package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente de los widgets.
 *
 * `refresh` repinta los cuatro widgets en cuanto la web guarda datos (sin esto
 * Android solo refresca cada 30 min) y `requestPin` abre el diálogo del
 * sistema para colocar el widget del tamaño elegido: Android no permite
 * añadirlos sin que el usuario confirme.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final Class<?>[] PROVIDERS = {
            DaysWidgetProvider.class,
            DaysCompactWidgetProvider.class,
            DistanceWidgetProvider.class,
            DistanceCompactWidgetProvider.class,
    };

    @PluginMethod
    public void refresh(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : PROVIDERS) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length > 0) WidgetRenderer.refresh(context, manager, provider, ids);
        }
        call.resolve();
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        String widget = call.getString("widget", "distance");
        boolean compact = "compact".equals(call.getString("size", "wide"));

        Class<?> provider;
        if ("days".equals(widget)) {
            provider = compact ? DaysCompactWidgetProvider.class : DaysWidgetProvider.class;
        } else {
            provider = compact ? DistanceCompactWidgetProvider.class : DistanceWidgetProvider.class;
        }

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
}
