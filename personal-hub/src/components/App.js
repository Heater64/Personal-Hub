/* ==========================================
   Personal Hub v2 — App Shell
   Layout principal con sidebar (desktop) y bottom-nav (móvil)
   Oculta navegación en login y en OsitosWorld
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { auth } from '../services/auth.service.js';
import { BottomNav } from './BottomNav.js';
import { Sidebar } from './Sidebar.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { moodStore } from '../stores/mood.store.js';
import { initPWA, isStandalone } from '../services/pwa.service.js';
import { syncReminderState, showDailyNotification, markWelcomeShownToday } from '../services/notifications.service.js';
import { closeLightbox } from './MediaLightbox.js';
import { getUserPref, setUserPref, removeUserPref, cleanupLegacyKeys } from '../utils/userStorage.js';
import { todayISO } from '../utils/format.js';

// Rutas que NO deben mostrar navegación (sidebar ni bottom-nav)
const NO_NAV_ROUTES = ['/login', '/ositos'];

export function AppShell(router) {
  const app = document.getElementById('app');
  app.className = 'app-shell';

  // Make the router render into a dedicated content area
  const contentEl = document.createElement('main');
  contentEl.className = 'app-content';
  contentEl.id = 'app-content';
  app.appendChild(contentEl);

  // Point the router at the content container
  router.setContainer(contentEl);

  // Bottom nav
  const bottomNav = BottomNav(router);
  app.appendChild(bottomNav);

  // Sidebar (desktop)
  const sidebar = Sidebar(router);
  app.appendChild(sidebar);

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
    if (!isLoggedIn && path !== '/login') {
      router.navigate('/login');
      return false;
    }

    // If logged in and on login page, go home
    if (isLoggedIn && path === '/login') {
      router.navigate('/');
      return false;
    }

    // Admin-only routes
    if (route?.adminOnly && !userStore.isAdmin) {
      router.navigate('/');
      return false;
    }

    return true;
  });

  // Update navigation on route change
  router.afterEach((path) => {
    updateNavigation(path);
    scheduleMoodCheck();
  });

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
    const today8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);

    if (!user) return false;
    if (userStore.isAdmin) return false;
    // Already showing?
    if (currentWelcomeOverlay || document.querySelector('.welcome-overlay')) return false;
    // Don't show on login page
    if (window.location.hash === '#/login') return false;
    // Already answered/skipped today?
    if (moodStore.hasSeenToday()) return false;
    // Only show from 8:00 AM onwards (or in-memory test hour)
    const checkHour = Number.isFinite(testWelcomeHour) && testWelcomeHour >= 0 && testWelcomeHour <= 23
      ? testWelcomeHour
      : 8;
    const todayCheck = new Date(now.getFullYear(), now.getMonth(), now.getDate(), checkHour, 0, 0, 0);
    return now >= todayCheck;
  }

  function showWelcome() {
    if (!shouldShowWelcome()) return;

    // Prevent re-showing on every route change after 8 AM
    const today = todayISO();
    if (getUserPref('welcomeShownDate') === today) return;
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

    const now = new Date();
    const checkHour = Number.isFinite(testWelcomeHour) && testWelcomeHour >= 0 && testWelcomeHour <= 23
      ? testWelcomeHour
      : 8;
    const today8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), checkHour, 0, 0, 0);
    const tomorrow8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, checkHour, 0, 0, 0);

    // Already answered today -> wait for tomorrow at 8 AM
    if (moodStore.hasSeenToday()) {
      moodTimer = setTimeout(scheduleMoodCheck, tomorrow8AM.getTime() - Date.now());
      return;
    }

    // After 8 AM and not answered -> show now, then schedule tomorrow
    if (now >= today8AM) {
      showWelcome();

      moodTimer = setTimeout(scheduleMoodCheck, tomorrow8AM.getTime() - Date.now());
      return;
    }

    // Before 8 AM -> wait until 8 AM today
    moodTimer = setTimeout(scheduleMoodCheck, today8AM.getTime() - Date.now());
  }

  // Re-evaluate schedule whenever the user state changes
  let legacyKeysCleaned = false;
  userStore.onChange(async () => {
    // Clean up old global localStorage keys once per session now that
    // these preferences are stored per-user.
    if (userStore.getUser() && !legacyKeysCleaned) {
      cleanupLegacyKeys();
      legacyKeysCleaned = true;
    }

    // Sync today's mood with the server so the welcome screen doesn't ask
    // again if it was already answered on another device.
    if (userStore.getUser()) {
      moodSyncPromise = moodStore.fetchTodayMood().catch(() => {});
      // Mantén el recordatorio diario alineado con el SW (IndexedDB + periodicSync)
      syncReminderState();
    } else {
      moodSyncPromise = null;
      // Logout: desactiva el recordatorio del SW (escribe enabled:false y desregistra)
      syncReminderState();
    }

    scheduleMoodCheck();
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
