package nl.lattenspecialist.beheer;

import android.os.Bundle;
import android.content.Intent;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.getWebView().addJavascriptInterface(new WidgetBridge(), "LattenspecialistWidget");
        rememberQuickMaterial(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String material = rememberQuickMaterial(intent);
        if (!material.isEmpty()) bridge.getWebView().post(() -> {
            bridge.getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('lattenspecialist:new-request',{detail:{material:'" + material + "'}}));", null);
            getSharedPreferences(AdminWidgetProvider.PREFS, MODE_PRIVATE).edit().remove("quick_material").apply();
        });
    }

    private String rememberQuickMaterial(Intent intent) {
        String material = intent == null ? "" : intent.getStringExtra("quick_material");
        if (!"Ski".equals(material) && !"Snowboard".equals(material)) return "";
        getSharedPreferences(AdminWidgetProvider.PREFS, MODE_PRIVATE).edit().putString("quick_material", material).apply();
        return material;
    }

    private final class WidgetBridge {
        @JavascriptInterface
        public void setAdminToken(String token) {
            String safeToken = token == null ? "" : token.trim();
            if (safeToken.length() > 256) return;
            String current = getSharedPreferences(AdminWidgetProvider.PREFS, MODE_PRIVATE)
                    .getString(AdminWidgetProvider.TOKEN, "");
            if (!safeToken.equals(current)) {
                getSharedPreferences(AdminWidgetProvider.PREFS, MODE_PRIVATE)
                        .edit().putString(AdminWidgetProvider.TOKEN, safeToken).apply();
                AdminWidgetProvider.refreshAll(MainActivity.this);
            }
        }

        @JavascriptInterface
        public void refresh() {
            AdminWidgetProvider.refreshAll(MainActivity.this);
        }

        @JavascriptInterface
        public String consumeQuickMaterial() {
            String material = getSharedPreferences(AdminWidgetProvider.PREFS, MODE_PRIVATE).getString("quick_material", "");
            getSharedPreferences(AdminWidgetProvider.PREFS, MODE_PRIVATE).edit().remove("quick_material").apply();
            return material;
        }
    }
}
