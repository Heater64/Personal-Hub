/* ==========================================
   Personal Hub v2 — User-scoped localStorage helpers
   Centraliza las claves de localStorage que deben ser
   independientes entre usuarios en el mismo navegador.
   ========================================== */

import { userStore } from '../stores/user.store.js';

/**
 * Returns the current logged-in user's id, or null.
 */
export function getUserId() {
  return userStore.getUser()?.id || null;
}

/**
 * Builds a user-scoped localStorage key.
 * Falls back to a global key when no user is logged in.
 */
export function userPrefKey(base) {
  const userId = getUserId();
  return userId ? `ph.${base}.${userId}` : `ph.${base}`;
}

/**
 * Reads a user-scoped localStorage value.
 * @param {string} base - short key name (e.g. 'notifications')
 * @param {*} defaultValue - value to return if the key is absent
 */
export function getUserPref(base, defaultValue = null) {
  const value = localStorage.getItem(userPrefKey(base));
  return value !== null ? value : defaultValue;
}

/**
 * Writes a user-scoped localStorage value.
 */
export function setUserPref(base, value) {
  localStorage.setItem(userPrefKey(base), value);
}

/**
 * Removes a user-scoped localStorage value.
 */
export function removeUserPref(base) {
  localStorage.removeItem(userPrefKey(base));
}

// Keys that used to be global and are now stored per-user.
// These are removed once at startup to avoid leaving orphan data.
const LEGACY_KEYS = [
  'ph.moodDate',
  'ph.mood',
  'ph.notifications',
  'ph.largeText',
  'ph.welcomeShownDate'
];

/**
 * Removes legacy global localStorage keys that have been replaced
 * by user-scoped keys. Safe to call multiple times (idempotent).
 */
export function cleanupLegacyKeys() {
  LEGACY_KEYS.forEach(key => {
    localStorage.removeItem(key);
  });
}
