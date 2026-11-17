package com.heater64.personalhub;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Widget de la distancia entre los dos.
 *
 * La app calcula la distancia (JS) y la deja escrita en Preferences; este
 * provider solo lee ese JSON y lo pinta. Un widget no puede ejecutar la web,
 * así que esa es la única forma de que el número sea el mismo que en la
 * portada. Cuando la app guarda una distancia nueva, WidgetBridgePlugin lanza
 * la actualización en el acto; sin eso, el sistema solo refresca cada 30 min.
 */
public class DistanceWidgetProvider extends AppWidgetProvider {

    /**
     * Dónde escribe @capacitor/preferences: fichero `CapacitorStorage` y la
     * clave tal cual, sin prefijo (PreferencesConfiguration.group y
     * Preferences.putString lo confirman).
     */
    static final String PREFS_NAME = "CapacitorStorage";
    static final String KEY = "widget_distance";
    private static final String KEY_ALT = "_cap_widget_distance";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateAll(context, appWidgetManager, appWidgetIds);
    }

    /** Pinta todos los widgets con los datos actuales (lo llama también el plugin). */
    static void updateAll(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) {
            ids = manager.getAppWidgetIds(new ComponentName(context, DistanceWidgetProvider.class));
        }
        RemoteViews views = buildViews(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_distance);

        String text = null;
        long at = 0L;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw == null) raw = prefs.getString(KEY_ALT, null);
            if (raw != null) {
                JSONObject json = new JSONObject(raw);
                if (!json.isNull("text")) text = json.getString("text");
                String iso = json.optString("at", "");
                at = parseIso(iso);
            }
        } catch (Exception ignored) {
            // JSON corrupto o Preferences inexistente: el widget se queda a cero
        }

        views.setTextViewText(R.id.widget_distance_value, text == null ? "—" : text);
        views.setTextViewText(
                R.id.widget_distance_caption,
                text == null ? context.getString(R.string.widget_distance_empty) : agoLabel(at)
        );

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_distance_root, pending);

        return views;
    }

    /** «hace 5 min», «hace 2 h» o «actualiza abriendo la app» si es viejo. */
    private static String agoLabel(long at) {
        if (at <= 0L) return "sin actualizar";
        long minutes = Math.max(0L, (System.currentTimeMillis() - at) / 60000L);
        if (minutes < 1) return "ahora mismo";
        if (minutes < 60) return "hace " + minutes + " min";
        long hours = minutes / 60;
        if (hours < 24) return "hace " + hours + " h";
        return "actualiza abriendo la app";
    }

    /** La app escribe `new Date().toISOString()`: UTC con milisegundos. */
    private static long parseIso(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        String[] patterns = { "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'" };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = format.parse(iso);
                if (date != null) return date.getTime();
            } catch (Exception ignored) {
                // se prueba el siguiente formato
            }
        }
        return 0L;
    }
}
