package com.heater64.personalhub;

import android.content.Context;

/** Cuenta atrás, tamaño compacto. */
public class CountdownCompactWidgetProvider extends HubWidgetProvider {
    @Override
    public void onDeleted(Context context, int[] ids) {
        CountdownSelection.clear(context, ids);
    }
}
