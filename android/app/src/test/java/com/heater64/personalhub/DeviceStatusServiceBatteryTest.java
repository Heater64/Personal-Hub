package com.heater64.personalhub;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.SystemClock;
import android.provider.Settings;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ServiceController;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
public class DeviceStatusServiceBatteryTest {

    @Test
    public void batteryAlertRetriesOnlyWhenUnauthorizedAndTheSessionWasRenewed() {
        DeviceStatusService.Session current = new DeviceStatusService.Session("expired", "refresh", 0L);
        DeviceStatusService.Session renewed = new DeviceStatusService.Session("fresh", "refresh-2", 3_600_000L);

        assertTrue(DeviceStatusService.shouldRetryBatteryAlert(401, current, renewed));
        assertFalse(DeviceStatusService.shouldRetryBatteryAlert(503, current, renewed));
        assertFalse(DeviceStatusService.shouldRetryBatteryAlert(401, current, current));
        assertFalse(DeviceStatusService.shouldRetryBatteryAlert(401, current, null));
    }

    @Test
    public void failedBatteryAlertsRetryWithinSixtySecondsUntilDelivered() {
        assertEquals(60_000L, DeviceStatusService.nextPublishDelay(false, "battery-low", true, false));
        assertEquals(300_000L, DeviceStatusService.nextPublishDelay(false, "battery-low", true, true));
        assertEquals(60_000L, DeviceStatusService.nextPublishDelay(false, "upload-failed", false, true));
        assertEquals(5_000L, DeviceStatusService.nextPublishDelay(true, "", false, true));
    }

    @Test
    public void batteryAlertRetriesBackOffToProtectBatteryButConnectionRecoveryRemainsImmediate() {
        assertEquals(60_000L, DeviceStatusService.batteryAlertRetryDelay(1));
        assertEquals(120_000L, DeviceStatusService.batteryAlertRetryDelay(2));
        assertEquals(240_000L, DeviceStatusService.batteryAlertRetryDelay(3));
        assertEquals(480_000L, DeviceStatusService.batteryAlertRetryDelay(4));
        assertEquals(900_000L, DeviceStatusService.batteryAlertRetryDelay(5));
        assertEquals(900_000L, DeviceStatusService.batteryAlertRetryDelay(12));
        assertEquals(5_000L, DeviceStatusService.nextPublishDelay(true, "battery-low", true, false, 5));
    }

    @Test
    public void batteryAlertQueueIsNotBlockedByAnInFlightLocationUpload() throws Exception {
        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();
        ExecutorService locationUploads = (ExecutorService) field(service, "io");
        ExecutorService batteryAlerts = (ExecutorService) field(service, "batteryAlerts");
        CountDownLatch uploadStarted = new CountDownLatch(1);
        CountDownLatch releaseUpload = new CountDownLatch(1);
        CountDownLatch alertStarted = new CountDownLatch(1);

        locationUploads.execute(() -> {
            uploadStarted.countDown();
            try {
                releaseUpload.await(2, TimeUnit.SECONDS);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
        });
        assertTrue("the location upload is already holding its queue", uploadStarted.await(1, TimeUnit.SECONDS));

        batteryAlerts.execute(alertStarted::countDown);

        assertTrue("a low-battery alert gets its own queue", alertStarted.await(1, TimeUnit.SECONDS));
        releaseUpload.countDown();
        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    public void reachingTwentyDispatchesOnePartnerAlertWithoutWaitingForThePublishTick() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.prefs(context).edit().clear().commit();
        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user", "couple",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());
        assertTrue(DeviceStatusService.configure(context, config, false));
        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();
        CapturingExecutorService urgentQueue = new CapturingExecutorService();
        field(service, "batteryAlerts", urgentQueue);
        call(service, "createChannel");
        field(DeviceStatusService.class, "active", service);

        call(service, "handleBatteryLevel", new Class<?>[] { int.class }, 20);
        call(service, "handleBatteryLevel", new Class<?>[] { int.class }, 19);

        assertTrue(DeviceStatusService.prefs(context).getBoolean("battery_paused", false));
        assertEquals("crossing the threshold dispatches independently of the location tick", 1,
                urgentQueue.tasks.size());
        assertTrue((boolean) field(service, "batteryAlertSending"));

        field(DeviceStatusService.class, "active", null);
        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    public void locationEventRetriesOnlyWhenUnauthorizedAndTheSessionWasRenewed() {
        DeviceStatusService.Session current = new DeviceStatusService.Session("expired", "refresh", 0L);
        DeviceStatusService.Session renewed = new DeviceStatusService.Session("fresh", "refresh-2", 3_600_000L);

        assertTrue(DeviceStatusService.shouldRetryLocationUpdate(401, current, renewed));
        assertFalse(DeviceStatusService.shouldRetryLocationUpdate(503, current, renewed));
        assertFalse(DeviceStatusService.shouldRetryLocationUpdate(401, current, current));
        assertFalse(DeviceStatusService.shouldRetryLocationUpdate(401, current, null));
    }

    @Test
    public void inaccurateGeofenceResponseIsRecognizedWithoutTreatingOtherResponsesAsWarnings() {
        assertTrue(DeviceStatusService.isUnreliableGeofenceResponse(
                "{\"sent\":0,\"skipped\":true,\"reason\":\"inaccurate-location\"}"));
        assertFalse(DeviceStatusService.isUnreliableGeofenceResponse("{\"sent\":1}"));
        assertFalse(DeviceStatusService.isUnreliableGeofenceResponse("not-json"));
    }

    @Test
    public void pausedSnapshotSharesBatteryStateWithoutRefreshingTheGpsTimestamp() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        DeviceStatusService.prefs(context).edit().putBoolean("battery_paused", true).commit();

        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();
        String lastFixAt = "2026-11-24T11:00:00.000Z";
        JSONObject previous = new JSONObject()
                .put("user_id", "user")
                .put("lat", 40.4168)
                .put("lng", -3.7038)
                .put("location_at", lastFixAt)
                .put("location_precision", "precise");
        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user", "couple",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, previous);

        JSONObject snapshot = (JSONObject) call(service, "snapshot", new Class<?>[] { DeviceStatusService.Config.class }, config);

        assertTrue(snapshot.getBoolean("batteryPaused"));
        assertEquals(lastFixAt, snapshot.getString("location_at"));
        assertEquals(40.4168, snapshot.getDouble("lat"), 0.00001);
        assertEquals(-3.7038, snapshot.getDouble("lng"), 0.00001);

        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    @Config(sdk = { 24, 26, 29, 31, 33, 34, 36 })
    public void batteryReceiverPausesAtTwentyAndResumesAtThirty() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.prefs(context).edit().clear().commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
                Manifest.permission.POST_NOTIFICATIONS);
        Settings.Secure.putInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_HIGH_ACCURACY);
        LocationManager locationManager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);
        context.sendStickyBroadcast(batteryIntent(50));
        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "", "anon-key", "user", "couple",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());
        assertTrue(DeviceStatusService.configure(context, config, false));
        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .withIntent(new Intent(context, DeviceStatusService.class))
                .create()
                .startCommand(0, 1);
        DeviceStatusService service = controller.get();
        assertTrue("the foreground service stays active through battery transitions",
                DeviceStatusService.isRunning());
        assertNotNull("location updates start while battery is above the threshold", field(service, "locationListener"));

        context.sendStickyBroadcast(batteryIntent(21));
        Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
        assertFalse("21% remains above the pause threshold (observed level=" + field(service, "batteryLevel") + ")",
                DeviceStatusService.prefs(context).getBoolean("battery_paused", false));
        assertNotNull(field(service, "locationListener"));

        context.sendStickyBroadcast(batteryIntent(20));
        Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
        assertTrue(DeviceStatusService.prefs(context).getBoolean("battery_paused", false));
        assertNull("location updates stop at 20%", field(service, "locationListener"));

        context.sendStickyBroadcast(batteryIntent(21));
        Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
        assertTrue("21% stays paused until recovery reaches 30%",
                DeviceStatusService.prefs(context).getBoolean("battery_paused", false));

        context.sendStickyBroadcast(batteryIntent(29));
        Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
        assertTrue("the 21–29% hysteresis band stays paused",
                DeviceStatusService.prefs(context).getBoolean("battery_paused", false));
        assertNull(field(service, "locationListener"));

        context.sendStickyBroadcast(batteryIntent(30));
        Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
        assertFalse("location tracking resumes at 30%", DeviceStatusService.prefs(context)
                .getBoolean("battery_paused", true));
        assertNotNull("the battery event registers location updates again", field(service, "locationListener"));
        assertTrue("reaching 30% must not stop the foreground service", DeviceStatusService.isRunning());

        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    @Config(sdk = { 24, 26, 29, 31, 33, 34, 36 })
    public void foregroundNotificationShowsBatteryPauseAndResumeImmediately() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        LocationManager locationManager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);
        DeviceStatusService.prefs(context).edit().clear().commit();
        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();
        call(service, "createChannel");

        call(service, "handleBatteryLevel", new Class<?>[] { int.class }, 20);

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        Notification paused = Shadows.shadowOf(manager).getAllNotifications().get(0);
        assertEquals("Ubicación pausada · batería 20%", paused.extras.getString(Notification.EXTRA_TEXT));

        call(service, "updateNotification", new Class<?>[] { JSONObject.class, String.class },
                new JSONObject().put("battery", 21).put("batteryPaused", false), "");
        Notification afterStaleUpload = Shadows.shadowOf(manager).getAllNotifications().get(0);
        assertEquals("a stale upload must not overwrite the pause state",
                "Ubicación pausada · batería 20%", afterStaleUpload.extras.getString(Notification.EXTRA_TEXT));

        call(service, "handleBatteryLevel", new Class<?>[] { int.class }, 30);

        Notification resumed = Shadows.shadowOf(manager).getAllNotifications().get(0);
        assertEquals("Ubicación reanudada · batería 30%", resumed.extras.getString(Notification.EXTRA_TEXT));

        call(service, "updateNotification", new Class<?>[] { JSONObject.class, String.class },
                new JSONObject().put("battery", 20).put("batteryPaused", true), "");
        Notification afterStalePausedUpload = Shadows.shadowOf(manager).getAllNotifications().get(0);
        assertEquals("a stale paused upload must not undo the resume state",
                "30%", afterStalePausedUpload.extras.getString(Notification.EXTRA_TEXT));
        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    public void locationRegistrationIsIdempotent() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);

        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();

        call(service, "registerLocationUpdates");
        Object firstListener = field(service, "locationListener");
        call(service, "registerLocationUpdates");

        assertSame("repeated starts must keep the same registered listener", firstListener,
                field(service, "locationListener"));
        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    @Config(sdk = { 24, 26, 29, 31, 33, 34, 36 })
    public void batteryPauseCancelsAnOutstandingOneShotLocationRequest() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.prefs(context).edit().clear().commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        LocationManager locationManager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);

        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();
        call(service, "requestFreshLocation");

        assertNotNull("the partner refresh should register its one-shot location listener",
                field(service, "singleLocationListener"));
        assertNotNull("a one-shot request must have a bounded timeout", field(service, "singleFixTimeout"));

        call(service, "handleBatteryLevel", new Class<?>[] { int.class }, 20);

        assertNull("battery pause must cancel an in-flight one-shot listener",
                field(service, "singleLocationListener"));
        assertNull("battery pause must cancel the one-shot timeout", field(service, "singleFixTimeout"));
        Location lateCallback = new Location(LocationManager.GPS_PROVIDER);
        lateCallback.setTime(System.currentTimeMillis());
        lateCallback.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        call(service, "acceptLocation", new Class<?>[] { Location.class }, lateCallback);
        assertNull("a callback already queued at the threshold must not become the latest fix",
                field(service, "lastFix"));
        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    public void startupBatterySnapshotPreventsLocationRegistrationAtTwentyPercent() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        context.sendStickyBroadcast(batteryIntent(20));

        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();

        call(service, "registerDeviceObservers");
        assertTrue("the sticky battery level pauses tracking before location starts",
                DeviceStatusService.prefs(context).getBoolean("battery_paused", false));
        call(service, "registerLocationUpdates");

        assertNull("a service starting at 20% must not request location", field(service, "locationListener"));
        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    @Config(sdk = { 24, 26, 29, 31, 33, 34, 36 })
    public void recreatedServiceResumesFromStickyBatterySnapshotAtThirtyPercent() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.prefs(context).edit().clear().commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION);
        LocationManager locationManager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        Shadows.shadowOf(locationManager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);
        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user", "couple",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());
        assertTrue(DeviceStatusService.configure(context, config, false));
        DeviceStatusService.prefs(context).edit().putBoolean("battery_paused", true).commit();
        context.sendStickyBroadcast(batteryIntent(30));

        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .withIntent(new Intent(context, DeviceStatusService.class))
                .create()
                .startCommand(0, 1);
        DeviceStatusService service = controller.get();

        assertFalse("recreation must apply the device's current 30% sticky battery level",
                DeviceStatusService.prefs(context).getBoolean("battery_paused", true));
        assertNotNull("location observation must be restored with the service", field(service, "locationListener"));
        assertTrue("the recreated foreground service must remain running", DeviceStatusService.isRunning());

        call(service, "shutdown");
        controller.destroy();
    }

    @Test
    public void changingAccountResetsBatteryAlertDeliveryButKeepsThePause() {
        Context context = RuntimeEnvironment.getApplication();
        DeviceStatusService.prefs(context).edit()
                .putBoolean("enabled", true)
                .putBoolean("battery_paused", true)
                .putBoolean("battery_alert_sent", true)
                .putBoolean("battery_alert_delivered", true)
                .putString("user_id", "previous-user")
                .putString("couple_id", "previous-couple")
                .putString("url", "https://previous.supabase.co")
                .commit();
        DeviceStatusService.Config nextAccount = new DeviceStatusService.Config(
                "https://next.supabase.co", "https://api.example.com", "anon-key", "next-user", "next-couple",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());

        assertTrue(DeviceStatusService.configure(context, nextAccount, false));

        assertTrue("low-battery pause applies to the physical device", DeviceStatusService.prefs(context)
                .getBoolean("battery_paused", false));
        assertFalse("the new partner must receive the low-battery alert", DeviceStatusService.prefs(context)
                .getBoolean("battery_alert_delivered", true));
        assertFalse("alert bookkeeping belongs to the previous account", DeviceStatusService.prefs(context)
                .getBoolean("battery_alert_sent", true));
    }

    @Test
    @Config(sdk = 34)
    public void snapshotReportsWhenSystemLocationIsDisabled() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        Settings.Secure.putInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_OFF);
        LocationManager manager = context.getSystemService(LocationManager.class);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.GPS_PROVIDER, false);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.NETWORK_PROVIDER, false);

        ServiceController<DeviceStatusService> controller = Robolectric
                .buildService(DeviceStatusService.class)
                .create();
        DeviceStatusService service = controller.get();
        DeviceStatusService.Config config = new DeviceStatusService.Config(
                "https://example.supabase.co", "https://example.com", "anon-key", "user", "couple",
                false, "Test", "", new DeviceStatusService.Session("access-token", "refresh-token",
                        System.currentTimeMillis() + 3_600_000L), 0L, new JSONObject());

        JSONObject snapshot = (JSONObject) call(service, "snapshot",
                new Class<?>[] { DeviceStatusService.Config.class }, config);

        assertEquals("disabled", snapshot.getString("locationServices"));
        call(service, "shutdown");
        controller.destroy();
    }

    private static Intent batteryIntent(int level) {
        return new Intent(Intent.ACTION_BATTERY_CHANGED)
                .putExtra(BatteryManager.EXTRA_LEVEL, level)
                .putExtra(BatteryManager.EXTRA_SCALE, 100)
                .putExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_DISCHARGING);
    }

    private static Object field(Object target, String name) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
    }

    private static void field(Object target, String name, Object value) throws Exception {
        Field field = target instanceof Class<?> type
                ? type.getDeclaredField(name) : target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target instanceof Class<?> ? null : target, value);
    }

    private static void call(Object target, String name) throws Exception {
        call(target, name, new Class<?>[0]);
    }

    private static Object call(Object target, String name, Class<?>[] parameterTypes, Object... args) throws Exception {
        Method method = target.getClass().getDeclaredMethod(name, parameterTypes);
        method.setAccessible(true);
        return method.invoke(target, args);
    }

    private static final class CapturingExecutorService extends AbstractExecutorService {
        final List<Runnable> tasks = new ArrayList<>();
        private boolean shutdown;

        @Override public void shutdown() { shutdown = true; }
        @Override public List<Runnable> shutdownNow() { shutdown = true; return new ArrayList<>(tasks); }
        @Override public boolean isShutdown() { return shutdown; }
        @Override public boolean isTerminated() { return shutdown; }
        @Override public boolean awaitTermination(long timeout, TimeUnit unit) { return shutdown; }

        @Override public void execute(Runnable command) {
            if (shutdown) throw new IllegalStateException("executor is shut down");
            tasks.add(command);
        }
    }
}
