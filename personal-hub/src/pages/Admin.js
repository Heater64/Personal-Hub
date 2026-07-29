/* ==========================================
   Personal Hub v2 — Admin Panel
   Dashboard · Estados de Ánimo · Razones · Canciones · Regalos
   Noticias · Mal Día · Series · Usuarios · Actividad
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
  music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  gift: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  news: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V7"/><path d="M10 10h4v8h-4v-8z"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 3v1m0 16v1m-9-9H2m20 0h-1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/></svg>',
  tv: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14h.01v.01H9V14Z"/><path d="M12 14h.01v.01H12V14Z"/><path d="M15 14h.01v.01H15V14Z"/><path d="M9 18h.01v.01H9V18Z"/><path d="M12 18h.01v.01H12V18Z"/><path d="M15 18h.01v.01H15V18Z"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
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
  { id:'razones',   icon: UI.heart, label:'Razones' },
  { id:'canciones', icon: UI.music, label:'Canciones' },
  { id:'regalos',   icon: UI.gift,  label:'Regalos' },
  { id:'noticias',  icon: UI.news,  label:'Noticias' },
  { id:'maldia',    icon: UI.sun,   label:'Mal Día' },
  { id:'series',    icon: UI.tv,    label:'Series' },
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
        <p class="text-muted">Gestiona todo el contenido de la web</p>
      </div>
      <div class="admin-status">
        <span class="status-dot online"></span>
        <span>Conectado como <strong>${userStore.getUser()?.name || ''}</strong></span>
      </div>
    </div>
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

    open(title, bodyHtml, onSave) {
      this.title.textContent = title;
      this.body.innerHTML = bodyHtml;
      this.el.style.display = 'flex';

      const makeHandler = (btn, handler) => {
        const clone = btn.cloneNode(true);
        btn.replaceWith(clone);
        clone.addEventListener('click', handler);
        return clone;
      };

      const close = () => { this.el.style.display = 'none'; S.editId = null; S.editType = null; };
      this.saveBtn = makeHandler(this.saveBtn, async () => {
        this.saveBtn.disabled = true; this.saveBtn.textContent = 'Guardando...';
        try { await onSave(); close(); loadSection(S.section); showToast('Guardado', 'success'); }
        catch (err) { showToast(err.message, 'error'); }
        finally { this.saveBtn.disabled = false; this.saveBtn.innerHTML = `${UI.check} Guardar`; }
      });
      this.cancelBtn = makeHandler(this.cancelBtn, close);
      this.closeBtn = makeHandler(this.closeBtn, close);
      this.el.onclick = (e) => { if (e.target === this.el) close(); };
    }
  };

  // ===== SECTION LOADER =====
  function loadSection(section) {
    const loaders = {
      dashboard: loadDashboard, moods: loadMoods, razones: loadRazones,
      canciones: loadCanciones, regalos: loadRegalos, noticias: loadNoticias,
      maldia: loadMaldia, series: loadSeries, usuarios: loadUsuarios, actividad: loadActividad
    };
    if (loaders[section]) loaders[section]();
  }

  // ===== BIND LIST ACTIONS =====
  function bindActions(actions) {
    if (!actions || actions.length === 0) return;
    const items = content.querySelectorAll('.admin-list-item');
    items.forEach((row, idx) => {
      const a = actions[idx];
      if (!a) return;
      const editBtn = row.querySelector('[data-action="edit"]');
      const delBtn = row.querySelector('[data-action="delete"]');
      if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); if (a.edit) a.edit(); };
      if (delBtn) delBtn.onclick = (e) => { e.stopPropagation(); if (a.delete) a.delete(); };
    });
  }

  // ===== HELPERS =====
  const esc = (s) => db.escapeHtml ? db.escapeHtml(s) : String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const field = (label, html) => `<div class="admin-field"><label>${label}</label>${html}</div>`;
  const input = (id, val = '', ph = '', type = 'text') =>
    `<input type="${type}" id="${id}" value="${esc(val)}" placeholder="${ph}">`;
  const textarea = (id, val = '', ph = '') =>
    `<textarea id="${id}" placeholder="${ph}">${esc(val)}</textarea>`;
  const select = (id, options, current) =>
    `<select id="${id}">${options.map(v => `<option value="${v}"${current===v?' selected':''}>${v}</option>`).join('')}</select>`;
  const listItem = (title, sub) =>
    `<div class="admin-list-item"><div class="item-content"><div class="item-title">${title}</div>${sub ? `<div class="item-sub">${sub}</div>` : ''}</div><div class="item-actions"><button class="item-action-btn edit" data-action="edit">${UI.edit}</button><button class="item-action-btn delete" data-action="delete">${UI.trash}</button></div></div>`;
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  async function loadDashboard() {
    const [reasons, songs, gifts, users, moods] = await Promise.all([
      db.getReasons(), db.getSongs(), db.getGifts(), db.listUsers(), db.getMoods()
    ]);
    const moodCount = Object.keys(moods||{}).length;

    // Count unique users in moods
    const moodUserIds = new Set();
    Object.values(moods).forEach(m => { if (m.user_id) moodUserIds.add(m.user_id); });
    const realUsers = users.filter(u => !u.id.startsWith('local_') && u.id.length > 10);
    const activeMoodUsers = moodUserIds.size;

    // Today's mood summary
    const today = new Date().toISOString().split('T')[0];
    const todayMoods = Object.entries(moods).filter(([date]) => date === today);
    const todayMoodCount = todayMoods.length;

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.dash} Dashboard</h2></div>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${realUsers.length}</div><div class="stat-label">Usuarios reales</div></div>
          <div class="stat-card"><div class="stat-value">${activeMoodUsers}</div><div class="stat-label">Con estado de ánimo</div></div>
          <div class="stat-card"><div class="stat-value">${moodCount}</div><div class="stat-label">Días ánimo totales</div></div>
          <div class="stat-card"><div class="stat-value">${todayMoodCount}</div><div class="stat-label">Ánimos hoy</div></div>
          <div class="stat-card"><div class="stat-value">${reasons.length}</div><div class="stat-label">Razones</div></div>
          <div class="stat-card"><div class="stat-value">${songs.length}</div><div class="stat-label">Canciones</div></div>
          <div class="stat-card"><div class="stat-value">${(gifts?.gifts || []).length}</div><div class="stat-label">Regalos</div></div>
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
      const mood = monthMoods[ds];
      const isToday = ds === todayStr;
      html += `<div class="moods-cal-cell${isToday?' today':''}${mood?' has-mood':''}" title="${ds}: ${mood?mood.label:'Sin registro'}">
        <span class="moods-cal-day">${day}</span>${mood?`<span class="moods-cal-emoji">${mood.emoji||MOOD_EMOJIS[mood.mood]||'—'}</span>`:''}
      </div>`;
    }
    html += '</div>';
    calendar.innerHTML = html;

    const entries = Object.entries(monthMoods);
    if (entries.length === 0) {
      stats.innerHTML = '<div class="admin-empty">No hay datos de ánimo para este mes</div>';
      breakdown.innerHTML = '';
      return;
    }

    const counts = {};
    let totalScore = 0;
    entries.forEach(([_, m]) => {
      const k = m.mood || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
      totalScore += MOOD_SCORES[m.mood] !== undefined ? MOOD_SCORES[m.mood] : 1;
    });
    const avg = totalScore / entries.length;
    const avgEmoji = avg >= 3.5 ? '🤍🤍🤍' : avg >= 2.5 ? '😊' : avg >= 1.5 ? '😕' : avg >= 0.5 ? '😔' : '❤️';

    let bestMood = '', bestCount = 0;
    Object.entries(counts).forEach(([k, c]) => { if (c > bestCount) { bestCount = c; bestMood = k; } });

    stats.innerHTML = `<div class="moods-stats-row">
      <div class="moods-stat"><span class="moods-stat-num">${entries.length}</span><span class="moods-stat-label">días registrados</span></div>
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
  // 3. RAZONES
  // ==========================================
  async function loadRazones() {
    const items = await db.getReasons();
    const actions = [];
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.heart} Razones</h2>
          <button class="admin-btn admin-btn-primary" id="addBtn">${UI.plus} Añadir razón</button>
        </div>
        <div class="admin-list">${
          items.length === 0 ? '<div class="admin-empty">No hay razones todavía</div>' :
          items.map((r, i) => {
            const t = typeof r === 'string' ? r : r.text;
            actions.push({ edit: () => showRazonForm(i), delete: () => deleteRazon(i) });
            return listItem(esc(t), `#${i+1}${r.category ? ` · ${esc(r.category)}` : ''}`);
          }).join('')
        }</div>
      </section>
    `;
    bindActions(actions);
    page.querySelector('#addBtn').onclick = () => showRazonForm();
  }

  function showRazonForm(idx) {
    db.getReasons().then(items => {
      const isEdit = idx !== undefined && idx !== null;
      const item = isEdit ? items[idx] : { text: '', category: '' };
      const t = typeof item === 'string' ? item : (item.text || '');
      modal.open(isEdit ? 'Editar razón' : 'Añadir razón',
        field('Texto *', textarea('fT', t, 'Escribe la razón...')) +
        field('Categoría', input('fC', item.category || '', 'ej: personalidad, físico...')),
        async () => {
          const t2 = getVal('fT');
          if (!t2) throw new Error('El texto no puede estar vacío');
          const cat = getVal('fC');
          const upd = [...items];
          const targetIdx = isEdit ? idx : upd.length;
          upd[targetIdx] = cat ? { text: t2, category: cat } : t2;
          await db.saveReasons(upd);
          db.logActivity(isEdit ? 'reason_updated' : 'reason_created', 'Razón ' + (isEdit ? 'actualizada' : 'añadida'));
        }
      );
    });
  }

  async function deleteRazon(idx) {
    if (!confirm('¿Eliminar esta razón?')) return;
    const items = await db.getReasons();
    items.splice(idx, 1);
    await db.saveReasons(items);
    db.logActivity('reason_deleted', 'Razón eliminada');
    showToast('Razón eliminada', 'info');
    loadSection('razones');
  }

  // ==========================================
  // 4. CANCIONES
  // ==========================================
  async function loadCanciones() {
    const items = await db.getSongs();
    const actions = [];
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.music} Canciones</h2>
          <button class="admin-btn admin-btn-primary" id="addBtn">${UI.plus} Añadir canción</button>
        </div>
        <div class="admin-list">${
          items.length === 0 ? '<div class="admin-empty">No hay canciones todavía</div>' :
          items.map((s, i) => {
            actions.push({ edit: () => showCancionForm(i), delete: () => deleteCancion(i) });
            return listItem(esc(s.title), `${esc(s.artist||'')}${s.album?` · ${esc(s.album)}`:''}`);
          }).join('')
        }</div>
      </section>
    `;
    bindActions(actions);
    page.querySelector('#addBtn').onclick = () => showCancionForm();
  }

  function showCancionForm(idx) {
    db.getSongs().then(items => {
      const isEdit = idx !== undefined && idx !== null;
      const item = isEdit ? items[idx] : { title: '', artist: '', album: '', cover: '', audio: '', lyrics: '' };
      modal.open(isEdit ? 'Editar canción' : 'Añadir canción',
        field('Título *', input('fT', item.title, 'título')) +
        field('Artista', input('fA', item.artist||'', 'artista')) +
        field('Álbum', input('fAl', item.album||'', 'álbum')) +
        field('URL Portada', input('fC', item.cover||'', 'https://...', 'url')) +
        field('URL Audio', input('fAu', item.audio||'', 'https://...', 'url')) +
        field('Letra', textarea('fL', item.lyrics||'', 'Letra de la canción...')),
        async () => {
          const title = getVal('fT');
          if (!title) throw new Error('El título es obligatorio');
          const upd = [...items];
          const n = { title, artist: getVal('fA'), album: getVal('fAl'), cover: getVal('fC'), audio: getVal('fAu'), lyrics: getVal('fL') };
          isEdit ? upd[idx] = n : upd.push(n);
          await db.saveSongs(upd);
          db.logActivity(isEdit ? 'song_updated' : 'song_created', `Canción: ${title}`);
        }
      );
    });
  }

  async function deleteCancion(idx) {
    if (!confirm('¿Eliminar esta canción?')) return;
    const items = await db.getSongs();
    items.splice(idx, 1);
    await db.saveSongs(items);
    db.logActivity('song_deleted', 'Canción eliminada');
    showToast('Canción eliminada', 'info');
    loadSection('canciones');
  }

  // ==========================================
  // 5. REGALOS
  // ==========================================
  async function loadRegalos() {
    const data = await db.getGifts();
    const items = data?.gifts || [];
    const actions = [];
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.gift} Regalos del Calendario</h2>
          <button class="admin-btn admin-btn-primary" id="addBtn">${UI.plus} Añadir regalo</button>
        </div>
        <div class="admin-list">${
          items.length === 0 ? '<div class="admin-empty">No hay regalos todavía</div>' :
          items.map((g, i) => {
            actions.push({ edit: () => showRegaloForm(i), delete: () => delRegalo(i) });
            return listItem(esc(g.title||g.id), `${g.type||'sin tipo'} · ${g.unlock?.value||'sin fecha'}`);
          }).join('')
        }</div>
      </section>
    `;
    bindActions(actions);
    page.querySelector('#addBtn').onclick = () => showRegaloForm();
  }

  function showRegaloForm(idx) {
    const isEdit = idx !== undefined && idx !== null;
    db.getGifts().then(data => {
      const items = data?.gifts || [];
      const item = isEdit ? items[idx] : { id:'', title:'', type:'letter', unlock:{mode:'date',value:''}, data:{content:''} };
      modal.open(isEdit ? 'Editar regalo' : 'Añadir regalo',
        field('ID *', input('fId', item.id, 'id único')) +
        field('Título *', input('fT', item.title, 'título')) +
        field('Tipo', select('fType', ['letter','cassette','giftBox','polaroid','video','surprise','quiz','wishlist','game'], item.type)) +
        field('Fecha desbloqueo', input('fD', item.unlock?.value||'', '', 'date')) +
        field('Contenido', textarea('fCo', item.data?.content||item.data?.message||'', 'Mensaje...')) +
        field('URL Juego', input('fR', item.redirectUrl||'', 'games/memoria.html', 'url') + '<small class="field-hint">Si es tipo Juego, URL aquí</small>'),
        async () => {
          const id = getVal('fId'), title = getVal('fT');
          if (!id || !title) throw new Error('ID y título son obligatorios');
          const upd = [...items];
          const n = { id, title, type: getVal('fType'), unlock: { mode:'date', value: getVal('fD') }, data: { content: getVal('fCo') }, redirectUrl: getVal('fR') };
          isEdit ? upd[idx] = n : upd.push(n);
          await db.saveGifts({ ...data, gifts: upd });
          db.logActivity(isEdit ? 'gift_updated' : 'gift_created', `Regalo: ${title}`);
        }
      );
    });
  }

  async function delRegalo(idx) {
    if (!confirm('¿Eliminar este regalo?')) return;
    const data = await db.getGifts();
    data.gifts.splice(idx, 1);
    await db.saveGifts(data);
    db.logActivity('gift_deleted', 'Regalo eliminado');
    showToast('Regalo eliminado', 'info');
    loadSection('regalos');
  }

  // ==========================================
  // 6. NOTICIAS
  // ==========================================
  async function loadNoticias() {
    const items = await db.getNews();
    const actions = [];
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.news} Noticias</h2>
          <button class="admin-btn admin-btn-primary" id="addBtn">${UI.plus} Añadir noticia</button>
        </div>
        <div class="admin-list">${
          items.length === 0 ? '<div class="admin-empty">No hay noticias todavía</div>' :
          items.map((n, i) => {
            actions.push({ edit: () => showNoticiaForm(i), delete: () => delNoticia(i) });
            return listItem(esc(n.title), `${n.date||''} · ${esc((n.description||'').slice(0,60))}`);
          }).join('')
        }</div>
      </section>
    `;
    bindActions(actions);
    page.querySelector('#addBtn').onclick = () => showNoticiaForm();
  }

  function showNoticiaForm(idx) {
    const isEdit = idx !== undefined && idx !== null;
    db.getNews().then(items => {
      const item = isEdit ? items[idx] : { date:'', title:'', description:'' };
      modal.open(isEdit ? 'Editar noticia' : 'Añadir noticia',
        field('Título *', input('fT', item.title, 'título')) +
        field('Fecha', input('fD', item.date||'', 'ej: 13 de julio de 2026')) +
        field('Descripción', textarea('fDe', item.description||'', 'Descripción...')),
        async () => {
          const t = getVal('fT');
          if (!t) throw new Error('El título es obligatorio');
          const upd = [...items];
          const n = { date: getVal('fD'), title: t, description: getVal('fDe') };
          isEdit ? upd[idx] = n : upd.push(n);
          await db.saveNews(upd);
          db.logActivity(isEdit ? 'news_updated' : 'news_created', `Noticia: ${t}`);
        }
      );
    });
  }

  async function delNoticia(idx) {
    if (!confirm('¿Eliminar esta noticia?')) return;
    const items = await db.getNews();
    items.splice(idx, 1);
    await db.saveNews(items);
    db.logActivity('news_deleted', 'Noticia eliminada');
    showToast('Noticia eliminada', 'info');
    loadSection('noticias');
  }

  // ==========================================
  // 7. MAL DÍA
  // ==========================================
  async function loadMaldia() {
    const [frases, mensajes] = await Promise.all([db.getMaldiaFrases(), db.getMaldiaMensajes()]);
    const af = [], am = [];
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header"><h2>${UI.sun} Mal Día</h2></div>
        <div class="admin-subsection">
          <div class="admin-section-header"><h3>Frases</h3><button class="admin-btn admin-btn-primary admin-btn-sm" id="addFrase">${UI.plus} Añadir</button></div>
          <div class="admin-list">${
            frases.length === 0 ? '<div class="admin-empty">No hay frases</div>' :
            frases.map((f, i) => {
              af.push({ edit: () => showTextForm('frase', i, db.getMaldiaFrases, db.saveMaldiaFrases), delete: () => delTextItem('frase', i, db.getMaldiaFrases, db.saveMaldiaFrases) });
              return listItem(esc(f.slice(0,80)+(f.length>80?'...':'')), '');
            }).join('')
          }</div>
        </div>
        <div class="admin-subsection">
          <div class="admin-section-header"><h3>Mensajes diarios</h3><button class="admin-btn admin-btn-primary admin-btn-sm" id="addMensaje">${UI.plus} Añadir</button></div>
          <div class="admin-list">${
            mensajes.length === 0 ? '<div class="admin-empty">No hay mensajes</div>' :
            mensajes.map((m, i) => {
              am.push({ edit: () => showTextForm('mensaje', i, db.getMaldiaMensajes, db.saveMaldiaMensajes), delete: () => delTextItem('mensaje', i, db.getMaldiaMensajes, db.saveMaldiaMensajes) });
              return listItem(esc(m.slice(0,80)+(m.length>80?'...':'')), '');
            }).join('')
          }</div>
        </div>
      </section>
    `;
    bindActions([...af, ...am]);
    page.querySelector('#addFrase')?.addEventListener('click', () => showTextForm('frase', null, db.getMaldiaFrases, db.saveMaldiaFrases));
    page.querySelector('#addMensaje')?.addEventListener('click', () => showTextForm('mensaje', null, db.getMaldiaMensajes, db.saveMaldiaMensajes));
  }

  function showTextForm(label, idx, getFn, saveFn) {
    const isEdit = idx !== null && idx !== undefined;
    getFn().then(items => {
      const item = isEdit ? items[idx] : '';
      modal.open(isEdit ? `Editar ${label}` : `Añadir ${label}`,
        field(`Texto del ${label}`, textarea('fText', item, `Escribe el ${label}...`)),
        async () => {
          const t = getVal('fText');
          if (!t) throw new Error(`El ${label} no puede estar vacío`);
          const upd = [...items];
          isEdit ? upd[idx] = t : upd.push(t);
          await saveFn(upd);
          db.logActivity(isEdit ? 'maldia_updated' : 'maldia_created', `${label} actualizado`);
        }
      );
    });
  }

  async function delTextItem(label, idx, getFn, saveFn) {
    if (!confirm(`¿Eliminar este ${label}?`)) return;
    const items = await getFn();
    items.splice(idx, 1);
    await saveFn(items);
    db.logActivity('maldia_deleted', `${label} eliminado`);
    showToast(`${label} eliminado`, 'info');
    loadSection('maldia');
  }

  // ==========================================
  // 8. SERIES
  // ==========================================
  async function loadSeries() {
    const items = await db.getSeries();
    const actions = [];
    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.tv} Series y Películas</h2>
          <button class="admin-btn admin-btn-primary" id="addBtn">${UI.plus} Añadir contenido</button>
        </div>
        <div class="admin-list">${
          items.length === 0 ? '<div class="admin-empty">No hay series/películas</div>' :
          items.map((s, i) => {
            actions.push({ edit: () => showSerieForm(i), delete: () => delSerie(i) });
            return listItem(esc(s.titulo||s.title||s.id), `${s.tipo||''}${s.totalEpisodios?` · ${s.totalEpisodios} eps`:''}`);
          }).join('')
        }</div>
      </section>
    `;
    bindActions(actions);
    page.querySelector('#addBtn').onclick = () => showSerieForm();
  }

  function showSerieForm(idx) {
    const isEdit = idx !== undefined && idx !== null;
    db.getSeries().then(items => {
      const item = isEdit ? items[idx] : { titulo:'', tipo:'serie', portada:'', web:'', totalEpisodios:0 };
      modal.open(isEdit ? 'Editar contenido' : 'Añadir contenido',
        field('Título *', input('fT', item.titulo||item.title||'', 'título')) +
        field('Tipo', select('fTipo', ['serie', 'pelicula'], item.tipo||'serie')) +
        field('URL Portada', input('fP', item.portada||'', 'https://...', 'url')) +
        field('URL Web', input('fW', item.web||'', 'https://...', 'url')) +
        field('Total episodios', input('fE', item.totalEpisodios||0, '', 'number')),
        async () => {
          const t = getVal('fT');
          if (!t) throw new Error('El título es obligatorio');
          const upd = [...items];
          const n = { titulo:t, title:t, tipo:getVal('fTipo'), portada:getVal('fP'), web:getVal('fW'), totalEpisodios:parseInt(getVal('fE'))||0, id: db.generateId() };
          isEdit ? Object.assign(upd[idx], n) : upd.push(n);
          await db.saveSeries(upd);
          db.logActivity(isEdit ? 'series_updated' : 'series_created', `Contenido: ${t}`);
        }
      );
    });
  }

  async function delSerie(idx) {
    if (!confirm('¿Eliminar este contenido?')) return;
    const items = await db.getSeries();
    items.splice(idx, 1);
    await db.saveSeries(items);
    db.logActivity('series_deleted', 'Contenido eliminado');
    showToast('Contenido eliminado', 'info');
    loadSection('series');
  }

  // ==========================================
  // 9. USUARIOS
  // ==========================================
  async function loadUsuarios() {
    const [users, allMoods] = await Promise.all([
      db.listUsers(),
      db.getMoods()
    ]);

    // Calculate mood stats per user
    const userMoodStats = {};
    Object.entries(allMoods).forEach(([date, data]) => {
      const uid = data.user_id || 'local';
      if (!userMoodStats[uid]) {
        userMoodStats[uid] = { total: 0, moods: {}, lastDate: '' };
      }
      userMoodStats[uid].total++;
      const moodId = data.mood || 'unknown';
      userMoodStats[uid].moods[moodId] = (userMoodStats[uid].moods[moodId] || 0) + 1;
      if (date > userMoodStats[uid].lastDate) userMoodStats[uid].lastDate = date;
    });

    content.innerHTML = `
      <section class="admin-section active">
        <div class="admin-section-header">
          <h2>${UI.users} Usuarios <span class="admin-count-badge">${users.length}</span></h2>
          <button class="admin-btn admin-btn-primary" id="addBtn">${UI.plus} Nuevo usuario</button>
        </div>
        <div class="admin-search"><input type="text" id="userSearch" class="admin-search-input" placeholder="Buscar usuarios por nombre, email o rol..."></div>
        <div class="admin-list" id="userList">${renderUsers(users, userMoodStats)}</div>
      </section>
    `;

    page.querySelector('#addBtn').onclick = () => showUserForm();
    page.querySelector('#userSearch').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      const f = users.filter(u =>
        (u.email||'').toLowerCase().includes(q) ||
        (u.name||'').toLowerCase().includes(q) ||
        (u.role||'').includes(q)
      );
      page.querySelector('#userList').innerHTML = renderUsers(f, userMoodStats);
    });

    // Click on user to see detail
    page.querySelector('#userList').addEventListener('click', function(e) {
      const item = e.target.closest('.admin-list-item');
      if (!item || item.dataset.noClick) return;
      const userId = item.dataset.userId;
      const user = users.find(u => u.id === userId);
      if (user) showUserDetail(user, userMoodStats[userId]);
    });
  }

  function renderUsers(users, moodStats) {
    if (users.length === 0) return '<div class="admin-empty">No hay usuarios</div>';
    return users.map(u => {
      const initial = (u.name||u.email||'?').charAt(0).toUpperCase();
      const status = u.enabled !== false ? '🟢' : '🔴';
      const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString('es') : '—';
      const stats = moodStats[u.id];
      const moodBadge = stats && stats.total > 0
        ? getMoodSummaryBadge(stats)
        : '<span class="user-mood-none">Sin datos</span>';

      return `<div class="admin-list-item" data-user-id="${esc(u.id)}" style="cursor:pointer">
        <div class="user-avatar-sm">
          ${u.photo
            ? `<img src="${esc(u.photo)}" class="user-avatar-img">`
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

  function showUserDetail(user, stats) {
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
        <h3 style="font-size:1rem;margin:0 0 12px;">${UI.heart} Historial de Ánimo</h3>
        ${moodHtml}
      </div>
    `, async () => {});
  }

  function showUserForm() {
    modal.open('Nuevo usuario',
      field('Usuario *', input('uU', '', 'nombre usuario')) +
      field('Contraseña *', input('uP', '', 'contraseña', 'password')) +
      field('Nombre', input('uN', '', 'Nombre completo')) +
      field('Foto URL', input('uPh', '', 'https://...', 'url')) +
      field('Rol', select('uR', ['user', 'admin'], 'user')),
      async () => {
        const u = getVal('uU'), p = getVal('uP');
        if (!u || !p) throw new Error('Usuario y contraseña son obligatorios');
        await db.createUser({ username:u, password:p, name:getVal('uN')||u, photo:getVal('uPh'), role:getVal('uR') });
      }
    );
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
            return `<div class="admin-list-item">
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
  // INIT
  // ==========================================
  loadSection('dashboard');

  return page;
}
