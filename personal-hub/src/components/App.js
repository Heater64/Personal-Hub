/* ==========================================
   Personal Hub v2 — App Shell
   Layout principal con sidebar (desktop) y bottom-nav (móvil)
   Oculta navegación en login y en OsitosWorld
   ========================================== */

import { userStore } from '../stores/user.store.js';
import { BottomNav } from './BottomNav.js';
import { Sidebar } from './Sidebar.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { initPWA, isStandalone } from '../services/pwa.service.js';
import { closeLightbox } from './MediaLightbox.js';

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

  /** Controla la visibilidad de la navegación según la ruta actual */
  function updateNavigation(path) {
    const shouldHide = NO_NAV_ROUTES.some(route => path === route || path.startsWith(route + '/'));
    app.classList.toggle('no-nav', shouldHide);
    app.classList.toggle('has-sidebar', !shouldHide);
  }

  // Redirect to login if not authenticated
  router.beforeEach(async (path, currentRoute) => {
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
  });

  // Check if we need to show Welcome Screen after login
  userStore.onChange((user) => {
    if (user) {
      const isAdmin = userStore.isAdmin;
      const hasSeenToday = localStorage.getItem('ph.moodDate') === new Date().toISOString().split('T')[0];

      if (!isAdmin && !hasSeenToday && window.location.hash !== '#/login') {
        setTimeout(() => {
          const ws = WelcomeScreen({
            onDone: () => { currentWelcomeOverlay = null; },
            onSkip: () => { currentWelcomeOverlay = null; }
          });
          currentWelcomeOverlay = ws;
          document.getElementById('app').appendChild(ws);
        }, 500);
      }
    }
  });

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
