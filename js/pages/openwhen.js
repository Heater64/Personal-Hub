// openwhen.js – Cartas interactivas con expansión en grid
const lettersData = [
    {
        title: "Abrela cuando estes triste",
        note: "Un empujoncito para los dias grises.",
        message: "No tienes que poder con todo a la vez. Respira, descansa un poco y recuerda que ya has superado cosas muy dificiles antes. Sigues siendo increible incluso en tus dias flojitos.\n\n❤️ Tómate tu tiempo, yo estaré aquí."
    },
    {
        title: "Abrela cuando me eches de menos",
        note: "Para cuando la distancia pese mas.",
        message: "Si ahora mismo pudiera, iria a buscarte para darte un abrazo largo. Mientras tanto, piensa en todo lo bonito que ya tenemos y en todo lo que todavia vamos a vivir.\n\n✨ Te llevo conmigo siempre."
    },
    {
        title: "Abrela cuando tengas un exito",
        note: "Para celebrar contigo aunque sea en pantalla.",
        message: "Sabia que podias hacerlo. Estoy orgulloso de ti no solo por lograrlo, sino por todo lo que has trabajado para llegar hasta ahi. Hoy toca presumir de ti un poquito.\n\n🎉 ¡Felicidades, campeona!"
    },
    {
        title: "Abrela cuando dudes de ti",
        note: "Para recordarte quien eres.",
        message: "A veces te miras mas duro de lo que mereces. Yo veo a una persona valiente, lista, sensible y especial. No necesitas ser perfecta para ser maravillosa.\n\n💪 Confía en ti, yo confío."
    },
    {
        title: "Abrela cuando no puedas dormir",
        note: "Una carta tranquilita para bajar revoluciones.",
        message: "Imagina una noche calmada, una manta, una luz tenue y mi mano buscando la tuya. No corras. El mundo puede esperar a manana. Ahora solo toca descansar.\n\n🌙 Buenas noches, mi amor."
    },
    {
        title: "Abrela cuando quieras sonreir",
        note: "Un mini refugio para momentos random.",
        message: "Quiero que recuerdes esta verdad sencilla: haces bonito mi mundo. Incluso cuando no lo intentas. Incluso cuando no lo ves. Y eso ya es una razon enorme para sonreir.\n\n😊 Gracias por existir."
    }
];

function renderLetters() {
    const grid = document.getElementById('lettersGrid');
    if (!grid) return;

    grid.innerHTML = lettersData.map((letter, index) => `
        <div class="letter-card" data-id="${index}">
            <div class="card-icon">
                <i data-lucide="mail"></i>
            </div>
            <h3>${escapeHtml(letter.title)}</h3>
            <div class="letter-note">${escapeHtml(letter.note)}</div>
            <button class="open-btn" data-id="${index}">
                <i data-lucide="mail-open"></i> Abrir carta
            </button>
            <div class="letter-content-open">
                <div class="letter-heart">❤️</div>
                <div class="letter-message">${escapeHtml(letter.message).replace(/\n/g, '<br>')}</div>
                <div class="letter-signature">— Con todo mi cariño</div>
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