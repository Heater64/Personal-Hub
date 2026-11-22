# PersonalHub — Plan de mejora por fases (identidad Umbra)

**Fecha:** 2026-11-19 · **Estado:** aprobado por el usuario
**Restricción de producto:** se conserva la identidad **Umbra** (oscura, coral). No hay rediseño pastel.
Se modernizan componentes, movimiento, navegación y experiencia; los colores, la tipografía y el
carácter de la app se quedan como están.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Estética | Mantener Umbra: superficies oscuras, acento coral, paletas actuales (coral · frambuesa · azul) |
| Navegación | **Ambos miembros** tienen Inicio, Rincón, Sentimientos y Perfil, como ahora |
| Multimedia | Pasar a **acceso privado** (buckets privados + URLs firmadas) |
| Alcance | Todas las fases, incluidas las funciones Pro |
| Orden | 1) seguridad y estabilidad · 2) navegación y rendimiento · 3) funciones Pro |
| Datos | No se borra ni se migra nada existente; toda migración es aditiva e idempotente |

## Reglas de trabajo

- Una fase por entrega, con `npm test` + `npm run build` verdes **antes** de pasar a la siguiente.
- Ninguna ruta, pantalla, dato o widget se elimina.
- Lo que dependa de Supabase se entrega como migración en `sql/` (idempotente) y se aplica a mano;
  el código nuevo debe funcionar **antes y después** de aplicarla cuando sea posible.
- Si una fase toca la navegación, se actualiza `src/routes.js` y `tests/routes-registry.test.js`
  en el mismo cambio: el test es el contrato, no un obstáculo.

---

## Fase 1 · Seguridad y estabilidad de cabeceras ✅

- `Content-Security-Policy` en todas las rutas, con `object-src 'none'`, `base-uri 'self'`,
  `frame-ancestors 'none'`, `form-action 'self'` y `script-src` cerrado a `self`, inline y jsDelivr (KaTeX).
- `connect-src` limitado al propio origen y a Supabase (`https` + `wss`): un script inyectado ya no
  puede exfiltrar datos a un dominio arbitrario.
- **Corregido:** `Permissions-Policy` tenía `geolocation=()` y desactivaba el GPS para la propia app,
  así que la distancia y el mapa no funcionaban en el dominio real. Ahora es `geolocation=(self)`.
- `Strict-Transport-Security` y `Cross-Origin-Opener-Policy`.
- Test `tests/security-headers.test.js`: impide romper la CSP, abrir `script-src`, olvidar un origen
  externo de `index.html` o volver a cerrar la geolocalización.

**Pendiente de esta fase (para la 4):** KaTeX se sirve desde jsDelivr. Auto-alojarlo quita el único
script de terceros y permite cerrar `script-src` a `'self'`. No se añade `integrity` porque ya hubo un
incidente con hashes publicados que dejó las fórmulas sin renderizar; la solución correcta es servir
los ficheros nosotros.

## Fase 2 · Privacidad de la multimedia 🟡

**Estado:** código implementado y verificado en local; migración **escrita pero NO APLICADA**.
En el proyecto real los cuatro buckets siguen públicos, así que hoy la app funciona exactamente como
antes y la privacidad efectiva todavía no está activa.

### Implementado

1. `src/services/media.service.js`: URL pública de Storage → `{ bucket, ruta }`, firma por lote con
   `createSignedUrls`, caché en memoria con caducidad, renovación dentro del margen
   (`renewDue`, temporizador de un minuto), enfriamiento tras un fallo, objetos inexistentes marcados
   (no se reintentan), paso directo para Cloudinary y URLs externas. `mediaUrl()` es síncrona: devuelve
   la firmada en caché o la original, así ninguna plantilla cambia de forma. La deduplicación por
   petición en vuelo garantiza **una firma por objeto**, no una por render.
2. Integración sin reescribir plantillas: `mediaThumb`/`mediaSrcset` (galería y memes), `lightboxSrc`
   y `browserVideoSrc` (lightbox y reproductor), `avatarEl` (avatares), reproductor de audios, fondos
   de Juntos y portada de Inicio. La galería/memes/audios se firman **antes** de pintar (dos pasadas en
   `Rincon.renderGaleriaMemes`), porque sus `onerror` inline borran la celda. Las subidas (`db.service`)
   firman lo recién subido antes de devolverlo, con import diferido para no romper las pruebas que
   simulan Supabase.
3. Degradación: si firmar falla, la vista usa la URL original (compatible con el bucket público de hoy);
   `installMediaFallback()` reintenta **una vez** cualquier `img/video/audio/source` roto y, si no hay
   firma nueva, devuelve el error a la plantilla para que muestre su respaldo de siempre.
4. `sql/030_media_privado.sql` — **escrito, no ejecutado** (ver más abajo).
5. Tests `tests/media-private.test.js` (26): reconocer la URL, firmar por lote, no re-firmar por
   render, renovar dentro del margen, fallo de firma, objeto inexistente, respaldo global y forma del
   SQL (idempotencia, `TO authenticated`, sin `anon`, sin borrados).

### Verificado en local (por mí)

- `npm test`: **309/309 en verde al cerrar la fase** (los 281 anteriores siguen pasando; 26 son
  nuevos de esta fase). Hoy la misma suite sigue en verde con **310/310**, porque el usuario va
  añadiendo pruebas locales por su cuenta; ninguna de ellas es de esta fase.
- `npm run build`: correcto (~1,1 s); bundle inicial 417,75 kB (gzip 126), sin coste apreciable.
- `npx eslint` en los archivos tocados y en el test nuevo: **0 errores** (solo avisos previos).
- Navegador (Chromium, servidor de desarrollo y `dist` con las cabeceras reales de `vercel.json`):
  50 renders de la misma foto producen **una sola firma**; la renovación dentro del margen se dispara
  una vez; con el firmante real y sin sesión la firma falla en ~120 ms y la vista conserva la URL
  original; el respaldo recupera una imagen rota con su URL firmada; la app arranca con **cero
  violaciones de CSP y cero excepciones** (solo el 401/RLS esperado sin sesión).
- Todo esto se probó **sin sesión iniciada y con los buckets públicos**. No hay ninguna comprobación
  hecha sobre el proyecto con los buckets ya privatizados.

### La migración: escrita y NO aplicada

`sql/030_media_privado.sql` es idempotente (`DROP POLICY IF EXISTS` + `CREATE`), trae la cabecera con
el paso a paso y un rollback comentado al final. Pone los cuatro buckets (`galeria`, `memes`, `audios`,
`avatars`) en privado, deja la lectura solo a `authenticated` con `public.is_enabled()` y recrea la
escritura tal como estaba (admin en galería/memes/audios; dueño o admin en avatares), sin `anon`.
**No borra, mueve ni reescribe objetos ni datos.**

> **Atención a la numeración:** en `sql/` ya existe `030_inicializar_pareja_actual.sql`, trabajo local
> del usuario, y este archivo es `030_media_privado.sql`. Comparten prefijo pero son cosas distintas:
> se aplica **solo** `sql/030_media_privado.sql` (el de los buckets); el otro es la inicialización de
> la pareja actual y no forma parte de esta fase. Es 030 porque `029` también está ocupado.

### Orden exacto de aplicación

1. **Desplegar este código** con los buckets todavía públicos. No cambia nada visible: si la firma
   falla se usa la URL pública.
2. **Aplicar `sql/030_media_privado.sql`** en el SQL Editor de Supabase — este y ningún otro. Desde ese
   momento la URL pública deja de servir y la app usa las firmadas.
3. **Solo entonces**, verificar con las dos cuentas (lista de abajo). Si algo va mal, el bloque de
   rollback del final del propio archivo devuelve los buckets a públicos sin tocar datos.

### Verificación pendiente (NO probada por mí)

Nada de esto está confirmado en el proyecto real ni en producción:

- [ ] URL pública de un objeto pegada en una pestaña sin sesión: debe dar 400/403, nunca la imagen.
- [ ] URL firmada sirviendo el objeto (galería, meme, audio y avatar).
- [ ] Galería, memes, audios y avatares intactos con las dos cuentas (incluidos favoritos y lightbox).
- [ ] Subir una foto (admin) y un avatar (cada cuenta) con el bucket privado.
- [ ] Fondo de Juntos y portada de Inicio con foto propia ya guardada en el móvil.
- [ ] Rollback disponible y probado si hiciera falta (bloque comentado al final de `030`).

Las fases 4 a 7 **no están empezadas**: nada de lo que sigue está implementado.

## Fase 3 · Navegación y experiencia ✅ (completada)

Objetivo de la fase: que la app se recorra por mundos sin añadir pestañas ni pantallas nuevas.

### Hecho y verificado

- **Catálogo de mundos**: `src/data/mundos.data.js` declara los siete mundos de la misión y el mapa
  módulo → mundo de las 11 tarjetas que ya existían (6 en Rincón, 5 en Sentimientos). Es dato puro:
  mover una tarjeta de mundo es una línea.
- **Agrupación en los dos hubs**, sin rutas, pestañas ni datos nuevos: `Rincon.renderLanding()` y
  `Sentimientos` pintan una sección `.mundo` por grupo, con la misma tarjeta y el mismo enlace de
  siempre. Empezó siendo una rejilla plana.
- **Componente único** `.mundo` / `.mundo-title` / `.mundo-hint` en `src/styles/ui.css`, con tokens
  (sin colores a mano): el mundo es una etiqueta de subtítulo, no una tarjeta nueva.
- **Reglas de la agrupación**: los grupos salen en el orden de la misión; un mundo sin tarjetas no se
  pinta; un módulo sin mundo asignado cae en «Más» en vez de desaparecer; ninguna tarjeta se duplica.
- **Tests**: `tests/mundos.test.js` (11) fija el catálogo, que toda tarjeta real tenga mundo, que el
  mapa no invente módulos, el orden, la caída en «Más», el componente en `ui.css` y que no exista
  ninguna ruta ni pestaña `/mundos`.
- Verificado en local: **321/321 tests en verde**, `npm run build` correcto (417,84 kB, gzip 126) y
  navegador con las dos pantallas montadas: Rincón pinta 3 mundos con sus 6 tarjetas y Sentimientos
  3 mundos con sus 5, la columna única de Sentimientos sigue siendo una sola y el título de mundo
  sale a 12 px con el color de token. Consola limpia.

### Cierre de la fase (las cuatro piezas)

- **Un solo patrón de cabecera**: `renderPageHeader({ title, subtitle, actions, back, className })`
  en `src/components/PageHeader.js`. Admite botón de volver (`data-back`, que cada pantalla engancha
  a su navegación) y acciones a la derecha. Migradas: Calendario, OpenWhen (lista y detalle),
  OsitosWorld, Razones, la subcabecera de Rincón y Curiosidades. No queda ningún
  `<h1 class="scr-title">` escrito a mano fuera del componente.
- **Estados vacíos y skeletons homogéneos**: `src/components/states.js` con `emptyStateHTML()`,
  `skeletonHTML()` y `skeletonCardsHTML()`, construidos sobre la tarjeta `.empty` y los tokens que ya
  existían. Aplicados donde hay carga real o lista que puede quedar vacía: el calendario (filas del
  mes y tarjeta del regalo destacado mientras llega el catálogo, con `catalogPending` para no dejar
  huecos para siempre si la carga falla), el historial de Sentimientos (solo si no hay nada local, y
  se sustituye siempre, también cuando falla la red) y la búsqueda de Curiosidades sin resultados. El
  brillo del skeleton se apaga con `prefers-reduced-motion`.
- **Transiciones de ruta**: el router añade `.route-enter` al montar la página, sin retrasar el
  montaje ni animar la salida (no hay parpadeo), y **no la añade** si `prefers-reduced-motion:
  reduce`. El CSS usa `#app-content > .route-enter` para ganar a la animación propia de cada página
  (`fade-in`) y la anula dentro del bloque de movimiento reducido.
- **Búsqueda global**: `src/components/GlobalSearch.js` sobre `openSheet` (foco, Tab atrapado, Atrás
  cierra). Índice en `src/data/search.data.js`: las 11 tarjetas reales de los hubs (con su mundo) y
  las rutas del registro, sin duplicar puertas y filtradas por rol (`isAdmin`). Se abre con
  **Ctrl/⌘ + K**, con un botón flotante en móvil (fuera de la barra de pestañas) y con la entrada del
  menú lateral en escritorio. Teclado completo (`aria-activedescendant`, ↑/↓, Enter, Escape), estado
  inicial con sugerencias y «sin resultados» explícito. No hay ruta ni pestaña `/buscar`.

### Verificado al cerrar

- `npm test` completo: **342/342 en verde**, incluidos `tests/mundos.test.js`, los contratos previos y
  los nuevos `tests/fase3.test.js` (18): la búsqueda encuentra cada tarjeta real, no devuelve rutas
  inventadas, respeta el rol, ignora acentos, tiene sugerencias y «sin resultados»; los estados y
  skeletons se renderizan (y escapan el texto); la cabecera compartida pinta título, subtítulo,
  acciones y volver; las pantallas principales ya no repiten el marcado; la transición solo se añade
  sin movimiento reducido.
- `npm run build` correcto: **427,32 kB JS (gzip 130,02)** y **223,83 kB CSS (gzip 42,29)**. El
  crecimiento (~9 kB) es el índice de búsqueda, los estados compartidos y el componente de búsqueda.
- `eslint` sobre todo lo tocado: **0 errores** (quedan avisos previos de variables sin usar en
  archivos que no son de esta fase).
- Navegador (sesión real, consola sin errores de JS; solo los 403 previos de storage y el aviso de
  realtime que ya existían): Ctrl + K y la entrada del menú abren la búsqueda con 8 sugerencias y el
  campo enfocado; «día» encuentra Mal Día/Calendario/Inicio/Juntos; ↑ + Enter abre `#/calendario` con
  la cabecera compartida y sin dejar la hoja abierta; Escape cierra; «zzzqqq» muestra «Sin
  resultados». En móvil (390 px) el botón flotante queda sobre la barra inferior, abre la búsqueda y
  desaparece en escritorio. El volver de Curiosidades lleva a `#/rincon`. Este equipo tiene
  *movimiento reducido* activado: con esa preferencia no se añade `.route-enter` y la animación queda
  anulada; el camino con movimiento se comprobó forzando `matchMedia` (la clase sí se añade).
- `tests/prepush.test.js`: la comprobación de la cabecera del calendario pasa de exigir el `<h1>` a
  mano a exigir `renderPageHeader`, que es el contrato nuevo.

### Lo que queda abierto (no es un fallo de la fase)

- [ ] **Vida cotidiana** sigue sin tarjetas: se llenará con los módulos Pro de las fases 5 y 6
  (juntos/mapa, hábitos, gastos…), no con puertas inventadas.
- [ ] Los skeletons existen y están probados, pero en local la carga es tan rápida que no se llega a
  ver el fotograma de carga; y en la cuenta de prueba el historial de Sentimientos ya tenía datos
  locales, que es justo el caso en el que no se pinta skeleton. Merece un repaso con red lenta.

## Fase 4 · Rendimiento ✅ (completada)

Objetivo de la fase: que el arranque lleve solo lo que se ve al entrar. Meta: ≤ 280 kB de JS y
≤ 160 kB de CSS.

### Hecho y verificado

- **Las hojas de pantalla salen del bundle inicial**. `main.css` se queda con lo transversal
  (tokens, reset, tipografía, `ui.css`, animaciones, utilidades, navegación, reproductor, visor y
  `motion.css`) y cada página importa la suya desde su módulo: Inicio, Login, Perfil, Razones,
  Mal Día, Juntos y Mapa (las que colgaban de `main.css`) y las que ya lo hacían por su cuenta.
- **Inicio, Perfil, Razones y Mal Día pasan a `lazy()`**: eran las cuatro pantallas estáticas que
  arrastraban 49 + 62 + 25 + 55 kB de JS y ~136 kB de CSS al primer byte. Login se queda estático
  porque es la primera pantalla con la sesión cerrada. El router ya enseñaba skeleton mientras
  resuelve la promesa, así que no hay pantalla en blanco.
- **KaTeX deja de viajar en `index.html`**: una hoja y dos scripts desde jsDelivr en *todas* las
  visitas para algo que solo usa el calendario. Ahora `loadKatex()` (`src/utils/renderMath.js`) los
  inyecta la primera vez que se abre el calendario; si aún no ha llegado, el texto se pinta como
  código y la vista nunca se bloquea. Verificado en el navegador: en Inicio/Perfil/Mal Día/Juntos
  `window.katex` es `undefined` y no hay ninguna petición a jsDelivr; al abrir el calendario llegan
  las dos y `renderMathText` devuelve `.katex`.
- **Preconnect podado**: fuera los orígenes de carátulas (Spotify, Genius, YouTube, Deezer,
  SoundCloud, Amazon, Akamai) y el de `dragonballlatino`, que solo se tocan en pantallas diferidas.
  Además el preconnect de Supabase apuntaba a un proyecto antiguo: ahora coincide con
  `VITE_SUPABASE_URL`.

### Medición (mismo equipo, `npm run build`)

| | Al cerrar la fase 3 | Al cerrar la fase 4 | Meta |
|---|---|---|---|
| JS inicial | 427,32 kB (gzip 130,02) | **253,72 kB (gzip 79,81)** | ≤ 280 / 90 |
| CSS inicial | 223,83 kB (gzip 42,29) | **91,36 kB (gzip 17,44)** | ≤ 160 / 30 |
| Recursos externos al arrancar | KaTeX (1 hoja + 2 scripts) + fuentes | solo fuentes | — |

- `npm test`: **348/348 en verde**, con `tests/fase4.test.js` (5) fijando que `main.css` no importe
  hojas de pantalla, que cada pantalla importe la suya, que las pesadas usen `lazy()`, que Login
  siga estático y que KaTeX no vuelva a `index.html`.
- `npm run build` correcto y `eslint` sin errores en lo tocado.
- Navegador: Inicio, Perfil, Mal Día y Juntos montan con sus estilos (reglas `.home-*`, `.prof-*`,
  `.maldia-page`, `.juntos-page` presentes) y su chunk; Calendario pide KaTeX y las fórmulas se
  renderizan. Consola sin errores de JS (siguen los 403 previos de `couple_members` y el aviso de
  realtime).

### Lo que queda abierto

- [ ] **LCP móvil real**: no se ha medido en un teléfono ni con throttling; el número de la tabla es
  el peso del bundle, no una métrica de campo. Merece una pasada con Lighthouse móvil.
- [ ] **Auto-alojar fuentes y KaTeX**: siguen en CDN. Ahorraría conexiones, pero implica añadir
  binarios al repo y perder la actualización automática; se deja para cuando haya red lenta medida.
- [ ] `App.js` sigue trayendo reproductor, bienvenida y visor en el arranque (27 kB de JS y ~38 kB
  de CSS). Diferirlos tiene sentido, pero toca el orden de montaje de la shell: fuera del alcance de
  esta fase tal como estaba escrita.

## Fase 5 · Pro sin migraciones ✅ (completada)

Estadísticas de ánimo y rachas · «un año hoy» · razón del día · watchlist compartida · récords de
juegos · cuenta atrás para ambos · resumen del ciclo · estado del móvil del otro · widgets nuevos
(razón, Open When pendiente, racha). Reutilizan datos y tablas existentes.

### Hecho y verificado

- **Estadísticas de ánimo y rachas.** `utils/pro-insights.js` (nuevo, puro: sin red, sin DOM y con
  el almacenamiento como parámetro) añade `bestStreak()` y `lastNDays()`. Sentimientos suma a sus
  contadores «mejor racha» y una tira de 14 días (`.pro-strip`, punto encendido = día con ánimo),
  reutilizando el `historyMap` que ya calculaba `computeStats()`.
- **«Un año hoy».** Inicio pinta una tarjeta «Tal día como hoy» con las fotos del mismo día y mes de
  años anteriores, leídas con `visiblePhotos()` + `photoDate()` de `galleryData`: las fechas ya
  estaban en la URL de cada foto, no hay metadatos nuevos. Si no hay ninguna coincide, la tarjeta no
  aparece.
- **Razón del día.** Razones elige la misma razón para las dos cuentas durante todo el día según la
  fecha (`reasonOfDay()`, sin `Math.random()` y sin guardar nada) y la deja para el widget. El botón
  abre la hoja de siempre.
- **Watchlist compartida.** `services/pro.service.js` guarda una fila `series_watchlist` en la tabla
  `content` que ya existe (mismo patrón que la presencia y los catálogos), así que no hay migración
  ni RLS nueva. Se añade desde el detalle de una serie, se ve en la portada de Series con quién la
  añadió, se marca vista y se quita; las dos cuentas leen y escriben la misma lista.
- **Récords de juegos.** Juegos lee los récords que los minijuegos ya guardan en `localStorage`
  (`snakeHighScore`, `tetrisHighScore`, tiempos de Memoria/Buscaminas/Laberinto…). No se tocó ningún
  juego ni se inventó una tabla: solo se pintan las marcas que existen en ese dispositivo.
- **Cuenta atrás para ambos.** Juntos muestra las tres próximas fechas especiales con `days` ya
  calculado por `upcomingSpecialDates()` (hoy / mañana / N días).
- **Resumen del ciclo.** Ya estaba en Bienestar › Ciclo (`pages/menstruacion/home.js`): fase, día del
  ciclo, próxima regla, ciclo y regla medios, último inicio y nota de confianza. La fase se cierra sin
  duplicarlo.
- **Estado del móvil del otro.** Juntos añade una tarjeta «Su móvil» con batería, si está cargando,
  red y antigüedad, desde `fetchPartnerLocation()` (los datos ya viajan con la posición). Se cachea un
  minuto y desaparece si no hay posición de la otra persona.
- **Widgets nuevos (razón, Open When pendiente, racha).** `widgets.service.js` gana
  `saveReasonWidget`, `saveOpenWhenWidget` y `saveStreakWidget` (con `WIDGET_KEYS`); la hoja de
  widgets los ofrece en cuadrado y apaisado con vista previa. En nativo, `ProWidgetProvider` +
  `WidgetRenderer.renderProText()` pintan los tres con una sola composición (kicker, valor y
  etiqueta), con layouts compartidos (`widget_pro_rect`, `widget_pro_compact`), 6 receptores en el
  manifiesto y deep links a Razones, Open When y Sentimientos. Open When guarda cuántas cartas
  quedan por descubrir con el estado `seen` que ya tenía.
- **Miniaturas siempre con contenido.** La hoja de widgets toma el paquete guardado de cada widget y,
  cuando todavía no existe (al abrir desde Inicio, o siempre en el navegador, donde Preferences solo
  existe en el APK), cae en `PREVIEW_SAMPLES`: una razón de ejemplo, 3 cartas y una racha de 7 días
  (mejor: 12). Así ninguna de las tres miniaturas nuevas queda con un guion. En el cuadrado, la razón
  se pinta recortada a tres líneas (`wprev__pro-text--sm`) como en el widget real, no como un emoji.
- **CSS.** Un solo componente `.pro-card` / `.pro-facts` / `.pro-record` / `.pro-year` en `ui.css`
  para todas las tarjetas nuevas, con tokens (sin colores a mano). Los previews de la hoja de widgets
  usan `.wprev--pro` en `home.css`.

### Verificación

- `npm test`: **363/363 en verde**, con `tests/fase5.test.js` (14) cubriendo los cálculos puros
  (récords, racha, tira, razón del día, «un año hoy») y los contratos de cada pantalla y de los tres
  widgets nativos.
- `npm run build` correcto: **253,48 kB de JS (gzip 79,77)** y **94,58 kB de CSS (gzip 17,97)**.
- `eslint tamp/src`: 0 errores (los avisos son los previos).
- `./gradlew assembleDebug`: BUILD SUCCESSFUL con los seis receptores nuevos.
- Hoja de widgets (navegador, cuenta real): 10/10 miniaturas con contenido (`days`, `distance`,
  `countdown`, `mood`, `cycle`, `watching`, `gifts`, `reason`, `openwhen`, `streak`), con la razón de
  ejemplo, 3 cartas y 7 días de racha; conmutar tamaño y el simulador de letra 1,5× sin desbordar.
- Navegador (datos reales de la cuenta):
  - Juegos pinta «Récords» con las marcas sembradas en `localStorage` («Snake 120 puntos»,
    «Tetris 3400 puntos») y el componente con sus estilos (radio 20px).
  - Inicio pinta «Tal día como hoy» con una foto sembrada del 19 nov 2023 («hace 3 años»); con la
    galería sin fotos de ese día la tarjeta no aparece.
  - Razones muestra «RAZÓN DEL DÍA» con una razón real y el botón que abre la hoja.
  - Juntos muestra «Para los dos» con Aniversario (226 días), cumpleaños de Peluche (257) y de dada
    (288); la tarjeta del móvil queda oculta sin posición de la otra cuenta, como debe.
  - Sentimientos: «mejor racha» aparece y la tira pinta 14 puntos (3 encendidos).
  - Series: añadir «Gravity Falls» desde el detalle creó la fila compartida y la portada mostró
    «la añadió Peluche»; quitarla la dejó vacía y oculta. Se limpió la entrada de prueba.
  - Hoja de widgets: 10 widgets, los tres nuevos con vista previa, solo tamaños cuadrado/apaisado y
    cambio de tamaño funcionando.
  - Consola sin errores nuevos de JS: solo los 403 previos de `couple_members` y el aviso de
    realtime (más un 404 de la foto falsa sembrada para la prueba, ya retirada).

### Lo que queda abierto

- [ ] **Widgets en un móvil real**: el APK compila, pero aquí no hay emulador ni dispositivo, así que
  no se ha visto el widget colocado ni la vista previa nativa. Queda probar razón, Open When y racha
  en la pantalla de inicio.
- [x] **Miniaturas vacías en la web**: cerrado. Razón, Open When y racha muestran un ejemplo neutro
  cuando no hay paquete guardado; los siete widgets anteriores ya enseñan su estado real (ánimo de
  hoy, ciclo, distancia) y no se tocaron. Verificado en el navegador: 10/10 miniaturas con texto,
  tamaño cuadrado/apaisado sin desbordar, y `tests/fase5.test.js` fija el respaldo.
- [ ] **Estado del móvil del otro** necesita que la otra cuenta comparta ubicación; con una sola
  sesión la tarjeta se oculta (probado el camino inverso: sin posición no pinta nada).
- [ ] **«Un año hoy» con fotos reales del mismo día**: en la cuenta de prueba no había ninguna foto
  del 19 de noviembre, así que se verificó sembrando una; conviene verlo con la galería real.
- [ ] **Fila vacía de la watchlist**: al quitar la última serie queda `items: []` en `content`
  `series_watchlist` en vez de borrar la fila. Es inofensivo (la sección se oculta) y evita un
  `delete` que la RLS tendría que permitir aparte.

## Fase 6 · Pro con migraciones 🔜

Listas y notas compartidas · hábitos ligeros · gastos simples · tablero de ideas · recordatorios de
pareja (hoy solo admin). Tablas nuevas con RLS **simétrica entre los dos miembros** (no `is_admin()`),
probadas con las dos cuentas y con tests de contrato.

## Fase 7 · Nativo y cierre 🔜

- Arreglar el OTA real del APK: `capacitor.config.ts` documenta `CAP_SERVER_URL` pero tiene
  `const remoteUrl = ''` fijo, así que hoy cada cambio exige APK nuevo.
- Iconos/splash coherentes con Umbra, revisión de accesibilidad (contraste, foco, teclado, lector).
- Backup/restauración probados y repaso final en dos dispositivos.
