# Inventario y resultados de la auditoría

**Actualizado:** 20 de noviembre de 2026  
**Alcance:** revisión estática del repositorio, pantalla de acceso en navegador, pruebas automatizadas y compilación local. No se inició sesión ni se accedió a Supabase desplegado.

## Referencia vigente

La planificación describe cuatro secciones principales para ambos usuarios: **Inicio, Rincón, Sentimientos y Perfil**. El panel de administración es un destino exclusivo del novio desde Perfil, no una quinta sección. El código conserva siete grupos temáticos dentro de las tarjetas de Rincón y Sentimientos; no se deben sustituir por el esquema antiguo de cuatro mundos Recuerdos/Rituales/Mi Salud/Juntos.

Todo el contenido compartido es visible para ambos. La única excepción general es la planificación personal de sorpresas y regalos. El ciclo menstrual también se comparte según los documentos 03 y 09; cada persona conserva la escritura y el borrado de sus propios registros. El documento 02 se actualizó para expresar la excepción de privacidad.

## Cambios hechos en este recorrido

| ID | Cambio | Estado local | Pendiente |
|---|---|---|---|
| AUD-01 | Las cuatro pestañas inferiores ahora son iguales para ambos roles; `/admin` deja de ocupar una pestaña y se alcanza desde Perfil. El administrador entra en Inicio. | Implementado y cubierto por `tests/routes-registry.test.js`. | Verificarlo con ambas cuentas y en móvil/escritorio. |
| AUD-02 | Se quitó la carga automática del catálogo de regalos al importar `gifts.service.js`; el catálogo se carga desde las funciones que lo necesitan. | Implementado; la pantalla de acceso ya no dispara esa lectura por el mero import del servicio. | Confirmar el log de arranque con el servidor local tras el cambio. |
| AUD-03 | Inicio ya incluye dos tarjetas de ánimo con autoría diferenciada y una tarjeta de próxima fecha. | Implementado en la interfaz y compilado. | Requiere aplicar la migración 033 y comprobar lectura cruzada desde ambas sesiones. |
| AUD-04 | El servicio del ciclo consulta directamente los registros de la pareja; la pantalla elimina el control de compartir campos. | Implementado localmente junto con la migración 033. | Aplicar en un entorno de prueba y comprobar lectura, escritura y borrado propios con ambas cuentas. |
| AUD-05 | La migración local 033 agrega acceso de lectura cruzada solo si hay exactamente dos perfiles habilitados con roles `admin` y `user`; el resto de las acciones sigue siendo propio. | Archivo creado y listado en `sql/README.md`. | Revisar el SQL en Supabase de prueba; no está aplicado. |
| AUD-06 | La auditoría ahora permite correcciones locales y migraciones revisables, pero mantiene fuera la ejecución en servicios desplegados. | Documento 14 actualizado. | Ninguno. |
| AUD-07 | El modo nuevo de Tamp debe iniciar en oscuro Umbra. | `theme.service.js` usa ahora modo `dark` si no hay preferencia guardada; las preferencias previas se conservan. | Revisar el contraste y el aspecto de las pantallas interiores en ambos temas. |

## Inventario de navegación y módulos

| Sección o destino | Ubicación actual | Estado respecto a la planificación |
|---|---|---|
| Inicio `/` | `Home.js`; saludo, contador, estados, accesos, fechas, mapa, contenido destacado, widgets. | La estructura común ya está; se completó localmente la tarjeta del ánimo de ambos. El orden visual completo aún no coincide con el orden recomendado. |
| Rincón `/rincon` | Tarjetas agrupadas en los siete grupos definidos en `mundos.data.js`; rutas para galería, memes, audios, Minecraft, curiosidades, juegos, canciones, series, Those Eyes y OsitosWorld. | Los módulos existen. Falta verificar visualmente los flujos autenticados y revisar la ubicación de Just The Way You Are, que aún es una ruta independiente. |
| Sentimientos `/sentimientos` | Ánimo, Razones, Open When, Mal Día, Menstruación y el calendario actual de regalos. | Hay funciones existentes; el calendario compartido de planes y la planificación privada de sorpresas siguen sin ser áreas separadas. |
| Perfil `/perfil` | Perfil y ajustes; el administrador ya tiene un acceso al panel desde esta pantalla. | Es el acceso acordado para Admin. Exportación y borrado completos siguen pendientes de especificación/implementación. |
| Admin `/admin` | Gestión de contenido, multimedia, usuarios, ánimo, notificaciones y actividad. | Ruta exclusiva; no forma parte de la barra principal. Se debe probar con rol admin. |
| Mapa `/mapa` y Juntos `/juntos` | Destinos a pantalla completa enlazados desde Inicio y widgets. | Mantener como destinos funcionales; comprobar permisos, estados vacíos y Android. |

## Hallazgos pendientes priorizados

| ID | Hallazgo confirmado en el repositorio | Prioridad | Próximo paso |
|---|---|---|---|
| PEND-01 | Las cargas de Galería, Memes y Audios usan Supabase Storage; no hay un endpoint Cloudinary de carga firmado en `api/`. Los límites tampoco coinciden con `08-multimedia.md`, y no aparecen PDF ni carga múltiple hasta 10 archivos. | P1 | Diseñar y probar una API de carga segura compatible con los medios existentes, progreso, cancelación y reintento. No borrar ni reubicar archivos actuales. |
| PEND-02 | `/calendario` es el calendario de regalos virtuales que ya existe. No se encontró una vista de calendario compartido para citas/planes ni una planificación privada individual para regalos sorpresa. | P1 | Crear módulos y almacenamiento separados; conservar el contenido y las respuestas del calendario actual mientras se define su destino. |
| PEND-03 | El Inicio tiene una portada de fotos configurable desde la propia portada y destacados diarios de meme, mensaje, serie y canción. No hay un recuerdo destacado elegido desde Galería con la regla de no repetir varios días. | P1 | Añadir selección compartida desde Galería y una tarjeta de recuerdo con estados vacío y sin foto. |
| PEND-04 | La política histórica `019_aislamiento_verificado.sql` restringe la lectura de ánimo. El código local ya ofrece lectura cruzada y existe la migración 033, pero la base desplegada no se ha comprobado. | P1 | Aplicar en entorno de prueba y probar las dos cuentas; confirmar que cada persona no puede editar ni borrar el registro de la otra. |
| PEND-05 | El ciclo usaba el RPC opcional `cycle_partner_snapshot` y ajustes de campos compartidos. El cliente local ya usa lectura directa con la nueva política, pero la migración no está desplegada y los datos reales no se consultaron. | P1 | Probar con ambas cuentas en base de prueba y revisar los permisos de lectura/escritura antes de aplicarlo a producción. |
| PEND-06 | La pantalla de Inicio tiene contenido adicional (mapa, series, “Un año como hoy” y destacados diarios) que altera el orden recomendado y puede saturar móvil. | P2 | Reordenar después de verificar los bloques y fijar jerarquía móvil/escritorio con datos reales. |
| PEND-07 | No se pudo revisar la web autenticada, la vista móvil real, los permisos del backend desplegado ni la experiencia de la segunda cuenta. | Bloqueo de verificación | Repetir recorrido con sesiones de ambas cuentas; el acceso a credenciales no debe copiarse ni exponerse en el informe. |
| PEND-08 | La compilación crea bundles grandes para algunas áreas, especialmente canciones, Rincón y Admin, pese a que las rutas usan carga diferida. | P2 | Medir navegación real y revisar importaciones estáticas compartidas antes de optimizar. |

## Revisión visual y técnica realizada

- La pantalla `/login` se abrió en el navegador local a 1280 × 720. Se observó el formulario centrado, campos etiquetados, acceso a recuperación y enlace para saltar al contenido. No se inició sesión ni se usaron credenciales.
- Antes de retirar la carga automática de regalos, Vite registró una lectura de `content` rechazada por permisos antes del inicio de sesión. El cambio elimina la consulta en tiempo de importación; falta repetir la comprobación visual y de consola.
- `node --test tests/routes-registry.test.js`: 9/9 pruebas correctas.
- `npm test`: 374/374 pruebas correctas.
- `npm run build`: compilación correcta; Vite transformó 223 módulos.
- No se aplicó ninguna migración, no se modificaron datos desplegados y no se inició sesión.

## Actualización de la auditoría

- La nueva versión de Tamp está aislada en `tamp/` para revisión antes de sustituir la app actual.
- El calendario compartido, Mal Día y Mis sorpresas ya tienen pantallas separadas, sincronización mediante `tamp_entries`, control de autoría y papelera de 30 días.
- `036_tamp_media.sql` y `api/tamp-media.js` preparan archivos con Cloudinary autenticado, límites por tipo y referencias protegidas.
- La compilación `npm run build:tamp` y las 20 pruebas específicas de Tamp pasan localmente.
- Siguen pendientes la aplicación de migraciones en Supabase de prueba y la conexión visual del selector de galería con la API de archivos.

## Criterios para cerrar esta auditoría

1. Completar el recorrido de todas las rutas principales con ambos roles en móvil y escritorio.
2. Validar con sesiones reales los permisos de ánimo, Mal Día, ciclo, calendario, medios y sorpresas.
3. Completar los flujos de calendario compartido y planificación privada, multimedia Cloudinary y recuerdo destacado.
4. Probar sincronización, estados sin conexión, PWA y widgets Android relacionados.
5. Mantener este documento actualizado con evidencia, pruebas y pendientes reales; no marcar cambios de backend como resueltos hasta probarlos en un entorno de Supabase.
