/* ==========================================
   BottomNav — navegación inferior (móvil)
   5 secciones, indicador activo suave y píldora en el icono.
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { setUserPref } from '../utils/userStorage.js';
import { icon, avatarEl } from './ui.js';

const NAV_ITEMS = [
  { id: 'home',         label: 'Inicio',       icon: 'home' },
  { id: 'rincon',       label: 'Rincón',       icon: 'heart' },
  { id: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake' },
  { id: 'ositos',       label: 'OsitosWorld',  icon: 'star' },
  { id: 'perfil',       label: 'Perfil',       icon: 'user' }
];

const PATHS = {
  home: '/',
  rincon: '/rincon',
  sentimientos: '/sentimientos',
  ositos: '/ositos',
  perfil: '/perfil'
};

// Subsecciones → sección a la que pertenecen: la pestaña del padre
// sigue marcada como activa dentro de sus páginas hijas.
const SECTION_PARENT = {
  razones: 'sentimientos',
  openwhen: 'sentimientos',
  calendario: 'sentimientos',
  maldia: 'sentimientos',
  galeria: 'rincon',
  memes: 'rincon',
  audios: 'rincon',
  minecraft: 'rincon',
  curiosidades: 'rincon',
  juegos: 'rincon',
  canciones: 'rincon',
  series: 'rincon',
  thoseeyes: 'rincon'
};

export function BottomNav(router) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Navegación principal');

  let currentPath = router.getCurrentPath();

  function isActiveFor(item) {
    const base = currentPath.split('?')[0];
    const currentId = (base.split('/')[1] || '') || 'home';
    if (item.id === 'home') return currentId === '' || currentId === 'home';
    if (item.id === 'perfil') return currentId === 'perfil' || currentId === 'admin';
    if (currentId === item.id) return true;
    return SECTION_PARENT[currentId] === item.id;
  }

  function render() {
    const user = userStore.getUser();
    const online = navigator.onLine;

    nav.innerHTML = NAV_ITEMS.map(item => {
      const active = isActiveFor(item);
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

    const matched = NAV_ITEMS.find(isActiveFor);
    if (matched) setUserPref('activeSection', matched.id);

    nav.querySelectorAll('.bn-item').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(PATHS[btn.dataset.nav] || '/'));
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
