package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Widget de la distancia, tamaño grande (4×3). */
public class DistanceWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderDistance(context, manager, ids, WidgetRenderer.Size.LARGE);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderDistance(context, manager, new int[] { id }, WidgetRenderer.Size.LARGE);
    }
}
