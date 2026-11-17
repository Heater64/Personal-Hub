package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Pinta los dos widgets. Está todo aquí para que los cuatro providers
 * (días/distancia × pequeño/grande) solo digan cuál son.
 */
final class WidgetRenderer {

    private WidgetRenderer() {}

    /** Repinta los ids del provider indicado, en el tamaño que le toque. */
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
    // TIEMPO JUNTOS — años, meses y días sueltos
    // ==========================================
    static void renderTogether(Context context, AppWidgetManager manager, int[] ids, boolean compact) {
        JSONObject data = WidgetSupport.read(context, "widget_days");
        int years = data == null ? 0 : data.optInt("y", 0);
        int months = data == null ? 0 : data.optInt("m", 0);
        int days = data == null ? 0 : data.optInt("d", 0);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_together);
            views.setTextViewText(R.id.widget_together_years, String.valueOf(years));
            views.setTextViewText(R.id.widget_together_months, String.valueOf(months));
            views.setTextViewText(R.id.widget_together_days, String.valueOf(days));

            int big = compact ? 22 : 30;
            int small = compact ? 11 : 13;
            views.setTextViewTextSize(R.id.widget_together_years, android.util.TypedValue.COMPLEX_UNIT_SP, big);
            views.setTextViewTextSize(R.id.widget_together_months, android.util.TypedValue.COMPLEX_UNIT_SP, big);
            views.setTextViewTextSize(R.id.widget_together_days, android.util.TypedValue.COMPLEX_UNIT_SP, big);
            views.setTextViewTextSize(R.id.widget_together_years_unit, android.util.TypedValue.COMPLEX_UNIT_SP, small);
            views.setTextViewTextSize(R.id.widget_together_months_unit, android.util.TypedValue.COMPLEX_UNIT_SP, small);
            views.setTextViewTextSize(R.id.widget_together_days_unit, android.util.TypedValue.COMPLEX_UNIT_SP, small);
            views.setTextViewTextSize(R.id.widget_together_label, android.util.TypedValue.COMPLEX_UNIT_SP, small - 2);
            views.setTextViewTextSize(R.id.widget_together_caption, android.util.TypedValue.COMPLEX_UNIT_SP, small - 1);

            // En el tamaño pequeño los años no caben: se ocultan sus dos vistas.
            int yearVisibility = compact ? android.view.View.GONE : android.view.View.VISIBLE;
            views.setViewVisibility(R.id.widget_together_years, yearVisibility);
            views.setViewVisibility(R.id.widget_together_years_unit, yearVisibility);

            WidgetSupport.openApp(context, views, R.id.widget_together_root);
            manager.updateAppWidget(id, views);
        }
    }

    // ==========================================
    // DÍAS JUNTOS — tarjeta oscura con las dos caras
    // ==========================================
    static void renderDays(Context context, AppWidgetManager manager, int[] ids, boolean compact) {
        JSONObject data = WidgetSupport.read(context, "widget_days");
        int days = data == null ? 0 : data.optInt("days", 0);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_days);
            views.setTextViewText(R.id.widget_days_count, String.valueOf(days));

            int big = compact ? 30 : 44;
            int small = compact ? 12 : 15;
            views.setTextViewTextSize(R.id.widget_days_count, android.util.TypedValue.COMPLEX_UNIT_SP, big);
            views.setTextViewTextSize(R.id.widget_days_unit, android.util.TypedValue.COMPLEX_UNIT_SP, small + 2);
            views.setTextViewTextSize(R.id.widget_days_caption, android.util.TypedValue.COMPLEX_UNIT_SP, small);

            boolean hasMe = data != null && !WidgetSupport.faceUrl(data, "me").isEmpty();
            boolean hasThem = data != null && !WidgetSupport.faceUrl(data, "partner").isEmpty();

            if (hasMe) {
                WidgetSupport.setFace(views, context, R.id.widget_days_me, WidgetSupport.faceUrl(data, "me"));
            } else {
                WidgetSupport.clearFace(views, R.id.widget_days_me);
            }
            if (hasThem) {
                WidgetSupport.setFace(views, context, R.id.widget_days_partner, WidgetSupport.faceUrl(data, "partner"));
            } else {
                WidgetSupport.clearFace(views, R.id.widget_days_partner);
            }

            views.setViewVisibility(R.id.widget_days_faces,
                    hasMe || hasThem ? android.view.View.VISIBLE : android.view.View.GONE);

            WidgetSupport.openApp(context, views, R.id.widget_days_root);
            manager.updateAppWidget(id, views);
        }

        // Si falta alguna foto, el descargador avisa y se repinta.
        scheduleFaceRefresh(context, data, DaysWidgetProvider.class);
    }

    // ==========================================
    // DISTANCIA — tarjeta clara con el número
    // ==========================================
    static void renderDistance(Context context, AppWidgetManager manager, int[] ids, boolean compact) {
        JSONObject data = WidgetSupport.read(context, "widget_distance");
        String text = data == null ? null : data.optString("text", null);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_distance);
            views.setTextViewText(R.id.widget_distance_value, text == null || text.isEmpty() ? "—" : text);

            int big = compact ? 26 : 38;
            int small = compact ? 10 : 12;
            views.setTextViewTextSize(R.id.widget_distance_value, android.util.TypedValue.COMPLEX_UNIT_SP, big);
            views.setTextViewTextSize(R.id.widget_distance_label, android.util.TypedValue.COMPLEX_UNIT_SP, small);
            views.setTextViewTextSize(R.id.widget_distance_caption, android.util.TypedValue.COMPLEX_UNIT_SP, small - 1);

            views.setTextViewText(
                    R.id.widget_distance_caption,
                    text == null ? context.getString(R.string.widget_distance_empty) : agoLabel(data));

            boolean hasMe = data != null && !WidgetSupport.faceUrl(data, "me").isEmpty();
            boolean hasThem = data != null && !WidgetSupport.faceUrl(data, "partner").isEmpty();

            if (hasMe) {
                WidgetSupport.setFace(views, context, R.id.widget_distance_me, WidgetSupport.faceUrl(data, "me"));
            } else {
                WidgetSupport.clearFace(views, R.id.widget_distance_me);
            }
            if (hasThem) {
                WidgetSupport.setFace(views, context, R.id.widget_distance_partner, WidgetSupport.faceUrl(data, "partner"));
            } else {
                WidgetSupport.clearFace(views, R.id.widget_distance_partner);
            }

            WidgetSupport.openApp(context, views, R.id.widget_distance_root);
            manager.updateAppWidget(id, views);
        }

        scheduleFaceRefresh(context, data, DistanceWidgetProvider.class);
    }

    /** «hace 5 min», «hace 2 h» o «abre la app». */
    private static String agoLabel(JSONObject data) {
        String iso = data == null ? "" : data.optString("at", "");
        long at = parseIso(iso);
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

    /**
     * Las fotos se descargan una sola vez: si aún no están en caché, se lanza
     * la descarga y, al terminar, se repinta el widget.
     */
    private static void scheduleFaceRefresh(Context context, JSONObject data, Class<?> provider) {
        if (data == null) return;
        String[] urls = { WidgetSupport.faceUrl(data, "me"), WidgetSupport.faceUrl(data, "partner") };
        for (String url : urls) {
            if (url == null || url.isEmpty()) continue;
            WidgetSupport.face(context, url, 160, () -> WidgetSupport.requestUpdate(context, provider));
        }
    }
}
