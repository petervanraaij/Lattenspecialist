package nl.lattenspecialist.beheer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Public deterministic fictional example. It never reads the operational widget or its token. */
public final class DemoAdminWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "lattenspecialist_demo_widgets_v1";
    static final String REFRESH = "nl.lattenspecialist.beheer.demo.REFRESH_WIDGET";
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (REFRESH.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            android.appwidget.AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
            if (info != null && info.provider.equals(new android.content.ComponentName(context, DemoAdminWidgetProvider.class)))
                update(context, manager, id);
        }
    }
    private static void update(Context context, AppWidgetManager manager, int id) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("fixture_version", 1).apply();
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.demo_admin_widget);
        view.setTextViewText(R.id.widget_new_value, "3");
        view.setTextViewText(R.id.widget_open_value, "5");
        view.setTextViewText(R.id.widget_collect_value, "2");
        view.setTextViewText(R.id.widget_bring_value, "1");
        view.setTextViewText(R.id.widget_status, "Fictief voorbeeld · geen live telling");
        view.setOnClickPendingIntent(R.id.widget_root, DemoIntents.open(context, null, null, 17300));
        Intent refresh = new Intent(context, DemoAdminWidgetProvider.class).setAction(REFRESH)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        view.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(context, id, refresh,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(id, view);
    }
}
