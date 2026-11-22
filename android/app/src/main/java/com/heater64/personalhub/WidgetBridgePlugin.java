package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.ByteArrayOutputStream;
import java.util.Collections;

/**
 * Puente de los widgets.
 *
 * Los cambios locales se publican al instante. La credencial de lectura permite
 * al launcher recibir novedades aunque el WebView esté dormido.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        WidgetRenderer.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void setWidgetData(PluginCall call) {
        String key = call.getString("key");
        if (WidgetData.writeLocal(getContext(), key, call.getString("value"), call.getString("userId"))) {
            WidgetRenderer.refreshKeys(getContext(), Collections.singleton(key));
        }
        call.resolve();
    }

    @PluginMethod
    public void getWidgetData(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", WidgetData.read(getContext(), call.getString("key")));
        call.resolve(result);
    }

    @PluginMethod
    public void setAccount(PluginCall call) {
        String userId = call.getString("userId");
        if (userId == null || userId.isEmpty()) {
            call.reject("widget-account-required");
            return;
        }
        if (WidgetData.setAccount(getContext(), userId)) {
            WidgetRenderer.refreshAll(getContext());
            WidgetSync.reconcile(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void configureSync(PluginCall call) {
        if (!WidgetData.configure(getContext(), call.getString("endpoint"), call.getString("token"),
                call.getString("userId"))) {
            call.reject("widget-sync-invalid-configuration");
            return;
        }
        WidgetSync.request(getContext());
        call.resolve();
    }

    @PluginMethod
    public void requestSync(PluginCall call) {
        boolean schedule = Boolean.TRUE.equals(call.getBoolean("schedule", true));
        JSObject result = new JSObject();
        result.put("scheduled", schedule && WidgetSync.request(getContext()));
        result.put("configured", WidgetData.isConfigured(getContext()));
        result.put("configuredAt", WidgetData.configuredAt(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void getMessagingToken(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                JSObject result = new JSObject();
                result.put("token", task.isSuccessful() ? task.getResult() : "");
                call.resolve(result);
            });
        } catch (IllegalStateException ignored) {
            JSObject result = new JSObject();
            result.put("token", "");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void clearSync(PluginCall call) {
        WidgetData.clear(getContext());
        WidgetRenderer.refreshAll(getContext());
        WidgetSync.reconcile(getContext());
        call.resolve();
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        String widget = call.getString("widget", "distance");
        // «wide» se mantiene por compatibilidad con la hoja antigua: quiere
        // decir el tamaño grande.
        String size = call.getString("size", "wide");

        Class<?> provider = providerFor(widget, size);

        JSObject result = new JSObject();

        // requestPinAppWidget existe desde Android 8 y el launcher tiene que
        // soportarlo; si no, la única salida es el menú de widgets a mano.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported()) {
            result.put("pinned", false);
            result.put("reason", "unsupported");
            call.resolve(result);
            return;
        }

        boolean started = manager.requestPinAppWidget(new ComponentName(context, provider), null, null);
        result.put("pinned", started);
        call.resolve(result);
    }

    /**
     * La vista previa real del widget: el mismo RemoteViews que se coloca en
     * el escritorio, dibujado como PNG. La hoja de widgets la usa para que la
     * miniatura no sea una maqueta aparte.
     */
    @PluginMethod
    public void preview(PluginCall call) {
        String widget = call.getString("widget", "days");
        String size = call.getString("size", "rect");

        Bitmap bitmap = WidgetPreview.render(getContext(), widget, size);
        if (bitmap == null) {
            call.reject("preview-unavailable");
            return;
        }

        ByteArrayOutputStream png = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);

        JSObject result = new JSObject();
        result.put("image", "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP));
        call.resolve(result);
    }

    /** Provider del widget y tamaño pedidos. Cualquier valor raro cae en grande. */
    private static Class<?> providerFor(String widget, String size) {
        boolean compact = "compact".equals(size);
        boolean rect = "rect".equals(size);

        if ("days".equals(widget)) {
            return compact ? DaysCompactWidgetProvider.class
                    : rect ? DaysRectWidgetProvider.class : DaysWidgetProvider.class;
        }
        if ("countdown".equals(widget)) {
            return compact ? CountdownCompactWidgetProvider.class
                    : rect ? CountdownRectWidgetProvider.class : CountdownWidgetProvider.class;
        }
        if ("mood".equals(widget)) {
            return compact ? MoodCompactWidgetProvider.class
                    : rect ? MoodRectWidgetProvider.class : MoodWidgetProvider.class;
        }
        if ("cycle".equals(widget)) {
            return compact ? CycleCompactWidgetProvider.class
                    : rect ? CycleRectWidgetProvider.class : CycleWidgetProvider.class;
        }
        if ("watching".equals(widget)) {
            return compact ? WatchingCompactWidgetProvider.class
                    : rect ? WatchingRectWidgetProvider.class : WatchingWidgetProvider.class;
        }
        if ("gifts".equals(widget)) {
            return compact ? GiftsCompactWidgetProvider.class
                    : rect ? GiftsRectWidgetProvider.class : GiftsWidgetProvider.class;
        }
        if ("reason".equals(widget)) {
            return compact ? ReasonCompactWidgetProvider.class : ReasonRectWidgetProvider.class;
        }
        if ("openwhen".equals(widget)) {
            return compact ? OpenWhenCompactWidgetProvider.class : OpenWhenRectWidgetProvider.class;
        }
        if ("streak".equals(widget)) {
            return compact ? StreakCompactWidgetProvider.class : StreakRectWidgetProvider.class;
        }
        return compact ? DistanceCompactWidgetProvider.class
                : rect ? DistanceRectWidgetProvider.class : DistanceWidgetProvider.class;
    }
}
