/* ==========================================
   Fase 3 — cabecera, estados, transiciones y búsqueda

   Fija las cuatro piezas que la fase añade para que no se degraden:

   1. Una sola cabecera de pantalla (`renderPageHeader`) con título,
      subtítulo opcional, acciones y botón de volver.
   2. Estados vacíos y skeletons compartidos, aplicados donde hay carga
      asíncrona o listas que pueden quedar vacías.
   3. Transición de ruta corta que con `prefers-reduced-motion` no anima.
   4. Búsqueda global que solo encuentra módulos reales, filtrada por rol y
      accesible desde la navegación actual, sin pestaña nueva.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL(`../personal-hub/src/${ruta}`, import.meta.url), 'utf8');

/* `states.js` reutiliza `icon()` de ui.js, que espera un navegador. Lo que se
   comprueba aquí es el marcado que devuelve, así que basta con un DOM mínimo:
   el comportamiento real se verificó en el navegador. */
const noop = () => {};
const nodo = () =>
  new Proxy(
    {
      style: {},
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      dataset: {},
      children: [],
      appendChild: noop,
      append: noop,
      addEventListener: noop,
      removeEventListener: noop,
      setAttribute: noop,
      removeAttribute: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      insertAdjacentHTML: noop,
      remove: noop,
      focus: noop,
      innerHTML: '',
      textContent: '',
      value: '',
    },
    { get: (target, key) => (key in target ? target[key] : noop) }
  );

globalThis.window = {
  ...globalThis.window,
  addEventListener: noop,
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  requestAnimationFrame: fn => fn?.(),
  cancelAnimationFrame: noop,
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  innerWidth: 1024,
  innerHeight: 768,
  scrollTo: noop,
};
globalThis.document = {
  addEventListener: noop,
  removeEventListener: noop,
  createElement: () => nodo(),
  createElementNS: () => nodo(),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: nodo(),
  head: nodo(),
  documentElement: nodo(),
  hidden: false,
  visibilityState: 'visible',
  readyState: 'complete',
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.matchMedia = globalThis.window.matchMedia;
globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
globalThis.HTMLElement = globalThis.HTMLElement || class {};
globalThis.IntersectionObserver =
  globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };

const { emptyStateHTML, skeletonHTML, skeletonCardsHTML } = await import(
  '../personal-hub/src/components/states.js'
);
const { renderPageHeader } = await import('../personal-hub/src/components/PageHeader.js');
const { buscarModulos, modulos, SEARCH_CARDS, normalizar } = await import(
  '../personal-hub/src/data/search.data.js'
);
const { ROUTES } = await import('../personal-hub/src/routes.js');

const routesSrc = leer('routes.js');
const routerSrc = leer('router.js');
const uiCss = leer('styles/ui.css');
const appSrc = leer('components/App.js');
const sidebarSrc = leer('components/Sidebar.js');
const searchSrc = leer('components/GlobalSearch.js');
const calendarioSrc = leer('pages/Calendario.js');
const sentimientosSrc = leer('pages/Sentimientos.js');
const curiositiesSrc = leer('pages/rincon/curiosities.js');
const sectionsSrc = leer('pages/rincon/sections.data.js');

const rutasReales = new Set(ROUTES.filter(r => !r.path.includes(':')).map(r => r.path));

/** Ids de un array literal del código fuente, sin evaluar el módulo. */
function idsDeArray(src, marca) {
  const inicio = src.indexOf(marca);
  assert.notEqual(inicio, -1, `no se encontró «${marca}»`);
  const fin = src.indexOf('\n];', inicio);
  return [...src.slice(inicio, fin).matchAll(/\bid:\s*'([^']+)'/g)].map(m => m[1]);
}

const idsHubs = new Set([
  ...idsDeArray(sectionsSrc, 'export const SECTIONS = ['),
  ...idsDeArray(sentimientosSrc, 'const CARDS = ['),
]);

/* ==========================================
   1. BÚSQUEDA GLOBAL
   ========================================== */

test('la búsqueda encuentra cada tarjeta real de los dos hubs', () => {
  for (const card of SEARCH_CARDS) {
    const resultados = buscarModulos(card.label).map(r => r.path);
    assert.ok(resultados.includes(card.path), `«${card.label}» debe llevar a ${card.path}`);
  }
});

test('la búsqueda no inventa módulos: todo resultado es una ruta real', () => {
  const consultas = ['', 'galeria', 'juegos', 'maldia', 'calendario', 'razones', 'fotos', 'zzzz'];
  for (const consulta of consultas) {
    for (const item of buscarModulos(consulta)) {
      assert.ok(rutasReales.has(item.path), `«${consulta}» devolvió ${item.path}, que no es una ruta`);
      assert.ok(item.label, 'todo resultado necesita etiqueta');
    }
  }
  for (const item of modulos({})) {
    assert.ok(rutasReales.has(item.path), `${item.path} no existe en el registro de rutas`);
  }
});

test('las tarjetas indexadas existen en las pantallas y no se duplican', () => {
  assert.equal(new Set(SEARCH_CARDS.map(c => c.id)).size, SEARCH_CARDS.length, 'ids únicos');
  assert.equal(new Set(SEARCH_CARDS.map(c => c.path)).size, SEARCH_CARDS.length, 'rutas únicas');
  for (const card of SEARCH_CARDS) {
    assert.ok(idsHubs.has(card.id), `la tarjeta ${card.id} no existe en ningún hub`);
    assert.ok(rutasReales.has(card.path), `la tarjeta ${card.id} apunta a ${card.path}, que no existe`);
  }
});

test('cada tarjeta del índice es la misma que la del hub (etiqueta incluida)', () => {
  for (const card of SEARCH_CARDS) {
    assert.ok(sectionsSrc.includes(`id: '${card.id}'`) || sentimientosSrc.includes(`id: '${card.id}'`));
    // La etiqueta que ve la persona sale del hub (`title`), no se reescribe.
    const etiqueta = card.label.replace(/'/g, "\\'");
    assert.ok(
      sectionsSrc.includes(`title: '${etiqueta}'`) || sentimientosSrc.includes(`title: '${etiqueta}'`),
      `la etiqueta «${card.label}» debe coincidir con la del hub`
    );
  }
});

test('la búsqueda ignora acentos y mayúsculas', () => {
  assert.equal(normalizar('Galería'), 'galeria');
  assert.equal(normalizar('  MAL  DÍA '), 'mal dia');
  assert.deepEqual(buscarModulos('galeria').map(r => r.path), buscarModulos('Galería').map(r => r.path));
  assert.ok(buscarModulos('día').some(r => r.path === '/maldia'));
});

test('sin texto hay sugerencias; sin coincidencias, ninguna', () => {
  const sugerencias = buscarModulos('');
  assert.ok(sugerencias.length > 0, 'el estado inicial ofrece algo que buscar');
  assert.ok(sugerencias.length <= 8, 'no se desborda la lista');
  assert.deepEqual(buscarModulos('zzzz-no-existe'), []);
  assert.deepEqual(buscarModulos('   '), sugerencias);
});

test('la búsqueda respeta el rol: el panel solo aparece para el admin', () => {
  assert.ok(!modulos({ isAdmin: false }).some(m => m.path === '/admin'));
  assert.deepEqual(buscarModulos('admin').map(r => r.path), []);
  assert.deepEqual(buscarModulos('admin', { isAdmin: true }).map(r => r.path), ['/admin']);
  for (const item of modulos({ isAdmin: false })) {
    assert.notEqual(item.path, '/admin');
  }
});

test('la búsqueda se abre desde la navegación actual, sin pestaña nueva', () => {
  assert.match(appSrc, /installGlobalSearch\(/, 'la app instala la búsqueda');
  assert.doesNotMatch(appSrc, /gs-fab/, 'ya no hay botón flotante de búsqueda');
  assert.match(sidebarSrc, /data-global-search/, 'la puerta es la del menú lateral');
  assert.match(searchSrc, /ctrlKey/, 'atajo Ctrl + K');
  assert.match(searchSrc, /aria-activedescendant/, 'navegable por teclado');
  assert.match(searchSrc, /openSheet\(/, 'reutiliza la capa compartida');
  assert.match(searchSrc, /emptyStateHTML\(/, 'tiene estado sin resultados');
  assert.doesNotMatch(routesSrc, /path:\s*'\/buscar'/, 'no se añadió una ruta de búsqueda');
  assert.doesNotMatch(routesSrc, /label:\s*'Buscar'/, 'no se añadió una pestaña de búsqueda');
});

/* ==========================================
   2. ESTADOS VACÍOS Y SKELETONS
   ========================================== */

test('el estado vacío se renderiza con mensaje y acción opcional', () => {
  const simple = emptyStateHTML({ title: 'Nada por aquí', text: 'Todavía no hay nada.' });
  assert.match(simple, /class="empty"/);
  assert.match(simple, /<b>Nada por aquí<\/b>/);
  assert.match(simple, /<p>Todavía no hay nada\.<\/p>/);
  assert.doesNotMatch(simple, /<button/, 'sin acción no se inventa un botón');

  const conBoton = emptyStateHTML({ title: 'Vacío', action: { label: 'Añadir', id: 'addBtn' } });
  assert.match(conBoton, /<button class="btn" type="button" id="addBtn">Añadir<\/button>/);

  const conEnlace = emptyStateHTML({ title: 'Vacío', action: { label: 'Ir', href: '/rincon' } });
  assert.match(conEnlace, /<a class="btn" href="\/rincon">Ir<\/a>/);
});

test('el estado vacío escapa el texto que le llega', () => {
  const html = emptyStateHTML({ title: '<img src=x onerror=alert(1)>', text: '<b>x</b>' });
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;img/);
});

test('el skeleton se renderiza como carga accesible, con sus huecos', () => {
  const lista = skeletonHTML({ rows: 3, label: 'Cargando tu historial' });
  assert.match(lista, /role="status"/);
  assert.match(lista, /aria-busy="true"/);
  assert.match(lista, /Cargando tu historial/);
  assert.equal((lista.match(/class="sk-row"/g) || []).length, 3);

  const rejilla = skeletonCardsHTML({ count: 6, label: 'Cargando regalos' });
  assert.equal((rejilla.match(/class="sk-card"/g) || []).length, 6);
  assert.match(rejilla, /class="sk-grid/);
});

test('los estados y skeletons están aplicados donde hay carga real', () => {
  assert.match(calendarioSrc, /skeletonHTML\(/, 'el calendario no se queda en blanco mientras carga');
  assert.match(calendarioSrc, /skeletonCardsHTML\(/, 'el regalo destacado también');
  assert.match(sentimientosSrc, /skeletonHTML\(/, 'el historial de ánimos tiene hueco de carga');
  assert.match(curiositiesSrc, /emptyStateHTML\(/, 'la búsqueda sin resultados usa el vacío compartido');
  assert.match(uiCss, /\.sk-row,/, 'las filas skeleton tienen estilo compartido');
  assert.match(uiCss, /\.sk-card \{/, 'las tarjetas skeleton también');
});

/* ==========================================
   3. CABECERA ÚNICA
   ========================================== */

test('la cabecera compartida pinta título, subtítulo, acciones y volver', () => {
  const html = renderPageHeader({
    title: 'Calendario',
    subtitle: 'Un regalo cada día',
    actions: '<button type="button">x</button>',
    back: true,
    className: 'cal-page-head',
  });
  assert.match(html, /class="scr-head cal-page-head"/);
  assert.match(html, /<h1 class="scr-title">Calendario<\/h1>/);
  assert.match(html, /<p class="sub">Un regalo cada día<\/p>/);
  assert.match(html, /class="head-actions"/);
  assert.match(html, /data-back/);
  assert.match(html, /aria-label="Volver"/);
});

test('la cabecera no pinta volver ni acciones si no tocan', () => {
  const html = renderPageHeader({ title: 'Razones' });
  assert.doesNotMatch(html, /data-back/);
  assert.doesNotMatch(html, /head-actions/);
  assert.doesNotMatch(html, /class="sub"/);
});

test('la cabecera escapa el título y admite subtítulo vacío con id', () => {
  const html = renderPageHeader({ title: '<script>x</script>', subtitleId: 'razonesMeta' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /id="razonesMeta"/);
});

test('las pantallas principales usan la cabecera compartida', () => {
  const pantallas = {
    Calendario: calendarioSrc,
    OpenWhen: leer('pages/OpenWhen.js'),
    OsitosWorld: leer('pages/OsitosWorld.js'),
    Razones: leer('pages/Razones.js'),
    Rincon: leer('pages/Rincon.js'),
    Curiosidades: curiositiesSrc,
  };
  for (const [nombre, src] of Object.entries(pantallas)) {
    assert.match(src, /renderPageHeader\(/, `${nombre} debe usar la cabecera compartida`);
    assert.doesNotMatch(src, /<h1 class="scr-title">/, `${nombre} no debe repetir el marcado a mano`);
  }
});

/* ==========================================
   4. TRANSICIONES Y MOVIMIENTO REDUCIDO
   ========================================== */

test('la transición de ruta es solo entrada y no anima con movimiento reducido', () => {
  assert.match(routerSrc, /route-enter/);
  assert.match(routerSrc, /prefers-reduced-motion: reduce/, 'el router consulta la preferencia');
  assert.match(uiCss, /#app-content > \.route-enter \{ animation: route-enter/);

  const indice = uiCss.indexOf('#app-content > .route-enter { animation: none; }');
  assert.notEqual(indice, -1, 'con movimiento reducido no hay animación');
  assert.ok(
    uiCss.lastIndexOf('@media (prefers-reduced-motion: reduce)', indice) !== -1,
    'la regla vive dentro del bloque de movimiento reducido'
  );
  assert.doesNotMatch(routerSrc, /animation: route-exit|setTimeout\([^)]*navigate/, 'no se retrasa la navegación');
});

test('el brillo del skeleton también se apaga con movimiento reducido', () => {
  const desde = uiCss.indexOf('@keyframes sk-shimmer');
  const bloque = uiCss.slice(desde, uiCss.indexOf('.route-enter'));
  assert.match(bloque, /\.sk-row::after/);
  assert.match(bloque, /animation: none/);
});
