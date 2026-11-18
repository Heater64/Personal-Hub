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
 * `refresh` repinta todos los widgets en cuanto la web guarda datos (sin esto
 * Android solo refresca cada 30 min) y `requestPin` abre el diálogo del
 * sistema para colocar el widget del tamaño elegido: Android no permite
 * añadirlos sin que el usuario confirme.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        WidgetRenderer.refreshAll(getContext());
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
        return compact ? DistanceCompactWidgetProvider.class
                : rect ? DistanceRectWidgetProvider.class : DistanceWidgetProvider.class;
    }
}
