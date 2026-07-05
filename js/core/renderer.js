// js/core/renderer.js
// Renderiza la experiencia del regalo basado en su tipo - VERSIÓN RESPONSIVE

export async function renderGiftExperience(gift, onClose) {
    if (!gift) {
        const fallback = document.createElement('p');
        fallback.textContent = 'Este regalo no tiene contenido.';
        return fallback;
    }

    const container = document.createElement('div');
    container.className = 'gift-module';
    container.style.cssText = 'width: 100%; max-width: 100%; display: flex; justify-content: center;';

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
            container.innerHTML = `<p style="text-align:center;color:var(--umbra-light);">✨ ${gift.title || 'Sorpresa'} ✨</p><p style="text-align:center;color:var(--umbra-ash);">${gift.data?.message || 'Disfruta de este regalo.'}</p>`;
    }

    return container;
}

// ==========================================
// UTILIDADES
// ==========================================

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

// ==========================================
// 1. CARTA (letter)
// ==========================================

function renderLetter(container, data) {
    container.innerHTML = `
        <div style="
            max-width: 420px; 
            width: 100%; 
            margin: 0 auto; 
            background: #f9e5c0; 
            padding: clamp(20px, 5vw, 32px); 
            border-radius: 12px; 
            color: #2c2c2c;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        ">
            <div style="font-family: 'Georgia', serif; font-size: clamp(0.9rem, 2vw, 1.05rem); line-height: 1.8; white-space: pre-wrap; word-break: break-word;">
                ${escapeHtml(data.content || 'Mensaje vacío.')}
            </div>
        </div>
    `;
}

// ==========================================
// 2. MÚSICA (cassette)
// ==========================================

function renderCassette(container, data) {
    const message = data.message || '🎵';
    const audioUrl = data.audioUrl || '';
    const coverImage = data.coverImage || '';
    
    container.innerHTML = `
        <div style="
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            background: linear-gradient(145deg, #1a1a1e, #0e0e12);
            border-radius: clamp(16px, 3vw, 24px);
            padding: clamp(16px, 3vw, 24px);
            border: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
        ">
            <!-- Cabecera -->
            <div style="
                display: flex;
                align-items: center;
                gap: clamp(12px, 2vw, 16px);
                margin-bottom: clamp(14px, 2vw, 20px);
                padding-bottom: clamp(12px, 1.5vw, 16px);
                border-bottom: 1px solid rgba(255,255,255,0.05);
            ">
                <div style="
                    width: clamp(40px, 8vw, 48px);
                    height: clamp(40px, 8vw, 48px);
                    background: linear-gradient(135deg, var(--accent-coral), var(--accent-rust));
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 4px 12px rgba(198,90,58,0.2);
                ">
                    <i data-lucide="music" style="width: clamp(20px, 4vw, 24px); height: clamp(20px, 4vw, 24px); color: white;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        color: var(--umbra-light);
                        font-weight: 500;
                        font-size: clamp(0.85rem, 2vw, 0.95rem);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">${escapeHtml(message)}</div>
                    <div style="
                        color: var(--umbra-ash);
                        font-size: clamp(0.6rem, 1.2vw, 0.7rem);
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
                    " loading="lazy">
                </div>
            ` : ''}

            <!-- Reproductor -->
            <div style="
                background: rgba(255,255,255,0.03);
                border-radius: 16px;
                padding: clamp(12px, 2vw, 16px);
                border: 1px solid rgba(255,255,255,0.04);
            ">
                ${audioUrl ? `
                    <audio controls preload="metadata" style="
                        width: 100%;
                        height: clamp(40px, 6vw, 44px);
                        background: transparent;
                        border-radius: 12px;
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
                margin-top: clamp(10px, 1.5vw, 14px);
                display: flex;
                justify-content: center;
                gap: 16px;
                font-size: clamp(0.55rem, 1vw, 0.65rem);
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

    // Estilos del audio
    const styleId = 'cassette-audio-styles';
    if (!document.getElementById(styleId)) {
        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .cassette-player audio, .gift-module audio {
                width: 100% !important;
                height: clamp(40px, 6vw, 44px) !important;
                background: rgba(255,255,255,0.02) !important;
                border-radius: 12px !important;
                border: 1px solid rgba(255,255,255,0.06) !important;
                padding: 4px 8px !important;
                box-sizing: border-box !important;
                outline: none !important;
            }
            .gift-module audio::-webkit-media-controls-panel {
                background: transparent !important;
                border-radius: 12px !important;
            }
            .gift-module audio::-webkit-media-controls-play-button {
                background-color: var(--accent-coral) !important;
                border-radius: 50% !important;
                width: 30px !important;
                height: 30px !important;
                margin: 4px !important;
                transition: transform 0.2s !important;
            }
            .gift-module audio::-webkit-media-controls-play-button:hover {
                transform: scale(1.05) !important;
            }
            .gift-module audio::-webkit-media-controls-current-time-display,
            .gift-module audio::-webkit-media-controls-time-remaining-display {
                color: var(--umbra-ash) !important;
                font-size: 0.7rem !important;
                font-family: 'Inter', sans-serif !important;
            }
            .gift-module audio::-webkit-media-controls-timeline {
                background: rgba(255,255,255,0.1) !important;
                border-radius: 4px !important;
                height: 4px !important;
            }
            .gift-module audio::-webkit-media-controls-timeline::-webkit-slider-thumb {
                background: var(--accent-coral) !important;
                border-radius: 50% !important;
                width: 12px !important;
                height: 12px !important;
                box-shadow: 0 0 12px rgba(198,90,58,0.3) !important;
            }
            @media (max-width: 480px) {
                .gift-module audio {
                    height: 48px !important;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: container });
    }
}

// ==========================================
// 3. REGALO (giftBox)
// ==========================================

function renderGiftBox(container, data) {
    container.innerHTML = `
        <div style="
            text-align: center; 
            max-width: 400px; 
            width: 100%; 
            margin: 0 auto;
            padding: clamp(10px, 2vw, 20px);
        ">
            <div style="font-size: clamp(3rem, 10vw, 4rem);">🎁</div>
            <p style="
                margin: 16px 0; 
                color: var(--umbra-light); 
                font-size: clamp(0.9rem, 2vw, 1.05rem);
            ">${escapeHtml(data.message || '¡Una sorpresa!')}</p>
            ${data.image ? `<img src="${escapeHtml(data.image)}" alt="Regalo" style="
                max-width: 100%; 
                width: 100%;
                max-height: 300px;
                object-fit: cover;
                border-radius: 16px; 
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            " loading="lazy">` : ''}
        </div>
    `;
}

// ==========================================
// 4. POLAROID / RECUERDO (polaroid)
// ==========================================

function renderPolaroid(container, data) {
    container.innerHTML = `
        <div style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            max-width: 300px; 
            width: 100%;
            margin: 0 auto;
        ">
            <div style="
                background: #f5f0e8; 
                padding: clamp(10px, 2vw, 12px) clamp(10px, 2vw, 12px) clamp(16px, 3vw, 18px); 
                border-radius: 8px; 
                box-shadow: 0 8px 24px rgba(0,0,0,0.2); 
                width: 100%;
            ">
                ${data.image ? `
                    <img src="${escapeHtml(data.image)}" alt="Polaroid" style="
                        width: 100%; 
                        aspect-ratio: 1; 
                        object-fit: cover; 
                        border-radius: 4px;
                    " loading="lazy">
                ` : `
                    <div style="
                        width: 100%; 
                        aspect-ratio: 1; 
                        background: #ddd; 
                        border-radius: 4px;
                    "></div>
                `}
                <p style="
                    text-align: center; 
                    margin-top: 8px; 
                    color: #333; 
                    font-size: clamp(0.75rem, 1.5vw, 0.85rem);
                ">${escapeHtml(data.caption || 'Recuerdo')}</p>
            </div>
        </div>
    `;
}

// ==========================================
// 5. MINI JUEGO ESTRELLAS (clickStar)
// ==========================================

function renderClickStar(container, data) {
    let score = 0;
    const starEmojis = ['⭐', '✨', '🌟'];

    const gameContainer = document.createElement('div');
    gameContainer.style.cssText = `
        text-align: center; 
        padding: clamp(10px, 2vw, 20px); 
        max-width: 400px; 
        width: 100%; 
        margin: 0 auto;
    `;

    const title = document.createElement('p');
    title.textContent = data.message || '¡Haz clic en las estrellas!';
    title.style.cssText = `
        margin-bottom: 16px; 
        color: var(--umbra-light); 
        font-size: clamp(0.9rem, 2vw, 1rem);
    `;
    gameContainer.appendChild(title);

    const scoreDisplay = document.createElement('p');
    scoreDisplay.textContent = `⭐ Puntos: ${score}`;
    scoreDisplay.style.cssText = `
        font-size: clamp(1.2rem, 3vw, 1.5rem); 
        margin-bottom: 20px; 
        color: var(--accent-coral);
        font-family: 'Playfair Display', serif;
    `;
    gameContainer.appendChild(scoreDisplay);

    const gameArea = document.createElement('div');
    gameArea.style.cssText = `
        position: relative; 
        height: clamp(150px, 40vw, 200px); 
        background: rgba(255,255,255,0.05); 
        border-radius: 16px; 
        border: 1px dashed rgba(255,255,255,0.1); 
        margin-bottom: 16px;
        overflow: hidden;
    `;
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
        padding: clamp(8px, 1.5vw, 12px) clamp(16px, 3vw, 20px);
        color: var(--umbra-light);
        cursor: pointer;
        transition: background 0.2s;
        font-size: clamp(0.75rem, 1.5vw, 0.85rem);
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
// 6. SORPRESA (surprise)
// ==========================================

function renderSurprise(container, data) {
    const message = data.message || '🎊 ¡Sorpresa!';
    
    container.innerHTML = `
        <div style="
            text-align: center; 
            padding: clamp(10px, 2vw, 20px);
            max-width: 420px;
            width: 100%;
            margin: 0 auto;
        ">
            <div style="
                font-size: clamp(3.5rem, 12vw, 5rem); 
                margin-bottom: 16px; 
                animation: bounce 1s infinite;
            ">🎊</div>
            <h3 style="
                color: var(--umbra-light); 
                font-family: 'Playfair Display', serif; 
                font-size: clamp(1.3rem, 3.5vw, 1.8rem); 
                margin-bottom: 16px;
            ">
                ${escapeHtml(message)}
            </h3>
            <p style="color: var(--umbra-ash); font-size: clamp(0.8rem, 1.5vw, 0.95rem);">
                ✨ Disfruta de este momento especial ✨
            </p>
        </div>
        <style>
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-15px); }
            }
            @media (max-width: 480px) {
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            }
        </style>
    `;

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

// ==========================================
// 7. VIDEO (video) - RESPONSIVE
// ==========================================

function renderVideo(container, data) {
    const videoUrl = data.videoUrl || '';
    const caption = data.caption || '';
    
    container.innerHTML = `
        <div style="
            max-width: 420px; 
            width: 100%; 
            margin: 0 auto; 
            text-align: center;
            padding: clamp(4px, 1vw, 10px);
        ">
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
                            max-height: min(60vh, 400px);
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
                ${caption ? `
                    <div style="
                        margin-top: 12px;
                        color: var(--umbra-ash);
                        font-size: clamp(0.75rem, 1.5vw, 0.85rem);
                        font-style: italic;
                        opacity: 0.7;
                        padding: 0 8px;
                    ">${escapeHtml(caption)}</div>
                ` : ''}
            ` : `
                <div style="
                    padding: clamp(30px, 8vw, 60px); 
                    background: rgba(255,255,255,0.03); 
                    border-radius: 16px; 
                    border: 1px dashed rgba(255,255,255,0.1);
                ">
                    <div style="font-size: clamp(3rem, 10vw, 4rem);">🎬</div>
                    <p style="color: var(--umbra-ash); margin-top: 12px; font-size: clamp(0.8rem, 1.5vw, 0.9rem);">
                        Video no disponible aún
                    </p>
                </div>
            `}
        </div>
    `;

    const video = container.querySelector('video');
    if (video) {
        video.muted = false;
        
        const playVideo = () => {
            video.play().catch(() => {
                video.muted = true;
                video.play().catch(() => {});
                const captionEl = container.querySelector('div[style*="margin-top: 12px;"]');
                if (captionEl && !captionEl.dataset.clickable) {
                    captionEl.dataset.clickable = 'true';
                    captionEl.textContent = '🔇 Toca aquí para activar el audio';
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

// ==========================================
// 8. PREGUNTA (quiz) - RESPONSIVE
// ==========================================

function renderQuiz(container, data) {
    const question = data.question || '¿Cuál es tu respuesta?';
    const options = data.options || ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'];
    let selected = null;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        max-width: 420px; 
        width: 100%; 
        margin: 0 auto; 
        text-align: center; 
        padding: clamp(8px, 1.5vw, 16px);
    `;

    const questionEl = document.createElement('h3');
    questionEl.textContent = question;
    questionEl.style.cssText = `
        color: var(--umbra-light); 
        font-family: 'Playfair Display', serif; 
        font-size: clamp(1.1rem, 2.5vw, 1.4rem); 
        margin-bottom: clamp(14px, 2vw, 20px);
        line-height: 1.4;
    `;
    wrapper.appendChild(questionEl);

    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

    const resultEl = document.createElement('p');
    resultEl.style.cssText = `
        color: var(--accent-coral); 
        margin-top: 16px; 
        font-size: clamp(0.95rem, 2vw, 1.1rem); 
        min-height: 30px;
    `;

    options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.style.cssText = `
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 40px;
            padding: clamp(10px, 1.5vw, 14px) clamp(16px, 2vw, 20px);
            color: var(--umbra-light);
            cursor: pointer;
            transition: all 0.2s;
            font-size: clamp(0.8rem, 1.5vw, 0.9rem);
            width: 100%;
            font-family: 'Inter', sans-serif;
            word-break: break-word;
        `;
        btn.addEventListener('mouseenter', () => {
            if (selected !== index) {
                btn.style.borderColor = 'var(--accent-coral)';
                btn.style.background = 'rgba(198,90,58,0.1)';
            }
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

// ==========================================
// 9. LISTA DE DESEOS (wishlist) - RESPONSIVE
// ==========================================

function renderWishlist(container, data) {
    const items = data.items || ['Deseo 1', 'Deseo 2', 'Deseo 3'];
    
    container.innerHTML = `
        <div style="
            max-width: 420px; 
            width: 100%; 
            margin: 0 auto; 
            text-align: center; 
            padding: clamp(8px, 1.5vw, 16px);
        ">
            <div style="font-size: clamp(2.5rem, 7vw, 3rem); margin-bottom: 8px;">📝</div>
            <h3 style="
                color: var(--umbra-light); 
                font-family: 'Playfair Display', serif; 
                font-size: clamp(1.2rem, 3vw, 1.6rem); 
                margin-bottom: clamp(14px, 2vw, 20px);
            ">
                Lista de Deseos ✨
            </h3>
            <div style="
                background: rgba(255,255,255,0.03); 
                border-radius: 16px; 
                padding: clamp(12px, 2vw, 20px); 
                border: 1px solid rgba(255,255,255,0.06);
            ">
                <ul style="
                    list-style: none; 
                    padding: 0; 
                    margin: 0; 
                    text-align: left;
                ">
                    ${items.map((item, index) => `
                        <li style="
                            padding: clamp(10px, 1.5vw, 14px) clamp(8px, 1vw, 12px); 
                            border-bottom: 1px solid rgba(255,255,255,0.04); 
                            display: flex; 
                            align-items: center; 
                            gap: 12px; 
                            color: var(--umbra-light); 
                            font-size: clamp(0.85rem, 1.5vw, 0.95rem);
                        ">
                            <span style="
                                font-size: clamp(1rem, 2vw, 1.2rem); 
                                color: var(--accent-coral);
                                flex-shrink: 0;
                            ">${index + 1}.</span>
                            <span style="word-break: break-word;">${escapeHtml(item)}</span>
                            <span style="
                                margin-left: auto; 
                                color: var(--umbra-ash); 
                                font-size: clamp(0.6rem, 1vw, 0.7rem);
                                flex-shrink: 0;
                            ">⭐</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            <p style="
                color: var(--umbra-ash); 
                font-size: clamp(0.7rem, 1.2vw, 0.8rem); 
                margin-top: 16px; 
                font-style: italic;
            ">
                ✨ Algún día estos sueños se harán realidad ✨
            </p>
        </div>
    `;
}