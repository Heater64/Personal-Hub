package com.heater64.personalhub;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
public class DeviceStatusPluginNotificationTest {

    @Test
    @Config(sdk = { 26, 34, 36 })
    public void disabledPartnerNotificationChannelIsReportedEvenWhenPermissionIsGranted() {
        Context context = RuntimeEnvironment.getApplication();
        grantNotificationPermissionWhenRequired(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
                context.getString(R.string.default_notification_channel_id), "Default",
                NotificationManager.IMPORTANCE_NONE));

        assertFalse(DeviceStatusPlugin.arePartnerNotificationsEnabled(context));
    }

    @Test
    @Config(sdk = { 26, 34, 36 })
    public void enabledPartnerNotificationChannelIsReported() {
        Context context = RuntimeEnvironment.getApplication();
        grantNotificationPermissionWhenRequired(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
                context.getString(R.string.default_notification_channel_id), "Default",
                NotificationManager.IMPORTANCE_DEFAULT));

        assertTrue(DeviceStatusPlugin.arePartnerNotificationsEnabled(context));
    }

    @Test
    @Config(sdk = { 34, 36 })
    public void deniedRuntimePermissionIsReported() {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);

        assertFalse(DeviceStatusPlugin.arePartnerNotificationsEnabled(context));
    }

    private static void grantNotificationPermissionWhenRequired(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Shadows.shadowOf(RuntimeEnvironment.getApplication())
                    .grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        }
    }
}
