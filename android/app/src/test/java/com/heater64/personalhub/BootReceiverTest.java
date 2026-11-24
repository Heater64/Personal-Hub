package com.heater64.personalhub;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
public class BootReceiverTest {

    @Test
    @Config(sdk = 34)
    public void enabledTrackingRestartsAfterBootWhenPermissionsAllowIt() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        prepareEnabledTracking(context);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        new BootReceiver().onReceive(context, new Intent(Intent.ACTION_BOOT_COMPLETED));

        assertNotNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
    }

    @Test
    @Config(sdk = 34)
    public void enabledTrackingRestartsAfterAppReplacementWhenPermissionsAllowIt() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        prepareEnabledTracking(context);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        new BootReceiver().onReceive(context, new Intent(Intent.ACTION_MY_PACKAGE_REPLACED));

        assertNotNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
    }

    @Test
    @Config(sdk = 34)
    public void enabledTrackingDoesNotStartAfterBootWithoutBackgroundPermission() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        prepareEnabledTracking(context);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        new BootReceiver().onReceive(context, new Intent(Intent.ACTION_BOOT_COMPLETED));

        assertNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
    }

    @Test
    @Config(sdk = 34)
    public void appReplacementDoesNotStartTrackingWithoutBackgroundPermission() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        prepareEnabledTracking(context);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        new BootReceiver().onReceive(context, new Intent(Intent.ACTION_MY_PACKAGE_REPLACED));

        assertNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
    }

    @Test
    @Config(sdk = 34)
    public void unrelatedBroadcastDoesNotStartTracking() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        prepareEnabledTracking(context);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        new BootReceiver().onReceive(context, new Intent(Intent.ACTION_TIME_CHANGED));

        assertNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
    }

    private static void prepareEnabledTracking(Context context) throws Exception {
        DeviceStatusService.stop(context);
        SharedPreferences prefs = DeviceStatusService.prefs(context);
        prefs.edit().clear().commit();
        Settings.Secure.putInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_HIGH_ACCURACY);
        LocationManager manager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);

        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user-id", "couple-id",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());
        DeviceStatusService.configure(context, config, false);
    }
}
