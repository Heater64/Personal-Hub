// Carga gifts desde JSON local o Firebase

const DEFAULT_JSON_PATH = '../data/gifts.json';

let cachedCatalog = null;

export async function loadGiftsCatalog(options = {}) {
    if (cachedCatalog && !options.force) return cachedCatalog;

    const fromFirebase = options.preferFirebase && typeof window.loadGiftsFromFirebase === 'function';
    if (fromFirebase) {
        try {
            const remote = await window.loadGiftsFromFirebase();
            if (remote?.gifts?.length) {
                cachedCatalog = normalizeCatalog(remote);
                return cachedCatalog;
            }
        } catch (err) {
            console.warn('Firebase gifts fallback a JSON:', err);
        }
    }

    const path = options.jsonPath || DEFAULT_JSON_PATH;
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`No se pudo cargar gifts: ${res.status}`);
    const data = await res.json();
    cachedCatalog = normalizeCatalog(data);
    return cachedCatalog;
}

export function normalizeCatalog(raw) {
    const gifts = raw.gifts || [];
    const giftsById = {};
    gifts.forEach((g) => {
        if (g?.id) giftsById[g.id] = g;
    });
    return {
        version: raw.version || 1,
        calendarMapping: raw.calendarMapping || {},
        gifts,
        giftsById
    };
}

export function clearGiftsCache() {
    cachedCatalog = null;
}
