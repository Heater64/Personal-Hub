// Grid de calendario — solo vista, sin lógica de tipos de regalo

const STATUS_ICON = {
    locked: '🔒',
    available: '✨',
    opened: '✓',
    completed: '♥'
};

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {Record<string, string>} options.calendarMapping - day → giftId
 * @param {Record<string, object>} options.dayMeta - day → { state, unlockDate, giftId, title }
 * @param {number} options.visibleDays
 */
export function renderCalendarGrid({
    container,
    calendarMapping = {},
    dayMeta = {},
    visibleDays = 31,
    onDayClick
}) {
    if (!container) return;

    container.innerHTML = Array.from({ length: visibleDays }, (_, i) => {
        const day = i + 1;
        const meta = dayMeta[String(day)] || dayMeta[day] || {};
        const state = meta.state || 'locked';
        const isLocked = state === 'locked';
        const isOpened = state === 'opened' || state === 'completed';
        const unlockDate = meta.unlockDate || '';

        const classes = [
            'day-card',
            isOpened ? 'opened' : '',
            isLocked ? 'locked' : ''
        ].filter(Boolean).join(' ');

        return `<button class="${classes}" data-day="${day}" data-gift-id="${meta.giftId || ''}" type="button" ${isLocked ? 'disabled' : ''}>
            <span class="day-number">${day}</span>
            <span class="day-status">${STATUS_ICON[state] || '✨'}</span>
            ${unlockDate && isLocked ? `<span class="lock-icon" title="Se desbloquea el ${unlockDate}">📅</span>` : ''}
        </button>`;
    }).join('');

    if (typeof onDayClick === 'function') {
        container.onclick = (e) => {
            const card = e.target.closest('.day-card');
            if (!card) return;
            onDayClick({
                day: Number(card.dataset.day),
                giftId: card.dataset.giftId,
                card,
                disabled: card.disabled
            });
        };
    }
}

export function refreshCalendarGrid(container, options) {
    renderCalendarGrid({ container, ...options });
}
