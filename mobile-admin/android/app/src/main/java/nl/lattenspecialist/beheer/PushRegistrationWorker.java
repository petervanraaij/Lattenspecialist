package nl.lattenspecialist.beheer;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.work.*;
import org.json.JSONObject;

public final class PushRegistrationWorker extends Worker {
    public PushRegistrationWorker(Context context,WorkerParameters params){super(context,params);}
    static void schedule(Context context){
        WorkManager.getInstance(context).enqueueUniqueWork("register-admin-push",ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(PushRegistrationWorker.class)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
    }
    @Override public Result doWork(){
        SharedPreferences prefs=getApplicationContext().getSharedPreferences(AdminWidgetProvider.PREFS,Context.MODE_PRIVATE);
        String owner=prefs.getString(AdminWidgetProvider.TOKEN,""),token=prefs.getString("fcm_token",""),device=prefs.getString("push_device_id","");
        int generation=prefs.getInt("push_generation",1);
        if(owner.isEmpty()||token.isEmpty()||device.isEmpty())return Result.success();
        try{
            JSONObject body=new JSONObject().put("deviceId",device).put("token",token).put("generation",generation);
            AdminNativeClient.call("/api/admin/push/register",owner,body.toString());
            if(!owner.equals(prefs.getString(AdminWidgetProvider.TOKEN,""))||generation!=prefs.getInt("push_generation",1))return Result.retry();
            prefs.edit().putString("push_status","gekoppeld").putLong("push_registered_at",System.currentTimeMillis()).apply();
            if(prefs.getLong("push_received_at",0)>prefs.getLong("push_ack_at",0)){
                AdminNativeClient.call("/api/admin/push/received",owner,new JSONObject().put("deviceId",device).toString());
                prefs.edit().putLong("push_ack_at",prefs.getLong("push_received_at",0)).apply();
            }
            return Result.success();
        }catch(AdminNativeClient.HttpError error){
            if(error.status==401||error.status==403){prefs.edit().putString("push_status","log opnieuw in").apply();return Result.success();}
            prefs.edit().putString("push_status","koppeling tijdelijk niet beschikbaar").apply();
            return getRunAttemptCount()<4?Result.retry():Result.success();
        }catch(Exception error){prefs.edit().putString("push_status","wacht op verbinding").apply();return getRunAttemptCount()<4?Result.retry():Result.success();}
    }
}
