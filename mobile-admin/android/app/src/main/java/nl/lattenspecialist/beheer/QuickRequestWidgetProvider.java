package nl.lattenspecialist.beheer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class QuickRequestWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.quick_request_widget);
            view.setOnClickPendingIntent(R.id.quick_ski, open(context, "Ski", 21));
            view.setOnClickPendingIntent(R.id.quick_snowboard, open(context, "Snowboard", 22));
            manager.updateAppWidget(id, view);
        }
    }

    private PendingIntent open(Context context, String material, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class).putExtra("quick_material", material).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
