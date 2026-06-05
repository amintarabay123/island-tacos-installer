package com.islandtacos.display;

import android.app.Presentation;
import android.content.Context;
import android.os.Bundle;
import android.view.Display;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.InputStream;
import java.net.URL;

public class CustomerDisplayPresentation extends Presentation {

    public interface LoadCallback {
        void onPageStarted(String url);
        void onPageFinished(String url);
        void onError(String description, String url);
    }

    private final String displayUrl;
    private final LoadCallback callback;

    public CustomerDisplayPresentation(Context context, Display display, String displayUrl, LoadCallback callback) {
        super(context, display);
        this.displayUrl = displayUrl;
        this.callback = callback;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = new WebView(getContext());
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // Allow the locally-loaded page to make network requests to the mini PC
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);

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
        loadBundledDisplay(webView);
    }

    /**
     * Loads display.html from APK assets.
     *
     * Why: The external React/Vite app uses ES modules and dynamic import()
     * which are not supported by the WebView on Android 7.1.2 (Chrome ~55).
     * The bundled plain HTML+JS works on any WebView >= Chrome 42.
     *
     * loadDataWithBaseURL uses the mini PC origin as the base URL so that
     * the vanilla JS inside display.html can resolve /api/display correctly
     * via fetch() without CORS issues.
     */
    private void loadBundledDisplay(WebView webView) {
        try {
            // Read the bundled asset
            InputStream is = getContext().getAssets().open("display.html");
            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            String html = new String(buffer, "UTF-8");

            // Derive API URL from the display URL
            String apiUrl = deriveApiUrl(displayUrl);

            // Inject the API URL so the JS knows where to poll
            String injected = html.replace("</head>",
                "<script>window.DISPLAY_API_URL='" + apiUrl + "';</script></head>");

            // Use mini PC origin as base URL so relative paths (e.g. images) work
            String baseUrl = deriveBaseUrl(displayUrl);
            webView.loadDataWithBaseURL(baseUrl, injected, "text/html", "UTF-8", null);

        } catch (Exception e) {
            // If assets can't be read, fall back to the external URL
            if (callback != null) callback.onError("Failed to load bundled display: " + e.getMessage(), displayUrl);
            webView.loadUrl(displayUrl);
        }
    }

    /** http://192.168.132.100:3001/display  ->  http://192.168.132.100:3001/api/display */
    private String deriveApiUrl(String url) {
        try {
            URL u = new URL(url);
            int port = u.getPort();
            String portStr = port > 0 ? ":" + port : "";
            return u.getProtocol() + "://" + u.getHost() + portStr + "/api/display";
        } catch (Exception e) {
            return "http://192.168.132.100:3001/api/display";
        }
    }

    /** http://192.168.132.100:3001/display  ->  http://192.168.132.100:3001/ */
    private String deriveBaseUrl(String url) {
        try {
            URL u = new URL(url);
            int port = u.getPort();
            String portStr = port > 0 ? ":" + port : "";
            return u.getProtocol() + "://" + u.getHost() + portStr + "/";
        } catch (Exception e) {
            return "http://192.168.132.100:3001/";
        }
    }
}
