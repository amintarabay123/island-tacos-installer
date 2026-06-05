package com.islandtacos.display;

import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.view.Display;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class CustomerDisplayPresentation extends Presentation {

    public interface LoadCallback {
        void onTestScreenShown();
        void onPageStarted(String url);
        void onPageFinished(String url);
        void onError(String description, String url);
    }

    private final String url;
    private final LoadCallback callback;

    public CustomerDisplayPresentation(Context context, Display display, String url, LoadCallback callback) {
        super(context, display);
        this.url = url;
        this.callback = callback;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── PHASE 1: Bright diagnostic test screen ─────────────────────────────
        // Show a BRIGHT RED background with visible text for 5 seconds.
        // If you see this on the customer display, the Presentation API is working.
        // If the customer display is still blank/mirroring, the display routing is wrong.
        FrameLayout root = new FrameLayout(getContext());
        root.setBackgroundColor(Color.RED);

        TextView testLabel = new TextView(getContext());
        testLabel.setText("CUSTOMER DISPLAY ACTIVE\n\nIf you see this, Presentation is working!\nLoading real page in 5 seconds...");
        testLabel.setTextColor(Color.WHITE);
        testLabel.setTextSize(36);
        testLabel.setGravity(Gravity.CENTER);
        testLabel.setPadding(60, 60, 60, 60);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT);
        root.addView(testLabel, lp);
        setContentView(root);

        if (callback != null) callback.onTestScreenShown();

        // ── PHASE 2: Load real URL after 5-second diagnostic window ────────────
        new Handler().postDelayed(() -> {
            WebView webView = new WebView(getContext());
            webView.setBackgroundColor(Color.parseColor("#1a1a2e"));

            WebSettings s = webView.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setLoadWithOverviewMode(true);
            s.setUseWideViewPort(true);
            s.setSupportZoom(false);
            s.setBuiltInZoomControls(false);
            s.setCacheMode(WebSettings.LOAD_NO_CACHE);
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageStarted(android.webkit.WebView view, String url, android.graphics.Bitmap favicon) {
                    if (callback != null) callback.onPageStarted(url);
                }
                @Override
                public void onPageFinished(android.webkit.WebView view, String url) {
                    if (callback != null) callback.onPageFinished(url);
                }
                @Override
                public void onReceivedError(android.webkit.WebView view, WebResourceRequest request, WebResourceError error) {
                    if (request.isForMainFrame() && callback != null) {
                        String desc = error.getDescription() != null ? error.getDescription().toString() : "unknown";
                        callback.onError(desc, request.getUrl().toString());
                    }
                }
            });

            root.removeAllViews();
            root.setBackgroundColor(Color.parseColor("#1a1a2e"));
            root.addView(webView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT));
            webView.loadUrl(url);
        }, 5000);
    }
}
