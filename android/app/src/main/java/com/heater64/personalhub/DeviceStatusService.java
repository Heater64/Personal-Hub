package com.heater64.personalhub;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
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
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Seguimiento del móvil con la app cerrada.
 *
 * Un servicio en primer plano (con su aviso fijo, como exige Android) que
 * cada cinco minutos junta ubicación, batería y red y las escribe en la misma
 * fila que usa la web. El token se renueva solo con el refresh token, así que
 * el seguimiento no se cae cuando caduca la sesión.
 *
 * La web arranca y para el servicio desde DeviceStatusPlugin; el estado
 * también queda en SharedPreferences para que el panel lo lea al instante.
 */
public class DeviceStatusService extends Service {

    public static final String PREFS = "device_status";
    public static final String CHANNEL_ID = "device_status";
    public static final String ACTION_STOP = "com.heater64.personalhub.DEVICE_STATUS_STOP";

    private static final String TAG = "DeviceStatus";
    private static final int NOTIFICATION_ID = 4310;
    private static final long TICK_MS = 5 * 60 * 1000L;
    private static final long LOCATION_MS = 5 * 60 * 1000L;

    private Handler handler;
    private LocationManager locationManager;
    private LocationListener locationListener;
    private Location lastLocation;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            try {
                publish();
            } catch (Exception err) {
                Log.w(TAG, "no se pudo publicar el estado", err);
            }
            if (handler != null) handler.postDelayed(this, TICK_MS);
        }
    };

    /** Arranca el servicio (no-op silencioso si el sistema lo impide). */
    public static void start(Context context) {
        try {
            Intent intent = new Intent(context, DeviceStatusService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception err) {
            Log.w(TAG, "Android no dejó arrancar el servicio", err);
        }
    }

    public static void stop(Context context) {
        try {
            context.stopService(new Intent(context, DeviceStatusService.class));
        } catch (Exception ignored) {
        }
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean("enabled", false);
    }

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        try {
            startForeground(NOTIFICATION_ID, buildNotification("Preparando el seguimiento…"));
        } catch (Exception err) {
            // Android 14+ exige el permiso de ubicación para el tipo
            // «location»: sin él no hay aviso válido y el servicio se apaga
            // solo en vez de tumbar la app.
            Log.w(TAG, "el sistema no dejó empezar el primer plano", err);
            stopSelf();
            return;
        }
        registerLocationUpdates();
        handler = new Handler(Looper.getMainLooper());
        handler.post(tick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            prefs(this).edit().putBoolean("enabled", false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        prefs(this).edit().putBoolean("enabled", true).apply();
        startForeground(NOTIFICATION_ID, buildNotification("Compartiendo estado…"));
        if (handler != null) {
            handler.removeCallbacks(tick);
            handler.post(tick);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
            handler = null;
        }
        if (locationManager != null && locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (Exception ignored) {
            }
        }
        locationManager = null;
        locationListener = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /* ==========================================
       UBICACIÓN
       ========================================== */

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    @SuppressWarnings("deprecation")
    private void registerLocationUpdates() {
        if (!hasLocationPermission()) return;
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                lastLocation = location;
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {
            }

            @Override
            public void onProviderEnabled(String provider) {
            }

            @Override
            public void onProviderDisabled(String provider) {
            }
        };

        for (String provider : new String[]{
                LocationManager.NETWORK_PROVIDER,
                LocationManager.GPS_PROVIDER,
        }) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    locationManager.requestLocationUpdates(
                            provider, LOCATION_MS, 0f, locationListener, Looper.getMainLooper());
                }
                Location known = locationManager.getLastKnownLocation(provider);
                if (known != null && (lastLocation == null || known.getTime() > lastLocation.getTime())) {
                    lastLocation = known;
                }
            } catch (Exception err) {
                Log.w(TAG, "sin proveedor " + provider, err);
            }
        }
    }

    /* ==========================================
       DATOS DEL MÓVIL
       ========================================== */

    private void addBattery(JSONObject data) {
        try {
            Intent battery = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (battery == null) return;
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (level < 0 || scale <= 0) return;
            int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            data.put("battery", Math.round(level * 100f / scale));
            data.put("charging",
                    status == BatteryManager.BATTERY_STATUS_CHARGING
                            || status == BatteryManager.BATTERY_STATUS_FULL);
        } catch (Exception ignored) {
        }
    }

    private void addNetwork(JSONObject data) {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            Network network = cm.getActiveNetwork();
            if (network == null) {
                data.put("online", false);
                return;
            }
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            if (caps == null) return;

            String net = "online";
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) net = "wifi";
            else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) net = "cellular";
            else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) net = "ethernet";

            data.put("online", true);
            data.put("net", net);
            int kbps = caps.getLinkDownstreamBandwidthKbps();
            if (kbps > 0) data.put("mbps", Math.round(kbps / 100.0) / 10.0);
        } catch (Exception ignored) {
        }
    }

    private JSONObject snapshot() throws Exception {
        JSONObject data = new JSONObject();
        SharedPreferences prefs = prefs(this);
        String at = isoNow();
        data.put("at", at);
        data.put("user_id", prefs.getString("user_id", ""));
        data.put("name", prefs.getString("name", ""));
        data.put("avatar", prefs.getString("avatar", ""));
        data.put("bg", true);

        Location location = lastLocation;
        if (location == null && locationManager != null && hasLocationPermission()) {
            for (String provider : new String[]{LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
                try {
                    Location known = locationManager.getLastKnownLocation(provider);
                    if (known != null && (location == null || known.getTime() > location.getTime())) {
                        location = known;
                    }
                } catch (Exception ignored) {
                }
            }
        }

        if (location != null) {
            data.put("lat", round(location.getLatitude()));
            data.put("lng", round(location.getLongitude()));
            if (location.hasAccuracy()) data.put("accuracy", Math.round(location.getAccuracy()));
            if (location.hasSpeed() && location.getSpeed() >= 0) {
                data.put("speed", Math.round(location.getSpeed() * 3.6));
            }
        } else {
            // Sin posición nueva se conservan las coordenadas del último envío:
            // es mejor «la última conocida» que borrar el mapa.
            JSONObject previous = previousData(prefs);
            if (previous != null && previous.has("lat") && previous.has("lng")) {
                data.put("lat", previous.optDouble("lat"));
                data.put("lng", previous.optDouble("lng"));
                if (previous.has("accuracy")) data.put("accuracy", previous.optInt("accuracy"));
            }
        }

        addBattery(data);
        addNetwork(data);
        return data;
    }

    private void publish() throws Exception {
        JSONObject data = snapshot();
        SharedPreferences prefs = prefs(this);
        prefs.edit()
                .putString("last_data", data.toString())
                .putString("last_at", data.optString("at"))
                .apply();
        updateNotification(data);
        upsert(data, true);
    }

    private JSONObject previousData(SharedPreferences prefs) {
        try {
            String raw = prefs.getString("last_data", "");
            return raw.isEmpty() ? null : new JSONObject(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    /* ==========================================
       ENVÍO A SUPABASE (misma fila que la web)
       ========================================== */

    private void upsert(JSONObject data, boolean allowRefresh) throws Exception {
        SharedPreferences prefs = prefs(this);
        String base = prefs.getString("url", "");
        String anon = prefs.getString("anonKey", "");
        String token = prefs.getString("accessToken", "");
        String userId = prefs.getString("user_id", "");
        if (base.isEmpty() || anon.isEmpty() || token.isEmpty() || userId.isEmpty()) return;

        boolean admin = prefs.getBoolean("is_admin", false);
        JSONObject row = new JSONObject();
        row.put("data", data);
        row.put("updated_at", data.optString("at"));

        String path;
        if (admin) {
            row.put("id", "location_admin");
            path = "/rest/v1/content?on_conflict=id";
        } else {
            row.put("user_id", userId);
            row.put("type", "location");
            path = "/rest/v1/user_progress?on_conflict=user_id,type";
        }

        int code = send("POST", base + path, anon, token, row.toString());
        if (code == 401 && allowRefresh && refreshToken(base, anon)) {
            upsert(data, false);
            return;
        }
        if (code >= 300) Log.w(TAG, "Supabase respondió " + code);
    }

    private int send(String method, String endpoint, String anon, String token, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            conn.setRequestMethod(method);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            conn.setRequestProperty("apikey", anon);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal");
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }

    /** Renueva el token con el refresh token y lo guarda para los siguientes envíos. */
    private boolean refreshToken(String base, String anon) {
        SharedPreferences prefs = prefs(this);
        String refresh = prefs.getString("refreshToken", "");
        if (refresh.isEmpty()) return false;

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(base + "/auth/v1/token?grant_type=refresh_token").openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            conn.setRequestProperty("apikey", anon);
            conn.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = conn.getOutputStream()) {
                JSONObject body = new JSONObject();
                body.put("refresh_token", refresh);
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            if (conn.getResponseCode() != 200) return false;

            String raw = read(conn.getInputStream());
            JSONObject json = new JSONObject(raw);
            String access = json.optString("access_token", "");
            String next = json.optString("refresh_token", refresh);
            if (access.isEmpty()) return false;

            int expiresIn = json.optInt("expires_in", 3600);
            prefs.edit()
                    .putString("accessToken", access)
                    .putString("refreshToken", next)
                    .putLong("expiresAt", System.currentTimeMillis() + expiresIn * 1000L)
                    .apply();
            return true;
        } catch (Exception err) {
            Log.w(TAG, "no se pudo renovar la sesión", err);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String read(InputStream in) throws Exception {
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) out.append(line);
        }
        return out.toString();
    }

    /* ==========================================
       AVISO FIJO
       ========================================== */

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Estado del móvil", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantiene la batería, la red y la ubicación al día.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Hub · estado del móvil")
                .setContentText(text)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(contentIntent)
                .build();
    }

    private void updateNotification(JSONObject data) {
        try {
            StringBuilder text = new StringBuilder();
            if (data.has("battery")) {
                text.append(data.optInt("battery")).append("%");
                if (data.optBoolean("charging")) text.append(" · cargando");
            }
            String net = data.optString("net", "");
            if (!net.isEmpty()) {
                if (text.length() > 0) text.append(" · ");
                text.append(net);
            }
            if (text.length() == 0) text.append("Compartiendo estado");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, buildNotification(text.toString()));
            }
        } catch (Exception ignored) {
        }
    }

    private static String isoNow() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date());
    }

    private static double round(double value) {
        return Math.round(value * 100000.0) / 100000.0;
    }
}
