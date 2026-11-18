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
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;
import android.graphics.Shader;
import android.net.Uri;
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
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

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

    /**
     * ¿Hay datos reales que enseñar? Un contador de 0 días es un dato válido
     * (el aniversario es hoy), así que no vale con «mayor que cero».
     */
    static boolean hasDays(JSONObject data) {
        if (data == null) return false;
        return data.has("days") || !str(data, "since").isEmpty();
    }

    /**
     * Días juntos.
     *
     * La app guarda también la fecha del aniversario (`since`) para que el
     * widget pueda sumar los días por su cuenta: así el número sigue siendo
     * correcto aunque la app no se haya abierto en varios días. Si el paquete
     * es de una versión anterior y no trae la fecha, se usa el total guardado.
     */
    static int daysTogether(JSONObject data) {
        if (data == null) return 0;

        long start = parseDay(str(data, "since"));
        if (start > 0L) {
            Calendar today = Calendar.getInstance();
            zeroTime(today);
            long diff = today.getTimeInMillis() - start;
            // Se redondea para que el cambio de hora no reste ni sume un día.
            return (int) Math.max(0L, Math.round(diff / 86400000.0));
        }

        return Math.max(0, data.optInt("days", 0));
    }

    /**
     * «1 año y 4 meses». Es un dato distinto del total: el total dice cuánto
     * lleváis, esto dice cómo se reparte. Si no llega a un mes, no hay nada
     * que añadir y se oculta.
     *
     * Se calcula con el calendario a partir de `since`, igual que los días: si
     * se usara el desglose guardado por la app, el número avanzaría solo y el
     * «1 año y 4 meses» se quedaría congelado en el último guardado.
     */
    static String breakdownLabel(JSONObject data) {
        if (data == null) return "";

        long start = parseDay(str(data, "since"));
        int years;
        int months;

        if (start > 0L) {
            int[] parts = calendarParts(start);
            years = parts[0];
            months = parts[1];
        } else {
            years = data.optInt("y", data.optInt("years", 0));
            months = data.optInt("m", data.optInt("months", 0));
        }

        if (years > 0 && months > 0) {
            return years + (years == 1 ? " año y " : " años y ")
                    + months + (months == 1 ? " mes" : " meses");
        }
        if (years > 0) return years + (years == 1 ? " año" : " años");
        if (months > 0) return months + (months == 1 ? " mes" : " meses");
        return "";
    }

    /** Hoy como `yyyy-MM-dd` en hora local. */
    static String todayISO() {
        Calendar today = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d",
                today.get(Calendar.YEAR),
                today.get(Calendar.MONTH) + 1,
                today.get(Calendar.DAY_OF_MONTH));
    }

    /**
     * Días que faltan para `iso`: 0 si es hoy, negativo si ya pasó.
     * `Integer.MIN_VALUE` si no hay fecha o no se entiende.
     */
    static int daysUntil(String iso) {
        long target = parseDay(iso);
        if (target <= 0L) return Integer.MIN_VALUE;

        Calendar today = Calendar.getInstance();
        zeroTime(today);
        long diff = target - today.getTimeInMillis();
        // Redondeo para que el cambio de hora no mueva el día.
        return (int) Math.round(diff / 86400000.0);
    }

    /** Años y meses cumplidos entre `since` y hoy, con el calendario. */
    private static int[] calendarParts(long startMs) {
        Calendar start = Calendar.getInstance();
        start.setTimeInMillis(startMs);
        zeroTime(start);

        Calendar today = Calendar.getInstance();
        zeroTime(today);

        int years = today.get(Calendar.YEAR) - start.get(Calendar.YEAR);
        int months = today.get(Calendar.MONTH) - start.get(Calendar.MONTH);
        int days = today.get(Calendar.DAY_OF_MONTH) - start.get(Calendar.DAY_OF_MONTH);

        if (days < 0) {
            months -= 1;
            // Días del mes anterior al de hoy.
            Calendar previous = (Calendar) today.clone();
            previous.set(Calendar.DAY_OF_MONTH, 1);
            previous.add(Calendar.DAY_OF_MONTH, -1);
            days += previous.get(Calendar.DAY_OF_MONTH);
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }

        return new int[] { Math.max(0, years), Math.max(0, months) };
    }

    /** Fecha `yyyy-MM-dd` en hora local, a medianoche. 0 si no se entiende. */
    private static long parseDay(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            format.setLenient(false);
            Date date = format.parse(iso);
            if (date == null) return 0L;
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(date);
            zeroTime(calendar);
            return calendar.getTimeInMillis();
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private static void zeroTime(Calendar calendar) {
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
    }

    static void openApp(Context context, RemoteViews views, int viewId) {
        openApp(context, views, viewId, null);
    }

    /**
     * Tocar el widget abre la app. Con `route`, en vez de la portada se abre esa
     * pantalla mediante el deep link personalhub://<route> (el widget de días
     * lleva a /juntos, la pantalla del aniversario).
     */
    static void openApp(Context context, RemoteViews views, int viewId, String route) {
        Intent intent;
        if (route == null || route.isEmpty()) {
            intent = new Intent(context, MainActivity.class);
        } else {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.heater64.personalhub://" + route));
            intent.setPackage(context.getPackageName());
        }

        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pending = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pending);
    }

    /**
     * Últimos bitmaps ya decodificados, por URL y tamaño.
     *
     * Cada repintado volvía a leer el fichero de caché y a recortarlo: abrir
     * el launcher o cambiar de tamaño repintaba los widgets y volvía a hacer
     * el trabajo de disco. Doce entradas son pocas para la memoria del widget
     * y cubren lo que cabe en pantalla.
     */
    private static final java.util.Map<String, Bitmap> MEMO = new java.util.HashMap<>();
    private static final int MEMO_MAX = 12;

    private static Bitmap memo(String key) {
        synchronized (MEMO) {
            return MEMO.get(key);
        }
    }

    private static void remember(String key, Bitmap bitmap) {
        synchronized (MEMO) {
            if (MEMO.size() >= MEMO_MAX) MEMO.clear();
            MEMO.put(key, bitmap);
        }
    }

    /**
     * Foto circular lista para poner en un ImageView.
     * Devuelve null si aún no está descargada (y lanza la descarga).
     */
    static Bitmap face(Context context, String url, int sizePx, Runnable onReady) {
        if (url == null || url.isEmpty()) return null;
        String key = "face|" + sizePx + "|" + url;
        Bitmap cached = memo(key);
        if (cached != null) return cached;

        File file = cacheFile(context, url);
        if (!file.exists()) {
            download(url, file, onReady);
            return null;
        }

        Bitmap raw = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (raw == null) return null;
        Bitmap round = circle(raw, sizePx);
        remember(key, round);
        return round;
    }

    /**
     * Póster de una serie: cuadrado redondeado y recortado al centro.
     * Mismo patrón que la foto (descarga → caché → repintado), para que el
     * widget no se quede con el hueco si la imagen llega un segundo después.
     */
    static Bitmap poster(Context context, String url, int widthPx, int heightPx, Runnable onReady) {
        if (url == null || url.isEmpty()) return null;
        String key = "poster|" + widthPx + "x" + heightPx + "|" + url;
        Bitmap cached = memo(key);
        if (cached != null) return cached;

        File file = cacheFile(context, url);
        if (!file.exists()) {
            download(url, file, onReady);
            return null;
        }

        Bitmap raw = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (raw == null) return null;
        Bitmap rounded = rounded(raw, widthPx, heightPx, dp(context, 10));
        remember(key, rounded);
        return rounded;
    }

    /** Recorte al centro con esquinas redondeadas. */
    private static Bitmap rounded(Bitmap source, int widthPx, int heightPx, int radiusPx) {
        int width = Math.max(1, widthPx);
        int height = Math.max(1, heightPx);
        Bitmap output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawRoundRect(new RectF(0, 0, width, height), radiusPx, radiusPx, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));

        float scale = Math.max(width / (float) source.getWidth(), height / (float) source.getHeight());
        float scaledWidth = source.getWidth() * scale;
        float scaledHeight = source.getHeight() * scale;
        float left = (width - scaledWidth) / 2f;
        float top = (height - scaledHeight) / 2f;
        canvas.drawBitmap(source, null,
                new RectF(left, top, left + scaledWidth, top + scaledHeight), paint);

        return output;
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

    static void setFace(RemoteViews views, Context context, int viewId, String url) {
        setFace(views, context, viewId, url, R.drawable.widget_face_empty);
    }

    /** Igual que {@link #setFace(RemoteViews, Context, int, String)} pero con
     *  el hueco de cada widget, para no mezclar paletas. */
    static void setFace(RemoteViews views, Context context, int viewId, String url, int placeholder) {
        if (url == null || url.isEmpty()) {
            views.setImageViewResource(viewId, placeholder);
            return;
        }
        Bitmap bitmap = face(context, url, 160, null);
        if (bitmap == null) {
            views.setImageViewResource(viewId, placeholder);
        } else {
            views.setImageViewBitmap(viewId, bitmap);
        }
    }

    /** Icono de relleno mientras no hay foto. */
    static void clearFace(RemoteViews views, int viewId) {
        views.setImageViewResource(viewId, R.drawable.widget_face_empty);
    }

    static void clearFace(RemoteViews views, int viewId, int placeholder) {
        views.setImageViewResource(viewId, placeholder);
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
