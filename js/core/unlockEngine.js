// js/core/unlockEngine.js
// Motor de desbloqueo — PRIMERO FECHA, luego progreso

export function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * @param {object} unlock - { mode, value }
 * @param {object} context - { progressMap, giftById, calendarMapping, dayNumber, manualUnlocks }
 */
export function isGiftUnlocked(unlock, context = {}) {
    // Si no hay unlock, está BLOQUEADO
    if (!unlock || !unlock.mode) {
        return false;
    }

    const {
        progressMap = {},
        giftById = {},
        manualUnlocks = new Set()
    } = context;

    const giftId = context.giftId;

    switch (unlock.mode) {
        case 'date': {
            const today = getTodayDateString();
            const unlockDate = unlock.value || '';
            return today >= unlockDate;
        }
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
            return false;
    }
}

/** 
 * Estado de un día en el grid: locked | available | opened | completed
 * PRIMERO verifica la fecha, SOLO luego evalúa el progreso
 */
export function getDayState(dayNumber, { gift, progress, unlockContext }) {
    const giftId = gift?.id;
    const prog = progress?.[giftId];
    
    // Si no hay gift, está bloqueado
    if (!gift) {
        return 'locked';
    }
    
    // PASO 1: Verificar si está desbloqueado por fecha
    const unlocked = isGiftUnlocked(gift.unlock, { ...unlockContext, giftId });
    
    // PASO 2: Si NO está desbloqueado por fecha, está BLOQUEADO
    // (incluso si tiene progreso guardado)
    if (!unlocked) {
        return 'locked';
    }
    
    // PASO 3: Si está desbloqueado por fecha, entonces evaluar el progreso
    if (prog?.completed) {
        return 'completed';
    }
    if (prog?.opened) {
        return 'opened';
    }
    
    return 'available';
}

export function canOpenDay(dayNumber, ctx) {
    const state = getDayState(dayNumber, ctx);
    return state !== 'locked';
}

/** Auto-desbloqueo por fecha */
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