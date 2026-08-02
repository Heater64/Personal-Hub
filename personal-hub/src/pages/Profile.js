/* ==========================================
   Personal Hub v2 — Profile Page
   Cuenta, apariencia, accesibilidad, seguridad, admin
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';
import { theme } from '../services/theme.service.js';
import { moodStore } from '../stores/mood.store.js';
import { showToast } from '../components/Toast.js';
import { db } from '../services/db.service.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { requestEnable, disable } from '../services/notifications.service.js';
import { escapeHtml } from '../utils/escape.js';

// ==========================================
// SVG ICONS
// ==========================================
const UI = {
  palette: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.56 1.5-1.5 0-.37-.14-.72-.38-1-.23-.28-.37-.63-.37-1 0-.93.67-1.5 1.5-1.5H16c5 0 8-3.48 8-8C24 6.5 19.5 2 12 2z"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 3v1m0 16v1m-9-9H2m20 0h-1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  monitor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  camera: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  save: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  logout: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  arrowRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  sparkles: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"/><path d="M8 8a5 5 0 0 0 5 5 5 5 0 0 0-5 5 5 5 0 0 0-5-5 5 5 0 0 0 5-5Z"/></svg>',
  adminShield: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

export function ProfilePage(router) {
  const user = userStore.getUser();

  const page = document.createElement('div');
  page.className = 'profile-page';

  const themeOptions = theme.getAvailable();
  const currentTheme = theme.currentTheme;

  // Theme icon mapping
  const themeIcons = { dark: UI.moon, light: UI.sun, auto: UI.monitor };
  const themeLabels = { dark: 'Oscuro', light: 'Claro', auto: 'Auto' };    page.innerHTML = `
    <!-- Header -->
    <div class="profile-header glass-card">
      <div class="profile-header__row">
        <div class="profile-avatar-wrap" id="profileAvatarWrap">
          <div class="profile-avatar" id="profileAvatar">
            ${user?.avatar
              ? `<img src="${escapeHtml(user.avatar)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="profile-initial fallback" id="profileInitial" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;">${escapeHtml((user?.name || 'U').charAt(0).toUpperCase())}</span>`
              : `<span class="profile-initial" id="profileInitial">${escapeHtml((user?.name || 'U').charAt(0).toUpperCase())}</span>`
            }
          </div>
          <span class="profile-avatar-edit" id="profileAvatarEdit">${UI.camera}</span>
          <input type="file" id="profileAvatarInput" accept="image/*" style="display:none">
        </div>
        <div class="profile-user-block">
          <h3 class="profile-name" id="profileName">${escapeHtml(user?.name || 'Usuario')}</h3>
          <p class="profile-role" id="profileRole">${userStore.isAdmin ? UI.adminShield + ' Admin' : UI.heart + ' Princesa'}</p>
          <p class="profile-email" id="profileEmail">${user?.email || ''}</p>
        </div>
      </div>
    </div>

    <!-- Theme -->
    <section class="profile-section glass-card">
      <div class="profile-section__header">
        <span class="profile-section__icon">${UI.palette}</span>
        <div>
          <h4>Apariencia</h4>
          <p class="text-muted text-sm">Modo de color</p>
        </div>
      </div>
      <div class="theme-options" id="themeOptions">
        ${themeOptions.map(t => `
          <button type="button" class="theme-btn ${t === currentTheme ? 'active' : ''}" data-theme="${t}">
            ${themeIcons[t] || UI.sun} ${themeLabels[t] || t}
          </button>
        `).join('')}
      </div>

      <!-- Large text -->
      <div class="profile-setting">
        <div class="profile-setting__info">
          <p class="profile-setting__label">Texto grande</p>
          <p class="profile-setting__desc">Aumenta el tamaño del texto</p>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="toggleLargeText">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </section>

    <!-- Account -->
    <section class="profile-section glass-card">
      <div class="profile-section__header">
        <span class="profile-section__icon">${UI.user}</span>
        <div>
          <h4>Cuenta</h4>
          <p class="text-muted text-sm">Tu información</p>
        </div>
      </div>
      <div class="profile-info-row"><span class="profile-info-label">Email</span><span class="profile-info-value">${user?.email || '—'}</span></div>
      <div class="profile-info-row"><span class="profile-info-label">Rol</span><span class="profile-info-value">${userStore.isAdmin ? 'Administrador' : 'Usuario'}</span></div>
    </section>

    <!-- Notifications -->
    <section class="profile-section glass-card">
      <div class="profile-section__header">
        <span class="profile-section__icon">🔔</span>
        <div>
          <h4>Notificaciones</h4>
          <p class="text-muted text-sm">Recordatorio diario a las 8:00 AM</p>
        </div>
      </div>
      <div class="profile-setting">
        <div class="profile-setting__info">
          <p class="profile-setting__label">Recordatorio de ánimo</p>
          <p class="profile-setting__desc">Recibe una notificación cada mañana para contestar cómo te sientes</p>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="toggleNotifications">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </section>

    <!-- Today's Mood -->
    <section class="profile-section glass-card">
      <div class="profile-section__header">
        <span class="profile-section__icon">${UI.heart}</span>
        <div>
          <h4>¿Cómo te sientes hoy?</h4>
          <p class="text-muted text-sm">Tu estado de ánimo de hoy</p>
        </div>
      </div>
      <div class="profile-mood-current" id="profileMoodCurrent"></div>
      <div class="profile-mood-selector" id="profileMoodSelector" style="display:none"></div>
      <div class="profile-mood-change">
        <button type="button" class="profile-btn" id="changeMoodBtn">${UI.edit} Cambiar estado de ánimo</button>
        <button type="button" class="profile-btn" id="saveMoodBtn" style="display:none">${UI.save} Guardar estado</button>
      </div>
    </section>

    <!-- App Info -->
    <section class="profile-section glass-card">
      <div class="profile-section__header">
        <span class="profile-section__icon">${UI.info}</span>
        <div>
          <h4>Información de la app</h4>
          <p class="text-muted text-sm">Versión y almacenamiento</p>
        </div>
      </div>
      <div class="profile-info-row"><span class="profile-info-label">Versión</span><span class="profile-info-value">2.0.0</span></div>
      <div class="profile-info-row"><span class="profile-info-label">Almacenamiento</span><span class="profile-info-value" id="storageUsed">Calculando...</span></div>
      <button class="profile-btn" id="clearCacheBtn">${UI.trash} Limpiar caché</button>
    </section>

    <!-- Admin (solo si es admin) -->
    ${userStore.isAdmin ? `
      <button class="profile-admin-btn glass-card" id="adminPanelBtn">
        <span class="profile-admin-btn-icon">${UI.settings}</span>
        <div class="profile-admin-btn-text">
          <strong>Panel de Administración</strong>
          <small>Gestionar contenido, usuarios y estadísticas</small>
        </div>
        <span class="profile-admin-btn-arrow">${UI.arrowRight}</span>
      </button>
    ` : ''}

    <!-- Security -->
    <section class="profile-section glass-card">
      <div class="profile-section__header">
        <span class="profile-section__icon">${UI.lock}</span>
        <div>
          <h4>Seguridad</h4>
          <p class="text-muted text-sm">Gestión de sesión</p>
        </div>
      </div>
      <button class="profile-btn profile-btn--danger" id="logoutBtn">${UI.logout} Cerrar sesión</button>
    </section>
  `;

  // ===== BIND EVENTS =====

  // Theme buttons
  const themeOptionsEl = page.querySelector('#themeOptions');
  themeOptionsEl.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      themeOptionsEl.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      theme.setTheme(btn.dataset.theme);
    });
  });

  // Large text toggle (user-scoped)
  const largeTextToggle = page.querySelector('#toggleLargeText');
  const isLargeText = getUserPref('largeText', '0') === '1';
  largeTextToggle.checked = isLargeText;
  document.documentElement.setAttribute('data-large-text', isLargeText ? 'true' : 'false');
  largeTextToggle.addEventListener('change', () => {
    const enabled = largeTextToggle.checked ? '1' : '0';
    setUserPref('largeText', enabled);
    document.documentElement.setAttribute('data-large-text', largeTextToggle.checked ? 'true' : 'false');
  });

  // ===== MOOD SECTION =====
  const moodCurrent = page.querySelector('#profileMoodCurrent');
  const moodSelector = page.querySelector('#profileMoodSelector');
  const changeMoodBtn = page.querySelector('#changeMoodBtn');
  const saveMoodBtn = page.querySelector('#saveMoodBtn');

  let selectedMood = null;

  function renderTodayMood() {
    const todayMood = moodStore.getTodayMood();
    if (todayMood) {
      moodCurrent.innerHTML = `
        <div class="profile-mood-badge">
          <span class="profile-mood-emoji">${todayMood.emoji}</span>
          <span class="profile-mood-label">${todayMood.label}</span>
        </div>
        <p class="profile-mood-note">Registrado hoy</p>
      `;
      changeMoodBtn.innerHTML = `${UI.edit} Cambiar estado`;
    } else {
      moodCurrent.innerHTML = `
        <p class="profile-mood-empty">Aún no has registrado cómo te sientes hoy 💭</p>
      `;
      changeMoodBtn.innerHTML = `${UI.sparkles} Contar cómo me siento`;
    }
  }

  function renderMoodSelector() {
    const moods = moodStore.getMoods();
    const todayMood = moodStore.getTodayMood();
    selectedMood = todayMood ? todayMood.id : null;

    // Set content FIRST while container is still hidden (display:none)
    // to prevent card collapse / empty flash
    moodSelector.innerHTML = moods.map((m, i) => `
      <button type="button" class="mood-btn ${selectedMood === m.id ? 'selected' : ''}" data-mood="${m.id}">
        <span class="mood-btn__emoji">${m.emoji}</span>
        <div class="mood-btn__text">
          <span class="mood-btn__label">${m.label}</span>
        </div>
        <span class="mood-btn__check">✓</span>
      </button>
    `).join('');

    // Now show the container — animations play from the start naturally
    moodSelector.style.display = 'flex';

    // Bind events
    moodSelector.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        moodSelector.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMood = btn.dataset.mood;
      });
    });

    saveMoodBtn.style.display = '';
    changeMoodBtn.style.display = 'none';
  }

  // Render local mood immediately, then sync with server and re-render
  renderTodayMood();
  moodStore.fetchTodayMood().then(() => renderTodayMood());

  changeMoodBtn.addEventListener('click', () => {
    moodCurrent.style.display = 'none';
    renderMoodSelector();
  });

  saveMoodBtn.addEventListener('click', async () => {
    if (!selectedMood) return;
    saveMoodBtn.disabled = true;
    saveMoodBtn.textContent = 'Guardando...';

    try {
      await moodStore.saveMood(selectedMood);
      showToast('💖 ¡Estado de ánimo actualizado!', 'success');
      moodCurrent.style.display = '';
      moodSelector.style.display = 'none';
      saveMoodBtn.style.display = 'none';
      changeMoodBtn.style.display = '';
      saveMoodBtn.disabled = false;
      saveMoodBtn.innerHTML = `${UI.save} Guardar estado`;
      renderTodayMood();
    } catch (err) {
      showToast('Error al guardar', 'error');
      saveMoodBtn.disabled = false;
      saveMoodBtn.innerHTML = `${UI.save} Guardar estado`;
    }
  });

  // Storage calculation
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      total += (localStorage.getItem(key) || '').length * 2; // UTF-16
    }
    const storageEl = page.querySelector('#storageUsed');
    storageEl.textContent = total > 1024 * 1024
      ? (total / (1024 * 1024)).toFixed(1) + ' MB'
      : (total / 1024).toFixed(1) + ' KB';
  } catch (e) { /* */ }

  // Clear cache (solo keys del Hub, respeta sesión de Supabase y tema)
  page.querySelector('#clearCacheBtn')?.addEventListener('click', () => {
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('ph.') || key.startsWith('personalHub.')) {
        localStorage.removeItem(key);
      }
    });
    showToast('Caché limpiado correctamente', 'success');
  });

  // Admin panel
  page.querySelector('#adminPanelBtn')?.addEventListener('click', () => {
    router.navigate('/admin');
  });

  // Avatar upload
  const avatarWrap = page.querySelector('#profileAvatarWrap');
  const avatarInput = page.querySelector('#profileAvatarInput');

  avatarWrap.addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Selecciona una imagen válida', 'error');
      return;
    }

    showToast('Subiendo avatar...', 'info');
    try {
      const url = await db.uploadAvatar(file);
      // Update local user store (do not re-persist to auth; uploadAvatar already did)
      userStore.updateProfile({ avatar: url }, false);
      // Update avatar display immediately
      const avatarContainer = page.querySelector('#profileAvatar');
      if (url) {
        avatarContainer.innerHTML = `<img src="${escapeHtml(url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      }
      showToast('Avatar actualizado', 'success');
    } catch (err) {
      console.error('[profile] avatar upload error:', err);
      showToast(err?.message || 'Error al subir el avatar', 'error');
    }
  });

  // Notifications toggle (user-scoped)
  const notifToggle = page.querySelector('#toggleNotifications');
  const notifEnabled = getUserPref('notifications', '0') === '1' && 'Notification' in window && Notification.permission === 'granted';
  if (notifToggle) {
    notifToggle.checked = notifEnabled;
    notifToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const ok = await requestEnable();
        if (ok) {
          showToast('🔔 Recordatorios activados', 'success');
        } else {
          e.target.checked = false;
          showToast(
            !('Notification' in window)
              ? 'Tu navegador no soporta notificaciones'
              : 'Permiso de notificaciones denegado',
            'error'
          );
        }
      } else {
        await disable();
      }
    });
  }

  // Logout
  page.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    try {
      await auth.signOut();
      router.navigate('/login');
    } catch (err) {
      showToast('Error al cerrar sesión', 'error');
    }
  });

  return page;
}
