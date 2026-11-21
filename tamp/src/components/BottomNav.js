/* ==========================================
   BottomNav — navegación inferior (móvil)
   4 secciones compartidas, indicador activo suave y píldora en el icono.
   El panel de administración se abre desde Perfil.
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { setUserPref } from '../utils/userStorage.js';
import { icon, avatarEl } from './ui.js';
import { bottomNavItems, roleFor, sectionFor } from '../routes.js';
import { hapticTap } from '../services/native.service.js';

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
      btn.addEventListener('click', () => {
        // En el APK cada pestaña responde con el toque del sistema; en la web no hace nada.
        hapticTap('light');
        const href = item?.href || '/';
        // Tocar la pestaña en la que ya estás sube arriba, como en una app.
        if (router.getCurrentPath() === href) {
          router.scrollToTop();
          return;
        }
        router.navigate(href);
      });
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
