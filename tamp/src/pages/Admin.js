/* ==========================================
   Personal Hub v2 — Admin Panel
   Dashboard · Estados de Ánimo · Usuarios ·
   Contenido · Actividad
   ========================================== */

import '../styles/admin.css';
import { db, UPLOAD_LIMITS } from '../services/db.service.js';
import {
  loadCatalog, loadFavorites,
  createId, getSeasons, getTotal, removeCatalogItem
} from '../services/seriesData.js';
import { seasonEditorHTML, collectSeasons, emptySeasonHTML, bindSeasonEditorEvents } from '../services/seriesEditor.js';
import { defaultCatalog } from '../data/series-seed.js';
import { userStore } from '../stores/user.store.js';
import { moodStore } from '../stores/mood.store.js';
import { showToast } from '../components/Toast.js';
import { openSpecialEventSheet, replaySpecialEventSheet } from '../components/SpecialEventSheet.js';
import { decorOptions, videoModeOptions, THEME_EMOJIS, MAX_GALLERY, MAX_EMOJIS } from '../utils/celebration.js';
import { escapeHtml } from '../utils/escape.js';
import { labelForPath } from '../routes.js';
import { isValidUrlField, todayISO, hourInSpain, timeInSpain } from '../utils/format.js';
import {
  buildSessions, sectionUsage, userUsage, sessionSummary,
  hourlyHeatmap, dayParts, streaks, uniqueDays, shiftStatsDay, statsDay,
  openWhenReadIds, isOpenWhenReadVisit
} from '../utils/stats-metrics.js';
import { dailyCounts, dashboardDates, latestDailyMoods, publishedLetterIds } from '../utils/dashboard-metrics.js';
import { refreshSpecialDates, loadSpecialDates, seasonalEvents, specialEventsToday, daysUntilDate, isValidMonthDay, SPECIAL_EVENT_TONES, FIXED_EVENT_FIELDS, eventTemplateFor, EVENT_TEMPLATES } from '../utils/specialDates.js';
import { cleanEventActions, MAX_EVENT_ACTIONS } from '../utils/event-actions.js';
import { isPushSupported, isEnabled, showDailyNotification, requestEnable, disable } from '../services/notifications.service.js';
import {
  listReminders, createReminder, updateReminder, toggleReminder, deleteReminder,
  runReminder, localInputToIso, isoToLocalInput, formatReminderDate
} from '../services/reminders.service.js';
import { expandCalendarCatalog } from '../data/calendar-expansion.js';
import { theme } from '../services/theme.service.js';
import { CATEGORIES, TYPE_META, LETTERS } from '../data/openwhen.data.js';
import {
  fileKind, kindLabel, formatBytes
} from '../services/cloudinary.service.js';
import { visiblePhotos, baseFolders } from '../services/galleryData.js';
import { onMoodChange } from '../services/realtime.service.js';

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
  palette: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h4.5A3.5 3.5 0 0 0 21 8.5C21 5.5 17 3 12 3z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/></svg>',
  spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3.5 13.8 8.7 19 10.5l-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2-5.6-3.1-5.6 3.1 1.2-6.2L3 9.5l6.3-.8z"/></svg>',
  calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  back: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
};

// ==========================================
// MOOD CONSTANTS
// El catálogo vive en mood.store (actual + antiguo). Este archivo no
// vuelve a declararlo: si se duplica, las gráficas se desincronizan del
// historial en cuanto se añade un estado nuevo.
// ==========================================
// Orden de las barras: catálogo vigente, emoción escrita a mano e histórico.
const MOOD_ORDER = [...moodStore.getMoods(), moodStore.getCustomMood(), ...(moodStore.getLegacyMoods() || [])].map(m => m.id);

// La emoción escrita a mano se agrupa POR SU TEXTO, no toda bajo «Otras»: en
// el panel tiene que leerse lo que escribió ella. Estas claves solo existen
// aquí (en la base de datos la fila sigue usando el id `custom`).
const MOOD_CUSTOM_PREFIX = 'custom:';
const moodAggKey = (item) => (item?.id === moodStore.getCustomMood().id ? `${MOOD_CUSTOM_PREFIX}${item.label}` : item?.id);

const moodInfo = (key) => {
  if (typeof key === 'string' && key.startsWith(MOOD_CUSTOM_PREFIX)) {
    const custom = moodStore.getCustomMood();
    return { emoji: custom.emoji, label: key.slice(MOOD_CUSTOM_PREFIX.length), score: custom.score, custom: true };
  }
  return moodStore.resolveMood({ mood: key }) || { emoji: '—', label: String(key || '—'), score: 0 };
};

/** Posición de una clave en las barras: catálogo → textos libres → histórico. */
const moodRank = (key) => {
  const idx = MOOD_ORDER.indexOf(key);
  if (idx >= 0) return idx;
  const customIdx = MOOD_ORDER.indexOf(moodStore.getCustomMood().id);
  return (customIdx >= 0 ? customIdx : MOOD_ORDER.length) + 0.5;
};

/** Clase de color de la barra: las emociones escritas comparten el tono de «Otras». */
const moodBarClass = (key) => (typeof key === 'string' && key.startsWith(MOOD_CUSTOM_PREFIX) ? 'custom' : key);

/**
 * Emociones de una fila de `moods`. Una fila puede traer varias codificadas
 * («triste|cansada»), así que las estadísticas cuentan cada una por separado
 * en vez de inventar un estado combinado que no existe en el catálogo.
 */
const moodRowItems = (row) => moodStore.resolveMood({
  mood: row?.mood,
  label: row?.label,
  emoji: row?.emoji,
  score: row?.score
})?.items || [];

// El resumen y el historial de ánimo comparten el filtro de cuenta.
const STATS_ALL = 'all';
const STATS_USER_PREF = 'ph.admin.statsUser';
let statsUserId = (() => {
  try { return localStorage.getItem(STATS_USER_PREF) || ''; }
  catch { return ''; }
})();
function setStatsUser(id) {
  statsUserId = id || STATS_ALL;
  try { localStorage.setItem(STATS_USER_PREF, statsUserId); } catch { /* sin almacenamiento */ }
}

function statsUserOptions(users = []) {
  return arr(users)
    .filter(user => user?.id && !user.id.startsWith('local_') && !/^listen-test/i.test(user.email || user.name || ''))
    .map(user => ({
      id: user.id,
      label: user.name || user.email?.split('@')[0] || 'Cuenta sin nombre',
      principal: user.role !== 'admin' && user.enabled !== false,
    }));
}

function statsUserSelectHTML(users, id = 'statsUserSelect') {
  const options = statsUserOptions(users);
  const opts = [{ id: STATS_ALL, label: 'Todos los usuarios' }, ...options];
  if (users == null && statsUserId && statsUserId !== STATS_ALL) {
    opts.push({ id: statsUserId, label: 'Cuenta seleccionada' });
  } else if (!opts.some(option => option.id === statsUserId)) {
    statsUserId = options.find(option => option.principal)?.id || STATS_ALL;
  }
  return `<select class="dash-range-select" id="${id}" aria-label="Usuario de las estadísticas">
    ${opts.map(o => `<option value="${escapeHtml(o.id)}"${o.id === statsUserId ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
  </select>`;
}
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ==========================================
// ACTIVIDAD DE USO — helpers compartidos
// (dashboard y detalle de usuario)
// Los nombres de las secciones salen del registro de rutas (labelForPath),
// no de una lista paralela que se quedaba corta al añadir una página.
// ==========================================

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

// Navegación del panel: accesos horizontales a todas las secciones.
const NAV_GROUPS = [
  {
    label: 'Principal',
    hint: 'Lo del día a día',
    items: [
      { id: 'dashboard',  icon: UI.dash,     label: 'Dashboard' },
      { id: 'contenido',  icon: UI.content,  label: 'Contenido' },
      { id: 'multimedia', icon: UI.cloud,    label: 'Multimedia' }
    ]
  },
  {
    label: 'Personas',
    hint: 'Quién y cómo está',
    items: [
      { id: 'moods',    icon: UI.smile, label: 'Ánimo' },
      { id: 'usuarios', icon: UI.users, label: 'Usuarios' }
    ]
  },
  {
    label: 'Herramientas',
    hint: 'Avisos, registro y ajustes',
    items: [
      { id: 'notificaciones', icon: UI.bell,     label: 'Notificaciones' },
      { id: 'recordatorios',  icon: UI.calendar, label: 'Recordatorios' },
      { id: 'actividad',      icon: UI.activity, label: 'Actividad' },
      { id: 'config',         icon: UI.settings, label: 'Configuración' }
    ]
  }
];

// Todas las secciones en el orden en que aparecen en el menú.
const SECTIONS = NAV_GROUPS.flatMap(g => g.items);
const sectionInfo = (id) => SECTIONS.find(s => s.id === id) || { id, label: id, icon: '' };

// Los ids que un aviso puede pedir por URL (`/admin?section=moods`,
// `/admin?section=contenido&sub=maldia`). Salen de las mismas listas que pinta
// el menú, así que no hay una segunda copia que se pueda quedar atrás. El
// servidor guarda la suya (es otro proceso) y un test exige que coincidan.
export const ADMIN_SECTION_IDS = SECTIONS.map(s => s.id);
export const ADMIN_CONTENT_SUB_IDS = CONTENT_SUBS.map(s => s.id);

// Una línea de orientación bajo cada título: en cuanto hay ocho
// secciones, saber qué hace cada una sin abrirla ahorra mucho ir y venir.
const SECTION_HINTS = {
  dashboard:      'Lo esencial del hub de un vistazo y un salto a cada sección.',
  contenido:      'Razones, canciones, regalos, noticias, mal día, series, Open When y audios.',
  multimedia:     'Sube cada archivo desde aquí: va directo a Galería, Memes o Audios y aparece en la app al momento.',
  moods:          'Cómo se ha sentidos cada día, mes a mes.',
  usuarios:       'Quién entra, cuándo y qué mira.',
  notificaciones: 'Avisos del hub y notificaciones push.',
  recordatorios:  'Avisos programados que envía el servidor, aunque nadie tenga la app abierta.',
  actividad:      'Registro completo de lo que va pasando.',
  config:         'Apariencia, fechas especiales y base de datos.'
};

// Las plantillas de una bienvenida viven en utils/event-templates.js: nombre,
// tono, emoji y composición salen de ahí para el editor y para la hoja, y así
// no pueden desincronizarse.

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

  // El shell mide el contenido como una página de lectura (columna de 880 px).
  // Un panel de gestión con menú lateral se queda sin sitio para las
  // rejillas, así que se le pide más ancho mientras está montado y se
  // devuelve al navegar (cleanup).
  const appShell = document.getElementById('app');
  appShell?.classList.add('has-admin');

  const esc = escapeHtml;
  const user = userStore.getUser();
  const userName = user?.name || 'Peluche';
  const userInitial = userName.charAt(0).toUpperCase();
  const userPhoto = user?.avatar || user?.photo || '';
  const userRole = user?.role || 'admin';

  // Time-based greeting (hora de España, península)
  const greetingFor = (h) => ({
    text: h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches',
    emoji: h < 12 ? '☀️' : h < 19 ? '🌤️' : '🌙'
  });
  const { text: greeting, emoji: greetingEmoji } = greetingFor(hourInSpain());

  const navHTML = SECTIONS.map(item => `
    <button type="button" class="admin-section-tab" data-section="${item.id}">
      ${item.icon}<span>${item.label}</span>
    </button>`).join('');

  page.innerHTML = `
    <div class="admin-layout">
      <main class="admin-main">
        <header class="admin-topbar">
          <div class="admin-topbar-title" id="adminTopTitle">${UI.dash}<span>Dashboard</span></div>
          <div class="admin-topbar-actions">
            <span class="admin-time-badge" id="adminTimeBadge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span id="adminTimeText"></span>
            </span>
            <span class="admin-time-badge admin-date-badge" id="adminDateBadge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span id="adminDateText"></span>
            </span>
          </div>
        </header>
        <nav class="admin-section-nav" id="adminSectionNav" aria-label="Secciones del panel">
          <div class="admin-section-nav__track">${navHTML}</div>
        </nav>
        <div class="admin-welcome" id="adminWelcome">
          <div class="admin-welcome-greeting">
            <h1 id="adminGreeting">${greeting}, ${esc(userName)} ${greetingEmoji}</h1>
            <div class="admin-welcome-sub">
              <span>Aquí tienes un resumen de tu Personal Hub.</span>
            </div>
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
      <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle" tabindex="-1">
        <div class="admin-modal-header">
          <h3 id="adminModalTitle"></h3>
          <button type="button" class="admin-modal-close" id="adminModalClose" aria-label="Cerrar">${UI.close}</button>
        </div>
        <div class="admin-modal-body" id="adminModalBody"></div>
        <p class="admin-modal-error" id="adminModalError" role="alert" hidden></p>
        <div class="admin-modal-footer">
          <button type="button" class="admin-btn admin-btn-secondary" id="adminModalCancel">Cancelar</button>
          <button type="button" class="admin-btn admin-btn-primary" id="adminModalSave">${UI.check} Guardar</button>
        </div>
      </div>
    </div>
  `;

  // ===== STATE =====
  const [initialYear, initialMonth] = todayISO().split('-').map(Number);
  const S = {
    section: 'dashboard',
    moodDate: new Date(initialYear, initialMonth - 1, 1),
    moodMonthData: null,
    contentSub: 'razones',
    calMonth: null,
    calDay: null,
    configTab: 'eventos',
  };

  const content = page.querySelector('#adminContent');

  // Live clock. El saludo también se refresca: si el panel queda abierto
  // cruzar las 12:00 o las 19:00, "buenas noches" se quedaba obsoleto.
  const timeText = page.querySelector('#adminTimeText');
  const greetingEl = page.querySelector('#adminGreeting');
  const dateText = page.querySelector('#adminDateText');
  const dateFormat = new Intl.DateTimeFormat('es', {
    timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric',
  });
  const updateClock = () => {
    if (timeText) timeText.textContent = timeInSpain();
    if (dateText) dateText.textContent = dateFormat.format();
    if (greetingEl) {
      const g = greetingFor(hourInSpain());
      greetingEl.textContent = `${g.text}, ${userName} ${g.emoji}`;
    }
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 30000);

  // ===== NAV =====
  // La fila de secciones se mantiene visible y sincronizada con cualquier
  // acceso del dashboard, para saltar de vista sin abrir un cajón lateral.
  const welcomeBox = page.querySelector('#adminWelcome');
  const topTitle = page.querySelector('#adminTopTitle');
  const topbar = page.querySelector('.admin-topbar');

  // Arriba del todo el título de la sección está justo debajo en el
  // encabezado, y repetirlo solo ruido. En cuanto se hace scroll (donde el
  // encabezado ya no se ve) aparece, y en móvil, donde el menú está
  // cerrado, siempre.
  // El scroll no lo lleva la ventana: lo lleva el contenedor .main del shell, y
  // el evento de scroll no burbujea. Se escucha en fase de captura sobre
  // document para que funcione llegue cuando se haya montado o no, y se lee
  // .main en el momento en vez de cachearlo (aún no existe al crearse).
  const onTopScroll = () => {
    const top = page.closest('.main')?.scrollTop ?? window.scrollY;
    topbar?.classList.toggle('is-scrolled', top > 24);
  };
  document.addEventListener('scroll', onTopScroll, { passive: true, capture: true });
  onTopScroll();

  /**
   * Deja el panel orientado a una sección: marca su botón del menú, pone el
   * título en la cabecera pegajosa y esconde el saludo (que solo tiene sentido
   * en el resumen) para que las demás secciones no repitan la bienvenida.
   */
  function activateNav(section) {
    const known = !!page.querySelector(`.admin-section-tab[data-section="${section}"]`);
    const id = known ? section : 'dashboard';
    page.querySelectorAll('.admin-section-tab').forEach(button => {
      const active = button.dataset.section === id;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (topTitle) topTitle.innerHTML = `${sectionInfo(id).icon}<span>${sectionInfo(id).label}</span>`;
    if (welcomeBox) welcomeBox.classList.toggle('is-hidden', id !== 'dashboard');
  }

  function setActiveSection(btn, section) {
    if (modal.busy) return;
    modal.close();
    loadSection(section);
    // En móvil, desplaza la fila horizontal hasta dejar visible la sección.
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  page.querySelectorAll('.admin-section-tab').forEach(item => {
    item.addEventListener('click', () => setActiveSection(item, item.dataset.section));
  });

  // ===== MODAL =====
  const modal = {
    el: page.querySelector('#adminModal'),
    dialog: page.querySelector('#adminModal .admin-modal'),
    title: page.querySelector('#adminModalTitle'),
    body: page.querySelector('#adminModalBody'),
    error: page.querySelector('#adminModalError'),
    saveBtn: page.querySelector('#adminModalSave'),
    cancelBtn: page.querySelector('#adminModalCancel'),
    closeBtn: page.querySelector('#adminModalClose'),
    _currentOnSave: null,
    busy: false,
    returnFocus: null,

    get visible() { return this.el.style.display === 'flex'; },

    open(title, bodyHtml, onSave, saveLabel) {
      if (this.busy || disposed) return;
      if (!this.visible) this.returnFocus = document.activeElement;
      this.title.textContent = title;
      this.body.innerHTML = bodyHtml;
      this.el.style.display = 'flex';
      this._currentOnSave = onSave || null;
      this.error.hidden = true;
      this.error.textContent = '';
      this.saveBtn.closest('.admin-modal-footer').style.display = onSave ? 'flex' : 'none';
      this.saveBtn.disabled = false;
      const isDanger = saveLabel === 'Eliminar';
      this.saveBtn.classList.toggle('admin-btn-danger', isDanger);
      this.saveBtn.innerHTML = `${UI.check} ${saveLabel || 'Guardar'}`;
      this.dialog.focus({ preventScroll: true });
    },

    close() {
      if (this.busy || !this.visible) return;
      this.el.style.display = 'none';
      this._currentOnSave = null;
      this.saveBtn.classList.remove('admin-btn-danger');
      if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
      this.returnFocus = null;
    },

    async save() {
      if (this.busy || !this._currentOnSave) return;
      const token = sectionToken;
      const originalButton = this.saveBtn.innerHTML;
      this.busy = true;
      this.error.hidden = true;
      for (const button of [this.saveBtn, this.cancelBtn, this.closeBtn]) button.disabled = true;
      this.dialog.setAttribute('aria-busy', 'true');
      this.saveBtn.textContent = 'Guardando...';
      let result = false;
      try {
        result = await this._currentOnSave();
      } catch (err) {
        if (isCurrentSection(token)) {
          this.error.textContent = err?.message || 'No se pudo guardar. Inténtalo de nuevo.';
          this.error.hidden = false;
        }
      } finally {
        this.busy = false;
        this.dialog.removeAttribute('aria-busy');
        for (const button of [this.saveBtn, this.cancelBtn, this.closeBtn]) button.disabled = false;
        this.saveBtn.innerHTML = originalButton;
      }
      if (result === false || disposed) return;
      this.close();
      if (result === true || !isCurrentSection(token)) return;
      loadSection(S.section);
      showToast('Guardado', 'success');
    }
  };

  modal.cancelBtn.addEventListener('click', () => modal.close());
  modal.closeBtn.addEventListener('click', () => modal.close());
  modal.el.addEventListener('click', (e) => { if (e.target === modal.el) modal.close(); });
  modal.saveBtn.addEventListener('click', () => modal.save());

  // Escape key closes modal
  const escapeHandler = (e) => {
    if (!modal.visible) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      modal.close();
    } else if (e.key === 'Tab') {
      const controls = Array.from(modal.dialog.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
      )).filter(control => control.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      const focused = document.activeElement;
      if (!first || !controls.includes(focused) || (e.shiftKey ? focused === first : focused === last)) {
        e.preventDefault();
        (e.shiftKey ? last || modal.dialog : first || modal.dialog).focus();
      }
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Cleanup on navigation
  page.cleanup = () => {
    disposed = true;
    sectionToken++;
    appShell?.classList.remove('has-admin');
    document.removeEventListener('keydown', escapeHandler);
    document.removeEventListener('scroll', onTopScroll, true);
    clearInterval(clockInterval);
    clearInterval(readRefreshTimer);
    clearTimeout(moodRefreshTimer);
    stopMoodRefresh();
    document.removeEventListener('visibilitychange', refreshVisibleSection);
    window.removeEventListener('online', refreshVisibleSection);
  };

  // ===== SECTION LOADER =====
  // Token de sección: si el usuario cambia de pestaña del admin mientras una
  // carga async está en curso, la escritura del DOM obsoleto se aborta.
  // Evita el crash "Cannot set properties of null (setting 'innerHTML')".
  let sectionToken = 0;
  let disposed = false;
  // Token por render de Ánimos: dos clics rápidos en ‹ › lanzan renders
  // solapados; el último clic debe ganar aunque resuelva antes el anterior.
  let moodRenderToken = 0;
  let moodWeekRenderToken = 0;
  let moodNavigationToken = 0;
  let activeRefresh = null;
  let refreshRequest = null;
  let moodRefreshTimer;
  const READ_REFRESH_MS = 120000;
  const isCurrentSection = token => !disposed && token === sectionToken;

  function refreshVisibleSection() {
    if (disposed || document.visibilityState !== 'visible') return;
    updateClock();
    void renderDbStatus().catch(() => {});
    if (modal.visible || (refreshRequest?.token === sectionToken)) return;
    const run = S.section === 'dashboard'
      ? () => loadDashboard({ background: true })
      : activeRefresh;
    if (!run) return;
    const token = sectionToken;
    const pending = { token };
    refreshRequest = pending;
    void Promise.resolve().then(() => {
      if (isCurrentSection(token)) return run();
    }).catch(err => console.warn('[admin] Actualización fallida:', err?.message)).finally(() => {
      if (refreshRequest === pending) refreshRequest = null;
    });
  }

  const readRefreshTimer = setInterval(refreshVisibleSection, READ_REFRESH_MS);
  document.addEventListener('visibilitychange', refreshVisibleSection);
  window.addEventListener('online', refreshVisibleSection);
  const stopMoodRefresh = onMoodChange(() => {
    if (S.section !== 'dashboard' && S.section !== 'moods') return;
    clearTimeout(moodRefreshTimer);
    moodRefreshTimer = setTimeout(refreshVisibleSection, 350);
  });

  function loadSection(section) {
    if (disposed) return;
    const token = ++sectionToken;
    activeRefresh = null;
    S.section = section;
    // Toda entrada a una sección pasa por aquí, así que el menú y la
    // cabecera se orientan solos venga de donde venga (menú, accesos,
    // atajos o el guardado de un modal, que recarga la sección actual).
    activateNav(section);
    const loaders = {
      dashboard: loadDashboard, moods: loadMoods,
      usuarios: loadUsuarios, contenido: loadContenido,
      multimedia: loadMultimedia,
      notificaciones: loadNotificaciones,
      recordatorios: loadRecordatorios,
      actividad: loadActividad,
      config: loadConfiguracion
    };
    void Promise.resolve().then(() => {
      if (isCurrentSection(token)) return loaders[section]?.();
    }).catch(error => {
      if (!isCurrentSection(token)) return;
      content.innerHTML = `<section class="admin-section active">
        <div class="admin-section-header"><h2>${sectionInfo(section).icon} ${sectionInfo(section).label}</h2></div>
        <div class="admin-empty" role="alert">${esc(error?.message || 'No se pudo cargar esta sección.')}</div>
        <button type="button" class="admin-btn admin-btn-secondary" data-admin-retry>Reintentar</button>
      </section>`;
      content.querySelector('[data-admin-retry]')?.addEventListener('click', () => loadSection(section));
    });
  }

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  // Nota dejada desde la sección Mal Día: la misma tarjeta se usa en el
  // resumen y en Contenido → Mal Día para que no haya dos formatos.
  function maldiaNoteCardHtml(n) {
    const who = n.email || (n.userId ? String(n.userId).slice(0, 8) : 'Ella');
    const when = n.createdAt
      ? new Date(n.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="gift-response">
            <div class="gift-response__meta">${esc(who)}${when ? ` · ${esc(when)}` : ''}</div>
            <div class="gift-response__text">${esc(n.text || '—')}</div>
          </div>`;
  }

  let dashboardRender = 0;
  let dashboardPeriod = 30;
  let dashboardMetric = 'visits';

  async function loadDashboard({ background = false } = {}) {
    const token = sectionToken;
    const render = ++dashboardRender;
    const current = () => isCurrentSection(token) && render === dashboardRender;
    if (!background || !content.querySelector('.dash-now')) {
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.dash} Resumen general</h2></div>
        <p class="admin-section-hint">${SECTION_HINTS.dashboard}</p>
        <div class="admin-panel dash-go-panel">
          <div class="admin-panel-head"><h4>Ir a</h4></div>
          <div class="quick-actions">
            ${'<div class="quick-action skeleton-card"></div>'.repeat(4)}
          </div>
          <div class="dash-go">
            <span class="dash-go-label">Atajos de gestión</span>
            <div class="dash-shortcuts">
              ${'<div class="dash-shortcut skeleton-card"></div>'.repeat(6)}
            </div>
          </div>
        </div>
        </section>
    `;

    }
    const today = todayISO();
    const period = dashboardPeriod;
    const from = shiftStatsDay(today, 1 - period);
    const usersResult = await safe(db.readAdminUsers(), null);
    if (!current()) return;
    const users = usersResult?.rows || [];
    const accountSelect = statsUserSelectHTML(usersResult?.rows ?? null);
    const userId = statsUserId === STATS_ALL ? null : statsUserId;

    const [
      reasons, songs, giftsData, audios, news,
      maldiaFrases, maldiaMensajes, owLetters, activityResult, moodsResult, seriesCatalog, visitsResult, maldiaNotes,
      giftResponses, hubDates
    ] = await Promise.all([
      safe(db.getReasons(), null), safe(db.getSongs(), null), safe(db.getGifts(), null),
      safe(db.getAudios(), null), safe(db.getNews(), null),
      safe(db.getMaldiaFrases(), null), safe(db.getMaldiaMensajes(), null), safe(db.getOpenWhenLetters(), null),
      safe(db.readAdminActivity({ limit: 5 }), null), safe(db.readAdminMoods({ from, through: today, userId }), null),
      safe(loadCatalog(), null), safe(db.readAdminVisits({ from, through: today, userId }), null),
      safe(db.getAllMaldiaNotes(), null), safe(db.getAllGiftResponses(), null), safe(db.getHubDates(), null)
    ]);
    if (!current()) return;
    const focused = content.contains(document.activeElement) ? document.activeElement : null;
    const chartDetailsOpen = content.querySelector('.dash-chart-data')?.open;
    const moods = moodsResult?.rows || [];
    const reasonsList = arr(reasons);
    const songsList = arr(songs);
    const newsList = arr(news);
    const maldiaFrasesList = arr(maldiaFrases);
    const maldiaMensajesList = arr(maldiaMensajes);
    const maldiaNotesList = arr(maldiaNotes);
    const owLettersList = arr(owLetters);
    const visitsList = visitsResult?.rows || [];
    // Las marcas de carta Open When abierta no son navegación: se apartan para
    // que no sumen secciones, tiempos ni horas punta.
    const letterReads = openWhenReadIds(visitsList);
    const navVisits = visitsList.filter(v => !isOpenWhenReadVisit(v));
    const giftResponsesMap = (giftResponses && typeof giftResponses === 'object') ? giftResponses : {};
    const audiosList = arr(audios);
    const activityList = activityResult?.rows || [];
    const giftsCount = (giftsData?.gifts || []).length;
    const seriesCount = Array.isArray(seriesCatalog) ? seriesCatalog.length : 0;
    const realUsers = users;
    const partial = [visitsResult, moodsResult, usersResult].some(result => result?.truncated || result?.source === 'local');
    const unavailable = '<p class="admin-data-note" role="status">No se pudo consultar esta fuente. Pulsa Actualizar para reintentar.</p>';
    const sessions = buildSessions(navVisits);

    // ---- Métricas ----
    // Fotos de la galería
    let galleryPhotos = 0;
    try {
      const folders = baseFolders();
      (folders.length ? folders : ['general']).forEach(f => { galleryPhotos += visiblePhotos(f).length; });
    } catch { galleryPhotos = 0; }

    const frases = reasonsList.length + maldiaFrasesList.length;
    const mensajes = frases + maldiaMensajesList.length;

    // ---- Atajos de gestión ----
    // Arriba del resumen. Las tarjetas de métricas se quitaron: contaban
    // cosas que no había que mirar para gestionar, y esos mismos datos
    // siguen vivios en la dona de contenido y en los propios atajos.

    // ---- Serie de los últimos N días (actividad o ánimos, área) ----
    const seriesDays = metric => {
      if (metric === 'mood') return moodsResult ? dailyCounts(today, period, moods, 'date') : null;
      if (!visitsResult) return null;
      return metric === 'sessions' ? dailyCounts(today, period, sessions, 'start') : dailyCounts(today, period, navVisits, 'timestamp');
    };

    // ---- Gráfico de área ----
    // El eje se escalaba con 0.66 / 0.33 del máximo real, así que las
    // líneas de rejilla caían en 4.29 / 8.58 y quedaban irregulares, y los
    // <circle> se deformaban en elipses por el preserveAspectRatio="none".
    // Ahora: escala de paso redondo, curva suave y sin puntos deformados
    // (la lectura fina se hace con la guía + tooltip al pasar el ratón).
    const CHART_METRICS = { visits: 'Visitas', sessions: 'Sesiones estimadas', mood: 'Registros de ánimo' };

    /** Redondea el paso del eje a 1/2/5 x 10^n para que los ticks sean legibles. */
    const niceStep = (raw) => {
      if (!(raw > 0)) return 1;
      const mag = 10 ** Math.floor(Math.log10(raw));
      const norm = raw / mag;
      return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    };

    /** Catmull-Rom -> Bézier. La y de los puntos de control es la de los
     *  nodos, así que la curva nunca se hunde bajo la base ni sobrepasa el pico. */
    const smoothPath = (pts) => {
      const f = (n) => n.toFixed(1);
      if (pts.length < 3) {
        return pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`).join(' ');
      }
      let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        d += ` C${f(c1x)},${f(p1[1])} ${f(c2x)},${f(p2[1])} ${f(p2[0])},${f(p2[1])}`;
      }
      return d;
    };

    const areaChart = (days, metric = dashboardMetric) => {
      if (!days) return unavailable;
      const nombre = CHART_METRICS[metric];
      const W = 540, H = 150, PAD = 12, AXIS = 33;
      const counts = days.map(d => d.count);
      const total = counts.reduce((a, b) => a + b, 0);
      const rawMax = Math.max(...counts, 1);
      const step = Math.max(1, niceStep(rawMax / 4));
      const max = step * 4;
      const stepX = (W - AXIS - PAD) / (days.length - 1 || 1);
      const y = (c) => H - PAD - (c / max) * (H - PAD * 2);
      const pts = days.map((d, i) => [AXIS + i * stepX, y(d.count)]);
      const line = smoothPath(pts);
      const area = `${line} L${W - PAD},${H - PAD} L${AXIS},${H - PAD} Z`;
      const grid = [max, max * 0.75, max * 0.5, max * 0.25, 0];
      const labelsEvery = Math.max(1, Math.ceil(days.length / 6));
      // Marcas de fecha: se descarta la que quede demasiado cerca de la
      // última. Con 0.9 la última pareja conserva margen incluso en móvil,
      // donde "27 sept" y "1 oct" se pegaban.
      const marked = [];
      for (let i = 0; i < days.length; i += labelsEvery) marked.push(i);
      while (marked.length > 1 && (days.length - 1) - marked[marked.length - 1] < labelsEvery * 0.9) {
        marked.pop();
      }
      if (marked[marked.length - 1] !== days.length - 1) marked.push(days.length - 1);

      if (!total) {
        return `
          <div class="dash-area-empty">
            <span aria-hidden="true">📉</span>
            <strong>Sin ${esc(nombre.toLowerCase())} en ${days.length} días</strong>
          </div>`;
      }

      return `
        <div class="dash-area-wrap">
          <svg class="dash-area-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
               aria-label="${esc(nombre)} de los últimos ${days.length} días. Máximo ${rawMax}, total ${total}">
            <defs>
              <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--theme-accent)" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="var(--theme-accent)" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            ${grid.map(g => `<text x="${AXIS - 4}" y="${y(g) + 4}" class="dash-axis-value" text-anchor="end">${g}</text><line x1="${AXIS}" y1="${y(g)}" x2="${W - PAD}" y2="${y(g)}" class="dash-area-grid"/>`).join('')}
            <path d="${area}" fill="url(#dashAreaFill)"/>
            <path d="${line}" fill="none" class="dash-area-line"/>
            <line class="dash-area-guide" x1="0" y1="${PAD}" x2="0" y2="${H - PAD}"/>
            ${days.map((d, i) => {
              const cx = pts[i][0];
              return `<rect class="dash-area-hit" x="${(cx - stepX / 2).toFixed(1)}" y="0"
                            width="${stepX.toFixed(1)}" height="${H}"
                            data-i="${i}" data-x="${cx.toFixed(1)}"/>`;
            }).join('')}
          </svg>
          <div class="dash-area-tip" hidden></div>
        </div>
        <div class="dash-area-foot">
          <span class="dash-area-summary">
            <strong>${total}</strong> ${esc(nombre.toLowerCase())} · máximo diario <strong>${rawMax}</strong>
          </span>
        </div>
        <div class="dash-area-labels">
          ${days.map((d, i) => {
            if (!marked.includes(i)) return '';
            const pct = pts[i][0] / W * 100;
            // El primero y el último se alinean a los bordes para que no
            // se salgan de la caja al traducirlos la mitad.
            const edge = i === 0 ? ' is-first' : i === days.length - 1 ? ' is-last' : '';
            return `<span class="dash-label${edge}" style="left:${pct.toFixed(2)}%">${d.label}</span>`;
          }).join('')}
        </div>
        <details class="dash-chart-data"><summary>Ver valores diarios</summary>
          <table><thead><tr><th scope="col">Fecha</th><th scope="col">${esc(nombre)}</th></tr></thead>
          <tbody>${days.map(day => `<tr><td>${esc(day.label)}</td><td>${day.count}</td></tr>`).join('')}</tbody></table>
        </details>`;
    };

    /** Guía vertical + tooltip con el dato exacto de cada día. */
    const bindAreaTip = (el, days) => {
      const tip = el.querySelector('.dash-area-tip');
      const guide = el.querySelector('.dash-area-guide');
      if (!tip || !guide) return;
      const hide = () => { tip.hidden = true; guide.classList.remove('is-on'); };
      el.querySelectorAll('.dash-area-hit').forEach(hit => {
        hit.addEventListener('pointerenter', () => {
          const d = days[Number(hit.dataset.i)];
          if (!d) return;
          tip.textContent = `${d.label} · ${d.count}`;
          tip.style.left = `${Math.min(88, Math.max(12, Number(hit.dataset.x) / 540 * 100))}%`;
          tip.hidden = false;
          const x = hit.dataset.x;
          guide.setAttribute('x1', x);
          guide.setAttribute('x2', x);
          guide.classList.add('is-on');
        });
      });
      el.querySelector('.dash-area-wrap')?.addEventListener('pointerleave', hide);
    };

    // ---- Distribución de contenido (dona) ----
    const dist = [
      { label: 'Series', count: seriesCount, color: '#ff6b4a' },
      { label: 'Fotos', count: galleryPhotos, color: '#ff9e7a' },
      { label: 'Frases', count: mensajes, color: '#f5b942' },
      { label: 'Música y audios', count: songsList.length + audiosList.length, color: '#4ec9b0' },
      { label: 'Regalos, noticias y cartas editadas', count: giftsCount + newsList.length + owLettersList.length, color: '#9b8cff' }
    ];
    const contentIncomplete = [reasons, songs, giftsData, news, audios, maldiaFrases, maldiaMensajes, owLetters, seriesCatalog]
      .some(entry => entry == null);
    const distTotal = dist.reduce((s, d) => s + d.count, 0);
    let acc = 0;
    const distSegs = dist.map(d => {
      const frac = distTotal ? d.count / distTotal : 0;
      const seg = { ...d, frac, start: acc };
      acc += frac;
      return seg;
    });
    const R = 42, CIRC = 2 * Math.PI * R;
    // Cada segmento lleva su <title>: al pasar el ratón se ve la cifra
    // exacta y, sin JavaScript, sigue siendo legible para el lector.
    const donutHtml = distSegs.filter(d => d.count > 0).map(d => {
      const len = d.frac * CIRC;
      return `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${d.color}" stroke-width="14"
        stroke-dasharray="${len.toFixed(1)} ${(CIRC - len).toFixed(1)}" stroke-dashoffset="${(-d.start * CIRC).toFixed(1)}" stroke-linecap="butt">
        <title>${esc(d.label)}: ${d.count} (${Math.round(d.frac * 100)}%)</title>
      </circle>`;
    }).join('');
    const donutLegend = distSegs.map(d => `
      <div class="dash-legend-row">
        <span class="dash-legend-dot" style="background:${d.color}"></span>
        <span class="dash-legend-label">${d.label}</span>
        <span class="dash-legend-count">${d.count} (${Math.round(d.frac * 100)}%)</span>
      </div>`).join('');

    // ---- Tendencia de ánimo ----
    const moodCounts = {};
    moods.forEach(m => {
      const items = moodRowItems(m);
      items.forEach(item => {
        const key = moodAggKey(item);
        moodCounts[key] = (moodCounts[key] || 0) + 1;
      });
    });
    const emotionTotal = Object.values(moodCounts).reduce((sum, count) => sum + count, 0);
    const mostMarked = Math.max(0, ...Object.values(moodCounts));
    const leading = Object.keys(moodCounts).filter(key => moodCounts[key] === mostMarked);
    const dominantText = leading.length === 1 ? moodInfo(leading[0]).label : `${leading.length} emociones empatadas`;
    const WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const weekCounts = [0, 0, 0, 0, 0, 0, 0];
    moods.forEach(m => {
      if (!m.date) return;
      weekCounts[(new Date(m.date + 'T12:00:00Z').getUTCDay() + 6) % 7]++;
    });
    const weekMax = Math.max(...weekCounts, 1);
    const weekTop = weekCounts.indexOf(weekMax);
    const weekTops = weekCounts.map((n, i) => (n && n === weekMax ? i : -1)).filter(i => i >= 0);
    const weekBars = WEEK_LABELS.map((l, i) => {
      const n = weekCounts[i];
      const h = Math.round(n / weekMax * 100);
      // La cifra se pinta encima de la barra: antes solo se veía al pasar el
      // ratón, y el gráfico no dizia cuántas barras había ni cuál era la mayor.
      return `<div class="dash-week-col${n === weekMax && n ? ' top' : ''}" title="${l}: ${n} registro${n === 1 ? '' : 's'}">
        <div class="dash-week-count">${n}</div>
        <div class="dash-week-wrap"><div class="dash-week-bar${n ? ' has' : ''}" style="height:${h}%"></div></div>
        <span class="dash-week-label">${l}</span>
      </div>`;
    }).join('');
    // Reparto por tipo de ánimo. moodCounts ya se calculaba entero para
    // sacar el dominante y se tiraba el resto; el panel se quedaba con
    // medio cuerpo de hueco al lado de "Fechas importantes".
    // Usa el catálogo real (MOOD_ORDER de módulo + moodInfo): antes esta
    // lista local solo traía los ids ANTIGUOS y pintaba con un vocabulario
    // inventado ("Enamorada", "Feliz"), así que los ánimos vigentes
    // (preocupada, enfadada, triste, bien, cariño) no aparecían nunca.
    const moodDist = Object.keys(moodCounts)
      .sort((a, b) => moodRank(a) - moodRank(b) || moodInfo(a).label.localeCompare(moodInfo(b).label, 'es'))
      .map(k => ({ k, n: moodCounts[k], info: moodInfo(k) }));
    const moodDistHtml = moodDist.length ? moodDist.map(d => `
        <div class="dash-mooddist-row${leading.includes(d.k) ? ' is-current' : ''}">
          <span class="dash-mooddist-face" aria-hidden="true">${esc(d.info.emoji)}</span>
          <span class="dash-mooddist-label">${esc(d.info.label)}</span>
          <span class="dash-mooddist-track"><span class="dash-mooddist-fill" style="width:${Math.round(d.n / emotionTotal * 100)}%"></span></span>
          <span class="dash-mooddist-count">${d.n} · ${Math.round(d.n / emotionTotal * 100)}%</span>
        </div>`).join('') : '<p class="dash-week-caption">Sin registros de ánimo todavía</p>';

    const weekCaption = weekCounts.some(Boolean)
      ? (weekTops.length > 1
        // Empate: nombrar solo uno mentía, así que se listan todos.
        ? `<p class="dash-week-caption">Empate en el máximo (${weekMax}): <strong>${weekTops.slice(0, 4).map(i => WEEK_LABELS[i]).join(', ')}</strong>${weekTops.length > 4 ? ` y ${weekTops.length - 4} más` : ''}</p>`
        : `<p class="dash-week-caption">Día con más registros: <strong>${WEEK_LABELS[weekTop]}</strong> (${weekMax})</p>`)
      : '<p class="dash-week-caption">Sin registros de ánimo todavía</p>';

    const fmtDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('es', {
      timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
    });
    const countdown = days => days === 0 ? 'Hoy' : days < 0 ? 'Ya pasó' : `En ${days} día${days === 1 ? '' : 's'}`;
    const dates = hubDates ? dashboardDates(hubDates, today, FIXED_EVENT_FIELDS) : [];
    const anniv = dates.find(date => date.id === 'anniversary');
    const fechas = dates.sort((a, b) => Number(a.days < 0) - Number(b.days < 0) || a.days - b.days)
      .slice(0, 8).map(event => ({
        icon: event.icon, title: event.title, date: fmtDate(event.date),
        note: event.recurring ? 'Anual' : '',
        badge: countdown(event.days), hot: event.days >= 0 && event.days <= 30, muted: event.days < 0,
      }));

    // ---- Actividad reciente ----
    const ACT_ICONS = { reason: '💌', song: '🎵', gift: '🎁', news: '📰', series: '📺', maldia: '💬', audio: '🎙️', letter: '📮', user: '👤', login: '🔑', logout: '🚪' };
    const actIcon = (action = '') => ACT_ICONS[String(action).split('_')[0]] || '✨';
    const relTime = ts => {
      const day = statsDay(ts);
      if (!day) return '';
      const time = new Date(ts).toLocaleTimeString('es', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
      if (day === today) return `Hoy, ${time}`;
      if (day === shiftStatsDay(today, -1)) return `Ayer, ${time}`;
      return fmtDate(day);
    };

    // ---- Ir a: secciones y atajos ----
    // El menú lateral ya tiene todo, pero el resumen es donde se entra sin
    // pensar: por eso repite el mapa completo de secciones y los atajos al
    // contenido que más se edita, cada uno con su número.
    const quickActions = [
      { section: 'contenido',      icon: UI.content,  label: 'Contenido' },
      { section: 'multimedia',     icon: UI.cloud,    label: 'Multimedia' },
      { section: 'moods',          icon: UI.smile,    label: 'Ánimo' },
      { section: 'usuarios',       icon: UI.users,    label: 'Usuarios' },
      { section: 'notificaciones', icon: UI.bell,     label: 'Notificaciones' },
      { section: 'actividad',      icon: UI.activity, label: 'Actividad' },
      { section: 'config',         icon: UI.settings, label: 'Configuración' }
    ];
    const shortcuts = [
      { icon: '📮', label: 'Open When', count: owLettersList.length, section: 'contenido', sub: 'openwhen' },
      { icon: '🖼️', label: 'Galeria', count: galleryPhotos, section: 'multimedia' },
      { icon: '💬', label: 'Frases', count: mensajes, section: 'contenido', sub: 'razones' },
      { icon: '🎵', label: 'Música', count: songsList.length, section: 'contenido', sub: 'canciones' },
      { icon: '🎁', label: 'Regalos', count: giftsCount, section: 'contenido', sub: 'regalos' },
      { icon: '📝', label: 'Notas', count: audiosList.length, section: 'contenido', sub: 'audios' }
    ];

    // ---- Uso de la app: sesiones, tiempo por sección y últimas conexiones ----
    // El tiempo de cada visita es el hueco hasta la siguiente de la misma
    // persona. La última página de cada sesión recibe una estimación (mediana
    // de sus huecos, entre 45 s y 2 min) en vez de quedarse en 0 ms porque no
    // llegaba ninguna visita después.
    const perSection = sectionUsage(sessions);
    const perUser = userUsage(sessions);
    const sessionStats = sessionSummary(sessions);
    const sortedVisits = [...navVisits].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const topSections = Object.entries(perSection)
      .filter(([, s]) => s.count > 0)
      .sort((a, b) => b[1].ms - a[1].ms || b[1].count - a[1].count)
      .slice(0, 6);
    const sectionMaxMs = Math.max(...topSections.map(([, s]) => s.ms), 1);
    const useHtml = topSections.length
      ? topSections.map(([bp, s]) => `
        <div class="dash-use-row">
          <span class="dash-use-label">${esc(labelForPath(bp))}</span>
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
          name: user?.name || user?.email?.split('@')[0] || 'Cuenta del historial',
          isAdmin: user?.role === 'admin',
          count: u.count,
          lastTs: u.lastTs,
          topSec: topSec ? labelForPath(topSec[0]) : '—'
        };
      })
      .filter(c => c.count > 0)
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 6);
    const connHtml = connections.length
      ? connections.map(c => `
        <div class="dash-conn-row">
          <span class="dash-conn-dot${c.isAdmin ? ' admin' : ''}"></span>
          <span class="dash-conn-name">${esc(c.name)}${c.isAdmin ? ' <span class="admin-badge-tag">Peluche</span>' : ''}</span>
          <span class="dash-conn-meta">${c.count} visita${c.count === 1 ? '' : 's'} · ${c.topSec}</span>
          <span class="dash-conn-time">${relTimeShort(c.lastTs)}</span>
        </div>`).join('')
      : '<p class="muted-text" style="margin:0">Sin conexiones registradas todavía.</p>';

    // ---- Horas punta: matriz 24 h x día de la semana ----
    const heat = hourlyHeatmap(navVisits);
    const heatParts = dayParts(heat);
    const heatMax = Math.max(...heat.matrix.flat(), 1);
    const heatDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const heatRows = heat.matrix.map((row, d) => `
      <div class="dash-heat-row">
        <span class="dash-heat-day">${heatDays[d]}</span>
        ${row.map((n, h) => `<span class="dash-heat-cell${n ? ' has' : ''}" style="--heat:${n ? (0.18 + 0.82 * (n / heatMax)).toFixed(2) : 0}" title="${heatDays[d]} ${String(h).padStart(2, '0')}:00 · ${n} visita${n === 1 ? '' : 's'}"></span>`).join('')}
      </div>`).join('');
    const hourAxis = `<div class="dash-heat-row dash-heat-axis"><span class="dash-heat-day"></span>${Array.from({ length: 24 }, (_, h) => `<span class="dash-heat-hour">${h % 3 === 0 ? h : ''}</span>`).join('')}</div>`;
    const peakText = heat.peakHour === null
      ? 'Sin visitas todavía'
      : `${String(heat.peakHour).padStart(2, '0')}:00–${String((heat.peakHour + 1) % 24).padStart(2, '0')}:00`;
    const heatTotal = Math.max(1, heat.total);
    const partsHtml = heatParts.map(p => `<span class="dash-part-chip"><strong>${p.label}</strong> ${p.count} · ${Math.round(p.count / heatTotal * 100)}%</span>`).join('');

    // ---- Rachas y constancia ----
    const visitDays = uniqueDays(navVisits.map(v => v.timestamp));
    const visitStreak = streaks(visitDays, today);
    const moodStreak = streaks(uniqueDays(moods.map(m => m.date)), today);
    const streakDays = Math.max(visitStreak.current, moodStreak.current);
    const streakBadge = userId && streakDays > 0
      ? `<span class="dash-streak" title="Visitas: ${visitStreak.current} día(s) seguidos · Ánimos: ${moodStreak.current} día(s) seguidos">🔥 Racha activa: ${streakDays} día${streakDays === 1 ? '' : 's'}</span>`
      : '';

    // ---- Engagement con el contenido ----
    const askedGifts = (giftsData?.gifts || []).filter(g => g?.data?.question);
    const answeredGifts = askedGifts.filter(g => (giftResponsesMap[g.id] || []).length > 0);
    // Total real de cartas: las del catálogo fijo más las que se añadan desde
    // el panel (un id repetido cuenta una sola vez).
    const publishedLetters = publishedLetterIds(LETTERS, owLettersList);
    const openedLetters = [...letterReads].filter(id => publishedLetters.has(id)).length;
    const engagementHtml = `<div class="dash-eng-grid">
      <div class="dash-eng"><span class="dash-eng-num">${visitsResult ? visitStreak.current + ' / ' + visitStreak.longest : '—'}</span><span class="dash-eng-label">racha de visitas · actual / mejor del período</span></div>
      <div class="dash-eng"><span class="dash-eng-num">${moodsResult ? moodStreak.current + ' / ' + moodStreak.longest : '—'}</span><span class="dash-eng-label">racha de ánimo · actual / mejor del período</span></div>
      <div class="dash-eng"><span class="dash-eng-num">${visitsResult ? visitDays.length : '—'}</span><span class="dash-eng-label">días con al menos una visita</span></div>
      <div class="dash-eng"><span class="dash-eng-num">${sessionStats.sessions ? fmtDuration(sessionStats.avgMs) : '—'}</span><span class="dash-eng-label">duración media estimada por sesión</span></div>
      <div class="dash-eng"><span class="dash-eng-num">${visitsResult && owLetters != null ? openedLetters + ' / ' + publishedLetters.size : '—'}</span><span class="dash-eng-label">cartas distintas leídas / catálogo publicado</span></div>
      <div class="dash-eng"><span class="dash-eng-num">${giftResponses == null || giftsData == null ? '—' : answeredGifts.length + ' / ' + askedGifts.length}</span><span class="dash-eng-label">regalos con respuesta · todas las cuentas y fechas</span></div>
    </div>`;

    // ---- Hoy: lo que se mira al entrar, antes de cualquier gráfico ----
    const lastVisit = sortedVisits.at(-1);
    const visitsToday = navVisits.filter(v => statsDay(v.timestamp) === today).length;
    const todayMoods = latestDailyMoods(moods, today);
    const todayMood = todayMoods.length === 1 ? moodRowItems(todayMoods[0]) : [];
    const lastNote = maldiaNotesList[0];
    const nowCards = [
      { label: 'Última visita',
        value: !visitsResult ? 'No disponible' : lastVisit ? relTimeShort(Date.parse(lastVisit.timestamp)) : 'Sin visitas',
        sub: visitsResult ? `${visitsToday} visita${visitsToday === 1 ? '' : 's'} hoy` : '' },
      { label: userId ? 'Su ánimo hoy' : 'Ánimo de hoy',
        value: !moodsResult ? 'No disponible' : todayMood.length
          ? todayMood.map(item => `${item.emoji} ${item.label}`).join(' · ')
          : todayMoods.length ? `${todayMoods.length} cuentas registraron su ánimo` : 'Sin registrar',
        sub: todayMood.length > 1 ? 'Emociones de su último registro' : '' },
      { label: 'Notas de Mal Día',
        value: maldiaNotes == null ? 'No disponibles' : String(maldiaNotesList.length),
        sub: lastNote?.createdAt ? `Última nota ${relTimeShort(Date.parse(lastNote.createdAt))} · todas las cuentas` : 'Todas las cuentas' },
      { label: anniv?.title || 'Aniversario',
        value: anniv ? countdown(anniv.days) : 'No disponible', sub: anniv ? fmtDate(anniv.date) : '' }
    ];

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.dash} Resumen general</h2>
          <div class="dash-header-tools">
            ${streakBadge}
            ${accountSelect}
            <select class="dash-range-select" id="dashActivityRange" aria-label="Período de las estadísticas">
              ${[7, 14, 30, 90].map(days => `<option value="${days}"${days === period ? ' selected' : ''}>${days} días</option>`).join('')}
            </select>
            <button type="button" class="admin-btn-ghost" id="refreshDashboard" aria-label="Actualizar resumen" title="Actualizar">${UI.refresh}</button>
          </div>
        </div>
        <p class="admin-section-hint">Del ${fmtDate(from)} al ${fmtDate(today)} · hora de España peninsular</p>
        ${partial ? '<p class="admin-data-note" role="status">Alguna fuente solo dispone de datos locales o parciales. Los totales pueden estar incompletos.</p>' : ''}
        ${!usersResult ? '<p class="admin-data-note" role="status">No se pudo consultar la lista de cuentas.</p>' : ''}

        <!-- Lo primero que se mira al entrar: cómo está hoy. Los gráficos y
             los accesos van después. -->
        <div class="dash-now">
          ${nowCards.map(c => `
            <div class="dash-now-card">
              <span class="dash-now-label">${esc(c.label)}</span>
              <b class="dash-now-value">${esc(c.value)}</b>
              <span class="dash-now-sub">${esc(c.sub)}</span>
            </div>`).join('')}
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head">
              <h4>Evolución diaria</h4>
            </div>
            <div class="dash-chart-toggle-group" role="group" aria-label="Métrica del gráfico">
              ${Object.entries(CHART_METRICS).map(([key, name]) => `<button type="button" class="dash-chart-toggle${key === dashboardMetric ? ' active' : ''}" data-metric="${key}" aria-pressed="${key === dashboardMetric}">${name}</button>`).join('')}
            </div>
            <p class="dash-week-caption" id="dashMetricHelp"></p>
            <div id="dashActivityChart"></div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Distribución de contenido</h4><span class="admin-panel-badge">Catálogo global</span></div>
            ${contentIncomplete ? '<p class="admin-data-note">Recuento parcial. Alguna colección no está disponible.</p>' : ''}
            <div class="dash-donut">
              <div class="dash-donut-wrap">
                <svg viewBox="0 0 120 120" class="dash-donut-svg">${donutHtml}</svg>
                <div class="dash-donut-center"><strong>${distTotal || (contentIncomplete ? '—' : 0)}</strong><span>${contentIncomplete ? 'Disponible' : 'Total'}</span></div>
              </div>
              <div class="dash-donut-legend">${donutLegend}</div>
            </div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head">
              <h4>Emociones y registros</h4>
              <div class="dash-panel-actions">
                <button class="dash-link" data-goto="moods">Historial →</button>
                <span class="admin-panel-badge">${moodsResult ? moods.length + ' registros' : 'Sin conexión'}</span>
              </div>
            </div>
            ${!moodsResult ? unavailable : emotionTotal ? `<div class="dash-mood-head">
              <div class="dash-mood-text">
                <div class="dash-mood-main">${esc(dominantText)}</div>
                <div class="dash-mood-sub">${emotionTotal} emociones marcadas · ${mostMarked} por emoción más frecuente</div>
              </div>
            </div>
            <p class="dash-week-caption">Registros acumulados por día de la semana</p>
            <div class="dash-week-chart">${weekBars}</div>
            ${weekCaption}
            <div class="dash-mooddist">${moodDistHtml}</div>` : '<div class="admin-empty">Sin emociones registradas en este período.</div>'}
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Fechas importantes</h4></div>
            <div class="dash-fechas">
              ${!hubDates ? unavailable : fechas.length ? fechas.map(f => `
                <div class="dash-fecha">
                  <div class="dash-fecha-icon">${f.icon}</div>
                  <div class="dash-fecha-body">
                    <div class="dash-fecha-title">${esc(f.title)}</div>
                    <div class="dash-fecha-date">${f.date}</div>
                    ${f.note ? `<div class="dash-fecha-note">${esc(f.note)}</div>` : ''}
                  </div>
                  <span class="dash-fecha-badge${f.hot ? ' hot' : ''}${f.muted ? ' muted' : ''}">${f.badge}</span>
                </div>`).join('') : '<div class="admin-empty">No hay fechas configuradas.</div>'}
            </div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Tiempo estimado por sección</h4><span class="admin-panel-badge">${visitsResult ? sortedVisits.length + ' visitas' : 'No disponible'}</span></div>
            <p class="dash-week-caption">Estimación según el tiempo entre visitas. Las sesiones se separan tras 30 minutos sin navegar.</p>
            <div class="dash-use">${visitsResult ? useHtml : unavailable}</div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Últimas visitas por cuenta</h4></div>
            <div class="dash-conn">${visitsResult ? connHtml : unavailable}</div>
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head">
              <h4>Visitas por día y hora</h4>
              <span class="admin-panel-badge">Hora más activa: ${peakText}</span>
            </div>
            ${!visitsResult ? unavailable : heat.total ? `<div class="dash-heat">${hourAxis}${heatRows}</div>
              <div class="dash-parts">${partsHtml}</div>` : '<div class="admin-empty">Sin visitas en este período.</div>'}
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Constancia y participación</h4></div>
            ${engagementHtml}
          </div>
        </div>

        <div class="admin-dash-grid">
          <div class="admin-panel">
            <div class="admin-panel-head">
              <h4>Notas de Mal Día</h4>
              <div class="dash-panel-actions">
                <button class="dash-link" id="dashMaldiaNotesAll">Ver todas →</button>
                <span class="admin-panel-badge">Todas las cuentas</span>
              </div>
            </div>
            <div class="gift-responses-list dash-notes-list">
              ${maldiaNotes == null ? unavailable : maldiaNotesList.length
                ? maldiaNotesList.slice(0, 3).map(maldiaNoteCardHtml).join('')
                : '<p class="muted-text" style="margin:0">Todavía no hay notas. Cuando ella escriba una desde la sección Mal Día, aparecerán aquí.</p>'}
            </div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-head"><h4>Últimas acciones de gestión</h4><span class="admin-panel-badge">Registro global</span></div>
            <div class="admin-activity-list">
              ${!activityResult ? unavailable : activityList.length ? activityList.map(e => `
                <div class="admin-activity-item">
                  <div class="admin-activity-emoji">${actIcon(e.action)}</div>
                  <div class="admin-activity-body">
                    <div class="admin-activity-action">${esc(db.formatAction(e.action))}</div>
                    <div class="admin-activity-details">${esc(e.details || '')}</div>
                  </div>
                  <div class="admin-activity-time">${relTime(e.timestamp)}</div>
                </div>`).join('') : '<div class="admin-empty">Sin acciones de gestión registradas.</div>'}
            </div>
            <button class="dash-more-btn" data-goto="actividad">Ver toda la actividad →</button>
          </div>
        </div>

        <!-- Al final, los accesos: el resumen ya ha enseñado lo importante. -->
        <div class="admin-panel dash-go-panel">
          <div class="admin-panel-head">
            <h4>Ir a</h4>
            <span class="admin-panel-badge">Todo el panel a un clic</span>
          </div>
          <div class="dash-go">
            <span class="dash-go-label">Secciones del panel</span>
            <div class="quick-actions">
              ${quickActions.map(q => `
                <button type="button" class="quick-action" data-goto="${q.section}">
                  <span class="quick-action-icon">${q.icon}</span>
                  <span class="quick-action-label">${q.label}</span>
                </button>`).join('')}
            </div>
          </div>
          <div class="dash-go">
            <span class="dash-go-label">Atajos de gestión</span>
            <div class="dash-shortcuts">
              ${shortcuts.map(s => `
                <button type="button" class="dash-shortcut" data-shortcut='${JSON.stringify({ section: s.section || '', sub: s.sub || '' })}'>
                  <span class="dash-shortcut-icon">${s.icon}</span>
                  <span class="dash-shortcut-label">${s.label}</span>
                  <span class="dash-shortcut-count">${s.count} ${s.count === 1 ? 'elemento' : 'elementos'}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>
      </section>
    `;

    const refreshDashboard = () => loadDashboard({ background: true });
    page.querySelector('#refreshDashboard')?.addEventListener('click', refreshDashboard);

    // Selector de usuario de las estadísticas (se aplica sin recargar).
    page.querySelector('#statsUserSelect')?.addEventListener('change', (e) => {
      setStatsUser(e.target.value);
      void refreshDashboard();
    });

    // Gráfico: una sola vía de render para métrica y rango, que además
    // vuelve a enganchar la guía/tooltip sobre el HTML recién inyectado.
    const renderChart = () => {
      const el = page.querySelector('#dashActivityChart');
      if (!el) return;
      const days = seriesDays(dashboardMetric);
      page.querySelector('#dashMetricHelp').textContent = {
        visits: 'Cada visita registrada al abrir una sección. Las lecturas de cartas se cuentan aparte.',
        sessions: 'Sesiones iniciadas cada día, separadas por 30 minutos sin visitas.',
        mood: 'Cada envío de ánimo cuenta como un registro, aunque incluya varias emociones.',
      }[dashboardMetric];
      el.innerHTML = areaChart(days);
      if (days) bindAreaTip(el, days);
    };

    // Métrica del gráfico: Actividad | Ánimos | Visitas
    page.querySelectorAll('.dash-chart-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        dashboardMetric = btn.dataset.metric;
        page.querySelectorAll('.dash-chart-toggle').forEach(b => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderChart();
      });
    });

    // Rango del gráfico
    page.querySelector('#dashActivityRange')?.addEventListener('change', e => {
      dashboardPeriod = Number(e.target.value);
      void refreshDashboard();
    });

    renderChart();
    if (chartDetailsOpen) page.querySelector('.dash-chart-data')?.setAttribute('open', '');
    if (focused?.id) page.querySelector(`#${CSS.escape(focused.id)}`)?.focus({ preventScroll: true });
    else if (focused?.dataset.metric) {
      page.querySelector(`[data-metric="${CSS.escape(focused.dataset.metric)}"]`)?.focus({ preventScroll: true });
    }

    // Accesos rápidos → cambian de sección
    page.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        S.section = btn.dataset.goto;
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
        loadSection(S.section);
      });
    });

    // "Ver todas" de las notas de Mal Día → Contenido, subpestaña Mal Día
    page.querySelector('#dashMaldiaNotesAll')?.addEventListener('click', () => {
      S.contentSub = 'maldia';
      S.section = 'contenido';
      loadSection(S.section);
    });
  }

  // ==========================================
  // 2. ESTADO DE ÁNIMO
  // ==========================================
  /** Fecha local en ISO (YYYY-MM-DD), sin pasar por UTC. */
  const isoDayOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  /**
   * Lleva el detalle a otro día. Si cae en un mes distinto, carga ese mes
   * antes de abrirlo (y el calendario de detrás se mueve con él, para que al
   * cerrar el modal no quede un mes que no es el que estabas mirando).
   */
  async function goToMoodDay(dateStr) {
    const token = sectionToken;
    const navigation = ++moodNavigationToken;
    const loadedMonth = `${S.moodDate.getFullYear()}-${String(S.moodDate.getMonth() + 1).padStart(2, '0')}`;
    if (!S.moodMonthData || dateStr.slice(0, 7) !== loadedMonth) {
      S.moodDate = new Date(Number(dateStr.slice(0, 4)), Number(dateStr.slice(5, 7)) - 1, 1);
      if (!await renderMoodMonth(S.moodDate)) return;
    }
    if (isCurrentSection(token) && navigation === moodNavigationToken && modal.visible) openMoodDayDetail(dateStr);
  }

  /**
   * Salta al día CON registro más cercano en una dirección (delta -1 ó 1).
   * Primero pregunta al servidor (una consulta ordenada por fecha) y, si no
   * hay conexión, busca en el mes que ya está cargado.
   */
  async function goToNearestMoodDay(anchorStr, delta) {
    const token = sectionToken;
    const navigation = ++moodNavigationToken;
    const date = new Date(`${anchorStr}T12:00:00`);
    const from = isoDayOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta));

    if (delta > 0 && from > todayISO()) {
      showToast('No hay días posteriores con registro', 'info');
      return;
    }

    const userId = statsUserId === STATS_ALL ? null : statsUserId;
    let target;
    let failed = false;
    try {
      target = await db.getNearestMoodDate({ from, direction: delta < 0 ? 'prev' : 'next', userId, strict: true });
    } catch {
      failed = true;
      const days = Object.keys(S.moodMonthData || {})
        .filter(ds => (S.moodMonthData[ds] || []).some(row => moodRowItems(row).length))
        .sort();
      target = delta < 0
        ? days.findLast(ds => ds <= from) || null
        : days.find(ds => ds >= from) || null;
    }
    if (!isCurrentSection(token) || navigation !== moodNavigationToken || !modal.visible) return;

    // Nunca hacia el futuro: allí no puede haber nada registrado.
    const usable = target && (delta < 0 || target <= todayISO()) ? target : null;
    if (!usable) {
      const message = failed ? 'No se pudo buscar otro día. Inténtalo de nuevo.'
        : delta < 0 ? 'No hay días anteriores con registro' : 'No hay días posteriores con registro';
      showToast(message, failed ? 'error' : 'info');
      return;
    }
    await goToMoodDay(usable);
  }

  /**
   * Todas las emociones de un día, en detalle. La celda del calendario solo
   * cabía tres emojis y un «+N», así que no había forma de saber cuáles eran
   * las demás. Aquí se leen todas, con el texto real de las escritas a mano.
   *
   * Las flechas saltan al día con registro más cercano: el ánimo se mira
   * seguido y parar en cada día vacío era recorrer el calendario a mano.
   */
  function openMoodDayDetail(dateStr) {
    const rows = S.moodMonthData?.[dateStr] || [];
    const items = rows.flatMap(moodRowItems);
    const dayDate = new Date(`${dateStr}T12:00:00`);
    const dateLabel = dayDate.toLocaleDateString('es', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const prevStr = isoDayOf(new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() - 1));
    const nextStr = isoDayOf(new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + 1));
    // Mirar al futuro no sirve: todavía no puede haber nada registrado.
    const canGoNext = nextStr <= todayISO();
    const isToday = dateStr === todayISO();

    const navHtml = `
      <div class="mood-day-nav">
        <button type="button" class="mood-day-nav-btn" data-mood-day-prev="${prevStr}" aria-label="Día anterior con registro">‹</button>
        <span class="mood-day-nav-label">${esc(dateLabel)}</span>
        <button type="button" class="mood-day-nav-btn" data-mood-day-next="${nextStr}" aria-label="Día siguiente con registro"${canGoNext ? '' : ' disabled'}>›</button>
      </div>
      ${isToday ? '' : '<div class="mood-day-tools"><button type="button" class="mood-day-today" data-mood-day-today aria-label="Ir al día de hoy">Hoy</button></div>'}`;

    // Las flechas saltan los días vacíos: van al registro más cercano.
    const bindNav = () => {
      modal.body.querySelector('[data-mood-day-prev]')?.addEventListener('click', () => goToNearestMoodDay(dateStr, -1));
      if (canGoNext) {
        modal.body.querySelector('[data-mood-day-next]')?.addEventListener('click', () => goToNearestMoodDay(dateStr, 1));
      }
      // Volver al día actual sin recorrer el calendario a mano.
      modal.body.querySelector('[data-mood-day-today]')?.addEventListener('click', () => goToMoodDay(todayISO()));
    };

    if (!items.length) {
      modal.open('Ánimo del día', `
        <div class="mood-day-detail">
          ${navHtml}
          <p class="mood-day-empty">Ese día no tiene ningún registro de ánimo.</p>
        </div>
      `);
      bindNav();
      return;
    }

    // Se agrupa por emoción (las escritas, por su texto) y se cuentan: si el
    // día tiene varios estados, el mismo ánimo puede repetirse.
    const counts = new Map();
    for (const item of items) {
      const key = moodAggKey(item);
      const prev = counts.get(key);
      counts.set(key, { info: moodInfo(key), n: (prev?.n || 0) + 1 });
    }
    const list = [...counts.entries()].sort((a, b) => moodRank(a[0]) - moodRank(b[0]));
    const summary = `${items.length} ${items.length === 1 ? 'emoción' : 'emociones'}`
      + ` · ${rows.length} ${rows.length === 1 ? 'registro' : 'registros'} ese día`;

    modal.open('Ánimo del día', `
      <div class="mood-day-detail">
        ${navHtml}
        <p class="mood-day-summary">${esc(summary)}</p>
        <div class="mood-day-chips">
          ${list.map(([, entry]) => `
            <span class="mood-day-chip">
              <span aria-hidden="true">${esc(entry.info.emoji)}</span>
              ${esc(entry.info.label)}
              ${entry.n > 1 ? `<span class="mood-day-chip-count">×${entry.n}</span>` : ''}
            </span>`).join('')}
        </div>
        ${rows.length > 1 ? '<p class="mood-day-hint">Ese día registró su ánimo más de una vez: se cuentan todas las emociones que marcó.</p>' : ''}
      </div>
    `);
    bindNav();
  }

  async function loadMoods() {
    const token = sectionToken;
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.heart} Estado de Ánimo</h2>
          <div class="dash-header-tools">
            <div id="moodAccountControl"></div>
            <button type="button" class="admin-btn-ghost" id="refreshMoods" aria-label="Actualizar ánimos" title="Actualizar">${UI.refresh}</button>
          </div>
        </div>
        <p class="admin-section-hint">${SECTION_HINTS.moods}</p>
        <p class="admin-data-note" id="moodAccountStatus" role="status" hidden></p>
        <div class="moods-chart-section">
          <div class="moods-chart-header">
            <h3>Calendario mensual</h3>
            <div class="moods-nav">
              <button type="button" class="moods-nav-btn" id="moodPrev" aria-label="Mes anterior">‹</button>
              <span id="moodMonthLabel">Cargando...</span>
              <button type="button" class="moods-nav-btn" id="moodNext" aria-label="Mes siguiente">›</button>
            </div>
          </div>
          <div class="moods-calendar" id="moodCalendar">${skeletonCard('280px')}</div>
          <p class="admin-data-note" id="moodMonthStatus" role="status" hidden></p>
          <div class="moods-stats" id="moodStats"></div>
          <div class="moods-breakdown" id="moodBreakdown"></div>
        </div>
        <!-- El resumen semanal cierra la sección: calendario → desglose → 7 días. -->
        <div class="moods-week" id="moodWeek">${skeletonCard('140px')}</div>
      </section>
    `;

    const render = () => renderMoodMonth(S.moodDate);
    const renderMoods = () => Promise.all([render(), renderMoodWeek()]);
    // Un día se abre para ver el detalle completo de sus emociones.
    const calendarEl = page.querySelector('#moodCalendar');
    calendarEl?.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-mood-day]');
      if (cell) openMoodDayDetail(cell.dataset.moodDay);
    });
    calendarEl?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const cell = event.target.closest('[data-mood-day]');
      if (!cell) return;
      event.preventDefault();
      openMoodDayDetail(cell.dataset.moodDay);
    });

    const moveMonth = offset => {
      S.moodDate = new Date(S.moodDate.getFullYear(), S.moodDate.getMonth() + offset, 1);
      void render();
    };
    page.querySelector('#moodPrev').onclick = () => moveMonth(-1);
    page.querySelector('#moodNext').onclick = () => moveMonth(1);
    const accountControl = page.querySelector('#moodAccountControl');
    const accountStatus = page.querySelector('#moodAccountStatus');
    let accountMarkup;
    activeRefresh = async () => {
      let moodUsers = null;
      let accountWarning = '';
      try {
        const result = await db.readAdminUsers();
        moodUsers = result.rows;
        if (result.source === 'local' || result.truncated) accountWarning = 'La lista muestra las cuentas disponibles.';
      } catch {
        accountWarning = 'No se pudo actualizar la lista de cuentas.';
      }
      if (!isCurrentSection(token)) return;
      accountStatus.textContent = accountWarning;
      accountStatus.hidden = !accountWarning;
      if (moodUsers || !accountMarkup) {
        const html = statsUserSelectHTML(moodUsers, 'statsMoodUserSelect');
        if (html !== accountMarkup) {
          accountMarkup = html;
          accountControl.innerHTML = html;
        }
      }
      await renderMoods();
    };
    accountControl.addEventListener('change', e => {
      setStatsUser(e.target.value);
      void renderMoods();
    });
    page.querySelector('#refreshMoods').addEventListener('click', () => refreshVisibleSection());
    await activeRefresh();
  }

  /**
   * Resumen de los últimos siete días (hoy incluido): qué emociones se
   * repiten más. Cuenta cada emoción marcada, no cada fila, y las escritas a
   * mano por su texto; respeta el selector de usuario del panel.
   */
  async function renderMoodWeek() {
    const box = page.querySelector('#moodWeek');
    if (!box) return;
    const token = sectionToken;
    const renderToken = ++moodWeekRenderToken;
    const today = todayISO();
    const start = new Date(`${today}T12:00:00`);
    start.setDate(start.getDate() - 6); // siete días contando hoy
    const startISO = isoDayOf(start);

    const userId = statsUserId === STATS_ALL ? null : statsUserId;
    const loadKey = `${userId || ''}:${today}`;
    const rangeLabel = `${start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${new Date(`${today}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;
    const header = `
      <div class="moods-chart-header">
        <h3>Últimos 7 días</h3>
        <span class="moods-week-range">${esc(rangeLabel)}</span>
      </div>`;
    if (box.dataset.scope !== loadKey) {
      delete box.dataset.scope;
      box.innerHTML = header + skeletonCard('110px');
    }
    let result;
    try {
      result = await db.readAdminMoods({ from: startISO, through: today, userId });
    } catch {
      if (!isCurrentSection(token) || renderToken !== moodWeekRenderToken) return;
      const message = '<p class="admin-data-note" role="status">No se pudo actualizar el resumen semanal.</p>';
      if (box.dataset.scope === loadKey) {
        box.querySelector('.admin-data-note')?.remove();
        box.insertAdjacentHTML('beforeend', message);
      } else box.innerHTML = header + message;
      return;
    }
    if (!isCurrentSection(token) || renderToken !== moodWeekRenderToken) return;
    box.dataset.scope = loadKey;

    const counts = new Map();
    const days = new Set();
    let total = 0;
    for (const row of result.rows) {
      const items = moodRowItems(row);
      if (!items.length) continue;
      days.add(row.date);
      for (const item of items) {
        const key = moodAggKey(item);
        counts.set(key, (counts.get(key) || 0) + 1);
        total++;
      }
    }

    const sourceNote = result.source === 'local' || result.truncated
      ? '<p class="admin-data-note">El resumen se basa en los registros disponibles.</p>' : '';

    if (!total) {
      box.innerHTML = `${header}<div class="admin-empty">Todavía no hay emociones en los últimos siete días</div>${sourceNote}`;
      return;
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || moodRank(a[0]) - moodRank(b[0]));
    // Empate: nombrar solo una mentiría, así que se enseñan todas las que
    // comparten el máximo (igual que en el desglose del mes).
    const maxCount = sorted[0][1];
    const tops = sorted.filter(([, n]) => n === maxCount);
    const topFaces = tops.map(([key]) => moodInfo(key).emoji).join('');
    const topLabel = tops.length === 1 ? moodInfo(tops[0][0]).label : `${tops.length} empatadas`;

    box.innerHTML = `
      ${header}
      <div class="moods-stats-row">
        <div class="moods-stat">
          <span class="moods-stat-num">${days.size}<span class="moods-stat-avg">/7</span></span>
          <span class="moods-stat-label">días con registro</span>
        </div>
        <div class="moods-stat">
          <span class="moods-stat-num">${total}</span>
          <span class="moods-stat-label">${total === 1 ? 'emoción marcada' : 'emociones marcadas'}</span>
        </div>
        <div class="moods-stat" title="${esc(topLabel)}: ${maxCount} de ${total} emociones">
          <span class="moods-stat-num">${esc(topFaces)}</span>
          <span class="moods-stat-label">la más repetida · ${esc(topLabel)} (${maxCount})</span>
        </div>
      </div>
      <div class="moods-week-bars">
        ${sorted.map(([key, n]) => {
          const pct = Math.round(n / total * 100);
          const info = moodInfo(key);
          return `<div class="moods-bar-row" title="${esc(info.label)}: ${n} de ${total} (${pct} %)">
            <span class="moods-bar-label">${esc(info.emoji)} ${esc(info.label)}</span>
            <div class="moods-bar-track"><div class="moods-bar-fill mood-${moodBarClass(key)}" style="width:${pct}%"></div></div>
            <span class="moods-bar-pct">${n} · ${pct}%</span>
          </div>`;
        }).join('')}
      </div>${sourceNote}`;
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
    const status = page.querySelector('#moodMonthStatus');
    if (!calendar) return;

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const todayStr = todayISO();
    const userId = statsUserId === STATS_ALL ? null : statsUserId;
    const scope = `${userId || ''}:${monthKey}`;
    const retain = calendar.dataset.scope === scope;
    monthLabel.textContent = `${MONTHS[date.getMonth()]} ${year}`;
    page.querySelector('#moodNext').disabled = monthKey >= todayStr.slice(0, 7);
    status.hidden = true;
    if (!retain) {
      delete calendar.dataset.scope;
      S.moodMonthData = null;
      stats.replaceChildren();
      breakdown.replaceChildren();
      calendar.innerHTML = skeletonCard('240px');
    }
    let monthMoods;
    try {
      monthMoods = await db.getMoodMonth(year, month, { strict: true, userId });
    } catch {
      if (!isCurrentSection(token) || renderToken !== moodRenderToken) return false;
      if (!retain) calendar.replaceChildren();
      status.textContent = retain
        ? 'No se pudo actualizar el calendario. Se conservan los últimos datos.'
        : 'No se pudo cargar el calendario. Vuelve a intentarlo.';
      status.hidden = false;
      return false;
    }
    if (!isCurrentSection(token) || renderToken !== moodRenderToken) return false;
    // Lo que se acaba de pintar es lo que abre el detalle del día: así el
    // modal enseña exactamente el mismo ánimo (y el mismo usuario) que la
    // rejilla, sin volver a consultar ni mezclar cuentas.
    S.moodMonthData = monthMoods;
    calendar.dataset.scope = scope;
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;

    let html = '<div class="moods-cal-grid">';
    ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].forEach(d => { html += `<div class="moods-cal-hd">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) html += '<div class="moods-cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dailyMoods = monthMoods[ds] || [];
      const isToday = ds === todayStr;
      const hasMood = dailyMoods.length > 0;
      const isFuture = ds > todayStr;

      let emojiHtml = '';
      let titleText = `${ds}: Sin registro`;
      if (hasMood) {
        // Cada fila puede traer varias emociones: se juntan todas en la celda.
        const items = dailyMoods.flatMap(moodRowItems);
        const emojis = items.slice(0, 3).map(item => esc(item.emoji)).join('');
        const extra = items.length > 3 ? `<span style="font-size:0.6rem;opacity:0.8">+${items.length - 3}</span>` : '';
        emojiHtml = `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:1px;font-size:0.8rem;line-height:1">${emojis}${extra}</div>`;
        const labels = items.map(item => esc(item.label)).join(', ');
        titleText = `${esc(ds)}: ${labels}`;
      }

      // Los días CON registro se pueden abrir: la celda solo cabía tres
      // emojis y un «+N», así que el resto no se podía consultar en ningún
      // sitio. Los días vacíos no son un botón (no habría nada que enseñar).
      const openable = hasMood;
      html += `<div class="moods-cal-cell${isToday?' today':''}${hasMood?' has-mood':''}${isFuture?' future':''}${openable?' is-openable':''}"
        ${openable ? `data-mood-day="${ds}" role="button" tabindex="0" aria-label="${titleText}"` : ''}
        title="${titleText}">
        <span class="moods-cal-day">${day}</span>${emojiHtml}
      </div>`;
    }
    html += '</div>';
    calendar.innerHTML = html;

    const entries = Object.values(monthMoods).flat();
    if (entries.length === 0) {
      stats.innerHTML = '<div class="admin-empty">No hay datos de ánimo para este mes</div>';
      breakdown.replaceChildren();
      return true;
    }

    const counts = {};
    let totalScore = 0;
    let scoredEntries = 0;
    let totalEmotions = 0;
    entries.forEach((m) => {
      const resolved = moodStore.resolveMood({ mood: m.mood, label: m.label, emoji: m.emoji, score: m.score });
      const items = resolved?.items || [];
      if (!items.length) return;
      items.forEach(item => {
        const key = moodAggKey(item);
        counts[key] = (counts[key] || 0) + 1;
        totalEmotions++;
      });
      if (Number.isFinite(resolved.score)) {
        totalScore += resolved.score;
        scoredEntries++;
      }
    });
    const avgText = scoredEntries
      ? (totalScore / scoredEntries).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '—';

    // "más frecuente" con empate: antes se quedaba con el primero que
    // encontraba y ponía un único emoji, así que en un mes con 1+1
    // afirmaba que uno era el más frecuente cuando estaban empatados.
    const maxCount = Math.max(...Object.values(counts), 0);
    const topMoods = Object.keys(counts).filter(k => counts[k] === maxCount);
    const topFaces = topMoods.map(k => moodInfo(k).emoji).join('');
    const topLabel = topMoods.length === 1
      ? moodInfo(topMoods[0]).label
      : `${topMoods.length} empatados`;

    // Días con registro: "ocupados" sobre el total de días del mes.
    const daysWithMood = Object.values(monthMoods).filter(list => list.length > 0).length;

    stats.innerHTML = `<div class="moods-stats-row">
      <div class="moods-stat"><span class="moods-stat-num">${entries.length}</span><span class="moods-stat-label">registros totales</span></div>
      <div class="moods-stat" title="${esc(topLabel)}"><span class="moods-stat-num">${esc(topFaces)}</span><span class="moods-stat-label">más frecuente${maxCount > 0 ? ` · ${maxCount}${topMoods.length > 1 ? ' cada uno' : ''}` : ''}</span></div>
      <div class="moods-stat" title="Cada registro tiene el mismo peso, aunque incluya varias emociones."><span class="moods-stat-num">${avgText}<span class="moods-stat-avg">/4</span></span><span class="moods-stat-label">puntuación media por registro</span></div>
      <div class="moods-stat"><span class="moods-stat-num">${daysWithMood}<span class="moods-stat-avg">/${daysInMonth}</span></span><span class="moods-stat-label">días con registro</span></div>
    </div>`;

    // Desglose: solo los ánimos que hay en el mes, de más a menos. Antes
    // salían las 10 filas del catálogo y con dos registros ocho marcaban 0 %,
    // y los ids antiguo y vigente comparten nombre ("Necesito cariño",
    // "Bien"), así que había filas duplicadas sin explicación.
    const rows = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || moodRank(a) - moodRank(b));
    // Denominador de los porcentajes: emociones marcadas, no filas. Un día con
    // dos emociones aporta dos marcas, y con el total de filas sumarían > 100 %.
    const emotionBase = totalEmotions || entries.length;
    // Si TODO el mes es del catálogo antiguo, decirlo una vez en la cabecera
    // es mejor que repetir "antiguo" en cada fila; si está mezclado, la
    // etiqueta por fila es la que explica cuál es cuál.
    const allLegacy = rows.length > 0 && rows.every(k => moodInfo(k).legacy);
    const anyCurrent = rows.some(k => !moodInfo(k).legacy);
    breakdown.innerHTML = rows.length
      ? `<h4>Emociones marcadas <span class="moods-breakdown-note">sobre ${emotionBase} marcas${allLegacy ? ' · estados antiguos' : ''}</span></h4>` + rows.map(k => {
        const count = counts[k];
        const pct = Math.round(count / emotionBase * 100);
        const info = moodInfo(k);
        const tag = info.legacy && anyCurrent ? ' <span class="moods-bar-legacy">antiguo</span>' : '';
        return `<div class="moods-bar-row" title="${esc(info.label)}: ${count} de ${emotionBase} (${pct} %)${info.legacy ? ' · estado antiguo' : ''}">
          <span class="moods-bar-label">${esc(info.emoji)} ${esc(info.label)}${tag}</span>
          <div class="moods-bar-track"><div class="moods-bar-fill mood-${moodBarClass(k)}" style="width:${pct}%"></div></div>
          <span class="moods-bar-pct">${count} · ${pct}%</span>
        </div>`;
      }).join('')
      : '';
    return true;
  }

  // ==========================================
  // 3. USUARIOS
  // ==========================================
  let userSearchQuery = '';
  let userDetailRequest = 0;

  async function loadUsuarios() {
    const token = sectionToken;
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.users} Usuarios <span class="admin-count-badge" id="adminUserCount"></span></h2>
          <button type="button" class="admin-btn-ghost" id="refreshUsers" title="Actualizar" aria-label="Actualizar usuarios">${UI.refresh}</button>
        </div>
        <p class="admin-section-hint">Estado de las cuentas y actividad registrada de los últimos 30 días.</p>
        <div class="admin-search"><input type="search" id="userSearch" class="admin-search-input" placeholder="Buscar usuarios…" aria-label="Buscar usuarios"></div>
        <p class="admin-data-note" id="adminUserStatus" role="status" hidden></p>
        <div class="admin-list" id="userList">${skeletonCard('56px')}${skeletonCard('56px')}</div>
      </section>
    `;

    const search = page.querySelector('#userSearch');
    const list = page.querySelector('#userList');
    const status = page.querySelector('#adminUserStatus');
    const counter = page.querySelector('#adminUserCount');
    const refresh = page.querySelector('#refreshUsers');
    let users = null;
    let moodStats = null;
    let visitStats = null;
    let loadRequest = 0;
    const changes = new Set();
    search.value = userSearchQuery;

    function paint() {
      if (!users) return;
      const query = search.value.trim();
      const filtered = users.filter(user => [user.email, user.name, user.role]
        .some(value => String(value || '').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))));
      list.innerHTML = renderUsers(filtered, moodStats, visitStats, query);
      counter.textContent = String(filtered.length);
      for (const button of list.querySelectorAll('[data-action][data-user-id]')) {
        if (changes.has(button.dataset.userId)) button.disabled = true;
      }
    }

    async function fetchUsers() {
      const request = ++loadRequest;
      const today = todayISO();
      const from = shiftStatsDay(today, -29);
      refresh.disabled = true;
      const [accounts, moods, visits] = await Promise.allSettled([
        db.readAdminUsers(), db.readAdminMoods({ from, through: today }), db.readAdminVisits({ from, through: today }),
      ]);
      if (!isCurrentSection(token) || request !== loadRequest) return;
      refresh.disabled = false;
      const notices = [];
      if (accounts.status === 'fulfilled') {
        users = accounts.value.rows;
        if (accounts.value.truncated || accounts.value.source === 'local') notices.push('Lista parcial de cuentas.');
      } else {
        notices.push('No se pudo actualizar la lista de cuentas.');
        if (!users) list.replaceChildren();
      }
      if (visits.status === 'fulfilled') {
        visitStats = userUsage(buildSessions(visits.value.rows.filter(v => !isOpenWhenReadVisit(v))));
        if (visits.value.truncated || visits.value.source === 'local') notices.push('El recuento de visitas es parcial.');
      } else {
        visitStats = null;
        notices.push('Visitas no disponibles.');
      }
      if (moods.status === 'fulfilled') {
        moodStats = Object.create(null);
        for (const row of moods.value.rows) {
          const items = moodRowItems(row);
          if (!items.length) continue;
          const stat = moodStats[row.user_id] ??= { total: 0, emotions: 0, moods: {}, lastDate: '' };
          stat.total++;
          for (const item of items) {
            const key = moodAggKey(item);
            stat.moods[key] = (stat.moods[key] || 0) + 1;
            stat.emotions++;
          }
          if (row.date > stat.lastDate) stat.lastDate = row.date;
        }
        if (moods.value.truncated || moods.value.source === 'local') notices.push('El recuento de ánimos es parcial.');
      } else {
        moodStats = null;
        notices.push('Registros de ánimo no disponibles.');
      }
      status.textContent = notices.join(' ');
      status.hidden = !notices.length;
      paint();
    }

    activeRefresh = fetchUsers;
    refresh.addEventListener('click', () => void fetchUsers());
    search.addEventListener('input', () => {
      userSearchQuery = search.value;
      paint();
    });
    list.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      const row = event.target.closest('[data-user-id]');
      const target = users?.find(account => account.id === row?.dataset.userId);
      if (!target) return;
      const action = button?.dataset.action;
      if (!action || action === 'detail') {
        await showUserDetail(target, moodStats?.[target.id], visitStats, moodStats !== null);
        return;
      }
      if (target.id === user?.id || changes.has(target.id)) return;
      if (action === 'delete-user') {
        modal.open(
          'Eliminar usuario',
          `<p>¿Seguro que quieres eliminar a <strong>${esc(target.name || target.email || 'este usuario')}</strong>? Esta acción no se puede deshacer.</p>`,
          async () => {
            const result = await db.deleteUser(target.id);
            if (isCurrentSection(token)) {
              users = users.filter(account => account.id !== target.id);
              paint();
              showToast(result.warning || 'Usuario eliminado', result.warning ? 'info' : 'success');
              void fetchUsers();
            }
            return true;
          },
          'Eliminar',
        );
        return;
      }
      if (action !== 'toggle') return;
      changes.add(target.id);
      button.disabled = true;
      const enabled = target.enabled === false;
      try {
        const result = await db.saveUser(target.id, { enabled });
        void db.logActivity('user_updated', `${enabled ? 'Habilitado' : 'Deshabilitado'}: ${target.name || target.email || target.id}`);
        if (!isCurrentSection(token)) return;
        users = users.map(account => account.id === target.id ? { ...account, enabled } : account);
        showToast(result.warning || (enabled ? 'Usuario habilitado' : 'Usuario deshabilitado'), result.warning ? 'info' : 'success');
        void fetchUsers();
      } catch (error) {
        if (isCurrentSection(token)) showToast(error?.message || 'No se pudo cambiar el estado de la cuenta.', 'error');
      } finally {
        changes.delete(target.id);
        if (isCurrentSection(token)) paint();
      }
    });

    await fetchUsers();
  }

  function renderUsers(users, moodStats, visitStats, query = '') {
    if (users.length === 0) {
      // Sin esto, al buscar sin coincidencias ponía "No hay usuarios" y
      // parecía que la cuenta había desaparecido.
      return query
        ? `<div class="admin-empty">Ningún usuario coincide con «${esc(query)}»</div>`
        : '<div class="admin-empty">No hay usuarios</div>';
    }
    return users.map((u) => {
      const initial = esc((u.name||u.email||'?').charAt(0).toUpperCase());
      const enabled = u.enabled !== false;
      const vs = visitStats?.[u.id];
      const lastVisit = !visitStats ? 'No disponible' : vs?.lastTs ? relTimeShort(vs.lastTs) : 'Sin visitas en 30 días';
      const stats = moodStats?.[u.id];
      const moodBadge = stats && stats.total > 0
        ? getMoodSummaryBadge(stats)
        : `<span class="user-mood-none">${moodStats ? 'Sin registros de ánimo en 30 días' : 'Registros de ánimo no disponibles'}</span>`;
      // La fecha del último ánimo va en la línea de estado, no como tercera
      // etiqueta: con las tres en la misma fila la tarjeta se partía en tres
      // renglones y quedaba desproporcionada.
      const moodLast = stats && stats.lastDate
        ? `<span class="user-status-sep">·</span> Último ánimo: ${relTimeShort(new Date(stats.lastDate + 'T12:00:00').getTime())}`
        : '';

      return `<div class="admin-list-item" data-user-id="${esc(u.id)}" style="cursor:pointer">
        <div class="user-avatar-sm">
          ${u.photo
            ? `<img src="${esc(u.photo)}" class="user-avatar-img" alt="">
               `
            : `<div class="user-avatar-placeholder">${initial}</div>`
          }
        </div>
        <div style="flex:1;min-width:0">
          <div class="item-title">${esc(u.name||'Sin nombre')}
            ${u.role === 'admin' ? '<span class="admin-badge-tag">Peluche</span>' : ''}
            ${enabled ? '' : '<span class="admin-badge-tag warn">Deshabilitado</span>'}
          </div>
          <div class="item-sub">
            <span class="user-email">${u.email ? esc(u.email) : 'ID: ' + esc(u.id.slice(0,12)) + '…'}</span>
            <span class="user-chips">
              ${vs?.count ? `<span class="user-chip" title="Visitas registradas">👁 ${vs.count}</span>` : ''}
              <span class="user-chip${enabled ? '' : ' off'}" title="${enabled ? 'Cuenta habilitada' : 'Cuenta deshabilitada'}">${enabled ? '🟢' : '🔴'} ${enabled ? 'Activo' : 'Inactivo'}</span>
            </span>
          </div>
          <div class="user-status-line">
            Última visita: ${lastVisit}
            ${moodLast}
          </div>
          <div class="user-mood-row">${moodBadge}</div>
        </div>
        <div class="item-actions">
          <button type="button" class="item-action-btn" data-action="detail" data-user-id="${esc(u.id)}" title="Ver detalle" aria-label="Ver detalle de ${esc(u.name || u.email || 'este usuario')}">${UI.users}</button>
          ${u.id === user?.id ? '' : `<button type="button" class="item-action-btn" data-action="toggle" data-user-id="${esc(u.id)}" title="${enabled ? 'Deshabilitar' : 'Habilitar'} usuario" aria-label="${enabled ? 'Deshabilitar' : 'Habilitar'} a ${esc(u.name || u.email || 'este usuario')}">
            ${enabled ? UI.toggleOn : UI.toggleOff}
          </button>
          <button type="button" class="item-action-btn delete" data-action="delete-user" data-user-id="${esc(u.id)}" title="Eliminar usuario" aria-label="Eliminar a ${esc(u.name || u.email || 'este usuario')}">${UI.trash}</button>`}
        </div>
      </div>`;
    }).join('');
  }

  function getMoodSummaryBadge(stats) {
    if (!stats || stats.total === 0) return '';
    // Con empate se nombraba solo el primero que aparecía: "Principal: 50 %"
    // sin decir de qué, y además a la carta entre dos estados igualados.
    const max = Math.max(...Object.values(stats.moods));
    const tops = Object.entries(stats.moods).filter(([, n]) => n === max);
    // Base de emociones, no de registros: con varias emociones por día los
    // porcentajes sobre el total de filas mentían.
    const emoBase = stats.emotions || stats.total;
    const pct = Math.round(max / emoBase * 100);
    const topFaces = tops.map(([id]) => moodInfo(id).emoji).join('');
    const topNames = tops.map(([id]) => moodInfo(id).label).join(' / ');
    // Línea de texto y no etiquetas: la columna mide ~250 px (los botones de
    // acción reservan 72 px aunque solo aparezcan al pasar el ratón) y dos
    // etiquetas inevitably se partían en dos renglones descuadrados.
    const topText = tops.length === 1
      ? `${esc(moodInfo(tops[0][0]).label)} <span class="user-mood-pct">(${pct} %)</span>`
      : `<strong>${tops.length} estados</strong> empatados <span class="user-mood-pct">(${pct} %)</span>`;
    return `<span class="user-mood-line"
      title="Ánimo más repetido: ${esc(topNames)} — ${max} de ${emoBase} emociones (${pct} %)">
      ${esc(topFaces)} <strong>${stats.total}</strong> ${stats.total === 1 ? 'registro' : 'registros'} · ${topText}
    </span>`;
  }

  async function showUserDetail(user, stats, visitStats, moodAvailable) {
    const token = sectionToken;
    const request = ++userDetailRequest;
    const initial = esc((user.name||user.email||'?').charAt(0).toUpperCase());
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString('es') : '—';
    const vs = visitStats?.[user.id];
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('es', { timeZone: 'Europe/Madrid' }) : '—';

    // Actividad de uso: dónde pasa más tiempo y última conexión.
    let useHtml = `<p class="muted-text">${visitStats ? 'Sin visitas en los últimos 30 días.' : 'No se pudo consultar la actividad de uso.'}</p>`;
    if (vs && vs.count > 0) {
      const top = Object.entries(vs.msBySection).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const maxMs = Math.max(...top.map(t => t[1]), 1);
      const totalMs = Object.values(vs.msBySection).reduce((a, b) => a + b, 0);
      const rows = top.length
        ? top.map(([bp, ms]) => `
          <div class="moods-bar-row">
            <span class="moods-bar-label" style="min-width:130px">${esc(labelForPath(bp))}</span>
            <div class="moods-bar-track"><div class="moods-bar-fill mood-good" style="width:${Math.round(ms / maxMs * 100)}%"></div></div>
            <span class="moods-bar-pct">${fmtDuration(ms)}</span>
          </div>`).join('')
        : '<div class="muted-text">Todavía sin tiempo acumulado por sección</div>';
      useHtml = `
        <div class="user-mood-summary-card" style="margin-bottom:12px">
          <div><strong>${vs.count}</strong><div class="muted-text">Visitas</div></div>
          <div><strong>${fmtDuration(totalMs)}</strong><div class="muted-text">Tiempo estimado</div></div>
          <div><strong>${new Date(vs.lastTs).toLocaleDateString('es', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong><div class="muted-text">Última visita</div></div>
        </div>
        ${rows}`;
    }

    let moodHtml = `<p class="muted-text">${moodAvailable ? 'Sin registros de ánimo en los últimos 30 días.' : 'No se pudieron consultar los registros de ánimo.'}</p>`;
    if (stats && stats.total > 0) {
      const order = Object.keys(stats.moods).sort((a, b) => moodRank(a) - moodRank(b));
      const detailBase = stats.emotions || stats.total;
      const rows = order.map(k => {
        const count = stats.moods[k] || 0;
        const pct = Math.round(count / detailBase * 100);
        if (count === 0) return '';
        const info = moodInfo(k);
        return `<div class="moods-bar-row">
          <span class="moods-bar-label" style="min-width:140px">${esc(info.emoji)} ${esc(info.label)}</span>
          <div class="moods-bar-track"><div class="moods-bar-fill mood-${moodBarClass(k)}" style="width:${pct}%"></div></div>
          <span class="moods-bar-pct">${count} (${pct}%)</span>
        </div>`;
      }).filter(Boolean).join('');

      const avgScore = order.reduce((sum, k) => sum + (moodInfo(k).score || 0) * (stats.moods[k] || 0), 0) / detailBase;
      const displayScore = avgScore.toLocaleString('es', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

      moodHtml = `
        <div class="user-mood-summary">
          <div class="user-mood-summary-card">
            <div>
              <strong>${stats.total}</strong>
              <div class="muted-text">Total registros</div>
            </div>
            <div>
              <strong>${displayScore}/4</strong>
              <div class="muted-text">Puntuación media por emoción</div>
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

    const result = await safe(db.readAdminMoods({ userId: user.id, limit: 120 }), null);
    if (!isCurrentSection(token) || request !== userDetailRequest || modal.visible) return;
    const history = result?.rows || [];
    let historyHtml;
    if (!result) {
      historyHtml = '<p class="admin-data-note" role="status">No se pudo consultar el historial de ánimo.</p>';
    } else if (history.length === 0) {
      historyHtml = '<p style="color:var(--theme-text-secondary);font-size:0.82rem;margin-bottom:12px;">Sin historial de ánimo</p>';
    } else {
      const rows = history.map(m => {
        const dateStr = new Date(m.date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
        const labels = moodRowItems(m).map(item => `${item.emoji} ${item.label}`).join(' · ');
        return `<div class="moods-bar-row" style="margin-bottom:6px;">
          <span class="moods-bar-label" style="min-width:120px">${dateStr}</span>
          <span style="font-size:0.82rem;color:var(--theme-text-secondary);">${esc(labels || 'Registro sin detalle')}</span>
        </div>`;
      }).join('');
      historyHtml = `<div style="max-height:240px;overflow-y:auto;margin-top:12px;">${rows}</div>
        ${result.truncated ? '<p class="admin-data-note">Se muestran los 120 registros más recientes.</p>' : ''}`;
    }

    modal.open(user.name || user.email || 'Usuario', `
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
            <span style="font-size:0.82rem;color:var(--theme-text-secondary);">${esc(user.email || 'ID: ' + user.id)}</span>
          </div>
          <span style="margin-left:auto;font-size:0.72rem;padding:3px 12px;border-radius:30px;background:${user.role === 'admin' ? 'var(--accent-dim)' : 'var(--theme-surface)'};color:${user.role === 'admin' ? 'var(--theme-accent)' : 'var(--theme-text-secondary)'};">${user.role === 'admin' ? 'Administrador' : 'Usuario'}</span>
        </div>

        <div class="admin-field">
          <p><strong>ID:</strong> ${esc(user.id)}</p>
          <p><strong>Creado:</strong> ${created}</p>
          <p><strong>Último inicio de sesión:</strong> ${lastLogin}</p>
          <p><strong>Estado:</strong> ${user.enabled !== false ? '🟢 Activo' : '🔴 Inactivo'}</p>
        </div>

        <hr style="opacity:0.2;margin:12px 0;">
        <h3 style="font-size:1rem;margin:0 0 12px;">${UI.activity} Actividad de uso · 30 días</h3>
        ${useHtml}

        <hr style="opacity:0.2;margin:12px 0;">
        <h3 style="font-size:1rem;margin:0 0 12px;">${UI.heart} Resumen de ánimo · 30 días</h3>
        ${moodHtml}
        <h3 style="font-size:1rem;margin:24px 0 12px;">${UI.heart} Historial de ánimo</h3>
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
        <div class="admin-section-header">
          <h2>${UI.content} Gestión de Contenido</h2>
          <button type="button" class="admin-btn-ghost" id="refreshContent" aria-label="Actualizar contenido">${UI.refresh}</button>
        </div>
        <p class="admin-section-hint">${SECTION_HINTS.contenido}</p>
        <div class="admin-tabs" id="contentSubTabs" role="group" aria-label="Categoría de contenido" style="margin-bottom:16px">
          ${CONTENT_SUBS.map(t => `<button type="button" class="admin-tab${t.id === (S.contentSub || 'razones') ? ' active' : ''}" aria-pressed="${t.id === (S.contentSub || 'razones')}" data-content="${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')}
        </div>
        <div id="contentSubContent">${skeletonCard('200px')}</div>
      </section>
    `;

    page.querySelectorAll('#contentSubTabs .admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('#contentSubTabs .admin-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
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
    page.querySelector('#refreshContent')?.addEventListener('click', () => loadContentSub(S.contentSub));
    return loadContentSub(S.contentSub);
  }

  async function editableList(id, key, fallback = []) {
    const snapshot = await db.getAdminContentSnapshot(id);
    const value = snapshot.data?.[key];
    if (value != null && !Array.isArray(value)) throw new Error('La lista guardada tiene un formato desconocido.');
    return {
      items: value ?? fallback,
      save: next => db.saveAdminContent(snapshot, { ...snapshot.data, [key]: next })
    };
  }

  async function readCalendarSeed() {
    const res = await fetch('/data/gifts.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('No se pudo leer el calendario base.');
    return expandCalendarCatalog(await res.json());
  }

  const CONTENT_LOADERS = {
    razones:   async () => ({ title: 'Razones', ...await editableList('razones', 'reasons') }),
    canciones: async () => ({ title: 'Canciones', ...await editableList('canciones', 'songs') }),
    noticias:  async () => ({ title: 'Noticias', ...await editableList('noticias', 'news') }),
    series:    async () => ({ title: 'Series', ...await editableList('series', 'series', defaultCatalog()) }),
    regalos:   async () => {
      const snapshot = await db.getAdminContentSnapshot('gifts');
      const saved = snapshot.data;
      const initialRow = Array.isArray(saved?.gifts) && !saved.gifts.length
        && saved.months && !Object.keys(saved.months).length && !saved.version;
      const catalog = !snapshot.exists || initialRow ? await readCalendarSeed() : structuredClone(saved);
      if (!Array.isArray(catalog?.gifts) || !catalog.months || typeof catalog.months !== 'object') {
        throw new Error('El catálogo de regalos guardado tiene un formato desconocido.');
      }
      if (catalog.gifts.length && Number(catalog.version) < 5) expandCalendarCatalog(catalog);
      return { catalog, save: next => db.saveAdminContent(snapshot, next) };
    },
    maldia:    async () => {
      const [frases, mensajes, notes] = await Promise.all([
        editableList('maldia_frases', 'phrases'),
        editableList('maldia_mensajes', 'messages'),
        db.getAllMaldiaNotes()
      ]);
      return { frases: frases.items, mensajes: mensajes.items, notes, saveFrases: frases.save, saveMensajes: mensajes.save };
    },
    audios:    async () => ({
      title: 'Audios',
      ...await editableList('audios', 'audios')
    }),
    openwhen:  async () => ({
      title: 'Open When',
      ...await editableList('openwhen_letters', 'letters'),
      staticLetters: LETTERS
    })
  };

  let contentLoadId = 0;
  const contentSearchByTab = new Map();
  async function loadContentSub(id) {
    const token = sectionToken;
    const loadId = ++contentLoadId;
    const sub = page.querySelector('#contentSubContent');
    const loader = CONTENT_LOADERS[id];
    if (!sub || !loader) return;
    const isCurrent = () => token === sectionToken && loadId === contentLoadId
      && page.querySelector('#contentSubContent') === sub;
    sub.setAttribute('aria-busy', 'true');
    sub.innerHTML = skeletonCard('120px');
    let data;
    try {
      data = await loader();
    } catch (err) {
      if (!isCurrent()) return;
      sub.innerHTML = `<div class="admin-empty" role="alert">
        <p>No se pudo cargar el contenido. ${esc(err?.message || '')}</p>
        <button type="button" class="admin-btn admin-btn-sm" id="retryContent">Reintentar</button>
      </div>`;
      sub.querySelector('#retryContent').addEventListener('click', () => loadContentSub(id));
      return;
    } finally {
      if (isCurrent()) sub.setAttribute('aria-busy', 'false');
    }
    if (!isCurrent()) return;

    if (id === 'maldia') {
      const notes = Array.isArray(data.notes) ? data.notes : [];
      const openNotes = () => {
        if (!notes.length) {
          modal.open('💌 Notas de Mal Día', '<p style="margin:0;color:var(--theme-text-secondary);">Todavía no hay notas. Cuando ella escriba una desde la sección Mal Día, aparecerá aquí.</p>');
          return;
        }
        modal.open('💌 Notas de Mal Día', `<div class="gift-responses-list">${notes.map(maldiaNoteCardHtml).join('')}</div>`);
      };

      sub.innerHTML = `
        <div class="admin-subsection">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h4>Notas recibidas (${notes.length})</h4>
            ${notes.length > 8 ? `<button class="admin-btn admin-btn-sm" id="viewAllMaldiaNotes">💌 Ver todas</button>` : ''}
          </div>
          ${notes.length
            ? `<div class="gift-responses-list">${notes.slice(0, 8).map(maldiaNoteCardHtml).join('')}</div>`
            : '<div class="admin-empty">Todavía no hay notas. Cuando ella escriba una desde la sección Mal Día, aparecerá aquí.</div>'}
        </div>
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

      // Notas que la usuaria deja desde Mal Día (llegan directas al Admin):
      // las N más recientes ya se ven en línea; el modal muestra todas.
      page.querySelector('#viewMaldiaNotes')?.addEventListener('click', openNotes);
      page.querySelector('#viewAllMaldiaNotes')?.addEventListener('click', openNotes);
    } else if (id === 'series') {
      // Catálogo unificado con la sección Series (misma fuente local)
      renderSeriesAdmin(sub, data.items, data.save, loadContentSub);
    } else if (id === 'openwhen') {
      renderOpenWhenAdmin(sub, data);
    } else if (id === 'regalos') {
      renderCalendarAdmin(sub, data);
    } else {
      const items = data.items || [];
      sub.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);" id="contentItemCount">${items.length} elemento${items.length === 1 ? '' : 's'}</span>
          <div style="display:flex;gap:8px;">
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
      const applySearch = () => {
        const raw = searchInput.value.trim();
        contentSearchByTab.set(id, searchInput.value);
        const q = raw.toLowerCase();
        const indexed = items.map((item, i) => ({ item, i }));
        // Antes comparaba contra JSON.stringify(item) entero: buscar "id" o
        // un trozo de URL devolvía todo, y cosas que no se ven en la lista
        // (ids internos, flags) también coincidian. Ahora se busca solo en
        // los campos que se ven.
        const filtered = q
          ? indexed.filter(({ item, i }) => {
            const label = String(contentItemLabel(item, id, i)).toLowerCase();
            const extra = [
              item?.artist, item?.creator, item?.text, item?.reason,
              item?.date ? fmtContentDate(item.date) : '', item?.description, item?.content
            ].filter(Boolean).join(' ').toLowerCase();
            return label.includes(q) || extra.includes(q);
          })
          : indexed;
        listEl.innerHTML = renderContentItemsIndexed(filtered, id, raw);
        countEl.textContent = q
          ? `${filtered.length} de ${items.length} elemento${items.length === 1 ? '' : 's'}`
          : `${items.length} elemento${items.length === 1 ? '' : 's'}`;
      };
      if (searchInput) {
        searchInput.value = contentSearchByTab.get(id) || '';
        searchInput.addEventListener('input', applySearch);
        applySearch();
      }
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
          <div class="upload-item-meta">${kindLabel(u.kind)}${u.size ? ' · ' + formatBytes(u.size) : ''}${u.date ? ' · ' + esc(relTimeShort(new Date(u.date).getTime())) : ''}</div>
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
    `).join('') || '<div class="admin-empty">Todavía no has subido ningún archivo desde este navegador.</div>';
  }

  async function loadMultimedia() {
    const token = sectionToken;

    // Cada sección gestiona su propia subida: el archivo va directo al bucket
    // correcto de Supabase y aparece en esa sección de la app al momento.
    // El límite sale de UPLOAD_LIMITS (mismo que usa el servicio): el texto y
    // la comprobación previa no pueden contradecir a lo que acepta el bucket.
    const SECTIONS = [
      {
        id: 'galeria', icon: '🖼️', title: 'Galería',
        desc: `Fotos (máx. ${UPLOAD_LIMITS.galeria} MB c/u) — aparecen al instante en la Galería de la app.`,
        accept: 'image/*', route: '/galeria', maxMB: UPLOAD_LIMITS.galeria, maxBytes: UPLOAD_LIMITS.galeria * 1024 * 1024,
        uploadFn: (files) => db.uploadGalleryPhotos(files)
      },
      {
        id: 'memes', icon: '😂', title: 'Memes',
        desc: `Imágenes y vídeos (máx. ${UPLOAD_LIMITS.memes} MB) — aparecen al instante en Memes.`,
        accept: 'image/*,video/*', route: '/memes', maxMB: UPLOAD_LIMITS.memes, maxBytes: UPLOAD_LIMITS.memes * 1024 * 1024,
        uploadFn: (files) => db.uploadMemes(files)
      },
      {
        id: 'audios', icon: '🎙️', title: 'Audios',
        desc: `Notas de voz (máx. ${UPLOAD_LIMITS.audios} MB) — aparecen al instante en Audios del Rincón.`,
        accept: 'audio/*', route: '/audios', maxMB: UPLOAD_LIMITS.audios, maxBytes: UPLOAD_LIMITS.audios * 1024 * 1024,
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
        <p class="admin-section-hint admin-section-hint--wide">${SECTION_HINTS.multimedia}</p>

        <div class="admin-upload-grid">
          ${sections.map(s => `
            <div class="admin-panel upload-panel">
              <div class="admin-panel-head">
                <h4>${s.icon} ${s.title}</h4>
                <a class="admin-btn admin-btn-ghost admin-btn-sm" href="#${s.route}" rel="noopener">${UI.link} Abrir sección</a>
              </div>
              <div class="upload-panel-body">
                <div>
                  <p class="muted-text">${s.desc}</p>
                  <div class="upload-dropzone" data-dropzone="${s.id}" role="button" tabindex="0"
                       aria-label="Subir archivos a ${s.title}: arrastra aquí o pulsa para elegir">
                    <div class="upload-dropzone-icon">${UI.cloud}</div>
                    <div class="upload-dropzone-title">Arrastra archivos aquí o toca para elegir</div>
                    <div class="upload-dropzone-sub">${s.id === 'galeria' ? 'Fotos' : s.id === 'memes' ? 'Imágenes y vídeos' : 'Audios (mp3, m4a, ogg, wav…)'}</div>
                    <input type="file" data-input="${s.id}" multiple accept="${s.accept}" hidden>
                  </div>
                </div>
                <div class="admin-subsection">
                  <h4>Subidas recientes (${s.uploads.length})</h4>
                  <div class="upload-list" data-list="${s.id}"></div>
                </div>
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
        const incoming = [...files].filter(f => f && f.size > 0);
        if (!incoming.length) return;
        // Comprobación previa con el mismo límite que aplica el servicio: el
        // aviso salía después de empezar la subida, y arrastrar un .txt a la
        // zona de Fotos no lo frenaba el accept del input.
        const aceptados = [];
        const rechazados = [];
        incoming.forEach(file => {
          const motivo = !s.accept.split(',').some(a => {
            const tipo = a.trim().replace('*', '');
            return tipo && file.type.startsWith(tipo);
          })
            ? `${file.name}: tipo no admitido`
            : file.size > s.maxBytes
              ? `${file.name}: supera los ${s.maxMB} MB`
              : '';
          if (motivo) rechazados.push(motivo);
          else aceptados.push(file);
        });
        if (rechazados.length) showToast(rechazados[0] + (rechazados.length > 1 ? ` (+${rechazados.length - 1} más)` : ''), 'error');
        if (!aceptados.length) return;

        aceptados.forEach(file => {
          const entry = {
            name: file.name,
            size: file.size,
            kind: fileKind(file),
            status: 'uploading',
            progress: 0,
            date: new Date().toISOString(),
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
              // La fecha es la de cada subida. Antes se estampaba new Date()
              // al guardar, así que todas las entradas acababan con la fecha
              // del último guardado y el historial no decía nada.
              saveUploadHistory(s.id, s.uploads.map(u => ({
                name: u.name, size: u.size, kind: u.kind,
                secure_url: u.secure_url, date: u.date || new Date().toISOString()
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
      // La zona es un div con click: sin esto solo se podía usar con ratón.
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          input.click();
        }
      });
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

  // Abre siempre en el mes en curso: antes elegía el último mes del catálogo
  // y se abría un mes que no era el que estaba viviendo (y en el que ya no
  // se podía crear contenido sin pulsar «Hoy»).
  function calDefaultMonth() {
    return calTodayStr().slice(0, 7);
  }

  function renderCalendarAdmin(sub, data) {
    const catalog = data.catalog || {};
    const giftsById = {};
    (catalog.gifts || []).forEach(g => { if (g?.id) giftsById[g.id] = g; });

    // No se exige que el mes exista en el catálogo: los meses vacíos también
    // se pueden abrir, y ahí se crea contenido nuevo.
    if (!S.calMonth) S.calMonth = calDefaultMonth();
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
    // Siempre hay un día elegido, aunque el mes esté vacío: el panel de abajo
    // es el único sitio desde el que se puede añadir contenido.
    if (!S.calDay || S.calDay > daysInMonth) {
      const today = calTodayStr();
      const sameMonth = today.startsWith(monthKey);
      S.calDay = (sameMonth ? Number(today.slice(8)) : null) || dayRows.find(r => !r.empty)?.day || 1;
    }
    const selDay = S.calDay;
    const selIds = selDay ? calToIds(mapping[String(selDay)]).filter(id => giftsById[id]) : [];
    const selDateStr = `${monthKey}-${calPad(selDay)}`;

    const totalGifts = (catalog.gifts || []).length;
    const daysWithContent = dayRows.filter(r => !r.empty).length;

    // Hueco del primer día para que cada fecha caiga en su día de la semana
    // (semana de lunes a domingo, como el resto de la app) y marca de hoy.
    const firstDow = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1).getDay();
    const leadBlanks = (firstDow + 6) % 7;
    const todayKey = calTodayStr();

    sub.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap;">
        <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);" id="calAdminCount">${daysWithContent} de ${daysInMonth} días con contenido · ${totalGifts} contenidos</span>
        <div style="display:flex;gap:8px;">
          <button class="admin-btn admin-btn-sm" id="calAdminRebuild" title="Regenera el calendario desde el esqueleto base (agosto empieza el 15, juegos en días seguidos)">♻️ Regenerar</button>
          <button class="admin-btn admin-btn-sm" id="calAdminResponses">💌 Respuestas</button>
        </div>
      </div>

      <div class="admin-cal-nav">
        <button class="admin-btn admin-btn-sm admin-btn-ghost" id="calAdminPrev" aria-label="Mes anterior">‹</button>
        <span class="admin-cal-nav__label" id="calAdminMonthLabel">${esc(calMonthLabel(monthKey))}</span>
        <button class="admin-btn admin-btn-sm admin-btn-ghost" id="calAdminNext" aria-label="Mes siguiente">›</button>
        <button class="admin-btn admin-btn-sm admin-btn-secondary" id="calAdminToday">Hoy</button>
      </div>

      <div class="admin-cal-week" aria-hidden="true">
        ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join('')}
      </div>
      <div class="admin-cal-grid" id="calAdminGrid">
        ${'<span class="admin-cal-day is-blank" aria-hidden="true"></span>'.repeat(leadBlanks)}
        ${dayRows.map(({ day, ids, empty }) => `
          <button class="admin-cal-day${empty ? ' is-empty' : ''}${day === selDay ? ' is-selected' : ''}${`${monthKey}-${calPad(day)}` === todayKey ? ' is-today' : ''}" data-day="${day}"
            title="${day} · ${empty ? 'sin contenido' : `${ids.length} contenido${ids.length === 1 ? '' : 's'}`}">
            <span class="admin-cal-day__num">${day}</span>
            ${empty ? '' : `
              <span class="admin-cal-day__types">${ids.map(id => CAL_TYPES[giftsById[id]?.type]?.emoji || '✨').join('')}</span>
              <span class="admin-cal-day__count">${ids.length}</span>
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
    page.querySelectorAll('#calAdminGrid .admin-cal-day[data-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        S.calDay = Number(btn.dataset.day);
        renderCalendarAdmin(sub, data);
      });
    });

    // Respuestas (mismo modal que la lista genérica)
    page.querySelector('#calAdminResponses').onclick = () => openGiftResponses('regalos', catalog.gifts || []);

    // Regenerar desde el esqueleto base: reconstruye el calendario desde
    // gifts.json (se mantiene julio, agosto empieza el 15 y los juegos van en
    // días consecutivos). Los contenidos personalizados de agosto en adelante
    // se pierden; por eso pide confirmación.
    page.querySelector('#calAdminRebuild').onclick = () => {
      modal.open(
        '♻️ Regenerar calendario',
        '<p style="margin:0;">Se reconstruirá el calendario desde el esqueleto base:<br>· Agosto empieza el <strong>15</strong><br>· Los <strong>juegos</strong> (solo los que no se desbloquearon en julio) van en días consecutivos (15 ago → 23 ago), <strong>solo el juego</strong> esos días<br>· Cuando se acaban los juegos, sigue el resto de contenidos<br><br>Se conserva <strong>julio</strong> tal cual. Los contenidos personalizados de agosto en adelante se eliminarán. ¿Continuar?</p>',
        async () => {
          await data.save(await readCalendarSeed());
        },
        'Regenerar'
      );
    };

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
          'Eliminar contenido',
          `<p style="margin:0;">¿Seguro que quieres eliminar <strong>${esc(g.title || 'este contenido')}</strong> del día ${esc(selDateStr)}? Esta acción no se puede deshacer.</p>`,
          async () => {
            const nextIds = selIds.filter(id => id !== g.id);
            const nextMonths = structuredClone(catalog.months || {});
            const m = nextMonths[monthKey] || { calendarMapping: {} };
            if (nextIds.length === 0) delete m.calendarMapping[String(selDay)];
            else if (nextIds.length === 1) m.calendarMapping[String(selDay)] = nextIds[0];
            else m.calendarMapping[String(selDay)] = nextIds;
            nextMonths[monthKey] = m;
            const nextGifts = (catalog.gifts || []).filter(x => x.id !== g.id);
            const next = { version: catalog.version, months: nextMonths, gifts: nextGifts };
            await data.save(next);
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
      // math usa `problem`, no `question`: no hay pregunta que hacerle. riddle
      // si la tiene y su historico de respuestas debe seguir editandose.
      if (type === 'math') return baseFields(type);
      return [...baseFields(type), ['question', 'Pregunta para ella (opcional) 💌', 'textarea']];
    };

    const baseFields = (type) => {
      switch (type) {
        case 'letter':     return [['message', 'Contenido de la carta', 'textarea']];
        case 'affirmation':return [['message', 'Mensaje', 'textarea']];
        case 'riddle':     return [['question', 'Pregunta / acertijo (soporta LaTeX)', 'textarea'], ['answer', 'Respuesta (soporta LaTeX)', 'textarea']];
        case 'curiosity':  return [['fact', 'Dato curioso', 'textarea']];
        case 'relax':      return [['message', 'Instrucciones de desconexión', 'textarea']];
        case 'challenge':  return [['message', 'El reto', 'textarea'], ['instructions', 'Instrucciones', 'textarea']];

        case 'polaroid':   return [['image', 'URL de la foto', 'text'], ['caption', 'Pie de foto', 'text']];
        case 'video':      return [['videoUrl', 'URL del vídeo', 'text'], ['caption', 'Descripción', 'text'], ['poster', 'URL de portada (opcional)', 'text']];
        case 'surprise':   return [['message', 'La sorpresa', 'textarea']];
        case 'craft':      return [['message', 'Descripción', 'textarea'], ['pdfUrl', 'URL del PDF', 'text']];
        case 'giftBox':    return [['message', 'Mensaje', 'textarea'], ['image', 'URL de imagen (opcional)', 'text']];
        case 'game':       return [['redirectUrl', 'URL del juego', 'text'], ['message', 'Mensaje', 'textarea']];
        case 'math':       return [['problem', 'Problema (soporta LaTeX: $inline$, $$bloque$$)', 'textarea'], ['solution', 'Solución paso a paso (usa LaTeX y markdown)', 'textarea'], ['answer', 'Resultado final (opcional)', 'text']];
        case 'cassette':   return [['message', 'Título / nota', 'text'], ['audioUrl', 'URL del audio', 'text']];
        case 'clickStar':  return [['message', 'Mensaje', 'textarea']];
        case 'quiz':       return [['message', 'Mensaje', 'textarea']];
        default:           return [['message', 'Contenido', 'textarea']];
      }
    };

    const fields = fieldByType(gift?.type || 'letter');

    modal.open(
      `${isNew ? 'Nuevo contenido' : 'Editar contenido'} · ${dateStr}`,
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

        // Se parte de los datos que YA había y se sobrescriben solo los campos
        // del tipo. Antes se construía desde cero y cualquier clave que el
        // formulario no conociera se perdía al guardar: las cartas tienen su
        // texto en `message` y el formulario ofrecía `content`, así que abrir
        // una carta en el panel y guardar le vaciaba el texto. Si cambia el
        // tipo, en cambio, se empieza de cero, que es lo que quiere.
        const payloadData = (!isNew && gift && type === gift.type && gift.data)
          ? { ...gift.data }
          : {};
        fieldByType(type).forEach(([key]) => {
          const el = page.querySelector(`#calEditF_${key}`);
          if (el) payloadData[key] = el.value.trim();
        });

        const next = structuredClone(catalog);
        next.months = next.months || {};
        next.gifts = Array.isArray(next.gifts) ? next.gifts : [];
        next.version = Math.max(Number(next.version) || 0, 5);

        if (isNew) {
          // Id único garantizado. Antes sederivaba del nº de contenidos del
          // día (base, _a, _b...), lo que colisionaba en cuanto se borraba un
          // contenido o se reordenaba: el regalo nuevo pisaba a otro que ya
          // estaba guardado y el día se quedaba como estaba. Ahora se busca
          // el siguiente sufijo libre de verdad.
          const dayNum = dateStr.slice(8);
          const dayKey = String(parseInt(dayNum, 10));
          const monthKeySrc = dateStr.slice(0, 7);
          const existingIds = calToIds(next.months?.[monthKeySrc]?.calendarMapping?.[dayKey]);
          const taken = new Set((next.gifts || []).map(x => x?.id).filter(Boolean));
          let suffix = '';
          let seq = 0;
          while (taken.has(`${calGiftId(dateStr)}${suffix}`)) {
            seq += 1;
            suffix = `_${String.fromCharCode(96 + seq)}`;
          }
          const id = `${calGiftId(dateStr)}${suffix}`;
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
      // Las tres cartas escritas a mano guardan su texto en `content` y las 43
      // generadas en `message`. Se leen las dos para que salir a editarlas no
      // aparezca en blanco.
      const val = data0[key] || (key === 'message' ? data0.content : '') || '';
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
    const search = sub.querySelector('#owSearch');
    const applyFilter = () => {
      contentSearchByTab.set('openwhen', search.value);
      const q = search.value.trim().toLowerCase();
      renderList(q ? merged.filter(l => [l.title, l.note].some(value => String(value || '').toLowerCase().includes(q))) : merged);
    };
    search.value = contentSearchByTab.get('openwhen') || '';
    search.addEventListener('input', applyFilter);
    if (search.value) applyFilter();
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
            ${l.status === 'pronto' ? '<span class="admin-badge-tag">Pronto</span>' : ''}
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
    // Si la carta ya tiene un tipo fuera de la lista (álbum, nota, canción…),
    // se añade como opción para que al guardar no se cambie sin querer.
    if (letter?.type && !types.some(([v]) => v === letter.type)) {
      const m = TYPE_META[letter.type];
      types.push([letter.type, `${m?.emoji || '💌'} ${m?.label || letter.type}`]);
    }
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
      <div class="admin-field"><label>Estado</label>
        <select id="owAdminStatus">
          <option value="">Lista para ella</option>
          <option value="pronto" ${letter?.status === 'pronto' ? 'selected' : ''}>Pronto · todavía sin escribir</option>
        </select>
        <small class="admin-field-hint">«Pronto» solo lo ves tú: la carta queda en borrador y ella no la ve.</small>
      </div>
      <div class="admin-field"><label>Mensaje *</label><textarea id="owAdminMsg" rows="6" placeholder="El contenido de la carta…">${esc(letter?.message || '')}</textarea></div>
      <div class="admin-field">
        <label>Multimedia (opcional)</label>
        <select id="owAdminMediaKind">
          <option value="">Sin multimedia</option>
          <option value="audio">🎙️ Audio</option>
          <option value="album">📸 Fotos</option>
          <option value="video">🎥 Vídeo</option>
          <option value="nota">🗣️ Nota de voz (lee el mensaje)</option>
          <option value="cancion">🎵 Canción (cajita musical)</option>
        </select>
        <small class="admin-field-hint">Se muestra dentro de la carta, debajo del mensaje. Puedes subir el archivo o pegar la URL.</small>
      </div>
      <div id="owAdminMediaFields"></div>
      `,
      async () => {
        const title = page.querySelector('#owAdminTitle')?.value?.trim();
        const message = page.querySelector('#owAdminMsg')?.value?.trim();
        const status = page.querySelector('#owAdminStatus')?.value === 'pronto' ? 'pronto' : '';
        if (!title) throw new Error('El título es obligatorio');
        if (!message && !status) throw new Error('El mensaje es obligatorio (o marca la carta como Pronto)');
        const mediaKind = page.querySelector('#owAdminMediaKind')?.value || '';
        let media = null;
        if (mediaKind === 'audio' || mediaKind === 'video') {
          const url = page.querySelector('#owAdminMediaUrl')?.value?.trim();
          if (!url) throw new Error(mediaKind === 'audio' ? 'Falta la URL del audio' : 'Falta la URL del vídeo');
          media = { kind: mediaKind, url };
        } else if (mediaKind === 'album') {
          const urls = (page.querySelector('#owAdminMediaUrls')?.value || '')
            .split('\n').map(u => u.trim()).filter(Boolean);
          if (!urls.length) throw new Error('Añade al menos una foto');
          media = { kind: 'album', urls };
        } else if (mediaKind === 'nota') {
          media = { kind: 'nota' };
        } else if (mediaKind === 'cancion') {
          media = { kind: 'cancion', melody: page.querySelector('#owAdminMelody')?.value === 'alegre' ? 'alegre' : 'cuna' };
        }
        const payload = {
          id: page.querySelector('#owAdminEditId').value || createId(),
          category: page.querySelector('#owAdminCat').value,
          type: page.querySelector('#owAdminType').value,
          title,
          note: page.querySelector('#owAdminNote')?.value?.trim() || '',
          message,
          // Versión de la carta: es lo que dispara el «Actualizada» de ella.
          updatedAt: new Date().toISOString(),
          ...(status ? { status } : {}),
          ...(media ? { media } : {})
        };
        const custom = [...(data.items || [])];
        const idx = custom.findIndex(c => c?.id === payload.id);
        if (idx >= 0) custom[idx] = payload;
        else custom.push(payload);
        await data.save(custom);
        logContentAction('openwhen', isNew ? 'created' : 'updated', `${isNew ? 'Añadida' : 'Actualizada'}: ${title}`);
      }
    );

    // Campos multimedia: se pintan según el tipo elegido y se suben a
    // Supabase Storage (misma vía que Audios/Galería/Memes del panel).
    setTimeout(() => {
      const kindSel = page.querySelector('#owAdminMediaKind');
      const fieldsBox = page.querySelector('#owAdminMediaFields');
      if (!kindSel || !fieldsBox) return;
      const current = letter?.media || null;
      kindSel.value = current?.kind || '';

      const wireUpload = () => {
        const btn = fieldsBox.querySelector('#owUploadMediaBtn');
        const fileInput = fieldsBox.querySelector('#owUploadMediaFile');
        const status = fieldsBox.querySelector('.ow-media-status');
        if (!btn || !fileInput) return;
        btn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
          const files = [...fileInput.files];
          fileInput.value = '';
          if (!files.length) return;
          const kind = kindSel.value;
          btn.disabled = true;
          status.textContent = 'Subiendo…';
          try {
            const urls = kind === 'audio'
              ? await db.uploadAudios(files)
              : kind === 'video'
                ? await db.uploadMemes(files)
                : await db.uploadGalleryPhotos(files);
            if (!urls?.length) throw new Error('El archivo se subió pero no devolvió URL');
            if (kind === 'album') {
              const ta = fieldsBox.querySelector('#owAdminMediaUrls');
              const prev = ta.value ? ta.value.replace(/\n+$/, '') + '\n' : '';
              ta.value = prev + urls.join('\n');
            } else {
              fieldsBox.querySelector('#owAdminMediaUrl').value = urls[0];
            }
            status.textContent = `✓ ${urls.length} ${urls.length === 1 ? 'archivo subido' : 'archivos subidos'}`;
          } catch (err) {
            status.textContent = '⚠ ' + (err?.message || 'No se pudo subir el archivo');
          }
          btn.disabled = false;
        });
      };

      const renderFields = () => {
        const kind = kindSel.value;
        if (kind === 'audio' || kind === 'video') {
          const url = current && current.kind === kind ? (current.url || '') : '';
          const what = kind === 'audio' ? 'audio' : 'vídeo';
          fieldsBox.innerHTML = `
            <div class="admin-field">
              <label>URL del ${what}</label>
              <input type="text" id="owAdminMediaUrl" value="${esc(url)}" placeholder="${kind === 'audio' ? 'https://…mp3' : 'https://…mp4'}">
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                <button type="button" class="admin-btn admin-btn-sm" id="owUploadMediaBtn">${UI.cloud} Subir ${what}</button>
                <span class="ow-media-status" style="font-size:12px;color:var(--theme-text-secondary);"></span>
              </div>
              <input type="file" id="owUploadMediaFile" accept="${kind === 'audio' ? 'audio/*' : 'video/*'}" hidden>
            </div>`;
        } else if (kind === 'album') {
          const urls = current?.kind === 'album' && Array.isArray(current.urls) ? current.urls.join('\n') : '';
          fieldsBox.innerHTML = `
            <div class="admin-field">
              <label>Fotos (una URL por línea)</label>
              <textarea id="owAdminMediaUrls" rows="3" placeholder="https://…jpg">${esc(urls)}</textarea>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                <button type="button" class="admin-btn admin-btn-sm" id="owUploadMediaBtn">${UI.cloud} Subir fotos</button>
                <span class="ow-media-status" style="font-size:12px;color:var(--theme-text-secondary);"></span>
              </div>
              <input type="file" id="owUploadMediaFile" accept="image/*" multiple hidden>
            </div>`;
        } else if (kind === 'nota') {
          fieldsBox.innerHTML = '<small class="admin-field-hint">🎙️ Al abrir la carta se lee el mensaje en voz alta.</small>';
        } else if (kind === 'cancion') {
          const melody = current?.kind === 'cancion' ? (current.melody || 'cuna') : 'cuna';
          fieldsBox.innerHTML = `
            <div class="admin-field">
              <label>Canción</label>
              <select id="owAdminMelody">
                <option value="cuna" ${melody === 'cuna' ? 'selected' : ''}>🌟 Estrellita (cuna)</option>
                <option value="alegre" ${melody === 'alegre' ? 'selected' : ''}>🔔 Campanitas (alegre)</option>
              </select>
            </div>`;
        } else {
          fieldsBox.replaceChildren();
        }
        wireUpload();
      };

      kindSel.addEventListener('change', renderFields);
      renderFields();
    }, 0);
  }

  function renderSeriesAdmin(sub, items, saveFn, reloadFn) {
    const favs = loadFavorites();
    const sinPortada = items.filter(i => !(i.portada || i.cover || ''));
    sub.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <span style="color:var(--theme-text-secondary);font-size:var(--fs-sm);">${items.length} títulos · catálogo compartido con la sección</span>
        <div style="display:flex;align-items:center;gap:8px;">
          ${sinPortada.length ? `<button class="admin-btn admin-btn-sm" id="fixPortadas" title="Rellenar desde el catálogo semilla las fichas sin imagen">🖼️ ${sinPortada.length} sin portada</button>` : ''}
          <button class="admin-btn admin-btn-sm" id="addSeriesItem">${UI.plus} Añadir</button>
        </div>
      </div>
      <div class="admin-list" id="seriesAdminList">
        ${items.length ? items.map((item, i) => {
          const cover = item.portada || item.cover || '';
          const falta = !cover;
          return `
          <div class="admin-list-item" data-index="${i}">
            <div class="series-admin-cover">
              ${cover ? `<img src="${esc(cover)}" alt="">` : ''}<span${cover ? ' hidden' : ''}>${esc((item.titulo || item.title || '?')[0])}</span>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="item-title">${esc(item.titulo || item.title || 'Sin título')}
                <span class="admin-badge-tag">${item.tipo === 'pelicula' ? 'Película' : 'Serie'}</span>
                ${item.destacado ? '<span class="admin-badge-tag accent">★ Destacado</span>' : ''}
                ${favs.has(item.id) ? '<span class="admin-badge-tag">❤</span>' : ''}
                ${falta ? '<span class="admin-badge-tag accent">Sin portada</span>' : ''}
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

    sub.querySelectorAll('.series-admin-cover img').forEach(img => {
      const fallback = () => {
        img.hidden = true;
        img.nextElementSibling.hidden = false;
      };
      img.addEventListener('error', fallback);
      if (img.complete && !img.naturalWidth) fallback();
    });
    page.querySelector('#fixPortadas')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const token = sectionToken;
      const loadId = contentLoadId;
      button.disabled = true;
      try {
        await repairPortadas(items, saveFn, () => {
          if (token === sectionToken && loadId === contentLoadId) return reloadFn('series');
        });
      } finally {
        button.disabled = false;
      }
    });
    page.querySelector('#addSeriesItem')?.addEventListener('click', () => openSeriesEditor(null, items, saveFn));
    page.querySelector('#seriesAdminList')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit"]');
      const delBtn = e.target.closest('[data-action="delete"]');
      const idxRaw = editBtn?.dataset.index ?? delBtn?.dataset.index;
      if (idxRaw === undefined) return;
      const idx = parseInt(idxRaw, 10);
      e.stopPropagation();
      if (editBtn) openSeriesEditor(items[idx], items, saveFn);
      else {
        const item = items[idx];
        modal.open(
          'Eliminar contenido',
          `<p style="margin:0;">¿Seguro que quieres eliminar <strong>${esc(item.titulo || item.title || 'este título')}</strong>? También se quitará de favoritos y Top 5.</p>`,
          async () => {
            await removeCatalogItem(item.id, items, saveFn);
          },
          'Eliminar'
        );
      }
    });
  }

  // Rellena de golpe las fichas sin portada usando la semilla.
  // El catálogo vivo vive en Supabase, así que corregir solo la semilla
  // no arregla lo que ya está guardado: por esto el admin ofrece el botón.
  // Solo se completa lo que está vacío y SOLO si la semilla conoce ese
  // título; nunca pisa una portada que el usuario haya puesto a mano.
  async function repairPortadas(items, saveFn, reloadFn) {
    const semilla = new Map(defaultCatalog().map(i => [i.id, i]));
    const faltan = items.filter(i => !(i.portada || i.cover || ''));
    const completados = new Set();
    const next = items.map(item => {
      if (item.portada || item.cover) return item;
      const ref = semilla.get(item.id);
      if (!ref?.portada) return item;
      completados.add(item.id);
      return {
        ...item,
        portada: ref.portada,
        banner: item.banner || ref.banner || ref.portada
      };
    });

    const sinRespaldo = faltan.filter(i => !completados.has(i.id));
    if (!completados.size) {
      showToast(
        sinRespaldo.length
          ? `Ninguna de las ${sinRespaldo.length} fichas pendientes tiene imagen en la semilla: edítalas a mano`
          : 'No hay portadas pendientes',
        sinRespaldo.length ? 'error' : 'info'
      );
      return;
    }

    try {
      await saveFn(next);
      showToast(`✅ ${completados.size} portada${completados.size === 1 ? '' : 's'} completada${completados.size === 1 ? '' : 's'}`, 'success');
      await reloadFn();
    } catch (err) {
      showToast(err?.message || 'No se pudo guardar el catálogo', 'error');
    }
  }

  function openSeriesEditor(item, items, saveFn) {
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
    return renderContentItemsIndexed(items.map((item, i) => ({ item, i })), type, '');
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

  function bindContentCRUD(type, items, saveFn) {
    const btn = page.querySelector('#addContentItem');
    if (btn) {
      btn.addEventListener('click', () => {
        openContentEditor(type, null, -1, items, saveFn);
      });
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
        openContentEditor(type, items[idx], idx, items, saveFn);
      } else if (delBtn) {
        e.stopPropagation();
        const idx = parseInt(delBtn.dataset.index);
        modal.open(
          'Eliminar elemento',
          `<p style="margin:0;">¿Seguro que quieres eliminar este elemento? Esta acción no se puede deshacer.</p>`,
          async () => {
            const newItems = items.filter((_, i) => i !== idx);
            const label = items[idx] ? (items[idx].title || items[idx].text || items[idx].name || 'elemento') : 'elemento';
            await saveFn(newItems);
            logContentAction(type, 'deleted', `Eliminado: ${label}`);
          },
          'Eliminar'
        );
      }
    });
  }

  // Render de la lista filtrada por búsqueda (mantiene los índices originales)
  function renderContentItemsIndexed(indexed, type, query = '') {
    if (!indexed.length) {
      return query
        ? `<div class="admin-empty">Ningún elemento coincide con «${esc(query)}»</div>`
        : '<div class="admin-empty">No hay elementos para mostrar</div>';
    }
    return indexed.map(({ item, i }) => {
      const label = contentItemLabel(item, type, i);
      let sub = type === 'canciones' ? ` — ${esc(item.artist || '')}` :
                type === 'noticias' ? ` — ${esc(fmtContentDate(item.date))}` :
                type === 'audios' ? ` — ${esc(fmtContentDate(item.date))}${item.creator ? ' · ' + esc(item.creator) : ''}` : '';
      if (type === 'razones' && item && typeof item === 'object') {
        const d = item.date || '';
        // todayISO() (hora de España) y no la fecha local del dispositivo:
        // el resto del panel usa la hora española y aquí se comparaba con
        // getFullYear/getMonth, que en otro huso descuadraba el desbloqueo.
        const todayStr = todayISO();
        const estado = !d ? 'Siempre disponible' : (d > todayStr ? `🔒 ${fmtContentDate(d)}` : '✅ Desbloqueada');
        sub = ` — <span class="razon-admin-date${d && d <= todayStr ? ' is-open' : ''}">${esc(estado)}</span>`;
      }
      return `<div class="admin-list-item" data-index="${i}">
        <div style="flex:1;min-width:0;">
          <div class="item-title">${esc(label)}</div>
          ${sub ? `<div class="item-sub">${sub}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="item-action-btn edit" data-action="edit" data-index="${i}" title="Editar" aria-label="Editar: ${esc(label)}">${UI.edit}</button>
          <button class="item-action-btn delete" data-action="delete" data-index="${i}" title="Eliminar" aria-label="Eliminar: ${esc(label)}">${UI.trash}</button>
        </div>
      </div>`;
    }).join('');
  }

  /** Título visible de un elemento de Contenido (also the search haystack). */
  function contentItemLabel(item, type, i) {
    if (type === 'razones') return item && typeof item === 'object' ? (item.text || item.reason || 'Sin texto') : (item || 'Sin texto');
    if (type === 'canciones' || type === 'noticias') return item.title || 'Sin título';
    if (type === 'audios') return item.title || `Audio ${i + 1}`;
    return `Elemento ${i + 1}`;
  }

  /**
   * Fecha de contenido legible. Antes los audios pintaban la fecha tal cual
   * venía guardada ("2025-09-26"), en crudo y con guiones, junto a tipos que
   * sí usan texto libre ("Hoy") o fecha en español.
   */
  function fmtContentDate(value) {
    const s = String(value ?? '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s; // texto libre: "Hoy", "Mañana"…
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      .toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function bindSimpleCRUD(key, items, saveFn) {
    const btn = page.querySelector(`#add${key.replace(/_./g, m => m[1].toUpperCase()).replace(/^./g, m => m.toUpperCase())}`);
    // Simpler approach: just use the prefix
    const prefix = key.startsWith('maldia_frase') ? 'MaldiaFrase' : 'MaldiaMensaje';
    const addBtn = page.querySelector(`#add${prefix}`);

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openTextEditor(null, -1, items, saveFn);
      });
    }

    // The parent container holds both frases and mensajes; scope to current subsection
    const parent = addBtn?.closest('.admin-subsection');
    const scope = parent || page;

    scope.querySelectorAll('.admin-list-item [data-action="edit"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(b.dataset.index);
        openTextEditor(items[idx], idx, items, saveFn);
      });
    });

    scope.querySelectorAll('.admin-list-item [data-action="delete"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(b.dataset.index);
        modal.open('Eliminar texto', '<p>¿Quieres eliminar este texto de Mal Día?</p>', async () => {
          await saveFn(items.filter((_, i) => i !== idx));
          logContentAction(key === 'maldia_frase' ? 'maldia_frases' : 'maldia_mensajes', 'deleted', 'Eliminado texto');
        }, 'Eliminar');
      });
    });
  }

  function openContentEditor(type, item, index, items, saveFn) {
    const isNew = index === -1;
    const labelMap = {
      razones: 'Razón (texto)', canciones: 'Canción', noticias: 'Noticia',
      series: 'Serie', regalos: 'Regalo', audios: 'Audio'
    };

    let formHtml;
    // Archivos de audio subidos desde el modal de Audios: al guardar con
    // varios archivos se crea una entrada por cada uno (fuera del bloque
    // `else if` para que lo vea el callback de guardado de modal.open).
    let pendingAudioFiles = [];
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
            <button type="button" class="admin-btn admin-btn-sm" id="uploadAudioBtn">${UI.cloud} Subir audio(s)</button>
            <span id="uploadAudioStatus" style="font-size:12px;color:var(--theme-text-secondary);"></span>
          </div>
          <input type="file" id="editFieldAudioFile" accept="audio/*" multiple hidden>
          <small class="admin-field-hint">Igual que en la sección Audios: el archivo se sube a Supabase y la URL se rellena sola. Puedes elegir 1 o varios a la vez.</small>
        </div>
        <div class="admin-field"><label>Creador (opcional)</label><input type="text" id="editFieldCreator" value="${esc(a.creator || '')}" placeholder="Darwin / Ella"></div>
        <div class="admin-field"><label>Duración en segundos (opcional)</label><input type="number" id="editFieldDuration" min="0" value="${esc(a.duration ?? '')}" placeholder="Se calcula automáticamente si la dejas vacía"></div>
        <small class="admin-field-hint">Si un mes necesita más de un audio, añade otra entrada con la misma fecha (o elige varios archivos en el botón de subir).</small>`;
      // Subida directa a Cloudinary (misma vía que Multimedia/galería)
      setTimeout(() => {
        const btn = page.querySelector('#uploadAudioBtn');
        const fileInput = page.querySelector('#editFieldAudioFile');
        const urlInput = page.querySelector('#editFieldAudio');
        const status = page.querySelector('#uploadAudioStatus');
        if (!btn || !fileInput || !urlInput) return;
        btn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
          const files = [...fileInput.files];
          fileInput.value = '';
          if (!files.length) return;
          const valid = files.filter(f => f.type.startsWith('audio/'));
          if (!valid.length) {
            status.textContent = '⚠ El archivo debe ser de audio (mp3, m4a, ogg, wav…)'; status.style.color = 'var(--theme-error)';
            return;
          }
          btn.disabled = true;
          const uploaded = [];
          const errors = [];
          for (let i = 0; i < valid.length; i++) {
            const file = valid[i];
            status.textContent = `Subiendo… ${i + 1}/${valid.length}`;
            status.style.color = 'var(--theme-text-secondary)';
            try {
              const [url] = await db.uploadAudios([file]);
              if (!url) throw new Error('El audio se subió pero no devolvió URL');
              uploaded.push({ url, name: file.name });
            } catch (err) {
              errors.push(file.name + ': ' + (err?.message || 'Error'));
            }
          }
          if (uploaded.length) {
            pendingAudioFiles = uploaded;
            // Primera URL como valor por defecto del campo; al guardar con
            // varios archivos se crea una entrada por cada uno.
            urlInput.value = uploaded[0].url;
            const plural = uploaded.length === 1 ? 'audio subido' : 'audios subidos';
            status.textContent = `✓ ${uploaded.length} ${plural}`; status.style.color = 'var(--theme-success)';
            if (uploaded.length === 1 && uploaded[0].name && !page.querySelector('#editFieldTitle')?.value) {
              page.querySelector('#editFieldTitle').value = uploaded[0].name.replace(/\.[^.]+$/, '');
            }
          } else {
            status.textContent = '⚠ No se pudo subir el audio'; status.style.color = 'var(--theme-error)';
          }
          if (errors.length) status.textContent += ' · ⚠ ' + errors[0];
          btn.disabled = false;
        });
      }, 0);
    }

    modal.open(
      `${isNew ? 'Añadir' : 'Editar'} ${labelMap[type] || 'elemento'}`,
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
          const creator = page.querySelector('#editFieldCreator')?.value?.trim() || '';
          const durRaw = parseInt(page.querySelector('#editFieldDuration')?.value || '', 10);
          const typedTitle = page.querySelector('#editFieldTitle')?.value?.trim() || '';
          const baseUrl = page.querySelector('#editFieldAudio')?.value?.trim() || '';
          const cloned = [...items];
          const now = new Date().toISOString();

          // Varios archivos subidos desde el modal → una entrada por cada uno
          if (isNew && pendingAudioFiles.length > 1) {
            const created = pendingAudioFiles.map((pf, i) => ({
              id: db.generateId(),
              date,
              year: parseInt(date.slice(0, 4), 10),
              month: parseInt(date.slice(5, 7), 10),
              title: (typedTitle && pendingAudioFiles.length === 1) ? typedTitle : (pf.name ? pf.name.replace(/\.[^.]+$/, '') : `Audio ${i + 1}`),
              url: pf.url,
              creator,
              duration: isFinite(durRaw) && durRaw > 0 ? durRaw : undefined,
              createdAt: now
            }));
            cloned.push(...created);
            await saveFn(cloned);
            logContentAction(type, 'created', `Añadidos ${created.length} audios`);
          } else {
            const url = baseUrl || (pendingAudioFiles[0]?.url) || '';
            if (!url) throw new Error('La URL del audio es obligatoria');
            const prev = isNew ? {} : (items[index] || {});
            const newItem = {
              ...prev,
              id: prev.id || db.generateId(),
              date,
              year: parseInt(date.slice(0, 4), 10),
              month: parseInt(date.slice(5, 7), 10),
              title: typedTitle || '',
              url,
              creator,
              duration: isFinite(durRaw) && durRaw > 0 ? durRaw : (prev.duration || undefined),
              createdAt: prev.createdAt || now
            };
            if (isNew) cloned.push(newItem);
            else cloned[index] = newItem;
            await saveFn(cloned);
            logContentAction(type, isNew ? 'created' : 'updated', `${isNew ? 'Añadido' : 'Actualizado'}: ${newItem.title || 'audio'}`);
          }
        }
      }
    );
  }

  function openTextEditor(text, index, items, saveFn) {
    const isNew = index === -1;
    const val = text ? (typeof text === 'string' ? text : (text.text || '')) : '';

    modal.open(
      `${isNew ? 'Añadir' : 'Editar'} texto`,
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
  const broadcastDraft = { title: 'Personal Hub 💌', body: '' };

  async function loadNotificaciones() {
    const token = sectionToken;
    const supported = isPushSupported();
    const enabled = isEnabled();
    // Tres estados distintos que antes iban todos bajo el mismo "No activadas":
    // la preferencia de la usuaria, el permiso del navegador y el service
    // worker. El permiso "denied" además no se puede arreglar desde la web.
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const swReady = 'serviceWorker' in navigator
      ? Boolean(navigator.serviceWorker.controller)
      : false;
    const PERMISSION = {
      granted: { ok: true, label: 'Concedido', note: 'El navegador permite mostrar notificaciones' },
      denied: { ok: false, label: 'Denegado', note: 'Hay que reactivarlo en los ajustes del navegador (el icono del candado en la barra de direcciones)' },
      default: { ok: false, label: 'Sin decidir', note: 'Todavía no se ha pedido permiso; se pide al activar' },
      unsupported: { ok: false, label: 'No disponible', note: 'Este navegador no expone la API de notificaciones' }
    };
    const perm = PERMISSION[permission] || PERMISSION.unsupported;
    const iconOk = UI.check;
    const iconNo = UI.close;

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.bell} Notificaciones</h2></div>
        <p class="admin-section-hint">${SECTION_HINTS.notificaciones}</p>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>Estado del sistema push</h4></div>
          <div class="notif-status-grid">
            <div class="notif-status-card">
              <span class="notif-status-icon ${supported ? 'ok' : 'muted'}">${supported ? iconOk : iconNo}</span>
              <div>
                <strong>${supported ? 'Compatible' : 'No compatible'}</strong>
                <div class="muted-text">Web Push API en este navegador</div>
              </div>
            </div>
            <div class="notif-status-card">
              <span class="notif-status-icon ${perm.ok ? 'ok' : 'muted'}">${perm.ok ? iconOk : iconNo}</span>
              <div>
                <strong>Permiso: ${perm.label}</strong>
                <div class="muted-text">${esc(perm.note)}</div>
              </div>
            </div>
            <div class="notif-status-card">
              <span class="notif-status-icon ${swReady ? 'ok' : 'muted'}">${swReady ? iconOk : iconNo}</span>
              <div>
                <strong>${swReady ? 'Service worker listo' : 'Service worker no activo'}</strong>
                <div class="muted-text">${swReady ? 'Controlando la página; puede mostrar avisos' : 'Sin él no hay notificaciones aunque el permiso sea correcto'}</div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;">
            <button class="admin-btn ${enabled ? 'admin-btn-secondary' : 'admin-btn-primary'}" id="togglePushBtn"
              ${!enabled && (permission === 'denied' || !supported) ? 'disabled' : ''}>
              ${enabled ? UI.toggleOff + ' Desactivar en este dispositivo' : UI.bell + ' Activar notificaciones'}
            </button>
            <span class="admin-btn-note" id="togglePushState">${enabled
              ? 'Activas en este dispositivo'
              : permission === 'denied'
                ? 'No se puede activar: el navegador tiene el permiso bloqueado'
                : supported ? 'Se te pedirá permiso al activar' : 'Este navegador no soporta push'}</span>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>${UI.send} Notificación de prueba</h4></div>
          <p class="muted-text">Verifica que el service worker y el canal de notificaciones de <strong>este dispositivo</strong> funcionan.</p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button class="admin-btn admin-btn-primary" id="testPushBtn"${supported && enabled && perm.ok && swReady ? '' : ' disabled title="El canal de este dispositivo no puede mostrar notificaciones todavía"'}>${UI.send} Enviar ahora</button>
            <span class="admin-btn-note" id="testPushState"></span>
          </div>
          <div class="notif-result" id="notifResult"></div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>${UI.send} Enviar a todos los usuarios</h4></div>
          <p class="muted-text">Envía un aviso a los dispositivos registrados de las cuentas habilitadas que tengan activado el recordatorio diario.</p>
          <div class="admin-field">
            <label for="sendAllTitle">Título</label>
            <input type="text" id="sendAllTitle" maxlength="100" value="${esc(broadcastDraft.title)}" placeholder="Título de la notificación">
          </div>
          <div class="admin-field">
            <label for="sendAllBody">Mensaje</label>
            <textarea id="sendAllBody" maxlength="500" rows="2" placeholder="Escribe el mensaje…">${esc(broadcastDraft.body)}</textarea>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button class="admin-btn admin-btn-primary" id="sendAllBtn">${UI.send} Enviar a todos</button>
            <span class="admin-btn-note">Se muestra el resultado de cada canal.</span>
          </div>
          <div class="notif-result" id="sendAllResult" role="status"></div>
        </div>
      </section>
    `;

    // Estado real del canal local
    const stateEl = page.querySelector('#testPushState');
    const reasons = [];
    if (!enabled) reasons.push('notificaciones apagadas');
    if (permission !== 'granted') reasons.push(`permiso: ${permission}`);
    if (!('serviceWorker' in navigator)) reasons.push('sin service worker');
    else if (!swReady) reasons.push('service worker sin activar');
    if (stateEl) stateEl.textContent = reasons.length ? `Estado: ${reasons.join(' · ')}` : 'Estado: canal listo';
    for (const [key, id] of [['title', 'sendAllTitle'], ['body', 'sendAllBody']]) {
      page.querySelector(`#${id}`).addEventListener('input', e => { broadcastDraft[key] = e.target.value; });
    }

    // El panel decía "No activadas" y no offercía ninguna acción, aunque el
    // servicio de la app ya sabe activarlas.
    page.querySelector('#togglePushBtn')?.addEventListener('click', async () => {
      const btn = page.querySelector('#togglePushBtn');
      const note = page.querySelector('#togglePushState');
      btn.disabled = true;
      try {
        if (enabled) {
          await disable();
          showToast('Notificaciones desactivadas en este dispositivo', 'success');
        } else {
          const ok = await requestEnable();
          showToast(ok ? 'Notificaciones activadas' : 'El navegador no concedió el permiso', ok ? 'success' : 'error');
        }
        if (isCurrentSection(token)) await loadNotificaciones();
      } catch (err) {
        showToast(err?.message || 'No se pudo cambiar el estado', 'error');
        btn.disabled = false;
        if (note) note.textContent = 'No se pudo cambiar el estado';
      }
    });

    page.querySelector('#testPushBtn')?.addEventListener('click', async () => {
      const btn = page.querySelector('#testPushBtn');
      const result = page.querySelector('#notifResult');
      btn.disabled = true;
      result.replaceChildren();
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
        if (!res.ok || data.success !== true) throw new Error(data?.error || 'El servidor no confirmó el resultado.');
        const web = Number(data.sent) || 0;
        const android = Number(data.android?.sent) || 0;
        const failed = (Number(data.failed) || 0) + (Number(data.android?.failed) || 0);
        const expired = (Number(data.removed) || 0) + (Number(data.android?.removed) || 0);
        const message = web + android
          ? `Aceptados por el servicio de envío: ${web} web y ${android} Android. La entrega al dispositivo queda pendiente de confirmación.`
          : 'Ningún envío fue aceptado.';
        const details = [failed ? `${failed} fallidos` : '', expired ? `${expired} caducados` : '',
          data.webConfigured === false ? 'Web Push sin configurar' : '',
          data.android?.configured === false ? 'Firebase sin configurar' : '',
          Number(data.filtered) ? `${data.filtered} excluidos por preferencias` : ''].filter(Boolean).join(' · ');
        result.innerHTML = `<div class="${web + android ? 'notif-ok' : 'notif-err'}">${esc(message)}${details ? `<br>${esc(details)}` : ''}</div>`;
      } catch (err) {
        result.innerHTML = `<div class="notif-err">✗ ${esc(err?.message || 'Error al enviar')}. En desarrollo (/api/push) no está disponible: solo funciona en Vercel.</div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ==========================================
  // 5b. RECORDATORIOS PROGRAMADOS
  // ==========================================
  // A diferencia del envío manual de arriba, esto lo manda el SERVIDOR
  // cuando toca: llega aunque no haya nadie con la app abierta. Las reglas
  // (longitudes, destino interno) las valida la API; aquí solo se recogen.
  const REMINDER_RECURRENCES = {
    once: 'Una sola vez',
    daily: 'Todos los días',
    weekly: 'Cada semana'
  };

  /** Formulario de un recordatorio, para crear y para editar. */
  function reminderFormHTML(r = {}) {
    const when = isoToLocalInput(r.next_run_at || new Date(Date.now() + 3600e3).toISOString());
    return `
      <div class="admin-field"><label>Título</label>
        <input type="text" id="remEditTitle" maxlength="100" value="${esc(r.title || '')}">
      </div>
      <div class="admin-field"><label>Mensaje</label>
        <textarea id="remEditBody" rows="2" maxlength="500">${esc(r.body || '')}</textarea>
      </div>
      <div class="admin-field"><label>Cuándo · España peninsular</label>
        <input type="datetime-local" id="remEditWhen" value="${when}">
      </div>
      <div class="admin-field"><label>Repetir</label>
        <select id="remEditRecurrence">
          ${Object.entries(REMINDER_RECURRENCES).map(([value, label]) =>
            `<option value="${value}"${(r.recurrence || 'once') === value ? ' selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="admin-field"><label>Al pulsarla, abrir</label>
        <input type="text" id="remEditUrl" value="${esc(r.target_url || '/')}" placeholder="/">
      </div>
      <p class="muted-text">Guardar fija la próxima ejecución en la fecha de arriba. Para encenderlo o apagarlo sin mover la fecha, usa el botón de la lista.</p>
    `;
  }

  /** Lee el formulario del modal y lo devuelve con los nombres de la API. */
  function reminderFieldsFrom(root) {
    return {
      title: root.querySelector('#remEditTitle')?.value?.trim() || '',
      body: root.querySelector('#remEditBody')?.value?.trim() || '',
      targetUrl: root.querySelector('#remEditUrl')?.value?.trim() || '/',
      recurrence: root.querySelector('#remEditRecurrence')?.value || 'once',
      scheduledAt: localInputToIso(root.querySelector('#remEditWhen')?.value)
    };
  }

  async function loadRecordatorios() {
    const token = sectionToken;
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.calendar} Recordatorios</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="admin-btn-ghost" id="refreshReminders" title="Actualizar" aria-label="Actualizar recordatorios">${UI.refresh}</button>
          </div>
        </div>
        <p class="admin-section-hint">${SECTION_HINTS.recordatorios}</p>
        <p class="reminder-scheduler-note">La hora se interpreta en España peninsular. Para enviarlo en el minuto elegido debe estar activo pg_cron cada minuto en Supabase; el cron diario de Vercel es solo un respaldo y puede retrasarlo hasta el día siguiente.</p>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>${UI.plus} Nuevo recordatorio</h4></div>
          <div class="admin-field"><label>Fecha y hora · España peninsular</label>
            <input type="datetime-local" id="remWhen">
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button class="admin-btn admin-btn-primary" id="remNewBtn">${UI.plus} Escribirlo</button>
            <span class="admin-btn-note">Se envía aunque nadie tenga la app abierta</span>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-head"><h4>${UI.calendar} Programados <span class="admin-count-badge" id="remCount"></span></h4></div>
          <p class="muted-text">Los envía el servidor cuando toca; los de una sola vez se apagan solos al salir.</p>
          <div class="admin-list" id="remList">${skeletonCard('72px')}${skeletonCard('72px')}</div>
          <div class="notif-result" id="remResult"></div>
        </div>
      </section>
    `;

    // Por defecto, dentro de una hora: es lo que se suele querer y evita
    // dejar el campo vacío (que la API rechazaría al no ser fecha válida).
    const whenInput = page.querySelector('#remWhen');
    if (whenInput) whenInput.value = isoToLocalInput(new Date(Date.now() + 3600e3).toISOString());

    const list = page.querySelector('#remList');
    const result = page.querySelector('#remResult');

    // Cómo se lee el resultado de un envío. Un 'skipped' no es un fallo: es
    // que esa persona tenía los recordatorios apagados o estaba en silencio
    // (023), y saberlo es la diferencia entre "falló" y "no le tocaba".
    // Tres estados, y el orden importa: «entregado» SOLO cuando el dispositivo
    // lo ha confirmado con su acuse (025). Sin confirmación, lo único que se
    // sabe es que el push service aceptó el envío — el móvil puede estar
    // apagado, sin datos o con la app congelada— y «visto» no lo sabe nadie.
    // Antes esta tabla traducía 'sent' como «entregado», que era una promesa
    // que la base no podía cumplir.
    const DELIVERY_RESULT = {
      delivered: () => 'entregado al dispositivo',
      sent: () => 'enviado (sin confirmación del dispositivo)',
      // Transitorio: el envío se registra antes de mandarlo, así que una fila
      // en 'queued' significa que todavía no hay resultado. Si se queda así,
      // la ejecución murió a mitad y no se sabe si llegó a salir.
      queued: () => 'en curso (sin resultado todavía)',
      skipped: log => `no enviado (${log.error === 'quiet_hours' ? 'horario de silencio' : 'avisos apagados'})`,
      failed: log => `falló (${esc(String(log.error || 'error'))})`
    };
    const deliveryResult = (log) => (log?.delivered_at
      ? DELIVERY_RESULT.delivered(log)
      : (DELIVERY_RESULT[log?.status] || DELIVERY_RESULT.failed)(log));

    function paint(reminders, logs) {
      const count = page.querySelector('#remCount');
      if (count) count.textContent = String(reminders.length);

      const lastByReminder = new Map();
      logs.forEach(log => {
        if (log.reminder_id && !lastByReminder.has(log.reminder_id)) lastByReminder.set(log.reminder_id, log);
      });

      if (!reminders.length) {
        list.innerHTML = '<div class="admin-empty">Todavía no hay recordatorios programados</div>';
        return;
      }

      list.innerHTML = reminders.map(r => {
        const pending = r.active && Date.parse(r.next_run_at) <= Date.now();
        const when = !r.active
          ? `Programado para: ${formatReminderDate(r.next_run_at)}`
          : pending
            ? 'Pendiente de envío'
            : `Próximo: ${formatReminderDate(r.next_run_at)}`;
        const last = lastByReminder.get(r.id);
        const lastLine = last
          ? `<div class="item-sub">Último envío: ${deliveryResult(last)} · ${esc(formatReminderDate(last.sent_at))}</div>`
          : '';
        return `
          <div class="admin-list-item rem-item" data-id="${esc(r.id)}">
            <div class="item-content">
              <div class="item-title">${esc(r.title)}
                <span class="rem-badge ${r.active ? 'is-on' : 'is-off'}">${r.active ? 'Activo' : 'Pausado'}</span>
              </div>
              <div class="item-sub">${esc(r.body)}</div>
              <div class="item-sub">${esc(REMINDER_RECURRENCES[r.recurrence] || REMINDER_RECURRENCES.once)} · ${esc(when)}${r.target_url && r.target_url !== '/' ? ` · ${esc(r.target_url)}` : ''}</div>
              ${lastLine}
            </div>
            <div class="rem-actions">
              <button class="admin-btn admin-btn-secondary" data-rem="run">${UI.send} Enviar</button>
              <button class="admin-btn admin-btn-secondary" data-rem="toggle">${r.active ? 'Pausar' : 'Activar'}</button>
              <button class="admin-btn admin-btn-secondary" data-rem="edit" aria-label="Editar recordatorio">${UI.edit}</button>
              <button class="admin-btn admin-btn-secondary" data-rem="delete" aria-label="Eliminar recordatorio">${UI.trash}</button>
            </div>
          </div>`;
      }).join('');
    }

    let requestId = 0;
    const pending = new Set();
    async function refresh() {
      const request = ++requestId;
      const { reminders, logs } = await listReminders();
      // Otra sección se abrió mientras cargaba: no se pisa su contenido.
      if (!isCurrentSection(token) || request !== requestId) return;
      paint(reminders, logs);
      for (const button of list.querySelectorAll('[data-rem]')) {
        button.disabled = pending.has(button.closest('.rem-item').dataset.id);
      }
      return reminders;
    }

    page.querySelector('#remNewBtn')?.addEventListener('click', () => {
      // La fecha del formulario es la que se propone al abrir el editor.
      const when = page.querySelector('#remWhen')?.value;
      let proposed;
      try {
        proposed = when ? localInputToIso(when) : undefined;
      } catch {
        showToast('Elige una fecha y una hora', 'error');
        return;
      }
      const html = reminderFormHTML({ next_run_at: proposed });
      modal.open(
        'Nuevo recordatorio',
        html,
        async () => {
          await createReminder(reminderFieldsFrom(modal.body));
          if (isCurrentSection(token)) {
            showToast('Recordatorio creado', 'success');
            void refresh().catch(error => showToast(error.message, 'error'));
          }
          return true;
        }
      );
    });

    page.querySelector('#refreshReminders')?.addEventListener('click', async e => {
      const button = e.currentTarget;
      button.disabled = true;
      try { await refresh(); } catch (error) {
        if (isCurrentSection(token)) showToast(error.message || 'No se pudo actualizar la lista.', 'error');
      } finally { button.disabled = false; }
    });

    // Delegación: la lista se repinta entera en cada refresco, así que los
    // botones se leen por su data-rem en vez de enlazarse uno a uno.
    list?.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-rem]');
      const item = event.target.closest('.rem-item');
      if (!btn || !item) return;
      const id = item.dataset.id;
      const action = btn.dataset.rem;
      if (pending.has(id) || modal.visible) return;

      if (action === 'edit') {
        try {
          const { reminders } = await listReminders();
          const current = reminders.find(r => String(r.id) === String(id));
          if (!isCurrentSection(token) || modal.visible) return;
          if (!current) throw new Error('Ese recordatorio ya no existe');
          modal.open(
            'Editar recordatorio',
            reminderFormHTML(current),
            async () => {
              await updateReminder(current.id, reminderFieldsFrom(modal.body));
              if (isCurrentSection(token)) {
                showToast('Recordatorio actualizado', 'success');
                void refresh().catch(error => showToast(error.message, 'error'));
              }
              return true;
            }
          );
        } catch (err) {
          showToast(err?.message || 'No se pudo abrir el recordatorio', 'error');
        }
        return;
      }

      if (action === 'delete') {
        modal.open('Eliminar recordatorio', '<p>¿Quieres eliminar este recordatorio programado?</p>', async () => {
          await deleteReminder(id);
          if (isCurrentSection(token)) {
            item.remove();
            showToast('Recordatorio eliminado', 'success');
            void refresh().catch(error => showToast(error.message, 'error'));
          }
          return true;
        }, 'Eliminar');
        return;
      }
      pending.add(id);
      item.querySelectorAll('[data-rem]').forEach(button => { button.disabled = true; });
      try {
        if (action === 'run') {
          const data = await runReminder(id);
          const n = data?.sent || 0;
          if (result) {
            result.innerHTML = n
              ? `<div class="notif-ok">✓ Enviado a ${n} dispositivo${n === 1 ? '' : 's'}${data?.removed ? ` (${data.removed} expirados eliminados)` : ''}.</div>`
              : `<div class="notif-err">Ningún envío fue aceptado. Consulta el resultado en el historial.</div>`;
          }
        } else if (action === 'toggle') {
          const isOn = item.querySelector('.rem-badge')?.classList.contains('is-on');
          await toggleReminder(id, !isOn);
          showToast(isOn ? 'Recordatorio pausado' : 'Recordatorio activado', 'success');
        }
        if (isCurrentSection(token)) await refresh();
      } catch (err) {
        showToast(err?.message || 'No se pudo completar la acción', 'error');
      } finally {
        pending.delete(id);
        const row = [...list.querySelectorAll('.rem-item')].find(entry => entry.dataset.id === id);
        row?.querySelectorAll('[data-rem]').forEach(button => { button.disabled = false; });
      }
    });

    try {
      await refresh();
    } catch (err) {
      if (token !== sectionToken) return;
      list.innerHTML = `<div class="admin-empty">${esc(err?.message || 'No se pudieron cargar los recordatorios')}</div>`;
    }
  }

  // ==========================================
  // 6. ACTIVIDAD
  // ==========================================
  async function loadActividad() {
    const token = sectionToken;
    // getActivity está topado; hay que decirlo o el panel parece completo
    // cuando en realidad solo enseña los más recientes.
    const ACTIVITY_LIMIT = 100;
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.activity} Registro de Actividad</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="admin-btn-ghost" id="refreshActivity" title="Actualizar" aria-label="Actualizar actividad">${UI.refresh}</button>
          </div>
        </div>
        <p class="admin-section-hint">${SECTION_HINTS.actividad}</p>
        <div class="admin-toolbar">
          <span class="admin-filter-icon">${UI.filter}</span>
          <select class="admin-select" id="activityFilter" aria-label="Filtrar por acción">
            <option value="all">Todas las acciones</option>
          </select>
          <span class="admin-count-badge" id="activityCount"></span>
        </div>
        <p class="activity-limit-note" id="activityLimitNote" hidden></p>
        <div class="admin-list" id="activityList">${skeletonCard('48px')}${skeletonCard('48px')}${skeletonCard('48px')}</div>
      </section>
    `;

    let allEntries = null;
    let result = null;

    function renderActivity() {
      const filter = page.querySelector('#activityFilter')?.value || 'all';
      if (!allEntries) return;
      const filtered = filter === 'all' ? allEntries : allEntries.filter(e => e.action === filter);
      const list = page.querySelector('#activityList');
      const count = page.querySelector('#activityCount');
      if (count) count.textContent = `${filtered.length} de ${allEntries.length}`;
      const note = page.querySelector('#activityLimitNote');
      if (note) {
        note.textContent = result.truncated ? `Mostrando los ${allEntries.length} registros más recientes.`
          : result.source === 'local' ? 'Solo se muestran las acciones guardadas en este navegador.' : '';
        note.hidden = !note.textContent;
      }
      if (!list) return;
      if (!filtered.length) {
        list.innerHTML = filter === 'all'
          ? '<div class="admin-empty">Todavía no hay actividad registrada</div>'
          : `<div class="admin-empty">Ninguna acción de este tipo en los registros cargados</div>`;
        return;
      }
      list.innerHTML = filtered.map(e => {
        const time = e.timestamp ? fmtActivityStamp(e.timestamp) : '';
        const known = db.isKnownAction(e.action);
        const label = db.formatAction(e.action);
        // logActivity escribe "Acción: detalle", y la acción ya sale arriba:
        // sin quitarlo se lee "Usuario eliminado / Usuario eliminado: uuid".
        const raw = String(e.details || '');
        const prefix = `${label}: `;
        const details = raw.toLowerCase().startsWith(prefix.toLowerCase()) ? raw.slice(prefix.length) : raw;
        return `<div class="admin-activity-item">
          <div class="admin-activity-dot${known ? '' : ' unknown'}"></div>
          <div class="admin-activity-body">
            <div class="admin-activity-action">${esc(label)}${known ? '' : ` <span class="activity-unknown-tag" title="Acción ${esc(e.action)} fuera del catálogo">${esc(e.action)}</span>`}</div>
            <div class="admin-activity-details">${details ? esc(details) : '—'}</div>
          </div>
          <div class="admin-activity-time" title="${esc(e.timestamp || '')}">${esc(time)}</div>
        </div>`;
      }).join('');
    }

    /** "1 oct, 16:09" — inequívoco y corto; el formato largo del navegador
     *  ("1/10/2026, 16:09:25") mezclaba dd/mm y desbordaba la fila. */
    function fmtActivityStamp(ts) {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    const fillFilter = () => {
      const types = [...new Set(allEntries.map(e => e.action))];
      const filterEl = page.querySelector('#activityFilter');
      if (!filterEl) return;
      const prev = filterEl.value;
      filterEl.innerHTML = '<option value="all">Todas las acciones</option>' +
        types.map(t => `<option value="${esc(t)}">${esc(db.formatAction(t))}${db.isKnownAction(t) ? '' : ' ⚠'}</option>`).join('');
      // Al recargar pueden aparecer tipos nuevos: se conserva el filtro previo
      // si sigue existiendo, y si no, se vuelve a "todas".
      filterEl.value = types.includes(prev) ? prev : 'all';
    };

    const refresh = page.querySelector('#refreshActivity');
    const note = page.querySelector('#activityLimitNote');
    note.setAttribute('role', 'status');
    async function load() {
      if (refresh.disabled) return;
      refresh.disabled = true;
      try {
        const updated = await db.readAdminActivity({ limit: ACTIVITY_LIMIT });
        if (!isCurrentSection(token)) return;
        result = updated;
        allEntries = updated.rows;
        fillFilter();
        renderActivity();
      } catch {
        if (!isCurrentSection(token)) return;
        if (!allEntries) page.querySelector('#activityList').replaceChildren();
        note.textContent = allEntries
          ? 'No se pudo actualizar. Se conservan las últimas acciones consultadas.'
          : 'No se pudo cargar la actividad. Pulsa Actualizar para reintentar.';
        note.hidden = false;
      } finally {
        refresh.disabled = false;
      }
    }
    activeRefresh = load;
    page.querySelector('#activityFilter')?.addEventListener('change', renderActivity);
    refresh.addEventListener('click', () => void load());
    await load();
  }

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  async function loadConfiguracion() {
    const token = sectionToken;
    const paletaActiva = theme.getPaleta();
    const modoActivo = theme.getModo();
    const notifEnabled = isEnabled();
    const pushOk = isPushSupported();
    const account = userStore.getUser();
    const { dates: hubDates, snapshot: datesSnapshot } = await db.getAdminHubDates();
    // La caché global la leen el botón «ver la bienvenida de hoy» y la hoja
    // temática; sin esto seguirían con los valores de fábrica.
    await loadSpecialDates().catch(() => {});
    if (!isCurrentSection(token)) return;

    // Cada bloque es una tarjeta con su icono y su rótulo de grupo: antes todo
    // era una lista plana de paneles y no se sabía qué tocaba cada cosa. Las
    // fechas, que son lo más largo, van en pestañas para no esconder el resto.
    const modeEmoji = { auto: '🖥️', dark: '🌙', light: '☀️' };
    const paletas = theme.getPaletas();
    const modos = theme.getModos();

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.settings} Configuración</h2>
        </div>
        <p class="admin-section-hint">${SECTION_HINTS.config}</p>

        <div class="admin-panel config-card config-dates">
          <div class="admin-panel-head">
            <h4>${UI.copy} Fechas especiales</h4>
            <span class="admin-panel-badge">Calendario y bienvenida</span>
          </div>
          <p class="config-card-hint">«Años juntos», «En el Hub», el cumpleaños y el primer mensaje. Los eventos y los días temáticos salen además en la bienvenida del Inicio.</p>

          <div class="admin-tabs config-tabs" id="configDatesTabs" role="tablist">
            <button type="button" class="admin-tab active" data-config-tab="fechas" role="tab" aria-selected="true">${UI.calendar}<span>Los cuatro días</span></button>
            <button type="button" class="admin-tab" data-config-tab="eventos" role="tab" aria-selected="false">${UI.spark}<span>Eventos</span></button>
            <button type="button" class="admin-tab" data-config-tab="aspecto" role="tab" aria-selected="false">${UI.palette}<span>Aspecto</span></button>
            <button type="button" class="admin-tab" data-config-tab="tematicos" role="tab" aria-selected="false">${UI.star}<span>Días temáticos</span></button>
          </div>

<div class="config-pane" data-config-pane="fechas">
            <p class="config-card-hint">Los cuatro días que alimentan el resumen y la bienvenida. El título es el que aparece en la app.</p>
            <div class="dates-cards">
              <div class="dates-card">
                <div class="dates-card-head"><span class="dates-card-emoji">🤍</span><span class="dates-card-name">Aniversario</span></div>
                <input type="text" id="dateAnniversaryTitle" class="dates-input" value="${esc(hubDates.titles?.anniversary || 'Aniversario')}" maxlength="40" placeholder="Título" aria-label="Título del aniversario">
                <label class="dates-slot">
                  <span class="dates-slot-label">${UI.calendar} Fecha</span>
                  <input type="date" id="dateAnniversary" class="dates-input" value="${esc(hubDates.anniversary)}" aria-label="Fecha del aniversario">
                </label>
                <label class="dates-switch"><input type="checkbox" id="dateAnniversaryRecur" ${hubDates.recurring?.anniversary !== false ? 'checked' : ''}><span class="dates-switch-track"><span class="dates-switch-thumb"></span></span><span class="dates-switch-label">Cada año</span></label>
              </div>

              <div class="dates-card">
                <div class="dates-card-head"><span class="dates-card-emoji">📅</span><span class="dates-card-name">Primer mensaje</span></div>
                <input type="text" id="dateHubStartTitle" class="dates-input" value="${esc(hubDates.titles?.hubStart || 'Primer mensaje')}" maxlength="40" placeholder="Título" aria-label="Título del primer mensaje">
                <label class="dates-slot">
                  <span class="dates-slot-label">${UI.calendar} Fecha</span>
                  <input type="date" id="dateHubStart" class="dates-input" value="${esc(hubDates.hubStart)}" aria-label="Fecha del primer mensaje">
                </label>
                <label class="dates-switch"><input type="checkbox" id="dateHubStartRecur" ${hubDates.recurring?.hubStart === true ? 'checked' : ''}><span class="dates-switch-track"><span class="dates-switch-thumb"></span></span><span class="dates-switch-label">Cada año</span></label>
              </div>

              <div class="dates-card">
                <div class="dates-card-head"><span class="dates-card-emoji">🎁</span><span class="dates-card-name">Cumpleaños de dada</span></div>
                <input type="text" id="dateBirthdayTitle" class="dates-input" value="${esc(hubDates.titles?.birthday || 'Cumpleaños de dada')}" maxlength="40" placeholder="Título" aria-label="Título del cumpleaños">
                <label class="dates-slot">
                  <span class="dates-slot-label">${UI.calendar} Fecha</span>
                  <input type="date" id="dateBirthday" class="dates-input" value="${esc(hubDates.birthday)}" aria-label="Fecha del cumpleaños">
                </label>
                <label class="dates-switch"><input type="checkbox" id="dateBirthdayRecur" ${hubDates.recurring?.birthday !== false ? 'checked' : ''}><span class="dates-switch-track"><span class="dates-switch-thumb"></span></span><span class="dates-switch-label">Cada año</span></label>
              </div>

              <div class="dates-card">
                <div class="dates-card-head"><span class="dates-card-emoji">🎂</span><span class="dates-card-name">Tu cumpleaños</span></div>
                <input type="text" id="dateUserBirthdayTitle" class="dates-input" value="${esc(hubDates.titles?.userBirthday || 'Tu cumpleaños')}" maxlength="40" placeholder="Título" aria-label="Título del cumpleaños del admin">
                <label class="dates-slot">
                  <span class="dates-slot-label">${UI.calendar} Fecha</span>
                  <input type="date" id="dateUserBirthday" class="dates-input" value="${esc(hubDates.userBirthday)}" aria-label="Fecha del cumpleaños del admin">
                </label>
                <label class="dates-switch"><input type="checkbox" id="dateUserBirthdayRecur" ${hubDates.recurring?.userBirthday !== false ? 'checked' : ''}><span class="dates-switch-track"><span class="dates-switch-thumb"></span></span><span class="dates-switch-label">Cada año</span></label>
              </div>
            </div>
          </div>

          <div class="config-pane" data-config-pane="eventos" hidden>
            <div class="dates-events">
              <span class="dates-events-title">✨ Próximas cosas</span>
              <p class="muted-text">Cada evento es una tarjeta: ábrela para editarlo y ver cuándo aparece. El aviso previo sale en pantalla al entrar en Inicio durante los 7 días anteriores; no es un push. El día que cae, un banner permite volver a abrir la bienvenida.</p>
              <div id="datesEventsList"></div>
              <button type="button" class="admin-btn admin-btn-ghost" id="addDatesEventBtn">${UI.plus} Añadir evento</button>
              <div class="dates-events-foot">
                <button type="button" class="admin-btn admin-btn-ghost" id="replayWelcomeBtn">🎬 Ver la bienvenida de hoy</button>
                <span class="muted-text" id="replayWelcomeHint"></span>
              </div>
            </div>
          </div>

          <div class="config-pane" data-config-pane="aspecto" hidden>
            <div class="dates-events">
              <span class="dates-events-title">🎨 Aspecto de los cuatro días en la bienvenida</span>
              <p class="muted-text">Emoji, texto, color y foto. Vaciar un campo devuelve el valor de fábrica.</p>
              <div id="datesLooksList"></div>
            </div>
          </div>

          <div class="config-pane" data-config-pane="tematicos" hidden>
            <div class="dates-events">
              <span class="dates-events-title">🎃 Días temáticos</span>
              <p class="muted-text">Los que saltan solos cada año, como Halloween o Navidad. «Hoy» pone el mes y el día de hoy y 🎬 muestra cómo se verá ese día. Vienen de fábrica: puedes cambiar fecha, texto, emoji, color y foto, apagarlos o añadir otros.</p>
              <div id="datesSeasonalList"></div>
              <button type="button" class="admin-btn admin-btn-ghost" id="addDatesSeasonalBtn">${UI.plus} Añadir día temático</button>
            </div>
          </div>

          <div class="config-save" id="datesSaveRow">
            <span class="config-save-state" id="datesSaveState">Todo guardado</span>
            <div class="config-draft" id="datesDraftRow" hidden>
              <span id="datesDraftText"></span>
              <button type="button" class="admin-btn admin-btn-ghost" id="restoreDraftBtn">Recuperar lo que no se guardó</button>
              <button type="button" class="admin-btn admin-btn-ghost" id="discardDraftBtn">Descartar</button>
            </div>
            <div class="config-save-right">
              <div class="muted-text" id="datesSavedHint"></div>
              <button class="admin-btn admin-btn-primary" id="saveDatesBtn">${UI.check} Guardar fechas</button>
            </div>
          </div>
        </div>

        <div class="config-group">
          <span class="config-group-label">Del día a día</span>
          <div class="config-grid">
            <div class="admin-panel config-card config-card--wide">
              <div class="admin-panel-head">
                <h4>${UI.palette} Apariencia</h4>
                <span class="admin-panel-badge">Se aplica al instante</span>
              </div>
              <p class="config-card-hint">El tema se guarda en este navegador y se aplica en toda la web.</p>

              <div class="config-appearance">
              <div>
              <span class="config-field-label">Paleta de color</span>
              <div class="config-swatches" id="themeSeg" role="radiogroup" aria-label="Paleta de color">
                ${paletas.map(t => `
                  <button type="button" role="radio" aria-checked="${paletaActiva === t.id}" class="config-swatch${paletaActiva === t.id ? ' active' : ''}" data-theme-set="paleta" data-theme-id="${t.id}" data-theme-label="${t.label}">
                    <span class="config-swatch-dot" style="--swatch:${t.preview}"></span>
                    <span class="config-swatch-text">
                      <b>${t.label}</b>
                      <small>${t.hint}</small>
                    </span>
                  </button>`).join('')}
              </div>
              </div>

              <div>
              <span class="config-field-label">Modo</span>
              <div class="config-modes" id="modeSeg" role="radiogroup" aria-label="Modo de color">
                ${modos.map(m => `
                  <button type="button" role="radio" aria-checked="${modoActivo === m.id}" class="config-mode${modoActivo === m.id ? ' active' : ''}" data-theme-set="modo" data-theme-id="${m.id}" data-theme-label="${m.label}">
                    <span class="config-mode-emoji" aria-hidden="true">${modeEmoji[m.id] || '🎨'}</span>
                    <span>${m.label}</span>
                  </button>`).join('')}
              </div>
              <p class="config-card-hint config-card-hint--foot">Con <b>Auto</b> se respeta el modo del sistema.</p>
              </div>
              </div>
            </div>

            <div class="admin-panel config-card">
              <div class="admin-panel-head">
                <h4>${UI.bell} Notificaciones</h4>
                <span class="admin-panel-badge">8:00 · hora de España</span>
              </div>
              <p class="config-card-hint">El recordatorio diario se envía a los dispositivos suscritos.</p>

              <ul class="config-status">
                <li class="${pushOk ? 'ok' : 'muted'}">
                  <span class="config-status-icon">${pushOk ? UI.check : UI.close}</span>
                  <span><b>${pushOk ? 'Este navegador admite push' : 'Push no disponible'}</b><small>Compatibilidad del dispositivo</small></span>
                </li>
                <li class="${notifEnabled ? 'ok' : 'muted'}">
                  <span class="config-status-icon">${notifEnabled ? UI.check : UI.close}</span>
                  <span><b>${notifEnabled ? 'Suscripción activa' : 'Suscripción apagada'}</b><small>Estado de tus notificaciones</small></span>
                </li>
              </ul>

              <div class="config-actions">
                ${notifEnabled
                  ? `<button class="admin-btn admin-btn-secondary" id="disableNotifBtn">Apagar notificaciones</button>`
                  : `<button class="admin-btn admin-btn-primary" id="enableNotifBtn">${UI.bell} Activar notificaciones</button>`}
                <button class="admin-btn admin-btn-ghost" id="testNotifBtn">${UI.send} Enviar prueba</button>
              </div>
              <div class="notif-result" id="configNotifResult"></div>
            </div>

            <div class="admin-panel config-card">
              <div class="admin-panel-head"><h4>${UI.users} Tu cuenta</h4></div>
              <div class="admin-profile-row">
                <div class="admin-profile-avatar">${userPhoto ? `<img src="${esc(userPhoto)}" alt="">` : userInitial}</div>
                <div>
                  <strong>${esc(account?.name || userName)}</strong>
                  <div class="muted-text">${esc(account?.email || '')}</div>
                </div>
                <span class="admin-sidebar-admin-badge">${esc(String(userRole).toUpperCase())}</span>
              </div>
              <dl class="config-facts">
                <div><dt>Zona horaria</dt><dd>España (península)</dd></div>
                <div><dt>Hora local ahora</dt><dd>${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</dd></div>
              </dl>
            </div>
          </div>
        </div>

        <div class="config-group">
          <span class="config-group-label">Sistema</span>
          <div class="config-grid">
            <div class="admin-panel config-card">
              <div class="admin-panel-head"><h4>${UI.cloud} Base de datos</h4></div>
              <div id="configDbStatus">${skeletonText()}</div>
              <div class="config-actions">
                <button class="admin-btn admin-btn-ghost" id="recheckDbBtn">${UI.refresh} Comprobar de nuevo</button>
              </div>
            </div>

          </div>
        </div>
      </section>
    `;

    if (token !== sectionToken) return;

    // ---- Pestañas de fechas ----
    // Los cuatro bloques de fechas (días base, eventos, aspecto y días
    // temáticos) ocupaban media pantalla cada uno: con las pestañas se ve
    // uno trabajo cada vez y el botón de guardar sigue siempre a mano.
    const showConfigTab = (id) => {
      S.configTab = id;
      page.querySelectorAll('#configDatesTabs .admin-tab').forEach(t => {
        const on = t.dataset.configTab === id;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
      });
      page.querySelectorAll('[data-config-pane]').forEach(pane => {
        pane.hidden = pane.dataset.configPane !== id;
      });
    };
    page.querySelectorAll('#configDatesTabs .admin-tab').forEach(btn => {
      btn.addEventListener('click', () => showConfigTab(btn.dataset.configTab));
    });
    showConfigTab(S.configTab);

    // ---- Tema ----
    // El catálogo de paletas sale de theme.service (una sola fuente), no de
    // una lista literal aquí: si mañana se añade una paleta, aparece sola
    // en Perfil y en Admin.
    page.querySelectorAll('[data-theme-set]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.themeId;
        if (btn.dataset.themeSet === 'paleta') theme.setPaleta(id);
        else theme.setModo(id);
        // Solo se desmarcan los botones del mismo grupo (paleta o modo)
        const group = btn.parentElement;
        if (group) {
          group.querySelectorAll('[data-theme-set]').forEach(b => {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-checked', String(b === btn));
          });
        }
        showToast(`${btn.dataset.themeSet === 'paleta' ? 'Paleta' : 'Modo'}: ${btn.dataset.themeLabel || id}`, 'success');
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
    // Aviso de cambios sin guardar: los cuatro días y las tres listas se
    // guardan juntos con un botón al final de la tarjeta, así que sin esto
    // no había forma de saber si lo editado está ya en la base de datos.
    const saveRow = page.querySelector('#datesSaveRow');
    const saveState = page.querySelector('#datesSaveState');
    // Red de seguridad: lo que se escribe se queda en este navegador al
    // momento. Si Supabase rechaza el guardado (sesión caducada, sin red, RLS)
    // o si se cierra la pestana sin guardar, nada de lo escrito se pierde.
    const DRAFT_KEY = 'ph.draft.hub_dates';
    const saveDraft = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), dates: collectDates() }));
      } catch { /* sin cuota o sin localStorage */ }
    };
    const readDraft = () => {
      try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }
      catch { return null; }
    };
    const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* nada */ } };
    const markDirty = () => {
      saveRow?.classList.add('is-dirty');
      if (saveState) saveState.textContent = 'Tienes cambios sin guardar';
      saveDraft();
    };
    const markSaved = () => {
      saveRow?.classList.remove('is-dirty');
      saveRow?.classList.remove('is-blocked');
      if (saveState) saveState.textContent = 'Todo guardado';
      clearDraft();
      page.querySelectorAll('.dates-event-row.is-wrong').forEach(r => r.classList.remove('is-wrong'));
    };
    /**
     * El guardado está parado por algo concreto: se marca la fila culpable, se
     * lleva la vista hasta ella y se explica. Un aviso suelto en una esquina
     * era lo que hacía que el botón pareciera no funcionar.
     */
    const blockSave = (motivo, row) => {
      page.querySelectorAll('.dates-event-row.is-wrong').forEach(r => r.classList.remove('is-wrong'));
      row?.classList.add('is-wrong');
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      saveRow?.classList.add('is-blocked');
      if (saveState) saveState.textContent = `No se puede guardar: ${motivo.toLowerCase()}`;
      saveDraft();
      showToast(`Falta un dato para guardar: ${motivo.toLowerCase()}.`, 'error', 6000);
    };

    // Si quedó un borrador de una sesión anterior (cerraste sin guardar, o el
    // subida falló), aparece con un botón para recuperar lo escrito.
    const draftRow = page.querySelector('#datesDraftRow');
    const showDraft = (draft) => {
      if (!draftRow || !draft?.dates) return;
      const cuando = new Date(draft.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      const text = page.querySelector('#datesDraftText');
      if (text) text.textContent = `Hay cambios sin subir del ${cuando}.`;
      draftRow.hidden = false;
    };
    page.querySelector('#restoreDraftBtn')?.addEventListener('click', () => {
      const draft = readDraft();
      if (!draft?.dates) return;
      const d = draft.dates;
      const set = (sel, value) => { const el = page.querySelector(sel); if (el && value) el.value = value; };
      set('#dateAnniversary', d.anniversary);
      set('#dateHubStart', d.hubStart);
      set('#dateBirthday', d.birthday);
      set('#dateUserBirthday', d.userBirthday);
      set('#dateAnniversaryTitle', d.titles?.anniversary);
      set('#dateHubStartTitle', d.titles?.hubStart);
      set('#dateBirthdayTitle', d.titles?.birthday);
      set('#dateUserBirthdayTitle', d.titles?.userBirthday);
      for (const [sel, key] of [['#dateAnniversaryRecur', 'anniversary'], ['#dateHubStartRecur', 'hubStart'], ['#dateBirthdayRecur', 'birthday'], ['#dateUserBirthdayRecur', 'userBirthday']]) {
        const el = page.querySelector(sel);
        if (el) el.checked = d.recurring?.[key] === true;
      }
      if (Array.isArray(d.events)) editingDates = d.events.map(e => ({ ...e }));
      if (Array.isArray(d.seasonal)) editingSeasonal = seasonalEvents({ seasonal: d.seasonal }).map(x => ({ ...x }));
      renderDateEvents();
      renderSeasonal();
      renderDateLooks();
      draftRow.hidden = true;
      markDirty();
      showToast('Recuperado lo que no se había guardado. Pulsa Guardar fechas.', 'success');
    });
    page.querySelector('#discardDraftBtn')?.addEventListener('click', () => {
      clearDraft();
      draftRow.hidden = true;
      showToast('Se ha descartado el borrador de este navegador', 'info');
    });
    page.querySelector('.config-dates')?.addEventListener('input', markDirty);
    page.querySelector('.config-dates')?.addEventListener('change', markDirty);
    /**
     * Lee todo lo del panel tal como está ahora mismo. La comparten el botón
     * de guardar y el borrador local: una sola lectura, para que lo que se
     * recupera sea exactamente lo que se iba a guardar.
     */
    function collectDates() {
      const events = [...page.querySelectorAll('#datesEventsList .dates-event-row')].map(row => ({
        id: row.dataset.evId,
        title: row.querySelector('.dates-event-title').value.trim(),
        date: row.querySelector('.dates-event-date').value,
        recurring: row.querySelector('.dates-event-recur-cb')?.checked === true,
        actions: readActions(row),
        ...readLookFields(row)
      }));
      const seasonal = [...page.querySelectorAll('#datesSeasonalList .dates-event-row')].map(row => ({
        id: row.dataset.seId,
        title: row.querySelector('.dates-se-title').value.trim(),
        monthDay: row.querySelector('.dates-se-monthday').value.trim(),
        enabled: row.querySelector('.dates-se-enabled')?.checked === true,
        ...readLookFields(row)
      }));
      const looks = {};
      for (const row of page.querySelectorAll('#datesLooksList .dates-look-row')) {
        const look = readLookFields(row);
        if (look.icon || look.description || look.type || look.image || look.video || look.gallery.length) {
          looks[row.dataset.lookId] = look;
        }
      }
      return {
        anniversary: page.querySelector('#dateAnniversary').value,
        hubStart: page.querySelector('#dateHubStart').value,
        birthday: page.querySelector('#dateBirthday').value,
        userBirthday: page.querySelector('#dateUserBirthday').value,
        events,
        seasonal,
        looks,
        titles: {
          anniversary: page.querySelector('#dateAnniversaryTitle').value,
          hubStart: page.querySelector('#dateHubStartTitle').value,
          birthday: page.querySelector('#dateBirthdayTitle').value,
          userBirthday: page.querySelector('#dateUserBirthdayTitle').value
        },
        recurring: {
          anniversary: page.querySelector('#dateAnniversaryRecur')?.checked === true,
          hubStart: page.querySelector('#dateHubStartRecur')?.checked === true,
          birthday: page.querySelector('#dateBirthdayRecur')?.checked === true,
          userBirthday: page.querySelector('#dateUserBirthdayRecur')?.checked === true
        }
      };
    }

    /** Lee los cuatro campos de aspecto de una fila (emoji, color, texto, foto). */
    function readLookFields(row) {
      const val = sel => row.querySelector(sel)?.value.trim() || '';
      return {
        icon: val('.dates-look-icon'),
        type: val('.dates-look-type') || 'custom',
        description: val('.dates-look-desc'),
        image: val('.dates-look-image'),
        // Lo que llena la tarjeta: vídeo de portada o de fondo, la tira de
        // fotos y el ambiente que cae al abrirla.
        video: val('.dates-look-video'),
        videoMode: val('.dates-look-videomode') || 'portada',
        gallery: val('.dates-look-gallery').split('\n').map(url => url.trim()).filter(Boolean).slice(0, MAX_GALLERY),
        decor: val('.dates-look-decor') || 'confeti',
        emojis: val('.dates-look-emojis').split(/\s+/).filter(Boolean).slice(0, MAX_EMOJIS).join(' ')
      };
    }

    /** Acciones escritas en una fila (texto del botón + destino), ya limpias. */
    function readActions(row) {
      return cleanEventActions([...row.querySelectorAll('[data-actions-list] .dates-action-row')].map(a => ({
        label: a.querySelector('.dates-action-label')?.value || '',
        route: a.querySelector('.dates-action-route')?.value || ''
      })));
    }

    // ---- Catálogo de plantillas, compartido con la hoja ----
    const templates = Object.values(EVENT_TEMPLATES);
    const tonePair = (value) => SPECIAL_EVENT_TONES[eventTemplateFor(value).id] || SPECIAL_EVENT_TONES.custom;

    /**
     * Selector visual de plantilla. Los botones son lo que se ve y se elige
     * (rol de radio); el valor sigue viajando en un input oculto con la clase
     * de siempre, así lo que lee y guarda el formulario no cambia.
     */
    const templatePickerHTML = (value) => {
      const current = eventTemplateFor(value);
      return `
        <div class="dates-templates">
          <div class="dates-templates-grid" role="radiogroup" aria-label="Plantilla de ocasión">
            ${templates.map(template => `
              <button type="button" class="dates-template-option" role="radio" data-template-set="${template.id}"
                aria-checked="${template.id === current.id}" style="--t-accent:${template.tone[0]};--t-soft:${template.tone[1]}">
                <span class="dates-template-option__emoji" aria-hidden="true">${template.icon}</span>
                <span class="dates-template-option__text">
                  <b>${template.label}</b>
                  <small>${template.short}</small>
                </span>
              </button>`).join('')}
          </div>
          <input type="hidden" class="dates-look-type" value="${current.id}">
          <p class="dates-template-hint">${current.editorHint}</p>
        </div>`;
    };
    /** Conecta los botones de plantilla de un contenedor con su input oculto. */
    const bindTemplatePickers = (scope, onPick) => {
      scope.querySelectorAll('[data-template-set]').forEach(btn => {
        btn.addEventListener('click', () => {
          const picker = btn.closest('.dates-templates');
          const hidden = picker?.querySelector('.dates-look-type');
          if (!hidden) return;
          hidden.value = btn.dataset.templateSet;
          picker.querySelectorAll('[data-template-set]').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
          const hint = picker.querySelector('.dates-template-hint');
          if (hint) hint.textContent = eventTemplateFor(hidden.value).editorHint;
          markDirty();
          onPick?.(hidden.value);
        });
      });
    };

    // El ambiente es todo lo que llena la bienvenida: emoji, lluvia, decoración,
    // texto y media. Se agrupa y se etiqueta, en vez de una fila de iconos.
    const ambienceFieldsHTML = (look = {}) => `
      <div class="dates-field-grid">
        <label class="dates-look-field">
          <span>Emoji principal</span>
          <input type="text" class="dates-look-icon" value="${esc(look.icon || '')}" placeholder="${esc(eventTemplateFor(look.type).defaultEmoji)}" maxlength="4" aria-label="Emoji principal">
        </label>
        <label class="dates-look-field">
          <span>Ambiente al abrir</span>
          <select class="dates-look-decor" aria-label="Ambiente de la bienvenida">${decorOptions(look.decor)}</select>
        </label>
        <label class="dates-look-field dates-look-field--wide">
          <span>Lluvia de emojis</span>
          <input type="text" class="dates-look-emojis" value="${esc(look.emojis || '')}" placeholder="${esc(THEME_EMOJIS[look.type] || THEME_EMOJIS.custom)}" aria-label="Emojis que caen al abrir">
          <small class="dates-look-note">Vacío: caen los de la plantilla. Sepáralos con espacios.</small>
        </label>
        <label class="dates-look-field dates-look-field--wide">
          <span>Texto de la bienvenida</span>
          <textarea class="dates-look-desc" rows="2" maxlength="180" placeholder="Lo que se lea ese día" aria-label="Texto de la bienvenida">${esc(look.description || '')}</textarea>
        </label>
        <label class="dates-look-field dates-look-field--wide">
          <span>Foto principal (URL)</span>
          <input type="url" class="dates-look-image" value="${esc(look.image || '')}" placeholder="https://…" aria-label="Foto principal">
        </label>
        <label class="dates-look-field dates-look-field--wide">
          <span>Vídeo (URL)</span>
          <input type="url" class="dates-look-video" value="${esc(look.video || '')}" placeholder="https://…mp4" aria-label="Vídeo de la bienvenida">
        </label>
        <label class="dates-look-field">
          <span>El vídeo va…</span>
          <select class="dates-look-videomode" aria-label="Dónde se ve el vídeo">${videoModeOptions(look.videoMode)}</select>
        </label>
        <label class="dates-look-field dates-look-field--wide">
          <span>Galería (una URL por línea)</span>
          <textarea class="dates-look-gallery" rows="2" placeholder="https://…&#10;https://…" aria-label="Fotos de la galería">${esc((look.gallery || []).join('\n'))}</textarea>
        </label>
      </div>`;
    let editingDates = (hubDates.events || []).map(e => ({ ...e }));

    // ---- Ver la bienvenida sin esperar al día ----
    // Antes solo se veía el día que de verdad caía, y un evento con la
    // fecha pasada no daba ninguna pista de por qué no salía. Con estos
    // botones se comprueba al momento: «Hoy» pone la fecha de hoy, «Ver»
    // abre la hoja con lo que hay escrito y la línea de estado dice si
    // ese día sale hoy, cuándo o por qué no sale.
    const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    /** '2026-09-02' -> '2 sep 2026' (o '' si no es una fecha). */
    const readableDate = (iso) => {
      const [y, m, d] = String(iso || '').split('-').map(Number);
      return y && m && d ? `${d} ${MESES_CORTOS[m - 1]} ${y}` : '';
    };
    /** '10-31' -> '31 de octubre' (o '' si no es un mes-día). */
    const readableMonthDay = (mmdd) => {
      const m = /^\d{2}-\d{2}$/.exec(String(mmdd || ''));
      if (!m || !isValidMonthDay(mmdd)) return '';
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${Number(mmdd.slice(3, 5))} de ${meses[Number(mmdd.slice(0, 2)) - 1]}`;
    };
    /** Lo que pinta la hoja, ledío de una fila del editor. */
    const draftFromRow = (row, seasonal = false) => ({
      title: row.querySelector(seasonal ? '.dates-se-title' : '.dates-event-title')?.value.trim() || '',
      // Vacío = el emoji de la plantilla elegida, igual que en el día real.
      icon: row.querySelector('.dates-look-icon')?.value.trim() || '',
      type: row.querySelector('.dates-look-type')?.value || 'custom',
      description: row.querySelector('.dates-look-desc')?.value.trim() || '',
      image: row.querySelector('.dates-look-image')?.value.trim() || '',
      video: row.querySelector('.dates-look-video')?.value.trim() || '',
      videoMode: row.querySelector('.dates-look-videomode')?.value || 'portada',
      gallery: (row.querySelector('.dates-look-gallery')?.value || '')
        .split('\n').map(url => url.trim()).filter(Boolean).slice(0, MAX_GALLERY),
      decor: row.querySelector('.dates-look-decor')?.value || 'confeti',
      emojis: row.querySelector('.dates-look-emojis')?.value.trim() || '',
      // La simulación muestra los mismos botones que verá ese día.
      actions: readActions(row)
    });
    /** Abre la hoja con el borrador de una fila, marcada como simulación. */
    const openDraftSheet = (row, seasonal = false) => {
      const draft = draftFromRow(row, seasonal);
      openSpecialEventSheet([{
        ...draft,
        title: draft.title || 'Día especial',
        description: draft.description || 'Así se verá este día en la bienvenida.'
      }], router, { preview: true });
    };
    /** '2026-09-02' con un desfase en días (para calcular el aviso de 7 días). */
    const isoShift = (iso, days) => {
      const [y, m, d] = String(iso || '').split('-').map(Number);
      if (!y || !m || !d) return '';
      const date = new Date(y, m - 1, d + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    /** Lo que se ve en la tarjeta y lo que se explica dentro del editor. */
    const whenForEvent = (row) => {
      const title = row.querySelector('.dates-event-title')?.value.trim() || '';
      const date = row.querySelector('.dates-event-date')?.value || '';
      const repeats = row.querySelector('.dates-event-recur-cb')?.checked === true;
      if (!title) return { tone: 'warn', text: 'Falta el nombre: sin él no se guarda.', forecast: 'Paso 1: ponle un nombre para poder guardarlo.' };
      if (!date) return { tone: 'muted', text: 'Ponle una fecha para saber cuándo sale.', forecast: 'Paso 1: sin fecha no hay día en el que aparezca.' };
      const today = todayISO();
      if (date === today) {
        return {
          tone: 'ok',
          text: '✓ Sale hoy en el Inicio.',
          forecast: 'Hoy: la bienvenida se abre una vez al entrar. Después, el banner del Inicio permite volver a verla cuando quieras.'
        };
      }
      if (date > today) {
        // Un evento del panel se anuncia unos días antes: quien lo escriba
        // tiene que saber que ya va a salir, no esperar a su víspera.
        const faltan = daysUntilDate(date, today);
        const desde = readableDate(isoShift(date, -7));
        return faltan !== null && faltan <= 7
          ? {
              tone: 'info',
              text: `Sale el ${readableDate(date)}: ya se anuncia (faltan ${faltan} ${faltan === 1 ? 'día' : 'días'}).`,
              forecast: `Próximamente: desde el ${desde} aparece un aviso en pantalla al entrar en Inicio. No es una notificación push. Ese día vuelve a abrir la bienvenida.`
            }
          : {
              tone: 'info',
              text: `Sale el ${readableDate(date)}.`,
              forecast: `Aparecerá el ${readableDate(date)}. El aviso en pantalla empieza 7 días antes, al entrar en Inicio el ${desde}; no es una notificación push.`
            };
      }
      return repeats
        ? {
            tone: 'warn',
            text: `La fecha ya pasó (${readableDate(date)}), pero con ♻️ repetirá el ${readableMonthDay(date.slice(5))}.`,
            forecast: `La fecha original ya pasó. Al repetirse cada año, volverá el ${readableMonthDay(date.slice(5))}, con un aviso en pantalla 7 días antes.`
          }
        : {
            tone: 'warn',
            text: `⚠️ La fecha ya pasó (${readableDate(date)}): no volverá a salir.`,
            forecast: 'La fecha ya pasó y no se repite, así que no volverá a aparecer. Activa la repetición anual o elige otra fecha.'
          };
    };
    /** Lo mismo para un día temático, que se fecha con mes-día. */
    const whenForSeasonal = (row) => {
      const title = row.querySelector('.dates-se-title')?.value.trim() || '';
      const monthDay = row.querySelector('.dates-se-monthday')?.value.trim() || '';
      const enabled = row.querySelector('.dates-se-enabled')?.checked === true;
      if (!enabled) return { tone: 'muted', text: 'Apagado: ese día no saltará.', forecast: 'Apagado: no aparecerá aunque llegue su fecha.' };
      if (!title) return { tone: 'warn', text: 'Falta el nombre: sin él no se guarda.', forecast: 'Ponle un nombre para poder guardarlo.' };
      const cada = readableMonthDay(monthDay);
      if (!cada) return { tone: 'muted', text: 'Pon el mes y el día (p. ej. 10-31).', forecast: 'Necesita un mes y un día válidos, como 10-31.' };
      const hoyMD = todayISO().slice(5);
      if (monthDay === hoyMD) return { tone: 'ok', text: '✓ Sale hoy en el Inicio.', forecast: 'Hoy: se abre la bienvenida y el banner del Inicio permite volver a verla.' };
      return monthDay > hoyMD
        ? { tone: 'info', text: `Sale el ${cada}.`, forecast: `Cada ${cada}. Los días temáticos no se anuncian antes: la bienvenida aparece solo ese día.` }
        : { tone: 'warn', text: `Este año ya pasó: el año que viene, el ${cada}.`, forecast: `Cada ${cada}; este año ya pasó. La bienvenida vuelve el año que viene, solo ese día.` };
    };
    /** La tarjeta resume lo que hay escrito ahora mismo, sin guardar. */
    const refreshCardSummary = (row, seasonal = false) => {
      const val = sel => row.querySelector(sel)?.value.trim() || '';
      const title = val(seasonal ? '.dates-se-title' : '.dates-event-title');
      const type = val('.dates-look-type') || 'custom';
      const template = eventTemplateFor(type);
      const icon = val('.dates-look-icon') || template.defaultEmoji;
      const date = seasonal ? val('.dates-se-monthday') : val('.dates-event-date');
      const repeats = seasonal ? true : row.querySelector('.dates-event-recur-cb')?.checked === true;
      const gallery = val('.dates-look-gallery').split('\n').map(url => url.trim()).filter(Boolean);
      const partes = [
        seasonal ? (readableMonthDay(date) || 'Sin fecha') : (readableDate(date) || 'Sin fecha'),
        repeats ? 'cada año' : 'una sola vez',
        template.label
      ];
      if (gallery.length) partes.push(`${gallery.length} ${gallery.length === 1 ? 'foto' : 'fotos'}`);
      if (val('.dates-look-video')) partes.push('vídeo');
      const titleEl = row.querySelector('.dates-card-title');
      if (titleEl) titleEl.textContent = title || (seasonal ? 'Día temático sin nombre' : 'Evento sin nombre');
      const metaEl = row.querySelector('.dates-card-meta');
      if (metaEl) metaEl.textContent = partes.join(' · ');
      const iconEl = row.querySelector('.dates-card-emoji');
      if (iconEl) iconEl.textContent = icon;
      renderLookPreview(row, title);
    };
    /** Pinta el estado y el pronóstico de todas las filas de las dos listas. */
    const refreshWhens = () => {
      const paint = (selector, calc, seasonal) => page.querySelectorAll(selector).forEach(row => {
        const info = calc(row);
        const out = row.querySelector('.dates-when');
        if (out) {
          out.className = `dates-when dates-when--${info.tone}`;
          out.textContent = info.text;
        }
        const forecast = row.querySelector('.dates-forecast');
        if (forecast) forecast.textContent = info.forecast;
        refreshCardSummary(row, seasonal);
      });
      paint('#datesEventsList .dates-event-row', whenForEvent, false);
      paint('#datesSeasonalList .dates-event-row', whenForSeasonal, true);
    };
    // Se repinta solo mientras se escribe: el estado se lee sin guardar.
    page.querySelectorAll('#datesEventsList, #datesSeasonalList').forEach(list => {
      list.addEventListener('input', refreshWhens);
      list.addEventListener('change', refreshWhens);
    });

    // Un evento ya no es una fila de campos e iconos: es una tarjeta que
    // resume lo guardado y, al abrirse, un flujo en cinco pasos con etiquetas
    // explícitas, vista previa y un resumen de cuándo aparecerá.
    /** Una acción de la hoja: el texto del botón y a dónde lleva. */
    const dateActionRow = (a = {}) => `
      <div class="dates-action-row">
        <input type="text" class="dates-action-label" placeholder="Qué pone el botón (p. ej. Ver la sorpresa)" value="${esc(a.label || '')}" maxlength="30" aria-label="Texto de la acción">
        <input type="text" class="dates-action-route" placeholder="/calendario o https://…" value="${esc(a.route || '')}" spellcheck="false" aria-label="Destino de la acción">
        <button type="button" class="dates-action-del" aria-label="Quitar acción">✕</button>
      </div>`;

    const dateEventRow = (e) => {
      const uid = e.id || 'ev' + Math.random().toString(36).slice(2, 8);
      const hasDetail = !!(e.description || e.icon || e.image || e.video || e.type || (e.gallery || []).length || (e.actions || []).length);
      return `
        <article class="dates-event-row dates-event-card${hasDetail ? ' is-open' : ''}" data-ev-id="${uid}">
          <header class="dates-card-head">
            <span class="dates-card-emoji" aria-hidden="true">${esc(e.icon || eventTemplateFor(e.type).defaultEmoji)}</span>
            <div class="dates-card-body">
              <b class="dates-card-title">${esc(e.title || 'Evento sin nombre')}</b>
              <span class="dates-card-meta"></span>
            </div>
            <div class="dates-card-actions">
              <button type="button" class="dates-event-edit" aria-expanded="${hasDetail}" aria-controls="ev-editor-${uid}">Editar</button>
              <button type="button" class="dates-event-preview" title="Ver la bienvenida" aria-label="Ver la bienvenida">Ver</button>
              <button type="button" class="dates-event-del" aria-label="Quitar evento">Quitar</button>
            </div>
          </header>
          <p class="dates-when"></p>
          <div class="dates-event-editor" id="ev-editor-${uid}"${hasDetail ? '' : ' hidden'}>
            <fieldset class="dates-fieldset">
              <legend>1 · Datos esenciales</legend>
              <div class="dates-field-grid">
                <label class="dates-look-field dates-look-field--wide">
                  <span>Nombre del evento</span>
                  <input type="text" class="dates-event-title" placeholder="Qué es (p. ej. Viaje a la playa)" value="${esc(e.title || '')}" maxlength="60" aria-label="Nombre del evento">
                </label>
                <label class="dates-look-field">
                  <span>Fecha</span>
                  <input type="date" class="dates-event-date" value="${esc(e.date || '')}" aria-label="Fecha del evento">
                </label>
                <div class="dates-field-actions">
                  <label class="dates-check"><input type="checkbox" class="dates-event-recur-cb" ${e.recurring === true ? 'checked' : ''}><span>Se repite cada año</span></label>
                  <button type="button" class="dates-event-today">Usar hoy</button>
                </div>
              </div>
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>2 · Plantilla de ocasión</legend>
              ${templatePickerHTML(e.type || 'custom')}
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>3 · Ambiente</legend>
              ${ambienceFieldsHTML(e)}
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>4 · Acciones de la bienvenida <span class="dates-optional">(opcional)</span></legend>
              <p class="dates-look-note">Los botones que verá ese día. Si no pones ninguna, sale el de siempre («Abrir el calendario»).</p>
              <div class="dates-actions-list" data-actions-list>${(e.actions || []).map(dateActionRow).join('')}</div>
              <button type="button" class="admin-btn admin-btn-ghost dates-action-add">${UI.plus} Añadir acción</button>
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>5 · Cuándo aparece</legend>
              <p class="dates-forecast"></p>
              <p class="dates-look-preview" data-preview-for="${uid}"></p>
              <button type="button" class="dates-event-open-preview">Ver la bienvenida</button>
            </fieldset>
          </div>
        </article>`;
    };

    // Vista previa en vivo de la hoja: plantilla, texto y media, sin abrirla.
    const renderLookPreview = (row, title) => {
      const out = row.querySelector('[data-preview-for]');
      if (!out) return;
      const val = sel => row.querySelector(sel)?.value.trim() || '';
      const type = val('.dates-look-type') || 'custom';
      const template = eventTemplateFor(type);
      const icon = val('.dates-look-icon') || template.defaultEmoji;
      const desc = val('.dates-look-desc');
      const image = val('.dates-look-image');
      const gallery = val('.dates-look-gallery').split('\n').map(url => url.trim()).filter(Boolean);
      const acciones = readActions(row).length;
      const [accent, soft] = tonePair(template.id);
      const piezas = [
        image ? 'foto principal' : 'sin foto',
        gallery.length ? `${gallery.length} en galería` : '',
        val('.dates-look-video') ? 'vídeo' : '',
        acciones ? `${acciones} ${acciones === 1 ? 'acción' : 'acciones'}` : ''
      ].filter(Boolean);
      out.innerHTML = `
        <span class="dates-look-chip" style="--event-accent:${accent};--event-soft:${soft}">
          ${image ? `<img class="dates-look-chip-photo" src="${esc(image)}" alt="" loading="lazy">` : ''}
          <span class="dates-look-chip-icon">${esc(icon)}</span>
        </span>
        <span class="dates-look-chip-text">
          <b>${esc(title || 'Día especial')}</b>
          <small>${template.label} · ${template.short}</small>
          ${desc ? `<small>${esc(desc)}</small>` : '<small class="muted-text">Sin texto: se usará el de la plantilla.</small>'}
          <small class="dates-look-chip-meta">${piezas.join(' · ')}</small>
        </span>`;
    };

    /** Pinta las acciones guardadas de una fila y deja listos sus ✕. */
    const bindActionDeletes = (box) => {
      box.querySelectorAll('.dates-action-del').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('.dates-action-row')?.remove();
          markDirty();
        });
      });
    };
    const paintActions = (row, actions = []) => {
      const box = row.querySelector('[data-actions-list]');
      if (!box) return;
      box.innerHTML = actions.map(dateActionRow).join('');
      bindActionDeletes(box);
    };

    const renderDateEvents = () => {
      const list = page.querySelector('#datesEventsList');
      if (!list) return;
      list.innerHTML = editingDates.map(dateEventRow).join('');
      // Las acciones se añaden y se quitan dentro de su propia tarjeta:
      // repintar la lista entera se llevaría por delante lo escrito.
      list.querySelectorAll('.dates-event-row').forEach((row, i) => paintActions(row, editingDates[i]?.actions || []));
      list.querySelectorAll('.dates-action-add').forEach(btn => {
        btn.addEventListener('click', () => {
          const box = btn.closest('.dates-fieldset')?.querySelector('[data-actions-list]');
          if (!box) return;
          if (box.children.length >= MAX_EVENT_ACTIONS) {
            showToast(`Máximo ${MAX_EVENT_ACTIONS} acciones por evento`, 'info');
            return;
          }
          box.insertAdjacentHTML('beforeend', dateActionRow({}));
          bindActionDeletes(box);
          markDirty();
          box.lastElementChild?.querySelector('.dates-action-label')?.focus();
        });
      });
      list.querySelectorAll('.dates-event-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.dates-event-row');
          // Se relee lo escrito antes de quitar un evento: quitarlo no puede
          // llevarse el texto ni las acciones de los otros.
          editingDates = collectDates().events;
          const idx = editingDates.findIndex(e => (e.id || '') === row.dataset.evId);
          if (idx >= 0) { editingDates.splice(idx, 1); renderDateEvents(); }
        });
      });
      list.querySelectorAll('.dates-event-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.dates-event-row');
          const editor = row.querySelector('.dates-event-editor');
          if (!editor) return;
          const open = editor.hidden;
          editor.hidden = !open;
          btn.setAttribute('aria-expanded', String(open));
          btn.textContent = open ? 'Cerrar' : 'Editar';
          row.classList.toggle('is-open', open);
          if (open) refreshWhens();
        });
      });
      list.querySelectorAll('.dates-event-today').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = btn.closest('.dates-event-row')?.querySelector('.dates-event-date');
          if (!input) return;
          input.value = todayISO();
          refreshWhens();
        });
      });
      // Dos formas de ver la bienvenida: la del encabezado y la del resumen.
      list.querySelectorAll('.dates-event-preview, .dates-event-open-preview').forEach(btn => {
        btn.addEventListener('click', () => openDraftSheet(btn.closest('.dates-event-row')));
      });
      bindTemplatePickers(list, () => refreshWhens());
      refreshWhens();
    };
    renderDateEvents();
    // Ver la bienvenida de HOY, no una simulación: olvida que ya se vio y la
    // abre tal cual saltaría. Sin esto, si el día ya se vio, cambiar la fecha
    // no lo hacía volver a aparecer en todo el año.
    page.querySelector('#replayWelcomeBtn')?.addEventListener('click', () => {
      if (!replaySpecialEventSheet(router)) {
        showToast('Hoy no hay ningún día especial configurado', 'error');
      }
    });
    // A la derecha del botón, lo que salíría hoy: así no hay que
    // recordar qué fechas están puestas.
    const replayHint = page.querySelector('#replayWelcomeHint');
    if (replayHint) {
      const hoy = specialEventsToday();
      replayHint.textContent = hoy.length
        ? `Hoy: ${hoy.map(e => e.title).join(' · ')}`
        : 'Hoy no hay ningún día configurado';
    }
    page.querySelector('#addDatesEventBtn')?.addEventListener('click', () => {
      editingDates.push({ id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', date: '', icon: '✨', type: 'custom', description: '', image: '' });
      renderDateEvents();
      // El nuevo sale ya desplegado y con el cursor en el nombre: es la parte
      // que hay que rellenar para que aparezca.
      const rows = page.querySelectorAll('.dates-event-row');
      const last = rows[rows.length - 1];
      last?.querySelector('.dates-event-edit')?.click();
      last?.querySelector('.dates-event-title')?.focus();
    });

    // ---- Aspecto de los cuatro días principales ----
    // Se edita directo sobre los inputs (no un array paralelo): lo que se ve
    // en el panel es lo que se guarda.
    const renderDateLooks = () => {
      const list = page.querySelector('#datesLooksList');
      if (!list) return;
      list.innerHTML = FIXED_EVENT_FIELDS.map(field => {
        const look = hubDates.looks?.[field.id] || {};
        const type = look.type || field.type;
        return `
        <div class="dates-look-row" data-look-id="${field.id}">
          <span class="dates-card-emoji" aria-hidden="true">${esc(look.icon || field.icon)}</span>
          <div class="dates-look-row-body">
            <p class="dates-look-row-title">${esc(field.label)} <small>· ${eventTemplateFor(type).label}</small></p>
            ${templatePickerHTML(type)}
            ${ambienceFieldsHTML(look)}
            <p class="dates-look-preview" data-preview-for="${field.id}"></p>
          </div>
        </div>`;
      }).join('');
      list.querySelectorAll('.dates-look-row').forEach(row => {
        const title = () => page.querySelector(`#date${fieldIdToInput(row.dataset.lookId)}Title`)?.value;
        renderLookPreview(row, title());
        // La vista previa se refresca al escribir, sin guardar.
        row.addEventListener('input', () => renderLookPreview(row, title()));
        bindTemplatePickers(row, () => renderLookPreview(row, title()));
      });
    };
    // anniversary -> Anniversary, userBirthday -> UserBirthday (el input usa CamelCase)
    function fieldIdToInput(id) {
      return id.charAt(0).toUpperCase() + id.slice(1);
    }
    renderDateLooks();

    // ---- Días temáticos ----
    // La lista arranca de lo que resuelve la app (fábrica + lo guardado), no
    // solo de lo guardado: si nunca se guardó, Halloween y Navidad salían
    // como lista vacía y parecía que no existieran ni se podían editar.
    let editingSeasonal = seasonalEvents(hubDates).map(s => ({ ...s }));
    const seasonalRow = (s) => {
      const uid = s.id || 'se' + Math.random().toString(36).slice(2, 8);
      return `
        <article class="dates-event-row dates-event-card is-open" data-se-id="${uid}">
          <header class="dates-card-head">
            <span class="dates-card-emoji" aria-hidden="true">${esc(s.icon || '✨')}</span>
            <div class="dates-card-body">
              <b class="dates-card-title">${esc(s.title || 'Día temático sin nombre')}</b>
              <span class="dates-card-meta"></span>
            </div>
            <div class="dates-card-actions">
              <button type="button" class="dates-se-preview" title="Ver la bienvenida" aria-label="Ver la bienvenida">Ver</button>
              <button type="button" class="dates-event-del" aria-label="Quitar día temático">Quitar</button>
            </div>
          </header>
          <p class="dates-when"></p>
          <div class="dates-event-editor">
            <fieldset class="dates-fieldset">
              <legend>1 · Datos esenciales</legend>
              <div class="dates-field-grid">
                <label class="dates-look-field dates-look-field--wide">
                  <span>Nombre</span>
                  <input type="text" class="dates-se-title" placeholder="Nombre (p. ej. Halloween)" value="${esc(s.title || '')}" maxlength="40" aria-label="Nombre del día temático">
                </label>
                <label class="dates-look-field">
                  <span>Mes y día</span>
                  <input type="text" class="dates-se-monthday" placeholder="MM-DD" value="${esc(s.monthDay || '')}" maxlength="5" pattern="[0-9]{2}-[0-9]{2}" aria-label="Mes y día, tipo 10-31">
                </label>
                <div class="dates-field-actions">
                  <label class="dates-check"><input type="checkbox" class="dates-se-enabled" ${s.enabled !== false ? 'checked' : ''}><span>Activo este año</span></label>
                  <button type="button" class="dates-se-today">Usar hoy</button>
                </div>
              </div>
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>2 · Plantilla de ocasión</legend>
              ${templatePickerHTML(s.type || 'custom')}
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>3 · Ambiente</legend>
              ${ambienceFieldsHTML(s)}
            </fieldset>

            <fieldset class="dates-fieldset">
              <legend>4 · Cuándo aparece</legend>
              <p class="dates-forecast"></p>
              <p class="dates-look-preview" data-preview-for="${uid}"></p>
            </fieldset>
          </div>
        </article>`;
    };
    const renderSeasonal = () => {
      const list = page.querySelector('#datesSeasonalList');
      if (!list) return;
      list.innerHTML = editingSeasonal.map(seasonalRow).join('');
      list.querySelectorAll('.dates-event-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.dates-event-row');
          const idx = editingSeasonal.findIndex(s => (s.id || '') === row.dataset.seId);
          if (idx >= 0) { editingSeasonal.splice(idx, 1); renderSeasonal(); }
        });
      });
      list.querySelectorAll('.dates-se-today').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = btn.closest('.dates-event-row')?.querySelector('.dates-se-monthday');
          if (!input) return;
          input.value = todayISO().slice(5);
          refreshWhens();
        });
      });
      list.querySelectorAll('.dates-se-preview').forEach(btn => {
        btn.addEventListener('click', () => openDraftSheet(btn.closest('.dates-event-row'), true));
      });
      bindTemplatePickers(list, () => refreshWhens());
      refreshWhens();
    };
    renderSeasonal();
    page.querySelector('#addDatesSeasonalBtn')?.addEventListener('click', () => {
      editingSeasonal.push({ id: 'se' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', monthDay: '', icon: '✨', type: 'custom', description: '', image: '', enabled: true });
      renderSeasonal();
    });

    page.querySelector('#saveDatesBtn')?.addEventListener('click', async e => {
      const button = e.currentTarget;
      if (button.disabled) return;
      // Fechas a medias: se señala la fila culpable en vez de un aviso suelto,
      // que es lo que hacía que el botón pareciera no funcionar.
      const sinFecha = [...page.querySelectorAll('#datesEventsList .dates-event-row')]
        .find(row => row.querySelector('.dates-event-title').value.trim() && !row.querySelector('.dates-event-date').value);
      if (sinFecha) {
        blockSave('Ese evento no tiene fecha', sinFecha);
        return;
      }
      const badSeasonal = [...page.querySelectorAll('#datesSeasonalList .dates-event-row')]
        .find(row => row.querySelector('.dates-se-title').value.trim()
          && !isValidMonthDay(row.querySelector('.dates-se-monthday').value.trim()));
      if (badSeasonal) {
        blockSave('Falta el mes y el día, tipo 10-31', badSeasonal);
        return;
      }
      const { anniversary, hubStart, birthday, userBirthday, events, seasonal, looks, titles, recurring } = collectDates();
      if (!anniversary || !hubStart || !birthday || !userBirthday) {
        showToast('Rellena las cuatro fechas', 'error');
        return;
      }
      const submitted = { anniversary, hubStart, birthday, userBirthday, events, seasonal, looks, titles, recurring };
      button.disabled = true;
      try {
        const saved = await db.saveHubDates(submitted, datesSnapshot);
        // Refresca la caché de fechas: el inicio, la bienvenida y el Perfil
        // reflejan el cambio al instante.
        refreshSpecialDates().catch(() => {});
        if (!isCurrentSection(token)) return;
        if (JSON.stringify(collectDates()) === JSON.stringify(submitted)) markSaved();
        else markDirty();
        showToast('Fechas especiales guardadas', 'success');
        const hint = page.querySelector('#datesSavedHint');
        if (hint) hint.textContent = `Aniversario ${saved.anniversary} · Hub ${saved.hubStart} · Cumple ${saved.birthday} · Tú ${saved.userBirthday}${saved.events?.length ? ` · ${saved.events.length} próximas` : ''}`;
      } catch (err) {
        if (!isCurrentSection(token)) return;
        console.error('[admin] No se pudieron guardar las fechas:', err);
        // Lo escrito sigue en el borrador local: avisar claro es la diferencia
        // entre «no guardó» y «no guardó, pero no has perdido nada».
        saveDraft();
        saveRow?.classList.add('is-blocked');
        // Sesión caducada o permisos: es el fallo más común al volver días
      // después, y el que más se confunde con «no funciona el botón». Se dice qué hacer.
        const caducada = /administrador|sesión|token|401|403/i.test(err?.message || '');
        if (saveState) saveState.textContent = caducada
          ? 'Sesión caducada: cierra sesión y vuelve a entrar'
          : 'No se ha podido subir; está guardado aquí';
        showToast(caducada
          ? 'Tu sesión ha caducado: vuelve a iniciar sesión y pulsa Guardar fechas. Lo que has escrito está guardado en este navegador.'
          : `${err?.message || 'No se pudieron guardar las fechas'}. Lo tienes a salvo en este navegador: no cierres esta pestaña.`, 'error', 9000);
      } finally { button.disabled = false; }
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

    // ¿Quedó algo sin subir? Solo si el borrador se diferencia de lo que hay
    // guardado; si son lo mismo, solo estaría ensuciando el pie para nada.
    const sinSubir = readDraft();
    if (sinSubir?.dates && JSON.stringify(sinSubir.dates) !== JSON.stringify(hubDates)) showDraft(sinSubir);
  }

  // ==========================================
  // DB CONNECTION STATUS
  // ==========================================
  async function renderDbStatus() {
    const banner = page.querySelector('#adminDbStatus');
    if (!banner) return;
    const status = await db.checkConnection();
    if (disposed) return;
    if (status.ok) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'block';
      banner.innerHTML = status.mode === 'supabase'
        ? '<strong>Base de datos no disponible</strong><br><small>Los cambios necesitan conexión a Supabase. Los borradores de fechas se conservan en este navegador.</small>'
        : '<strong>Modo local</strong><br><small>Algunas lecturas solo muestran los datos de este navegador.</small>';
    }
  }

  // ==========================================
  // INIT
  // ==========================================
  /**
   * Abre la sección que pide el aviso: `/admin?section=moods` o
   * `/admin?section=contenido&sub=maldia`.
   *
   * Se lee al montar, igual que el Rincón con `?tab=`. Un id desconocido no
   * cambia nada (manda el defecto del panel) y `sub` solo vale dentro de
   * Contenido, que es donde existen esas subsecciones.
   */
  function applyDeepLink() {
    const query = router?.currentRoute?.query;
    if (!query) return;
    const section = String(query.section || '');
    if (ADMIN_SECTION_IDS.includes(section)) S.section = section;
    const sub = String(query.sub || '');
    if (S.section === 'contenido' && ADMIN_CONTENT_SUB_IDS.includes(sub)) S.contentSub = sub;
  }

  renderDbStatus();
  applyDeepLink();
  loadSection(S.section);

  return page;
}
