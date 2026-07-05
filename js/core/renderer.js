// js/core/renderer.js
// Renderiza la experiencia del regalo basado en su tipo

export async function renderGiftExperience(gift, onClose) {
    if (!gift) {
        const fallback = document.createElement('p');
        fallback.textContent = 'Este regalo no tiene contenido.';
        return fallback;
    }

    const container = document.createElement('div');
    container.className = 'gift-module';

    switch (gift.type) {
        case 'letter':
            renderLetter(container, gift.data);
            break;
        case 'cassette':
            renderCassette(container, gift.data);
            break;
        case 'giftBox':
            renderGiftBox(container, gift.data);
            break;
        case 'polaroid':
            renderPolaroid(container, gift.data);
            break;
        case 'clickStar':
            renderClickStar(container, gift.data);
            break;
        // ========== NUEVOS TIPOS ==========
        case 'surprise':
            renderSurprise(container, gift.data);
            break;
        case 'video':
            renderVideo(container, gift.data);
            break;
        case 'quiz':
            renderQuiz(container, gift.data);
            break;
        case 'wishlist':
            renderWishlist(container, gift.data);
            break;
        default:
            container.innerHTML = `<p>✨ ${gift.title || 'Sorpresa'} ✨</p><p>${gift.data?.message || 'Disfruta de este regalo.'}</p>`;
    }

    return container;
}

// --- Funciones de renderizado por tipo ---

function renderLetter(container, data) {
    container.innerHTML = `
        <div class="letter-envelope" style="max-width: 400px; margin: 0 auto; background: #f9e5c0; padding: 24px; border-radius: 12px; color: #2c2c2c;">
            <div class="letter-body" style="font-family: 'Georgia', serif;">
                <p style="white-space: pre-wrap; line-height: 1.8;">${escapeHtml(data.content || 'Mensaje vacío.')}</p>
            </div>
        </div>
    `;
}

// js/core/renderer.js - Función renderCassette CORREGIDA
function renderCassette(container, data) {
    const message = data.message || '🎵';
    const audioUrl = data.audioUrl || '';
    const coverImage = data.coverImage || '';
    
    container.innerHTML = `
        <div class="cassette-player" style="
            background: linear-gradient(145deg, #1a1a1e, #0e0e12);
            border-radius: 24px;
            padding: 24px;
            max-width: 420px;
            margin: 0 auto;
            border: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
        ">
            <!-- Cabecera -->
            <div style="
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            ">
                <div style="
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, var(--accent-coral), var(--accent-rust));
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 4px 12px rgba(198,90,58,0.2);
                ">
                    <i data-lucide="music" style="width: 24px; height: 24px; color: white;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        color: var(--umbra-light);
                        font-weight: 500;
                        font-size: 0.95rem;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">${escapeHtml(message)}</div>
                    <div style="
                        color: var(--umbra-ash);
                        font-size: 0.7rem;
                        letter-spacing: 0.05em;
                    ">🎵 Canción para ti</div>
                </div>
            </div>

            ${coverImage ? `
                <div style="
                    width: 100%;
                    aspect-ratio: 1/1;
                    max-height: 200px;
                    border-radius: 16px;
                    overflow: hidden;
                    margin-bottom: 16px;
                    background: #0a0a12;
                    border: 1px solid rgba(255,255,255,0.05);
                ">
                    <img src="${escapeHtml(coverImage)}" alt="Portada" style="
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    ">
                </div>
            ` : `
                <div style="
                    width: 100%;
                    aspect-ratio: 1/1;
                    max-height: 160px;
                    border-radius: 16px;
                    margin-bottom: 16px;
                    background: linear-gradient(135deg, rgba(198,90,58,0.08), rgba(0,0,0,0.4));
                    border: 1px solid rgba(255,255,255,0.04);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="
                        font-size: 4rem;
                        opacity: 0.3;
                        filter: grayscale(0.5);
                    ">🎵</div>
                </div>
            `}

            <!-- Reproductor -->
            <div style="
                background: rgba(255,255,255,0.03);
                border-radius: 16px;
                padding: 16px;
                border: 1px solid rgba(255,255,255,0.04);
            ">
                ${audioUrl ? `
                    <audio controls preload="metadata" style="
                        width: 100%;
                        background: transparent;
                        border-radius: 12px;
                        height: 44px;
                    ">
                        <source src="${escapeHtml(audioUrl)}" type="audio/mp4">
                        <source src="${escapeHtml(audioUrl)}" type="audio/mpeg">
                        Tu navegador no soporta audio.
                    </audio>
                ` : `
                    <div style="
                        text-align: center;
                        padding: 16px;
                        color: var(--umbra-ash);
                        font-size: 0.85rem;
                    ">
                        <span style="opacity: 0.5;">🔇</span>
                        <p style="margin-top: 8px;">No hay audio disponible aún</p>
                    </div>
                `}
            </div>

            <!-- Pie -->
            <div style="
                margin-top: 14px;
                display: flex;
                justify-content: center;
                gap: 16px;
                font-size: 0.65rem;
                color: var(--umbra-ash);
                opacity: 0.5;
                letter-spacing: 0.05em;
            ">
                <span>✦</span>
                <span>Hecho con amor</span>
                <span>✦</span>
            </div>
        </div>
    `;

    // Forzar reproducción del audio al cargar
    const audio = container.querySelector('audio');
    if (audio && audioUrl) {
        audio.load();
        // Intentar reproducir automáticamente
        audio.play().catch(() => {
            // Si falla, el usuario tendrá que hacer clic en el botón play
            console.log('🔇 Autoplay bloqueado, esperando interacción del usuario');
        });
    }

    // Estilos para el audio player
    const styleId = 'cassette-audio-styles';
    if (!document.getElementById(styleId)) {
        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .cassette-player audio {
                width: 100%;
                height: 44px;
                background: rgba(255,255,255,0.02);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.06);
                padding: 4px 8px;
                box-sizing: border-box;
                outline: none;
            }
            .cassette-player audio::-webkit-media-controls-panel {
                background: transparent;
                border-radius: 12px;
            }
            .cassette-player audio::-webkit-media-controls-play-button {
                background-color: var(--accent-coral);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                margin: 4px;
                transition: transform 0.2s;
            }
            .cassette-player audio::-webkit-media-controls-play-button:hover {
                transform: scale(1.05);
            }
            .cassette-player audio::-webkit-media-controls-current-time-display,
            .cassette-player audio::-webkit-media-controls-time-remaining-display {
                color: var(--umbra-ash);
                font-size: 0.7rem;
                font-family: 'Inter', sans-serif;
            }
            .cassette-player audio::-webkit-media-controls-timeline {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                height: 4px;
            }
            .cassette-player audio::-webkit-media-controls-timeline::-webkit-slider-thumb {
                background: var(--accent-coral);
                border-radius: 50%;
                width: 12px;
                height: 12px;
                box-shadow: 0 0 12px rgba(198,90,58,0.3);
            }
            .cassette-player audio::-webkit-media-controls-volume-slider {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                height: 4px;
            }
            .cassette-player audio::-webkit-media-controls-volume-slider::-webkit-slider-thumb {
                background: var(--accent-coral);
                border-radius: 50%;
                width: 10px;
                height: 10px;
            }
            .cassette-player audio::-moz-range-track {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                height: 4px;
                border: none;
            }
            .cassette-player audio::-moz-range-thumb {
                background: var(--accent-coral);
                border: none;
                border-radius: 50%;
                width: 12px;
                height: 12px;
            }
            .cassette-player audio::-moz-progress-bar {
                background: var(--accent-coral);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(styles);
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: container });
    }
}

function renderGiftBox(container, data) {
    container.innerHTML = `
        <div class="gift-box" style="text-align: center; max-width: 400px; margin: 0 auto;">
            <div style="font-size: 4rem;">🎁</div>
            <p style="margin: 16px 0; color: var(--umbra-light);">${escapeHtml(data.message || '¡Una sorpresa!')}</p>
            ${data.image ? `<img src="${escapeHtml(data.image)}" alt="Regalo" style="max-width: 100%; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">` : ''}
        </div>
    `;
}

function renderPolaroid(container, data) {
    container.innerHTML = `
        <div class="polaroid-stack" style="display: flex; flex-direction: column; align-items: center; max-width: 300px; margin: 0 auto;">
            <div style="background: #f5f0e8; padding: 12px 12px 18px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); width: 100%;">
                ${data.image ? `<img src="${escapeHtml(data.image)}" alt="Polaroid" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px;">` : '<div style="width: 100%; aspect-ratio: 1; background: #ddd; border-radius: 4px;"></div>'}
                <p style="text-align: center; margin-top: 8px; color: #333; font-size: 0.85rem;">${escapeHtml(data.caption || 'Recuerdo')}</p>
            </div>
        </div>
    `;
}

function renderClickStar(container, data) {
    let score = 0;
    const starEmojis = ['⭐', '✨', '🌟'];

    const gameContainer = document.createElement('div');
    gameContainer.style.cssText = 'text-align: center; padding: 20px; max-width: 400px; margin: 0 auto;';

    const title = document.createElement('p');
    title.textContent = data.message || '¡Haz clic en las estrellas!';
    title.style.cssText = 'margin-bottom: 16px; color: var(--umbra-light);';
    gameContainer.appendChild(title);

    const scoreDisplay = document.createElement('p');
    scoreDisplay.textContent = `⭐ Puntos: ${score}`;
    scoreDisplay.style.cssText = 'font-size: 1.5rem; margin-bottom: 20px; color: var(--accent-coral);';
    gameContainer.appendChild(scoreDisplay);

    const gameArea = document.createElement('div');
    gameArea.style.cssText = 'position: relative; height: 200px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1); margin-bottom: 16px;';
    gameContainer.appendChild(gameArea);

    const spawnStar = () => {
        const star = document.createElement('span');
        star.textContent = starEmojis[Math.floor(Math.random() * starEmojis.length)];
        star.style.cssText = `
            position: absolute;
            font-size: ${20 + Math.random() * 30}px;
            cursor: pointer;
            left: ${Math.random() * 85 + 5}%;
            top: ${Math.random() * 75 + 10}%;
            transform: translate(-50%, -50%);
            transition: transform 0.1s;
            user-select: none;
        `;
        star.addEventListener('click', () => {
            score++;
            scoreDisplay.textContent = `⭐ Puntos: ${score}`;
            star.remove();
            const particle = document.createElement('span');
            particle.textContent = '✨';
            particle.style.cssText = `position: absolute; font-size: 20px; left: ${star.style.left}; top: ${star.style.top}; animation: decor-burst 600ms forwards;`;
            gameArea.appendChild(particle);
            setTimeout(() => particle.remove(), 700);
            setTimeout(spawnStar, 300 + Math.random() * 400);
        });
        gameArea.appendChild(star);
    };

    setTimeout(spawnStar, 500);
    setTimeout(spawnStar, 900);
    setTimeout(spawnStar, 1300);
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reiniciar';
    resetBtn.style.cssText = `
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 40px;
        padding: 8px 20px;
        color: var(--umbra-light);
        cursor: pointer;
        transition: background 0.2s;
    `;
    resetBtn.addEventListener('mouseenter', () => resetBtn.style.background = 'rgba(198,90,58,0.2)');
    resetBtn.addEventListener('mouseleave', () => resetBtn.style.background = 'rgba(255,255,255,0.08)');
    resetBtn.addEventListener('click', () => {
        score = 0;
        scoreDisplay.textContent = `⭐ Puntos: ${score}`;
        gameArea.innerHTML = '';
        setTimeout(spawnStar, 300);
        setTimeout(spawnStar, 700);
        setTimeout(spawnStar, 1100);
    });
    gameContainer.appendChild(resetBtn);

    container.appendChild(gameContainer);
}

// ==========================================
// NUEVOS TIPOS DE REGALOS
// ==========================================

// 1. Sorpresa interactiva (confeti, animaciones)
function renderSurprise(container, data) {
    const message = data.message || '🎊 ¡Sorpresa!';
    const effect = data.effect || 'confetti';
    
    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 5rem; margin-bottom: 16px; animation: bounce 1s infinite;">🎊</div>
            <h3 style="color: var(--umbra-light); font-family: 'Playfair Display', serif; font-size: 1.8rem; margin-bottom: 16px;">
                ${escapeHtml(message)}
            </h3>
            <p style="color: var(--umbra-ash);">✨ Disfruta de este momento especial ✨</p>
        </div>
        <style>
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-15px); }
            }
        </style>
    `;

    // Efecto de confeti
    if (typeof launchParticles === 'function') {
        setTimeout(() => {
            launchParticles({
                amount: 40,
                symbols: ['🎉', '✨', '⭐', '🌟', '🎊', '❤️'],
                colors: ['#ffd700', '#ff6b6b', '#4a9eff', '#5fd08a', '#ffb347', '#ff8aa1'],
                spread: 200,
                duration: 2500
            });
        }, 300);
    }
}

// 2. Video - Reproducción automática sin controles (TAMAÑO NORMAL)
function renderVideo(container, data) {
    const videoUrl = data.videoUrl || '';
    const caption = data.caption || '';
    
    container.innerHTML = `
        <div style="max-width: 400px; margin: 0 auto; text-align: center;">
            ${videoUrl ? `
                <div style="
                    border-radius: 16px; 
                    overflow: hidden; 
                    background: #000; 
                    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
                    position: relative;
                ">
                    <video 
                        autoplay 
                        loop 
                        muted 
                        playsinline 
                        style="
                            width: 100%; 
                            display: block; 
                            pointer-events: none;
                            max-height: 400px;
                            object-fit: contain;
                        " 
                        preload="auto"
                        disablePictureInPicture
                        controlslist="nofullscreen nodownload noremoteplayback"
                        webkit-playsinline="true"
                        x-webkit-airplay="deny"
                    >
                        <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                        Tu navegador no soporta videos.
                    </video>
                </div>
                ${caption ? `<div style="
                    margin-top: 12px;
                    color: var(--umbra-ash);
                    font-size: 0.85rem;
                    font-style: italic;
                    opacity: 0.7;
                ">${escapeHtml(caption)}</div>` : ''}
            ` : `
                <div style="padding: 40px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                    <div style="font-size: 4rem;">🎬</div>
                    <p style="color: var(--umbra-ash); margin-top: 12px;">Video no disponible aún</p>
                </div>
            `}
        </div>
    `;

    // Intentar reproducir con audio
    const video = container.querySelector('video');
    if (video) {
        // Primero intentar con audio
        video.muted = false;
        
        const playVideo = () => {
            video.play().catch(() => {
                // Si falla, silenciar y mostrar mensaje
                video.muted = true;
                video.play().catch(() => {});
                // Buscar el caption para mostrar mensaje
                const captionEl = container.querySelector('div[style*="margin-top: 12px;"]');
                if (captionEl && !captionEl.dataset.clickable) {
                    captionEl.dataset.clickable = 'true';
                    captionEl.textContent = '🔇 Haz clic aquí para activar el audio';
                    captionEl.style.cursor = 'pointer';
                    captionEl.style.color = 'var(--accent-coral)';
                    captionEl.onclick = () => {
                        video.muted = false;
                        video.play().catch(() => {});
                        captionEl.textContent = caption;
                        captionEl.style.cursor = 'default';
                        captionEl.style.color = 'var(--umbra-ash)';
                        captionEl.onclick = null;
                    };
                }
            });
        };

        playVideo();

        // Click en el video para activar audio
        const wrapper = container.querySelector('div[style*="border-radius: 16px; overflow: hidden;"]');
        if (wrapper) {
            wrapper.style.cursor = 'pointer';
            wrapper.addEventListener('click', () => {
                if (video.muted) {
                    video.muted = false;
                    video.play().catch(() => {});
                }
            });
        }
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: container });
    }
}

// 3. Encuesta o pregunta (quiz)
function renderQuiz(container, data) {
    const question = data.question || '¿Cuál es tu respuesta?';
    const options = data.options || ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'];
    let selected = null;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width: 400px; margin: 0 auto; text-align: center; padding: 10px;';

    const questionEl = document.createElement('h3');
    questionEl.textContent = question;
    questionEl.style.cssText = 'color: var(--umbra-light); font-family: "Playfair Display", serif; font-size: 1.4rem; margin-bottom: 20px;';
    wrapper.appendChild(questionEl);

    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

    const resultEl = document.createElement('p');
    resultEl.style.cssText = 'color: var(--accent-coral); margin-top: 16px; font-size: 1.1rem; min-height: 30px;';

    options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.style.cssText = `
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 40px;
            padding: 12px 20px;
            color: var(--umbra-light);
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.9rem;
            width: 100%;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = 'var(--accent-coral)';
            btn.style.background = 'rgba(198,90,58,0.1)';
        });
        btn.addEventListener('mouseleave', () => {
            if (selected !== index) {
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
                btn.style.background = 'rgba(255,255,255,0.05)';
            }
        });
        btn.addEventListener('click', () => {
            selected = index;
            resultEl.textContent = '✨ ¡Gracias por responder!';
            resultEl.style.color = 'var(--green)';
            // Resaltar selección
            optionsContainer.querySelectorAll('.quiz-option').forEach((b, i) => {
                if (i === index) {
                    b.style.borderColor = 'var(--accent-coral)';
                    b.style.background = 'rgba(198,90,58,0.15)';
                } else {
                    b.style.borderColor = 'rgba(255,255,255,0.05)';
                    b.style.background = 'rgba(255,255,255,0.02)';
                }
            });
            if (typeof launchParticles === 'function') {
                launchParticles({
                    amount: 12,
                    symbols: ['✨', '❤️', '⭐'],
                    colors: ['#ffd700', '#ff6b6b', '#4a9eff'],
                    spread: 100
                });
            }
        });
        btn.className = 'quiz-option';
        optionsContainer.appendChild(btn);
    });

    wrapper.appendChild(optionsContainer);
    wrapper.appendChild(resultEl);
    container.appendChild(wrapper);
}

// 4. Lista de deseos
function renderWishlist(container, data) {
    const items = data.items || ['Deseo 1', 'Deseo 2', 'Deseo 3'];
    
    container.innerHTML = `
        <div style="max-width: 400px; margin: 0 auto; text-align: center; padding: 10px;">
            <div style="font-size: 3rem; margin-bottom: 8px;">📝</div>
            <h3 style="color: var(--umbra-light); font-family: 'Playfair Display', serif; font-size: 1.6rem; margin-bottom: 20px;">
                Lista de Deseos ✨
            </h3>
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.06);">
                <ul style="list-style: none; padding: 0; margin: 0; text-align: left;">
                    ${items.map((item, index) => `
                        <li style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 14px; color: var(--umbra-light); font-size: 0.95rem;">
                            <span style="font-size: 1.2rem; color: var(--accent-coral);">${index + 1}.</span>
                            <span>${escapeHtml(item)}</span>
                            <span style="margin-left: auto; color: var(--umbra-ash); font-size: 0.7rem;">⭐</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            <p style="color: var(--umbra-ash); font-size: 0.8rem; margin-top: 16px; font-style: italic;">
                ✨ Algún día estos sueños se harán realidad ✨
            </p>
        </div>
    `;
}

// --- Utilidad ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}