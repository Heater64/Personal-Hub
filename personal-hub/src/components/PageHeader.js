import { escapeHtml } from '../utils/escape.js';

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="m15.5 8.5-2.1 4.8-4.9 2.2 2.1-4.9z"/></svg>',
  minecraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M8 9V5a4 4 0 0 1 8 0v4M7 14h3m-1.5-1.5v3M16 13h.01M18 15h.01"/></svg>'
};

export function renderPageIcon(icon, className = 'page-header__icon-svg') {
  const svg = ICONS[icon] || ICONS.home;
  return svg.replace('<svg ', `<svg class="${className}" aria-hidden="true" focusable="false" `);
}

export function renderPageHeader({ title, icon, mobileHidden = false }) {
  return `
    <header class="page-header${mobileHidden ? ' page-header--mobile-hidden' : ''}">
      <span class="page-header__icon">${renderPageIcon(icon)}</span>
      <h1 class="page-header__title">${escapeHtml(title)}</h1>
      <span class="page-header__line" aria-hidden="true"></span>
    </header>
  `;
}
