package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/**
 * Base de los widgets Pro (razón, Open When y racha).
 *
 * Los tres comparten composición —kicker, valor y etiqueta—, así que solo
 * cambian la clave de datos y el tamaño con el que se pintan. El renderer
 * hace el resto.
 */
abstract class ProWidgetProvider extends AppWidgetProvider {

    abstract String dataKey();

    abstract WidgetRenderer.Size defaultSize();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.renderProText(context, manager, ids, defaultSize(), dataKey());
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        WidgetRenderer.renderProText(
                context, manager, new int[] { id }, defaultSize(), dataKey());
    }
}
