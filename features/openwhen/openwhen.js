// openwhen.js – Cartas interactivas con expansión en grid
const lettersData = [
    {
        title: "Abrela cuando sientas que no te amo.",
        note: "Cosa que no es verdad, yo siempre te amo y te amaré por siempre jamás.",
        message: "Te amo mucho y quiero que sepas que siempre estaré aquí para ti, apoyándote en cada paso del camino. Porque estamos juntos en esto. Peluche y princesa para siempre. 🤍🤍🤍"
    },
    {
        title: "Abrela cuando...",
        note: "",
        message: ""
    },
    {
        title: "Abrela cuando...",
        note: "",
        message: ""
    },
    {
        title: "Abrela cuando...",
        note: "",
        message: ""
    },
    {
        title: "Abrela cuando...",
        note: "",
        message: ""
    },
    {
        title: "Abrela cuando...",
        note: "",
        message: ""
    },
];

function renderLetters() {
    const grid = document.getElementById('lettersGrid');
    if (!grid) return;

    grid.innerHTML = lettersData.map((letter, index) => `
        <div class="letter-card" data-id="${index}">
            <div class="card-icon">
                <i data-lucide="mail"></i>
            </div>
            <h3 data-editable="openwhen_title_${index}">${escapeHtml(letter.title)}</h3>
            <div class="letter-note" data-editable="openwhen_note_${index}">${escapeHtml(letter.note)}</div>
            <button class="open-btn" data-id="${index}">
                <i data-lucide="mail-open"></i> Abrir carta
            </button>
            <div class="letter-content-open">
                <div class="letter-heart">🤍</div>
                <div class="letter-message">${escapeHtml(letter.message).replace(/\n/g, '<br>')}</div>
                <div class="letter-signature">— Con todo mi cariño: Peluchito</div>
                <button class="close-btn" data-id="${index}">
                    <i data-lucide="x"></i> Cerrar sobre
                </button>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Eventos para abrir/cerrar
    document.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.letter-card');
            if (!card) return;
            // Cerrar cualquier otra carta abierta
            document.querySelectorAll('.letter-card.open').forEach(openCard => {
                if (openCard !== card) openCard.classList.remove('open');
            });
            card.classList.add('open');
            if (typeof launchParticles === 'function') {
                launchParticles({
                    amount: 12,
                    symbols: ['❤', '✉', '✨'],
                    colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
                    spread: 120,
                    source: btn
                });
            }
            if (typeof pulseElement === 'function') pulseElement(btn);
        });
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.letter-card');
            if (card) card.classList.remove('open');
            if (typeof pulseElement === 'function') pulseElement(btn);
        });
    });
}

document.addEventListener('DOMContentLoaded', renderLetters);