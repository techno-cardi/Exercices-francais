package ca.profiltravail.horaire;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.widget.*;
import java.time.*;
import java.util.*;

public final class MainActivity extends Activity {
  private static final String PKG = "ca.profiltravail.horaire";
  private static final String ALARM = PKG+".ALARM", RETRY=PKG+".RETRY", VERIFY=PKG+".VERIFY";
  private static final int WORKDAYS=62;
  private LinearLayout root;
  private final CheckBox[] days=new CheckBox[7];
  private CheckBox enabled;
  private Button fromButton,toButton;
  private TextView status,permissionStatus;
  private int from,to;
  private static android.content.SharedPreferences pref(Context c) { return c.getSharedPreferences("quiet_schedule_v5",MODE_PRIVATE); }
  private static boolean enabled(Context c){return pref(c).getBoolean("enabled",false);}
  private static int days(Context c){return pref(c).getInt("days",WORKDAYS);}
  private static int from(Context c){return pref(c).getInt("from",8*60);}
  private static int to(Context c){return pref(c).getInt("to",17*60);}
  private static boolean pending(Context c){return pref(c).getBoolean("pending",false);}
  private static void pending(Context c,boolean value){pref(c).edit().putBoolean("pending",value).apply();}
  private static String time(int v){return String.format(Locale.CANADA_FRENCH,"%02d:%02d",v/60,v%60);}
  private static boolean workTime(Context c){
    return ScheduleLogic.isWorkTime(days(c),from(c),to(c),ZonedDateTime.now());
  }
  private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
  private void message(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
  private TextView text(String s,int size){
    TextView t=new TextView(this);t.setText(s);t.setTextSize(size);
    t.setTextColor(Color.rgb(28,44,65));t.setTextIsSelectable(true);
    t.setPadding(0,dp(7),0,dp(9));root.addView(t);return t;
  }
  private Button button(String label,Runnable run){
    Button b=new Button(this);b.setText(label);b.setAllCaps(false);
    b.setOnClickListener(v->run.run());root.addView(b);return b;
  }
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    from=from(this);to=to(this);
    ScrollView scroll=new ScrollView(this);root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(18),dp(18),dp(18),dp(25));
    scroll.addView(root);setContentView(scroll);
    text("Pause profil travail",25);
    text("Suspend automatiquement le profil professionnel. Les applications personnelles restent actives.",15);
    status=text("",18);permissionStatus=text("",14);
    text("Mode silencieux via Android. Aucun panneau de réglages rapides ni service d'accessibilité.",14);
    text("Autorisation ADB à accorder UNE FOIS après installation :",14);
    String command="adb shell pm grant ca.profiltravail.horaire android.permission.MODIFY_QUIET_MODE";
    text(command,14);
    button("Copier la commande ADB",()->{
      ((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("Commande ADB",command));
      message("Commande copiée.");
    });
    text("Vérification : réussis une suspension ET une réactivation avec les boutons manuels avant d'activer l'horaire.",14);
    button("Actualiser",this::refresh);
    text("Programmation",20);
    enabled=new CheckBox(this);enabled.setText("Activer la programmation");
    enabled.setChecked(enabled(this));root.addView(enabled);
    String[] names={"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"};
    int current=days(this);
    for(int i=0;i<7;i++){
      CheckBox c=new CheckBox(this);c.setText(names[i]);c.setChecked((current&(1<<(i+1)))!=0);
      days[i]=c;root.addView(c);
    }
    fromButton=button("Réactiver à "+time(from),()->choose(true));
    toButton=button("Suspendre à "+time(to),()->choose(false));
    text("Le profil reste suspendu les jours non sélectionnés, notamment les fins de semaine.",14);
    button("Enregistrer l'horaire",this::save);
    text("Commande manuelle",20);
    button("Suspendre maintenant",()->manual(true));
    button("Réactiver maintenant",()->manual(false));
    button("Autoriser les notifications d’échec (facultatif)",()->{
      if(Build.VERSION.SDK_INT>=33 &&
          checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)
        requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},7);
      else message("Notifications déjà autorisées, si Android ne les bloque pas.");
    });
    text("Configuration et fiabilité",20);
    text("Installe l'application dans ton profil PERSONNEL. Accorde la permission ADB après installation.",14);
    button("Autoriser les alarmes exactes",()->{
      if(Build.VERSION.SDK_INT>=31)try{
        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));
      }catch(Exception e){message("Accès aux alarmes indisponible");}
    });
    button("Réglages de batterie",()->startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)));
    text("Si le téléphone est verrouillé lors de la reprise, elle sera retentée après le déverrouillage. Une politique de NIP professionnel distinct peut bloquer la reprise silencieuse.",13);
    text("Sans Internet, sans accessibilité, sans lecture des données du travail.",13);
    refresh();
  }
  @Override protected void onResume(){super.onResume();if(status!=null)refresh();}
  private void choose(boolean start){
    int min=start?from:to;
    new TimePickerDialog(this,(v,h,m)->{
      if(start){from=h*60+m;fromButton.setText("Réactiver à "+time(from));}
      else{to=h*60+m;toButton.setText("Suspendre à "+time(to));}
    },min/60,min%60,true).show();
  }
  private void save(){
    if(from>=to){message("La reprise doit précéder l'heure de suspension.");return;}
    int bits=0;
    for(int i=0;i<7;i++)if(days[i].isChecked())bits|=1<<(i+1);
    if(enabled.isChecked()&&bits==0){message("Choisis au moins un jour.");return;}
    if(enabled.isChecked()&&!ProfileBackend.authorized(this)){message("Accorde d'abord la permission ADB.");return;}
    if(enabled.isChecked()&&!tested(this)){message("Réussis les deux tests manuels avant d'activer l'horaire.");return;}
    if(enabled.isChecked()&&!canExact(this)){message("Autorise les alarmes exactes d'abord.");return;}
    pref(this).edit().putBoolean("enabled",enabled.isChecked()).putInt("days",bits)
      .putInt("from",from).putInt("to",to).putBoolean("pending",false).apply();
    arm(this);
    if(enabled.isChecked())reconcile(this);
    else{
      getSystemService(AlarmManager.class).cancel(pendingIntent(this,RETRY,102));
      getSystemService(AlarmManager.class).cancel(pendingIntent(this,VERIFY,103));
      record(this,"Horaire désactivé, profil inchangé.");
    }
    refresh();message("Horaire enregistré.");
  }
  private static boolean tested(Context c){
    return pref(c).getBoolean("test_pause",false)&&pref(c).getBoolean("test_resume",false);
  }
  private static void record(Context c,String message){
    pref(c).edit().putString("work_message",message).putLong("last_checked",System.currentTimeMillis()).apply();
  }
  private void manual(boolean pause){
    ProfileBackend.Result result=ProfileBackend.change(this,pause);
    record(this,result.info);
    if(!result.accepted){message(result.info);refresh();return;}
    if(!result.changed){
      message("Déjà dans cet état. Teste une vraie transition pour valider.");refresh();return;
    }
    message(result.info+" Vérification en cours.");
    new Handler(Looper.getMainLooper()).postDelayed(()->{
      ProfileBackend.State state=ProfileBackend.inspect(this);
      if(state.paused!=null&&state.paused==pause){
        pref(this).edit().putBoolean(pause?"test_pause":"test_resume",true).apply();
        record(this,(pause?"Suspension":"Réactivation")+" confirmée par Android.");
        message("Test réussi.");
      }else{
        record(this,"Transition non confirmée. "+state.info);
        message("Test non confirmé : vois le diagnostic.");
      }
      refresh();
    },1600);
  }
  private void refresh(){
    if(status==null)return;
    ProfileBackend.State state=ProfileBackend.inspect(this);
    status.setText("Profil : "+(state.paused==null?"non détecté":state.paused?"SUSPENDU":"ACTIF")
      +"\n"+state.info);
    permissionStatus.setText("Autorisation ADB : "+(ProfileBackend.authorized(this)?"OK":"à accorder")
      +"\nAlarmes exactes : "+(canExact(this)?"OK":"à autoriser")
      +"\nTest suspension : "+(pref(this).getBoolean("test_pause",false)?"réussi":"non validé")
      +"\nTest réactivation : "+(pref(this).getBoolean("test_resume",false)?"réussi":"non validé")
      +"\nHoraire : "+(enabled(this)?"ACTIF":"désactivé")
      +"\nDernier événement : "+pref(this).getString("work_message","Aucun")
      +(pending(this)?"\nReprise en attente du déverrouillage.":""));
  }
  private static void notifyFailure(Context c,String detail){
    NotificationManager nm=c.getSystemService(NotificationManager.class);
    if(nm==null)return;
    String channel="work_failure";
    nm.createNotificationChannel(new NotificationChannel(channel,"Alertes profil travail",NotificationManager.IMPORTANCE_DEFAULT));
    if(Build.VERSION.SDK_INT>=33 &&
       c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)return;
    PendingIntent open=PendingIntent.getActivity(c,99,new Intent(c,MainActivity.class),
      PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    Notification notification=new Notification.Builder(c,channel)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle("Profil travail : action non confirmée")
      .setContentText(detail).setStyle(new Notification.BigTextStyle().bigText(detail))
      .setAutoCancel(true).setContentIntent(open).build();
    nm.notify(34,notification);
  }
  private static PendingIntent pendingIntent(Context c,String action,int code){
    Intent i=new Intent(c,Events.class).setAction(action);
    return PendingIntent.getBroadcast(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  private static boolean canExact(Context c){
    AlarmManager a=c.getSystemService(AlarmManager.class);
    return Build.VERSION.SDK_INT<31||a.canScheduleExactAlarms();
  }
  private static void alarm(Context c,long millis,String action,int code,boolean exact){
    AlarmManager a=c.getSystemService(AlarmManager.class);
    PendingIntent p=pendingIntent(c,action,code);
    if(exact&&canExact(c)){
      try{a.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,millis,p);return;}
      catch(SecurityException ignored){}
    }
    a.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,millis,p);
  }
  private static void arm(Context c){
    AlarmManager a=c.getSystemService(AlarmManager.class);
    a.cancel(pendingIntent(c,ALARM,101));
    if(!enabled(c)||days(c)==0)return;
    Instant next=ScheduleLogic.nextTransition(days(c),from(c),to(c),ZonedDateTime.now());
    if(next!=null)alarm(c,next.toEpochMilli(),ALARM,101,true);
  }
  private static void reconcile(Context c){
    AlarmManager am=c.getSystemService(AlarmManager.class);
    if(!enabled(c)){
      pending(c,false);
      am.cancel(pendingIntent(c,RETRY,102));
      return;
    }
    if(!ProfileBackend.authorized(c)||!tested(c)){
      record(c,"Permission ADB ou tests manquants. Programmation non exécutée.");
      notifyFailure(c,"Contrôle la permission et les tests de l'application.");
      return;
    }
    boolean pause=!workTime(c);
    ProfileBackend.Result result=ProfileBackend.change(c,pause);
    record(c,result.info);
    am.cancel(pendingIntent(c,RETRY,102));
    pending(c,result.deferred);
    if(result.deferred){
      alarm(c,System.currentTimeMillis()+10*60_000L,RETRY,102,false);
      return;
    }
    if(!result.accepted){
      notifyFailure(c,result.info);
      return;
    }
    if(result.changed){
      pref(c).edit().putBoolean("verify_target",pause).apply();
      alarm(c,System.currentTimeMillis()+7000L,VERIFY,103,false);
    }
  }
  private static void verify(Context c){
    if(!enabled(c))return;
    Boolean state=ProfileBackend.inspect(c).paused;
    boolean desired=pref(c).getBoolean("verify_target",false);
    if(state==null||state!=desired){
      record(c,"Changement non confirmé par Android.");
      notifyFailure(c,"Changement du profil non confirmé.");
    }else record(c,desired?"Suspension confirmée.":"Réactivation confirmée.");
  }
  public static final class Events extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent i){
      if(i==null)return;
      String a=i.getAction();if(a==null)return;
      if(VERIFY.equals(a)){verify(c);return;}
      if(RETRY.equals(a)||Intent.ACTION_USER_PRESENT.equals(a)){
        if(pending(c)&&enabled(c))reconcile(c);
        return;
      }
      if(ALARM.equals(a)||Intent.ACTION_BOOT_COMPLETED.equals(a)||
         Intent.ACTION_TIME_CHANGED.equals(a)||Intent.ACTION_TIMEZONE_CHANGED.equals(a)||
         Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)||
         AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(a)){
        reconcile(c);arm(c);
      }
    }
  }
}
