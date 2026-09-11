# Renovación Inicio y Rincón Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cabeceras Umbra compartidas, Inicio simplificado y Rincón con carrusel manual, sin romper datos, rutas ni funciones.

**Architecture:** `PageHeader.js` existente como única cabecera (un `h1` por página); barra móvil contextual del router para rutas internas; CSS solo con tokens; carrusel sin autoplay con `aria-roledescription="carousel"`.

**Tech Stack:** JS nativo ES Modules + CSS tokens Umbra + `node:test` (`npm test`), build `npm run build`.

## Global Constraints

- Estilo Umbra: tokens `var(--*)`, un solo `h1` por página, radio 22px, sin hex fuera de tokens (previews ornamentales sí).
- Cero dependencias nuevas, cero cambios de backend/datos; rutas y deep-links (`?tab=`) intactos.
- Sin `console.log`; `prefers-reduced-motion` (sin autoplay en carrusel de todos modos); toque ≥44px; foco visible.
- NO tocar `Calendario.js`/`calendario.css` (cambios locales ajenos) ni `dist/`.
- `git add` selectivo por tarea; verificar `npm test` tras cada bloque.

---

### Task 1: PageHeader + barra móvil contextual

**Files:**
- Modify: `personal-hub/src/components/PageHeader.js` (revisar; añadir variante si falta)
- Modify: CSS de `.page-header*` (localizar con grep; si no existe, crear `personal-hub/src/styles/page-header.css` e importarlo donde se importan estilos)
- Modify: router (donde viven `MOBILE_ROOT_ROUTES` y el mapa de labels/iconos) — barra con icono+título+volver en rutas internas
- Modify: `tests/prepush.test.js` (1 test)
- Test: `tests/prepush.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `renderPageHeader({title, icon, mobileHidden})` con estilos tokenizados + barra móvil contextual para Task 3/4/5.

- [ ] **Step 1: Write the failing test**

```js
test('pageheader umbra con tokens y barra movil contextual', async () => {
  const comp = await readFile(projectPath('personal-hub', 'src', 'components', 'PageHeader.js'), 'utf8');
  assert.ok(comp.includes('renderPageHeader'));
  assert.ok(comp.includes('<h1'));
  assert.ok(comp.includes('mobileHidden'));
  assert.ok(comp.includes('page-header__icon'));
  assert.ok(comp.includes('page-header__line'));
  const css = await readFile(projectPath('personal-hub', 'src', 'styles', 'page-header.css'), 'utf8');
  assert.ok(!css.includes('#') || css.includes('rgba('));
  assert.ok(css.includes('--accent-dim'));
  assert.ok(css.includes('--theme-divider-strong'));
  const main = await readFile(projectPath('personal-hub', 'src', 'styles', 'main.css'), 'utf8');
  assert.ok(main.includes('page-header'));
});
```

> I1 (barra móvil icono+título en App.js) pendiente de los cambios del otro worker; se verifica end-state en Task 6.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (falta el CSS o la variante).

- [ ] **Step 3: Write minimal implementation**

CSS `.page-header` con patrón chip+título+línea (tokens `--accent-dim`, `--theme-text-secondary`, `--theme-divider-strong`, radio `--r-sm` 34px chip); variante `--mobile-hidden` (oculta en móvil, visible desktop). Barra móvil del router: icono+título+botón volver (`history.back()` con fallback a la ruta padre) solo en rutas internas (`/galeria`, `/memes`, `/audios`, `/minecraft`, `/curiosidades`, `/juegos`, ...), nunca en las 5 root.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run build`
Expected: PASS + build OK.

- [ ] **Step 5: Commit**

```bash
git add personal-hub/src/components/PageHeader.js personal-hub/src/styles/page-header.css <router> tests/prepush.test.js
git commit -m "feat(rincon): pageheader umbra y barra movil contextual"
```

---

### Task 2: BottomNav icono-solo + subnav desplazable

**Files:**
- Modify: CSS de BottomNav (localizar `.bottom-nav__label`)
- Modify: CSS/marcado de la subnavegación del Rincón (Galería/Memes/Audios/Minecraft)
- Modify: `personal-hub/src/pages/Rincon.js` (quitar solo botones “Volver a Rincón” duplicados)
- Modify: `tests/prepush.test.js` (1 test)

- [ ] **Step 1: Write the failing test**

```js
test('bottomnav compacta a 390px y subnav con scroll horizontal', async () => {
  const cssFiles = ['bottom-nav.css', 'rincon.css'];
  let css = '';
  for (const f of cssFiles) { try { css += await readFile(projectPath('personal-hub', 'src', 'styles', f), 'utf8'); } catch (e) {} }
  assert.ok(css.includes('390px'));
  assert.ok(css.includes('overflow-x'));
});
```

- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3:** media query ≤390px que oculta `.bottom-nav__label` (botones 44px, `aria-label` y `aria-current` ya existen en `BottomNav.js`, no tocar JS); subnav con `overflow-x:auto`, `scrollbar-width:none`, items `flex-shrink:0` y área táctil ≥44px. Quitar en `Rincon.js` solo los “Volver a Rincón” que duplican la barra móvil.
- [ ] **Step 4: Run** `npm test && npm run build` → PASS. **Step 5: Commit** `feat(rincon): nav movil compacta y subnav con scroll`.

---

### Task 3: Inicio (header + bienvenida, sin duplicados)

**Files:**
- Modify: `personal-hub/src/pages/Home.js` + su CSS
- Modify: `tests/prepush.test.js` (1 test)

- [ ] **Step 1: Write the failing test**

```js
test('inicio usa pageheader y tarjeta de bienvenida sin frase ni particulas', async () => {
  const home = await readFile(projectPath('personal-hub', 'src', 'pages', 'Home.js'), 'utf8');
  assert.ok(home.includes('renderPageHeader'));
  assert.ok(!home.includes('home-hero__phrase'));
  assert.ok(!home.includes('home-hero__particle'));
  assert.ok(home.includes('homeCounter'));
  assert.ok(home.includes('Datos curiosos'));
});
```

- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3:** cabecera “Inicio” (`renderPageHeader` icono home) + una tarjeta bienvenida (saludo dinámico `gSaludo` + `#homeCounter` días juntos); eliminar frase/autor/partículas/sub duplicado/footer decorativo; conservar 4 tarjetas, destinos, atajos teclado y `posterRotator`; “Datos curiosos” con encabezado de sección (icono+separador). Un solo `h1` (el del PageHeader).
- [ ] **Step 4: Run** `npm test && npm run build` → PASS. **Step 5: Commit** `feat(inicio): cabecera y bienvenida sin duplicados`.

---

### Task 4: Rincón landing (header + carrusel manual)

**Files:**
- Modify: `personal-hub/src/pages/Rincon.js` (landing: hero + `getDescubreHoy()` + featured) + su CSS
- Modify: `tests/prepush.test.js` (1 test)

- [ ] **Step 1: Write the failing test**

```js
test('rincon con cabecera y carrusel manual accesible', async () => {
  const rincon = await readFile(projectPath('personal-hub', 'src', 'pages', 'Rincon.js'), 'utf8');
  assert.ok(rincon.includes("renderPageHeader"));
  assert.ok(rincon.includes('El Rincón'));
  assert.ok(rincon.includes('aria-roledescription'));
  assert.ok(!rincon.includes('setInterval'));
  assert.ok(rincon.includes('rincon-hero-crown') === false);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3:** sustituir hero (corona/contador/copy) por `renderPageHeader` “El Rincón” icono heart; “Descubre hoy” → carrusel de 3 sugerencias distintas (reutilizar fuentes de `getDescubreHoy()`, sin persistir): una tarjeta visible, gesto touch horizontal, flechas prev/next, dots con `aria-label` de posición, `aria-roledescription="carousel"` + `aria-live="polite"` en la tarjeta, cero `setInterval`; sin `autoplay`. Grid, previews, edición portadas admin y rutas intactos.
- [ ] **Step 4: Run** `npm test && npm run build` → PASS. **Step 5: Commit** `feat(rincon): cabecera y carrusel manual`.

---

### Task 5: Interiores (4 cabeceras + Minecraft)

**Files:**
- Modify: `personal-hub/src/pages/Rincon.js` (vistas galeria-memes/memes/audios/curiosidades)
- Modify: `personal-hub/src/pages/Minecraft.js` (jerarquía h1/h2)
- Modify: `tests/prepush.test.js` (1 test)

- [ ] **Step 1: Write the failing test**

```js
test('interiores con cabecera y minecraft con h1-h2', async () => {
  const rincon = await readFile(projectPath('personal-hub', 'src', 'pages', 'Rincon.js'), 'utf8');
  for (const t of ['Galería', 'Memes', 'Audios', 'Curiosidades']) assert.ok(rincon.includes(t));
  const mc = await readFile(projectPath('personal-hub', 'src', 'pages', 'Minecraft.js'), 'utf8');
  assert.ok(mc.includes('<h1'));
  assert.ok(mc.includes('Nuestros mundos'));
});
```

- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3:** `renderPageHeader` en cada vista (iconos image/smile/mic/compass) sin tocar filtros/favoritos/lightbox/álbumes/admin; Minecraft: `h1` página + `h2` “Nuestros mundos”, resto intacto.
- [ ] **Step 4: Run** `npm test && npm run build` → PASS. **Step 5: Commit** `feat(rincon): cabeceras de interiores y minecraft`.

---

### Task 6: Verificación final

- [ ] **Step 1:** `npm test` (12+5 tests PASS) y `npm run build` OK.
- [ ] **Step 2:** checklist manual en sesión autorizada servida en dev (navegación tarjetas, carrusel sin autoplay, atrás, subnav, favoritos, edición admin, 360/390/768/1024/1280/1440 × 4 paletas, teclado + `aria-current`, sin overflow).
- [ ] **Step 3:** review final de rama; si hay findings Critical/Important → fix + re-review.
