package com.heater64.personalhub;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Confirmación local al colocar un widget en la pantalla de inicio.
 *
 * Se dispara desde {@link HubWidgetProvider#onEnabled}, que Android envía solo
 * la primera vez que hay un widget de ese tipo (no en cada refresco ni al
 * actualizar la app), así que no genera avisos repetidos.
 */
final class WidgetAddedNotifier {
    private static final String CHANNEL = "widgets";
    private static final int NOTIFICATION_ID = 4312;

    private WidgetAddedNotifier() {}

    static void notifyAdded(Context context, Class<?> provider) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL,
                    context.getString(R.string.notification_channel_widgets),
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(context.getString(R.string.notification_channel_widgets_desc));
            manager.createNotificationChannel(channel);
        }

        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(context, NOTIFICATION_ID,
                launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String body = context.getString(R.string.widget_added_notification_body, label(context, provider));
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_add)
                .setContentTitle(context.getString(R.string.widget_added_notification_title))
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification.build());
        } catch (SecurityException error) {
            // El permiso puede haberse revocado entre la comprobación y el envío.
        }
    }

    /** Etiqueta del widget tal y como la eligió el usuario en el lanzador. */
    private static String label(Context context, Class<?> provider) {
        try {
            ActivityInfo info = context.getPackageManager()
                    .getReceiverInfo(new ComponentName(context, provider), 0);
            if (info.labelRes != 0) return context.getString(info.labelRes);
            if (info.nonLocalizedLabel != null) return info.nonLocalizedLabel.toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            // Sin etiqueta propia: cae al nombre de la app.
        }
        return context.getString(R.string.app_name);
    }
}
