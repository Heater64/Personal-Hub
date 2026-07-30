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
import { closeLightbox } from './MediaLightbox.js';
import { getUserPref, setUserPref, removeUserPref, cleanupLegacyKeys } from '../utils/userStorage.js';

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

    console.log('[Welcome] check:', {
      hasUser: !!user,
      isAdmin: userStore.isAdmin,
      isLoggedIn: userStore.isLoggedIn,
      hash: window.location.hash,
      hasSeenToday: moodStore.hasSeenToday(),
      now: now.toISOString(),
      after8AM: now >= today8AM
    });

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
    if (!shouldShowWelcome()) {
      console.log('[Welcome] showWelcome skipped, shouldShowWelcome false');
      return;
    }

    // Prevent re-showing on every route change after 8 AM
    const today = new Date().toISOString().split('T')[0];
    if (getUserPref('welcomeShownDate') === today) {
      console.log('[Welcome] already shown today');
      return;
    }
    setUserPref('welcomeShownDate', today);

    console.log('[Welcome] showing welcome screen');

    // Fire local push notification reminder if enabled and permission granted
    try {
      if (
        getUserPref('notifications', '0') === '1' &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        'serviceWorker' in navigator
      ) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('¡Buenos días! ☀️', {
            body: 'Es hora de tu check-in diario de estado de ánimo.',
            tag: 'mood-reminder',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            data: { url: '/' }
          });
        });
      }
    } catch (err) {
      console.warn('[Welcome] Could not show notification:', err);
    }

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

    console.log('[Welcome] scheduleMoodCheck', { now: now.toISOString(), today8AM: today8AM.toISOString() });

    // Already answered today -> wait for tomorrow at 8 AM
    if (moodStore.hasSeenToday()) {
      console.log('[Welcome] already seen today, scheduling tomorrow');
      moodTimer = setTimeout(scheduleMoodCheck, tomorrow8AM.getTime() - Date.now());
      return;
    }

    // After 8 AM and not answered -> show now, then schedule tomorrow
    if (now >= today8AM) {
      console.log('[Welcome] after 8 AM, showing welcome now');
      showWelcome();

      moodTimer = setTimeout(scheduleMoodCheck, tomorrow8AM.getTime() - Date.now());
      return;
    }

    // Before 8 AM -> wait until 8 AM today
    console.log('[Welcome] before 8 AM, scheduling for today');
    moodTimer = setTimeout(scheduleMoodCheck, today8AM.getTime() - Date.now());
  }

  // Re-evaluate schedule whenever the user state changes
  let legacyKeysCleaned = false;
  userStore.onChange(async () => {
    console.log('[Welcome] userStore changed, user:', userStore.getUser()?.email);

    // Clean up old global localStorage keys once per session now that
    // these preferences are stored per-user.
    if (userStore.getUser() && !legacyKeysCleaned) {
      cleanupLegacyKeys();
      legacyKeysCleaned = true;
    }

    // Sync today's mood with the server so the welcome screen doesn't ask
    // again if it was already answered on another device.
    if (userStore.getUser()) {
      moodSyncPromise = moodStore.fetchTodayMood().catch(err => {
        console.warn('[Welcome] Could not fetch today mood:', err);
      });
    } else {
      moodSyncPromise = null;
    }

    scheduleMoodCheck();
  });

  // Debug helpers for testing the welcome screen (in-memory only)
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
    console.log('[Welcome] reset mood state and welcomeShownDate');
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
    if (Number.isNaN(h) || h < 0 || h > 23) {
      console.error('[Welcome] hour must be between 0 and 23');
      return;
    }
    testWelcomeHour = h;
    console.log('[Welcome] test hour set to', h);
    scheduleMoodCheck();
  };
  window.__clearWelcomeTestHour = () => {
    testWelcomeHour = null;
    console.log('[Welcome] test hour cleared');
    scheduleMoodCheck();
  };

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
