# Renovación visual — Inicio y Rincón — Design Spec

**Fecha:** 2026-09-11 · **Estado:** aprobada por el usuario (texto original preservado abajo)
**Objetivo:** rediseñar Inicio y áreas internas de Rincón con cabeceras claras, menos duplicación y navegación móvil contextual. Sin dependencias nuevas ni cambios de backend. Datos, rutas y funciones intactos.

## Mapa técnico (levantado del repo)

- `personal-hub/src/components/PageHeader.js` YA existe (`renderPageHeader({title, icon, mobileHidden})`, iconos home/heart/image/smile/mic/compass/minecraft). El trabajo es aplicarlo + CSS tokens + barra móvil.
- Páginas: `src/pages/Home.js` (hero + partículas + frase + 4 tarjetas + Datos curiosos), `src/pages/Rincon.js` (landing con hero corona/contador + `getDescubreHoy()` + grid + vistas galeria-memes/memes/audios/curiosidades), `src/pages/Minecraft.js`.
- Rutas (router): `/rincon`, `/galeria`, `/memes`, `/audios`, `/curiosidades` → RinconPage; `/minecraft` → MinecraftPage. Ya existe mapa de barra móvil (`MOBILE_ROOT_ROUTES` + labels/iconos por ruta) que se extiende con icono+título+volver.
- `src/components/BottomNav.js`: 5 tabs con `aria-label` y `aria-current` ya; falta modo icono-solo ≤390px.
- Tests: `npm test` (`node --test tests/prepush.test.js`); build: `npm run build`. NO tocar cambios locales de Calendario.

## Spec del usuario (verbatim)

### Resumen

Rediseñar Inicio y las áreas internas de Rincón con cabeceras claras, menos contenido duplicado y navegación móvil contextual. Se preservan datos, rutas y funciones existentes; no se añadirán dependencias ni cambios de backend.

### Patrón compartido y navegación

- Crear un componente interno `PageHeader` con icono SVG, un único `h1`, y estilos Umbra basados exclusivamente en tokens. En móvil, las rutas internas usarán la barra superior contextual —ahora con icono, título y volver— para no duplicar cabeceras.
- Aplicarlo a Inicio, El Rincón, Galería, Memes, Audios, Curiosidades y Minecraft. En escritorio, esas páginas mostrarán la cabecera completa en el contenido.
- Mantener las cinco pestañas inferiores. A ≤390 px se ocultarán sus textos, conservando botones de 44 px, estado activo y `aria-label` para que sigan siendo comprensibles con lector de pantalla.
- Mantener la subnavegación Galería/Memes/Audios/Minecraft; en móvil pasará a ser desplazable horizontalmente, con objetivos táctiles cómodos y sin comprimir etiquetas. Solo se ocultarán los botones “Volver a Rincón” que duplican la barra superior móvil.

### Inicio

- Sustituir el hero actual por: cabecera “Inicio” con icono, seguida de una sola tarjeta de bienvenida con saludo dinámico y contador de días juntos.
- Eliminar del Inicio la frase diaria, autor, partículas, subtítulo duplicado y footer decorativo; conservar las cuatro tarjetas actuales, sus destinos, atajos de teclado y rotación de portadas.
- Mantener “Datos curiosos” después del grid, dotándolo de un encabezado de sección coherente con icono y separador visual.

### Rincón e interiores

- Reemplazar el hero de Rincón —corona, contador y copy duplicado de Inicio— por la cabecera “El Rincón” con icono de corazón.
- Convertir “Descubre hoy” en un carrusel manual de tres sugerencias distintas, reutilizando las fuentes de contenido existentes. Mostrará una tarjeta completa por vez, admitirá gesto horizontal, flechas y controles de posición accesibles; no habrá avance automático.
- Preservar el grid de tarjetas, sus previews dinámicas, la edición de portadas de admin y todas las rutas.
- Añadir cabecera a Galería, Memes, Audios y Curiosidades sin alterar filtros, favoritos, lightbox, álbumes ni acciones administrativas.
- En Minecraft, introducir la cabecera de sección y simplificar la jerarquía existente a `h1` de página y `h2` para “Nuestros mundos”; se conservarán mundos, detalles, medios y controles internos.

### Verificación

- Ejecutar `npm test` y `npm run build` tras cada bloque relevante.
- Probar Inicio, Rincón y cada ruta interna en una sesión autorizada: navegación desde tarjetas, carrusel, botones atrás, subnavegación, favoritos, edición admin y carga de contenido.
- Validar en 360, 390, 768, 1024, 1280 y 1440 px, en las cuatro paletas disponibles: sin overflow horizontal, cabeceras legibles, navegación táctil accesible y grid de 2→3 columnas.
- Recorrer teclado y comprobar nombres accesibles, foco visible, `aria-current` en navegación y que el carrusel no cambia sin interacción.

### Suposiciones

- Esta fase excluye Juegos, Canciones, Those Eyes, Series, Sentimientos, Perfil, Admin, Login y experiencias inmersivas.
- Se conservará todo el contenido funcional; la limpieza elimina solo repetición visual y decoración secundaria.
- El carrusel seleccionará tres destinos no repetidos por renderizado, sin persistir ni modificar datos.
- Los cambios locales existentes en Calendario no se tocarán. La base actual ya supera `npm test` y `npm run build`.
