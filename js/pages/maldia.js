// maldia.js - Frases, contador, musica y animaciones

const phrases = [
    "Respira. No tienes que arreglarlo todo ahora mismo. Primero: agua, aire y un poquito de ternura contigo.",
    "Estas aqui, y eso ya es suficiente. Un dia mas, un paso mas. Yo te veo, y eres increible.",
    "No necesitas rendir cuentas hoy. Solo existir. Y si puedes, sonreir un poquito.",
    "Eres mas fuerte de lo que crees, mas bonita de lo que piensas y mas querida de lo que imaginas.",
    "Hoy puede que no sea facil, pero manana sera otro dia. Yo seguire estando aqui para ti.",
    "Tu mision ahora: beber agua, respirar hondo y recordar que te quiero muchisimo.",
    "No tienes que poder con todo. Permitete descansar. Yo te apano el resto."
];

let kindCount = 0;
let isMusicPlaying = false;
let audioElement = null;

const maldiaRef = db.collection('maldia').doc('contador');

async function loadCount() {
    try {
        const doc = await maldiaRef.get();
        if (doc.exists && typeof doc.data().cuenta === 'number') {
            kindCount = doc.data().cuenta;
        } else {
            kindCount = 0;
            await maldiaRef.set({ cuenta: 0 });
        }
    } catch (error) {
        console.error('Error al cargar contador:', error);
        kindCount = 0;
    }

    const counter = document.getElementById('kindCounter');
    if (counter) counter.textContent = kindCount;
}

async function saveCount() {
    try {
        await maldiaRef.set({ cuenta: kindCount }, { merge: true });
    } catch (error) {
        console.error('Error al guardar contador:', error);
    }
}

function initMusic() {
    audioElement = document.getElementById('happyAudio');
    if (!audioElement) {
        console.warn("No se encontro <audio id='happyAudio'>");
        return;
    }

    audioElement.load();

    const startOnInteraction = () => {
        if (!isMusicPlaying && audioElement && audioElement.paused) {
            audioElement.play().catch((error) => console.log('Autoplay denegado:', error));
            isMusicPlaying = true;
            updateMusicButtonUI();
        }
        document.removeEventListener('click', startOnInteraction);
        document.removeEventListener('keydown', startOnInteraction);
    };

    document.addEventListener('click', startOnInteraction);
    document.addEventListener('keydown', startOnInteraction);
}

function updateMusicButtonUI() {
    const musicBtn = document.getElementById('musicBtn');
    if (!musicBtn) return;

    if (isMusicPlaying) {
        musicBtn.innerHTML = '<i data-lucide="volume-2"></i> Pausar musica';
    } else {
        musicBtn.innerHTML = '<i data-lucide="volume-x"></i> Pon musica feliz';
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleMusic() {
    if (!audioElement) return;

    if (isMusicPlaying) {
        audioElement.pause();
        isMusicPlaying = false;
    } else {
        audioElement.play().catch((error) => console.warn('No se pudo reproducir:', error));
        isMusicPlaying = true;
    }

    updateMusicButtonUI();

    const waveBars = document.querySelectorAll('.wave-bar');
    waveBars.forEach((bar) => {
        if (isMusicPlaying) {
            bar.style.animation = 'wave 0.8s ease-in-out infinite';
        } else {
            bar.style.animation = 'none';
        }
    });
}

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

function betterDay() {
    randomPhrase();
    if (typeof launchParticles === 'function') {
        const source = document.querySelector('.hero-card') || document.querySelector('.bento-hero') || document.body;
        launchParticles({
            amount: 20,
            symbols: ['❤', '✦', '✧', '☀'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1', '#ffd966'],
            spread: 150,
            source
        });
    }
    if (typeof pulseElement === 'function') {
        pulseElement(document.getElementById('betterBtn'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadCount();
    randomPhrase();
    initMusic();

    document.getElementById('newPhraseBtn')?.addEventListener('click', randomPhrase);
    document.getElementById('musicBtn')?.addEventListener('click', toggleMusic);
    document.getElementById('betterBtn')?.addEventListener('click', betterDay);
    document.getElementById('countBtn')?.addEventListener('click', async () => {
        kindCount++;
        const counter = document.getElementById('kindCounter');
        if (counter) counter.textContent = kindCount;
        await saveCount();

        if (typeof launchParticles === 'function') {
            launchParticles({
                amount: 12,
                symbols: ['❤', '❤️', '♡'],
                colors: ['#c65a3a', '#ff8aa1', '#ffb347'],
                spread: 110,
                source: counter
            });
        }

        if (typeof pulseElement === 'function') {
            pulseElement(document.getElementById('countBtn'));
        }
    });

    updateMusicButtonUI();
});
