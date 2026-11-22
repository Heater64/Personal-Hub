# 14. Método para auditar y mejorar la web

## Objetivo

Revisar la aplicación actual de forma ordenada y convertir los objetivos acordados para Tamp en mejoras pequeñas, comprobables y seguras. La auditoría debe indicar qué funciona, qué falta, qué contradice la planificación y qué conviene hacer primero. Se pueden corregir el código, los documentos y las migraciones locales. Los cambios de datos o servicios desplegados se verifican y preparan, pero no se ejecutan sin una instrucción específica.

## Regla principal

La planificación define el resultado esperado; el código, la web ejecutándose y las cuentas disponibles sirven para comprobar el estado real. Antes de modificar una función se registra la diferencia entre ambos. Si varios documentos parecen contradecirse, prevalece la decisión específica del módulo cuando confirma una excepción; los conflictos reales se dejan pendientes sin inventar una respuesta ni migrar información.

## Fase 0: fijar el alcance

1. Confirmar que se audita la aplicación actual del repositorio y sus experiencias web y Android relacionadas.
2. Usar como referencia los documentos 01–13 y anotar decisiones que estén en conflicto o pendientes.
3. Separar tres tipos de trabajo:
   - **Mejora de la web actual:** reparar, simplificar o completar lo que ya existe.
   - **Cambio de producto:** necesita una decisión escrita si altera permisos, privacidad, navegación o comportamiento.
   - **Idea futura:** se registra, pero no entra en el trabajo actual.
4. No borrar módulos, cuentas ni contenido. Las migraciones se pueden crear y revisar localmente, pero no aplicar al proyecto desplegado durante la auditoría.

### Conflictos que deben comprobarse al comenzar

- La visión plantea español como único idioma; conversaciones y referencias anteriores mencionaron español, inglés y ruso.
- El documento 02 ya recoge la excepción de sorpresas privadas confirmada en navegación, usuarios y funciones.
- La planificación de Tamp describe una aplicación privada para dos personas; el README del código todavía describe la estructura y los nombres actuales de PersonalHub.
- Hay que verificar si las tareas de rediseño Umbra y los widgets descritos en `docs/` ya están reflejados en la planificación vigente.

Estos puntos no impiden revisar el resto de la web; se dejan bloqueados solo los cambios que dependan de su resolución.

## Fase 1: crear el inventario real

Recorrer la navegación como administrador y como usuaria, en móvil y escritorio. Registrar para cada pantalla o módulo:

| Dato | Qué anotar |
|---|---|
| Pantalla | Nombre, ruta y mundo al que pertenece |
| Acceso | Desde qué menú o acción se llega |
| Roles | Qué puede ver, crear, editar y borrar cada cuenta |
| Contenido | Qué muestra, de dónde salen los datos y si se sincronizan |
| Estados | Carga, vacío, error, sin conexión y contenido existente |
| Presentación | Captura móvil y escritorio, tema claro/oscuro si aplica |
| Resultado | Funciona, funciona con problemas, falta o no se puede verificar |

La lista inicial se contrasta con las páginas, rutas, componentes y servicios del repositorio. Si una pantalla documentada no aparece o existe una pantalla no documentada, se apunta en ambos sentidos.

## Fase 2: revisar cada módulo con la misma ficha

Usar la plantilla de pantalla y acción de `12-plantillas.md`. Para cada flujo habitual:

1. Empezar desde el lugar donde lo encontraría una persona que no conoce la app.
2. Completar el flujo principal con las dos cuentas cuando haya permisos diferentes.
3. Comprobar volver, cancelar, confirmar, recargar y abrir el mismo contenido desde otro acceso.
4. Revisar estados vacío, carga, error y conexión interrumpida cuando correspondan.
5. Comparar el resultado con la planificación y guardar evidencia breve: captura, ruta, pasos y observación.
6. No considerar terminado un flujo solo porque la pantalla carga: debe poder completarse y el resultado debe quedar donde corresponde.

## Fase 3: auditar por áreas

| Área | Preguntas de revisión |
|---|---|
| Producto y navegación | ¿Cada función tiene un lugar único? ¿Los nombres y accesos se entienden? ¿Inicio duplica contenido o facilita llegar a él? |
| Flujos y permisos | ¿Las dos cuentas pueden hacer exactamente lo previsto? ¿Las acciones no permitidas están protegidas también en servidor/base de datos? |
| Privacidad y datos | ¿Lo compartido y lo personal se consulta correctamente? ¿Hay riesgo de filtrar registros, archivos, ubicación o datos del ciclo? ¿Se conserva autoría y consistencia? |
| Diseño y uso | ¿La interfaz respeta la dirección visual elegida, tiene jerarquía clara y textos comprensibles? ¿Se puede usar con teclado, lectores de pantalla y movimiento reducido? |
| Móvil y escritorio | ¿Se adapta a 360 px y a escritorio? ¿Hay controles cortados, modales incómodos, scroll innecesario o elementos difíciles de tocar? |
| Multimedia | ¿Subir, ver, reproducir, borrar y reintentar funciona? ¿Se muestra progreso y se manejan límites o formatos no admitidos? |
| Fechas y notificaciones | ¿Se interpretan bien fechas, zonas horarias, silencios y preferencias? ¿Un aviso llega a quien corresponde y en el momento adecuado? |
| Rendimiento y estabilidad | ¿La entrada inicial es ligera? ¿Las pantallas cargan solo lo necesario? ¿Errores de red o de API dejan la app en un estado recuperable? |
| PWA y Android | ¿Instalación, navegación, actualización, widgets y notificaciones siguen funcionando donde se prometen? |
| Administración | ¿Las herramientas de gestión son claras, restringidas al rol adecuado y no exponen acciones peligrosas accidentalmente? |

No todas las áreas tienen que probarse en cada pantalla: se revisan las que aplican y se marca el resto como «No aplica» con motivo.

## Fase 4: registrar hallazgos y ordenar el trabajo

Cada hallazgo debe tener una ficha:

```text
ID y título:
Pantalla / flujo:
Esperado según planificación:
Observado y pasos para reproducir:
Evidencia:
Impacto para la pareja:
Riesgo para privacidad o datos:
Propuesta mínima:
Criterio observable para darlo por resuelto:
Prioridad y estado:
```

Prioridad:

- **P0 — crítico:** exposición de datos, acceso indebido, pérdida de contenido o app inutilizable. Detener cambios relacionados y resolver primero.
- **P1 — alto:** flujo importante roto, permisos incorrectos o función central inaccesible.
- **P2 — medio:** confusión frecuente, fallo parcial o diseño que dificulta completar una tarea.
- **P3 — bajo:** pulido visual, comodidad o idea futura sin bloqueo real.

Orden recomendado dentro de cada prioridad: protección de datos y acceso → funciones principales → navegación y comprensión → consistencia visual → mejoras opcionales.

## Fase 5: mejorar en entregas pequeñas

Trabajar un módulo o flujo por entrega. Para cada entrega:

1. Elegir hallazgos P0/P1 o un grupo pequeño de P2 relacionados.
2. Escribir antes el criterio de aceptación y delimitar archivos y datos afectados.
3. Corregir sin ampliar el alcance ni introducir una función nueva por sorpresa.
4. Revisar el cambio en móvil y escritorio y con los roles que correspondan.
5. Comprobar los flujos relacionados y las protecciones de datos que puedan verse afectadas.
6. Anotar qué se cambió, qué se verificó y cualquier pendiente.
7. Pasar al siguiente módulo solo cuando los criterios de aceptación se cumplan.

Las migraciones, cambios de proveedor, reemplazos globales y borrados se tratan como tareas separadas: primero se documentan el impacto, la copia recuperable y el plan de vuelta atrás.

## Orden de recorrido recomendado

1. Inicio de sesión, recuperación de acceso y permisos.
2. Navegación principal, Inicio, Rincón y Sentimientos.
3. Flujos de mayor uso: ánimo, Mal día, galería, Open When, calendario.
4. Perfil, administración, notificaciones y recordatorios.
5. Funciones restantes, multimedia, juegos, mapa y OsitosWorld.
6. PWA, Android y widgets.

Si durante el primer recorrido aparece un P0, se atiende antes de seguir con la secuencia.

## Entregables de la auditoría

- Inventario de pantallas y flujos reales.
- Tabla de cobertura: objetivo planificado → ubicación actual → estado → evidencia.
- Lista priorizada de hallazgos, cada uno con un criterio de aceptación.
- Registro de decisiones contradictorias o pendientes, sin resolverlas por suposición.
- Plan de entregas pequeñas con alcance y orden.
- Resumen al terminar cada entrega: corregido, verificado y pendiente.

## Cómo sabremos que la web mejora

- Las funciones prioritarias de la planificación se encuentran y se completan en los dispositivos objetivo.
- Cada acción aparece solo a quien tiene permiso y el servidor protege los datos correspondientes.
- Los flujos principales tienen estados claros cuando cargan, no hay contenido o algo falla.
- No quedan hallazgos P0/P1 abiertos en las áreas ya revisadas.
- Las mejoras no rompen módulos vecinos, sincronización, PWA ni Android.
- Los pendientes restantes tienen motivo, prioridad y siguiente paso claro.
