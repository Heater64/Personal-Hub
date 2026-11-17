package com.heater64.personalhub;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import java.util.Calendar;

/**
 * Widget de prueba: el mismo contador de "días juntos" que la portada de la
 * app (#homeCounter), directamente en la pantalla de inicio.
 *
 * La fecha es la misma que usa la app por defecto (utils/specialDates.js:
 * anniversary = 2025-07-03). Si algún día se cambia desde el panel, este
 * número es el único sitio que hay que tocar aquí: un widget no puede leer
 * Supabase (para eso haría falta un Worker propio y un AppWidget con
 * refresco por JobScheduler, que es el siguiente paso si el widget convence).
 */
public class DaysWidgetProvider extends AppWidgetProvider {

    private static final int START_YEAR = 2025;
    private static final int START_MONTH = Calendar.JULY;
    private static final int START_DAY = 3;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        long days = daysTogether();
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context, days));
        }
    }

    private RemoteViews buildViews(Context context, long days) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_days);
        views.setTextViewText(R.id.widget_days_count, String.valueOf(days));

        // Tocar el widget abre la app (la portada, que es donde vive el contador).
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_days_root, pending);

        return views;
    }

    /**
     * Días completos entre la fecha de inicio y hoy, sin horas ni zonas:
     * se normalizan los dos extremos a medianoche y se redondea, para que un
     * cambio de hora no reste ni sume un día.
     */
    private long daysTogether() {
        Calendar start = Calendar.getInstance();
        start.set(START_YEAR, START_MONTH, START_DAY, 0, 0, 0);
        start.set(Calendar.MILLISECOND, 0);

        Calendar today = Calendar.getInstance();
        today.set(Calendar.HOUR_OF_DAY, 0);
        today.set(Calendar.MINUTE, 0);
        today.set(Calendar.SECOND, 0);
        today.set(Calendar.MILLISECOND, 0);

        long diff = today.getTimeInMillis() - start.getTimeInMillis();
        long days = Math.round(diff / (24.0 * 60 * 60 * 1000));
        return Math.max(0, days);
    }
}
