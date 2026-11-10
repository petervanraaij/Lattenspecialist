package nl.lattenspecialist.beheer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;

/** Fixed fictional content; no networking, token, operational preference or WorkManager access. */
final class DemoRequestNotification {
    private DemoRequestNotification() {}
    @android.annotation.TargetApi(28)
    static boolean post(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return false;
        manager.createNotificationChannel(new NotificationChannel(DemoNotificationPolicy.CHANNEL,
            "DEMO · Fictieve onderhoudsaanvragen", NotificationManager.IMPORTANCE_DEFAULT));
        Notification notification = new Notification.Builder(context, DemoNotificationPolicy.CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("DEMO · Fictieve onderhoudsaanvraag")
            .setContentText("Voorbeeldmelding zonder klantgegevens. Tik om uitsluitend de fictieve demo te openen.")
            .setContentIntent(DemoIntents.open(context, null, null, DemoNotificationPolicy.NOTIFICATION_ID))
            .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).build();
        manager.notify(DemoNotificationPolicy.NOTIFICATION_ID, notification);
        return true;
    }
}
