/* ==========================================
   states.js — estados vacíos y de carga compartidos

   Las pantallas pintan su HTML como cadena, así que aquí viven las dos
   piezas en forma de marcado reutilizable:

   · `emptyStateHTML`  → la misma tarjeta `.empty` que ya usa `emptyState()`
     en las pantallas que construyen DOM. Una sola verdad visual.
   · `skeletonHTML`    → filas de carga con la forma de una lista.
   · `skeletonCardsHTML` → huecos con la forma de una rejilla de tarjetas.

   Los tres respetan `prefers-reduced-motion`: el brillo del skeleton se
   apaga en CSS, aquí no hay animación en JS.
   ========================================== */

import { icon } from './ui.js';
import { escapeHtml } from '../utils/escape.js';

/**
 * Tarjeta de estado vacío.
 * @param {{ icon?: string, title: string, text?: string,
 *           action?: { label: string, id?: string, href?: string } }} options
 */
export function emptyStateHTML({ icon: iconName = 'search', title, text = '', action = null } = {}) {
  const boton = action?.label
    ? action.href
      ? `<a class="btn" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`
      : `<button class="btn" type="button"${action.id ? ` id="${escapeHtml(action.id)}"` : ''}>${escapeHtml(action.label)}</button>`
    : '';

  return `
    <div class="empty">
      <div class="e-ic">${icon(iconName, 24)}</div>
      <b>${escapeHtml(title || '')}</b>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${boton}
    </div>
  `;
}

/**
 * Filas de carga con la forma de una lista.
 * Va con `role="status"` y un texto solo para lectores de pantalla: quien no
 * ve el brillo sabe que está cargando.
 */
export function skeletonHTML({ rows = 4, label = 'Cargando', className = '' } = {}) {
  return `
    <div class="sk-list${className ? ` ${escapeHtml(className)}` : ''}" role="status" aria-live="polite" aria-busy="true">
      <span class="sr-only">${escapeHtml(label)}…</span>
      ${Array.from({ length: Math.max(1, rows) }, () => '<span class="sk-row" aria-hidden="true"></span>').join('')}
    </div>
  `;
}

/** Huecos de carga con la forma de una rejilla de tarjetas. */
export function skeletonCardsHTML({ count = 4, label = 'Cargando', className = '' } = {}) {
  return `
    <div class="sk-grid${className ? ` ${escapeHtml(className)}` : ''}" role="status" aria-live="polite" aria-busy="true">
      <span class="sr-only">${escapeHtml(label)}…</span>
      ${Array.from({ length: Math.max(1, count) }, () => '<span class="sk-card" aria-hidden="true"></span>').join('')}
    </div>
  `;
}
