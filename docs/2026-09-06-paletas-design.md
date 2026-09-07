# 4 Paletas en Personal Hub — Design Spec

**Fecha:** 2026-09-06 · **Enfoque aprobado:** A (dual atributo, `data-theme` intacto)
**Objetivo:** elegir entre 4 paletas (Umbra Oscuro, Umbra Claro, Azul Claro, Azul Oscuro) + Auto, desde Perfil > Apariencia, con los juegos heredando modo y acento.

## 1. Las 4 paletas

| id (`ph.theme`) | Nombre UI | Base modo | Acento |
|----|-----------|-----------|--------|
| `umbra-oscuro` (legacy `dark`) | Umbra Oscuro | dark actual `#0a0a0c` | coral `#e8735a` |
| `umbra-claro` (legacy `light`) | Umbra Claro | light actual porcelana `#faf6f8` | frambuesa `#c2185b` |
| `azul-claro` | Azul Claro | light porcelana | azul `#2563EB` |
| `azul-oscuro` | Azul Oscuro | dark `#0a0a0c` | azul luminoso `#7DB7FF` |
| `auto` (legacy) | Automático | según SO | familia Umbra |

- `data-theme` = modo (`light|dark`, resuelto; Auto borra→resuelve por SO). NO se toca ningún selector existente (160 usos + `dist/` se regenera).
- `data-tema` = familia (`umbra|azul`; ausente = umbra). Solo overrides de acento + matices.
- Base dark y `[data-theme="light"]` de `design-tokens.css` intactos (= Umbra).

## 2. Arquitectura

- Fuente visual: `personal-hub/src/styles/design-tokens.css` (solo se añaden bloques `[data-tema="azul"]` y `[data-tema="azul"][data-theme="light"]` al final).
- Lógica: `src/services/theme.service.js` (`ph.theme`, normaliza legacy, escribe dual, `color-scheme` + meta por paleta, listener Auto).
- UI: `src/pages/Profile.js` (grid 2x2 con previews + Auto) + `src/pages/Admin.js` (segmented 5) + CSS correspondiente.
- Arranque: `personal-hub/index.html` inline (mismo mapa dual mínimo) + `offline.html` sin cambios.
- Juegos (`public/games/` + `_postgame.js`): sin tocar; heredan `data-theme` modo y las variables que ya usan.

## 3. Data flow y compat

- Guardado: `ph.theme` ∈ {4 ids, `auto`}; `dark`→`umbra-oscuro`, `light`→`umbra-claro` al leer.
- `isDark()` por modo resuelto; meta theme-color por paleta (umbra-oscuro `#0c0b0b`, umbra-claro `#fdf4f6`, azul-oscuro `#0B1020`, azul-claro `#faf6f8`). Nota: las bases de fondo Umbra (`#0a0a0c` dark / porcelana light en §1) quedan intactas; estos valores son solo la meta del navegador.
- Sin migración; `dist/` se regenera con el build.

## 4. Testing

- `tests/prepush.test.js` (node --test): añadir asserts de tokens (bloques data-tema azul), servicio (normalización + dual-write) y marcado (4 paletas + auto en Profile y Admin).
- Manual: 360/390/768/1024/1280, ambos modos × ambas familias, teclado, juegos (snake/tetris) en claro+azul.

## 5. Archivos a tocar

1. `personal-hub/src/styles/design-tokens.css` (overrides familia azul)
2. `personal-hub/src/services/theme.service.js` (4 ids + dual + legacy)
3. `personal-hub/src/pages/Profile.js` + CSS (grid 2x2 + Auto)
4. `personal-hub/src/pages/Admin.js` + CSS (segmented 5)
5. `personal-hub/index.html` (inline dual mínimo)
6. `tests/prepush.test.js` (asserts nuevos)
