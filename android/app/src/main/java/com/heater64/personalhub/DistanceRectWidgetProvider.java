package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Widget de la distancia, tamaño rectangular (4×2). */
public class DistanceRectWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderDistance(context, manager, ids, WidgetRenderer.Size.RECT);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderDistance(context, manager, new int[] { id }, WidgetRenderer.Size.RECT);
    }
}
