/* ==========================================
   Personal Hub v2 — Profile Page
   Professional uniform layout
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';
import { theme } from '../services/theme.service.js';
import { moodStore } from '../stores/mood.store.js';
import { showToast } from '../components/Toast.js';
import { db } from '../services/db.service.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { requestEnable, disable, isPushSupported } from '../services/notifications.service.js';
import { escapeHtml } from '../utils/escape.js';
import { specialDates, loadSpecialDates, refreshSpecialDates } from '../utils/specialDates.js';

// ==========================================
// APP — versión y novedades
// ==========================================
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.1';

// Changelog real: cada versión con sus novedades (semver: fix → patch,
// función nueva → minor). Al subir una versión nueva solo hay que añadir
// su entrada al principio de la lista y actualizar APP_VERSION.
const WHATS_NEW = [
  {
    version: '1.1.1',
    items: [
      '🖼️ La galería carga las fotos al instante al entrar (antes había que tocar una pestaña)',
      '📁 La carpeta "Momentos" pasó de Memes a la Galería',
      '🎙️ En Audios puedes subir 1 o varios audios a la vez desde el panel Admin',
      '🌧️ Sección Mal Día rediseñada: frases, música y respiración guiada en un mismo lugar',
      '📅 Todos los días del calendario están disponibles para probar los regalos'
    ]
  },
  {
    version: '1.1.0',
    items: [
      '🎮 Juegos multijugador: invita a alguien, espera, juega en tiempo real y pide revancha',
      '🎙️ Nueva sección Audios en El Rincón: la cápsula de nuestros audios del día 3',
      '🎁 Regalos interactivos del calendario con cajita para responder',
      '📅 Calendario completo con juegos y regalos repartidos hasta el 31 de diciembre',
      '📺 Catálogo de series y películas reorganizado',
      '🔗 Escuchar juntos: comparte música con tu persona en tiempo real'
    ]
  },
  {
    version: '1.0.9',
    items: [
      '🐛 Correcciones menores de navegación y animaciones',
      '⚡ La app carga más rápido en el móvil'
    ]
  },
  {
    version: '1.0.8',
    items: [
      '💡 Curiosidades con pestaña detallada para cada dato',
      '🔍 Buscador en curiosidades y memes'
    ]
  },
  {
    version: '1.0.7',
    items: [
      '🧹 Limpieza de caché desde el perfil',
      '📊 Mejoras de rendimiento en la galería y los vídeos'
    ]
  },
  {
    version: '1.0.6',
    items: [
      '🖼️ Galería renovada: álbumes, favoritas, presentación y fotos subidas por el Admin',
      '😄 Memes organizados en álbumes'
    ]
  },
  {
    version: '1.0.5',
    items: [
      '🔔 Notificaciones diarias de ánimo y novedades',
      '👤 Perfil con avatar y nombre personalizados'
    ]
  },
  {
    version: '1.0.4',
    items: [
      '🌙 Modo oscuro, claro y automático',
      '🔤 Texto grande para que todo se lea mejor'
    ]
  },
  {
    version: '1.0.3',
    items: [
      '📅 Calendario con la sorpresa de cada día',
      '🎁 Regalos diarios desbloqueables'
    ]
  },
  {
    version: '1.0.2',
    items: [
      '🎮 Juegos clásicos: Snake, Buscaminas, Ahorcado y más',
      '🎵 Sección Canciones con la banda sonora de nuestro amor'
    ]
  },
  {
    version: '1.0.1',
    items: [
      '💖 Sección Sentimientos: Razones, Mal Día y Open When',
      '🧸 OsitosWorld: un mundo lleno de aventuras'
    ]
  },
  {
    version: '1.0.0',
    items: [
      '🚀 Lanzamiento de Personal Hub',
      '🏠 Inicio con el contador de nuestros días juntos',
      '🖼️ El Rincón: galería, memes y curiosidades',
      '📺 Sección Series y películas para seguir juntos'
    ]
  }
];

// ==========================================
// SVG ICONS
// ==========================================
const UI = {
  palette: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.56 1.5-1.5 0-.37-.14-.72-.38-1-.23-.28-.37-.63-.37-1 0-.93.67-1.5 1.5-1.5H16c5 0 8-3.48 8-8C24 6.5 19.5 2 12 2z"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 3v1m0 16v1m-9-9H2m20 0h-1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  monitor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  camera: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  save: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  logout: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  arrowRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  sparkles: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"/><path d="M8 8a5 5 0 0 0 5 5 5 5 0 0 0-5 5 5 5 0 0 0-5-5 5 5 0 0 0 5-5Z"/></svg>',
  adminShield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

export function ProfilePage(router) {
  const user = userStore.getUser();

  const page = document.createElement('div');
  page.className = 'profile-page';

  const themeOptions = theme.getAvailable();
  const currentTheme = theme.currentTheme;
  const themeIcons = { dark: UI.moon, light: UI.sun, auto: UI.monitor };
  const themeLabels = { dark: 'Oscuro', light: 'Claro', auto: 'Auto' };
  const isUserAdmin = userStore.isAdmin;
  const pushSupported = isPushSupported();

  page.innerHTML = `
    <!-- ===== HEADER ===== -->
    <div class="prof-header">
      <div class="prof-header-bg"></div>
      <div class="prof-header-body">
        <div class="prof-avatar-wrap" id="profileAvatarWrap">
          <div class="prof-avatar" id="profileAvatar">
            ${user?.avatar
              ? `<img src="${escapeHtml(user.avatar)}" alt="Avatar" onerror="this.style.display='none';var f=this.nextElementSibling;if(f){f.style.display='flex'}">`
              : ''
            }
            <span class="prof-avatar-initial" id="profileInitial" style="${user?.avatar ? 'display:none' : 'display:flex'}">${escapeHtml((user?.name || 'U').charAt(0).toUpperCase())}</span>
          </div>
          <span class="prof-avatar-edit">${UI.camera}</span>
          <input type="file" id="profileAvatarInput" accept="image/*" style="display:none">
        </div>
        <div class="prof-user-info">
          <div class="prof-name-row">
            <h1 class="prof-name" id="profileName">${escapeHtml(user?.name || 'Usuario')}</h1>
            <button class="prof-name-edit" id="editNameBtn" aria-label="Editar nombre" title="Editar nombre">${UI.edit}</button>
          </div>
          <div class="prof-name-editor" id="profileNameEditor" hidden>
            <input type="text" id="profileNameInput" class="prof-name-input" maxlength="40" aria-label="Nuevo nombre" autocomplete="off">
            <button type="button" class="prof-btn prof-btn--primary prof-btn--sm" id="profileNameSave">${UI.save} Guardar</button>
            <button type="button" class="prof-btn prof-btn--sm" id="profileNameCancel">Cancelar</button>
          </div>
          <div class="prof-meta">
            <span class="prof-badge">${isUserAdmin ? UI.adminShield + ' Admin' : UI.heart + ' Princesa'}</span>
            <span class="prof-email">${escapeHtml(user?.email || '')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== PREFERENCIAS ===== -->
    <div class="prof-group">
      <div class="prof-group-label">Preferencias</div>
      <div class="prof-card">

        <!-- Theme -->
        <div class="prof-row prof-row--header">
          <span class="prof-row-icon">${UI.palette}</span>
          <div class="prof-row-text">
            <span class="prof-row-title">Apariencia</span>
            <span class="prof-row-sub">Modo de color</span>
          </div>
        </div>
        <div class="prof-theme-opts" id="themeOptions">
          ${themeOptions.map(t => `
            <button type="button" class="prof-theme-btn ${t === currentTheme ? 'active' : ''}" data-theme="${t}">
              ${themeIcons[t] || UI.sun} ${themeLabels[t] || t}
            </button>
          `).join('')}
        </div>

        <div class="prof-divider"></div>

        <!-- Large text -->
        <div class="prof-row">
          <div class="prof-row-text">
            <span class="prof-row-title">Texto grande</span>
            <span class="prof-row-sub">Aumenta el tamaño del texto</span>
          </div>
          <label class="prof-toggle">
            <input type="checkbox" id="toggleLargeText">
            <span class="prof-toggle-slider"></span>
          </label>
        </div>

        <div class="prof-divider"></div>

        <!-- Notifications -->
        <div class="prof-row">
          <div class="prof-row-text">
            <span class="prof-row-title">Notificaciones</span>
            <span class="prof-row-sub">Recordatorio diario a las 8:00 AM <span id="pushStatus"></span></span>
          </div>
          <label class="prof-toggle">
            <input type="checkbox" id="toggleNotifications">
            <span class="prof-toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- ===== ESTADO DE ÁNIMO ===== -->
    <div class="prof-group">
      <div class="prof-group-label">Estado de ánimo</div>
      <div class="prof-card">
        <div class="prof-mood-display" id="profileMoodDisplay"></div>
        <div class="prof-mood-picker" id="profileMoodPicker" style="display:none"></div>
        <div class="prof-mood-actions">
          <button type="button" class="prof-btn" id="changeMoodBtn">${UI.sparkles} Contar cómo me siento</button>
          <button type="button" class="prof-btn prof-btn--primary" id="saveMoodBtn" style="display:none">${UI.save} Guardar estado</button>
        </div>
      </div>
    </div>

    <!-- ===== DÍAS ESPECIALES ===== -->
    <div class="prof-group">
      <div class="prof-group-label">Días especiales</div>
      <div class="prof-card">
        <div class="prof-days-head">
          <span class="prof-days-sub">Nuestros días importantes y lo que viene ✨</span>
          ${isUserAdmin ? `<button type="button" class="prof-days-edit" id="editDaysBtn" aria-label="Editar días especiales">${UI.edit} Editar</button>` : ''}
        </div>
        <div class="prof-days" id="profileSpecialDays"></div>
        ${isUserAdmin ? `
        <div class="prof-days-editor" id="profileDaysEditor" hidden>
          <div class="prof-days-field"><span class="prof-days-emoji-label">🤍</span><div class="prof-days-inputs"><input type="text" id="pdAnniversaryTitle" maxlength="40" placeholder="Título" aria-label="Título del aniversario"><input type="date" id="pdAnniversary"></div><label class="prof-days-recur"><input type="checkbox" id="pdAnniversaryRecur"><span>Se repite cada año</span></label></div>
          <div class="prof-days-field"><span class="prof-days-emoji-label">📅</span><div class="prof-days-inputs"><input type="text" id="pdHubStartTitle" maxlength="40" placeholder="Título" aria-label="Título del primer mensaje"><input type="date" id="pdHubStart"></div><label class="prof-days-recur"><input type="checkbox" id="pdHubStartRecur"><span>Se repite cada año</span></label></div>
          <div class="prof-days-field"><span class="prof-days-emoji-label">🎁</span><div class="prof-days-inputs"><input type="text" id="pdBirthdayTitle" maxlength="40" placeholder="Título" aria-label="Título del cumpleaños"><input type="date" id="pdBirthday"></div><label class="prof-days-recur"><input type="checkbox" id="pdBirthdayRecur"><span>Se repite cada año</span></label></div>
          <div class="prof-days-field"><span class="prof-days-emoji-label">🎂</span><div class="prof-days-inputs"><input type="text" id="pdUserBirthdayTitle" maxlength="40" placeholder="Título" aria-label="Título del cumpleaños del admin"><input type="date" id="pdUserBirthday"></div><label class="prof-days-recur"><input type="checkbox" id="pdUserBirthdayRecur"><span>Se repite cada año</span></label></div>
          <div class="prof-days-events">
            <span class="prof-days-events-title">✨ Próximas cosas <small>(marca ♻️ si se repite cada año)</small></span>
            <div id="pdEventsList"></div>
            <button type="button" class="prof-btn prof-btn--sm" id="pdAddEvent">+ Añadir evento</button>
          </div>
          <div class="prof-days-editor-actions">
            <button type="button" class="prof-btn prof-btn--primary" id="pdSave">${UI.save} Guardar</button>
            <button type="button" class="prof-btn" id="pdCancel">Cancelar</button>
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- ===== ALMACENAMIENTO ===== -->
    <div class="prof-group">
      <div class="prof-group-label">Almacenamiento</div>
      <div class="prof-card">
        <div class="prof-storage-bar-wrap">
          <div class="prof-storage-bar" id="storageBar"><div class="prof-storage-bar-fill" id="storageBarFill" style="width:0%"></div></div>
          <div class="prof-storage-info">
            <span class="prof-storage-used" id="storageUsed">Calculando...</span>
            <span class="prof-storage-limit">de ~5 MB disponibles</span>
          </div>
        </div>
        <button class="prof-btn prof-btn--sm" id="clearCacheBtn">${UI.trash} Limpiar caché</button>
      </div>
    </div>

    <!-- ===== APP ===== -->
    <div class="prof-group">
      <div class="prof-group-label">App</div>
      <div class="prof-card">
        <div class="prof-row">
          <div class="prof-row-text">
            <span class="prof-row-title">Versión</span>
            <span class="prof-row-sub">Personal Hub PWA</span>
          </div>
          <span class="prof-row-value" id="appVersion">${APP_VERSION}</span>
        </div>
        <div class="prof-divider"></div>
        <button class="prof-app-btn" id="noveltiesBtn" type="button">
          <span class="prof-app-btn-text">
            <strong>Novedades</strong>
            <small>Qué hay de nuevo en cada versión</small>
          </span>
          ${UI.arrowRight}
        </button>
      </div>
    </div>

    <!-- ===== ADMIN ===== -->
    ${isUserAdmin ? `
      <button class="prof-admin-btn" id="adminPanelBtn">
        <span class="prof-admin-icon">${UI.settings}</span>
        <div class="prof-admin-text">
          <strong>Panel de Administración</strong>
          <small>Gestionar contenido, usuarios y estadísticas</small>
        </div>
        ${UI.arrowRight}
      </button>
    ` : ''}

    <!-- ===== SEGURIDAD ===== -->
    <div class="prof-group">
      <div class="prof-group-label">Seguridad</div>
      <div class="prof-card">
        <button class="prof-btn prof-btn--danger" id="logoutBtn">${UI.logout} Cerrar sesión</button>
      </div>
    </div>
  `;

  // ===== THEME =====
  const themeOptsEl = page.querySelector('#themeOptions');
  themeOptsEl.querySelectorAll('.prof-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      themeOptsEl.querySelectorAll('.prof-theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      theme.setTheme(btn.dataset.theme);
    });
  });

  // ===== LARGE TEXT =====
  const largeTextToggle = page.querySelector('#toggleLargeText');
  const isLargeText = getUserPref('largeText', '0') === '1';
  largeTextToggle.checked = isLargeText;
  document.documentElement.setAttribute('data-large-text', isLargeText ? 'true' : 'false');
  largeTextToggle.addEventListener('change', () => {
    setUserPref('largeText', largeTextToggle.checked ? '1' : '0');
    document.documentElement.setAttribute('data-large-text', largeTextToggle.checked ? 'true' : 'false');
  });

  // ===== MOOD =====
  const moodDisplay = page.querySelector('#profileMoodDisplay');
  const moodPicker = page.querySelector('#profileMoodPicker');
  const changeMoodBtn = page.querySelector('#changeMoodBtn');
  const saveMoodBtn = page.querySelector('#saveMoodBtn');
  let selectedMood = null;

  function renderTodayMood() {
    const todayMood = moodStore.getTodayMood();
    if (todayMood) {
      moodDisplay.innerHTML = `
        <div class="prof-mood-badge">
          <span class="prof-mood-emoji">${todayMood.emoji}</span>
          <span class="prof-mood-label">${todayMood.label}</span>
        </div>
      `;
      changeMoodBtn.innerHTML = `${UI.edit} Cambiar estado`;
    } else {
      moodDisplay.innerHTML = `
        <span class="prof-mood-empty">Aún no has registrado cómo te sientes hoy 💭</span>
      `;
      changeMoodBtn.innerHTML = `${UI.sparkles} Contar cómo me siento`;
    }
  }

  function renderMoodPicker() {
    const moods = moodStore.getMoods();
    const todayMood = moodStore.getTodayMood();
    selectedMood = todayMood ? todayMood.id : null;

    moodPicker.innerHTML = moods.map(m => `
      <button type="button" class="prof-mood-btn ${selectedMood === m.id ? 'selected' : ''}" data-mood="${m.id}">
        <span class="prof-mood-btn-emoji">${m.emoji}</span>
        <span class="prof-mood-btn-label">${m.label}</span>
        <span class="prof-mood-btn-check">✓</span>
      </button>
    `).join('');
    moodPicker.style.display = 'flex';

    moodPicker.querySelectorAll('.prof-mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Tocar la emoción ya seleccionada la DESELECCIONA (puede quedar sin emoción)
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          selectedMood = null;
          return;
        }
        moodPicker.querySelectorAll('.prof-mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMood = btn.dataset.mood;
      });
    });

    saveMoodBtn.style.display = '';
    changeMoodBtn.style.display = 'none';
  }

  renderTodayMood();
  moodStore.fetchTodayMood().then(() => renderTodayMood());

  changeMoodBtn.addEventListener('click', () => {
    renderMoodPicker();
  });

  saveMoodBtn.addEventListener('click', async () => {
    saveMoodBtn.disabled = true;
    saveMoodBtn.textContent = 'Guardando...';

    try {
      if (selectedMood) {
        await moodStore.saveMood(selectedMood);
        showToast('💖 ¡Estado de ánimo actualizado!', 'success');
      } else {
        // Sin emoción seleccionada → quita el estado de hoy (si está en su ventana)
        const res = await moodStore.removeTodayMood();
        if (res.locked) showToast('Este ánimo ya quedó registrado 🤍', 'info');
        else if (res.removed) showToast('Ánimo eliminado · hoy sin emoción', 'info');
      }
      moodPicker.style.display = 'none';
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

  // ===== DÍAS ESPECIALES =====
  function dayBadge(iso, recurring) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let target;
    if (recurring) {
      // Se repite cada año: siempre hay una próxima vez (la de este año o la del siguiente).
      const [y, m, d] = iso.split('-').map(Number);
      target = new Date(now.getFullYear(), m - 1, d);
      if (target < now) target = new Date(now.getFullYear() + 1, m - 1, d);
    } else {
      target = new Date(iso + 'T00:00:00');
    }
    const days = Math.round((target - now) / 864e5);
    if (days === 0) return '<span class="prof-day-badge is-today">¡Hoy! 💫</span>';
    if (days > 0) return `<span class="prof-day-badge is-future">En ${days} día${days === 1 ? '' : 's'}</span>`;
    return '<span class="prof-day-badge is-past">Ya pasó</span>';
  }

  function renderSpecialDays() {
    const el = page.querySelector('#profileSpecialDays');
    if (!el) return;
    const d = specialDates();
    const t = d.titles || {};
    const r = d.recurring || {};
    const fmt = (iso) => new Date(iso + 'T00:00:00')
      .toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    const items = [
      { emoji: '🤍', title: t.anniversary || 'Aniversario', date: d.anniversary, recurring: r.anniversary !== false },
      { emoji: '🎁', title: t.birthday || 'Cumpleaños de dada', date: d.birthday, recurring: r.birthday !== false },
      { emoji: '🎂', title: t.userBirthday || 'Tu cumpleaños', date: d.userBirthday, recurring: r.userBirthday !== false },
      { emoji: '📅', title: t.hubStart || 'Primer mensaje', date: d.hubStart, recurring: r.hubStart === true },
      ...(d.events || []).map(e => ({ emoji: '✨', title: e.title, date: e.date, recurring: e.recurring === true }))
    ].filter(it => it.date);
    if (!items.length) {
      el.innerHTML = '<p class="prof-days-empty">Aún no hay días especiales 💭</p>';
      return;
    }
    el.innerHTML = items.map(it => `
      <div class="prof-day">
        <span class="prof-day-emoji">${it.emoji}</span>
        <div class="prof-day-body">
          <span class="prof-day-title">${escapeHtml(it.title)}</span>
          <span class="prof-day-date">${fmt(it.date)}${it.recurring ? '<span class="prof-day-note">· cada año</span>' : ''}</span>
        </div>
        ${dayBadge(it.date, it.recurring)}
      </div>`).join('');
  }

  // Editor (solo admin): edita las 4 fechas principales y las próximas cosas.
  const daysEditor = page.querySelector('#profileDaysEditor');
  const editDaysBtn = page.querySelector('#editDaysBtn');
  let editingDays = [];

  const eventRowHTML = (e) => {
    const uid = e.id || 'ev' + Math.random().toString(36).slice(2, 8);
    return `
      <div class="prof-days-event-row" data-ev-id="${uid}">
        <input type="text" class="prof-days-event-title" placeholder="Qué es (p. ej. Viaje a la playa)" value="${escapeHtml(e.title || '')}" maxlength="60" aria-label="Nombre del evento">
        <input type="date" class="prof-days-event-date" value="${escapeHtml(e.date || '')}" aria-label="Fecha del evento">
        <label class="prof-days-event-recur" title="Se repite cada año"><input type="checkbox" class="prof-days-event-recur-cb" ${e.recurring === true ? 'checked' : ''}><span>♻️</span></label>
        <button type="button" class="prof-days-event-del" aria-label="Quitar evento">✕</button>
      </div>`;
  };

  const renderEventRows = () => {
    const list = page.querySelector('#pdEventsList');
    if (!list) return;
    list.innerHTML = editingDays.map(eventRowHTML).join('');
    list.querySelectorAll('.prof-days-event-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.prof-days-event-row');
        const idx = editingDays.findIndex(e => (e.id || '') === row.dataset.evId);
        if (idx >= 0) { editingDays.splice(idx, 1); renderEventRows(); }
      });
    });
  };

  function openDaysEditor() {
    const d = specialDates();
    const t = d.titles || {};
    const r = d.recurring || {};
    editingDays = (d.events || []).map(e => ({ ...e }));
    const set = (id, v) => { const el = page.querySelector(id); if (el) el.value = v || ''; };
    const setCheck = (id, v) => { const el = page.querySelector(id); if (el) el.checked = !!v; };
    set('#pdAnniversary', d.anniversary); set('#pdAnniversaryTitle', t.anniversary || ''); setCheck('#pdAnniversaryRecur', r.anniversary !== false);
    set('#pdHubStart', d.hubStart); set('#pdHubStartTitle', t.hubStart || ''); setCheck('#pdHubStartRecur', r.hubStart === true);
    set('#pdBirthday', d.birthday); set('#pdBirthdayTitle', t.birthday || ''); setCheck('#pdBirthdayRecur', r.birthday !== false);
    set('#pdUserBirthday', d.userBirthday); set('#pdUserBirthdayTitle', t.userBirthday || ''); setCheck('#pdUserBirthdayRecur', r.userBirthday !== false);
    renderEventRows();
    daysEditor.hidden = false;
    daysEditor.scrollIntoView({ block: 'nearest' });
  }

  editDaysBtn?.addEventListener('click', openDaysEditor);
  page.querySelector('#pdAddEvent')?.addEventListener('click', () => {
    editingDays.push({ id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', date: '' });
    renderEventRows();
  });
  page.querySelector('#pdSave')?.addEventListener('click', async () => {
    const rows = [...page.querySelectorAll('.prof-days-event-row')].map(row => ({
      id: row.dataset.evId,
      title: row.querySelector('.prof-days-event-title').value.trim(),
      date: row.querySelector('.prof-days-event-date').value,
      recurring: row.querySelector('.prof-days-event-recur-cb')?.checked === true
    }));
    const payload = {
      anniversary: page.querySelector('#pdAnniversary').value,
      hubStart: page.querySelector('#pdHubStart').value,
      birthday: page.querySelector('#pdBirthday').value,
      userBirthday: page.querySelector('#pdUserBirthday').value,
      titles: {
        anniversary: page.querySelector('#pdAnniversaryTitle').value,
        hubStart: page.querySelector('#pdHubStartTitle').value,
        birthday: page.querySelector('#pdBirthdayTitle').value,
        userBirthday: page.querySelector('#pdUserBirthdayTitle').value
      },
      recurring: {
        anniversary: page.querySelector('#pdAnniversaryRecur')?.checked === true,
        hubStart: page.querySelector('#pdHubStartRecur')?.checked === true,
        birthday: page.querySelector('#pdBirthdayRecur')?.checked === true,
        userBirthday: page.querySelector('#pdUserBirthdayRecur')?.checked === true
      },
      events: rows
    };
    if (!payload.anniversary || !payload.hubStart || !payload.birthday || !payload.userBirthday) {
      showToast('Rellena las cuatro fechas principales', 'error');
      return;
    }
    try {
      await db.saveHubDates(payload);
      await refreshSpecialDates().catch(() => {});
      daysEditor.hidden = true;
      renderSpecialDays();
      showToast('Días especiales guardados', 'success');
    } catch (err) {
      console.error('[profile] fechas especiales:', err);
      showToast(err?.message || 'No se pudieron guardar', 'error');
    }
  });
  page.querySelector('#pdCancel')?.addEventListener('click', () => { daysEditor.hidden = true; });

  renderSpecialDays();
  loadSpecialDates().then(() => renderSpecialDays()).catch(() => {});

  // ===== STORAGE =====
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      total += (localStorage.getItem(localStorage.key(i)) || '').length * 2;
    }
    const maxBytes = 5 * 1024 * 1024; // 5 MB reference
    const pct = Math.min(100, (total / maxBytes) * 100);
    const storageEl = page.querySelector('#storageUsed');
    const barFill = page.querySelector('#storageBarFill');
    if (storageEl) {
      storageEl.textContent = total > 1024 * 1024
        ? (total / (1024 * 1024)).toFixed(1) + ' MB usados'
        : (total / 1024).toFixed(1) + ' KB usados';
    }
    if (barFill) barFill.style.width = pct + '%';
  } catch (e) { /* */ }

  page.querySelector('#clearCacheBtn')?.addEventListener('click', () => {
    // Esta acción borra CACHÉS EFÍMERAS (no los datos del usuario: fotos
    // subidas, progreso del calendario, favoritos ni catálogos).
    if (!confirm('¿Limpiar la caché de la app?\n\nSe borrarán duraciones de canciones, proporciones de fotos y datos temporales. Tus fotos, recuerdos y progreso se conservan.')) return;

    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    // Solo claves efímeras regenerables (aisladas por usuario).
    // Se conservan los datos del usuario: fotos, progreso, favoritos…
    const userId = userStore.getUser()?.id;
    ['trackDurations', 'galleryRatios', 'trackCache'].forEach(base => {
      localStorage.removeItem(`ph.${base}`);
      if (userId) localStorage.removeItem(`ph.${base}.${userId}`);
    });
    // Preferencias del sistema que no son contenido
    localStorage.removeItem('ph.theme');
    showToast('Caché limpiada correctamente', 'success');
  });

  // ===== ADMIN =====
  page.querySelector('#adminPanelBtn')?.addEventListener('click', () => {
    router.navigate('/admin');
  });

  // ===== AVATAR =====
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
      userStore.updateProfile({ avatar: url }, false);
      // Sincroniza también la tabla profiles (best effort): Admin, rivales e
      // invitaciones de juego leen de ahí para mostrar la foto.
      db.saveProfile({ avatar: url }).catch(err => console.warn('[profile] sync avatar:', err?.message));
      const avatarEl = page.querySelector('#profileAvatar');
      if (url && avatarEl) {
        const initial = avatarEl.querySelector('.prof-avatar-initial');
        const existingImg = avatarEl.querySelector('img');
        if (existingImg) existingImg.src = url;
        else {
          avatarEl.insertAdjacentHTML('afterbegin', `<img src="${escapeHtml(url)}" alt="Avatar">`);
        }
        if (initial) initial.style.display = 'none';
      }
      showToast('Avatar actualizado', 'success');
    } catch (err) {
      console.error('[profile] avatar upload error:', err);
      showToast(err?.message || 'Error al subir el avatar', 'error');
    }
  });

  // ===== NOTIFICATIONS =====
  const notifToggle = page.querySelector('#toggleNotifications');
  const notifEnabled = getUserPref('notifications', '0') === '1' && 'Notification' in window && Notification.permission === 'granted';
  if (notifToggle) {
    notifToggle.checked = notifEnabled;
    const pushStatusEl = page.querySelector('#pushStatus');
    if (pushStatusEl) {
      if (pushSupported && notifEnabled) {
        pushStatusEl.textContent = '· Push activo';
        pushStatusEl.className = 'prof-push-status prof-push--active';
      } else if (notifEnabled) {
        pushStatusEl.textContent = '· fallback local';
        pushStatusEl.className = 'prof-push-status prof-push--fallback';
      }
    }

    notifToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const ok = await requestEnable();
        if (ok) {
          showToast('🔔 Recordatorios activados' + (pushSupported ? ' (Push)' : ''), 'success');
          if (pushStatusEl) {
            pushStatusEl.textContent = pushSupported ? '· Push activo' : '· fallback local';
            pushStatusEl.className = pushSupported ? 'prof-push-status prof-push--active' : 'prof-push-status prof-push--fallback';
          }
        } else {
          e.target.checked = false;
          if (pushStatusEl) { pushStatusEl.textContent = ''; pushStatusEl.className = 'prof-push-status'; }
          showToast('Permiso de notificaciones denegado', 'error');
        }
      } else {
        await disable();
        if (pushStatusEl) { pushStatusEl.textContent = ''; pushStatusEl.className = 'prof-push-status'; }
        showToast('🔕 Recordatorios desactivados', 'info');
      }
    });
  }

  // ===== NAME EDIT (editor inline, sin prompt() nativo) =====
  const editNameBtn = page.querySelector('#editNameBtn');
  const profileNameEl = page.querySelector('#profileName');
  const nameEditor = page.querySelector('#profileNameEditor');
  const nameInput = page.querySelector('#profileNameInput');
  const nameSaveBtn = page.querySelector('#profileNameSave');
  const nameCancelBtn = page.querySelector('#profileNameCancel');

  function openNameEditor() {
    if (!nameEditor || !nameInput) return;
    nameInput.value = userStore.getUser()?.name || '';
    nameEditor.hidden = false;
    nameInput.focus();
    nameInput.select();
  }

  function closeNameEditor() {
    if (nameEditor) nameEditor.hidden = true;
  }

  function commitName() {
    const val = nameInput.value.trim();
    if (!val) {
      showToast('El nombre no puede estar vacío', 'error');
      nameInput.focus();
      return;
    }
    const currentName = userStore.getUser()?.name || '';
    if (val !== currentName) {
      userStore.updateProfile({ name: val }, true);
      // Sincroniza también la tabla profiles: el Admin, las invitaciones de
      // juego y el selector de rivales leen de ahí (best effort, no bloquea).
      db.saveProfile({ name: val }).catch(err => console.warn('[profile] sync nombre:', err?.message));
      if (profileNameEl) profileNameEl.textContent = val;
      const initialEl = page.querySelector('#profileInitial');
      if (initialEl) initialEl.textContent = val.charAt(0).toUpperCase();
      showToast('Nombre actualizado', 'success');
    }
    closeNameEditor();
    // Accesibilidad: devuelve el foco al botón de editar tras guardar
    if (editNameBtn) editNameBtn.focus();
  }

  if (editNameBtn && nameEditor && nameInput) {
    editNameBtn.addEventListener('click', openNameEditor);
    nameSaveBtn?.addEventListener('click', commitName);
    nameCancelBtn?.addEventListener('click', closeNameEditor);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitName(); }
      if (e.key === 'Escape') { e.preventDefault(); closeNameEditor(); }
    });
    nameInput.addEventListener('blur', (e) => {
      // Cierra solo si el foco sale fuera de los controles del editor
      if (!nameEditor.contains(e.relatedTarget)) closeNameEditor();
    });
  }

  // ===== LOGOUT =====
  page.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    try {
      await auth.signOut();
      // replace: tras logout, Atrás no debe volver a la página protegida
      router.replace('/login');
    } catch (err) {
      showToast('Error al cerrar sesión', 'error');
    }
  });

  // ===== APP (versión, novedades) =====
  page.querySelector('#noveltiesBtn')?.addEventListener('click', () => {
    const body = WHATS_NEW.map(v => `
      <div class="prof-novelties__version">
        <div class="prof-novelties__badge">v${escapeHtml(v.version)}</div>
        <ul class="prof-novelties__list">
          ${v.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
    openSheet({ title: 'Novedades', body });
  });

  return page;
}

// ==========================================
// SHEET GENÉRICO (modal accesible)
// ==========================================
function openSheet({ title, body }) {
  // Elimina sheets previos abiertos (evita apilamiento al reabrir)
  document.querySelectorAll('.prof-sheet-overlay').forEach(o => o.remove());

  const overlay = document.createElement('div');
  overlay.className = 'prof-sheet-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.innerHTML = `
    <div class="prof-sheet">
      <div class="prof-sheet__header">
        <div class="prof-sheet__title">${title}</div>
        <button type="button" class="prof-sheet__close" aria-label="Cerrar">✕</button>
      </div>
      <div class="prof-sheet__body">${body}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const close = () => {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 250);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.prof-sheet__close').addEventListener('click', close);
  const firstFocusable = overlay.querySelector('button');
  if (firstFocusable) firstFocusable.focus();
  return close;
}


