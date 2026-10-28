package ca.profiltravail.horaire;

import android.Manifest;
import android.app.Activity;
import android.app.TimePickerDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;

public final class MainActivity extends Activity {
  private static final int BG=0xfff5f7fb, NAVY=0xff152843, TEXT=0xff1c2b43;
  private static final int MUTED=0xff697b96, BLUE=0xff315fcf, TEAL=0xff007c73;
  private static final int BORDER=0xffe2e9f3, AMBER=0xffb56613, WHITE=Color.WHITE;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private LinearLayout page;
  private TextView profileState,profileDetails,permissionBadge,alarmBadge,testPauseBadge,testResumeBadge;
  private TextView nextLabel,history;
  private CheckBox scheduleSwitch;
  private final CheckBox[] days=new CheckBox[7];
  private Button beginTimeButton,endTimeButton;
  private int beginMinute,endMinute;
  private boolean testing=false;

  private int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
  private GradientDrawable shape(int color,int radius,int stroke){
    GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));
    if(stroke!=0)d.setStroke(dp(1),stroke);
    return d;
  }
  private TextView text(String value,int size,int color,boolean bold){
    TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(size);
    if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    v.setIncludeFontPadding(true);return v;
  }
  private LinearLayout stack(){
    LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;
  }
  private LinearLayout.LayoutParams lp(int width,int height,int bottom){
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height);
    p.bottomMargin=dp(bottom);return p;
  }
  private LinearLayout card(String heading,String subtitle){
    LinearLayout l=stack();l.setPadding(dp(18),dp(17),dp(18),dp(18));
    l.setBackground(shape(WHITE,22,BORDER));
    page.addView(l,lp(-1,-2,13));
    TextView h=text(heading,17,NAVY,true);l.addView(h,lp(-1,-2,3));
    if(subtitle!=null&&!subtitle.isEmpty()){
      TextView sub=text(subtitle,13,MUTED,false);l.addView(sub,lp(-1,-2,12));
    }else l.addView(new View(this),lp(1,dp(8),0));
    return l;
  }
  private void addLine(LinearLayout l,String title,String description){
    l.addView(text(title,14,TEXT,true),lp(-1,-2,3));
    l.addView(text(description,13,MUTED,false),lp(-1,-2,13));
  }
  private Button action(LinearLayout l,String label,boolean primary,Runnable click){
    Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(14);
    b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    b.setTextColor(primary?WHITE:BLUE);
    b.setBackground(shape(primary?BLUE:0xffedf2fd,13,0));
    b.setPadding(dp(12),dp(10),dp(12),dp(10));
    b.setMinHeight(dp(48));
    LinearLayout.LayoutParams p=lp(-1,dp(48),9);
    l.addView(b,p);b.setOnClickListener(v->click.run());return b;
  }
  private TextView capsule(LinearLayout l,String value){
    TextView badge=text(value,12,BLUE,true);
    badge.setPadding(dp(11),dp(7),dp(11),dp(7));
    badge.setBackground(shape(0xffedf2ff,100,0));
    LinearLayout.LayoutParams p=lp(-2,-2,9);l.addView(badge,p);return badge;
  }
  private void setCapsule(TextView badge,boolean good,String ok,String bad){
    badge.setText(good?ok:bad);
    badge.setTextColor(good?TEAL:AMBER);
    badge.setBackground(shape(good?0xffe7f7f3:0xfffff3e5,100,0));
  }
  private void toast(String msg){Toast.makeText(this,msg,Toast.LENGTH_LONG).show();}
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    beginMinute=ScheduleEngine.from(this);endMinute=ScheduleEngine.to(this);
    ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(BG);
    page=stack();page.setPadding(dp(16),dp(18),dp(16),dp(38));
    scroll.addView(page);setContentView(scroll);

    LinearLayout hero=stack();
    hero.setPadding(dp(22),dp(23),dp(22),dp(21));hero.setBackground(shape(NAVY,24,0));
    page.addView(hero,lp(-1,-2,13));
    TextView small=text("AUTOMATISATION PRIVÉE  •  V6",11,0xffb8d3ff,true);
    hero.addView(small,lp(-1,-2,8));
    hero.addView(text("Pause profil travail",25,WHITE,true),lp(-1,-2,7));
    hero.addView(text("Ton travail, à tes heures. Suspension silencieuse du vrai profil professionnel.",14,0xffd7e4fa,false));

    LinearLayout state=card("État du profil","Lecture directe d'Android, sans ouvrir les réglages rapides.");
    profileState=text("Vérification...",25,NAVY,true);state.addView(profileState,lp(-1,-2,5));
    profileDetails=text("",13,MUTED,false);state.addView(profileDetails,lp(-1,-2,12));
    action(state,"Actualiser l'état",false,this::refresh);

    LinearLayout config=card("01  •  Mise en route","Trois éléments à vérifier avant l'automatisation.");
    addLine(config,"Autorisation Android","Accordée une seule fois depuis un ordinateur avec ADB.");
    permissionBadge=capsule(config,"Vérification...");
    String cmd="adb shell pm grant ca.profiltravail.horaire android.permission.MODIFY_QUIET_MODE";
    TextView command=text(cmd,12,NAVY,false);
    command.setTextIsSelectable(true);command.setPadding(dp(12),dp(11),dp(12),dp(11));
    command.setBackground(shape(0xfff2f5fa,12,0));config.addView(command,lp(-1,-2,9));
    action(config,"Copier la commande ADB",false,()->{
      ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("Commande ADB",cmd));
      toast("Commande ADB copiée.");
    });
    addLine(config,"Alarmes et rappels","Nécessaires pour exécuter l'horaire aux heures choisies.");
    alarmBadge=capsule(config,"Vérification...");
    action(config,"Ouvrir les autorisations d'alarme",false,()->{
      if(Build.VERSION.SDK_INT>=31)try{
        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:"+getPackageName())));
      }catch(Exception ex){toast("Paramètres > Applications > Accès spécial > Alarmes et rappels.");}
      else toast("Autorisation non nécessaire sur cette version d'Android.");
    });

    LinearLayout test=card("02  •  Tester la connexion","Obligatoire avant toute activation de l'horaire. Une vraie transition est nécessaire pour chaque test.");
    testPauseBadge=capsule(test,"Suspension à tester");
    action(test,"Suspendre maintenant",true,()->manual(true));
    testResumeBadge=capsule(test,"Réactivation à tester");
    action(test,"Réactiver maintenant",false,()->manual(false));

    LinearLayout schedule=card("03  •  Ton horaire","Le profil sera actif seulement pendant les plages sélectionnées.");
    scheduleSwitch=new CheckBox(this);scheduleSwitch.setText("Activer l'automatisation");
    scheduleSwitch.setTextSize(15);scheduleSwitch.setTextColor(NAVY);
    scheduleSwitch.setButtonTintList(ColorStateList.valueOf(BLUE));
    scheduleSwitch.setChecked(ScheduleEngine.enabled(this));
    schedule.addView(scheduleSwitch,lp(-1,dp(48),10));
    schedule.addView(text("JOURS DE TRAVAIL",11,MUTED,true),lp(-1,-2,9));

    String[] names={"LUN","MAR","MER","JEU","VEN","SAM","DIM"};
    for(int row=0;row<2;row++){
      LinearLayout group=new LinearLayout(this);group.setOrientation(LinearLayout.HORIZONTAL);
      schedule.addView(group,lp(-1,-2,9));
      int count=row==0?4:3;
      for(int col=0;col<count;col++){
        int idx=row*4+col;
        CheckBox chip=new CheckBox(this);
        chip.setText(names[idx]);chip.setTextSize(12);chip.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);chip.setButtonDrawable(null);
        chip.setChecked((ScheduleEngine.days(this)&(1<<(idx+1)))!=0);
        chip.setPadding(dp(4),dp(11),dp(4),dp(11));
        chip.setOnCheckedChangeListener((button,checked)->styleChip(chip,checked));
        styleChip(chip,chip.isChecked());
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,dp(44),1);
        cp.rightMargin=col==count-1?0:dp(7);group.addView(chip,cp);days[idx]=chip;
      }
    }
    beginTimeButton=action(schedule,"Reprendre à  "+fmt(beginMinute),false,()->pick(true));
    endTimeButton=action(schedule,"Suspendre à  "+fmt(endMinute),false,()->pick(false));
    TextView caveat=text("En activant et en enregistrant, l'application appliquera immédiatement l'état prévu pour l'heure actuelle.",12,MUTED,false);
    schedule.addView(caveat,lp(-1,-2,12));
    action(schedule,"Enregistrer et appliquer l'horaire",true,this::save);
    nextLabel=text("",13,TEAL,true);schedule.addView(nextLabel,lp(-1,-2,0));

    LinearLayout diagnostics=card("Informations et fiabilité","Aucune fenêtre ne s'ouvre pendant les actions automatiques.");
    history=text("",13,TEXT,false);diagnostics.addView(history,lp(-1,-2,12));
    action(diagnostics,"Vérifier les restrictions de batterie",false,()->{
      try{startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));}
      catch(Exception e){toast("Paramètres > Applications > Pause profil travail > Batterie.");}
    });
    action(diagnostics,"Autoriser les alertes d'échec (facultatif)",false,()->{
      if(Build.VERSION.SDK_INT>=33 &&
         checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},8);
      else toast("Notifications déjà autorisées, si Android ne les bloque pas.");
    });
    TextView foot=text("Sans Internet, sans publicité, sans accessibilité. La reprise peut être reportée si Android exige de déverrouiller le profil professionnel. Une restriction de l'employeur peut empêcher l'action.",12,MUTED,false);
    page.addView(foot,lp(-1,-2,0));
    refresh();
  }
  private void styleChip(CheckBox chip,boolean checked){
    chip.setTextColor(checked?BLUE:MUTED);
    chip.setBackground(shape(checked?0xffe8efff:0xfff3f5f9,12,checked?0xff9db8f5:BORDER));
  }
  private String fmt(int mins){return String.format(Locale.CANADA_FRENCH,"%02d:%02d",mins/60,mins%60);}
  @Override protected void onResume(){super.onResume();if(profileState!=null)refresh();}
  private void pick(boolean start){
    int value=start?beginMinute:endMinute;
    new TimePickerDialog(this,(picker,h,m)->{
      if(start){beginMinute=h*60+m;beginTimeButton.setText("Reprendre à  "+fmt(beginMinute));}
      else{endMinute=h*60+m;endTimeButton.setText("Suspendre à  "+fmt(endMinute));}
    },value/60,value%60,true).show();
  }
  private void manual(boolean pause){
    if(testing){toast("Un test est déjà en cours.");return;}
    ProfileBackend.Result r=ProfileBackend.change(this,pause);
    ScheduleEngine.log(this,r.info);refresh();
    if(!r.accepted){toast(r.info);return;}
    if(!r.changed){
      toast("Le profil est déjà dans cet état. Une vraie transition est nécessaire pour valider le test.");return;
    }
    testing=true;
    toast("Commande envoyée. Vérification auprès d'Android...");
    handler.postDelayed(()->{
      ProfileBackend.State state=ProfileBackend.inspect(this);
      if(state.paused!=null && state.paused==pause){
        ScheduleEngine.markTest(this,pause);
        ScheduleEngine.log(this,(pause?"Suspension":"Réactivation")+" confirmée par Android.");
        toast("Test "+(pause?"de suspension":"de réactivation")+" réussi.");
      }else{
        ScheduleEngine.log(this,"Test non confirmé : "+state.info);
        toast("Test non confirmé. Regarde le diagnostic.");
      }
      testing=false;refresh();
    },1800);
  }
  private void save(){
    if(beginMinute>=endMinute){toast("L'heure de reprise doit précéder celle de suspension.");return;}
    int mask=0;for(int i=0;i<7;i++)if(days[i].isChecked())mask|=1<<(i+1);
    if(scheduleSwitch.isChecked()&&mask==0){toast("Sélectionne au moins un jour.");return;}
    if(scheduleSwitch.isChecked()){
      if(!ProfileBackend.authorized(this)){toast("Accorde d'abord la permission ADB.");return;}
      if(!ScheduleEngine.tested(this)){toast("Les tests de suspension et de reprise doivent réussir.");return;}
      if(!ScheduleEngine.canExact(this)){toast("Autorise d'abord les alarmes exactes.");return;}
    }
    ScheduleEngine.save(this,scheduleSwitch.isChecked(),mask,beginMinute,endMinute);
    refresh();toast(scheduleSwitch.isChecked()?"Horaire activé et appliqué.":"Horaire désactivé.");
  }
  private void refresh(){
    ProfileBackend.State state=ProfileBackend.inspect(this);
    profileState.setText(state.paused==null?"État indisponible":state.paused?"Profil suspendu":"Profil actif");
    profileState.setTextColor(state.paused==null?AMBER:state.paused?BLUE:TEAL);
    profileDetails.setText(state.info);
    setCapsule(permissionBadge,ProfileBackend.authorized(this),"AUTORISÉE","À ACCORDER AVEC ADB");
    setCapsule(alarmBadge,ScheduleEngine.canExact(this),"ALARMES PRÊTES","AUTORISATION NÉCESSAIRE");
    setCapsule(testPauseBadge,ScheduleEngine.prefs(this).getBoolean("test_pause",false),"SUSPENSION VALIDÉE","SUSPENSION À TESTER");
    setCapsule(testResumeBadge,ScheduleEngine.prefs(this).getBoolean("test_resume",false),"RÉACTIVATION VALIDÉE","RÉACTIVATION À TESTER");
    nextLabel.setText(ScheduleEngine.enabled(this)?"Prochain changement : "+ScheduleEngine.nextText(this):
      "Programmation actuellement désactivée");
    android.content.SharedPreferences pref=ScheduleEngine.prefs(this);
    String pending=pref.getBoolean("pending_resume",false)?"\n• Reprise en attente du déverrouillage":"";
    history.setText("Dernier événement : "+pref.getString("last_message","Aucun événement enregistré.")+
      "\nÉtat de l'horaire : "+(ScheduleEngine.enabled(this)?"ACTIVÉ":"DÉSACTIVÉ")+
      "\nBatterie : "+(ScheduleEngine.batteryRestricted(this)?"optimisation active (peut retarder l'horaire)":"optimisation désactivée")+
      "\nDernière mise à jour : "+pref.getString("last_date","—")+pending);
  }
}
