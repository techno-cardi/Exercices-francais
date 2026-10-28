package ca.profiltravail.horaire;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Persists the desired schedule; alarms remain passive until explicit activation. */
public final class ScheduleEngine {
  public static final String ALARM="ca.profiltravail.horaire.ALARM";
  public static final String RETRY="ca.profiltravail.horaire.RETRY";
  public static final String VERIFY="ca.profiltravail.horaire.VERIFY";
  private static final String CHANNEL="work_profile_errors";
  private static final int DEFAULT_DAYS=62, RETRY_MINUTES=15;
  private ScheduleEngine(){}

  public static android.content.SharedPreferences prefs(Context c){
    return c.getSharedPreferences("quiet_schedule_v5",Context.MODE_PRIVATE);
  }
  public static boolean enabled(Context c){return prefs(c).getBoolean("enabled",false);}
  public static int days(Context c){return prefs(c).getInt("days",DEFAULT_DAYS);}
  public static int from(Context c){return prefs(c).getInt("from",8*60);}
  public static int to(Context c){return prefs(c).getInt("to",17*60);}
  public static boolean tested(Context c){
    return prefs(c).getBoolean("test_pause",false)&&prefs(c).getBoolean("test_resume",false);
  }
  public static boolean canExact(Context c){
    AlarmManager a=c.getSystemService(AlarmManager.class);
    return a!=null && (Build.VERSION.SDK_INT<31||a.canScheduleExactAlarms());
  }
  public static boolean batteryRestricted(Context c){
    android.os.PowerManager p=c.getSystemService(android.os.PowerManager.class);
    return p!=null && !p.isIgnoringBatteryOptimizations(c.getPackageName());
  }
  public static boolean intendedPause(Context c){
    return !ScheduleLogic.isWorkTime(days(c),from(c),to(c),ZonedDateTime.now());
  }
  public static Instant next(Context c){
    return ScheduleLogic.nextTransition(days(c),from(c),to(c),ZonedDateTime.now());
  }
  public static String nextText(Context c){
    Instant next=next(c);
    if(!enabled(c)||next==null)return "Aucun changement programmé";
    return DateTimeFormatter.ofPattern("EEE d MMM • HH:mm",Locale.CANADA_FRENCH)
      .format(next.atZone(ZoneId.systemDefault()));
  }
  public static void log(Context c,String message){
    String date=ZonedDateTime.now().format(DateTimeFormatter.ofPattern("d MMM HH:mm",Locale.CANADA_FRENCH));
    prefs(c).edit().putString("last_message",message).putString("last_date",date).apply();
  }
  public static void markTest(Context c,boolean pause){
    prefs(c).edit().putBoolean(pause?"test_pause":"test_resume",true).apply();
  }
  private static PendingIntent pi(Context c,String action,int code){
    return PendingIntent.getBroadcast(c,code,new Intent(c,Receiver.class).setAction(action),
      PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  }
  private static void cancel(Context c,String action,int code){
    AlarmManager am=c.getSystemService(AlarmManager.class);
    if(am!=null)am.cancel(pi(c,action,code));
  }
  private static boolean alarm(Context c,String action,int code,long epoch,boolean exact){
    AlarmManager am=c.getSystemService(AlarmManager.class);
    if(am==null)return false;
    if(exact){
      if(!canExact(c))return false;
      try{
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,epoch,pi(c,action,code));
        return true;
      }catch(SecurityException e){return false;}
    }
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,epoch,pi(c,action,code));
    return true;
  }
  public static void arm(Context c){
    cancel(c,ALARM,101);
    prefs(c).edit().remove("next_epoch").apply();
    if(!enabled(c))return;
    Instant transition=next(c);
    if(transition!=null){
      if(alarm(c,ALARM,101,transition.toEpochMilli(),true))
        prefs(c).edit().putLong("next_epoch",transition.toEpochMilli()).apply();
      else{log(c,"Impossible de programmer une alarme exacte.");warn(c,"Active l'accès Alarmes et rappels.");}
    }
  }
  /** A fresh schedule always supersedes an old pending resume or verification. */
  public static void save(Context c,boolean active,int mask,int start,int end){
    cancel(c,ALARM,101);cancel(c,RETRY,102);cancel(c,VERIFY,103);
    prefs(c).edit().putBoolean("enabled",active).putInt("days",mask)
      .putInt("from",start).putInt("to",end)
      .putBoolean("pending_resume",false).remove("verify_epoch").apply();
    if(active){arm(c);reconcile(c);}
    else log(c,"Programmation désactivée. Le profil est resté inchangé.");
  }
  public static void reconcile(Context c){
    if(!enabled(c))return;
    if(!ProfileBackend.authorized(c)||!tested(c)){
      log(c,"Autorisation ou tests non validés : action annulée.");
      warn(c,"Vérifie la permission ADB et les deux tests.");return;
    }
    boolean pause=intendedPause(c);
    ProfileBackend.Result result=ProfileBackend.change(c,pause);
    log(c,result.info);
    cancel(c,RETRY,102);
    if(result.deferred){
      prefs(c).edit().putBoolean("pending_resume",true).apply();
      alarm(c,RETRY,102,System.currentTimeMillis()+RETRY_MINUTES*60000L,false);
      return;
    }
    prefs(c).edit().putBoolean("pending_resume",false).apply();
    if(!result.accepted){warn(c,result.info);return;}
    if(result.changed){
      long time=System.currentTimeMillis()+60_000L;
      prefs(c).edit().putBoolean("verify_target",pause).putLong("verify_epoch",time).apply();
      alarm(c,VERIFY,103,time,false);
    }
  }
  public static void verify(Context c){
    if(!enabled(c))return;
    android.content.SharedPreferences pref=prefs(c);
    if(!pref.contains("verify_epoch"))return;
    pref.edit().remove("verify_epoch").apply();
    boolean target=pref.getBoolean("verify_target",false);
    Boolean state=ProfileBackend.inspect(c).paused;
    if(state==null||state!=target){
      log(c,"Transition non confirmée. Vérifie le profil.");
      warn(c,"Le profil n'a pas atteint l'état attendu.");
    }else log(c,"Transition confirmée : "+(target?"profil suspendu.":"profil actif."));
  }
  public static void warn(Context c,String reason){
    NotificationManager nm=c.getSystemService(NotificationManager.class);
    if(nm==null)return;
    nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Erreurs de programmation",
      NotificationManager.IMPORTANCE_DEFAULT));
    if(Build.VERSION.SDK_INT>=33&&
       c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    PendingIntent open=PendingIntent.getActivity(c,14,
      new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP),
      PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    Notification n=new Notification.Builder(c,CHANNEL)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle("Profil professionnel : action à vérifier")
      .setContentText(reason).setStyle(new Notification.BigTextStyle().bigText(reason))
      .setAutoCancel(true).setContentIntent(open).build();
    nm.notify(53,n);
  }
  public static final class Receiver extends BroadcastReceiver{
    @Override public void onReceive(Context c,Intent i){
      if(i==null||i.getAction()==null)return;
      String action=i.getAction();
      if(VERIFY.equals(action)){verify(c);return;}
      if(RETRY.equals(action)){
        if(enabled(c)&&prefs(c).getBoolean("pending_resume",false))reconcile(c);
        return;
      }
      if(Intent.ACTION_USER_PRESENT.equals(action)){
        if(enabled(c)&&prefs(c).getBoolean("pending_resume",false))reconcile(c);
        return;
      }
      if(ALARM.equals(action)||Intent.ACTION_BOOT_COMPLETED.equals(action)||
         Intent.ACTION_TIME_CHANGED.equals(action)||Intent.ACTION_TIMEZONE_CHANGED.equals(action)||
         Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)||
         AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action)){
        if(!enabled(c))return;
        // Re-arm first; always recompute desired state at delivery, not at scheduling time.
        arm(c);
        reconcile(c);
      }
    }
  }
}
