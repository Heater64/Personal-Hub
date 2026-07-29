/* ==========================================
   Personal Hub v2 — Bottom Navigation
   Navegación inferior responsive con 5 tabs
   ========================================== */

import { userStore } from '../stores/user.store.js';

const NAV_ITEMS = [
  { id: 'home',        label: 'Inicio',      icon: 'home' },
  { id: 'rincon',      label: 'Rincón',      icon: 'heart' },
  { id: 'sentimientos',label: 'Sentimientos',icon: 'heart-handshake' },
  { id: 'ositos',      label: 'OsitosWorld', icon: 'star' },
  { id: 'perfil',      label: 'Perfil',      icon: 'user' }
];

export function BottomNav(router) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Navegación principal');

  let currentPath = router.getCurrentPath();

  function render() {
    const user = userStore.getUser();
    const currentId = currentPath.split('/')[1] || 'home';

    nav.innerHTML = NAV_ITEMS.map((item, i) => {
      const isActive = item.id === currentId ||
        (item.id === 'perfil' && (currentId === 'perfil' || currentId === 'admin')) ||
        (item.id === 'home' && currentId === '');

      const isCenter = i === Math.floor(NAV_ITEMS.length / 2);

      let iconHtml;
      if (item.id === 'perfil' && user) {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        iconHtml = `<span class="bottom-avatar">${initial}</span>`;
      } else {
        iconHtml = getNavIcon(item.icon);
      }

      return `
        <button type="button" class="bottom-nav__item ${isActive ? 'is-active' : ''} ${isCenter ? 'is-center' : ''}"
                data-nav="${item.id}" aria-current="${isActive ? 'page' : 'false'}">
          ${iconHtml}
          <span class="bottom-nav__label">${item.label}</span>
        </button>
      `;
    }).join('');

    // Bind clicks
    nav.querySelectorAll('.bottom-nav__item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.nav;
        const paths = {
          home: '/',
          rincon: '/rincon',
          sentimientos: '/sentimientos',
          ositos: '/ositos',
          perfil: '/perfil'
        };
        router.navigate(paths[id] || '/');
      });
    });
  }

  render();

  // Re-render on auth change
  userStore.onChange(() => render());

  // Listen to route changes
  const originalNavigate = router.navigate.bind(router);
  router.navigate = function(path) {
    currentPath = path;
    originalNavigate(path);
    // The hashchange event will trigger re-render
  };

  // Also listen to hash changes
  window.addEventListener('hashchange', () => {
    currentPath = router.getCurrentPath();
    render();
  });

  return nav;
}

function getNavIcon(icon) {
  const icons = {
    'home': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'heart': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'heart-handshake': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'star': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'user': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };
  return icons[icon] || icons.home;
}
