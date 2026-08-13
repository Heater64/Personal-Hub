/* ==========================================
   Personal Hub v2 — App Shell
   Layout principal con sidebar (desktop) y bottom-nav (móvil)
   Oculta navegación en login y en OsitosWorld
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';
import { db } from '../services/db.service.js';
import { BottomNav } from './BottomNav.js';
import { Sidebar } from './Sidebar.js';
import { NowPlayingBar } from './NowPlayingBar.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { moodStore } from '../stores/mood.store.js';
import { initPWA, isStandalone } from '../services/pwa.service.js';
import { syncReminderState, showDailyNotification, markWelcomeShownToday, resyncPushSubscription, notifyTodayNovelties, notifyNewOpenWhenLetters } from '../services/notifications.service.js';
import { closeLightbox } from './MediaLightbox.js';
import { GameInviteCenter } from './GameInviteCenter.js';
import { initListenTogether, onListenTogether, getListenTogetherState, initListenStateRealtime, stopListenStateRealtime } from '../services/listenTogether.service.js';
import { player } from '../services/player.service.js';
import '../styles/online-games.css';
import { initRealtime, stopRealtime } from '../services/realtime.service.js';
import { getUserPref, setUserPref, removeUserPref, cleanupLegacyKeys, migrateUserPref } from '../utils/userStorage.js';
import { todayISO, spainMsOnDate, nextDayISO } from '../utils/format.js';

// Rutas que NO deben mostrar navegación (sidebar ni bottom-nav)
const NO_NAV_ROUTES = ['/login', '/ositos'];

export function AppShell(router) {
  const app = document.getElementById('app');
  app.className = 'app-shell';

  // Skip link: permite saltar la navegación con teclado (WCAG 2.4.1)
  // Usa click handler con preventDefault: un href="#app-content" alteraría
  // location.hash y dispararía el hash-router.
  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = '#app-content';
  skipLink.textContent = 'Saltar al contenido';
  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    contentEl.focus({ preventScroll: false });
  });
  app.appendChild(skipLink);

  // Make the router render into a dedicated content area
  const contentEl = document.createElement('main');
  contentEl.className = 'app-content';
  contentEl.id = 'app-content';
  contentEl.tabIndex = -1;
  app.appendChild(contentEl);

  // Point the router at the content container
  router.setContainer(contentEl);

  // Bottom nav
  const bottomNav = BottomNav(router);
  app.appendChild(bottomNav);

  // Sidebar (desktop)
  const sidebar = Sidebar(router);
  app.appendChild(sidebar);

  // Reproductor global (tipo Spotify): barra persistente que sigue
  // sonando al navegar. Vive fuera de las páginas.
  const nowPlayingBar = NowPlayingBar(router);
  app.appendChild(nowPlayingBar);

  // Centro persistente: no se desmonta al cambiar de sección y permite
  // responder invitaciones desde cualquier pantalla de la aplicación.
  const gameInviteCenter = GameInviteCenter(router);
  app.appendChild(gameInviteCenter);

  // Escucha global de 'escuchar juntos': permite recibir solicitudes y
  // respuestas estando en cualquier página de la web.
  initListenTogether();

  // Handler global de sincronización: cuando el otro dispositivo cambia de
  // canción (evento 'listen' via postgres_changes), busca la canción en el
  // catálogo y la carga en el player global para que NowPlayingBar aparezca
  // desde cualquier página (incluido OsitosWorld).
  let _findSongByKey = null;
  onListenTogether(({ type, payload }) => {
    // 'state' = la sesión cambió: arranca/detiene la suscripción Realtime
    if (type === 'state') {
      const st = getListenTogetherState();
      if (st.active) {
        initListenStateRealtime();
      } else {
        stopListenStateRealtime();
      }
      return;
    }
    // 'listen' = cambio de estado vía postgres_changes (push instantáneo).
    if (type === 'listen') {
      if (!payload?.song_key) return;
      // Lazy-import del catálogo: solo se carga la primera vez que llega un
      // evento 'listen' (evita arrastrar el módulo de Canciones al arranque).
      import('../pages/Canciones.js').then(mod => {
        _findSongByKey = mod.findSongByKey;
        const song = _findSongByKey(payload.song_key);
        if (!song) return;
        player.setInfo({ title: song.title, artist: song.artist || '', cover: song.cover || '' });
        if (player.audio.src !== song.audio) {
          player.audio.src = song.audio;
          player.audio.currentTime = 0;
        }
        if (Number.isFinite(payload.position) && payload.position > 0) {
          if (Math.abs(player.audio.currentTime - payload.position) > 2) {
            player.audio.currentTime = payload.position;
          }
        }
        if (payload.playing === true && player.audio.paused) {
          player.audio.play().catch(() => {});
        } else if (payload.playing === false && !player.audio.paused) {
          player.audio.pause();
        }
      }).catch(() => {});
    }
  });

  // Store ref to remove welcome overlay on route change
  let currentWelcomeOverlay = null;
  let moodTimer = null;
  let testWelcomeHour = null; // in-memory override for testing only
  let moodSyncPromise = null; // resolves once today's mood has been synced with the server

  /** Controla la visibilidad de la navegación según la ruta actual */
  function updateNavigation(path) {
    const shouldHide = NO_NAV_ROUTES.some(route => path === route || path.startsWith(route + '/'));
    app.classList.toggle('no-nav', shouldHide);
    app.classList.toggle('has-sidebar', !shouldHide);
  }

  // Wait for auth restoration before guarding routes
  const authReady = auth.isReady();

  // Redirect to login if not authenticated
  router.beforeEach(async (path, currentRoute) => {
    // Make sure auth state has been restored before deciding
    await authReady;

    const isLoggedIn = userStore.isLoggedIn;

    // Update navigation visibility
    updateNavigation(path);

    // Remove any lingering welcome overlay
    if (currentWelcomeOverlay) {
      currentWelcomeOverlay.remove();
      currentWelcomeOverlay = null;
    }
    document.body.style.overflow = '';

    // Close lightbox if open when navigating between pages
    closeLightbox();

    // Check route protection
    const route = router.matchRoute(path);

    // Protect all routes except login
    // NOTA: se usa router.replace() para que el redirect no acumule una
    // entrada de historial — si se usara push, el botón Atrás volvería a la
    // ruta protegida y provocaría un bucle infinito de redirects.
    if (!isLoggedIn && path !== '/login') {
      router.replace('/login');
      return false;
    }

    // If logged in and on login page, go home
    if (isLoggedIn && path === '/login') {
      router.replace('/');
      return false;
    }

    // Admin-only routes
    if (route?.adminOnly && !userStore.isAdmin) {
      router.replace('/');
      return false;
    }

    return true;
  });

  // Update navigation on route change
  router.afterEach((path) => {
    updateNavigation(path);
    scheduleMoodCheck();
    hideBootSplash();
    // Registro de actividad (analítica): con qué secciones pasa más tiempo
    // cada usuario y su última conexión. Fire-and-forget: nunca bloquea la
    // navegación. Se omite la pantalla de login (no aporta señal útil).
    if (path && path !== '/login') {
      db.trackVisit(path).catch(() => {});
    }
  });

  // Oculta el splash de arranque (index.html) en la primera vista montada.
  // Failsafe: si el render tarda demasiado, se retira solo a los 8s para no
  // dejar una pantalla bloqueada.
  let splashRemoved = false;
  function hideBootSplash() {
    if (splashRemoved) return;
    splashRemoved = true;
    const splash = document.getElementById('boot-splash');
    if (!splash) return;
    splash.classList.add('boot-splash--hide');
    setTimeout(() => splash.remove(), 500);
  }
  setTimeout(hideBootSplash, 8000);

  // Wait for any in-progress mood sync before deciding whether to show the welcome screen
  async function awaitMoodSync() {
    if (moodSyncPromise) {
      try { await moodSyncPromise; } catch (e) { /* ignore */ }
    }
  }

  // ==========================================
  // Daily Welcome Screen scheduler (8:00 AM)
  // ==========================================
  function shouldShowWelcome() {
    const user = userStore.getUser();
    const now = new Date();

    if (!user) return false;
    if (userStore.isAdmin) return false;
    // Already showing?
    if (currentWelcomeOverlay || document.querySelector('.welcome-overlay')) return false;
    // Don't show on login page
    if (window.location.hash === '#/login') return false;
    // Already answered/skipped today?
    if (moodStore.hasSeenToday()) return false;
    // Only show from 8:00 AM (hora de España) onwards (or in-memory test hour)
    const checkHour = Number.isFinite(testWelcomeHour) && testWelcomeHour >= 0 && testWelcomeHour <= 23
      ? testWelcomeHour
      : 8;
    const todayCheck = spainMsOnDate(todayISO(now), checkHour);
    return now.getTime() >= todayCheck;
  }

  function showWelcome() {
    if (!shouldShowWelcome()) return;

    // Prevent re-showing on every route change after 8 AM
    const today = todayISO();
    if (getUserPref('welcomeShownDate') === today) return;

    // Prevent double-show if a welcome is already displayed
    if (currentWelcomeOverlay || document.querySelector('.welcome-overlay')) return;

    setUserPref('welcomeShownDate', today);

    // Notificación local (app abierta) si está habilitada
    showDailyNotification('¡Buenos días! ☀️', 'Es hora de tu check-in diario de estado de ánimo.');
    // Marca el día para que el SW (app cerrada) no la duplique: 1 vez/día
    markWelcomeShownToday();

    const ws = WelcomeScreen({
      onDone: () => { currentWelcomeOverlay = null; },
      onSkip: () => { currentWelcomeOverlay = null; }
    });
    currentWelcomeOverlay = ws;
    document.getElementById('app').appendChild(ws);
  }

  async function scheduleMoodCheck() {
    clearTimeout(moodTimer);

    // Make sure we have the latest server state before deciding
    await awaitMoodSync();

    // Novedades diarias (la dedupe interna evita repetir; es barato si ya se notificó)
    notifyTodayNovelties();
    // Cartas nuevas de Open When sin abrir (dedupe: 1 aviso por carta)
    notifyNewOpenWhenLetters();

    const now = new Date();
    const checkHour = Number.isFinite(testWelcomeHour) && testWelcomeHour >= 0 && testWelcomeHour <= 23
      ? testWelcomeHour
      : 8;
    // El check-in diario (8:00) y el cambio de día usan la hora de España (península)
    const today8AM = spainMsOnDate(todayISO(now), checkHour);
    const tomorrow8AM = spainMsOnDate(nextDayISO(now), checkHour);

    // Already answered today -> wait for tomorrow at 8 AM
    if (moodStore.hasSeenToday()) {
      const delay = Math.max(1000, tomorrow8AM - Date.now());
      moodTimer = setTimeout(scheduleMoodCheck, delay);
      return;
    }

    // After 8 AM and not answered -> show now, then schedule tomorrow
    if (now.getTime() >= today8AM) {
      showWelcome();

      const delay = Math.max(1000, tomorrow8AM - Date.now());
      moodTimer = setTimeout(scheduleMoodCheck, delay);
      return;
    }

    // Before 8 AM -> wait until 8 AM today
    const delay = Math.max(1000, today8AM - Date.now());
    moodTimer = setTimeout(scheduleMoodCheck, delay);
  }

  // ── Navegación desde notificaciones ──
  // El SW envía { type: 'NAVIGATE', url } al tocar una notificación
  // (el click en la notificación abre la sección correspondiente).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'NAVIGATE' && data.url) {
        router.navigate(data.url);
      }
    });
  }

  // Re-evaluate schedule whenever the user state changes
  let legacyKeysCleaned = false;
  let schedulePending = false;
  userStore.onChange(async () => {
    // Clean up old global localStorage keys once per session now that
    // these preferences are stored per-user.
    if (userStore.getUser() && !legacyKeysCleaned) {
      cleanupLegacyKeys();
      // Migra (preservando datos) las claves legacy de Canciones/Home a su clave por-usuario.
      // No están en LEGACY_KEYS a propósito: ahí se borrarían antes de poder migrarse.
      migrateUserPref('favSongs');
      migrateUserPref('continueTrack');
      legacyKeysCleaned = true;
    }

    // Sync today's mood with the server so the welcome screen doesn't ask
    // again if it was already answered on another device.
    if (userStore.getUser()) {
      // Tiempo real: los cambios del Admin se propagan a todos los usuarios
      // (Realtime + polling). Se inicia al loguearse y se detiene al salir.
      initRealtime();
      moodSyncPromise = moodStore.fetchTodayMood().catch(() => {});
      // Sincroniza push subscription + fallback (IndexedDB + periodicSync)
      syncReminderState();
      resyncPushSubscription();
      // Notificación diaria de novedades (dedupe 1/día + puerta 8 AM)
      notifyTodayNovelties();
      // Cartas nuevas de Open When sin abrir (dedupe: 1 aviso por carta)
      notifyNewOpenWhenLetters();
    } else {
      moodSyncPromise = null;
      // Logout: desactiva todo (incluida la sincronización en tiempo real)
      stopRealtime();
      syncReminderState();
    }

    // Debounce: avoid scheduling multiple checks when onChange fires rapidly
    if (!schedulePending) {
      schedulePending = true;
      // Small delay to let auth state settle before deciding
      setTimeout(() => {
        schedulePending = false;
        scheduleMoodCheck();
      }, 200);
    }
  });

  // Debug helpers para testear la bienvenida (solo en desarrollo)
  if (import.meta.env.DEV) {
    window.__resetMoodDate = () => {
      const user = userStore.getUser();
      if (user) {
        localStorage.removeItem(`ph.moodDate.${user.id}`);
        localStorage.removeItem(`ph.mood.${user.id}`);
      } else {
        localStorage.removeItem('ph.moodDate');
        localStorage.removeItem('ph.mood');
      }
      removeUserPref('welcomeShownDate');
      scheduleMoodCheck();
    };
    window.__showWelcomeNow = () => {
      const user = userStore.getUser();
      if (user) {
        localStorage.removeItem(`ph.moodDate.${user.id}`);
        localStorage.removeItem(`ph.mood.${user.id}`);
      } else {
        localStorage.removeItem('ph.moodDate');
      }
      removeUserPref('welcomeShownDate');
      showWelcome();
    };
    window.__setWelcomeTestHour = (hour) => {
      const h = parseInt(hour, 10);
      if (Number.isNaN(h) || h < 0 || h > 23) return;
      testWelcomeHour = h;
      scheduleMoodCheck();
    };
    window.__clearWelcomeTestHour = () => {
      testWelcomeHour = null;
      scheduleMoodCheck();
    };
  }

  // Initial navigation state
  updateNavigation(router.getCurrentPath());

  // ── Inicializar PWA ──
  // Pequeño delay para no bloquear la carga inicial
  setTimeout(() => {
    initPWA();
  }, 1000);

  // ── Añadir clase standalone si corresponde ──
  if (isStandalone()) {
    document.documentElement.classList.add('is-standalone');
  }

  return app;
}
