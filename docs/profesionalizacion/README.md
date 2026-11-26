# Profesionalización integral de Personal Hub

Seguimiento del objetivo de calidad visual, navegación, integración Android, rendimiento y control de calidad. Este directorio distingue con claridad entre trabajo **implementado** y **verificado**.

## Estado general

**En progreso.** Se ha tomado la línea base del repositorio y se ha abierto la auditoría. No se han modificado pantallas ni lógica de producto en esta fase inicial.

## Documentos

- [Auditoría inicial](auditoria-inicial.md)
- [Sistema de diseño](sistema-diseno.md)
- [Arquitectura de navegación](navegacion.md)
- [Experiencia Android](android.md)
- [Inventario de pantallas](pantallas.md)
- [Rendimiento](rendimiento.md)
- [Matriz de pruebas](pruebas.md)
- [Registro de decisiones](decisiones.md)
- [Progreso](progreso.md)
- [Informe final](informe-final.md)

## Evidencia previa relacionada

- [`tasks/plan.md`](../../tasks/plan.md) y [`tasks/todo.md`](../../tasks/todo.md) ya contienen una auditoría reciente de Tamp: registra un recorrido de 23 rutas con una sesión de Peluche/admin y señala como pendientes la sesión de Princesa, el repaso detallado de controles y una pasada responsive. Esos archivos tienen cambios locales preexistentes y se conservan intactos.
- [`docs/audit-readiness.md`](../audit-readiness.md) contiene una auditoría de preparación y seguridad anterior; no se toma como medición actual de UX ni de rendimiento móvil.
- El árbol de código auditado es la app Tamp bajo `tamp/`, una SPA JavaScript/Vite con shell Capacitor para Android.

## Convención de estado

- **Pendiente:** sin trabajo iniciado o sin evidencia suficiente.
- **En progreso:** inspección o implementación activa.
- **Implementada:** el cambio está en el repositorio, falta validación correspondiente.
- **Verificada:** hay una comprobación reciente reproducible y se anota su alcance.
- **Bloqueada:** requiere un recurso externo no disponible; se registra el motivo.
