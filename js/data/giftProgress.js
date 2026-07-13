// js/data/giftProgress.js
// Progreso de regalos con soporte cloud (Firestore) + localStorage como fallback

const STORAGE_KEY = 'personalHub.giftProgress';

let progressMap = {};
let manualUnlocks = new Set();
let legacyOpenedIndices = [];
let currentUid = null;

// ==========================================
// PERSISTENCIA LOCAL
// ==========================================

function persistLocal() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));
    } catch (err) {
        console.error('Error guardando progreso local:', err);
    }
}

function loadLocal() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (err) {
        console.error('Error cargando progreso local:', err);
        return {};
    }
}

// ==========================================
// FIRESTORE SYNC
// ==========================================

function getCurrentUid() {
    var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return user ? user.uid : null;
}

async function loadFromCloud(uid) {
    if (!uid || !window.db) return null;
    try {
        var ref = window.db.collection('users').doc(uid).collection('progress').doc('calendar');
        var doc = await ref.get();
        if (doc.exists && doc.data().gifts) {
            return doc.data().gifts;
        }
    } catch (err) {
        console.warn('⚠️ Error cargando progreso cloud:', err);
    }
    return null;
}

async function saveToCloud(uid, data) {
    if (!uid || !window.db) return;
    try {
        var ref = window.db.collection('users').doc(uid).collection('progress').doc('calendar');
        await ref.set({ gifts: data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
        console.warn('⚠️ Error guardando progreso cloud:', err);
    }
}

// ==========================================
// API PÚBLICA
// ==========================================

export function getProgressMap() {
    return { ...progressMap };
}

export function getLegacyOpenedIndices() {
    return [...legacyOpenedIndices];
}

export function getManualUnlocks() {
    return manualUnlocks;
}

export async function loadGiftProgress() {
    legacyOpenedIndices = [];
    progressMap = {};

    // Cargar desde localStorage como respaldo rápido
    progressMap = loadLocal();

    // Intentar cargar desde Firestore (si hay sesión)
    var uid = getCurrentUid();
    if (uid) {
        var cloudData = await loadFromCloud(uid);
        if (cloudData) {
            // Cloud tiene prioridad: fusionar con local (cloud wins)
            var merged = { ...progressMap, ...cloudData };
            progressMap = merged;
            // Actualizar localStorage con la versión cloud
            persistLocal();
            console.log('☁️ Progreso cargado desde cloud:', Object.keys(progressMap).length, 'regalos');
        } else if (Object.keys(progressMap).length > 0) {
            // No hay datos cloud pero sí locales → subir a cloud
            await saveToCloud(uid, progressMap);
            console.log('☁️ Progreso local subido a cloud');
        }
    }

    return progressMap;
}

export async function saveGiftProgress(giftId, patch) {
    var existing = progressMap[giftId] || {};
    var next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    progressMap[giftId] = next;

    // Guardar local siempre
    persistLocal();

    // Guardar en cloud si hay sesión
    var uid = getCurrentUid();
    if (uid) {
        await saveToCloud(uid, progressMap);
    }

    return next;
}

export async function markGiftOpened(giftId, opts) {
    var completed = opts && opts.completed;
    var patch = {
        opened: true,
        openedAt: new Date().toISOString()
    };
    if (completed) patch.completed = true;
    return saveGiftProgress(giftId, patch);
}

export function setManualUnlock(giftId, enabled) {
    if (enabled) manualUnlocks.add(giftId);
    else manualUnlocks.delete(giftId);
}

export function subscribeGiftProgress(callback) {
    if (typeof callback === 'function') callback(progressMap);
    return function () {};
}
