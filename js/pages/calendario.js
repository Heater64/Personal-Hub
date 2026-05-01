// ==========================================
// calendario.js · calendario de sorpresas
// ==========================================
const surprises = [
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', ''
];
const openedKey = 'calendarioSorpresasAbiertas';
const opened = JSON.parse(localStorage.getItem(openedKey) || '[]');
const visibleDays = 16;

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    grid.innerHTML = surprises.slice(0, visibleDays).map((text, index) => `
        <button class="day-card ${opened.includes(index) ? 'opened' : ''}" data-day="${index}" type="button">
            <span class="day-number">${index + 1}</span>
            <span class="muted">${opened.includes(index) ? 'abierto' : 'abrir sorpresa'}</span>
        </button>
    `).join('');
}

function revealSurprise(day, surpriseBox, surpriseTitle, surpriseText) {
    surpriseTitle.textContent = '¡Sorpresa! ✨';
    surpriseText.textContent = 'Abriendo tu detalle...';
    surpriseBox.classList.remove('show');
    void surpriseBox.offsetWidth;
    surpriseBox.classList.add('show');

    setTimeout(() => {
        surpriseTitle.textContent = `Día ${day + 1}`;
        surpriseText.textContent = surprises[day];
    }, 180);
}

function initCalendario() {
    const grid = document.getElementById('calendarGrid');
    const surpriseBox = document.getElementById('surpriseBox');
    const surpriseTitle = document.getElementById('surpriseTitle');
    const surpriseText = document.getElementById('surpriseText');
    if (!grid || !surpriseBox || !surpriseTitle || !surpriseText) return;

    renderCalendar();

    grid.addEventListener('click', function (event) {
        const card = event.target.closest('.day-card');
        if (!card) return;

        const day = Number(card.dataset.day);
        if (!opened.includes(day)) {
            opened.push(day);
            localStorage.setItem(openedKey, JSON.stringify(opened));
            renderCalendar();
        }

        if (typeof pulseElement === 'function') pulseElement(card);
        if (typeof launchParticles === 'function') {
            launchParticles({
                amount: 10,
                symbols: ['✦', '✨', '★'],
                colors: ['#ffb347', '#c65a3a', '#ff8aa1'],
                spread: 110,
                source: card
            });
        }

        revealSurprise(day, surpriseBox, surpriseTitle, surpriseText);
    });
}

document.addEventListener('DOMContentLoaded', initCalendario);
