/* ==========================================
   UI — Toolkit compartido
   Fuente única de: iconos SVG, cabeceras de pantalla,
   bottom sheets, toasts, estados vacíos y diálogos.

   Antes cada página traía su propio mapa de iconos y su
   propio CSS de modal; ahora todo vive aquí.
   ========================================== */

import { escapeHtml } from '../utils/escape.js';

/* ==========================================
   ICONOS — un solo set (stroke 1.8, 24×24)
   ========================================== */
export const ICONS = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6h6v6"/>',
  heart: '<path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8z"/>',
  'heart-handshake': '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12.4 5.8a.6.6 0 0 1-.8 0A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l5.5 5.4a2 2 0 0 0 2.9.05 2.1 2.1 0 0 0 0-3 2.1 2.1 0 1 0 3-3 2.1 2.1 0 0 0 3 0 2 2 0 0 0 0-2.8"/>',
  star: '<path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2-5.6-3.1-5.6 3.1 1.2-6.2L3 9.5l6.3-.8z"/>',
  spark: '<path d="M12 3.5 13.8 8.7 19 10.5l-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="m18.5 16.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checksq: '<path d="m9 11.5 2.5 2.5L21 4.5"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  volume: '<path d="M11 5 6.5 9H3v6h3.5l4.5 4z" fill="currentColor" stroke="none"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  muted: '<path d="M11 5 6.5 9H3v6h3.5l4.5 4z" fill="currentColor" stroke="none"/><path d="m16 9.5 5 5m0-5-5 5"/>',
  volumeLow: '<path d="M11 5 6.5 9H3v6h3.5l4.5 4z" fill="currentColor" stroke="none"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/>',
  send: '<path d="m21 3-9.5 18-2.5-7-7-2.5z"/><path d="M21 3 9 14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M12 8v13"/><path d="M12 8H8.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8z"/><path d="M12 8h3.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  music: '<path d="M9 18V5l10-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM19 16a3 3 0 1 1-3-3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L7 20"/>',
  video: '<rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2v8l-4-2z"/>',
  camera: '<path d="M5 8h2.5l1.2-2h6.6L16.5 8H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><circle cx="12" cy="14" r="3.4"/>',
  game: '<path d="M6 11V8H3"/><path d="M15.5 12a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/><path d="M12 2a4 4 0 0 1 4 4v1H8V6a4 4 0 0 1 4-4Z"/><path d="M2 17v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h4.5A3.5 3.5 0 0 0 21 8.5C21 5.5 17 3 12 3z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>',
  pin: '<path d="M12 17v5"/><path d="M8.5 3h7l-.8 6 3.3 3v2H6v-2l3.3-3z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-6M13 17V7M18 17v-9"/>',
  cloud: '<path d="M20 17.6A5 5 0 0 0 18 8h-1.3A7 7 0 1 0 5 15.7"/><path d="M12 12v9"/><path d="m8.5 17.5 3.5 3.5 3.5-3.5"/>',
  upload: '<path d="M20 17.6A5 5 0 0 0 18 8h-1.3A7 7 0 1 0 5 15.7"/><path d="M12 21V12"/><path d="m8.5 15.5 3.5-3.5 3.5 3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  pencil: '<path d="m4 20 4-.9L19 8a2.1 2.1 0 0 0-3-3L5 16zM13.5 6.5l4 4"/>',
  coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2a3 3 0 0 1 0 6h-2M3 21h15"/>',
  cake: '<path d="M4 21h16"/><path d="M5 21v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6"/><path d="M12 10V7.5"/><path d="M12 7.5a1.5 1.5 0 1 0-1.5-1.5"/><path d="M9 13v-2M15 13v-2"/>',
  cart: '<path d="M3 4h2l2 11h10l3-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  map: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  paw: '<circle cx="7" cy="7.5" r="1.7"/><circle cx="12" cy="5.8" r="1.7"/><circle cx="17" cy="7.5" r="1.7"/><path d="M12 11.5c-2.9 0-5.2 2.1-5.2 4.4 0 1.6 1.2 2.9 2.9 2.9 1 0 1.5-.4 2.3-.4s1.3.4 2.3.4c1.7 0 2.9-1.3 2.9-2.9 0-2.3-2.3-4.4-5.2-4.4z"/>',
  water: '<path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z"/>',
  run: '<circle cx="13" cy="5" r="2"/><path d="m11 9-2 5 4 2 2 5M9 14l-4 4M11 9l5 2 2 4"/>',
  flower: '<path d="M12 21V9M12 13c-5 0-7-3-7-7 4 0 7 2 7 7zM12 17c5 0 7-3 7-7-4 0-7 2-7 7z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.8-4.9 2.2 2.1-4.9z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>',
  flower2: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM12 15a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM3 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0zM15 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z"/>',
  gift2: '<path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 21V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'
};

/**
 * Icono SVG inline.
 * @param {string} name clave de ICONS
 * @param {number} size tamaño en px
 * @param {string} className clases extra para el contenedor
 */
export function icon(name, size = 20, className = '') {
  const box = size || 20;
  return `<span class="ic ${className}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="${box}" height="${box}">${ICONS[name] || ICONS.star}</svg></span>`;
}

/* ==========================================
   DOM — constructor de elementos
   ========================================== */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') el.value = value;
    else if (key === 'checked') el.checked = value;
    else if (key === 'disabled') el.disabled = true;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(child));
  }
  return el;
}

/* ==========================================
   CABECERAS DE PANTALLA
   ========================================== */
export function headBar(title, subtitle, ...actions) {
  return h('div', { class: 'scr-head' },
    h('div', null,
      h('h1', { class: 'scr-title' }, title),
      subtitle ? h('p', { class: 'sub' }, subtitle) : null
    ),
    actions.filter(Boolean).length ? h('div', { class: 'head-actions' }, ...actions.filter(Boolean)) : null
  );
}

export function formHead(title, onBack, extra) {
  return h('div', { class: 'scr-head' },
    h('div', { style: 'display:flex;align-items:center;gap:10px;min-width:0' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Volver', onclick: onBack, html: icon('back', 19) }),
      h('h1', { class: 'scr-title', style: 'font-size:var(--fs-lg)' }, title)
    ),
    extra ? h('div', { class: 'head-actions' }, extra) : null
  );
}

export function iconBtn(name, label, onClick, { size = 19, small = false } = {}) {
  return h('button', {
    class: small ? 'mini-btn' : 'icon-btn',
    type: 'button',
    'aria-label': label,
    onclick: onClick,
    html: icon(name, size)
  });
}

/* ==========================================
   ESTADOS VACÍOS
   ========================================== */
export function emptyState(iconName, title, text, actionLabel, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'e-ic', html: icon(iconName, 24) }),
    h('b', null, title),
    text ? h('p', null, text) : null,
    actionLabel ? h('button', { class: 'btn', type: 'button', onclick: action }, actionLabel) : null
  );
}

/* ==========================================
   OVERLAYS — bottom sheet, confirmación, toast
   ========================================== */
const OVERLAY_ROOT_ID = 'toast-container';

function overlayRoot() {
  let root = document.getElementById('overlays');
  if (!root) {
    root = document.createElement('div');
    root.id = 'overlays';
    document.body.appendChild(root);
  }
  return root;
}

let lastFocused = null;
let sheetEsc = null;

/**
 * Abre un bottom sheet. `build` recibe el elemento del sheet y devuelve
 * (o añade) el contenido.
 */
export function openSheet(title, build) {
  const overlay = h('div', {
    class: 'overlay',
    onclick: event => { if (event.target === overlay) closeSheets(); }
  });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    h('div', { class: 'grabber' })
  );
  if (title) {
    sheet.append(h('div', { class: 'sheet-head' },
      h('h2', null, title),
      iconBtn('x', 'Cerrar', closeSheets, { size: 18, small: true })
    ));
  }
  const body = build ? build(sheet) : null;
  if (body) sheet.append(body);
  overlay.append(sheet);
  lastFocused = document.activeElement;
  overlayRoot().append(overlay);
  if (!sheetEsc) {
    sheetEsc = event => { if (event.key === 'Escape') closeSheets(); };
    document.addEventListener('keydown', sheetEsc);
  }
  const focusable = sheet.querySelector('input,select,textarea,button');
  if (focusable) focusable.focus({ preventScroll: true });
  return overlay;
}

export function closeSheets() {
  overlayRoot().innerHTML = '';
  if (sheetEsc) { document.removeEventListener('keydown', sheetEsc); sheetEsc = null; }
  if (lastFocused && typeof lastFocused.focus === 'function') {
    try { lastFocused.focus({ preventScroll: true }); } catch { /* ignorar */ }
  }
  lastFocused = null;
}

export function confirmDialog({ title, message, confirmText = 'Eliminar', danger = true, onConfirm }) {
  const overlay = h('div', {
    class: 'overlay',
    style: 'z-index:calc(var(--z-modal) + 5)',
    onclick: event => { if (event.target === overlay) overlay.remove(); }
  });
  const sheet = h('div', { class: 'sheet', style: 'max-width:420px', role: 'alertdialog', 'aria-label': title },
    h('h3', { style: 'font-size:var(--fs-md);font-weight:800;margin-bottom:8px' }, title),
    h('p', { style: 'font-size:var(--fs-sm);color:var(--text-2);line-height:1.55;margin-bottom:20px' }, message),
    h('div', { style: 'display:flex;gap:10px;justify-content:flex-end' },
      h('button', { class: 'btn-soft', type: 'button', onclick: () => overlay.remove() }, 'Cancelar'),
      h('button', {
        class: danger ? 'btn-danger' : 'btn',
        type: 'button',
        onclick: () => { overlay.remove(); if (onConfirm) onConfirm(); }
      }, confirmText)
    )
  );
  overlay.append(sheet);
  document.body.appendChild(overlay);
  const first = sheet.querySelector('button');
  if (first) first.focus({ preventScroll: true });
  return overlay;
}

let toastTimer = null;

export function toast(message, action) {
  const holder = document.getElementById(OVERLAY_ROOT_ID) || (() => {
    const el = document.createElement('div');
    el.id = OVERLAY_ROOT_ID;
    document.body.appendChild(el);
    return el;
  })();
  holder.innerHTML = '';
  const el = h('div', { class: 'toast', role: 'status' },
    h('span', null, message),
    action ? h('button', { type: 'button', onclick: () => { el.remove(); action.fn(); } }, action.label || 'Deshacer') : null
  );
  holder.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), action ? 6000 : 2600);
  return el;
}

/* ==========================================
   AVATAR
   ========================================== */
export function avatarEl(name, photo, size = 40, className = '') {
  const box = h('div', {
    class: `avatar ${className}`,
    style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`
  });
  if (photo) box.append(h('img', { src: photo, alt: '', loading: 'lazy' }));
  else box.append(escapeHtml((name || '?').trim().charAt(0).toUpperCase()));
  return box;
}

/* ==========================================
   ACCIÓN RÁPIDA (FAB)
   ========================================== */
const QUICK_ACTIONS = [
  { id: 'calendario', icon: 'calendar', label: 'Calendario', hint: 'Sorpresas y días especiales' },
  { icon: 'spark', label: 'Razones', hint: 'Una razón nueva para quererte' },
  { icon: 'mail', label: 'Open When', hint: 'Cartas para cuando lo necesites' },
  { icon: 'music', label: 'Canciones', hint: 'Lo que suena entre nosotros' },
  { icon: 'image', label: 'Galería', hint: 'Momentos guardados' },
  { icon: 'heart', label: 'Mal Día', hint: 'Un abrazo para el mal día' }
];

export function quickAddMenu(router) {
  openSheet('¿Qué quieres abrir?', () => {
    const list = h('div', { style: 'margin:-4px -20px -8px' });
    for (const action of QUICK_ACTIONS) {
      list.append(h('button', {
        class: 'set-row',
        type: 'button',
        onclick: () => { closeSheets(); router.navigate('/' + action.id); }
      },
        h('span', { class: 'r-ic', html: icon(action.icon, 19) }),
        h('div', { style: 'flex:1' },
          h('b', { style: 'font-size:var(--fs-base);display:block' }, action.label),
          h('span', { style: 'font-size:var(--fs-xs);color:var(--text-2);font-weight:500' }, action.hint)
        ),
        h('span', { class: 'chev', html: icon('chev', 17) })
      ));
    }
    return list;
  });
}
