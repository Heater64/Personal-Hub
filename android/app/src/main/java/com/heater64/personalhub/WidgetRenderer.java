package com.heater64.personalhub;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Pinta los widgets.
 *
 * Cada tamaño tiene su PROPIA composición: el cuadrado enseña solo el dato, el
 * apaisado reparte texto y caras en horizontal y el alto apila caras, número y
 * desglose. Los tamaños de texto viven en el XML para que lo que se ve en la
 * app sea exactamente lo que se ve en la pantalla de inicio.
 *
 * La composición NO se elige por el provider sino por el hueco real que ocupa
 * el widget (`getAppWidgetOptions`). Así un widget que ya estaba colocado en
 * 4×2 con la versión anterior se repinta con la composición baja en vez de
 * recortarse, y al estirarlo vuelve a la alta. Si el launcher no devuelve el
 * tamaño, se usa SIEMPRE la composición baja: es la única que cabe en 110 dp
 * con seguridad. El provider solo decide entre cuadrado y bajo.
 *
 * Con la letra del sistema grande (1,3× / 1,5×) el dato principal se ancla a
 * su tamaño físico y, si el hueco apilado se queda corto, se omite la línea
 * secundaria. Los textos de apoyo sí crecen con la preferencia del usuario.
 */
final class WidgetRenderer {

    /** Los tres tamaños de un widget. */
    enum Size { COMPACT, RECT, LARGE }

    /** Debajo de esta altura (dp) la composición apilada no cabe. */
    private static final int TALL_MIN_HEIGHT_DP = 150;
    /** Debajo de esta anchura (dp) no caben dos caras y el número al lado. */
    private static final int WIDE_MIN_WIDTH_DP = 200;
    /** A partir de aquí la letra del sistema deja sin sitio la tercera línea. */
    private static final float TIGHT_FONT_SCALE = 1.25f;
    /** A partir de aquí la composición baja tampoco admite tres líneas. */
    private static final float EXTREME_FONT_SCALE = 1.7f;

    private static final int DAYS_FACE_SIZE_PX = 160;
    private static final int DISTANCE_FACE_SIZE_PX = 160;

    /**
     * Vista previa dentro de la app.
     *
     * Mientras hay captura no se toca el escritorio: el repintado guarda el
     * RemoteViews y la app lo dibuja como imagen. Así la miniatura es el
     * widget de verdad —mismo layout, mismos textos, mismos tamaños— y no una
     * maqueta aparte que se desincroniza.
     */
    private static final ThreadLocal<int[]> PREVIEW_BOX = new ThreadLocal<>();
    private static final ThreadLocal<RemoteViews[]> PREVIEW_OUT = new ThreadLocal<>();

    private static boolean previewing() {
        return PREVIEW_BOX.get() != null;
    }

    private static void push(AppWidgetManager manager, int id, RemoteViews views) {
        RemoteViews[] out = PREVIEW_OUT.get();
        if (out != null) {
            out[0] = views;
            return;
        }
        manager.updateAppWidget(id, views);
    }

    /** El widget real, con los datos reales, sin tocar la pantalla de inicio. */
    static RemoteViews capture(Context context, String widget, int[] box, Size size) {
        PREVIEW_BOX.set(box);
        PREVIEW_OUT.set(new RemoteViews[1]);
        try {
            switch (widget == null ? "" : widget) {
                case "days":
                    renderDays(context, null, new int[] { -1 }, size);
                    break;
                case "distance":
                    renderDistance(context, null, new int[] { -1 }, size);
                    break;
                case "countdown":
                    renderCountdown(context, null, new int[] { -1 }, size);
                    break;
                case "mood":
                    renderMood(context, null, new int[] { -1 }, size);
                    break;
                case "cycle":
                    renderCycle(context, null, new int[] { -1 }, size);
                    break;
                case "watching":
                    renderWatching(context, null, new int[] { -1 }, size);
                    break;
                case "gifts":
                    renderGifts(context, null, new int[] { -1 }, size);
                    break;
                default:
                    return null;
            }
            return PREVIEW_OUT.get()[0];
        } finally {
            PREVIEW_BOX.remove();
            PREVIEW_OUT.remove();
        }
    }

    private WidgetRenderer() {}

    /**
     * Todos los providers. Fuente única: el puente y el receiver de cambio de
     * día tienen que repintar exactamente el mismo conjunto.
     */
    static final Class<?>[] PROVIDERS = {
            DaysWidgetProvider.class,
            DaysRectWidgetProvider.class,
            DaysCompactWidgetProvider.class,
            DistanceWidgetProvider.class,
            DistanceRectWidgetProvider.class,
            DistanceCompactWidgetProvider.class,
            CountdownWidgetProvider.class,
            CountdownRectWidgetProvider.class,
            CountdownCompactWidgetProvider.class,
            MoodWidgetProvider.class,
            MoodRectWidgetProvider.class,
            MoodCompactWidgetProvider.class,
            CycleWidgetProvider.class,
            CycleRectWidgetProvider.class,
            CycleCompactWidgetProvider.class,
            WatchingWidgetProvider.class,
            WatchingRectWidgetProvider.class,
            WatchingCompactWidgetProvider.class,
            GiftsWidgetProvider.class,
            GiftsRectWidgetProvider.class,
            GiftsCompactWidgetProvider.class,
    };

    /** Repinta todos los widgets colocados (los que no están, se saltan). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : PROVIDERS) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length > 0) refresh(context, manager, provider, ids);
        }
    }

    static void refresh(Context context, AppWidgetManager manager, Class<?> provider, int[] ids) {
        if (provider == DaysCompactWidgetProvider.class) {
            renderDays(context, manager, ids, Size.COMPACT);
        } else if (provider == DaysRectWidgetProvider.class) {
            renderDays(context, manager, ids, Size.RECT);
        } else if (provider == DaysWidgetProvider.class) {
            renderDays(context, manager, ids, Size.LARGE);
        } else if (provider == DistanceCompactWidgetProvider.class) {
            renderDistance(context, manager, ids, Size.COMPACT);
        } else if (provider == DistanceRectWidgetProvider.class) {
            renderDistance(context, manager, ids, Size.RECT);
        } else if (provider == CountdownCompactWidgetProvider.class) {
            renderCountdown(context, manager, ids, Size.COMPACT);
        } else if (provider == CountdownRectWidgetProvider.class) {
            renderCountdown(context, manager, ids, Size.RECT);
        } else if (provider == CountdownWidgetProvider.class) {
            renderCountdown(context, manager, ids, Size.LARGE);
        } else if (provider == MoodCompactWidgetProvider.class) {
            renderMood(context, manager, ids, Size.COMPACT);
        } else if (provider == MoodRectWidgetProvider.class) {
            renderMood(context, manager, ids, Size.RECT);
        } else if (provider == MoodWidgetProvider.class) {
            renderMood(context, manager, ids, Size.LARGE);
        } else if (provider == CycleCompactWidgetProvider.class) {
            renderCycle(context, manager, ids, Size.COMPACT);
        } else if (provider == CycleRectWidgetProvider.class) {
            renderCycle(context, manager, ids, Size.RECT);
        } else if (provider == CycleWidgetProvider.class) {
            renderCycle(context, manager, ids, Size.LARGE);
        } else if (provider == WatchingCompactWidgetProvider.class) {
            renderWatching(context, manager, ids, Size.COMPACT);
        } else if (provider == WatchingRectWidgetProvider.class) {
            renderWatching(context, manager, ids, Size.RECT);
        } else if (provider == WatchingWidgetProvider.class) {
            renderWatching(context, manager, ids, Size.LARGE);
        } else if (provider == GiftsCompactWidgetProvider.class) {
            renderGifts(context, manager, ids, Size.COMPACT);
        } else if (provider == GiftsRectWidgetProvider.class) {
            renderGifts(context, manager, ids, Size.RECT);
        } else if (provider == GiftsWidgetProvider.class) {
            renderGifts(context, manager, ids, Size.LARGE);
        } else {
            renderDistance(context, manager, ids, Size.LARGE);
        }
    }

    // ==========================================
    // DÍAS JUNTOS
    //   cuadrado: «días juntos» + número
    //   apaisado: acento + número/desglose + caras
    //   alto: caras + número + desglose + frescura
    // ==========================================
    static void renderDays(Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        JSONObject data = WidgetSupport.read(context, "widget_days");
        boolean known = WidgetSupport.hasDays(data);

        // Sin datos no se inventa un número: se enseña un guion y una salida.
        String count = known ? String.valueOf(WidgetSupport.daysTogether(data)) : "—";
        String breakdown = known ? WidgetSupport.breakdownLabel(data) : "";
        String empty = context.getString(R.string.widget_days_empty);

        float scale = fontScale(context);
        boolean tight = scale > TIGHT_FONT_SCALE;
        boolean extreme = scale > EXTREME_FONT_SCALE;

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = daysLayout(box, defaultSize);
            boolean compact = layout == R.layout.widget_days_compact;
            boolean stacked = layout == R.layout.widget_days;

            // El número comparte fila con «días»: se descuenta su hueco.
            int available = availableWidthDp(box, layout) - (compact ? 0 : 34);
            int countSp = pinnedSp(
                    fitSp(context, count, baseCountSp(layout), available), scale);

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_days_count, count);
            views.setTextViewTextSize(
                    R.id.widget_days_count, TypedValue.COMPLEX_UNIT_SP, countSp);

            if (compact) {
                views.setTextViewText(R.id.widget_days_hint, empty);
                views.setViewVisibility(
                        R.id.widget_days_hint, known ? View.GONE : View.VISIBLE);
            } else {
                // En la composición baja el hueco del desglose hace también de
                // aviso de estado vacío; en la alta tiene su propia línea.
                String meta = !breakdown.isEmpty() ? breakdown : (known ? "" : empty);
                // Con la letra al 170 % o más, la composición baja no tiene
                // altura para tres líneas: se queda el dato principal.
                if (extreme && !stacked) meta = "";
                views.setTextViewText(R.id.widget_days_breakdown, meta);
                views.setViewVisibility(
                        R.id.widget_days_breakdown, meta.isEmpty() ? View.GONE : View.VISIBLE);

                paintFaces(context, views, data, R.id.widget_days_faces,
                        R.id.widget_days_me, R.id.widget_days_partner,
                        R.drawable.widget_days_face_empty);

                if (stacked) {
                    // Solo avisa si el paquete tiene más de un día: un contador
                    // de días no gana nada repitiendo «ahora mismo». Con letra
                    // muy grande no cabe una tercera línea y se omite.
                    String fresh = !known || tight ? "" : staleLabel(data);
                    if (fresh.isEmpty()) {
                        views.setViewVisibility(R.id.widget_days_fresh, View.GONE);
                    } else {
                        views.setTextViewText(R.id.widget_days_fresh, fresh);
                        views.setViewVisibility(R.id.widget_days_fresh, View.VISIBLE);
                    }
                }
            }

            // El widget de días abre la pantalla del aniversario.
            WidgetSupport.openApp(context, views, R.id.widget_days_root, "juntos");
            push(manager, id, views);
        }

        scheduleFaceRefresh(context, data, DAYS_FACE_SIZE_PX);
    }

    /**
     * Elige la composición de días según el hueco real.
     * Sin tamaño conocido se pinta la baja: la alta no cabe garantizada en
     * 110 dp y era justo lo que se recortaba en 4×2.
     */
    private static int daysLayout(int[] box, Size defaultSize) {
        if (defaultSize == Size.COMPACT) {
            return R.layout.widget_days_compact;
        }

        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.LARGE
                    ? R.layout.widget_days
                    : R.layout.widget_days_rect;
        }

        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_days_compact
                    : R.layout.widget_days_rect;
        }

        // Alto pero estrecho: la apilada necesitaría más ancho del que hay y
        // la cifra se saldría. El cuadrado cabe en cualquier hueco estrecho.
        if (isNarrow(box[0])) return R.layout.widget_days_compact;

        return R.layout.widget_days;
    }

    // ==========================================
    // DISTANCIA
    //   cuadrado: «estáis a» + cifra
    //   apaisado: acento + cifra/frescura + caras
    //   alto: caras + cifra + frescura
    // ==========================================
    static void renderDistance(
            Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        JSONObject data = WidgetSupport.read(context, "widget_distance");
        String text = data == null ? "" : data.optString("text", "");
        boolean known = !text.isEmpty();
        String value = known ? text : "—";
        String empty = context.getString(R.string.widget_distance_empty);
        // La distancia es un dato que caduca: aquí sí interesa decir siempre
        // cuándo se supo, no solo cuando está viejo.
        String fresh = known ? agoLabel(data) : empty;

        float scale = fontScale(context);
        boolean extreme = scale > EXTREME_FONT_SCALE;

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = distanceLayout(box, defaultSize);
            boolean compact = layout == R.layout.widget_distance_compact;
            boolean stacked = layout == R.layout.widget_distance;

            // La distancia no tiene un máximo («1234 km»): se mide el texto y,
            // si no cabe, baja de cuerpo en vez de recortarse.
            int valueSp = pinnedSp(
                    fitSp(context, value, baseDistanceSp(layout), availableWidthDp(box, layout)),
                    scale);

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_distance_value, value);
            views.setTextViewTextSize(
                    R.id.widget_distance_value, TypedValue.COMPLEX_UNIT_SP, valueSp);

            if (compact) {
                views.setTextViewText(R.id.widget_distance_hint, empty);
                views.setViewVisibility(
                        R.id.widget_distance_hint, known ? View.GONE : View.VISIBLE);
            } else {
                // La hora se calla solo en el caso extremo (letra ≥ 170 % en la
                // composición baja), donde empujaría la cifra fuera.
                boolean hideCaption = !stacked && extreme;
                views.setTextViewText(R.id.widget_distance_caption, fresh);
                views.setViewVisibility(
                        R.id.widget_distance_caption, hideCaption ? View.GONE : View.VISIBLE);

                paintFaces(context, views, data, R.id.widget_distance_faces,
                        R.id.widget_distance_me, R.id.widget_distance_partner,
                        R.drawable.widget_face_empty);

                // Su móvil: batería y red de la última posición compartida.
                paintDevice(context, views, data);
            }

            // El widget de distancia abre el mapa a pantalla completa.
            WidgetSupport.openApp(context, views, R.id.widget_distance_root, "mapa");
            push(manager, id, views);
        }

        scheduleFaceRefresh(context, data, DISTANCE_FACE_SIZE_PX);
    }

    /**
     * Elige la composición de distancia según el hueco real. Igual que en
     * días: sin tamaño conocido, la baja.
     */
    private static int distanceLayout(int[] box, Size defaultSize) {
        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.COMPACT
                    ? R.layout.widget_distance_compact
                    : R.layout.widget_distance_rect;
        }

        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_distance_compact
                    : R.layout.widget_distance_rect;
        }

        // Igual que en días: estrecho y alto, el cuadrado.
        if (isNarrow(box[0])) return R.layout.widget_distance_compact;

        return R.layout.widget_distance;
    }

    // ==========================================
    // CUENTA ATRÁS
    //   cuadrado: título + «N días»
    //   apaisado: acento + título/número + fecha
    //   alto: «FALTAN» + número + título + fecha
    // ==========================================
    static void renderCountdown(
            Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        List<CountdownSelection.Event> all = CountdownSelection.events(context);

        float scale = fontScale(context);
        boolean extreme = scale > EXTREME_FONT_SCALE;

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = countdownLayout(box, defaultSize);
            boolean stacked = layout == R.layout.widget_countdown;

            // Qué fechas quiere esta instancia; sin elección, todas.
            List<CountdownSelection.Event> chosen = CountdownSelection.pick(context, id, all);

            // Dos o tres fechas solo caben en la composición alta, una fila
            // cada una: el número gigante se comería las demás.
            if (chosen.size() > 1 && stacked) {
                renderCountdownRows(context, manager, id, chosen);
                continue;
            }

            CountdownSelection.Event event = chosen.isEmpty() ? null : chosen.get(0);
            String title = event == null ? "" : event.title;
            String date = event == null ? "" : event.date;
            int daysLeft = event == null ? Integer.MIN_VALUE : WidgetSupport.daysUntil(date);

            boolean hasDate = daysLeft != Integer.MIN_VALUE && !title.isEmpty();
            boolean today = hasDate && daysLeft == 0;
            boolean past = hasDate && daysLeft < 0;

            // Sin fecha no se inventa una cuenta atrás.
            String count = !hasDate ? "—" : today ? "hoy" : past ? "—" : String.valueOf(daysLeft);
            boolean showUnit = hasDate && daysLeft > 0;
            String heading = hasDate
                    ? title
                    : context.getString(R.string.widget_countdown_empty);
            String when = past
                    ? context.getString(R.string.widget_countdown_past)
                    : hasDate ? formatShortDate(date) : "";

            // El número comparte fila con «días»: se descuenta su hueco.
            int available = availableWidthDp(box, layout) - 30;
            int countSp = pinnedSp(fitSp(context, count, baseCountdownSp(layout), available), scale);

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_countdown_title, heading);
            views.setTextViewText(R.id.widget_countdown_count, count);
            views.setTextViewTextSize(
                    R.id.widget_countdown_count, TypedValue.COMPLEX_UNIT_SP, countSp);
            views.setViewVisibility(
                    R.id.widget_countdown_unit, showUnit ? View.VISIBLE : View.GONE);

            if (layout != R.layout.widget_countdown_compact) {
                // Con la letra al 170 % o más la composición baja no admite
                // tres líneas: el número y el título se quedan solos.
                boolean hideDate = when.isEmpty() || (!stacked && extreme);
                if (hideDate) {
                    views.setViewVisibility(R.id.widget_countdown_date, View.GONE);
                } else {
                    views.setTextViewText(R.id.widget_countdown_date, when);
                    views.setViewVisibility(R.id.widget_countdown_date, View.VISIBLE);
                }
            }

            WidgetSupport.openApp(context, views, R.id.widget_countdown_root, "calendario");
            push(manager, id, views);
        }
    }

    private static int countdownLayout(int[] box, Size defaultSize) {
        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.COMPACT
                    ? R.layout.widget_countdown_compact
                    : R.layout.widget_countdown_rect;
        }
        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_countdown_compact
                    : R.layout.widget_countdown_rect;
        }
        if (isNarrow(box[0])) return R.layout.widget_countdown_compact;
        return R.layout.widget_countdown;
    }

    private static int baseCountdownSp(int layout) {
        if (layout == R.layout.widget_countdown_compact) return 34;
        if (layout == R.layout.widget_countdown_rect) return 36;
        return 48;
    }

    /**
     * Varias fechas en la composición alta: una fila por fecha.
     * Con la letra del sistema grande se quita la línea de la fecha, que es lo
     * primero que no cabe cuando las filas crecen.
     */
    private static void renderCountdownRows(
            Context context,
            AppWidgetManager manager,
            int id,
            List<CountdownSelection.Event> events) {
        int[] rows = {
                R.id.widget_countdown_row1,
                R.id.widget_countdown_row2,
                R.id.widget_countdown_row3,
        };
        int[] titles = {
                R.id.widget_countdown_row1_title,
                R.id.widget_countdown_row2_title,
                R.id.widget_countdown_row3_title,
        };
        int[] dates = {
                R.id.widget_countdown_row1_date,
                R.id.widget_countdown_row2_date,
                R.id.widget_countdown_row3_date,
        };
        int[] counts = {
                R.id.widget_countdown_row1_count,
                R.id.widget_countdown_row2_count,
                R.id.widget_countdown_row3_count,
        };
        int[] units = {
                R.id.widget_countdown_row1_unit,
                R.id.widget_countdown_row2_unit,
                R.id.widget_countdown_row3_unit,
        };

        boolean tight = fontScale(context) > TIGHT_FONT_SCALE;
        String empty = context.getString(R.string.widget_countdown_empty);
        RemoteViews views = new RemoteViews(
                context.getPackageName(), R.layout.widget_countdown_multi);

        for (int i = 0; i < rows.length; i++) {
            if (i >= events.size()) {
                views.setViewVisibility(rows[i], View.GONE);
                continue;
            }

            CountdownSelection.Event event = events.get(i);
            int days = WidgetSupport.daysUntil(event.date);
            boolean known = days != Integer.MIN_VALUE && !event.title.isEmpty();
            boolean today = known && days == 0;

            String count = !known ? "—"
                    : today ? "hoy"
                    : days < 0 ? "—"
                    : String.valueOf(days);
            String when = !known ? ""
                    : days < 0 ? context.getString(R.string.widget_countdown_past)
                    : formatShortDate(event.date);

            views.setTextViewText(titles[i], known ? event.title : empty);
            views.setTextViewText(counts[i], count);
            views.setViewVisibility(units[i], known && days > 0 ? View.VISIBLE : View.GONE);
            views.setTextViewText(dates[i], when);
            views.setViewVisibility(
                    dates[i], when.isEmpty() || tight ? View.GONE : View.VISIBLE);
            views.setViewVisibility(rows[i], View.VISIBLE);
        }

        WidgetSupport.openApp(context, views, R.id.widget_countdown_root, "calendario");
        manager.updateAppWidget(id, views);
    }

    /** Repinta solo las cuentas atrás (acaba de cambiar su configuración). */
    static void refreshCountdowns(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Class<?>[] providers = {
                CountdownCompactWidgetProvider.class,
                CountdownRectWidgetProvider.class,
                CountdownWidgetProvider.class,
        };
        for (Class<?> provider : providers) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length > 0) refresh(context, manager, provider, ids);
        }
    }

    // ==========================================
    // ESTADO DE ÁNIMO
    //   cuadrado: emoji + etiqueta
    //   apaisado: emoji + etiqueta + cuándo
    //   alto: emoji grande + etiqueta + cuándo
    // ==========================================
    static void renderMood(
            Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        JSONObject data = WidgetSupport.read(context, "widget_mood");
        String label = WidgetSupport.str(data, "label");
        String emoji = WidgetSupport.str(data, "emoji");
        String date = WidgetSupport.str(data, "date");

        boolean known = !label.isEmpty() || !emoji.isEmpty();
        String today = WidgetSupport.todayISO();
        boolean isToday = known && date.equals(today);

        String shownEmoji = known ? emoji : "—";
        String shownLabel = known
                ? label
                : context.getString(R.string.widget_mood_empty);
        String meta = !known
                ? context.getString(R.string.widget_mood_hint)
                : isToday ? context.getString(R.string.widget_mood_today) : relativeDay(date);

        float scale = fontScale(context);
        boolean extreme = scale > EXTREME_FONT_SCALE;

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = moodLayout(box, defaultSize);

            // Con la letra gigante el emoji cede unos puntos para que sigan
            // cabiendo la etiqueta y el «hoy».
            int emojiBase = baseMoodEmojiSp(layout);
            if (extreme) emojiBase = Math.max(28, emojiBase - 8);

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_mood_emoji, shownEmoji);
            views.setTextViewTextSize(
                    R.id.widget_mood_emoji,
                    TypedValue.COMPLEX_UNIT_SP,
                    pinnedSp(emojiBase, scale));
            views.setTextViewText(R.id.widget_mood_label, shownLabel);
            views.setTextViewText(R.id.widget_mood_meta, meta);

            // En el grande, el «hoy» es lo primero que sobra al 170 %.
            if (layout == R.layout.widget_mood && extreme) {
                views.setViewVisibility(R.id.widget_mood_meta, View.GONE);
            }

            WidgetSupport.openApp(context, views, R.id.widget_mood_root, "sentimientos");
            push(manager, id, views);
        }
    }

    private static int moodLayout(int[] box, Size defaultSize) {
        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.COMPACT
                    ? R.layout.widget_mood_compact
                    : R.layout.widget_mood_rect;
        }
        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_mood_compact
                    : R.layout.widget_mood_rect;
        }
        if (isNarrow(box[0])) return R.layout.widget_mood_compact;
        return R.layout.widget_mood;
    }

    private static int baseMoodEmojiSp(int layout) {
        if (layout == R.layout.widget_mood_compact) return 40;
        if (layout == R.layout.widget_mood_rect) return 36;
        return 56;
    }

    // ==========================================
    // CICLO
    //   cuadrado: fase + día
    //   apaisado: barra + fase, día y próxima regla
    //   alto: fase grande, día y próxima regla
    // ==========================================
    static void renderCycle(
            Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        JSONObject data = WidgetSupport.read(context, "widget_cycle");
        String phase = WidgetSupport.str(data, "phase");
        int day = data == null ? 0 : data.optInt("day", 0);
        int length = data == null ? 0 : data.optInt("length", 0);
        int days = data == null ? Integer.MIN_VALUE : data.optInt("days", Integer.MIN_VALUE);
        String next = WidgetSupport.str(data, "next");

        boolean known = data != null && !phase.isEmpty() && day > 0;
        String shownPhase = known ? phase : context.getString(R.string.widget_cycle_empty);
        String bigDay = known ? String.valueOf(day) : "—";
        String dayLabel = !known ? "—"
                : length > 0
                ? context.getString(R.string.widget_cycle_day_of, day, length)
                : context.getString(R.string.widget_cycle_day, day);

        String nextLabel = "";
        if (known && days != Integer.MIN_VALUE) {
            if (days <= 0) nextLabel = context.getString(R.string.widget_cycle_today);
            else if (days == 1) nextLabel = context.getString(R.string.widget_cycle_tomorrow);
            else nextLabel = context.getString(R.string.widget_cycle_next, days);
            if (days > 1 && !next.isEmpty()) nextLabel += " · " + formatShortDate(next);
        }

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = cycleLayout(box, defaultSize);
            boolean compact = layout == R.layout.widget_cycle_compact;

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_cycle_phase, shownPhase);
            views.setTextViewText(R.id.widget_cycle_day, compact ? bigDay : dayLabel);

            if (!compact) {
                if (nextLabel.isEmpty()) {
                    views.setViewVisibility(R.id.widget_cycle_next, View.GONE);
                } else {
                    views.setTextViewText(R.id.widget_cycle_next, nextLabel);
                    views.setViewVisibility(R.id.widget_cycle_next, View.VISIBLE);
                }
            }

            // El ciclo vive dentro de Sentimientos.
            WidgetSupport.openApp(context, views, R.id.widget_cycle_root, "sentimientos");
            push(manager, id, views);
        }
    }

    private static int cycleLayout(int[] box, Size defaultSize) {
        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.COMPACT
                    ? R.layout.widget_cycle_compact
                    : R.layout.widget_cycle_rect;
        }
        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_cycle_compact
                    : R.layout.widget_cycle_rect;
        }
        if (isNarrow(box[0])) return R.layout.widget_cycle_compact;
        return R.layout.widget_cycle;
    }

    // ==========================================
    // SEGUIR VIENDO
    //   cuadrado: póster + título + episodio
    //   apaisado: póster + título + «Ep. 4 de 10 · 40 %»
    //   alto: póster grande + título + avance
    // ==========================================
    static void renderWatching(
            Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        JSONObject data = WidgetSupport.read(context, "widget_watching");
        String title = WidgetSupport.str(data, "title");
        String poster = WidgetSupport.str(data, "poster");
        int watched = data == null ? 0 : data.optInt("watched", 0);
        int total = data == null ? 0 : data.optInt("total", 0);
        int percent = data == null ? 0 : data.optInt("percent", 0);
        boolean known = !title.isEmpty() && total > 0;

        String shownTitle = known ? title : context.getString(R.string.widget_watching_empty);
        String episode = known
                ? context.getString(R.string.widget_watching_episode, watched, total)
                : "";
        String percentLabel = known
                ? context.getString(R.string.widget_watching_percent, percent)
                : "";

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = watchingLayout(box, defaultSize);
            boolean compact = layout == R.layout.widget_watching_compact;

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_watching_title, shownTitle);
            setIfText(views, R.id.widget_watching_episode, episode);
            if (!compact) setIfText(views, R.id.widget_watching_percent, percentLabel);

            // El póster sí se pierde con los datos vacíos: sin serie no hay
            // portada que enseñar (el hueco redondeado se queda solo).
            paintPoster(context, views, R.id.widget_watching_poster, known ? poster : "", layout);

            WidgetSupport.openApp(context, views, R.id.widget_watching_root, "rincon");
            push(manager, id, views);
        }

        if (known && !poster.isEmpty() && !previewing()) {
            int[] size = posterSizePx(context, defaultSize);
            WidgetSupport.poster(context, poster, size[0], size[1],
                    () -> WidgetSupport.requestUpdate(context, watchingProvider(defaultSize)));
        }
    }

    private static void paintPoster(
            Context context, RemoteViews views, int viewId, String url, int layout) {
        if (url.isEmpty()) {
            views.setImageViewResource(viewId, R.drawable.widget_poster_empty);
            return;
        }
        int[] size = posterSizePx(context, layout);
        Bitmap bitmap = WidgetSupport.poster(context, url, size[0], size[1], null);
        if (bitmap == null) {
            views.setImageViewResource(viewId, R.drawable.widget_poster_empty);
        } else {
            views.setImageViewBitmap(viewId, bitmap);
        }
    }

    /** Tamaño del póster en píxeles, el mismo que declara cada layout. */
    private static int[] posterSizePx(Context context, int layout) {
        int wDp = layout == R.layout.widget_watching ? 72
                : layout == R.layout.widget_watching_rect ? 52 : 44;
        int hDp = layout == R.layout.widget_watching ? 96
                : layout == R.layout.widget_watching_rect ? 72 : 60;
        return new int[] { WidgetSupport.dp(context, wDp), WidgetSupport.dp(context, hDp) };
    }

    private static int[] posterSizePx(Context context, Size size) {
        return posterSizePx(context, size == Size.LARGE ? R.layout.widget_watching
                : size == Size.RECT ? R.layout.widget_watching_rect
                : R.layout.widget_watching_compact);
    }

    private static Class<?> watchingProvider(Size size) {
        return size == Size.LARGE ? WatchingWidgetProvider.class
                : size == Size.RECT ? WatchingRectWidgetProvider.class
                : WatchingCompactWidgetProvider.class;
    }

    private static int watchingLayout(int[] box, Size defaultSize) {
        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.COMPACT
                    ? R.layout.widget_watching_compact
                    : R.layout.widget_watching_rect;
        }
        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_watching_compact
                    : R.layout.widget_watching_rect;
        }
        if (isNarrow(box[0])) return R.layout.widget_watching_compact;
        return R.layout.widget_watching;
    }

    /** Pone el texto o oculta la vista si no hay nada que decir. */
    private static void setIfText(RemoteViews views, int viewId, String text) {
        if (text == null || text.isEmpty()) {
            views.setViewVisibility(viewId, View.GONE);
            return;
        }
        views.setTextViewText(viewId, text);
        views.setViewVisibility(viewId, View.VISIBLE);
    }

    // ==========================================
    // SORPRESAS
    //   cuadrado: emoji + pendientes
    //   apaisado: barra + «HOY» + pendientes
    //   alto: «HOY» + emoji + pendientes + qué hacer
    // ==========================================
    static void renderGifts(
            Context context, AppWidgetManager manager, int[] ids, Size defaultSize) {
        JSONObject data = WidgetSupport.read(context, "widget_gifts");
        int total = data == null ? 0 : data.optInt("total", 0);
        int pending = data == null ? 0 : data.optInt("pending", 0);
        boolean known = data != null;

        String count = known ? String.valueOf(pending) : "—";
        String label = !known
                ? context.getString(R.string.widget_gifts_empty)
                : pending > 0
                ? context.getResources().getQuantityString(
                        R.plurals.widget_gifts_pending, pending, pending)
                : context.getString(R.string.widget_gifts_opened);
        String hint = !known || total <= 0 ? ""
                : pending > 0 ? context.getString(R.string.widget_gifts_hint)
                : context.getString(R.string.widget_gifts_tomorrow);

        for (int id : ids) {
            int[] box = box(context, manager, id);
            int layout = giftsLayout(box, defaultSize);
            boolean compact = layout == R.layout.widget_gifts_compact;

            RemoteViews views = new RemoteViews(context.getPackageName(), layout);
            views.setTextViewText(R.id.widget_gifts_count, count);
            views.setTextViewText(R.id.widget_gifts_label, label);
            if (layout == R.layout.widget_gifts_rect) {
                views.setViewVisibility(
                        R.id.widget_gifts_unit, pending > 0 ? View.VISIBLE : View.GONE);
            }
            if (!compact) setIfText(views, R.id.widget_gifts_hint, hint);

            WidgetSupport.openApp(context, views, R.id.widget_gifts_root, "calendario");
            push(manager, id, views);
        }
    }

    private static int giftsLayout(int[] box, Size defaultSize) {
        if (box[0] <= 0 && box[1] <= 0) {
            return defaultSize == Size.COMPACT
                    ? R.layout.widget_gifts_compact
                    : R.layout.widget_gifts_rect;
        }
        if (isShort(box[1])) {
            return isNarrow(box[0])
                    ? R.layout.widget_gifts_compact
                    : R.layout.widget_gifts_rect;
        }
        if (isNarrow(box[0])) return R.layout.widget_gifts_compact;
        return R.layout.widget_gifts;
    }

    /** «3 jul 2026», con meses en español sin depender del idioma del móvil. */
    static String formatShortDate(String iso) {
        String[] months = { "ene", "feb", "mar", "abr", "may", "jun",
                "jul", "ago", "sep", "oct", "nov", "dic" };
        String[] parts = (iso == null ? "" : iso).split("-");
        if (parts.length != 3) return "";
        try {
            int month = Integer.parseInt(parts[1]);
            int day = Integer.parseInt(parts[2]);
            if (month < 1 || month > 12) return "";
            return day + " " + months[month - 1] + " " + parts[0];
        } catch (Exception ignored) {
            return "";
        }
    }

    /** «ayer», «hace 3 días» o la fecha corta, para el ánimo guardado. */
    private static String relativeDay(String iso) {
        int days = WidgetSupport.daysUntil(iso);
        if (days == 0) return "hoy";
        if (days == -1) return "ayer";
        if (days < -1) return formatShortDate(iso);
        return formatShortDate(iso);
    }

    private static boolean isShort(int heightDp) {
        return heightDp > 0 && heightDp < TALL_MIN_HEIGHT_DP;
    }

    private static boolean isNarrow(int widthDp) {
        return widthDp > 0 && widthDp < WIDE_MIN_WIDTH_DP;
    }

    /**
     * Tamaño real del widget en dp, `{ancho, alto}`. 0 = el launcher no lo
     * sabe todavía.
     */
    private static int[] box(Context context, AppWidgetManager manager, int id) {
        int[] preview = PREVIEW_BOX.get();
        if (preview != null) return preview;
        if (manager == null) return new int[] { 0, 0 };
        try {
            Bundle options = manager.getAppWidgetOptions(id);
            if (options == null) return new int[] { 0, 0 };
            return new int[] {
                    options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
                    options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0),
            };
        } catch (Exception ignored) {
            return new int[] { 0, 0 };
        }
    }

    /** Cuerpo de partida del número de días, según la composición. */
    private static int baseCountSp(int layout) {
        return layout == R.layout.widget_days ? 44 : 36;
    }

    /** Cuerpo de partida de la cifra de distancia, según la composición. */
    private static int baseDistanceSp(int layout) {
        if (layout == R.layout.widget_distance_compact) return 30;
        if (layout == R.layout.widget_distance_rect) return 34;
        return 40;
    }

    /**
     * Ancho útil del dato, en dp, descontando padding y, en la composición
     * baja, la barra de acento y las dos caras.
     */
    private static int availableWidthDp(int[] box, int layout) {
        int width = box[0] > 0 ? box[0] : (layout == R.layout.widget_days_compact
                || layout == R.layout.widget_distance_compact ? 110 : 250);

        if (layout == R.layout.widget_days_rect || layout == R.layout.widget_distance_rect) {
            // 14 + 14 de padding, 3 de barra, 12 de margen, 80 de caras y 10
            // de separación.
            return Math.max(60, width - 133);
        }
        return Math.max(50, width - 20);
    }

    /**
     * Cuerpo que hace caber `text` en `availableDp`.
     * Se mide con las métricas reales del mismo tipo que pinta el TextView
     * (Roboto bold), así no hay que adivinar cuánto mide «1234 km».
     */
    private static int fitSp(Context context, String text, int baseSp, int availableDp) {
        if (text == null || text.isEmpty() || availableDp <= 0) return baseSp;

        float density = context.getResources().getDisplayMetrics().density;
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(Typeface.DEFAULT_BOLD);
        paint.setTextSize(baseSp * density);

        float width = paint.measureText(text);
        float max = availableDp * density;
        if (width <= max || width <= 0f) return baseSp;

        return Math.max(12, (int) Math.floor(baseSp * max / width));
    }

    private static float fontScale(Context context) {
        float scale = context.getResources().getConfiguration().fontScale;
        return scale <= 0f ? 1f : scale;
    }

    /**
     * El dato principal conserva su tamaño FÍSICO aunque la letra del sistema
     * esté al 130 % o al 150 %: si creciera con ella empujaría las caras y el
     * desglose fuera del widget. Las etiquetas sí crecen, que es donde importa
     * la preferencia de lectura.
     */
    private static int pinnedSp(int baseSp, float fontScale) {
        return Math.max(12, Math.round(baseSp / Math.max(1f, fontScale)));
    }

    /** Las dos caras, o el bloque entero oculto si aún no hay ninguna. */
    private static void paintFaces(
            Context context,
            RemoteViews views,
            JSONObject data,
            int groupId,
            int meId,
            int partnerId,
            int placeholder) {
        String me = WidgetSupport.faceUrl(data, "me");
        String partner = WidgetSupport.faceUrl(data, "partner");

        if (me.isEmpty() && partner.isEmpty()) {
            views.setViewVisibility(groupId, View.GONE);
            return;
        }

        // setFace pinta el hueco y lanza la descarga: el bitmap llega en el
        // siguiente repintado, así que aquí solo se elige el recurso.
        if (me.isEmpty()) {
            WidgetSupport.clearFace(views, meId, placeholder);
        } else {
            WidgetSupport.setFace(views, context, meId, me, placeholder);
        }

        if (partner.isEmpty()) {
            WidgetSupport.clearFace(views, partnerId, placeholder);
        } else {
            WidgetSupport.setFace(views, context, partnerId, partner, placeholder);
        }

        views.setViewVisibility(groupId, View.VISIBLE);
    }

    /**
     * «su móvil · 82 % · Wi-Fi»: lo que dejó escrito su posición.
     * Sin dato se oculta la línea entera en vez de enseñar la de ayer.
     */
    private static void paintDevice(Context context, RemoteViews views, JSONObject data) {
        JSONObject device = data == null ? null : data.optJSONObject("device");
        int battery = device == null ? -1 : device.optInt("battery", -1);
        if (battery < 0) {
            views.setViewVisibility(R.id.widget_distance_device, View.GONE);
            return;
        }

        StringBuilder text = new StringBuilder(
                context.getString(R.string.widget_distance_device, battery));
        if (device.optBoolean("charging", false)) {
            text.append(" · ").append(context.getString(R.string.widget_distance_charging));
        }
        String net = netLabel(device.optString("net", ""));
        if (!net.isEmpty()) text.append(" · ").append(net);

        views.setTextViewText(R.id.widget_distance_device, text.toString());
        views.setViewVisibility(R.id.widget_distance_device, View.VISIBLE);
    }

    /** «wifi» → «Wi-Fi»; lo que no se reconoce se deja como venga. */
    private static String netLabel(String raw) {
        String key = raw == null ? "" : raw.toLowerCase(Locale.US);
        if (key.isEmpty()) return "";
        if (key.equals("wifi")) return "Wi-Fi";
        if (key.equals("cellular")) return "Datos";
        if (key.equals("ethernet")) return "Cable";
        if (key.equals("4g") || key.equals("3g") || key.equals("2g")) return key.toUpperCase(Locale.US);
        return key.toUpperCase(Locale.US);
    }

    /** «hace 5 min», «hace 2 h» o «abre la app». */
    private static String agoLabel(JSONObject data) {
        long at = parseIso(data == null ? "" : data.optString("at", ""));
        if (at <= 0L) return "sin actualizar";

        long minutes = Math.max(0L, (System.currentTimeMillis() - at) / 60000L);
        if (minutes < 1) return "ahora mismo";
        if (minutes < 60) return "hace " + minutes + " min";
        long hours = minutes / 60;
        if (hours < 24) return "hace " + hours + " h";
        return "abre la app para actualizar";
    }

    /**
     * «hace 2 días» cuando el paquete guardado ya está viejo.
     * Vacío mientras los datos sean de hoy: no hay nada que avisar.
     */
    private static String staleLabel(JSONObject data) {
        long at = parseIso(data == null ? "" : data.optString("at", ""));
        if (at <= 0L) return "";

        long hours = Math.max(0L, (System.currentTimeMillis() - at) / 3600000L);
        if (hours < 24L) return "";

        long days = hours / 24L;
        if (days == 1L) return "actualizado ayer";
        if (days < 7L) return "hace " + days + " días";
        return "abre la app para actualizar";
    }

    private static long parseIso(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        String[] patterns = { "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'" };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = format.parse(iso);
                if (date != null) return date.getTime();
            } catch (Exception ignored) {
                // siguiente formato
            }
        }
        return 0L;
    }

    /** Descarga las caras que falten y repinta todos los widgets al terminar. */
    private static void scheduleFaceRefresh(Context context, JSONObject data, int sizePx) {
        if (data == null || previewing()) return;
        String[] urls = { WidgetSupport.faceUrl(data, "me"), WidgetSupport.faceUrl(data, "partner") };
        for (String url : urls) {
            if (url == null || url.isEmpty()) continue;
            WidgetSupport.face(context, url, sizePx,
                    () -> WidgetRenderer.refreshAll(context));
        }
    }
}
