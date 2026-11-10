package nl.lattenspecialist.beheer;

import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Operational push only; demo process and demo widgets never register a device. */
public final class AdminMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token){AdminPush.rememberToken(getApplicationContext(),token);}
    @Override public void onMessageReceived(RemoteMessage message){
        Context context=getApplicationContext();
        SharedPreferences prefs=context.getSharedPreferences(AdminWidgetProvider.PREFS,MODE_PRIVATE);
        String event=message.getData().get("eventId"),reference=message.getData().get("reference");
        java.util.LinkedHashSet<String> recent=new java.util.LinkedHashSet<>();
        try{org.json.JSONArray saved=new org.json.JSONArray(prefs.getString("push_recent_events","[]"));for(int i=0;i<saved.length();i++)recent.add(saved.getString(i));}catch(org.json.JSONException ignored){}
        if(!PushMessagePolicy.accepts(message.getData(),!prefs.getString(AdminWidgetProvider.TOKEN,"").isEmpty(),AdminPush.permitted(context),recent))return;
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("maintenance_requests","Nieuwe onderhoudsaanvragen",NotificationManager.IMPORTANCE_HIGH));
        PendingIntent open=PendingIntent.getActivity(context,410,new Intent(context,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.notify(410,new NotificationCompat.Builder(context,"maintenance_requests").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Nieuwe onderhoudsaanvraag")
            .setContentText("Open Beheer om de nieuwe aanvraag te bekijken.")
            .setContentIntent(open).setOngoing(true).setAutoCancel(false).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPriority(NotificationCompat.PRIORITY_HIGH).build());
        recent.add(event);while(recent.size()>32)recent.remove(recent.iterator().next());
        prefs.edit().putString("push_recent_events",new org.json.JSONArray(recent).toString()).putString("push_last_reference",reference).putBoolean("push_pending_summary",true).putLong("push_received_at",System.currentTimeMillis()).apply();
        RequestNotificationWorker.checkNow(context);PushRegistrationWorker.schedule(context);
    }
}
