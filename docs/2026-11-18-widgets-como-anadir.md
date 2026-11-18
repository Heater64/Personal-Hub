# Cómo añadir un widget nuevo

Pasos que ya siguen los cuatro widgets actuales. Copiar el orden evita que uno
se quede con diseño, estados o comportamiento distintos.

1. **Datos** — `widgets.service.js`: `KEY_<WIDGET>`, `save<Widget>Widget(...)` que
   escribe el JSON en `CapacitorStorage` y llama a `refreshWidgets()`. Solo datos
   reales; nada inventado para rellenar el hueco.
2. **Persistencia** — la pantalla dueña del dato llama al `save` al montar y cada
   vez que el dato cambia (store, callback o servicio). Nunca desde el widget.
3. **Layouts** — tres composiciones propias: `_compact` (2×2), `_rect` (4×2) y
   grande (4×3). Etiquetas fijas en el XML; datos y visibilidades en Java.
4. **Recursos** — fondo con la paleta (`#0F0F10`, `#25172A`, `#C65A3A`, `#F3C5D0`),
   `strings.xml` con las cuatro descripciones y los textos de estado vacío.
5. **Providers** — tres clases `AppWidgetProvider` con `onAppWidgetOptionsChanged`
   y tres `appwidget-provider` con `targetCellWidth/Height` y `previewLayout`.
6. **Renderer** — `render<Widget>(...)` con:
   - composición elegida por `getAppWidgetOptions` (sin tamaño → **la baja**),
   - número anclado con `pinnedSp` y medido con `fitSp`,
   - estado vacío explícito y línea de frescura si el dato caduca.
7. **Puente y manifiesto** — `WidgetBridgePlugin.PROVIDERS`, `providerFor()` y los
   seis `receiver` con `exported="true"`.
8. **Hoja de widgets** — entrada en `WidgetsSheet.js` con sus tres tamaños y
   miniaturas con los mismos px que dp del widget.
9. **Navegación** — el toque abre la sección correspondiente por deep link.
10. **Verificación** — `node .freebuff-tmp/widget-fit-check.mjs` (alturas a 1,0×,
    1,3×, 1,5× y 2,0×), `npx eslint`, `npx vite build` y `./gradlew assembleDebug`.
11. **Cambio de día** — `WidgetDayChangeReceiver` ya repinta todos los widgets en
    `DATE_CHANGED`, `TIME_SET`, `TIMEZONE_CHANGED` y `LOCALE_CHANGED`. Regla: en el
    payload va la fecha cruda (`yyyy-MM-dd`), nunca el texto «hoy»/«ayer»; lo
    decide el renderer al pintar, o el widget mentirá hasta el día siguiente.

Regla que no se negocia: **cada tamaño es una composición**, no el grande
encogido, y el estado vacío nunca deja el widget en blanco.

## Qué widgets hay

| Widget | Tamaños | Paquete |
|---|---|---|
| Días juntos | 2×2, 4×2, 4×3 | `widget_days` |
| Distancia | 2×2, 4×2, 4×3 | `widget_distance` (+ `device`: batería y red de ella) |
| Cuenta atrás | 2×2, 4×2, 4×3 | `widget_countdown` (+ elección de fechas por instancia) |
| Ánimo | 2×2, 4×2, 4×3 | `widget_mood` (solo el de ella) |
| Ciclo | 2×2, 4×2, 4×3 | `widget_cycle` |
| Seguir viendo | 2×2, 4×2, 4×3 | `widget_watching` |
| Sorpresas | 2×2, 4×2, 4×3 | `widget_gifts` |

## Herramientas

- `node tools/widget-previews.mjs` — genera los PNG de vista previa por tamaño
  (`drawable-nodpi`) y deja las fichas apuntando a `previewImage`.
- `node tools/sync-widget-tokens.mjs` — copia la paleta del bloque `widget-tokens`
  de `home.css` a `widget_colors.xml`.
- `node .freebuff-tmp/widget-fit-check.mjs` — alturas de las doce composiciones
  originales a 1,0×, 1,3×, 1,5× y 2,0×.
