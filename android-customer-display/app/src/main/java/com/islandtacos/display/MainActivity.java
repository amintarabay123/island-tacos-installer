package com.islandtacos.display;

import android.app.Activity;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.view.Display;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity implements DisplayManager.DisplayListener {

    // ── Change this URL to match your mini PC's local IP ──────────────────────
    private static final String DISPLAY_URL = "http://192.168.132.100:3001/display";

    private DisplayManager displayManager;
    private CustomerDisplayPresentation presentation;
    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(0xFF1a1a2e);

        statusText = new TextView(this);
        statusText.setTextColor(0xFFffffff);
        statusText.setTextSize(16);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(60, 60, 60, 60);
        layout.addView(statusText);
        setContentView(layout);

        displayManager = (DisplayManager) getSystemService(DISPLAY_SERVICE);
        displayManager.registerDisplayListener(this, null);

        tryShowPresentation();
    }

    private void tryShowPresentation() {
        Display[] all = displayManager.getDisplays();

        StringBuilder diag = new StringBuilder();
        for (Display d : all) {
            diag.append("\n  #").append(d.getDisplayId())
                .append(" flags=0x").append(Integer.toHexString(d.getFlags()))
                .append(" \"").append(d.getName()).append("\"");
        }

        Display second = getSecondaryDisplay(all);
        if (second != null) {
            if (presentation == null || presentation.getDisplay().getDisplayId() != second.getDisplayId()) {
                if (presentation != null) presentation.dismiss();

                final int screenId = second.getDisplayId();
                presentation = new CustomerDisplayPresentation(this, second, DISPLAY_URL,
                        new CustomerDisplayPresentation.LoadCallback() {
                            @Override public void onPageStarted(String url) {
                                setStatus("Screen #" + screenId + ": Loading bundled display...");
                            }
                            @Override public void onPageFinished(String url) {
                                setStatus("Customer display active \u2713\n\nScreen #" + screenId + " ready");
                            }
                            @Override public void onError(String description, String url) {
                                setStatus("Screen #" + screenId + " LOAD ERROR\n\n"
                                        + description
                                        + "\n\nCheck: Is the mini PC on and the IP correct?\n" + url);
                            }
                        });

                presentation.show();
                setStatus("Presentation shown on screen #" + screenId + "\n\nAll displays:" + diag);
            }
        } else {
            setStatus("Island Tacos Customer Display\n\nWaiting for secondary screen...\n\nAll displays:"
                    + diag + "\n\nMake sure the customer-facing display is powered on.");
        }
    }

    private Display getSecondaryDisplay(Display[] all) {
        Display fallback = null;
        for (Display d : all) {
            if (d.getDisplayId() == Display.DEFAULT_DISPLAY) continue;
            if ((d.getFlags() & Display.FLAG_PRESENTATION) != 0) return d;
            if (fallback == null) fallback = d;
        }
        return fallback;
    }

    private void setStatus(final String msg) {
        runOnUiThread(() -> statusText.setText(msg));
    }

    @Override public void onDisplayAdded(int id)   { runOnUiThread(this::tryShowPresentation); }
    @Override public void onDisplayRemoved(int id) {
        runOnUiThread(() -> {
            if (presentation != null && presentation.getDisplay().getDisplayId() == id) {
                presentation.dismiss();
                presentation = null;
                setStatus("Secondary screen disconnected.\nWaiting to reconnect...");
            }
        });
    }
    @Override public void onDisplayChanged(int id) {}

    @Override protected void onResume()  { super.onResume();  tryShowPresentation(); }
    @Override protected void onDestroy() {
        super.onDestroy();
        displayManager.unregisterDisplayListener(this);
        if (presentation != null) presentation.dismiss();
    }
}
