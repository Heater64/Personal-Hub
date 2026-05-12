// ==========================================
// calendario.js · Calendario de experiencias interactivas
// ==========================================

const visibleDays = 24; // O 25, o 16 como tenías
let opened = [];
let currentAudio = null; // Para controlar reproducción de audio

// --- Referencias a Firebase y DOM (mantener igual) ---
const calendarioRef = db.collection('calendario').doc('sorpresas');

// ==========================================
// 1. DEFINICIÓN DE LAS SORPRESAS (0-indexado, día 1 = índice 0)
// ==========================================
const surprises = [
    // Día 1: Carta flotante animada (Mensaje + foto)
    {
        type: 'letter',
        title: 'Carta flotante',
        data: {
            message: "La primera sorpresa del calendario. Una carta que cruza el espacio virtual para llegarte. ❤️",
            image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1778355903/20260505_070212_sgkvy2.jpg", // Tu atardecer favorito
            audio: null
        }
    },
    // Día 2: Máquina de escribir (Confesión lenta)
    {
        type: 'typewriter',
        title: 'Confesión nocturna',
        data: {
            text: "Me gusta más de lo que debería cuando te ríes de tus propios chistes. Es mi sonido favorito.",
            speed: 60 // ms por letra
        }
    },
    // Día 3: Mini cassette retro (Audio)
    {
        type: 'cassette',
        title: 'Recuerdo en cassette',
        data: {
            message: "Una risa, un momento. Dale play.",
            audioUrl: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/gatito_isgr4b.mp4", // Cambia por un audio real
            coverImage: "https://res.cloudinary.com/dcsent4fs/image/upload/v1777135720/CurriculumGatos_tixrwq.jpg"
        }
    },
    // Día 4: Polaroid stack (Fotos que se expanden)
    {
        type: 'polaroid',
        title: 'Instantáneas',
        data: {
            images: [
                "https://res.cloudinary.com/dcsent4fs/image/upload/v1778355904/20260425_070118_c8t3kj.jpg",
                "https://res.cloudinary.com/dcsent4fs/image/upload/v1778355904/20260313_190837_aib1zt.jpg",
                "https://res.cloudinary.com/dcsent4fs/image/upload/v1778355905/20260131_182652_h5gqlm.jpg"
            ],
            message: "Trozos de tiempo que quiero guardar."
        }
    },
    // Día 5: Ticket de cine
    {
        type: 'ticket',
        title: 'Pase especial',
        data: {
            movie: "Nuestra película",
            quote: "Admite 1 abrazo infinito.",
            date: "Siempre",
            seat: "A tu lado"
        }
    },
    // Día 6: Presiona y mantén (Interacción)
    {
        type: 'holdButton',
        title: 'Sorpresa sellada',
        data: {
            message: "Presiona y mantén 3 segundos para revelar...",
            secretMessage: "Eres mi persona favorita en este planeta. 🌍"
        }
    },
    // Día 7: Estrella interactiva
    {
        type: 'clickStar',
        title: 'Encuentra la estrella',
        data: {
            message: "Toca la estrella especial entre las demás.",
            successMessage: "⭐ ¡Lo lograste! Cada día brillas más a mi lado."
        }
    },
    // Día 8: Mini nube interactiva (Revela al pasar mouse/tocar)
    {
        type: 'cloudReveal',
        title: 'Nube de pensamientos',
        data: {
            hiddenMessage: "Hoy me desperté pensando en lo afortunado que soy por tenerte.",
            hint: "Pasa el mouse o toca la nube."
        }
    },
    // Día 9: Diario nocturno (Estética notebook)
    {
        type: 'diary',
        title: '3:47 AM',
        data: {
            entry: "No podía dormir. Me puse a recordar cuando nos reímos hasta que nos dolió la panza. Necesitaba escribirlo. Te quiero."
        }
    },
    // Día 10: Cinematic memory card (Fullscreen visual)
    {
        type: 'cinematic',
        title: 'Un minuto para ti',
        data: {
            videoUrl: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777132934/Spidermaaaan.mp4", // Video emotivo
            quote: "Algunas historias merecen su propio soundtrack.",
            backgroundImage: "https://res.cloudinary.com/dcsent4fs/image/upload/v1778355906/20251211_175213_1_u8khuv.jpg"
        }
    },
    // Día 11: Frasco de recuerdos
    {
        type: 'memoryJar',
        title: 'Frasco de momentos',
        data: {
            memories: [
                "Esa vez que hiciste galletas a las 2 AM.",
                "El día que me mandaste esa canción sin decir nada.",
                "Cuando me dijiste 'cuídate' y sentí que lo decías en serio."
            ]
        }
    },
    // Día 12: Playlist secreta
    {
        type: 'secretPlaylist',
        title: 'Playlist: ✨ tus ojos ✨',
        data: {
            songs: [
                { title: "Those Eyes", artist: "New West", reason: "Por obvias razones." },
                { title: "La Plena", artist: "Beéle", reason: "Por cómo me miras cuando suena." },
                { title: "Rara Vez", artist: "Milo J", reason: "Porque así de especial." }
            ]
        }
    },
    // Día 13: Cámara instantánea (Animación flash)
    {
        type: 'instantCamera',
        title: 'Click... revelado',
        data: {
            image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1777747760/5199564237372592635_eqj9v5.jpg",
            caption: "Mi foto favorita tuya. 📸"
        }
    },
    // Día 14: Mini juego de raspar (Simulado con click)
    {
        type: 'scratchCard',
        title: 'Tarjeta rasca y gana',
        data: {
            hiddenPrize: "✨ Un beso virtual gigante ✨",
            instructions: "Haz click repetidamente para 'raspar'."
        }
    },
    // Día 15: Constelación
    {
        type: 'constellation',
        title: 'Nuestra constelación',
        data: {
            stars: [
                { name: "Estrella Polar", message: "Siempre vuelvo a ti." },
                { name: "Sirio", message: "La más brillante, como tú." },
                { name: "Betelgeuse", message: "Roja como mi corazón cuando te veo." }
            ]
        }
    },
    // Día 16: Countdown sorpresa
    {
        type: 'countdown',
        title: '3... 2... 1...',
        data: {
            finalMessage: "¡BOOM! 💥 Eres explosiva de bonita.",
            particleColor: "#ffb347"
        }
    },
    // Día 17: Mood card (Cómo te sientes hoy)
    {
        type: 'moodCard',
        title: 'Check-in emocional',
        data: {
            options: {
                "🌧️": "Te mando un abrazo gigante. Aquí estoy.",
                "🌙": "Perfecto para soñar con cosas bonitas.",
                "✨": "Esa energía me encanta. Brillas mucho.",
                "❤️": "Yo también te quiero. Eso nunca cambia."
            }
        }
    },
    // Día 18: Carta "prohibida" (Estilo confidencial)
    {
        type: 'confidentialLetter',
        title: "⚠️ CONFIDENCIAL ⚠️",
        data: {
            message: "Para sus ojos solamente. Eres lo mejor que me ha pasado en la vida."
        }
    },
    // Día 19: Lluvia de emojis
    {
        type: 'emojiRain',
        title: 'Lluvia de cariño',
        data: {
            emojis: ['❤️', '✨', '🌟', '💫', '🌹', '🎵'],
            message: "Así me siento cada vez que pienso en ti. 💫"
        }
    },
    // Día 20: Mini cinemática (Video corto)
    {
        type: 'cinematic',
        title: 'Postal en movimiento',
        data: {
            videoUrl: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777745737/gatito_isgr4b.mp4",
            quote: "Un momento random pero con todo el cariño.",
            backgroundImage: null
        }
    },
    // Día 21: "Lo que pienso de ti hoy"
    {
        type: 'randomThought',
        title: "Pensamiento del día",
        data: {
            thoughts: [
                "Hoy te imagino sonriendo y se me arregla el día.",
                "Tienes una forma de ser que no encuentro en nadie más.",
                "Me gusta cómo dices mi nombre.",
                "Eres mi persona favorita para mandar memes a las 3 AM."
            ]
        }
    },
    // Día 22: Corazón 3D CSS (Late al tocar)
    {
        type: 'beatingHeart',
        title: 'Toca el corazón',
        data: {
            message: "Palpita por ti. 💓"
        }
    },
    // Día 23: Mensaje cifrado (Simple arrastrar letras)
    {
        type: 'cipherMessage',
        title: 'Mensaje secreto',
        data: {
            encrypted: "*** *ÉTSE ONAM ***",
            solution: "TÚ ERES AMOR",
            hint: "Está al revés"
        }
    },
    // Día 24: Caja de regalo realista (Último día)
    {
        type: 'giftBox',
        title: '🎁 ¡Feliz calendario! 🎁',
        data: {
            message: "Gracias por compartir estos días conmigo. Eres el mejor regalo.",
            finalImage: "https://res.cloudinary.com/dcsent4fs/image/upload/v1777744533/DADA_ziogvd.jpg"
        }
    }
];

// ==========================================
// 2. FUNCIONES PARA RENDERIZAR CADA TIPO DE SORPRESA
// ==========================================

function renderLetter(data) {
    return `
        <div class="surprise-letter">
            <div class="letter-envelope">
                <div class="letter-flap"></div>
                <div class="letter-body">
                    <p>${escapeHtml(data.message)}</p>
                    ${data.image ? `<img src="${data.image}" alt="Recuerdo" style="max-width:100%; border-radius:12px; margin-top:16px;">` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderTypewriter(data) {
    const uniqueId = `typewriter-${Date.now()}`;
    return `
        <div class="typewriter-container" id="${uniqueId}">
            <div class="paper-stack">
                <div class="paper-line"></div>
                <div class="paper-line"></div>
                <div class="paper-text"></div>
            </div>
        </div>
        <script>
            (function() {
                const container = document.getElementById('${uniqueId}');
                const textEl = container.querySelector('.paper-text');
                const fullText = ${JSON.stringify(data.text)};
                let i = 0;
                function type() {
                    if (i < fullText.length) {
                        textEl.innerHTML += fullText.charAt(i);
                        i++;
                        setTimeout(type, ${data.speed});
                    }
                }
                type();
            })();
        </script>
    `;
}

function renderCassette(data) {
    return `
        <div class="cassette-player">
            <div class="cassette-tape">
                <div class="tape-reel left"></div>
                <div class="tape-reel right"></div>
                <div class="tape-label">MIXTAPE</div>
            </div>
            <p style="margin: 16px 0 12px;">${escapeHtml(data.message)}</p>
            ${data.audioUrl ? `<audio controls src="${data.audioUrl}" style="width:100%; margin-top:8px;"></audio>` : ''}
            ${data.coverImage ? `<img src="${data.coverImage}" style="width:80px; margin-top:12px; border-radius:8px;">` : ''}
        </div>
    `;
}

function renderPolaroid(data) {
    const imagesHtml = data.images.map((img, idx) => `
        <div class="polaroid" style="transform: rotate(${Math.random() * 6 - 3}deg); z-index: ${idx};">
            <img src="${img}" alt="Polaroid ${idx+1}">
            <div class="polaroid-caption">❤️</div>
        </div>
    `).join('');
    return `
        <div class="polaroid-stack">
            ${imagesHtml}
            <p style="margin-top: 80px; text-align:center;">${escapeHtml(data.message)}</p>
        </div>
    `;
}

function renderTicket(data) {
    return `
        <div class="movie-ticket">
            <div class="ticket-stub">
                <span class="ticket-movie">${escapeHtml(data.movie)}</span>
                <span class="ticket-quote">"${escapeHtml(data.quote)}"</span>
                <div class="ticket-details">
                    <span>📅 ${escapeHtml(data.date)}</span>
                    <span>💺 ${escapeHtml(data.seat)}</span>
                </div>
                <div class="ticket-tear"></div>
            </div>
        </div>
    `;
}

function renderHoldButton(data) {
    const uniqueId = `hold-${Date.now()}`;
    return `
        <div class="hold-secret" id="${uniqueId}">
            <p>${escapeHtml(data.message)}</p>
            <button class="hold-btn">🔒 Mantén presionado</button>
            <div class="secret-reveal" style="display:none; margin-top:20px; padding:16px; background:rgba(0,0,0,0.5); border-radius:16px;">
                <p>✨ ${escapeHtml(data.secretMessage)} ✨</p>
            </div>
        </div>
        <script>
            (function() {
                const container = document.getElementById('${uniqueId}');
                const btn = container.querySelector('.hold-btn');
                const reveal = container.querySelector('.secret-reveal');
                let timer;
                btn.addEventListener('mousedown', () => {
                    timer = setTimeout(() => {
                        reveal.style.display = 'block';
                        if (typeof launchParticles === 'function') launchParticles({ amount: 15, source: btn });
                        btn.disabled = true;
                    }, 3000);
                });
                btn.addEventListener('mouseup', () => clearTimeout(timer));
                btn.addEventListener('mouseleave', () => clearTimeout(timer));
                // Para touch
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    timer = setTimeout(() => {
                        reveal.style.display = 'block';
                        if (typeof launchParticles === 'function') launchParticles({ amount: 15, source: btn });
                        btn.disabled = true;
                    }, 3000);
                });
                btn.addEventListener('touchend', () => clearTimeout(timer));
            })();
        </script>
    `;
}

// ... (Funciones similares para los demás tipos: clickStar, cloudReveal, diary, cinematic, memoryJar, secretPlaylist, instantCamera, scratchCard, constellation, countdown, moodCard, confidentialLetter, emojiRain, randomThought, beatingHeart, cipherMessage, giftBox)
// Por brevedad, aquí se incluirían todas. Te proporciono las más importantes y el patrón para las demás.

// Función principal que elige el renderizador
function renderSurpriseContent(dayIndex) {
    const surprise = surprises[dayIndex];
    if (!surprise) return `<p>Sorpensa no definida aún. 🌙</p>`;

    switch (surprise.type) {
        case 'letter': return renderLetter(surprise.data);
        case 'typewriter': return renderTypewriter(surprise.data);
        case 'cassette': return renderCassette(surprise.data);
        case 'polaroid': return renderPolaroid(surprise.data);
        case 'ticket': return renderTicket(surprise.data);
        case 'holdButton': return renderHoldButton(surprise.data);
        // ... añade los demás casos
        default: return `<p>${escapeHtml(surprise.data?.message || 'Abrir sorpresa...')}</p>`;
    }
}

// ==========================================
// 3. LOGICA PRINCIPAL DEL CALENDARIO (MODIFICADA)
// ==========================================

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

    grid.innerHTML = surprises.slice(0, visibleDays).map((_, index) => `
        <button class="day-card ${opened.includes(index) ? 'opened' : ''}" data-day="${index}" type="button">
            <span class="day-number">${index + 1}</span>
            <span class="muted">${opened.includes(index) ? 'abierto' : 'abrir sorpresa'}</span>
        </button>
    `).join('');
}

function revealSurprise(day, surpriseTitleEl, surpriseContentEl) {
    // Actualizar título
    surpriseTitleEl.textContent = `Día ${day + 1}: ${surprises[day].title}`;
    
    // Renderizar contenido dinámico
    surpriseContentEl.innerHTML = renderSurpriseContent(day);
    
    // Mostrar caja con animación
    const surpriseBox = document.getElementById('surpriseBox');
    surpriseBox.classList.add('show');
    
    // Inicializar Lucide si hay nuevos íconos
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: surpriseContentEl });
    
    // Efectos visuales
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 12,
            symbols: ['✦', '✨', '★'],
            colors: ['#ffb347', '#c65a3a', '#ff8aa1'],
            spread: 120,
            source: document.querySelector(`.day-card[data-day="${day}"]`)
        });
    }
}

function initCalendario() {
    const grid = document.getElementById('calendarGrid');
    const surpriseBox = document.getElementById('surpriseBox');
    const surpriseTitle = document.getElementById('surpriseTitle');
    const surpriseContent = document.getElementById('surpriseDynamicContent');
    const closeBtn = document.getElementById('closeSurpriseBtn');
    
    if (!grid || !surpriseBox || !surpriseTitle || !surpriseContent) return;

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
        revealSurprise(day, surpriseTitle, surpriseContent);
    });
    
    // Cerrar sorpresa
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            surpriseBox.classList.remove('show');
            surpriseContent.innerHTML = ''; // Limpiar para liberar audio/video
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
        });
    }
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && surpriseBox.classList.contains('show')) {
            surpriseBox.classList.remove('show');
            surpriseContent.innerHTML = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', initCalendario);