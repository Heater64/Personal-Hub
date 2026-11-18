package com.heater64.personalhub;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * La cuenta de días que se recalcula al cambiar el día.
 *
 * Es lo que hace que la cuenta atrás pase a «hoy» a medianoche y que el ánimo
 * deje de decir «hoy» con el estado de ayer: los dos comparan la fecha guardada
 * con este cálculo, así que conviene tenerlo clavado en los bordes.
 */
public class WidgetDatesTest {

    /** Fecha local `yyyy-MM-dd` desplazada N días desde hoy. */
    private static String iso(int offsetDays) {
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DAY_OF_MONTH, offsetDays);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.getTime());
    }

    @Test
    public void todayIsZero() {
        assertEquals(0, WidgetSupport.daysUntil(iso(0)));
    }

    @Test
    public void yesterdayIsMinusOne() {
        assertEquals(-1, WidgetSupport.daysUntil(iso(-1)));
    }

    @Test
    public void tomorrowIsOne() {
        assertEquals(1, WidgetSupport.daysUntil(iso(1)));
    }

    @Test
    public void monthBoundaryCountsDays() {
        // 35 días vista cruza mes (y a veces año): el cálculo no depende del mes.
        assertEquals(35, WidgetSupport.daysUntil(iso(35)));
    }

    @Test
    public void missingOrInvalidDateHasNoAnswer() {
        assertEquals(Integer.MIN_VALUE, WidgetSupport.daysUntil(""));
        assertEquals(Integer.MIN_VALUE, WidgetSupport.daysUntil("2026-13-45"));
    }
}
