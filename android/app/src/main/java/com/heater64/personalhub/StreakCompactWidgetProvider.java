package com.heater64.personalhub;

/**
 * La racha de ánimo en tamaño cuadrado (1×1).
 */
public class StreakCompactWidgetProvider extends ProWidgetProvider {

    @Override
    String dataKey() {
        return "widget_streak";
    }

    @Override
    WidgetRenderer.Size defaultSize() {
        return WidgetRenderer.Size.COMPACT;
    }
}
