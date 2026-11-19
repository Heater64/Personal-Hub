package com.heater64.personalhub;

/**
 * La razón del día en tamaño cuadrado (1×1).
 */
public class ReasonCompactWidgetProvider extends ProWidgetProvider {

    @Override
    String dataKey() {
        return "widget_reason";
    }

    @Override
    WidgetRenderer.Size defaultSize() {
        return WidgetRenderer.Size.COMPACT;
    }
}
