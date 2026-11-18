package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Cuenta atrás, tamaño pequeño (2×2). */
public class CountdownCompactWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderCountdown(context, manager, ids, WidgetRenderer.Size.COMPACT);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        // La elección de fechas es de esta instancia: al quitarla, se borra.
        CountdownSelection.clear(context, ids);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderCountdown(
                context, manager, new int[] { id }, WidgetRenderer.Size.COMPACT);
    }
}
