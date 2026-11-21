/* ==========================================
   SENTIMIENTOS — el día y el mes en una mirada
   Cabecera del sistema + registro de ánimo + historial
   mensual + accesos. Sin hero propio ni decoración:
   el saludo es el título y el ánimo manda.

   El ánimo admite VARIAS emociones a la vez: los atajos van en la
   rejilla y el resto (más la que ella escriba) en el desplegable
   «Otras». Cada cambio se guarda solo, con la misma ventana de
   5 minutos del modelo de estados.
   ========================================== */

import '../styles/sentimientos.css';
import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { skeletonHTML } from '../components/states.js';
import { bestStreak, lastNDays } from '../utils/pro-insights.js';
import { saveStreakWidget } from '../services/widgets.service.js';
import { icon, toast } from '../components/ui.js';
import { escapeHtml } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import {
  MAX_CUSTOM_LABEL,
  encodeMood,
  makeCustomMood,
  toggleMoodSelection,
} from '../data/moods.data.js';

// Los cuatro accesos de Sentimientos, en el orden en que se leen.
const CARDS = [
  {
    id: 'razones',
    icon: 'spark',
    title: 'Razones',
    desc: 'Una razón nueva para quererte',
    href: '/razones',
    color: 'var(--violet-c)',
  },
  {
    id: 'maldia',
    icon: 'sun',
    title: 'Mal Día',
    desc: 'Lo que nos ha afectado y cómo nos sentimos',
    href: '/maldia',
    color: 'var(--warn)',
  },
  {
    id: 'openwhen',
    icon: 'mail',
    title: 'Open When',
    desc: 'Cartas para cuando las necesites',
    href: '/openwhen',
    color: 'var(--primary)',
  },
  {
    id: 'calendario',
    icon: 'calendar',
    title: 'Calendario',
    desc: 'Planes, fechas y regalos recibidos en un solo sitio',
    href: '/calendario',
    color: 'var(--ok)',
  },
  {
    id: 'menstruacion',
    icon: 'droplet',
    title: 'Menstruación',
    desc: 'Tu ciclo, con tus datos y tus reglas',
    href: '/menstruacion',
    color: 'var(--primary)',
  },
  {
    id: 'sorpresas', icon: 'gift', title: 'Mis sorpresas', desc: 'Ideas y regalos que solo tú puedes ver', href: '/sorpresas', color: 'var(--primary)',
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
// La semana empieza en lunes (como el resto de calendarios de la app)
const HIST_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const pad2 = n => String(n).padStart(2, '0');

export function SentimientosPage(router) {
  const page = document.createElement('div');
  page.className = 'sentimientos-page';

  const quickMoods = moodStore.getQuickMoods();
  const paletteMoods = moodStore.getPaletteMoods();
  const customMood = moodStore.getCustomMood();
  const quickIds = new Set(quickMoods.map(m => m.id));

  let todayMood = moodStore.getTodayMood();
  let selection = todayMood ? todayMood.items.map(item => ({ ...item })) : [];

  /* ==========================================
     HISTORIAL — una sola fuente para el mes y las cifras.
     date → estado COMPLETO ({ mood, label, emoji, score }), no
     solo el id: así los días registrados con el catálogo
     anterior se siguen viendo tal cual se pusieron, aunque ya
     no exista ese id en el catálogo actual.
     Se siembra con el historial local y se completa con Supabase
     (una consulta) para que las estadísticas sean las reales
     también en otro dispositivo.
     ========================================== */
  const historyMap = {};
  let histMonth = new Date();
  for (const entry of moodStore.getHistory() || []) {
    if (entry?.date && entry.moodId) {
      historyMap[entry.date] = {
        mood: entry.moodId,
        label: entry.label,
        emoji: entry.emoji,
        score: entry.score,
      };
    }
  }
  if (todayMood?.id) {
    const stored = encodeMood(todayMood.items);
    if (stored) historyMap[todayISO()] = stored;
  }

  function computeStats() {
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

  page.innerHTML = `
    ${renderPageHeader({ title: 'Sentimientos', subtitle: 'Cómo estamos y qué nos hace bien' })}

    <!-- ===== ÁNIMO DE HOY ===== -->
    <section class="card sent-mood" aria-labelledby="sentMoodTitle">
      <div class="sent-mood-head">
        <h2 class="sent-mood-title" id="sentMoodTitle">¿Cómo te sientes hoy?</h2>
        <span class="sent-mood-saved" id="moodSaved" hidden></span>
      </div>
      <div class="sent-mood-grid" id="moodGrid" role="group" aria-label="Elige cómo te sientes hoy. Puedes marcar varias">
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

    <!-- ===== TU MES DE ÁNIMOS ===== -->
    <section class="card sent-history" aria-labelledby="sentHistoryTitle">
      <div class="sent-history-head">
        <div class="sent-history-copy">
          <h2 class="sent-history-title" id="sentHistoryTitle">Tu mes de ánimos</h2>
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

    <!-- ===== ACCESOS ===== -->
    <div class="sent-cards-grid">
      ${CARDS.map(
        card => `
        <button type="button" class="sent-card lift" data-href="${card.href}" style="--card-color:${card.color}">
          <span class="sent-card-cover">${icon(card.icon, 30)}</span>
          <span class="sent-card-body">
            <span class="sent-card-title">${card.title}</span>
            <span class="sent-card-desc">${
              card.id === 'menstruacion' && userStore.isAdmin
                ? 'Lo que ella comparte contigo'
                : card.desc
            }</span>
          </span>
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
      if (stored) historyMap[today] = stored;
    } else {
      delete historyMap[today];
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
    renderHistory();
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
    const stats = computeStats();
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

  function renderHistory() {
    const cal = page.querySelector('#histCal');
    const label = page.querySelector('#histLabel');
    const legend = page.querySelector('#histLegend');
    const sub = page.querySelector('#sentHistorySub');
    if (!cal || !label) return;

    const year = histMonth.getFullYear();
    const month = histMonth.getMonth() + 1;
    const monthKey = `${year}-${pad2(month)}`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = todayISO();
    label.textContent = `${HIST_MONTHS[month - 1]} ${year}`;

    const monthEntries = Object.keys(historyMap).filter(date => date.startsWith(monthKey));
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // lunes = 0

    let cells = '';
    for (let i = 0; i < firstWeekday; i++)
      cells += '<span class="sent-hist-cell is-offset" aria-hidden="true"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${pad2(day)}`;
      const mood = historyMap[dateStr] ? moodStore.resolveMood(historyMap[dateStr]) : null;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      cells += `
        <div class="sent-hist-cell${mood ? ' has-mood' : ''}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}"
             ${mood ? `title="${escapeHtml(mood.label)}" aria-label="${escapeHtml(`${day} de ${HIST_MONTHS[month - 1]} · ${mood.label}`)}"` : ''}>
          <span class="sent-hist-day">${day}</span>
          ${mood ? `<span class="sent-hist-emoji" aria-hidden="true">${escapeHtml(mood.emoji)}</span>` : ''}
        </div>`;
    }

    cal.innerHTML = `
      <div class="sent-hist-grid">
        ${HIST_WEEKDAYS.map(day => `<span class="sent-hist-hd">${day}</span>`).join('')}
        ${cells}
      </div>
      ${monthEntries.length ? '' : `<p class="sent-hist-empty">Aún no hay ánimos este mes.<br><small>Cada día que lo cuentas queda guardado aquí.</small></p>`}
    `;

    if (legend) {
      // Una entrada por emoción DISTINTA del mes, con la etiqueta real: la de
      // «Otras» es la que escribió ella, no la palabra «Otras».
      const present = new Map();
      for (const date of monthEntries) {
        const resolved = moodStore.resolveMood(historyMap[date]);
        for (const item of resolved?.items || []) {
          if (!present.has(item.id)) present.set(item.id, item);
        }
      }
      legend.innerHTML = present.size
        ? [...present.values()]
            .map(
              mood =>
                `<span class="sent-hist-legend-item"><span aria-hidden="true">${escapeHtml(mood.emoji)}</span>${escapeHtml(mood.label)}</span>`
            )
            .join('')
        : '';
    }
    if (sub)
      sub.textContent = monthEntries.length
        ? `${monthEntries.length} ${monthEntries.length === 1 ? 'día guardado' : 'días guardados'} este mes`
        : 'Todavía sin registros este mes';
  }

  // Mientras llega el historial del servidor la rejilla se sustituye por
  // huecos con forma (solo si no hay nada local que enseñar).
  let histSkeletonShown = false;

  // Historial completo desde el servidor: una sola consulta para toda la vida
  // del usuario (un estado por día, poco peso) y las cifras ya son las reales.
  async function loadRemoteHistory() {
    const user = userStore.getUser();
    if (!user) return;
    let changed = false;
    try {
      const rows = await moodStore.getMoodHistory(user.id, '2000-01-01', todayISO());
      for (const row of rows || []) {
        // Vienen de la más reciente a la más antigua: el primer estado de cada
        // día es el último que se guardó, que es el que cuenta.
        if (!row?.date || !row.mood || historyMap[row.date]) continue;
        historyMap[row.date] = {
          mood: row.mood,
          label: row.label,
          emoji: row.emoji,
          score: row.score,
        };
        changed = true;
      }
    } catch {
      /* sin conexión: vale el historial local */
    }
    // El hueco de carga se sustituye SIEMPRE: con el historial remoto, con el
    // local o con el mensaje de «aún no hay ánimos». Si no, un fallo de red
    // dejaría la rejilla cargando para siempre.
    if (changed || histSkeletonShown) {
      histSkeletonShown = false;
      renderStats();
      renderHistory();
    }
  }

  page.querySelectorAll('.sent-card').forEach(card => {
    card.addEventListener('click', () => router.navigate(card.dataset.href));
  });

  // ==========================================
  // EVENTOS DE LA TARJETA
  // ==========================================
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
    // Tocar una emoción ya marcada la quita: puede quedar sin ninguna, y
    // entonces el día vuelve a estar sin emoción.
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
    selection = [...selection.filter(i => i.id !== customMood.id), item];
    customInput.value = item.label;
    paintSelection();
    scheduleSave();
  });

  // Meses del historial
  page.querySelector('#histPrev')?.addEventListener('click', () => {
    histMonth = new Date(histMonth.getFullYear(), histMonth.getMonth() - 1, 1);
    renderHistory();
  });
  page.querySelector('#histNext')?.addEventListener('click', () => {
    histMonth = new Date(histMonth.getFullYear(), histMonth.getMonth() + 1, 1);
    renderHistory();
  });

  // Estado inicial
  applyMoodUI(todayMood);
  // Si hoy hay emociones que no son atajos, el desplegable arranca abierto:
  // si no, parecería que solo hay una marcada.
  openPalette(selection.some(item => !quickIds.has(item.id)));
  renderStats();
  renderHistory();
  const histCal = page.querySelector('#histCal');
  if (histCal && !Object.keys(historyMap).length) {
    histCal.innerHTML = skeletonHTML({ rows: 3, label: 'Cargando tu historial' });
    histSkeletonShown = true;
  }
  loadRemoteHistory();

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
