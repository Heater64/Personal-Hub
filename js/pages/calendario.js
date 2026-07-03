// Orquestador del calendario — sin switch por tipo de regalo

import { loadGiftsCatalog } from '../data/giftLoader.js';
import {
    loadGiftProgress,
    markGiftOpened,
    getProgressMap,
    getManualUnlocks
} from '../data/giftProgress.js';
import { getDayState, getNewlyUnlockedDays } from '../core/unlockEngine.js';
import { renderGiftExperience } from '../core/renderer.js';
import { openExperienceModal, closeExperienceModal } from '../core/modalSystem.js';
import { renderCalendarGrid } from '../ui/calendarGrid.js';

const USE_GIFT_PLATFORM = window.USE_GIFT_PLATFORM !== false;
const VISIBLE_DAYS = 31;
const UNLOCK_CHECK_MS = 60000;

let catalog = null;
let unlockCheckInterval = null;

function showToast(message, isError = false) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, isError);
        return;
    }
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, isError);
        return;
    }
    let toast = document.querySelector('.toast-message');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    if (isError) toast.style.borderLeftColor = '#dc3545';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function buildUnlockContext() {
    return {
        progressMap: getProgressMap(),
        giftById: catalog?.giftsById || {},
        manualUnlocks: getManualUnlocks()
    };
}

function buildDayMeta() {
    const progressMap = getProgressMap();
    const ctx = buildUnlockContext();
    const dayMeta = {};

    for (let day = 1; day <= VISIBLE_DAYS; day++) {
        const giftId = catalog.calendarMapping[String(day)];
        const gift = catalog.giftsById[giftId];
        const state = gift
            ? getDayState(day, { gift, progress: progressMap, unlockContext: { ...ctx, giftId } })
            : 'locked';
        dayMeta[String(day)] = {
            state,
            giftId,
            title: gift?.title || '',
            unlockDate: gift?.unlock?.mode === 'date' ? gift.unlock.value : ''
        };
    }
    return dayMeta;
}

function paintGrid() {
    const grid = document.getElementById('calendarGrid');
    if (!grid || !catalog) return;

    renderCalendarGrid({
        container: grid,
        calendarMapping: catalog.calendarMapping,
        dayMeta: buildDayMeta(),
        visibleDays: VISIBLE_DAYS,
        onDayClick: handleDayClick
    });
}

function createGiftLoader() {
    const loader = document.createElement('div');
    loader.className = 'gift-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = `
        <div class="heart-pulse" aria-hidden="true">❤️</div>
        <span>Cargando sorpresa...</span>
    `;
    return loader;
}

async function handleDayClick({ day, giftId, disabled }) {
    const gift = catalog.giftsById[giftId];
    if (!gift) return;

    if (disabled) {
        const date = gift.unlock?.value;
        showToast(date ? `📅 Se desbloqueará el ${date}` : '🔒 Aún no disponible');
        return;
    }

    const progressMap = getProgressMap();
    if (!progressMap[giftId]?.opened) {
        await markGiftOpened(giftId, { calendarMapping: catalog.calendarMapping });
        paintGrid();
    }

    try {
        let contentNode = null;
        const modal = openExperienceModal({
            title: gift.title,
            contentNode: createGiftLoader(),
            onClose: () => {
                if (contentNode?._cleanup) contentNode._cleanup();
            }
        });

        contentNode = await renderGiftExperience(gift, () => closeExperienceModal());
        modal?.setContent(contentNode);
    } catch (err) {
        console.error(err);
        showToast('No se pudo cargar la experiencia', true);
    }
}

async function autoUnlockByDate() {
    const newly = getNewlyUnlockedDays(
        catalog.calendarMapping,
        catalog.giftsById,
        getProgressMap(),
        buildUnlockContext()
    );
    if (!newly.length) return;
    for (const { giftId } of newly) {
        await markGiftOpened(giftId, { calendarMapping: catalog.calendarMapping });
    }
    paintGrid();
}

function startUnlockChecker() {
    if (unlockCheckInterval) clearInterval(unlockCheckInterval);
    unlockCheckInterval = setInterval(() => autoUnlockByDate(), UNLOCK_CHECK_MS);
    autoUnlockByDate();
}


/** Legacy fallback (feature flag off) */
function initLegacyCalendario() {
    const UNLOCK_SCHEDULE = {
        1: '2026-12-01', 2: '2026-12-02', 3: '2026-12-03', 4: '2026-12-04',
        5: '2026-12-05', 6: '2026-12-06', 7: '2026-12-07', 8: '2026-12-08',
        9: '2026-12-09', 10: '2026-12-10', 11: '2026-12-11', 12: '2026-12-12',
        13: '2026-12-13', 14: '2026-12-14', 15: '2026-12-15', 16: '2026-12-16',
        17: '2026-12-17', 18: '2026-12-18', 19: '2026-12-19', 20: '2026-12-20',
        21: '2026-12-21', 22: '2026-12-22', 23: '2026-12-23', 24: '2026-12-24',
        25: '2026-12-25', 26: '2026-12-26', 27: '2026-12-27', 28: '2026-12-28',
        29: '2026-12-29', 30: '2026-12-30', 31: '2026-12-31'
    };
    let opened = [];
    const getToday = () => new Date().toISOString().split('T')[0];
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const render = () => {
        grid.innerHTML = Array.from({ length: VISIBLE_DAYS }, (_, i) => {
            const unlockDate = UNLOCK_SCHEDULE[i + 1];
            const unlocked = opened.includes(i) || getToday() >= unlockDate;
            const isOpened = opened.includes(i);
            return `<button class="day-card ${isOpened ? 'opened' : ''} ${!unlocked ? 'locked' : ''}" data-day="${i}" type="button" ${!unlocked ? 'disabled' : ''}>
                <span class="day-number">${i + 1}</span>
                <span class="day-status">${isOpened ? '✓' : (unlocked ? '✨' : '🔒')}</span>
            </button>`;
        }).join('');
    };

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.day-card');
        if (!card || card.disabled) return;
        const day = Number(card.dataset.day);
        if (!opened.includes(day)) opened.push(day);
        render();
        alert('🎁 ¡Sorpresa!');
    });
    render();
}

async function initGiftPlatform() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    try {
        catalog = await loadGiftsCatalog();
        window.__calendarMapping = catalog.calendarMapping;

        await loadGiftProgress(catalog.calendarMapping, catalog.giftsById);
        paintGrid();
        startUnlockChecker();
    } catch (err) {
        console.error('Error iniciando plataforma de regalos:', err);
        showToast('Error cargando el calendario', true);
    }
}

async function init() {
    if (!USE_GIFT_PLATFORM) {
        initLegacyCalendario();
        return;
    }
    await initGiftPlatform();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
