/* Copia la paleta de los widgets desde el CSS a `widget_colors.xml`.
 *
 * La fuente única es el bloque `widget-tokens` de home.css (variables CSS que
 * usa la vista previa). Android necesita las mismas como recursos, así que se
 * generan; así no hay dos listas de colores que se separen con el tiempo.
 *
 *   node tools/sync-widget-tokens.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(ROOT, 'personal-hub/src/styles/home.css');
const XML = join(ROOT, 'android/app/src/main/res/values/widget_colors.xml');

const css = readFileSync(CSS, 'utf8');
const block = css.match(/\/\* widget-tokens:start \*\/([\s\S]*?)\/\* widget-tokens:end \*\//);
if (!block) {
  console.error('No encuentro el bloque widget-tokens en home.css');
  process.exit(1);
}

// `--widget-coral-soft` → `widget_coral_soft`: los nombres de recurso son
// snake_case, igual que el resto de las referencias de los layouts.
const tokens = [...block[1].matchAll(/--widget-([a-z-]+):\s*(#[0-9A-Fa-f]{6,8})/g)]
  .map(([, name, value]) => [name.replace(/-/g, '_'), value.toUpperCase()]);

if (!tokens.length) {
  console.error('El bloque widget-tokens no tiene colores');
  process.exit(1);
}

const lines = tokens.map(([name, value]) => `    <color name="widget_${name}">${value}</color>`).join('\n');
const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Paleta de los widgets: GENERADA por tools/sync-widget-tokens.mjs desde el
     bloque widget-tokens de home.css. No editar a mano: cambia el CSS y
     vuelve a ejecutar el script. -->
<resources>
${lines}
</resources>
`;

writeFileSync(XML, xml);
console.log(`OK: ${tokens.length} colores sincronizados en widget_colors.xml`);
