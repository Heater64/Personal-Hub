package com.heater64.personalhub;

import static org.junit.Assert.assertNotNull;

import android.graphics.Bitmap;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

/**
 * Las composiciones se inflan de verdad, como en el escritorio.
 *
 * RemoteViews solo admite un puñado de clases (`TextView`, `ImageView`,
 * `LinearLayout`…): un `<View>` suelto para la barra de acento compila pero
 * revienta al inflar, y el widget queda en blanco sin decir por qué. Aquí se
 * pinta cada tamaño con el mismo `apply` que usa el launcher, así que un
 * layout que no se deja inflar no pasa la prueba.
 */
@RunWith(RobolectricTestRunner.class)
public class WidgetCompositionsTest {

    private static final String[] WIDGETS = {
            "days", "distance", "countdown", "mood", "cycle", "watching", "gifts",
    };

    private static final String[] SIZES = { "compact", "rect", "large" };

    @Test
    public void everyCompositionInflates() {
        for (String widget : WIDGETS) {
            for (String size : SIZES) {
                Bitmap bitmap = WidgetPreview.render(RuntimeEnvironment.getApplication(), widget, size);
                assertNotNull(widget + "/" + size + " no se puede inflar en el escritorio", bitmap);
            }
        }
    }
}
