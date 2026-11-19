package com.heater64.personalhub;

/**
 * Las cartas de open when en tamaño cuadrado (1×1).
 */
public class OpenWhenCompactWidgetProvider extends ProWidgetProvider {

    @Override
    String dataKey() {
        return "widget_openwhen";
    }

    @Override
    WidgetRenderer.Size defaultSize() {
        return WidgetRenderer.Size.COMPACT;
    }
}
