package com.islandtacos.display;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Display;

/**
 * Foreground Service that owns the CustomerDisplayPresentation.
 *
 * Why a Service: android.app.Presentation is tied to the Activity that shows it.
 * When the operator switches to the POS in Chrome, our Activity goes to the
 * background and Sunmi OS reverts the secondary display to mirror mode.
 * A foreground Service keeps the Presentation alive permanently, so the
 * customer display stays on screen regardless of which app is in the foreground.
 *
 * START_STICKY ensures the Service is restarted by the OS if it is killed.
 *
 * IMPORTANT: Presentation must be created with getApplicationContext(), NOT
 * 'this' (Service). Dialog/Presentation requires a context that can provide
 * application-level theming. A bare Service context causes a crash on
 * Android 7.x when the Dialog tries to resolve its window theme.
 */
public class DisplayService extends Service implements DisplayManager.DisplayListener {

    // ── Change this to match your mini PC's local IP ──────────────────────────
    static final String DISPLAY_URL = "http://192.168.132.100:3001/display";

    private static final String CHANNEL_ID   = "customer_display_ch";
    private static final String CHANNEL_NAME = "Customer Display";
    private static final int    NOTIF_ID     = 1;

    // ── Status callback (optional, used by bound MainActivity) ────────────────
    public interface StatusListener {
        void onStatus(String msg);
    }

    public class LocalBinder extends Binder {
        DisplayService getService() { return DisplayService.this; }
    }

    private final IBinder binder      = new LocalBinder();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private DisplayManager              displayManager;
    private CustomerDisplayPresentation presentation;
    private StatusListener              statusListener;
    private String                      lastStatus = "Starting…";

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        displayManager = (DisplayManager) getSystemService(DISPLAY_SERVICE);
        displayManager.registerDisplayListener(this, mainHandler);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // startForeground() requires API 26+ (and FOREGROUND_SERVICE permission on API 28+).
        // On Android 7.x (API 25) background services work fine — no restrictions were
        // introduced until API 26. Calling startForeground() on API 25 is not harmful per se,
        // but some Sunmi OS builds crash with the foreground-service machinery. Skip it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForeground(NOTIF_ID, buildNotification("Starting customer display…"));
        }
        // Use anonymous Runnable — avoids method-reference desugaring on API 25
        mainHandler.post(new Runnable() {
            @Override public void run() { tryShowPresentation(); }
        });
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return binder; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        displayManager.unregisterDisplayListener(this);
        dismissPresentation();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** MainActivity binds and sets this to receive live status strings. */
    void setStatusListener(StatusListener listener) {
        this.statusListener = listener;
        if (listener != null) listener.onStatus(lastStatus);
    }

    // ── Display management ────────────────────────────────────────────────────

    private void tryShowPresentation() {
        Display[] all = displayManager.getDisplays();
        Display secondary = findSecondaryDisplay(all);

        if (secondary != null) {
            final int screenId = secondary.getDisplayId();

            // Already showing on this display → nothing to do
            if (presentation != null
                    && presentation.isShowing()
                    && presentation.getDisplay().getDisplayId() == screenId) {
                return;
            }

            dismissPresentation();

            // Use getApplicationContext() — Presentation extends Dialog and needs
            // a Context that can resolve themes. A bare Service context cannot do
            // this on Android 7.x and causes a crash. Application context can.
            Context appCtx = getApplicationContext();

            try {
                presentation = new CustomerDisplayPresentation(
                        appCtx, secondary, DISPLAY_URL,
                        new CustomerDisplayPresentation.LoadCallback() {
                            @Override public void onPageStarted(String url) {
                                setStatus("Screen #" + screenId + ": loading…");
                            }
                            @Override public void onPageFinished(String url) {
                                setStatus("Customer display active \u2713  (screen #" + screenId + ")");
                            }
                            @Override public void onError(String description, String url) {
                                setStatus("Screen #" + screenId + " error: " + description);
                            }
                        });

                presentation.show();
                setStatus("Presentation shown on screen #" + screenId);
            } catch (Exception e) {
                presentation = null;
                setStatus("Presentation error: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            }

        } else {
            dismissPresentation();
            StringBuilder sb = new StringBuilder("Waiting for secondary screen…\n\nDisplays found:");
            for (Display d : all) {
                sb.append("\n  #").append(d.getDisplayId())
                  .append(" flags=0x").append(Integer.toHexString(d.getFlags()))
                  .append(" \"").append(d.getName()).append("\"");
            }
            setStatus(sb.toString());
        }
    }

    private void dismissPresentation() {
        if (presentation != null) {
            try { presentation.dismiss(); } catch (Exception ignored) {}
            presentation = null;
        }
    }

    private Display findSecondaryDisplay(Display[] all) {
        Display fallback = null;
        for (Display d : all) {
            if (d.getDisplayId() == Display.DEFAULT_DISPLAY) continue;
            if ((d.getFlags() & Display.FLAG_PRESENTATION) != 0) return d;
            if (fallback == null) fallback = d;
        }
        return fallback;
    }

    // ── Status / Notification ─────────────────────────────────────────────────

    private void setStatus(final String msg) {
        lastStatus = msg;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(msg));
        if (statusListener != null) statusListener.onStatus(msg);
    }

    private Notification buildNotification(String text) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            //noinspection deprecation
            builder = new Notification.Builder(this);
        }
        return builder
                .setContentTitle("Island Tacos · Customer Display")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Keeps the customer-facing secondary display active");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    // ── DisplayManager.DisplayListener ────────────────────────────────────────

    @Override
    public void onDisplayAdded(int displayId) {
        mainHandler.post(new Runnable() {
            @Override public void run() { tryShowPresentation(); }
        });
    }

    @Override
    public void onDisplayRemoved(int displayId) {
        final int removedId = displayId;
        mainHandler.post(new Runnable() {
            @Override public void run() {
                if (presentation != null
                        && presentation.getDisplay().getDisplayId() == removedId) {
                    dismissPresentation();
                }
                tryShowPresentation();
            }
        });
    }

    @Override public void onDisplayChanged(int displayId) {}
}
