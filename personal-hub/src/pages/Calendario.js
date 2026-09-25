/* ==========================================
   Calendario — sorpresas día a día
   Reconstruido sobre el sistema de diseño nuevo
   (tarjeta de mes + agenda del día + bottom sheet).

   Se conserva el contrato de datos completo:
     · catálogo (Supabase → /data/gifts.json) con months.calendarMapping
     · 20+ tipos de experiencia con su `data`
     · progreso local por usuario (misma clave que antes)
     · overrides locales para revisar el calendario sin tocar fechas
     · respuestas de la usuaria (db.saveGiftResponse)
   ========================================== */

import {
  h, icon, emptyState, openSheet, closeSheets, toast
} from '../components/ui.js';
import { buildVideoPlayer } from '../components/MediaLightbox.js';
import { loadGiftsCatalog } from '../services/gifts.service.js';
import { db } from '../services/db.service.js';
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
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
  offline:     { icon: 'external', label: 'Reto real' },
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
  surprise: 'amber', offline: 'green', craft: 'amber', giftBox: 'rose',
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

function loadProgress() {
  try { progressMap = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}'); } catch { progressMap = {}; }
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY(), JSON.stringify(progressMap)); } catch { /* cuota llena */ }
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
  if (override === 'open') {
    if (allOpened(ids)) return 'opened';
    return dateStr === todayISO() ? 'today' : 'open';
  }

  // Bloqueado por fecha: se comprueba antes de "opened" para que los días
  // futuros abiertos con versiones antiguas vuelvan a bloquearse.
  const today = todayISO();
  const anyUnlocked = ids.some(id => {
    const unlock = giftOf(id)?.unlock?.value;
    return !unlock || today >= unlock;
  });
  if (!anyUnlocked) return 'locked';

  if (allOpened(ids)) return 'opened';
  return dateStr === today ? 'today' : 'open';
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

function countdownText(dateStr) {
  const today = todayISO();
  if (!dateStr) return 'Sin sorpresas programadas';
  if (dateStr === today) return '¡Hoy hay sorpresa!';
  const diff = Math.round((new Date(`${dateStr}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  if (diff === 1) return 'Mañana llega una sorpresa';
  return `Próxima sorpresa en ${diff} días`;
}

/* ==========================================
   PÁGINA
   ========================================== */
export function CalendarioPage(router) {
  const page = document.createElement('div');
  page.className = 'calendario-page';

  const previewAll = new URLSearchParams(location.search).get('previewGifts') === '1';
  const selectedDay = { value: todayISO() };
  const view = { monthKey: monthKeyOf(todayISO()) };

  // Rotación del regalo destacado: si el día tiene varios, van pasando
  // solos. `index` es la posición dentro de los regalos del día en curso.
  const SPOT_ROTATE_MS = 5000;
  const spotRot = { date: null, index: 0, timer: null };
  function stopSpotRotation() {
    if (spotRot.timer) {
      clearInterval(spotRot.timer);
      spotRot.timer = null;
    }
  }

  page.innerHTML = `
    ${renderHead()}
    <div id="calSpot"></div>
    <div id="calMonth"></div>
    <section id="calDay" aria-live="polite"></section>
  `;

  function renderHead() {
    return `
      <div class="scr-head">
        <div>
          <h1 class="scr-title">Calendario</h1>
          <p class="sub">Un regalo cada día, pensado para ti</p>
        </div>
        <div class="head-actions">
          <button type="button" class="icon-btn" id="calDevBtn" aria-label="Modo revisión" title="Modo revisión">${icon('gear', 19)}</button>
        </div>
      </div>
    `;
  }

  /* ===== CABECERA DE MES ===== */
  function paintMonth() {
    const host = page.querySelector('#calMonth');
    if (!host) return;

    const months = Object.keys(catalog?.months || {}).sort();
    if (!months.length) {
      host.innerHTML = '';
      return;
    }
    if (!months.includes(view.monthKey)) {
      const past = months.filter(m => m <= monthKeyOf(todayISO()));
      view.monthKey = past.length ? past[past.length - 1] : months[0];
    }

    const [year, month] = view.monthKey.split('-').map(Number);
    const total = daysInMonth(year, month);
    const offset = mondayIndex(year, month, 1);
    const today = todayISO();
    const selected = selectedDay.value;

    // Nº de regalos por día (para el punto que indica "hay algo aquí").
    const counts = {};
    for (let day = 1; day <= total; day++) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const ids = dayIds(dateStr);
      if (!ids.length) continue;
      counts[dateStr] = ids.length;
    }

    const cells = [];
    const prevMonthTotal = daysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
    for (let i = offset - 1; i >= 0; i--) {
      cells.push(`<span class="cal-day is-dim is-empty" aria-hidden="true">${prevMonthTotal - i}</span>`);
    }
    for (let day = 1; day <= total; day++) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const ids = dayIds(dateStr);
      const state = dayState(dateStr, ids);
      const classes = ['cal-day'];
      if (state === 'empty') classes.push('is-empty');
      if (state === 'locked') classes.push('is-locked');
      if (state === 'opened') classes.push('is-opened');
      if (dateStr === today) classes.push('is-today');
      if (dateStr === selected) classes.push('is-sel');

      // Bloqueado: candado pequeño. Abierto: check. Pendiente: punto de
      // color que indica que ese día hay regalo esperando.
      const count = counts[dateStr] || 0;
      const mark = state === 'opened' ? `<span class="cal-day__ok" aria-hidden="true">${icon('check', 11)}</span>`
        : state === 'locked' ? `<span class="cal-day__lock" aria-hidden="true">${icon('lock', 10)}</span>`
        : count > 0 ? `<span class="cal-day__dot" aria-hidden="true"></span>` : '';

      const label = state === 'empty' ? `${day} — sin regalo`
        : state === 'locked' ? `${day} — sorpresa por llegar`
        : state === 'opened' ? `${day} — regalo abierto`
        : `${day} — ${count} ${count === 1 ? 'regalo' : 'regalos'}`;
      cells.push(`<button type="button" class="${classes.join(' ')}" data-day="${day}" aria-label="${escapeHtml(label)}" aria-pressed="${dateStr === selected}"><span class="cal-day__n">${day}</span>${mark}</button>`);
    }
    while (cells.length % 7 !== 0) cells.push('<span class="cal-day is-dim is-empty" aria-hidden="true"></span>');

    const [vy, vm] = view.monthKey.split('-').map(Number);
    let mTotal = 0, mOpened = 0;
    for (let day = 1; day <= daysInMonth(vy, vm); day++) {
      const ids = dayIds(`${vy}-${pad(vm)}-${pad(day)}`);
      if (!ids.length) continue;
      mTotal++;
      if (allOpened(ids)) mOpened++;
    }

    // Progreso global real: cada regalo abierto cuenta (no cada día).
    const global = overallProgress();
    const pct = global.total ? Math.round((global.opened / global.total) * 100) : 0;

    host.innerHTML = `
      <div class="cal">
        <div class="cal-head">
          <div>
            <b>${escapeHtml(monthLabel(view.monthKey))}</b>
            <span class="cal-head__sub">${mTotal ? `${mOpened} de ${mTotal} ${mTotal === 1 ? 'regalo abierto' : 'regalos abiertos'}` : 'Sin regalos este mes'}</span>
          </div>
          <div class="cal-nav">
            <button type="button" class="icon-btn" data-month="-1" aria-label="Mes anterior">${icon('back', 18)}</button>
            <button type="button" class="cal-today-btn" data-today>Hoy</button>
            <button type="button" class="icon-btn" data-month="1" aria-label="Mes siguiente">${icon('chev', 18)}</button>
          </div>
        </div>
        <div class="cal-grid">
          ${WEEKDAYS.map(w => `<span class="wd">${w}</span>`).join('')}
          ${cells.join('')}
        </div>
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

    host.querySelectorAll('.cal-day[data-day]').forEach(cell => {
      cell.addEventListener('click', () => {
        const day = Number(cell.dataset.day);
        selectedDay.value = `${year}-${pad(month)}-${pad(day)}`;
        paintMonth();
        paintDay();
      });
    });
    host.querySelectorAll('[data-month]').forEach(btn => {
      btn.addEventListener('click', () => shiftMonth(Number(btn.dataset.month)));
    });
    const todayBtn = host.querySelector('[data-today]');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        selectedDay.value = todayISO();
        view.monthKey = monthKeyOf(todayISO());
        paintMonth();
        paintDay();
      });
    }
  }

  function shiftMonth(delta) {
    const months = Object.keys(catalog?.months || {}).sort();
    if (!months.length) return;
    const index = months.indexOf(view.monthKey);
    const next = months[Math.min(months.length - 1, Math.max(0, (index === -1 ? 0 : index) + delta))];
    if (next === view.monthKey) return;
    view.monthKey = next;
    paintMonth();
  }

  /* ===== REGALO DESTACADO ===== */
  function paintSpot() {
    const host = page.querySelector('#calSpot');
    if (!host) return;

    stopSpotRotation();

    const today = todayISO();
    const todayIds = dayIds(today);
    // nextDayWithContent puede devolver null mientras el catálogo aún no ha
    // llegado: en ese caso nos quedamos en hoy y se repinta al cargar.
    const next = todayIds.length ? today : (nextDayWithContent(today) || today);
    const nextIds = dayIds(next);
    const state = dayState(next, nextIds);

    if (!nextIds.length) {
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

    // El regalo destacado es el primero del día que aún no se ha abierto;
    // si están todos abiertos, el último para volver a verlo.
    // El destacado rota entre los regalos del día. Al repintar (p. ej. tras
    // abrir uno) se conserva la posición; solo se reinicia si cambia el día
    // o el índice quedó fuera de rango.
    if (spotRot.date !== next || spotRot.index >= nextIds.length) {
      spotRot.date = next;
      // Empezamos por el primer regalo pendiente; si están todos abiertos, 0.
      spotRot.index = Math.max(0, nextIds.findIndex(id => !progressMap[id]?.opened));
    }
    const focusId = nextIds[spotRot.index];
    const gift = giftOf(focusId) || giftOf(nextIds[0]);
    const meta = metaOf(gift?.type);
    const isOpen = !!progressMap[focusId]?.opened;
    const when = next === today ? 'Tu regalo de hoy' : countdownText(next);

    const art = `<div class="cal-spot__art cal-spot__art--tone is-${toneOf(gift?.type)}">${icon(meta.icon, 30)}</div>`;

    const dots = nextIds.length > 1
      ? `<span class="cal-spot__dots">
          ${nextIds.map((id, i) => `<button type="button" class="cal-spot__dot${i === spotRot.index ? ' is-on' : ''}" data-dot="${i}" aria-label="Regalo ${i + 1} de ${nextIds.length}"></button>`).join('')}
        </span>`
      : '';

    host.innerHTML = `
      <article class="cal-spot${isOpen ? ' is-open' : ''}">
        <button type="button" class="cal-spot__hit" data-gift="${escapeHtml(focusId)}" aria-label="${escapeHtml(`Abrir ${gift?.title || meta.label}`)}"></button>
        ${art}
        <div class="cal-spot__body">
          <span class="cal-spot__when">${escapeHtml(when)}</span>
          <b class="cal-spot__title">${escapeHtml(gift?.title || meta.label)}</b>
          <span class="cal-spot__type">${escapeHtml(meta.label)}${nextIds.length > 1 ? ` · ${spotRot.index + 1} de ${nextIds.length}` : ''}</span>
          ${dots}
        </div>
        <span class="cal-spot__go">${isOpen ? 'Ver' : 'Abrir'} ${icon('chev', 16)}</span>
      </article>
    `;

    const hit = host.querySelector('[data-gift]');
    if (hit) hit.addEventListener('click', () => openExperience(gift, next));

    host.querySelectorAll('[data-dot]').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        spotRot.index = Number(dot.dataset.dot);
        paintSpot(); // repinta y reinicia el temporizador
      });
    });

    // Rotación automática: pasa al siguiente regalo cada 5s (si hay varios).
    if (nextIds.length > 1) {
      spotRot.timer = setInterval(() => {
        if (document.hidden) return; // pestaña en segundo plano: no gasta
        spotRot.index = (spotRot.index + 1) % nextIds.length;
        paintSpot();
      }, SPOT_ROTATE_MS);
    }
  }

  /* ===== REGALOS DEL DÍA ===== */
  function paintDay() {
    const host = page.querySelector('#calDay');
    if (!host) return;

    const dateStr = selectedDay.value;
    const ids = dayIds(dateStr);
    const state = dayState(dateStr, ids);
    const isToday = dateStr === todayISO();

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

    const openedCount = ids.filter(id => progressMap[id]?.opened).length;
    const dayPct = Math.round((openedCount / ids.length) * 100);
    host.innerHTML = `
      <p class="section-title">${escapeHtml(prettyDate(dateStr))}
        <span class="section-title__aside">${openedCount === ids.length ? 'Todo abierto ✓' : `${openedCount} de ${ids.length}`}</span>
      </p>
      <div class="cal-dayprogress${openedCount === ids.length ? ' is-done' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${ids.length}" aria-valuenow="${openedCount}">
        <div class="cal-dayprogress__bar"><span style="width:${dayPct}%"></span></div>
      </div>
    `;

    const grid = h('div', { class: `cal-gifts${isToday ? ' is-today' : ''}` });
    for (const id of ids) {
      const gift = giftOf(id);
      if (!gift) continue;
      const meta = metaOf(gift.type);
      const isOpen = !!progressMap[id]?.opened;
      const tone = toneOf(gift.type);
      const caption = gift.data?.caption || gift.data?.message || '';

      const card = h('button', {
        class: `cal-gift${isOpen ? ' is-open' : ''}`,
        type: 'button',
        'aria-label': `${gift.title || meta.label}${isOpen ? ', ya abierto' : ''}`,
        onclick: () => openExperience(gift, dateStr)
      },
        h('div', { class: 'cal-gift__media' },
          h('div', { class: `cal-gift__art cal-gift__art--tone is-${tone}` }, h('span', { html: icon(meta.icon, 30) })),
          h('span', { class: 'cal-gift__tag' }, meta.label),
          isOpen ? h('span', { class: 'cal-gift__ok', html: icon('check', 13) }) : null
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

  function paintAll() {
    paintSpot();
    paintMonth();
    paintDay();
  }

  /* ==========================================
     EXPERIENCIAS
     ========================================== */
  function openExperience(gift, dateStr) {
    const meta = metaOf(gift.type);
    const wasOpened = !!progressMap[gift.id]?.opened;

    openSheet(gift.title || meta.label, () => {
      const body = document.createElement('div');
      body.className = 'exp';

      const content = renderContent(gift);
      if (content) body.append(content);

      const ask = renderAsk(gift);
      if (ask) body.append(ask);

      body.append(h('button', {
        class: 'btn btn--block',
        type: 'button',
        onclick: () => { closeSheets(); }
      }, 'Cerrar'));

      return body;
    });

    markGiftSeen(gift.id, wasOpened);
  }

  /** Marca solo el regalo abierto como visto (cada regalo es independiente). */
  function markGiftSeen(giftId, alreadySeen) {
    if (!progressMap[giftId]?.opened) {
      progressMap[giftId] = { opened: true, openedAt: new Date().toISOString() };
      saveProgress();
    }
    paintAll();

    if (!alreadySeen) {
      toast('Regalo visto ✨', {
        label: 'Deshacer',
        fn: () => {
          delete progressMap[giftId];
          saveProgress();
          paintAll();
        }
      });
    }
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
        // offline, craft y cualquier tipo nuevo: tarjeta de mensaje.
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

  /** Cajita de respuesta (si la sorpresa plantea una pregunta). */
  function renderAsk(gift) {
    const question = gift?.data?.question;
    if (!question || gift.type === 'riddle' || gift.type === 'math') return null;

    const wrap = h('div', { class: 'exp' });
    wrap.append(h('p', { class: 'exp-note' }, question));

    const input = h('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: 'Escribe aquí tu respuesta…' });
    const status = h('p', { class: 'exp-note' });
    const send = h('button', { class: 'btn', type: 'button' }, 'Enviar respuesta');

    const disable = (text) => {
      input.disabled = true;
      send.disabled = true;
      send.textContent = 'Respondida ❤';
      status.textContent = text;
    };

    db.getMyGiftResponses()
      .then(responses => {
        const previous = responses?.[gift.id];
        if (previous?.text) {
          input.value = previous.text;
          disable('Ya respondiste a esta sorpresa. Gracias 💌');
        }
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
        await db.saveGiftResponse(gift.id, text);
        disable('¡Enviada! Gracias 💌');
        toast('Respuesta enviada 💌');
      } catch (error) {
        send.disabled = false;
        send.textContent = 'Enviar respuesta';
        status.textContent = error?.message || 'No se pudo enviar. Inténtalo de nuevo.';
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
  const devBtn = page.querySelector('#calDevBtn');
  if (devBtn) devBtn.addEventListener('click', openDevSheet);

  loadProgress();
  paintAll();

  loadGiftsCatalog().then(data => {
    if (data) {
      catalog = data;
      catalog.giftsById = catalog.giftsById || {};
      (catalog.gifts || []).forEach(gift => { if (gift.id) catalog.giftsById[gift.id] = gift; });
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
  });

  const offContent = previewAll
    ? () => {}
    : onContentChange(['gifts'], async () => {
      // El Admin cambió el catálogo: recarga limpia y repinta.
      const { invalidateGiftsCache } = await import('../services/gifts.service.js');
      invalidateGiftsCache();
      const data = await loadGiftsCatalog();
      if (data) {
        catalog = data;
        catalog.giftsById = catalog.giftsById || {};
        (catalog.gifts || []).forEach(gift => { if (gift.id) catalog.giftsById[gift.id] = gift; });
        paintAll();
      }
    });

  page.cleanup = () => {
    stopSpotRotation();
    try { offContent(); } catch { /* noop */ }
    closeSheets();
  };

  return page;
}
