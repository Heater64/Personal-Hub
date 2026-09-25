/* ==========================================
   PageHeader — cabecera de pantalla del sistema nuevo
   Emite el marcado de la librería (.scr-head): título grande,
   subtítulo opcional y acciones alineadas a la derecha.
   ========================================== */

import { escapeHtml } from '../utils/escape.js';

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6h6v6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L7 20"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.8-4.9 2.2 2.1-4.9z"/></svg>',
  'gamepad-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 11V8H3"/><path d="M15.5 12a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/><path d="M12 2a4 4 0 0 1 4 4v1H8V6a4 4 0 0 1 4-4Z"/><path d="M2 17v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3"/></svg>',
  minecraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M8 9V5a4 4 0 0 1 8 0v4"/><path d="M7 14h3m-1.5-1.5v3M16 13h.01M18 15h.01"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>'
};

export function renderPageIcon(icon, className = 'ic') {
  const svg = ICONS[icon] || ICONS.home;
  return svg.replace('<svg ', `<svg class="${className}" aria-hidden="true" focusable="false" `);
}

/**
 * Cabecera de pantalla.
 * @param {{ title: string, subtitle?: string, icon?: string, actions?: string, mobileHidden?: boolean }} options
 */
export function renderPageHeader({ title, subtitle, actions, mobileHidden = false } = {}) {
  return `
    <header class="scr-head${mobileHidden ? ' scr-head--mobile-hidden' : ''}">
      <div>
        <h1 class="scr-title">${escapeHtml(title || '')}</h1>
        ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="head-actions">${actions}</div>` : ''}
    </header>
  `;
}
