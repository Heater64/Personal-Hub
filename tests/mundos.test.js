/* ==========================================
   Mundos — contrato de la agrupación de tarjetas

   La fase 3 agrupa los módulos que YA existen por mundos, dentro de Rincón
   y Sentimientos. No hay rutas nuevas ni pantallas nuevas: una etiqueta por
   grupo. Este test fija cuatro cosas para que la agrupación no se degrade:

   1. Los siete mundos de la misión existen, en orden.
   2. Toda tarjeta de los dos hubs tiene mundo asignado.
   3. El mapa no inventa módulos que no existen en las pantallas.
   4. Nada se pierde al agrupar: un módulo sin mundo cae en «Más».
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MUNDOS,
  MUNDO_DE,
  mundoDe,
  agruparPorMundo,
} from '../tamp/src/data/mundos.data.js';

const leer = ruta => readFileSync(new URL(`../tamp/src/${ruta}`, import.meta.url), 'utf8');

/** Ids de un array literal del código fuente, sin evaluar el módulo. */
function idsDeArray(src, marca) {
  const inicio = src.indexOf(marca);
  assert.notEqual(inicio, -1, `no se encontró «${marca}»`);
  // El cierre del array va en su propia línea: dentro de los getPreview()
  // también hay `];` (por ejemplo `...GATO_IMG];`).
  const fin = src.indexOf('\n];', inicio);
  return [...src.slice(inicio, fin).matchAll(/\bid:\s*'([^']+)'/g)].map(m => m[1]);
}

const sectionsSrc = leer('pages/rincon/sections.data.js');
const sentimientosSrc = leer('pages/Sentimientos.js');
const landingSrc = leer('pages/rincon/landing.js');
const routesSrc = leer('routes.js');
const uiCss = leer('styles/ui.css');

const idsRincon = idsDeArray(sectionsSrc, 'export const SECTIONS = [');
const idsSentimientos = idsDeArray(sentimientosSrc, 'const CARDS = [');

test('los siete mundos de la misión existen y van en orden', () => {
  assert.deepEqual(
    MUNDOS.map(m => m.label),
    [
      'Recuerdos',
      'Sentimientos',
      'Planes',
      'Entretenimiento',
      'Bienestar',
      'Vida cotidiana',
      'Creatividad',
    ]
  );
  assert.equal(new Set(MUNDOS.map(m => m.id)).size, MUNDOS.length, 'ids únicos');
  for (const mundo of MUNDOS) assert.ok(mundo.hint, `el mundo ${mundo.id} necesita una pista`);
});

test('cada tarjeta de Rincón tiene su mundo', () => {
  assert.ok(idsRincon.length >= 6, `se esperaban al menos 6 tarjetas, hay ${idsRincon.length}`);
  for (const id of idsRincon) {
    assert.ok(mundoDe(id), `la tarjeta ${id} de Rincón no tiene mundo asignado`);
  }
});

test('cada tarjeta de Sentimientos tiene su mundo', () => {
  assert.ok(idsSentimientos.length >= 5, `se esperaban al menos 5 tarjetas, hay ${idsSentimientos.length}`);
  for (const id of idsSentimientos) {
    assert.ok(mundoDe(id), `la tarjeta ${id} de Sentimientos no tiene mundo asignado`);
  }
});

test('el mapa no inventa módulos', () => {
  const reales = new Set([...idsRincon, ...idsSentimientos]);
  for (const id of Object.keys(MUNDO_DE)) {
    assert.ok(reales.has(id), `MUNDO_DE apunta a «${id}», que no es ninguna tarjeta`);
  }
  for (const id of Object.values(MUNDO_DE)) {
    assert.ok(MUNDOS.some(m => m.id === id), `«${id}» no es un mundo declarado`);
  }
});

test('agrupar respeta el orden de los mundos y no pierde tarjetas', () => {
  const tarjetas = idsRincon.concat(idsSentimientos).map(id => ({ id }));
  const grupos = agruparPorMundo(tarjetas);

  assert.deepEqual(
    grupos.map(g => g.id),
    MUNDOS.map(m => m.id).filter(id => grupos.some(g => g.id === id)),
    'los grupos salen en el orden de MUNDOS'
  );

  const recuperadas = grupos.flatMap(g => g.items.map(i => i.id)).sort();
  assert.deepEqual(recuperadas, [...new Set(tarjetas.map(t => t.id))].sort(), 'nada se queda fuera');
  assert.equal(new Set(recuperadas).size, recuperadas.length, 'ninguna tarjeta se duplica');
});

test('un módulo sin mundo no desaparece: cae en «Más»', () => {
  const grupos = agruparPorMundo([{ id: 'razones' }, { id: 'modulo-nuevo' }]);
  const ultimo = grupos[grupos.length - 1];
  assert.equal(ultimo.id, 'mas');
  assert.deepEqual(ultimo.items, [{ id: 'modulo-nuevo' }]);
});

test('los mundos vacíos no se pintan', () => {
  const grupos = agruparPorMundo([{ id: 'ositos' }]);
  assert.deepEqual(grupos.map(g => g.id), ['creatividad']);
});

test('agrupar tolera listas raras sin romper', () => {
  assert.deepEqual(agruparPorMundo([]), []);
  assert.deepEqual(agruparPorMundo(null), []);
  const grupos = agruparPorMundo([null, {}, { id: 'juegos' }]);
  assert.equal(grupos[0].id, 'entretenimiento');
  assert.deepEqual(grupos[0].items, [{ id: 'juegos' }]);
});

test('Rincón pinta los mundos con la etiqueta compartida', () => {
  assert.match(landingSrc, /agruparPorMundo\(/, 'Rincón debe usar la agrupación compartida');
  assert.match(landingSrc, /class="mundo"/, 'Rincón necesita el contenedor de mundo');
  assert.match(landingSrc, /class="mundo-title"/, 'Rincón necesita el título de mundo');
});

test('Sentimientos es una lista plana de accesos, sin etiquetas de mundo', () => {
  // Decisión de producto: el hub enseña sus cinco accesos seguidos, con el
  // título y el subtítulo de la página, no agrupados por mundo.
  assert.doesNotMatch(sentimientosSrc, /agruparPorMundo\(/);
  assert.doesNotMatch(sentimientosSrc, /class="mundo"/);
  assert.match(sentimientosSrc, /title: 'Sentimientos'/);
  assert.match(sentimientosSrc, /subtitle: 'Cómo estamos y qué nos hace bien'/);
});

test('la etiqueta de mundo es un componente único, con tokens y sin colores sueltos', () => {
  const bloque = uiCss.slice(uiCss.indexOf('.mundo {'), uiCss.indexOf('@keyframes ui-fade'));
  assert.ok(bloque.length > 100, 'el componente .mundo vive en ui.css');
  assert.match(bloque, /\.mundo-title\s*\{/);
  assert.match(bloque, /var\(--fs-xs\)/, 'el tamaño sale de los tokens');
  assert.match(bloque, /var\(--text-2\)/, 'el color sale de los tokens');
  assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}\b/, 'nada de colores a mano');
});

test('no se añadió ninguna pestaña ni ruta de Mundos', () => {
  assert.doesNotMatch(routesSrc, /path:\s*'\/mundos'/, 'la agrupación no crea una ruta nueva');
  assert.doesNotMatch(routesSrc, /label:\s*'Mundos'/, 'ni una pestaña nueva');
});
