package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Estado de ánimo, tamaño rectangular (4×2). */
public class MoodRectWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderMood(context, manager, ids, WidgetRenderer.Size.RECT);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderMood(context, manager, new int[] { id }, WidgetRenderer.Size.RECT);
    }
}
