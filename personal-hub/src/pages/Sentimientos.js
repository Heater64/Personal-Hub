/* ==========================================
   Personal Hub v2 — Sentimientos Page
   Emotional hub: mood tracking + navigation
   ========================================== */

import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';
import { todayISO, hourInSpain } from '../utils/format.js';

const CARDS = [
  {
    id: 'razones',
    icon: 'sparkles',
    emoji: '💝',
    title: 'Razones',
    href: '/razones',
    colorVar: '--sent-color-razones'
  },
  {
    id: 'openwhen',
    icon: 'mail',
    emoji: '💌',
    title: 'Open When',
    href: '/openwhen',
    colorVar: '--sent-color-openwhen'
  },
  {
    id: 'calendario',
    icon: 'calendar',
    emoji: '📅',
    title: 'Calendario',
    href: '/calendario',
    colorVar: '--sent-color-calendario'
  },
  {
    id: 'maldia',
    icon: 'sun',
    emoji: '🌤️',
    title: 'Mal Día',
    href: '/maldia',
    colorVar: '--sent-color-maldia'
  }
];

const ICON_SVGS = {
  'sparkles': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 2l.5 2L21 4.5l-1.5.5L19 7l-.5-2L17 4.5l1.5-.5z"/><path d="M5 20l.5 1.5L7 22l-1.5.5L5 24l-.5-1.5L3 22l1.5-.5z"/></svg>`,
  'mail': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  'calendar': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  'sun': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
};

function getGreeting() {
  const h = hourInSpain();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const HIST_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const HIST_WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function pad2(n) { return String(n).padStart(2, '0'); }

function createFloatingParticles() {
  const shapes = [
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg>',
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
  ];
  let html = '';
  for (let i = 0; i < 20; i++) {
    const shape = shapes[i % shapes.length];
    const size = 8 + Math.random() * 16;
    const left = Math.random() * 100;
    const delay = Math.random() * 6;
    const duration = 5 + Math.random() * 5;
    const opacity = 0.06 + Math.random() * 0.1;
    html += `<span class="sent-float" style="left:${left}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${duration}s;opacity:${opacity};color:var(--theme-accent)">${shape}</span>`;
  }
  return html;
}

function getMoodStats() {
  const history = moodStore.getHistory() || [];
  const today = todayISO();

  // Count days this month
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysThisMonth = history.filter(h => h.date?.startsWith(thisMonth)).length;

  // Count total days tracked
  const totalDays = history.length;

  // Find most common mood
  const counts = {};
  history.forEach(h => { counts[h.moodId] = (counts[h.moodId] || 0) + 1; });
  let mostCommonId = null;
  let mostCommonCount = 0;
  Object.entries(counts).forEach(([id, count]) => {
    if (count > mostCommonCount) { mostCommonId = id; mostCommonCount = count; }
  });
  const mostCommon = mostCommonId ? moodStore.getMoodById(mostCommonId) : null;

  // Current streak
  let streak = 0;
  const sortedDates = [...new Set(history.map(h => h.date))].sort().reverse();
  if (sortedDates.length) {
    const checkDate = new Date(today);
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date(checkDate);
      expected.setDate(expected.getDate() - i);
      const expectedStr = todayISO(expected);
      if (sortedDates[i] === expectedStr) streak++;
      else break;
    }
  }

  return { totalDays, daysThisMonth, mostCommon, streak };
}

export function SentimientosPage(router) {
  const page = document.createElement('div');
  page.className = 'sentimientos-page';

  const todayMood = moodStore.getTodayMood();
  const allMoods = moodStore.getMoods();
  const stats = getMoodStats();
  const greeting = getGreeting();

  // Async sync for cross-device moods
  moodStore.fetchTodayMood().then(remoteMood => {
    if (remoteMood && remoteMood.id !== todayMood?.id) {
      const grid = page.querySelector('#moodGrid');
      const feedback = page.querySelector('#moodFeedback');
      const saved = page.querySelector('.sent-mood-saved');
      if (grid) {
        grid.querySelectorAll('.sent-mood-btn').forEach(b => {
          b.classList.toggle('is-active', b.dataset.mood === remoteMood.id);
        });
      }
      if (feedback) {
        feedback.style.display = 'flex';
        feedback.querySelector('.sent-mood-feedback-icon').textContent = remoteMood.emoji;
        feedback.querySelector('.sent-mood-feedback-text').textContent = `Hoy te sientes: ${remoteMood.label}`;
      }
      if (saved) saved.textContent = `Guardado · ${remoteMood.emoji}`;
      else {
        const header = page.querySelector('.sent-mood-header');
        if (header) {
          const span = document.createElement('span');
          span.className = 'sent-mood-saved';
          span.textContent = `Guardado · ${remoteMood.emoji}`;
          header.appendChild(span);
        }
      }
    }
  });

  page.innerHTML = `
    <!-- Calming Hero -->
    <div class="sent-hero">
      <div class="sent-hero-particles">${createFloatingParticles()}</div>
      <div class="sent-hero-glow"></div>
      <div class="sent-hero-content">
        <span class="sent-hero-eyebrow">${greeting}, princesa</span>
        <h1 class="sent-hero-title">
          Tu espacio de sentimientos
          <span class="sent-hero-heart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </span>
        </h1>
        <p class="sent-hero-sub">Un lugar tranquilo donde guardamos cómo nos sentimos, lo que nos hace felices y todo lo bonito que compartimos.</p>
      </div>
    </div>

    <!-- Mood Tracker -->
    <div class="sent-mood">
      <div class="sent-mood-header">
        <h3 class="sent-mood-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          ¿Cómo te sientes hoy?
        </h3>
        ${todayMood ? `<span class="sent-mood-saved">Guardado · ${todayMood.emoji}</span>` : ''}
      </div>
      <div class="sent-mood-grid" id="moodGrid">
        ${allMoods.map(m => `
          <button class="sent-mood-btn ${todayMood?.id === m.id ? 'is-active' : ''}" data-mood="${m.id}">
            <span class="sent-mood-emoji">${m.emoji}</span>
            <span class="sent-mood-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="sent-mood-feedback" id="moodFeedback" style="display:${todayMood ? 'flex' : 'none'}">
        <span class="sent-mood-feedback-icon">${todayMood?.emoji || '🤍'}</span>
        <span class="sent-mood-feedback-text">${todayMood ? `Hoy te sientes: ${todayMood.label}` : ''}</span>
      </div>

      <!-- Mood Stats Mini -->
      ${stats.totalDays > 0 ? `
      <div class="sent-mood-stats">
        <div class="sent-stat">
          <span class="sent-stat-value">${stats.totalDays}</span>
          <span class="sent-stat-label">días registrados</span>
        </div>
        <div class="sent-stat">
          <span class="sent-stat-value">${stats.streak}</span>
          <span class="sent-stat-label">días seguidos</span>
        </div>
        ${stats.mostCommon ? `
        <div class="sent-stat">
          <span class="sent-stat-value">${stats.mostCommon.emoji}</span>
          <span class="sent-stat-label">más frecuente</span>
        </div>
        ` : ''}
        <div class="sent-stat">
          <span class="sent-stat-value">${stats.daysThisMonth}</span>
          <span class="sent-stat-label">este mes</span>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Historial de ánimos — tu mes en una mirada -->
    <div class="sent-history">
      <div class="sent-history-head">
        <div class="sent-history-title-wrap">
          <span class="sent-history-icon" aria-hidden="true">📖</span>
          <div>
            <h3 class="sent-history-title">Tu mes de ánimos</h3>
            <p class="sent-history-sub" id="sentHistorySub">Así te has sentido últimamente</p>
          </div>
        </div>
        <div class="sent-history-nav">
          <button type="button" class="sent-history-nav-btn" id="histPrev" aria-label="Mes anterior">‹</button>
          <span class="sent-history-label" id="histLabel"></span>
          <button type="button" class="sent-history-nav-btn" id="histNext" aria-label="Mes siguiente">›</button>
        </div>
      </div>
      <div class="sent-hist-cal" id="histCal">
        <div class="sent-hist-skeleton" aria-hidden="true"></div>
      </div>
      <div class="sent-history-legend" id="histLegend"></div>
    </div>

    <!-- Navigation Cards -->
    <div class="sent-cards-label">
      <span class="sent-cards-label-line"></span>
      <span class="sent-cards-label-text">Explorar</span>
      <span class="sent-cards-label-line"></span>
    </div>

    <div class="sent-cards-grid">
      ${CARDS.map((card, i) => `
        <button type="button" class="sent-card" data-href="${card.href}" style="--card-color:var(${card.colorVar});--enter-delay:${i * 0.08}s">
          <div class="sent-card-glow"></div>
          <div class="sent-card-cover">
            <span class="sent-card-icon">${ICON_SVGS[card.icon] || ''}</span>
            <span class="sent-card-emoji" aria-hidden="true">${card.emoji}</span>
          </div>
          <div class="sent-card-body">
            <h3 class="sent-card-title">${card.title}</h3>
          </div>
        </button>
      `).join('')}
    </div>
  `;

  // Bind card clicks
  page.querySelectorAll('.sent-card').forEach(card => {
    card.addEventListener('click', () => {
      const href = card.dataset.href;
      if (href) router.navigate(href);
    });
  });

  // Bind mood buttons
  // Aplica a la UI el ánimo activo (o "sin ánimo" si mood es null)
  function applyMoodUI(mood) {
    page.querySelectorAll('.sent-mood-btn').forEach(b => b.classList.remove('is-active'));
    const feedback = page.querySelector('#moodFeedback');
    const saved = page.querySelector('.sent-mood-saved');
    if (mood) {
      const activeBtn = page.querySelector(`.sent-mood-btn[data-mood="${mood.id}"]`);
      if (activeBtn) activeBtn.classList.add('is-active');
      if (feedback) {
        feedback.style.display = 'flex';
        feedback.querySelector('.sent-mood-feedback-icon').textContent = mood.emoji;
        feedback.querySelector('.sent-mood-feedback-text').textContent = `Hoy te sientes: ${mood.label}`;
      }
      if (saved) {
        saved.textContent = `Guardado · ${mood.emoji}`;
      } else {
        const header = page.querySelector('.sent-mood-header');
        if (header) {
          const span = document.createElement('span');
          span.className = 'sent-mood-saved';
          span.textContent = `Guardado · ${mood.emoji}`;
          header.appendChild(span);
        }
      }
    } else {
      if (feedback) feedback.style.display = 'none';
      if (saved) saved.remove();
    }
  }

  // Refresca historial del mes + estadísticas tras guardar/eliminar
  function refreshMoodSide() {
    renderHistory();
    const newStats = getMoodStats();
    const statsEl = page.querySelector('.sent-mood-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="sent-stat"><span class="sent-stat-value">${newStats.totalDays}</span><span class="sent-stat-label">días registrados</span></div>
        <div class="sent-stat"><span class="sent-stat-value">${newStats.streak}</span><span class="sent-stat-label">días seguidos</span></div>
        ${newStats.mostCommon ? `<div class="sent-stat"><span class="sent-stat-value">${newStats.mostCommon.emoji}</span><span class="sent-stat-label">más frecuente</span></div>` : ''}
        <div class="sent-stat"><span class="sent-stat-value">${newStats.daysThisMonth}</span><span class="sent-stat-label">este mes</span></div>
      `;
    }
  }

  page.querySelectorAll('.sent-mood-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const moodId = btn.dataset.mood;
      btn.classList.add('is-loading');

      // Tocar la emoción YA activa la ELIMINA: no tiene que haber una emoción
      // puesta sí o sí. Si el estado lleva más de 5 min, quedó bloqueado.
      if (btn.classList.contains('is-active')) {
        try {
          const res = await moodStore.removeTodayMood();
          if (res.locked) {
            showToast('Este ánimo ya quedó registrado 🤍', 'info');
          } else {
            applyMoodUI(res.mood);
            refreshMoodSide();
            showToast(res.mood ? 'Ánimo actualizado' : 'Ánimo eliminado · hoy sin emoción', 'info');
          }
        } catch (err) { /* silent */ }
        btn.classList.remove('is-loading');
        return;
      }

      try {
        await moodStore.saveMood(moodId);
        applyMoodUI(moodStore.getMoodById(moodId));
        refreshMoodSide();
      } catch (err) { /* silent */ }
      btn.classList.remove('is-loading');
    });
  });

  // ==========================================
  // HISTORIAL — Tu mes de ánimos
  // ==========================================
  let histMonth = new Date();
  let histToken = 0; // guard de carrera: un render obsoleto se descarta

  // La fecha "hoy" del calendario usa la MISMA convención que el moodStore:
  // el día cambia a las 00:00 de España (península).
  function moodTodayStr() {
    return todayISO();
  }

  function renderHistory() {
    const cal = page.querySelector('#histCal');
    const label = page.querySelector('#histLabel');
    const legend = page.querySelector('#histLegend');
    const sub = page.querySelector('#sentHistorySub');
    if (!cal || !label) return;

    const token = ++histToken;
    const year = histMonth.getFullYear();
    const month = histMonth.getMonth() + 1;
    const monthKey = `${year}-${pad2(month)}`;
    label.textContent = `${HIST_MONTHS[month - 1]} ${year}`;

    // Mapa fecha → moodId (local primero, servidor después)
    const map = {};
    (moodStore.getHistory() || []).forEach(h => {
      if (h.date && h.moodId) map[h.date] = h.moodId;
    });

    // Rellena el mes desde Supabase (multi-dispositivo) sin bloquear el render
    const user = userStore.getUser();
    const daysInMonth = new Date(year, month, 0).getDate();
    if (user) {
      moodStore.getMoodHistory(user.id, `${monthKey}-01`, `${monthKey}-${pad2(daysInMonth)}`)
        .then(rows => {
          if (token !== histToken) return; // mes obsoleto: descartar merge
          if (!rows || !rows.length) return;
          let changed = false;
          rows.forEach(r => {
            if (r.date && r.mood && !map[r.date]) { map[r.date] = r.mood; changed = true; }
          });
          if (changed) drawCalendar();
        })
        .catch(() => { /* silencioso: queda el historial local */ });
    }

    function drawCalendar() {
      if (token !== histToken) return; // el usuario ya navegó a otro mes
      const firstWeekday = new Date(year, month - 1, 1).getDay();
      const todayStr = moodTodayStr();
      const thisMonthEntries = Object.keys(map).filter(d => d.startsWith(monthKey)).length;

      let cells = '';
      for (let i = 0; i < firstWeekday; i++) {
        cells += '<span class="sent-hist-cell is-offset" aria-hidden="true"></span>';
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${monthKey}-${pad2(day)}`;
        const moodId = map[dateStr];
        const mood = moodId ? moodStore.getMoodById(moodId) : null;
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        cells += `
          <div class="sent-hist-cell${mood ? ' has-mood' : ''}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}"
               ${mood ? `title="${mood.label}" aria-label="${day} de ${HIST_MONTHS[month - 1]} · ${mood.label}"` : ''}>
            <span class="sent-hist-day">${day}</span>
            ${mood ? `<span class="sent-hist-emoji" aria-hidden="true">${mood.emoji}</span>` : ''}
          </div>`;
      }

      const todayLabel = monthKey === moodTodayStr().slice(0, 7);
      const emptyHint = thisMonthEntries === 0
        ? `<p class="sent-hist-empty">Aún no has registrado cómo te sentías este mes 💭<br><small>Cada día que lo cuentas queda guardado aquí.</small></p>`
        : '';

      cal.innerHTML = `
        <div class="sent-hist-grid">
          ${HIST_WEEKDAYS.map(w => `<span class="sent-hist-hd">${w}</span>`).join('')}
          ${cells}
        </div>
        ${emptyHint}
      `;

      // Leyenda: solo los ánimos presentes en el mes visible
      const present = [...new Set(Object.keys(map).filter(d => d.startsWith(monthKey)).map(d => map[d]))]
        .map(id => moodStore.getMoodById(id))
        .filter(Boolean);
      if (legend) {
        legend.innerHTML = present.length
          ? present.map(m => `<span class="sent-hist-legend-item"><span class="sent-hist-legend-emoji">${m.emoji}</span>${m.label}</span>`).join('')
          : '';
      }
      if (sub) sub.textContent = todayLabel ? 'Así te has sentido últimamente' : `Cómo te sentías en ${HIST_MONTHS[month - 1].toLowerCase()}`;
    }

    drawCalendar();
  }

  page.querySelector('#histPrev')?.addEventListener('click', () => {
    histMonth = new Date(histMonth.getFullYear(), histMonth.getMonth() - 1, 1);
    renderHistory();
  });
  page.querySelector('#histNext')?.addEventListener('click', () => {
    histMonth = new Date(histMonth.getFullYear(), histMonth.getMonth() + 1, 1);
    renderHistory();
  });

  renderHistory();

  return page;
}
