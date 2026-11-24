/* ==========================================
   Registro de rutas (src/routes.js)

   Comprueba dos cosas:
   1. Que unificar la navegación en un solo sitio no le cambia nada a la
      usuaria: aquí viven, como valores esperados, las listas que antes
      estaban repartidas por main.js, App.js, BottomNav.js, Sidebar.js y
      Admin.js.
   2. Que el admin no usa la pantalla diaria: no la ve en su navegación y
      entra por la gestión de eventos del panel.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTES, ROLE_USER, ROLE_ADMIN,
  routeFor, roleFor, homePathFor, isVisibleTo, isChromeHidden,
  isMobileRoot, mobileTopbarMeta, mobileBackTarget, sectionFor,
  bottomNavItems, sidebarItems, sidebarGroupFor, navEntry, labelForPath
} from '../tamp/src/routes.js';

// Todas las rutas que puede visitar alguien, con las query que se usan.
const PATHS = [
  '/', '/login', '/rincon', '/galeria', '/memes', '/audios', '/minecraft',
  '/curiosidades', '/juegos', '/juegos/online/abc', '/canciones',
  '/canciones?v=favoritas', '/series', '/thoseeyes', '/razones', '/openwhen',
  '/calendario', '/calendario?day=2026-10-06', '/maldia', '/sentimientos',
  '/menstruacion', '/ositos', '/perfil', '/admin', '/justthewayyouare'
];

// ── Valores de antes (la navegación que ya existía) ──
const BOTTOM_ANTES = [
  { id: 'home', label: 'Inicio', icon: 'home', href: '/' },
  { id: 'rincon', label: 'Rincón', icon: 'heart', href: '/rincon' },
  { id: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: '/sentimientos' },
  { id: 'perfil', label: 'Perfil', icon: 'user', href: '/perfil' }
];

const SIDEBAR_ANTES = [
  { id: 'home', label: 'Inicio', icon: 'home', href: '/' },
  { id: 'rincon', label: 'Rincón', icon: 'heart', href: '/rincon' },
  { id: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: '/sentimientos' }
];

const SECTION_PARENT_ANTES = {
  razones: 'sentimientos', openwhen: 'sentimientos', calendario: 'sentimientos', maldia: 'sentimientos',
  menstruacion: 'sentimientos',
  galeria: 'rincon', memes: 'rincon', audios: 'rincon', minecraft: 'rincon',
  curiosidades: 'rincon', juegos: 'rincon', canciones: 'rincon', series: 'rincon', thoseeyes: 'rincon',
  ositos: 'rincon'
};

const MOBILE_ROOTS_ANTES = ['/', '/rincon', '/sentimientos', '/perfil'];

const META_ANTES = {
  '/galeria': { label: 'Galería', icon: 'image' },
  '/memes': { label: 'Memes', icon: 'smile' },
  '/audios': { label: 'Audios', icon: 'mic' },
  '/minecraft': { label: 'Minecraft', icon: 'minecraft' },
  '/curiosidades': { label: 'Curiosidades', icon: 'compass' },
  '/juegos': { label: 'Juegos', icon: 'minecraft' },
  '/calendario': { label: 'Calendario', icon: 'home' },
  '/razones': { label: 'Razones', icon: 'heart' },
  '/openwhen': { label: 'Open When', icon: 'heart' },
  '/maldia': { label: 'Mal Día', icon: 'heart' },
  '/canciones': { label: 'Canciones', icon: 'mic' },
  '/series': { label: 'Series', icon: 'image' },
  '/thoseeyes': { label: 'Those Eyes', icon: 'heart' },
  '/ositos': { label: 'OsitosWorld', icon: 'star' },
  '/menstruacion': { label: 'Menstruación', icon: 'droplet' }
};

const RINCON_HIJOS_ANTES = ['/galeria', '/memes', '/audios', '/minecraft', '/curiosidades', '/juegos', '/canciones', '/series', '/thoseeyes', '/ositos'];
const SENTIMIENTOS_HIJOS_ANTES = ['/razones', '/openwhen', '/calendario', '/maldia', '/menstruacion'];

const baseOf = (p) => p.split('?')[0];

/** Pestaña que marcaba la barra inferior antes, o undefined si ninguna. */
function seccionActivaAntes(path) {
  const id = baseOf(path).split('/')[1] || 'home';
  if (id === 'home') return 'home';
  if (id === 'perfil' || id === 'admin') return 'perfil'; // el admin marcaba Perfil
  if (id === 'rincon' || id === 'sentimientos') return id;
  return SECTION_PARENT_ANTES[id];
}

/** A dónde volvía el botón Atrás antes. */
function backAntes(path) {
  if (path.startsWith('/juegos/online/')) return '/juegos';
  const base = baseOf(path);
  if (RINCON_HIJOS_ANTES.includes(base)) return '/rincon';
  if (SENTIMIENTOS_HIJOS_ANTES.includes(base)) return '/sentimientos';
  return '/';
}

// ==========================================
// INVARIANTES DEL REGISTRO
// ==========================================

test('el registro describe cada ruta una sola vez y con lo que la navegación necesita', () => {
  const rutas = ROUTES.map(r => r.path);
  assert.equal(new Set(rutas).size, rutas.length, 'no puede haber rutas repetidas');

  for (const route of ROUTES) {
    assert.ok(route.path?.startsWith('/'), `ruta sin path válido: ${JSON.stringify(route)}`);
    assert.ok(route.label, `la ruta ${route.path} necesita nombre`);
    assert.ok(route.icon, `la ruta ${route.path} necesita icono`);
    assert.ok(route.title, `la ruta ${route.path} necesita título de documento`);
    if (route.roles) {
      for (const rol of route.roles) assert.ok([ROLE_USER, ROLE_ADMIN].includes(rol), `rol desconocido en ${route.path}`);
    }
    // Un destino de «Atrás» tiene que existir de verdad.
    if (route.parent) assert.ok(routeFor(route.parent), `el padre de ${route.path} no existe`);
    // Lo que sale en la barra inferior necesita pestaña a la que pertenecer.
    if (route.bottomNav) assert.ok(route.section, `${route.path} sale en la barra inferior y no tiene pestaña`);
  }

  // Las pestañas que existen son las que la barra usa de verdad.
  const pestañas = new Set(bottomNavItems(ROLE_USER).map(i => i.id));
  for (const id of ['home', 'rincon', 'sentimientos', 'perfil']) {
    assert.ok(pestañas.has(id), `falta la pestaña ${id}`);
  }
});

test('la ruta antigua de agenda mantiene el título de marca de Personal Hub', () => {
  assert.equal(routeFor('/agenda')?.title, 'Calendario · Personal Hub');
});

test('el registro reconoce rutas con segmento dinámico y su query', () => {
  assert.equal(routeFor('/juegos/online/abc')?.path, '/juegos/online/:gameId');
  assert.equal(routeFor('/calendario?day=2026-10-06&gift=x')?.path, '/calendario');
  assert.equal(routeFor('/rincon/')?.path, '/rincon', 'una barra final no es otra ruta');
  assert.equal(routeFor('/no-existe'), null);
  assert.equal(roleFor(true), ROLE_ADMIN);
  assert.equal(roleFor(false), ROLE_USER);
});

// ==========================================
// LA USUARIA NO NOTA EL CAMBIO
// ==========================================

test('ambos roles tienen la misma barra inferior de cuatro secciones', () => {
  assert.deepEqual(bottomNavItems(ROLE_USER), BOTTOM_ANTES);
  assert.deepEqual(bottomNavItems(ROLE_ADMIN), BOTTOM_ANTES);
});

test('el menú lateral de la usuaria es exactamente el de antes', () => {
  const sidebarForUser = sidebarItems(ROLE_USER);
  assert.deepEqual(sidebarForUser, SIDEBAR_ANTES);
  // Ambos roles comparten Inicio y las secciones principales.
  assert.ok(sidebarItems(ROLE_ADMIN).some(i => i.href === '/'), 'el admin tiene Inicio en PC');
  assert.deepEqual(sidebarItems(ROLE_ADMIN).filter(i => i.href !== '/'), SIDEBAR_ANTES.filter(i => i.id !== 'home'), 'el resto del menú lateral del admin es igual al de la usuaria');
  assert.deepEqual(navEntry('/admin'), { href: '/admin', label: 'Peluche', icon: 'gear' });
  assert.equal(navEntry('/no-existe'), null);
});

test('los grupos contextuales del menú lateral no cambian', () => {
  const grupoDe = {
    '/canciones': 'Música',
    '/rincon': 'Rincón', '/juegos': 'Rincón', '/series': 'Rincón', '/thoseeyes': 'Rincón',
    '/ositos': 'Rincón',
    '/galeria': 'Galería y Memes', '/memes': 'Galería y Memes', '/audios': 'Galería y Memes', '/minecraft': 'Galería y Memes',
    '/curiosidades': 'Curiosidades',
    '/sentimientos': 'Sentimientos', '/razones': 'Sentimientos', '/openwhen': 'Sentimientos',
    '/calendario': 'Sentimientos', '/maldia': 'Sentimientos', '/menstruacion': 'Sentimientos'
  };
  for (const [path, titulo] of Object.entries(grupoDe)) {
    assert.equal(sidebarGroupFor(path)?.title, titulo, `el grupo de ${path} cambió`);
  }
  // Donde antes no había grupo, no hay grupo.
  for (const path of ['/', '/perfil', '/admin', '/login', '/justthewayyouare', '/juegos/online/abc']) {
    assert.equal(sidebarGroupFor(path), null, `${path} no debería tener grupo contextual`);
  }
  // Y de dónde sale cada grupo es la ruta, no una lista paralela.
  assert.equal(sidebarGroupFor('/canciones?v=favoritas')?.title, 'Música');
});

test('raíces móviles, barra de vuelta y destino de Atrás siguen igual para la usuaria', () => {
  for (const path of PATHS) {
    // El panel es de otro rol: se comprueba aparte, al final.
    if (baseOf(path) === '/admin') continue;
    const base = baseOf(path);
    assert.equal(isMobileRoot(base, ROLE_USER), MOBILE_ROOTS_ANTES.includes(base), `raíz móvil de ${path}`);
    assert.equal(mobileBackTarget(path, ROLE_USER), backAntes(path), `destino de Atrás de ${path}`);

    // El nombre de la barra móvil solo se ve donde la barra sale.
    const visible = !isChromeHidden(path) && !isMobileRoot(base, ROLE_USER);
    if (visible) {
      const esperado = META_ANTES[base] || { label: 'Volver', icon: 'home' };
      assert.deepEqual(mobileTopbarMeta(base), esperado, `barra móvil de ${path}`);
    }
  }

  // El panel, para el admin: raíz de sección (sin flecha que lo saque) y su
  // casa, así que el Atrás de una página suya vuelve al panel y no a Inicio.
  assert.equal(isMobileRoot('/admin', ROLE_ADMIN), true);
  assert.equal(mobileBackTarget('/galeria', ROLE_ADMIN), '/rincon');
  assert.equal(mobileBackTarget('/no-existe', ROLE_ADMIN), '/');
  assert.equal(mobileBackTarget('/no-existe', ROLE_USER), '/');
});

test('la pestaña activa corresponde a una de las cuatro secciones compartidas', () => {
  for (const path of PATHS) {
    const esperado = seccionActivaAntes(path);
    if (baseOf(path) === '/admin') continue; // Admin se abre desde Perfil.
    assert.equal(sectionFor(path), esperado ?? null, `pestaña activa de ${path}`);
  }
  assert.equal(sectionFor('/admin'), 'perfil');
});

test('sin navegación y etiquetas de sección siguen resolviéndose igual', () => {
  assert.equal(isChromeHidden('/login'), true);
  assert.equal(isChromeHidden('/login/recuperar'), true);
  assert.equal(isChromeHidden('/'), false);
  assert.equal(isChromeHidden('/rincon'), false);

  // Nombres de la analítica del panel (lo que antes era SECTION_LABELS).
  assert.equal(labelForPath('/'), 'Inicio');
  assert.equal(labelForPath('/rincon'), 'Rincón');
  assert.equal(labelForPath('/juegos/online/1'), 'Juegos', 'la analítica agrupa por sección raíz');
  assert.equal(labelForPath('/calendario?day=2026-10-06'), 'Calendario');
  assert.equal(labelForPath('/no-existe'), '/no-existe');
});

// ==========================================
// EL ADMIN NO USA LA PANTALLA DIARIA COMO FLUJO POR DEFECTO,
// PERO LA TIENE EXPUESTA EN EL MENÚ LATERAL DE ESCRITORIO (PC)
// ==========================================

test('el admin comparte Inicio y la navegación principal, con Admin aparte', () => {
  const inicio = routeFor('/');
  assert.deepEqual(inicio.roles, [ROLE_USER, ROLE_ADMIN], 'la pantalla diaria es de ambos roles');
  assert.equal(isVisibleTo('/', ROLE_ADMIN), true, 'el admin puede ver Inicio');
  assert.equal(isVisibleTo('/', ROLE_USER), true);

  // Y el check-in diario se salta para el admin (la pantalla que lo ofrece
  // tampoco está en su navegación).
  assert.equal(routeFor('/admin').skipMood, true);
  assert.equal(routeFor('/admin').adminOnly, true);

  // El admin usa las mismas cuatro pestañas y abre su panel desde Perfil.
  assert.ok(bottomNavItems(ROLE_ADMIN).some(i => i.id === 'home'), 'el admin tiene Inicio en la barra inferior de móvil');
  assert.ok(bottomNavItems(ROLE_ADMIN).some(i => i.href === '/'), 'el admin tiene Inicio en la barra inferior de móvil');
  assert.ok(sidebarItems(ROLE_ADMIN).some(i => i.href === '/'), 'el admin tiene Inicio en el menú lateral de PC');

  assert.equal(homePathFor(ROLE_ADMIN), '/', 'el admin entra en Inicio');
  assert.equal(homePathFor(ROLE_USER), '/');
  assert.deepEqual(bottomNavItems(ROLE_ADMIN), BOTTOM_ANTES);
  assert.equal(routeFor('/admin').bottomNav, undefined, 'Admin no es una pestaña principal');
  assert.equal(sectionFor('/admin'), 'perfil', 'Admin se abre desde Perfil');

  // Y el panel abre en el editor de fechas y eventos, no en el resumen.
  assert.equal(routeFor('/admin').mobileRoot, true, 'el panel es raíz: no lleva flecha de vuelta');
});
