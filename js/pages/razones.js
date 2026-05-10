const reasonsData = [
    { short: "Tu forma de mirar", long: "Cuando me miras asi, siento que todo se detiene y solo existes tu." },
    { short: "Como me haces sentir", long: "Me haces mas ligero, mas valiente. Contigo los dias grises tienen luz." },
    { short: "Tu risa", long: "Esa risa tuya, la que sale sin avisar, me desarma y me reconstruye." },
    { short: "Tu forma de ser", long: "Tan autentica, sin mascaras. Eso es poco comun y muy valioso." },
    { short: "Los pequenos detalles", long: "Un mensaje sin motivo, una foto, recordar como me gusta el cafe... ahi vives tu." },
    { short: "Porque estoy mejor contigo", long: "Mi mundo funciona mejor cuando vos estas en el. No necesito mas razones." }
];

let currentRandomIndex = 0;
let favoriteIndices = [];
const razonesRef = db.collection('razones').doc('favoritos');

async function loadFavorites() {
    try {
        const doc = await razonesRef.get();
        if (doc.exists && doc.data().indices) {
            favoriteIndices = doc.data().indices;
        } else {
            favoriteIndices = [];
            await razonesRef.set({ indices: [] });
        }
    } catch (error) {
        console.error('Error al cargar razones:', error);
        favoriteIndices = [];
    }
    renderReasonsList();
}

async function saveFavorites() {
    try {
        await razonesRef.set({ indices: favoriteIndices }, { merge: true });
    } catch (error) {
        console.error('Error al guardar razones:', error);
        showMessage('No se pudo guardar favoritos', true);
    }
}

function toggleFavorite(index) {
    if (favoriteIndices.includes(index)) {
        favoriteIndices = favoriteIndices.filter((item) => item !== index);
    } else {
        favoriteIndices.push(index);
    }

    saveFavorites();
    renderReasonsList();
}

function getOrderedReasons() {
    const ordered = [];

    for (const idx of favoriteIndices) {
        if (idx >= 0 && idx < reasonsData.length) {
            ordered.push({ ...reasonsData[idx], originalIndex: idx, isFav: true });
        }
    }

    for (let i = 0; i < reasonsData.length; i++) {
        if (!favoriteIndices.includes(i)) {
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

    document.querySelectorAll('.reason-item').forEach((item) => {
        const heartSpan = item.querySelector('.reason-heart');
        const originalIndex = parseInt(item.dataset.originalIndex, 10);

        item.addEventListener('click', (event) => {
            if (event.target === heartSpan) return;

            const isActive = item.classList.contains('active');
            document.querySelectorAll('.reason-item.active').forEach((activeItem) => {
                if (activeItem !== item) activeItem.classList.remove('active');
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

        if (heartSpan) {
            heartSpan.addEventListener('click', (event) => {
                event.stopPropagation();
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
    loadFavorites();
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
