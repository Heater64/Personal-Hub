# Sistema de diseño

**Estado: En progreso (inventario inicial); unificación pendiente.**

## Fuente visual

Se adopta el lenguaje Umbra descrito en `.agents/skills/estilo_umbra/SKILL.md`, junto con las variables existentes en `tamp/src/styles/design-tokens.css`. La portada emocional, el acento coral, las superficies oscuras y el tema claro con acento propio son parte de la identidad existente y se preservan.

## Base encontrada

- Tokens centrales para color, tipografía, espaciado, radios, elevación y movimiento.
- Componentes compartidos en `components/ui.js`, `PageHeader.js`, `states.js`, `Toast.js`, `MediaLightbox.js`, `BottomNav.js` y `Sidebar.js`.
- Estilos globales separados de estilos por pantalla.
- Excepción con identidad propia documentada para Ositos World.

## Auditoría pendiente

- Comparar usos reales de tokens con CSS heredado y alias antiguos sin hacer una sustitución masiva.
- Revisar contraste y jerarquía en ambos temas, densidad móvil, focos visibles, tamaños táctiles y estados de controles.
- Inventariar botones, campos, menús, diálogos, hojas, errores y estados vacíos; identificar duplicados por comportamiento, no solo por apariencia.
- Definir por cada componente hallado: contrato, variantes justificadas y pantallas donde aparece.

## Reglas provisionales

- Reutilizar tokens existentes antes de crear nuevos.
- No cambiar una pantalla solo para uniformarla; conservar patrones específicos que respondan al contenido.
- No hacer migraciones masivas de variables ni agregar dependencias como parte de la auditoría.
- Estado de cada unificación: pendiente hasta que se haya implementado y verificado en navegador.
