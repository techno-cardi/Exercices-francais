package ca.profiltravail.horaire;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.widget.*;
import java.time.*;
import java.util.*;

public final class MainActivity extends Activity {
  private static final String PKG = "ca.profiltravail.horaire";
  private static final String GRANT = "adb shell pm grant "+PKG+" android.permission.MODIFY_QUIET_MODE";
  private static final String ALARM = PKG+".ALARM", RETRY=PKG+".RETRY";
  private static final int WORKDAYS=62;
  private LinearLayout root;
  private final CheckBox[] days=new CheckBox[7];
  private CheckBox enabled;
  private Button fromButton,toButton;
  private TextView status,permissionStatus;
  private int from,to;
  private static android.content.SharedPreferences pref(Context c) { return c.getSharedPreferences("schedule",MODE_PRIVATE); }
  private static boolean enabled(Context c){return pref(c).getBoolean("enabled",false);}
  private static int days(Context c){return pref(c).getInt("days",WORKDAYS);}
  private static int from(Context c){return pref(c).getInt("from",8*60);}
  private static int to(Context c){return pref(c).getInt("to",17*60);}
  private static boolean pending(Context c){return pref(c).getBoolean("pending",false);}
  private static void pending(Context c,boolean value){pref(c).edit().putBoolean("pending",value).apply();}
  private static String time(int v){return String.format(Locale.CANADA_FRENCH,"%02d:%02d",v/60,v%60);}
  private static boolean workTime(Context c){
    ZonedDateTime n=ZonedDateTime.now();
    int minute=n.getHour()*60+n.getMinute(), bit=1<<n.getDayOfWeek().getValue();
    return enabled(c) && (days(c)&bit)!=0 && minute>=from(c) && minute<to(c);
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
    text("Autorisation initiale",20);
    text("Après l'installation, donne une seule fois cette autorisation depuis ton ordinateur avec ADB. Sans elle, l'application ne peut pas contrôler le profil.",14);
    text(GRANT,14);
    button("Copier la commande ADB",()->{
      ClipboardManager cm=getSystemService(ClipboardManager.class);
      cm.setPrimaryClip(ClipData.newPlainText("Commande ADB",GRANT));message("Commande copiée");
    });
    button("Autoriser les alarmes exactes",()->{
      if(Build.VERSION.SDK_INT>=31)try{
        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));
      }catch(Exception e){message("Accès aux alarmes indisponible");}
    });
    text("Aucun accès Internet, localisation, publicité ni service d'accessibilité.",14);
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
    if(from>=to){message("L'heure de reprise doit précéder l'heure de suspension.");return;}
    int bits=0;
    for(int i=0;i<7;i++)if(days[i].isChecked())bits|=1<<(i+1);
    if(enabled.isChecked()&&bits==0){message("Sélectionne au moins un jour.");return;}
    pref(this).edit().putBoolean("enabled",enabled.isChecked()).putInt("days",bits)
      .putInt("from",from).putInt("to",to).putBoolean("pending",false).apply();
    arm(this);Result r=reconcile(this);refresh();
    message(r==Result.OK?"Horaire enregistré":"Horaire enregistré. "+explain(r));
  }
  private static String explain(Result r){
    switch(r){
      case NO_PERMISSION:return "Autorisation ADB manquante.";
      case NO_PROFILE:return "Profil professionnel non trouvé.";
      case LOCKED:return "Déverrouillage du profil professionnel nécessaire.";
      case DENIED:return "Action bloquée par Android ou l'organisation.";
      default:return "OK";
    }
  }
  private void manual(boolean pause){
    Result r=setPaused(this,pause);refresh();
    message(r==Result.OK?(pause?"Profil suspendu":"Profil réactivé"):explain(r));
  }
  private void refresh(){
    if(status==null)return;
    Boolean paused=isPaused(this);
    status.setText("Profil : "+(paused==null?"introuvable":paused?"suspendu":"actif")
      +(pending(this)?" (réactivation en attente)":""));
    permissionStatus.setText("Autorisation ADB : "+(hasPermission(this)?"OK":"à accorder")
      +"\nAlarmes exactes : "+(canExact(this)?"OK":"à autoriser"));
  }
  enum Result{OK,NO_PERMISSION,NO_PROFILE,LOCKED,DENIED}
  private static boolean hasPermission(Context c){
    return c.checkSelfPermission("android.permission.MODIFY_QUIET_MODE")==PackageManager.PERMISSION_GRANTED;
  }
  private static UserHandle profile(Context c){
    UserManager um=c.getSystemService(UserManager.class);
    if(um==null)return null;
    UserHandle result=null;
    for(UserHandle u:um.getUserProfiles()){
      if(u.equals(Process.myUserHandle()))continue;
      if(result!=null)return null;
      result=u;
    }
    return result;
  }
  private static Boolean isPaused(Context c){
    UserHandle p=profile(c);
    if(p==null)return null;
    try{return c.getSystemService(UserManager.class).isQuietModeEnabled(p);}
    catch(RuntimeException e){return null;}
  }
  private static Result setPaused(Context c,boolean pause){
    if(!hasPermission(c))return Result.NO_PERMISSION;
    UserHandle p=profile(c);if(p==null)return Result.NO_PROFILE;
    try{
      UserManager um=c.getSystemService(UserManager.class);
      if(um.isQuietModeEnabled(p)==pause)return Result.OK;
      if(!pause){
        KeyguardManager key=c.getSystemService(KeyguardManager.class);
        if(key!=null&&key.isDeviceLocked())return Result.LOCKED;
        return um.requestQuietModeEnabled(false,p,UserManager.QUIET_MODE_DISABLE_ONLY_IF_CREDENTIAL_NOT_REQUIRED)
          ?Result.OK:Result.LOCKED;
      }
      return um.requestQuietModeEnabled(true,p)?Result.OK:Result.DENIED;
    }catch(RuntimeException e){return Result.DENIED;}
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
    ZonedDateTime now=ZonedDateTime.now();Instant next=null;
    for(int offset=0;offset<=8;offset++){
      LocalDate d=now.toLocalDate().plusDays(offset);
      if((days(c)&(1<<d.getDayOfWeek().getValue()))==0)continue;
      for(int minute:new int[]{from(c),to(c)}){
        Instant when=d.atTime(minute/60,minute%60).atZone(ZoneId.systemDefault()).toInstant();
        if(when.isAfter(now.toInstant())&&(next==null||when.isBefore(next)))next=when;
      }
    }
    if(next!=null)alarm(c,next.toEpochMilli(),ALARM,101,true);
  }
  private static Result reconcile(Context c){
    AlarmManager am=c.getSystemService(AlarmManager.class);
    if(!enabled(c)||days(c)==0){
      pending(c,false);am.cancel(pendingIntent(c,RETRY,102));return Result.OK;
    }
    boolean pause=!workTime(c);
    Result result=setPaused(c,pause);
    boolean retry=!pause&&result==Result.LOCKED;
    pending(c,retry);
    am.cancel(pendingIntent(c,RETRY,102));
    if(retry)alarm(c,System.currentTimeMillis()+5*60_000L,RETRY,102,false);
    return result;
  }
  public static final class Events extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent i){
      if(i==null)return;
      String a=i.getAction();if(a==null)return;
      if(RETRY.equals(a)||Intent.ACTION_USER_PRESENT.equals(a)){
        if(pending(c)&&workTime(c))reconcile(c);else{
          pending(c,false);c.getSystemService(AlarmManager.class).cancel(pendingIntent(c,RETRY,102));
        }
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
