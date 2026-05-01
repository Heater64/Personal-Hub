// maldia.js – Frases, contador, música y animaciones
const phrases = [
    "Respira. No tienes que arreglarlo todo ahora mismo. Primero: agua, aire y un poquito de ternura contigo.",
    "Estás aquí, y eso ya es suficiente. Un día más, un paso más. Yo te veo, y eres increíble.",
    "No necesitas rendir cuentas hoy. Solo existir. Y si puedes, sonreír un poquito.",
    "Eres más fuerte de lo que crees, más bonita de lo que piensas y más querida de lo que imaginas.",
    "Hoy puede que no sea fácil, pero mañana será otro día. Y yo seguiré estando aquí para ti.",
    "Tu misión ahora: beber agua, respirar hondo y recordar que te quiero muchísimo.",
    "No tienes que poder con todo. Permítete descansar. Yo te apaño el resto."
];

let kindCount = 0;
let isMusicPlaying = false;
let audio = null;

function randomPhrase() {
    const heroMsg = document.getElementById('heroMessage');
    if (heroMsg) {
        const randomIndex = Math.floor(Math.random() * phrases.length);
        heroMsg.textContent = phrases[randomIndex];
        if (typeof launchParticles === 'function') {
            launchParticles({
                amount: 8,
                symbols: ['❤', '✦'],
                colors: ['#ffb347', '#c65a3a'],
                spread: 100,
                source: heroMsg
            });
        }
    }
}

function updateCounter() {
    const counterEl = document.getElementById('kindCounter');
    if (counterEl) {
        kindCount++;
        counterEl.textContent = kindCount;
        if (typeof launchParticles === 'function') {
            launchParticles({
                amount: 12,
                symbols: ['❤', '❤️', '♡'],
                colors: ['#c65a3a', '#ff8aa1', '#ffb347'],
                spread: 110,
                source: counterEl
            });
        }
    }
}

function initMusic() {
    audio = document.getElementById('happyAudio');
    if (!audio) return;
    // Aquí puedes poner una URL real de música alegre
    // audio.src = "https://ejemplo.com/cancion-feliz.mp3";
    // Por ahora solo simulamos
}

function toggleMusic() {
    if (!audio) return;
    if (isMusicPlaying) {
        audio.pause();
        isMusicPlaying = false;
    } else {
        audio.play().catch(() => {});
        isMusicPlaying = true;
    }
}

function betterDay() {
    randomPhrase();
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 20,
            symbols: ['❤', '✦', '✧', '☀'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1', '#ffd966'],
            spread: 150,
            source: document.querySelector('.hero-card')
        });
    }
    if (typeof pulseElement === 'function') {
        pulseElement(document.getElementById('betterBtn'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    randomPhrase();
    initMusic();
    
    const counterEl = document.getElementById('kindCounter');
    if (counterEl) {
        const saved = localStorage.getItem('maldia_count');
        if (saved) kindCount = parseInt(saved);
        counterEl.textContent = kindCount;
    }
    
    document.getElementById('newPhraseBtn')?.addEventListener('click', randomPhrase);
    document.getElementById('musicBtn')?.addEventListener('click', toggleMusic);
    document.getElementById('betterBtn')?.addEventListener('click', betterDay);
    document.getElementById('countBtn')?.addEventListener('click', () => {
        updateCounter();
        localStorage.setItem('maldia_count', kindCount);
        if (typeof pulseElement === 'function') pulseElement(document.getElementById('countBtn'));
    });
});