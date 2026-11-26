# Arquitectura de navegación

**Estado: En progreso.**

## Arquitectura encontrada

- `tamp/src/router.js`: router SPA con fragmentos hash, `pushState`/`popstate`, cargas diferidas, guardas y render de ruta.
- `tamp/src/routes.js`: catálogo de rutas, roles, secciones, padres, grupos de sidebar y reglas de chrome.
- `tamp/src/components/App.js`: shell, guardas de auth/rol y actualización de navegación.
- `BottomNav.js` y `Sidebar.js`: navegación inferior móvil y lateral de escritorio derivadas del registro.
- `scrollMemory.js` y `overlayHistory.js`: utilidades para conservar scroll y coordinar capas con Atrás.
- `native.service.js`: botón Atrás Android, reanudación, enlaces profundos y navegación desde push.

## Reglas existentes observadas

- Cuatro pestañas principales compartidas: Inicio, Rincón, Sentimientos y Perfil.
- Algunas pantallas hijas tienen padre explícito; otras (por ejemplo Juntos y Mapa) se abren a pantalla completa desde widgets/enlaces internos.
- Overlay history añade estado de historial para que Atrás cierre capas antes de abandonar la ruta.
- Tocar de nuevo la pestaña activa desplaza la pantalla al inicio.

## Verificación observada

- En navegador de escritorio, Atrás regresó de Sentimientos a Rincón.
- La posición de scroll de Rincón volvió al mismo tramo después de visitar Inicio.
- La pestaña Biblioteca de Series se conservó al salir de Series y regresar.

## Verificación pendiente

- Camino completo: pestaña → pantalla hija → diálogo/hoja → Atrás del sistema/gesto → pestaña original.
- Restauración de scroll y estado por pestaña; rutas con query (`/canciones?v=…`) y segmento dinámico de partida.
- Enlaces profundos desde app cerrada/abierta, notificaciones y widgets.
- Diferencias de navegación por rol, recarga directa de hash y retorno desde segundo plano.
- Medir si el chrome (barra inferior/cabecera) cambia donde corresponde en móvil/tablet/escritorio.

## Riesgos por confirmar

- El comentario de `BottomNav.js` indica cinco secciones, mientras que el registro define cuatro; parece documentación interna desactualizada, no una diferencia de runtime.
- No afirmar que el historial restaura estado visual completo hasta probar varios cambios de pestaña en una sesión autenticada y Android.
