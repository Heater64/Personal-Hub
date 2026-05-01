// ==========================================
// openwhen.js · cartas digitales
// ==========================================
const letters = [
    { title: 'Abrela cuando estes triste', note: 'Un empujoncito para los dias grises.', message: 'No tienes que poder con todo a la vez. Respira, descansa un poco y recuerda que ya has superado cosas muy dificiles antes. Sigues siendo increible incluso en tus dias flojitos.' },
    { title: 'Abrela cuando me eches de menos', note: 'Para cuando la distancia pese mas.', message: 'Si ahora mismo pudiera, iria a buscarte para darte un abrazo largo. Mientras tanto, piensa en todo lo bonito que ya tenemos y en todo lo que todavia vamos a vivir.' },
    { title: 'Abrela cuando tengas un exito', note: 'Para celebrar contigo aunque sea en pantalla.', message: 'Sabia que podias hacerlo. Estoy orgulloso de ti no solo por lograrlo, sino por todo lo que has trabajado para llegar hasta ahi. Hoy toca presumir de ti un poquito.' },
    { title: 'Abrela cuando dudes de ti', note: 'Para recordarte quien eres.', message: 'A veces te miras mas duro de lo que mereces. Yo veo a una persona valiente, lista, sensible y especial. No necesitas ser perfecta para ser maravillosa.' },
    { title: 'Abrela cuando no puedas dormir', note: 'Una carta tranquilita para bajar revoluciones.', message: 'Imagina una noche calmada, una manta, una luz tenue y mi mano buscando la tuya. No corras. El mundo puede esperar a manana. Ahora solo toca descansar.' },
    { title: 'Abrela cuando quieras sonreir', note: 'Un mini refugio para momentos random.', message: 'Quiero que recuerdes esta verdad sencilla: haces bonito mi mundo. Incluso cuando no lo intentas. Incluso cuando no lo ves. Y eso ya es una razon enorme para sonreir.' }
];

function openEnvelope(title, message, source = null) {
    const modal = document.getElementById('envelopeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    if (!modal || !modalTitle || !modalMessage) return;

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add('active');

    if (typeof pulseElement === 'function') pulseElement(modal.querySelector('.envelope-modal'));
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 10,
            symbols: ['❤', '✦', '✉'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
            spread: 120,
            source: source || modal.querySelector('.envelope-modal')
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeEnvelope() {
    const modal = document.getElementById('envelopeModal');
    if (modal) modal.classList.remove('active');
}

function initOpenWhen() {
    const grid = document.getElementById('lettersGrid');
    const closeBtn = document.getElementById('closeModalBtn');
    const closeIconBtn = document.getElementById('modalCloseIcon');
    const modal = document.getElementById('envelopeModal');
    if (!grid) return;

    grid.innerHTML = letters.map((letter, index) => `
        <article class="letter-card" data-id="${index}">
            <div class="letter-top">
                <div class="letter-icon"><i data-lucide="mail"></i></div>
            </div>
            <h3>${escapeHtml(letter.title)}</h3>
            <small class="letter-note">${escapeHtml(letter.note)}</small>
            <button class="open-btn" type="button" data-title="${escapeHtml(letter.title)}" data-message="${escapeHtml(letter.message)}">
                <i data-lucide="mail-open"></i>
                <span>Abrir carta</span>
            </button>
        </article>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.querySelectorAll('.open-btn').forEach((btn) => {
        btn.addEventListener('click', function (event) {
            event.stopPropagation();
            if (typeof pulseElement === 'function') pulseElement(btn);
            openEnvelope(btn.getAttribute('data-title'), btn.getAttribute('data-message'), btn);
        });
    });

    if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) closeEnvelope();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeEnvelope);
    if (closeIconBtn) closeIconBtn.addEventListener('click', closeEnvelope);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeEnvelope();
        }
    });
}

document.addEventListener('DOMContentLoaded', initOpenWhen);
