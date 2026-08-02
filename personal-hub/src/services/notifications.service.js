/* ==========================================
   Personal Hub v2 — Notifications Service
   Recordatorio diario (8:00) con notificación local real.
   - App abierta: App.js muestra la bienvenida + notificación.
   - App cerrada: Periodic Background Sync despierta el SW.
   El SW no tiene acceso a localStorage, así que el estado se
   comparte vía IndexedDB (mismo origin, ambos contexts).
   ponytail: periodicSync solo existe en Chromium y exige PWA
   instalada; si no, el timer de App.js (app abierta) sigue siendo
   el fallback. Upgrade path: push server con VAPID.
   ========================================== */

import { getUserPref, setUserPref, getUserId } from '../utils/userStorage.js';
import { todayISO } from '../utils/format.js';

const DB_NAME = 'ph-notifications';
const DB_STORE = 'state';
const SYNC_TAG = 'daily-welcome';

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
    /* IndexedDB no disponible: el recordatorio SW no funcionará, el timer sí */
  }
}

export function isEnabled() {
  return getUserPref('notifications', '0') === '1';
}

export async function requestEnable() {
  if (!('Notification' in window)) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  setUserPref('notifications', '1');
  await syncReminderState();
  return true;
}

export async function disable() {
  setUserPref('notifications', '0');
  await syncReminderState();
}

/**
 * Sincroniza el estado del recordatorio con el SW (IndexedDB)
 * y registra/desregistra el periodic sync.
 * Se llama al iniciar sesión y al cambiar el toggle.
 */
export async function syncReminderState() {
  const enabled = isEnabled() && 'Notification' in window && Notification.permission === 'granted';
  const userId = getUserId();
  // Conserva lastShown previo: el SW lo marca al notificar y no debe borrarse
  // aquí o la deduplicación "1 vez/día" se rompe.
  const prev = await getState();
  const state = { enabled: enabled && !!userId, userId, lastShown: prev?.lastShown ?? null };
  await setState(state);

  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return;
    if (state.enabled) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => null);
      if (!status || status.state === 'granted') {
        await reg.periodicSync.register(SYNC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
      }
    } else {
      await reg.periodicSync.unregister(SYNC_TAG).catch(() => {});
    }
  } catch {
    /* periodicSync no soportado o SW no listo */
  }
}

/** Marca que la bienvenida ya se mostró hoy para que el SW no la duplique (1 vez/día). */
export async function markWelcomeShownToday() {
  const state = (await getState()) || {};
  await setState({ ...state, lastShown: todayISO() });
}

/** Notificación inmediata vía SW (app abierta). Marca el día para respetar 1 vez/día. */
export async function showDailyNotification(title, body, url = '/') {
  if (!isEnabled() || !('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag: SYNC_TAG, vibrate: [200, 100, 200], data: { url } });
  } catch {
    /* notificación fallida silenciosamente */
  }
}
