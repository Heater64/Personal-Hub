/* Genera los PNG de vista previa de los widgets y apunta las fichas a ellos.
 *
 * El selector de widgets del launcher pinta `previewImage` (o, en Android 12+,
 * `previewLayout`): con el layout en vivo se veían los ceros y los guiones del
 * estado vacío. Aquí se dibuja cada composición con datos de ejemplo reales y
 * se guarda un PNG por tamaño en `drawable-nodpi`.
 *
 * Los colores son los mismos tokens de la paleta (widget_colors.xml / CSS);
 * si cambia la paleta, se cambia aquí y se vuelve a ejecutar:
 *
 *   node tools/widget-previews.mjs
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android/app/src/main/res');
const XML = join(RES, 'xml');
const OUT = join(RES, 'drawable-nodpi');
const DP = 3; // px por dp: xxxhdpi

const INK = '#0F0F10';
const PLUM = '#25172A';
const CORAL = '#C65A3A';
const CORAL_SOFT = '#E59277';
const ROSE = '#F3C5D0';
const MUTED = '#B3C9BBD1';
const WHITE = '#FFFFFF';

// El destacado ya no ocupa 4×3: es la composición horizontal de 4×2, igual
// que su layout. La miniatura tiene que medir lo mismo o el selector la
// recorta y parece otro widget.
const SIZES = { compact: [110, 110], rect: [250, 110], large: [220, 110] };
const FONT = 'Segoe UI, Arial, Helvetica, sans-serif';

const esc = text => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** Una línea de texto del widget, en dp. */
const line = (text, size, color = WHITE, extra = {}) => ({ text, size, color, ...extra });

/** Pila vertical centrada; devuelve el SVG de las líneas. */
function stack(lines, centerX, height, { anchor = 'middle', gap = 7 } = {}) {
  const total = lines.reduce((sum, item, i) => sum + item.size + (i < lines.length - 1 ? gap : 0), 0);
  let y = (height - total) / 2;
  return lines.map(item => {
    y += item.size;
    const el = `<text x="${centerX}" y="${y.toFixed(1)}" font-family="${FONT}"`
      + ` font-weight="${item.bold === false ? 400 : 700}" font-size="${item.size}"`
      + ` fill="${item.color}" text-anchor="${anchor}"`
      + `${item.track ? ` letter-spacing="${item.track}"` : ''}>${esc(item.text)}</text>`;
    y += gap;
    return el;
  }).join('\n');
}

/** Una línea de texto en coordenadas absolutas (dp). */
function text(value, x, y, size, color = WHITE, options = {}) {
  const { anchor = 'middle', bold = true, track = 0 } = options;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="${bold ? 700 : 400}"`
    + ` font-size="${size}" fill="${color}" text-anchor="${anchor}"`
    + `${track ? ` letter-spacing="${track}"` : ''}>${esc(value)}</text>`;
}

/** Dos caras superpuestas a la derecha (composiciones apaisadas). */
function faces(right, cy, r = 17) {
  return `<circle cx="${right - r * 2.5}" cy="${cy}" r="${r}" fill="${PLUM}" stroke="${ROSE}" stroke-width="2"/>`
    + `<circle cx="${right - r * 1.05}" cy="${cy}" r="${r}" fill="${PLUM}" stroke="${ROSE}" stroke-width="2"/>`;
}

/** Póster con forma de portada y un triángulo de reproducción. */
function poster(x, y, w, h) {
  const play = Math.min(w, h) * 0.28;
  // Ojo: el hex de SVG es RRGGBBAA, no AARRGGBB. Con el alfa delante el
  // borde salía verde turquesa en todas las miniaturas.
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#3A2A42" stroke="#F3C5D033"/>`
    + `<path d="M ${x + w / 2 - play / 3} ${y + h / 2 - play / 2} L ${x + w / 2 + play / 1.6} ${y + h / 2}`
    + ` L ${x + w / 2 - play / 3} ${y + h / 2 + play / 2} Z" fill="${ROSE}" opacity="0.9"/>`;
}

/** Caja de regalo dibujada (los emojis no se rasterizan igual en todas partes). */
function gift(cx, cy, size) {
  const w = size, h = size * 0.8;
  const x = cx - w / 2, y = cy - h / 2;
  return `<rect x="${x}" y="${y + h * 0.22}" width="${w}" height="${h * 0.78}" rx="3" fill="${CORAL}"/>`
    + `<rect x="${x - 2}" y="${y}" width="${w + 4}" height="${h * 0.28}" rx="3" fill="${CORAL_SOFT}"/>`
    + `<rect x="${cx - 2}" y="${y}" width="4" height="${h}" fill="${ROSE}"/>`
    + `<rect x="${x - 2}" y="${y + h * 0.26}" width="${w + 4}" height="2.5" fill="${ROSE}" opacity="0.75"/>`;
}

/** Cara sonriente para el ánimo. */
function smiley(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${CORAL}"/>`
    + `<circle cx="${cx - r * 0.32}" cy="${cy - r * 0.2}" r="${r * 0.09}" fill="${WHITE}"/>`
    + `<circle cx="${cx + r * 0.32}" cy="${cy - r * 0.2}" r="${r * 0.09}" fill="${WHITE}"/>`
    + `<path d="M ${cx - r * 0.36} ${cy + r * 0.16} Q ${cx} ${cy + r * 0.58} ${cx + r * 0.36} ${cy + r * 0.16}"`
    + ` fill="none" stroke="${WHITE}" stroke-width="${Math.max(2, r * 0.09)}" stroke-linecap="round"/>`;
}

/** Luna creciente: el bloque derecho del widget del ciclo. */
function moon(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ROSE}"/>`
    + `<circle cx="${cx + r * 0.42}" cy="${cy - r * 0.18}" r="${r * 0.88}" fill="#2A1B30"/>`;
}

/** Marco del widget: fondo, borde y barra de acento opcional. */
function frame(w, h, start, stroke, accent = false) {
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${INK}"/>`
    + `</linearGradient></defs>`
    + `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="26" fill="url(#bg)"`
    + ` stroke="${stroke}" stroke-width="1.5"/>`
    + (accent
      ? `<rect x="14" y="${h / 2 - 22}" width="3" height="44" rx="1.5" fill="${CORAL}"/>`
      : '');
}

const DISCREET = 'su móvil · 82 % · Wi-Fi';

const CONTENT = {
  days: {
    start: '#2A1B30', stroke: '#F3C5D030',
    compact: h => stack([
      line('DÍAS JUNTOS', 8, CORAL_SOFT, { track: 1.1 }),
      line('503', 40),
      line('días', 9, ROSE),
    ], 55, h),
    rect: h => frame(250, h, '#2A1B30', '#F3C5D030', true)
      + faces(240, h / 2, 15)
      + text('DÍAS JUNTOS', 32, 40, 8, CORAL_SOFT, { anchor: 'start', track: 1 })
      + text('503', 32, 76, 30, WHITE, { anchor: 'start' })
      + text('1 año y 4 meses', 32, 94, 9, MUTED, { anchor: 'start', bold: false }),
    large: h => frame(220, h, '#2A1B30', '#F3C5D030', true)
      + faces(212, h / 2, 17)
      + text('DÍAS JUNTOS', 32, 32, 9, CORAL_SOFT, { anchor: 'start', track: 1.2 })
      + text('503', 32, 74, 42, WHITE, { anchor: 'start' })
      + text('días', 112, 74, 12, CORAL, { anchor: 'start' })
      + text('1 año y 4 meses', 32, 92, 9, MUTED, { anchor: 'start', bold: false }),
  },
  distance: {
    start: '#1E1A24', stroke: '#E5927730',
    compact: h => stack([line('ESTÁIS A', 8, CORAL_SOFT, { track: 1 }), line('412 km', 30), line('hace 2 min', 8, MUTED, { bold: false })], 55, h),
    rect: h => frame(250, h, '#1E1A24', '#E5927730', true)
      + faces(240, h / 2, 15)
      + text('ESTÁIS A', 32, 36, 8, CORAL_SOFT, { anchor: 'start', track: 1 })
      + text('412 km', 32, 70, 28, WHITE, { anchor: 'start' })
      + text('hace 2 min', 32, 86, 9, MUTED, { anchor: 'start', bold: false })
      + text(DISCREET, 32, 100, 8, ROSE, { anchor: 'start', bold: false }),
    large: h => frame(220, h, '#1E1A24', '#E5927730', true)
      + faces(210, h / 2, 16)
      + text('ESTÁIS A', 32, 26, 9, CORAL_SOFT, { anchor: 'start', track: 1 })
      + text('412 km', 32, 66, 34, WHITE, { anchor: 'start' })
      + text('hace 2 min', 32, 84, 9, MUTED, { anchor: 'start', bold: false })
      + text(DISCREET, 32, 98, 8, ROSE, { anchor: 'start', bold: false }),
  },
  countdown: {
    start: '#2C1B22', stroke: '#C65A3A30',
    compact: h => stack([line('Aniversario', 8, CORAL_SOFT), line('227', 34), line('días', 10, ROSE)], 55, h),
    rect: (h) => frame(250, h, '#2C1B22', '#C65A3A30', true) + stack([
      line('Aniversario', 8, CORAL_SOFT),
      line('227 días', 34),
      line('3 jul 2027', 9, MUTED, { bold: false }),
    ], 154, h, { anchor: 'start' }),
    large: h => frame(220, h, '#2C1B22', '#C65A3A30', true)
      + text('Aniversario', 32, 28, 9, CORAL_SOFT, { anchor: 'start', track: 1 })
      + text('227', 32, 72, 42, WHITE, { anchor: 'start' })
      + text('días', 116, 72, 12, ROSE, { anchor: 'start' })
      + text('3 jul 2027', 32, 90, 9, MUTED, { anchor: 'start', bold: false }),
  },
  mood: {
    start: '#2A1B30', stroke: '#F3C5D030',
    compact: h => smiley(55, 38, 20)
      + text('contento', 55, 78, 12)
      + text('hoy', 55, 94, 8, MUTED, { bold: false }),
    rect: h => smiley(48, 55, 22)
      + text('HOY', 86, 38, 8, ROSE, { anchor: 'start', track: 1.2 })
      + text('contento', 86, 66, 16, WHITE, { anchor: 'start' })
      + text('hoy', 86, 82, 9, MUTED, { anchor: 'start', bold: false }),
    large: h => frame(220, h, '#2A1B30', '#F3C5D030', true)
      + smiley(190, h / 2, 22)
      + text('ESTADO DE ÁNIMO', 32, 32, 9, ROSE, { anchor: 'start', track: 1.2 })
      + text('contento', 32, 68, 20, WHITE, { anchor: 'start' })
      + text('hoy', 32, 86, 9, MUTED, { anchor: 'start', bold: false }),
  },
  cycle: {
    start: '#2A1B30', stroke: '#F3C5D030',
    compact: h => stack([line('CICLO', 8, ROSE, { track: 1.2 }), line('12', 26), line('Fase lútea', 9, ROSE, { bold: false })], 55, h),
    rect: h => frame(250, h, '#2A1B30', '#F3C5D030', true) + stack([
      line('CICLO', 8, CORAL_SOFT, { track: 1 }),
      line('Fase lútea', 13),
      line('día 12 de ~28', 9, ROSE, { bold: false }),
      line('próxima regla en 16 d', 8, MUTED, { bold: false }),
    ], 154, h, { anchor: 'start' }),
    large: h => frame(220, h, '#2A1B30', '#F3C5D030', true)
      + moon(190, h / 2, 22)
      + text('CICLO', 32, 26, 9, CORAL_SOFT, { anchor: 'start', track: 1.2 })
      + text('Fase lútea', 32, 56, 18, WHITE, { anchor: 'start' })
      + text('día 12 de ~28', 32, 74, 10, ROSE, { anchor: 'start', bold: false })
      + text('próxima regla en 16 d', 32, 90, 8, MUTED, { anchor: 'start', bold: false }),
  },
  watching: {
    start: '#241A2C', stroke: '#E5927730',
    compact: () => `<g transform="translate(10,25)">${poster(0, 0, 44, 60)}</g>`
      + text('Dragon', 60, 48, 8, WHITE, { anchor: 'start' })
      + text('Ball Super', 60, 60, 8, WHITE, { anchor: 'start' })
      + text('Ep. 4 de 10', 60, 74, 6.5, MUTED, { anchor: 'start', bold: false }),
    rect: h => `<g transform="translate(14,19)">${poster(0, 0, 52, 72)}</g>`
      + stack([
        line('SEGUIR VIENDO', 8, CORAL_SOFT, { track: 1 }),
        line('Dragon Ball Super', 13),
        line('Ep. 4 de 10', 9, MUTED, { bold: false }),
        line('40 % visto', 9, ROSE, { bold: false }),
      ], 190, h, { anchor: 'start' }),
    large: () => `<g transform="translate(14,19)">${poster(0, 0, 52, 72)}</g>`
      + text('SEGUIR VIENDO', 78, 28, 9, CORAL_SOFT, { anchor: 'start', track: 1 })
      + text('Dragon Ball Super', 78, 52, 15, WHITE, { anchor: 'start' })
      + text('Ep. 4 de 10', 78, 72, 9, MUTED, { anchor: 'start', bold: false })
      + text('40 % visto', 78, 90, 9, ROSE, { anchor: 'start', bold: false }),
  },
  gifts: {
    start: '#2C1B22', stroke: '#C65A3A30',
    compact: () => gift(55, 32, 22)
      + text('1', 55, 74, 24)
      + text('sorpresa', 55, 90, 8, ROSE, { bold: false }),
    rect: h => frame(250, h, '#2C1B22', '#C65A3A30', true) + stack([
      line('HOY', 8, CORAL_SOFT, { track: 1 }),
      line('1 sorpresa', 26),
      line('en el calendario', 9, MUTED, { bold: false }),
    ], 154, h, { anchor: 'start' }),
    large: h => frame(220, h, '#2C1B22', '#C65A3A30', true)
      + gift(190, h / 2, 26)
      + text('HOY', 32, 26, 9, CORAL_SOFT, { anchor: 'start', track: 1.2 })
      + text('1', 32, 68, 42, WHITE, { anchor: 'start' })
      + text('sorpresa', 56, 68, 12, ROSE, { anchor: 'start' })
      + text('en el calendario', 32, 86, 8, MUTED, { anchor: 'start', bold: false }),
  },
};

function svg(kind, size) {
  const spec = CONTENT[kind];
  const [w, h] = SIZES[size];
  const facesSVG = size === 'compact' ? ''
    : `<g transform="translate(0,${size === 'rect' ? 0 : -6})">${faces(w - 12, size === 'rect' ? h / 2 : 52)}</g>`;
  const body = spec[size](size === 'compact' ? h : h, facesSVG);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * DP}" height="${h * DP}"`
    + ` viewBox="0 0 ${w} ${h}">${frame(w, h, spec.start, spec.stroke)}${body}</svg>`;
}

mkdirSync(OUT, { recursive: true });

const done = [];
for (const kind of Object.keys(CONTENT)) {
  for (const size of Object.keys(SIZES)) {
    const file = join(OUT, `widget_preview_${kind}_${size}.png`);
    await sharp(Buffer.from(svg(kind, size)))
      .resize(SIZES[size][0] * DP, SIZES[size][1] * DP)
      .png()
      .toFile(file);
    done.push(file.replace(ROOT, '').replace(/\\/g, '/'));
  }
}

// Las fichas pasan de `previewLayout` (layout en vivo con ceros) a `previewImage`.
let touched = 0;
for (const name of readdirSync(XML)) {
  const match = name.match(/^widget_(days|distance|countdown|mood|cycle|watching|gifts)(?:_(compact|rect))?_info\.xml$/);
  if (!match) continue;
  const kind = match[1];
  const size = match[2] || 'large';
  const file = join(XML, name);
  let xml = readFileSync(file, 'utf8');
  const attr = `android:previewImage="@drawable/widget_preview_${kind}_${size}"`;
  if (xml.includes('android:previewLayout=')) {
    xml = xml.replace(/android:previewLayout="[^"]*"/, attr);
  } else if (!xml.includes('android:previewImage=')) {
    xml = xml.replace(
      '<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"',
      `<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"\n    ${attr}`,
    );
  }
  writeFileSync(file, xml);
  touched += 1;
}

console.log(`OK: ${done.length} PNG en drawable-nodpi, ${touched} fichas con previewImage`);
