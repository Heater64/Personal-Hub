package com.heater64.personalhub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Repinta los widgets cuando cambia el día (o la hora, el huso o el idioma).
 *
 * Sin esto, el widget de ánimo seguía diciendo «hoy» con el estado de ayer
 * hasta que se abría la app —o hasta el siguiente `updatePeriodMillis`, que
 * puede tardar media hora—, la cuenta atrás no pasaba a «hoy» a medianoche y
 * el contador de días se quedaba con la cifra de ayer. Ninguno de esos fallos
 * da error: solo enseñan un dato viejo.
 *
 * · DATE_CHANGED     — cambia la fecha (medianoche o día nuevo tras cambiar la hora).
 * · TIME_SET         — el usuario pone la hora a mano.
 * · TIMEZONE_CHANGED — cambia de huso (viaje o ajuste).
 * · LOCALE_CHANGED   — cambia el idioma del sistema (se reformatean las etiquetas).
 */
public class WidgetDayChangeReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        boolean changesTheDay =
                Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_LOCALE_CHANGED.equals(action);

        if (!changesTheDay) return;

        // Recalcula días, «hoy/ayer» y la cuenta atrás en cada widget colocado.
        WidgetRenderer.refreshAll(context);
    }
}
