/* ==========================================
   Personal Hub — Registro único de rutas y navegación

   Todo lo que antes estaba repartido entre main.js (rutas), App.js
   (rutas sin navegación, raíces móviles, nombre e icono de la barra de
   vuelta, destino de atrás), BottomNav.js (pestañas y sección padre),
   Sidebar.js (items y grupos laterales) y Admin.js (etiquetas de la
   analítica) vive aquí.

   Añadir o cambiar una pantalla debe ser editar UNA entrada de ROUTES.

   Cada entrada declara:
     path          ruta hash ('/rincon'); admite un segmento dinámico (':id')
     label         nombre de la página (navegación, barra móvil, analítica)
     icon          icono canónico de navegación
     topbarIcon    icono en la barra móvil cuando hoy difiere del anterior
     title         document.title
     public        no necesita sesión (login)
     adminOnly     solo el administrador
     skipMood      no dispara el check-in diario
     lazy          viaja en su propio chunk (main.js la carga con lazy())
     roles         quién la tiene en la navegación (por defecto, ambos)
     section       pestaña de la barra inferior a la que pertenece
     parent        a dónde vuelve el botón Atrás en móvil
     mobileRoot    sin barra de vuelta (es raíz de sección)
     bottomNav     aparece en la barra inferior
     sidebar       aparece en el menú lateral de escritorio
     sidebarGroup  grupo contextual del menú lateral
     chrome:false  sin sidebar ni barra inferior (login)
     genericTopbar la barra móvil pone «Volver» en vez del nombre

   Regla de producto (misión): el administrador NO usa la pantalla diaria.
   La ruta '/' está marcada como solo para el rol de usuario y el panel
   ('/admin') es su casa: al entrar aterriza en la gestión de eventos.
   ========================================== */

export const ROLE_USER = 'user';
export const ROLE_ADMIN = 'admin';

/** Sin `roles` declarados, la ruta es de los dos. */
const TODOS = [ROLE_USER, ROLE_ADMIN];

export const ROUTES = [
  {
    path: '/',
    label: 'Inicio',
    icon: 'home',
    title: 'Inicio · Personal Hub',
    // La pantalla diaria es de la usuaria: el admin no la ve ni la tiene
    // en su navegación (aterriza en el panel, ver homePathFor).
    roles: [ROLE_USER],
    section: 'home',
    mobileRoot: true,
    bottomNav: true,
    sidebar: true
  },
  {
    path: '/login',
    label: 'Iniciar sesión',
    icon: 'lock',
    title: 'Iniciar sesión · Personal Hub',
    // Pública (sin ella no se podría entrar) y sin navegación: antes
    // vivía en NO_NAV_ROUTES y skipMood/protected en main.js.
    public: true,
    skipMood: true,
    chrome: false
  },
  {
    path: '/perfil',
    label: 'Perfil',
    icon: 'user',
    title: 'Perfil · Personal Hub',
    skipMood: true,
    section: 'perfil',
    mobileRoot: true,
    bottomNav: true
  },
  {
    path: '/admin',
    label: 'Admin',
    icon: 'gear',
    title: 'Admin · Personal Hub',
    adminOnly: true,
    skipMood: true,
    lazy: true,
    roles: [ROLE_ADMIN],
    section: 'admin',
    mobileRoot: true,
    bottomNav: true
  },
  {
    path: '/rincon',
    label: 'Rincón',
    icon: 'heart',
    title: 'Rincón · Personal Hub',
    lazy: true,
    section: 'rincon',
    mobileRoot: true,
    bottomNav: true,
    sidebar: true,
    sidebarGroup: 'rincon'
  },
  {
    path: '/galeria',
    label: 'Galería',
    icon: 'image',
    title: 'Galería · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'galeria'
  },
  {
    path: '/memes',
    label: 'Memes',
    icon: 'smile',
    title: 'Memes · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'galeria'
  },
  {
    path: '/audios',
    label: 'Audios',
    icon: 'mic',
    title: 'Audios · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'galeria'
  },
  {
    path: '/minecraft',
    label: 'Minecraft',
    icon: 'game',
    topbarIcon: 'minecraft',
    title: 'Minecraft · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'galeria'
  },
  {
    path: '/curiosidades',
    label: 'Curiosidades',
    icon: 'compass',
    title: 'Curiosidades · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'curiosidades'
  },
  {
    path: '/canciones',
    label: 'Canciones',
    icon: 'music',
    topbarIcon: 'mic',
    title: 'Canciones · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'musica'
  },
  {
    path: '/razones',
    label: 'Razones',
    icon: 'spark',
    topbarIcon: 'heart',
    title: 'Razones · Personal Hub',
    section: 'sentimientos',
    parent: '/sentimientos',
    sidebarGroup: 'sentimientos'
  },
  {
    path: '/sentimientos',
    label: 'Sentimientos',
    icon: 'heart-handshake',
    title: 'Sentimientos · Personal Hub',
    lazy: true,
    section: 'sentimientos',
    mobileRoot: true,
    bottomNav: true,
    sidebar: true,
    sidebarGroup: 'sentimientos'
  },
  {
    path: '/juegos',
    label: 'Juegos',
    icon: 'game',
    topbarIcon: 'minecraft',
    title: 'Juegos · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'rincon'
  },
  {
    path: '/juegos/online/:gameId',
    label: 'Partida online',
    icon: 'game',
    title: 'Partida online · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/juegos',
    genericTopbar: true
  },
  {
    path: '/calendario',
    label: 'Calendario',
    icon: 'calendar',
    topbarIcon: 'home',
    title: 'Calendario · Personal Hub',
    lazy: true,
    section: 'sentimientos',
    parent: '/sentimientos',
    sidebarGroup: 'sentimientos'
  },
  {
    path: '/maldia',
    label: 'Mal Día',
    icon: 'sun',
    topbarIcon: 'heart',
    title: 'Mal Día · Personal Hub',
    section: 'sentimientos',
    parent: '/sentimientos',
    sidebarGroup: 'sentimientos'
  },
  {
    path: '/openwhen',
    label: 'Open When',
    icon: 'mail',
    topbarIcon: 'heart',
    title: 'Open When · Personal Hub',
    lazy: true,
    section: 'sentimientos',
    parent: '/sentimientos',
    sidebarGroup: 'sentimientos'
  },
  {
    path: '/series',
    label: 'Series',
    icon: 'book',
    topbarIcon: 'image',
    title: 'Series · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'rincon'
  },
  {
    path: '/thoseeyes',
    label: 'Those Eyes',
    icon: 'spark',
    topbarIcon: 'heart',
    title: 'Those Eyes · Personal Hub',
    lazy: true,
    section: 'rincon',
    parent: '/rincon',
    sidebarGroup: 'rincon'
  },
  {
    path: '/justthewayyouare',
    label: 'Just The Way You Are',
    icon: 'music',
    title: 'Just The Way You Are · Personal Hub',
    lazy: true,
    genericTopbar: true
  },
  {
    path: '/ositos',
    label: 'OsitosWorld',
    icon: 'star',
    title: 'OsitosWorld · Personal Hub',
    lazy: true,
    section: 'ositos',
    mobileRoot: true,
    bottomNav: true,
    sidebar: true
  }
];

// ==========================================
// GRUPOS DEL MENÚ LATERAL
// Subnavegación contextual: cada grupo se enseña dentro de sus páginas.
// Sus items no son rutas propias (algunos llevan query: ?v=, ?cat=), así
// que viven aquí completos, con su nombre y su icono de menú.
// ==========================================
const SIDEBAR_GROUPS = [
  {
    id: 'musica',
    title: 'Música',
    items: [
      { label: 'Explorar', icon: 'music', href: '/canciones' },
      { label: 'Biblioteca', icon: 'book', href: '/canciones?v=biblioteca' },
      { label: 'Favoritas', icon: 'heart', href: '/canciones?v=favoritas' },
      { label: 'Playlists', icon: 'list', href: '/canciones?v=playlists' },
      { label: 'Historial', icon: 'clock', href: '/canciones?v=historial' }
    ]
  },
  {
    id: 'rincon',
    title: 'Rincón',
    items: [
      { label: 'Galería y Memes', icon: 'image', href: '/galeria' },
      { label: 'Audios', icon: 'mic', href: '/audios' },
      { label: 'Curiosidades', icon: 'compass', href: '/curiosidades' },
      { label: 'Juegos', icon: 'game', href: '/juegos' },
      { label: 'Canciones', icon: 'music', href: '/canciones' },
      { label: 'Those Eyes', icon: 'spark', href: '/thoseeyes' },
      { label: 'Series', icon: 'book', href: '/series' }
    ]
  },
  {
    id: 'galeria',
    title: 'Galería y Memes',
    items: [
      { label: 'Galería', icon: 'image', href: '/galeria' },
      { label: 'Memes', icon: 'smile', href: '/memes' },
      { label: 'Audios', icon: 'mic', href: '/audios' },
      { label: 'Minecraft', icon: 'game', href: '/minecraft' }
    ]
  },
  {
    id: 'curiosidades',
    title: 'Curiosidades',
    items: [
      { label: 'San Juan Pueblo', icon: 'map', href: '/curiosidades?cat=spb' },
      { label: 'San Petersburgo', icon: 'compass', href: '/curiosidades?cat=sp' },
      { label: 'Enciclopedia Gatuna', icon: 'paw', href: '/curiosidades?cat=gatos' }
    ]
  },
  {
    id: 'sentimientos',
    title: 'Sentimientos',
    items: [
      { label: 'Razones', icon: 'spark', href: '/razones' },
      { label: 'Open When', icon: 'mail', href: '/openwhen' },
      { label: 'Calendario', icon: 'calendar', href: '/calendario' },
      { label: 'Mal Día', icon: 'sun', href: '/maldia' }
    ]
  }
];

// Pestañas de la barra inferior, en orden. El admin no ve «Inicio» y ve
// «Admin» en su lugar: la lista se filtra por rol.
export const BOTTOM_NAV_PATHS = ['/', '/admin', '/rincon', '/sentimientos', '/ositos', '/perfil'];

// ==========================================
// CONSULTAS
// ==========================================

/** Ruta sin query ni barra final. */
function basePath(path) {
  const raw = String(path || '').split('?')[0];
  const trimmed = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Entrada de ROUTES para una ruta, incluidas las de segmento dinámico. */
export function routeFor(path) {
  const base = basePath(path);
  const exacta = ROUTES.find(r => r.path === base);
  if (exacta) return exacta;

  const buscada = base.split('/').filter(Boolean);
  return ROUTES.find(r => {
    if (!r.path.includes(':')) return false;
    const suya = r.path.split('/').filter(Boolean);
    if (suya.length !== buscada.length) return false;
    return suya.every((seg, i) => seg.startsWith(':') || seg === buscada[i]);
  }) || null;
}

/** Rol de navegación a partir de si la sesión es admin. */
export function roleFor(isAdmin) {
  return isAdmin ? ROLE_ADMIN : ROLE_USER;
}

function visiblePara(route, role) {
  return (route.roles || TODOS).includes(role);
}

/** ¿Este rol tiene esta ruta en su navegación? */
export function isVisibleTo(path, role) {
  const route = routeFor(path);
  return !!route && visiblePara(route, role);
}

/** Pantalla a la que entra cada rol: la diaria es solo de la usuaria. */
export function homePathFor(role) {
  return role === ROLE_ADMIN ? '/admin' : '/';
}

/** Sin sidebar ni barra inferior (login y sus subrutas). */
export function isChromeHidden(path) {
  return ROUTES.some(r => r.chrome === false && (path === r.path || String(path).startsWith(`${r.path}/`)));
}

/** Raíz de sección: en móvil no lleva barra de vuelta. */
export function isMobileRoot(path, role) {
  const route = routeFor(path);
  return !!route && route.mobileRoot === true && visiblePara(route, role);
}

/** Nombre e icono de la barra móvil de vuelta. */
export function mobileTopbarMeta(path) {
  const route = routeFor(path);
  if (!route || route.genericTopbar) return { label: 'Volver', icon: 'home' };
  return { label: route.label, icon: route.topbarIcon || route.icon };
}

/** A dónde vuelve el botón Atrás en móvil. */
export function mobileBackTarget(path, role) {
  return routeFor(path)?.parent || homePathFor(role);
}

/** Pestaña activa de la barra inferior (null si la ruta no es de ninguna). */
export function sectionFor(path) {
  return routeFor(path)?.section || null;
}

/** Pestañas de la barra inferior para un rol. */
export function bottomNavItems(role) {
  return BOTTOM_NAV_PATHS
    .map(p => routeFor(p))
    .filter(r => r && r.bottomNav === true && visiblePara(r, role))
    .map(r => ({ id: r.section, label: r.label, icon: r.icon, href: r.path }));
}

/** Items principales del menú lateral para un rol. */
export function sidebarItems(role) {
  return ROUTES
    .filter(r => r.sidebar === true && visiblePara(r, role))
    .map(r => ({ id: r.section, href: r.path, label: r.label, icon: r.icon }));
}

/** Un item de navegación suelto (así el panel de admin sale de aquí). */
export function navEntry(path) {
  const route = routeFor(path);
  return route ? { href: route.path, label: route.label, icon: route.icon } : null;
}

/** Grupo contextual del menú lateral para la ruta actual. */
export function sidebarGroupFor(path) {
  const id = routeFor(path)?.sidebarGroup;
  return id ? SIDEBAR_GROUPS.find(g => g.id === id) || null : null;
}

/**
 * Nombre de la sección raíz de una ruta, para la analítica del panel: la
 * actividad se agrupa por sección, no por pantalla.
 * '/juegos/online/1' → «Juegos», '/canciones?v=x' → «Canciones».
 */
export function labelForPath(path) {
  const raiz = `/${basePath(path).split('/').filter(Boolean)[0] || ''}`;
  return routeFor(raiz)?.label || raiz;
}
