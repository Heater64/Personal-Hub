# Inventario y rediseño de pantallas

**Estado: En progreso.** Inventario derivado de `tamp/src/routes.js` y `main.js`; el acceso visual autenticado está pendiente en la sesión actual.

| Ruta                                                           | Pantalla/área        | Acceso y relación                         | Estado de revisión                                                                                             |
| -------------------------------------------------------------- | -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/login`                                                       | Inicio de sesión     | Pública, sin navegación                   | Vista en navegador; móvil/errores pendiente                                                                    |
| `/`                                                            | Inicio               | Raíz, pestaña                             | Vista y navegación autenticada observadas en escritorio; revisión de controles pendiente                       |
| `/perfil`                                                      | Perfil               | Raíz, pestaña                             | Evidencia previa parcial; sesión actual pendiente                                                              |
| `/admin`                                                       | Administración       | Solo admin                                | Evidencia previa; repaso integral pendiente                                                                    |
| `/rincon`                                                      | Rincón               | Raíz, pestaña                             | Vista y scroll restaurado; fallback de imagen corregido y recargado; resto de estados pendiente                |
| `/galeria`, `/memes`, `/audios`, `/minecraft`, `/curiosidades` | Contenido del Rincón | Hijas; algunas con subvista/query         | Recorrido previo reportado; controles y estados pendientes                                                     |
| `/canciones`                                                   | Música               | Hija de Rincón; vistas `?v=`              | Recorrido anterior reportado; flujo de pestañas pendiente                                                      |
| `/sentimientos`                                                | Sentimientos         | Raíz, pestaña                             | Vista y navegación Atrás observadas; controles de emoción no se cambiaron                                      |
| `/sentimientos/historial`                                      | Historial emocional  | Hija de Sentimientos                      | Inventario estático; revisión visual pendiente                                                                 |
| `/razones`                                                     | Razones              | Hija de Sentimientos                      | Recorrido previo reportado; estados pendiente                                                                  |
| `/juegos`                                                      | Juegos               | Hija de Rincón                            | Recorrido previo reportado; controles pendiente                                                                |
| `/juegos/online/:gameId`                                       | Partida online       | Ruta dinámica, hija de Juegos             | Recorrido de partida pendiente                                                                                 |
| `/juntos`                                                      | Juntos               | Pantalla completa; deep link/widget       | Recorrido previo reportado; deep link en dispositivo pendiente                                                 |
| `/mapa`                                                        | Ubicación            | Pantalla completa; deep link/widget       | Recorrido previo reportado; permisos/dispositivo pendiente                                                     |
| `/calendario`, `/agenda`                                       | Calendario           | Sección Sentimientos; legado en `/agenda` | Fix previo reportado; vistas/acciones pendientes                                                               |
| `/maldia`                                                      | Mal Día              | Pantalla completa                         | Fix previo reportado; conversación/estados pendientes                                                          |
| `/sorpresas`                                                   | Sorpresas/Regalos    | Hija de Sentimientos                      | Recorrido previo reportado; CRUD completo pendiente                                                            |
| `/menstruacion`                                                | Bienestar/Ciclo      | Hija de Sentimientos                      | Recorrido previo reportado; dos perfiles y permisos pendientes                                                 |
| `/openwhen`                                                    | Open When            | Hija de Sentimientos                      | Recorrido previo reportado; draft/roles pendiente                                                              |
| `/series`                                                      | Series               | Hija de Rincón                            | Inicio y Biblioteca observados; pestaña Biblioteca se conserva al salir/volver; CRUD y demás vistas pendientes |
| `/thoseeyes`                                                   | Those Eyes           | Hija de Rincón                            | Recorrido previo reportado; juego/teclado pendiente                                                            |
| `/justthewayyouare`                                            | Just The Way You Are | Ruta independiente sin pestaña            | Recorrido previo reportado; teclado pendiente                                                                  |
| `/ositos`                                                      | OsitosWorld          | Hija de Rincón; identidad visual propia   | Recorrido previo reportado; dispositivo/controles pendiente                                                    |

## Superficies transversales a revisar

Cabecera móvil y botón Volver; barra inferior y sidebar; búsqueda global; reproductor; invitaciones de juego; bienvenida/check-in de ánimo y sueño; hojas de eventos; visor multimedia; widgets sheet; toasts; skeletons; confirmaciones; formularios compartidos; avisos de red y permisos.

## Cobertura

El inventario suma 28 rutas registradas (incluida la ruta dinámica). La auditoría previa documenta un recorrido del rol admin por 23 rutas navegables. Esta sesión añade revisión visual de cuatro pantallas. No se interpreta que “ruta abierta” signifique que se probaron todos sus controles o estados. Faltan la revisión exhaustiva por pantalla, la sesión de usuario no-admin y el recorrido móvil responsive.
