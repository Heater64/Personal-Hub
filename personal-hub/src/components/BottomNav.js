/* ==========================================
   BottomNav — navegación inferior (móvil)
   5 secciones, indicador activo suave y píldora en el icono.
   Las pestañas salen del registro de rutas: la usuaria ve «Inicio» y el
   admin ve «Admin» en su lugar (no usa la pantalla diaria).
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { setUserPref } from '../utils/userStorage.js';
import { icon, avatarEl } from './ui.js';
import { bottomNavItems, roleFor, sectionFor } from '../routes.js';

export function BottomNav(router) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Navegación principal');

  let currentPath = router.getCurrentPath();

  function render() {
    const user = userStore.getUser();
    const role = roleFor(userStore.isAdmin);
    const items = bottomNavItems(role);
    const section = sectionFor(currentPath);
    const online = navigator.onLine;

    nav.innerHTML = items.map(item => {
      const active = item.id === section;
      let visual;

      if (item.id === 'perfil' && user) {
        // El avatar del perfil sustituye al icono; el punto indica conexión.
        const avatar = avatarEl(user.name, user.avatar, 30);
        visual = `<span class="bottom-avatar-wrap">${avatar.innerHTML ? avatar.outerHTML : ''}</span>
          <span class="bottom-nav__status" style="background:${online ? 'var(--ok)' : 'var(--danger-c)'}"></span>`;
      } else {
        visual = `<span class="bn-ic">${icon(item.icon, 22)}</span>`;
      }

      return `<button type="button" class="bn-item${active ? ' is-active' : ''}"
        data-nav="${item.id}" aria-label="${item.label}"${active ? ' aria-current="page"' : ''}>
        ${visual}
        <span>${item.label}</span>
      </button>`;
    }).join('');

    const matched = items.find(item => item.id === section);
    if (matched) setUserPref('activeSection', matched.id);

    nav.querySelectorAll('.bn-item[data-nav]').forEach(btn => {
      const item = items.find(i => i.id === btn.dataset.nav);
      btn.addEventListener('click', () => router.navigate(item?.href || '/'));
    });
  }

  render();

  userStore.onChange(() => render());

  router.afterEach((path) => {
    currentPath = path;
    render();
  });

  window.addEventListener('online', render);
  window.addEventListener('offline', render);

  return nav;
}
