package com.heater64.personalhub;

import android.content.Context;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/** Lee los datos del launcher aunque la actividad y Capacitor estén cerrados. */
public final class WidgetSync extends Worker {
    private static final String IMMEDIATE = "widgets-refresh";
    private static final String PERIODIC = "widgets-refresh-periodic";
    private static final int MAX_RESPONSE_BYTES = 256 * 1024;
    private static final Object FETCH_LOCK = new Object();
    private static final Constraints CONNECTED = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED).build();

    public WidgetSync(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }

    static synchronized boolean request(Context context) {
        if (!reconcile(context)) return false;
        // Varias señales seguidas se condensan en una consulta. Si había otra en
        // vuelo, la más reciente debe quedar pendiente para leer el cambio final.
        WorkManager.getInstance(context).enqueueUniqueWork(IMMEDIATE, ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(WidgetSync.class)
                        .setConstraints(CONNECTED)
                        .setInitialDelay(1, TimeUnit.SECONDS)
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                        .build());
        return true;
    }

    static synchronized boolean reconcile(Context context) {
        boolean active = WidgetData.isConfigured(context) && !WidgetRenderer.installedKeys(context).isEmpty();
        WorkManager manager = WorkManager.getInstance(context);
        if (active) {
            // FCM se puede retrasar o perder. Android ajusta este intervalo al ahorro de energía.
            manager.enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
                    new PeriodicWorkRequest.Builder(WidgetSync.class, 15, TimeUnit.MINUTES)
                            .setInitialDelay(15, TimeUnit.MINUTES)
                            .setConstraints(CONNECTED)
                            .build());
        } else {
            manager.cancelUniqueWork(PERIODIC);
            manager.cancelUniqueWork(IMMEDIATE);
        }
        return active;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        Set<String> keys = WidgetRenderer.installedKeys(context);
        synchronized (FETCH_LOCK) {
            WidgetData.Snapshot snapshot = WidgetData.snapshot(context, keys);
            if (snapshot == null || keys.isEmpty() || isStopped()) return Result.success();
            Result failure = refreshWidgets(context, keys, snapshot);
            if (failure != null) return failure;
        }

        Set<String> images = WidgetSupport.awaitImages(context, keys);
        if (!isStopped() && !images.isEmpty()) WidgetRenderer.refreshKeys(context, images);
        return Result.success();
    }

    /** Una respuesta útil devuelve null para completar después las imágenes. */
    private Result refreshWidgets(Context context, Set<String> keys, WidgetData.Snapshot snapshot) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(snapshot.endpoint).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setConnectTimeout(8_000);
            connection.setReadTimeout(10_000);
            connection.setRequestProperty("Authorization", "Bearer " + snapshot.token);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("X-Widget-Keys", TextUtils.join(",", keys));
            connection.setRequestProperty("X-Widget-Timezone", TimeZone.getDefault().getID());

            int status = connection.getResponseCode();
            if (isStopped()) return Result.success();
            if (status == 401 || status == 403 || status == 410) {
                if (WidgetData.revoke(context, snapshot)) {
                    WidgetRenderer.refreshAll(context);
                    reconcile(context);
                }
                return Result.success();
            }
            if (status == 408 || status == 429 || status >= 500) return retry();
            if (status != 200) return Result.failure();

            JSONObject widgets = new JSONObject(readResponse(connection)).optJSONObject("widgets");
            if (widgets == null) return Result.failure();
            if (isStopped()) return Result.success();
            Set<String> changed = WidgetData.apply(context, snapshot, widgets);
            // El texto de distancia depende también del reloj, aunque el JSON
            // siga siendo el mismo de la última ubicación recibida.
            if (keys.contains(WidgetRenderer.Group.DISTANCE.key)) changed.add(WidgetRenderer.Group.DISTANCE.key);
            if (keys.contains(WidgetRenderer.Group.GIFTS.key)) changed.add(WidgetRenderer.Group.GIFTS.key);
            if (!changed.isEmpty()) WidgetRenderer.refreshKeys(context, changed);
            return null;
        } catch (IOException | JSONException ignored) {
            return retry();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private Result retry() {
        return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
    }

    private static String readResponse(HttpURLConnection connection) throws IOException {
        try (InputStream input = connection.getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8_192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_RESPONSE_BYTES) throw new IOException("Widget response too large");
                output.write(buffer, 0, count);
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
