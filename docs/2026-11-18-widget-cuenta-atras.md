# Ficha de diseño — Widget «Cuenta atrás»

## 1. Identificación

- **Nombre:** Cuenta atrás
- **Categoría:** Fechas especiales
- **Descripción:** Cuántos días faltan para la próxima fecha del panel.
- **Función principal:** Saber cuánto queda y para qué, sin abrir la app.
- **Datos que muestra:** días restantes, título de la fecha, día concreto.
- **Origen de los datos:** PersonalHub → `upcomingSpecialDates(6)` → `saveCountdownWidget` → `CapacitorStorage` (`widget_countdown`). La elección de cada instancia vive aparte, en `widget_countdown_selection` (nativa, por `appWidgetId`).

## 2. Diseño visual

- **Estilo:** el de la familia, con acento coral.
- **Fondo:** degradado `#2C1B22 → #0F0F10` con borde coral al 19 %.
- **Principal:** blanco. **Secundario:** rosa `#F3C5D0` («días»). **Acento:** coral `#C65A3A` (barra del rectangular) y coral suave (etiquetas).
- **Radio:** 26 dp. **Sombras:** ninguna (limitación de RemoteViews).
- **Iconografía:** ninguna; aquí el dato es el día.

### Pequeña (2×2)

- Título (8 sp, recortado si es largo) y número 34 sp con «días». Sin fecha.

### Rectangular (4×2)

- Barra coral + columna: título, número 36 sp con «días» y fecha («3 jul 2026»).

### Grande (4×3)

- «FALTAN», número 48 sp con «días», título de la fecha y día concreto, centrados.

### Grande con varias fechas (4×3)

- Con dos o tres elegidas, el número gigante deja paso a una fila por fecha:
  título, día concreto y días que faltan (20 sp). Las filas comparten altura,
  así el widget no cambia de tamaño al añadir una fecha.
- Con la letra del sistema grande se oculta la línea del día concreto para que
  las tres filas sigan cabiendo.

## 3. Información y funcionamiento

- **Qué fechas:** al colocar el widget, Android abre su configuración
  (`CountdownWidgetConfigActivity`) con las próximas fechas: se pueden marcar
  hasta tres. La elección es de cada instancia, así que dos widgets pueden
  enseñar fechas distintas. Para cambiarla después, se reconfigura desde el
  launcher (la ficha lleva `widgetFeatures="reconfigurable"`).
- **Sin elegir nada** se enseña solo la más cercana, que es lo que hacía el
  widget antes de poder elegir: actualizar la app no cambia los ya colocados.
- En pequeño y apaisado manda la primera fecha elegida (la más cercana).
- El widget calcula los días desde `date`, así la cuenta baja sola aunque la app no se abra.
- **Hoy:** el número pasa a «hoy» y se oculta «días» (no tiene sentido «hoy días»).
- **Fecha pasada:** «—» y «ya pasó»; no se inventa la siguiente fecha (la app la envía al abrirse).
- **Sin fechas:** «—» y «sin fechas próximas».
- La fecha se pinta con meses en español sin depender del idioma del móvil.

## 4. Estados

| Estado | Comportamiento |
| --- | --- |
| Normal | Número, título y fecha. |
| Hoy | «hoy» en el hueco del número, sin «días». |
| Sin datos | «—» + «sin fechas próximas». |
| Fecha pasada | «—» + «ya pasó». |
| Fuente grande | El número mantiene su caja; al 170 % se oculta la fecha en la composición baja. |

## 5. Interacciones

- Toda la superficie abre `/calendario`.

## 6. Verificación

- Compilación web y Android.
- Comprobación geométrica de las tres composiciones a 1,0× / 1,3× / 1,5× / 2,0× de fuente.
- Pendiente de probar en dispositivo real.

## 7. Resultado final

- **Diseño aprobado:** pendiente de revisión.
- **Implementación terminada:** tres tamaños con composición adaptativa.
