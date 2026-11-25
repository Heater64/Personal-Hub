/* ==========================================
   SENTIMIENTOS — el ánimo de hoy, la semana y los accesos

   Dos pantallas comparten este módulo y la misma fuente de datos:

   · Sentimientos: cabecera, registro del ánimo de hoy, cifras plegadas,
     tarjeta compacta «Nuestro ánimo» (últimos siete días, Peluche o
     Princesa) y los accesos con sus ilustraciones SVG.
   · Historial emocional: el calendario mensual completo, con selector de
     persona, navegación de meses, leyenda y detalle del día. Vive aparte
     del calendario de planes, fechas y regalos.

   Cada registro guarda una sola emoción o varias. Los atajos van en la
   rejilla y el resto (más la que ella escriba) en el desplegable «Otras».
   Cada cambio se guarda solo, con la misma ventana de 5 minutos del modelo
   de estados.
   ========================================== */

import '../styles/sentimientos.css';
import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { skeletonHTML } from '../components/states.js';
import { bestStreak, lastNDays } from '../utils/pro-insights.js';
import { saveStreakWidget } from '../services/widgets.service.js';
import { icon, toast, openSheet } from '../components/ui.js';
import { escapeHtml } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import { supabase } from '../services/supabase.js';
import { fetchPartnerPresence } from '../services/presence.service.js';
import {
  MAX_CUSTOM_LABEL,
  encodeMood,
  makeCustomMood,
  toggleMoodSelection,
} from '../data/moods.data.js';

// Ilustraciones propias de Sentimientos (SVG, sin fondo).
const ART = '/assets/icons/sentimientos';

// Los accesos de Sentimientos, en el orden en que se leen.
const CARDS = [
  {
    id: 'razones',
    art: 'razones',
    title: 'Razones',
    desc: 'Una razón nueva para quererte',
    href: '/razones',
  },
  {
    id: 'maldia',
    art: 'mal-dia',
    title: 'Mal Día',
    desc: 'Lo que nos ha afectado y cómo nos sentimos',
    href: '/maldia',
  },
  {
    id: 'openwhen',
    art: 'open-when',
    title: 'Open When',
    desc: 'Cartas para cuando las necesites',
    href: '/openwhen',
  },
  {
    id: 'calendario',
    art: 'calendario',
    title: 'Calendario',
    desc: 'Planes, fechas y regalos recibidos en un solo sitio',
    href: '/calendario',
  },
  {
    id: 'menstruacion',
    art: 'menstruacion',
    title: 'Menstruación',
    desc: 'Tu ciclo, con tus datos y tus reglas',
    href: '/menstruacion',
  },
  {
    id: 'sorpresas',
    art: 'mis-sorpresas',
    title: 'Mis sorpresas',
    desc: 'Ideas y regalos que solo tú puedes ver',
    href: '/sorpresas',
  },
];

const HIST_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// La semana empieza en lunes (como el resto de calendarios de la app)
const HIST_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
// Inicial del día de la semana con getDay() (domingo = 0).
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const pad2 = n => String(n).padStart(2, '0');

// ==========================================
// HISTORIAL — una sola fuente para la semana y el mes
// date → estado COMPLETO ({ mood, label, emoji, score }), no solo el id: así
// los días registrados con el catálogo anterior se siguen viendo tal cual se
// pusieron, aunque ya no exista ese id en el catálogo actual.
// Se siembra con el historial local y se completa con Supabase (una consulta)
// para que lo que se ve sea lo real también en otro dispositivo.
// ==========================================
function createHistoryState(todayMood) {
  const state = { historyMap: {}, rowsByDate: {}, localMap: {} };
  for (const entry of moodStore.getHistory() || []) {
    if (!entry?.date || !entry.moodId) continue;
    const stored = {
      mood: entry.moodId,
      label: entry.label,
      emoji: entry.emoji,
      score: entry.score,
    };
    state.localMap[entry.date] = stored;
    state.historyMap[entry.date] = stored;
    state.rowsByDate[entry.date] = [{ ...stored }];
  }
  if (todayMood?.id) {
    const stored = encodeMood(todayMood.items);
    if (stored) {
      state.historyMap[todayISO()] = stored;
      state.localMap[todayISO()] = stored;
    }
  }
  return state;
}

/** Fila remota → estado que se pinta (fiel a lo que se guardó ese día). */
function rowToEntry(row) {
  return {
    mood: row.mood,
    label: row.label,
    emoji: row.emoji,
    score: row.score,
  };
}

/**
 * Añade las filas del servidor encima de lo local. Vienen de la más reciente
 * a la más antigua: la primera fila de cada día es la vigente.
 */
function mergeRemoteRows(state, rows) {
  const { historyMap, rowsByDate } = state;
  const remoteDates = new Set();
  for (const row of rows || []) {
    if (row?.date && row.mood) (rowsByDate[row.date] ||= []).push(row);
    if (!row?.date || !row.mood || remoteDates.has(row.date)) continue;
    remoteDates.add(row.date);
    historyMap[row.date] = rowToEntry(row);
  }
}

/**
 * Historial completo de una persona: local primero, después el servidor.
 * Devuelve `false` si la consulta falló, para poder reintentar (y para no
 * pisar con un vacío lo que ya se estaba mostrando).
 */
async function fetchHistory(state, ownerId, selfId) {
  let rows;
  try {
    rows = (await moodStore.getMoodHistory(ownerId, '2000-01-01', todayISO(), { strict: true })) || [];
  } catch {
    return false;
  }
  for (const date of Object.keys(state.historyMap)) delete state.historyMap[date];
  for (const date of Object.keys(state.rowsByDate)) delete state.rowsByDate[date];
  if (ownerId === selfId) {
    Object.assign(state.historyMap, state.localMap);
    for (const [date, entry] of Object.entries(state.localMap)) {
      state.rowsByDate[date] = [{ ...entry }];
    }
  }
  mergeRemoteRows(state, rows);
  return true;
}

/** Cifras del historial: los mismos cálculos para la tarjeta y el historial. */
function computeStats(historyMap) {
  const dates = Object.keys(historyMap);
  const thisMonth = todayISO().slice(0, 7);

  // Racha: cuenta desde hoy y, si hoy todavía no hay estado, sigue desde
  // ayer (si no, saltaría a 0 cada mañana hasta que se marcara el día).
  let streak = 0;
  const cursor = new Date();
  if (!historyMap[todayISO(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (historyMap[todayISO(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Cada emoción marcada cuenta: un día con «Triste + Cansada» suma uno a
  // cada una, no uno a un estado combinado que no existe en el catálogo.
  const counts = {};
  dates.forEach(date => {
    const ids = moodStore.resolveMood(historyMap[date])?.ids || [];
    ids.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalDays: dates.length,
    daysThisMonth: dates.filter(date => date.startsWith(thisMonth)).length,
    streak,
    // «Mejor racha» y la tira de la quincena: mismo historial, otra lectura.
    best: bestStreak(historyMap),
    recent: lastNDays(historyMap, 14, todayISO()),
    mostCommon: top ? moodStore.resolveMood({ mood: top[0] }) : null,
  };
}

/**
 * Calendario de un mes, con sus emociones resueltas desde la fila guardada
 * (no desde el catálogo actual). Devuelve el marcado, la leyenda y el número
 * de días con registro para que cada pantalla decida qué enseñar.
 */
function monthCalendar(state, month) {
  const { historyMap } = state;
  const year = month.getFullYear();
  const monthIndex = month.getMonth() + 1;
  const monthKey = `${year}-${pad2(monthIndex)}`;
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const todayStr = todayISO();
  const monthEntries = Object.keys(historyMap).filter(date => date.startsWith(monthKey));
  const firstWeekday = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7; // lunes = 0

  let cells = '';
  for (let i = 0; i < firstWeekday; i++)
    cells += '<span class="sent-hist-cell is-offset" aria-hidden="true"></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthKey}-${pad2(day)}`;
    const mood = historyMap[dateStr] ? moodStore.resolveMood(historyMap[dateStr]) : null;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    cells += `
      <button type="button" class="sent-hist-cell${mood ? ' has-mood is-openable' : ''}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}"
           data-history-date="${dateStr}" ${mood ? `title="${escapeHtml(mood.label)}" aria-label="${escapeHtml(`${day} de ${HIST_MONTHS[monthIndex - 1]} · ${mood.label}`)}"` : 'disabled aria-hidden="true"'}>
        <span class="sent-hist-day">${day}</span>
        ${mood ? `<span class="sent-hist-emoji" aria-hidden="true">${escapeHtml(mood.emoji)}</span>` : ''}
      </button>`;
  }

  // Una entrada por emoción DISTINTA del mes, con la etiqueta real: la de
  // «Otras» es la que escribió ella, no la palabra «Otras».
  const present = new Map();
  for (const date of monthEntries) {
    const resolved = moodStore.resolveMood(historyMap[date]);
    for (const item of resolved?.items || []) {
      if (!present.has(item.id)) present.set(item.id, item);
    }
  }

  return {
    label: `${HIST_MONTHS[monthIndex - 1]} ${year}`,
    count: monthEntries.length,
    legend: [...present.values()],
    html: `
      <div class="sent-hist-grid">
        ${HIST_WEEKDAYS.map(day => `<span class="sent-hist-hd">${day}</span>`).join('')}
        ${cells}
      </div>
      ${monthEntries.length ? '' : `<p class="sent-hist-empty">Aún no hay ánimos este mes.<br><small>Cada día que lo cuentas queda guardado aquí.</small></p>`}
    `,
  };
}

/** Detalle de un día: cada estado con su hora, como quedó guardado. */
function openMoodDay(state, date, ownerLabel) {
  const rows = [...(state.rowsByDate[date] || [])].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  );
  const dayDate = new Date(`${date}T12:00:00`);
  const dateLabel = dayDate.toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const entries = rows.map(row => {
    const mood = moodStore.resolveMood({
      mood: row.mood,
      label: row.label,
      emoji: row.emoji,
      score: row.score,
    });
    const at = row.created_at ? new Date(row.created_at) : null;
    const time = at && !Number.isNaN(at.getTime())
      ? at.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<li class="sent-mood-change">
      <span class="sent-mood-change-emoji" aria-hidden="true">${escapeHtml(mood?.emoji || '💭')}</span>
      <span class="sent-mood-change-label">${escapeHtml(mood?.label || 'Estado de ánimo')}</span>
      ${time ? `<time class="sent-mood-change-time" datetime="${escapeHtml(row.created_at)}">${time}</time>` : ''}
    </li>`;
  }).join('');
  openSheet(`Ánimo de ${ownerLabel}`, sheet => {
    const body = document.createElement('div');
    body.className = 'sent-mood-day-detail';
    body.innerHTML = `<p class="sent-mood-day-date">${escapeHtml(dateLabel)}</p>
      ${rows.length ? `<p class="sent-mood-day-summary">${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}</p>` : ''}
      ${rows.length ? `<ol class="sent-mood-change-list">${entries}</ol>` : '<p class="sent-mood-day-empty">Ese día no tiene registros disponibles en este dispositivo.</p>'}`;
    sheet.append(body);
    return null;
  });
}

// ==========================================
// PAREJA — quién es la otra cuenta
// ==========================================
async function resolvePartnerId(selfId) {
  let partnerId = null;
  try {
    if (selfId && supabase) {
      const { data: membership } = await supabase.from('couple_members')
        .select('couple_id').eq('user_id', selfId).maybeSingle();
      if (membership?.couple_id) {
        const { data: members } = await supabase.from('couple_members')
          .select('user_id').eq('couple_id', membership.couple_id).neq('user_id', selfId).limit(1);
        partnerId = members?.[0]?.user_id || null;
      }
    }
  } catch { /* intenta la identidad heredada de presencia */ }
  if (!partnerId) partnerId = (await fetchPartnerPresence())?.userId || null;
  return partnerId;
}

// ==========================================
// PANTALLA · SENTIMIENTOS
// ==========================================
export function SentimientosPage(router) {
  const page = document.createElement('div');
  page.className = 'sentimientos-page';

  const quickMoods = moodStore.getQuickMoods();
  const paletteMoods = moodStore.getPaletteMoods();
  const customMood = moodStore.getCustomMood();
  const quickIds = new Set(quickMoods.map(m => m.id));

  let todayMood = moodStore.getTodayMood();
  let selection = todayMood ? todayMood.items.map(item => ({ ...item })) : [];

  const selfUser = userStore.getUser();
  const selfId = selfUser?.id || null;
  const selfLabel = userStore.isAdmin ? 'Peluche' : 'Princesa';
  const partnerLabel = userStore.isAdmin ? 'Princesa' : 'Peluche';
  let partnerId = null;
  // idle → loading → ready | error. Desde «error», tocar el botón reintenta.
  let partnerStatus = 'idle';
  let weekPerson = 'self';

  const selfHistory = createHistoryState(todayMood);
  const partnerHistory = createHistoryState(null);

  page.innerHTML = `
    ${renderPageHeader({ title: 'Sentimientos', subtitle: 'Cómo estamos y qué nos hace bien' })}

    <!-- ===== ÁNIMO DE HOY ===== -->
    <section class="card sent-mood" aria-labelledby="sentMoodTitle">
      <div class="sent-mood-head">
        <h2 class="sent-mood-title" id="sentMoodTitle">¿Cómo te sientes hoy?</h2>
        <span class="sent-mood-saved" id="moodSaved" hidden></span>
      </div>
      <div class="sent-mood-grid" id="moodGrid" role="group" aria-label="Elige cómo te sientes hoy. Puedes marcar varias emociones">
        ${quickMoods
          .map(
            m => `
          <button type="button" class="sent-mood-btn" data-mood="${m.id}" aria-pressed="false">
            <span class="sent-mood-emoji" aria-hidden="true">${m.emoji}</span>
            <span class="sent-mood-label">${m.label}</span>
          </button>
        `
          )
          .join('')}
        <button type="button" class="sent-mood-btn sent-mood-btn--more" id="moodMoreBtn" aria-expanded="false" aria-controls="moodExtra">
          <span class="sent-mood-emoji" aria-hidden="true">${customMood.emoji}</span>
          <span class="sent-mood-label">Otras</span>
          <span class="sent-mood-more-count" id="moodExtraCount" hidden></span>
        </button>
      </div>

      <div class="sent-mood-extra" id="moodExtra" hidden>
        <div class="sent-mood-extra-head">
          <span class="sent-mood-extra-title">Más emociones</span>
          <small class="sent-mood-extra-hint">Puedes marcar varias · toca otra vez para quitar</small>
        </div>
        <div class="sent-mood-palette" id="moodPalette">
          ${paletteMoods
            .map(
              m => `
            <button type="button" class="sent-mood-chip" data-mood="${m.id}" aria-pressed="false">
              <span class="sent-mood-chip-emoji" aria-hidden="true">${m.emoji}</span>
              <span class="sent-mood-chip-label">${m.label}</span>
              <span class="sent-mood-chip-check" aria-hidden="true">✓</span>
            </button>
          `
            )
            .join('')}
        </div>
        <form class="sent-mood-custom" id="moodCustomForm">
          <input
            type="text"
            id="moodCustomInput"
            class="sent-mood-custom-input"
            maxlength="${MAX_CUSTOM_LABEL}"
            placeholder="¿No está? Escríbela tú…"
            aria-label="Escribe tú la emoción"
            autocomplete="off"
          >
          <button type="submit" class="sent-mood-custom-add">Añadir</button>
        </form>
        <div class="sent-mood-custom-chips" id="moodCustomChips"></div>
      </div>

      <p class="sent-mood-feedback" id="moodFeedback" hidden>
        <span class="sent-mood-feedback-icon" aria-hidden="true"></span>
        <span class="sent-mood-feedback-text"></span>
      </p>
    </section>

    <button type="button" class="sent-stats-toggle" id="sentStatsToggle" aria-expanded="false" aria-controls="sentStats">
      <span class="sent-stats-toggle-text">Más información</span>
      <span class="sent-stats-toggle-chev" aria-hidden="true">${icon('chev', 16)}</span>
    </button>
    <div class="sent-stats" id="sentStats" hidden></div>

    <!-- ===== NUESTRO ÁNIMO · últimos siete días ===== -->
    <section class="card sent-week" aria-labelledby="sentWeekTitle">
      <div class="sent-week-head">
        <div class="sent-week-copy">
          <h2 class="sent-week-title" id="sentWeekTitle">Nuestro ánimo</h2>
          <p class="sent-week-sub" id="sentWeekSub">Últimos siete días</p>
        </div>
        <div class="sent-week-people" role="group" aria-label="Ver el ánimo de">
          <button type="button" class="sent-week-person is-active" data-week-person="self" aria-pressed="true">${selfLabel}</button>
          <button type="button" class="sent-week-person" data-week-person="partner" aria-pressed="false">${partnerLabel}</button>
        </div>
      </div>
      <ul class="sent-week-days" id="sentWeekDays"></ul>
      <button type="button" class="sent-week-link" data-href="/sentimientos/historial">
        <span class="sent-week-link-text">Historial emocional completo</span>
        <span class="sent-week-link-chev" aria-hidden="true">${icon('chev', 16)}</span>
      </button>
    </section>

    <!-- ===== ACCESOS ===== -->
    <div class="sent-cards-grid">
      ${CARDS.map(
        card => `
        <button type="button" class="sent-card lift" data-href="${card.href}">
          <span class="sent-card-cover">
            <img class="sent-card-art" src="${ART}/${card.art}.svg" alt="" width="56" height="56" loading="lazy" decoding="async">
          </span>
          <span class="sent-card-body">
            <span class="sent-card-title">${card.title}</span>
            <span class="sent-card-desc">${
              card.id === 'menstruacion' && userStore.isAdmin
                ? 'Lo que ella comparte contigo'
                : card.desc
            }</span>
          </span>
          <span class="sent-card-chev" aria-hidden="true">${icon('chev', 18)}</span>
        </button>`
      ).join('')}
    </div>
  `;

  const moreBtn = page.querySelector('#moodMoreBtn');
  const extraPanel = page.querySelector('#moodExtra');
  const customInput = page.querySelector('#moodCustomInput');
  const customForm = page.querySelector('#moodCustomForm');
  const statsToggle = page.querySelector('#sentStatsToggle');
  // Las cifras arrancan plegadas: lo importante de esta pantalla es el ánimo
  // de hoy, no una fila de números. Se abren solo si el usuario las pide.
  let statsOpen = false;

  // ==========================================
  // SELECCIÓN — atajos y desplegable comparten estado
  // ==========================================
  function paintSelection() {
    page.querySelectorAll('[data-mood]').forEach(btn => {
      const active = selection.some(item => item.id === btn.dataset.mood);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    // El botón «Otras» se marca cuando hay algo elegido que no es un atajo.
    const extras = selection.filter(item => !quickIds.has(item.id));
    moreBtn.classList.toggle('is-active', extras.length > 0);
    const countEl = page.querySelector('#moodExtraCount');
    if (countEl) {
      countEl.hidden = extras.length === 0;
      countEl.textContent = extras.length > 1 ? String(extras.length) : '';
    }

    const customChips = page.querySelector('#moodCustomChips');
    const customItem = selection.find(item => item.id === customMood.id);
    customChips.innerHTML = customItem
      ? `<button type="button" class="sent-mood-custom-chip" data-custom-remove aria-label="Quitar «${escapeHtml(customItem.label)}»">
          <span aria-hidden="true">${customItem.emoji}</span>${escapeHtml(customItem.label)}
          <span class="sent-mood-custom-chip-x" aria-hidden="true">×</span>
        </button>`
      : '';
    page.querySelector('.sent-mood-custom-add').textContent = customItem ? 'Cambiar' : 'Añadir';
  }

  // ==========================================
  // ÁNIMO — pintar el estado guardado
  // ==========================================
  function applyMoodUI(mood) {
    todayMood = mood || null;
    selection = mood ? mood.items.map(item => ({ ...item })) : [];

    const today = todayISO();
    if (mood) {
      const stored = encodeMood(mood.items);
      if (stored) {
        selfHistory.historyMap[today] = stored;
        selfHistory.localMap[today] = stored;
      }
    } else {
      delete selfHistory.historyMap[today];
      delete selfHistory.localMap[today];
    }

    paintSelection();

    const saved = page.querySelector('#moodSaved');
    const feedback = page.querySelector('#moodFeedback');
    if (mood) {
      if (saved) {
        saved.textContent = `Guardado · ${mood.emoji}`;
        saved.hidden = false;
      }
      if (feedback) {
        feedback.querySelector('.sent-mood-feedback-icon').textContent = mood.emoji;
        feedback.querySelector('.sent-mood-feedback-text').textContent =
          `Hoy te sientes: ${mood.label}`;
        feedback.hidden = false;
      }
    } else {
      if (saved) saved.hidden = true;
      if (feedback) feedback.hidden = true;
    }
    if (weekPerson === 'self') renderWeek();
  }

  // ==========================================
  // GUARDADO — un cambio, un guardado (con cola para no pisarse)
  // ==========================================
  let saveTimer = null;
  let saving = false;
  let queued = null;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => flushSave(selection.slice()), 400);
  }

  async function flushSave(snapshot) {
    queued = snapshot;
    if (saving) return;
    saving = true;
    try {
      while (queued) {
        const items = queued;
        queued = null;
        await persist(items);
      }
    } finally {
      saving = false;
    }
  }

  async function persist(items) {
    try {
      let mood;
      if (!items.length) {
        // Sin nada marcado el día se queda sin emoción (si sigue en su ventana).
        const res = await moodStore.removeTodayMood();
        if (res.locked) {
          queued = null;
          applyMoodUI(res.mood);
          refreshMoodSide();
          toast('Este ánimo ya quedó registrado 🤍');
          return;
        }
        mood = res.mood;
      } else {
        mood = await moodStore.saveMoods(items);
      }
      if (queued) {
        todayMood = mood;
        return;
      } // hay un cambio más nuevo esperando
      applyMoodUI(mood);
      refreshMoodSide();
    } catch {
      toast('No se pudo guardar el ánimo', 'error');
      applyMoodUI(moodStore.getTodayMood());
    }
  }

  function refreshMoodSide() {
    renderStats();
    renderWeek();
  }

  function openPalette(open) {
    extraPanel.hidden = !open;
    moreBtn.setAttribute('aria-expanded', String(open));
    moreBtn.classList.toggle('is-open', open);
  }

  // ==========================================
  // CIFRAS
  // ==========================================
  // La barra es la única puerta a las cifras: anuncia si están abiertas y, si
  // todavía no hay ningún día registrado, no se enseña (no habría nada dentro).
  function paintStatsToggle(hasStats) {
    if (!statsToggle) return;
    statsToggle.hidden = !hasStats;
    statsToggle.setAttribute('aria-expanded', String(hasStats && statsOpen));
    statsToggle.classList.toggle('is-open', hasStats && statsOpen);
    const text = statsToggle.querySelector('.sent-stats-toggle-text');
    if (text) text.textContent = statsOpen ? 'Ocultar información' : 'Más información';
  }

  if (statsToggle) {
    statsToggle.addEventListener('click', () => {
      statsOpen = !statsOpen;
      renderStats();
    });
  }

  function renderStats() {
    const box = page.querySelector('#sentStats');
    if (!box) return;
    const stats = computeStats(selfHistory.historyMap);
    const hasStats = stats.totalDays > 0;
    paintStatsToggle(hasStats);
    if (!hasStats) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    const items = [
      {
        value: stats.totalDays,
        label: stats.totalDays === 1 ? 'día registrado' : 'días registrados',
      },
      { value: stats.streak, label: stats.streak === 1 ? 'día seguido' : 'días seguidos' },
      {
        value: escapeHtml(stats.mostCommon?.emoji) || '—',
        label: 'más frecuente',
        emoji: !!stats.mostCommon,
      },
      { value: stats.daysThisMonth, label: 'este mes' },
      { value: stats.best, label: 'mejor racha' },
    ];
    box.innerHTML = items
      .map(
        item => `
      <div class="sent-stat">
        <span class="sent-stat-value${item.emoji ? ' sent-stat-value--emoji' : ''}">${item.value}</span>
        <span class="sent-stat-label">${item.label}</span>
      </div>
    `
      )
      .join('');
    // Últimos 14 días de un vistazo: punto encendido = ese día hubo ánimo.
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="pro-strip" role="img" aria-label="Últimos 14 días con ánimo registrado">${stats.recent
        .map(day => `<span class="pro-dot${day.mood ? ' is-on' : ''}"></span>`)
        .join('')}</div>`
    );
    // Se repinta en cada cambio de ánimo: el plegado lo decide el usuario, no
    // el repintado.
    box.hidden = !statsOpen;

    // Widget de racha (solo APK: en el navegador la llamada no hace nada).
    saveStreakWidget({ days: stats.streak, best: stats.best });
  }

  // ==========================================
  // NUESTRO ÁNIMO — siete días, sin inventar registros
  // ==========================================
  function renderWeek() {
    const box = page.querySelector('#sentWeekDays');
    const sub = page.querySelector('#sentWeekSub');
    if (!box) return;

    const isPartner = weekPerson === 'partner';
    const state = isPartner ? partnerHistory : selfHistory;
    const label = isPartner ? partnerLabel : selfLabel;
    const loading = isPartner && partnerStatus === 'loading';
    const failed = isPartner && partnerStatus === 'error';
    const days = lastNDays(state.historyMap, 7, todayISO());
    const registered = days.filter(day => day.mood).length;

    box.innerHTML = days
      .map(({ date, mood }) => {
        const dayDate = new Date(`${date}T12:00:00`);
        const number = Number(date.slice(8, 10));
        const isToday = date === todayISO();
        // Mientras se carga (o si falló) no se pinta «sin registro»: eso sería
        // afirmar algo que todavía no se sabe.
        let resolved = null;
        let status = 'sin registro';
        if (loading) status = 'cargando';
        else if (failed) status = 'sin datos';
        else if (mood) {
          resolved = moodStore.resolveMood(mood);
          status = resolved?.label || 'sin registro';
        }
        const readOut = `${number} de ${MONTHS_SHORT[dayDate.getMonth()]}${
          isToday ? ' (hoy)' : ''
        }: ${status}`;
        return `<li class="sent-week-day${resolved ? ' has-mood' : ''}${isToday ? ' is-today' : ''}" aria-label="${escapeHtml(readOut)}">
          <span class="sent-week-day-wd" aria-hidden="true">${WEEKDAY_INITIALS[dayDate.getDay()]}</span>
          <span class="sent-week-day-num" aria-hidden="true">${number}</span>
          ${
            resolved
              ? `<span class="sent-week-day-mark" aria-hidden="true">${escapeHtml(resolved.emoji)}</span>`
              : '<span class="sent-week-day-mark is-empty" aria-hidden="true"></span>'
          }
        </li>`;
      })
      .join('');

    if (sub) {
      if (loading) sub.textContent = `Cargando el ánimo de ${label}…`;
      else if (failed) sub.textContent = `No se pudo cargar · toca ${label} para reintentar`;
      else
        sub.textContent = registered
          ? `${registered} de 7 días con ánimo · ${label}`
          : `Sin registros estos siete días · ${label}`;
    }

    page.querySelectorAll('[data-week-person]').forEach(btn => {
      const active = btn.dataset.weekPerson === weekPerson;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /**
   * El ánimo de la pareja se pide SOLO al tocar su nombre: ni al abrir la
   * pantalla ni al volver de otra sección. Quién es se resuelve en ese
   * momento (no antes) y, si la consulta falla, se reintenta una vez; el
   * botón sigue activo, así que volver a tocarlo también reintenta.
   */
  async function loadPartner() {
    if (partnerStatus === 'loading' || partnerStatus === 'ready') return;
    partnerStatus = 'loading';
    renderWeek();
    if (!partnerId) partnerId = await resolvePartnerId(selfId);
    let ok = false;
    if (partnerId) ok = await fetchHistory(partnerHistory, partnerId, selfId);
    if (!ok && partnerId && page.isConnected) {
      ok = await fetchHistory(partnerHistory, partnerId, selfId);
    }
    if (!page.isConnected) return;
    partnerStatus = ok ? 'ready' : 'error';
    renderWeek();
  }

  page.querySelectorAll('[data-week-person]').forEach(button => {
    button.addEventListener('click', () => {
      weekPerson = button.dataset.weekPerson;
      // La pareja se pinta en cuanto su carga lo diga (cargando o lista):
      // así no parpadea un «sin registros» que todavía no se sabe.
      if (weekPerson === 'partner' && partnerStatus !== 'ready') loadPartner();
      else renderWeek();
    });
  });

  // ==========================================
  // EVENTOS
  // ==========================================
  page.querySelectorAll('.sent-card').forEach(card => {
    card.addEventListener('click', () => router.navigate(card.dataset.href));
  });
  page.querySelector('.sent-week-link')?.addEventListener('click', event => {
    router.navigate(event.currentTarget.dataset.href);
  });

  page.addEventListener('click', event => {
    const removeCustom = event.target.closest('[data-custom-remove]');
    if (removeCustom && page.contains(removeCustom)) {
      selection = selection.filter(item => item.id !== customMood.id);
      customInput.value = '';
      paintSelection();
      scheduleSave();
      return;
    }
    const btn = event.target.closest('[data-mood]');
    if (!btn || !page.contains(btn)) return;
    selection = toggleMoodSelection(selection, btn.dataset.mood);
    paintSelection();
    scheduleSave();
  });

  moreBtn.addEventListener('click', () => openPalette(extraPanel.hidden));

  customForm.addEventListener('submit', event => {
    event.preventDefault();
    const item = makeCustomMood(customInput.value);
    if (!item) {
      customInput.focus();
      toast('Escribe cómo te sientes', 'info');
      return;
    }
    // La emoción escrita también forma parte de la selección múltiple.
    selection = toggleMoodSelection(selection, item);
    customInput.value = item.label;
    paintSelection();
    scheduleSave();
  });

  // Estado inicial
  applyMoodUI(todayMood);
  // Si hoy hay emociones que no son atajos, el desplegable arranca abierto:
  // si no, parecería que solo hay una marcada.
  openPalette(selection.some(item => !quickIds.has(item.id)));
  renderStats();
  renderWeek();

  // El historial propio, al abrir; el de la pareja, solo cuando se pide.
  fetchHistory(selfHistory, selfId, selfId).then(() => {
    if (!page.isConnected) return;
    renderStats();
    renderWeek();
  });

  // El ánimo puede haber cambiado en otro dispositivo mientras mirábamos
  moodStore.fetchTodayMood().then(remoteMood => {
    if (!page.isConnected) return;
    if ((remoteMood?.id || null) !== (todayMood?.id || null)) {
      applyMoodUI(remoteMood);
      refreshMoodSide();
    }
  });

  return page;
}

// ==========================================
// PANTALLA · HISTORIAL EMOCIONAL
// El calendario mensual completo, separado del calendario de planes.
// ==========================================
export function HistorialEmocionalPage(router) {
  const page = document.createElement('div');
  page.className = 'sentimientos-page sent-history-page';

  const selfUser = userStore.getUser();
  const selfId = selfUser?.id || null;
  const selfLabel = userStore.isAdmin ? 'Peluche' : 'Princesa';
  const partnerLabel = userStore.isAdmin ? 'Princesa' : 'Peluche';
  let partnerId = null;
  let owner = 'self';

  const selfHistory = createHistoryState(moodStore.getTodayMood());
  const partnerHistory = createHistoryState(null);
  let month = new Date();
  let loadToken = 0;

  const stateFor = who => (who === 'self' ? selfHistory : partnerHistory);
  const ownerIdFor = who => (who === 'self' ? selfId : partnerId);
  const ownerLabelFor = who => (who === 'self' ? selfLabel : partnerLabel);

  page.innerHTML = `
    ${renderPageHeader({
      title: 'Historial emocional',
      subtitle: 'Los días que habéis registrado, mes a mes',
      back: true,
    })}

    <section class="card sent-history" aria-labelledby="sentHistoryTitle">
      <div class="sent-history-person" role="group" aria-label="Ver el historial de">
        <button type="button" class="sent-history-person-btn is-active" data-history-person="self" aria-pressed="true">${selfLabel}</button>
        <button type="button" class="sent-history-person-btn" data-history-person="partner" aria-pressed="false" disabled>${partnerLabel}</button>
      </div>
      <div class="sent-history-head">
        <div class="sent-history-copy">
          <h2 class="sent-history-title" id="sentHistoryTitle">Ánimo de ${selfLabel}</h2>
          <p class="sent-history-sub" id="sentHistorySub"></p>
        </div>
        <div class="sent-history-nav">
          <button type="button" class="icon-btn" id="histPrev" aria-label="Mes anterior">${icon('back', 18)}</button>
          <span class="sent-history-label" id="histLabel"></span>
          <button type="button" class="icon-btn" id="histNext" aria-label="Mes siguiente">${icon('chev', 18)}</button>
        </div>
      </div>
      <div class="sent-hist-cal" id="histCal"></div>
      <div class="sent-history-legend" id="histLegend"></div>
    </section>

    <p class="sent-history-note">
      Solo el ánimo que cada persona decide compartir. Los planes, las fechas y los regalos
      siguen en su calendario.
    </p>
  `;

  function renderCalendar() {
    const cal = page.querySelector('#histCal');
    const label = page.querySelector('#histLabel');
    const legend = page.querySelector('#histLegend');
    const sub = page.querySelector('#sentHistorySub');
    if (!cal || !label) return;

    const calendar = monthCalendar(stateFor(owner), month);
    label.textContent = calendar.label;
    cal.innerHTML = calendar.html;
    if (legend) {
      legend.innerHTML = calendar.legend.length
        ? calendar.legend
            .map(
              mood =>
                `<span class="sent-hist-legend-item"><span aria-hidden="true">${escapeHtml(mood.emoji)}</span>${escapeHtml(mood.label)}</span>`
            )
            .join('')
        : '';
    }
    if (sub) {
      sub.textContent = calendar.count
        ? `${calendar.count} ${calendar.count === 1 ? 'día guardado' : 'días guardados'} este mes`
        : 'Todavía sin registros este mes';
    }
  }

  async function loadOwner(who) {
    const targetId = ownerIdFor(who);
    if (!targetId) return;
    const token = ++loadToken;
    const state = stateFor(who);
    const hadLocal = Object.keys(state.historyMap).length > 0;
    if (!hadLocal) {
      page.querySelector('#histCal').innerHTML = skeletonHTML({
        rows: 3,
        label: `Cargando ánimo de ${ownerLabelFor(who)}`,
      });
    }
    await fetchHistory(state, targetId, selfId);
    if (!page.isConnected || token !== loadToken) return;
    renderCalendar();
  }

  function selectOwner(who) {
    owner = who;
    page.querySelectorAll('[data-history-person]').forEach(button => {
      const active = button.dataset.historyPerson === who;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const title = page.querySelector('#sentHistoryTitle');
    if (title) title.textContent = `Ánimo de ${ownerLabelFor(who)}`;
    renderCalendar();
    loadOwner(who);
  }

  page.querySelectorAll('[data-history-person]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      selectOwner(button.dataset.historyPerson);
    });
  });

  page.querySelector('#histPrev')?.addEventListener('click', () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    renderCalendar();
  });
  page.querySelector('#histNext')?.addEventListener('click', () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    renderCalendar();
  });

  page.querySelector('#histCal')?.addEventListener('click', event => {
    const cell = event.target.closest('[data-history-date]');
    if (!cell || cell.disabled) return;
    openMoodDay(stateFor(owner), cell.dataset.historyDate, ownerLabelFor(owner));
  });

  page.querySelector('[data-back]')?.addEventListener('click', () => {
    router.navigate('/sentimientos');
  });

  renderCalendar();
  loadOwner('self');

  resolvePartnerId(selfId).then(userId => {
    if (!page.isConnected || !userId) return;
    partnerId = userId;
    const partnerButton = page.querySelector('[data-history-person="partner"]');
    if (partnerButton) partnerButton.disabled = false;
  });

  return page;
}
