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

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = surprises.map((text, index) => `
        <button class="day-card ${opened.includes(index) ? 'opened' : ''}" data-day="${index}">
            <span class="day-number">${index + 1}</span>
            <span class="muted">${opened.includes(index) ? 'abierto' : 'abrir sorpresa'}</span>
        </button>
    `).join('');
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
        surpriseTitle.textContent = `Dia ${day + 1}`;
        surpriseText.textContent = surprises[day];
        surpriseBox.classList.add('show');
    });
}

document.addEventListener('DOMContentLoaded', initCalendario);
