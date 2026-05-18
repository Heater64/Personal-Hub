const STORAGE_KEY = 'personalHub.giftProgress';

let progressMap = {};
let manualUnlocks = new Set();
let legacyOpenedIndices = [];

function persistProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));
    } catch (err) {
        console.error('Error guardando progreso local:', err);
    }
}

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

    try {
        progressMap = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (err) {
        console.error('Error cargando progreso local:', err);
        progressMap = {};
    }

    return progressMap;
}

export async function saveGiftProgress(giftId, patch) {
    const existing = progressMap[giftId] || {};
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    progressMap[giftId] = next;
    persistProgress();
    return next;
}

export async function markGiftOpened(giftId, { completed = false } = {}) {
    const patch = {
        opened: true,
        openedAt: new Date().toISOString()
    };
    if (completed) patch.completed = true;
    return saveGiftProgress(giftId, patch);
}

export function setManualUnlock(giftId, enabled = true) {
    if (enabled) manualUnlocks.add(giftId);
    else manualUnlocks.delete(giftId);
}

export function subscribeGiftProgress(callback) {
    if (typeof callback === 'function') callback(progressMap);
    return () => {};
}
