package com.islandtacos.display;

import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Display;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class CustomerDisplayPresentation extends Presentation {

    public interface LoadCallback {
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

        WebView webView = new WebView(getContext());
        webView.setBackgroundColor(Color.parseColor("#1a1a2e")); // dark so we see it's alive

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString("IslandTacosDisplay/1.0 Android");

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

        setContentView(webView);
        webView.loadUrl(url);
    }
}
