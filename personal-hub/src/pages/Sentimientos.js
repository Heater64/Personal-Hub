/* ==========================================
   SENTIMIENTOS — el día y el mes en una mirada
   Cabecera del sistema + registro de ánimo + historial
   mensual + accesos. Sin hero propio ni decoración:
   el saludo es el título y el ánimo manda.
   ========================================== */

import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { icon, toast } from '../components/ui.js';
import { todayISO, hourInSpain } from '../utils/format.js';

const CARDS = [
  { id: 'razones', icon: 'spark', title: 'Razones', desc: 'Una razón nueva para quererte', href: '/razones', color: 'var(--violet-c)' },
  { id: 'openwhen', icon: 'mail', title: 'Open When', desc: 'Cartas para cuando las necesites', href: '/openwhen', color: 'var(--primary)' },
  { id: 'calendario', icon: 'calendar', title: 'Calendario', desc: 'Sorpresas y días especiales', href: '/calendario', color: 'var(--ok)' },
  { id: 'maldia', icon: 'sun', title: 'Mal Día', desc: 'Un abrazo para el mal día', href: '/maldia', color: 'var(--warn)' }
];

const HIST_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// La semana empieza en lunes (como el resto de calendarios de la app)
const HIST_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const pad2 = (n) => String(n).padStart(2, '0');

function getGreeting() {
  const h = hourInSpain();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function longDate(date = new Date()) {
  const s = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SentimientosPage(router) {
  const page = document.createElement('div');
  page.className = 'sentimientos-page';

  const allMoods = moodStore.getMoods();
  let todayMood = moodStore.getTodayMood();

  /* ==========================================
     HISTORIAL — una sola fuente para el mes y las cifras
     date → moodId. Se siembra con el historial local y se
     completa con Supabase (una consulta) para que las
     estadísticas sean las reales también en otro dispositivo.
     ========================================== */
  const historyMap = {};
  let histMonth = new Date();
  for (const entry of moodStore.getHistory() || []) {
    if (entry?.date && entry.moodId) historyMap[entry.date] = entry.moodId;
  }
  if (todayMood?.id) historyMap[todayISO()] = todayMood.id;

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

    const counts = {};
    dates.forEach(date => { const id = historyMap[date]; counts[id] = (counts[id] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalDays: dates.length,
      daysThisMonth: dates.filter(date => date.startsWith(thisMonth)).length,
      streak,
      mostCommon: top ? moodStore.getMoodById(top[0]) : null
    };
  }

  page.innerHTML = `
    ${renderPageHeader({ title: `${getGreeting()}, princesa`, subtitle: longDate() })}

    <!-- ===== ÁNIMO DE HOY ===== -->
    <section class="card sent-mood" aria-labelledby="sentMoodTitle">
      <div class="sent-mood-head">
        <h2 class="sent-mood-title" id="sentMoodTitle">¿Cómo te sientes hoy?</h2>
        <span class="sent-mood-saved" id="moodSaved" hidden></span>
      </div>
      <div class="sent-mood-grid" id="moodGrid" role="group" aria-label="Elige cómo te sientes hoy">
        ${allMoods.map(m => `
          <button type="button" class="sent-mood-btn${todayMood?.id === m.id ? ' is-active' : ''}" data-mood="${m.id}" aria-pressed="${todayMood?.id === m.id}">
            <span class="sent-mood-emoji" aria-hidden="true">${m.emoji}</span>
            <span class="sent-mood-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
      <p class="sent-mood-feedback" id="moodFeedback" hidden>
        <span class="sent-mood-feedback-icon" aria-hidden="true"></span>
        <span class="sent-mood-feedback-text"></span>
      </p>
    </section>

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

    <!-- ===== EXPLORAR ===== -->
    <h2 class="section-title">Explorar</h2>
    <div class="sent-cards-grid">
      ${CARDS.map(card => `
        <button type="button" class="sent-card lift" data-href="${card.href}" style="--card-color:${card.color}">
          <span class="sent-card-cover">${icon(card.icon, 24)}</span>
          <span class="sent-card-body">
            <span class="sent-card-title">${card.title}</span>
            <span class="sent-card-desc">${card.desc}</span>
          </span>
        </button>
      `).join('')}
    </div>
  `;

  // ==========================================
  // ÁNIMO — pintar el estado guardado
  // ==========================================
  function applyMoodUI(mood) {
    todayMood = mood;
    const today = todayISO();
    if (mood) historyMap[today] = mood.id;
    else delete historyMap[today];

    page.querySelectorAll('.sent-mood-btn').forEach(btn => {
      const active = btn.dataset.mood === mood?.id;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const saved = page.querySelector('#moodSaved');
    const feedback = page.querySelector('#moodFeedback');
    if (mood) {
      if (saved) { saved.textContent = `Guardado · ${mood.emoji}`; saved.hidden = false; }
      if (feedback) {
        feedback.querySelector('.sent-mood-feedback-icon').textContent = mood.emoji;
        feedback.querySelector('.sent-mood-feedback-text').textContent = `Hoy te sientes: ${mood.label}`;
        feedback.hidden = false;
      }
    } else {
      if (saved) saved.hidden = true;
      if (feedback) feedback.hidden = true;
    }
  }

  // ==========================================
  // CIFRAS
  // ==========================================
  function renderStats() {
    const box = page.querySelector('#sentStats');
    if (!box) return;
    const stats = computeStats();
    if (!stats.totalDays) { box.hidden = true; box.innerHTML = ''; return; }
    const items = [
      { value: stats.totalDays, label: stats.totalDays === 1 ? 'día registrado' : 'días registrados' },
      { value: stats.streak, label: stats.streak === 1 ? 'día seguido' : 'días seguidos' },
      { value: stats.mostCommon?.emoji || '—', label: 'más frecuente', emoji: !!stats.mostCommon },
      { value: stats.daysThisMonth, label: 'este mes' }
    ];
    box.innerHTML = items.map(item => `
      <div class="sent-stat">
        <span class="sent-stat-value${item.emoji ? ' sent-stat-value--emoji' : ''}">${item.value}</span>
        <span class="sent-stat-label">${item.label}</span>
      </div>
    `).join('');
    box.hidden = false;
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
    for (let i = 0; i < firstWeekday; i++) cells += '<span class="sent-hist-cell is-offset" aria-hidden="true"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${pad2(day)}`;
      const mood = historyMap[dateStr] ? moodStore.getMoodById(historyMap[dateStr]) : null;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      cells += `
        <div class="sent-hist-cell${mood ? ' has-mood' : ''}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}"
             ${mood ? `title="${mood.label}" aria-label="${day} de ${HIST_MONTHS[month - 1]} · ${mood.label}"` : ''}>
          <span class="sent-hist-day">${day}</span>
          ${mood ? `<span class="sent-hist-emoji" aria-hidden="true">${mood.emoji}</span>` : ''}
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
      const present = [...new Set(monthEntries.map(date => historyMap[date]))]
        .map(id => moodStore.getMoodById(id))
        .filter(Boolean);
      legend.innerHTML = present.length
        ? present.map(mood => `<span class="sent-hist-legend-item"><span aria-hidden="true">${mood.emoji}</span>${mood.label}</span>`).join('')
        : '';
    }
    if (sub) sub.textContent = monthEntries.length
      ? `${monthEntries.length} ${monthEntries.length === 1 ? 'día guardado' : 'días guardados'} este mes`
      : 'Todavía sin registros este mes';
  }

  // Historial completo desde el servidor: una sola consulta para toda la vida
  // del usuario (un estado por día, poco peso) y las cifras ya son las reales.
  async function loadRemoteHistory() {
    const user = userStore.getUser();
    if (!user) return;
    try {
      const rows = await moodStore.getMoodHistory(user.id, '2000-01-01', todayISO());
      if (!rows?.length) return;
      let changed = false;
      for (const row of rows) {
        // Vienen de la más reciente a la más antigua: el primer estado de cada
        // día es el último que se guardó, que es el que cuenta.
        if (!row?.date || !row.mood || historyMap[row.date]) continue;
        historyMap[row.date] = row.mood;
        changed = true;
      }
      if (changed) { renderStats(); renderHistory(); }
    } catch { /* sin conexión: vale el historial local */ }
  }

  page.querySelectorAll('.sent-card').forEach(card => {
    card.addEventListener('click', () => router.navigate(card.dataset.href));
  });

  page.querySelectorAll('.sent-mood-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const moodId = btn.dataset.mood;
      btn.classList.add('is-loading');

      // Tocar la emoción ya activa la quita: no tiene que haber una puesta
      // sí o sí. Si el estado lleva más de 5 min, quedó bloqueado.
      const removing = btn.classList.contains('is-active');
      try {
        if (removing) {
          const res = await moodStore.removeTodayMood();
          if (res.locked) {
            toast('Este ánimo ya quedó registrado 🤍');
          } else {
            applyMoodUI(res.mood);
            refreshMoodSide();
            toast(res.mood ? 'Ánimo actualizado' : 'Ánimo eliminado · hoy sin emoción');
          }
        } else {
          await moodStore.saveMood(moodId);
          applyMoodUI(moodStore.getMoodById(moodId));
          refreshMoodSide();
        }
      } catch { /* offline: se reintenta al volver */ }

      btn.classList.remove('is-loading');
    });
  });

  function refreshMoodSide() {
    renderStats();
    renderHistory();
  }

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
  renderStats();
  renderHistory();
  loadRemoteHistory();

  // El ánimo puede haber cambiado en otro dispositivo mientras mirábamos
  moodStore.fetchTodayMood().then(remoteMood => {
    if (!page.isConnected) return;
    if ((remoteMood?.id || null) !== (todayMood?.id || null)) applyMoodUI(remoteMood);
  });

  return page;
}
