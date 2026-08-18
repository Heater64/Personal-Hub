/* ==========================================
   Personal Hub v2 — Bottom Navigation
   Navegación inferior responsive con 5 tabs
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { setUserPref } from '../utils/userStorage.js';

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
    const currentId = (currentPath.split('/')[1] || '').split('?')[0] || 'home';

    nav.innerHTML = NAV_ITEMS.map((item, i) => {
      const isActive = item.id === currentId ||
        (item.id === 'perfil' && (currentId === 'perfil' || currentId === 'admin')) ||
        (item.id === 'home' && currentId === '');

      const isCenter = i === Math.floor(NAV_ITEMS.length / 2);

      let iconHtml;
      let statusDot = '';
      if (item.id === 'perfil' && user) {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        const hasAvatar = !!user.avatar;
        // La inicial solo se muestra si NO hay foto o si la foto falla al cargar
        const avatarImg = hasAvatar
          ? `<img src="${user.avatar}" alt="" class="bottom-avatar" style="object-fit:cover;display:flex;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
          : '';
        iconHtml = `<span class="bottom-avatar-wrap">${avatarImg}<span class="bottom-avatar${hasAvatar ? ' fallback' : ''}"${hasAvatar ? ' style="display:none"' : ''}>${initial}</span></span>`;
        // Online status dot on the profile tab
        const online = navigator.onLine;
        statusDot = `<span class="bottom-nav__status" style="background:${online ? 'var(--green, #4caf50)' : 'var(--red, #dc3545)'};"></span>`;
      } else {
        iconHtml = getNavIcon(item.icon);
      }

      return `
        <button type="button" class="bottom-nav__item ${isActive ? 'is-active' : ''} ${isCenter ? 'is-center' : ''}"
                data-nav="${item.id}" aria-current="${isActive ? 'page' : 'false'}">
          ${iconHtml}
          ${statusDot}
          <span class="bottom-nav__label">${item.label}</span>
        </button>
      `;
    }).join('');

    // Persist active section to localStorage — ensures a single source of truth
    const matchedItem = NAV_ITEMS.find(item =>
      item.id === currentId ||
      (item.id === 'perfil' && (currentId === 'perfil' || currentId === 'admin')) ||
      (item.id === 'home' && currentId === '')
    );
    if (matchedItem) {
      setUserPref('activeSection', matchedItem.id);
    }

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

  // Re-render al cambiar de ruta. Se usa router.afterEach en lugar de
  // escuchar 'hashchange': router.navigate() usa history.pushState(), que
  // NO dispara hashchange, así que con hashchange el resaltado de la sección
  // activa se quedaba congelado en la primera ruta (parecía que siempre
  // estabas en Inicio). afterEach cubre navigate, replace, popstate y
  // hashchange por igual.
  router.afterEach((path) => {
    currentPath = path;
    render();
  });

  // Re-render connection indicator when going online/offline
  window.addEventListener('online', render);
  window.addEventListener('offline', render);

  return nav;
}

function getNavIcon(icon) {
  const icons = {
    'home': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'heart': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'heart-handshake': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'star': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'user': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'image': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    'smile': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    'mic': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    'lightbulb': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4.2 12.6c.7.6 1.2 1.5 1.2 2.4h6c0-.9.5-1.8 1.2-2.4A7 7 0 0 0 12 2z"/></svg>'
  };
  return icons[icon] || icons.home;
}
