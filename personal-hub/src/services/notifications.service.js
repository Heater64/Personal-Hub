/* ==========================================
   Personal Hub v2 — Notifications Service
   Push API (Web Push) como sistema principal.
   - Se suscribe al push server via /api/push/subscribe
   - El servidor envía push diario a las 8:00 AM via cron
   - Fallback: notificación local vía SW si push no disponible
   - Fallback legacy: PeriodicSync (Chromium PWA instalada)
   ========================================== */

import { getUserPref, setUserPref, getUserId } from '../utils/userStorage.js';
import { todayISO, hourInSpain } from '../utils/format.js';
import { supabase } from './supabase.js';
import { getTodayNovelties } from './novelties.service.js';
import { loadAllOpenWhenLetters } from '../pages/OpenWhen.js';

// VAPID public key — debe coincidir con VAPID_PUBLIC_KEY en el servidor
const VAPID_PUBLIC_KEY = 'BO_qmnZrQT4twbo24CGDk-bpJWcJyfGFQoBVqf24B0jkUKKHNOEyhkZQZ2nPc1Q4BHSSEpcVq71Xcb3FYKz7gIA';

const SYNC_TAG = 'daily-welcome';
const NOVELTIES_TAG = 'daily-novelties';
const OPENWHEN_TAG = 'openwhen-new';
const OPENWHEN_ANNOUNCED_KEY = 'openwhen.announced';
const DB_NAME = 'ph-notifications';
const DB_STORE = 'state';

// Single-flight: evita duplicados si notifyTodayNovelties se invoca
// a la vez desde login y desde scheduleMoodCheck.
let noveltyCheckPromise = null;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function getState() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const get = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('reminder');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setState(state) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(state, 'reminder');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* no-op */
  }
}

// ==========================================
// PUBLIC API
// ==========================================

export function isEnabled() {
  return getUserPref('notifications', '0') === '1';
}

/**
 * Check if Web Push is supported in this browser.
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Request notification permission + subscribe to push server.
 * Returns true if fully enabled (push subscription active).
 */
export async function requestEnable() {
  if (!('Notification' in window)) return false;

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return false;
  }

  setUserPref('notifications', '1');

  // Intentar suscribirse a push
  const pushOk = await subscribeToPush();

  // Sincronizar estado con el SW (fallback)
  await syncReminderState();

  return true;
}

/**
 * Disable notifications: unsubscribe from push + clear prefs.
 */
export async function disable() {
  setUserPref('notifications', '0');
  await unsubscribeFromPush();
  await syncReminderState();
}

/**
 * Subscribe to the push server.
 * Stores the subscription on the server for later push sending.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      // Already subscribed — verify it on the server
      await sendSubscriptionToServer(subscription);
      return true;
    }

    // Subscribe
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await sendSubscriptionToServer(subscription);
    return true;
  } catch (err) {
    console.warn('[notif] Push subscription failed:', err.message);
    // Push no disponible: el fallback (local + periodicSync) sigue activo
    return false;
  }
}

/**
 * Unsubscribe from push and remove from server.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe locally
      await subscription.unsubscribe();

      // Notify server
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/push?action=unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        }
      } catch (e) {
        console.warn('[notif] Server unsubscribe failed:', e.message);
      }
    }
  } catch (err) {
    console.warn('[notif] Push unsubscribe error:', err.message);
  }
}

/**
 * Resync push subscription on login — ensures the server has the
 * latest subscription for the current user + device.
 */
export async function resyncPushSubscription() {
  if (!isEnabled()) return;
  if (!isPushSupported()) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      await sendSubscriptionToServer(subscription);
    } else {
      // Try to subscribe
      await subscribeToPush();
    }
  } catch {
    /* silent */
  }
}

// ==========================================
// INTERNAL
// ==========================================

/**
 * Sends the PushSubscription to the server API.
 */
async function sendSubscriptionToServer(subscription) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const subObj = subscription.toJSON ? subscription.toJSON() : subscription;

    const res = await fetch('/api/push?action=subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ subscription: subObj })
    });

    if (!res.ok) {
      console.warn('[notif] Server subscribe failed:', res.status);
    }
  } catch (err) {
    console.warn('[notif] Could not send subscription to server:', err.message);
  }
}

/**
 * Sincroniza el estado del recordatorio con el SW (IndexedDB)
 * y registra/desregistra el periodic sync (fallback legacy).
 */
export async function syncReminderState() {
  const enabled = isEnabled() && 'Notification' in window && Notification.permission === 'granted';
  const userId = getUserId();
  const prev = await getState();
  const state = { enabled: enabled && !!userId, userId, lastShown: prev?.lastShown ?? null };
  await setState(state);

  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;

    // PeriodicSync fallback (solo Chromium + PWA instalada)
    if ('periodicSync' in reg) {
      if (state.enabled) {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => null);
        if (!status || status.state === 'granted') {
          await reg.periodicSync.register(SYNC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
        }
      } else {
        await reg.periodicSync.unregister(SYNC_TAG).catch(() => {});
      }
    }
  } catch {
    /* silent */
  }
}

/** Marca que la bienvenida ya se mostró hoy. */
export async function markWelcomeShownToday() {
  const state = (await getState()) || {};
  await setState({ ...state, lastShown: todayISO() });
}

/**
 * Notificación local inmediata vía SW (app abierta, fallback).
 * Devuelve true si la notificación llegó a mostrarse; false si no se pudo
 * (permiso no concedido, notificaciones apagadas, sin service worker o error).
 */
export async function showDailyNotification(title, body, url = '/', opts = {}) {
  if (!isEnabled()) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag: opts.tag || SYNC_TAG,
      vibrate: [200, 100, 200],
      data: { url }
    });
    return true;
  } catch (err) {
    console.warn('[notif] showDailyNotification error:', err?.message);
    return false;
  }
}

/**
 * Notificación diaria de novedades: si hoy hay contenido nuevo
 * (regalo del calendario sin abrir o razones nuevas por leer),
 * muestra una notificación con enlace directo a esa sección.
 * - Máximo 1 vez al día por usuario (dedupe en localStorage).
 * - Solo a partir de las 8:00 (misma ventana que el push del cron).
 */
export async function notifyTodayNovelties() {
  if (!isEnabled() || !('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const userId = getUserId();
  if (!userId) return;

  // Solo a partir de las 8:00 (hora de España, península)
  if (hourInSpain() < 8) return;

  // Dedupe: una comprobación/notificación de novedades por día y por usuario
  const dedupeKey = 'noveltiesNotifDate';
  if (getUserPref(dedupeKey) === todayISO()) return;

  // Single-flight: si ya hay una comprobación en curso, únete a ella
  if (noveltyCheckPromise) return noveltyCheckPromise;

  noveltyCheckPromise = (async () => {
    try {
      const items = await getTodayNovelties();
      if (!items.length) return;

      let title;
      let body;
      let url;
      if (items.length === 1) {
        const n = items[0];
        title = `Novedad de hoy ${n.icon}`;
        body = n.text;
        url = n.route; // enlace directo a la sección (p. ej. /calendario?day=...)
      } else {
        title = `Tienes ${items.length} novedades hoy`;
        body = items.map(n => `${n.icon} ${n.tag}: ${n.text}`).join('\n');
        url = '/'; // el Inicio las agrupa todas
      }

      await showDailyNotification(title, body, url, { tag: NOVELTIES_TAG });
    } finally {
      // Marca el día como comprobado haya o no novedades: la comprobación
      // (lectura de db) se hace 1 vez al día, no en cada navegación.
      setUserPref(dedupeKey, todayISO());
      noveltyCheckPromise = null;
    }
  })();

  return noveltyCheckPromise;
}

/**
 * Notificación local de cartas nuevas en Open When.
 * Detecta cartas recién añadidas (aún sin abrir y nunca anunciadas)
 * y avisa una sola vez por carta, con enlace directo a Open When.
 * No tiene puerta de hora: avisa en cuanto la usuaria abre la app
 * tras una actualización que añada cartas nuevas.
 */
export async function notifyNewOpenWhenLetters() {
  if (!isEnabled()) return;
  const userId = getUserId();
  if (!userId) return;
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;

  // Cartas que la usuaria aún no ha abierto
  let seen = [];
  try {
    const arr = JSON.parse(getUserPref('openwhen.seen', '[]'));
    if (Array.isArray(arr)) seen = arr;
  } catch { /* noop */ }

  // Cartas de las que ya avisamos (dedupe por usuaria)
  let announced = [];
  try {
    const arr = JSON.parse(getUserPref(OPENWHEN_ANNOUNCED_KEY, '[]'));
    if (Array.isArray(arr)) announced = arr;
  } catch { /* noop */ }

  // Incluye también las cartas personalizadas creadas desde el Admin
  const all = await loadAllOpenWhenLetters();
  const fresh = all.filter(l => !seen.includes(l.id) && !announced.includes(l.id));
  if (!fresh.length) return;

  const title = fresh.length === 1
    ? 'Nueva carta en Open When 💌'
    : `${fresh.length} cartas nuevas en Open When 💌`;
  const body = fresh.length === 1
    ? `«${fresh[0].title}» te está esperando.`
    : 'Te están esperando. ¿Qué necesitas ahora? 🤍';

  await showDailyNotification(title, body, '/openwhen', { tag: OPENWHEN_TAG });

  // Solo marca como anunciadas si la notificación pudo mostrarse
  setUserPref(OPENWHEN_ANNOUNCED_KEY, JSON.stringify([...announced, ...fresh.map(l => l.id)]));
}

/**
 * Convierte base64 URL-safe a Uint8Array (para applicationServerKey).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
