package nl.lattenspecialist.beheer;

import android.app.Activity;
import android.content.SharedPreferences;
import androidx.appcompat.app.AlertDialog;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/** Updates only through the installed app's Google Play entitlement. No APK downloads. */
final class PlayUpdates {
    static final int REQUEST=612;
    private final MainActivity activity;
    private final AppUpdateManager manager;
    private final SharedPreferences prefs;
    private boolean foreground,checking,downloaded;
    private AlertDialog ready;
    private long lastCheck;
    private final InstallStateUpdatedListener listener=state->{
        if(state.installStatus()==InstallStatus.DOWNLOADED){downloaded=true;showReady();}
    };
    PlayUpdates(MainActivity activity){
        this.activity=activity;
        manager=AppUpdateManagerFactory.create(activity);
        prefs=activity.getSharedPreferences("play_updates",Activity.MODE_PRIVATE);
        manager.registerListener(listener);
    }
    void resume(){
        foreground=true;
        if(downloaded){showReady();return;}
        long now=System.currentTimeMillis();
        if(checking||now-lastCheck<60000)return;
        lastCheck=now;checking=true;
        manager.getAppUpdateInfo().addOnSuccessListener(info->{
            checking=false;
            if(activity.isFinishing()||!foreground)return;
            if(info.installStatus()==InstallStatus.DOWNLOADED){downloaded=true;showReady();return;}
            if(info.updateAvailability()==UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS){
                start(info,AppUpdateType.IMMEDIATE);return;
            }
            if(info.updateAvailability()==UpdateAvailability.UPDATE_AVAILABLE
                &&info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                &&UpdatePromptPolicy.shouldOffer(System.currentTimeMillis(),prefs.getLong("last_offer",0))){
                prefs.edit().putLong("last_offer",System.currentTimeMillis()).apply();
                start(info,AppUpdateType.FLEXIBLE);
            }
        }).addOnFailureListener(error->{checking=false;});
    }
    private void start(com.google.android.play.core.appupdate.AppUpdateInfo info,int type){
        try{manager.startUpdateFlowForResult(info,activity,AppUpdateOptions.newBuilder(type).build(),REQUEST);}
        catch(android.content.IntentSender.SendIntentException ignored){/* Keep the working app available. */}
    }
    private void showReady(){
        if(!foreground||activity.isFinishing()||ready!=null)return;
        ready=new AlertDialog.Builder(activity).setTitle("Update klaar")
            .setMessage("De nieuwe versie is gedownload. Sla je werk op en kies daarna Bijwerken. De app wordt opnieuw geopend.")
            .setPositiveButton("Bijwerken",(dialog,which)->manager.completeUpdate())
            .setNegativeButton("Later",null).create();
        ready.setOnDismissListener(dialog->ready=null);ready.show();
    }
    void pause(){foreground=false;}
    void destroy(){manager.unregisterListener(listener);if(ready!=null)ready.dismiss();}
}
