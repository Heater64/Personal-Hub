package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Seguir viendo, tamaño apaisado (4×2). */
public class WatchingRectWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderWatching(context, manager, ids, WidgetRenderer.Size.RECT);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderWatching(
                context, manager, new int[] { id }, WidgetRenderer.Size.RECT);
    }
}
