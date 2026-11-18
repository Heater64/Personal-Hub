package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Widget de días juntos, tamaño grande (4×3). */
public class DaysWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderDays(context, manager, ids, WidgetRenderer.Size.LARGE);
    }

    /**
     * Al estirar o encoger el widget cambia la composición (apilada o
     * apaisada). Sin esto, el launcher mantiene el layout anterior y el
     * contenido se recorta.
     */
    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderDays(context, manager, new int[] { id }, WidgetRenderer.Size.LARGE);
    }
}
