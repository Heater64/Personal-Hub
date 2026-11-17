package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente mínimo para que la web pueda refrescar el widget en el momento.
 *
 * Sin esto, Android solo actualiza el widget cada 30 minutos (el mínimo de
 * `updatePeriodMillis`) y el número iría por detrás de la portada. La app
 * llama a `window.Capacitor.Plugins.WidgetBridge.refresh()` justo después de
 * guardar la distancia.
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
}
