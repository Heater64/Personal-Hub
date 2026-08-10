/* ==========================================
   Personal Hub v3 — Calendario Page
   Calendario de sorpresas y experiencias
   Estilo Umbra — reescrito
   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey } from '../utils/userStorage.js';
import { todayISO, dayOfMonthInSpain } from '../utils/format.js';
import { buildVideoPlayer } from '../components/MediaLightbox.js';
import { loadGiftsCatalog } from '../services/gifts.service.js';
import { onContentChange } from '../services/realtime.service.js';
import { db } from '../services/db.service.js';
import { gameCover } from '../utils/gameCovers.js';

const PROGRESS_KEY = () => userPrefKey('giftProgress');

const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS_ES = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const MONTHS_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const TYPE_META = {
  letter:    { label: 'Carta',    emoji: '✉️' },
  cassette:  { label: 'Música',   emoji: '🎵' },
  giftBox:   { label: 'Regalo',   emoji: '🎁' },
  polaroid:  { label: 'Foto',     emoji: '📸' },
  clickStar: { label: 'Estrella', emoji: '⭐' },
  game:      { label: 'Juego',    emoji: '🎮' },
  surprise:  { label: 'Sorpresa', emoji: '🎉' },
  video:     { label: 'Vídeo',    emoji: '🎬' },
  quiz:      { label: 'Quiz',     emoji: '🧠' },
  wishlist:  { label: 'Lista',    emoji: '📝' },
  challenge: { label: 'Reto',     emoji: '🎯' },
  coupon:    { label: 'Vale',     emoji: '🎟️' },
  memory:    { label: 'Recuerdo', emoji: '🫶' },
  plan:      { label: 'Plan',     emoji: '🗓️' },
  affirmation:{ label: 'Mensaje', emoji: '💌' },
  riddle:     { label: 'Acertijo',   emoji: '🧩' },
  curiosity:  { label: 'Curiosidad', emoji: '💡' },
  relax:      { label: 'Desconexión', emoji: '🧘' },
  craft:      { label: 'Manualidad', emoji: '🎨' },
  offline:    { label: 'Reto real',  emoji: '🔗' },
  math:       { label: 'Mates',      emoji: '➗' },
};

// Portadas de los juegos del calendario (mismos colores que la sala de juegos)
const GAME_COVERS = {
  'agujero-negro': { color: '#b45309', accent: '#ffb347' },
  'tetris':        { color: '#7c9cff', accent: '#a5baff' },
  '2048':          { color: '#ffcf4d', accent: '#ffe59a' },
  'conecta4':      { color: '#ff8a5e', accent: '#ffb08f' },
  'tresenraya':    { color: '#9ad1ff', accent: '#bce3ff' },
  'flappy':        { color: '#7ee0a3', accent: '#a5f0bf' },
  'invaders':      { color: '#5ed6d0', accent: '#8ae8e3' },
  'pong':          { color: '#ff9f6e', accent: '#ffc08f' },
  'asteroides':    { color: '#b39bff', accent: '#cdbfff' },
  'simon':         { color: '#ffcf6e', accent: '#ffdf9e' },
  'nonogramas':    { color: '#ffb347', accent: '#ffcf8a' },
  'dino':          { color: '#8be06e', accent: '#a8f08a' },
  'doodle':        { color: '#f5a05e', accent: '#ffc58a' },
  'match3':        { color: '#f87171', accent: '#ff9d9d' },
  'battleship':    { color: '#5aa0ff', accent: '#8ac0ff' }
};

const typeIconMap = {
  letter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  cassette: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  giftBox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  polaroid: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  clickStar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  game: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>',
  surprise: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  video: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  quiz: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  wishlist: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  challenge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
  coupon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V5Z"/><path d="M12 7v10"/></svg>',
  memory: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 8.6c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.8 2.6Z"/></svg>',
  plan: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h3M8 17h6"/></svg>',
  affirmation: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11.5a8 8 0 0 1-8 8 8.7 8.7 0 0 1-3.4-.7L4 20l1.2-3.6A8 8 0 1 1 20 11.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>',
  riddle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2h4a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2h-2v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1H6a2 2 0 0 1-2-2v-2H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1V9a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  curiosity: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>',
  relax: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c2.5 3 2.5 6 0 9-2.5-3-2.5-6 0-9Z"/><path d="M12 12c2.5-1 4.5 0 4.5 3s-2 4-4.5 4-4.5-1-4.5-4 2-4 4.5-3Z"/><path d="M12 19c2 2 4.5 2 6.5 1 0 1.5-2.5 2.5-4 1.5M12 19c-2 2-4.5 2-6.5 1 0 1.5 2.5 2.5 4 1.5"/></svg>',
  craft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>',
  offline: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  math: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>'
};

const ICON_CAL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_CHEV = (dir) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="${dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}"/></svg>`;

let catalog = null;
let currentMonthKey = null;
let progressMap = {};
let lastFocusedEl = null;
let onKey = null;
let calVideoRefs = []; // vídeos del sheet activo (para pausarlos con suavidad)

function pad(n) { return String(n).padStart(2, '0'); }

/** Normaliza la asignación de un día: string → [string], array → array limpia. */
function normalizeIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

// Fecha local (evita el desfase de UTC de toISOString)
// El día del calendario cambia a las 00:00 de España (península)
function getTodayStr() {
  return todayISO();
}
function todayMonthKey() { return getTodayStr().slice(0, 7); }

function loadProgress() {
  try { progressMap = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}'); } catch { progressMap = {}; }
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY(), JSON.stringify(progressMap)); } catch { /* noop */ }
}

async function loadGifts() {
  try {
    // Fuente unificada con el Admin y la Galería (Supabase → gifts.json semilla)
    const data = await loadGiftsCatalog();
    if (!data) {
      showToast('Error cargando el calendario', 'error');
      return null;
    }
    catalog = data;
    catalog.giftsById = {};
    (catalog.gifts || []).forEach(g => { if (g.id) catalog.giftsById[g.id] = g; });
    return catalog;
  } catch {
    showToast('Error cargando el calendario', 'error');
    return null;
  }
}

function getDayState(dateStr, ids) {
  if (!ids?.length) return 'empty';
  if (ids.every(id => progressMap[id]?.opened)) return 'opened';
  // Todos los contenidos están disponibles: no hay bloqueo por fecha.
  return dateStr === getTodayStr() ? 'today' : 'catchup';
}

function resolveInitialMonth() {
  const months = Object.keys(catalog?.months || {}).sort();
  if (!months.length) return null;
  const t = todayMonthKey();
  if (months.includes(t)) return t;
  const past = months.filter(m => m <= t);
  return past.length ? past[past.length - 1] : months[0];
}

function monthLabel(key) {
  if (catalog?.months?.[key]?.label) return catalog.months[key].label;
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_SHORT[m] || m} ${y}`;
}

export function CalendarioPage(router) {
  const page = document.createElement('div');
  page.className = 'calendario-page';
  // Modo temporal de revisión: permite abrir todos los regalos sin cambiar
  // sus fechas reales ni la distribución futura del calendario.
  const previewAllGifts = router?.currentRoute?.query?.previewGifts === '1';

  // ===== ESTADO DE CARGA (skeleton) =====
  page.innerHTML = `
    <div class="cal-skeleton">
      <div class="cal-section-header">
        <span class="cal-section-chip">${ICON_CAL}</span>
        <h1 class="cal-section-title">Calendario de sorpresas</h1>
        <span class="cal-section-line"></span>
      </div>
      <div class="cal-skeleton__hero"></div>
      <div class="cal-skeleton__grid">
        ${Array.from({ length: 35 }, () => '<span class="cal-skeleton__cell"></span>').join('')}
      </div>
    </div>
  `;

  loadProgress();
  loadGifts().then(() => {
    if (!catalog) {
      page.innerHTML = `<div class="cal-end"><p class="cal-end__title">No se pudo cargar el calendario</p><p class="cal-end__sub">Inténtalo de nuevo más tarde ❤️</p></div>`;
      return;
    }
    renderCalendar();
    handleDeepLink();
  });

  // Tiempo real: si el Admin edita el catálogo de regalos (portadas,
  // contenido, fechas…), los usuarios lo ven al instante sin recargar.
  const offContent = onContentChange(['gifts'], () => {
    const sheet = page.querySelector('#calSheet');
    if (sheet && sheet.classList.contains('is-open')) closeSheet();
    loadGifts().then(() => {
      if (!catalog) return;
      renderCalendar();
    });
  });

  /**
   * Deep-link desde el Inicio: /calendario?day=YYYY-MM-DD
   * Cambia al mes correspondiente y abre directamente el regalo de ese día.
   */
  function handleDeepLink() {
    const day = router?.currentRoute?.query?.day || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const monthKey = day.slice(0, 7);
    const dayNum = String(parseInt(day.slice(8), 10));

    if (!catalog?.months?.[monthKey]) {
      showToast('Ese día no está en el calendario', 'info');
      return;
    }
    if (currentMonthKey !== monthKey) {
      currentMonthKey = monthKey;
      renderCalendar();
    }
    const ids = normalizeIds(catalog.months[monthKey]?.calendarMapping?.[dayNum]).filter(id => catalog.giftsById?.[id]);
    if (!ids.length) {
      showToast('Ese día no tiene sorpresa ❤️', 'info');
      return;
    }
    const state = getDayState(day, ids);
    if (state === 'today' || state === 'catchup' || state === 'opened') {
      openDay(day, ids);
    } else {
      showToast('Ese día aún no está disponible', 'info');
    }
  }

  // ===== RENDER PRINCIPAL =====
  function renderCalendar() {
    // (accesibilidad) título de página para lectores de pantalla — el mes se lee en el nav
    if (!catalog) return;
    if (!currentMonthKey) currentMonthKey = resolveInitialMonth();
    if (!currentMonthKey) {
      page.innerHTML = `<div class="cal-end"><p class="cal-end__title">El calendario aún se está preparando</p><p class="cal-end__sub">Vuelve pronto ❤️</p></div>`;
      return;
    }

    const [y, m] = currentMonthKey.split('-').map(Number);
    const monthData = catalog?.months?.[currentMonthKey];
    const mapping = (monthData && monthData.calendarMapping) || {};
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0 = Domingo
    const hasAnyGift = Object.values(mapping).some(Boolean);

    let cells = '';
    let idx = 0;
    for (let i = 0; i < firstWeekday; i++) {
      cells += '<span class="cal-day is-offset" aria-hidden="true"></span>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonthKey}-${pad(day)}`;
      cells += renderDayCell(day, dateStr, mapping[String(day)], idx++);
    }

    page.innerHTML = `
      <div class="calendario-content">
        <div class="cal-section-header">
          <span class="cal-section-chip">${ICON_CAL}</span>
          <h1 class="cal-section-title">Calendario de sorpresas</h1>
          <span class="cal-section-line"></span>
        </div>
        ${previewAllGifts ? '<div class="cal-preview-banner" role="status">🧪 Modo revisión: todos los regalos están disponibles hoy. Las fechas reales no se han cambiado.</div>' : ''}

        ${renderTodayHero()}
        ${renderProgress()}

        <div class="cal-month-block">
          ${renderMonthNav()}
          ${hasAnyGift ? `
            <div class="cal-weekdays">${WEEKDAYS.map(w => `<span class="cal-weekday">${w}</span>`).join('')}</div>
            <div class="cal-grid">${cells}</div>
          ` : renderEmptyMonth()}
        </div>
      </div>

      <div class="cal-sheet" id="calSheet" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Sorpresa del día">
        <div class="cal-sheet__panel">
          <span class="cal-sheet__handle" aria-hidden="true"></span>
          <button class="cal-sheet__close" id="calSheetClose" aria-label="Cerrar">${ICON_X}</button>
          <span class="cal-sheet__chip" id="calSheetChip"></span>
          <h3 class="cal-sheet__title" id="calSheetTitle"></h3>
          <div class="cal-sheet__body" id="calSheetBody"></div>
          <div class="cal-sheet__footer">
            <button class="btn-primary" id="calSheetDone">Hecho ❤</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    requestAnimationFrame(() => {
      page.querySelectorAll('.cal-day.animate-in').forEach(el => el.classList.add('visible'));
    });
  }

  // ===== CELDA DE DÍA =====
  function renderDayCell(day, dateStr, dayIds, index) {
    const ids = normalizeIds(dayIds).filter(id => catalog?.giftsById?.[id]);
    const state = getDayState(dateStr, ids);
    const first = ids.length ? catalog?.giftsById?.[ids[0]] : null;
    const isSpecial = !!(first && first.special);
    const count = ids.length;

    if (state === 'empty') {
      return `<span class="cal-day is-empty" style="--enter-delay:${index * 10}ms" aria-hidden="true"><span class="cal-day__num">${day}</span></span>`;
    }

    const cls = state === 'today' ? 'is-today' : state === 'catchup' ? 'is-catchup' : state === 'opened' ? 'is-opened' : 'is-locked';
    const label = `${day} de ${MONTHS_ES[Number(dateStr.slice(5, 7))]}${isSpecial ? ' · día especial' : ''}${count > 1 ? ` · ${count} contenidos` : ''} — ${state === 'opened' ? 'ya descubierto' : state === 'today' ? 'disponible hoy' : state === 'catchup' ? 'disponible' : 'próximamente'}`;
    const icon = state !== 'locked' && first?.type && typeIconMap[first.type]
      ? `<span class="cal-day__icon" aria-hidden="true">${typeIconMap[first.type]}</span>` : '';
    const mark = isSpecial
      ? '<span class="cal-day__special" aria-hidden="true">★</span>'
      : state === 'opened'
        ? '<span class="cal-day__heart" aria-hidden="true">♥</span>'
        : state === 'today'
          ? '<span class="cal-day__dot" aria-hidden="true"></span>'
          : '';

    return `
      <button class="cal-day ${cls} animate-in" style="--enter-delay:${index * 14}ms"
              data-day="${day}" data-gift-ids="${escapeHtml(ids.join(' '))}" aria-label="${escapeHtml(label)}" aria-pressed="${state === 'opened'}">
        <span class="cal-day__num">${day}</span>
        ${icon}${mark}${count > 1 ? `<span class="cal-day__count" aria-hidden="true">+${count - 1}</span>` : ''}
      </button>`;
  }

  // ===== HERO HOY =====
  function renderTodayHero() {
    return `<section class="cal-today" id="calTodayWrap">${renderTodayHeroInner()}</section>`;
  }

  function renderTodayHeroInner() {
    const todayStr = getTodayStr();
    const [y, m, d] = todayStr.split('-').map(Number);
    const monthData = catalog?.months?.[todayStr.slice(0, 7)];
    const ids = normalizeIds(monthData?.calendarMapping?.[String(d)]).filter(id => catalog?.giftsById?.[id]);
    const gift = ids.length ? catalog?.giftsById?.[ids[0]] : null;
    const state = ids.length ? getDayState(todayStr, ids) : 'empty';

    const dateLabel = `HOY · ${d} DE ${MONTHS_ES[m]}`;
    let title;
    let sub;
    let ctaLabel = '';

    if (state === 'today') {
      const ctx = gift?.context;
      if (ctx === 'exam') {
        title = 'Hoy tienes examen ❤️';
        sub = 'No necesitas hacer nada aquí. Solo quería recordarte que puedes con todo. Estoy orgulloso de ti, pase lo que pase.';
        ctaLabel = 'Ver tu sorpresa';
      } else if (ctx === 'study') {
        title = 'Día de estudio';
        sub = 'Toca concentrarse, pero nunca está de más una pequeña pausa para ti.';
        ctaLabel = 'Abrir sorpresa';
      } else {
        const meta = TYPE_META[gift?.type];
        title = 'Tengo algo para ti';
        sub = ids.length > 1
          ? `Hoy tienes ${ids.length} sorpresas esperándote.`
          : meta ? `Te espera ${meta.emoji} ${meta.label.toLowerCase()}.` : 'Cada día esconde algo diferente.';
        ctaLabel = 'Abrir sorpresa';
      }
    } else if (state === 'opened') {
      title = 'Ya lo descubriste ❤️';
      sub = '¿Quieres revivir el momento de hoy?';
      ctaLabel = 'Volver a abrirlo';
    } else if (state === 'catchup' || state === 'locked') {
      title = state === 'catchup' ? 'Te quedó una sorpresa por abrir' : 'Muy pronto…';
      sub = state === 'catchup'
        ? 'Algún día de este mes sigue esperándote. Búscalo abajo y ábrelo cuando quieras.'
        : `Algo especial te espera el día ${d}. Vuelve entonces.`;
      ctaLabel = state === 'catchup' ? 'Ver tu sorpresa' : '';
    } else {
      title = 'Hoy no hay sorpresa preparada';
      sub = 'Pero mañana puede haber una. ❤️';
    }

    const hasCta = state === 'today' || state === 'opened' || state === 'catchup';
    return `
      <span class="cal-today__chip">${dateLabel}</span>
      <h2 class="cal-today__title">${title}</h2>
      <p class="cal-today__sub">${sub}</p>
      ${hasCta && ids.length ? `<button class="cal-today__cta btn-primary" id="calTodayCta" data-gift-ids="${escapeHtml(ids.join(' '))}">${ctaLabel} →</button>` : ''}
    `;
  }

  // ===== PROGRESO =====
  function renderProgress() {
    const gifts = catalog?.gifts || [];
    if (!gifts.length) return '';
    return `<div class="cal-progress">${renderProgressInner()}</div>`;
  }

  /** Días con contenido (uno por día, con sus ids). */
  function collectMappedDays() {
    const out = [];
    Object.keys(catalog?.months || {}).forEach(mk => {
      Object.entries(catalog.months[mk].calendarMapping || {}).forEach(([day, v]) => {
        const ids = normalizeIds(v).filter(id => catalog?.giftsById?.[id]);
        if (ids.length) out.push({ day: `${mk}-${pad(day)}`, ids });
      });
    });
    return out;
  }

  function renderProgressInner() {
    const days = collectMappedDays();
    const opened = days.filter(({ ids }) => ids.every(id => progressMap[id]?.opened)).length;
    const pct = days.length ? Math.round((opened / days.length) * 100) : 0;
    return `
      <div class="cal-progress__row">
        <span>Días descubiertos</span>
        <span>${opened} de ${days.length}</span>
      </div>
      <div class="cal-progress__bar" role="progressbar" aria-valuenow="${opened}" aria-valuemin="0" aria-valuemax="${days.length}" aria-label="Progreso del calendario">
        <span class="cal-progress__fill" style="width:${pct}%"></span>
      </div>`;
  }

  // ===== NAVEGACIÓN DE MESES =====
  function renderMonthNav() {
    const isTodayMonth = currentMonthKey === todayMonthKey();
    return `
      <div class="cal-monthnav">
        <button class="cal-monthnav__arrow" id="calPrev" aria-label="Mes anterior">${ICON_CHEV('left')}</button>
        <div class="cal-monthnav__label">${escapeHtml(monthLabel(currentMonthKey))}</div>
        <button class="cal-monthnav__arrow" id="calNext" aria-label="Mes siguiente">${ICON_CHEV('right')}</button>
        ${isTodayMonth ? '' : '<button class="cal-monthnav__today" id="calTodayBtn">Ir a hoy</button>'}
      </div>`;
  }

  function shiftMonth(delta) {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    currentMonthKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    renderCalendar();
  }

  // ===== ESTADO VACÍO DE MES =====
  function renderEmptyMonth() {
    return `
      <div class="cal-empty">
        <div class="cal-empty__icon" aria-hidden="true">✨</div>
        <p class="cal-empty__title">Este mes aún no tiene sorpresas</p>
        <p class="cal-empty__sub">Vuelve pronto o explora otro mes.</p>
      </div>`;
  }

  // ===== EVENTOS =====
  function bindEvents() {
    page.querySelector('#calPrev').onclick = () => shiftMonth(-1);
    page.querySelector('#calNext').onclick = () => shiftMonth(1);
    const todayBtn = page.querySelector('#calTodayBtn');
    if (todayBtn) todayBtn.onclick = () => { currentMonthKey = todayMonthKey(); renderCalendar(); };

    const todayCta = page.querySelector('#calTodayCta');
    if (todayCta) todayCta.onclick = () => openDay(getTodayStr(), normalizeIds(todayCta.dataset.giftIds?.split(' ')));

    page.querySelectorAll('.cal-day.is-today, .cal-day.is-catchup, .cal-day.is-opened').forEach(cell => {
      cell.addEventListener('click', () => openDay(`${currentMonthKey}-${pad(cell.dataset.day)}`, normalizeIds(cell.dataset.giftIds?.split(' '))));
    });
    page.querySelectorAll('.cal-day.is-locked').forEach(cell => {
      cell.addEventListener('click', () => {
        const ids = normalizeIds(cell.dataset.giftIds?.split(' '));
        showToast(ids.length ? 'Aún no disponible — vuelve ese día' : 'Este día no tiene sorpresa', 'info');
      });
    });

    // Sheet
    page.querySelector('#calSheetClose').onclick = closeSheet;
    page.querySelector('#calSheetDone').onclick = handleDoneBtn;
    const sheet = page.querySelector('#calSheet');
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

    // Estrella interactiva (tipo clickStar)
    const star = page.querySelector('#calStar');
    if (star) star.addEventListener('click', () => {
      star.classList.add('is-popped');
      setTimeout(() => star.classList.remove('is-popped'), 320);
    });
  }

  // ===== APERTURA DEL DÍA (uno o varios contenidos) =====
  function renderDayContents(gifts) {
    const esc = escapeHtml;
    return `<div class="cal-multi">${gifts.map((g, i) => {
      const meta = TYPE_META[g.type] || { label: 'Sorpresa', emoji: '✨' };
      return `
        <div class="cal-multi__item">
          ${i > 0 ? '<div class="cal-multi__sep" aria-hidden="true"></div>' : ''}
          <div class="cal-multi__head">
            <span class="cal-multi__chip">${meta.emoji} ${meta.label}</span>
            <h4 class="cal-multi__title">${esc(g.title || meta.label)}</h4>
          </div>
          <div class="cal-multi__body">${renderContent(g)}</div>
          ${g?.data?.question ? renderAskBlock(g) : ''}
        </div>`;
    }).join('')}</div>`;
  }

  function openDay(dateStr, ids) {
    const gifts = ids.map(id => catalog?.giftsById?.[id]).filter(Boolean);
    if (!gifts.length) return;

    // Evita doble apertura / fuga de listeners del teclado
    const openSheet = page.querySelector('#calSheet');
    if (openSheet && openSheet.classList.contains('is-open')) closeSheet();

    markOpened(dateStr, ids);

    const sheet = page.querySelector('#calSheet');
    const chip = page.querySelector('#calSheetChip');
    const title = page.querySelector('#calSheetTitle');
    const body = page.querySelector('#calSheetBody');
    const doneBtn = page.querySelector('#calSheetDone');

    const single = gifts.length === 1;
    const meta = TYPE_META[gifts[0].type] || { label: 'Sorpresa', emoji: '✨' };
    chip.textContent = single ? `${meta.emoji} ${meta.label}` : `🎁 ${gifts.length} sorpresas hoy`;
    chip.classList.toggle('is-special', gifts.some(g => g.special));
    title.textContent = single ? (gifts[0].title || 'Sorpresa') : (gifts[0].title || 'Sorpresas del día');
    body.innerHTML = `<div class="cal-reveal">${renderDayContents(gifts)}</div>`;

    // Monta los reproductores de vídeo (varios posibles) con la barra glass
    body.querySelectorAll('.cal-video[data-video-url]').forEach(videoSlot => {
      if (!videoSlot.dataset.videoUrl) return;
      const player = buildVideoPlayer({
        src: videoSlot.dataset.videoUrl,
        poster: videoSlot.dataset.poster || ''
      });
      videoSlot.prepend(player.wrap);
      calVideoRefs.push(player);
    });

    doneBtn.textContent = 'Hecho ❤';
    doneBtn.dataset.playUrl = '';

    // Quiz interactivo — tocar una opción responde con feedback inmediato
    bindQuiz(body);

    // Cajitas de respuesta de los regalos interactivos (si existen)
    body.querySelectorAll('.cal-ask[data-gift-id]').forEach(ask => bindAsk(ask));

    // Acertijos y mates: botón "mostrar respuesta"
    bindReveals(body);

    lastFocusedEl = document.activeElement;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-locked');
    requestAnimationFrame(() => {
      sheet.classList.add('is-visible');
      page.querySelector('#calSheetClose').focus();
    });

    onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
      if (e.key === 'Tab') {
        const focusables = Array.from(sheet.querySelectorAll('button'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
  }

  /** Botones "mostrar respuesta" de acertijos y problemas de mates. */
  function bindReveals(body) {
    body.querySelectorAll('[data-riddle-reveal]').forEach(btn => {
      const label = btn.dataset.label || 'Mostrar respuesta';
      btn.addEventListener('click', () => {
        const answer = btn.parentElement?.querySelector('[data-riddle-answer]');
        if (!answer) return;
        const show = answer.hidden;
        answer.hidden = !show;
        btn.textContent = show ? 'Ocultar respuesta' : label;
      });
    });
  }

  /** Cajita de respuesta de un regalo interactivo (pregunta del Admin) */
  function renderAskBlock(gift) {
    const question = gift?.data?.question || '';
    if (!question) return '';
    return `
      <div class="cal-ask" data-gift-id="${escapeHtml(gift.id)}">
        <div class="cal-ask__heading">
          <span class="cal-ask__icon" aria-hidden="true">💌</span>
          <span class="cal-ask__label">Responder</span>
        </div>
        <p class="cal-ask__question">${escapeHtml(question)}</p>
        <textarea class="cal-ask__input" rows="3" maxlength="1000" placeholder="Escribe aquí tu respuesta…"></textarea>
        <button type="button" class="cal-ask__send btn-primary">Enviar respuesta</button>
        <p class="cal-ask__status" role="status" aria-live="polite"></p>
      </div>`;
  }

  /** Enlaza la cajita: carga la respuesta previa y gestiona el envío */
  function bindAsk(ask) {
    if (!ask) return;
    const giftId = ask.dataset.giftId;
    const input = ask.querySelector('.cal-ask__input');
    const sendBtn = ask.querySelector('.cal-ask__send');
    const status = ask.querySelector('.cal-ask__status');

    // Carga la respuesta anterior de este usuario (si existe)
    db.getMyGiftResponses().then(responses => {
      const prev = responses?.[giftId];
      if (!prev?.text) return;
      input.value = prev.text;
      input.disabled = true;
      sendBtn.disabled = true;
      sendBtn.textContent = 'Respondida ❤';
      status.textContent = 'Ya respondiste a esta sorpresa. Gracias 💌';
      status.classList.add('is-done');
    }).catch(() => {});

    sendBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) {
        status.textContent = 'Escribe una respuesta antes de enviar.';
        status.classList.add('is-error');
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando…';
      try {
        await db.saveGiftResponse(giftId, text);
        input.disabled = true;
        sendBtn.textContent = 'Respondida ❤';
        status.textContent = '¡Enviada! El Admin la verá en el panel.';
        status.classList.remove('is-error');
        status.classList.add('is-done');
        showToast('Respuesta enviada 💌', 'success');
      } catch (err) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar respuesta';
        status.textContent = err?.message || 'No se pudo enviar. Inténtalo de nuevo.';
        status.classList.add('is-error');
      }
    });
  }

  /** Enlaza las opciones del quiz (el contenido se inyecta al abrir la sorpresa) */
  function bindQuiz(body) {
    body.querySelectorAll('.cal-quiz__q').forEach(qBlock => {
      const hint = qBlock.querySelector('.cal-quiz__hint');
      // Si ninguna opción marca una respuesta definida, no hay acierto/fallo
      const hasAnswer = qBlock.querySelectorAll('.cal-quiz__opt[data-correct="1"]').length > 0;
      qBlock.querySelectorAll('.cal-quiz__opt').forEach(opt => {
        opt.addEventListener('click', () => {
          if (qBlock.classList.contains('is-answered')) return;
          qBlock.classList.add('is-answered');
          qBlock.querySelectorAll('.cal-quiz__opt').forEach(o => { o.disabled = true; o.classList.add('is-disabled'); });
          opt.classList.add('is-selected');
          if (hasAnswer) {
            const isCorrect = opt.dataset.correct === '1';
            opt.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
            if (hint) hint.textContent = isCorrect ? '¡Correcto! ❤️' : 'Mmm… casi ❤️';
          } else if (hint) {
            opt.classList.add('is-neutral');
            hint.textContent = '¡Respondido! ❤️';
          }
        });
      });
    });
  }

  function handleDoneBtn() {
    const btn = page.querySelector('#calSheetDone');
    if (btn?.dataset?.playUrl) {
      window.location.href = btn.dataset.playUrl;
      return;
    }
    closeSheet();
  }

  function closeSheet() {
    const sheet = page.querySelector('#calSheet');
    if (!sheet || !sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-visible');
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-locked');
    if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
    // Pausa suave antes de destruir los vídeos (evita el corte brusco de audio)
    calVideoRefs.forEach(v => { try { v.video.pause(); } catch (e) {} });
    // Deja que la animación de salida complete (el contenido se desliza
    // con el panel) antes de destruirlo — transición no brusca
    const calBody = page.querySelector('#calSheetBody');
    setTimeout(() => {
      if (!sheet.classList.contains('is-open')) {
        calVideoRefs.forEach(v => { try { v.destroy(); } catch (e) {} });
        calVideoRefs = [];
        if (calBody) calBody.innerHTML = '';
      }
    }, 320);
    if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
    lastFocusedEl = null;
  }

  // ===== MARCADO DE ABIERTO (actualiza celda + hero + progreso en sitio) =====
  function markOpened(dateStr, ids) {
    ids.forEach(id => {
      if (!progressMap[id]?.opened) {
        progressMap[id] = { opened: true, openedAt: new Date().toISOString() };
      }
    });
    saveProgress();

    const dayNum = String(parseInt(dateStr.slice(8), 10));
    const cell = page.querySelector(`.cal-day[data-day="${dayNum}"]`);
    if (cell) {
      const firstId = ids[0];
      const gift = firstId ? catalog?.giftsById?.[firstId] : null;
      cell.classList.remove('is-today', 'is-catchup', 'is-locked');
      cell.classList.add('is-opened');
      cell.setAttribute('aria-pressed', 'true');
      const oldLabel = cell.getAttribute('aria-label') || '';
      cell.setAttribute('aria-label', oldLabel.replace(/— (disponible hoy|disponible|ya descubierto|próximamente)$/, '— ya descubierto'));
      const icon = gift?.type && typeIconMap[gift.type] ? `<span class="cal-day__icon" aria-hidden="true">${typeIconMap[gift.type]}</span>` : '';
      const specialMark = gift?.special ? '<span class="cal-day__special" aria-hidden="true">★</span>' : '';
      const countMark = ids.length > 1 ? `<span class="cal-day__count" aria-hidden="true">+${ids.length - 1}</span>` : '';
      cell.innerHTML = `<span class="cal-day__num">${cell.dataset.day}</span>${icon}${specialMark}<span class="cal-day__heart" aria-hidden="true">♥</span>${countMark}`;
    }
    const hero = page.querySelector('#calTodayWrap');
    const todayIds = normalizeIds(catalog?.months?.[todayMonthKey()]?.calendarMapping?.[String(dayOfMonthInSpain())]);
    if (hero && todayIds.length === ids.length && todayIds.every((id, i) => id === ids[i])) {
      hero.innerHTML = renderTodayHeroInner();
      const cta = page.querySelector('#calTodayCta');
      if (cta) cta.onclick = () => openDay(getTodayStr(), todayIds);
    }
    const prog = page.querySelector('.cal-progress');
    if (prog) prog.innerHTML = renderProgressInner();
  }

  // ===== CONTENIDO POR TIPO =====
  function renderContent(gift) {
    const data = gift.data || {};
    const esc = escapeHtml;

    switch (gift.type) {
      case 'letter':
        return `
          <div class="cal-type cal-letter">
            <span class="cal-letter__orn" aria-hidden="true">“</span>
            <div class="cal-letter__text">${esc(data.content || 'Mensaje vacío').replace(/\n/g, '<br>')}</div>
            <span class="cal-letter__sigil" aria-hidden="true">❤</span>
          </div>`;

      case 'cassette':
        return `
          <div class="cal-type cal-media">
            <div class="cal-media__info">
              <span class="cal-media__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </span>
              <strong>${esc(data.message || 'Música')}</strong>
            </div>
            <div class="cal-media__box">
              ${data.audioUrl ? `<audio controls preload="metadata"><source src="${esc(data.audioUrl)}"></audio>` : '<p class="cal-muted">No hay audio disponible aún</p>'}
            </div>
          </div>`;

      case 'giftBox':
        return `
          <div class="cal-type cal-photo">
            ${data.image
              ? `<img class="cal-photo__img" src="${esc(data.image)}" alt="Regalo" loading="lazy">`
              : '<span class="cal-photo__fallback" aria-hidden="true">🎁</span>'}
            ${data.message ? `<p class="cal-photo__msg">${esc(data.message)}</p>` : ''}
          </div>`;

      case 'video': {
        // El reproductor (misma barra glass que la galería) se monta en openGift
        const videoUrl = data.videoUrl || data.url || '';
        if (!videoUrl) {
          return `
            <div class="cal-type cal-video">
              <span class="cal-video__fallback" aria-hidden="true">🎬</span>
              <p class="cal-muted">${esc(data.caption || 'El vídeo aún no está disponible ❤️')}</p>
            </div>`;
        }
        // gifts.json usa `cover` como portada del vídeo; `poster` también se acepta
        const poster = data.poster || data.cover || '';
        return `
          <div class="cal-type cal-video" data-video-url="${esc(videoUrl)}"${poster ? ` data-poster="${esc(poster)}"` : ''}>
            ${data.caption ? `<p class="cal-muted">${esc(data.caption)}</p>` : ''}
          </div>`;
      }

      case 'surprise':
        return `
          <div class="cal-type cal-surprise">
            <div class="cal-surprise__emoji" aria-hidden="true">🎉</div>
            <p>${esc(data.message || '¡Sorpresa!')}</p>
          </div>`;

      case 'wishlist': {
        const items = data.items || [];
        return `
          <div class="cal-type cal-wishlist">
            <h4 class="cal-wishlist__title">Lista de deseos</h4>
            ${items.length
              ? `<ul class="cal-wishlist__list">${items.map((item, i) => `<li><span class="cal-wishlist__num">${i + 1}</span>${esc(item)}</li>`).join('')}</ul>`
              : `<p class="cal-muted">${esc(data.message || 'La lista está vacía por ahora')}</p>`}
          </div>`;
      }

      case 'challenge':
      case 'coupon':
      case 'memory':
      case 'plan':
      case 'affirmation': {
        const meta = TYPE_META[gift.type] || TYPE_META.affirmation;
        return `
          <div class="cal-type cal-new-gift cal-new-gift--${esc(gift.type)}">
            <div class="cal-new-gift__emoji" aria-hidden="true">${meta.emoji}</div>
            <h4 class="cal-new-gift__title">${esc(gift.title || meta.label)}</h4>
            <p class="cal-new-gift__message">${esc(data.message || 'Un detalle pensado para ti.')}</p>
          </div>`;
      }

      case 'clickStar':
        return `
          <div class="cal-type cal-star">
            <button class="cal-star__btn" id="calStar" aria-label="Toca la estrella"><span aria-hidden="true">⭐</span></button>
            <p>${esc(data.message || 'Toca la estrella ✧')}</p>
          </div>`;

      case 'game': {
        // Los juegos clásicos (julio) guardan redirectUrl a nivel de regalo;
        // los generados por calendar-expansion lo guardan dentro de data.
        const redirectUrl = data.redirectUrl || gift.redirectUrl;
        const playUrl = redirectUrl ? normalizePlayUrl(redirectUrl) : '';
        const gameId = redirectUrl
          ? redirectUrl.split('/').pop().replace(/\.html$/, '')
          : '';
        const cover = GAME_COVERS[gameId] || { color: '#7c9cff', accent: '#a5baff' };
        const gameName = (gift.title || '').replace(/^🎮\s*/, '') || 'Juego';
        return `
          <div class="cal-type cal-game">
            <div class="cal-game__cover">
              <img src="${gameCover(gameId, cover.color, cover.accent)}" alt="Portada de ${esc(gameName)}" loading="lazy">
            </div>
            <h4 class="cal-game__name">${esc(gameName)}</h4>
            <p class="cal-game__msg">${esc(data.message || '¡A jugar!')}</p>
            ${playUrl ? `<a class="cal-game__play btn-primary" href="${playUrl}">Jugar 🎮</a>` : ''}
          </div>`;
      }

      case 'quiz': {
        const questions = data.questions || [];
        if (!questions.length) {
          return `<div class="cal-type cal-quiz"><p class="cal-muted">${esc(data.message || 'Quiz interactivo')}</p></div>`;
        }
        // Quiz interactivo: toca una opción para responder.
        // Contrato de datos: `options` (o `answers`) + opcional `correct` (índice)
        // o `answer` (valor) para dar feedback inmediato de acierto/fallo.
        return `
          <div class="cal-type cal-quiz">
            ${questions.map((q, qi) => {
              const opts = q.options || q.answers || [];
              const correctIdx = Number.isInteger(q.correct)
                ? q.correct
                : (q.correctIndex !== undefined && q.correctIndex !== null ? Number(q.correctIndex) : -1);
              const correctVal = (q.answer !== undefined && q.answer !== null) ? String(q.answer) : null;
              // Solo hay feedback de acierto/fallo si la pregunta define la respuesta
              const hasAnswer = correctIdx >= 0 || correctVal !== null;
              return `
              <div class="cal-quiz__q" data-qid="${qi}">
                <p class="cal-quiz__prompt"><span class="cal-quiz__n">${qi + 1}</span>${esc(q.q || q.question || 'Pregunta')}</p>
                <div class="cal-quiz__opts" role="group" aria-label="Pregunta ${qi + 1}">
                  ${opts.map((o, oi) => {
                    const isRight = hasAnswer && (correctIdx === oi || (correctVal !== null && String(o) === correctVal));
                    return `
                    <button type="button" class="cal-quiz__opt" data-oi="${oi}"
                      data-correct="${isRight ? '1' : hasAnswer ? '0' : ''}">
                      ${esc(o)}
                    </button>`;
                  }).join('')}
                </div>
                ${opts.length ? '<p class="cal-quiz__hint" aria-live="polite"></p>' : ''}
              </div>`;
            }).join('')}
          </div>`;
      }

      case 'polaroid':
        return `
          <div class="cal-type cal-polaroid">
            ${data.image
              ? `<img class="cal-polaroid__img" src="${esc(data.image)}" alt="Foto" loading="lazy">`
              : '<span class="cal-polaroid__fallback" aria-hidden="true">📸</span>'}
            <p class="cal-polaroid__cap">${esc(data.caption || data.message || 'Un momento especial')}</p>
          </div>`;

      case 'riddle': {
        const question = data.question || data.content || data.message || 'Adivina, adivinanza…';
        const hasAnswer = !!data.answer;
        return `
          <div class="cal-type cal-riddle">
            <p class="cal-riddle__q">${esc(question)}</p>
            ${hasAnswer
              ? `<button type="button" class="cal-riddle__reveal btn-primary" data-riddle-reveal data-label="Mostrar respuesta">Mostrar respuesta</button>
                 <p class="cal-riddle__a" data-riddle-answer hidden>${esc(data.answer)}</p>`
              : ''}
          </div>`;
      }

      case 'curiosity':
        return `
          <div class="cal-type cal-curiosity">
            <span class="cal-curiosity__icon" aria-hidden="true">💡</span>
            <p>${esc(data.fact || data.message || 'Curiosidad del día')}</p>
          </div>`;

      case 'relax':
        return `
          <div class="cal-type cal-relax">
            <div class="cal-relax__orb" aria-hidden="true"></div>
            <p>${esc(data.message || 'Respira y suelta.')}</p>
          </div>`;

      case 'craft': {
        const pdfUrl = data.pdfUrl || data.url || '';
        return `
          <div class="cal-type cal-craft">
            <p>${esc(data.message || 'Manualidad para imprimir y hacer')}</p>
            ${pdfUrl
              ? `<div class="cal-craft__actions">
                   <a class="cal-craft__btn cal-craft__btn--primary" href="${esc(pdfUrl)}" target="_blank" rel="noopener">Ver PDF 🎨</a>
                   <a class="cal-craft__btn" href="${esc(pdfUrl)}" download>Descargar ⬇</a>
                 </div>`
              : '<p class="cal-muted">El PDF estará disponible pronto.</p>'}
          </div>`;
      }

      case 'offline':
        return `
          <div class="cal-type cal-offline">
            <span class="cal-offline__icon" aria-hidden="true">🔗</span>
            <p>${esc(data.message || 'Un reto para hacer fuera de la web')}</p>
            ${data.instructions ? `<p class="cal-muted">${esc(data.instructions)}</p>` : ''}
          </div>`;

      case 'math': {
        const problem = data.problem || data.question || data.message || 'Problema de mates';
        const hasAnswer = !!data.answer;
        return `
          <div class="cal-type cal-math">
            <p class="cal-math__problem">${esc(problem)}</p>
            ${hasAnswer
              ? `<button type="button" class="cal-math__reveal btn-primary" data-riddle-reveal data-label="Ver solución">Ver solución</button>
                 <p class="cal-math__a" data-riddle-answer hidden>${esc(data.answer)}</p>`
              : ''}
          </div>`;
      }

      default:
        return `
          <div class="cal-type cal-default">
            <p>${esc(gift.title || 'Sorpresa')}</p>
            <p class="cal-muted">${esc(data.message || 'Disfruta de este regalo.')}</p>
          </div>`;
    }
  }

  /** Normaliza una URL de juego/enlace: absoluta o relativa a la raíz. */
  function normalizePlayUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  // ===== LIMPIEZA (router) =====
  page.cleanup = () => {
    offContent();
    if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
    calVideoRefs.forEach(v => { try { v.destroy(); } catch (e) {} });
    calVideoRefs = [];
    document.body.classList.remove('sheet-locked');
  };

  return page;
}
