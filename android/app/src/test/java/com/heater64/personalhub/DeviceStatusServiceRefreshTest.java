package com.heater64.personalhub;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
public class DeviceStatusServiceRefreshTest {

    @Test
    @Config(sdk = { 29, 34, 36 })
    public void notificationTapCanRestartRefreshInForegroundWithoutBackgroundLocationPermission() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.stop(context);
        DeviceStatusService.prefs(context).edit().clear().commit();
        Settings.Secure.putInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_HIGH_ACCURACY);
        LocationManager manager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user-id", "couple-id",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());
        assertTrue(DeviceStatusService.configure(context, config, false));

        DeviceStatusService.requestLocationUpdateFromUser(context);

        Intent started = Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService();
        assertNotNull("the notification tap should restart the enabled refresh service", started);
        assertEquals(DeviceStatusService.ACTION_REFRESH, started.getAction());
    }

    @Test
    @Config(sdk = { 29, 34, 36 })
    public void remoteRefreshStillRequiresBackgroundLocationPermissionWhenServiceIsStopped() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.stop(context);
        DeviceStatusService.prefs(context).edit().clear().commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);
        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user-id", "couple-id",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());
        assertTrue(DeviceStatusService.configure(context, config, false));

        DeviceStatusService.requestLocationUpdate(context);

        assertNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
    }
}
