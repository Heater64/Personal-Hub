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

/* ==========================================
   NOTIFICACIONES NATIVAS (FCM)
   ========================================== */

let pushStarted = false;
let pushNavigate = null;

/**
 * Prepara las notificaciones de la app Android.
 *
 * Se llama una vez al arrancar. Los listeners se registran siempre (para no
 * perder el toque de un aviso), pero el alta del token solo ocurre cuando ya
 * hay sesión: si arrancas desconectado, `registerNativePush()` se reintenta
 * al iniciar sesión y al volver del segundo plano.
 */
export async function initNativePush({ onNavigate } = {}) {
  if (pushStarted || !isNative()) return;
  pushStarted = true;
  pushNavigate = typeof onNavigate === 'function' ? onNavigate : null;

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

  // Toque en un aviso: abre la sección exacta, igual que el service worker
  // hace en la web con { type: 'NAVIGATE', url }.
  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    const url = action?.notification?.data?.url;
    if (!url || !pushNavigate) return;
    pushNavigate(url.startsWith('/') ? url : `/${url}`);
  });

  // Volver a la app es buen momento para reintentar el alta si faltaba.
  const AppMod = await loadApp();
  AppMod?.App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) registerNativePush();
  });

  await registerNativePush();
}

/**
 * Pide permiso (si hace falta) y da de alta el dispositivo. Idempotente:
 * llamarlo en cada inicio de sesión es lo esperado.
 */
export async function registerNativePush() {
  if (!isNative()) return false;
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
 * Guarda el token en el servidor (tabla push_tokens, migración 026).
 * Sin sesión no se envía: el token no vale de nada sin dueño.
 */
async function saveTokenToServer(token) {
  try {
    const { supabase } = await import('./supabase.js');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch('/api/push?action=token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ token, platform: 'android' })
    });

    if (!res.ok) {
      console.warn('[native] el servidor no guardó el token:', res.status);
    }
  } catch (err) {
    console.warn('[native] no se pudo enviar el token:', err?.message);
  }
}
