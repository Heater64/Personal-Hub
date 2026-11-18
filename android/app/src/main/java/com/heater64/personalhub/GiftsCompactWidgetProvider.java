package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Sorpresas del calendario, tamaño cuadrado (2×2). */
public class GiftsCompactWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderGifts(context, manager, ids, WidgetRenderer.Size.COMPACT);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderGifts(
                context, manager, new int[] { id }, WidgetRenderer.Size.COMPACT);
    }
}
