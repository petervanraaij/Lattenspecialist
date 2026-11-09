package nl.lattenspecialist.beheer;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.work.*;
import org.json.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/** One bounded background check per device; Android may defer it in battery saving mode. */
public class RequestNotificationWorker extends Worker {
    private static final String CHANNEL="maintenance_requests";
    public RequestNotificationWorker(Context context, WorkerParameters params){super(context,params);}
    static void schedule(Context context){
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("maintenance-requests",ExistingPeriodicWorkPolicy.KEEP,
            new PeriodicWorkRequest.Builder(RequestNotificationWorker.class,15,TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
        checkNow(context);
    }
    static void checkNow(Context context){WorkManager.getInstance(context).enqueueUniqueWork("maintenance-check",ExistingWorkPolicy.KEEP,
        new OneTimeWorkRequest.Builder(RequestNotificationWorker.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());}
    @Override public Result doWork(){
        Context context=getApplicationContext();
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26) manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Nieuwe onderhoudsaanvragen",NotificationManager.IMPORTANCE_HIGH));
        String token=context.getSharedPreferences(AdminWidgetProvider.PREFS,Context.MODE_PRIVATE).getString(AdminWidgetProvider.TOKEN,"");
        if(token.isEmpty()){manager.cancel(410);return Result.success();}
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL("https://stuiterbaas-reserveren.stuiterbaas-456655a6.workers.dev/api/admin/reservations").openConnection();
            connection.setConnectTimeout(10000);connection.setReadTimeout(10000);
            connection.setRequestProperty("Authorization","Bearer "+token);
            int status=connection.getResponseCode();
            if(status==401||status==403){manager.cancel(410);return Result.success();}
            if(status!=200)return Result.success();
            java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();
            try(java.io.InputStream input=connection.getInputStream()){byte[] buffer=new byte[8192];int size;while((size=input.read(buffer))!=-1){output.write(buffer,0,size);if(output.size()>4000000)return Result.success();}}
            String body=output.toString("UTF-8");
            JSONArray records=new JSONObject(body).optJSONArray("records");int count=0;java.util.TreeSet<String> references=new java.util.TreeSet<>();
            if(records!=null)for(int i=0;i<records.length();i++){
                JSONObject record=records.optJSONObject(i);
                if(record!=null&&"Onderhoud".equals(record.optString("service"))&&record.optString("closedAt","").isEmpty()&&record.optInt("currentStep",1)==1){count++;references.add(record.optString("reference"));}
            }
            if(count==0){manager.cancel(410);return Result.success();}
            SharedPreferences prefs=context.getSharedPreferences(AdminWidgetProvider.PREFS,Context.MODE_PRIVATE);
            if(!token.equals(prefs.getString(AdminWidgetProvider.TOKEN,"")))return Result.success();
            if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return Result.success();
            PendingIntent open=PendingIntent.getActivity(context,410,new Intent(context,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            manager.notify(410,new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(count+" nieuwe onderhoudsaanvraag"+(count==1?"":"en"))
                .setContentText("Tik om te bekijken. Blijft open tot de aanvraag is opgepakt.")
                .setContentIntent(open).setOngoing(true).setAutoCancel(false).setOnlyAlertOnce(references.toString().equals(prefs.getString("notified_requests","")))
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPriority(NotificationCompat.PRIORITY_HIGH).build());
            prefs.edit().putString("notified_requests",references.toString()).apply();
            return Result.success();
        }catch(Exception error){return Result.success();}
        finally{if(connection!=null)connection.disconnect();}
    }
}
