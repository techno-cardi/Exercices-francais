package ca.quizdesalon.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;
import android.view.KeyEvent;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.graphics.Bitmap;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.Toast;

public final class MainActivity extends Activity {
 private static final String HOME="https://techno-cardi.github.io/Exercices-francais/quiz-salon/";
 private WebView web;
 private FrameLayout root;
 private LinearLayout errorPanel;
 private long backPressedAt=0;
 private boolean pageReady=false;
 private boolean loadingError=false;
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON|WindowManager.LayoutParams.FLAG_FULLSCREEN);
  immersive();
  root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(12,29,58));setContentView(root);
  web=new WebView(this);web.setBackgroundColor(Color.rgb(12,29,58));web.setOverScrollMode(View.OVER_SCROLL_NEVER);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setMediaPlaybackRequiresUserGesture(false);settings.setSupportMultipleWindows(false);
  settings.setUserAgentString(settings.getUserAgentString()+" QuizSalonTV/1.0");
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));
  buildErrorPanel();
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return route(url);}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return route(request.getUrl().toString());}
   @Override public void onPageStarted(WebView view,String url,Bitmap icon){loadingError=false;}
   @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=400)showError();}
   @Override public void onPageFinished(WebView view,String url){if(loadingError)return;pageReady=true;errorPanel.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);immersive();}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showError();}
   @SuppressWarnings("deprecation") @Override public void onReceivedError(WebView view,int code,String description,String failingUrl){if(Build.VERSION.SDK_INT<23)showError();}
  });
  if(saved==null||web.restoreState(saved)==null){
   String last=getPreferences(MODE_PRIVATE).getString("last_url",HOME+"?tv=1");
   web.loadUrl(isGameUrl(last)?last:HOME+"?tv=1");
  }
 }
 private boolean isGameUrl(String url){return url!=null&&(url.equals(HOME)||url.startsWith(HOME+"?")||url.startsWith(HOME+"#"));}
 private boolean route(String url){
  if(isGameUrl(url))return false;
  Uri uri=Uri.parse(url);if("https".equals(uri.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){Toast.makeText(this,"Ouvre cette source sur ton téléphone.",Toast.LENGTH_SHORT).show();}}
  return true;
 }
 private void buildErrorPanel(){
  errorPanel=new LinearLayout(this);errorPanel.setOrientation(LinearLayout.VERTICAL);errorPanel.setGravity(17);errorPanel.setPadding(60,40,60,40);errorPanel.setBackgroundColor(Color.rgb(12,29,58));
  TextView title=new TextView(this);title.setText("Quiz de salon");title.setTextColor(Color.WHITE);title.setTextSize(32);errorPanel.addView(title);
  TextView detail=new TextView(this);detail.setText("La connexion au jeu est interrompue.\nVérifie Internet, puis réessaie. Ton accès est conservé.");detail.setTextColor(Color.rgb(169,187,214));detail.setTextSize(18);detail.setGravity(17);detail.setPadding(0,20,0,25);errorPanel.addView(detail);
  Button retry=new Button(this);retry.setText("RÉESSAYER");retry.setOnClickListener(new View.OnClickListener(){ public void onClick(View v){errorPanel.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);String current=web.getUrl();web.loadUrl(isGameUrl(current)?current:HOME+"?tv=1");}});errorPanel.addView(retry);
  root.addView(errorPanel,new FrameLayout.LayoutParams(-1,-1));errorPanel.setVisibility(View.GONE);
 }
 private void showError(){loadingError=true;pageReady=false;web.setVisibility(View.INVISIBLE);errorPanel.setVisibility(View.VISIBLE);errorPanel.getChildAt(2).requestFocus();}
 private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);}
 @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
 @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.dispatchEvent(new Event('online'));",null);}immersive();}
 @Override protected void onPause(){if(web!=null){String current=web.getUrl();if(isGameUrl(current))getPreferences(MODE_PRIVATE).edit().putString("last_url",current).apply();web.onPause();}super.onPause();}
 @Override public void onSaveInstanceState(Bundle out){if(web!=null)web.saveState(out);super.onSaveInstanceState(out);}
 @Override public void onBackPressed(){long now=System.currentTimeMillis();if(now-backPressedAt<2500){super.onBackPressed();}else{backPressedAt=now;Toast.makeText(this,"Appuie encore sur Retour pour quitter. La partie reste enregistrée.",Toast.LENGTH_SHORT).show();}}
 @Override public boolean onKeyDown(int keyCode,KeyEvent event){
  if(pageReady&&(keyCode==KeyEvent.KEYCODE_DPAD_LEFT||keyCode==KeyEvent.KEYCODE_DPAD_RIGHT||keyCode==KeyEvent.KEYCODE_DPAD_UP||keyCode==KeyEvent.KEYCODE_DPAD_DOWN||keyCode==KeyEvent.KEYCODE_DPAD_CENTER||keyCode==KeyEvent.KEYCODE_ENTER||keyCode==KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)){
   String key=keyCode==KeyEvent.KEYCODE_DPAD_LEFT?"ArrowLeft":keyCode==KeyEvent.KEYCODE_DPAD_RIGHT?"ArrowRight":keyCode==KeyEvent.KEYCODE_DPAD_UP?"ArrowUp":keyCode==KeyEvent.KEYCODE_DPAD_DOWN?"ArrowDown":"Enter";
   // This trusted native bridge only forwards fixed remote keys to our own page.
   web.evaluateJavascript("(function(){var e=document.activeElement;if('"+key+"'==='Enter'){if(e&&e.matches&&e.matches('button,a,label.pill,input'))e.click();else{var b=document.querySelector('.btn:not(:disabled)');if(b)b.click();}}else{document.dispatchEvent(new KeyboardEvent('keydown',{key:'"+key+"',bubbles:true}));}})()",null);return true;
  }return super.onKeyDown(keyCode,event);
 }
 @Override protected void onDestroy(){if(web!=null){root.removeView(web);web.destroy();}super.onDestroy();}
}
