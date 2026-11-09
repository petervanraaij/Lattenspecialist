package nl.lattenspecialist.beheer;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** Opens the real editable synthetic request form; it never silently submits a request. */
public final class DemoQuickRequestWidgetProvider extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        context.getSharedPreferences(DemoAdminWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit().putInt("fixture_version", 1).apply();
        for (int id : ids) {
            RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.demo_quick_request_widget);
            view.setOnClickPendingIntent(R.id.quick_ski, DemoIntents.open(context, "new-request", "Ski", 17301));
            view.setOnClickPendingIntent(R.id.quick_snowboard, DemoIntents.open(context, "new-request", "Snowboard", 17302));
            manager.updateAppWidget(id, view);
        }
    }
}
