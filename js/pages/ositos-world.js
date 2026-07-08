// js/pages/ositos-world.js
// Lógica completa de Ositos World

// ==========================================
// ESTADO
// ==========================================

const state = {
    currentSection: 'home',
    currentChapterIndex: 0,
    modalOpen: false,
    favorites: JSON.parse(localStorage.getItem('ositosFavorites') || '[]')
};

// ==========================================
// DOM REFERENCIAS
// ==========================================

const mainContent = document.getElementById('ositosContent');
const modal = document.getElementById('ositosModal');
const modalBody = document.getElementById('ositosModalBody');
const modalClose = document.getElementById('ositosModalClose');
const hamburger = document.getElementById('ositosHamburger');
const mobileMenu = document.getElementById('ositosMobileMenu');
const navLinks = document.querySelectorAll('.ositos-nav-link, .ositos-mobile-nav-link');

// ==========================================
// FAVORITOS
// ==========================================

function toggleFavorite(characterId) {
    const index = state.favorites.indexOf(characterId);
    if (index > -1) {
        state.favorites.splice(index, 1);
        showOsitosMessage('💔 Quitado de favoritos');
    } else {
        state.favorites.push(characterId);
        showOsitosMessage('❤️ Añadido a favoritos');
    }
    localStorage.setItem('ositosFavorites', JSON.stringify(state.favorites));
    updateFavoriteCounters();
    
    if (state.currentSection === 'personajes') {
        renderCharacters();
    }
}

function isFavorite(characterId) {
    return state.favorites.includes(characterId);
}

function updateFavoriteCounters() {
    const totalFavs = state.favorites.length;
    const favBtn = document.getElementById('showFavoritesBtn');
    if (favBtn) {
        favBtn.innerHTML = totalFavs > 0 
            ? `❤️ FAVORITOS (${totalFavs})` 
            : `❤️ FAVORITOS`;
    }
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function navigateTo(section) {
    state.currentSection = section;
    
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });
    
    closeMobileMenu();
    renderSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSection(section) {
    switch(section) {
        case 'home': renderHome(); break;
        case 'historia': renderHistory(); break;
        case 'personajes': renderCharacters(); break;
        case 'mundo': renderWorld(); break;
        case 'noticias': renderNews(); break;
        default: renderHome();
    }
    
    setTimeout(() => {
        setupSidebarFilters();
        updateSidebarCounters();
        updateFavoriteCounters();
    }, 100);
}

// ==========================================
// MENÚ MÓVIL
// ==========================================

function toggleMobileMenu() {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
}

function closeMobileMenu() {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
}

// ==========================================
// TOAST NOTIFICACIONES
// ==========================================

function showOsitosMessage(text) {
    const existing = document.querySelector('.ositos-temp-message');
    if (existing) existing.remove();
    
    const msg = document.createElement('div');
    msg.className = 'ositos-temp-message';
    msg.textContent = text;
    msg.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #09142E;
        color: white;
        padding: 14px 32px;
        border-radius: 40px;
        font-family: 'Nunito', sans-serif;
        font-weight: 700;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.08);
        animation: ositosToastIn 0.3s ease;
        max-width: 90%;
        text-align: center;
        backdrop-filter: blur(8px);
    `;
    
    if (!document.getElementById('ositos-toast-style')) {
        const style = document.createElement('style');
        style.id = 'ositos-toast-style';
        style.textContent = `
            @keyframes ositosToastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes ositosToastOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.style.animation = 'ositosToastOut 0.3s ease forwards';
        setTimeout(() => msg.remove(), 300);
    }, 2500);
}

// ==========================================
// RENDER: INICIO
// ==========================================

function renderHome() {
    const heroChapter = chapters[0];
    const latestNews = news[0];
    const featuredCharacters = characters.slice(0, 4);
    const totalChapters = chapters.length;
    const totalCharacters = characters.length;
    const totalPlaces = places.length;
    const totalFavs = state.favorites.length;
    
    mainContent.innerHTML = `
        <div class="ositos-page-content active">
            <!-- HERO -->
            <div class="ositos-hero-section">
                <span class="hero-icon">🧸</span>
                <h1>Bienvenida a <span>Ositos World</span></h1>
                <p>Un pequeño lugar lleno de aventuras, personajes curiosos y muchas historias por descubrir.</p>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; flex-direction:column; align-items:center; max-width:400px; margin:0 auto;">
                    <button class="btn-primary" onclick="openChapterPDF(${heroChapter ? heroChapter.id : 1})" style="width:100%; justify-content:center;">
                        📖 Empezar a leer
                    </button>
                    <button class="btn-primary" style="background:rgba(255,255,255,0.15); box-shadow:none; width:100%; justify-content:center;" onclick="navigateTo('personajes')">
                        🧸 Conocer personajes
                    </button>
                </div>
            </div>

            <!-- ESTADÍSTICAS RÁPIDAS -->
            <div class="ositos-stats">
                <div class="ositos-stat-item">
                    <div class="ositos-stat-icon">📖</div>
                    <div class="ositos-stat-number">${totalChapters}</div>
                    <div class="ositos-stat-label">Capítulos</div>
                </div>
                <div class="ositos-stat-item">
                    <div class="ositos-stat-icon">🧸</div>
                    <div class="ositos-stat-number">${totalCharacters}</div>
                    <div class="ositos-stat-label">Personajes</div>
                </div>
                <div class="ositos-stat-item">
                    <div class="ositos-stat-icon">🏰</div>
                    <div class="ositos-stat-number">${totalPlaces}</div>
                    <div class="ositos-stat-label">Lugares</div>
                </div>
                <div class="ositos-stat-item">
                    <div class="ositos-stat-icon">❤️</div>
                    <div class="ositos-stat-number">${totalFavs}</div>
                    <div class="ositos-stat-label">Favoritos</div>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// RENDER: HISTORIA (con PDF)
// ==========================================

function renderHistory() {
    const sagas = {};
    chapters.forEach(ch => {
        if (!sagas[ch.saga]) sagas[ch.saga] = [];
        sagas[ch.saga].push(ch);
    });
    
    let html = `
        <div class="ositos-page-content active">
            <div class="ositos-section-header">
                <h2 class="ositos-section-title">📖 Biblioteca de Capítulos</h2>
                <span class="ositos-orange-curl"></span>
            </div>
    `;
    
    const sagaKeys = Object.keys(sagas).sort((a, b) => a - b);
    sagaKeys.forEach(sagaKey => {
        const sagaChapters = sagas[sagaKey];
        html += `
            <div style="margin-bottom: 32px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; padding: 10px 16px; background: linear-gradient(135deg, #09142E, #1a2a5e); border-radius: 12px;">
                    <span style="font-size:24px;">📜</span>
                    <h3 style="font-family:'Lilita One','Baloo 2',sans-serif; font-size:22px; color:white; margin:0;">Ositos World ${sagaKey}</h3>
                    <span style="color:rgba(255,255,255,0.5); font-size:13px; margin-left:auto;">${sagaChapters.length} capítulos</span>
                </div>
                <div class="ositos-grid-3">
                    ${sagaChapters.map(ch => `
                        <div class="ositos-card-home" style="cursor:pointer;" onclick="openChapterPDF(${ch.id})">
                            <div class="card-image">
                                <span>📖</span>
                            </div>
                            <span class="tag">Capítulo ${ch.id}</span>
                            <h3>${ch.title}</h3>
                            <p>${ch.summary}</p>
                            <button class="btn-sm" onclick="event.stopPropagation();openChapterPDF(${ch.id})">📖 Leer capítulo</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    mainContent.innerHTML = html;
}

// ==========================================
// ABRIR CAPÍTULO PDF
// ==========================================

function openChapterPDF(id) {
    const ch = chapters.find(c => c.id === id);
    if (!ch) return;
    
    const prev = ch.previous ? chapters.find(c => c.id === ch.previous) : null;
    const next = ch.next ? chapters.find(c => c.id === ch.next) : null;
    
    const charLinks = (ch.characters || []).map(name => {
        const char = characters.find(c => c.name === name);
        return char ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openCharacter('${char.id}')">${name}</span>` : `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${name}</span>`;
    }).join('');
    
    const placeLinks = (ch.places || []).map(name => {
        const place = places.find(p => p.name === name);
        return place ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openPlaceModal('${place.id}')">${name}</span>` : `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${name}</span>`;
    }).join('');
    
    const html = `
        <div class="ositos-modal-image" style="aspect-ratio:16/9;">
            <span>📖</span>
        </div>
        <h2 class="ositos-modal-name">Capítulo ${ch.id}: ${ch.title}</h2>
        
        <div style="width:100%; margin:12px 0;">
            <iframe src="${ch.pdfUrl}" style="width:100%; height:500px; border:none; border-radius:12px; background:#f5f5f5;"></iframe>
            <div style="text-align:center; margin-top:8px;">
                <a href="${ch.pdfUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:10px 24px; background:#4169FF; color:white; border-radius:30px; text-decoration:none; font-weight:700; font-family:'Nunito',sans-serif; font-size:14px;">
                    📄 Abrir en nueva ventana
                </a>
            </div>
        </div>
        
        ${charLinks ? `
            <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
                <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🧸 Personajes que aparecen</h4>
                <div>${charLinks}</div>
            </div>
        ` : ''}
        
        ${placeLinks ? `
            <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
                <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🏰 Lugares mencionados</h4>
                <div>${placeLinks}</div>
            </div>
        ` : ''}
        
        <div style="display:flex;justify-content:space-between;gap:12px;width:100%;margin-top:20px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
            <button ${!prev ? 'disabled' : ''} style="padding:8px 20px;border-radius:30px;font-weight:600;font-size:14px;background:${prev ? '#FFD44A' : '#F0F2F5'};color:${prev ? '#1E284B' : '#B0B8C8'};border:none;cursor:${prev ? 'pointer' : 'default'};transition:all 0.2s;" onclick="${prev ? `closeModal();openChapterPDF(${prev.id})` : ''}">
                ← Anterior
            </button>
            <button ${!next ? 'disabled' : ''} style="padding:8px 20px;border-radius:30px;font-weight:600;font-size:14px;background:${next ? '#FFD44A' : '#F0F2F5'};color:${next ? '#1E284B' : '#B0B8C8'};border:none;cursor:${next ? 'pointer' : 'default'};transition:all 0.2s;" onclick="${next ? `closeModal();openChapterPDF(${next.id})` : ''}">
                Siguiente →
            </button>
        </div>
    `;
    
    openModal(html);
}

// ==========================================
// RENDER: PERSONAJES
// ==========================================

function renderCharacters() {
    const allCharacters = [...characters];
    
    let html = `
        <div class="ositos-page-content active">
            <div class="ositos-section-header">
                <h2 class="ositos-section-title">🧸 Personajes</h2>
                <span class="ositos-orange-curl"></span>
                ${state.favorites.length > 0 ? `<span style="margin-left:auto; font-size:13px; color:#FF6B6B; font-weight:700;">❤️ ${state.favorites.length} favoritos</span>` : ''}
            </div>
            <div class="ositos-grid">
                ${allCharacters.map(c => createCharacterCard(c)).join('')}
            </div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    
    setTimeout(() => {
        const activeFilter = document.querySelector('.ositos-filter-btn.active');
        if (activeFilter) {
            const filter = activeFilter.dataset.filter;
            if (filter !== 'todos') {
                const cards = document.querySelectorAll('.ositos-card');
                cards.forEach(c => {
                    const role = c.querySelector('.ositos-card-role');
                    if (role) {
                        c.style.display = role.classList.contains(filter) ? 'flex' : 'none';
                    }
                });
            }
        }
    }, 100);
}

function createCharacterCard(char) {
    const hasImage = char.image && char.image.length > 0;
    const fav = isFavorite(char.id);
    
    return `
        <div class="ositos-card ${fav ? 'selected' : ''}" onclick="openCharacter('${char.id}')">
            <button class="ositos-card-fav ${fav ? 'active' : ''}" onclick="event.stopPropagation();toggleFavorite('${char.id}')">
                ${fav ? '❤️' : '🤍'}
            </button>
            <span class="ositos-card-role ${char.role}">${char.role.toUpperCase()}</span>
            <div class="ositos-card-image" style="background:#FAFAFA">
                ${hasImage ? `<img src="${char.image}" alt="${char.name}">` : `<span class="ositos-card-emoji">${getEmojiForCharacter(char.name)}</span>`}
            </div>
            <div class="ositos-card-name">${char.name.toUpperCase()}</div>
        </div>
    `;
}

// ==========================================
// ABRIR PERSONAJE
// ==========================================

function openCharacter(id) {
    const char = characters.find(c => c.id === id);
    if (!char) return;
    
    const hasImage = char.image && char.image.length > 0;
    const fav = isFavorite(char.id);
    
    const friendLinks = (char.friends || []).map(name => {
        const friend = characters.find(c => c.name === name);
        return friend ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openCharacter('${friend.id}')">${name}</span>` : `<span style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${name}</span>`;
    }).join('');
    
    const homeLink = places.find(p => p.name === char.home);
    const homeHtml = homeLink ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openPlaceModal('${homeLink.id}')">${char.home}</span>` : `<span style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${char.home}</span>`;
    
    const html = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:8px;">
            <div></div>
            <button onclick="toggleFavorite('${char.id}'); closeModal(); openCharacter('${char.id}')" style="background:none; border:none; font-size:28px; cursor:pointer; transition:transform 0.2s; padding:8px;">
                ${fav ? '❤️' : '🤍'}
            </button>
        </div>
        <div class="ositos-modal-image" style="aspect-ratio:1/1; max-width:200px; border-radius:50%; margin:0 auto;">
            ${hasImage ? `<img src="${char.image}" alt="${char.name}">` : `<span>${getEmojiForCharacter(char.name)}</span>`}
        </div>
        <h2 class="ositos-modal-name">${char.name}</h2>
        <span class="ositos-modal-role ${char.role}">${char.role.toUpperCase()}</span>
        
        <div style="font-size:14px;color:#4A5268;line-height:1.6;text-align:left;width:100%;margin-top:8px;">
            <p><strong>Descripción:</strong> ${char.description}</p>
            <p><strong>Personalidad:</strong> ${char.personality}</p>
            ${char.curiosities ? `<p><strong>Curiosidades:</strong> ${char.curiosities}</p>` : ''}
        </div>
        
        <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
            <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🏠 Lugar donde vive</h4>
            <div>${homeHtml}</div>
        </div>
        
        ${friendLinks ? `
            <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
                <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🤝 Amigos</h4>
                <div>${friendLinks}</div>
            </div>
        ` : ''}
    `;
    
    openModal(html);
}

// ==========================================
// RENDER: MUNDO (con imagen principal)
// ==========================================

function renderWorld() {
    mainContent.innerHTML = `
        <div class="ositos-page-content active">
            <!-- IMAGEN PRINCIPAL DEL MUNDO -->
            <div style="width:100%; border-radius:20px; overflow:hidden; margin-bottom:32px; box-shadow:0 4px 20px rgba(0,0,0,0.06);">
                <img src="" alt="El Mundo de Ositos" style="width:100%; height:auto; aspect-ratio:16/6; object-fit:cover; display:block;">
            </div>

            <div class="ositos-section-header">
                <h2 class="ositos-section-title">🏰 Lugares del Mundo</h2>
                <span class="ositos-orange-curl"></span>
            </div>
            <div class="ositos-grid-3">
                ${places.map(p => `
                    <div class="ositos-card-home" onclick="openPlaceModal('${p.id}')" style="cursor:pointer;">
                        <div class="card-image">
                            <span>${getEmojiForPlace(p.name)}</span>
                        </div>
                        <h3>${p.name}</h3>
                        <p>${p.description}</p>
                        <button class="btn-sm" onclick="event.stopPropagation();openPlaceModal('${p.id}')">🔍 Explorar</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ==========================================
// ABRIR LUGAR (modal con PDF - sin mapa)
// ==========================================

function openPlaceModal(id) {
    const place = places.find(p => p.id === id);
    if (!place) return;
    
    const charLinks = (place.characters || []).map(name => {
        const char = characters.find(c => c.name === name);
        return char ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openCharacter('${char.id}')">${name}</span>` : `<span style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${name}</span>`;
    }).join('');
    
    const html = `
        <div class="ositos-modal-image" style="aspect-ratio:16/9;">
            <span>${getEmojiForPlace(place.name)}</span>
        </div>
        <h2 class="ositos-modal-name">${place.name}</h2>
        
        <div style="font-size:14px;color:#4A5268;line-height:1.6;text-align:left;width:100%;margin-top:8px;">
            <p>${place.description}</p>
            ${place.curiosities ? `<p><strong>Curiosidad:</strong> ${place.curiosities}</p>` : ''}
        </div>
        
        <!-- PDF del lugar -->
        <div style="width:100%; margin:12px 0;">
            <iframe src="${place.pdfUrl}" style="width:100%; height:450px; border:none; border-radius:12px; background:#f5f5f5;"></iframe>
            <div style="text-align:center; margin-top:8px;">
                <a href="${place.pdfUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:10px 24px; background:#4169FF; color:white; border-radius:30px; text-decoration:none; font-weight:700; font-family:'Nunito',sans-serif; font-size:14px;">
                    📄 Abrir guía completa
                </a>
            </div>
        </div>
        
        ${charLinks ? `
            <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
                <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🧸 Personajes que viven aquí</h4>
                <div>${charLinks}</div>
            </div>
        ` : ''}
    `;
    
    openModal(html);
}

// ==========================================
// RENDER: NOTICIAS
// ==========================================

function getNoticiasFiltradas() {
    const hoy = new Date();
    const semanaMs = 7 * 24 * 60 * 60 * 1000;
    
    const noticiasConFecha = news.map(n => {
        let fecha = new Date(n.date);
        if (isNaN(fecha.getTime())) {
            fecha = new Date();
        }
        return { ...n, fecha };
    });
    
    noticiasConFecha.sort((a, b) => b.fecha - a.fecha);
    
    const recientes = noticiasConFecha.filter(n => 
        (hoy - n.fecha) < semanaMs
    );
    
    const anteriores = noticiasConFecha.filter(n => 
        (hoy - n.fecha) >= semanaMs
    );
    
    return { recientes, anteriores };
}

function renderNews() {
    const { recientes, anteriores } = getNoticiasFiltradas();
    
    let html = `
        <div class="ositos-page-content active">
            <div class="ositos-section-header">
                <h2 class="ositos-section-title">📰 Periódico del Mundo</h2>
                <span class="ositos-orange-curl"></span>
            </div>
    `;
    
    if (recientes.length > 0) {
        html += `
            <div style="margin-bottom: 28px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                    <span style="font-size:20px;">🆕</span>
                    <h3 style="font-family:'Fredoka','Baloo 2',sans-serif; font-size:18px; color:#1E284B; margin:0;">Noticias Recientes</h3>
                    <span style="font-size:12px; color:#5C6475; background:#F0F2F5; padding:2px 12px; border-radius:30px;">Esta semana</span>
                </div>
                <div class="ositos-grid-3">
                    ${recientes.map(n => createNewsCardHTML(n)).join('')}
                </div>
            </div>
        `;
    }
    
    if (anteriores.length > 0) {
        html += `
            <div style="margin-bottom: 16px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                    <span style="font-size:20px;">📜</span>
                    <h3 style="font-family:'Fredoka','Baloo 2',sans-serif; font-size:18px; color:#5C6475; margin:0;">Noticias Anteriores</h3>
                    <span style="font-size:12px; color:#8a94a6; background:#F0F2F5; padding:2px 12px; border-radius:30px;">Archivo</span>
                </div>
                <div class="ositos-grid-3">
                    ${anteriores.map(n => createNewsCardHTML(n)).join('')}
                </div>
            </div>
        `;
    }
    
    if (recientes.length === 0 && anteriores.length === 0) {
        html += `
            <div style="text-align:center; padding:40px 20px; color:#5C6475;">
                <span style="font-size:48px; display:block; margin-bottom:12px;">📭</span>
                <h3 style="font-family:'Fredoka','Baloo 2',sans-serif; font-size:20px; color:#1E284B;">No hay noticias</h3>
                <p>Vuelve pronto para ver las últimas novedades del mundo Ositos.</p>
            </div>
        `;
    }
    
    html += `</div>`;
    mainContent.innerHTML = html;
}

function createNewsCardHTML(n) {
    return `
        <div class="ositos-card-home" onclick="openNews(${n.id})" style="cursor:pointer;">
            <div class="card-image">
                <span>📰</span>
            </div>
            <span class="date" style="font-size:12px; color:#8a94a6;">${n.date}</span>
            <h3>${n.title}</h3>
            <p>${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}</p>
            <button class="btn-sm" onclick="event.stopPropagation();openNews(${n.id})">📰 Leer noticia</button>
        </div>
    `;
}

function openNews(id) {
    const newsItem = news.find(n => n.id === id);
    if (!newsItem) return;
    
    const charLinks = (newsItem.relatedCharacters || []).map(name => {
        const char = characters.find(c => c.name === name);
        return char ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openCharacter('${char.id}')">${name}</span>` : `<span style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${name}</span>`;
    }).join('');
    
    const placeLinks = (newsItem.relatedPlaces || []).map(name => {
        const place = places.find(p => p.name === name);
        return place ? `<span class="chip" style="display:inline-block;padding:4px 14px;border-radius:30px;background:rgba(65,105,255,0.1);color:#4169FF;font-weight:600;font-size:13px;cursor:pointer;margin:4px;" onclick="closeModal();openPlaceModal('${place.id}')">${name}</span>` : `<span style="display:inline-block;padding:4px 14px;border-radius:30px;background:#F0F2F5;color:#5C6475;font-weight:600;font-size:13px;margin:4px;">${name}</span>`;
    }).join('');
    
    const html = `
        <div class="ositos-modal-image" style="aspect-ratio:16/6;">
            <span>📰</span>
        </div>
        <h2 class="ositos-modal-name">${newsItem.title}</h2>
        <div style="font-size:13px;color:#8a94a6;width:100%;text-align:center;">${newsItem.date}</div>
        <div style="font-size:15px;color:#4A5268;line-height:1.8;text-align:left;width:100%;margin-top:12px;">
            <p>${newsItem.content}</p>
        </div>
        
        ${charLinks ? `
            <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
                <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🧸 Personajes relacionados</h4>
                <div>${charLinks}</div>
            </div>
        ` : ''}
        
        ${placeLinks ? `
            <div style="width:100%;margin-top:16px;padding-top:16px;border-top:2px solid rgba(255,212,74,0.3);">
                <h4 style="font-family:'Fredoka','Baloo 2',sans-serif;font-size:16px;color:#1E284B;margin-bottom:8px;">🏰 Lugares relacionados</h4>
                <div>${placeLinks}</div>
            </div>
        ` : ''}
    `;
    
    openModal(html);
}

// ==========================================
// EMojis
// ==========================================

function getEmojiForCharacter(name) {
    const map = { 
        'Batón Gordito': '🧸', 
        'Lili y Lolo': '🐰', 
        'Tito': '🦝', 
        'Vaca Lola': '🐿️', 
        'Rey Esqueleto': '💀' 
    };
    return map[name] || '🧸';
}

function getEmojiForPlace(name) {
    const map = { 
        'Bosque Azul': '🌳', 
        'Pueblo de los Conejos': '🏘️', 
        'Castillo Oscuro': '🏰', 
        'Lago de los Deseos': '🌊' 
    };
    return map[name] || '📍';
}

// ==========================================
// MODALES
// ==========================================

function openModal(html) {
    modalBody.innerHTML = html;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// ==========================================
// SIDEBAR
// ==========================================

function setupSidebarFilters() {
    const filterBtns = document.querySelectorAll('.ositos-filter-btn');
    if (!filterBtns.length) return;
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            
            navigateTo('personajes');
            
            setTimeout(() => {
                const grid = document.querySelector('.ositos-grid');
                const cards = document.querySelectorAll('.ositos-card');
                
                if (filter === 'todos') {
                    cards.forEach(c => c.style.display = 'flex');
                    if (grid) {
                        grid.style.display = 'grid';
                        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
                    }
                } else {
                    let hasVisible = false;
                    cards.forEach(c => {
                        const role = c.querySelector('.ositos-card-role');
                        if (role) {
                            const roleClass = role.classList.contains(filter);
                            c.style.display = roleClass ? 'flex' : 'none';
                            if (roleClass) hasVisible = true;
                        }
                    });
                    
                    if (!hasVisible && grid) {
                        let noResults = grid.querySelector('.ositos-no-results');
                        if (!noResults) {
                            noResults = document.createElement('div');
                            noResults.className = 'ositos-no-results';
                            noResults.style.cssText = `
                                grid-column: 1 / -1;
                                text-align: center;
                                padding: 60px 20px;
                                color: #5C6475;
                            `;
                            noResults.innerHTML = `
                                <div style="font-size:48px; margin-bottom:16px;">🔍</div>
                                <h3 style="font-size:22px; font-weight:800; color:#1E284B; font-family:'Lilita One','Baloo 2',sans-serif; margin:0 0 8px;">No hay personajes</h3>
                                <p style="font-size:15px; color:#5C6475; font-family:'Nunito',sans-serif;">Pronto llegará más gente a este mundo.</p>
                            `;
                            grid.appendChild(noResults);
                        }
                        noResults.style.display = 'block';
                    } else {
                        const noResults = grid?.querySelector('.ositos-no-results');
                        if (noResults) noResults.style.display = 'none';
                    }
                }
            }, 300);
        });
    });
}

function setupSidebarFavorites() {
    const favBtn = document.getElementById('showFavoritesBtn');
    if (!favBtn) return;
    
    favBtn.addEventListener('click', function() {
        navigateTo('personajes');
        setTimeout(() => {
            const cards = document.querySelectorAll('.ositos-card');
            const hasFavorites = state.favorites.length > 0;
            
            if (hasFavorites) {
                cards.forEach(c => {
                    const favBtn = c.querySelector('.ositos-card-fav');
                    if (favBtn && favBtn.classList.contains('active')) {
                        c.style.display = 'flex';
                    } else {
                        c.style.display = 'none';
                    }
                });
                showOsitosMessage(`❤️ Mostrando ${state.favorites.length} favoritos`);
            } else {
                cards.forEach(c => c.style.display = 'flex');
                showOsitosMessage('💔 No tienes favoritos aún');
            }
        }, 300);
    });
}

function updateSidebarCounters() {
    const total = characters.length;
    const heroes = characters.filter(c => c.role === 'heroe').length;
    const villanos = characters.filter(c => c.role === 'villano').length;
    const aliados = characters.filter(c => c.role === 'aliado').length;
    
    const countTodos = document.getElementById('countTodos');
    const countHeroes = document.getElementById('countHeroes');
    const countVillanos = document.getElementById('countVillanos');
    const countAliados = document.getElementById('countAliados');
    
    if (countTodos) countTodos.textContent = total;
    if (countHeroes) countHeroes.textContent = heroes;
    if (countVillanos) countVillanos.textContent = villanos;
    if (countAliados) countAliados.textContent = aliados;
}

// ==========================================
// EVENTOS
// ==========================================

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.section);
    });
});

hamburger.addEventListener('click', toggleMobileMenu);

modalClose.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

document.querySelector('.ositos-logo-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('home');
});

// ==========================================
// INICIO
// ==========================================

renderHome();

setTimeout(() => {
    setupSidebarFilters();
    setupSidebarFavorites();
    updateSidebarCounters();
    updateFavoriteCounters();
}, 200);

if (typeof lucide !== 'undefined') {
    setTimeout(() => lucide.createIcons(), 300);
}

console.log('🧸 Ositos World iniciado!');
console.log(`📚 ${chapters.length} capítulos`);
console.log(`🧸 ${characters.length} personajes`);
console.log(`🏰 ${places.length} lugares`);
console.log(`📰 ${news.length} noticias`);
console.log(`❤️ ${state.favorites.length} favoritos`);