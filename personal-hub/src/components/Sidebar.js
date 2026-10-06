/* ==========================================
   Sidebar — navegación de escritorio
   Marca, items tipo píldora, grupo contextual según la sección y usuario
   al pie. Los items y los grupos salen del registro de rutas: la usuaria
   ve «Inicio» y el admin no (su casa es el panel).
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';
import { icon } from './ui.js';
import { escapeHtml, safeUrl } from '../utils/escape.js';
import { sidebarItems, sidebarGroupFor, navEntry, roleFor, sectionFor } from '../routes.js';

export function Sidebar(router) {
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  aside.setAttribute('role', 'navigation');
  aside.setAttribute('aria-label', 'Navegación principal');

  let currentPath = router.getCurrentPath();

  function navButton(item, active) {
    return `<button type="button" class="nav-item${active ? ' is-active' : ''}" data-href="${item.href}"${active ? ' aria-current="page"' : ''}>
      ${icon(item.icon, 20)}<span>${item.label}</span>
    </button>`;
  }

  // Los grupos contextuales tienen entradas que comparten ruta base y se
  // distinguen por el query (música: ?v=biblioteca|favoritas|...; curiosidades:
  // ?cat=spb|sp|gatos). Comparar solo la base las daba por activas A TODAS.
  // Ahora se compara la ruta entera; si no hay coincidencia exacta (p. ej.
  // /curiosidades sin ?cat=), se resalta solo la primera en vez de todas.
  function group(title, items) {
    const exactos = items.filter(item => currentPath === item.href);
    const base = currentPath.split('?')[0];
    const activos = exactos.length
      ? exactos
      : items.filter(item => base === item.href.split('?')[0]).slice(0, 1);
    return `<p class="side-label">${title}</p>` +
      items.map(item => navButton(item, activos.includes(item))).join('');
  }

  function render() {
    const user = userStore.getUser();
    const isAdmin = userStore.isAdmin;
    const base = currentPath.split('?')[0];
    const currentId = (base.split('/')[1] || '') || 'home';

    const contextual = (() => {
      const grupo = sidebarGroupFor(base);
      return grupo ? group(grupo.title, grupo.items) : '';
    })();

    const adminEntry = navEntry('/admin');
    const initial = user ? (user.name || 'U').charAt(0).toUpperCase() : '?';
    // El avatar viene de user_metadata.avatar_url, que el usuario puede
    // editar por su cuenta: se valida el esquema y se escapa el atributo
    // para que no pueda cerrar la etiqueta ni inyectar un onerror.
    const avatarUrl = user ? safeUrl(user.avatar) : '';
    const avatar = avatarUrl
      ? `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.replaceWith(document.createTextNode(this.dataset.fallback))" data-fallback="${escapeHtml(initial)}">`
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
          ${sidebarItems(roleFor(isAdmin)).map(item => navButton(item, item.id === currentId)).join('')}
          ${contextual}
          ${isAdmin && adminEntry ? `<p class="side-label">Admin</p>${navButton(adminEntry, sectionFor(base) === 'admin')}` : ''}
        </div>
      </div>

      <div>
        ${user ? `
          <button type="button" class="side-user" id="sidebarUser">
            <span class="avatar" style="width:36px;height:36px;font-size:15px">${avatar}</span>
            <span style="min-width:0">
              <b>${escapeHtml(user.name || '')}</b>
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
