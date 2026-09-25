/* ==========================================
   Sidebar — navegación de escritorio
   Estructura de habitos-web: marca, items tipo píldora,
   grupo contextual según la sección y usuario al pie.
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';
import { icon } from './ui.js';

const NAV_ITEMS = [
  { id: 'home',         label: 'Inicio',       icon: 'home',            href: '/' },
  { id: 'rincon',       label: 'Rincón',       icon: 'heart',           href: '/rincon' },
  { id: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: '/sentimientos' },
  { id: 'ositos',       label: 'OsitosWorld',  icon: 'star',            href: '/ositos' }
];

const MUSIC_ITEMS = [
  { label: 'Explorar',   icon: 'music',   href: '/canciones' },
  { label: 'Biblioteca', icon: 'book',    href: '/canciones?v=biblioteca' },
  { label: 'Favoritas',  icon: 'heart',   href: '/canciones?v=favoritas' },
  { label: 'Playlists',  icon: 'list',    href: '/canciones?v=playlists' },
  { label: 'Historial',  icon: 'clock',   href: '/canciones?v=historial' }
];

const RINCON_CARDS = [
  { label: 'Galería y Memes', icon: 'image',   href: '/galeria' },
  { label: 'Audios',          icon: 'mic',     href: '/audios' },
  { label: 'Curiosidades',    icon: 'compass', href: '/curiosidades' },
  { label: 'Juegos',          icon: 'game',    href: '/juegos' },
  { label: 'Canciones',       icon: 'music',   href: '/canciones' },
  { label: 'Those Eyes',      icon: 'spark',   href: '/thoseeyes' },
  { label: 'Series',          icon: 'book',    href: '/series' }
];

const GALERIA_ITEMS = [
  { label: 'Galería',   icon: 'image', href: '/galeria' },
  { label: 'Memes',     icon: 'smile', href: '/memes' },
  { label: 'Audios',    icon: 'mic',   href: '/audios' },
  { label: 'Minecraft', icon: 'game',  href: '/minecraft' }
];

const CURIOSIDADES_ITEMS = [
  { label: 'San Juan Pueblo',     icon: 'map',      href: '/curiosidades?cat=spb' },
  { label: 'San Petersburgo',     icon: 'compass',  href: '/curiosidades?cat=sp' },
  { label: 'Enciclopedia Gatuna', icon: 'paw',      href: '/curiosidades?cat=gatos' }
];

const SENTIMIENTOS_ITEMS = [
  { label: 'Razones',    icon: 'spark',    href: '/razones' },
  { label: 'Open When',  icon: 'mail',     href: '/openwhen' },
  { label: 'Calendario', icon: 'calendar', href: '/calendario' },
  { label: 'Mal Día',    icon: 'sun',      href: '/maldia' }
];

const GROUPS = { rincon: RINCON_CARDS, galeria: GALERIA_ITEMS, curiosidades: CURIOSIDADES_ITEMS, sentimientos: SENTIMIENTOS_ITEMS };

export function Sidebar(router) {
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  aside.setAttribute('role', 'navigation');
  aside.setAttribute('aria-label', 'Navegación principal');

  let currentPath = router.getCurrentPath();

  function navButton(item, active) {
    return `<button type="button" class="nav-item${active ? ' is-active' : ''}" data-href="${item.href}">
      ${icon(item.icon, 20)}<span>${item.label}</span>
    </button>`;
  }

  function group(title, items) {
    const base = currentPath.split('?')[0];
    return `<p class="side-label">${title}</p>` +
      items.map(item => navButton(item, base === item.href.split('?')[0])).join('');
  }

  function render() {
    const user = userStore.getUser();
    const isAdmin = userStore.isAdmin;
    const base = currentPath.split('?')[0];
    const currentId = (base.split('/')[1] || '') || 'home';

    // Subsecciones: cada grupo se muestra también dentro de sus páginas
    // hijas (p. ej. el grupo Sentimientos al estar en /razones o /calendario).
    const RINCON_PATHS = ['/rincon', '/juegos', '/series', '/thoseeyes'];
    const SENTIMIENTOS_PATHS = ['/sentimientos', '/razones', '/openwhen', '/calendario', '/maldia'];

    let contextual = '';
    if (base === '/canciones') contextual = group('Música', MUSIC_ITEMS);
    else if (RINCON_PATHS.includes(base)) contextual = group('Rincón', RINCON_CARDS);
    else if (['/galeria', '/memes', '/audios', '/minecraft'].includes(base)) contextual = group('Galería y Memes', GALERIA_ITEMS);
    else if (base === '/curiosidades') contextual = group('Curiosidades', CURIOSIDADES_ITEMS);
    else if (SENTIMIENTOS_PATHS.includes(base)) contextual = group('Sentimientos', SENTIMIENTOS_ITEMS);

    const initial = user ? (user.name || 'U').charAt(0).toUpperCase() : '?';
    const avatar = user && user.avatar
      ? `<img src="${user.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.replaceWith(document.createTextNode('${initial}'))">`
      : initial;

    aside.innerHTML = `
      <div>
        <div class="brand">
          <div class="brand-mark">H</div>
          <div>
            <h1>Personal Hub</h1>
            <p>Todo lo bonito, en un sitio</p>
          </div>
        </div>

        <div class="side-nav">
          ${NAV_ITEMS.map(item => navButton(item, item.id === currentId || (item.id === 'home' && currentId === ''))).join('')}
          ${contextual}
          ${isAdmin ? `<p class="side-label">Admin</p>${navButton({ label: 'Panel Admin', icon: 'gear', href: '/admin' }, currentId === 'admin')}` : ''}
        </div>
      </div>

      <div>
        ${user ? `
          <button type="button" class="side-user" id="sidebarUser">
            <span class="avatar" style="width:36px;height:36px;font-size:15px">${avatar}</span>
            <span style="min-width:0">
              <b>${user.name || ''}</b>
              <span>${isAdmin ? 'Admin' : 'Tu perfil'}</span>
            </span>
          </button>
        ` : ''}
        <div class="side-foot">
          <small>De hecho te amo</small>
          <button type="button" class="side-logout" id="sidebarLogout" aria-label="Cerrar sesión">${icon('logout', 18)}</button>
        </div>
      </div>
    `;

    aside.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(btn.dataset.href));
    });

    const logoutBtn = aside.querySelector('#sidebarLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        // replace: Atrás no debe volver a una página protegida por el guard
        router.replace('/login');
      });
    }

    const userRow = aside.querySelector('#sidebarUser');
    if (userRow) {
      userRow.addEventListener('click', () => router.navigate('/perfil'));
    }
  }

  render();

  userStore.onChange(() => render());

  router.afterEach((path) => {
    currentPath = path;
    render();
  });

  return aside;
}
