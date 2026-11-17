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
 * `refresh` repinta el widget de la distancia en cuanto la web guarda un valor
 * (sin esto Android solo refresca cada 30 min) y `requestPin` abre el diálogo
 * del sistema para colocar un widget en la pantalla de inicio: Android no
 * permite añadirlos sin que el usuario confirme, así que esto es lo máximo
 * que puede hacer la app.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        DistanceWidgetProvider.updateAll(context, manager, null);
        call.resolve();
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        String which = call.getString("widget", "distance");
        Class<?> provider = "days".equals(which)
                ? DaysWidgetProvider.class
                : DistanceWidgetProvider.class;

        JSObject result = new JSObject();

        // requestPinAppWidget existe desde Android 8 y el launcher tiene que
        // soportarlo; si no, la única salida es el menú de widgets a mano.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported()) {
            result.put("pinned", false);
            result.put("reason", "unsupported");
            call.resolve(result);
            return;
        }

        ComponentName component = new ComponentName(context, provider);
        boolean started = manager.requestPinAppWidget(component, null, null);
        result.put("pinned", started);
        call.resolve(result);
    }
}
