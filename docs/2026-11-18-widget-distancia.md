# Ficha de diseño — Widget «Distancia»

## 1. Identificación

- **Nombre:** Distancia
- **Categoría:** Ubicación de pareja
- **Descripción:** Kilómetros que separan a los dos, con la última hora de cálculo.
- **Función principal:** Responder «¿a cuánto está?» sin abrir la app.
- **Datos que muestra:** distancia formateada, cuándo se supo, las dos caras.
- **Origen de los datos:** PersonalHub → `saveDistanceWidget` → `CapacitorStorage` (`widget_distance`).

## 2. Diseño visual

- **Estilo:** el mismo lenguaje que «Días juntos», con otro acento para distinguirlos de un vistazo.
- **Fondo:** degradado `#2A1A22 → #0F0F10` con borde coral al 22 %.
- **Color principal:** blanco (la cifra). **Secundario:** `#C9BBD1` (tiempo). **Acento:** coral `#C65A3A` y coral suave `#E59277`.
- **Radio:** 26 dp. **Sombras:** ninguna (RemoteViews no las pinta de forma fiable).
- **Iconografía:** las dos fotos circulares con aro claro.

### Versión pequeña (2×2)

- Vertical centrada: «ESTÁIS A» + cifra 30 sp. «abre la app» solo si no hay dato.

### Versión rectangular (4×2)

- Horizontal: barra coral, cifra 34 sp con el tiempo debajo y las dos caras de 46 dp a la derecha.

### Versión grande (4×3)

- Vertical: caras de 44 dp, «ESTÁIS A», cifra 40 sp y el tiempo de actualización.

## 3. Información y funcionamiento

- La cifra y la hora las escribe la app al calcular la distancia; el widget no consulta nada.
- La distancia caduca, así que aquí **siempre** se enseña cuándo se supo («ahora mismo», «hace 5 min», «hace 2 h»).
- Sin dato: «—» + «abre la app», sin caras.
- Si el permiso de ubicación está denegado, el widget no se rompe: se queda con el último valor y su hora.

## 4. Estados

| Estado | Comportamiento |
| --- | --- |
| Normal | Cifra, tiempo y caras. |
| Sin datos | «—» y «abre la app». |
| Cargando | Hueco con aro mientras baja el avatar; se repinta al terminar. |
| Error / sin red | Mantiene el último valor bueno con su hora. |
| Datos antiguos | «hace 12 h» o «abre la app para actualizar». |

## 5. Interacciones

- Toda la superficie abre el mapa (`com.heater64.personalhub://mapa`).

## 6. Verificación

- `npx vite build personal-hub` y `./gradlew assembleDebug`.
- Altura con fuente del sistema 1,0×, 1,3×, 1,5× y 2,0×: cabe en las tres composiciones; a partir de 1,7× se oculta la hora en la composición baja.
- Pendiente de probar en dispositivo real (render, no solo geometría).

## 7. Resultado final

- **Diseño aprobado:** pendiente de revisión del usuario.
- **Implementación terminada:** distancia en tres tamaños y composición adaptativa.
- **Observaciones:** la versión pequeña deja fuera las caras a propósito: a 2×2 competirían con la cifra. La cifra clave conserva su tamaño físico con la letra del sistema grande y, si el texto es muy largo («1234 km»), baja de cuerpo antes que recortarse.
