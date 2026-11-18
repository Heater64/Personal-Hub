package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Sorpresas del calendario, tamaño grande (4×3). */
public class GiftsWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderGifts(context, manager, ids, WidgetRenderer.Size.LARGE);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderGifts(
                context, manager, new int[] { id }, WidgetRenderer.Size.LARGE);
    }
}
