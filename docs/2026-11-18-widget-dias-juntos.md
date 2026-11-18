# Ficha de diseño — Widget «Días juntos»

## 1. Identificación

- **Nombre:** Días juntos
- **Categoría:** Contador de pareja
- **Descripción:** Cuántos días han pasado desde la fecha del aniversario.
- **Función principal:** Dar el dato de un vistazo, con los dos como parte del widget.
- **Datos que muestra:** total de días, desglose (años y meses), caras, antigüedad del dato.
- **Origen de los datos:** PersonalHub → `widgets.service.js` → `CapacitorStorage` (`widget_days`), leído por `WidgetRenderer`.

## 2. Diseño visual

### Identidad

- **Estilo:** minimalista, nativo, sin tarjetas dentro de tarjetas.
- **Fondo:** degradado `#2E1B35 → #0F0F10` con borde rosa al 18 %.
- **Color principal:** blanco `#FFFFFF` (el número).
- **Color secundario:** rosa `#F3C5D0` (etiqueta y unidad) y `#C9BBD1` (desglose).
- **Color de acento:** coral `#C65A3A` (barra del rectangular; coral suave `#E59277` para la frescura).
- **Tipografía:** la del sistema, `bold` en el número, `letter-spacing` amplio en la etiqueta.
- **Radio de esquinas:** 26 dp.
- **Sombras:** no se usan; RemoteViews no pinta sombras fiables y el borde ya separa del fondo.
- **Iconografía:** las dos fotos circulares con aro rosa.
- **Elementos decorativos:** solo la barra coral del tamaño rectangular.

### Versión pequeña (2×2)

- **Distribución:** vertical centrada.
- **Dato principal:** número de días (36 sp).
- **Información secundaria:** «DÍAS JUNTOS» (8 sp) encima.
- **Elementos visibles:** etiqueta y número; «abre la app» solo en estado vacío.
- **Comportamiento al pulsar:** abre `/juntos`.

### Versión rectangular (4×2)

- **Distribución:** horizontal; acento coral + columna de texto + caras.
- **Dato principal:** número (36 sp) con «días» al lado.
- **Información secundaria:** etiqueta y desglose («1 año y 4 meses»).
- **Elementos visibles:** dos caras de 46 dp solapadas 12 dp.
- **Comportamiento al pulsar:** abre `/juntos`.

### Versión grande (4×3)

- **Distribución:** vertical; caras arriba, número centrado, desglose debajo.
- **Dato principal:** número (44 sp) con «días».
- **Información secundaria:** caras, desglose y, si toca, «hace 2 días».
- **Elementos visibles:** caras de 44 dp, etiqueta, número y estado del dato.
- **Comportamiento al pulsar:** abre `/juntos`.

## 3. Información y funcionamiento

- El número se recalcula en el widget desde `since` (fecha del aniversario), así que sigue avanzando aunque la app no se abra.
- El desglose y las caras vienen del último paquete guardado por la app.
- Sin paquete guardado no se inventa ninguna cifra: «—» y «abre la app».
- La línea de frescura solo aparece cuando el paquete tiene más de un día.

## 4. Estados

| Estado | Comportamiento |
| --- | --- |
| Normal | Número, desglose y caras. |
| Sin datos | «—» y «abre la app»; sin caras ni desglose. |
| Cargando | Se pinta sin foto (hueco con aro) y se repinta al terminar la descarga. |
| Error | Si no hay red, el widget mantiene lo último bueno y no rompe el diseño. |
| Datos antiguos | «actualizado ayer», «hace N días» o «abre la app para actualizar». |

## 5. Interacciones

- Toda la superficie abre el aniversario (`com.heater64.personalhub://juntos`).
- No hay botones pequeños: el widget entero es el objetivo de pulsación.

## 6. Verificación

- `npx vite build personal-hub` — compila la web.
- `./gradlew assembleDebug` — compila el APK con los tres `appwidget-provider`.
- Altura de las tres composiciones con fuente del sistema 1,0×, 1,3×, 1,5× y 2,0× (`.freebuff-tmp/widget-fit-check.mjs`): caben todas; a partir de 1,3× se oculta «hace N días» y a partir de 1,7× el desglose de la composición baja.
- Pendiente de probar en dispositivo: colocación real en el launcher de Xiaomi y el render con la fuente grande (la comprobación anterior es geométrica, sobre los valores del XML).

## 7. Resultado final

- **Diseño aprobado:** pendiente de revisión del usuario.
- **Implementación terminada:** días juntos en tres tamaños, con composición adaptativa.
- **Pruebas realizadas:** compilación web y Android.
- **Observaciones:** la composición se elige por el hueco real (`getAppWidgetOptions`), no por el provider: un widget ya colocado en 4×2 se repinta apaisado y no se recorta. Si el launcher no devuelve el tamaño, se usa siempre la composición baja (el cuadrado solo para el provider pequeño, porque el apaisado no cabe en 110×110). Al redimensionar, `onAppWidgetOptionsChanged` vuelve a pintarlo. El desglose se calcula en el widget desde `since`, para que no se quede congelado si la app tarda en abrirse. El número conserva su tamaño físico con la letra del sistema al 130-150 %; las etiquetas sí crecen.
