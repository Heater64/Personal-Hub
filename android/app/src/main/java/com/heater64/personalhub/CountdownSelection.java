package com.heater64.personalhub;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Qué fechas enseña cada instancia del widget de cuenta atrás.
 *
 * La app deja en el paquete las próximas fechas; la elección vive aquí, por
 * `appWidgetId`, porque dos widgets del mismo provider pueden querer fechas
 * distintas (el aniversario en uno y el cumpleaños en otro).
 *
 * Sin elección guardada se enseña SOLO la más cercana, que es lo que hacía el
 * widget antes de poder elegir: así los widgets ya colocados no cambian de
 * aspecto con la actualización. Varias fechas hay que marcarlas a propósito.
 */
final class CountdownSelection {

    /** Cuántas fechas caben a la vez en la composición alta. */
    static final int MAX = 3;

    private static final String PREFS = "widget_countdown_selection";
    private static final String PREFIX = "ids_";
    /** Separador que no puede aparecer en una clave (`anniversary`, `event:x`). */
    private static final String SEP = "\u001F";

    /** Una fecha del paquete: identidad estable, título y día. */
    static final class Event {
        final String key;
        final String title;
        final String date;

        Event(String key, String title, String date) {
            this.key = key;
            this.title = title;
            this.date = date;
        }
    }

    private CountdownSelection() {}

    /** Fechas que dejó la app, de la más cercana a la más lejana. */
    static List<Event> events(Context context) {
        List<Event> list = new ArrayList<>();
        JSONObject data = WidgetSupport.read(context, "widget_countdown");
        if (data == null) return list;

        JSONArray array = data.optJSONArray("events");
        if (array != null) {
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.optJSONObject(i);
                if (item == null) continue;
                String date = item.optString("date", "");
                if (date.isEmpty()) continue;
                String title = item.optString("title", "");
                String key = item.optString("key", "");
                if (key.isEmpty()) key = fallbackKey(title, date);
                list.add(new Event(key, title, date));
            }
        }

        // Paquete de una versión anterior: solo traía la próxima fecha.
        if (list.isEmpty()) {
            String title = WidgetSupport.str(data, "title");
            String date = WidgetSupport.str(data, "date");
            if (!title.isEmpty() && !date.isEmpty()) {
                list.add(new Event(fallbackKey(title, date), title, date));
            }
        }

        Collections.sort(list, (a, b) -> Integer.compare(order(a), order(b)));

        // Una fecha repetida (dos eventos con el mismo id) se enseña una vez.
        List<Event> unique = new ArrayList<>();
        for (Event event : list) {
            boolean repeated = false;
            for (Event kept : unique) {
                if (kept.key.equals(event.key)) {
                    repeated = true;
                    break;
                }
            }
            if (!repeated) unique.add(event);
        }
        return unique;
    }

    /** Fechas elegidas para esta instancia; la más cercana si no hay elección. */
    static List<Event> pick(Context context, int widgetId, List<Event> all) {
        if (all.isEmpty()) return all;

        String[] keys = read(context, widgetId);
        if (keys.length == 0) return closest(all);

        List<Event> chosen = new ArrayList<>();
        for (Event event : all) {
            for (String key : keys) {
                if (key.equals(event.key)) {
                    chosen.add(event);
                    break;
                }
            }
        }

        // Si la app borró las fechas elegidas, el widget no se queda en blanco:
        // vuelve a enseñar la próxima.
        return chosen.isEmpty() ? closest(all) : chosen;
    }

    private static List<Event> closest(List<Event> all) {
        List<Event> one = new ArrayList<>();
        if (!all.isEmpty()) one.add(all.get(0));
        return one;
    }

    static String[] read(Context context, int widgetId) {
        String raw = prefs(context).getString(PREFIX + widgetId, "");
        if (raw == null || raw.isEmpty()) return new String[0];
        return raw.split(SEP);
    }

    static void write(Context context, int widgetId, List<String> keys) {
        StringBuilder raw = new StringBuilder();
        for (String key : keys) {
            if (key == null || key.isEmpty()) continue;
            if (raw.length() > 0) raw.append(SEP);
            raw.append(key);
        }
        prefs(context).edit().putString(PREFIX + widgetId, raw.toString()).apply();
    }

    /** Al quitar el widget de la pantalla, su elección se va con él. */
    static void clear(Context context, int[] ids) {
        if (ids == null || ids.length == 0) return;
        SharedPreferences.Editor editor = prefs(context).edit();
        for (int id : ids) editor.remove(PREFIX + id);
        editor.apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Días que faltan, para ordenar; las fechas rotas van al final. */
    private static int order(Event event) {
        int days = WidgetSupport.daysUntil(event.date);
        return days == Integer.MIN_VALUE ? Integer.MAX_VALUE : days;
    }

    /** Clave estable para un paquete que no la traía. */
    private static String fallbackKey(String title, String date) {
        return "date:" + date + ":" + title;
    }
}
