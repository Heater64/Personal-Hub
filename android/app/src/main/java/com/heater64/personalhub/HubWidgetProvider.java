package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

abstract class HubWidgetProvider extends AppWidgetProvider {
    @Override
    public void onEnabled(Context context) {
        WidgetSync.request(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetSync.reconcile(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.refresh(context, manager, getClass(), ids);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        WidgetRenderer.refresh(context, manager, getClass(), new int[] { id });
    }
}
