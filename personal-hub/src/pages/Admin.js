/* ==========================================
   Personal Hub v2 — Admin Panel
   Dashboard · Estados de Ánimo · Usuarios · Actividad
   ========================================== */

import { db } from '../services/db.service.js';
import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';

// ==========================================
// SVG ICONS
// ==========================================
const UI = {
  dash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14h.01v.01H9V14Z"/><path d="M12 14h.01v.01H12V14Z"/><path d="M15 14h.01v.01H15V14Z"/><path d="M9 18h.01v.01H9V18Z"/><path d="M12 18h.01v.01H12V18Z"/><path d="M15 18h.01v.01H15V18Z"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

// ==========================================
// MOOD CONSTANTS
// ==========================================
const MOOD_EMOJIS = { great: '🤍🤍🤍', good: '😊', meh: '😕', bad: '😔', love: '❤️' };
const MOOD_LABELS = { great: 'Muy bieeeen', good: 'Bien', meh: 'Un poquito mal', bad: 'Mal', love: 'Necesito cariño' };
const MOOD_SCORES = { great: 4, good: 3, meh: 2, bad: 1, love: 0 };
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const TABS = [
  { id:'dashboard', icon: UI.dash, label:'Dashboard' },
  { id:'moods',     icon: UI.heart, label:'Ánimo' },
  { id:'usuarios',  icon: UI.users, label:'Usuarios' },
  { id:'actividad', icon: UI.activity, label:'Actividad' }
];

// ==========================================
// MAIN COMPONENT
// ==========================================

export function AdminPage(router) {
  const page = document.createElement('div');
  page.className = 'admin-page';
  page.innerHTML = `
    <div class="admin-header">
      <div>
        <h1>${UI.settings} Panel de Administración</h1>
        <p class="text-muted">Estadísticas y seguimiento de la app</p>
      </div>
      <div class="admin-status">
        <span class="status-dot online"></span>
        <span>Conectado como <strong>${userStore.getUser()?.name || ''}</strong></span>
      </div>
    </div>
    <div class="admin-db-status" id="adminDbStatus" style="display:none"></div>
    <nav class="admin-tabs" id="adminTabs">
      ${TABS.map(t => `<button class="admin-tab${t.id==='dashboard'?' active':''}" data-section="${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')}
    </nav>
    <div class="admin-content" id="adminContent"></div>
    <div class="admin-modal-overlay" id="adminModal" style="display:none">
      <div class="admin-modal">
        <div class="admin-modal-header">
          <h3 id="adminModalTitle"></h3>
          <button type="button" class="admin-modal-close" id="adminModalClose">${UI.close}</button>
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
  const S = { section: 'dashboard', editId: null, editType: null, moodDate: new Date() };

  const content = page.querySelector('#adminContent');

  // ===== TABS =====
  page.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      page.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      S.section = tab.dataset.section;
      loadSection(S.section);
    });
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

    open(title, bodyHtml, onSave) {
      this.title.textContent = title;
      this.body.innerHTML = bodyHtml;
      this.el.style.display = 'flex';
      this._currentOnSave = onSave || null;
      // Hide footer when the modal is read-only (no save callback)
      this.saveBtn.closest('.admin-modal-footer').style.display = onSave ? 'flex' : 'none';
      this.saveBtn.disabled = false;
      this.saveBtn.innerHTML = `${UI.check} Guardar`;
    },

    close() {
      this.el.style.display = 'none';
      this._currentOnSave = null;
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
        this.saveBtn.innerHTML = `${UI.check} Guardar`;
      }
    }
  };

  // Single listeners for modal actions (no cloning)
  modal.cancelBtn.addEventListener('click', () => modal.close());
  modal.closeBtn.addEventListener('click', () => modal.close());
  modal.el.addEventListener('click', (e) => { if (e.target === modal.el) modal.close(); });
  modal.saveBtn.addEventListener('click', () => modal.save());

  // ===== SECTION LOADER =====
  function loadSection(section) {
    const loaders = {
      dashboard: loadDashboard, moods: loadMoods,
      usuarios: loadUsuarios, actividad: loadActividad
    };
    if (loaders[section]) loaders[section]();
  }

  // ===== HELPERS =====
  const esc = (s) => db.escapeHtml ? db.escapeHtml(s) : String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  async function loadDashboard() {
    const [reasons, songs, gifts, users] = await Promise.all([
      db.getReasons(), db.getSongs(), db.getGifts(), db.listUsers()
    ]);

    // Fetch all server moods for admin stats (last 1000 rows)
    const today = new Date().toISOString().split('T')[0];
    const startOfYear = `${new Date().getFullYear()}-01-01`;
    const allMoods = await db.getAllMoods(startOfYear, today);

    const moodCount = allMoods.length;

    // Count unique users in moods
    const moodUserIds = new Set();
    allMoods.forEach(m => { if (m.user_id) moodUserIds.add(m.user_id); });
    const realUsers = users.filter(u => !u.id.startsWith('local_') && u.id.length > 10);
    const activeMoodUsers = moodUserIds.size;

    // Today's mood summary
    const todayMoods = allMoods.filter(m => m.date === today);
    const todayMoodCount = todayMoods.length;

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.dash} Dashboard</h2></div>
        <div class="stats-grid">
          <div class="card stat-card"><div class="stat-value">${realUsers.length}</div><div class="stat-label">Usuarios reales</div></div>
          <div class="card stat-card"><div class="stat-value">${activeMoodUsers}</div><div class="stat-label">Con estado de ánimo</div></div>
          <div class="card stat-card"><div class="stat-value">${moodCount}</div><div class="stat-label">Días ánimo totales</div></div>
          <div class="card stat-card"><div class="stat-value">${todayMoodCount}</div><div class="stat-label">Ánimos hoy</div></div>
          <div class="card stat-card"><div class="stat-value">${reasons.length}</div><div class="stat-label">Razones</div></div>
          <div class="card stat-card"><div class="stat-value">${songs.length}</div><div class="stat-label">Canciones</div></div>
          <div class="card stat-card"><div class="stat-value">${(gifts?.gifts || []).length}</div><div class="stat-label">Regalos</div></div>
        </div>
      </section>
    `;
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
              <span id="moodMonthLabel"></span>
              <button class="moods-nav-btn" id="moodNext">›</button>
            </div>
          </div>
          <div class="moods-calendar" id="moodCalendar"></div>
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
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthLabel = page.querySelector('#moodMonthLabel');
    const calendar = page.querySelector('#moodCalendar');
    const stats = page.querySelector('#moodStats');
    const breakdown = page.querySelector('#moodBreakdown');
    if (!calendar) return;

    monthLabel.textContent = `${MONTHS[date.getMonth()]} ${year}`;
    const monthMoods = await db.getMoodMonth(year, month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];

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
  // 9. USUARIOS
  // ==========================================
  async function loadUsuarios() {
    const [users, allMoods] = await Promise.all([
      db.listUsers(),
      db.getAllMoods('2024-01-01', new Date().toISOString().split('T')[0])
    ]);

    // Calculate mood stats per user from server moods
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

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.users} Usuarios <span class="admin-count-badge">${users.length}</span></h2>
        </div>
        <div class="admin-search"><input type="text" id="userSearch" class="admin-search-input" placeholder="Buscar usuarios por nombre, email o rol..."></div>
        <div class="admin-list" id="userList">${renderUsers(users, userMoodStats)}</div>
      </section>
    `;
    page.querySelector('#userSearch').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      const f = users.filter(u =>
        (u.email||'').toLowerCase().includes(q) ||
        (u.name||'').toLowerCase().includes(q) ||
        (u.role||'').includes(q)
      );
      page.querySelector('#userList').innerHTML = renderUsers(f, userMoodStats);
    });

    // Click on user to see detail (ignore action buttons)
    page.querySelector('#userList').addEventListener('click', async function(e) {
      if (e.target.closest('[data-action]')) return;
      const item = e.target.closest('.admin-list-item');
      if (!item) return;
      const userId = item.dataset.userId;
      const user = users.find(u => u.id === userId);
      if (user) await showUserDetail(user, userMoodStats[userId]);
    });
  }

  function renderUsers(users, moodStats) {
    if (users.length === 0) return '<div class="admin-empty">No hay usuarios</div>';
    return users.map((u, i) => {
      const initial = (u.name||u.email||'?').charAt(0).toUpperCase();
      const status = u.enabled !== false ? '🟢' : '🔴';
      const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString('es') : '—';
      const stats = moodStats[u.id];
      const moodBadge = stats && stats.total > 0
        ? getMoodSummaryBadge(stats)
        : '<span class="user-mood-none">Sin datos</span>';

      return `<div class="card admin-list-item" data-user-id="${esc(u.id)}" style="cursor:pointer">
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
            · ${status} · Último: ${lastLogin}
          </div>
          <div class="user-mood-row">${moodBadge}</div>
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

  async function showUserDetail(user, stats) {
    const initial = (user.name||user.email||'?').charAt(0).toUpperCase();
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString('es') : '—';
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('es') : '—';

    // Build mood breakdown HTML
    let moodHtml = '<p style="color:var(--umbra-ash);font-size:0.82rem;margin-bottom:12px;">Sin registros de ánimo</p>';
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
          <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:100px;text-align:center;padding:12px;background:var(--glass-bg);border-radius:12px;">
              <strong style="font-size:1.3rem;color:var(--accent-coral);">${stats.total}</strong>
              <div style="font-size:0.7rem;color:var(--umbra-ash);">Total registros</div>
            </div>
            <div style="flex:1;min-width:100px;text-align:center;padding:12px;background:var(--glass-bg);border-radius:12px;">
              <strong style="font-size:1.3rem;">${avgEmoji}</strong>
              <div style="font-size:0.7rem;color:var(--umbra-ash);">Media ánimo</div>
            </div>
            <div style="flex:1;min-width:100px;text-align:center;padding:12px;background:var(--glass-bg);border-radius:12px;">
              <strong style="font-size:1rem;color:var(--accent-coral);">${stats.lastDate ? new Date(stats.lastDate+'T12:00:00').toLocaleDateString('es') : '—'}</strong>
              <div style="font-size:0.7rem;color:var(--umbra-ash);">Último registro</div>
            </div>
          </div>
          <h4 style="font-size:0.85rem;margin:0 0 8px;color:var(--umbra-light);">Desglose de ánimos</h4>
          ${rows}
        </div>
      `;
    }

    const history = await db.getUserMoods(user.id);
    let historyHtml;
    if (history.length === 0) {
      historyHtml = '<p style="color:var(--umbra-ash);font-size:0.82rem;margin-bottom:12px;">Sin historial de ánimo</p>';
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
              ? `<img src="${esc(user.photo)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
              : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-coral);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1.3rem;">${initial}</div>`
            }
          </div>
          <div>
            <strong style="font-size:1rem;">${esc(user.name||'Sin nombre')}</strong><br>
            <span style="font-size:0.82rem;color:var(--umbra-ash);">${user.email || 'ID: ' + user.id}</span>
          </div>
          <span style="margin-left:auto;font-size:0.72rem;padding:3px 12px;border-radius:30px;background:${user.role === 'admin' ? 'rgba(198,90,58,0.15)' : 'rgba(255,255,255,0.05)'};color:${user.role === 'admin' ? 'var(--accent-coral)' : 'var(--umbra-ash)'};">${user.role || 'user'}</span>
        </div>

        <div class="admin-field">
          <p><strong>ID:</strong> ${user.id}</p>
          <p><strong>Creado:</strong> ${created}</p>
          <p><strong>Último login:</strong> ${lastLogin}</p>
          <p><strong>Estado:</strong> ${user.enabled !== false ? '🟢 Activo' : '🔴 Inactivo'}</p>
        </div>

        <hr style="opacity:0.2;margin:12px 0;">
        <h3 style="font-size:1rem;margin:0 0 12px;">${UI.heart} Resumen de Ánimo</h3>
        ${moodHtml}
        <h3 style="font-size:1rem;margin:24px 0 12px;">${UI.heart} Historial Completo</h3>
        ${historyHtml}
      </div>
    `);
  }

  // ==========================================
  // 10. ACTIVIDAD
  // ==========================================
  async function loadActividad() {
    const entries = await db.getActivity(50);
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.activity} Registro de Actividad</h2></div>
        <div class="admin-list">${
          entries.length === 0 ? '<div class="admin-empty">No hay actividad registrada</div>' :
          entries.map(e => {
            const time = e.timestamp ? new Date(e.timestamp).toLocaleString('es') : '';
            return `<div class="card admin-list-item">
              <div class="item-content">
                <div class="item-title">${esc(db.formatAction(e.action))}</div>
                <div class="item-sub">${esc(e.details||'')} · ${time}</div>
              </div>
            </div>`;
          }).join('')
        }</div>
      </section>
    `;
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
