package com.heater64.personalhub;

/**
 * La razón del día en tamaño apaisado (3×1).
 */
public class ReasonRectWidgetProvider extends ProWidgetProvider {

    @Override
    String dataKey() {
        return "widget_reason";
    }

    @Override
    WidgetRenderer.Size defaultSize() {
        return WidgetRenderer.Size.RECT;
    }
}
