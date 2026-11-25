package com.heater64.personalhub;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class WidgetMessagingService extends MessagingService {
    private static final String TAG = "WidgetMessagingService";
    private static final String LOCATION_REFRESH_CHANNEL = "location_refresh";
    private static final int LOCATION_REFRESH_NOTIFICATION_ID = 4311;

    @Override
    public void onNewToken(@NonNull String token) {
        // MessagingService registra el token en el plugin de Capacitor.
        super.onNewToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if ("location_refresh".equals(message.getData().get("type"))) {
            showLocationRefreshNotification();
            if (shouldStartLocationRefresh(message.getPriority())) {
                DeviceStatusService.requestLocationUpdate(this);
            } else {
                // Android can revoke the background-start exemption when FCM
                // downgrades a high-priority message. The notification remains
                // tappable so opening the app can perform the requested refresh.
                Log.w(TAG, "Actualización remota aplazada: prioridad FCM insuficiente");
            }
            return;
        }
        if ("widget_sync".equals(message.getData().get("type"))) {
            WidgetSync.request(this);
            return;
        }
        super.onMessageReceived(message);
    }

    static boolean shouldStartLocationRefresh(int priority) {
        return priority == RemoteMessage.PRIORITY_HIGH;
    }

    /** Hace visible la solicitud remota y cumple el propósito de su FCM urgente. */
    private void showLocationRefreshNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && manager.getNotificationChannel(LOCATION_REFRESH_CHANNEL) == null) {
            manager.createNotificationChannel(new NotificationChannel(
                    LOCATION_REFRESH_CHANNEL,
                    getString(R.string.notification_channel_location_refresh),
                    NotificationManager.IMPORTANCE_LOW));
        }

        Intent launch = new Intent(this, MainActivity.class)
                .setAction(DeviceStatusService.ACTION_USER_LOCATION_REFRESH)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(this, LOCATION_REFRESH_NOTIFICATION_ID,
                launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, LOCATION_REFRESH_CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(getString(R.string.location_refresh_notification_title))
                .setContentText(getString(R.string.location_refresh_notification_body))
                .setContentIntent(contentIntent)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(this).notify(LOCATION_REFRESH_NOTIFICATION_ID, notification.build());
        } catch (SecurityException error) {
            // El permiso puede haberse revocado entre la comprobación y el envío.
        }
    }

    @Override
    public void onDeletedMessages() {
        WidgetSync.request(this);
        super.onDeletedMessages();
    }
}
