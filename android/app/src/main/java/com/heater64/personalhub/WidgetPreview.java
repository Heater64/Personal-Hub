package com.heater64.personalhub;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;

/**
 * Vista previa de verdad: coge el RemoteViews que se colocaría en el
 * escritorio —mismo layout, mismos textos, mismos tamaños de letra— y lo
 * dibuja en un bitmap.
 *
 * Es lo único que garantiza que lo que se ve en la hoja de widgets y lo que
 * aparece en la pantalla de inicio no se separen: no hay una maqueta paralela,
 * se pinta el mismo objeto.
 */
final class WidgetPreview {

    /** Tamaños con los que se dibuja cada composición, en dp. */
    private static final int[][] SIZES = {
            { 110, 110 }, // compact
            { 250, 110 }, // rect
            { 250, 180 }, // large
    };

    private WidgetPreview() {}

    /**
     * @return el bitmap del widget o null si no se pudo inflar.
     */
    static Bitmap render(Context context, String widget, String size) {
        int which = "compact".equals(size) ? 0 : ("large".equals(size) || "wide".equals(size)) ? 2 : 1;
        int[] box = SIZES[which];
        WidgetRenderer.Size target = which == 0
                ? WidgetRenderer.Size.COMPACT
                : which == 2 ? WidgetRenderer.Size.LARGE : WidgetRenderer.Size.RECT;

        RemoteViews views = WidgetRenderer.capture(context, widget, box, target);
        if (views == null) return null;

        int width = WidgetSupport.dp(context, box[0]);
        int height = WidgetSupport.dp(context, box[1]);
        if (width <= 0 || height <= 0) return null;

        try {
            FrameLayout host = new FrameLayout(context);
            View view = views.apply(context, host);
            view.measure(
                    View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, width, height);

            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            view.draw(new Canvas(bitmap));
            return bitmap;
        } catch (Exception e) {
            // Un layout que no se deja inflar se ve en la app como «sin vista
            // previa»; es mejor eso que tumbar la hoja.
            return null;
        }
    }
}
