// maldia.js - Versión completa con recuerdos

const phrases = [
    "Respira. No tienes que arreglarlo todo ahora mismo. Primero: agua, aire y un abrazo.",
    "Estás aquí, y eso ya es suficiente. Un día más, un paso más. Yo te veo, y eres increíble.",
    "No necesitas demostrar nada a nadie. Solo a ti misma. Y si puedes, sonreír un poquito.",
    "Eres más fuerte de lo que crees, más bonita de lo que piensas y más querida de lo que imaginas.",
    "Hoy puede que no sea fácil, pero mañana será otro día. Yo seguiré estando aquí para ti.",
    "Tu misión ahora: beber agua, respirar hondo y recordar que te quiero muchísimo.",
    "No tienes que poder con todo. Permítete descansar. Yo te apaño el resto.",
    "Eres mi persona favorita en este planeta. No lo olvides.",
    "Aunque hoy sea gris, recuerda que los días bonitos también existen y volverán.",
    "Tómate un minuto para ti. Cierra los ojos. Respira. Yo cuido de ti.",
    "✨ Eres única, especial e irrepetible. No hay nadie como tú.",
    "🌼 Tu sonrisa ilumina incluso los días más nublados.",
    "💫 La vida es mejor porque tú estás en ella.",
    "🌸 Eres como una flor que florece incluso en invierno.",
    "⭐ Tu fuerza me inspira cada día un poco más.",
    "💖 Eres el mejor descubrimiento de mi vida.",
    "🌈 Incluso sin saberlo, haces mi mundo más bonito.",
    "🎀 Eres perfecta exactamente como eres.",
];

const dailyMessages = [
    "🌟 Cada día te conviertes en una versión más maravillosa de ti misma.",
];

// Recuerdos (imágenes)
const memories = [
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777747760/5199564237372592635_eqj9v5.jpg", caption: "Siempre tan linda ✨" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766240/5913325400387948133_1_t6a24g.jpg", caption: "piscina con mi princesa" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766239/5913325400387948134_efteqk.jpg", caption: "comprando papitash jsjs" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766239/5913325400387948135_diq97c.jpg", caption: "Que hermosa que eres" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948138_ryirj6.jpg", caption: "Batooon" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948137_i6fcp2.jpg", caption: "Que preciosidad" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948136_n6ayva.jpg", caption: "JSsjsjsj" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948139_qdgn0l.jpg", caption: "Que ojazos tiene mi princesa" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/6046582610491806111_mx6qc3.jpg", caption: "Yo tambien te amo miniñaaaaaaaaaa" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1783252673/5931306366871997939_mpvodw.jpg", caption: "jijijiji si somosh" },
];

let isMusicPlaying = false;
let audioElement = null;
let breathingInterval = null;
let currentDailyMessageIndex = 0;
let currentMemoryIndex = 0;

// ==========================================
// FRASES Y MENSAJES
// ==========================================

function randomPhrase() {
    const heroMsg = document.getElementById('heroMessage');
    if (heroMsg) {
        const randomIndex = Math.floor(Math.random() * phrases.length);
        heroMsg.textContent = phrases[randomIndex];
    }
}

function updateDailyMessage() {
    const msgEl = document.getElementById('dailyMessage');
    if (msgEl) {
        currentDailyMessageIndex = (currentDailyMessageIndex + 1) % dailyMessages.length;
        msgEl.textContent = dailyMessages[currentDailyMessageIndex];
        if (typeof pulseElement === 'function') pulseElement(msgEl);
    }
}

// ==========================================
// RECUERDOS
// ==========================================

function changeMemory() {
    currentMemoryIndex = (currentMemoryIndex + 1) % memories.length;
    const img = document.getElementById('memoryImage');
    const caption = document.getElementById('memoryCaption');
    
    if (img) {
        img.style.opacity = '0.5';
        setTimeout(() => {
            img.src = memories[currentMemoryIndex].image;
            img.style.opacity = '1';
        }, 150);
    }
    if (caption) caption.textContent = memories[currentMemoryIndex].caption;
    
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 8,
            symbols: ['📸', '✨', '❤'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
            spread: 80
        });
    }
    if (typeof pulseElement === 'function') pulseElement(document.getElementById('changeMemoryBtn'));
}

// ==========================================
// PARTÍCULAS
// ==========================================

function launchParticlesEffect() {
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 18,
            symbols: ['❤', '✦', '✨', '🌟', '🫶'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1', '#ffd966', '#4caf50'],
            spread: 140
        });
    }
    if (typeof pulseElement === 'function') {
        pulseElement(document.getElementById('particlesBtn'));
    }
}

// ==========================================
// MÚSICA
// ==========================================

function initMusic() {
    audioElement = document.getElementById('happyAudio');
    if (!audioElement) return;
    audioElement.load();
    
    const startOnInteraction = () => {
        if (!isMusicPlaying && audioElement && audioElement.paused) {
            audioElement.play().catch(() => {});
            isMusicPlaying = true;
            updateMusicUI();
        }
        document.removeEventListener('click', startOnInteraction);
    };
    document.addEventListener('click', startOnInteraction);
}

function updateMusicUI() {
    const musicWave = document.getElementById('musicWave');
    const musicLabel = document.getElementById('musicLabel');
    const musicBtn = document.getElementById('musicBtn');
    
    if (musicWave) {
        if (isMusicPlaying) {
            musicWave.classList.add('playing');
            if (musicLabel) musicLabel.textContent = '🎵 Sonando';
        } else {
            musicWave.classList.remove('playing');
            if (musicLabel) musicLabel.textContent = '🎵 Pausada';
        }
    }
    
    if (musicBtn) {
        musicBtn.innerHTML = isMusicPlaying ? 
            '<i data-lucide="volume-x"></i>' : 
            '<i data-lucide="volume-2"></i>';
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleMusic() {
    if (!audioElement) return;
    if (isMusicPlaying) {
        audioElement.pause();
        isMusicPlaying = false;
    } else {
        audioElement.play().catch(() => {});
        isMusicPlaying = true;
    }
    updateMusicUI();
}

// ==========================================
// RESPIRACIÓN GUIADA
// ==========================================

function startBreathingSession() {
    const modal = document.getElementById('breathingModal');
    const circle = document.getElementById('breathingCircle');
    const text = document.getElementById('breathingText');
    if (!modal || !circle || !text) return;
    
    modal.classList.add('active');
    let phase = 'inhale';
    let time = 0;
    const inhaleTime = 4000;
    const exhaleTime = 4000;
    
    if (breathingInterval) clearInterval(breathingInterval);
    
    function updateBreathing() {
        if (phase === 'inhale') {
            const progress = time / inhaleTime;
            const scale = 1 + (progress * 0.4);
            circle.style.transform = `scale(${scale})`;
            text.textContent = 'Inhala';
            if (time >= inhaleTime) {
                phase = 'exhale';
                time = 0;
            }
        } else {
            const progress = time / exhaleTime;
            const scale = 1.4 - (progress * 0.4);
            circle.style.transform = `scale(${scale})`;
            text.textContent = 'Exhala';
            if (time >= exhaleTime) {
                phase = 'inhale';
                time = 0;
            }
        }
        time += 100;
    }
    
    breathingInterval = setInterval(updateBreathing, 100);
}

function stopBreathingSession() {
    const modal = document.getElementById('breathingModal');
    if (modal) modal.classList.remove('active');
    if (breathingInterval) {
        clearInterval(breathingInterval);
        breathingInterval = null;
    }
    const circle = document.getElementById('breathingCircle');
    const text = document.getElementById('breathingText');
    if (circle) circle.style.transform = 'scale(1)';
    if (text) text.textContent = 'Inhala';
}

// ==========================================
// ME SIENTO MEJOR (con cierre tocando fuera)
// ==========================================

function showBetterModal() {
    const modal = document.getElementById('betterModal');
    const video = document.getElementById('betterVideo');
    
    if (modal) {
        modal.classList.add('active');
        if (video) {
            video.currentTime = 0;
            video.play().catch(() => {});
        }
    }
    
    randomPhrase();
    updateDailyMessage();
    launchParticlesEffect();
}

function closeBetterModal() {
    const modal = document.getElementById('betterModal');
    const video = document.getElementById('betterVideo');
    if (modal) modal.classList.remove('active');
    if (video) video.pause();
}

// Cerrar modal haciendo clic fuera del contenido
function closeBetterModalOnOutsideClick(event) {
    const modal = document.getElementById('betterModal');
    const content = modal?.querySelector('.better-modal-content');
    if (event.target === modal && content) {
        closeBetterModal();
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

function initMalDia() {
    randomPhrase();
    initMusic();
    
    // Event listeners
    document.getElementById('newPhraseBtn')?.addEventListener('click', randomPhrase);
    document.getElementById('particlesBtn')?.addEventListener('click', launchParticlesEffect);
    document.getElementById('musicBtn')?.addEventListener('click', toggleMusic);
    document.getElementById('betterBtn')?.addEventListener('click', showBetterModal);
    document.getElementById('refreshMessageBtn')?.addEventListener('click', updateDailyMessage);
    document.getElementById('changeMemoryBtn')?.addEventListener('click', changeMemory);
    document.getElementById('breathingBtn')?.addEventListener('click', startBreathingSession);
    document.getElementById('closeBreathingModal')?.addEventListener('click', stopBreathingSession);
    document.getElementById('stopBreathingBtn')?.addEventListener('click', stopBreathingSession);
    document.getElementById('closeBetterModal')?.addEventListener('click', closeBetterModal);
    
    // Cerrar modal del gato tocando fuera
    const betterModal = document.getElementById('betterModal');
    if (betterModal) {
        betterModal.addEventListener('click', closeBetterModalOnOutsideClick);
    }
    
    // Cerrar modal de respiración con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            stopBreathingSession();
            closeBetterModal();
        }
    });
    
    updateMusicUI();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMalDia);
} else {
    initMalDia();
}