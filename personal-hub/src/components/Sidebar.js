/* ==========================================
   Personal Hub v2 — Sidebar
   Navegación lateral para escritorio
   Oculta en móvil, visible en desktop (>= 768px)
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';

const NAV_ITEMS = [
  { id: 'home',        label: 'Inicio',         icon: 'home',           href: '/' },
  { id: 'rincon',      label: 'Rincón',         icon: 'heart',          href: '/rincon' },
  { id: 'sentimientos',label: 'Sentimientos',   icon: 'heart-handshake', href: '/sentimientos' },
  { id: 'ositos',      label: 'OsitosWorld',    icon: 'star',           href: '/ositos' }
];

const MUSIC_ITEMS = [
  { id: 'explorar',   label: 'Explorar',   icon: 'music',    href: '/canciones' },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'library',  href: '/canciones?v=biblioteca' },
  { id: 'favoritas',  label: 'Favoritas',  icon: 'heart',    href: '/canciones?v=favoritas' },
  { id: 'playlists',  label: 'Playlists',  icon: 'list',     href: '/canciones?v=playlists' },
  { id: 'historial',  label: 'Historial',  icon: 'history',  href: '/canciones?v=historial' }
];

// La sidebar en PC es contextual: muestra las tarjetas/secciones de la zona
// en la que estás. Rincón (landing) → sus tarjetas; Galería/Memes/Audios →
// sus 3 secciones; Curiosidades → sus colecciones.
const RINCON_CARDS = [
  { label: 'Galería y Memes', icon: 'image',     href: '/galeria' },
  { label: 'Juegos',          icon: 'gamepad-2', href: '/juegos' },
  { label: 'Curiosidades',    icon: 'lightbulb', href: '/curiosidades' },
  { label: 'Canciones',       icon: 'music',     href: '/canciones' },
  { label: 'Those Eyes',      icon: 'star',      href: '/thoseeyes' },
  { label: 'Series',          icon: 'book',      href: '/series' }
];

const GALERIA_ITEMS = [
  { label: 'Galería',   icon: 'image',     href: '/galeria' },
  { label: 'Memes',     icon: 'smile',     href: '/memes' },
  { label: 'Audios',    icon: 'mic',       href: '/audios' },
  { label: 'Minecraft', icon: 'gamepad-2', href: '/minecraft' }
];

const CURIOSIDADES_ITEMS = [
  { label: 'San Juan Pueblo',     icon: 'map-pin',  href: '/curiosidades?cat=spb' },
  { label: 'San Petersburgo',     icon: 'mountain', href: '/curiosidades?cat=sp' },
  { label: 'Enciclopedia Gatuna', icon: 'paw',      href: '/curiosidades?cat=gatos' }
];

const SENTIMIENTOS_ITEMS = [
  { label: 'Razones',     icon: 'sparkles', href: '/razones' },
  { label: 'Open When',   icon: 'mail',     href: '/openwhen' },
  { label: 'Calendario',  icon: 'calendar', href: '/calendario' },
  { label: 'Mal Día',     icon: 'sun',      href: '/maldia' }
];

function getIconSVG(icon) {
  const icons = {
    'home': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'heart': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'heart-handshake': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-handshake-icon lucide-heart-handshake"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/></svg>',
    'music': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'star': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'library': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    'list': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    'history': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    'gamepad-2': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 11 6 8 3 8"/><path d="M15.5 12a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/><path d="M12 2a4 4 0 0 1 4 4v1H8V6a4 4 0 0 1 4-4Z"/><path d="M2 17v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3"/></svg>',
    'settings': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'user': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'log-out': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    'image': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    'smile': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    'mic': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    'lightbulb': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4.2 12.6c.7.6 1.2 1.5 1.2 2.4h6c0-.9.5-1.8 1.2-2.4A7 7 0 0 0 12 2z"/></svg>',
    'book': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    'map-pin': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    'mountain': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
    'paw': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M20 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M8 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M5 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M12 12c-2.5 0-4.5 1-6 2.5C4.5 16 4 18 4 20c0 1.5 1 1.5 1 1.5h14s1 0 1-1.5c0-2-.5-3.5-2-5.5-1.5-1.5-3.5-2.5-6-2.5z"/></svg>',
    'sparkles': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 2l.5 2L21 4.5l-1.5.5L19 7l-.5-2L17 4.5l1.5-.5z"/><path d="M5 20l.5 1.5L7 22l-1.5.5L5 24l-.5-1.5L3 22l1.5-.5z"/></svg>',
    'mail': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    'calendar': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'sun': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
  };
  return icons[icon] || icons.home;
}

export function Sidebar(router) {
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  aside.setAttribute('role', 'navigation');
  aside.setAttribute('aria-label', 'Navegación principal');

  let currentPath = router.getCurrentPath();

  function render() {
    const user = userStore.getUser();
    const isAdmin = userStore.isAdmin;
    const currentId = (currentPath.split('/')[1] || '').split('?')[0] || 'home';
    // El grupo Música solo se muestra mientras estás dentro de Canciones
    const onMusic = currentPath.split('?')[0] === '/canciones';
    // Grupos contextuales: cambian según la sección en la que estés
    const basePath = currentPath.split('?')[0];
    const onRinconLanding = basePath === '/rincon';
    const onGaleria = ['/galeria', '/memes', '/audios', '/minecraft'].includes(basePath);
    const onCuriosidades = basePath === '/curiosidades';
    const onSentimientos = basePath === '/sentimientos';

    const initial = user ? (user.name || 'U').charAt(0).toUpperCase() : '?';

    aside.innerHTML = `
      <div class="sidebar__brand">
        <h2 class="sidebar__title">
          <span class="sidebar__title-word sidebar__title-word--primary">Personal</span>
          <span class="sidebar__title-word sidebar__title-word--accent">Hub</span>
        </h2>
        <p class="sidebar__tagline">Todo lo bonito, en un solo sitio.</p>
      </div>

      <nav class="sidebar__nav">
        ${NAV_ITEMS.map(item => {
          const isActive = item.id === currentId ||
            (item.id === 'home' && currentId === '');
          return `
            <button type="button" class="sidebar__link ${isActive ? 'is-active' : ''}"
                    data-nav="${item.id}">
              <span class="sidebar__link-icon">${getIconSVG(item.icon)}</span>
              <span class="sidebar__link-label">${item.label}</span>
            </button>
          `;
        }).join('')}

        ${onMusic ? `
          <div class="sidebar__section-divider">Música</div>
          ${MUSIC_ITEMS.map(item => {
            const isActive = currentPath === item.href ||
              (item.href === '/canciones' && currentPath.split('?')[0] === '/canciones' && !currentPath.includes('?'));
            return `
              <button type="button" class="sidebar__link ${isActive ? 'is-active' : ''}"
                      data-nav="music-${item.id}">
                <span class="sidebar__link-icon">${getIconSVG(item.icon)}</span>
                <span class="sidebar__link-label">${item.label}</span>
              </button>
            `;
          }).join('')}
        ` : ''}

        ${onRinconLanding ? `
          <div class="sidebar__section-divider">Rincón</div>
          ${RINCON_CARDS.map(item => {
            const isActive = basePath === item.href;
            return `
              <button type="button" class="sidebar__link ${isActive ? 'is-active' : ''}"
                      data-nav-href="${item.href}">
                <span class="sidebar__link-icon">${getIconSVG(item.icon)}</span>
                <span class="sidebar__link-label">${item.label}</span>
              </button>
            `;
          }).join('')}
        ` : ''}

        ${onGaleria ? `
          <div class="sidebar__section-divider">Galería y Memes</div>
          ${GALERIA_ITEMS.map(item => {
            const isActive = basePath === item.href;
            return `
              <button type="button" class="sidebar__link ${isActive ? 'is-active' : ''}"
                      data-nav-href="${item.href}">
                <span class="sidebar__link-icon">${getIconSVG(item.icon)}</span>
                <span class="sidebar__link-label">${item.label}</span>
              </button>
            `;
          }).join('')}
        ` : ''}

        ${onCuriosidades ? `
          <div class="sidebar__section-divider">Curiosidades</div>
          ${CURIOSIDADES_ITEMS.map(item => {
            const isActive = currentPath === item.href;
            return `
              <button type="button" class="sidebar__link ${isActive ? 'is-active' : ''}"
                      data-nav-href="${item.href}">
                <span class="sidebar__link-icon">${getIconSVG(item.icon)}</span>
                <span class="sidebar__link-label">${item.label}</span>
              </button>
            `;
          }).join('')}
        ` : ''}

        ${onSentimientos ? `
          <div class="sidebar__section-divider">Sentimientos</div>
          ${SENTIMIENTOS_ITEMS.map(item => {
            const isActive = basePath === item.href;
            return `
              <button type="button" class="sidebar__link ${isActive ? 'is-active' : ''}"
                      data-nav-href="${item.href}">
                <span class="sidebar__link-icon">${getIconSVG(item.icon)}</span>
                <span class="sidebar__link-label">${item.label}</span>
              </button>
            `;
          }).join('')}
        ` : ''}

        ${isAdmin ? `
          <div class="sidebar__section-divider">Admin</div>
          <button type="button" class="sidebar__link ${currentId === 'admin' ? 'is-active' : ''}"
                  data-nav="admin">
            <span class="sidebar__link-icon">${getIconSVG('settings')}</span>
            <span class="sidebar__link-label">Panel Admin</span>
          </button>
        ` : ''}
      </nav>

      <div class="sidebar__footer">
        ${user ? `
          <div class="sidebar__user" id="sidebarUser" tabindex="0" role="button" aria-label="Abrir mi perfil">
            <div class="sidebar__user-avatar">
              ${user.avatar
                ? `<img src="${user.avatar}" alt="" class="sidebar__user-avatar-img" onerror="this.style.display='none';">`
                : ''}
              <span class="sidebar__user-avatar-fallback">${initial}</span>
            </div>
            <div class="sidebar__user-info">
              <span class="sidebar__user-name">${user.name || ''}${isAdmin ? ' <span class="admin-badge">Admin</span>' : ''}</span>
              <span class="sidebar__user-role">${isAdmin ? 'Admin' : 'Princesa'}</span>
            </div>
          </div>
          <button type="button" class="sidebar__logout" id="sidebarLogout" aria-label="Cerrar sesión">
            ${getIconSVG('log-out')}
          </button>
        ` : ''}
        <div class="sidebar__footer-meta">
          <small>De hecho te amo</small>
          <span>${new Date().getFullYear()} · hecho por tu peluche</span>
        </div>
      </div>
    `;

    // Bind nav clicks
    aside.querySelectorAll('.sidebar__link').forEach(btn => {
      btn.addEventListener('click', () => {
        // Botones de grupos contextuales (tarjetas del Rincón, Galería/Memes/
        // Audios, colecciones de Curiosidades): navegan directo a su href.
        if (btn.dataset.navHref) {
          router.navigate(btn.dataset.navHref);
          return;
        }
        const id = btn.dataset.nav;
        const paths = {
          home: '/', rincon: '/rincon', sentimientos: '/sentimientos',
          ositos: '/ositos', perfil: '/perfil', admin: '/admin'
        };
        if (id.startsWith('music-')) {
          const item = MUSIC_ITEMS.find(m => m.id === id.slice(6));
          router.navigate(item?.href || '/canciones');
          return;
        }
        router.navigate(paths[id] || '/');
      });
    });

    // Bind logout
    const logoutBtn = aside.querySelector('#sidebarLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        // replace: Atrás no debe volver a una página ya protegida por el guard
        router.replace('/login');
      });
    }

    // Bind profile click
    const userRow = aside.querySelector('#sidebarUser');
    if (userRow) {
      const goProfile = () => router.navigate('/perfil');
      userRow.addEventListener('click', goProfile);
      userRow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goProfile();
        }
      });
    }
  }

  render();

  // Re-render on auth change
  userStore.onChange(() => render());

  // Re-render on route change. router.afterEach (no hashchange): navigate()
  // usa history.pushState() que no dispara hashchange, así que con hashchange
  // los grupos contextuales y el resaltado se quedaban congelados en la
  // primera ruta (siempre parecía Inicio).
  router.afterEach((path) => {
    currentPath = path;
    render();
  });

  return aside;
}
