// Registry de renderizadores — carga dinámica por tipo

const MODULE_REGISTRY = {
    letter: () => import('../modules/letter/index.js'),
    polaroid: () => import('../modules/polaroid/index.js'),
    cassette: () => import('../modules/cassette/index.js'),
    diary: () => import('../modules/diary/index.js'),
    ticket: () => import('../modules/ticket/index.js'),
    holdButton: () => import('../modules/holdButton/index.js'),
    clickStar: () => import('../modules/clickStar/index.js'),
    cloudReveal: () => import('../modules/cloudReveal/index.js'),
    cinematic: () => import('../modules/cinematic/index.js'),
    memoryJar: () => import('../modules/memoryJar/index.js'),
    secretPlaylist: () => import('../modules/secretPlaylist/index.js'),
    instantCamera: () => import('../modules/instantCamera/index.js'),
    scratchCard: () => import('../modules/scratchCard/index.js'),
    constellation: () => import('../modules/constellation/index.js'),
    countdown: () => import('../modules/countdown/index.js'),
    moodCard: () => import('../modules/moodCard/index.js'),
    confidentialLetter: () => import('../modules/confidentialLetter/index.js'),
    emojiRain: () => import('../modules/emojiRain/index.js'),
    randomThought: () => import('../modules/randomThought/index.js'),
    beatingHeart: () => import('../modules/beatingHeart/index.js'),
    cipherMessage: () => import('../modules/cipherMessage/index.js'),
    giftBox: () => import('../modules/giftBox/index.js'),
    typewriter: () => import('../modules/typewriter/index.js')
};

const moduleCache = new Map();

export function registerGiftType(type, loaderFn) {
    MODULE_REGISTRY[type] = loaderFn;
}

export async function loadGiftModule(type) {
    if (moduleCache.has(type)) return moduleCache.get(type);
    const loader = MODULE_REGISTRY[type];
    if (!loader) {
        throw new Error(`Tipo de regalo no registrado: ${type}`);
    }
    const mod = await loader();
    moduleCache.set(type, mod);
    return mod;
}

export async function renderGiftExperience(gift, onClose) {
    const mod = await loadGiftModule(gift.type);
    if (typeof mod.render !== 'function') {
        throw new Error(`El módulo "${gift.type}" no exporta render()`);
    }
    return mod.render(gift.data || {}, onClose, gift);
}

export async function getGiftThumbnail(gift) {
    try {
        const mod = await loadGiftModule(gift.type);
        if (typeof mod.getThumbnail === 'function') {
            return mod.getThumbnail(gift.data || {}, gift);
        }
    } catch (_) { /* ignore */ }
    return gift.thumbnail || '';
}

export function getRegisteredTypes() {
    return Object.keys(MODULE_REGISTRY);
}
