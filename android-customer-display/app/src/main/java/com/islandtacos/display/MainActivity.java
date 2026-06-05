package com.islandtacos.display;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.IBinder;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Operator-facing status screen.
 *
 * All display management lives in DisplayService (a foreground Service) so
 * the Presentation on the secondary screen stays alive even when the operator
 * switches to Chrome/POS. This Activity just starts the Service, binds to it
 * for live status strings, and shows them on the primary screen.
 */
public class MainActivity extends Activity {

    private TextView      statusText;
    private DisplayService displayService;
    private boolean        bound = false;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            displayService = ((DisplayService.LocalBinder) binder).getService();
            bound = true;
            // Receive live status updates from the service
            displayService.setStatusListener(msg -> runOnUiThread(() -> {
                if (statusText != null) statusText.setText(msg);
            }));
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            bound = false;
            displayService = null;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // ── Operator UI ───────────────────────────────────────────────────────
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(0xFF1a1a2e);

        statusText = new TextView(this);
        statusText.setTextColor(0xFFffffff);
        statusText.setTextSize(16);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(60, 60, 60, 60);
        statusText.setText("Starting customer display service…");
        layout.addView(statusText);
        setContentView(layout);

        // ── Start + bind the foreground service ───────────────────────────────
        Intent serviceIntent = new Intent(this, DisplayService.class);
        startService(serviceIntent);
        bindService(serviceIntent, serviceConnection, BIND_AUTO_CREATE);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (bound) {
            // Remove listener so the service doesn't hold a reference to this Activity
            if (displayService != null) displayService.setStatusListener(null);
            unbindService(serviceConnection);
            bound = false;
        }
        // Note: we do NOT stop the service here — it must keep running so the
        // Presentation stays on the secondary screen when the operator uses Chrome.
    }
}
