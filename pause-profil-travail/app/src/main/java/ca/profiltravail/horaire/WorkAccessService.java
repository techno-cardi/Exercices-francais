package ca.profiltravail.horaire;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Safe, explicit UI automation: no Internet, no ADB, no unknown-state toggle. */
public final class WorkAccessService extends AccessibilityService {
  private static volatile WorkAccessService instance;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final Runnable scanRunnable=this::scan;
  private static final String[] LABELS={
    "applications professionnelles","application professionnelle","applis professionnelles",
    "profil professionnel","work apps","work profile","work mode"
  };
  private Boolean target; // null means inspect-only
  private boolean scheduled,running,clicked,openedShade,expanded;
  private int scans;
  private long lastRetry;
  static boolean isEnabled(Context c){
    AccessibilityManager m=c.getSystemService(AccessibilityManager.class);
    if(m==null)return false;
    for(AccessibilityServiceInfo s:m.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)){
      if(s.getResolveInfo()!=null&&s.getResolveInfo().serviceInfo!=null &&
         c.getPackageName().equals(s.getResolveInfo().serviceInfo.packageName) &&
         s.getResolveInfo().serviceInfo.name.endsWith(".WorkAccessService"))return true;
    }
    return false;
  }
  static MainActivity.Result request(Context c,Boolean desired,boolean automatic){
    WorkAccessService s=instance;
    if(s==null)return MainActivity.Result.NO_SERVICE;
    KeyguardManager km=c.getSystemService(KeyguardManager.class);
    if(km!=null&&km.isDeviceLocked())return MainActivity.Result.LOCKED;
    s.handler.post(()->s.begin(desired,automatic));
    return MainActivity.Result.QUEUED;
  }
  @Override protected void onServiceConnected(){
    super.onServiceConnected();instance=this;
    handler.postDelayed(()->MainActivity.tryPending(this),1100);
  }
  @Override public void onAccessibilityEvent(AccessibilityEvent e){
    // Never cancel/reschedule scanner on repeated UI events; prevents scan starvation.
    if(!running&&MainActivity.isPending(this)){
      KeyguardManager km=getSystemService(KeyguardManager.class);
      long now=SystemClock.elapsedRealtime();
      if(now-lastRetry>12000&&(km==null||!km.isDeviceLocked())){
        lastRetry=now;
        handler.post(()->MainActivity.tryPending(this));
      }
    }
  }
  @Override public void onInterrupt(){}
  @Override public void onDestroy(){
    if(instance==this)instance=null;
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }
  private void begin(Boolean desired,boolean automatic){
    if(running)end(false,"L'ancienne opération a été interrompue.");
    target=desired;scheduled=automatic;running=true;clicked=false;openedShade=false;expanded=false;scans=0;
    if(!performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)){
      end(false,"Impossible d'ouvrir les réglages rapides.");return;
    }
    openedShade=true;
    handler.removeCallbacks(scanRunnable);
    handler.postDelayed(scanRunnable,650);
  }
  private void scan(){
    if(!running)return;
    if(++scans>15){
      end(false,clicked?"Commande envoyée, résultat impossible à confirmer.":
        "Tuile du profil professionnel introuvable. Aucun clic effectué.");
      return;
    }
    AccessibilityNodeInfo tile=findTile();
    if(tile==null){
      if(scans==6&&!expanded){
        expanded=true;
        performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
      }
      handler.postDelayed(scanRunnable,500);return;
    }
    Boolean active=readState(tile);
    if(active!=null)MainActivity.verified(this,active);
    if(target==null){
      end(active!=null,active==null?"Tuile trouvée mais état ON/OFF illisible. Aucun clic.":
        active?"Profil ACTIF confirmé sur la tuile.":"Profil SUSPENDU confirmé sur la tuile.");
      return;
    }
    if(active==null){
      end(false,clicked?"Commande envoyée, résultat non vérifiable.":
        "État ON/OFF illisible. Aucun clic pour éviter une inversion.");
      return;
    }
    if(active==!target){
      end(true,clicked?"Changement confirmé sur la tuile Samsung.":
        "Le profil est déjà dans l'état demandé.");
      return;
    }
    if(clicked){
      // Never click twice, even if Samsung is slow to update its state.
      handler.postDelayed(scanRunnable,500);return;
    }
    AccessibilityNodeInfo action=clickableAncestor(tile);
    if(action==null||!action.performAction(AccessibilityNodeInfo.ACTION_CLICK)){
      end(false,"Tuile trouvée mais Android refuse le clic.");
      return;
    }
    clicked=true;
    handler.postDelayed(scanRunnable,750);
  }
  private AccessibilityNodeInfo findTile(){
    List<AccessibilityNodeInfo> roots=new ArrayList<>();
    try{
      AccessibilityNodeInfo r=getRootInActiveWindow();
      if(systemUI(r))roots.add(r);
      for(AccessibilityWindowInfo window:getWindows()){
        if(window==null)continue;
        r=window.getRoot();
        if(systemUI(r)&&!roots.contains(r))roots.add(r);
      }
    }catch(RuntimeException e){return null;}
    for(AccessibilityNodeInfo r:roots){
      AccessibilityNodeInfo match=walk(r,0);
      if(match!=null)return match;
    }
    return null;
  }
  private static boolean systemUI(AccessibilityNodeInfo n){
    return n!=null&&n.getPackageName()!=null &&
      "com.android.systemui".contentEquals(n.getPackageName());
  }
  private static AccessibilityNodeInfo walk(AccessibilityNodeInfo n,int depth){
    if(n==null||depth>26)return null;
    if(n.isVisibleToUser() && (isLabel(n.getText())||isLabel(n.getContentDescription())) &&
       clickableAncestor(n)!=null)return n;
    for(int i=0;i<Math.min(n.getChildCount(),100);i++){
      AccessibilityNodeInfo r=walk(n.getChild(i),depth+1);
      if(r!=null)return r;
    }
    return null;
  }
  private static String normalized(CharSequence raw){
    if(raw==null)return "";
    return Normalizer.normalize(raw.toString().toLowerCase(Locale.ROOT).trim(),Normalizer.Form.NFD)
      .replaceAll("\\p{M}+","").replaceAll("\\s+"," ");
  }
  private static String stateSuffix(CharSequence raw){
    String text=normalized(raw);
    for(String label:LABELS){
      if(text.equals(label))return "";
      if(text.startsWith(label+",")||text.startsWith(label+":")||text.startsWith(label+";"))
        return text.substring(label.length()+1).trim();
    }
    return null;
  }
  private static boolean isLabel(CharSequence c){return stateSuffix(c)!=null;}
  private static AccessibilityNodeInfo clickableAncestor(AccessibilityNodeInfo tile){
    Rect bounds=new Rect();
    tile.getBoundsInScreen(bounds);
    if(bounds.isEmpty()||!tile.isVisibleToUser())return null;
    AccessibilityNodeInfo n=tile;
    for(int i=0;i<5&&n!=null;i++,n=n.getParent()){
      if(!systemUI(n)||!n.isVisibleToUser())return null;
      if(n.isClickable()&&n.isEnabled())return n;
    }
    return null;
  }
  private static Boolean readState(AccessibilityNodeInfo tile){
    AccessibilityNodeInfo n=tile;
    for(int i=0;i<5&&n!=null;i++,n=n.getParent()){
      if(n.isCheckable())return n.isChecked();
      Boolean state=parseState(n.getStateDescription());
      if(state!=null)return state;
      if(n==tile){
        state=parseState(stateSuffix(n.getContentDescription()));
        if(state!=null)return state;
      }
      if(n.isClickable())break;
    }
    return null;
  }
  private static Boolean parseState(CharSequence state){
    String s=normalized(state);
    if(s.matches("^(on|actif|active|activee|enabled|allume|allumee|en marche)$"))return true;
    if(s.matches("^(off|inactif|inactive|desactive|desactivee|disabled|eteint|eteinte|paused|suspendu|suspendue)$"))return false;
    return null;
  }
  private void end(boolean ok,String detail){
    Boolean desired=target;
    boolean auto=scheduled;
    running=false;clicked=false;
    handler.removeCallbacks(scanRunnable);
    MainActivity.actionComplete(this,desired,auto,ok,detail);
    if(openedShade){
      AccessibilityNodeInfo r=getRootInActiveWindow();
      if(systemUI(r))performGlobalAction(GLOBAL_ACTION_BACK);
    }
    openedShade=false;target=null;
  }
}
