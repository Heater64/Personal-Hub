// razones.js – UI con favoritos usando emojis (♡ / 🤍)
const reasonsData = [
    { short: "Tu forma de mirar", long: "Cuando me miras así, siento que todo se detiene y solo existes tú." },
    { short: "Cómo me haces sentir", long: "Me haces más ligero, más valiente. Contigo los días grises tienen luz." },
    { short: "Tu risa", long: "Esa risa tuya, la que sale sin avisar, me desarma y me reconstruye." },
    { short: "Tu forma de ser", long: "Tan auténtica, sin máscaras. Eso es poco común y muy valioso." },
    { short: "Los pequeños detalles", long: "Un mensaje sin motivo, una foto, recordar cómo me gusta el café… ahí vives tú." },
    { short: "Porque estoy mejor contigo", long: "Mi mundo funciona mejor cuando vos estás en él. No necesito más razones." }
];

let currentRandomIndex = 0;
const STORAGE_KEY = 'razones_favoritos';

function loadFavorites() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch(e) { return []; }
    }
    return [];
}

function saveFavorites(favs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

function toggleFavorite(index) {
    let favs = loadFavorites();
    if (favs.includes(index)) {
        favs = favs.filter(i => i !== index);
    } else {
        favs.push(index);
    }
    saveFavorites(favs);
    renderReasonsList();
}

function getOrderedReasons() {
    const favs = loadFavorites();
    const ordered = [];
    // favoritos en orden de aparición en favs
    for (let idx of favs) {
        if (idx >= 0 && idx < reasonsData.length) {
            ordered.push({ ...reasonsData[idx], originalIndex: idx, isFav: true });
        }
    }
    // no favoritos en orden original
    for (let i = 0; i < reasonsData.length; i++) {
        if (!favs.includes(i)) {
            ordered.push({ ...reasonsData[i], originalIndex: i, isFav: false });
        }
    }
    return ordered;
}

function renderReasonsList() {
    const container = document.getElementById('reasonsList');
    if (!container) return;
    
    const ordered = getOrderedReasons();
    
    container.innerHTML = ordered.map((item) => `
        <li class="reason-item" data-original-index="${item.originalIndex}">
            <div class="reason-left">
                <span class="reason-number">${item.originalIndex + 1}</span>
                <span class="reason-text">${escapeHtml(item.short)}</span>
            </div>
            <span class="reason-heart">${item.isFav ? '🤍' : '♡'}</span>
            <div class="reason-detail">${escapeHtml(item.long)}</div>
        </li>
    `).join('');

    // Eventos
    document.querySelectorAll('.reason-item').forEach(item => {
        const heartSpan = item.querySelector('.reason-heart');
        const originalIndex = parseInt(item.dataset.originalIndex);
        
        // Expandir/colapsar al hacer clic en el ítem (excepto en el corazón)
        item.addEventListener('click', (e) => {
            if (e.target === heartSpan) return;
            
            const isActive = item.classList.contains('active');
            document.querySelectorAll('.reason-item.active').forEach(act => {
                if (act !== item) act.classList.remove('active');
            });
            if (!isActive) {
                item.classList.add('active');
                if (typeof launchParticles === 'function') {
                    launchParticles({
                        amount: 6,
                        symbols: ['❤', '✦'],
                        colors: ['#c65a3a', '#ffb347'],
                        spread: 80,
                        source: item.querySelector('.reason-number')
                    });
                }
            } else {
                item.classList.remove('active');
            }
            if (typeof pulseElement === 'function') pulseElement(item);
        });
        
        // Clic en el corazón: marcar favorito
        if (heartSpan) {
            heartSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(originalIndex);
                if (typeof pulseElement === 'function') pulseElement(heartSpan);
                if (typeof launchParticles === 'function') {
                    launchParticles({
                        amount: 8,
                        symbols: ['❤', '✧'],
                        colors: ['#c65a3a', '#ffb347'],
                        spread: 90,
                        source: heartSpan
                    });
                }
            });
        }
    });
}

function updateRandomReason() {
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * reasonsData.length);
    } while (reasonsData.length > 1 && newIndex === currentRandomIndex);
    currentRandomIndex = newIndex;
    const reason = reasonsData[currentRandomIndex];
    const textEl = document.getElementById('randomReasonText');
    if (textEl) textEl.textContent = reason.short;
}

function initRazones() {
    renderReasonsList();
    updateRandomReason();

    const randomBtn = document.getElementById('randomizeBtn');
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            updateRandomReason();
            if (typeof pulseElement === 'function') pulseElement(randomBtn);
            if (typeof launchParticles === 'function') {
                launchParticles({
                    amount: 14,
                    symbols: ['❤', '✦', '✧'],
                    colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
                    spread: 140,
                    source: randomBtn
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initRazones);