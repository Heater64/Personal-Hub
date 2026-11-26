# Auditoría y mejora integral de Tamp

## Objetivo

Recorrer las rutas, pestañas, tarjetas y acciones visibles de Tamp desde las cuentas de Peluche y Princesa, corregir fallos funcionales dentro de los permisos previstos y elevar las pantallas con peor presentación hacia el estilo Umbra tomando como referencia las hojas de detalle, superficies limpias y jerarquía visual de Sentimientos.

## Criterios

- Mantener cada cambio en `tamp/` y conservar el modelo actual de permisos; compartir visualización no implica habilitar escrituras ajenas.
- No alterar contenido ni flujos que ya funcionan solo por uniformidad estética.
- Priorizar una pantalla o flujo completo por iteración: inspección, corrección, compilación y comprobación visual.
- Revisar móvil y escritorio, ambos temas cuando la vista use los tokens globales, estados vacíos/carga/error y navegación teclado.
- Dejar evidencia de las rutas y roles efectivamente comprobados; señalar cualquier cuenta/dispositivo al que no se haya podido acceder.

## Fases

1. **Mapa y recorrido**: registrar rutas raíz, rutas hijas, tabs y grupos de tarjetas; identificar qué se ve y qué acciones corresponden a cada rol.
2. **Base visual compartida**: detectar inconsistencias en cabeceras, tarjetas, hojas, listas y controles comunes. Corregir componentes globales solo cuando el arreglo beneficie a las pantallas sin perjudicar sus patrones propios.
3. **Rutas principales**: Inicio, Rincón, Sentimientos y Perfil; revisar acciones, navegación, carga de contenido y responsive.
4. **Rutas de contenido**: Calendario, Agenda, Razones, Mal Día, Open When, Menstruación, Sorpresas, Galería/Memes, Audios, Curiosidades, Canciones, Series y juegos; reparar los flujos que fallen por rol y mejorar las vistas con peor legibilidad/jerarquía.
5. **Verificación por rol y viewport**: comprobar entradas disponibles, botones y navegación en los dos roles usando sesiones legítimas disponibles; revisar 360, 390, 768 y escritorio; compilar Tamp al final de cada bloque.

## Registro de hallazgos

| Estado | Ruta / componente | Rol | Hallazgo y acción |
|---|---|---|---|
| Corregido | Sentimientos / calendario | Ambos | Añadido selector Peluche/Princesa y detalle por día con todos los registros, horas y contador de cambios. Verificado localmente para ambos estados de ánimo. |
| Corregido | Perfil / días especiales | Ambos | Fechas inválidas mostraban “Invalid Date”; ahora se conservan visibles como “Fecha por revisar” para que Peluche pueda corregirlas desde el editor. |
| Corregido | Menstruación compartida e historial | Ambos | Duraciones fuera de rango (p. ej. fechas con 189 días) ya no se presentan como duraciones válidas; ciclo retrasado anuncia retraso y la nueva estimación. Datos guardados intactos. |
| Corregido | Mal Día | Ambos | El toolbar enseñaba un selector mensual sin calendario ni filtro. Se oculta navegación de fechas que no aplica y se conserva “Actualizar”. |
| Corregido | Ruta antigua `/agenda` | Ambos | La cabecera decía “Agenda compartida” mientras el contenido decía “Calendario”; etiqueta y título ahora coinciden. |
| Corregido | Rincón / Galería | Ambos | Las tarjetas de álbum aparecían transparentes si el binding de animación no llegaba a activarse. Se muestran desde el primer render y el enlace de apertura/búsqueda sigue activo. Verificados los seis álbumes en localhost. |

## Comprobación realizada en esta sesión

- Se recorrieron 23 rutas navegables de la cuenta disponible (Peluche/admin) en el navegador integrado: Inicio, Rincón, Galería, Memes, Audios, Minecraft, Curiosidades, Canciones, Razones, Sentimientos, Juegos, Juntos, Mapa, Calendario, Mal Día, Sorpresas, Menstruación, Open When, Series, Those Eyes, Just The Way You Are, Ositos World y Perfil.
- Las cargas iniciales que mostraban “Cargando…” fueron revisadas tras la espera: Razones, Series, Menstruación, Sorpresas y Mapa cargaron o explicaron el permiso faltante. No aparecieron errores de consola en esas rutas.
- La sesión de navegador disponible corresponde a Peluche/admin; el segundo inicio de sesión/dispositivo no estuvo disponible. La vista de estados de ánimo sí fue comprobada para Peluche y Princesa usando el selector compartido.
- Verificación final: `npm run build:tamp` pasa; ESLint en los archivos tocados de esta ronda termina con cero errores y nueve avisos `no-unused-vars`.

## Límites de esta revisión

- No publicar ni desplegar cambios, no cambiar datos reales y no crear una APK nueva sin petición expresa.
- Si un flujo requiere una cuenta, contraseña o dispositivo que no está disponible, verificar el código y la ruta navegable sin asumir que el comportamiento remoto quedó probado.

---

# Mejora: check-in diario de sueño

## Objetivo

Añadir al primer acceso diario de Princesa una pregunta sobre la calidad del sueño, guardada en el diario existente y visible a Peluche solo mediante el permiso explícito de compartir. Corregir también la comprobación diaria al volver de segundo plano.

## Decisiones

- Reutilizar `cycle_daily_logs.sleep_quality`, sin guardar el sueño en la tabla de estados de ánimo.
- Añadir `sleep_prompt_completed` para sincronizar en los dos dispositivos la respuesta o el «Más tarde» y evitar repetir la pregunta durante el mismo día.
- Mantener el filtrado del RPC de pareja; el nuevo campo solo viajará cuando Princesa lo incluya en `shared_fields`.
- El check-in de ánimo se sigue mostrando solo si no hay ánimo para hoy; en el navegador local ya existe uno, por eso no apareció en esta sesión.
- Revalidar la bienvenida al volver de segundo plano (Android) o al recuperar visibilidad (web).

## Tareas

1. Añadir la migración SQL idempotente para el marcador del check-in y el campo de sueño compartible.
2. Persistir y leer el check-in diario mediante el servicio de ciclo, conservando cualquier otro dato del día.
3. Implementar la pantalla de sueño y encadenarla tras Sentimientos; «Más tarde» también se sincroniza como completado.
4. Añadir sueño al selector de campos compartidos y renderizarlo solo desde el snapshot autorizado.
5. Verificar el flujo en localhost y compilar; aplicar la migración SQL en Supabase antes de depender de sincronización/compartición en producción.
