package nl.lattenspecialist.medewerkers;

import android.annotation.TargetApi;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Separate :demo process and WebView data directory; no work-app bridge or credentials. */
public final class DemoActivity extends Activity {
    private static boolean dataDirectoryReady;
    private WebView web;
    private TextView message;
    private Button retry;
    private String origin;
    private OnBackInvokedCallback predictiveBack;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 33) registerPredictiveBack();
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        TextView banner = new TextView(this);
        banner.setText("De Lattenspecialist · Medewerkers · DEMO\nAanvullende demonstratie — uitsluitend fictieve gegevens");
        banner.setTextColor(Color.BLACK);
        banner.setBackgroundColor(0xFFFFC845);
        banner.setPadding(dp(14), dp(12), dp(14), dp(12));
        layout.addView(banner);
        Button choice = new Button(this);
        choice.setText("Terug naar appkeuze");
        choice.setOnClickListener(view -> returnToChoice());
        layout.addView(choice);
        message = new TextView(this);
        message.setPadding(dp(14), dp(12), dp(14), dp(12));
        layout.addView(message);
        retry = new Button(this);
        retry.setText("Demo opnieuw openen");
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(view -> openDemo());
        layout.addView(retry);
        setContentView(layout);
        if (Build.VERSION.SDK_INT < 28) {
            message.setText("Voor de afzonderlijke demo-opslag is Android 9 of hoger nodig. De beveiligde app blijft beschikbaar via de appkeuze.");
            return;
        }
        prepareDemoStorage();
        try { origin = DemoOriginPolicy.validateOrigin(DemoOriginPolicy.ORIGIN); }
        catch (IllegalArgumentException error) { message.setText("Het afzonderlijke demo-adres is ongeldig."); return; }
        configure(layout);
        openDemo();
    }

    @TargetApi(28)
    private static synchronized void prepareDemoStorage() {
        if (!dataDirectoryReady) { WebView.setDataDirectorySuffix("synthetic-review-demo"); dataDirectoryReady = true; }
    }

    @TargetApi(28)
    private void configure(LinearLayout layout) {
        WebView.setWebContentsDebuggingEnabled(false);
        web = new WebView(this);
        layout.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setSafeBrowsingEnabled(true);
        // Cookies are confined to the :demo process and suffixed WebView storage.
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return DemoOriginPolicy.allows(request.getUrl().toString()) ? null : blocked();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String requestedOrigin, GeolocationPermissions.Callback callback) {
                callback.invoke(requestedOrigin, false, false);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (DemoOriginPolicy.allows(request.getUrl().toString())) return false;
                if (request.isForMainFrame()) fail("Een bestemming buiten deze fictieve demo is geblokkeerd.");
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return DemoOriginPolicy.allows(request.getUrl().toString()) ? null : blocked();
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (!DemoOriginPolicy.allows(url)) { view.stopLoading(); fail("Een externe verwijzing is geblokkeerd."); }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                fail("De beveiligde verbinding met de demo kon niet worden gecontroleerd.");
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) fail("De fictieve demo is niet bereikbaar. Probeer later opnieuw.");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (DemoOriginPolicy.allows(url) && web.getVisibility() == View.VISIBLE) {
                    message.setText("Afzonderlijke demo-omgeving; alle getoonde gegevens en wijzigingen zijn fictief.");
                }
            }
        });
        web.setDownloadListener((url, userAgent, disposition, type, length) ->
            message.setText("Downloads zijn uitgeschakeld in deze aanvullende demo."));
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Demo origin restriction",
            Collections.singletonMap("Cache-Control", "no-store"),
            new ByteArrayInputStream("External connection blocked in synthetic demo.".getBytes(StandardCharsets.UTF_8)));
    }

    private void openDemo() {
        if (web == null || origin == null) return;
        retry.setVisibility(View.GONE);
        message.setText("Afzonderlijke fictieve demo laden…");
        web.setVisibility(View.VISIBLE);
        web.loadUrl(origin);
    }
    private void fail(String reason) {
        runOnUiThread(() -> {
            message.setText(reason);
            if (web != null) web.setVisibility(View.GONE);
            retry.setVisibility(web == null ? View.GONE : View.VISIBLE);
        });
    }
    private void returnToChoice() {
        startActivity(new Intent(this, EntryActivity.class));
        finish();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @TargetApi(33)
    private void registerPredictiveBack() {
        predictiveBack = this::navigateBack;
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, predictiveBack);
    }
    private void navigateBack() {
        if (web != null && web.getVisibility() == View.VISIBLE && web.canGoBack()) web.goBack();
        else returnToChoice();
    }
    // API 33+ uses the registered platform callback; this override supports older Android.
    @SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { navigateBack(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && predictiveBack != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(predictiveBack);
        if (web != null) { web.stopLoading(); web.setWebViewClient(new WebViewClient()); web.destroy(); }
        super.onDestroy();
    }
}

