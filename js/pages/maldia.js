// ==========================================
// maldia.js · frases, musica y corazones
// ==========================================
const phrases = ['', '', '', '', '', '', '', '', '', ''];

function randomPhrase() {
    const heroMessage = document.getElementById('heroMessage');
    if (!heroMessage || !phrases.length) return;
    heroMessage.textContent = phrases[Math.floor(Math.random() * phrases.length)];
}

function launchHearts(amount = 18) {
    const floatHearts = document.getElementById('floatHearts');
    if (!floatHearts) return;
    const icons = ['❤', '✦', '☀', '♡'];
    for (let index = 0; index < amount; index++) {
        const span = document.createElement('span');
        span.textContent = icons[Math.floor(Math.random() * icons.length)];
        span.style.left = `${Math.random() * 100}%`;
        span.style.animationDelay = `${Math.random() * 0.6}s`;
        span.style.color = index % 2 === 0 ? '#ffc567' : '#ff8aa1';
        floatHearts.appendChild(span);
        setTimeout(() => span.remove(), 5200);
    }
}

function initMalDia() {
    const happyAudio = document.getElementById('happyAudio');
    const kindCounter = document.getElementById('kindCounter');
    const newPhraseBtn = document.getElementById('newPhraseBtn');
    const musicBtn = document.getElementById('musicBtn');
    const betterBtn = document.getElementById('betterBtn');
    const countBtn = document.getElementById('countBtn');

    randomPhrase();

    if (newPhraseBtn) newPhraseBtn.addEventListener('click', randomPhrase);
    if (musicBtn && happyAudio) {
        musicBtn.addEventListener('click', function () {
            if (happyAudio.paused) {
                happyAudio.play().catch(() => {});
            } else {
                happyAudio.pause();
            }
        });
    }
    if (betterBtn) {
        betterBtn.addEventListener('click', function () {
            randomPhrase();
            launchHearts();
        });
    }
    if (countBtn && kindCounter) {
        countBtn.addEventListener('click', function () {
            const value = Number(kindCounter.textContent || 0) + 1;
            kindCounter.textContent = value;
            launchHearts(8);
        });
    }
}

document.addEventListener('DOMContentLoaded', initMalDia);
