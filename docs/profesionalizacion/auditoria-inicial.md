# Auditoría inicial UX/UI

**Estado: En progreso** · Fecha de línea base: 2026-11-26

## Alcance y método

- Inspección estática de las rutas registradas, shell, navegación inferior/lateral, router, tokens, estilos globales, integración de Capacitor y actividad Android.
- Arranque local mediante Vite (`http://127.0.0.1:5176/`) e inspección visual/accesible de la pantalla de inicio de sesión.
- Revisión de la auditoría reciente ya guardada en `tasks/plan.md` y `tasks/todo.md`; se reutiliza como evidencia anterior, no como sustituto de la revisión en curso.
- Build y suite automatizada ejecutados el 2026-11-26 como línea base. Los resultados están en [Rendimiento](rendimiento.md) y [Matriz de pruebas](pruebas.md).

## Evidencia observada

| ID   | Severidad | Hallazgo                                                                                                                                                                                                                           | Estado/evidencia                                                                                                                                                                                                                                           |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | P1        | La carga inicial mostró `/login`; al recuperar el estado de la pestaña integrada apareció una sesión ya autenticada de Peluche. No se introdujeron credenciales.                                                                   | Mitigado para inspección de lectura del perfil admin: Inicio, Rincón, Sentimientos y Series se vieron en navegador de escritorio. Perfil no-admin y dispositivo siguen pendientes.                                                                         |
| A-02 | P1        | No hay dispositivos visibles por ADB (`adb devices -l` no devolvió dispositivos).                                                                                                                                                  | Bloqueada la verificación en Android físico, APK instalada y ciclo de vida real.                                                                                                                                                                           |
| A-03 | P2        | La navegación declara cuatro pestañas (`BOTTOM_NAV_PATHS`), pero el comentario de `BottomNav.js` aún dice “5 secciones”.                                                                                                           | Hallazgo estático confirmado; corregir comentario en una tarea de limpieza separada si sigue vigente tras revisar la navegación visual.                                                                                                                    |
| A-04 | P2        | La auditoría anterior reporta 23 rutas visitadas con el rol admin y deja controles y responsive incompletos. En esta sesión se revisaron visualmente Inicio, Rincón, Sentimientos y Series; no se activaron acciones de escritura. | Auditoría integral todavía en progreso.                                                                                                                                                                                                                    |
| A-05 | P2        | El build divide el código por pantalla; aun así, algunos chunks diferidos son grandes (Admin 210,84 kB, Canciones 226,73 kB, Supabase 223,48 kB antes de gzip).                                                                    | Tamaños de artefacto confirmados; impacto en tiempo de uso real no medido.                                                                                                                                                                                 |
| A-06 | P2        | La shell usa un registro de rutas centralizado, memoria de scroll, historial de overlays, safe areas, reduced-motion y manejo nativo de Atrás.                                                                                     | Existe en código; comportamiento aún requiere recorridos visuales y dispositivo.                                                                                                                                                                           |
| A-07 | P3        | En la tarjeta de continuación de Series dentro de Rincón, la zona de imagen de Dragon Ball Super se veía como un bloque vacío; la portada sí cargaba dentro de la videoteca.                                                       | Tras corregir el manejo de error de imagen, Rincón y la pantalla Inicio se recargaron y montaron correctamente. El caso visual quedó mitigado; no se cambió contenido.                                                                                     |
| A-08 | P2        | El listener global de error retiraba imágenes durante la fase de captura, antes de que corrieran manejadores inline que accedían al elemento hermano; el acceso nulo podía lanzar una excepción y dejar el fallback vacío.         | Corregido en `tamp/src/utils/imageReveal.js`: la retirada se aplaza hasta el fin del evento, y fallbacks conocidos se muestran directamente. Regresión añadida a `tests/web-accessibility.test.js`; suite completa y recarga visual posteriores correctas. |

## Evaluación de la pantalla pública observada

- Acceso oscuro con acento coral, marca y jerarquía clara; campos rotulados y botón para mostrar/ocultar contraseña presentes en el árbol accesible.
- El texto de marca se lee correctamente y no se observó desbordamiento en la captura de escritorio.
- No se pudo verificar teclado móvil, foco con lector de pantalla, recuperación de sesión ni respuesta a errores de acceso sin enviar credenciales.

## Recorridos de lectura en navegador

- La vista de Inicio autenticada y las secciones Rincón, Sentimientos y Series montaron en escritorio.
- Al desplazarse al final de Rincón, cambiar a Inicio y volver a Rincón, la posición de scroll se restauró.
- El botón Atrás del navegador volvió de Sentimientos a Rincón.
- La pestaña Biblioteca de Series permaneció seleccionada después de navegar a Rincón y volver a Series.
- Tras la corrección del listener de imágenes, Rincón y luego Inicio se recargaron correctamente en la sesión existente; ya no se observó el fallo de acceso a `.style` del fallback. La revisión visual posterior no cubrió todas las imágenes fallidas ni estados de red.
- No se probaron acciones que escriban datos, controles de permisos, ni formularios con información personal.

## Fuentes de auditoría anterior

`tasks/plan.md` registra correcciones concretas sobre Sentimientos/calendario, Perfil, Mal Día, Galería y `/agenda`, además de una compilación. `tasks/todo.md` marca como pendientes la sesión real del segundo perfil, controles detallados y responsive completo. Se debe preservar ese trabajo y reconciliarlo con los resultados nuevos antes de dar por cerradas pantallas.

## Prioridad inicial

1. Conseguir una sesión legítima de prueba de cada perfil y recorrer pantallas/acciones sin cambiar permisos ni contenido real.
2. Verificar móvil Android con dispositivo conectado; hasta entonces, avanzar con revisión estática, build y navegador responsive cuando la herramienta disponible permita fijar viewport.
3. Mapear estados de carga, error, vacío y datos reales en cada pantalla.
4. Corregir hallazgos confirmados en incrementos pequeños y anotar evidencia después de cada cambio.
