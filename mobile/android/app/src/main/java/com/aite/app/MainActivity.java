package com.aite.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final String HOME_URL = "https://localhost/";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WebView webView = getBridge().getWebView();
    if (webView != null) {
      WebSettings settings = webView.getSettings();
      settings.setSupportZoom(false);
      settings.setBuiltInZoomControls(false);
      settings.setDisplayZoomControls(false);
      settings.setDomStorageEnabled(true);
      settings.setDatabaseEnabled(true);
      // Accept cross-origin cookies from the live backend (aite-lite.vercel.app).
      CookieManager.getInstance().setAcceptCookie(true);
      CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
      // Prevent text selection / context menu at the native level.
      webView.setOnLongClickListener(new View.OnLongClickListener() {
        @Override
        public boolean onLongClick(View v) {
          return true;
        }
      });
      webView.setLongClickable(false);
    }

    // Android can restore an Activity/WebView from a saved task. For a fresh
    // launcher start, discard that page stack and run the normal entry flow.
    if (savedInstanceState != null && isLauncherIntent(getIntent())) {
      restartAtHome();
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // launchMode="singleTask" may reuse the old Activity when the user taps
    // the app icon again. Treat that as a new launch instead of restoring the
    // last screen they were viewing.
    if (isLauncherIntent(intent)) {
      restartAtHome();
    }
  }

  private boolean isLauncherIntent(Intent intent) {
    return intent != null
        && Intent.ACTION_MAIN.equals(intent.getAction())
        && intent.hasCategory(Intent.CATEGORY_LAUNCHER);
  }

  private void restartAtHome() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    webView.post(() -> {
      webView.evaluateJavascript(
          "try { sessionStorage.removeItem('__AITE_FAKE_LOC__'); } catch (e) {}",
          null);
      webView.clearHistory();
      // The bundled index.html sends the user through splash/check-status:
      // signed-in users land on chat_list; others land on accounts/login.
      webView.loadUrl(HOME_URL);
    });
  }
}
