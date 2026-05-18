// Motor de desbloqueo — independiente del calendario y de los tipos de regalo

export function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * @param {object} unlock - { mode, value }
 * @param {object} context - { progressMap, giftById, calendarMapping, dayNumber, manualUnlocks }
 */
export function isGiftUnlocked(unlock, context = {}) {
    if (!unlock || !unlock.mode) return true;

    const {
        progressMap = {},
        giftById = {},
        manualUnlocks = new Set()
    } = context;

    const giftId = context.giftId;

    switch (unlock.mode) {
        case 'date':
            return getTodayDateString() >= (unlock.value || '');
        case 'afterPrevious': {
            const prevId = unlock.value;
            if (!prevId) return false;
            const prev = progressMap[prevId];
            return Boolean(prev?.completed || prev?.opened);
        }
        case 'manual':
            return manualUnlocks.has(giftId) || Boolean(progressMap[giftId]?.manualUnlock);
        case 'score': {
            const required = Number(unlock.value) || 0;
            const score = Object.values(progressMap).filter((p) => p?.completed).length;
            return score >= required;
        }
        default:
            return true;
    }
}

/** Estado de un día en el grid: locked | available | opened | completed */
export function getDayState(dayNumber, { gift, progress, unlockContext }) {
    const giftId = gift?.id;
    const prog = progress?.[giftId];
    const unlocked = gift
        ? isGiftUnlocked(gift.unlock, { ...unlockContext, giftId })
        : false;

    if (prog?.completed) return 'completed';
    if (prog?.opened) return 'opened';
    if (unlocked) return 'available';
    return 'locked';
}

export function canOpenDay(dayNumber, ctx) {
    const state = getDayState(dayNumber, ctx);
    return state !== 'locked';
}

/** Auto-desbloqueo por fecha (equivalente al checkAndAutoUnlock legacy) */
export function getNewlyUnlockedDays(calendarMapping, giftsById, progressMap, unlockContext) {
    const newly = [];
    for (let day = 1; day <= 31; day++) {
        const giftId = calendarMapping[String(day)];
        const gift = giftsById[giftId];
        if (!gift) continue;
        const prog = progressMap[giftId];
        if (prog?.opened) continue;
        if (isGiftUnlocked(gift.unlock, { ...unlockContext, giftId })) {
            newly.push({ day, giftId });
        }
    }
    return newly;
}
