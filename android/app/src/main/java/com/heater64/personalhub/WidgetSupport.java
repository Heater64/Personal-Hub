package com.heater64.personalhub;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Utilidades de los widgets: leer lo que dejó la app, abrir la app al tocar y
 * recortar las fotos en círculo.
 *
 * RemoteViews no puede cargar imágenes de red, así que la foto se descarga una
 * vez a la caché interna y se pinta como bitmap circular. Mientras llega, el
 * widget se repinta sin foto y vuelve a llamarse al terminar.
 */
final class WidgetSupport {

    /** @capacitor/preferences: fichero y claves sin prefijo. */
    static final String PREFS_NAME = "CapacitorStorage";

    private WidgetSupport() {}

    static JSONObject read(Context context, String key) {
        try {
            String raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(key, null);
            if (raw == null) return null;
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    static String str(JSONObject json, String key) {
        if (json == null) return "";
        return json.optString(key, "");
    }

    /** Nombre o foto de una de las dos personas dentro del JSON guardado. */
    static String faceUrl(JSONObject json, String who) {
        if (json == null) return "";
        JSONObject person = json.optJSONObject(who);
        return person == null ? "" : person.optString("avatar", "");
    }

    static void openApp(Context context, RemoteViews views, int viewId) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pending);
    }

    /**
     * Foto circular lista para poner en un ImageView.
     * Devuelve null si aún no está descargada (y lanza la descarga).
     */
    static Bitmap face(Context context, String url, int sizePx, Runnable onReady) {
        if (url == null || url.isEmpty()) return null;
        File file = cacheFile(context, url);

        if (!file.exists()) {
            download(url, file, onReady);
            return null;
        }

        Bitmap raw = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (raw == null) return null;
        return circle(raw, sizePx);
    }

    private static File cacheFile(Context context, String url) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(url.getBytes("UTF-8"));
            StringBuilder name = new StringBuilder("wface_");
            for (byte b : hash) name.append(String.format("%02x", b));
            return new File(context.getCacheDir(), name.toString());
        } catch (Exception e) {
            return new File(context.getCacheDir(), "wface_fallback");
        }
    }

    private static void download(String url, File target, Runnable onReady) {
        new Thread(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.connect();
                try (InputStream in = connection.getInputStream();
                     FileOutputStream out = new FileOutputStream(target)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                }
                if (onReady != null) new Handler(Looper.getMainLooper()).post(onReady);
            } catch (Exception ignored) {
                // sin red: el widget sigue sin foto, sin romperse
            }
        }).start();
    }

    private static Bitmap circle(Bitmap source, int sizePx) {
        int size = Math.max(sizePx, 32);
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        int side = Math.min(source.getWidth(), source.getHeight());
        Bitmap square = Bitmap.createBitmap(
                source,
                (source.getWidth() - side) / 2,
                (source.getHeight() - side) / 2,
                side,
                side);
        Bitmap scaled = Bitmap.createScaledBitmap(square, size, size, true);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);

        return output;
    }

    static void setFace(android.widget.RemoteViews views, Context context, int viewId, String url) {
        if (url == null || url.isEmpty()) {
            views.setImageViewResource(viewId, R.drawable.widget_face_empty);
            return;
        }
        Bitmap bitmap = face(context, url, 160, null);
        if (bitmap == null) {
            views.setImageViewResource(viewId, R.drawable.widget_face_empty);
        } else {
            views.setImageViewBitmap(viewId, bitmap);
        }
    }

    /** Icono de relleno mientras no hay foto. */
    static void clearFace(RemoteViews views, int viewId) {
        views.setImageViewResource(viewId, R.drawable.widget_face_empty);
    }

    static int dp(Context context, float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    static int color(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }

    /** Vuelve a pedir la actualización de un provider concreto. */
    static void requestUpdate(Context context, Class<?> provider) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
                new android.content.ComponentName(context, provider));
        if (ids.length > 0) WidgetRenderer.refresh(context, manager, provider, ids);
    }
}
