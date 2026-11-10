package nl.lattenspecialist.beheer;

import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.util.concurrent.Executors;

final class AdminPush {
    private static final java.util.concurrent.ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
    static synchronized void rememberToken(Context context,String token){
        SharedPreferences prefs=context.getSharedPreferences(AdminWidgetProvider.PREFS,Context.MODE_PRIVATE);
        if(!token.equals(prefs.getString("fcm_token","")))prefs.edit().putString("fcm_token",token)
            .putInt("push_generation",prefs.getInt("push_generation",1)+1).apply();
        if(!prefs.getString(AdminWidgetProvider.TOKEN,"").isEmpty())PushRegistrationWorker.schedule(context);
    }
    static boolean permitted(Context context){
        if(!NotificationManagerCompat.from(context).areNotificationsEnabled())return false;
        if(Build.VERSION.SDK_INT>=26){
            android.app.NotificationChannel channel=context.getSystemService(NotificationManager.class).getNotificationChannel("maintenance_requests");
            return channel==null||channel.getImportance()!=NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }
    static void sync(Context context){
        SharedPreferences prefs=context.getSharedPreferences(AdminWidgetProvider.PREFS,Context.MODE_PRIVATE);
        if(prefs.getString(AdminWidgetProvider.TOKEN,"").isEmpty())return;
        if(!permitted(context)){prefs.edit().putString("push_status","meldingen staan uit").apply();return;}
        if(prefs.getString("push_device_id","").isEmpty())prefs.edit().putString("push_device_id",java.util.UUID.randomUUID().toString()).apply();
        try{
            FirebaseMessaging messaging=FirebaseMessaging.getInstance();messaging.setAutoInitEnabled(true);
            messaging.getToken().addOnCompleteListener(task->{
                if(task.isSuccessful()&&task.getResult()!=null){rememberToken(context,task.getResult());PushRegistrationWorker.schedule(context);}
                else prefs.edit().putString("push_status","Google Play-services niet bereikbaar").apply();
            });
        }catch(IllegalStateException error){prefs.edit().putString("push_status","pushconfiguratie ontbreekt").apply();}
    }
    static void logout(Context context,String previousCode){
        SharedPreferences prefs=context.getSharedPreferences(AdminWidgetProvider.PREFS,Context.MODE_PRIVATE);
        String device=prefs.getString("push_device_id","");
        prefs.edit().remove("fcm_token").putString("push_status","afgemeld").putInt("push_generation",prefs.getInt("push_generation",1)+1).apply();
        context.getSystemService(NotificationManager.class).cancel(410);
        try{FirebaseMessaging.getInstance().setAutoInitEnabled(false);FirebaseMessaging.getInstance().deleteToken();}catch(IllegalStateException ignored){}
        if(!device.isEmpty()&&!previousCode.isEmpty())EXECUTOR.execute(()->{
            try{AdminNativeClient.call("/api/admin/push/unregister",previousCode,new JSONObject().put("deviceId",device).toString());}catch(Exception ignored){}
        });
    }
}
