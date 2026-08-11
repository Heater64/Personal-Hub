/* ==========================================
   Personal Hub v2 — Admin Panel
   Dashboard · Estados de Ánimo · Usuarios ·
   Contenido · Actividad
   ========================================== */

import { db } from '../services/db.service.js';
import {
  loadCatalog, saveCatalog, loadFavorites,
  createId, getSeasons, getTotal, deleteCatalogItem
} from '../services/seriesData.js';
import { seasonEditorHTML, collectSeasons, emptySeasonHTML, bindSeasonEditorEvents } from '../services/seriesEditor.js';
import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { isValidUrlField, todayISO, hourInSpain } from '../utils/format.js';
import { isPushSupported, isEnabled, showDailyNotification, requestEnable, disable } from '../services/notifications.service.js';
import { loadGiftsCatalog, invalidateGiftsCache } from '../services/gifts.service.js';
import { theme } from '../services/theme.service.js';
import { CATEGORIES, TYPE_META, LETTERS } from './OpenWhen.js';
import {
  fileKind, kindLabel, formatBytes
} from '../services/cloudinary.service.js';
import { auth } from '../services/auth.service.js';
import { visiblePhotos, baseFolders } from '../services/galleryData.js';
import { getUserPref } from '../utils/userStorage.js';

// Resuelve una promesa sin romper el panel: si la query falla (Supabase caído,
// sesión caducada, RLS…), devuelve el fallback en vez de colgar el dashboard.
function safe(promise, fallback) {
  return Promise.resolve(promise).catch(err => {
    console.warn('[admin] Query fallida (usando fallback):', err?.message || err);
    return fallback;
  });
}
const arr = v => (Array.isArray(v) ? v : []);

// ==========================================
// SVG ICONS
// ==========================================
const UI = {
  dash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  content: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  toggleOn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3" fill="currentColor"/></svg>',
  toggleOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3" fill="currentColor"/></svg>',
  music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  gift: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  newspaper: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
  film: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>',
  smile: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  bell: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>',
  send: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  filter: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  cloud: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.7A4 4 0 0 0 7 19z"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="9 15 12 12 15 15"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
};

// ==========================================
// MOOD CONSTANTS
// ==========================================
const MOOD_EMOJIS = { great: '🤍🤍🤍', good: '😊', meh: '😕', bad: '😔', love: '❤️' };
const MOOD_LABELS = { great: 'Muy bieeeen', good: 'Bien', meh: 'Un poquito mal', bad: 'Mal', love: 'Necesito cariño' };
const MOOD_SCORES = { great: 4, good: 3, meh: 2, bad: 1, love: 0 };
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ==========================================
// ACTIVIDAD DE USO — helpers compartidos
// (dashboard y detalle de usuario)
// ==========================================
const SECTION_LABELS = {
  '/': 'Inicio', '/rincon': 'Rincón', '/galeria': 'Galería', '/memes': 'Memes',
  '/audios': 'Audios', '/curiosidades': 'Curiosidades', '/canciones': 'Música',
  '/juegos': 'Juegos', '/series': 'Series', '/sentimientos': 'Sentimientos',
  '/razones': 'Razones', '/openwhen': 'Open When', '/calendario': 'Calendario',
  '/maldia': 'Mal Día', '/ositos': 'OsitosWorld', '/thoseeyes': 'Those Eyes',
  '/justthewayyouare': 'Just The Way You Are', '/perfil': 'Perfil', '/admin': 'Panel Admin'
};

/** Sección raíz de una página: '/canciones?v=x' → '/canciones', '/juegos/online/1' → '/juegos' */
function basePageOf(p) {
  const base = String(p || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return '/' + (base.split('/').filter(Boolean)[0] || '');
}

/** Duración legible a partir de ms. */
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m <= 0) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

/** "Ahora mismo", "Hace 5 min", "Hace 2 h" o fecha corta. */
function relTimeShort(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60e3) return 'Ahora mismo';
  if (diff < 3600e3) return `Hace ${Math.floor(diff / 60e3)} min`;
  if (diff < 86400e3) return `Hace ${Math.floor(diff / 3600e3)} h`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

// Content-tab sub-tabs
const CONTENT_SUBS = [
  { id: 'razones',   icon: UI.heart,     label: 'Razones' },
  { id: 'canciones', icon: UI.music,     label: 'Canciones' },
  { id: 'regalos',   icon: UI.gift,      label: 'Regalos' },
  { id: 'noticias',  icon: UI.newspaper, label: 'Noticias' },
  { id: 'maldia',    icon: UI.smile,     label: 'Mal Día' },
  { id: 'series',    icon: UI.film,      label: 'Series' },
  { id: 'openwhen',  icon: UI.mail,      label: 'Open When' },
  { id: 'audios',    icon: UI.music,     label: 'Audios' }
];

const TABS = [
  { id:'dashboard',       icon: UI.dash,     label:'Dashboard' },
  { id:'moods',           icon: UI.heart,    label:'Ánimo' },
  { id:'usuarios',        icon: UI.users,    label:'Usuarios' },
  { id:'contenido',       icon: UI.content,  label:'Contenido' },
  { id:'multimedia',      icon: UI.cloud,    label:'Multimedia' },
  { id:'notificaciones',  icon: UI.bell,     label:'Notificaciones' },
  { id:'actividad',       icon: UI.activity, label:'Actividad' },
  { id:'config',          icon: UI.settings, label:'Configuración' }
];

// ==========================================
// SKELETON LOADER
// ==========================================
function skeletonCard(h = '120px') {
  return `<div class="card skeleton-card" style="height:${h};margin-bottom:12px;"></div>`;
}

function skeletonText(w = '80%') {
  return `<div class="skeleton skeleton-text" style="width:${w};"></div>`;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export function AdminPage(router) {
  const page = document.createElement('div');
  page.className = 'admin-page';

  const esc = escapeHtml;
  const user = userStore.getUser();
  const userName = user?.name || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();
  const userPhoto = user?.photo || '';
  const userRole = user?.role || 'admin';

  // Time-based greeting (hora de España, península)
  const hour = hourInSpain();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const greetingEmoji = hour < 12 ? '☀️' : hour < 19 ? '🌤️' : '🌙';

  page.innerHTML = `
    <div class="admin-layout">
      <main class="admin-main">
        <header class="admin-topbar">
          <div class="admin-topbar-brand">
            <span class="admin-topbar-icon">${UI.settings}</span>
            <div class="admin-topbar-brand-text">
              <strong>Panel Admin</strong>
              <span>Personal Hub</span>
            </div>
          </div>
          <nav class="admin-topbar-nav" id="adminTopNav" aria-label="Secciones del panel">
            ${TABS.map(t => `<button class="admin-topbar-tab${t.id==='dashboard'?' active':''}" data-section="${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')}
          </nav>
          <div class="admin-topbar-right">
            <span class="admin-conn-pill admin-conn-pill--top" id="adminConnPill" title="Estado de la base de datos"></span>
            <div class="admin-topbar-user">
              <div class="admin-sidebar-avatar">
                ${userPhoto ? `<img src="${esc(userPhoto)}" alt="">` : userInitial}
              </div>
              <div class="admin-topbar-user-info">
                <span class="admin-topbar-user">${esc(userName)} <span class="admin-sidebar-admin-badge">ADMIN</span></span>
                <span class="admin-topbar-role">Administrador</span>
              </div>
            </div>
            <button type="button" class="admin-topbar-logout" id="adminLogout" aria-label="Cerrar sesión">🚪 Salir</button>
          </div>
        </header>
        <div class="admin-welcome">
          <div class="admin-welcome-greeting">
            <h1>${greeting}, ${esc(userName)} ${greetingEmoji}</h1>
            <div class="admin-welcome-sub">
              <span>Aquí tienes un resumen de tu Personal Hub.</span>
            </div>
          </div>
          <div class="admin-welcome-actions">
            <span class="admin-time-badge" id="adminTimeBadge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span id="adminTimeText"></span>
            </span>
            <span class="admin-time-badge admin-date-badge" id="adminDateBadge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span id="adminDateText"></span>
            </span>
          </div>
        </div>
        <div class="admin-db-status" id="adminDbStatus" style="display:none"></div>
        <div class="admin-content" id="adminContent"></div>
        <footer class="admin-footer">
          <span>De hecho te amo</span>
          <span>${new Date().getFullYear()} · hecho por tu peluche</span>
        </footer>
      </main>
    </div>
    <div class="admin-modal-overlay" id="adminModal" style="display:none">
      <div class="admin-modal">
        <div class="admin-modal-header">
          <h3 id="adminModalTitle"></h3>
          <button type="button" class="admin-modal-close" id="adminModalClose" aria-label="Cerrar">${UI.close}</button>
        </div>
        <div class="admin-modal-body" id="adminModalBody"></div>
        <div class="admin-modal-footer">
          <button type="button" class="admin-btn admin-btn-secondary" id="adminModalCancel">Cancelar</button>
          <button type="button" class="admin-btn admin-btn-primary" id="adminModalSave">${UI.check} Guardar</button>
        </div>
      </div>
    </div>
  `;

  // ===== STATE =====
  const S = { section: 'dashboard', moodDate: new Date(), contentSub: 'razones', calMonth: null, calDay: null };

  const content = page.querySelector('#adminContent');

  // Live clock
  const timeText = page.querySelector('#adminTimeText');
  const updateClock = () => {
    if (timeText) {
      timeText.textContent = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 30000);

  // Fecha actual en el header
  const dateText = page.querySelector('#adminDateText');
  if (dateText) {
    dateText.textContent = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ===== TOPBAR NAV =====
  function setActiveSection(btn, section) {
    page.querySelectorAll('.admin-topbar-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    S.section = section;
    loadSection(section);
  }

  page.querySelectorAll('.admin-topbar-tab').forEach(item => {
    item.addEventListener('click', () => setActiveSection(item, item.dataset.section));
  });

  // Logout
  page.querySelector('#adminLogout')?.addEventListener('click', async () => {
    await auth.signOut();
    // replace: Atrás no debe volver a una página ya protegida por el guard
    router.replace('/login');
  });

  // ===== MODAL =====
  const modal = {
    el: page.querySelector('#adminModal'),
    title: page.querySelector('#adminModalTitle'),
    body: page.querySelector('#adminModalBody'),
    saveBtn: page.querySelector('#adminModalSave'),
    cancelBtn: page.querySelector('#adminModalCancel'),
    closeBtn: page.querySelector('#adminModalClose'),
    _currentOnSave: null,

    open(title, bodyHtml, onSave, saveLabel) {
      this.title.textContent = title;
      this.body.innerHTML = bodyHtml;
      this.el.style.display = 'flex';
      this._currentOnSave = onSave || null;
      this.saveBtn.closest('.admin-modal-footer').style.display = onSave ? 'flex' : 'none';
      this.saveBtn.disabled = false;
      const isDanger = saveLabel === 'Eliminar';
      this.saveBtn.classList.toggle('admin-btn-danger', isDanger);
      this.saveBtn.innerHTML = `${UI.check} ${saveLabel || 'Guardar'}`;
    },

    close() {
      this.el.style.display = 'none';
      this._currentOnSave = null;
      this.saveBtn.classList.remove('admin-btn-danger');
    },

    async save() {
      if (!this._currentOnSave) return;
      this.saveBtn.disabled = true;
      this.saveBtn.textContent = 'Guardando...';
      try {
        await this._currentOnSave();
        this.close();
        loadSection(S.section);
        showToast('Guardado', 'success');
      } catch (err) {
        showToast(err?.message || 'Error al guardar', 'error');
      } finally {
        this.saveBtn.disabled = false;
        this.saveBtn.classList.remove('admin-btn-danger');
        this.saveBtn.innerHTML = `${UI.check} Guardar`;
      }
    }
  };

  modal.cancelBtn.addEventListener('click', () => modal.close());
  modal.closeBtn.addEventListener('click', () => modal.close());
  modal.el.addEventListener('click', (e) => { if (e.target === modal.el) modal.close(); });
  modal.saveBtn.addEventListener('click', () => modal.save());

  // Escape key closes modal
  const escapeHandler = (e) => {
    if (e.key === 'Escape' && modal.el.style.display === 'flex') {
      modal.close();
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Cleanup on navigation
  page.cleanup = () => {
    document.removeEventListener('keydown', escapeHandler);
    clearInterval(clockInterval);
  };

  // ===== SECTION LOADER =====
  // Token de sección: si el usuario cambia de pestaña del admin mientras una
  // carga async está en curso, la escritura del DOM obsoleto se aborta.
  // Evita el crash "Cannot set properties of null (setting 'innerHTML')".
  let sectionToken = 0;
  // Token por render de Ánimos: dos clics rápidos en ‹ › lanzan renders
  // solapados; el último clic debe ganar aunque resuelva antes el anterior.
  let moodRenderToken = 0;
  function loadSection(section) {
    sectionToken++;
    const loaders = {
      dashboard: loadDashboard, moods: loadMoods,
      usuarios: loadUsuarios, contenido: loadContenido,
      multimedia: loadMultimedia,
      notificaciones: loadNotificaciones,
      actividad: loadActividad,
      config: loadConfiguracion
    };
    if (loaders[section]) loaders[section]();
  }

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  async function loadDashboard() {
    // Skeleton
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.dash} Resumen general</h2></div>
        <div class="dash-metrics">
          ${'<div class="dash-metric skeleton-card"></div>'.repeat(5)}
        </div>
        <div class="dash-metrics">
          ${'<div class="dash-metric skeleton-card"></div>'.repeat(5)}
        </div>
      </section>
    `;

    const token = sectionToken;
    const today = todayISO();
    const todayDate = new Date();

    const [
      reasons, songs, giftsData, users, audios, news,
      maldiaFrases, maldiaMensajes, owLetters, activity, allMoods, seriesCatalog, visits
    ] = await Promise.all([
      safe(db.getReasons(), []), safe(db.getSongs(), []), safe(db.getGifts(), { gifts: [] }),
      safe(db.listUsers(), []), safe(db.getAudios(), []), safe(db.getNews(), []),
      safe(db.getMaldiaFrases(), []), safe(db.getMaldiaMensajes(), []), safe(db.getOpenWhenLetters(), []),
      safe(db.getActivity(200), []), safe(db.getAllMoods('2024-01-01', today), []), safe(loadCatalog(), null),
      safe(db.getPageVisits(2000), [])
    ]);

    // Fechas especiales configurables (aniversario, inicio del Hub, cumpleaños)
    const hubDates = await db.getHubDates();
    const annivISO = hubDates.anniversary || '2024-07-10';
    const hubStartISO = hubDates.hubStart || '2024-05-10';
    const birthdayISO = hubDates.birthday || '2024-11-24';

    const moods = arr(allMoods);
    const reasonsList = arr(reasons);
    const songsList = arr(songs);
    const newsList = arr(news);
    const maldiaFrasesList = arr(maldiaFrases);
    const maldiaMensajesList = arr(maldiaMensajes);
    const owLettersList = arr(owLetters);
    const visitsList = arr(visits);
    const audiosList = arr(audios);
    const activityList = arr(activity);
    const giftsCount = (giftsData?.gifts || []).length;
    const seriesCount = Array.isArray(seriesCatalog) ? seriesCatalog.length : 0;
    const realUsers = users.filter(u => !u.id.startsWith('local_') && u.id.length > 10);

    if (token !== sectionToken) return; // la sección cambió mientras cargaba

    // ---- Helpers de fechas ----
    const yearsBetween = (iso) => {
      const start = new Date(iso + 'T00:00:00');
      let y = todayDate.getFullYear() - start.getFullYear();
      if (new Date(todayDate.getFullYear(), start.getMonth(), start.getDate()) > todayDate) y--;
      return Math.max(y, 0);
    };
    const monthsBetween = (iso) => {
      const start = new Date(iso + 'T00:00:00');
      let m = (todayDate.getFullYear() - start.getFullYear()) * 12 + (todayDate.getMonth() - start.getMonth());
      if (todayDate.getDate() < start.getDate()) m--;
      return Math.max(m, 0);
    };
    const fmtShortDate = (iso) => new Date(iso + 'T00:00:00')
      .toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

    // ---- Métricas ----
    const monthKey = today.slice(0, 7);
    const usersThisMonth = realUsers.filter(u => (u.created_at || '').startsWith(monthKey)).length;
    const moodsThisMonth = moods.filter(m => (m.date || '').startsWith(monthKey)).length;
    const songsThisWeek = songsList.filter(s => {
      const t = s && (s.createdAt || s.addedAt);
      return t && (Date.now() - new Date(t).getTime()) < 7 * 864e5;
    }).length;

    // Fotos de la galería
    let galleryPhotos = 0;
    try {
      const folders = baseFolders();
      (folders.length ? folders : ['general']).forEach(f => { galleryPhotos += visiblePhotos(f).length; });
    } catch { galleryPhotos = 0; }

    // Notificaciones sin leer: razones nuevas + cartas Open When sin abrir
    let unreadReasons = 0;
    try {
      const readSet = new Set(JSON.parse(getUserPref('razonesRead', '[]') || '[]'));
      unreadReasons = reasonsList.filter((r, i) => r && r.date && r.date <= today && !readSet.has(r.id || `r${i}`)).length;
    } catch { /* */ }
    let unreadLetters = 0;
    try {
      const seen = new Set(JSON.parse(getUserPref('openwhen.seen', '[]') || '[]'));
      unreadLetters = owLettersList.filter(l => l && l.id && !seen.has(l.id)).length;
    } catch { /* */ }

    const frases = reasonsList.length + maldiaFrasesList.length;
    const mensajes = frases + maldiaMensajesList.length;
    const hubMonths = monthsBetween(hubStartISO);

    const row1 = [
      { icon: '👥', value: realUsers.length, label: 'Usuarios', trend: `+${usersThisMonth} este mes` },
      { icon: '❤️', value: moods.length, label: 'Contenido de ánimo', trend: `+${moodsThisMonth} este mes` },
      { icon: '📅', value: yearsBetween(annivISO), label: 'Años juntos', trend: fmtShortDate(annivISO) },
      { icon: '⏱️', value: hubMonths >= 24 ? `${Math.floor(hubMonths / 12)} años` : `${hubMonths} meses`, label: 'En el Hub', trend: 'Desde el inicio' },
      { icon: '🎵', value: songsList.length, label: 'Canciones', trend: songsThisWeek ? `+${songsThisWeek} esta semana` : 'En el catálogo' }
    ];
    const row2 = [
      { icon: '🎁', value: giftsCount, label: 'Regalos', trend: 'Total registrados' },
      { icon: '📝', value: audiosList.length, label: 'Notas', trend: 'Notas de voz' },
      { icon: '🖼️', value: galleryPhotos, label: 'Fotos', trend: 'En la galería' },
      { icon: '💬', value: mensajes, label: 'Mensajes', trend: 'En frases' },
      { icon: '🔔', value: unreadReasons + unreadLetters, label: 'Notificaciones', trend: 'Sin leer' }
    ];
    const metricCard = (m) => `
      <div class="dash-metric">
        <div class="dash-metric-icon">${m.icon}</div>
        <div class="dash-metric-value">${m.value}</div>
        <div class="dash-metric-label">${m.label}</div>
        <div class="dash-metric-trend">${m.trend}</div>
      </div>`;

    // ---- Serie de los últimos N días (actividad o ánimos, área) ----
    let chartMetric = 'activity'; // 'activity' | 'mood'
    const seriesDays = (n, metric) => {
      const days = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = todayISO(d);
        days.push({ ds, count: 0, label: d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) });
      }
      const byDay = new Map(days.map(x => [x.ds, x]));
      const source = metric === 'mood' ? moods : metric === 'visits' ? visitsList : activityList;
      source.forEach(e => {
        const ts = metric === 'mood' ? (e.date || '') : e.timestamp;
        if (!ts) return;
        const day = byDay.get(todayISO(new Date(ts)));
        if (day) day.count++;
      });
      return days;
    };

    const areaChart = (days) => {
      const W = 540, H = 150, PAD = 10;
      const max = Math.max(...days.map(d => d.count), 4);
      const stepX = (W - PAD * 2) / (days.length - 1 || 1);
      const y = (c) => H - PAD - (c / max) * (H - PAD * 2);
      const pts = days.map((d, i) => [PAD + i * stepX, y(d.count)]);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const area = `${line} L${(W - PAD).toFixed(1)},${(H - PAD).toFixed(1)} L${PAD},${(H - PAD).toFixed(1)} Z`;
      const grid = [1, 0.66, 0.33, 0].map(f => Math.round(max * f));
      const labelsEvery = Math.max(1, Math.ceil(days.length / 6));
      return `
        <svg class="dash-area-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Actividad de los últimos ${days.length} días">
          <defs>
            <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ff6b4a" stop-opacity="0.32"/>
              <stop offset="100%" stop-color="#ff6b4a" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          ${grid.map(g => `<line x1="${PAD}" y1="${y(g)}" x2="${W - PAD}" y2="${y(g)}" class="dash-area-grid"/>`).join('')}
          <path d="${area}" fill="url(#dashAreaFill)"/>
          <path d="${line}" fill="none" class="dash-area-line"/>
          ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${days[i].count ? 3 : 1.6}" class="dash-area-dot"/>`).join('')}
        </svg>
        <div class="dash-area-labels">
          ${days.map((d, i) => (i % labelsEvery === 0 || i === days.length - 1)
            ? `<span>${d.label}</span>` : `<span></span>`).join('')}
        </div>`;
    };

    // ---- Distribución de contenido (dona) ----
    const dist = [
      { label: 'Series', count: seriesCount, color: '#ff6b4a' },
      { label: 'Fotos', count: galleryPhotos, color: '#ff9e7a' },
      { label: 'Frases', count: mensajes, color: '#f5b942' },
      { label: 'Música', count: songsList.length + audiosList.length, color: '#4ec9b0' },
      { label: 'Otros', count: giftsCount + newsList.length + owLettersList.length, color: '#9b8cff' }
    ];
    const distTotal = dist.reduce((s, d) => s + d.count, 0) || 1;
    let acc = 0;
    const distSegs = dist.map(d => {
      const frac = d.count / distTotal;
      const seg = { ...d, frac, start: acc };
      acc += frac;
      return seg;
    });
    const R = 42, CIRC = 2 * Math.PI * R;
    const donutHtml = distSegs.map(d => {
      const len = Math.max(d.frac * CIRC - 2, 0.5);
      return `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${d.color}" stroke-width="14"
        stroke-dasharray="${len.toFixed(1)} ${(CIRC - len).toFixed(1)}" stroke-dashoffset="${(-d.start * CIRC).toFixed(1)}" stroke-linecap="butt"/>`;
    }).join('');
    const donutLegend = distSegs.map(d => `
      <div class="dash-legend-row">
        <span class="dash-legend-dot" style="background:${d.color}"></span>
        <span class="dash-legend-label">${d.label}</span>
        <span class="dash-legend-count">${d.count} (${Math.round(d.frac * 100)}%)</span>
      </div>`).join('');

    // ---- Tendencia de ánimo ----
    const MOOD_FACE = { great: '🤍🤍', good: '😊', meh: '😕', bad: '😔', love: '❤️' };
    const MOOD_TITLE = { great: 'Muy bien', good: 'Feliz', meh: 'Regular', bad: 'Necesita un abrazo', love: 'Enamorada' };
    const moodCounts = {};
    moods.forEach(m => { const k = m.mood || m.status || 'good'; moodCounts[k] = (moodCounts[k] || 0) + 1; });
    const dominant = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    const domKey = dominant ? dominant[0] : 'good';
    const avgScore = moods.length
      ? moods.reduce((s, m) => s + (MOOD_SCORES[m.mood || m.status] ?? 2), 0) / moods.length
      : 2;
    const WEEK_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const weekCounts = [0, 0, 0, 0, 0, 0, 0];
    moods.forEach(m => {
      if (!m.date) return;
      weekCounts[new Date(m.date + 'T12:00:00').getDay()]++;
    });
    const weekMax = Math.max(...weekCounts, 1);
    const weekBars = WEEK_LABELS.map((l, i) => {
      const h = weekCounts[i] ? Math.max(Math.round((weekCounts[i] / weekMax) * 100), 12) : 4;
      return `<div class="dash-week-col" title="${l}: ${weekCounts[i]} registro${weekCounts[i] === 1 ? '' : 's'}">
        <div class="dash-week-wrap"><div class="dash-week-bar${weekCounts[i] ? ' has' : ''}" style="height:${h}%"></div></div>
        <span class="dash-week-label">${l}</span>
      </div>`;
    }).join('');

    // ---- Fechas importantes ----
    const fmtDate = (d) => d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayStart = new Date(today + 'T00:00:00');
    const daysUntil = (target) => Math.round((target - todayStart) / 864e5);
    const startAnniv = new Date(annivISO + 'T00:00:00');
    let anniv = new Date(todayDate.getFullYear(), startAnniv.getMonth(), startAnniv.getDate());
    if (anniv < todayStart) anniv = new Date(todayDate.getFullYear() + 1, startAnniv.getMonth(), startAnniv.getDate());
    const annivDays = daysUntil(anniv);
    const annivYears = anniv.getFullYear() - startAnniv.getFullYear();
    const bd = new Date(birthdayISO + 'T00:00:00');
    let birthday = new Date(todayDate.getFullYear(), bd.getMonth(), bd.getDate());
    if (birthday < todayStart) birthday = new Date(todayDate.getFullYear() + 1, bd.getMonth(), bd.getDate());
    const birthdayDays = daysUntil(birthday);
    const fechas = [
      { icon: '🤍', title: `${annivYears} año${annivYears === 1 ? '' : 's'} juntos`, date: fmtDate(anniv),
        badge: annivDays === 0 ? '¡Hoy! 💫' : `En ${annivDays} día${annivDays === 1 ? '' : 's'}`, hot: annivDays <= 30 },
      { icon: '🎁', title: 'Cumple de la persona especial', date: fmtDate(bd),
        badge: birthdayDays === 0 ? '¡Hoy! 🎂' : `En ${birthdayDays} día${birthdayDays === 1 ? '' : 's'}`, hot: birthdayDays <= 30 },
      { icon: '📅', title: 'Nuestro primer mensaje', date: fmtDate(new Date(hubStartISO + 'T00:00:00')), badge: 'Ya pasó', muted: true }
    ];

    // ---- Actividad reciente ----
    const ACT_ICONS = { reason: '💌', song: '🎵', gift: '🎁', news: '📰', series: '📺', maldia: '💬', audio: '🎙️', letter: '📮', user: '👤', login: '🔑', logout: '🚪' };
    const actIcon = (action = '') => ACT_ICONS[String(action).split('_')[0]] || '✨';
    const relTime = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      const hm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      if (d.toDateString() === todayDate.toDateString()) return `Hoy, ${hm}`;
      const yest = new Date(todayDate); yest.setDate(todayDate.getDate() - 1);
      if (d.toDateString() === yest.toDateString()) return `Ayer, ${hm}`;
      return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
    };

    // ---- Accesos rápidos y atajos ----
    const quickActions = [
      { section: 'contenido',      emoji: '📁', label: 'Gestionar contenido' },
      { section: 'multimedia',     emoji: '☁️', label: 'Subir multimedia' },
      { section: 'notificaciones', emoji: '✈️', label: 'Enviar notificación' },
      { section: 'moods',          emoji: '😊', label: 'Ver ánimos' },
      { section: 'usuarios',       emoji: '👥', label: 'Usuarios' },
      { section: 'config',         emoji: '⚙️', label: 'Configuración' }
    ];
    const shortcuts = [
      { icon: '📮', label: 'Open When', count: owLettersList.length, section: 'contenido', sub: 'openwhen' },
      { icon: '🖼️', label: 'Galeria', count: galleryPhotos, section: 'multimedia' },
      { icon: '💬', label: 'Frases', count: mensajes, section: 'contenido', sub: 'razones' },
      { icon: '🎵', label: 'Música', count: songsList.length, section: 'contenido', sub: 'canciones' },
      { icon: '🎁', label: 'Regalos', count: giftsCount, section: 'contenido', sub: 'regalos' },
      { icon: '📝', label: 'Notas', count: audiosList.length, section: 'contenido', sub: 'audios' }
    ];

    // ---- Uso de la app: tiempo por sección y últimas conexiones ----
    const perSection = {};
    const perUser = {};
    const byPerson = {};
    const sortedVisits = [...visitsList].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sortedVisits.forEach(v => {
      const uid = v.user_id || 'anon';
      const bp = basePageOf(v.page);
      const ts = new Date(v.timestamp).getTime() || 0;
      (perSection[bp] = perSection[bp] || { count: 0, ms: 0 }).count++;
      const u = (perUser[uid] = perUser[uid] || { count: 0, msBySection: {}, lastTs: 0 });
      u.count++;
      u.lastTs = Math.max(u.lastTs, ts);
      (byPerson[uid] = byPerson[uid] || []).push({ bp, ts, uid });
    });
    // Atribución: el tiempo de cada visita es el hueco hasta la siguiente de
    // la misma persona (máx. 30 min; si hay más, es una nueva sesión).
    Object.values(byPerson).forEach(list => {
      list.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < list.length - 1; i++) {
        const gap = list[i + 1].ts - list[i].ts;
        if (gap > 0 && gap <= 30 * 60 * 1000) {
          perSection[list[i].bp].ms += gap;
          const u = perUser[list[i].uid];
          if (u) u.msBySection[list[i].bp] = (u.msBySection[list[i].bp] || 0) + gap;
        }
      }
    });
    const topSections = Object.entries(perSection)
      .filter(([, s]) => s.count > 0)
      .sort((a, b) => b[1].ms - a[1].ms || b[1].count - a[1].count)
      .slice(0, 6);
    const sectionMaxMs = Math.max(...topSections.map(([, s]) => s.ms), 1);
    const useHtml = topSections.length
      ? topSections.map(([bp, s]) => `
        <div class="dash-use-row">
          <span class="dash-use-label">${esc(SECTION_LABELS[bp] || bp)}</span>
          <div class="dash-use-track"><div class="dash-use-fill" style="width:${Math.max(Math.round(s.ms / sectionMaxMs * 100), 4)}%"></div></div>
          <span class="dash-use-meta">${s.count} visita${s.count === 1 ? '' : 's'} · ${fmtDuration(s.ms)}</span>
        </div>`).join('')
      : '<p class="muted-text" style="margin:0">Todavía no hay datos de actividad. Se recogen automáticamente al navegar por la web.</p>';
    const userById = new Map(realUsers.map(u => [u.id, u]));
    const connections = Object.entries(perUser)
      .map(([uid, u]) => {
        const user = userById.get(uid);
        const topSec = Object.entries(u.msBySection).sort((a, b) => b[1] - a[1])[0];
        return {
          uid,
          name: user?.name || (user?.email ? user.email.split('@')[0] : 'Invitado'),
          isAdmin: user?.role === 'admin',
          count: u.count,
          lastTs: u.lastTs,
          topSec: topSec ? (SECTION_LABELS[topSec[0]] || topSec[0]) : '—'
        };
      })
      .filter(c => c.count > 0)
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 6);
    const connHtml = connections.length
      ? connections.map(c => `
        <div class="dash-conn-row">
          <span class="dash-conn-dot${c.isAdmin ? ' admin' : ''}"></span>
          <span class="dash-conn-name">${esc(c.name)}${c.isAdmin ? ' <span class="admin-badge-tag">Admin</span>' : ''}</span>
          <span class="dash-conn-meta">${c.count} visita${c.count === 1 ? '' : 's'} · ${c.topSec}</span>
          <span class="dash-conn-time">${relTimeShort(c.lastTs)}</span>
        </div>`).join('')
      : '<p class="muted-text" style="margin:0">Sin conexiones registradas todavía.</p>';

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.dash} Resumen general</h2>
          <div class="dash-header-tools">
            <span class="dash-conn-pill" id="dashConnPill">Comprobando…</span>
            <button class="admin-btn-ghost" id="refreshDashboard" title="Actualizar">${UI.refresh}</button>
          </div>
        </div>

        <div class="dash-metrics">
          ${row1.map(metricCard).join('')}
        </div>
        <div class="dash-metrics">
          ${row2.map(metricCard).join('')}
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head">
              <div class="dash-chart-toggle-group" role="group" aria-label="Métrica del gráfico">
                <button type="button" class="dash-chart-toggle active" data-metric="activity">Actividad</button>
                <button type="button" class="dash-chart-toggle" data-metric="mood">Ánimos</button>
                <button type="button" class="dash-chart-toggle" data-metric="visits">Visitas</button>
              </div>
              <select class="dash-range-select" id="dashActivityRange" aria-label="Rango de días">
                <option value="7">7 días</option>
                <option value="14" selected>14 días</option>
                <option value="30">30 días</option>
              </select>
            </div>
            <div id="dashActivityChart">${areaChart(seriesDays(14, 'activity'))}</div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Distribución de contenido</h4></div>
            <div class="dash-donut">
              <div class="dash-donut-wrap">
                <svg viewBox="0 0 120 120" class="dash-donut-svg">${donutHtml}</svg>
                <div class="dash-donut-center"><strong>${distTotal}</strong><span>Total</span></div>
              </div>
              <div class="dash-donut-legend">${donutLegend}</div>
            </div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head">
              <h4>Tendencia de ánimo</h4>
              <div class="dash-panel-actions">
                <button class="dash-link" data-goto="moods">Historial →</button>
                <span class="admin-panel-badge">${moods.length} registros</span>
              </div>
            </div>
            <div class="dash-mood-head">
              <div class="dash-mood-text">
                <div class="dash-mood-main">${MOOD_TITLE[domKey] || 'Feliz'} ${MOOD_FACE[domKey] || '😊'}</div>
                <div class="dash-mood-sub">${avgScore >= 2.5 ? 'Predomina el buen ánimo. ¡Sigue así!' : 'Un poquito de cariño no viene mal hoy.'}</div>
              </div>
              <div class="dash-mood-face">${MOOD_FACE[domKey] || '😊'}</div>
            </div>
            <div class="dash-week-chart">${weekBars}</div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Fechas importantes</h4></div>
            <div class="dash-fechas">
              ${fechas.map(f => `
                <div class="dash-fecha">
                  <div class="dash-fecha-icon">${f.icon}</div>
                  <div class="dash-fecha-body">
                    <div class="dash-fecha-title">${f.title}</div>
                    <div class="dash-fecha-date">${f.date}</div>
                  </div>
                  <span class="dash-fecha-badge${f.hot ? ' hot' : ''}${f.muted ? ' muted' : ''}">${f.badge}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Dónde pasa más tiempo</h4><span class="admin-panel-badge">${sortedVisits.length} visitas</span></div>
            <div class="dash-use">${useHtml}</div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Últimas conexiones</h4></div>
            <div class="dash-conn">${connHtml}</div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Actividad reciente</h4></div>
            <div class="admin-activity-list">
              ${activity.slice(0, 5).map(e => `
                <div class="admin-activity-item">
                  <div class="admin-activity-emoji">${actIcon(e.action)}</div>
                  <div class="admin-activity-body">
                    <div class="admin-activity-action">${esc(db.formatAction(e.action))}</div>
                    <div class="admin-activity-details">${esc(e.details || '')}</div>
                  </div>
                  <div class="admin-activity-time">${relTime(e.timestamp)}</div>
                </div>`).join('')}
            </div>
            <button class="dash-more-btn" data-goto="actividad">Ver toda la actividad →</button>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Accesos rápidos</h4></div>
            <div class="quick-actions">
              ${quickActions.map(q => `<button class="quick-action" data-goto="${q.section}"><span class="quick-action-emoji">${q.emoji}</span><span>${q.label}</span></button>`).join('')}
            </div>
          </div>
        </div>

        <div class="admin-panel dash-shortcuts-panel">
          <div class="admin-panel-head"><h4>Atajos de gestión</h4></div>
          <div class="dash-shortcuts">
            ${shortcuts.map(s => `
              <button type="button" class="dash-shortcut" data-shortcut='${JSON.stringify({ href: s.href || '', section: s.section || '', sub: s.sub || '' })}'>
                <span class="dash-shortcut-icon">${s.icon}</span>
                <span class="dash-shortcut-label">${s.label}</span>
                <span class="dash-shortcut-count">${s.count} ${s.count === 1 ? 'elemento' : 'elementos'}</span>
              </button>`).join('')}
          </div>
        </div>
      </section>
    `;

    page.querySelector('#refreshDashboard')?.addEventListener('click', loadDashboard);

    // Estado de la conexión (chip del dashboard)
    db.checkConnection().then(status => {
      const pill = page.querySelector('#dashConnPill');
      if (pill && page.querySelector('#adminContent')?.contains(pill)) {
        pill.textContent = status.ok ? '● Supabase conectado' : '● Modo local';
        pill.classList.toggle('ok', !!status.ok);
      }
    }).catch(() => {});

    // Métrica del gráfico: Actividad | Ánimos
    page.querySelectorAll('.dash-chart-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        chartMetric = btn.dataset.metric;
        page.querySelectorAll('.dash-chart-toggle').forEach(b => b.classList.toggle('active', b === btn));
        const range = page.querySelector('#dashActivityRange');
        const el = page.querySelector('#dashActivityChart');
        if (el && range) el.innerHTML = areaChart(seriesDays(Number(range.value), chartMetric));
      });
    });

    // Rango del gráfico
    page.querySelector('#dashActivityRange')?.addEventListener('change', (e) => {
      const el = page.querySelector('#dashActivityChart');
      if (el) el.innerHTML = areaChart(seriesDays(Number(e.target.value), chartMetric));
    });

    // Accesos rápidos → cambian de sección
    page.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        S.section = btn.dataset.goto;
        page.querySelectorAll('.admin-topbar-tab').forEach(t => t.classList.remove('active'));
        const navBtn = page.querySelector(`.admin-topbar-tab[data-section="${S.section}"]`);
        if (navBtn) navBtn.classList.add('active');
        loadSection(S.section);
      });
    });

    // Atajos de gestión
    page.querySelectorAll('[data-shortcut]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = JSON.parse(btn.dataset.shortcut || '{}');
        if (s.href) { router.navigate(s.href); return; }
        if (s.sub) S.contentSub = s.sub;
        S.section = s.section;
        page.querySelectorAll('.admin-topbar-tab').forEach(t => t.classList.remove('active'));
        const navBtn = page.querySelector(`.admin-topbar-tab[data-section="${S.section}"]`);
        if (navBtn) navBtn.classList.add('active');
        loadSection(S.section);
      });
    });
  }

  // ==========================================
  // 2. ESTADO DE ÁNIMO
  // ==========================================
  async function loadMoods() {
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.heart} Estado de Ánimo</h2></div>
        <div class="moods-chart-section">
          <div class="moods-chart-header">
            <h3>Calendario mensual</h3>
            <div class="moods-nav">
              <button class="moods-nav-btn" id="moodPrev">‹</button>
              <span id="moodMonthLabel">Cargando...</span>
              <button class="moods-nav-btn" id="moodNext">›</button>
            </div>
          </div>
          <div class="moods-calendar" id="moodCalendar">${skeletonCard('280px')}</div>
          <div class="moods-stats" id="moodStats"></div>
          <div class="moods-breakdown" id="moodBreakdown"></div>
        </div>
      </section>
    `;

    const render = () => renderMoodMonth(S.moodDate);
    render();
    page.querySelector('#moodPrev').onclick = () => { S.moodDate.setMonth(S.moodDate.getMonth() - 1); render(); };
    page.querySelector('#moodNext').onclick = () => { S.moodDate.setMonth(S.moodDate.getMonth() + 1); render(); };
  }

  async function renderMoodMonth(date) {
    const token = sectionToken;
    const renderToken = ++moodRenderToken;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthLabel = page.querySelector('#moodMonthLabel');
    const calendar = page.querySelector('#moodCalendar');
    const stats = page.querySelector('#moodStats');
    const breakdown = page.querySelector('#moodBreakdown');
    if (!calendar) return;

    monthLabel.textContent = `${MONTHS[date.getMonth()]} ${year}`;
    const monthMoods = await db.getMoodMonth(year, month);
    if (token !== sectionToken || renderToken !== moodRenderToken) return; // sección o render obsoletos
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const todayStr = todayISO();

    let html = '<div class="moods-cal-grid">';
    ['D','L','M','X','J','V','S'].forEach(d => { html += `<div class="moods-cal-hd">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) html += '<div class="moods-cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dailyMoods = monthMoods[ds] || [];
      const isToday = ds === todayStr;
      const hasMood = dailyMoods.length > 0;

      let emojiHtml = '';
      let titleText = `${ds}: Sin registro`;
      if (hasMood) {
        const emojis = dailyMoods.slice(0, 3).map(m => m.emoji || MOOD_EMOJIS[m.mood] || '—').join('');
        const extra = dailyMoods.length > 3 ? `<span style="font-size:0.6rem;opacity:0.8">+${dailyMoods.length - 3}</span>` : '';
        emojiHtml = `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:1px;font-size:0.8rem;line-height:1">${emojis}${extra}</div>`;
        const labels = dailyMoods.map(m => esc(m.label || MOOD_LABELS[m.mood] || m.mood)).join(', ');
        titleText = `${esc(ds)}: ${labels}`;
      }

      html += `<div class="moods-cal-cell${isToday?' today':''}${hasMood?' has-mood':''}" title="${titleText}">
        <span class="moods-cal-day">${day}</span>${emojiHtml}
      </div>`;
    }
    html += '</div>';
    calendar.innerHTML = html;

    const entries = Object.values(monthMoods).flat();
    if (entries.length === 0) {
      stats.innerHTML = '<div class="admin-empty">No hay datos de ánimo para este mes</div>';
      breakdown.innerHTML = '';
      return;
    }

    const counts = {};
    let totalScore = 0;
    entries.forEach((m) => {
      const k = m.mood || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
      totalScore += MOOD_SCORES[m.mood] !== undefined ? MOOD_SCORES[m.mood] : 1;
    });
    const avg = totalScore / entries.length;
    const avgEmoji = avg >= 3.5 ? '🤍🤍🤍' : avg >= 2.5 ? '😊' : avg >= 1.5 ? '😕' : avg >= 0.5 ? '😔' : '❤️';

    let bestMood = '', bestCount = 0;
    Object.entries(counts).forEach(([k, c]) => { if (c > bestCount) { bestCount = c; bestMood = k; } });

    stats.innerHTML = `<div class="moods-stats-row">
      <div class="moods-stat"><span class="moods-stat-num">${entries.length}</span><span class="moods-stat-label">registros totales</span></div>
      <div class="moods-stat"><span class="moods-stat-num">${MOOD_EMOJIS[bestMood]||'—'}</span><span class="moods-stat-label">más frecuente</span></div>
      <div class="moods-stat"><span class="moods-stat-num">${avgEmoji}</span><span class="moods-stat-label">media del mes</span></div>
    </div>`;

    const order = ['great','good','meh','bad','love'];
    breakdown.innerHTML = '<h4>Desglose</h4>' + order.map(k => {
      const count = counts[k] || 0;
      const pct = entries.length > 0 ? Math.round(count / entries.length * 100) : 0;
      return `<div class="moods-bar-row">
        <span class="moods-bar-label">${MOOD_EMOJIS[k]||k} ${MOOD_LABELS[k]||k}</span>
        <div class="moods-bar-track"><div class="moods-bar-fill mood-${k}" style="width:${pct}%"></div></div>
        <span class="moods-bar-pct">${pct}%</span>
      </div>`;
    }).join('');
  }

  // ==========================================
  // 3. USUARIOS
  // ==========================================
  async function loadUsuarios() {
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.users} Usuarios</h2>
        </div>
        <div class="admin-search"><input type="text" id="userSearch" class="admin-search-input" placeholder="Buscar usuarios..."></div>
        <div class="admin-list" id="userList">${skeletonCard('56px')}${skeletonCard('56px')}${skeletonCard('56px')}</div>
      </section>
    `;

    const token = sectionToken;
    const [users, allMoods, visits] = await Promise.all([
      safe(db.listUsers(), []),
      safe(db.getAllMoods('2024-01-01', todayISO()), []),
      safe(db.getPageVisits(3000), [])
    ]);

    // Actividad de uso por usuario: visitas, última conexión y tiempo por sección.
    const visitStats = {};
    [...visits].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(v => {
      const uid = v.user_id || 'anon';
      const bp = basePageOf(v.page);
      const ts = new Date(v.timestamp).getTime() || 0;
      const st = (visitStats[uid] = visitStats[uid] || { count: 0, lastTs: 0, msBySection: {}, order: [] });
      st.count++;
      st.lastTs = Math.max(st.lastTs, ts);
      st.order.push({ bp, ts });
    });
    Object.values(visitStats).forEach(st => {
      const list = st.order.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < list.length - 1; i++) {
        const gap = list[i + 1].ts - list[i].ts;
        if (gap > 0 && gap <= 30 * 60 * 1000) {
          st.msBySection[list[i].bp] = (st.msBySection[list[i].bp] || 0) + gap;
        }
      }
      delete st.order;
    });

    const userMoodStats = {};
    allMoods.forEach(m => {
      const uid = m.user_id || 'local';
      if (!userMoodStats[uid]) {
        userMoodStats[uid] = { total: 0, moods: {}, lastDate: '' };
      }
      userMoodStats[uid].total++;
      const moodId = m.mood || 'unknown';
      userMoodStats[uid].moods[moodId] = (userMoodStats[uid].moods[moodId] || 0) + 1;
      if (m.date > userMoodStats[uid].lastDate) userMoodStats[uid].lastDate = m.date;
    });

    // La sección pudo cambiar mientras cargaban los datos — abortar la escritura
    if (token !== sectionToken) return;

    // Re-render header with count
    page.querySelector('.admin-section-header h2').innerHTML = `${UI.users} Usuarios <span class="admin-count-badge">${users.length}</span>`;

    function renderUserList(list) {
      const listEl = page.querySelector('#userList');
      if (listEl) listEl.innerHTML = renderUsers(list, userMoodStats, visitStats);
    }

    renderUserList(users);

    page.querySelector('#userSearch').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      const f = users.filter(u =>
        (u.email||'').toLowerCase().includes(q) ||
        (u.name||'').toLowerCase().includes(q) ||
        (u.role||'').includes(q)
      );
      renderUserList(f);
    });

    // Click on user actions (toggle / delete) or detail
    page.querySelector('#userList').addEventListener('click', async function(e) {
      const toggleBtn = e.target.closest('[data-action="toggle"]');
      const delBtn = e.target.closest('[data-action="delete-user"]');

      if (toggleBtn) {
        e.stopPropagation();
        const target = users.find(u => u.id === toggleBtn.dataset.userId);
        if (!target) return;
        const nextEnabled = target.enabled !== false ? false : true;
        await db.saveUser(target.id, { enabled: nextEnabled });
        db.logActivity('user_updated', `${nextEnabled ? 'Habilitado' : 'Deshabilitado'}: ${target.name || target.email || target.id}`);
        await loadUsuarios();
        showToast(nextEnabled ? 'Usuario habilitado' : 'Usuario deshabilitado', 'success');
        return;
      }

      if (delBtn) {
        e.stopPropagation();
        const uid = delBtn.dataset.userId;
        if (uid === user?.id) { showToast('No puedes eliminar tu propia cuenta', 'error'); return; }
        const target = users.find(u => u.id === uid);
        const name = target?.name || target?.email || 'este usuario';
        modal.open(
          `${UI.trash} Eliminar usuario`,
          `<p style="margin:0;">¿Seguro que quieres eliminar a <strong>${esc(name)}</strong>? Esta acción no se puede deshacer.</p>`,
          async () => {
            try {
              await db.deleteUser(uid);
              showToast('Usuario eliminado', 'success');
              // Recarga la lista para que desaparezca al momento
              await loadUsuarios();
            } catch (err) {
              console.error('[admin] No se pudo eliminar el usuario:', err);
              showToast(err?.message || 'No se pudo eliminar el usuario', 'error');
            }
          },
          'Eliminar'
        );
        return;
      }

      if (e.target.closest('button')) return;
      const item = e.target.closest('.admin-list-item');
      if (!item) return;
      const userId = item.dataset.userId;
      const detailUser = users.find(u => u.id === userId);
      if (detailUser) await showUserDetail(detailUser, userMoodStats[userId], visitStats);
    });
  }

  function renderUsers(users, moodStats, visitStats) {
    if (users.length === 0) return '<div class="admin-empty">No hay usuarios</div>';
    return users.map((u) => {
      const initial = esc((u.name||u.email||'?').charAt(0).toUpperCase());
      const status = u.enabled !== false ? '🟢' : '🔴';
      const vs = visitStats[u.id];
      const online = vs?.lastTs && (Date.now() - vs.lastTs < 5 * 60e3);
      const lastLogin = vs?.lastTs ? relTimeShort(vs.lastTs) : (u.last_login ? new Date(u.last_login).toLocaleDateString('es') : '—');
      const stats = moodStats[u.id];
      const moodBadge = stats && stats.total > 0
        ? getMoodSummaryBadge(stats)
        : '<span class="user-mood-none">Sin datos</span>';

      return `<div class="admin-list-item" data-user-id="${esc(u.id)}" style="cursor:pointer">
        <div class="user-avatar-sm">
          ${u.photo
            ? `<img src="${esc(u.photo)}" class="user-avatar-img" alt="">`
            : `<div class="user-avatar-placeholder">${initial}</div>`
          }
        </div>
        <div style="flex:1;min-width:0">
          <div class="item-title">${esc(u.name||'Sin nombre')}
            ${u.role === 'admin' ? '<span class="admin-badge-tag">Admin</span>' : ''}
          </div>
          <div class="item-sub">
            ${u.email ? esc(u.email) : 'ID: ' + u.id.slice(0,12)+'…'}
            · ${status} · ${online ? '<strong class="user-online">En línea ahora</strong>' : `Última conexión: ${lastLogin}`}
          </div>
          <div class="user-mood-row">${moodBadge}</div>
        </div>
        <div class="item-actions">
          <button class="item-action-btn" data-action="toggle" data-user-id="${esc(u.id)}" title="${u.enabled !== false ? 'Deshabilitar' : 'Habilitar'} usuario">
            ${u.enabled !== false ? UI.toggleOn : UI.toggleOff}
          </button>
          <button class="item-action-btn delete" data-action="delete-user" data-user-id="${esc(u.id)}" title="Eliminar usuario">${UI.trash}</button>
        </div>
      </div>`;
    }).join('');
  }

  function getMoodSummaryBadge(stats) {
    if (!stats || stats.total === 0) return '';
    const best = Object.entries(stats.moods).sort((a, b) => b[1] - a[1])[0];
    const emoji = MOOD_EMOJIS[best[0]] || '—';
    const pct = Math.round(best[1] / stats.total * 100);
    const lastDate = stats.lastDate ? new Date(stats.lastDate + 'T12:00:00').toLocaleDateString('es') : '—';
    return `
      <span class="user-mood-badge" title="Último: ${lastDate}">
        ${emoji} ${stats.total} registros
      </span>
      <span class="user-mood-badge muted">Principal: ${pct}%</span>
      <span class="user-mood-badge muted">Últ: ${lastDate}</span>
    `;
  }

  async function showUserDetail(user, stats, visitStats) {
    const initial = esc((user.name||user.email||'?').charAt(0).toUpperCase());
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString('es') : '—';
    const vs = visitStats?.[user.id];
    const lastLogin = vs?.lastTs ? new Date(vs.lastTs).toLocaleString('es', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : (user.last_login ? new Date(user.last_login).toLocaleDateString('es') : '—');

    // Actividad de uso: dónde pasa más tiempo y última conexión.
    let useHtml = '<p class="muted-text" style="font-size:0.82rem">Sin actividad registrada todavía. Se recoge automáticamente al usar la app.</p>';
    if (vs && vs.count > 0) {
      const top = Object.entries(vs.msBySection).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const maxMs = Math.max(...top.map(t => t[1]), 1);
      const totalMs = Object.values(vs.msBySection).reduce((a, b) => a + b, 0);
      const rows = top.length
        ? top.map(([bp, ms]) => `
          <div class="moods-bar-row">
            <span class="moods-bar-label" style="min-width:130px">${esc(SECTION_LABELS[bp] || bp)}</span>
            <div class="moods-bar-track"><div class="moods-bar-fill mood-good" style="width:${Math.round(ms / maxMs * 100)}%"></div></div>
            <span class="moods-bar-pct">${fmtDuration(ms)}</span>
          </div>`).join('')
        : '<div class="muted-text">Todavía sin tiempo acumulado por sección</div>';
      useHtml = `
        <div class="user-mood-summary-card" style="margin-bottom:12px">
          <div><strong>${vs.count}</strong><div class="muted-text">Visitas</div></div>
          <div><strong>${fmtDuration(totalMs)}</strong><div class="muted-text">Tiempo activo</div></div>
          <div><strong>${new Date(vs.lastTs).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong><div class="muted-text">Última conexión</div></div>
        </div>
        ${rows}`;
    }

    let moodHtml = '<p style="color:var(--theme-text-secondary);font-size:0.82rem;margin-bottom:12px;">Sin registros de ánimo</p>';
    if (stats && stats.total > 0) {
      const order = ['great','good','meh','bad','love'];
      const rows = order.map(k => {
        const count = stats.moods[k] || 0;
        const pct = Math.round(count / stats.total * 100);
        if (count === 0) return '';
        return `<div class="moods-bar-row">
          <span class="moods-bar-label" style="min-width:140px">${MOOD_EMOJIS[k]} ${MOOD_LABELS[k]}</span>
          <div class="moods-bar-track"><div class="moods-bar-fill mood-${k}" style="width:${pct}%"></div></div>
          <span class="moods-bar-pct">${count} (${pct}%)</span>
        </div>`;
      }).filter(Boolean).join('');

      const avgScore = order.reduce((sum, k) => sum + (MOOD_SCORES[k] || 0) * (stats.moods[k] || 0), 0) / stats.total;
      const avgEmoji = avgScore >= 3.5 ? '🤍🤍🤍' : avgScore >= 2.5 ? '😊' : avgScore >= 1.5 ? '😕' : '😔';

      moodHtml = `
        <div class="user-mood-summary">
          <div class="user-mood-summary-card">
            <div>
              <strong>${stats.total}</strong>
              <div class="muted-text">Total registros</div>
            </div>
            <div>
              <strong>${avgEmoji}</strong>
              <div class="muted-text">Media ánimo</div>
            </div>
            <div>
              <strong>${stats.lastDate ? new Date(stats.lastDate+'T12:00:00').toLocaleDateString('es') : '—'}</strong>
              <div class="muted-text">Último registro</div>
            </div>
          </div>
          <h4 style="font-size:0.85rem;margin:0 0 8px;color:var(--theme-text-secondary);">Desglose de ánimos</h4>
          ${rows}
        </div>
      `;
    }

    const history = await db.getUserMoods(user.id);
    let historyHtml;
    if (history.length === 0) {
      historyHtml = '<p style="color:var(--theme-text-secondary);font-size:0.82rem;margin-bottom:12px;">Sin historial de ánimo</p>';
    } else {
      const rows = history.map(m => {
        const dateStr = new Date(m.date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
        const emoji = m.emoji || MOOD_EMOJIS[m.mood] || '—';
        const label = m.label || MOOD_LABELS[m.mood] || m.mood;
        return `<div class="moods-bar-row" style="margin-bottom:6px;">
          <span class="moods-bar-label" style="min-width:120px">${dateStr}</span>
          <span style="margin-right:8px;">${emoji}</span>
          <span style="font-size:0.82rem;color:var(--theme-text-secondary);">${label}</span>
        </div>`;
      }).join('');
      historyHtml = `<div style="max-height:240px;overflow-y:auto;margin-top:12px;">${rows}</div>`;
    }

    modal.open(`👤 ${esc(user.name||user.email||'Usuario')}`, `
      <div class="user-detail-grid">
        <div class="admin-field" style="display:flex;align-items:center;gap:16px;">
          <div class="user-avatar-sm" style="width:48px;height:48px;">
            ${user.photo
              ? `<img src="${esc(user.photo)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
              : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-dim);color:var(--theme-accent);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1.3rem;">${initial}</div>`
            }
          </div>
          <div>
            <strong style="font-size:1rem;">${esc(user.name||'Sin nombre')}</strong><br>
            <span style="font-size:0.82rem;color:var(--theme-text-secondary);">${esc(user.email) || 'ID: ' + user.id}</span>
          </div>
          <span style="margin-left:auto;font-size:0.72rem;padding:3px 12px;border-radius:30px;background:${user.role === 'admin' ? 'var(--accent-dim)' : 'var(--theme-surface)'};color:${user.role === 'admin' ? 'var(--theme-accent)' : 'var(--theme-text-secondary)'};">${user.role || 'user'}</span>
        </div>

        <div class="admin-field">
          <p><strong>ID:</strong> ${user.id}</p>
          <p><strong>Creado:</strong> ${created}</p>
          <p><strong>Última conexión:</strong> ${lastLogin}</p>
          <p><strong>Estado:</strong> ${user.enabled !== false ? '🟢 Activo' : '🔴 Inactivo'}</p>
        </div>

        <hr style="opacity:0.2;margin:12px 0;">
        <h3 style="font-size:1rem;margin:0 0 12px;">${UI.activity} Actividad de uso</h3>
        ${useHtml}

        <hr style="opacity:0.2;margin:12px 0;">
        <h3 style="font-size:1rem;margin:0 0 12px;">${UI.heart} Resumen de Ánimo</h3>
        ${moodHtml}
        <h3 style="font-size:1rem;margin:24px 0 12px;">${UI.heart} Historial Completo</h3>
        ${historyHtml}
      </div>
    `);
  }

  // ==========================================
  // 4. CONTENIDO (Razones, Canciones, Regalos, Noticias, MalDía, Series)
  // ==========================================
  async function loadContenido() {
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.content} Gestión de Contenido</h2></div>
        <div class="admin-tabs" id="contentSubTabs" style="margin-bottom:16px">
          ${CONTENT_SUBS.map(t => `<button class="admin-tab${t.id === (S.contentSub || 'razones') ? ' active' : ''}" data-content="${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')}
        </div>
        <div id="contentSubContent">${skeletonCard('200px')}</div>
      </section>
    `;

    page.querySelectorAll('#contentSubTabs .admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('#contentSubTabs .admin-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        S.contentSub = btn.dataset.content;
        loadContentSub(S.contentSub);
      });
    });

    // Restore previously active sub-tab if returning from a modal save
    const activeSubBtn = page.querySelector(`#contentSubTabs [data-content="${S.contentSub}"]`);
    if (activeSubBtn) activeSubBtn.classList.add('active');
    else {
      // Mark default
      const defaultBtn = page.querySelector('#contentSubTabs [data-content="razones"]');
      if (defaultBtn) defaultBtn.classList.add('active');
      S.contentSub = 'razones';
    }
    loadContentSub(S.contentSub);
  }

  const CONTENT_LOADERS = {
    razones:   async () => ({ title: 'Razones', items: await safe(db.getReasons(), []), save: db.saveReasons }),
    canciones: async () => ({ title: 'Canciones', items: await safe(db.getSongs(), []), save: db.saveSongs }),
    noticias:  async () => ({ title: 'Noticias', items: await safe(db.getNews(), []), save: db.saveNews }),
    series:    async () => ({ title: 'Series', items: await safe(loadCatalog(), []), save: saveCatalog }),
    regalos:   async () => {
      // Fuente unificada: lo guardado en Supabase, o gifts.json como semilla.
      const cat = await safe(loadGiftsCatalog(), { gifts: [] });
      return {
        title: 'Regalos',
        catalog: cat,
        items: cat?.gifts || [],
        // Guarda el catálogo completo (version + months + gifts) y refresca
        // la caché compartida con el Calendario y la Galería
        save: async (next) => {
          await db.saveGifts(next);
          invalidateGiftsCache();
        }
      };
    },
    maldia:    async () => ({
      title: 'Mal Día',
      frases: await safe(db.getMaldiaFrases(), []),
      mensajes: await safe(db.getMaldiaMensajes(), []),
      saveFrases: db.saveMaldiaFrases,
      saveMensajes: db.saveMaldiaMensajes
    }),
    audios:    async () => ({
      title: 'Audios',
      items: await safe(db.getAudios(), []),
      save: (audios) => db.saveAudios(audios)
    }),
    openwhen:  async () => ({
      title: 'Open When',
      items: await safe(db.getOpenWhenLetters(), []),
      staticLetters: LETTERS,
      save: (letters) => db.saveOpenWhenLetters(letters)
    })
  };

  async function loadContentSub(id) {
    const token = sectionToken;
    const sub = page.querySelector('#contentSubContent');
    if (!sub) return;
    sub.innerHTML = skeletonCard('120px');

    const loader = CONTENT_LOADERS[id];
    if (!loader) return;
    const data = await loader();

    if (token !== sectionToken || !page.querySelector('#contentSubContent')) return;

    if (id === 'maldia') {
      sub.innerHTML = `
        <div class="admin-subsection">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h4>Frases (${data.frases.length})</h4>
            <div style="display:flex;gap:8px;">
              <button class="admin-btn admin-btn-sm" id="viewMaldiaNotes">💌 Notas</button>
              <button class="admin-btn admin-btn-sm" id="addMaldiaFrase">${UI.plus} Añadir</button>
            </div>
          </div>
          <div class="admin-list">${renderSimpleList(data.frases, 'frase')}</div>
        </div>
        <div class="admin-subsection">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h4>Mensajes (${data.mensajes.length})</h4>
            <button class="admin-btn admin-btn-sm" id="addMaldiaMensaje">${UI.plus} Añadir</button>
          </div>
          <div class="admin-list">${renderSimpleList(data.mensajes, 'mensaje')}</div>
        </div>
      `;

      bindSimpleCRUD('maldia_frase', data.frases, data.saveFrases, loadContentSub);
      bindSimpleCRUD('maldia_mensaje', data.mensajes, data.saveMensajes, loadContentSub);

      // Notas que la usuaria deja desde Mal Día (llegan directas al Admin)
      page.querySelector('#viewMaldiaNotes')?.addEventListener('click', async () => {
        const notes = await db.getAllMaldiaNotes();
        if (!notes.length) {
          modal.open('💌 Notas de Mal Día', '<p style="margin:0;color:var(--theme-text-secondary);">Todavía no hay notas. Cuando ella escriba una desde la sección Mal Día, aparecerá aquí.</p>');
          return;
        }
        const listHtml = notes.map(n => {
          const who = n.email || (n.userId ? String(n.userId).slice(0, 8) : 'Ella');
          const when = n.createdAt ? new Date(n.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
          return `<div class="gift-response">
            <div class="gift-response__meta">${esc(who)}${when ? ` · ${esc(when)}` : ''}</div>
            <div class="gift-response__text">${esc(n.text || '—')}</div>
          </div>`;
        }).join('');
        modal.open('💌 Notas de Mal Día', `<div class="gift-responses-list">${listHtml}</div>`);
      });
    } else if (id === 'series') {
      // Catálogo unificado con la sección Series (misma fuente local)
      renderSeriesAdmin(sub, data.items, data.save, loadContentSub);
    } else if (id === 'openwhen') {
      renderOpenWhenAdmin(sub, data);
    } else if (id === 'regalos') {
      renderCalendarAdmin(sub, data);
    } else {
      const items = data.items || [];
      const isRegalos = id === 'regalos';
      sub.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);" id="contentItemCount">${items.length} elemento${items.length === 1 ? '' : 's'}</span>
          <div style="display:flex;gap:8px;">
            ${isRegalos ? '<button class="admin-btn admin-btn-sm" id="viewGiftResponses">💌 Respuestas</button>' : ''}
            <button class="admin-btn admin-btn-sm" id="addContentItem">${UI.plus} Añadir</button>
          </div>
        </div>
        <div class="admin-search admin-search--compact">
          <span class="admin-search-icon">${UI.search}</span>
          <input type="text" id="contentSearch" class="admin-search-input" placeholder="Buscar en ${data.title}…" autocomplete="off">
        </div>
        <div class="admin-list" id="contentItemsList">${renderContentItems(items, id)}</div>
      `;

      bindContentCRUD(id, items, data.save, loadContentSub);

      // Búsqueda local dentro del tipo de contenido (conserva los índices originales)
      const searchInput = page.querySelector('#contentSearch');
      const listEl = page.querySelector('#contentItemsList');
      const countEl = page.querySelector('#contentItemCount');
      searchInput?.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        const indexed = items.map((item, i) => ({ item, i }));
        const filtered = q
          ? indexed.filter(({ item }) => JSON.stringify(item).toLowerCase().includes(q))
          : indexed;
        listEl.innerHTML = renderContentItemsIndexed(filtered, id);
        countEl.textContent = `${filtered.length} de ${items.length} elemento${items.length === 1 ? '' : 's'}`;
      });
    }
  }

  // ==========================================
  // MULTIMEDIA — subida a Cloudinary
  // ==========================================
  const UPLOAD_HISTORY_KEY = 'ph.admin.uploads';

  // Historial por sección: { galeria: [...], memes: [...], audios: [...] }
  function loadUploadHistory(sectionId) {
    try {
      const all = JSON.parse(localStorage.getItem(UPLOAD_HISTORY_KEY) || '{}');
      return Array.isArray(all[sectionId]) ? all[sectionId] : [];
    } catch { return []; }
  }

  function saveUploadHistory(sectionId, list) {
    try {
      const all = JSON.parse(localStorage.getItem(UPLOAD_HISTORY_KEY) || '{}');
      all[sectionId] = list.slice(0, 30);
      localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(all));
    } catch { /* cuota llena */ }
  }

  async function copyText(text, msg = 'URL copiada al portapapeles') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg, 'success');
      return true;
    } catch {
      // Fallback para contextos sin Clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* no-op */ }
      ta.remove();
      if (ok) showToast(msg, 'success');
      else showToast('No se pudo copiar. Selecciona y copia manualmente.', 'error');
      return ok;
    }
  }

  function uploadPreviewHtml(u) {
    if (u.kind === 'image') return `<img src="${esc(u.secure_url || u.preview)}" alt="${esc(u.name)}" loading="lazy">`;
    if (u.kind === 'video') return `<video src="${esc(u.secure_url)}" muted playsinline preload="metadata"></video>`;
    if (u.kind === 'pdf') return `<span class="upload-kind-icon upload-kind-icon--pdf">PDF</span>`;
    if (u.kind === 'audio') return `<span class="upload-kind-icon">🎵</span>`;
    return `<span class="upload-kind-icon">📄</span>`;
  }

  function renderUploadsList(uploads, listEl) {
    if (!listEl) return;
    listEl.innerHTML = uploads.map((u, i) => `
      <div class="upload-item${u.status === 'error' ? ' upload-item--error' : ''}">
        <div class="upload-item-preview">${uploadPreviewHtml(u)}</div>
        <div class="upload-item-body">
          <div class="upload-item-name" title="${esc(u.name)}">${esc(u.name)}</div>
          <div class="upload-item-meta">${kindLabel(u.kind)}${u.size ? ' · ' + formatBytes(u.size) : ''}</div>
          ${u.status === 'uploading'
            ? `<div class="upload-progress"><div class="upload-progress-fill" style="width:${u.progress}%"></div></div>
               <div class="upload-item-meta">Subiendo… ${u.progress}%</div>`
            : u.status === 'done'
              ? `<div class="upload-item-url" title="${esc(u.secure_url)}">${esc(u.secure_url)}</div>
                 <div class="upload-item-actions">
                   <button class="admin-btn admin-btn-sm" data-copy="${i}">${UI.copy} Copiar URL</button>
                   <button class="admin-btn admin-btn-sm admin-btn-secondary" data-open="${i}">${UI.link} Abrir</button>
                 </div>`
              : `<div class="upload-item-error">⚠ ${esc(u.error || 'Error al subir')}</div>`}
        </div>
      </div>
    `).join('') || '<div class="admin-empty">Aún no hay archivos subidos en esta sesión.</div>';
  }

  async function loadMultimedia() {
    const token = sectionToken;

    // Cada sección gestiona su propia subida: el archivo va directo al bucket
    // correcto de Supabase y aparece en esa sección de la app al momento.
    const SECTIONS = [
      {
        id: 'galeria', icon: '🖼️', title: 'Galería',
        desc: 'Fotos (máx. 5 MB c/u) — aparecen al instante en la Galería de la app.',
        accept: 'image/*', route: '/galeria',
        uploadFn: (files) => db.uploadGalleryPhotos(files)
      },
      {
        id: 'memes', icon: '😂', title: 'Memes',
        desc: 'Imágenes y vídeos (máx. 50 MB) — aparecen al instante en Memes.',
        accept: 'image/*,video/*', route: '/memes',
        uploadFn: (files) => db.uploadMemes(files)
      },
      {
        id: 'audios', icon: '🎙️', title: 'Audios',
        desc: 'Notas de voz (máx. 50 MB) — aparecen al instante en Audios del Rincón.',
        accept: 'audio/*', route: '/audios',
        uploadFn: (files) => db.uploadAudios(files)
      }
    ];

    const sections = SECTIONS.map(s => ({
      ...s,
      uploads: loadUploadHistory(s.id).map(h => ({ ...h, status: 'done' }))
    }));

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.cloud} Subir multimedia</h2>
        </div>
        <p class="muted-text" style="margin-top:-6px">Sube cada archivo desde su sección: va directo a Galería, Memes o Audios y aparece en la app al momento. (También puedes subir desde cada sección en la app.)</p>

        <div class="admin-dash-grid">
          ${sections.map(s => `
            <div class="admin-panel">
              <div class="admin-panel-head">
                <h4>${s.icon} ${s.title}</h4>
                <a class="admin-btn admin-btn-ghost admin-btn-sm" href="#${s.route}" rel="noopener">${UI.link} Abrir sección</a>
              </div>
              <p class="muted-text">${s.desc}</p>
              <div class="upload-dropzone" data-dropzone="${s.id}">
                <div class="upload-dropzone-icon">${UI.cloud}</div>
                <div class="upload-dropzone-title">Arrastra archivos aquí o toca para elegir</div>
                <div class="upload-dropzone-sub">${s.id === 'galeria' ? 'Fotos' : s.id === 'memes' ? 'Imágenes y vídeos' : 'Audios (mp3, m4a, ogg, wav…)'}</div>
                <input type="file" data-input="${s.id}" multiple accept="${s.accept}" hidden>
              </div>
              <div class="admin-subsection" style="margin-top:12px">
                <h4>Subidas recientes (${s.uploads.length})</h4>
                <div class="upload-list" data-list="${s.id}"></div>
              </div>
            </div>`).join('')}
        </div>
      </section>
    `;

    if (token !== sectionToken) return;

    sections.forEach(s => {
      const dropzone = page.querySelector(`[data-dropzone="${s.id}"]`);
      const input = page.querySelector(`[data-input="${s.id}"]`);
      const listEl = page.querySelector(`[data-list="${s.id}"]`);
      if (!dropzone || !input || !listEl) return;
      renderUploadsList(s.uploads, listEl);

      const renderList = () => renderUploadsList(s.uploads, listEl);
      const pickFiles = (files) => {
        const valid = [...files].filter(f => f && f.size > 0);
        if (!valid.length) return;
        valid.forEach(file => {
          const entry = {
            name: file.name,
            size: file.size,
            kind: fileKind(file),
            status: 'uploading',
            progress: 0,
            preview: fileKind(file) === 'image' ? URL.createObjectURL(file) : ''
          };
          s.uploads.unshift(entry);
          renderList();
          s.uploadFn([file]).then(urls => {
            const url = urls?.[0];
            Object.assign(entry, {
              status: url ? 'done' : 'error',
              secure_url: url || '',
              error: url ? '' : 'El archivo se subió pero no devolvió URL',
              progress: 100
            });
            renderList();
            if (url) {
              saveUploadHistory(s.id, s.uploads.map(u => ({
                name: u.name, size: u.size, kind: u.kind,
                secure_url: u.secure_url, date: new Date().toISOString()
              })).filter(u => u.secure_url));
              showToast(`✅ ${file.name} subido a ${s.title}`, 'success');
            } else {
              showToast(`Error al subir ${file.name}`, 'error');
            }
          }).catch(err => {
            entry.status = 'error';
            entry.error = err?.message || 'Error al subir';
            renderList();
            showToast(err?.message || `Error al subir ${file.name}`, 'error');
          });
        });
      };

      dropzone.addEventListener('click', () => input.click());
      input.addEventListener('change', () => { pickFiles(input.files); input.value = ''; });
      ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragging');
      }));
      ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragging');
      }));
      dropzone.addEventListener('drop', (e) => pickFiles(e.dataTransfer?.files || []));

      // Delegación de acciones (copiar / abrir) sobre la lista de esta sección
      listEl.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('[data-copy]');
        const openBtn = e.target.closest('[data-open]');
        const idx = copyBtn?.dataset.copy ?? openBtn?.dataset.open;
        if (idx === undefined) return;
        const u = s.uploads[parseInt(idx, 10)];
        if (!u?.secure_url) return;
        if (copyBtn) copyText(u.secure_url);
        else window.open(u.secure_url, '_blank', 'noopener');
      });
    });
  }

  // ==========================================
  // SERIES — Admin unificado con la sección
  // ==========================================
  // ==========================================
  // OPEN WHEN — cartas personalizadas
  // ==========================================
  // ==========================================
  // CALENDARIO — editor de regalos por día (reemplaza la lista genérica)
  // ==========================================
  // Metadatos de los tipos de contenido del calendario (editor)
  const CAL_TYPES = {
    letter:     { label: 'Carta',        emoji: '✉️' },
    affirmation:{ label: 'Mensaje',      emoji: '💌' },
    riddle:     { label: 'Acertijo',     emoji: '🧩' },
    curiosity:  { label: 'Curiosidad',   emoji: '💡' },
    relax:      { label: 'Desconexión',  emoji: '🧘' },
    challenge:  { label: 'Reto',         emoji: '🎯' },
    polaroid:   { label: 'Foto',         emoji: '📸' },
    video:      { label: 'Vídeo',        emoji: '🎬' },
    surprise:   { label: 'Sorpresa',     emoji: '🎉' },
    offline:    { label: 'Reto real',    emoji: '🔗' },
    craft:      { label: 'Manualidad',   emoji: '🎨' },
    giftBox:    { label: 'Regalo',       emoji: '🎁' },
    game:       { label: 'Juego',        emoji: '🎮' },
    math:       { label: 'Mates',        emoji: '➗' },
    cassette:   { label: 'Música',       emoji: '🎵' },
    quiz:       { label: 'Quiz',         emoji: '🧠' },
    clickStar:  { label: 'Estrella',     emoji: '⭐' }
  };

  const CAL_MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Id canónico de un regalo por fecha (igual que calendar-expansion)
  function calGiftId(dateStr) { return `calendario_${dateStr.replaceAll('-', '')}`; }

  function calPad(n) { return String(n).padStart(2, '0'); }

  function calToIds(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
  }

  function calTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-${calPad(d.getDate())}`;
  }

  function calMonthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return `${CAL_MONTHS_ES[m - 1]} ${y}`;
  }

  function calDefaultMonth(catalog) {
    const months = Object.keys(catalog?.months || {}).sort();
    if (months.length) return months[months.length - 1];
    const t = calTodayStr().slice(0, 7);
    return t;
  }

  function renderCalendarAdmin(sub, data) {
    const catalog = data.catalog || {};
    const giftsById = {};
    (catalog.gifts || []).forEach(g => { if (g?.id) giftsById[g.id] = g; });

    if (!S.calMonth || !catalog.months?.[S.calMonth]) S.calMonth = calDefaultMonth(catalog);
    const monthKey = S.calMonth;
    const monthData = catalog.months?.[monthKey] || { calendarMapping: {} };
    const mapping = monthData.calendarMapping || {};

    // Días del mes con su contenido
    const daysInMonth = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
    const dayRows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ids = calToIds(mapping[String(d)]).filter(id => giftsById[id]);
      dayRows.push({ day: d, ids, empty: !ids.length });
    }

    // Día seleccionado (por defecto el primero con contenido, o hoy si el mes es el actual)
    if (!S.calDay || S.calDay > daysInMonth) {
      const today = calTodayStr();
      const todayRow = today.startsWith(monthKey) ? dayRows.find(r => r.day === Number(today.slice(8))) : null;
      S.calDay = (todayRow && !todayRow.empty) ? todayRow.day : (dayRows.find(r => !r.empty)?.day || null);
    }
    const selDay = S.calDay;
    const selIds = selDay ? calToIds(mapping[String(selDay)]).filter(id => giftsById[id]) : [];
    const selDateStr = `${monthKey}-${calPad(selDay)}`;

    const totalGifts = (catalog.gifts || []).length;
    const daysWithContent = dayRows.filter(r => !r.empty).length;

    sub.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap;">
        <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);" id="calAdminCount">${daysWithContent} de ${daysInMonth} días · ${totalGifts} regalos</span>
        <div style="display:flex;gap:8px;">
          <button class="admin-btn admin-btn-sm" id="calAdminResponses">💌 Respuestas</button>
        </div>
      </div>

      <div class="admin-cal-nav">
        <button class="admin-btn admin-btn-sm admin-btn-ghost" id="calAdminPrev" aria-label="Mes anterior">‹</button>
        <span class="admin-cal-nav__label" id="calAdminMonthLabel">${esc(calMonthLabel(monthKey))}</span>
        <button class="admin-btn admin-btn-sm admin-btn-ghost" id="calAdminNext" aria-label="Mes siguiente">›</button>
        <button class="admin-btn admin-btn-sm admin-btn-secondary" id="calAdminToday">Hoy</button>
      </div>

      <div class="admin-cal-grid" id="calAdminGrid">
        ${dayRows.map(({ day, ids, empty }) => `
          <button class="admin-cal-day${empty ? ' is-empty' : ''}${day === selDay ? ' is-selected' : ''}" data-day="${day}">
            <span class="admin-cal-day__num">${day}</span>
            ${empty ? '' : `
              <span class="admin-cal-day__types">${ids.map(id => CAL_TYPES[giftsById[id]?.type]?.emoji || '✨').join('')}</span>
              <span class="admin-cal-day__count">${ids.length}${ids.length > 1 ? ' contenidos' : ' contenido'}</span>
            `}
          </button>
        `).join('')}
      </div>

      ${selDay ? `
      <div class="admin-subsection" style="margin-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap;">
          <h4 style="margin:0;">${esc(selDateStr)} · ${selIds.length ? `${selIds.length} contenido${selIds.length > 1 ? 's' : ''}` : 'Día vacío'}</h4>
          <button class="admin-btn admin-btn-sm" id="calAdminAdd">${UI.plus} Añadir contenido</button>
        </div>
        ${selIds.length
          ? `<div class="admin-list" id="calAdminDayList">${selIds.map((id, i) => {
              const g = giftsById[id];
              const t = CAL_TYPES[g.type] || { label: 'Sorpresa', emoji: '✨' };
              const preview = g?.data?.content || g?.data?.message || g?.data?.fact || g?.data?.question || g?.title || '';
              return `<div class="admin-list-item" data-cal-index="${i}">
                <div style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;min-width:34px;">${t.emoji}</div>
                <div style="flex:1;min-width:0;">
                  <div class="item-title">${esc(g?.title || t.label)} <span class="admin-badge-tag">${esc(t.label)}</span></div>
                  ${preview ? `<div class="item-sub">${esc(String(preview).slice(0, 80))}${String(preview).length > 80 ? '…' : ''}</div>` : ''}
                </div>
                <div class="item-actions">
                  <button class="item-action-btn edit" data-cal-edit="${i}" title="Editar">${UI.edit}</button>
                  <button class="item-action-btn delete" data-cal-delete="${i}" title="Eliminar">${UI.trash}</button>
                </div>
              </div>`;
            }).join('')}</div>`
          : '<div class="admin-empty">Este día no tiene contenido todavía. Pulsa «Añadir contenido» para crear la primera sorpresa.</div>'}
      </div>
      ` : ''}
    `;

    // Navegación de meses
    page.querySelector('#calAdminPrev').onclick = () => {
      const [y, m] = monthKey.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      S.calMonth = `${d.getFullYear()}-${calPad(d.getMonth() + 1)}`;
      S.calDay = null;
      renderCalendarAdmin(sub, data);
    };
    page.querySelector('#calAdminNext').onclick = () => {
      const [y, m] = monthKey.split('-').map(Number);
      const d = new Date(y, m, 1);
      S.calMonth = `${d.getFullYear()}-${calPad(d.getMonth() + 1)}`;
      S.calDay = null;
      renderCalendarAdmin(sub, data);
    };
    page.querySelector('#calAdminToday').onclick = () => {
      S.calMonth = calTodayStr().slice(0, 7);
      S.calDay = null;
      renderCalendarAdmin(sub, data);
    };

    // Selección de día
    page.querySelectorAll('#calAdminGrid .admin-cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        S.calDay = Number(btn.dataset.day);
        renderCalendarAdmin(sub, data);
      });
    });

    // Respuestas (mismo modal que la lista genérica)
    page.querySelector('#calAdminResponses').onclick = () => openGiftResponses('regalos', catalog.gifts || []);

    // Añadir contenido al día seleccionado
    page.querySelector('#calAdminAdd').onclick = () => openCalGiftEditor(null, selDateStr, catalog, data.save);

    // Editar / eliminar contenidos del día
    const dayList = page.querySelector('#calAdminDayList');
    dayList?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-cal-edit]');
      const delBtn = e.target.closest('[data-cal-delete]');
      if (editBtn) {
        const g = giftsById[selIds[Number(editBtn.dataset.calEdit)]];
        if (g) openCalGiftEditor(g, selDateStr, catalog, data.save);
      } else if (delBtn) {
        const g = giftsById[selIds[Number(delBtn.dataset.calDelete)]];
        if (!g) return;
        modal.open(
          `${UI.trash} Eliminar contenido`,
          `<p style="margin:0;">¿Seguro que quieres eliminar <strong>${esc(g.title || 'este contenido')}</strong> del día ${esc(selDateStr)}? Esta acción no se puede deshacer.</p>`,
          async () => {
            const nextIds = selIds.filter(id => id !== g.id);
            const nextMonths = JSON.parse(JSON.stringify(catalog.months || {}));
            const m = nextMonths[monthKey] || { calendarMapping: {} };
            if (nextIds.length === 0) delete m.calendarMapping[String(selDay)];
            else if (nextIds.length === 1) m.calendarMapping[String(selDay)] = nextIds[0];
            else m.calendarMapping[String(selDay)] = nextIds;
            nextMonths[monthKey] = m;
            const nextGifts = (catalog.gifts || []).filter(x => x.id !== g.id);
            const next = { version: catalog.version, months: nextMonths, gifts: nextGifts };
            await data.save(next);
            renderCalendarAdmin(page.querySelector('#contentSubContent'), { catalog: next, save: data.save });
            showToast('Contenido eliminado ✓', 'success');
          },
          'Eliminar'
        );
      }
    });
  }

  // Formulario del editor de contenido (campos por tipo)
  function openCalGiftEditor(gift, dateStr, catalog, saveFn) {
    const isNew = !gift;
    const data0 = gift?.data || {};
    const types = Object.entries(CAL_TYPES).map(([id, t]) => `<option value="${id}" ${gift?.type === id ? 'selected' : ''}>${t.emoji} ${esc(t.label)}</option>`).join('');

    // Campos por tipo: título común + data según tipo
    const fieldByType = (type) => {
      switch (type) {
        case 'letter':     return [['content', 'Contenido de la carta', 'textarea']];
        case 'affirmation':return [['message', 'Mensaje', 'textarea']];
        case 'riddle':     return [['question', 'Pregunta / acertijo', 'textarea'], ['answer', 'Respuesta', 'text']];
        case 'curiosity':  return [['fact', 'Dato curioso', 'textarea']];
        case 'relax':      return [['message', 'Instrucciones de desconexión', 'textarea']];
        case 'challenge':  return [['message', 'El reto', 'textarea']];
        case 'polaroid':   return [['image', 'URL de la foto', 'text'], ['caption', 'Pie de foto', 'text']];
        case 'video':      return [['videoUrl', 'URL del vídeo', 'text'], ['caption', 'Descripción', 'text']];
        case 'surprise':   return [['message', 'La sorpresa', 'textarea']];
        case 'offline':    return [['message', 'El reto', 'textarea'], ['instructions', 'Instrucciones', 'textarea']];
        case 'craft':      return [['message', 'Descripción', 'textarea'], ['pdfUrl', 'URL del PDF', 'text']];
        case 'giftBox':    return [['message', 'Mensaje', 'textarea'], ['image', 'URL de imagen (opcional)', 'text']];
        case 'game':       return [['redirectUrl', 'URL del juego', 'text'], ['message', 'Mensaje', 'textarea']];
        case 'math':       return [['problem', 'Problema', 'textarea'], ['answer', 'Solución', 'text']];
        case 'cassette':   return [['message', 'Título / nota', 'text'], ['audioUrl', 'URL del audio', 'text']];
        case 'clickStar':  return [['message', 'Mensaje', 'textarea']];
        case 'quiz':       return [['message', 'Mensaje', 'textarea']];
        default:           return [['message', 'Contenido', 'textarea']];
      }
    };

    const fields = fieldByType(gift?.type || 'letter');

    modal.open(
      `${isNew ? 'Nuevo contenido' : 'Editar contenido'} · ${esc(dateStr)}`,
      `
      <input type="hidden" id="calEditType">
      <div class="admin-form-grid">
        <div class="admin-field">
          <label>Tipo</label>
          <select id="calEditTypeSelect">${types}</select>
        </div>
        <div class="admin-field">
          <label>Título *</label>
          <input type="text" id="calEditTitle" value="${esc(gift?.title || '')}" placeholder="Ej: Carta de agosto">
        </div>
      </div>
      <div id="calEditFields">${renderCalFields(fields, data0)}</div>
      <p style="margin:0;color:var(--theme-text-secondary);font-size:var(--fs-sm);">${isNew ? '💡 El contenido se añade al final del día. Puedes cambiar el tipo antes de guardar.' : '💡 Cambia el tipo si quieres y rellena solo los campos que veas.'}</p>
      `,
      async () => {
        const type = page.querySelector('#calEditTypeSelect').value;
        const title = page.querySelector('#calEditTitle').value.trim();
        if (!title) throw new Error('El título es obligatorio');

        // Recoge los campos según el tipo elegido (no el original)
        const payloadData = {};
        fieldByType(type).forEach(([key]) => {
          const el = page.querySelector(`#calEditF_${key}`);
          if (el) payloadData[key] = el.value.trim();
        });

        const next = JSON.parse(JSON.stringify(catalog));
        next.months = next.months || {};
        next.gifts = Array.isArray(next.gifts) ? next.gifts : [];
        next.version = Math.max(Number(next.version) || 0, 5);

        if (isNew) {
          // Id canónico por fecha + sufijo si el día ya tiene contenidos
          const dayNum = dateStr.slice(8);
          const existingIds = calToIds(next.months?.[dateStr.slice(0, 7)]?.calendarMapping?.[String(parseInt(dayNum, 10))]);
          const n = existingIds.length;
          const id = `${calGiftId(dateStr)}${n === 0 ? '' : `_${String.fromCharCode(96 + n)}`}`;
          const g = { id, title, type, unlock: { mode: 'date', value: dateStr }, redirect: false, data: payloadData };
          next.gifts.push(g);
          const monthKey = dateStr.slice(0, 7);
          if (!next.months[monthKey]) next.months[monthKey] = { label: calMonthLabel(monthKey), calendarMapping: {} };
          if (!next.months[monthKey].calendarMapping) next.months[monthKey].calendarMapping = {};
          const ids = calToIds(next.months[monthKey].calendarMapping[String(parseInt(dayNum, 10))]).concat(g.id);
          next.months[monthKey].calendarMapping[String(parseInt(dayNum, 10))] = ids.length === 1 ? ids[0] : ids;
        } else {
          const idx = next.gifts.findIndex(x => x.id === gift.id);
          if (idx >= 0) next.gifts[idx] = { ...next.gifts[idx], title, type, data: payloadData };
        }

        await saveFn(next);
        renderCalendarAdmin(page.querySelector('#contentSubContent'), { catalog: next, save: saveFn });
        showToast(isNew ? 'Contenido añadido ✓' : 'Contenido actualizado ✓', 'success');
      }
    );

    // Al cambiar el tipo, re-renderiza los campos
    const sel = page.querySelector('#calEditTypeSelect');
    sel.addEventListener('change', () => {
      const el = page.querySelector('#calEditFields');
      if (el) el.innerHTML = renderCalFields(fieldByType(sel.value), {});
    });
  }

  function renderCalFields(fields, data0) {
    return fields.map(([key, label, kind]) => {
      const val = data0[key] || '';
      return `<div class="admin-field">
        <label>${esc(label)}</label>
        ${kind === 'textarea'
          ? `<textarea id="calEditF_${key}" rows="4">${esc(val)}</textarea>`
          : `<input type="text" id="calEditF_${key}" value="${esc(val)}">`}
      </div>`;
    }).join('');
  }

  function renderOpenWhenAdmin(sub, data) {
    const custom = Array.isArray(data.items) ? data.items : [];
    const statics = Array.isArray(data.staticLetters) ? data.staticLetters : [];
    const staticIds = new Set(statics.map(l => l.id));

    // Lista fusionada: personalizadas primero (sobrescriben), luego las de la app
    const seenIds = new Set();
    const merged = [];
    custom.forEach(l => { if (l?.id && !seenIds.has(l.id)) { seenIds.add(l.id); merged.push(l); } });
    statics.forEach(l => { if (!seenIds.has(l.id)) { seenIds.add(l.id); merged.push(l); } });

    const isCustom = (l) => custom.some(c => c?.id === l.id);

    sub.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);" id="owItemCount">${custom.length} personalizada${custom.length === 1 ? '' : 's'} · ${statics.length} de la app</span>
        <button class="admin-btn admin-btn-sm" id="addOpenWhenLetter">${UI.plus} Nueva carta</button>
      </div>
      <div class="admin-search admin-search--compact">
        <span class="admin-search-icon">${UI.search}</span>
        <input type="text" id="owSearch" class="admin-search-input" placeholder="Buscar carta…" autocomplete="off">
      </div>
      <div class="admin-list" id="openWhenAdminList">
        ${merged.map((l, i) => owRowHTML(l, i, isCustom(l), staticIds.has(l.id))).join('')}
      </div>
    `;

    const renderList = (list) => {
      const el = page.querySelector('#openWhenAdminList');
      if (el) el.innerHTML = list.length
        ? list.map((l, i) => owRowHTML(l, i, isCustom(l), staticIds.has(l.id))).join('')
        : '<div class="admin-empty">No hay cartas que coincidan</div>';
    };

    page.querySelector('#addOpenWhenLetter')?.addEventListener('click', () => openOpenWhenEditor(null, data));
    page.querySelector('#owSearch')?.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      renderList(q ? merged.filter(l => JSON.stringify(l).toLowerCase().includes(q)) : merged);
    });
    page.querySelector('#openWhenAdminList')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-ow-edit]');
      const delBtn = e.target.closest('[data-ow-delete]');
      const id = editBtn?.dataset.owEdit ?? delBtn?.dataset.owDelete;
      if (!id) return;
      e.stopPropagation();
      const letter = merged.find(l => l.id === id);
      if (!letter) return;
      if (editBtn) {
        openOpenWhenEditor(letter, data);
      } else {
        const isOverride = staticIds.has(id);
        modal.open(
          'Eliminar carta',
          isOverride
            ? `<p style="margin:0;">Se quitará tu versión personalizada de <strong>${esc(letter.title)}</strong> y volverá la carta original de la app.</p>`
            : `<p style="margin:0;">¿Seguro que quieres eliminar <strong>${esc(letter.title)}</strong>?</p>`,
          async () => {
            const next = custom.filter(l => l.id !== id);
            await data.save(next);
            logContentAction('openwhen', 'deleted', `Eliminada: ${letter.title}`);
            loadContentSub('openwhen');
            showToast('Carta eliminada ✓', 'success');
          },
          'Eliminar'
        );
      }
    });
  }

  function owRowHTML(l, i, isCustom, isStatic) {
    const meta = TYPE_META[l.type] || TYPE_META.carta;
    const cat = CATEGORIES.find(c => c.id === l.category);
    return `
      <div class="admin-list-item" data-index="${i}">
        <div class="series-admin-cover" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${meta.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div class="item-title">${esc(l.title || 'Sin título')}
            ${isCustom ? '<span class="admin-badge-tag accent">Personalizada</span>' : '<span class="admin-badge-tag">App</span>'}
          </div>
          <div class="item-sub">${cat ? `${cat.emoji} ${esc(cat.title)}` : ''}${l.note ? ` · ${esc(l.note)}` : ''}</div>
        </div>
        <div class="item-actions">
          <button class="item-action-btn edit" data-ow-edit="${esc(l.id)}" title="Editar">${UI.edit}</button>
          ${isCustom ? `<button class="item-action-btn delete" data-ow-delete="${esc(l.id)}" title="Eliminar">${UI.trash}</button>` : ''}
        </div>
      </div>`;
  }

  function openOpenWhenEditor(letter, data) {
    const isNew = !letter;
    const types = [
      ['carta', '💌 Carta'],
      ['mensaje', '💬 Mensaje'],
      ['reto', '🧩 Reto'],
      ['juego', '🎮 Juego'],
      ['sorpresa', '🎁 Sorpresa']
    ];
    modal.open(
      `${isNew ? 'Nueva carta' : 'Editar carta'} de Open When`,
      `
      <input type="hidden" id="owAdminEditId" value="${esc(letter?.id || '')}">
      <div class="admin-field"><label>Título *</label><input type="text" id="owAdminTitle" value="${esc(letter?.title || '')}" placeholder="Ábrela cuando…"></div>
      <div class="admin-field"><label>Nota (subtítulo)</label><input type="text" id="owAdminNote" value="${esc(letter?.note || '')}" placeholder="Unas palabras cortitas"></div>
      <div class="admin-form-grid">
        <div class="admin-field"><label>Categoría</label>
          <select id="owAdminCat">${CATEGORIES.map(c => `<option value="${c.id}" ${letter?.category === c.id ? 'selected' : ''}>${c.emoji} ${esc(c.title)}</option>`).join('')}</select>
        </div>
        <div class="admin-field"><label>Tipo</label>
          <select id="owAdminType">${types.map(([v, lbl]) => `<option value="${v}" ${letter?.type === v ? 'selected' : ''}>${lbl}</option>`).join('')}</select>
        </div>
      </div>
      <div class="admin-field"><label>Mensaje *</label><textarea id="owAdminMsg" rows="6" placeholder="El contenido de la carta…">${esc(letter?.message || '')}</textarea></div>
      <p style="margin:0;color:var(--theme-text-secondary);font-size:var(--fs-sm);">💡 Las cartas con multimedia (notas de voz, canciones, álbumes) se crean desde el código.</p>
      `,
      async () => {
        const title = page.querySelector('#owAdminTitle')?.value?.trim();
        const message = page.querySelector('#owAdminMsg')?.value?.trim();
        if (!title) throw new Error('El título es obligatorio');
        if (!message) throw new Error('El mensaje es obligatorio');
        const payload = {
          id: page.querySelector('#owAdminEditId').value || createId(),
          category: page.querySelector('#owAdminCat').value,
          type: page.querySelector('#owAdminType').value,
          title,
          note: page.querySelector('#owAdminNote')?.value?.trim() || '',
          message
        };
        const custom = [...(data.items || [])];
        const idx = custom.findIndex(c => c?.id === payload.id);
        if (idx >= 0) custom[idx] = payload;
        else custom.push(payload);
        await data.save(custom);
        logContentAction('openwhen', isNew ? 'created' : 'updated', `${isNew ? 'Añadida' : 'Actualizada'}: ${title}`);
        loadContentSub('openwhen');
        showToast(isNew ? 'Carta añadida ✓' : 'Carta actualizada ✓', 'success');
      }
    );
  }

  function renderSeriesAdmin(sub, items, saveFn, reloadFn) {
    const favs = loadFavorites();
    sub.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);">${items.length} títulos · catálogo compartido con la sección</span>
        <button class="admin-btn admin-btn-sm" id="addSeriesItem">${UI.plus} Añadir</button>
      </div>
      <div class="admin-list" id="seriesAdminList">
        ${items.length ? items.map((item, i) => {
          const cover = item.portada || item.cover || '';
          return `
          <div class="admin-list-item" data-index="${i}">
            <div class="series-admin-cover">
              ${cover ? `<img src="${esc(cover)}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${esc((item.titulo||item.title||'?')[0])}'">` : `<span>${esc((item.titulo||item.title||'?')[0])}</span>`}
            </div>
            <div style="flex:1;min-width:0;">
              <div class="item-title">${esc(item.titulo || item.title || 'Sin título')}
                <span class="admin-badge-tag">${item.tipo === 'pelicula' ? 'Película' : 'Serie'}</span>
                ${item.destacado ? '<span class="admin-badge-tag accent">★ Destacado</span>' : ''}
                ${favs.has(item.id) ? '<span class="admin-badge-tag">❤</span>' : ''}
              </div>
              <div class="item-sub">
                ${getTotal(item) > 0 ? `${getTotal(item)} ep · ` : ''}${item.tipo === 'serie' ? 'Serie' : 'Película'}
              </div>
            </div>
            <div class="item-actions">
              <button class="item-action-btn edit" data-action="edit" data-index="${i}" title="Editar">${UI.edit}</button>
              <button class="item-action-btn delete" data-action="delete" data-index="${i}" title="Eliminar">${UI.trash}</button>
            </div>
          </div>`;
        }).join('') : '<div class="admin-empty">Aún no hay series ni películas. Añade la primera desde el botón +.</div>'}
      </div>
    `;

    page.querySelector('#addSeriesItem')?.addEventListener('click', () => openSeriesEditor(null, items, saveFn, reloadFn));
    page.querySelector('#seriesAdminList')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit"]');
      const delBtn = e.target.closest('[data-action="delete"]');
      const idxRaw = editBtn?.dataset.index ?? delBtn?.dataset.index;
      if (idxRaw === undefined) return;
      const idx = parseInt(idxRaw, 10);
      e.stopPropagation();
      if (editBtn) openSeriesEditor(items[idx], items, saveFn, reloadFn);
      else {
        const item = items[idx];
        modal.open(
          `${UI.trash} Eliminar contenido`,
          `<p style="margin:0;">¿Seguro que quieres eliminar <strong>${esc(item.titulo || item.title || 'este título')}</strong>? También se quitará de favoritos y Top 5.</p>`,
          async () => {
            // Fuente única: seriesData.deleteCatalogItem limpia
            // catálogo + favoritos + podio (renumerando) + progreso
            await deleteCatalogItem(item.id);
            reloadFn('series');
            showToast('Eliminado ✓', 'success');
          },
          'Eliminar'
        );
      }
    });
  }

  function openSeriesEditor(item, items, saveFn, reloadFn) {
    const isNew = !item;
    const tipo = item?.tipo || 'serie';
    const seasons = item ? getSeasons(item) : [{ titulo: 'Temporada 1', episodios: [{ num: 1, titulo: 'Episodio 1' }] }];

    modal.open(
      `${isNew ? 'Añadir' : 'Editar'} ${tipo === 'serie' ? 'serie' : 'película'}`,
      `
      <input type="hidden" id="srAdminEditId" value="${esc(item?.id || '')}">
      <div class="admin-form-grid">
        <div class="admin-field"><label>Título *</label><input type="text" id="srAdminTitulo" value="${esc(item?.titulo || '')}"></div>
        <div class="admin-field"><label>Tipo</label>
          <select id="srAdminTipo">
            <option value="serie" ${tipo === 'serie' ? 'selected' : ''}>Serie</option>
            <option value="pelicula" ${tipo === 'pelicula' ? 'selected' : ''}>Película</option>
          </select>
        </div>
      </div>
      <div class="admin-field"><label>Descripción</label><textarea id="srAdminDesc" rows="3">${esc(item?.descripcion || '')}</textarea></div>
      <div class="admin-form-grid">
        <div class="admin-field"><label>Portada (2:3)</label><input type="text" id="srAdminPortada" value="${esc(item?.portada || '')}" placeholder="https://..."></div>
        <div class="admin-field"><label>Banner (16:9)</label><input type="text" id="srAdminBanner" value="${esc(item?.banner || '')}" placeholder="https://..."></div>
      </div>
      <div class="admin-field"><label>Enlace de reproducción</label><input type="text" id="srAdminRecurso" value="${esc(item?.recurso || item?.webUrl || item?.videoUrl || '')}" placeholder="https://..."></div>
      <label class="admin-check"><input type="checkbox" id="srAdminDestacado" ${item?.destacado ? 'checked' : ''}> Destacar en el inicio de la sección</label>

      <div id="srAdminSeasonsPanel" style="display:${tipo === 'serie' ? 'block' : 'none'}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 8px;">
          <strong style="font-size:var(--fs-sm);">Temporadas y episodios</strong>
          <button type="button" class="admin-btn admin-btn-sm" id="srAdminAddSeason">${UI.plus} Temporada</button>
        </div>
        <div id="srAdminSeasonsBox" class="sr-admin-seasons">${seasonEditorHTML(seasons)}</div>
      </div>`,
      async () => {
        const titulo = page.querySelector('#srAdminTitulo')?.value?.trim();
        if (!titulo) throw new Error('El título es obligatorio');
        const tipoFinal = page.querySelector('#srAdminTipo').value;
        const editId = page.querySelector('#srAdminEditId').value;
        const urlFields = {
          portada: page.querySelector('#srAdminPortada')?.value?.trim() || '',
          banner: page.querySelector('#srAdminBanner')?.value?.trim() || '',
          recurso: page.querySelector('#srAdminRecurso')?.value?.trim() || ''
        };
        const badUrl = Object.entries(urlFields).find(([, v]) => !isValidUrlField(v));
        if (badUrl) throw new Error(`La URL de ${badUrl[0]} no es válida (usa https://…)`);
        const payload = {
          id: editId || createId(),
          titulo,
          tipo: tipoFinal,
          descripcion: page.querySelector('#srAdminDesc')?.value?.trim() || '',
          portada: urlFields.portada,
          banner: urlFields.banner,
          recurso: urlFields.recurso,
          destacado: page.querySelector('#srAdminDestacado')?.checked || false
        };
        if (tipoFinal === 'serie') {
          const s = collectSeasons(page.querySelector('#srAdminSeasonsBox'));
          if (s.length) payload.temporadas = s;
        }
        const cloned = [...items];
        if (isNew) { payload.createdAt = Date.now(); cloned.push(payload); }
        else cloned[items.indexOf(item)] = { ...items[items.indexOf(item)], ...payload };
        await saveFn(cloned);
        logContentAction('series', isNew ? 'created' : 'updated', `${isNew ? 'Añadida' : 'Actualizada'}: ${payload.title || 'serie'}`);
        reloadFn('series');
        showToast(isNew ? 'Añadido ✓' : 'Actualizado ✓', 'success');
      }
    );

    // Wire: tipo → mostrar/ocultar temporadas + añadir temporada
    page.querySelector('#srAdminTipo')?.addEventListener('change', (e) => {
      const panel = page.querySelector('#srAdminSeasonsPanel');
      panel.style.display = e.target.value === 'serie' ? 'block' : 'none';
    });
    page.querySelector('#srAdminAddSeason')?.addEventListener('click', () => {
      page.querySelector('#srAdminSeasonsBox').insertAdjacentHTML('beforeend', emptySeasonHTML());
    });
    bindSeasonEditorEvents(page.querySelector('#srAdminSeasonsBox'));
  }

  function renderContentItems(items, type) {
    // Mismo renderer que la búsqueda: los índices apuntan a la lista completa
    return renderContentItemsIndexed(items.map((item, i) => ({ item, i })), type);
  }

  function renderSimpleList(items, label) {
    if (!items.length) return '<div class="admin-empty">No hay elementos</div>';
    return items.map((item, i) => {
      const text = typeof item === 'string' ? item : (item.text || item[label] || '');
      return `<div class="admin-list-item" data-index="${i}">
        <div style="flex:1;min-width:0;"><div class="item-title">${esc(text)}</div></div>
        <div class="item-actions">
          <button class="item-action-btn edit" data-action="edit" data-index="${i}" title="Editar">${UI.edit}</button>
          <button class="item-action-btn delete" data-action="delete" data-index="${i}" title="Eliminar">${UI.trash}</button>
        </div>
      </div>`;
    }).join('');
  }

  async function openGiftResponses(type, items) {
    // Solo regalos: muestra las respuestas recibidas agrupadas por día.
    if (type !== 'regalos') return;
    const all = await db.getAllGiftResponses();
    const byId = {};
    items.forEach(g => { if (g?.id) byId[g.id] = g; });

    const rows = Object.entries(all).filter(([, list]) => list?.length);
    if (!rows.length) {
      modal.open('💌 Respuestas de regalos', '<p style="margin:0;color:var(--theme-text-secondary);">Todavía no hay respuestas. Cuando alguien responda a un regalo con pregunta, aparecerá aquí.</p>');
      return;
    }

    // Ordena por fecha del regalo (unlock.value) de forma descendente
    rows.sort((a, b) => {
      const da = byId[a[0]]?.unlock?.value || '';
      const dbv = byId[b[0]]?.unlock?.value || '';
      return dbv.localeCompare(da);
    });

    const listHtml = rows.map(([giftId, list]) => {
      const gift = byId[giftId] || {};
      const day = gift.unlock?.value || '';
      const title = gift.title || gift.name || giftId;
      const answers = list.map(r => {
        const who = r.email || (r.userId ? String(r.userId).slice(0, 8) : 'Usuario');
        const when = r.respondedAt ? new Date(r.respondedAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="gift-response">
          <div class="gift-response__meta">${esc(who)}${when ? ` · ${esc(when)}` : ''}</div>
          <div class="gift-response__text">${esc(r.text || '—')}</div>
        </div>`;
      }).join('');
      return `<div class="gift-response-group">
        <div class="gift-response-group__head">${day ? esc(day) + ' · ' : ''}${esc(title)} <span class="gift-response-group__count">${list.length}</span></div>
        ${answers}
      </div>`;
    }).join('');

    modal.open('💌 Respuestas de regalos', `<div class="gift-responses-list">${listHtml}</div>`);
  }

  // Registra en el log de actividad del Admin las acciones de contenido
  // (create/update/delete) con la etiqueta del tipo.
  function logContentAction(type, verb, label) {
    const prefix = {
      razones: 'reason', canciones: 'song', noticias: 'news', series: 'series',
      regalos: 'gift', audios: 'audio', openwhen: 'letter',
      maldia_frases: 'maldia', maldia_mensajes: 'maldia'
    }[type] || type;
    db.logActivity(`${prefix}_${verb}`, label);
  }

  function bindContentCRUD(type, items, saveFn, reloadFn) {
    const btn = page.querySelector('#addContentItem');
    if (btn) {
      btn.addEventListener('click', () => {
        openContentEditor(type, null, -1, items, saveFn, reloadFn);
      });
    }

    const respBtn = page.querySelector('#viewGiftResponses');
    if (respBtn) {
      respBtn.addEventListener('click', () => openGiftResponses(type, items));
    }

    // Delegación en el contenedor: funciona aunque la lista se re-renderice
    // al buscar (los data-index apuntan siempre a la lista completa `items`)
    const listEl = page.querySelector('#contentItemsList');
    if (!listEl) return;
    listEl.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-action="edit"]');
      const delBtn = e.target.closest('[data-action="delete"]');
      if (editBtn) {
        e.stopPropagation();
        const idx = parseInt(editBtn.dataset.index);
        openContentEditor(type, items[idx], idx, items, saveFn, reloadFn);
      } else if (delBtn) {
        e.stopPropagation();
        const idx = parseInt(delBtn.dataset.index);
        modal.open(
          `${UI.trash} Eliminar elemento`,
          `<p style="margin:0;">¿Seguro que quieres eliminar este elemento? Esta acción no se puede deshacer.</p>`,
          async () => {
            const newItems = items.filter((_, i) => i !== idx);
            const label = items[idx] ? (items[idx].title || items[idx].text || items[idx].name || 'elemento') : 'elemento';
            await saveFn(newItems);
            logContentAction(type, 'deleted', `Eliminado: ${label}`);
            await reloadFn(type);
            showToast('Eliminado', 'success');
          },
          'Eliminar'
        );
      }
    });
  }

  // Render de la lista filtrada por búsqueda (mantiene los índices originales)
  function renderContentItemsIndexed(indexed, type) {
    if (!indexed.length) return '<div class="admin-empty">No hay elementos para mostrar</div>';
    return indexed.map(({ item, i }) => {
      const label = type === 'razones' ? (item && typeof item === 'object' ? (item.text || item.reason || 'Sin texto') : (item || 'Sin texto')) :
                    type === 'canciones' ? (item.title || 'Sin título') :
                    type === 'noticias' ? (item.title || 'Sin título') :
                    type === 'series' ? (item.title || item.name || 'Sin título') :
                    type === 'regalos' ? (item.title || item.name || 'Regalo ' + (i + 1)) :
                    type === 'audios' ? (item.title || 'Audio ' + (i + 1)) :
                    'Elemento ' + (i + 1);
      let sub = type === 'canciones' ? ` — ${esc(item.artist || '')}` :
                type === 'noticias' ? ` — ${esc(item.date || '')}` :
                type === 'audios' ? ` — ${esc(item.date || '')}${item.creator ? ' · ' + esc(item.creator) : ''}` : '';
      if (type === 'razones' && item && typeof item === 'object') {
        const d = item.date || '';
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const estado = !d ? 'Siempre disponible' : (d > todayStr ? `🔒 ${d}` : '✅ Desbloqueada');
        sub = ` — <span class="razon-admin-date${d && d <= todayStr ? ' is-open' : ''}">${esc(estado)}</span>`;
      }
      return `<div class="admin-list-item" data-index="${i}">
        <div style="flex:1;min-width:0;">
          <div class="item-title">${esc(label)}</div>
          ${sub ? `<div class="item-sub">${sub}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="item-action-btn edit" data-action="edit" data-index="${i}" title="Editar">${UI.edit}</button>
          <button class="item-action-btn delete" data-action="delete" data-index="${i}" title="Eliminar">${UI.trash}</button>
        </div>
      </div>`;
    }).join('');
  }

  function bindSimpleCRUD(key, items, saveFn, reloadFn) {
    const btn = page.querySelector(`#add${key.replace(/_./g, m => m[1].toUpperCase()).replace(/^./g, m => m.toUpperCase())}`);
    // Simpler approach: just use the prefix
    const prefix = key.startsWith('maldia_frase') ? 'MaldiaFrase' : 'MaldiaMensaje';
    const addBtn = page.querySelector(`#add${prefix}`);

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openTextEditor(prefix, null, -1, items, saveFn, reloadFn);
      });
    }

    // The parent container holds both frases and mensajes; scope to current subsection
    const parent = addBtn?.closest('.admin-subsection');
    const scope = parent || page;

    scope.querySelectorAll('.admin-list-item [data-action="edit"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(b.dataset.index);
        openTextEditor(prefix, items[idx], idx, items, saveFn, reloadFn);
      });
    });

    scope.querySelectorAll('.admin-list-item [data-action="delete"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(b.dataset.index);
        const newItems = items.filter((_, i) => i !== idx);
        saveFn(newItems).then(() => {
          logContentAction(prefix.startsWith('MaldiaFrase') ? 'maldia_frases' : 'maldia_mensajes', 'deleted', 'Eliminado texto');
          reloadFn(prefix.startsWith('MaldiaFrase') ? 'maldia' : 'maldia').then(() => showToast('Eliminado', 'success'));
        }).catch(err => showToast(err?.message || 'Error', 'error'));
      });
    });
  }

  function openContentEditor(type, item, index, items, saveFn, reloadFn) {
    const isNew = index === -1;
    const labelMap = {
      razones: 'Razón (texto)', canciones: 'Canción', noticias: 'Noticia',
      series: 'Serie', regalos: 'Regalo', audios: 'Audio'
    };

    let formHtml;
    if (type === 'razones') {
      const val = item ? (typeof item === 'string' ? item : (item.text || item.reason || '')) : '';
      const dateVal = item && typeof item === 'object' && item.date ? item.date : '';
      formHtml = `
        <div class="admin-field">
          <label>Texto de la razón *</label>
          <textarea id="editFieldText" rows="3">${esc(val)}</textarea>
        </div>
        <div class="admin-field">
          <label>Fecha de desbloqueo (opcional)</label>
          <input type="date" id="editFieldDate" value="${esc(dateVal)}">
          <small class="admin-field-hint">Si la dejas vacía, la razón estará siempre disponible. Si pones una fecha, solo se desbloqueará ese día (como el Calendario).</small>
        </div>`;
    } else if (type === 'canciones') {
      formHtml = `
        <div class="admin-field"><label>Título</label><input type="text" id="editFieldTitle" value="${esc(item?.title || '')}"></div>
        <div class="admin-field"><label>Artista</label><input type="text" id="editFieldArtist" value="${esc(item?.artist || '')}"></div>
        <div class="admin-field"><label>URL del audio</label><input type="text" id="editFieldAudio" value="${esc(item?.audio || '')}"></div>
        <div class="admin-field"><label>URL de portada</label><input type="text" id="editFieldCover" value="${esc(item?.cover || '')}"></div>`;
    } else if (type === 'noticias') {
      formHtml = `
        <div class="admin-field"><label>Título</label><input type="text" id="editFieldTitle" value="${esc(item?.title || '')}"></div>
        <div class="admin-field"><label>Fecha</label><input type="text" id="editFieldDate" value="${esc(item?.date || '')}"></div>
        <div class="admin-field"><label>Descripción</label><textarea id="editFieldDesc" rows="3">${esc(item?.description || '')}</textarea></div>`;
    } else if (type === 'series') {
      formHtml = `
        <div class="admin-field"><label>Título</label><input type="text" id="editFieldTitle" value="${esc(item?.title || item?.name || '')}"></div>
        <div class="admin-field"><label>URL de imagen</label><input type="text" id="editFieldCover" value="${esc(item?.cover || item?.image || '')}"></div>
        <div class="admin-field"><label>Descripción</label><textarea id="editFieldDesc" rows="3">${esc(item?.description || '')}</textarea></div>`;
    } else if (type === 'regalos') {
      formHtml = `
        <div class="admin-field"><label>Nombre</label><input type="text" id="editFieldTitle" value="${esc(item?.title || item?.name || '')}"></div>
        <div class="admin-field"><label>Descripción</label><textarea id="editFieldDesc" rows="3">${esc(item?.description || item?.message || '')}</textarea></div>
        <div class="admin-field"><label>Pregunta interactiva (opcional)</label>
          <textarea id="editFieldQuestion" rows="2" placeholder="Ej: ¿Cuál es tu recuerdo favorito conmigo?">${esc(item?.data?.question || '')}</textarea>
          <small class="admin-field-hint">Si pones una pregunta, al abrir el regalo aparecerá una cajita para responder y verás la respuesta aquí.</small>
        </div>`;
    } else if (type === 'audios') {
      const a = item || {};
      const dateVal = a.date || '';
      const yearVal = a.year || (dateVal ? dateVal.slice(0, 4) : '');
      const monthVal = a.month || (dateVal ? String(parseInt(dateVal.slice(5, 7), 10)).padStart(2, '0') : '');
      formHtml = `
        <div class="admin-field">
          <label>Fecha del audio *</label>
          <input type="date" id="editFieldDate" value="${esc(dateVal)}">
          <small class="admin-field-hint">Usa el día 3 del mes (p. ej. 2026-08-03). El mes/año se calculan solos.</small>
        </div>
        <div class="admin-field"><label>Título (opcional)</label><input type="text" id="editFieldTitle" value="${esc(a.title || '')}" placeholder="Ej: Nuestra voz de agosto"></div>
        <div class="admin-field">
          <label>Audio (archivo o URL) *</label>
          <input type="text" id="editFieldAudio" value="${esc(a.url || '')}" placeholder="https://res.cloudinary.com/...mp3">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <button type="button" class="admin-btn admin-btn-sm" id="uploadAudioBtn">${UI.cloud} Subir audio</button>
            <span id="uploadAudioStatus" style="font-size:12px;color:var(--theme-text-secondary);"></span>
          </div>
          <input type="file" id="editFieldAudioFile" accept="audio/*" hidden>
          <small class="admin-field-hint">Igual que en la sección Audios: el archivo se sube a Supabase y la URL se rellena sola.</small>
        </div>
        <div class="admin-field"><label>Creador (opcional)</label><input type="text" id="editFieldCreator" value="${esc(a.creator || '')}" placeholder="Darwin / Ella"></div>
        <div class="admin-field"><label>Duración en segundos (opcional)</label><input type="number" id="editFieldDuration" min="0" value="${esc(a.duration ?? '')}" placeholder="Se calcula automáticamente si la dejas vacía"></div>
        <small class="admin-field-hint">Si un mes necesita más de un audio, añade otra entrada con la misma fecha.</small>`;
      // Subida directa a Cloudinary (misma vía que Multimedia/galería)
      setTimeout(() => {
        const btn = page.querySelector('#uploadAudioBtn');
        const fileInput = page.querySelector('#editFieldAudioFile');
        const urlInput = page.querySelector('#editFieldAudio');
        const status = page.querySelector('#uploadAudioStatus');
        if (!btn || !fileInput || !urlInput) return;
        btn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files?.[0];
          fileInput.value = '';
          if (!file) return;
          if (!file.type.startsWith('audio/')) {
            status.textContent = '⚠ El archivo debe ser de audio (mp3, m4a, ogg, wav…)'; status.style.color = 'var(--theme-error)';
            return;
          }
          btn.disabled = true;
          status.textContent = 'Subiendo…';
          status.style.color = 'var(--theme-text-secondary)';
          try {
            const [url] = await db.uploadAudios([file]);
            if (!url) throw new Error('El audio se subió pero no devolvió URL');
            urlInput.value = url;
            status.textContent = '✓ Audio subido'; status.style.color = 'var(--theme-success)';
            if (file.name && !page.querySelector('#editFieldTitle')?.value) {
              page.querySelector('#editFieldTitle').value = file.name.replace(/\.[^.]+$/, '');
            }
          } catch (err) {
            status.textContent = '⚠ ' + (err?.message || 'Error al subir'); status.style.color = 'var(--theme-error)';
          } finally {
            btn.disabled = false;
          }
        });
      }, 0);
    }

    modal.open(
      `${UI.edit} ${isNew ? 'Añadir' : 'Editar'} ${labelMap[type] || 'elemento'}`,
      formHtml,
      async () => {
        const newItem = {};

        if (type === 'razones') {
          const text = page.querySelector('#editFieldText')?.value?.trim();
          if (!text) throw new Error('Escribe una razón');
          const date = page.querySelector('#editFieldDate')?.value?.trim() || '';
          const id = isNew
            ? db.generateId()
            : (typeof items[index] === 'object' && items[index]?.id) || db.generateId();
          const cloned = [...items];
          const newItem = { id, text, date };
          if (isNew) cloned.push(newItem);
          else cloned[index] = newItem;
          await saveFn(cloned);
          logContentAction(type, isNew ? 'created' : 'updated', `${isNew ? 'Añadida' : 'Actualizada'}: ${text.slice(0, 40)}`);
        } else if (type === 'canciones') {
          const title = page.querySelector('#editFieldTitle')?.value?.trim();
          if (!title) throw new Error('El título es obligatorio');
          newItem.title = title;
          newItem.artist = page.querySelector('#editFieldArtist')?.value?.trim() || '';
          newItem.audio = page.querySelector('#editFieldAudio')?.value?.trim() || '';
          newItem.cover = page.querySelector('#editFieldCover')?.value?.trim() || '';
          const cloned = [...items];
          if (isNew) cloned.push(newItem);
          else cloned[index] = { ...cloned[index], ...newItem };
          await saveFn(cloned);
          logContentAction(type, isNew ? 'created' : 'updated', `${isNew ? 'Añadida' : 'Actualizada'}: ${newItem.title}`);
        } else if (type === 'noticias') {
          const title = page.querySelector('#editFieldTitle')?.value?.trim();
          if (!title) throw new Error('El título es obligatorio');
          newItem.title = title;
          newItem.date = page.querySelector('#editFieldDate')?.value?.trim() || '';
          newItem.description = page.querySelector('#editFieldDesc')?.value?.trim() || '';
          const cloned = [...items];
          if (isNew) cloned.unshift(newItem); // newest first
          else cloned[index] = { ...cloned[index], ...newItem };
          await saveFn(cloned);
          logContentAction(type, isNew ? 'created' : 'updated', `${isNew ? 'Añadida' : 'Actualizada'}: ${newItem.title}`);
        } else if (type === 'series') {
          const title = page.querySelector('#editFieldTitle')?.value?.trim();
          if (!title) throw new Error('El título es obligatorio');
          newItem.title = title;
          newItem.cover = page.querySelector('#editFieldCover')?.value?.trim() || '';
          newItem.description = page.querySelector('#editFieldDesc')?.value?.trim() || '';
          const cloned = [...items];
          if (isNew) cloned.push(newItem);
          else cloned[index] = { ...cloned[index], ...newItem };
          await saveFn(cloned);
        } else if (type === 'regalos') {
          const title = page.querySelector('#editFieldTitle')?.value?.trim();
          newItem.title = title || `Regalo ${items.length + 1}`;
          newItem.description = page.querySelector('#editFieldDesc')?.value?.trim() || '';
          const question = page.querySelector('#editFieldQuestion')?.value?.trim() || '';
          // Conserva el resto del objeto del regalo (type, unlock, redirect, data…)
          const prev = isNew ? {} : (items[index] || {});
          newItem.data = { ...(prev.data || {}), question };
          const cloned = [...items];
          if (isNew) cloned.push({ ...prev, ...newItem });
          else cloned[index] = { ...prev, ...newItem };
          await saveFn(cloned);
          logContentAction(type, isNew ? 'created' : 'updated', `${isNew ? 'Añadido' : 'Actualizado'}: ${newItem.title}`);
        } else if (type === 'audios') {
          const date = page.querySelector('#editFieldDate')?.value?.trim() || '';
          if (!date) throw new Error('La fecha es obligatoria (usa el día 3 del mes)');
          const url = page.querySelector('#editFieldAudio')?.value?.trim() || '';
          if (!url) throw new Error('La URL del audio es obligatoria');
          const durRaw = parseInt(page.querySelector('#editFieldDuration')?.value || '', 10);
          const prev = isNew ? {} : (items[index] || {});
          const newItem = {
            ...prev,
            id: prev.id || db.generateId(),
            date,
            year: parseInt(date.slice(0, 4), 10),
            month: parseInt(date.slice(5, 7), 10),
            title: page.querySelector('#editFieldTitle')?.value?.trim() || '',
            url,
            creator: page.querySelector('#editFieldCreator')?.value?.trim() || '',
            duration: isFinite(durRaw) && durRaw > 0 ? durRaw : (prev.duration || undefined),
            createdAt: prev.createdAt || new Date().toISOString()
          };
          const cloned = [...items];
          if (isNew) cloned.push(newItem);
          else cloned[index] = newItem;
          await saveFn(cloned);
          logContentAction(type, isNew ? 'created' : 'updated', `${isNew ? 'Añadido' : 'Actualizado'}: ${newItem.title || 'audio'}`);
        }
      }
    );
  }

  function openTextEditor(prefix, text, index, items, saveFn, reloadFn) {
    const isNew = index === -1;
    const val = text ? (typeof text === 'string' ? text : (text.text || '')) : '';

    modal.open(
      `${UI.edit} ${isNew ? 'Añadir' : 'Editar'} texto`,
      `<div class="admin-field">
        <label>Texto</label>
        <textarea id="editFieldText" rows="3">${esc(val)}</textarea>
      </div>`,
      async () => {
        const value = page.querySelector('#editFieldText')?.value?.trim();
        if (!value) throw new Error('Escribe un texto');
        const cloned = [...items];
        if (isNew) cloned.push(value);
        else cloned[index] = value;
        await saveFn(cloned);
      }
    );
  }

  // ==========================================
  // 5. NOTIFICACIONES
  // ==========================================
  async function loadNotificaciones() {
    const supported = isPushSupported();
    const enabled = isEnabled();

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.bell} Notificaciones</h2></div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>Estado del sistema push</h4></div>
          <div class="notif-status-grid">
            <div class="notif-status-card">
              <span class="notif-status-icon ${supported ? 'ok' : 'muted'}">${UI.bell}</span>
              <div>
                <strong>${supported ? 'Compatible' : 'No compatible'}</strong>
                <div class="muted-text">Web Push API en este navegador</div>
              </div>
            </div>
            <div class="notif-status-card">
              <span class="notif-status-icon ${enabled ? 'ok' : 'muted'}">${UI.check}</span>
              <div>
                <strong>${enabled ? 'Activadas' : 'No activadas'}</strong>
                <div class="muted-text">Permiso de notificaciones del usuario</div>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>${UI.send} Notificación de prueba</h4></div>
          <p class="muted-text">Verifica que el service worker y el canal de notificaciones de <strong>este dispositivo</strong> funcionan.</p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button class="admin-btn admin-btn-primary" id="testPushBtn">${UI.send} Enviar ahora</button>
            <span class="admin-btn-note" id="testPushState"></span>
          </div>
          <div class="notif-result" id="notifResult"></div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>${UI.send} Enviar a todos los usuarios</h4></div>
          <p class="muted-text">Envía un push a todos los dispositivos suscritos (solo llega a quien haya activado notificaciones en su perfil).</p>
          <div class="admin-field">
            <label>Título</label>
            <input type="text" id="sendAllTitle" value="Personal Hub 💌" placeholder="Título de la notificación">
          </div>
          <div class="admin-field">
            <label>Mensaje</label>
            <textarea id="sendAllBody" rows="2" placeholder="Escribe el mensaje…"></textarea>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button class="admin-btn admin-btn-primary" id="sendAllBtn">${UI.send} Enviar a todos</button>
            <span class="admin-btn-note">Requiere VAPID configurado en el servidor</span>
          </div>
          <div class="notif-result" id="sendAllResult"></div>
        </div>
      </section>
    `;

    // Estado real del canal local
    const stateEl = page.querySelector('#testPushState');
    const reasons = [];
    if (!isEnabled()) reasons.push('notificaciones apagadas');
    if ('Notification' in window && Notification.permission !== 'granted') reasons.push(`permiso: ${Notification.permission}`);
    if (!('serviceWorker' in navigator)) reasons.push('sin service worker');
    if (stateEl) stateEl.textContent = reasons.length ? `Estado: ${reasons.join(' · ')}` : 'Estado: canal listo';

    page.querySelector('#testPushBtn')?.addEventListener('click', async () => {
      const btn = page.querySelector('#testPushBtn');
      const result = page.querySelector('#notifResult');
      btn.disabled = true;
      result.innerHTML = '';
      try {
        const ok = await showDailyNotification('📣 Personal Hub', 'El panel de administración funciona correctamente 🎉', '/');
        result.innerHTML = ok
          ? '<div class="notif-ok">✓ Notificación mostrada en este dispositivo.</div>'
          : '<div class="notif-err">✗ No se pudo mostrar: activa las notificaciones en Perfil y concede el permiso del navegador.</div>';
      } catch (err) {
        result.innerHTML = `<div class="notif-err">✗ ${esc(err?.message || 'Error al enviar la notificación')}</div>`;
      } finally {
        btn.disabled = false;
      }
    });

    page.querySelector('#sendAllBtn')?.addEventListener('click', async () => {
      const btn = page.querySelector('#sendAllBtn');
      const result = page.querySelector('#sendAllResult');
      const title = page.querySelector('#sendAllTitle')?.value?.trim() || 'Personal Hub 💌';
      const body = page.querySelector('#sendAllBody')?.value?.trim();
      if (!body) { result.innerHTML = '<div class="notif-err">✗ Escribe un mensaje para enviar.</div>'; return; }
      btn.disabled = true;
      result.innerHTML = '<div class="muted-text">Enviando…</div>';
      try {
        const { data: { session } } = await (await import('../services/supabase.js')).supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sesión no disponible');
        const res = await fetch('/api/push?action=send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ title, body })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        const n = data?.sent || 0;
        result.innerHTML = `<div class="notif-ok">✓ Enviado a ${n} dispositivo${n === 1 ? '' : 's'}${data?.removed ? ` (${data.removed} expirados eliminados)` : ''}.</div>`;
      } catch (err) {
        result.innerHTML = `<div class="notif-err">✗ ${esc(err?.message || 'Error al enviar')}. En desarrollo (/api/push) no está disponible: solo funciona en Vercel.</div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ==========================================
  // 6. ACTIVIDAD
  // ==========================================
  async function loadActividad() {
    const token = sectionToken;
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.activity} Registro de Actividad</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="admin-btn-ghost" id="refreshActivity" title="Actualizar">${UI.refresh}</button>
          </div>
        </div>
        <div class="admin-toolbar">
          <span class="admin-filter-icon">${UI.filter}</span>
          <select class="admin-select" id="activityFilter">
            <option value="all">Todas las acciones</option>
          </select>
          <span class="admin-count-badge" id="activityCount"></span>
        </div>
        <div class="admin-list" id="activityList">${skeletonCard('48px')}${skeletonCard('48px')}${skeletonCard('48px')}</div>
      </section>
    `;

    let allEntries = [];

    function renderActivity() {
      const filter = page.querySelector('#activityFilter')?.value || 'all';
      const filtered = filter === 'all' ? allEntries : allEntries.filter(e => e.action === filter);
      const list = page.querySelector('#activityList');
      const count = page.querySelector('#activityCount');
      if (count) count.textContent = `${filtered.length} de ${allEntries.length}`;
      if (!list) return;
      if (!filtered.length) {
        list.innerHTML = '<div class="admin-empty">No hay actividad para este filtro</div>';
        return;
      }
      list.innerHTML = filtered.map(e => {
        const time = e.timestamp ? new Date(e.timestamp).toLocaleString('es') : '';
        return `<div class="admin-activity-item">
          <div class="admin-activity-dot"></div>
          <div class="admin-activity-body">
            <div class="admin-activity-action">${esc(db.formatAction(e.action))}</div>
            <div class="admin-activity-details">${esc(e.details||'')} · ${time}</div>
          </div>
        </div>`;
      }).join('');
    }

    allEntries = await db.getActivity(100);
    if (token !== sectionToken) return; // se cambió de sección mientras cargaba

    // Poblar el filtro con los tipos presentes
    const types = [...new Set(allEntries.map(e => e.action))];
    const filterEl = page.querySelector('#activityFilter');
    if (filterEl && types.length) {
      filterEl.innerHTML = '<option value="all">Todas las acciones</option>' +
        types.map(t => `<option value="${esc(t)}">${esc(db.formatAction(t))}</option>`).join('');
      filterEl.addEventListener('change', renderActivity);
    }
    page.querySelector('#refreshActivity')?.addEventListener('click', async () => {
      allEntries = await db.getActivity(100);
      renderActivity();
      showToast('Actividad actualizada', 'success');
    });
    renderActivity();
  }

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  async function loadConfiguracion() {
    const token = sectionToken;
    const themeState = theme.currentTheme || 'dark';
    const notifEnabled = isEnabled();
    const pushOk = isPushSupported();
    const account = userStore.getUser();
    const hubDates = await db.getHubDates();

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.settings} Configuración</h2>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Apariencia</h4></div>
            <p class="muted-text">El tema se aplica en toda la web y se recuerda en este navegador.</p>
            <div class="admin-seg" id="themeSeg">
              ${[{ id: 'dark', label: '🌙 Oscuro' }, { id: 'light', label: '☀️ Claro' }, { id: 'auto', label: '🖥️ Auto' }]
                .map(t => `<button type="button" class="admin-seg-btn${themeState === t.id ? ' active' : ''}" data-theme-set="${t.id}">${t.label}</button>`).join('')}
            </div>
          </div>

          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Notificaciones</h4></div>
            <p class="muted-text">El recordatorio diario se envía a las 8:00 (hora de España) a los dispositivos suscritos.</p>
            <div class="notif-status-grid">
              <div class="notif-status-card">
                <span class="notif-status-icon ${pushOk ? 'ok' : 'muted'}">${UI.bell}</span>
                <div><strong>${pushOk ? 'Web Push compatible' : 'Push no disponible'}</strong><div class="muted-text">Este navegador puede recibir notificaciones</div></div>
              </div>
              <div class="notif-status-card">
                <span class="notif-status-icon ${notifEnabled ? 'ok' : 'muted'}">${UI.check}</span>
                <div><strong>${notifEnabled ? 'Activadas' : 'Apagadas'}</strong><div class="muted-text">Estado de tu suscripción</div></div>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
              ${notifEnabled
                ? `<button class="admin-btn admin-btn-secondary" id="disableNotifBtn">Apagar notificaciones</button>`
                : `<button class="admin-btn admin-btn-primary" id="enableNotifBtn">${UI.bell} Activar notificaciones</button>`}
              <button class="admin-btn admin-btn-ghost" id="testNotifBtn">Enviar prueba</button>
            </div>
            <div class="notif-result" id="configNotifResult"></div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Base de datos</h4></div>
            <div id="configDbStatus">${skeletonText()}</div>
            <button class="admin-btn admin-btn-ghost" id="recheckDbBtn" style="margin-top:12px">${UI.refresh} Comprobar de nuevo</button>
          </div>

          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Cuenta</h4></div>
            <div class="admin-profile-row">
              <div class="admin-sidebar-avatar">${userPhoto ? `<img src="${esc(userPhoto)}" alt="">` : userInitial}</div>
              <div>
                <strong>${esc(account?.name || userName)}</strong>
                <div class="muted-text">${esc(account?.email || '')}</div>
              </div>
              <span class="admin-sidebar-admin-badge">ADMIN</span>
            </div>
            <p class="muted-text" style="margin-top:14px">Hora base: <strong>España (península)</strong> · ahora son las ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>Fechas especiales</h4></div>
          <p class="muted-text">Estas fechas alimentan las métricas del dashboard: «Años juntos», «En el Hub», el cumpleaños y el primer mensaje.</p>
          <div class="dates-editor">
            <label class="dates-field">
              <span>🤍 Aniversario</span>
              <input type="date" id="dateAnniversary" value="${esc(hubDates.anniversary)}">
            </label>
            <label class="dates-field">
              <span>📅 Inicio del Hub / primer mensaje</span>
              <input type="date" id="dateHubStart" value="${esc(hubDates.hubStart)}">
            </label>
            <label class="dates-field">
              <span>🎁 Cumpleaños</span>
              <input type="date" id="dateBirthday" value="${esc(hubDates.birthday)}">
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
            <button class="admin-btn admin-btn-primary" id="saveDatesBtn">${UI.check} Guardar fechas</button>
            <div class="muted-text" id="datesSavedHint"></div>
          </div>
        </div>
      </section>
    `;

    if (token !== sectionToken) return;

    // ---- Tema ----
    page.querySelectorAll('[data-theme-set]').forEach(btn => {
      btn.addEventListener('click', () => {
        theme.setTheme(btn.dataset.themeSet);
        page.querySelectorAll('[data-theme-set]').forEach(b => b.classList.toggle('active', b === btn));
        showToast(`Tema: ${btn.dataset.themeSet}`, 'success');
      });
    });

    // ---- Notificaciones ----
    const notifResult = page.querySelector('#configNotifResult');
    page.querySelector('#enableNotifBtn')?.addEventListener('click', async () => {
      const ok = await requestEnable();
      notifResult.innerHTML = ok
        ? '<div class="notif-ok">✓ Notificaciones activadas en este dispositivo.</div>'
        : '<div class="notif-err">No se concedió el permiso. Revisa los permisos del navegador.</div>';
      loadConfiguracion();
    });
    page.querySelector('#disableNotifBtn')?.addEventListener('click', async () => {
      await disable();
      showToast('Notificaciones apagadas', 'success');
      loadConfiguracion();
    });
    page.querySelector('#testNotifBtn')?.addEventListener('click', async () => {
      const ok = await showDailyNotification('📣 Personal Hub', 'Prueba desde Configuración', '/');
      notifResult.innerHTML = ok
        ? '<div class="notif-ok">✓ Notificación mostrada en este dispositivo.</div>'
        : '<div class="notif-err">No se pudo mostrar: activa las notificaciones y concede el permiso.</div>';
    });

    // ---- Fechas especiales ----
    page.querySelector('#saveDatesBtn')?.addEventListener('click', async () => {
      const anniversary = page.querySelector('#dateAnniversary').value;
      const hubStart = page.querySelector('#dateHubStart').value;
      const birthday = page.querySelector('#dateBirthday').value;
      if (!anniversary || !hubStart || !birthday) {
        showToast('Rellena las tres fechas', 'error');
        return;
      }
      try {
        const saved = await db.saveHubDates({ anniversary, hubStart, birthday });
        showToast('Fechas especiales guardadas', 'success');
        const hint = page.querySelector('#datesSavedHint');
        if (hint) hint.textContent = `Aniversario ${saved.anniversary} · Hub ${saved.hubStart} · Cumple ${saved.birthday}`;
      } catch (err) {
        console.error('[admin] No se pudieron guardar las fechas:', err);
        showToast(err?.message || 'No se pudieron guardar las fechas', 'error');
      }
    });

    // ---- Base de datos ----
    const dbStatusEl = page.querySelector('#configDbStatus');
    const renderDb = async () => {
      const status = await db.checkConnection();
      dbStatusEl.innerHTML = status.ok
        ? `<div class="notif-status-card"><span class="notif-status-icon ok">${UI.check}</span><div><strong>Supabase conectado</strong><div class="muted-text">Los cambios se guardan y se sincronizan entre dispositivos.</div></div></div>`
        : `<div class="notif-status-card"><span class="notif-status-icon muted">⚠️</span><div><strong>Modo local</strong><div class="muted-text">${esc(status.message || 'Sin conexión a Supabase.')} Los datos se guardan solo en este navegador.</div></div></div>`;
    };
    renderDb();
    page.querySelector('#recheckDbBtn')?.addEventListener('click', renderDb);
  }

  // ==========================================
  // DB CONNECTION STATUS
  // ==========================================
  async function renderDbStatus() {
    const banner = page.querySelector('#adminDbStatus');
    if (!banner) return;
    const status = await db.checkConnection();
    if (status.ok) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'block';
      banner.innerHTML = status.mode === 'supabase'
        ? `<strong>⚠️ Base de datos no disponible</strong> — ${status.message}<br>
           <small>Los cambios se guardarán solo en este navegador hasta que se arregle el permiso en Supabase.</small>`
        : `<strong>️ Modo local</strong> — ${status.message}`;
    }
    // Pill de conexión en la sidebar
    const pill = page.querySelector('#adminConnPill');
    if (pill) {
      pill.textContent = status.ok ? '● Supabase' : '● Modo local';
      pill.classList.toggle('ok', !!status.ok);
      pill.title = status.message || '';
    }
  }

  // ==========================================
  // INIT
  // ==========================================
  renderDbStatus();
  loadSection('dashboard');

  return page;
}
