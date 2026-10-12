package nl.lattenspecialist.beheer;

import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.getWebView().addJavascriptInterface(new WidgetBridge(), "LattenspecialistWidget");
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
    }
}
