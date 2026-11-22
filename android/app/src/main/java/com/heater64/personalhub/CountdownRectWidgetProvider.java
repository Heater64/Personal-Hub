package com.heater64.personalhub;

import android.content.Context;

/** Cuenta atrás, tamaño rectangular. */
public class CountdownRectWidgetProvider extends HubWidgetProvider {
    @Override
    public void onDeleted(Context context, int[] ids) {
        CountdownSelection.clear(context, ids);
    }
}
