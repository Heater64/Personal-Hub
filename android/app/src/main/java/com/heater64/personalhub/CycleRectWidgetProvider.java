package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Ciclo, tamaño apaisado (4×2). */
public class CycleRectWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderCycle(context, manager, ids, WidgetRenderer.Size.RECT);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderCycle(
                context, manager, new int[] { id }, WidgetRenderer.Size.RECT);
    }
}
