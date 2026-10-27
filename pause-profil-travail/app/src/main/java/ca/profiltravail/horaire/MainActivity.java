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
    text("Vérification du profil professionnel",20);
    text("L'état affiché provient de la dernière lecture du bouton Samsung. Aucun basculement n'est effectué si l'état de la tuile est ambigu.",14);
    button("Tester la tuile sans rien changer",()->{
      Result r=WorkAccessService.request(this,null,false);
      message(r==Result.QUEUED?"Inspection lancée, actualise ensuite le diagnostic.":explain(r));
    });
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
    text("Configuration",20);
    text("1. Place la tuile « Applications professionnelles » dans les réglages rapides Samsung.\n2. Active le service d'accessibilité « Pause profil travail ».\n3. Autorise les alarmes exactes.",14);
    button("Activer l'accessibilité",()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
    text("Le service peut lire et manipuler l'interface. Il est limité aux événements de l'interface système et ne sauvegarde aucun contenu affiché.",14);
    button("Autoriser les alarmes exactes",()->{
      if(Build.VERSION.SDK_INT>=31)try{
        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));
      }catch(Exception e){message("Accès aux alarmes indisponible");}
    });
    text("Android 13+ : si l'accessibilité est grisée, ouvre Paramètres > Applications > Pause profil travail > menu ⋮ > Autoriser les paramètres restreints (seulement si tu fais confiance à ce code).",13);
    text("Aucun accès Internet ni collecte de données. L'automatisation peut ouvrir brièvement les réglages rapides.",13);
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
    message(r==Result.OK?"Horaire enregistré":r==Result.QUEUED?"Horaire enregistré. Vérification de la tuile en cours.":"Horaire enregistré. "+explain(r));
  }
  private static String explain(Result r){
    switch(r){
      case NO_SERVICE:return "Active le service d'accessibilité dans les paramètres.";
      case UNKNOWN_STATE:return "État du bouton impossible à lire. Aucun clic effectué.";
      case NOT_FOUND:return "Tuile du profil professionnel introuvable dans les réglages rapides.";
      case LOCKED:return "Téléphone verrouillé : action reportée au déverrouillage.";
      case QUEUED:return "Action en cours. Vérifie l\'état du profil.";
      case DENIED:return "Action bloquée par Android ou l'organisation.";
      default:return "OK";
    }
  }
  private void manual(boolean pause){
    Result r=setPaused(this,pause);refresh();
    message(r==Result.QUEUED?"Recherche du bouton Samsung en cours. Consulte le statut après l’opération.":explain(r));
  }
  private void refresh(){
    if(status==null)return;
    int state=pref(this).getInt("work_state",-1);
    String label=state<0?"non initialisé":state==1?"actif":"suspendu";
    String verify=pref(this).getBoolean("work_state_verified",false)?" (état lu sur la tuile)":" (non vérifié)";
    status.setText("Dernier état vérifié : "+label+(state<0?"":verify)+
      (pending(this)?"\\nAction reportée au déverrouillage":"")+"\\n"+
      pref(this).getString("work_message",""));
    permissionStatus.setText("Accessibilité : "+(WorkAccessService.isEnabled(this)?"OK":"à activer")
      +"\\nAlarmes exactes : "+(canExact(this)?"OK":"à autoriser"));
  }
  enum Result{OK,QUEUED,NO_SERVICE,UNKNOWN_STATE,NOT_FOUND,LOCKED,DENIED}
  private static Result setPaused(Context c,boolean pause){
    return WorkAccessService.request(c,pause,false);
  }
  static boolean isPending(Context c){return pending(c);}
  static void tryPending(Context c){
    if(pending(c)&&enabled(c))reconcile(c);
  }
  static void actionComplete(Context c,Boolean target,boolean automatic,boolean success,String detail){
    pref(c).edit().putString("work_message",detail).putLong("last_checked",System.currentTimeMillis()).apply();
    if(automatic){
      pending(c,false);
      if(!success)notifyFailure(c,detail);
    }
  }
  static void verified(Context c,boolean active){
    pref(c).edit().putInt("work_state",active?1:0).putBoolean("work_state_verified",true)
      .putLong("last_verified",System.currentTimeMillis()).apply();
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
    Result result=WorkAccessService.request(c,pause,true);
    boolean retry=result==Result.LOCKED||result==Result.NO_SERVICE;
    pending(c,retry);
    am.cancel(pendingIntent(c,RETRY,102));
    if(retry)alarm(c,System.currentTimeMillis()+15*60_000L,RETRY,102,false);
    return result;
  }
  public static final class Events extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent i){
      if(i==null)return;
      String a=i.getAction();if(a==null)return;
      if(RETRY.equals(a)||Intent.ACTION_USER_PRESENT.equals(a)){
        if(pending(c)&&enabled(c))reconcile(c);else{
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
