/* ==========================================
   Fase 4 — rendimiento del arranque

   El arranque tiene que llevar solo lo que se ve desde el primer fotograma.
   Estas comprobaciones son la red que impide que una hoja o una pantalla
   vuelvan al bundle inicial sin que nadie lo note (medido en la entrega:
   JS 427,32 → 253,65 kB y CSS 223,83 → 91,36 kB).

   1. `main.css` no importa hojas de pantalla: cada una viaja en su chunk.
   2. Las pantallas pesadas se montan con `lazy()`; Login sigue estático.
   3. KaTeX no viaja en `index.html`: lo pide el calendario bajo demanda.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL(`../personal-hub/${ruta}`, import.meta.url), 'utf8');

const mainCss = leer('src/styles/main.css');
const mainJs = leer('src/main.js');
const indexHtml = leer('index.html');
const renderMath = leer('src/utils/renderMath.js');
const calendario = leer('src/pages/Calendario.js');

test('main.css solo trae lo compartido: ninguna hoja de pantalla', () => {
  const dePantalla = [
    'home.css',
    'login.css',
    'profile.css',
    'razones.css',
    'maldia.css',
    'juntos.css',
    'mapa.css',
    'calendario.css',
    'sentimientos.css',
    'rincon.css',
    'admin.css',
  ];
  for (const hoja of dePantalla) {
    assert.ok(!mainCss.includes(hoja), `main.css no debe importar ${hoja}`);
  }

  // Lo transversal sigue ahí: sin esto la app arranca sin estilos.
  for (const compartido of ['design-tokens.css', 'reset.css', 'ui.css', 'nav.css', 'lightbox.css']) {
    assert.ok(mainCss.includes(compartido), `main.css debe conservar ${compartido}`);
  }
});

test('cada pantalla carga su propia hoja desde su módulo', () => {
  const propias = {
    'pages/Home.js': 'home.css',
    'pages/Login.js': 'login.css',
    'pages/Profile.js': 'profile.css',
    'pages/Razones.js': 'razones.css',
    'pages/MalDia.js': 'maldia.css',
    'pages/Juntos.js': 'juntos.css',
    'pages/Mapa.js': 'mapa.css',
  };
  for (const [pagina, hoja] of Object.entries(propias)) {
    assert.ok(
      leer(`src/${pagina}`).includes(`import '../styles/${hoja}';`),
      `${pagina} debe importar ${hoja}`
    );
  }
});

test('las pantallas pesadas se montan con lazy() y Login no espera chunk', () => {
  assert.ok(mainJs.includes('const lazy = (loader)'), 'existe el helper lazy');
  assert.ok(mainJs.includes("from './pages/Login.js'"), 'Login sigue estático');

  for (const pagina of ['Home', 'Profile', 'Razones', 'MalDia']) {
    assert.ok(
      !mainJs.includes(`from './pages/${pagina}.js'`),
      `${pagina} no puede volver al bundle de arranque`
    );
    assert.match(
      mainJs,
      new RegExp(`import\\('\\./pages/${pagina}\\.js'\\)`),
      `${pagina} debe cargarse con import()`
    );
  }
});

test('KaTeX no se carga en index.html: lo pide el calendario', () => {
  assert.doesNotMatch(indexHtml, /katex\.min\.(js|css)/, 'index.html no debe cargar KaTeX');
  assert.doesNotMatch(indexHtml, /<script[^>]+src="https?:/, 'ningún script externo en el arranque');

  assert.match(renderMath, /export function loadKatex\(/, 'renderMath expone la carga bajo demanda');
  assert.match(renderMath, /cdn\.jsdelivr\.net\/npm\/katex/, 'y de ahí sale KaTeX');
  assert.match(renderMath, /typeof katex !== 'undefined'/, 'sin KaTeX el texto se pinta igual (respaldo)');
  assert.match(calendario, /loadKatex\(\)/, 'el calendario es quien lo pide');
});

test('los orígenes que ya no se usan al arrancar salen del preconnect', () => {
  for (const origen of ['dragonballlatino', 'i.scdn.co', 'images.genius.com', 'i.ytimg.com']) {
    assert.ok(!indexHtml.includes(origen), `${origen} ya no se toca al arrancar`);
  }
  // Los que sí se usan desde el primer segundo siguen precalentados.
  for (const origen of ['fonts.gstatic.com', 'res.cloudinary.com', 'supabase.co']) {
    assert.ok(indexHtml.includes(origen), `falta el preconnect a ${origen}`);
  }
});
