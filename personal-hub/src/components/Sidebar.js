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

function getIconSVG(icon) {
  const icons = {
    'home': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'heart': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'heart-handshake': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-handshake-icon lucide-heart-handshake"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/></svg>',
    'music': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'star': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'gamepad-2': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 11 6 8 3 8"/><path d="M15.5 12a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/><path d="M12 2a4 4 0 0 1 4 4v1H8V6a4 4 0 0 1 4-4Z"/><path d="M2 17v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3"/></svg>',
    'settings': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'user': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'log-out': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
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
    const currentId = currentPath.split('/')[1] || 'home';

    const initial = user ? (user.name || 'U').charAt(0).toUpperCase() : '?';

    aside.innerHTML = `
      <div class="sidebar__brand">
        <span class="sidebar__eyebrow">Personal Hub</span>
        <h2 class="sidebar__title">Hub</h2>
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
          <div class="sidebar__user" id="sidebarUser">
            <div class="sidebar__user-avatar">${initial}</div>
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
        const id = btn.dataset.nav;
        const paths = {
          home: '/', rincon: '/rincon', sentimientos: '/sentimientos',
          ositos: '/ositos', perfil: '/perfil', admin: '/admin'
        };
        router.navigate(paths[id] || '/');
      });
    });

    // Bind logout
    const logoutBtn = aside.querySelector('#sidebarLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        router.navigate('/login');
      });
    }

    // Bind profile click
    const userRow = aside.querySelector('#sidebarUser');
    if (userRow) {
      userRow.addEventListener('click', () => {
        router.navigate('/perfil');
      });
    }
  }

  render();

  // Re-render on auth change
  userStore.onChange(() => render());

  // Re-render on route change
  window.addEventListener('hashchange', () => {
    currentPath = router.getCurrentPath();
    render();
  });

  return aside;
}
