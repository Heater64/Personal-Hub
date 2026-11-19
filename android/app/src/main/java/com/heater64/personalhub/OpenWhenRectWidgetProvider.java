package com.heater64.personalhub;

/**
 * Las cartas de open when en tamaño apaisado (3×1).
 */
public class OpenWhenRectWidgetProvider extends ProWidgetProvider {

    @Override
    String dataKey() {
        return "widget_openwhen";
    }

    @Override
    WidgetRenderer.Size defaultSize() {
        return WidgetRenderer.Size.RECT;
    }
}
