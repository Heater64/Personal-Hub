// ==========================================
// calendario.js · calendario de sorpresas
// ==========================================
const surprises = [
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', ''
];
const visibleDays = 16;

const calendarioRef = db.collection('calendario').doc('sorpresas');

let opened = [];

async function loadOpened() {
    try {
        const doc = await calendarioRef.get();
        if (doc.exists && doc.data().abiertos) {
            opened = doc.data().abiertos;
        } else {
            opened = [];
            await calendarioRef.set({ abiertos: [] });
        }
    } catch (error) {
        console.error('Error al cargar calendario:', error);
        opened = [];
    }
    renderCalendar();
}

async function saveOpened() {
    try {
        await calendarioRef.set({ abiertos: opened }, { merge: true });
    } catch (error) {
        console.error('Error al guardar calendario:', error);
        showMessage('No se pudo guardar en la nube', true);
    }
}

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
        surpriseTitle.textContent = `Dia ${day + 1}`;
        surpriseText.textContent = surprises[day];
    }, 180);
}

function initCalendario() {
    const grid = document.getElementById('calendarGrid');
    const surpriseBox = document.getElementById('surpriseBox');
    const surpriseTitle = document.getElementById('surpriseTitle');
    const surpriseText = document.getElementById('surpriseText');
    if (!grid || !surpriseBox || !surpriseTitle || !surpriseText) return;

    loadOpened();

    grid.addEventListener('click', async function (event) {
        const card = event.target.closest('.day-card');
        if (!card) return;

        const day = Number(card.dataset.day);
        if (!opened.includes(day)) {
            opened.push(day);
            await saveOpened();
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
