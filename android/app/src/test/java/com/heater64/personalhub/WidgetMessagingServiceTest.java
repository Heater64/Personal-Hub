package com.heater64.personalhub;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import com.google.firebase.messaging.RemoteMessage;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowNotificationManager;
import org.robolectric.shadows.ShadowPendingIntent;

import java.util.List;
import java.util.Map;

@RunWith(RobolectricTestRunner.class)
public class WidgetMessagingServiceTest {

    @Test
    public void backgroundLocationRefreshRequiresEffectiveHighPriority() {
        assertTrue(WidgetMessagingService.shouldStartLocationRefresh(RemoteMessage.PRIORITY_HIGH));
        assertFalse(WidgetMessagingService.shouldStartLocationRefresh(RemoteMessage.PRIORITY_NORMAL));
    }

    @Test
    @Config(sdk = { 26, 29, 31, 33, 34, 36 })
    public void locationRefreshPostsASilentNotificationBeforeRefresh() {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);

        WidgetMessagingService service = Robolectric.buildService(WidgetMessagingService.class).create().get();
        RemoteMessage message = new RemoteMessage.Builder("test-sender")
                .setData(Map.of("type", "location_refresh"))
                .build();

        service.onMessageReceived(message);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        ShadowNotificationManager shadowManager = Shadows.shadowOf(manager);
        List<Notification> notifications = shadowManager.getAllNotifications();
        assertEquals(1, notifications.size());
        Notification notification = notifications.get(0);
        assertEquals(context.getString(R.string.location_refresh_notification_title),
                notification.extras.getString(Notification.EXTRA_TITLE));
        assertEquals(context.getString(R.string.location_refresh_notification_body),
                notification.extras.getString(Notification.EXTRA_TEXT));
        assertEquals(NotificationManager.IMPORTANCE_LOW,
                manager.getNotificationChannel("location_refresh").getImportance());
        ShadowPendingIntent tap = Shadows.shadowOf(notification.contentIntent);
        assertTrue("tapping the fallback notification must open the app", tap.isActivityIntent());
        assertEquals(DeviceStatusService.ACTION_USER_LOCATION_REFRESH, tap.getSavedIntent().getAction());
    }

    @Test
    @Config(sdk = { 33, 34, 36 })
    public void locationRefreshDoesNotPostWithoutNotificationPermission() {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);
        assertEquals(PackageManager.PERMISSION_DENIED,
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS));

        WidgetMessagingService service = Robolectric.buildService(WidgetMessagingService.class).create().get();
        service.onMessageReceived(new RemoteMessage.Builder("test-sender")
                .setData(Map.of("type", "location_refresh"))
                .build());

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        assertTrue(Shadows.shadowOf(manager).getAllNotifications().isEmpty());
    }
}
