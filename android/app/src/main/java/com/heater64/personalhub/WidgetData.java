package com.heater64.personalhub;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Guarda juntos el propietario, la credencial de lectura y los datos del launcher. */
final class WidgetData {
    private static final String PREFS = "widget_data";
    private static final String LEGACY_PREFS = "CapacitorStorage";
    private static final String ACCOUNT = "widget_account";
    private static final String ENDPOINT = "widget_sync_endpoint";
    private static final String TOKEN = "widget_sync_token";
    private static final String GENERATION = "widget_sync_generation";
    private static final String CONFIGURED_AT = "widget_sync_configured_at";

    static final class Snapshot {
        final String endpoint;
        final String token;
        final String generation;
        final Map<String, String> previous;

        Snapshot(String endpoint, String token, String generation, Map<String, String> previous) {
            this.endpoint = endpoint;
            this.token = token;
            this.generation = generation;
            this.previous = previous;
        }
    }

    private WidgetData() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized boolean setAccount(Context context, String userId) {
        SharedPreferences prefs = prefs(context);
        String previous = prefs.getString(ACCOUNT, null);
        if (userId.equals(previous)) return false;

        purge(prefs).putString(ACCOUNT, userId).commit();
        if (previous != null) CountdownSelection.clearAll(context);
        else clearLegacyData(context);
        return true;
    }

    static synchronized boolean configure(Context context, String endpoint, String token, String userId) {
        if (!validEndpoint(endpoint) || token == null || token.trim().isEmpty() || userId == null) return false;
        SharedPreferences prefs = prefs(context);
        if (!userId.equals(prefs.getString(ACCOUNT, null))) return false;
        if (endpoint.equals(prefs.getString(ENDPOINT, null)) && token.equals(prefs.getString(TOKEN, null))) {
            return prefs.edit().putLong(CONFIGURED_AT, System.currentTimeMillis()).commit();
        }

        return prefs.edit().putString(ENDPOINT, endpoint).putString(TOKEN, token)
                .putString(GENERATION, UUID.randomUUID().toString())
                .putLong(CONFIGURED_AT, System.currentTimeMillis()).commit();
    }

    private static boolean validEndpoint(String endpoint) {
        if (endpoint == null) return false;
        try {
            URI uri = URI.create(endpoint);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getFragment() == null;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    static synchronized void clear(Context context) {
        purge(prefs(context)).remove(ACCOUNT).commit();
        CountdownSelection.clearAll(context);
        clearLegacyData(context);
    }

    private static void clearLegacyData(Context context) {
        SharedPreferences.Editor editor = context.getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE).edit();
        for (WidgetRenderer.Group group : WidgetRenderer.Group.values()) editor.remove(group.key);
        editor.apply();
    }

    private static SharedPreferences.Editor purge(SharedPreferences prefs) {
        SharedPreferences.Editor editor = prefs.edit().remove(ENDPOINT).remove(TOKEN)
                .remove(GENERATION).remove(CONFIGURED_AT);
        for (WidgetRenderer.Group group : WidgetRenderer.Group.values()) editor.remove(group.key);
        return editor;
    }

    static synchronized String read(Context context, String key) {
        SharedPreferences prefs = prefs(context);
        if (!WidgetRenderer.isDataKey(key) || !prefs.contains(ACCOUNT)) return null;
        return prefs.getString(key, null);
    }

    static synchronized boolean writeLocal(Context context, String key, String value, String userId) {
        if (!WidgetRenderer.isDataKey(key) || value == null || userId == null) return false;
        SharedPreferences prefs = prefs(context);
        if (!userId.equals(prefs.getString(ACCOUNT, null)) || value.equals(prefs.getString(key, null))) {
            return false;
        }
        prefs.edit().putString(key, value).apply();
        return true;
    }

    static synchronized boolean isConfigured(Context context) {
        return prefs(context).contains(GENERATION);
    }

    static synchronized long configuredAt(Context context) {
        return prefs(context).getLong(CONFIGURED_AT, 0L);
    }

    static synchronized Snapshot snapshot(Context context, Set<String> keys) {
        SharedPreferences prefs = prefs(context);
        String generation = prefs.getString(GENERATION, null);
        if (generation == null) return null;
        Map<String, String> previous = new HashMap<>();
        for (String key : keys) previous.put(key, prefs.getString(key, null));
        return new Snapshot(prefs.getString(ENDPOINT, null), prefs.getString(TOKEN, null), generation, previous);
    }

    static synchronized boolean revoke(Context context, Snapshot snapshot) {
        SharedPreferences prefs = prefs(context);
        if (!snapshot.generation.equals(prefs.getString(GENERATION, null))) return false;
        purge(prefs).commit();
        return true;
    }

    static synchronized Set<String> apply(Context context, Snapshot snapshot, JSONObject widgets) {
        Set<String> changed = new LinkedHashSet<>();
        SharedPreferences prefs = prefs(context);
        if (!snapshot.generation.equals(prefs.getString(GENERATION, null))) return changed;

        SharedPreferences.Editor editor = prefs.edit();
        for (Map.Entry<String, String> previous : snapshot.previous.entrySet()) {
            String key = previous.getKey();
            Object value = widgets.opt(key);
            // Un campo ausente conserva la caché. Solo un null explícito la limpia.
            if (value != JSONObject.NULL && !(value instanceof JSONObject)) continue;
            String before = previous.getValue();
            if (!Objects.equals(before, prefs.getString(key, null))) continue;
            String after;
            if (value == JSONObject.NULL) after = null;
            else if (WidgetRenderer.Group.GIFTS.key.equals(key)) {
                after = mergeGifts((JSONObject) value, before);
                if (after == null) continue;
            } else after = value.toString();
            if (Objects.equals(before, after)) continue;
            if (after == null) editor.remove(key);
            else editor.putString(key, after);
            changed.add(key);
        }
        if (!changed.isEmpty()) editor.apply();
        return changed;
    }

    private static String mergeGifts(JSONObject remote, String previous) {
        String date = remote.optString("date", "");
        JSONArray gifts = remote.optJSONArray("giftIds");
        if (gifts == null || !WidgetSupport.todayISO().equals(date)) return null;

        Set<String> opened = new LinkedHashSet<>();
        if (previous != null) {
            try {
                opened = giftIds(new JSONObject(previous).optJSONArray("openedIds"));
            } catch (JSONException ignored) {
                // Un paquete antiguo o vacío aún no llevaba el progreso local.
            }
        }
        Set<String> ids = giftIds(gifts);
        int pending = 0;
        for (String id : ids) if (!opened.contains(id)) pending++;
        try {
            return new JSONObject().put("giftIds", new JSONArray(ids)).put("openedIds", new JSONArray(opened))
                    .put("date", date).put("total", ids.size()).put("pending", pending).toString();
        } catch (JSONException ignored) {
            return null;
        }
    }

    private static Set<String> giftIds(JSONArray values) {
        Set<String> ids = new LinkedHashSet<>();
        if (values == null) return ids;
        for (int i = 0; i < values.length(); i++) {
            Object value = values.opt(i);
            if (value instanceof String && !((String) value).isEmpty()) ids.add((String) value);
        }
        return ids;
    }
}
