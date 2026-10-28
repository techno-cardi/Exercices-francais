package ca.profiltravail.horaire;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import android.os.UserHandle;
import android.os.UserManager;
import android.content.pm.LauncherApps;
import java.util.LinkedHashSet;

/** Direct Android quiet-mode API. Never reads work data, never opens any UI. */
public final class ProfileBackend {
  public static final String PERMISSION="android.permission.MODIFY_QUIET_MODE";
  private ProfileBackend(){}
  public static boolean authorized(Context c){
    return c.checkSelfPermission(PERMISSION)==PackageManager.PERMISSION_GRANTED;
  }
  private static UserHandle handle(Context c)throws Exception{
    UserManager um=c.getSystemService(UserManager.class);
    if(um==null)throw new Exception("Service UserManager indisponible.");
    if(um.isManagedProfile())throw new Exception("Installe l'application dans ton profil personnel.");
    LinkedHashSet<UserHandle> users=new LinkedHashSet<>();
    for(UserHandle p:um.getUserProfiles())
      if(!p.equals(Process.myUserHandle()))users.add(p);
    if(users.isEmpty()){
      LauncherApps la=c.getSystemService(LauncherApps.class);
      if(la!=null)for(UserHandle p:la.getProfiles())
        if(!p.equals(Process.myUserHandle()))users.add(p);
    }
    if(users.isEmpty())throw new Exception("Aucun profil secondaire visible. Vérifie que le profil professionnel existe.");
    if(users.size()!=1)throw new Exception("Plusieurs profils secondaires détectés ("+users.size()+"). Aucun basculement par sécurité.");
    return users.iterator().next();
  }
  public static State inspect(Context c){
    if(!authorized(c))return new State(null,"Permission ADB à accorder.");
    try{
      UserHandle p=handle(c);
      return new State(c.getSystemService(UserManager.class).isQuietModeEnabled(p),"Profil professionnel accessible.");
    }catch(Exception ex){return new State(null,ex.getMessage());}
  }
  public static Result change(Context c,boolean pause){
    if(!authorized(c))return new Result(false,false,false,"Permission ADB manquante.");
    try{
      UserManager um=c.getSystemService(UserManager.class);
      UserHandle profile=handle(c);
      if(um.isQuietModeEnabled(profile)==pause)
        return new Result(true,false,false,pause?"Déjà suspendu.":"Déjà actif.");
      if(!pause){
        KeyguardManager km=c.getSystemService(KeyguardManager.class);
        if(km!=null&&km.isDeviceLocked())
          return new Result(false,false,true,"Reprise différée jusqu'au déverrouillage.");
        boolean ok=Build.VERSION.SDK_INT>=30?
          um.requestQuietModeEnabled(false,profile,UserManager.QUIET_MODE_DISABLE_ONLY_IF_CREDENTIAL_NOT_REQUIRED):
          um.requestQuietModeEnabled(false,profile);
        if(!ok)return new Result(false,false,false,"Un code professionnel distinct est nécessaire : reprise silencieuse refusée.");
      }else{
        if(!um.requestQuietModeEnabled(true,profile))
          return new Result(false,false,false,"Suspension refusée par Android.");
      }
      return new Result(true,true,false,pause?"Suspension envoyée.":"Réactivation envoyée.");
    }catch(SecurityException ex){
      return new Result(false,false,false,"Permission refusée par Android. Vérifie ADB et les règles de l'organisation.");
    }catch(Exception ex){
      return new Result(false,false,false,ex.getMessage());
    }
  }
  public static final class State{
    public final Boolean paused;
    public final String info;
    State(Boolean p,String i){paused=p;info=i;}
  }
  public static final class Result{
    public final boolean accepted,changed,deferred;
    public final String info;
    Result(boolean a,boolean c,boolean d,String i){accepted=a;changed=c;deferred=d;info=i;}
  }
}
