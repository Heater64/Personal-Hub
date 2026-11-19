package com.heater64.personalhub;

/**
 * La racha de ánimo en tamaño apaisado (3×1).
 */
public class StreakRectWidgetProvider extends ProWidgetProvider {

    @Override
    String dataKey() {
        return "widget_streak";
    }

    @Override
    WidgetRenderer.Size defaultSize() {
        return WidgetRenderer.Size.RECT;
    }
}
