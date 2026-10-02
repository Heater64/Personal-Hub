/* ==========================================
   Personal Hub v2 — Admin Panel
   Dashboard · Estados de Ánimo · Usuarios ·
   Contenido · Actividad
   ========================================== */

import '../styles/admin.css';
import { db, UPLOAD_LIMITS } from '../services/db.service.js';
import {
  loadCatalog, saveCatalog, loadFavorites,
  createId, getSeasons, getTotal, deleteCatalogItem
} from '../services/seriesData.js';
import { seasonEditorHTML, collectSeasons, emptySeasonHTML, bindSeasonEditorEvents } from '../services/seriesEditor.js';
import { defaultCatalog } from '../data/series-seed.js';
import { userStore } from '../stores/user.store.js';
import { moodStore } from '../stores/mood.store.js';
import { showToast } from '../components/Toast.js';
import { openSpecialEventSheet, replaySpecialEventSheet } from '../components/SpecialEventSheet.js';
import { decorOptions, videoModeOptions, THEME_EMOJIS, MAX_GALLERY, MAX_EMOJIS } from '../utils/celebration.js';
import { escapeHtml } from '../utils/escape.js';
import { isValidUrlField, todayISO, hourInSpain, timeInSpain } from '../utils/format.js';
import { refreshSpecialDates, loadSpecialDates, seasonalEvents, specialEventsToday, SPECIAL_EVENT_TONES, FIXED_EVENT_FIELDS } from '../utils/specialDates.js';
import { isPushSupported, isEnabled, showDailyNotification, requestEnable, disable } from '../services/notifications.service.js';
import { loadGiftsCatalog, invalidateGiftsCache } from '../services/gifts.service.js';
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
// Orden de las barras: primero el catálogo vigente, detrás el histórico.
const MOOD_ORDER = [...moodStore.getMoods(), ...(moodStore.getLegacyMoods() || [])].map(m => m.id);
const moodInfo = (id) => moodStore.resolveMood({ mood: id }) || { emoji: '—', label: String(id || '—'), score: 0 };

// El panel Admin muestra SOLO las estadísticas de este usuario (dada):
// ánimos, visitas, dónde pasa el tiempo y últimas conexiones. El resto de
// métricas (contenido, fechas…) son independientes del usuario, y el detalle
// al tocar una tarjeta de usuario sigue mostrando sus datos individuales.
// Cambia este id si quieres ver las de otra persona.
const STATS_USER_ID = '6fadf968-f3e8-465c-816d-f41978e00704';
const isStatsUser = (id) => id === STATS_USER_ID;
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

// Navegación del panel: menú lateral agrupado. Lo que se usa a diario va
// primero y sin rodeos; el resto no se esconde, simplemente baja a su grupo
// para que la lista siga siendo corta y cada sección tenga su sitio.
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
      { id: 'actividad',      icon: UI.activity, label: 'Actividad' },
      { id: 'config',         icon: UI.settings, label: 'Configuración' }
    ]
  }
];

// Todas las secciones en el orden en que aparecen en el menú.
const SECTIONS = NAV_GROUPS.flatMap(g => g.items);
const sectionInfo = (id) => SECTIONS.find(s => s.id === id) || { id, label: id, icon: '' };

// Una línea de orientación bajo cada título: en cuanto hay ocho
// secciones, saber qué hace cada una sin abrirla ahorra mucho ir y venir.
const SECTION_HINTS = {
  dashboard:      'Lo esencial del hub de un vistazo y un salto a cada sección.',
  contenido:      'Razones, canciones, regalos, noticias, mal día, series, Open When y audios.',
  multimedia:     'Sube cada archivo desde aquí: va directo a Galería, Memes o Audios y aparece en la app al momento.',
  moods:          'Cómo se ha sentidos cada día, mes a mes.',
  usuarios:       'Quién entra, cuándo y qué mira.',
  notificaciones: 'Avisos del hub y notificaciones push.',
  actividad:      'Registro completo de lo que va pasando.',
  config:         'Apariencia, fechas especiales y base de datos.'
};

// Colores disponibles para una bienvenida. El id va a SPECIAL_EVENT_TYPES y
// el tono a SPECIAL_EVENT_TONES: el Admin y la hoja leen los dos.
const EVENT_TYPE_OPTIONS = [
  { id: 'custom',      label: 'Hub (rosa)' },
  { id: 'birthday',    label: 'Cumpleaños' },
  { id: 'anniversary', label: 'Aniversario' },
  { id: 'memory',      label: 'Recuerdo' },
  { id: 'halloween',   label: 'Halloween (naranja)' },
  { id: 'christmas',   label: 'Navidad (verde)' },
  { id: 'valentine',   label: 'San Valentín (rojo)' }
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

  // El shell mide el contenido como una página de lectura (columna de 880 px).
  // Un panel de gestión con menú lateral se queda sin sitio para las
  // rejillas, así que se le pide más ancho mientras está montado y se
  // devuelve al navegar (cleanup).
  const appShell = document.getElementById('app');
  appShell?.classList.add('has-admin');

  const esc = escapeHtml;
  const user = userStore.getUser();
  const userName = user?.name || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();
  const userPhoto = user?.avatar || user?.photo || '';
  const userRole = user?.role || 'admin';

  // Time-based greeting (hora de España, península)
  const greetingFor = (h) => ({
    text: h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches',
    emoji: h < 12 ? '☀️' : h < 19 ? '🌤️' : '🌙'
  });
  const { text: greeting, emoji: greetingEmoji } = greetingFor(hourInSpain());

  // El menú lateral se pinta una sola vez a partir de NAV_GROUPS, para que
  // el HTML no repita la lista de secciones. En móvil es un cajón que
  // entra con el botón de la cabecera.
  const navHTML = NAV_GROUPS.map(g => `
    <div class="admin-nav-group">
      <span class="admin-nav-group-label">${g.label}<em>${g.hint}</em></span>
      ${g.items.map(t => `
        <button type="button" class="admin-sidebar-item" data-section="${t.id}">
          ${t.icon}<span>${t.label}</span>
        </button>`).join('')}
    </div>`).join('');

  page.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar" aria-label="Menú del panel">
        <div class="admin-sidebar-top">
          <span class="admin-sidebar-top-label">Panel de admin</span>
          <button type="button" class="admin-sidebar-close" id="adminNavClose" aria-label="Cerrar menú">${UI.close}</button>
        </div>
        <nav class="admin-sidebar-nav" id="adminSidebarNav" aria-label="Secciones del panel">${navHTML}</nav>
        <div class="admin-sidebar-footer">
          <button type="button" class="admin-btn-ghost admin-sidebar-home" id="adminGoHome" title="Volver al hub">
            ${UI.back}<span>Volver al hub</span>
          </button>
        </div>
      </aside>
      <div class="admin-nav-scrim" id="adminNavScrim" hidden></div>
      <main class="admin-main">
        <header class="admin-topbar">
          <button type="button" class="admin-nav-toggle" id="adminNavToggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="adminSidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
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
  const S = { section: 'dashboard', moodDate: new Date(), contentSub: 'razones', calMonth: null, calDay: null, configTab: 'fechas' };

  const content = page.querySelector('#adminContent');

  // Live clock. El saludo también se refresca: si el panel queda abierto
  // cruzar las 12:00 o las 19:00, "buenas noches" se quedaba obsoleto.
  const timeText = page.querySelector('#adminTimeText');
  const greetingEl = page.querySelector('#adminGreeting');
  const updateClock = () => {
    if (timeText) timeText.textContent = timeInSpain();
    if (greetingEl) {
      const g = greetingFor(hourInSpain());
      greetingEl.textContent = `${g.text}, ${userName} ${g.emoji}`;
    }
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 30000);

  // Fecha actual en el header
  const dateText = page.querySelector('#adminDateText');
  if (dateText) {
    dateText.textContent = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ===== NAV =====
  // Menú lateral en escritorio, cajón en móvil. Un solo sitio decide qué está
  // marcado, qué pone la cabecera y si el saludo se ve, para que ir a una
  // sección desde cualquier botón (menú, accesos, atajos) deixe el panel
  // siempre igual de orientado.
  const navScrim = page.querySelector('#adminNavScrim');
  const navToggle = page.querySelector('#adminNavToggle');
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

  function setNavOpen(open) {
    page.classList.toggle('nav-open', open);
    if (navScrim) navScrim.hidden = !open;
    navToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.documentElement.classList.toggle('admin-nav-locked', open);
  }
  navToggle?.addEventListener('click', () => setNavOpen(!page.classList.contains('nav-open')));
  navScrim?.addEventListener('click', () => setNavOpen(false));
  page.querySelector('#adminNavClose')?.addEventListener('click', () => setNavOpen(false));
  page.querySelector('#adminGoHome')?.addEventListener('click', () => {
    setNavOpen(false);
    router.navigate('/');
  });
  /**
   * Deja el panel orientado a una sección: marca su botón del menú, pone el
   * título en la cabecera pegajosa y esconde el saludo (que solo tiene sentido
   * en el resumen) para que las demás secciones no repitan la bienvenida.
   */
  function activateNav(section) {
    const known = !!page.querySelector(`.admin-sidebar-item[data-section="${section}"]`);
    const id = known ? section : 'dashboard';
    page.querySelectorAll('.admin-sidebar-item').forEach(t => t.classList.remove('active'));
    page.querySelector(`.admin-sidebar-item[data-section="${id}"]`)?.classList.add('active');
    if (topTitle) topTitle.innerHTML = `${sectionInfo(id).icon}<span>${sectionInfo(id).label}</span>`;
    if (welcomeBox) welcomeBox.classList.toggle('is-hidden', id !== 'dashboard');
    setNavOpen(false);
  }

  function setActiveSection(btn, section) {
    S.section = section;
    loadSection(section);
    // Al cambiar de sección, deja el botón activo a la vista en el menú.
    btn?.scrollIntoView({ block: 'nearest' });
  }

  page.querySelectorAll('.admin-sidebar-item').forEach(item => {
    item.addEventListener('click', () => setActiveSection(item, item.dataset.section));
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

  // Escape cierra también el cajón del menú (solo en móvil, donde se superpone).
  const navEscapeHandler = (e) => {
    if (e.key === 'Escape' && page.classList.contains('nav-open')) setNavOpen(false);
  };
  document.addEventListener('keydown', navEscapeHandler);

  // Cleanup on navigation
  page.cleanup = () => {
    appShell?.classList.remove('has-admin');
    document.removeEventListener('keydown', escapeHandler);
    document.removeEventListener('keydown', navEscapeHandler);
    document.removeEventListener('scroll', onTopScroll, true);
    clearInterval(clockInterval);
    // El bloqueo de scroll es global: si se navega con el cajón abierto, se
    // queda puesto y la web entera deja de hacer scroll al volver.
    document.documentElement.classList.remove('admin-nav-locked');
    // Desuscribe del aviso de ánimos en vivo (se reinstala en loadMoods)
    if (moodRealTimeOff) { moodRealTimeOff(); moodRealTimeOff = null; }
  };

  // ===== SECTION LOADER =====
  // Token de sección: si el usuario cambia de pestaña del admin mientras una
  // carga async está en curso, la escritura del DOM obsoleto se aborta.
  // Evita el crash "Cannot set properties of null (setting 'innerHTML')".
  let sectionToken = 0;
  // Token por render de Ánimos: dos clics rápidos en ‹ › lanzan renders
  // solapados; el último clic debe ganar aunque resuelva antes el anterior.
  let moodRenderToken = 0;
  // Unsubscribe del aviso de ánimos en vivo (se reinstala en loadMoods)
  let moodRealTimeOff = null;
  function loadSection(section) {
    sectionToken++;
    // Toda entrada a una sección pasa por aquí, así que el menú y la
    // cabecera se orientan solos venga de donde venga (menú, accesos,
    // atajos o el guardado de un modal, que recarga la sección actual).
    activateNav(section);
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
    const annivISO = hubDates.anniversary || '2025-07-03';
    const hubStartISO = hubDates.hubStart || '2024-05-10';
    const birthdayISO = hubDates.birthday || '2012-09-03';
    const userBirthdayISO = hubDates.userBirthday || '2009-08-03';

    // Estadísticas SOLO de dada: se descartan ánimos y visitas del resto.
    const moods = arr(allMoods).filter(m => isStatsUser(m.user_id));
    const reasonsList = arr(reasons);
    const songsList = arr(songs);
    const newsList = arr(news);
    const maldiaFrasesList = arr(maldiaFrases);
    const maldiaMensajesList = arr(maldiaMensajes);
    const owLettersList = arr(owLetters);
    const visitsList = arr(visits).filter(v => isStatsUser(v.user_id));
    const audiosList = arr(audios);
    const activityList = arr(activity);
    const giftsCount = (giftsData?.gifts || []).length;
    const seriesCount = Array.isArray(seriesCatalog) ? seriesCatalog.length : 0;
    const realUsers = users.filter(u => !u.id.startsWith('local_') && u.id.length > 10);

    if (token !== sectionToken) return; // la sección cambió mientras cargaba

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

    // ---- Gráfico de área ----
    // El eje se escalaba con 0.66 / 0.33 del máximo real, así que las
    // líneas de rejilla caían en 4.29 / 8.58 y quedaban irregulares, y los
    // <circle> se deformaban en elipses por el preserveAspectRatio="none".
    // Ahora: escala de paso redondo, curva suave y sin puntos deformados
    // (la lectura fina se hace con la guía + tooltip al pasar el ratón).
    const CHART_METRICS = { activity: 'Actividad', mood: 'Ánimos', visits: 'Visitas' };

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

    const areaChart = (days, metric = chartMetric) => {
      const nombre = CHART_METRICS[metric] || 'Actividad';
      const W = 540, H = 150, PAD = 10;
      const counts = days.map(d => d.count);
      const total = counts.reduce((a, b) => a + b, 0);
      const rawMax = Math.max(...counts, 1);
      const step = niceStep(rawMax / 4);
      const max = step * 4;
      const stepX = (W - PAD * 2) / (days.length - 1 || 1);
      const y = (c) => H - PAD - (c / max) * (H - PAD * 2);
      const pts = days.map((d, i) => [PAD + i * stepX, y(d.count)]);
      const line = smoothPath(pts);
      const area = `${line} L${(W - PAD).toFixed(1)},${(H - PAD).toFixed(1)} L${PAD},${(H - PAD).toFixed(1)} Z`;
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
            <span>No hay nada que dibujar todavía</span>
          </div>`;
      }

      return `
        <div class="dash-area-wrap">
          <svg class="dash-area-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
               aria-label="${esc(nombre)} de los últimos ${days.length} días. Máximo ${rawMax}, total ${total}">
            <defs>
              <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ff6b4a" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="#ff6b4a" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            ${grid.map(g => `<line x1="${PAD}" y1="${y(g).toFixed(1)}" x2="${W - PAD}" y2="${y(g).toFixed(1)}" class="dash-area-grid"/>`).join('')}
            <path d="${area}" fill="url(#dashAreaFill)"/>
            <path d="${line}" fill="none" class="dash-area-line"/>
            <line class="dash-area-guide" x1="0" y1="${PAD}" x2="0" y2="${H - PAD}"/>
            ${days.map((d, i) => {
              const cx = PAD + (i + 0.5) * stepX;
              return `<rect class="dash-area-hit" x="${(cx - stepX / 2).toFixed(1)}" y="0"
                            width="${stepX.toFixed(1)}" height="${H}"
                            data-i="${i}" data-x="${cx.toFixed(1)}"/>`;
            }).join('')}
          </svg>
          <div class="dash-area-tip" hidden></div>
        </div>
        <div class="dash-area-foot">
          <span class="dash-area-summary">
            <strong>${total}</strong> en ${days.length} días · máx. <strong>${rawMax}</strong>
          </span>
          <span class="dash-area-peak" title="Techo del eje">eje hasta ${max}</span>
        </div>
        <div class="dash-area-labels">
          ${days.map((d, i) => {
            if (!marked.includes(i)) return '';
            const pct = (i / (days.length - 1)) * 100;
            // El primero y el último se alinean a los bordes para que no
            // se salgan de la caja al traducirlos la mitad.
            const edge = i === 0 ? ' is-first' : i === days.length - 1 ? ' is-last' : '';
            return `<span class="dash-label${edge}" style="left:${pct.toFixed(2)}%">${d.label}</span>`;
          }).join('')}
        </div>`;
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
          tip.textContent = `${d.label} · ${d.count ? `${d.count} ${d.count === 1 ? 'evento' : 'eventos'}` : 'sin registros'}`;
          tip.style.left = `${((Number(hit.dataset.i) + 0.5) / days.length) * 100}%`;
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
    // Cada segmento lleva su <title>: al pasar el ratón se ve la cifra
    // exacta y, sin JavaScript, sigue siendo legible para el lector.
    const donutHtml = distSegs.map(d => {
      const len = Math.max(d.frac * CIRC - 2, 0.5);
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
    moods.forEach(m => { const k = m.mood || m.status || 'good'; moodCounts[k] = (moodCounts[k] || 0) + 1; });
    const dominant = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    const domKey = dominant ? dominant[0] : 'good';
    // Etiqueta y emoji del catalogs real: con el mapa local anterior, un
    // ánimo vigente ("cariño") caía en el respaldo y se pintaba "Feliz".
    const domInfo = moodInfo(domKey);
    const avgScore = moods.length
      ? moods.reduce((s, m) => s + (moodInfo(m.mood || m.status).score ?? 2), 0) / moods.length
      : 2;
    const WEEK_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const weekCounts = [0, 0, 0, 0, 0, 0, 0];
    moods.forEach(m => {
      if (!m.date) return;
      weekCounts[new Date(m.date + 'T12:00:00').getDay()]++;
    });
    const weekMax = Math.max(...weekCounts, 1);
    const weekTop = weekCounts.indexOf(weekMax);
    const weekTops = weekCounts.map((n, i) => (n && n === weekMax ? i : -1)).filter(i => i >= 0);
    const weekBars = WEEK_LABELS.map((l, i) => {
      const n = weekCounts[i];
      const h = n ? Math.max(Math.round((n / weekMax) * 100), 12) : 4;
      // La cifra se pinta encima de la barra: antes solo se veía al pasar el
      // ratón, y el gráfico no dizia cuántas barras había ni cuál era la mayor.
      return `<div class="dash-week-col${n === weekMax && n ? ' top' : ''}" title="${l}: ${n} registro${n === 1 ? '' : 's'}">
        <div class="dash-week-count">${n || ''}</div>
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
    const moodDist = MOOD_ORDER
      .filter(k => moodCounts[k])
      .map(k => ({ k, n: moodCounts[k], info: moodInfo(k) }));
    const moodDistMax = Math.max(...moodDist.map(d => d.n), 1);
    const moodDistHtml = moodDist.length ? moodDist.map(d => `
        <div class="dash-mooddist-row${d.k === domKey ? ' is-current' : ''}">
          <span class="dash-mooddist-face" aria-hidden="true">${esc(d.info.emoji)}</span>
          <span class="dash-mooddist-label">${esc(d.info.label)}${d.k === domKey ? ' <span class="dash-mooddist-tag"> predominante</span>' : ''}</span>
          <span class="dash-mooddist-track"><span class="dash-mooddist-fill" style="width:${Math.max(Math.round(d.n / moodDistMax * 100), 3)}%"></span></span>
          <span class="dash-mooddist-count">${d.n}</span>
        </div>`).join('') : '<p class="dash-week-caption">Sin registros de ánimo todavía</p>';

    const weekCaption = weekCounts.some(Boolean)
      ? (weekTops.length > 1
        // Empate: nombrar solo uno mentía, así que se listan todos.
        ? `<p class="dash-week-caption">Empate en el máximo (${weekMax}): <strong>${weekTops.slice(0, 4).map(i => WEEK_LABELS[i]).join(', ')}</strong>${weekTops.length > 4 ? ` y ${weekTops.length - 4} más` : ''}</p>`
        : `<p class="dash-week-caption">Día con más registros: <strong>${WEEK_LABELS[weekTop]}</strong> (${weekMax})</p>`)
      : '<p class="dash-week-caption">Sin registros de ánimo todavía</p>';

    // ---- Fechas importantes ----
    // Formato corto ("3 jul 2027"): el largo ("3 de julio de 2027") no cabía
    // junto a la cuenta atrás y se partía en dos renglones. Además coincide con
    // la fecha que ya usan las tarjetas de métricas ("3 jul 2025").
    const fmtDate = (d) => d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
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
    const ubd = new Date(userBirthdayISO + 'T00:00:00');
    let userBd = new Date(todayDate.getFullYear(), ubd.getMonth(), ubd.getDate());
    if (userBd < todayStart) userBd = new Date(todayDate.getFullYear() + 1, ubd.getMonth(), ubd.getDate());
    const userBdDays = daysUntil(userBd);
    const hubTitles = hubDates.titles || {};
    const hubRecurring = hubDates.recurring || {};
    // Antes cada ficha repetia la fecha original ("3 de septiembre de 2012")
    // junto a una cuenta atrás que apuntaba a 2027: dos fechas distintas en la
    // misma línea. Ahora se muestra la PRÓXIMA ocurrencia y el año original
    // pasa a la nota ("desde 2012"), que es lo que sí es informativo.
    const nextOccurrence = (iso) => {
      const start = new Date(iso + 'T00:00:00');
      let d = new Date(todayDate.getFullYear(), start.getMonth(), start.getDate());
      if (d < todayStart) d = new Date(todayDate.getFullYear() + 1, start.getMonth(), start.getDate());
      return d;
    };
    const sinceNote = (iso, everyYear) => {
      const y = new Date(iso + 'T00:00:00').getFullYear();
      const parts = [];
      if (everyYear) parts.push('cada año');
      if (y < todayDate.getFullYear()) parts.push(`desde ${y}`);
      // Espacio duro tras el punto: si la línea se parte, el separador va con
      // la palabra que sigue y no queda colgando al final ("cada año ·").
      // Carácter, no entidad: la nota pasa por esc() y &nbsp; se imprimiría
      // literal.
      return parts.join(' ·\u00A0');
    };
    const fechas = [
      { icon: '🤍', title: hubTitles.anniversary || `${annivYears} año${annivYears === 1 ? '' : 's'} juntos`, date: fmtDate(anniv),
        note: sinceNote(annivISO, hubRecurring.anniversary !== false),
        badge: annivDays === 0 ? '¡Hoy! 💫' : `En ${annivDays} día${annivDays === 1 ? '' : 's'}`, hot: annivDays <= 30 },
      { icon: '🎁', title: hubTitles.birthday || 'Cumpleaños de dada', date: fmtDate(birthday),
        note: sinceNote(birthdayISO, hubRecurring.birthday !== false),
        badge: birthdayDays === 0 ? '¡Hoy! 🎂' : `En ${birthdayDays} día${birthdayDays === 1 ? '' : 's'}`, hot: birthdayDays <= 30 },
      { icon: '🎂', title: hubTitles.userBirthday || 'Tu cumpleaños', date: fmtDate(userBd),
        note: sinceNote(userBirthdayISO, hubRecurring.userBirthday !== false),
        badge: userBdDays === 0 ? '¡Hoy! 🎂' : `En ${userBdDays} día${userBdDays === 1 ? '' : 's'}`, hot: userBdDays <= 30 },
      { icon: '📅', title: hubTitles.hubStart || 'Primer mensaje', date: fmtDate(new Date(hubStartISO + 'T00:00:00')),
        note: sinceNote(hubStartISO, false),
        badge: 'Ya pasó', muted: true }
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
        <p class="admin-section-hint">${SECTION_HINTS.dashboard}</p>

        <!-- Arriba del todo, lo accionable: a qué ir y qué editar. El resto
             del resumen es para mirar. -->
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
            <div id="dashActivityChart"></div>
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
                <div class="dash-mood-main">${esc(domInfo.label)} ${esc(domInfo.emoji)}</div>
                <div class="dash-mood-sub">${avgScore >= 2.5 ? 'Predomina el buen ánimo. ¡Sigue así!' : 'Un poquito de cariño no viene mal hoy.'}</div>
              </div>
              <div class="dash-mood-face">${esc(domInfo.emoji)}</div>
            </div>
            <div class="dash-week-chart">${weekBars}</div>
            ${weekCaption}
            <div class="dash-mooddist">${moodDistHtml}</div>
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
                    ${f.note ? `<div class="dash-fecha-note">${esc(f.note)}</div>` : ''}
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

    // Gráfico: una sola vía de render para métrica y rango, que además
    // vuelve a enganchar la guía/tooltip sobre el HTML recién inyectado.
    const renderChart = () => {
      const el = page.querySelector('#dashActivityChart');
      const range = page.querySelector('#dashActivityRange');
      if (!el) return;
      const days = seriesDays(Number(range?.value || 14), chartMetric);
      el.innerHTML = areaChart(days);
      bindAreaTip(el, days);
    };

    // Métrica del gráfico: Actividad | Ánimos | Visitas
    page.querySelectorAll('.dash-chart-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        chartMetric = btn.dataset.metric;
        page.querySelectorAll('.dash-chart-toggle').forEach(b => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderChart();
      });
    });

    // Rango del gráfico
    page.querySelector('#dashActivityRange')?.addEventListener('change', renderChart);

    renderChart();

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
  }

  // ==========================================
  // 2. ESTADO DE ÁNIMO
  // ==========================================
  async function loadMoods() {
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.heart} Estado de Ánimo</h2></div>
        <p class="admin-section-hint">${SECTION_HINTS.moods}</p>
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
    // Refresca el calendario en vivo cuando la usuaria registra/quita un ánimo
    // en el mes que se muestra (evento realtime o polling de seguridad).
    if (moodRealTimeOff) moodRealTimeOff();
    moodRealTimeOff = onMoodChange((mood) => {
      const ds = mood?.date;
      if (!ds) { render(); return; }
      const displayed = `${S.moodDate.getFullYear()}-${String(S.moodDate.getMonth() + 1).padStart(2, '0')}`;
      if (ds.slice(0, 7) === displayed) render();
    });
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
    // Solo estadísticas de dada: descarta los ánimos del resto de usuarios.
    Object.keys(monthMoods).forEach(ds => {
      monthMoods[ds] = monthMoods[ds].filter(m => isStatsUser(m.user_id));
    });
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
      const isFuture = ds > todayStr;

      let emojiHtml = '';
      let titleText = `${ds}: Sin registro`;
      if (hasMood) {
        const emojis = dailyMoods.slice(0, 3).map(m => esc(m.emoji || moodInfo(m.mood).emoji)).join('');
        const extra = dailyMoods.length > 3 ? `<span style="font-size:0.6rem;opacity:0.8">+${dailyMoods.length - 3}</span>` : '';
        emojiHtml = `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:1px;font-size:0.8rem;line-height:1">${emojis}${extra}</div>`;
        const labels = dailyMoods.map(m => esc(m.label || moodInfo(m.mood).label)).join(', ');
        titleText = `${esc(ds)}: ${labels}`;
      }

      html += `<div class="moods-cal-cell${isToday?' today':''}${hasMood?' has-mood':''}${isFuture?' future':''}" title="${titleText}">
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
      totalScore += moodInfo(m.mood).score;
    });
    const avg = totalScore / entries.length;
    const avgEmoji = avg >= 3.5 ? '🤍🤍🤍' : avg >= 2.5 ? '😊' : avg >= 1.5 ? '😕' : avg >= 0.5 ? '😔' : '❤️';
    const avgText = avg.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
      <div class="moods-stat" title="Media de la escala de 0 a 4"><span class="moods-stat-num">${esc(avgEmoji)} <span class="moods-stat-avg">${avgText}</span></span><span class="moods-stat-label">media del mes (0-4)</span></div>
      <div class="moods-stat"><span class="moods-stat-num">${daysWithMood}<span class="moods-stat-avg">/${daysInMonth}</span></span><span class="moods-stat-label">días con registro</span></div>
    </div>`;

    // Desglose: solo los ánimos que hay en el mes, de más a menos. Antes
    // salían las 10 filas del catálogo y con dos registros ocho marcaban 0 %,
    // y los ids antiguo y vigente comparten nombre ("Necesito cariño",
    // "Bien"), así que había filas duplicadas sin explicación.
    const rows = MOOD_ORDER
      .filter(k => counts[k])
      .sort((a, b) => counts[b] - counts[a] || MOOD_ORDER.indexOf(a) - MOOD_ORDER.indexOf(b));
    // Si TODO el mes es del catálogo antiguo, decirlo una vez en la cabecera
    // es mejor que repetir "antiguo" en cada fila; si está mezclado, la
    // etiqueta por fila es la que explica cuál es cuál.
    const allLegacy = rows.length > 0 && rows.every(k => moodInfo(k).legacy);
    const anyCurrent = rows.some(k => !moodInfo(k).legacy);
    breakdown.innerHTML = rows.length
      ? `<h4>Desglose${allLegacy ? ' <span class="moods-breakdown-note">estados antiguos</span>' : ''}</h4>` + rows.map(k => {
        const count = counts[k];
        const pct = Math.round(count / entries.length * 100);
        const info = moodInfo(k);
        const tag = info.legacy && anyCurrent ? ' <span class="moods-bar-legacy">antiguo</span>' : '';
        return `<div class="moods-bar-row" title="${esc(info.label)}: ${count} de ${entries.length} (${pct} %)${info.legacy ? ' · estado antiguo' : ''}">
          <span class="moods-bar-label">${esc(info.emoji)} ${esc(info.label)}${tag}</span>
          <div class="moods-bar-track"><div class="moods-bar-fill mood-${k}" style="width:${pct}%"></div></div>
          <span class="moods-bar-pct">${count} · ${pct}%</span>
        </div>`;
      }).join('')
      : '';
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
        <p class="admin-section-hint">${SECTION_HINTS.usuarios}</p>
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

    function renderUserList(list, query = '') {
      const listEl = page.querySelector('#userList');
      if (listEl) listEl.innerHTML = renderUsers(list, userMoodStats, visitStats, query);
      // Contador del encabezado: al buscar pasa a decir cuántas coinciden.
      const badge = page.querySelector('.admin-count-badge');
      if (badge) badge.textContent = String(list.length);
    }

    renderUserList(users);

    page.querySelector('#userSearch').addEventListener('input', function() {
      const raw = this.value.trim();
      const q = raw.toLowerCase();
      const f = users.filter(u =>
        (u.email||'').toLowerCase().includes(q) ||
        (u.name||'').toLowerCase().includes(q) ||
        (u.role||'').toLowerCase().includes(q)
      );
      renderUserList(f, raw);
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
      const vs = visitStats[u.id];
      const online = vs?.lastTs && (Date.now() - vs.lastTs < 5 * 60e3);
      const lastLogin = vs?.lastTs ? relTimeShort(vs.lastTs) : (u.last_login ? new Date(u.last_login).toLocaleDateString('es') : '—');
      const stats = moodStats[u.id];
      const moodBadge = stats && stats.total > 0
        ? getMoodSummaryBadge(stats)
        : '<span class="user-mood-none">Sin ánimos</span>';
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
            ${u.role === 'admin' ? '<span class="admin-badge-tag">Admin</span>' : ''}
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
            ${online
              ? '<strong class="user-online">En línea ahora</strong>'
              : `Última conexión: ${lastLogin}`}
            ${moodLast}
          </div>
          <div class="user-mood-row">${moodBadge}</div>
        </div>
        <div class="item-actions">
          <button class="item-action-btn" data-action="toggle" data-user-id="${esc(u.id)}" title="${enabled ? 'Deshabilitar' : 'Habilitar'} usuario" aria-label="${enabled ? 'Deshabilitar' : 'Habilitar'} a ${esc(u.name || u.email || 'este usuario')}">
            ${enabled ? UI.toggleOn : UI.toggleOff}
          </button>
          <button class="item-action-btn delete" data-action="delete-user" data-user-id="${esc(u.id)}" title="Eliminar usuario" aria-label="Eliminar a ${esc(u.name || u.email || 'este usuario')}">${UI.trash}</button>
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
    const pct = Math.round(max / stats.total * 100);
    const topFaces = tops.map(([id]) => moodInfo(id).emoji).join('');
    const topNames = tops.map(([id]) => moodInfo(id).label).join(' / ');
    // Línea de texto y no etiquetas: la columna mide ~250 px (los botones de
    // acción reservan 72 px aunque solo aparezcan al pasar el ratón) y dos
    // etiquetas inevitably se partían en dos renglones descuadrados.
    const topText = tops.length === 1
      ? `${esc(moodInfo(tops[0][0]).label)} <span class="user-mood-pct">(${pct} %)</span>`
      : `<strong>${tops.length} estados</strong> empatados <span class="user-mood-pct">(${pct} %)</span>`;
    return `<span class="user-mood-line"
      title="Ánimo más repetido: ${esc(topNames)} — ${max} de ${stats.total} registros (${pct} %)">
      ${esc(topFaces)} <strong>${stats.total}</strong> ${stats.total === 1 ? 'registro' : 'registros'} · ${topText}
    </span>`;
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
      const order = MOOD_ORDER;
      const rows = order.map(k => {
        const count = stats.moods[k] || 0;
        const pct = Math.round(count / stats.total * 100);
        if (count === 0) return '';
        const info = moodInfo(k);
        return `<div class="moods-bar-row">
          <span class="moods-bar-label" style="min-width:140px">${esc(info.emoji)} ${esc(info.label)}</span>
          <div class="moods-bar-track"><div class="moods-bar-fill mood-${k}" style="width:${pct}%"></div></div>
          <span class="moods-bar-pct">${count} (${pct}%)</span>
        </div>`;
      }).filter(Boolean).join('');

      const avgScore = order.reduce((sum, k) => sum + (moodInfo(k).score || 0) * (stats.moods[k] || 0), 0) / stats.total;
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
        const info = moodInfo(m.mood);
        const emoji = esc(m.emoji || info.emoji);
        const label = esc(m.label || info.label);
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
        <p class="admin-section-hint">${SECTION_HINTS.contenido}</p>
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
      // Si la carga falla, NO se devuelve un catálogo vacío: se propaga el
      // error para que el panel muestre el fallo en vez de dejar una copia
      // vacía lista para pisar el catálogo bueno al guardar.
      const cat = await loadGiftsCatalog();
      if (!cat || !Array.isArray(cat.gifts) || !cat.gifts.length) {
        throw new Error('No se pudo cargar el catálogo de regalos. No se guardará nada para no perder el contenido existente.');
      }
      return {
        title: 'Regalos',
        catalog: cat,
        items: cat?.gifts || [],
        // Guarda el catálogo completo (version + months + gifts) y refresca
        // la caché compartida con el Calendario y la Galería.
        // Guarda de seguridad: si el catálogo que llega está claramente
        // incompleto respecto a lo que había, se aborta en vez de sobrescribir.
        save: async (next) => {
          const incoming = Array.isArray(next?.gifts) ? next.gifts.length : 0;
          const current = Array.isArray(cat?.gifts) ? cat.gifts.length : 0;
          if (current > 0 && incoming === 0) {
            throw new Error('Guardado cancelado: el catálogo ha llegado vacío y habría borrado todo el calendario.');
          }
          await db.saveGifts(next);
          // Tras guardar, esta copia deja de ser la referencia: se sincroniza
          // con lo guardado para que el siguiente guardado compare bien.
          cat.gifts = next.gifts;
          cat.months = next.months;
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
      searchInput?.addEventListener('input', () => {
        const raw = searchInput.value.trim();
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

    // Regenerar desde el esqueleto base: reconstruye el calendario desde
    // gifts.json (se mantiene julio, agosto empieza el 15 y los juegos van en
    // días consecutivos). Los contenidos personalizados de agosto en adelante
    // se pierden; por eso pide confirmación.
    page.querySelector('#calAdminRebuild').onclick = () => {
      modal.open(
        '♻️ Regenerar calendario',
        '<p style="margin:0;">Se reconstruirá el calendario desde el esqueleto base:<br>· Agosto empieza el <strong>15</strong><br>· Los <strong>juegos</strong> (solo los que no se desbloquearon en julio) van en días consecutivos (15 ago → 23 ago), <strong>solo el juego</strong> esos días<br>· Cuando se acaban los juegos, sigue el resto de contenidos<br><br>Se conserva <strong>julio</strong> tal cual. Los contenidos personalizados de agosto en adelante se eliminarán. ¿Continuar?</p>',
        async () => {
          const res = await fetch('/data/gifts.json', { cache: 'no-cache' });
          if (!res.ok) throw new Error('No se pudo leer el esqueleto base');
          const next = expandCalendarCatalog(await res.json());
          await data.save(next);
          renderCalendarAdmin(page.querySelector('#contentSubContent'), { catalog: next, save: data.save });
          showToast('Calendario regenerado ✓', 'success');
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

        const next = JSON.parse(JSON.stringify(catalog));
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
        if (!title) throw new Error('El título es obligatorio');
        if (!message) throw new Error('El mensaje es obligatorio');
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
          ...(media ? { media } : {})
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
          fieldsBox.innerHTML = '';
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
              ${cover ? `<img src="${esc(cover)}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${esc((item.titulo||item.title||'?')[0])}'">` : `<span>${esc((item.titulo||item.title||'?')[0])}</span>`}
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

    page.querySelector('#fixPortadas')?.addEventListener('click', () => repairPortadas(items, saveFn, reloadFn));
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
      reloadFn('series');
    } catch (err) {
      showToast(err?.message || 'No se pudo guardar el catálogo', 'error');
    }
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

  function bindContentCRUD(type, items, saveFn, reloadFn) {
    const btn = page.querySelector('#addContentItem');
    if (btn) {
      btn.addEventListener('click', () => {
        openContentEditor(type, null, -1, items, saveFn, reloadFn);
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
            <button class="admin-btn admin-btn-primary" id="testPushBtn"${supported && perm.ok && swReady ? '' : ' disabled title="El canal de este dispositivo no puede mostrar notificaciones todavía"'}>${UI.send} Enviar ahora</button>
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
    if (!enabled) reasons.push('notificaciones apagadas');
    if (permission !== 'granted') reasons.push(`permiso: ${permission}`);
    if (!('serviceWorker' in navigator)) reasons.push('sin service worker');
    else if (!swReady) reasons.push('service worker sin activar');
    if (stateEl) stateEl.textContent = reasons.length ? `Estado: ${reasons.join(' · ')}` : 'Estado: canal listo';

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
        await loadNotificaciones();
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

    let allEntries = [];
    let truncated = false;

    function renderActivity() {
      const filter = page.querySelector('#activityFilter')?.value || 'all';
      const filtered = filter === 'all' ? allEntries : allEntries.filter(e => e.action === filter);
      const list = page.querySelector('#activityList');
      const count = page.querySelector('#activityCount');
      if (count) count.textContent = `${filtered.length} de ${allEntries.length}`;
      const note = page.querySelector('#activityLimitNote');
      if (note) {
        note.hidden = !truncated;
        if (truncated) {
          note.textContent = `Mostrando los ${allEntries.length} registros más recientes. Los anteriores no se cargan para no bloquear el navegador.`;
        }
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
      return d.toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    const load = async () => {
      try {
        const entries = await db.getActivity(ACTIVITY_LIMIT);
        truncated = entries.length >= ACTIVITY_LIMIT;
        allEntries = entries;
        return true;
      } catch (err) {
        showToast(err?.message || 'No se pudo cargar la actividad', 'error');
        return false;
      }
    };

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

    if (!await load()) return;
    if (token !== sectionToken) return; // se cambió de sección mientras cargaba

    fillFilter();
    page.querySelector('#activityFilter')?.addEventListener('change', renderActivity);

    page.querySelector('#refreshActivity')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      if (await load()) {
        fillFilter(); // el filtro se reconstruye: pueden entrar acciones nuevas
        renderActivity();
        showToast('Actividad actualizada', 'success');
      }
      btn.disabled = false;
    });

    renderActivity();
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
    const hubDates = await db.getHubDates();
    // La caché global la leen el botón «ver la bienvenida de hoy» y la hoja
    // temática; sin esto seguirían con los valores de fábrica.
    await loadSpecialDates().catch(() => {});

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

        <div class="admin-panel config-card config-dates">
          <div class="admin-panel-head">
            <h4>${UI.copy} Fechas especiales</h4>
            <span class="admin-panel-badge">Alimentan las métricas del resumen</span>
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
              <p class="muted-text">Eventos con fecha: salen en la bienvenida del Inicio el día que cae, una sola vez. Usa «Hoy» para poner la fecha de hoy y 🎬 para ver la bienvenida sin esperar.</p>
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

    // Los mismos campos para los cuatro días, los eventos y los temáticos: la
    // tarjeta se rellena igual en los tres sitios.
    const mediaFieldsHTML = (look = {}) => `
      <label class="dates-look-field">
        <span>Ambiente al abrir</span>
        <select class="dates-look-decor" aria-label="Decoración de la bienvenida">${decorOptions(look.decor)}</select>
      </label>
      <label class="dates-look-field dates-look-field--wide">
        <span>Emojis que caen</span>
        <input type="text" class="dates-look-emojis" value="${esc(look.emojis || '')}" placeholder="${esc(THEME_EMOJIS[look.type] || THEME_EMOJIS.custom)}" aria-label="Emojis que caen al abrir">
        <small class="dates-look-note">Si lo dejas vacío caen los de la fiesta, los que se ven de ejemplo.</small>
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
        <span>Más fotos (una URL por línea)</span>
        <textarea class="dates-look-gallery" rows="2" placeholder="https://…&#10;https://…" aria-label="Fotos de la tirita">${esc((look.gallery || []).join('\n'))}</textarea>
      </label>`;
    let editingDates = (hubDates.events || []).map(e => ({ ...e }));
    const typeOptions = (value) => EVENT_TYPE_OPTIONS
      .map(t => `<option value="${t.id}"${t.id === value ? ' selected' : ''}>${t.label}</option>`)
      .join('');

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
      if (!m) return '';
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${Number(mmdd.slice(3, 5))} de ${meses[Number(mmdd.slice(0, 2)) - 1]}`;
    };
    /** Lo que pinta la hoja, ledío de una fila del editor. */
    const draftFromRow = (row, seasonal = false) => ({
      title: row.querySelector(seasonal ? '.dates-se-title' : '.dates-event-title')?.value.trim() || '',
      icon: row.querySelector('.dates-look-icon')?.value.trim() || '✨',
      type: row.querySelector('.dates-look-type')?.value || 'custom',
      description: row.querySelector('.dates-look-desc')?.value.trim() || '',
      image: row.querySelector('.dates-look-image')?.value.trim() || '',
      video: row.querySelector('.dates-look-video')?.value.trim() || '',
      videoMode: row.querySelector('.dates-look-videomode')?.value || 'portada',
      gallery: (row.querySelector('.dates-look-gallery')?.value || '')
        .split('\n').map(url => url.trim()).filter(Boolean).slice(0, MAX_GALLERY),
      decor: row.querySelector('.dates-look-decor')?.value || 'confeti',
      emojis: row.querySelector('.dates-look-emojis')?.value.trim() || ''
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
    /** Estado de un evento con fecha completa: hoy, cuándo, o por qué no sale. */
    const whenForEvent = (row) => {
      const title = row.querySelector('.dates-event-title')?.value.trim() || '';
      const date = row.querySelector('.dates-event-date')?.value || '';
      const repeats = row.querySelector('.dates-event-recur-cb')?.checked === true;
      if (!title) return ['warn', 'Falta el nombre: sin él no se guarda.'];
      if (!date) return ['muted', 'Ponle una fecha para saber cuándo sale.'];
      const today = todayISO();
      if (date === today) return ['ok', '✓ Sale hoy en el Inicio.'];
      if (date > today) return ['info', `Sale el ${readableDate(date)}.`];
      return repeats
        ? ['warn', `La fecha ya pasó (${readableDate(date)}), pero con ♻️ repetirá el ${readableMonthDay(date.slice(5))}.`]
        : ['warn', `⚠️ La fecha ya pasó (${readableDate(date)}): no volverá a salir.`];
    };
    /** Lo mismo para un día temático, que se fecha con mes-día. */
    const whenForSeasonal = (row) => {
      const title = row.querySelector('.dates-se-title')?.value.trim() || '';
      const monthDay = row.querySelector('.dates-se-monthday')?.value.trim() || '';
      const enabled = row.querySelector('.dates-se-enabled')?.checked === true;
      if (!enabled) return ['muted', 'Apagado: ese día no saltará.'];
      if (!title) return ['warn', 'Falta el nombre: sin él no se guarda.'];
      const cada = readableMonthDay(monthDay);
      if (!cada) return ['muted', 'Pon el mes y el día (p. ej. 10-31).'];
      const hoyMD = todayISO().slice(5);
      if (monthDay === hoyMD) return ['ok', '✓ Sale hoy en el Inicio.'];
      return monthDay > hoyMD
        ? ['info', `Sale el ${cada}.`]
        : ['warn', `Este año ya pasó: el año que viene, el ${cada}.`];
    };
    /** Pinta la línea de estado de todas las filas de las dos listas. */
    const refreshWhens = () => {
      const paint = (selector, calc) => page.querySelectorAll(selector).forEach(row => {
        const out = row.querySelector('.dates-when');
        if (!out) return;
        const [tone, text] = calc(row);
        out.className = `dates-when dates-when--${tone}`;
        out.textContent = text;
      });
      paint('#datesEventsList .dates-event-row', whenForEvent);
      paint('#datesSeasonalList .dates-event-row', whenForSeasonal);
    };
    // Se repinta solo mientras se escribe: el estado se lee sin guardar.
    page.querySelectorAll('#datesEventsList, #datesSeasonalList').forEach(list => {
      list.addEventListener('input', refreshWhens);
      list.addEventListener('change', refreshWhens);
    });

    // Cada evento lleva lo mínimo (título + fecha) y, al desplegarlo, todo lo
    // que pinta la bienvenida: texto, emoji, color y foto. Con foto vacía se
    // guarda sin foto y la hoja sale sin ella.
    const dateEventRow = (e) => {
      const uid = e.id || 'ev' + Math.random().toString(36).slice(2, 8);
      const hasDetail = !!(e.description || e.icon || e.image || e.type);
      return `
        <div class="dates-event-row${hasDetail ? ' is-open' : ''}" data-ev-id="${uid}">
          <div class="dates-event-main">
            <input type="text" class="dates-event-title" placeholder="Qué es (p. ej. Viaje a la playa)" value="${esc(e.title || '')}" maxlength="60" aria-label="Nombre del evento">
            <input type="date" class="dates-event-date" value="${esc(e.date || '')}" aria-label="Fecha del evento">
            <label class="dates-event-recur" title="Se repite cada año"><input type="checkbox" class="dates-event-recur-cb" ${e.recurring === true ? 'checked' : ''}><span>♻️</span></label>
            <button type="button" class="dates-event-today" title="Poner la fecha de hoy">Hoy</button>
            <button type="button" class="dates-event-toggle" aria-label="Editar el aspecto de la bienvenida" title="Aspecto en la bienvenida">🎨</button>
            <button type="button" class="dates-event-preview" title="Ver la bienvenida" aria-label="Ver la bienvenida">🎬</button>
            <button type="button" class="dates-event-del" aria-label="Quitar evento">✕</button>
          </div>
          <p class="dates-when"></p>
          <div class="dates-event-look"${hasDetail ? '' : ' hidden'}>
            <label class="dates-look-field">
              <span>Emoji</span>
              <input type="text" class="dates-look-icon" value="${esc(e.icon || '✨')}" maxlength="4" aria-label="Emoji del evento">
            </label>
            <label class="dates-look-field">
              <span>Color</span>
              <select class="dates-look-type" aria-label="Color del evento">${typeOptions(e.type || 'custom')}</select>
            </label>
            <label class="dates-look-field dates-look-field--wide">
              <span>Texto de la bienvenida</span>
              <textarea class="dates-look-desc" rows="2" maxlength="180" placeholder="Lo que se lea ese día" aria-label="Texto de la bienvenida">${esc(e.description || '')}</textarea>
            </label>
            <label class="dates-look-field dates-look-field--wide">
              <span>Foto (URL)</span>
              <input type="url" class="dates-look-image" value="${esc(e.image || '')}" placeholder="https://…" aria-label="Foto del evento">
            </label>
            ${mediaFieldsHTML(e)}
            <p class="dates-look-preview" data-preview-for="${uid}"></p>
          </div>
        </div>`;
    };

    // Vista previa en vivo de la hoja: sin salir del panel se ve cómo queda.
    const renderLookPreview = (row, title) => {
      const out = row.querySelector('[data-preview-for]');
      if (!out) return;
      const val = sel => row.querySelector(sel)?.value.trim() || '';
      const icon = val('.dates-look-icon') || '✨';
      const type = val('.dates-look-type') || 'custom';
      const desc = val('.dates-look-desc');
      const image = val('.dates-look-image');
      const [accent, soft] = SPECIAL_EVENT_TONES[type] || SPECIAL_EVENT_TONES.custom;
      out.innerHTML = `
        <span class="dates-look-chip" style="--event-accent:${accent};--event-soft:${soft}">
          ${image ? `<img class="dates-look-chip-photo" src="${esc(image)}" alt="" loading="lazy">` : ''}
          <span class="dates-look-chip-icon">${esc(icon)}</span>
        </span>
        <span class="dates-look-chip-text">
          <b>${esc(title || 'Día especial')}</b>
          ${desc ? `<small>${esc(desc)}</small>` : '<small class="muted-text">Sin texto: se usará el de fábrica.</small>'}
        </span>`;
    };

    const renderDateEvents = () => {
      const list = page.querySelector('#datesEventsList');
      if (!list) return;
      list.innerHTML = editingDates.map(dateEventRow).join('');
      list.querySelectorAll('.dates-event-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.dates-event-row');
          const idx = editingDates.findIndex(e => (e.id || '') === row.dataset.evId);
          if (idx >= 0) { editingDates.splice(idx, 1); renderDateEvents(); }
        });
      });
      list.querySelectorAll('.dates-event-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.dates-event-row');
          const look = row.querySelector('.dates-event-look');
          if (!look) return;
          const open = look.hidden;
          look.hidden = !open;
          row.classList.toggle('is-open', open);
          if (open) renderLookPreview(row, row.querySelector('.dates-event-title')?.value);
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
      list.querySelectorAll('.dates-event-preview').forEach(btn => {
        btn.addEventListener('click', () => openDraftSheet(btn.closest('.dates-event-row')));
      });
      // La vista previa se refresca mientras se escribe, sin guardar.
      list.querySelectorAll('.dates-event-row').forEach(row => {
        const look = row.querySelector('.dates-event-look');
        if (look && !look.hidden) renderLookPreview(row, row.querySelector('.dates-event-title')?.value);
      });
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
      // El nuevo sale ya desplegado: es la parte que hay que rellenar.
      const rows = page.querySelectorAll('.dates-event-row');
      rows[rows.length - 1]?.querySelector('.dates-event-toggle')?.click();
    });

    // ---- Aspecto de los cuatro días principales ----
    // Se edita directo sobre los inputs (no un array paralelo): lo que se ve
    // en el panel es lo que se guarda.
    const renderDateLooks = () => {
      const list = page.querySelector('#datesLooksList');
      if (!list) return;
      list.innerHTML = FIXED_EVENT_FIELDS.map(field => {
        const look = hubDates.looks?.[field.id] || {};
        return `
        <div class="dates-look-row" data-look-id="${field.id}">
          <span class="dates-emoji-label">${field.icon}</span>
          <label class="dates-look-field">
            <span>Emoji</span>
            <input type="text" class="dates-look-icon" value="${esc(look.icon || field.icon)}" maxlength="4" aria-label="Emoji de ${esc(field.label)}">
          </label>
          <label class="dates-look-field">
            <span>Color</span>
            <select class="dates-look-type" aria-label="Color de ${esc(field.label)}">${typeOptions(look.type || field.type)}</select>
          </label>
          <label class="dates-look-field dates-look-field--wide">
            <span>Texto de la bienvenida</span>
            <textarea class="dates-look-desc" rows="2" maxlength="180" placeholder="${esc(field.description)}" aria-label="Texto de ${esc(field.label)}">${esc(look.description || '')}</textarea>
          </label>
          <label class="dates-look-field dates-look-field--wide">
            <span>Foto (URL)</span>
            <input type="url" class="dates-look-image" value="${esc(look.image || '')}" placeholder="${esc(field.description ? 'Sin foto por defecto' : 'https://…')}" aria-label="Foto de ${esc(field.label)}">
          </label>
          ${mediaFieldsHTML(look)}
          <p class="dates-look-preview" data-preview-for="${field.id}"></p>
        </div>`;
      }).join('');
      list.querySelectorAll('.dates-look-row').forEach(row => {
        renderLookPreview(row, page.querySelector(`#date${fieldIdToInput(row.dataset.lookId)}Title`)?.value);
      });
      // Se repinta al escribir, para ver el resultado mientras se edita.
      list.querySelectorAll('.dates-look-row').forEach(row => {
        row.addEventListener('input', () => {
          renderLookPreview(row, page.querySelector(`#date${fieldIdToInput(row.dataset.lookId)}Title`)?.value);
        });
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
        <div class="dates-event-row is-open" data-se-id="${uid}">
          <div class="dates-event-main">
            <input type="text" class="dates-se-title" placeholder="Nombre (p. ej. Halloween)" value="${esc(s.title || '')}" maxlength="40" aria-label="Nombre del día temático">
            <input type="text" class="dates-se-monthday" placeholder="MM-DD" value="${esc(s.monthDay || '')}" maxlength="5" pattern="[0-9]{2}-[0-9]{2}" aria-label="Mes y día, tipo 10-31">
            <label class="dates-event-recur" title="Este día está activo"><input type="checkbox" class="dates-se-enabled" ${s.enabled !== false ? 'checked' : ''}><span>Activo</span></label>
            <button type="button" class="dates-se-today" title="Poner el mes y el día de hoy">Hoy</button>
            <button type="button" class="dates-se-preview" title="Ver la bienvenida" aria-label="Ver la bienvenida">🎬</button>
            <button type="button" class="dates-event-del" aria-label="Quitar día temático">✕</button>
          </div>
          <p class="dates-when"></p>
          <div class="dates-event-look">
            <label class="dates-look-field">
              <span>Emoji</span>
              <input type="text" class="dates-look-icon" value="${esc(s.icon || '✨')}" maxlength="4" aria-label="Emoji del día temático">
            </label>
            <label class="dates-look-field">
              <span>Color</span>
              <select class="dates-look-type" aria-label="Color del día temático">${typeOptions(s.type || 'custom')}</select>
            </label>
            <label class="dates-look-field dates-look-field--wide">
              <span>Texto de la bienvenida</span>
              <textarea class="dates-look-desc" rows="2" maxlength="180" placeholder="Lo que se lea ese día" aria-label="Texto de la bienvenida">${esc(s.description || '')}</textarea>
            </label>
            <label class="dates-look-field dates-look-field--wide">
              <span>Foto (URL)</span>
              <input type="url" class="dates-look-image" value="${esc(s.image || '')}" placeholder="https://…" aria-label="Foto del día temático">
            </label>
            ${mediaFieldsHTML(s)}
            <p class="dates-look-preview" data-preview-for="${uid}"></p>
          </div>
        </div>`;
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
      list.querySelectorAll('.dates-event-row').forEach(row => {
        renderLookPreview(row, row.querySelector('.dates-se-title')?.value);
        row.addEventListener('input', () => renderLookPreview(row, row.querySelector('.dates-se-title')?.value));
      });
      refreshWhens();
    };
    renderSeasonal();
    page.querySelector('#addDatesSeasonalBtn')?.addEventListener('click', () => {
      editingSeasonal.push({ id: 'se' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', monthDay: '', icon: '✨', type: 'custom', description: '', image: '', enabled: true });
      renderSeasonal();
    });

    page.querySelector('#saveDatesBtn')?.addEventListener('click', async () => {
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
          && !/^\d{2}-\d{2}$/.test(row.querySelector('.dates-se-monthday').value.trim()));
      if (badSeasonal) {
        blockSave('Falta el mes y el día, tipo 10-31', badSeasonal);
        return;
      }
      const { anniversary, hubStart, birthday, userBirthday, events, seasonal, looks, titles, recurring } = collectDates();
      if (!anniversary || !hubStart || !birthday || !userBirthday) {
        showToast('Rellena las cuatro fechas', 'error');
        return;
      }
      try {
        const saved = await db.saveHubDates({ anniversary, hubStart, birthday, userBirthday, events, seasonal, looks, titles, recurring });
        // Refresca la caché de fechas: el inicio, la bienvenida y el Perfil
        // reflejan el cambio al instante.
        refreshSpecialDates().catch(() => {});
        markSaved();
        showToast('Fechas especiales guardadas', 'success');
        const hint = page.querySelector('#datesSavedHint');
        if (hint) hint.textContent = `Aniversario ${saved.anniversary} · Hub ${saved.hubStart} · Cumple ${saved.birthday} · Tú ${saved.userBirthday}${saved.events?.length ? ` · ${saved.events.length} próximas` : ''}`;
      } catch (err) {
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
    if (status.ok) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'block';
      banner.innerHTML = status.mode === 'supabase'
        ? `<strong>⚠️ Base de datos no disponible</strong> — ${status.message}<br>
           <small>Los cambios se guardarán solo en este navegador hasta que se arregle el permiso en Supabase.</small>`
        : `<strong>️ Modo local</strong> — ${status.message}`;
    }
  }

  // ==========================================
  // INIT
  // ==========================================
  renderDbStatus();
  loadSection('dashboard');

  return page;
}
