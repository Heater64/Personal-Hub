package com.heater64.personalhub;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Comparte ubicación, batería y conexión desde un servicio iniciado por el usuario. */
public class DeviceStatusService extends Service {

    private static final String PREFS = "device_status";
    private static final String CHANNEL_ID = "device_status";
    private static final String ACTION_STOP = "com.heater64.personalhub.DEVICE_STATUS_STOP";
    static final String ACTION_REFRESH = "com.heater64.personalhub.DEVICE_STATUS_REFRESH";
    static final String ACTION_USER_LOCATION_REFRESH = "com.heater64.personalhub.USER_LOCATION_REFRESH";
    private static final String TAG = "DeviceStatus";
    private static final int NOTIFICATION_ID = 4310;
    private static final long HEARTBEAT_MS = 5 * 60 * 1000L;
    private static final long LOCATION_INTERVAL_MS = 2 * 60 * 1000L;
    private static final long CHANGE_DELAY_MS = 5_000L;
    private static final long RETRY_MS = 60_000L;
    private static final long MAX_BATTERY_ALERT_RETRY_MS = 15 * 60_000L;

    // La generación invalida envíos y renovaciones en curso al cambiar de cuenta o salir.
    private static final Object CONFIG_LOCK = new Object();
    private static long generation;

    // Los arranques, las paradas y los observadores se coordinan en el hilo principal.
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final List<Runnable> START_WAITERS = new ArrayList<>();
    private static volatile DeviceStatusService active;
    private static Runnable startTimeout;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ExecutorService events = Executors.newSingleThreadExecutor();
    // A stalled location upload must not delay the one-shot low-battery alert.
    private final ExecutorService batteryAlerts = Executors.newSingleThreadExecutor();
    private final Runnable tick = this::publishPending;
    private long scheduledAt = Long.MAX_VALUE;
    private boolean publishing;
    private boolean publishAgain;
    private boolean batteryAlertSending;
    private volatile Fix lastFix;

    private LocationManager locationManager;
    private LocationListener locationListener;
    private LocationListener singleLocationListener;
    private Runnable singleFixTimeout;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private BroadcastReceiver batteryReceiver;
    private int batteryLevel = -1;
    private boolean charging;
    private String connectionKey = "";

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean("enabled", false);
    }

    static boolean isRunning() {
        return active != null;
    }

    /** Atiende una petición de la pareja si el usuario ya activó el seguimiento. */
    static void requestLocationUpdate(Context context) {
        DeviceStatusService service = active;
        if (service != null) {
            MAIN.post(service::requestFreshLocation);
            return;
        }
        if (!isEnabled(context) || !hasBackgroundLocationPermission(context)) return;
        try {
            ContextCompat.startForegroundService(context,
                    new Intent(context, DeviceStatusService.class).setAction(ACTION_REFRESH));
        } catch (RuntimeException error) {
            Log.w(TAG, "Android rechazó la actualización solicitada", error);
        }
    }

    /** A notification tap brings the activity to the foreground, so it can refresh without background permission. */
    static void requestLocationUpdateFromUser(Context context) {
        DeviceStatusService service = active;
        if (service != null) {
            MAIN.post(service::requestFreshLocation);
            return;
        }
        if (!isEnabled(context) || !hasLocationPermission(context)) return;
        String prerequisite = startPrerequisite(context);
        if (!prerequisite.isEmpty()) {
            recordStartError(context, prerequisite);
            return;
        }
        try {
            ContextCompat.startForegroundService(context,
                    new Intent(context, DeviceStatusService.class).setAction(ACTION_REFRESH));
        } catch (RuntimeException error) {
            Log.w(TAG, "Android rechazó la actualización solicitada desde la app", error);
            recordStartError(context, "foreground-service-rejected");
        }
    }

    static boolean hasPreciseLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    static boolean hasLocationPermission(Context context) {
        return hasPreciseLocationPermission(context)
                || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    static boolean hasBackgroundLocationPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    static String locationServicesState(Context context) {
        LocationManager manager = context.getSystemService(LocationManager.class);
        if (manager == null) return "unknown";
        return LocationManagerCompat.isLocationEnabled(manager) ? "enabled" : "disabled";
    }

    static boolean configure(Context context, Config config, boolean resume) {
        synchronized (CONFIG_LOCK) {
            SharedPreferences prefs = prefs(context);
            boolean sameUser = config.userId().equals(prefs.getString("user_id", ""));
            boolean enabled = prefs.getBoolean("enabled", false);
            if (resume && (!enabled || !sameUser)) return false;

            boolean sameScope = enabled && sameUser
                    && config.coupleId().equals(prefs.getString("couple_id", ""))
                    && config.url().equals(prefs.getString("url", ""));
            SharedPreferences.Editor edit = prefs.edit();
            if (!sameScope) {
                generation++;
                clearSnapshot(edit);
                // The physical battery pause carries across accounts, but alert delivery
                // belongs to the previous partner scope and must be attempted again.
                edit.putBoolean("battery_alert_sent", false)
                        .putBoolean("battery_alert_delivered", false)
                        .remove("battery_alert_attempts");
            }
            // Evita reemplazar una sesión que el servicio acaba de renovar.
            if (!sameScope || config.session().expiresAt() >= prefs.getLong("expiresAt", 0L)) {
                writeSession(edit, config.session());
            }
            edit.putString("url", config.url())
                    .putString("apiOrigin", config.apiOrigin())
                    .putString("anonKey", config.anonKey())
                    .putString("user_id", config.userId())
                    .putString("couple_id", config.coupleId())
                    .putBoolean("is_admin", config.isAdmin())
                    .putString("name", config.name())
                    .putString("avatar", config.avatar())
                    .putBoolean("enabled", true)
                    .apply();
            return true;
        }
    }

    static String startPrerequisite(Context context) {
        if (!hasLocationPermission(context)) return "location-permission";
        return "disabled".equals(locationServicesState(context)) ? "location-disabled" : "";
    }

    /** Espera a que Android confirme el arranque en primer plano. */
    static void start(Context context, Runnable callback) {
        if (callback != null) START_WAITERS.add(callback);
        if (active != null) {
            active.schedulePublish(CHANGE_DELAY_MS);
            finishStart();
            return;
        }
        if (startTimeout != null) return;

        String error = startPrerequisite(context);
        if (readConfig(context) == null || !error.isEmpty()) {
            recordStartError(context, error.isEmpty() ? "session" : error);
            return;
        }
        try {
            ContextCompat.startForegroundService(context, new Intent(context, DeviceStatusService.class));
            Context app = context.getApplicationContext();
            startTimeout = () -> recordStartError(app, "foreground-service-timeout");
            MAIN.postDelayed(startTimeout, 4_000L);
        } catch (RuntimeException err) {
            Log.w(TAG, "Android rechazó el inicio del servicio", err);
            recordStartError(context, "foreground-service-rejected");
        }
    }

    private static void finishStart() {
        if (startTimeout != null) MAIN.removeCallbacks(startTimeout);
        startTimeout = null;
        List<Runnable> callbacks = new ArrayList<>(START_WAITERS);
        START_WAITERS.clear();
        for (Runnable callback : callbacks) callback.run();
    }

    static void recordStartError(Context context, String error) {
        if (isEnabled(context)) prefs(context).edit().putString("last_error", error).apply();
        finishStart();
    }

    static void stop(Context context) {
        synchronized (CONFIG_LOCK) {
            generation++;
            SharedPreferences.Editor edit = prefs(context).edit()
                    .putBoolean("enabled", false)
                    .remove("accessToken").remove("refreshToken").remove("expiresAt")
                    .remove("user_id").remove("couple_id").remove("is_admin")
                    .remove("name").remove("avatar").remove("running");
            clearSnapshot(edit);
            edit.apply();
        }
        if (active != null) active.shutdown();
        context.stopService(new Intent(context, DeviceStatusService.class));
        finishStart();
    }

    private static void clearSnapshot(SharedPreferences.Editor edit) {
        edit.remove("last_data").remove("last_at").remove("last_sent_at")
                .remove("last_attempt_at").remove("last_error");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stop(this);
            return START_NOT_STICKY;
        }
        boolean refreshRequested = intent != null && ACTION_REFRESH.equals(intent.getAction());
        if (active == this) {
            if (refreshRequested) requestFreshLocation();
            return START_STICKY;
        }

        // Android puede recrear un servicio START_STICKY sin el Intent inicial.
        String error = startPrerequisite(this);
        if (readConfig(this) == null || !error.isEmpty()) {
            recordStartError(this, error.isEmpty() ? "session" : error);
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        try {
            createChannel();
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification("Compartiendo estado…"),
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
        } catch (RuntimeException err) {
            Log.w(TAG, "Android rechazó el servicio en primer plano", err);
            recordStartError(this, "foreground-service-rejected");
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        active = this;
        prefs(this).edit().remove("last_error").remove("running").apply();
        registerDeviceObservers();
        registerLocationUpdates();
        if (refreshRequested) requestFreshLocation();
        else schedulePublish(0L);
        finishStart();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        shutdown();
        super.onDestroy();
    }

    private void shutdown() {
        if (active == this) {
            active = null;
            stopForeground(STOP_FOREGROUND_REMOVE);
        }
        MAIN.removeCallbacks(tick);
        io.shutdownNow();
        events.shutdownNow();
        batteryAlerts.shutdownNow();
        if (locationManager != null && locationListener != null) {
            locationManager.removeUpdates(locationListener);
            locationListener = null;
        }
        clearSingleLocationRequest();
        if (connectivityManager != null && networkCallback != null) {
            connectivityManager.unregisterNetworkCallback(networkCallback);
            networkCallback = null;
        }
        if (batteryReceiver != null) {
            unregisterReceiver(batteryReceiver);
            batteryReceiver = null;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void schedulePublish(long delayMs) {
        if (active != this) return;
        long deadline = SystemClock.uptimeMillis() + delayMs;
        if (deadline >= scheduledAt) return;
        scheduledAt = deadline;
        MAIN.removeCallbacks(tick);
        MAIN.postAtTime(tick, deadline);
    }

    private void requestFreshLocation() {
        if (prefs(this).getBoolean("battery_paused", false)) { schedulePublish(0L); return; }
        if (!hasLocationPermission(this)) return;
        if (locationManager == null) locationManager = getSystemService(LocationManager.class);
        if (locationManager == null) { schedulePublish(0L); return; }
        clearSingleLocationRequest();
        List<String> providers = locationManager.getAllProviders();
        String provider = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && providers.contains(LocationManager.FUSED_PROVIDER)
                ? LocationManager.FUSED_PROVIDER
                : hasPreciseLocationPermission(this) && providers.contains(LocationManager.GPS_PROVIDER)
                    ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        if (!providers.contains(provider)) { schedulePublish(0L); return; }
        singleLocationListener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                clearSingleLocationRequest();
                acceptLocation(location);
                schedulePublish(0L);
            }
            @Override public void onStatusChanged(String providerName, int status, Bundle extras) {}
            @Override public void onProviderEnabled(String providerName) {}
            @Override public void onProviderDisabled(String providerName) {}
        };
        try {
            locationManager.requestLocationUpdates(provider, 0L, 0f, singleLocationListener, Looper.getMainLooper());
            singleFixTimeout = () -> { clearSingleLocationRequest(); schedulePublish(0L); };
            MAIN.postDelayed(singleFixTimeout, 20_000L);
        } catch (SecurityException | IllegalArgumentException error) {
            clearSingleLocationRequest();
            Log.w(TAG, "No se pudo solicitar una ubicación inmediata", error);
            schedulePublish(0L);
        }
    }

    private void clearSingleLocationRequest() {
        if (singleFixTimeout != null) MAIN.removeCallbacks(singleFixTimeout);
        singleFixTimeout = null;
        if (locationManager != null && singleLocationListener != null) {
            locationManager.removeUpdates(singleLocationListener);
        }
        singleLocationListener = null;
    }

    private void publishPending() {
        scheduledAt = Long.MAX_VALUE;
        if (active != this) return;
        scheduleBatteryAlert();
        if (publishing) {
            publishAgain = true;
            return;
        }
        if (!hasLocationPermission(this)) {
            recordStartError(this, "location-permission");
            shutdown();
            stopSelf();
            return;
        }
        publishing = true;
        io.execute(() -> {
            String error = publish();
            MAIN.post(() -> {
                if (active != this) return;
                publishing = false;
                SharedPreferences prefs = prefs(this);
                long delay = nextPublishDelay(publishAgain, error,
                        prefs.getBoolean("battery_paused", false),
                        prefs.getBoolean("battery_alert_delivered", false),
                        prefs.getInt("battery_alert_attempts", 0));
                publishAgain = false;
                schedulePublish(delay);
            });
        });
    }

    static long nextPublishDelay(boolean publishAgain, String error,
            boolean batteryPaused, boolean batteryAlertDelivered) {
        return nextPublishDelay(publishAgain, error, batteryPaused, batteryAlertDelivered, 1);
    }

    static long nextPublishDelay(boolean publishAgain, String error,
            boolean batteryPaused, boolean batteryAlertDelivered, int batteryAlertAttempts) {
        long delay = publishAgain ? CHANGE_DELAY_MS : HEARTBEAT_MS;
        if ("upload-failed".equals(error)) delay = Math.min(delay, RETRY_MS);
        if (batteryPaused && !batteryAlertDelivered) {
            delay = Math.min(delay, batteryAlertRetryDelay(batteryAlertAttempts));
        }
        return delay;
    }

    static long batteryAlertRetryDelay(int failedAttempts) {
        int exponent = Math.max(0, Math.min(failedAttempts - 1, 4));
        long delay = RETRY_MS * (1L << exponent);
        return Math.min(delay, MAX_BATTERY_ALERT_RETRY_MS);
    }

    @SuppressWarnings("deprecation")
    private void registerLocationUpdates() {
        if (prefs(this).getBoolean("battery_paused", false)) return;
        if (locationListener != null) return;
        locationManager = getSystemService(LocationManager.class);
        if (locationManager == null) return;

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                acceptLocation(location);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {
            }

            @Override
            public void onProviderEnabled(String provider) {
                schedulePublish(CHANGE_DELAY_MS);
            }

            @Override
            public void onProviderDisabled(String provider) {
                schedulePublish(CHANGE_DELAY_MS);
            }
        };

        List<String> providers = locationManager.getAllProviders();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && providers.contains(LocationManager.FUSED_PROVIDER)
                && registerProvider(LocationManager.FUSED_PROVIDER)) return;
        if (providers.contains(LocationManager.NETWORK_PROVIDER)) registerProvider(LocationManager.NETWORK_PROVIDER);
        if (hasPreciseLocationPermission(this) && providers.contains(LocationManager.GPS_PROVIDER)) {
            registerProvider(LocationManager.GPS_PROVIDER);
        }
    }

    private boolean registerProvider(String provider) {
        try {
            // Si el proveedor está apagado, Android reanuda sus avisos al habilitarlo.
            locationManager.requestLocationUpdates(provider, LOCATION_INTERVAL_MS, 0f,
                    locationListener, Looper.getMainLooper());
            acceptLocation(locationManager.getLastKnownLocation(provider));
            return true;
        } catch (SecurityException | IllegalArgumentException err) {
            Log.w(TAG, "Proveedor de ubicación no disponible: " + provider);
            return false;
        }
    }

    private void acceptLocation(Location candidate) {
        // LocationManager can deliver a callback that was already queued when
        // the battery threshold was crossed. Do not retain or publish it.
        if (prefs(this).getBoolean("battery_paused", false)) return;
        if (candidate == null || candidate.getTime() <= 0) return;
        boolean precise = hasPreciseLocationPermission(this);
        Fix previousFix = lastFix;
        Location previous = previousFix == null || previousFix.precise() != precise ? null : previousFix.location();
        if (previous != null) {
            long deltaNanos = candidate.getElapsedRealtimeNanos() - previous.getElapsedRealtimeNanos();
            if (deltaNanos <= 0) return;
            if (deltaNanos < 30_000_000_000L && previous.hasAccuracy()
                    && (!candidate.hasAccuracy() || candidate.getAccuracy() > previous.getAccuracy() * 2)) return;
        }
        lastFix = new Fix(candidate, precise);
        schedulePublish(previous == null ? 0L : CHANGE_DELAY_MS);
    }

    private void registerDeviceObservers() {
        BroadcastReceiver observer = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                int level = readBatteryLevel(intent);
                boolean isCharging = isCharging(intent);
                if (level == batteryLevel && isCharging == charging) return;
                batteryLevel = level;
                charging = isCharging;
                handleBatteryLevel(level);
                schedulePublish(CHANGE_DELAY_MS);
            }
        };
        try {
            Intent battery = registerReceiver(observer, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            batteryLevel = readBatteryLevel(battery);
            charging = isCharging(battery);
            batteryReceiver = observer;
            handleBatteryLevel(batteryLevel);
        } catch (RuntimeException err) {
            Log.w(TAG, "No se pudo escuchar la batería", err);
        }

        connectivityManager = getSystemService(ConnectivityManager.class);
        if (connectivityManager == null) return;
        try {
            connectionKey = connectionKey(networkCapabilities(this));
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                    MAIN.post(() -> handleConnectionChange(capabilities));
                }

                @Override
                public void onLost(Network network) {
                    MAIN.post(() -> handleConnectionChange(null));
                }
            };
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } catch (RuntimeException err) {
            networkCallback = null;
            Log.w(TAG, "No se pudo escuchar la conexión", err);
        }
    }

    private void handleBatteryLevel(int level) {
        if (level < 0) return;
        batteryLevel = level;
        SharedPreferences prefs = prefs(this);
        boolean paused = prefs.getBoolean("battery_paused", false);
        if (!paused && level <= 20) {
            prefs.edit().putBoolean("battery_paused", true)
                    .putBoolean("battery_alert_sent", true)
                    .putBoolean("battery_alert_delivered", false)
                    .putInt("battery_alert_attempts", 0)
                    .apply();
            updateBatteryPauseNotification(true, level);
            clearSingleLocationRequest();
            if (locationManager != null && locationListener != null) {
                locationManager.removeUpdates(locationListener);
                locationListener = null;
            }
            lastFix = null;
            schedulePublish(0L);
        } else if (paused && level >= 30) {
            prefs.edit().putBoolean("battery_paused", false)
                    .putBoolean("battery_alert_sent", false)
                    .remove("battery_alert_attempts")
                    .remove("battery_alert_delivered")
                    .apply();
            updateBatteryPauseNotification(false, level);
            registerLocationUpdates();
            schedulePublish(0L);
        }
        scheduleBatteryAlert();
    }

    private void updateBatteryPauseNotification(boolean paused, int level) {
        if (level < 0) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        int message = paused
                ? R.string.notification_status_location_paused
                : R.string.notification_status_location_resumed;
        manager.notify(NOTIFICATION_ID, buildNotification(getString(message, level)));
    }

    /** Starts the partner alert independently of the serialized location upload queue. */
    private void scheduleBatteryAlert() {
        if (active != this || batteryAlertSending) return;
        SharedPreferences prefs = prefs(this);
        if (!prefs.getBoolean("battery_paused", false)
                || prefs.getBoolean("battery_alert_delivered", false)) return;
        Config config = readConfig(this);
        if (config == null) return;

        batteryAlertSending = true;
        int level = Math.max(0, batteryLevel);
        batteryAlerts.execute(() -> {
            try {
                sendBatteryAlert(config, level);
            } finally {
                MAIN.post(() -> {
                    batteryAlertSending = false;
                    if (active != this || !prefs(this).getBoolean("battery_paused", false)) return;
                    SharedPreferences current = prefs(this);
                    long delay = nextPublishDelay(false, "battery-low", true,
                            current.getBoolean("battery_alert_delivered", false),
                            current.getInt("battery_alert_attempts", 0));
                    schedulePublish(delay);
                });
            }
        });
    }

    private void sendBatteryAlert(Config config, int level) {
        if (!canPublish(config)) return;
        if (config.apiOrigin().isEmpty()) {
            recordBatteryAlertFailure(config);
            return;
        }
        try {
            Session session = readSession(prefs(this));
            BatteryAlertResponse response = postBatteryAlert(config, level, session);
            if (response.status() == 401) {
                Session renewed = renewSession(config, session.accessToken());
                if (shouldRetryBatteryAlert(response.status(), session, renewed)) {
                    response = postBatteryAlert(config, level, renewed);
                }
            }
            if (response.status() < 200 || response.status() >= 300) {
                recordBatteryAlertFailure(config);
                Log.w(TAG, "No se pudo enviar el aviso de batería: HTTP " + response.status());
                return;
            }
            if (response.sent() > 0) {
                synchronized (CONFIG_LOCK) {
                    if (canPublish(config)) {
                        prefs(this).edit().putBoolean("battery_alert_delivered", true)
                                .remove("battery_alert_attempts").apply();
                    }
                }
            } else {
                recordBatteryAlertFailure(config);
                Log.w(TAG, "Aviso de batería pendiente: FCM no entregó ningún aviso");
            }
        } catch (Exception err) {
            recordBatteryAlertFailure(config);
            Log.w(TAG, "No se pudo avisar a la pareja de la batería baja", err);
        }
    }

    private void recordBatteryAlertFailure(Config config) {
        synchronized (CONFIG_LOCK) {
            if (!canPublish(config)) return;
            SharedPreferences prefs = prefs(this);
            prefs.edit().putInt("battery_alert_attempts",
                    prefs.getInt("battery_alert_attempts", 0) + 1).apply();
        }
    }

    private BatteryAlertResponse postBatteryAlert(Config config, int level, Session session) throws Exception {
        if (!canPublish(config)) return new BatteryAlertResponse(-1, 0);
        String base = config.apiOrigin().replaceAll("/+$", "");
        HttpURLConnection conn = (HttpURLConnection) new URL(base + "/api/push?action=battery-low").openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(12_000);
            conn.setReadTimeout(12_000);
            conn.setInstanceFollowRedirects(false);
            conn.setDoOutput(true);
            conn.setRequestProperty("Authorization", "Bearer " + session.accessToken());
            conn.setRequestProperty("Content-Type", "application/json");
            writeBody(conn, new JSONObject().put("level", level));
            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) return new BatteryAlertResponse(status, 0);

            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }
            return new BatteryAlertResponse(status, new JSONObject(body.toString()).optInt("sent", 0));
        } finally {
            conn.disconnect();
        }
    }

    static boolean shouldRetryBatteryAlert(int status, Session current, Session renewed) {
        return status == 401 && current != null && renewed != null
                && !renewed.accessToken().isEmpty()
                && !renewed.accessToken().equals(current.accessToken());
    }

    private void handleConnectionChange(NetworkCapabilities caps) {
        String key = connectionKey(caps);
        if (connectionKey.equals(key)) return;
        connectionKey = key;
        schedulePublish(CHANGE_DELAY_MS);
    }

    private static String connectionKey(NetworkCapabilities caps) {
        return isOnline(caps) + ":" + networkType(caps);
    }

    private static int readBatteryLevel(Intent battery) {
        if (battery == null) return -1;
        int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        return level >= 0 && scale > 0 ? Math.min(100, Math.round(level * 100f / scale)) : -1;
    }

    private static boolean isCharging(Intent battery) {
        if (battery == null) return false;
        int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
    }

    private static NetworkCapabilities networkCapabilities(Context context) {
        ConnectivityManager manager = context.getSystemService(ConnectivityManager.class);
        if (manager == null) return null;
        Network network = manager.getActiveNetwork();
        return network == null ? null : manager.getNetworkCapabilities(network);
    }

    private static boolean isOnline(NetworkCapabilities caps) {
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private static String networkType(NetworkCapabilities caps) {
        if (caps == null) return "";
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return "wifi";
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "cellular";
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "ethernet";
        return "online";
    }

    static JSONObject deviceFacts(Context context) {
        JSONObject facts = new JSONObject();
        try {
            Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            int level = readBatteryLevel(battery);
            if (level >= 0) {
                facts.put("battery", level);
                facts.put("charging", isCharging(battery));
            }
            NetworkCapabilities caps = networkCapabilities(context);
            facts.put("online", isOnline(caps));
            if (caps != null) {
                facts.put("net", networkType(caps));
                int kbps = caps.getLinkDownstreamBandwidthKbps();
                if (kbps > 0) facts.put("mbps", Math.round(kbps / 100.0) / 10.0);
            }
        } catch (Exception err) {
            Log.w(TAG, "No se pudo leer el estado del dispositivo", err);
        }
        return facts;
    }

    private JSONObject snapshot(Config config) throws Exception {
        JSONObject data = deviceFacts(this);
        data.put("at", isoAt(System.currentTimeMillis()));
        data.put("user_id", config.userId());
        data.put("name", config.name());
        data.put("avatar", config.avatar());
        data.put("bg", true);
        data.put("batteryPaused", prefs(this).getBoolean("battery_paused", false));
        data.put("locationServices", locationServicesState(this));

        boolean precise = hasPreciseLocationPermission(this);
        JSONObject previous = config.previous();
        String previousAt = previous.optString("location_at", "");
        boolean mayReusePrevious = config.userId().equals(previous.optString("user_id"))
                && previous.has("lat") && previous.has("lng")
                && (precise || "approximate".equals(previous.optString("location_precision")));
        long previousTime = mayReusePrevious ? parseLocationTime(previousAt) : 0L;
        Fix fix = lastFix;
        Location location = fix == null || (fix.precise() && !precise) ? null : fix.location();
        if (location != null && location.getTime() >= previousTime) {
            data.put("lat", round(location.getLatitude()));
            data.put("lng", round(location.getLongitude()));
            // Un cambio de batería no cambia la hora de la última posición GPS.
            data.put("location_at", isoAt(location.getTime()));
            data.put("location_age_ms", Math.max(0L, System.currentTimeMillis() - location.getTime()));
            data.put("location_precision", fix.precise() ? "precise" : "approximate");
            if (location.hasAccuracy()) data.put("accuracy", Math.round(location.getAccuracy()));
            if (location.hasSpeed() && location.getSpeed() >= 0) {
                data.put("speed", Math.round(location.getSpeed() * 3.6));
            }
        } else if (previousTime > 0L) {
            data.put("lat", previous.optDouble("lat"));
            data.put("lng", previous.optDouble("lng"));
            data.put("location_at", previousAt);
            data.put("location_age_ms", Math.max(0L, System.currentTimeMillis() - previousTime));
            data.put("location_precision", previous.optString("location_precision", "precise"));
            if (previous.has("accuracy")) data.put("accuracy", previous.optInt("accuracy"));
        }
        return data;
    }

    private String publish() {
        Config config = readConfig(this);
        if (config == null) return "session";
        if (prefs(this).getBoolean("battery_paused", false)) {
            // Keep sharing battery/connectivity while paused, without claiming a
            // fresh GPS fix or triggering a geofence event from an old position.
            publishBatteryPausedStatus(config);
            return "battery-low";
        }
        JSONObject data = null;
        String error;
        String at = "";
        try {
            data = snapshot(config);
            at = data.optString("at");
            synchronized (CONFIG_LOCK) {
                if (!canPublish(config)) return "";
                prefs(this).edit().putString("last_data", data.toString())
                        .putString("last_attempt_at", at).apply();
            }
            if (!data.optBoolean("online")) error = "offline";
            // No sustituir una posición publicada por un envío que solo contiene batería.
            else if (!data.has("location_at")) error = "waiting-location";
            else error = upsert(data, config);
        } catch (Exception err) {
            Log.w(TAG, "No se pudo sincronizar el dispositivo", err);
            error = "upload-failed";
        }
        synchronized (CONFIG_LOCK) {
            if (!canPublish(config)) return "";
            SharedPreferences.Editor edit = prefs(this).edit();
            if (error.isEmpty()) edit.putString("last_sent_at", at).remove("last_error");
            else edit.putString("last_error", error);
            edit.apply();
        }
        JSONObject observed = data;
        String result = error;
        MAIN.post(() -> {
            if (observed != null && canPublish(config)) updateNotification(observed, result);
        });
        return error;
    }

    private boolean canPublish(Config config) {
        synchronized (CONFIG_LOCK) {
            return active == this && generation == config.generation() && hasLocationPermission(this);
        }
    }

    private record Fix(Location location, boolean precise) {}

    record Session(String accessToken, String refreshToken, long expiresAt) {}

    record BatteryAlertResponse(int status, int sent) {}

    record Config(String url, String apiOrigin, String anonKey, String userId, String coupleId, boolean isAdmin,
                  String name, String avatar, Session session, long generation, JSONObject previous) {
        boolean valid() {
            return url.startsWith("https://") && !anonKey.isEmpty() && !userId.isEmpty()
                    && !session.accessToken().isEmpty();
        }
    }

    private static Config readConfig(Context context) {
        synchronized (CONFIG_LOCK) {
            SharedPreferences prefs = prefs(context);
            if (!prefs.getBoolean("enabled", false)) return null;
            JSONObject previous;
            try {
                previous = new JSONObject(prefs.getString("last_data", "{}"));
            } catch (Exception ignored) {
                previous = new JSONObject();
            }
            Config config = new Config(prefs.getString("url", ""), prefs.getString("apiOrigin", ""), prefs.getString("anonKey", ""),
                    prefs.getString("user_id", ""), prefs.getString("couple_id", ""), prefs.getBoolean("is_admin", false),
                    prefs.getString("name", ""), prefs.getString("avatar", ""), readSession(prefs), generation, previous);
            return config.valid() ? config : null;
        }
    }

    static Session readSession(SharedPreferences prefs) {
        synchronized (CONFIG_LOCK) {
            return new Session(prefs.getString("accessToken", ""), prefs.getString("refreshToken", ""),
                    prefs.getLong("expiresAt", 0L));
        }
    }

    private static void writeSession(SharedPreferences.Editor edit, Session session) {
        edit.putString("accessToken", session.accessToken())
                .putString("refreshToken", session.refreshToken())
                .putLong("expiresAt", session.expiresAt());
    }

    /** Comparte batería/conexión pausadas sin reclamar eventos con un GPS antiguo. */
    private void publishBatteryPausedStatus(Config config) {
        try {
            JSONObject data = snapshot(config);
            if (!data.has("location_at") || !data.has("lat") || !data.has("lng") || !data.optBoolean("online")) return;
            synchronized (CONFIG_LOCK) {
                if (!canPublish(config)) return;
                prefs(this).edit().putString("last_data", data.toString())
                        .putString("last_attempt_at", data.optString("at")).apply();
            }
            String error = upsert(data, config, false);
            synchronized (CONFIG_LOCK) {
                if (!canPublish(config)) return;
                SharedPreferences.Editor edit = prefs(this).edit();
                if (error.isEmpty()) edit.putString("last_sent_at", data.optString("at")).remove("last_error");
                else edit.putString("last_error", error);
                edit.apply();
            }
        } catch (Exception error) {
            Log.w(TAG, "No se pudo sincronizar el estado de batería pausado", error);
        }
    }

    private String upsert(JSONObject data, Config config) throws Exception {
        return upsert(data, config, true);
    }

    private String upsert(JSONObject data, Config config, boolean notifyPlaceEvents) throws Exception {
        JSONObject row = new JSONObject();
        row.put("data", data);
        row.put("updated_at", data.optString("at"));

        String path;
        if (!config.coupleId().isEmpty()) {
            row.put("couple_id", config.coupleId());
            row.put("user_id", config.userId());
            row.put("location_at", data.getString("location_at"));
            row.put("sent_at", data.optString("at"));
            path = "/rest/v1/couple_locations?on_conflict=couple_id,user_id";
        } else if (config.isAdmin()) {
            row.put("id", "location_admin");
            path = "/rest/v1/content?on_conflict=id";
        } else {
            row.put("user_id", config.userId());
            row.put("type", "location");
            path = "/rest/v1/user_progress?on_conflict=user_id,type";
        }

        int code = send(path, config, config.session().accessToken(), row);
        if (code == 401) {
            Session session = renewSession(config);
            if (session == null) return "session";
            code = send(path, config, session.accessToken(), row);
        }
        if (code >= 200 && code < 300) {
            if (notifyPlaceEvents && !config.coupleId().isEmpty() && data.has("location_at")) {
                try {
                    events.execute(() -> notifyLocationUpdate(data, config));
                } catch (RuntimeException ignored) {
                    // El apagado del servicio también puede cerrar la cola.
                }
            }
            return "";
        }
        Log.w(TAG, "Supabase respondió HTTP " + code);
        return code == 401 || code == 403 ? "session" : "upload-failed";
    }

    private void notifyLocationUpdate(JSONObject location, Config config) {
        if (config.apiOrigin().isEmpty() || !canPublish(config)) return;
        try {
            Session session = readSession(prefs(this));
            int status = postLocationUpdate(config, location, session);
            if (status == 401) {
                Session renewed = renewSession(config, session.accessToken());
                if (shouldRetryLocationUpdate(status, session, renewed)) {
                    status = postLocationUpdate(config, location, renewed);
                }
            }
            if (status < 200 || status >= 300) Log.w(TAG, "No se pudo procesar la ubicación compartida: HTTP " + status);
        } catch (Exception err) {
            Log.w(TAG, "No se pudo enviar el evento de llegada", err);
        }
    }

    private int postLocationUpdate(Config config, JSONObject location, Session session) throws Exception {
        if (!canPublish(config)) return -1;
        String base = config.apiOrigin().replaceAll("/+$", "");
        HttpURLConnection conn = (HttpURLConnection) new URL(base + "/api/push?action=location-update").openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(8_000);
            conn.setReadTimeout(8_000);
            conn.setInstanceFollowRedirects(false);
            conn.setDoOutput(true);
            conn.setRequestProperty("Authorization", "Bearer " + session.accessToken());
            conn.setRequestProperty("Content-Type", "application/json");
            JSONObject body = new JSONObject();
            body.put("lat", location.getDouble("lat"));
            body.put("lng", location.getDouble("lng"));
            body.put("accuracy", location.opt("accuracy") == JSONObject.NULL ? JSONObject.NULL : location.opt("accuracy"));
            body.put("location_at", location.getString("location_at"));
            writeBody(conn, body);
            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) {
                String response;
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder content = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) content.append(line);
                    response = content.toString();
                }
                prefs(this).edit().putBoolean("geofence_accuracy_warning",
                        isUnreliableGeofenceResponse(response)).apply();
            }
            return status;
        } finally {
            conn.disconnect();
        }
    }

    static boolean shouldRetryLocationUpdate(int status, Session current, Session renewed) {
        return status == 401 && current != null && renewed != null
                && !renewed.accessToken().isEmpty()
                && !renewed.accessToken().equals(current.accessToken());
    }

    static boolean isUnreliableGeofenceResponse(String body) {
        try {
            return "inaccurate-location".equals(new JSONObject(body).optString("reason"));
        } catch (Exception ignored) {
            return false;
        }
    }

    private HttpURLConnection open(String path, Config config) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(config.url() + path).openConnection();
        conn.setRequestMethod("POST");
        conn.setConnectTimeout(12_000);
        conn.setReadTimeout(12_000);
        conn.setInstanceFollowRedirects(false);
        conn.setDoOutput(true);
        conn.setRequestProperty("apikey", config.anonKey());
        conn.setRequestProperty("Content-Type", "application/json");
        return conn;
    }

    private int send(String path, Config config, String token, JSONObject data) throws Exception {
        if (!canPublish(config)) return -1;
        HttpURLConnection conn = open(path, config);
        try {
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal");
            if (!canPublish(config)) return -1;
            writeBody(conn, data);
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }

    private Session renewSession(Config config) throws Exception {
        return renewSession(config, config.session().accessToken());
    }

    private Session renewSession(Config config, String rejectedAccessToken) throws Exception {
        SharedPreferences prefs = prefs(this);
        Session current;
        synchronized (CONFIG_LOCK) {
            if (!canPublish(config)) return null;
            current = readSession(prefs);
            // Otro envío pudo renovar la sesión mientras el aviso se mandaba.
            // Solo evita renovar otra vez si el token guardado ya es distinto
            // del token que esta petición acaba de ver rechazado.
            if (!current.accessToken().equals(rejectedAccessToken)) return current;
        }
        if (current.refreshToken().isEmpty()) return null;

        HttpURLConnection conn = open("/auth/v1/token?grant_type=refresh_token", config);
        try {
            JSONObject body = new JSONObject().put("refresh_token", current.refreshToken());
            if (!canPublish(config)) return null;
            writeBody(conn, body);
            int code = conn.getResponseCode();
            if (code >= 500) throw new IOException("Renovación de sesión: HTTP " + code);

            StringBuilder response = new StringBuilder();
            if (code == 200) {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) response.append(line);
                }
            }
            JSONObject json = code == 200 ? new JSONObject(response.toString()) : new JSONObject();
            String access = json.optString("access_token");
            synchronized (CONFIG_LOCK) {
                if (!canPublish(config)) return null;
                Session latest = readSession(prefs);
                if (!latest.equals(current)) return latest;
                if (access.isEmpty()) return null;
                Session next = new Session(access, json.optString("refresh_token", current.refreshToken()),
                        System.currentTimeMillis() + json.optInt("expires_in", 3600) * 1000L);
                SharedPreferences.Editor edit = prefs.edit();
                writeSession(edit, next);
                edit.apply();
                return next;
            }
        } finally {
            conn.disconnect();
        }
    }

    private static void writeBody(HttpURLConnection conn, JSONObject body) throws IOException {
        try (OutputStream out = conn.getOutputStream()) {
            out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, getString(R.string.notification_channel_status), NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.notification_channel_status_desc));
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Intent stop = new Intent(this, DeviceStatusService.class).setAction(ACTION_STOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, flags);
        PendingIntent stopIntent = PendingIntent.getService(this, 1, stop, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(getString(R.string.notification_status_title))
                .setContentText(text)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(contentIntent)
                .addAction(0, "Dejar de compartir", stopIntent)
                .build();
    }

    private void updateNotification(JSONObject data, String error) {
        int level = batteryLevel >= 0 ? batteryLevel : data.optInt("battery", -1);
        boolean batteryPaused = prefs(this).getBoolean("battery_paused", false);
        String text = batteryPaused && level >= 0
                ? getString(R.string.notification_status_location_paused, level)
                : level >= 0
                    ? getString(R.string.notification_status_battery, level)
                : getString(R.string.notification_status_title);
        if (data.optBoolean("charging")) text += " · " + getString(R.string.notification_status_charging);
        if ("offline".equals(error)) text += " · Sin conexión";
        else if ("waiting-location".equals(error)) text += " · Buscando ubicación";
        else if (!error.isEmpty()) text += " · Sin sincronizar";
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(text));
    }

    private static SimpleDateFormat isoFormat() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return format;
    }

    private static String isoAt(long timeMs) {
        return isoFormat().format(new Date(timeMs));
    }

    private static long parseLocationTime(String value) {
        if (value.isEmpty()) return 0L;
        try {
            Date at = isoFormat().parse(value);
            return at == null ? 0L : at.getTime();
        } catch (ParseException ignored) {
            return 0L;
        }
    }

    private static double round(double value) {
        return Math.round(value * 100000.0) / 100000.0;
    }
}
