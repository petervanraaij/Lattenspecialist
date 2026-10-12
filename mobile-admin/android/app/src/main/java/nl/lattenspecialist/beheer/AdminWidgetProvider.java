package nl.lattenspecialist.beheer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AdminWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "lattenspecialist_widget";
    static final String TOKEN = "admin_token";
    private static final String ENDPOINT = "https://stuiterbaas-reserveren.stuiterbaas-456655a6.workers.dev/api/admin/reservations";
    private static final String ACTION_REFRESH = "nl.lattenspecialist.beheer.REFRESH_WIDGET";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        refresh(context, manager, widgetIds, goAsync());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, AdminWidgetProvider.class));
            refresh(context.getApplicationContext(), manager, ids, goAsync());
        }
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, AdminWidgetProvider.class));
        if (ids.length > 0) refresh(context.getApplicationContext(), manager, ids, null);
    }

    private static void refresh(Context context, AppWidgetManager manager, int[] ids, PendingResult pending) {
        for (int id : ids) manager.updateAppWidget(id, loadingView(context));
        EXECUTOR.execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String token = prefs.getString(TOKEN, "");
                RemoteViews view = token.isEmpty() ? loginView(context) : dataView(context, loadCounts(token));
                for (int id : ids) manager.updateAppWidget(id, view);
            } catch (Exception error) {
                RemoteViews view = errorView(context);
                for (int id : ids) manager.updateAppWidget(id, view);
            } finally {
                if (pending != null) pending.finish();
            }
        });
    }

    private static Counts loadCounts(String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "application/json");
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        int status = connection.getResponseCode();
        if (status != 200) throw new IllegalStateException("HTTP " + status);
        String body = readAll(connection.getInputStream());
        JSONArray records = new JSONObject(body).optJSONArray("records");
        Counts counts = new Counts();
        if (records == null) return counts;
        for (int index = 0; index < records.length(); index++) {
            JSONObject record = records.optJSONObject(index);
            if (record == null || !record.isNull("closedAt") && !record.optString("closedAt").isEmpty()) continue;
            counts.open++;
            int step = Math.max(1, record.optInt("currentStep", 1));
            if (step == 1) counts.newRequests++;
            if (step >= 3 || !"Onderhoud".equalsIgnoreCase(record.optString("service"))) continue;
            int amount = Math.max(1, record.optInt("amount", 1));
            String logistics = record.optString("logistics").toLowerCase(Locale.ROOT);
            if (logistics.contains("gratis") && logistics.contains("ophalen")) counts.toCollect += amount;
            else if (logistics.contains("zelf brengen")) counts.customerBrings += amount;
        }
        return counts;
    }

    private static String readAll(InputStream stream) throws Exception {
        StringBuilder value = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) value.append(line);
        }
        return value.toString();
    }

    private static RemoteViews baseView(Context context) {
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.admin_widget);
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent openIntent = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        view.setOnClickPendingIntent(R.id.widget_root, openIntent);
        Intent refresh = new Intent(context, AdminWidgetProvider.class).setAction(ACTION_REFRESH);
        PendingIntent refreshIntent = PendingIntent.getBroadcast(context, 1, refresh, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        view.setOnClickPendingIntent(R.id.widget_refresh, refreshIntent);
        return view;
    }

    private static RemoteViews loadingView(Context context) {
        RemoteViews view = baseView(context);
        view.setTextViewText(R.id.widget_status, "Bijwerken…");
        return view;
    }

    private static RemoteViews loginView(Context context) {
        RemoteViews view = baseView(context);
        view.setTextViewText(R.id.widget_status, "Open de beheerapp en log in");
        setCounts(view, "–", "–", "–", "–");
        return view;
    }

    private static RemoteViews errorView(Context context) {
        RemoteViews view = baseView(context);
        view.setTextViewText(R.id.widget_status, "Bijwerken mislukt · tik op ↻");
        return view;
    }

    private static RemoteViews dataView(Context context, Counts counts) {
        RemoteViews view = baseView(context);
        setCounts(view, String.valueOf(counts.newRequests), String.valueOf(counts.open), String.valueOf(counts.toCollect), String.valueOf(counts.customerBrings));
        String time = new SimpleDateFormat("HH:mm", new Locale("nl", "NL")).format(new Date());
        view.setTextViewText(R.id.widget_status, "Bijgewerkt om " + time);
        view.setViewVisibility(R.id.widget_refresh, View.VISIBLE);
        return view;
    }

    private static void setCounts(RemoteViews view, String fresh, String open, String collect, String bring) {
        view.setTextViewText(R.id.widget_new_value, fresh);
        view.setTextViewText(R.id.widget_open_value, open);
        view.setTextViewText(R.id.widget_collect_value, collect);
        view.setTextViewText(R.id.widget_bring_value, bring);
    }

    private static final class Counts {
        int newRequests;
        int open;
        int toCollect;
        int customerBrings;
    }
}
