/* ==========================================
   Personal Hub — Capa nativa (Capacitor)

   Adaptador fino sobre los plugins nativos. Todo lo importante:

   · En el navegador NADA de esto se ejecuta: `isNative()` es false y los
     paquetes @capacitor/* no se descargan (van en chunks aparte, cargados
     con import() diferido y solo si la app corre dentro del contenedor).
     La web sigue pesando lo mismo que antes.

   · Cada llamada falla en silencio: si un plugin no está instalado (o el
     dispositivo no lo soporta), la app sigue funcionando como web.

   · Esto es la base para las funciones nativas que vienen después:
     vibración («toque» a distancia), notificaciones y widgets se apoyan
     aquí en vez de hablar con Capacitor desde las pantallas.
   ========================================== */

const NATIVE_CLASS = 'is-native';

let started = false;

/** ¿Estamos dentro del APK? (window.Capacitor lo inyecta el contenedor nativo) */
export function isNative() {
  const cap = window.Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

// Literales, no variables: así Vite los resuelve al compilar y crea un chunk
// por plugin que solo se pide en el dispositivo.
const loadHaptics = () => import('@capacitor/haptics').catch(() => null);
const loadApp = () => import('@capacitor/app').catch(() => null);
const loadStatusBar = () => import('@capacitor/status-bar').catch(() => null);
const loadSplash = () => import('@capacitor/splash-screen').catch(() => null);
const loadPush = () => import('@capacitor/push-notifications').catch(() => null);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ==========================================
   HÁPTICA
   ========================================== */

/**
 * Toque corto, como el de un botón del sistema. `kind` sigue las
 * intensidades de iOS/Android: light | medium | heavy.
 */
export async function hapticTap(kind = 'light') {
  if (!isNative()) return;
  const mod = await loadHaptics();
  if (!mod) return;
  const { Haptics, ImpactStyle } = mod;
  const style = ImpactStyle[kind === 'heavy' ? 'Heavy' : kind === 'medium' ? 'Medium' : 'Light'];
  try {
    await Haptics.impact({ style });
  } catch {
    /* dispositivo sin motor háptico */
  }
}

/**
 * Latido de corazón: «lub-dub» y pausa. Es el patrón del «toque» a
 * distancia — quien lo recibe siente el pulso, no una vibración genérica.
 * `beats` repeticiones completas.
 */
export async function hapticHeartbeat(beats = 2) {
  if (!isNative()) return;
  const mod = await loadHaptics();
  if (!mod) return;
  const { Haptics, ImpactStyle } = mod;
  const total = Math.max(1, Math.min(6, beats));
  for (let i = 0; i < total; i++) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await wait(130);
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      return; // sin háptica: no tiene sentido seguir el patrón
    }
    if (i < total - 1) await wait(430);
  }
}

/* ==========================================
   STATUS BAR (tono del tema activo)
   ========================================== */

function isDarkTheme() {
  return document.documentElement.dataset.theme !== 'light';
}

function statusBarColor() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim();
  // setBackgroundColor solo acepta hex de 6 dígitos.
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#0a0a0c';
}

/* ==========================================
   INIT
   ========================================== */

/**
 * Arranca la capa nativa. Idempotente y no-op en el navegador.
 * No necesita el router: el botón Atrás de Android se resuelve con el
 * historial, que es quien sabe si la app está en la raíz o dentro de una
 * página (el router ya escribe `phDepth` / `__phInPage` en cada entrada).
 */
export async function initNativeApp() {
  if (started || !isNative()) return;
  started = true;

  document.documentElement.classList.add(NATIVE_CLASS);

  const [AppMod, StatusBarMod, SplashMod] = await Promise.all([
    loadApp(),
    loadStatusBar(),
    loadSplash(),
  ]);

  // La splash nativa solo cubre el arranque del WebView.
  try {
    await SplashMod?.SplashScreen.hide();
  } catch {
    /* ya oculta */
  }

  if (StatusBarMod) {
    const { StatusBar, Style } = StatusBarMod;
    const paint = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: isDarkTheme() ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: statusBarColor() });
      } catch {
        /* sin barra de estado (tablet/ajuste del sistema) */
      }
    };
    await paint();
    // Cambiar de paleta o de claro/oscuro repinta la barra del sistema.
    new MutationObserver(paint).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-paleta'],
    });
  }

  if (AppMod) {
    const { App } = AppMod;

    // Botón Atrás: primero desapila (overlay o página anterior); en la raíz,
    // sale de la app como cualquier app nativa — no deja la app en blanco.
    App.addListener('backButton', () => {
      const depth = Number(window.history.state?.phDepth) || 0;
      if (depth > 0 || window.history.state?.__phInPage) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Al volver del segundo plano: buscar versión nueva del service worker.
    // Es la mitad «OTA» que se nota — abrir la app después de un push a
    // Vercel ya trae el último HTML/JS en la siguiente recarga.
    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      try {
        const reg = await navigator.serviceWorker?.getRegistration?.('/');
        await reg?.update?.();
      } catch {
        /* sin service worker (primera ejecución o http) */
      }
    });
  }
}

/**
 * Deep links de los widgets.
 *
 * El widget de días lanza `personalhub://juntos`; Capacitor lo entrega como
 * `appUrlOpen` (o como URL de arranque si la app estaba cerrada) y aquí se
 * traduce a una ruta de la web. Sin esto, tocar el widget abre la portada.
 */
export async function initDeepLinks(router) {
  if (!isNative() || !router) return;
  const AppMod = await loadApp();
  const { App } = AppMod || {};
  if (!App) return;

  const go = raw => {
    try {
      const url = new URL(raw);
      // personalhub://juntos → host «juntos» → ruta «/juntos»
      const route = url.hostname
        ? `/${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
        : '';
      if (route) router.navigate(route);
    } catch {
      /* url rara: se ignora */
    }
  };

  App.addListener('appUrlOpen', ({ url }) => go(url));

  // Arranque en frío desde el widget: la URL viene en el intent inicial.
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) go(launch.url);
  } catch {
    /* sin URL de arranque */
  }
}

/* ==========================================
   NOTIFICACIONES NATIVAS (FCM)
   ========================================== */

let pushStarted = false;
let pushNavigate = null;
// Último token recibido y si el servidor lo aceptó. Alimenta el diagnóstico
// de Perfil → Notificaciones: sin esto, en el APK no hay manera de saber si el
// móvil quedó dado de alta.
let lastToken = null;
let tokenSaved = false;
let tokenError = null;
// Resuelve cuando los listeners del plugin ya están puestos. `registerNativePush`
// la espera: si la sesión se restauraba antes de tiempo, el plugin emitía
// `registration` antes de que hubiera listener y el token se perdía hasta el
// siguiente arranque (o hasta volver del segundo plano).
let pushReady = null;

/**
 * Prepara las notificaciones de la app Android.
 *
 * Se llama una vez al arrancar. Los listeners se registran siempre (para no
 * perder el toque de un aviso), pero el alta del token solo ocurre cuando ya
 * hay sesión: si arrancas desconectado, `registerNativePush()` se reintenta
 * al iniciar sesión y al volver del segundo plano.
 */
export async function initNativePush({ onNavigate } = {}) {
  if (!isNative()) return;
  if (pushStarted) return pushReady;
  pushStarted = true;
  pushNavigate = typeof onNavigate === 'function' ? onNavigate : null;

  pushReady = (async () => {
    const mod = await loadPush();
    if (!mod) return;
    const { PushNotifications } = mod;

    // El plugin devuelve el token cada vez que se registra (también al
    // renovarse): es el único momento en que sabemos que cambió.
    PushNotifications.addListener('registration', ({ value }) => {
      if (value) saveTokenToServer(value);
    });
    PushNotifications.addListener('registrationError', err => {
      console.warn('[native] alta de notificaciones fallida:', err?.error);
    });

    // Con la app ABIERTA, Android no pinta el aviso: entrega el mensaje aquí
    // y, si nadie lo trata, desaparece sin dejar rastro. Por eso una prueba
    // enviada con la app en primer plano «no llegaba». Se muestra como banner
    // dentro de la app, que es lo que la capa web puede hacer sin un plugin
    // de notificaciones locales.
    PushNotifications.addListener('pushNotificationReceived', notification => {
      if (document.visibilityState !== 'visible') return;
      showInAppBanner(notification);
    });

    // Toque en un aviso: abre la sección exacta, igual que el service worker
    // hace en la web con { type: 'NAVIGATE', url }.
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const url = action?.notification?.data?.url;
      if (!url || !pushNavigate) return;
      pushNavigate(url.startsWith('/') ? url : `/${url}`);
    });
  })();

  await pushReady;

  // Volver a la app es buen momento para reintentar el alta si faltaba. Se
  // engancha DESPUÉS de pushReady para que este listener no pueda esperar a la
  // promesa que él mismo está resolviendo.
  const AppMod = await loadApp();
  AppMod?.App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) registerNativePush();
  });

  await registerNativePush();
}

/**
 * Aviso recibido con la app en primer plano.
 *
 * No imita a una notificación del sistema (no puede): es un banner arriba,
 * con el mismo texto, que se cierra solo a los 7 s o al tocarlo.
 */
function showInAppBanner(notification) {
  if (!document.body) return;
  const title = notification?.title || 'Hub🧸';
  const body = notification?.body || '';
  if (!body && !notification?.title) return;

  document.querySelector('[data-native-push-banner]')?.remove();

  const el = document.createElement('div');
  el.setAttribute('data-native-push-banner', '');
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    left: '12px',
    right: '12px',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '12px 16px',
    borderRadius: '16px',
    background: 'rgba(22, 22, 26, 0.96)',
    color: '#fff',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
    fontSize: '14px',
    lineHeight: '1.35',
    cursor: 'pointer',
    opacity: '0',
    transform: 'translateY(-8px)',
    transition: 'opacity .25s ease, transform .25s ease',
  });

  const strong = document.createElement('strong');
  strong.textContent = title;
  strong.style.fontSize = '14px';

  const text = document.createElement('span');
  text.textContent = body;
  text.style.opacity = '0.85';

  el.append(strong, text);

  const close = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 250);
  };

  el.addEventListener('click', () => {
    const url = notification?.data?.url;
    if (url && pushNavigate) pushNavigate(url.startsWith('/') ? url : `/${url}`);
    close();
  });

  document.body.append(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(close, 7000);
}

/**
 * Pide permiso (si hace falta) y da de alta el dispositivo. Idempotente:
 * llamarlo en cada inicio de sesión es lo esperado.
 */
export async function registerNativePush() {
  if (!isNative()) return false;
  // Nunca registrar antes de que los listeners estén puestos: el token viaja
  // en ese evento y, sin listener, se pierde sin dejar rastro.
  if (pushReady) {
    try {
      await pushReady;
    } catch {
      /* el plugin no cargó: se intenta igual, register() fallará y se registra el aviso */
    }
  }
  const mod = await loadPush();
  if (!mod) return false;
  const { PushNotifications } = mod;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return false;

    await PushNotifications.register();
    return true;
  } catch (err) {
    console.warn('[native] no se pudo registrar para notificaciones:', err?.message);
    return false;
  }
}

/**
 * Estado de las notificaciones de la app, para mostrarlo en Ajustes.
 *
 * Devuelve `null` en el navegador (ahí manda Web Push) y, dentro del APK:
 *   plugin      → ¿esta build incluye @capacitor/push-notifications?
 *   permission  → granted | denied | prompt
 *   registered  → ¿el plugin ya emitió un token?
 *   saved       → ¿el servidor lo aceptó? (si es false, mira `error`)
 */
export async function getNativePushStatus() {
  if (!isNative()) return null;

  const mod = await loadPush();
  if (!mod) {
    return {
      plugin: false,
      permission: 'unknown',
      registered: false,
      saved: false,
      error: 'plugin',
    };
  }

  let permission = 'unknown';
  try {
    const perm = await mod.PushNotifications.checkPermissions();
    permission = perm.receive;
  } catch {
    /* el plugin existe pero no respondió: se queda en unknown */
  }

  return {
    plugin: true,
    permission,
    registered: !!lastToken,
    saved: tokenSaved,
    error: tokenError,
  };
}

/**
 * Guarda el token en el servidor (tabla push_tokens, migración 026).
 * Sin sesión no se envía: el token no vale de nada sin dueño.
 */
async function saveTokenToServer(token) {
  try {
    const { supabase } = await import('./supabase.js');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch('/api/push?action=token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token, platform: 'android' }),
    });

    // El motivo del rechazo se muestra tal cual en Perfil → Notificaciones:
    // «HTTP 500» no sirve para arreglar nada.
    let detail = `HTTP ${res.status}`;
    if (!res.ok) {
      try {
        const body = await res.json();
        if (body?.error) detail = body.error;
      } catch {
        /* respuesta sin JSON: se queda el código */
      }
    }

    lastToken = token;
    tokenSaved = res.ok;
    tokenError = res.ok ? null : detail;

    if (!res.ok) {
      console.warn('[native] el servidor no guardó el token:', res.status);
    }
  } catch (err) {
    console.warn('[native] no se pudo enviar el token:', err?.message);
  }
}
