/* ==========================================
   Videoteca Tamp — contenedor de la sección

   Cuatro pestañas independientes: Inicio, Biblioteca, Descubrir y Top 5.
   La ficha se abre dentro del mismo contenedor y oculta las pestañas.
   ========================================== */

import '../../styles/series.css';
import { icon } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import { onContentChange } from '../../services/realtime.service.js';
import {
  state,
  initData,
  refreshCatalog,
  catalogById,
  loadPartner
} from './store.js';
import { renderHome } from './home.js';
import { renderLibrary } from './library.js';
import { renderDiscover } from './discover.js';
import { renderTop5 } from './top5.js';
import { renderDetail } from './detail.js';
import {
  openEditor as openEditorSheet,
  openLinkTool,
  openManageTool
} from './editor.js';
import {
  openExternalDetail,
  openPendingList,
  openPendingItem,
  openItemMenu
} from './panels.js';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'book' },
  { id: 'descubrir', label: 'Descubrir', icon: 'compass' },
  { id: 'top5', label: 'Top 5', icon: 'star' }
];

let page = null;
let panel = null;
let tabsHost = null;
let ctx = null;
const VALID_TABS = new Set(TABS.map(tab => tab.id));

function paintTabs() {
  if (!tabsHost) return;
  tabsHost.querySelectorAll('[data-tab]').forEach(button => {
    const on = button.dataset.tab === state.tab;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
  });
}

function renderPanel() {
  if (!panel) return;
  state.detailId = null;
  page.classList.remove('is-detail');
  switch (state.tab) {
    case 'biblioteca': renderLibrary(panel, ctx); break;
    case 'descubrir': renderDiscover(panel, ctx); break;
    case 'top5': renderTop5(panel, ctx); break;
    default: renderHome(panel, ctx); break;
  }
}

function openDetail(itemId) {
  const item = catalogById(itemId);
  if (!item) { showToast('Ese título ya no está en la biblioteca', 'info'); return; }
  state.detailId = item.id;
  page.classList.add('is-detail');
  renderDetail(panel, ctx, item);
  panel.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function closeDetail() {
  state.detailId = null;
  page.classList.remove('is-detail');
  renderPanel();
}

function goTab(tab) {
  if (!VALID_TABS.has(tab)) return;
  state.tab = tab;
  paintTabs();
  renderPanel();
}

function refresh() {
  if (state.detailId) {
    const item = catalogById(state.detailId);
    if (item) { renderDetail(panel, ctx, item); return; }
    closeDetail();
    return;
  }
  renderPanel();
}

function bootShell() {
  page.classList.remove('is-detail');
  page.innerHTML = `
    <div class="sx-shell">
      <nav class="sx-tabs" role="tablist" aria-label="Secciones de la videoteca">
        ${TABS.map(tab => `
          <button type="button" class="sx-tab${state.tab === tab.id ? ' is-on' : ''}" data-tab="${tab.id}" role="tab" aria-selected="${state.tab === tab.id}" tabindex="${state.tab === tab.id ? 0 : -1}">
            ${icon(tab.icon, 16)}<span>${tab.label}</span>
          </button>
        `).join('')}
      </nav>
      <div class="sx-panel" id="sxPanel" role="tabpanel"></div>
    </div>
  `;
  panel = page.querySelector('#sxPanel');
  tabsHost = page.querySelector('.sx-tabs');

  tabsHost.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => goTab(button.dataset.tab));
  });

  tabsHost.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const buttons = [...tabsHost.querySelectorAll('[data-tab]')];
    const index = buttons.indexOf(document.activeElement);
    const from = index === -1 ? buttons.findIndex(button => button.dataset.tab === state.tab) : index;
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = buttons[(from + step + buttons.length) % buttons.length];
    next.focus();
    goTab(next.dataset.tab);
  });
}

export function SeriesPage(router) {
  page = document.createElement('div');
  page.className = 'series-page sx-page';

  const requestedTab = router?.currentRoute?.query?.v;
  if (VALID_TABS.has(requestedTab)) state.tab = requestedTab;

  ctx = {
    page,
    router,
    goTab,
    refresh,
    openDetail,
    closeDetail,
    openEditor: itemId => openEditorSheet(ctx, itemId),
    openLinkTool: itemId => openLinkTool(ctx, itemId),
    openManageTool: () => openManageTool(ctx),
    openExternal: title => openExternalDetail(ctx, title),
    openPending: key => openPendingItem(ctx, key),
    openPendingList: () => openPendingList(ctx),
    openMenu: itemId => openItemMenu(ctx, itemId)
  };

  // Portadas caídas (enlaces viejos o bloqueo de origen): se muestra el
  // marcador de película en lugar de un hueco vacío.
  const onPosterError = event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.matches('[data-poster-img]')) return;
    img.hidden = true;
    const fallback = img.parentElement?.querySelector('.sx-poster-fallback');
    if (fallback) fallback.hidden = false;
  };
  page.addEventListener('error', onPosterError, true);

  // La videoteca necesita más ancho en escritorio que una columna de lectura.
  document.querySelector('.app-shell')?.classList.add('has-series');

  bootShell();
  panel.innerHTML = `
    <div class="sx-boot" role="status" aria-live="polite">
      <span class="sx-boot-spinner" aria-hidden="true"></span>
      <span>Cargando la videoteca…</span>
    </div>
  `;

  const offSeries = onContentChange(['series'], async () => {
    await refreshCatalog().catch(() => { /* sin red: se conserva el espejo */ });
    if (!page.isConnected) return;
    refresh();
  });

  initData()
    .then(() => {
      if (!page.isConnected) return;
      renderPanel();
      const deepId = router?.currentRoute?.query?.id;
      if (deepId && catalogById(deepId)) openDetail(deepId);
    })
    .catch(async error => {
      if (!page.isConnected) return;
      // Sin catálogo remoto se pinta igualmente el espejo local.
      await refreshCatalog().catch(() => {});
      renderPanel();
      showToast(error?.message || 'Sin conexión: se muestra la copia local', 'warning');
    });

  // Al volver a la pestaña, refresca el Top 5 de la pareja sin bloquear.
  const onVisible = () => {
    if (document.visibilityState !== 'visible' || !page.isConnected) return;
    loadPartner({ force: true }).then(() => {
      if (state.tab === 'top5' && !state.detailId) renderPanel();
    }).catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);

  const previousCleanup = page.cleanup;
  page.cleanup = () => {
    offSeries();
    page.removeEventListener('error', onPosterError, true);
    document.removeEventListener('visibilitychange', onVisible);
    document.querySelector('.app-shell')?.classList.remove('has-series');
    if (previousCleanup) previousCleanup();
  };

  return page;
}
