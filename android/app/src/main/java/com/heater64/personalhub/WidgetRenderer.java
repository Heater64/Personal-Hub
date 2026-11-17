package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Pinta los widgets.
 *
 * Cada tamaño tiene su PROPIO layout: el pequeño no es el grande con letra
 * menor (eso se veía igual y no servía de nada elegir). Los tamaños de texto
 * viven en el XML, no se tocan desde aquí, para que lo que se ve en la app sea
 * exactamente lo que se ve en la pantalla de inicio.
 */
final class WidgetRenderer {

    private WidgetRenderer() {}

    static void refresh(Context context, AppWidgetManager manager, Class<?> provider, int[] ids) {
        String name = provider.getSimpleName();
        boolean compact = name.contains("Compact");
        if (name.startsWith("Days")) {
            renderDays(context, manager, ids, compact);
        } else if (name.startsWith("Together")) {
            renderTogether(context, manager, ids, compact);
        } else {
            renderDistance(context, manager, ids, compact);
        }
    }

    // ==========================================
    // DÍAS JUNTOS
    //   grande: caras + «501 días / juntos»
    //   pequeño: solo el número
    // ==========================================
    static void renderDays(Context context, AppWidgetManager manager, int[] ids, boolean compact) {
        JSONObject data = WidgetSupport.read(context, "widget_days");
        int days = data == null ? 0 : data.optInt("days", 0);

        for (int id : ids) {
            RemoteViews views = compact
                    ? new RemoteViews(context.getPackageName(), R.layout.widget_days_compact)
                    : new RemoteViews(context.getPackageName(), R.layout.widget_days);

            views.setTextViewText(R.id.widget_days_count, String.valueOf(days));

            if (!compact) {
                String me = WidgetSupport.faceUrl(data, "me");
                String partner = WidgetSupport.faceUrl(data, "partner");

                if (me.isEmpty()) WidgetSupport.clearFace(views, R.id.widget_days_me);
                else WidgetSupport.setFace(views, context, R.id.widget_days_me, me);

                if (partner.isEmpty()) WidgetSupport.clearFace(views, R.id.widget_days_partner);
                else WidgetSupport.setFace(views, context, R.id.widget_days_partner, partner);

                views.setViewVisibility(
                        R.id.widget_days_faces,
                        me.isEmpty() && partner.isEmpty() ? View.GONE : View.VISIBLE);
            }

            WidgetSupport.openApp(context, views, R.id.widget_days_root);
            manager.updateAppWidget(id, views);
        }

        if (!compact) scheduleFaceRefresh(context, data, DaysWidgetProvider.class);
    }

    // ==========================================
    // DISTANCIA
    //   grande: «estáis a / 301 km / caras / hace 2 min»
    //   pequeño: solo «301 km»
    // ==========================================
    static void renderDistance(Context context, AppWidgetManager manager, int[] ids, boolean compact) {
        JSONObject data = WidgetSupport.read(context, "widget_distance");
        String text = data == null ? "" : data.optString("text", "");
        String value = text.isEmpty() ? "—" : text;

        for (int id : ids) {
            RemoteViews views = compact
                    ? new RemoteViews(context.getPackageName(), R.layout.widget_distance_compact)
                    : new RemoteViews(context.getPackageName(), R.layout.widget_distance);

            views.setTextViewText(R.id.widget_distance_value, value);

            if (!compact) {
                views.setTextViewText(
                        R.id.widget_distance_caption,
                        text.isEmpty() ? context.getString(R.string.widget_distance_empty) : agoLabel(data));

                String me = WidgetSupport.faceUrl(data, "me");
                String partner = WidgetSupport.faceUrl(data, "partner");

                if (me.isEmpty()) WidgetSupport.clearFace(views, R.id.widget_distance_me);
                else WidgetSupport.setFace(views, context, R.id.widget_distance_me, me);

                if (partner.isEmpty()) WidgetSupport.clearFace(views, R.id.widget_distance_partner);
                else WidgetSupport.setFace(views, context, R.id.widget_distance_partner, partner);

                views.setViewVisibility(
                        R.id.widget_distance_faces,
                        me.isEmpty() && partner.isEmpty() ? View.GONE : View.VISIBLE);
            }

            WidgetSupport.openApp(context, views, R.id.widget_distance_root);
            manager.updateAppWidget(id, views);
        }

        if (!compact) scheduleFaceRefresh(context, data, DistanceWidgetProvider.class);
    }

    // ==========================================
    // TIEMPO JUNTOS
    //   grande: años + meses + días
    //   pequeño: meses + días
    // ==========================================
    static void renderTogether(Context context, AppWidgetManager manager, int[] ids, boolean compact) {
        JSONObject data = WidgetSupport.read(context, "widget_days");
        int years = data == null ? 0 : data.optInt("y", 0);
        int months = data == null ? 0 : data.optInt("m", 0);
        int days = data == null ? 0 : data.optInt("d", 0);

        for (int id : ids) {
            RemoteViews views = compact
                    ? new RemoteViews(context.getPackageName(), R.layout.widget_together_compact)
                    : new RemoteViews(context.getPackageName(), R.layout.widget_together);

            views.setTextViewText(R.id.widget_together_months, String.valueOf(months));
            views.setTextViewText(R.id.widget_together_days, String.valueOf(days));
            if (!compact) views.setTextViewText(R.id.widget_together_years, String.valueOf(years));

            WidgetSupport.openApp(context, views, R.id.widget_together_root);
            manager.updateAppWidget(id, views);
        }
    }

    /** «hace 5 min», «hace 2 h» o «abre la app». */
    private static String agoLabel(JSONObject data) {
        long at = parseIso(data == null ? "" : data.optString("at", ""));
        if (at <= 0L) return "sin actualizar";

        long minutes = Math.max(0L, (System.currentTimeMillis() - at) / 60000L);
        if (minutes < 1) return "ahora mismo";
        if (minutes < 60) return "hace " + minutes + " min";
        long hours = minutes / 60;
        if (hours < 24) return "hace " + hours + " h";
        return "abre la app para actualizar";
    }

    private static long parseIso(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        String[] patterns = { "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'" };
        for (String pattern : patterns) {
            try {
                java.text.SimpleDateFormat format =
                        new java.text.SimpleDateFormat(pattern, java.util.Locale.US);
                format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                java.util.Date date = format.parse(iso);
                if (date != null) return date.getTime();
            } catch (Exception ignored) {
                // siguiente formato
            }
        }
        return 0L;
    }

    /** Descarga las caras que falten y repinta al terminar. */
    private static void scheduleFaceRefresh(Context context, JSONObject data, Class<?> provider) {
        if (data == null) return;
        String[] urls = { WidgetSupport.faceUrl(data, "me"), WidgetSupport.faceUrl(data, "partner") };
        for (String url : urls) {
            if (url == null || url.isEmpty()) continue;
            WidgetSupport.face(context, url, 160, () -> WidgetSupport.requestUpdate(context, provider));
        }
    }
}
