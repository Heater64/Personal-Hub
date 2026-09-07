# 4 Paletas Personal Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 paletas elegibles (Umbra Oscuro/Claro, Azul Oscuro/Claro) + Auto en Personal Hub, con juegos heredando modo y acento.

**Architecture:** dual atributo: `data-theme` modo (`light|dark`, intacto — 160 usos + games sin tocar) + `data-tema` familia (`umbra|azul`, ausente = umbra). Tokens Umbra intactos; solo overrides azules al final de `design-tokens.css`.

**Tech Stack:** HTML + CSS (tokens `var(--*)`, Umbra) + JS nativo ES Modules + `node:test` (`npm test` = `node --test tests/prepush.test.js`).

## Global Constraints

- Estilo Umbra siempre: tokens `var(--*)`, radio 22px paneles, coral solo acciones, sin hex fuera de tokens (previews ornamentales sí).
- `data-theme` solo `light|dark`; ningún selector existente se reescribe; `dist/` no se toca (se regenera).
- Sin scripts inline nuevos (solo editar el existente de `index.html`); sin `console.log`; toque ≥48px; `radiogroup` + `aria-checked`; `prefers-reduced-motion`.
- `dark`→`umbra-oscuro`, `light`→`umbra-claro` al leer; `auto` = familia Umbra + modo según SO.

---

### Task 1: Tokens familia azul + tests base

**Files:**
- Modify: `personal-hub/src/styles/design-tokens.css` (SOLO añadir al final)
- Modify: `tests/prepush.test.js` (añadir 1 test, estilo `node:test` + `assert/strict` + `readFile` existente)
- Test: `tests/prepush.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: bloques `[data-tema="azul"]` y `[data-tema="azul"][data-theme="light"]`; IDs `azul-claro|azul-oscuro` para Task 2/3.

- [ ] **Step 1: Write the failing test** (añadir al final de `tests/prepush.test.js`):

```js
test('la familia azul existe como override por data-tema (modo intacto)', async () => {
  const css = await readFile(projectPath('personal-hub', 'src', 'styles', 'design-tokens.css'), 'utf8');
  for (const s of ['[data-tema="azul"]', '#2563EB', '#7DB7FF']) assert.match(css, new RegExp(s.replace(/[[\]]/g, '\\$&')));
  assert.match(css, /\[data-theme="light"\]/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL solo el test nuevo.

- [ ] **Step 3: Write minimal implementation**

Leer el final de `design-tokens.css` (bloque `[data-theme="light"]`, tokens `--accent`, `--accent-hover`, `--accent-pressed`, `--accent-dim`, `--accent-dim-strong`, `--glow-accent` y focus ring si existe) y añadir al FINAL:

```css
/* ===== Familia AZUL (override sobre Umbra; el modo lo sigue dando data-theme) ===== */
:root[data-tema="azul"] {
  --accent: #7DB7FF;
  --accent-hover: #A8D1FF;
  --accent-pressed: #4B8BD8;
  --accent-dim: rgba(125,183,255,.12);
  --accent-dim-strong: rgba(125,183,255,.22);
  --glow-accent: 0 0 20px rgba(125,183,255,.15);
}
:root[data-tema="azul"][data-theme="light"] {
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --accent-pressed: #1E40AF;
  --accent-dim: rgba(37,99,235,.12);
  --accent-dim-strong: rgba(37,99,235,.22);
  --glow-accent: 0 0 20px rgba(37,99,235,.15);
}
```

(Si algún token no existe con ese nombre exacto en el archivo, mapear al equivalente real; no renombrar nada existente.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS todo.

- [ ] **Step 5: Commit**

```bash
git add personal-hub/src/styles/design-tokens.css tests/prepush.test.js
git commit -m "feat(paletas): tokens familia azul por data-tema"
```

---

### Task 2: Servicio 4 ids + dual + arranque

**Files:**
- Modify: `personal-hub/src/services/theme.service.js`
- Modify: `personal-hub/index.html` (script inline líneas 5-20, mínimo)
- Modify: `tests/prepush.test.js` (añadir 1 test)
- Test: `tests/prepush.test.js`

**Interfaces:**
- Consumes: IDs de Task 1.
- Produces: `ph.theme` ∈ {`umbra-oscuro`,`umbra-claro`,`azul-claro`,`azul-oscuro`,`auto`} + escritura dual para Task 3.

- [ ] **Step 1: Write the failing test**

```js
test('el servicio de temas maneja 4 paletas con escritura dual y legacy', async () => {
  const svc = await readFile(projectPath('personal-hub', 'src', 'services', 'theme.service.js'), 'utf8');
  for (const s of ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro', 'dataset.tema', 'dataset.theme']) assert.ok(svc.includes(s));
  const boot = await readFile(projectPath('personal-hub', 'index.html'), 'utf8');
  assert.ok(boot.includes('dataset.tema'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL solo el nuevo.

- [ ] **Step 3: Write minimal implementation**

`theme.service.js` (conservar listeners, `onChange`, `isDark` por modo resuelto):
```js
const THEMES = ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro', 'auto'];
function normalize(t) {
  if (t === 'dark') return 'umbra-oscuro';
  if (t === 'light') return 'umbra-claro';
  return THEMES.includes(t) ? t : 'auto';
}
// _applyTheme(id|auto): resuelve modo (/-oscuro$/ o auto→SO) y familia (azul-*→'azul', resto→borra data-tema)
```
`apply(id)`: `data-theme` = `/-oscuro$/.test(id) ? 'dark' : 'light'` (auto→SO por `prefers-color-scheme: light`); `data-tema` = id empieza por `azul-` ? `'azul'` : ausente. Meta por paleta: umbra-oscuro `#0c0b0b`, umbra-claro `#fdf4f6`, azul-oscuro `#0B1020`, azul-claro `#faf6f8`. `getAvailable()` → las 4 + `auto`. `setTheme` valida con `normalize`. `isDark()` por modo resuelto (incluye `azul-oscuro`).

`index.html` inline: mismo `normalize` mínimo + escritura dual + meta por paleta; sin elección → no fija nada (el `data-theme="dark"` del `<html>` ya es el default).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add personal-hub/src/services/theme.service.js personal-hub/index.html tests/prepush.test.js
git commit -m "feat(paletas): servicio 4 ids con escritura dual y legacy"
```

---

### Task 3: Selector elegante en Perfil + Admin

**Files:**
- Modify: `personal-hub/src/pages/Profile.js` (bloque `#themeOptions`, líneas ~150-153 y 204-210; handler ~342)
- Modify: CSS de `.prof-theme-*` (buscar dónde vive: provavelmente `personal-hub/src/styles/profile.css`)
- Modify: `personal-hub/src/pages/Admin.js` (segmented líneas ~2956 y 2973-2974, handler 3067-3073)
- Modify: `tests/prepush.test.js` (añadir 1 test)
- Test: `tests/prepush.test.js`

**Interfaces:**
- Consumes: IDs + `theme.setTheme/getAvailable` de Task 2.
- Produces: UI final; nada posterior.

- [ ] **Step 1: Write the failing test**

```js
test('perfil y admin ofrecen las 4 paletas + auto', async () => {
  const profile = await readFile(projectPath('personal-hub', 'src', 'pages', 'Profile.js'), 'utf8');
  for (const s of ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro']) assert.ok(profile.includes(s));
  const admin = await readFile(projectPath('personal-hub', 'src', 'pages', 'Admin.js'), 'utf8');
  for (const s of ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro']) assert.ok(admin.includes(s));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Perfil: `themeIcons`/`themeLabels` con las 4 (`umbra-oscuro` 🌙 Umbra Oscuro, `umbra-claro` ☀️ Umbra Claro, `azul-claro` 💧 Azul Claro, `azul-oscuro` 🌊 Azul Oscuro) + `auto` 🖥️; grid 2x2 con mini-preview (3 franjas inline con fondo/borde/acento reales de cada paleta) + fila Auto; `radiogroup` + `aria-checked`; click → `theme.setTheme(id)` (solo iconos existentes en `UI`, no inventar).
CSS: `.prof-theme-grid` (2 col, gap tokens), `.prof-theme-btn` tarjeta radio-22px token, `--activo` con borde acento, `reduced-motion` sin transición. Reutilizar `.prof-theme-btn` existente, no duplicar sistema.

Admin: segmented con las 5 opciones (mismo mapa id→label con emoji); handler `theme.setTheme` intacto (ya delega) + toast con nombre bonito.

- [ ] **Step 4: Run tests + verificación manual**

Run: `npm test`
Expected: PASS.
Manual en servidor dev: 4 paletas persisten tras recarga, Auto sigue al SO, juegos (snake/tetris) heredan modo, 360/768/1024 sin overflow, Tab+Enter.

- [ ] **Step 5: Commit**

```bash
git add personal-hub/src/pages/Profile.js personal-hub/src/pages/Admin.js personal-hub/src/styles/profile.css tests/prepush.test.js
git commit -m "feat(paletas): selector elegante 2x2 en perfil y admin"
```
(Ajustar la ruta del CSS a la real si vive en otro archivo.)
