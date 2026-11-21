/* ==========================================
   GlobalSearch — búsqueda de módulos de la app

   Una sola capa, sin pestaña nueva:
     · se abre con Ctrl/⌘ + K o con cualquier botón `[data-global-search]`
       (barra superior del móvil y menú lateral)
     · busca entre las tarjetas de los dos hubs y las rutas reales
     · teclado completo: escribir, ↑/↓ para moverse, Enter para abrir,
       Escape para cerrar (lo pone la hoja compartida)
     · estado inicial con sugerencias y estado «sin resultados» explícito

   Reutiliza `openSheet`, que ya se encarga del foco, del Tab atrapado y de
   que Atrás cierre la capa en vez de salir de la ruta.
   ========================================== */

import { escapeHtml } from '../utils/escape.js';
import { closeSheets, icon, openSheet } from './ui.js';
import { emptyStateHTML } from './states.js';
import { buscarModulos } from '../data/search.data.js';

const MAX_VISIBLE = 8;

/**
 * Abre la búsqueda.
 * @param {{ navigate: (path: string) => void }} router
 * @param {{ isAdmin?: boolean }} options
 */
export function openGlobalSearch(router, { isAdmin = false } = {}) {
  const overlay = openSheet('Buscar', sheet => {
    const wrap = document.createElement('div');
    wrap.className = 'gs';
    wrap.innerHTML = `
      <div class="gs-field">
        ${icon('search', 18)}
        <input
          type="text"
          id="gsInput"
          class="gs-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="gsList"
          aria-autocomplete="list"
          aria-describedby="gsHint"
          placeholder="Busca un módulo o una pantalla…"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <p class="gs-hint" id="gsHint">Escribe para filtrar · ↑ ↓ para moverte · Enter para abrir</p>
      <div class="gs-list" id="gsList" role="listbox" aria-label="Resultados de búsqueda"></div>
    `;

    const input = wrap.querySelector('#gsInput');
    const list = wrap.querySelector('#gsList');
    let items = [];
    let activo = -1;

    const marcar = () => {
      [...list.querySelectorAll('.gs-item')].forEach((el, i) => {
        const on = i === activo;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', String(on));
      });
      const el = activo >= 0 ? list.querySelector(`#gs-opt-${activo}`) : null;
      if (el) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    };

    const abrir = entrada => {
      if (!entrada) return;
      // La hoja tiene su propia entrada de historial. Se suelta ANTES de
      // cerrar: si la ruta nueva se empujara con ese id dentro, el
      // `history.back()` con el que la hoja se cierra en una microtarea
      // devolvería a la pantalla anterior encima de la ruta recién abierta.
      if (history.state && history.state.__phOverlayId != null) {
        history.replaceState({ ...history.state, __phOverlayId: undefined }, '');
      }
      closeSheets();
      router.navigate(entrada.path);
    };

    const pintar = () => {
      const query = input.value.trim();
      items = buscarModulos(query, { isAdmin }).slice(0, MAX_VISIBLE);
      activo = items.length ? 0 : -1;

      if (!items.length) {
        list.innerHTML = emptyStateHTML({
          icon: 'search',
          title: 'Sin resultados',
          text: `Nada coincide con «${query}». Prueba con otra palabra.`,
        });
        input.removeAttribute('aria-activedescendant');
        return;
      }

      list.innerHTML = items
        .map(
          (item, i) => `
        <div class="gs-item" role="option" id="gs-opt-${i}" data-i="${i}" aria-selected="${i === 0}">
          <span class="gs-item-label">${escapeHtml(item.label)}</span>
          ${item.world ? `<span class="gs-item-world">${escapeHtml(item.world)}</span>` : ''}
        </div>`
        )
        .join('');

      marcar();
    };

    input.addEventListener('input', pintar);

    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!items.length) return;
        event.preventDefault();
        const paso = event.key === 'ArrowDown' ? 1 : -1;
        activo = (activo + paso + items.length) % items.length;
        marcar();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        abrir(items[activo] || items[0]);
      }
    });

    list.addEventListener('click', event => {
      const el = event.target.closest('[data-i]');
      if (!el) return;
      abrir(items[Number(el.dataset.i)]);
    });

    pintar();
    return wrap;
  });

  // El foco arranca en el campo: escribir es la acción principal. Se pide
  // después de montar porque `openSheet` enfoca la hoja para atrapar el Tab.
  const campo = overlay.querySelector('#gsInput');
  campo?.focus({ preventScroll: true });
  requestAnimationFrame(() => campo?.focus({ preventScroll: true }));
}

/**
 * Engancha la búsqueda a la navegación: atajo de teclado y cualquier
 * elemento con `data-global-search`.
 * @returns {() => void} para desenganchar
 */
export function installGlobalSearch({ router, isAdmin = false } = {}) {
  const adminAhora = () => (typeof isAdmin === 'function' ? Boolean(isAdmin()) : Boolean(isAdmin));

  const handler = event => {
    const atajoK = (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k';
    const disparador = event.target?.closest?.('[data-global-search]');
    if (!atajoK && !disparador) return;
    // Sin sesión no hay módulos que ofrecer.
    if (router.getCurrentPath?.().startsWith('/login')) return;
    event.preventDefault();
    openGlobalSearch(router, { isAdmin: adminAhora() });
  };

  document.addEventListener('keydown', handler);
  document.addEventListener('click', handler);
  return () => {
    document.removeEventListener('keydown', handler);
    document.removeEventListener('click', handler);
  };
}
