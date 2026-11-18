package com.heater64.personalhub;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Pantalla que Android abre al colocar el widget de cuenta atrás (o al
 * reconfigurarlo desde el launcher, si lo ofrece).
 *
 * Lista las próximas fechas que dejó la app y deja marcar hasta tres: una sola
 * da la cuenta atrás grande de siempre, varias dan una fila por fecha en el
 * tamaño 4×3. La elección se guarda por instancia, así que dos widgets pueden
 * enseñar fechas distintas.
 *
 * Sin guardar no se coloca nada: el resultado por defecto es CANCELED.
 */
public class CountdownWidgetConfigActivity extends Activity {

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final List<CountdownSelection.Event> events = new ArrayList<>();
    private final List<CheckBox> boxes = new ArrayList<>();
    private TextView hint;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Cancelar (atrás o «Cancelar») deja el widget sin colocar, que es lo
        // que Android espera de una configuración no guardada.
        setResult(RESULT_CANCELED);

        Bundle extras = getIntent() == null ? null : getIntent().getExtras();
        appWidgetId = extras == null
                ? AppWidgetManager.INVALID_APPWIDGET_ID
                : extras.getInt(
                        AppWidgetManager.EXTRA_APPWIDGET_ID,
                        AppWidgetManager.INVALID_APPWIDGET_ID);
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        setContentView(R.layout.activity_countdown_config);
        hint = findViewById(R.id.config_hint);

        events.addAll(CountdownSelection.events(this));
        List<String> saved = Arrays.asList(CountdownSelection.read(this, appWidgetId));

        LinearLayout list = findViewById(R.id.config_list);
        if (events.isEmpty()) {
            hint.setText(R.string.widget_countdown_config_hint_empty);
            hint.setVisibility(View.VISIBLE);
        } else {
            // Sin elección previa, la más cercana aparece marcada: es lo que
            // el widget enseña por defecto y así se ve de dónde se parte.
            boolean fresh = saved.isEmpty();
            for (int i = 0; i < events.size(); i++) {
                CountdownSelection.Event event = events.get(i);
                list.addView(buildRow(event, fresh ? i == 0 : saved.contains(event.key)));
            }
        }

        findViewById(R.id.config_cancel).setOnClickListener(v -> finish());
        findViewById(R.id.config_save).setOnClickListener(v -> save());
    }

    /** Una fecha: casilla, título y cuándo cae. Toda la fila se puede tocar. */
    private LinearLayout buildRow(CountdownSelection.Event event, boolean checked) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, WidgetSupport.dp(this, 10), 0, WidgetSupport.dp(this, 10));

        CheckBox box = new CheckBox(this);
        box.setChecked(checked);
        box.setButtonTintList(ColorStateList.valueOf(getColor(R.color.widget_coral)));
        box.setOnCheckedChangeListener((button, isChecked) -> updateHint());
        boxes.add(box);

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams columnParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        columnParams.setMarginStart(WidgetSupport.dp(this, 4));
        column.setLayoutParams(columnParams);

        TextView title = new TextView(this);
        title.setText(event.title);
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(15);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        title.setMaxLines(1);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);

        TextView when = new TextView(this);
        when.setText(whenLabel(event));
        when.setTextColor(getColor(R.color.widget_text_muted));
        when.setTextSize(12);
        when.setMaxLines(1);

        column.addView(title);
        column.addView(when);

        row.addView(box);
        row.addView(column);

        row.setOnClickListener(v -> box.toggle());
        return row;
    }

    /** «227 días · 3 jul 2027», «hoy · 3 jul 2027» o «ya pasó». */
    private String whenLabel(CountdownSelection.Event event) {
        int days = WidgetSupport.daysUntil(event.date);
        String date = WidgetRenderer.formatShortDate(event.date);

        if (days == Integer.MIN_VALUE) return date;
        if (days == 0) return date.isEmpty()
                ? getString(R.string.widget_countdown_config_today)
                : getString(R.string.widget_countdown_config_today) + " · " + date;
        if (days < 0) return getString(R.string.widget_countdown_past);
        String label = getResources().getQuantityString(
                R.plurals.widget_countdown_config_days, days, days);
        return date.isEmpty() ? label : label + " · " + date;
    }

    /** Avisa al pasar de tres. El aviso de «sin fechas» no se pisa. */
    private void updateHint() {
        if (events.isEmpty()) return;
        boolean tooMany = numberOfSelected() > CountdownSelection.MAX;
        if (tooMany) hint.setText(R.string.widget_countdown_config_hint_max);
        hint.setVisibility(tooMany ? View.VISIBLE : View.GONE);
    }

    private int numberOfSelected() {
        int selected = 0;
        for (CheckBox box : boxes) if (box.isChecked()) selected++;
        return selected;
    }

    private void save() {
        List<String> keys = new ArrayList<>();
        for (int i = 0; i < boxes.size(); i++) {
            if (boxes.get(i).isChecked()) keys.add(events.get(i).key);
        }

        if (keys.size() > CountdownSelection.MAX) {
            hint.setText(R.string.widget_countdown_config_hint_max);
            hint.setVisibility(View.VISIBLE);
            return;
        }

        CountdownSelection.write(this, appWidgetId, keys);
        WidgetRenderer.refreshCountdowns(this);

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        setResult(RESULT_OK, result);
        finish();
    }
}
