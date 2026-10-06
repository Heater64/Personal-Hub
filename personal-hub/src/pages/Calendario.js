/* ==========================================
   Calendario — sorpresas día a día
   Cuadrícula mensual con regalos por día y vista semanal
   y detalle de cada sorpresa en bottom sheet.

   Se conserva el contrato de datos completo:
     · catálogo (Supabase → /data/gifts.json) con months.calendarMapping
     · 20+ tipos de experiencia con su `data`
     · progreso local por usuario (misma clave que antes)
     · overrides locales para revisar el calendario sin tocar fechas
     · respuestas de la usuaria (db.saveGiftResponse)
   ========================================== */

import '../styles/calendario.css';
import {
  h, icon, emptyState, openSheet, closeSheets, toast
} from '../components/ui.js';
import { buildVideoPlayer } from '../components/MediaLightbox.js';
import { loadGiftsCatalog } from '../services/gifts.service.js';
import { db } from '../services/db.service.js';
import { userStore } from '../stores/user.store.js';
import { onContentChange } from '../services/realtime.service.js';
import { renderMathText } from '../utils/renderMath.js';
import { escapeHtml } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import { userPrefKey } from '../utils/userStorage.js';
import {
  applyCalendarDayOverride,
  setCalendarOverrideMode,
  getCalendarOverrides,
  clearCalendarOverrides
} from '../utils/calendarOverrides.js';

/* ==========================================
   CONSTANTES
   ========================================== */
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const CALENDAR_VIEWS = [
  { id: 'month', label: 'Mes' },
  { id: 'week', label: 'Semana' }
];
const CALENDAR_VIEW = { MONTH: 'month', WEEK: 'week' };

/** Icono y etiqueta de cada tipo de experiencia. */
const TYPE_META = {
  letter:      { icon: 'mail',     label: 'Carta' },
  affirmation: { icon: 'heart',    label: 'Mensaje' },
  riddle:      { icon: 'info',     label: 'Acertijo' },
  curiosity:   { icon: 'compass',  label: 'Curiosidad' },
  relax:       { icon: 'flower',   label: 'Desconexión' },
  challenge:   { icon: 'spark',    label: 'Reto' },
  polaroid:    { icon: 'camera',   label: 'Foto' },
  video:       { icon: 'video',    label: 'Vídeo' },
  surprise:    { icon: 'star',     label: 'Sorpresa' },
  craft:       { icon: 'pencil',   label: 'Manualidad' },
  giftBox:     { icon: 'gift',     label: 'Regalo' },
  game:        { icon: 'game',     label: 'Juego' },
  cassette:    { icon: 'music',    label: 'Música' },
  clickStar:   { icon: 'star',     label: 'Mini juego' },
  wishlist:    { icon: 'checksq',  label: 'Lista' },
  quiz:        { icon: 'info',     label: 'Quiz' },
  memory:      { icon: 'image',    label: 'Recuerdo' },
  plan:        { icon: 'calendar', label: 'Plan' },
  coupon:      { icon: 'tag',      label: 'Vale' },
  math:        { icon: 'pencil',   label: 'Mates' }
};

const metaOf = (type) => TYPE_META[type] || TYPE_META.affirmation;

/** Tono de color por tipo: la rejilla y las tarjetas se distinguen de un vistazo. */
const TYPE_TONES = {
  letter: 'rose', affirmation: 'rose', riddle: 'amber', curiosity: 'green',
  relax: 'green', challenge: 'amber', polaroid: 'rose', video: 'violet',
  surprise: 'amber', craft: 'amber', giftBox: 'rose',
  game: 'violet', cassette: 'violet', clickStar: 'amber', wishlist: 'rose',
  quiz: 'green', memory: 'rose', plan: 'green', coupon: 'amber', math: 'blue'
};
const toneOf = (type) => TYPE_TONES[type] || 'rose';

const PROGRESS_KEY = () => userPrefKey('giftProgress');

/* ==========================================
   ESTADO (módulo: sobrevive entre renders del router)
   ========================================== */
let catalog = null;
let progressMap = {};

// Respuestas de la usuaria, indexadas por giftId. Vive a nivel de módulo
// porque el calendario necesita saber, al pintar, si un regalo tiene una
// pregunta pendiente de contestar o ya está respondida.
let responsesMap = {};

/**
 * Si un regalo abre la cajita de respuesta: basta con que tenga `question`.
 *
 * Se incluye riddle a proposito: en agosto se responderon 9 acertijos desde
 * aqui, asi que ese historico es real y debe seguir siendo visible. Ademas
 * al abrir un acertijo queda el "adivina y luego descubre la respuesta", que
 * encaja con escribir la propia.
 *
 * math no entra porque sus retos usan `problem`, no `question`: no hay nada
 * que preguntar y la comprobacion ya lo resuelve sin una lista de tipos.
 */
function hasAskBox(gift) {
  return !!gift?.data?.question;
}

/**
 * Único punto por el que se escribe una respuesta. Actualiza la caché en
 * memoria ANTES de repintar: si solo se guardara en Supabase/localStorage, el
 * calendario seguiría mostrando el sobre y el contador de pendientes, porque
 * `pendingAnswer` lee de aquí.
 *
 * No repinta aquí: esta función vive a nivel de módulo y `paintAll` está
 * dentro del cierre de la página (el mismo motivo por el que loadMyResponses
 * devuelve la promesa en vez de repintar). Quien llama repinta justo después.
 */
function setResponse(giftId, text, extra = {}) {
  responsesMap = { ...responsesMap, [giftId]: { text, respondedAt: new Date().toISOString(), ...extra } };
}

/** Regalos que tienen pregunta y aún no se han contestado. */
const pendingAnswer = (gift) => hasAskBox(gift) && !responsesMap[gift.id]?.text;

/** Regalos con pregunta ya respondida. */
const alreadyAnswered = (gift) => hasAskBox(gift) && !!responsesMap[gift.id]?.text;

/** Cuántas preguntas quedan sin contestar en todo el catálogo. */
function pendingAnswerCount() {
  if (!catalog?.gifts) return 0;
  return catalog.gifts.filter(pendingAnswer).length;
}

function loadProgress() {
  try { progressMap = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}'); } catch { progressMap = {}; }
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY(), JSON.stringify(progressMap)); } catch { /* cuota llena */ }
}

/**
 * Carga las respuestas de la usuaria una vez, para poder marcar en el
 * calendario qué preguntas quedan. No bloquea el pintado: si falla, el
 * calendario se ve igual y solo se pierde el distintivo.
 *
 * Devuelve la promesa para que quien la llame repinte. Esta función es de
 * módulo y NO puede llamar a paintAll(), que vive dentro del cierre de la
 * página: si lo hiciera, la promesa rechazaría al no encontrarlo y el catch
 * dejaria la cache vacia.
 */
function loadMyResponses() {
  return db.getMyGiftResponses()
    .then((data) => { responsesMap = data || {}; return responsesMap; })
    .catch(() => { /* se conserva lo que hubiera: el distintivo es lo de menos */ });
}

/* ==========================================
   HELPERS DE FECHA
   ========================================== */
const pad = (n) => String(n).padStart(2, '0');

/** Normaliza la asignación de un día: string → [id], array → array limpia. */
function dayIds(dateStr) {
  if (!dateStr) return [];
  const [year, month, day] = dateStr.split('-');
  const mapping = catalog?.months?.[`${year}-${month}`]?.calendarMapping || {};
  const value = mapping[String(parseInt(day, 10))];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

const giftOf = (id) => catalog?.giftsById?.[id] || null;

/* ==========================================
   BUSCADOR
   Con 393 regalos repartidos por un año, la única forma de llegar a uno
   era recorrer día a día. El indice se calcula UNA vez por cada carga del
   catálogo (recorrer los 393 regalos por cada tecla seria tonto) y se
   reutiliza en cada pulsación.
   ========================================== */

/** Índice de búsqueda: regalo + fecha + texto en minúsculas. */
let searchIndex = null;
let searchIndexFor = null;

function getSearchIndex() {
  if (searchIndex && searchIndexFor === catalog) return searchIndex;
  const dateById = {};
  for (const key of Object.keys(catalog?.months || {})) {
    const mapping = catalog.months[key]?.calendarMapping || {};
    for (const day of Object.keys(mapping)) {
      const value = mapping[day];
      const ids = Array.isArray(value) ? value : value ? [value] : [];
      for (const id of ids) dateById[id] = `${key}-${pad(day)}`;
    }
  }
  searchIndex = (catalog?.gifts || [])
    .filter((gift) => gift?.id)
    .map((gift) => {
      const data = gift.data || {};
      const dateStr = dateById[gift.id] || '';
      // El nombre del mes entra en el indice: buscar "diciembre" tiene que
      // devolver los regalos de diciembre, no cero resultados.
      const mes = dateStr ? monthLabel(monthKeyOf(dateStr)) : '';
      const texto = [
        gift.title,
        metaOf(gift.type).label,
        mes,
        data.message, data.content, data.fact, data.caption,
        data.question, data.instructions, data.problem, data.redirectUrl,
      ].filter(Boolean).join(' ');
      return { gift, dateStr, texto: texto.toLowerCase() };
    });
  searchIndexFor = catalog;
  return searchIndex;
}

/** Regalos que casan con la búsqueda, ordenados por fecha. */
function searchGifts(query, limit = 60) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  // Varias palabras: tienen que aparecer todas. Asi "carta playa" encuentra
  // la carta que habla de la playa.
  const terms = q.split(/\s+/).filter(Boolean);
  return getSearchIndex()
    .filter((entry) => terms.every((term) => entry.texto.includes(term)))
    .sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''))
    .slice(0, limit);
}

function monthKeyOf(dateStr) { return dateStr.slice(0, 7); }

function monthLabel(key) {
  if (catalog?.months?.[key]?.label) return catalog.months[key].label;
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month - 1] || month} ${year}`;
}

function prettyDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return `${WEEKDAYS_FULL[weekday]} ${day} de ${MONTHS[month - 1].toLowerCase()}`;
}

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

/** Primer día de la semana en formato lunes=0. */
const mondayIndex = (year, month, day) => (new Date(year, month - 1, day).getDay() + 6) % 7;

/* ==========================================
   ESTADO DEL DÍA
   ========================================== */
const allOpened = (ids) => ids.length > 0 && ids.every(id => progressMap[id]?.opened);

/** Cuántos de los regalos del día están abiertos. */
const openedCount = (ids) => ids.filter(id => progressMap[id]?.opened).length;

/**
 * Un día con 2 de 3 abierta no es lo mismo que uno sin abrir nada, y antes
 * ambos salían con el mismo puntito. `partial` distingue ese caso para que
 * de un vistazo se vea cuánto queda.
 */
const isPartial = (ids) => {
  const n = openedCount(ids);
  return n > 0 && n < ids.length;
};

/** Progreso real de la app: nº de regalos abiertos / total. */
function overallProgress() {
  const entries = Object.keys(catalog?.giftsById || {});
  const total = entries.length;
  const opened = entries.filter(id => progressMap[id]?.opened).length;
  return { total, opened };
}

function dayState(dateStr, ids) {
  if (!ids.length) return 'empty';

  // Overrides locales (solo este navegador): permiten revisar el calendario
  // sin esperar a las fechas. Ganan sobre la lógica de fecha.
  const override = applyCalendarDayOverride(dateStr);
  if (override === 'locked') return 'locked';
  if (override === 'open') return openState(dateStr, ids);

  // Bloqueado por fecha: se comprueba antes de "opened" para que los días
  // futuros abiertos con versiones antiguas vuelvan a bloquearse.
  const today = todayISO();
  const anyUnlocked = ids.some(id => {
    const unlock = giftOf(id)?.unlock?.value;
    return !unlock || today >= unlock;
  });
  if (!anyUnlocked) return 'locked';

  return openState(dateStr, ids);
}

/** Estado de un día que ya se puede abrir: abierto, a medias o pendiente. */
function openState(dateStr, ids) {
  if (allOpened(ids)) return 'opened';
  if (isPartial(ids)) return 'partial';
  return dateStr === todayISO() ? 'today' : 'open';
}

/** Mensaje breve para el regalo más cercano del calendario. */
function countdownText(dateStr) {
  const today = todayISO();
  if (!dateStr) return 'Sin sorpresas programadas';
  if (dateStr === today) return 'Tu regalo de hoy';
  const diff = Math.round((new Date(`${dateStr}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  if (diff === 1) return 'La sorpresa de mañana';
  return `Próxima sorpresa en ${diff} días`;
}

/** Siguiente día con contenido a partir de hoy (inclusive). */
function nextDayWithContent(from = todayISO()) {
  const [year, month, day] = from.split('-').map(Number);
  let cursor = new Date(year, month - 1, day);
  for (let i = 0; i < 400; i++) {
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    if (dayIds(key).length) return key;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/* ==========================================
   PÁGINA
   ========================================== */
export function CalendarioPage(router) {
  const page = document.createElement('div');
  page.className = 'calendario-page';

  const previewAll = new URLSearchParams(location.search).get('previewGifts') === '1';
  const query = router.currentRoute?.query || {};
  const requestedDay = /^\d{4}-\d{2}-\d{2}$/.test(query.day || '') ? query.day : todayISO();
  const requestedGiftId = typeof query.gift === 'string' && /^[\w-]{1,120}$/.test(query.gift) ? query.gift : '';
  const selectedDay = { value: requestedDay };
  const view = { monthKey: monthKeyOf(requestedDay), mode: CALENDAR_VIEW.MONTH };
  let requestedGiftOpened = false;
  let pageActive = true;

  page.innerHTML = `
    ${renderHead()}
    <div id="calSpot"></div>
    <div id="calMonth"></div>
    <section id="calDay" class="cal-day-panel" hidden></section>
    <!-- Anuncia SOLO el cambio de día, no cada repintado. Con aria-live en el
         panel entero, moverse con las flechas entre regalos lo reponía todo
         (el panel se repinta porque navegar marca el regalo como visto) y un
         lector de pantalla lo leía entero en cada pulsación. -->
    <p class="sr-only" id="calAnnounce" aria-live="polite"></p>
  `;

  function renderHead() {
    const pendientes = pendingAnswerCount();
    return `
      <div class="scr-head cal-page-head">
        <div>
          <h1 class="scr-title">Calendario</h1>
          <p class="sub">Un regalo cada día, pensado para ti</p>
        </div>
        <div class="head-actions">
          <button type="button" class="icon-btn" id="calSearchBtn" aria-label="Buscar regalos" title="Buscar regalos">${icon('search', 19)}</button>
          <button type="button" class="icon-btn" id="calAnswersBtn" aria-label="${pendientes ? `Tus respuestas · ${pendientes} sin contestar` : 'Tus respuestas'}" title="Tus respuestas">
            ${icon('mail', 19)}${pendientes ? `<span class="icon-btn__badge">${pendientes}</span>` : ''}
          </button>
          ${userStore.isAdmin ? `<button type="button" class="icon-btn" id="calDevBtn" aria-label="Modo revisión" title="Modo revisión">${icon('gear', 19)}</button>` : ''}
        </div>
      </div>
    `;
  }

  /* ===== REGALO DESTACADO ===== */
  const SPOT_ROTATE_MS = 5000;
  const spotRot = { date: null, index: 0, timer: null };

  function stopSpotRotation() {
    if (spotRot.timer) {
      clearInterval(spotRot.timer);
      spotRot.timer = null;
    }
  }

  function paintSpot() {
    const host = page.querySelector('#calSpot');
    if (!host) return;

    stopSpotRotation();

    const today = todayISO();
    const todayIds = dayIds(today);
    const dateStr = todayIds.length ? today : (nextDayWithContent(today) || today);
    const ids = dayIds(dateStr);

    if (!ids.length) {
      host.innerHTML = `
        <article class="cal-spot">
          <span class="cal-spot__icon">${icon('calendar', 22)}</span>
          <div class="cal-spot__body">
            <b>Aún no hay regalos</b>
            <span>En cuanto se programe contenido aparecerá aquí.</span>
          </div>
        </article>
      `;
      return;
    }

    if (spotRot.date !== dateStr || spotRot.index >= ids.length) {
      spotRot.date = dateStr;
      spotRot.index = Math.max(0, ids.findIndex(id => !progressMap[id]?.opened));
    }

    const giftId = ids[spotRot.index];
    const gift = giftOf(giftId) || giftOf(ids[0]);
    if (!gift) {
      host.innerHTML = '';
      return;
    }

    const meta = metaOf(gift.type);
    const isOpen = !!progressMap[giftId]?.opened;
    const art = `<div class="cal-spot__art cal-spot__art--tone is-${toneOf(gift.type)}">${icon(meta.icon, 30)}</div>`;
    const dots = ids.length > 1
      ? `<span class="cal-spot__dots">
          ${ids.map((id, index) => `<button type="button" class="cal-spot__dot${index === spotRot.index ? ' is-on' : ''}" data-dot="${index}" aria-label="Regalo ${index + 1} de ${ids.length}"></button>`).join('')}
        </span>`
      : '';

    host.innerHTML = `
      <article class="cal-spot${isOpen ? ' is-open' : ''}">
        <button type="button" class="cal-spot__hit" data-gift="${escapeHtml(giftId)}" aria-label="${escapeHtml(`Abrir ${gift.title || meta.label}`)}"></button>
        ${art}
        <div class="cal-spot__body">
          <span class="cal-spot__when">${escapeHtml(countdownText(dateStr))}</span>
          <b class="cal-spot__title">${escapeHtml(gift.title || meta.label)}</b>
          <span class="cal-spot__type">${escapeHtml(meta.label)}${ids.length > 1 ? ` · ${spotRot.index + 1} de ${ids.length}` : ''}</span>
          ${dots}
        </div>
        <span class="cal-spot__go">${isOpen ? 'Ver' : 'Abrir'} ${icon('chev', 16)}</span>
      </article>
    `;

    host.querySelector('[data-gift]')?.addEventListener('click', () => openExperience(gift, dateStr));
    host.querySelectorAll('[data-dot]').forEach(dot => {
      dot.addEventListener('click', event => {
        event.stopPropagation();
        spotRot.index = Number(dot.dataset.dot);
        paintSpot();
      });
    });

    if (ids.length > 1) {
      spotRot.timer = setInterval(() => {
        if (document.hidden) return;
        spotRot.index = (spotRot.index + 1) % ids.length;
        paintSpot();
      }, SPOT_ROTATE_MS);
    }
  }

  /* ===== CALENDARIO ===== */
  function paintMonth() {
    const host = page.querySelector('#calMonth');
    if (!host) return;
    page.querySelector('#calDay')?.removeAttribute('hidden');

    const months = Object.keys(catalog?.months || {}).sort();
    if (!months.length) {
      host.innerHTML = '';
      return;
    }
    if (!months.includes(view.monthKey)) {
      const past = months.filter(m => m <= monthKeyOf(todayISO()));
      view.monthKey = past.length ? past[past.length - 1] : months[0];
      if (!months.includes(monthKeyOf(selectedDay.value))) {
        selectedDay.value = `${view.monthKey}-${pad(Math.min(Number(selectedDay.value.slice(-2)), daysInMonth(...view.monthKey.split('-').map(Number))))}`;
      }
    }

    const [year, month] = view.monthKey.split('-').map(Number);
    const total = daysInMonth(year, month);
    const offset = mondayIndex(year, month, 1);
    const today = todayISO();
    const selected = selectedDay.value;
    const selectedParts = selected.split('-').map(Number);
    const firstCell = new Date(year, month - 1, 1);
    let cellCount;

    if (view.mode === CALENDAR_VIEW.WEEK) {
      const selectedDate = new Date(selectedParts[0], selectedParts[1] - 1, selectedParts[2]);
      firstCell.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      firstCell.setDate(firstCell.getDate() - mondayIndex(selectedParts[0], selectedParts[1], selectedParts[2]));
      cellCount = 7;
    } else {
      firstCell.setDate(1 - offset);
      cellCount = Math.ceil((offset + total) / 7) * 7;
    }

    // Progreso mensual por día con regalos y progreso global por regalo.
    let monthTotal = 0;
    let monthOpened = 0;
    for (let day = 1; day <= total; day++) {
      const ids = dayIds(`${year}-${pad(month)}-${pad(day)}`);
      if (!ids.length) continue;
      monthTotal++;
      if (allOpened(ids)) monthOpened++;
    }
    const global = overallProgress();
    const pct = global.total ? Math.round((global.opened / global.total) * 100) : 0;
    const pendientes = pendingAnswerCount();
    const calendarTitle = monthLabel(view.monthKey);
    const calendarSummary = monthTotal ? `${monthOpened} de ${monthTotal} regalos abiertos` : 'Sin regalos este mes';

    const cells = [];
    for (let i = 0; i < cellCount; i++) {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + i);
      const day = date.getDate();
      const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(day)}`;
      const inMonth = date.getFullYear() === year && date.getMonth() === month - 1;
      const adjacent = view.mode === CALENDAR_VIEW.MONTH && !inMonth;
      // Un mes enseña las fechas de relleno sin revelar regalos del mes
      // siguiente; la vista semanal sí muestra su contenido completo.
      const ids = adjacent ? [] : dayIds(dateStr);
      const state = dayState(dateStr, ids);
      const count = ids.length;
      const abiertos = openedCount(ids);
      const classes = ['cal-day'];
      if (!count) classes.push('is-empty');
      if (state === 'locked') classes.push('is-locked');
      if (state === 'partial') classes.push('is-partial');
      if (state === 'opened') classes.push('is-opened');
      if (state === 'partial') classes.push('is-partial');
      if (dateStr === today) classes.push('is-today');
      if (dateStr === selected) classes.push('is-sel');
      if (state === 'today' && dateStr !== selected) classes.push('is-pending');
      if (adjacent) classes.push('is-dim');

      const status = state === 'opened' ? `<span class="cal-day__ok" aria-hidden="true">${icon('check', 12)}</span>`
        : state === 'partial' ? `<span class="cal-day__part" aria-hidden="true">${abiertos}/${count}</span>`
        : '';
      const dot = count && state !== 'opened' && state !== 'partial'
        ? '<span class="cal-day__dot" aria-hidden="true"></span>'
        : '';
      const label = state === 'empty' ? `${day} — sin regalo`
        : state === 'locked' ? `${day} — sorpresa por llegar`
        : state === 'opened' ? `${day} — regalo abierto`
        : state === 'partial' ? `${day} — ${abiertos} de ${count} regalos abiertos`
        : `${day} — ${count} ${count === 1 ? 'regalo' : 'regalos'}`;

      cells.push(`
        <button type="button" class="${classes.join(' ')}" data-date="${dateStr}" aria-label="${escapeHtml(`${prettyDate(dateStr)} — ${label.split(' — ').slice(1).join(' — ')}`)}" aria-pressed="${dateStr === selected}"${adjacent ? ' disabled' : ''}>
          <span class="cal-day__n">${date.getDate()}</span>
          ${status}${dot}
        </button>
      `);
    }

    host.innerHTML = `
      <div class="cal">
        <header class="cal-head">
          <div class="cal-head__identity">
            <span class="cal-head__icon" aria-hidden="true">${icon('calendar', 32)}</span>
            <div class="cal-head__copy">
              <h1 class="cal-head__month">${escapeHtml(calendarTitle)}</h1>
              <p class="cal-head__sub">${escapeHtml(calendarSummary)}</p>
            </div>
          </div>
          <div class="cal-head__controls">
            <div class="cal-nav" role="group" aria-label="Navegar por el calendario">
              <button type="button" class="icon-btn" data-period="-1" aria-label="${view.mode === CALENDAR_VIEW.MONTH ? 'Mes anterior' : 'Semana anterior'}">${icon('back', 18)}</button>
              <button type="button" class="cal-today-btn" data-today>Hoy</button>
              <button type="button" class="icon-btn" data-period="1" aria-label="${view.mode === CALENDAR_VIEW.MONTH ? 'Mes siguiente' : 'Semana siguiente'}">${icon('chev', 18)}</button>
            </div>
            <div class="cal-view-tabs" role="group" aria-label="Vista del calendario">
              ${CALENDAR_VIEWS.map(({ id, label: viewLabel }) => `<button type="button" class="cal-view-btn${view.mode === id ? ' is-active' : ''}" data-calendar-view="${id}" aria-pressed="${view.mode === id}">${viewLabel}</button>`).join('')}
            </div>
          </div>
        </header>
        <div class="cal-weekdays" aria-label="Días de la semana">
          ${WEEKDAYS.map((day, index) => `<span class="wd" aria-label="${day}"><span class="wd__full">${day}</span><span class="wd__short">${WEEKDAYS_SHORT[index]}</span></span>`).join('')}
        </div>
        <div class="cal-grid cal-grid--${view.mode}">${cells.join('')}</div>
        ${global.total ? `
        <div class="cal-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${global.total}" aria-valuenow="${global.opened}" aria-label="Regalos abiertos">
          <div class="cal-progress__text">
            <span>Regalos abiertos</span>
            <b>${global.opened} / ${global.total}</b>
          </div>
          <div class="cal-progress__bar"><span style="width:${pct}%"></span></div>
        </div>` : ''}
      </div>
    `;

    host.querySelectorAll('.cal-day[data-date]').forEach(button => {
      button.addEventListener('click', () => selectCalendarDate(button.dataset.date));
    });
    host.querySelectorAll('[data-period]').forEach(button => {
      button.addEventListener('click', () => shiftPeriod(Number(button.dataset.period)));
    });
    host.querySelector('[data-today]')?.addEventListener('click', () => selectCalendarDate(todayISO()));
    host.querySelectorAll('[data-calendar-view]').forEach(button => {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.calendarView;
        if (nextMode === CALENDAR_VIEW.WEEK && monthKeyOf(selectedDay.value) !== view.monthKey) {
          const [year, month] = view.monthKey.split('-').map(Number);
          const day = Number(selectedDay.value.slice(-2));
          selectedDay.value = `${view.monthKey}-${pad(Math.min(day, daysInMonth(year, month)))}`;
        }
        view.mode = nextMode;
        paintMonth();
        paintDay();
      });
    });
  }

  function selectCalendarDate(dateStr) {
    selectedDay.value = dateStr;
    view.monthKey = monthKeyOf(dateStr);
    paintMonth();
    paintDay();
    page.querySelector('#calDay')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openRequestedGift() {
    if (!pageActive || !requestedGiftId || requestedGiftOpened || selectedDay.value !== requestedDay) return;
    const ids = dayIds(requestedDay);
    const gift = ids.includes(requestedGiftId) ? giftOf(requestedGiftId) : null;
    if (!gift || dayState(requestedDay, ids) === 'locked') return;
    requestedGiftOpened = true;
    openExperience(gift, requestedDay);
  }

  function shiftPeriod(delta) {
    const months = Object.keys(catalog?.months || {}).sort();
    if (!months.length) return;

    if (view.mode === CALENDAR_VIEW.MONTH) {
      const index = months.indexOf(view.monthKey);
      const next = months[Math.min(months.length - 1, Math.max(0, (index === -1 ? 0 : index) + delta))];
      if (next === view.monthKey) return;
      view.monthKey = next;
      paintMonth();
      return;
    }

    const [year, month, day] = selectedDay.value.split('-').map(Number);
    const target = new Date(year, month - 1, day);
    target.setDate(target.getDate() + delta * 7);

    const [firstYear, firstMonth] = months[0].split('-').map(Number);
    const [lastYear, lastMonth] = months[months.length - 1].split('-').map(Number);
    const firstAvailable = new Date(firstYear, firstMonth - 1, 1);
    const lastAvailable = new Date(lastYear, lastMonth, 0);
    if (target < firstAvailable) target.setTime(firstAvailable.getTime());
    if (target > lastAvailable) target.setTime(lastAvailable.getTime());

    selectedDay.value = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    view.monthKey = monthKeyOf(selectedDay.value);
    paintMonth();
    paintDay();
    page.querySelector('#calDay')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ===== REGALOS DEL DÍA ===== */
  function paintDay() {
    const host = page.querySelector('#calDay');
    if (!host) return;

    const dateStr = selectedDay.value;
    const ids = dayIds(dateStr);
    const state = dayState(dateStr, ids);
    const isToday = dateStr === todayISO();

    // Aviso para lectores de pantalla, solo si el día ha cambiado de verdad.
    announceDay(dateStr, ids);

    if (!ids.length) {
      host.innerHTML = `
        <p class="section-title">${escapeHtml(prettyDate(dateStr))}</p>
        ${emptyState('gift', 'Ese día no tiene regalo', isToday ? 'Hoy no hay nada programado.' : 'Este día todavía no tiene nada asignado.', isToday ? 'Ver el primer regalo' : 'Ir al siguiente', () => {
          const target = nextDayWithContent(dateStr) || nextDayWithContent(todayISO());
          if (!target) return;
          selectedDay.value = target;
          view.monthKey = monthKeyOf(target);
          paintMonth();
          paintDay();
          page.querySelector('#calDay')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }).outerHTML}
      `;
      return;
    }

    if (state === 'locked') {
      const unlock = giftOf(ids[0])?.unlock?.value;
      host.innerHTML = `
        <p class="section-title">${escapeHtml(prettyDate(dateStr))}</p>
        <div class="cal-locked">
          <span class="e-ic">${icon('lock', 22)}</span>
          <b>Todavía no</b>
          <p>${unlock ? `Se abre el ${escapeHtml(prettyDate(unlock))}.` : 'Este regalo aún no está disponible.'}</p>
        </div>
      `;
      return;
    }

    const abiertos = openedCount(ids);
    const dayPct = Math.round((abiertos / ids.length) * 100);
    const contestadas = ids.filter(id => alreadyAnswered(giftOf(id))).length;
    const sinResponder = ids.filter(id => pendingAnswer(giftOf(id))).length;
    host.innerHTML = `
      <p class="section-title">${escapeHtml(prettyDate(dateStr))}
        <span class="section-title__aside">${abiertos === ids.length ? 'Todo abierto ✓' : `${abiertos} de ${ids.length}`}</span>
      </p>
      ${abiertos > 0 ? `<div class="cal-dayprogress${abiertos === ids.length ? ' is-done' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${ids.length}" aria-valuenow="${abiertos}">
        <div class="cal-dayprogress__bar"><span style="width:${dayPct}%"></span></div>
      </div>` : ''}
      ${contestadas || sinResponder ? `<p class="cal-dayask">${sinResponder
        ? `💌 ${sinResponder === 1 ? 'Te queda 1 por responder' : `Te quedan ${sinResponder} por responder`}`
        : `💌 ${contestadas === 1 ? '1 respuesta guardada' : `${contestadas} respuestas guardadas`}`}</p>` : ''}
    `;

    if (requestedGiftId && requestedDay === dateStr && ids.includes(requestedGiftId)
        && !requestedGiftOpened) {
      queueMicrotask(openRequestedGift);
    }

    const grid = h('div', { class: `cal-gifts${isToday ? ' is-today' : ''}` });
    for (const id of ids) {
      const gift = giftOf(id);
      if (!gift) continue;
      const meta = metaOf(gift.type);
      const isOpen = !!progressMap[id]?.opened;
      const pendiente = pendingAnswer(gift);
      const contestada = alreadyAnswered(gift);
      const tone = toneOf(gift.type);
      const caption = gift.data?.caption || gift.data?.message || '';
      const extraLabel = isOpen ? ', ya abierto' : '';
      const askLabel = pendiente ? ', tiene una pregunta sin contestar' : contestada ? ', pregunta respondida' : '';

      const card = h('button', {
        class: `cal-gift${isOpen ? ' is-open' : ''}${pendiente ? ' is-ask' : ''}`,
        type: 'button',
        'aria-label': `${gift.title || meta.label}${extraLabel}${askLabel}`,
        onclick: () => openExperience(gift, dateStr)
      },
        h('div', { class: 'cal-gift__media' },
          h('div', { class: `cal-gift__art cal-gift__art--tone is-${tone}` }, h('span', { html: icon(meta.icon, 30) })),
          h('span', { class: 'cal-gift__tag' }, meta.label),
          isOpen ? h('span', { class: 'cal-gift__ok', html: icon('check', 13) }) : null,
          // El sobre avisa de que hay algo que responder sin abrir el regalo.
          pendiente ? h('span', { class: 'cal-gift__ask', html: icon('mail', 12) }) : null
        ),
        h('div', { class: 'cal-gift__body' },
          h('b', null, gift.title || meta.label),
          caption ? h('span', { class: 'cal-gift__cap' }, caption) : null
        )
      );
      grid.append(card);
    }
    host.append(grid);
  }

  /**
   * Anuncia el cambio de día a los lectores de pantalla. Solo habla cuando el
   * día seleccionado es otro: repintar el mismo día (por ejemplo al navegar
   * entre sus regalos, que marca cada uno como visto) no dice nada, porque si
   * no el lector repite el panel entero en cada flecha.
   */
  let lastAnnouncedDay = null;
  function announceDay(dateStr, ids) {
    // Antes de que llegue el catálogo el día parece vacío: si se anunciara
    // eso, se quedaría marcado como ya dicho y al cargar los regalos seguiría
    // diciendo "sin regalo".
    if (!catalog) return;
    if (dateStr === lastAnnouncedDay) return;
    lastAnnouncedDay = dateStr;
    const live = page.querySelector('#calAnnounce');
    if (!live) return;
    const abiertos = openedCount(ids);
    live.textContent = ids.length
      ? `${prettyDate(dateStr)}. ${ids.length} ${ids.length === 1 ? 'regalo' : 'regalos'}, ${abiertos} abierto${abiertos === 1 ? '' : 's'}.`
      : `${prettyDate(dateStr)}. Sin regalo.`;
  }

  /** El catálogo (re)cargado: el día actual vuelve a merecer anuncio. */
  function resetAnnouncement() { lastAnnouncedDay = null; }

  function paintAll() {
    paintHeadBadge();
    paintSpot();
    paintMonth();
    paintDay();
  }

  /** El contador de preguntas pendientes vive en la cabecera: se actualiza solo. */
  function paintHeadBadge() {
    const btn = page.querySelector('#calAnswersBtn');
    if (!btn) return;
    const pendientes = pendingAnswerCount();
    btn.title = pendientes ? `Tus respuestas · ${pendientes} sin contestar` : 'Tus respuestas';
    btn.setAttribute('aria-label', btn.title);
    btn.querySelector('.icon-btn__badge')?.remove();
    if (pendientes) {
      btn.append(h('span', { class: 'icon-btn__badge' }, String(pendientes)));
    }
  }

  /* ==========================================
     EXPERIENCIAS
     ========================================== */
  function openExperience(gift, dateStr) {
    // Solo los regalos DEL DÍA: las flechas recorren lo que hay para hoy sin
    // salir, en vez de llevar a cualquier fecha del calendario.
    const list = dayIds(dateStr)
      .map(id => ({ gift: giftOf(id), dateStr }))
      .filter(entry => entry.gift);
    let index = list.findIndex(e => e.gift.id === gift.id);
    if (index < 0) index = 0;

    // Estado de la navegación en curso, para poder desmontarla al cerrar.
    const nav = { handler: null, alive: true };

    // Al cerrar la hoja nada de lo de dentro sigue vivo: el audio y
    // el vídeo NO se pausan solos al sacar el elemento del DOM, y las
    // flechas del teclado no deben quedar escuchando detrás.
    const closeExperience = () => {
      nav.alive = false;
      if (nav.handler) document.removeEventListener('keydown', nav.handler);
      overlay.querySelectorAll('audio, video').forEach(media => {
        try {
          media.pause();
          if (media.currentTime) media.currentTime = 0;
        } catch { /* ya sin recurso */ }
      });
    };

    const overlay = openSheet(gift.title || metaOf(gift.type).label, () => {
      const body = document.createElement('div');
      body.className = 'exp exp--browse';
      body.append(
        h('div', { class: 'exp-browse__bar' },
          h('span', { class: 'exp-browse__date' }),
          h('span', { class: 'exp-browse__count' })
        ),
        h('div', { class: 'exp-kind' },
          h('span', { class: 'exp-kind__icon' }),
          h('span', { class: 'exp-kind__label' })
        ),
        h('div', { class: 'exp-browse__stage' }),
        h('div', { class: 'exp-browse__nav' },
          h('button', { class: 'exp-browse__arrow exp-browse__arrow--prev', type: 'button', 'aria-label': 'Regalo anterior' },
            h('span', { html: icon('chevron-left', 20) })),
          h('button', { class: 'exp-browse__arrow exp-browse__arrow--next', type: 'button', 'aria-label': 'Regalo siguiente' },
            h('span', { html: icon('chevron-right', 20) })),
        ),
        h('button', { class: 'btn btn--block exp-browse__close', type: 'button', onclick: () => closeSheets() }, 'Cerrar')
      );
      return body;
    }, closeExperience);

    const sheet = overlay.querySelector('.sheet');
    const head = overlay.querySelector('.sheet-head h2');
    const bar = overlay.querySelector('.exp-browse__bar');
    const stage = overlay.querySelector('.exp-browse__stage');
    let stageTransitionEnd = null;
    const kind = overlay.querySelector('.exp-kind');
    const kindIcon = kind.querySelector('.exp-kind__icon');
    const kindLabel = kind.querySelector('.exp-kind__label');
    const btnPrev = overlay.querySelector('.exp-browse__arrow--prev');
    const btnNext = overlay.querySelector('.exp-browse__arrow--next');
    const navEl = overlay.querySelector('.exp-browse__nav');
    const dateOut = bar.querySelector('.exp-browse__date');
    const countOut = bar.querySelector('.exp-browse__count');

    const go = (delta) => {
      const next = index + delta;
      // No es cíclico: en los extremos la flecha se desactiva. Envolver de
      // un día a otro confunde más que ayuda.
      if (next < 0 || next >= list.length) return;
      index = next;
      paint();
      // Moverse con las flechas ES mirar el regalo, asi que cuenta como
      // visto: si no, se podrian recorrer los cuatro del dia sin que
      // ninguno quedara marcado.
      markGiftSeen(list[index].gift.id);
    };

    function paint() {
      const actual = list[index];
      if (!actual) return;
      const meta = metaOf(actual.gift.type);
      const tone = toneOf(actual.gift.type);

      if (head) head.textContent = actual.gift.title || meta.label;
      dateOut.textContent = prettyDate(actual.dateStr);
      countOut.textContent = `${index + 1} de ${list.length}`;

      // La identidad visual: cada tipo de regalo lleva su propio icono, su
      // tono y su clase, para que una carta no se parezca a un mensaje ni un
      // acertijo a una curiosidad.
      kind.className = `exp-kind is-${tone} exp-kind--${actual.gift.type}`;
      kindIcon.innerHTML = icon(meta.icon, 15);
      kindLabel.textContent = meta.label;
      stage.className = `exp-browse__stage exp--${actual.gift.type}`;

      // Animamos los cambios de altura del contenido normal, pero no el vídeo:
      // su tamaño intrínseco llega con los metadatos y fijar la altura antes
      // de cargarlos puede recortar el reproductor. Tampoco se fija altura
      // cuando el sistema pide movimiento reducido (no habría transitionend).
      const alturaVieja = stage.offsetHeight;
      if (stageTransitionEnd) {
        stage.removeEventListener('transitionend', stageTransitionEnd);
        stageTransitionEnd = null;
      }
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const animateHeight = actual.gift.type !== 'video' && !prefersReducedMotion;
      stage.style.transition = 'none';
      stage.style.overflow = animateHeight ? 'hidden' : '';
      stage.style.height = animateHeight ? `${alturaVieja}px` : '';

      // El audio/vídeo no se pausa solo al sacarlo del DOM: sin
      // esto, la cassette anterior seguiría sonando de fondo.
      stage.querySelectorAll('audio, video').forEach(media => {
        try { media.pause(); media.currentTime = 0; } catch { /* ignorar */ }
      });
      stage.replaceChildren();
      const content = renderContent(actual.gift);
      if (content) stage.append(content);
      const ask = renderAsk(actual.gift);
      if (ask) stage.append(ask);

      // La altura nueva es la del contenido, no la del bloque: si no, el
      // growth se queda bloqueado en la altura anterior.
      const alturaNueva = stage.scrollHeight;
      stage.style.transition = '';
      if (animateHeight && alturaNueva !== alturaVieja) {
        // reflow para que el navegador vea el punto de partida de la transición
        void stage.offsetHeight;
        stage.style.height = `${alturaNueva}px`;
        const alTerminar = (ev) => {
          if (ev.target !== stage || ev.propertyName !== 'height') return;
          stage.removeEventListener('transitionend', alTerminar);
          if (stageTransitionEnd === alTerminar) stageTransitionEnd = null;
          stage.style.height = '';      // vuelve a crecer con el contenido
          stage.style.overflow = '';
        };
        stageTransitionEnd = alTerminar;
        stage.addEventListener('transitionend', alTerminar);
      } else {
        stage.style.height = '';
        stage.style.overflow = '';
      }

      btnPrev.disabled = index === 0;
      btnNext.disabled = index === list.length - 1;
      btnPrev.setAttribute('aria-label', `Regalo anterior: ${(list[index - 1]?.gift.title) || 'ninguno'}`);
      btnNext.setAttribute('aria-label', `Regalo siguiente: ${(list[index + 1]?.gift.title) || 'ninguno'}`);
      if (list.length < 2) navEl.hidden = true;

      // Al cambiar de regalo, arriba del todo: si no, se hereda el scroll
      // del anterior y parece que no ha cambiado nada.
      sheet.scrollTop = 0;
    }

    btnPrev.addEventListener('click', () => go(-1));
    btnNext.addEventListener('click', () => go(1));

    // Flechas del teclado. Se anula al escribir en un campo de texto, para
    // que las flechas sigan moviendo el cursor y no cambien de regalo.
    nav.handler = event => {
      if (!nav.alive || !overlay.isConnected) {
        // El sheet se ha cerrado por otra via (Escape, fondo, ruta): el
        // listener se retira solo, sin depender de un unmount explicito.
        nav.alive = false;
        document.removeEventListener('keydown', nav.handler);
        return;
      }
      const typing = event.target.closest?.('input,textarea,select,[contenteditable]');
      if (typing) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    };
    document.addEventListener('keydown', nav.handler);

    paint();
    markGiftSeen(gift.id);
  }

  /**
   * Marca solo el regalo abierto como visto (cada regalo es independiente).
   * Sin aviso: el regalo ya se ve marcado con el check en la tarjeta y el
   * progreso avanza solo, así que el aviso solo tapaba la pantalla.
   */
  function markGiftSeen(giftId) {
    if (!progressMap[giftId]?.opened) {
      progressMap[giftId] = { opened: true, openedAt: new Date().toISOString() };
      saveProgress();
    }
    paintAll();
  }

  /** Contenido de la sorpresa según su tipo. */
  function renderContent(gift) {
    const data = gift.data || {};
    const type = gift.type;

    const textBlock = (text, className = 'exp-text') => {
      const p = document.createElement('div');
      p.className = className;
      p.innerHTML = type === 'letter' ? escapeHtml(text).replace(/\n/g, '<br>') : escapeHtml(text);
      return p;
    };

    switch (type) {
      case 'letter': {
        // Sin título dentro: la cabecera del sheet ya lo muestra.
        const wrap = h('div', { class: 'exp' });
        wrap.append(textBlock(data.content || data.message || '', 'exp-text'));
        return wrap;
      }

      case 'cassette': {
        const wrap = h('div', { class: 'exp exp-audio' });
        const cover = data.coverImage || data.cover || '';
        if (cover) {
          wrap.append(h('div', { class: 'exp-cover' }, h('img', { src: cover, alt: 'Portada', loading: 'lazy' })));
        }
        if (data.message) wrap.append(textBlock(data.message, 'exp-note'));
        if (data.audioUrl) {
          wrap.append(h('audio', { controls: true, preload: 'metadata', src: data.audioUrl }));
        } else {
          wrap.append(h('p', { class: 'exp-note' }, 'El audio todavía no está disponible.'));
        }
        return wrap;
      }

      case 'giftBox':
      case 'polaroid': {
        const wrap = h('div', { class: 'exp' });
        const src = data.image || '';
        if (src) {
          wrap.append(h('div', { class: 'exp-media' }, h('img', { src, alt: gift.title || 'Sorpresa', loading: 'lazy' })));
        } else {
          wrap.append(h('div', { class: 'exp-media exp-media--placeholder' },
            h('span', { html: icon(type === 'polaroid' ? 'camera' : 'gift', 26) }),
            h('span', null, type === 'polaroid' ? 'La foto llegará pronto' : 'El regalo llegará pronto')
          ));
        }
        const caption = data.caption || data.message || '';
        if (caption) wrap.append(textBlock(caption, 'exp-note'));
        return wrap;
      }

      case 'video': {
        const wrap = h('div', { class: 'exp' });
        const src = data.videoUrl || data.url || '';
        const poster = data.poster || data.cover || '';
        if (src) {
          // buildVideoPlayer devuelve { wrap, video, ... }; hay que montar
          // `wrap`, no el objeto (insertaba "[object Object]").
          const player = buildVideoPlayer({ src, poster, autoplay: false, loop: false, className: 'exp-video' });
          const media = h('div', { class: 'exp-media' });
          media.append(player.wrap);
          wrap.append(media);
        } else {
          wrap.append(h('div', { class: 'exp-media exp-media--placeholder' },
            h('span', { html: icon('video', 26) }),
            h('span', null, 'El vídeo aún no está disponible')
          ));
        }
        if (data.caption) wrap.append(textBlock(data.caption, 'exp-note'));
        return wrap;
      }

      case 'surprise': {
        const wrap = h('div', { class: 'exp' });
        wrap.append(h('div', { class: 'exp-surprise' },
          h('span', { class: 'e-emoji' }, '🎉'),
          h('p', { class: 'exp-text' }, data.message || '¡Sorpresa!')
        ));
        return wrap;
      }

      case 'wishlist': {
        const wrap = h('div', { class: 'exp' });
        wrap.append(h('p', { class: 'exp-title' }, 'Lista de deseos'));
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length) {
          const list = h('ul', { class: 'exp-list' });
          items.forEach(item => {
            list.append(h('li', null, h('span', { html: icon('heart', 15) }), h('span', null, String(item))));
          });
          wrap.append(list);
        } else {
          wrap.append(h('p', { class: 'exp-note' }, data.message || 'La lista está vacía por ahora.'));
        }
        return wrap;
      }

      case 'clickStar': {
        const total = Math.max(3, Math.min(20, parseInt(data.stars, 10) || 8));
        const wrap = h('div', { class: 'exp' });
        wrap.append(h('p', { class: 'exp-note' }, data.message || 'Toca todas las estrellas ✨'));
        const grid = h('div', { class: 'exp-stars' });
        const counter = h('p', { class: 'exp-note' });
        let found = 0;
        const update = () => {
          counter.textContent = found === total ? '¡Lo conseguiste! ⭐' : `${found} de ${total} estrellas`;
        };
        for (let i = 0; i < total; i++) {
          const btn = h('button', { class: 'exp-star', type: 'button', 'aria-label': 'Estrella', html: icon('star', 22) });
          btn.addEventListener('click', () => {
            if (btn.classList.contains('is-on')) return;
            btn.classList.add('is-on');
            found++;
            update();
          });
          grid.append(btn);
        }
        update();
        wrap.append(grid, counter);
        return wrap;
      }

      case 'game': {
        const wrap = h('div', { class: 'exp' });
        const redirectUrl = data.redirectUrl || gift.redirectUrl || '';
        if (data.message) wrap.append(textBlock(data.message, 'exp-note'));
        if (redirectUrl) {
          const playUrl = /^https?:\/\//i.test(redirectUrl)
            ? redirectUrl
            : (redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`);
          wrap.append(h('div', { class: 'exp-actions' },
            h('a', { class: 'btn', href: playUrl, target: '_blank', rel: 'noopener' }, 'Jugar 🎮')
          ));
        }
        return wrap;
      }

      case 'riddle':
      case 'math': {
        const wrap = h('div', { class: 'exp' });
        const question = data.question || data.problem || data.content || data.message || 'Adivina, adivinanza…';
        const answer = data.answer || data.solution || '';
        const block = h('div', { class: 'exp-riddle' });
        block.append(h('b', null, type === 'math' ? 'Resuelve' : (gift.title || 'Acertijo')));
        block.append(h('p', { html: renderMathText(question) }));
        wrap.append(block);
        if (answer) {
          const answerEl = h('div', { class: 'exp-answer', html: renderMathText(answer) });
          answerEl.hidden = true;
          const btn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Mostrar respuesta');
          btn.addEventListener('click', () => {
            answerEl.hidden = false;
            btn.remove();
          });
          wrap.append(btn, answerEl);
        }
        return wrap;
      }

      case 'quiz': {
        const wrap = h('div', { class: 'exp' });
        const questions = Array.isArray(data.questions) ? data.questions : [];
        if (!questions.length) {
          wrap.append(h('p', { class: 'exp-note' }, data.message || 'Quiz interactivo'));
          return wrap;
        }
        questions.forEach((question, qi) => {
          const options = question.options || question.answers || [];
          const correctIndex = Number.isInteger(question.correct)
            ? question.correct
            : (question.correctIndex !== undefined && question.correctIndex !== null ? Number(question.correctIndex) : -1);
          const correctValue = (question.answer !== undefined && question.answer !== null) ? String(question.answer) : null;
          const hasAnswer = correctIndex >= 0 || correctValue !== null;

          const block = h('div', { class: 'exp' });
          block.append(h('p', { class: 'exp-note' }, `${qi + 1}. ${question.q || question.question || 'Pregunta'}`));
          const hint = h('p', { class: 'exp-note' });
          options.forEach((option, oi) => {
            const isRight = hasAnswer && (correctIndex === oi || (correctValue !== null && String(option) === correctValue));
            const btn = h('button', { class: 'btn-soft btn--block', type: 'button', style: 'justify-content:flex-start;text-align:left' }, String(option));
            btn.addEventListener('click', () => {
              if (!hasAnswer) return;
              hint.textContent = isRight ? '¡Correcto! 🎉' : 'No era esa, prueba otra vez.';
              hint.style.color = isRight ? 'var(--ok)' : 'var(--danger-c)';
            });
            block.append(btn);
          });
          if (options.length) block.append(hint);
          wrap.append(block);
        });
        return wrap;
      }

      default: {
        // affirmation, curiosity, relax, challenge, coupon, memory, plan,
        // craft, plan y cualquier tipo nuevo: tarjeta de mensaje.
        // Sin título dentro: la cabecera del sheet ya lo muestra.
        const wrap = h('div', { class: 'exp' });
        wrap.append(textBlock(data.message || 'Un detalle pensado para ti.', 'exp-text'));
        if (data.pdfUrl) {
          wrap.append(h('div', { class: 'exp-actions' },
            h('a', { class: 'btn btn-secondary', href: data.pdfUrl, target: '_blank', rel: 'noopener' }, 'Abrir manualidad')
          ));
        }
        return wrap;
      }
    }
  }

  /* ==========================================
     TUS RESPUESTAS
     ========================================== */

  /** Fecha de un regalo, buscándola en el mapeo del catálogo. */
  function dateOfGiftId(giftId) {
    for (const key of Object.keys(catalog?.months || {})) {
      const mapping = catalog.months[key]?.calendarMapping || {};
      for (const day of Object.keys(mapping)) {
        const value = mapping[day];
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        if (ids.includes(giftId)) return `${key}-${pad(day)}`;
      }
    }
    return null;
  }

  /**
   * Lo que ha escrito, en orden de fecha, y lo que le queda por contestar.
   * Sin esto las respuestas se guardaban pero no se podian volver a leer:
   * solo las veía el Admin.
   */
  function openMyAnswers() {
    const preguntas = (catalog?.gifts || []).filter(hasAskBox);
    const conFecha = preguntas
      .map((gift) => ({ gift, date: dateOfGiftId(gift.id) }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    openSheet('Tus respuestas', () => {
      const body = h('div', { class: 'exp' });

      if (!preguntas.length) {
        body.append(h('p', { class: 'exp-note' },
          'Ahora mismo ningun regalo trae una pregunta. Cuando haya una, aparecerá aquí.'));
        return body;
      }

      const pendientes = conFecha.filter((e) => !responsesMap[e.gift.id]?.text);
      const contestadas = conFecha.filter((e) => responsesMap[e.gift.id]?.text);

      if (pendientes.length) {
        body.append(h('p', { class: 'exp-title' }, pendientes.length === 1
          ? 'Te queda 1 por responder'
          : `Te quedan ${pendientes.length} por responder`));
        const lista = h('ul', { class: 'exp-list' });
        for (const { gift, date } of pendientes) {
          lista.append(h('li', null,
            h('span', { class: 'exp-answers__q' }, gift.data.question),
            h('span', { class: 'exp-answers__meta' },
              `${date ? prettyDate(date) + ' · ' : ''}${gift.title || metaOf(gift.type).label}`)
          ));
        }
        body.append(lista);
      }

      if (contestadas.length) {
        body.append(h('p', { class: 'exp-title' }, `Lo que ya has escrito (${contestadas.length})`));
        const lista = h('ul', { class: 'exp-list' });
        for (const { gift, date } of contestadas) {
          const entry = responsesMap[gift.id];
          lista.append(h('li', null,
            h('span', { class: 'exp-answers__q' }, gift.data.question),
            h('span', { class: 'exp-answers__text' }, entry.text),
            h('span', { class: 'exp-answers__meta' },
              `${date ? prettyDate(date) + ' · ' : ''}${gift.title || metaOf(gift.type).label}`)
          ));
        }
        body.append(lista);
      }

      body.append(h('p', { class: 'exp-note' },
        'Para cambiar lo que escribiste, abre el regalo otra vez.'));
      body.append(h('button', {
        class: 'btn btn--block', type: 'button', onclick: () => closeSheets(),
      }, 'Cerrar'));
      return body;
    });
  }

  /**
   * Palabras que se ofrecen para empezar, sacadas de los propios datos: los
   * tipos que mas regalos tienen y el mes que esta a la vista. Sugerir lo que
   * existe de verdad es mejor que inventar una lista fija que se queda corta.
   */
  function searchSuggestions() {
    const count = {};
    for (const gift of catalog?.gifts || []) {
      const label = metaOf(gift.type).label;
      count[label] = (count[label] || 0) + 1;
    }
    const tipos = Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label]) => label.toLowerCase());
    const mes = monthLabel(view.monthKey).toLowerCase();
    return [...new Set([mes, ...tipos])];
  }

  /**
   * Buscador. Busca por titulo, tipo y contenido, en los 393 regalos.
   * Un dia bloqueado NO se abre: se dice cuando se desbloquea, para no
   * gastar la sorpresa buscándola.
   */
  function openSearch() {
    const results = h('div', { class: 'cal-search__results' });
    const resumen = h('p', { class: 'cal-search__count' });
    const suggestions = h('div', { class: 'cal-search__chips', hidden: true });
    // El campo se declara aquí y se rellena dentro del builder del sheet:
    // las sugerencias lo necesitan para rellenarlo al pulsarlas.
    let searchInput = null;

    const pintar = (query) => {
      const encontrados = query.trim().length >= 2 ? searchGifts(query) : [];
      results.replaceChildren();
      resumen.textContent = '';

      // Sin consulta no hay resultados, pero tampoco un panel mudo: se
      // ofrecen palabras que si devuelven algo.
      if (query.trim().length < 2) {
        resumen.textContent = query.trim().length
          ? 'Escribe al menos dos letras.'
          : 'Busca por título, tipo o texto, o prueba con una de estas.';
        suggestions.replaceChildren(...searchSuggestions().map((word) => h('button', {
          class: 'chip cal-search__chip', type: 'button',
          onclick: () => { searchInput.value = word; searchInput.focus(); pintar(word); },
        }, word)));
        suggestions.hidden = false;
        return;
      }
      suggestions.hidden = true;
      if (!encontrados.length) {
        resumen.textContent = `Nada con «${query.trim()}». Prueba con otra palabra.`;
        return;
      }
      const total = getSearchIndex().filter((e) => query.trim().toLowerCase().split(/\s+/)
        .filter(Boolean).every((t) => e.texto.includes(t))).length;
      resumen.textContent = total > encontrados.length
        ? `Mostrando ${encontrados.length} de ${total} coincidencias.`
        : `${encontrados.length} ${encontrados.length === 1 ? 'coincidencia' : 'coincidencias'}.`;

      for (const { gift, dateStr } of encontrados) {
        const meta = metaOf(gift.type);
        const state = dateStr ? dayState(dateStr, dayIds(dateStr)) : 'empty';
        const bloqueado = state === 'locked';
        const item = h('button', {
          class: `cal-search__item${bloqueado ? ' is-locked' : ''}`,
          type: 'button',
          onclick: () => {
            if (bloqueado) {
              const unlock = gift.unlock?.value;
              // Sin el día de la semana: "se abre el Martes 1 de diciembre"
              // suena a día de la semana en vez de fecha.
              const cuando = unlock ? prettyDate(unlock).replace(/^[^ ]+\s+/, '') : '';
              toast(cuando ? `Se abre el ${cuando} 🔒` : 'Ese regalo aún no está disponible 🔒');
              return;
            }
            // Lleva al día y abre el regalo: el buscador se cierra antes para
            // que el sheet del regalo quede por encima.
            if (dateStr) {
              selectedDay.value = dateStr;
              view.monthKey = monthKeyOf(dateStr);
              paintMonth();
              paintDay();
              page.querySelector('#calDay')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            closeSheets();
            openExperience(gift, dateStr);
          },
        },
          h('span', { class: `cal-search__art is-${toneOf(gift.type)}`, html: icon(meta.icon, 16) }),
          h('span', { class: 'cal-search__body' },
            h('b', null, gift.title || meta.label),
            h('span', { class: 'cal-search__meta' },
              `${dateStr ? prettyDate(dateStr) + ' · ' : ''}${meta.label}`),
            h('span', { class: 'cal-search__snip' }, (gift.data?.message || gift.data?.content || gift.data?.fact || '').slice(0, 90))
          ),
          bloqueado ? h('span', { class: 'cal-search__lock', html: icon('lock', 13) }) : null
        );
        results.append(item);
      }
    };

    openSheet('Buscar regalos', () => {
      const body = h('div', { class: 'cal-search' });
      const input = h('input', {
        class: 'cal-search__input', type: 'search', autocomplete: 'off',
        placeholder: 'Busca por título, tipo o texto…', 'aria-label': 'Buscar regalos',
      });
      searchInput = input;
      const wrap = h('div', { class: 'cal-search__field' },
        h('span', { class: 'cal-search__icon', html: icon('search', 16) }),
        input
      );
      body.append(wrap, resumen, suggestions, results);
      input.addEventListener('input', () => pintar(input.value));

      // Con teclado se recorre la lista sin ratón: desde el campo, la flecha
      // baja al primer resultado y de ahí salta de uno en uno. Los resultados
      // son botones, así que Enter los abre y el lector de pantalla los lee
      // como lo que son.
      body.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const items = [...results.querySelectorAll('.cal-search__item')];
        if (!items.length || !searchInput) return;
        event.preventDefault();
        const pos = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') {
          items[pos + 1 < items.length ? pos + 1 : 0].focus();
        } else if (pos <= 0) {
          // Arriba del primero se vuelve al campo, no se sale de la lista.
          searchInput.focus();
        } else {
          items[pos - 1].focus();
        }
      });

      // Se pinta al abrir para que no salga un panel vacio sin explicación.
      setTimeout(() => { input.focus(); pintar(''); }, 0);
      return body;
    });
  }

  /**
   * Cajita de respuesta. Antes era inalcanzable: solo se activaba con
   * data.question, y el unico sitio donde el Admin podia escribir una
   * pregunta era el esquema de riddle, que aqui se excluye. Ahora cualquier
   * tipo de regalo puede llevar una, y se puede volver a editar lo escrito
   * (antes el textarea se bloqueaba para siempre en cuanto enviabas).
   */
  function renderAsk(gift) {
    const question = gift?.data?.question;
    if (!hasAskBox(gift)) return null;

    const wrap = h('div', { class: 'exp exp-ask' });
    wrap.append(
      h('p', { class: 'exp-ask__q' },
        h('span', { class: 'exp-ask__icon', html: icon('mail', 15) }),
        h('span', null, question)
      )
    );

    const input = h('textarea', {
      class: 'input', rows: 3, maxlength: 1000,
      placeholder: 'Escribe aquí tu respuesta…',
    });
    const status = h('p', { class: 'exp-note exp-ask__status' });
    const send = h('button', { class: 'btn', type: 'button' }, 'Enviar respuesta');

    // Guardar el estado de "¿esta respondida?" para poder marcar la tarjeta
    // del regalo y el dia, sin tener que releer el servidor.
    let respondida = false;

    const pintarEstado = (texto) => {
      respondida = !!texto;
      send.textContent = respondida ? 'Guardar cambios' : 'Enviar respuesta';
      status.textContent = texto
        ? 'Guardada. Puedes cambiarla cuando quieras.'
        : '';
    };

    db.getMyGiftResponses()
      .then((responses) => {
        const previous = responses?.[gift.id];
        if (previous?.text) input.value = previous.text;
        pintarEstado(previous?.text);
      })
      .catch(() => {});

    send.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) {
        status.textContent = 'Escribe una respuesta antes de enviar.';
        return;
      }
      send.disabled = true;
      send.textContent = 'Enviando…';
      try {
        const saved = await db.saveGiftResponse(gift.id, text);
        setResponse(gift.id, text, { respondedAt: saved?.respondedAt });
        // La caché ya tiene la respuesta: repinta el calendario (badge,
        // tarjeta y panel del día). La hoja de la experiencia vive fuera
        // de la página, así que sigue abierta y con su propio estado.
        paintAll();
        pintarEstado(text);
        toast('Respuesta guardada 💌');
      } catch (error) {
        status.textContent = error?.message || 'No se pudo enviar. Inténtalo de nuevo.';
      } finally {
        send.disabled = false;
        send.textContent = respondida ? 'Guardar cambios' : 'Enviar respuesta';
      }
    });

    wrap.append(input, send, status);
    return wrap;
  }

  /* ==========================================
     MODO REVISIÓN (overrides locales)
     ========================================== */
  function openDevSheet() {
    const current = getCalendarOverrides();
    const modes = [
      { id: 'auto', label: 'Normal', hint: 'Los días se abren con su fecha real' },
      { id: 'all-open', label: 'Todo abierto', hint: 'Revisa el contenido sin esperar' },
      { id: 'all-locked', label: 'Todo bloqueado', hint: 'Comprueba cómo se ve antes de tiempo' }
    ];

    openSheet('Modo revisión', () => {
      const list = h('div', { class: 'exp' });
      list.append(h('p', { class: 'exp-note' }, 'Estos ajustes solo afectan a este navegador: no cambian las fechas ni la base de datos.'));

      for (const mode of modes) {
        const row = h('button', { class: 'row', type: 'button' },
          h('span', { class: 'r-ic', html: icon(mode.id === 'auto' ? 'clock' : mode.id === 'all-open' ? 'lock' : 'calendar', 19) }),
          h('span', { class: 'r-body' },
            h('b', null, mode.label),
            h('span', { class: 'r-sub' }, mode.hint)
          ),
          h('span', { class: 'r-end' }, h('span', { class: 'row-check' + (current.mode === mode.id ? ' is-done' : '') }))
        );
        row.addEventListener('click', () => {
          setCalendarOverrideMode(mode.id);
          closeSheets();
          paintAll();
          toast(`Modo revisión: ${mode.label}`);
        });
        list.append(row);
      }

      list.append(h('button', {
        class: 'btn-soft btn--block',
        type: 'button',
        onclick: () => {
          clearCalendarOverrides();
          closeSheets();
          paintAll();
          toast('Modo revisión restablecido');
        }
      }, 'Restablecer todo'));

      return list;
    });
  }

  /* ==========================================
     ARRANQUE
     ========================================== */
  // La cabecera se reconstruye al cambiar de mes/vista; delegamos para no
  // perder estas acciones en cada repintado.
  page.addEventListener('click', (event) => {
    if (event.target.closest('#calSearchBtn')) openSearch();
    else if (event.target.closest('#calAnswersBtn')) openMyAnswers();
    else if (event.target.closest('#calDevBtn')) openDevSheet();
  });

  // Atajo para llegar al buscador sin tener que ir a por el boton: Ctrl/⌘+K,
  // que es lo que ya espera cualquiera, y «/» como alternativa. Se ignoran si
  // se esta escribiendo en un campo o si ya hay un sheet abierto.
  const onShortcut = (event) => {
    const enCampo = /^(input|textarea|select)$/i.test(event.target?.tagName || '') || event.target?.isContentEditable;
    if (enCampo) return;
    const esK = event.key?.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
    if (!esK && event.key !== '/') return;
    if (document.querySelector('#overlays .overlay')) return;
    event.preventDefault();
    openSearch();
  };
  document.addEventListener('keydown', onShortcut);

  loadProgress();
  loadMyResponses().then(() => { if (pageActive) paintAll(); });

  // Un override creado antes (p. ej. como admin) no debe seguir alterando
  // el calendario en una cuenta de usuaria: se limpia al detectar que ya
  // no somos admin y había algo forzado.
  if (!userStore.isAdmin && getCalendarOverrides().mode !== 'auto') {
    clearCalendarOverrides();
  }

  paintAll();

  loadGiftsCatalog().then(data => {
    if (!pageActive) return;
    if (data) {
      catalog = data; resetAnnouncement();
      catalog.giftsById = catalog.giftsById || {};
      (catalog.gifts || []).forEach(gift => { if (gift.id) catalog.giftsById[gift.id] = gift; });
      if (!dayIds(requestedDay).length || !catalog.months?.[monthKeyOf(requestedDay)]) {
        selectedDay.value = todayISO();
        view.monthKey = monthKeyOf(selectedDay.value);
      }
    }
    // Solo saltamos a un mes con contenido si el actual está vacío
    if (catalog && !dayIds(selectedDay.value).length) {
      const next = nextDayWithContent();
      if (next) {
        selectedDay.value = next;
        view.monthKey = monthKeyOf(next);
      }
    }
    paintAll();
    openRequestedGift();
  });

  const offContent = previewAll
    ? () => {}
    : onContentChange(['gifts'], async () => {
      // El Admin cambió el catálogo: recarga limpia y repinta.
      const { invalidateGiftsCache } = await import('../services/gifts.service.js');
      invalidateGiftsCache();
      // loadGiftsCatalog puede devolver null si la carga se invalidó otra
      // vez a mitad (guardado seguido de otro). Reintentamos una vez para no
      // quedarnos con un calendario viejo.
      let data = await loadGiftsCatalog();
      if (!data) data = await loadGiftsCatalog();
      if (data) {
        catalog = data;
        resetAnnouncement();
        catalog.giftsById = catalog.giftsById || {};
        (catalog.gifts || []).forEach(gift => { if (gift.id) catalog.giftsById[gift.id] = gift; });
        // Si el día seleccionado sigue vacío tras el guardado (p. ej. se
        // añadió contenido a otro día), saltamos al primero con contenido.
        if (!dayIds(selectedDay.value).length) {
          const next = nextDayWithContent();
          if (next) {
            selectedDay.value = next;
            view.monthKey = monthKeyOf(next);
          }
        }
        paintAll();
        openRequestedGift();
      }
    });

  page.cleanup = () => {
    pageActive = false;
    stopSpotRotation();
    document.removeEventListener('keydown', onShortcut);
    try { offContent(); } catch { /* noop */ }
    closeSheets();
  };

  return page;
}
