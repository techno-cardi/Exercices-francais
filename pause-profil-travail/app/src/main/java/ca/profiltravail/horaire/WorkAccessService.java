package ca.profiltravail.horaire;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.accessibilityservice.GestureDescription;
import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Path;
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

/**
 * No root, ADB, network or privileged permission.
 * The user explicitly enables this accessibility service in system settings.
 * Only the System UI "Work apps" quick-settings tile is interacted with.
 * Screen contents are never logged, transmitted, or persisted.
 */
public final class WorkAccessService extends AccessibilityService {
  private static volatile WorkAccessService active;
  private static final long SCAN_DELAY_MS=550;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private Boolean desiredPaused;
  private int scanCount;
  private boolean clicked;
  private long lastPendingRetry;
  private final Runnable scanTask=this::scan;

  static boolean isEnabled(Context c){
    AccessibilityManager manager=c.getSystemService(AccessibilityManager.class);
    if(manager==null)return false;
    for(AccessibilityServiceInfo info:manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)){
      if(info.getResolveInfo()!=null && info.getResolveInfo().serviceInfo!=null){
        String p=info.getResolveInfo().serviceInfo.packageName;
        String name=info.getResolveInfo().serviceInfo.name;
        if(c.getPackageName().equals(p) && name.endsWith(".WorkAccessService"))return true;
      }
    }
    return false;
  }

  static MainActivity.Result request(Context c,boolean pause){
    Boolean current=MainActivity.isPaused(c);
    if(current==null)return MainActivity.Result.NO_PROFILE;
    if(current==pause)return MainActivity.Result.OK;
    WorkAccessService s=active;
    if(s==null)return MainActivity.Result.NO_SERVICE;
    KeyguardManager key=c.getSystemService(KeyguardManager.class);
    if(key!=null&&key.isDeviceLocked())return MainActivity.Result.LOCKED;
    s.handler.post(()->s.begin(pause));
    return MainActivity.Result.QUEUED;
  }

  @Override protected void onServiceConnected(){
    super.onServiceConnected();
    active=this;
    handler.postDelayed(()->MainActivity.tryPending(this),1000);
  }

  @Override public void onAccessibilityEvent(AccessibilityEvent event){
    if(desiredPaused!=null){
      handler.removeCallbacks(scanTask);
      handler.postDelayed(scanTask,250);
    }else if(MainActivity.isPending(this)){
      KeyguardManager km=getSystemService(KeyguardManager.class);
      long now=SystemClock.elapsedRealtime();
      if((km==null||!km.isDeviceLocked())&&now-lastPendingRetry>6000){
        lastPendingRetry=now;
        handler.post(()->MainActivity.tryPending(this));
      }
    }
  }

  @Override public void onInterrupt(){}

  @Override public void onDestroy(){
    if(active==this)active=null;
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }

  private void begin(boolean pause){
    Boolean current=MainActivity.isPaused(this);
    if(current==null){MainActivity.actionComplete(this,false);return;}
    if(current==pause){MainActivity.actionComplete(this,true);return;}
    desiredPaused=pause;
    clicked=false;
    scanCount=0;
    if(!performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)){
      finish(false);return;
    }
    handler.removeCallbacks(scanTask);
    handler.postDelayed(scanTask,SCAN_DELAY_MS);
  }

  private void scan(){
    if(desiredPaused==null)return;
    Boolean current=MainActivity.isPaused(this);
    if(current!=null&&current.equals(desiredPaused)){finish(true);return;}
    if(clicked){
      if(++scanCount>=9){finish(false);return;}
      handler.postDelayed(scanTask,550);return;
    }
    if(++scanCount>9){finish(false);return;}
    AccessibilityNodeInfo tile=findWorkTile();
    if(tile!=null){
      if(clickTile(tile)){
        clicked=true;
        handler.postDelayed(scanTask,900);
        return;
      }
    }
    handler.postDelayed(scanTask,SCAN_DELAY_MS);
  }

  private AccessibilityNodeInfo findWorkTile(){
    List<AccessibilityNodeInfo> roots=new ArrayList<>();
    try{
      AccessibilityNodeInfo activeRoot=getRootInActiveWindow();
      if(activeRoot!=null&&isSystemUi(activeRoot))roots.add(activeRoot);
      for(AccessibilityWindowInfo w:getWindows()){
        if(w==null)continue;
        AccessibilityNodeInfo r=w.getRoot();
        if(r!=null && isSystemUi(r) && !roots.contains(r))roots.add(r);
      }
    }catch(Exception ignored){}
    for(AccessibilityNodeInfo r:roots){
      AccessibilityNodeInfo found=findLabel(r,0);
      if(found!=null)return found;
    }
    return null;
  }

  private static boolean isSystemUi(AccessibilityNodeInfo node){
    CharSequence p=node.getPackageName();
    return p!=null&&"com.android.systemui".contentEquals(p);
  }

  private static AccessibilityNodeInfo findLabel(AccessibilityNodeInfo n,int depth){
    if(n==null||depth>28)return null;
    if(isWorkLabel(n.getContentDescription())||isWorkLabel(n.getText()))return n;
    int count=Math.min(n.getChildCount(),120);
    for(int i=0;i<count;i++){
      AccessibilityNodeInfo child=n.getChild(i);
      AccessibilityNodeInfo found=findLabel(child,depth+1);
      if(found!=null)return found;
    }
    return null;
  }

  private static boolean isWorkLabel(CharSequence label){
    if(label==null)return false;
    String t=Normalizer.normalize(label.toString().toLowerCase(Locale.ROOT),Normalizer.Form.NFD)
      .replaceAll("\\p{InCombiningDiacriticalMarks}+","");
    return t.contains("applications professionnelles")||
      t.contains("application professionnelle")||
      t.contains("profil professionnel")||
      t.contains("apps professionnelles")||
      t.contains("work profile")||
      t.contains("work apps")||
      t.contains("work mode")||
      t.equals("travail")||
      t.equals("work");
  }

  private boolean clickTile(AccessibilityNodeInfo tile){
    AccessibilityNodeInfo n=tile;
    for(int i=0;i<6&&n!=null;i++,n=n.getParent()){
      if(n.isClickable() && n.performAction(AccessibilityNodeInfo.ACTION_CLICK))return true;
    }
    Rect r=new Rect();
    tile.getBoundsInScreen(r);
    if(r.isEmpty())return false;
    Path p=new Path();
    p.moveTo(r.centerX(),r.centerY());
    GestureDescription g=new GestureDescription.Builder()
      .addStroke(new GestureDescription.StrokeDescription(p,0,90)).build();
    return dispatchGesture(g,null,null);
  }

  private void finish(boolean ok){
    desiredPaused=null;
    clicked=false;
    handler.removeCallbacks(scanTask);
    MainActivity.actionComplete(this,ok);
    AccessibilityNodeInfo root=getRootInActiveWindow();
    if(root!=null&&isSystemUi(root))performGlobalAction(GLOBAL_ACTION_BACK);
  }
}
