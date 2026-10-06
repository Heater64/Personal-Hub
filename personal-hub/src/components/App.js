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
import { renderPageIcon } from './PageHeader.js';
import { isChromeHidden, isMobileRoot, mobileTopbarMeta, mobileBackTarget, homePathFor, isVisibleTo, roleFor } from '../routes.js';
import { NowPlayingBar } from './NowPlayingBar.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { setMoodWelcomeState } from './SpecialEventSheet.js';
import { moodStore } from '../stores/mood.store.js';
import { initPWA, isStandalone } from '../services/pwa.service.js';
import { syncReminderState, showDailyNotification, markWelcomeShownToday, resyncPushSubscription, notifyTodayNovelties, notifyNewOpenWhenLetters, notifyAdminMoodSaved } from '../services/notifications.service.js';
import { closeLightbox } from './MediaLightbox.js';
import { GameInviteCenter } from './GameInviteCenter.js';
import { initListenTogether, onListenTogether, getListenTogetherState, initListenStateRealtime, stopListenStateRealtime } from '../services/listenTogether.service.js';
import { player } from '../services/player.service.js';
import { showToast } from './Toast.js';
import { initRealtime, stopRealtime } from '../services/realtime.service.js';
import { getUserPref, setUserPref, removeUserPref, cleanupLegacyKeys, migrateUserPref, getUserId } from '../utils/userStorage.js';
import { todayISO, hourInSpain, spainMsOnDate, nextDayISO } from '../utils/format.js';


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

  // Barra superior móvil: una flecha persistente y contextual se siente más
  // nativa que obligar a buscar un enlace de vuelta al final de cada página.
  const mobileTopBar = document.createElement('header');
  mobileTopBar.className = 'mobile-topbar';
  mobileTopBar.setAttribute('aria-label', 'Navegación de página');
  app.appendChild(mobileTopBar);

  // Contenido: el router monta dentro de .shell > .main > .content.
  // Estructura del sistema nuevo (habitos-web): la sidebar ocupa su
  // columna fija y el contenido scrollea por su cuenta en escritorio.
  const shellEl = document.createElement('div');
  shellEl.className = 'shell';

  const mainEl = document.createElement('main');
  mainEl.className = 'main';

  const contentEl = document.createElement('div');
  contentEl.className = 'content';
  contentEl.id = 'app-content';
  contentEl.tabIndex = -1;

  mainEl.appendChild(contentEl);
  shellEl.appendChild(mainEl);
  app.appendChild(shellEl);

  // Point the router at the content container
  router.setContainer(contentEl);

  // Sidebar (escritorio) — dentro del shell, antes del contenido
  const sidebar = Sidebar(router);
  shellEl.prepend(sidebar);

  // Bottom nav (móvil)
  const bottomNav = BottomNav(router);
  app.appendChild(bottomNav);

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

  // Qué rutas llevan barra de vuelta, cómo se llama cada una, sin navegación
  // y hacia dónde vuelve el botón Atrás: todo sale del registro de rutas
  // (src/routes.js), que es la única lista de pantallas de la aplicación.
  function updateMobileTopBar(path) {
    const role = roleFor(userStore.isAdmin);
    const basePath = path.split('?')[0];
    const shouldShow = !isChromeHidden(path) && !isMobileRoot(basePath, role);

    mobileTopBar.classList.toggle('is-visible', shouldShow);
    if (!shouldShow) {
      mobileTopBar.innerHTML = '';
      return;
    }

    const meta = mobileTopbarMeta(basePath);
    mobileTopBar.innerHTML = `
      <button type="button" class="mobile-topbar__back" aria-label="Volver">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        <span>Volver</span>
      </button>
      <h1 class="mobile-topbar__title">
        <span class="mobile-topbar__icon">${renderPageIcon(meta.icon, 'mobile-topbar__icon-svg')}</span>
        <span class="mobile-topbar__title-text">${meta.label}</span>
      </h1>
      <span class="mobile-topbar__spacer" aria-hidden="true"></span>
    `;
    mobileTopBar.querySelector('.mobile-topbar__back').addEventListener('click', () => {
      router.back(mobileBackTarget(path, role));
    });
  }

  // Store ref to remove welcome overlay on route change
  let currentWelcomeOverlay = null;
  let moodTimer = null;
  let moodSyncPromise = null; // resolves once today's mood has been synced with the server
  let moodNotifCleanup = null; // unsubscribe del aviso de ánimo al admin (sólo admin)

  // Aviso al Admin cuando la usuaria registra su ánimo (Realtime + polling).
  // Sólo el admin instala este listener: el usuario ya se avisa a sí mismo
  // en mood.store (notifyMoodSaved). Filtra los propios ánimos del admin.
  const attachAdminMoodListener = () => {
    const onMood = (e) => {
      const mood = e?.detail;
      if (!mood) return;
      if (mood.user_id === getUserId()) return; // no avisar por el propio admin
      notifyAdminMoodSaved(mood).catch(() => {});
      showToast(`${mood.emoji || '🫶'} ${mood.label || 'Ánimo registrado'}`, 'info', 4000);
    };
    window.addEventListener('ph:mood-changed', onMood);
    return () => window.removeEventListener('ph:mood-changed', onMood);
  };

  /** Controla la visibilidad de la navegación según la ruta actual */
  function updateNavigation(path) {
    const shouldHide = isChromeHidden(path);
    app.classList.toggle('no-nav', shouldHide);
    // has-sidebar = hay navegación lateral visible (lo usan la barra del
    // reproductor y las vistas inmersivas para alinearse al contenido).
    app.classList.toggle('has-sidebar', !shouldHide);
  }

  // Wait for auth restoration before guarding routes
  const authReady = auth.isReady();

  // Techo entre revalidaciones de la cuenta (rol + enabled) en el guard.
  const ACCOUNT_CHECK_TTL_MS = 60_000;
  let lastAccountCheck = 0;

  // Redirect to login if not authenticated
  router.beforeEach(async (path, currentRoute) => {
    // Make sure auth state has been restored before deciding
    await authReady;

    // Revalida el estado de la cuenta (profiles.role + profiles.enabled)
    // con un techo de 60 s. Así una cuenta deshabilitada con la pestaña
    // abierta pierde el acceso en la siguiente navegación, en vez de
    // mantenerlo hasta que caduque el JWT. La decisión real de seguridad
    // está en la RLS (is_enabled) y en /api/*; esto es la capa de UX.
    if (userStore.isLoggedIn) {
      const last = lastAccountCheck;
      if (!last || Date.now() - last > ACCOUNT_CHECK_TTL_MS) {
        lastAccountCheck = Date.now();
        await auth.refreshAccount();
      }
    }

    const isLoggedIn = userStore.isLoggedIn;

    // Update navigation visibility
    updateNavigation(path);
    updateMobileTopBar(path);

    // Remove any lingering welcome overlay
    if (currentWelcomeOverlay) {
      currentWelcomeOverlay.remove();
      currentWelcomeOverlay = null;
      setMoodWelcomeState('clear');
      window.dispatchEvent(new CustomEvent('ph:mood-welcome-done'));
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
    if (route?.adminOnly) {
      // El rol definitivo vive en la DB (profiles): con sesión fría aún no ha
      // llegado y isAdmin se decide solo con la lista de emails de respaldo.
      // Refréscalo antes de decidir para no expulsar a un admin real al
      // recargar /admin (deep link o F5).
      await auth.refreshAccount();
      if (!userStore.isAdmin) {
        router.replace('/');
        return false;
      }
    }

    // Cada rol entra por donde le toca: la pantalla diaria ('/') es de la
    // usuaria, así que el admin aterriza en su casa, el panel, donde gestiona
    // los eventos importantes. Se usa replace para no apilar una entrada de
    // historial que vuelva a redirigir.
    const navRole = roleFor(userStore.isAdmin);
    if (!isVisibleTo(path, navRole)) {
      router.replace(homePathFor(navRole));
      return false;
    }

    return true;
  });

  // Update navigation on route change
  router.afterEach((path) => {
    updateNavigation(path);
    updateMobileTopBar(path);
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
  // Check-in diario de ánimo en el primer inicio del día
  // (la fecha cambia a medianoche en Europe/Madrid).
  // ==========================================
  function shouldShowWelcome() {
    const user = userStore.getUser();

    if (!user) return false;
    if (userStore.isAdmin) return false;
    // Already showing?
    if (currentWelcomeOverlay || document.querySelector('.welcome-overlay')) return false;
    // Don't show on login page
    if (window.location.hash === '#/login') return false;
    // Already answered/skipped today?
    if (moodStore.hasSeenToday()) return false;
    return true;
  }

  function showWelcome() {
    if (!shouldShowWelcome()) return false;

    // Evita volver a abrirla el mismo día si una navegación cerró el modal.
    const today = todayISO();
    if (getUserPref('welcomeShownDate') === today) return false;

    // Prevent double-show if a welcome is already displayed
    if (currentWelcomeOverlay || document.querySelector('.welcome-overlay')) return false;

    setUserPref('welcomeShownDate', today);

    // Notificación local (app abierta) si está habilitada, con el saludo
    // correspondiente a la hora española en que abrió la aplicación.
    const hour = hourInSpain();
    const greeting = hour < 12 ? '¡Buenos días! ☀️' : hour < 19 ? '¡Buenas tardes! 🌤️' : '¡Buenas noches! 🌙';
    showDailyNotification(greeting, '¿Cómo te sientes hoy? Abre Personal Hub para registrarlo.');
    // Marca el día para que el SW (app cerrada) no la duplique: 1 vez/día
    markWelcomeShownToday();

    const ws = WelcomeScreen({
      onDone: () => {
        currentWelcomeOverlay = null;
        setMoodWelcomeState('clear');
      },
      onSkip: () => {
        currentWelcomeOverlay = null;
        setMoodWelcomeState('clear');
      }
    });
    currentWelcomeOverlay = ws;
    document.getElementById('app').appendChild(ws);
    setMoodWelcomeState('showing');
    return true;
  }

  async function scheduleMoodCheck() {
    clearTimeout(moodTimer);
    // Invalida el estado anterior (también al cambiar el día): hasta terminar
    // la sincronización no se debe abrir un evento con el ánimo aún pendiente.
    const user = userStore.getUser();
    setMoodWelcomeState(user && !userStore.isAdmin ? 'pending' : 'clear');

    // Make sure we have the latest server state before deciding
    await awaitMoodSync();

    // Novedades diarias (la dedupe interna evita repetir; es barato si ya se notificó)
    notifyTodayNovelties();
    // Cartas nuevas de Open When sin abrir (dedupe: 1 aviso por carta)
    notifyNewOpenWhenLetters();

    const now = new Date();
    if (!userStore.getUser() || userStore.isAdmin) {
      setMoodWelcomeState('clear');
      return;
    }

    // Se muestra en el primer inicio del día de la princesa, a cualquier hora.
    // El próximo check se arma a medianoche de España para el día siguiente.
    const nextDayCheck = spainMsOnDate(nextDayISO(now), 0);
    const scheduleNextDay = () => {
      moodTimer = setTimeout(scheduleMoodCheck, Math.max(1000, nextDayCheck - Date.now()));
    };

    if (!moodStore.hasSeenToday()) {
      if (!showWelcome()) {
        setMoodWelcomeState(document.querySelector('.welcome-overlay') ? 'showing' : 'clear');
      }
    } else {
      setMoodWelcomeState('clear');
    }
    scheduleNextDay();
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
    // Al reautenticar, congela la bienvenida temática hasta conocer el ánimo
    // sincronizado de esta cuenta (evita que una sesión previa dé vía libre).
    setMoodWelcomeState(userStore.getUser() && !userStore.isAdmin ? 'pending' : 'clear');

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
      // Aviso al Admin cuando la usuaria registra su estado de ánimo.
      // Sólo el admin escucha: el usuario ya se avisa a sí mismo en el store.
      if (userStore.isAdmin && !moodNotifCleanup) {
        moodNotifCleanup = attachAdminMoodListener();
      }
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
      if (moodNotifCleanup) { moodNotifCleanup(); moodNotifCleanup = null; }
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
  }

  // Initial navigation state
  updateNavigation(router.getCurrentPath());
  updateMobileTopBar(router.getCurrentPath());

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
