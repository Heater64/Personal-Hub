const FAVORITES_KEY = 'personalHub.razonesFavoritas';

const DEFAULT_RAZONES = [
    'Por la forma en que iluminas mi dia con solo una sonrisa.',
    'Porque siempre sabes como hacerme reir, incluso en los dias dificiles.',
    'Por tu paciencia infinita y tu forma de escuchar.',
    'Porque eres mi lugar seguro en este mundo caotico.',
    'Por la pasion que pones en todo lo que haces.',
    'Porque contigo el tiempo vuela y cada segundo vale la pena.',
    'Por esos pequenos detalles que solo tu tienes conmigo.',
    'Porque me inspiras a ser una mejor version de mi mismo cada dia.',
    'Por tu inteligencia y la forma en que ves el mundo.',
    'Simplemente, por ser tu, sin filtros ni pretensiones.'
];

const razonesList = Array.isArray(window.razonesData) && window.razonesData.length
    ? window.razonesData
    : DEFAULT_RAZONES;

let favoritos = [];

function cargarFavoritos() {
    try {
        favoritos = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
        favoritos = [];
    }
}

function guardarFavoritos() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritos));
}

function toggleFavorito(index) {
    if (favoritos.includes(index)) {
        favoritos = favoritos.filter(i => i !== index);
        showToast('Eliminado de favoritos');
    } else {
        favoritos.push(index);
        showToast('Anadido a favoritos');

        if (typeof launchParticles === 'function') {
            launchParticles({
                amount: 12,
                symbols: ['❤', '✦', '✧'],
                colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
                spread: 100
            });
        }
    }

    guardarFavoritos();
    renderRazones();
}

function renderRazones() {
    const grid = document.getElementById('razonesGrid');
    if (!grid) return;

    grid.innerHTML = razonesList.map((razon, index) => {
        const esFavorito = favoritos.includes(index);
        return `
            <div class="razon-card" data-index="${index}" style="animation: fadeInUp 0.5s forwards ${index * 0.05}s; opacity: 0;">
                <div class="razon-number">${(index + 1).toString().padStart(2, '0')}</div>
                <div class="razon-content" data-editable="razon_${index}">${escapeHtml(razon)}</div>
                <div class="razon-footer">
                    <button class="fav-btn ${esFavorito ? 'active' : ''}" data-index="${index}">
                        <i data-lucide="heart" ${esFavorito ? 'fill="currentColor"' : ''}></i>
                        <span>Favorito</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    document.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleFavorito(Number(btn.dataset.index));
        });
    });

    document.querySelectorAll('.razon-card').forEach(card => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('.fav-btn')) return;
            if (typeof pulseElement === 'function') pulseElement(card);

            const index = Number(card.dataset.index);
            showToast(`${razonesList[index].substring(0, 60)}...`, false, 2000);
        });
    });
}

function mostrarRazonAleatoria() {
    const randomIndex = Math.floor(Math.random() * razonesList.length);
    const modal = document.getElementById('randomModal');
    const textEl = document.getElementById('randomText');

    if (textEl) textEl.textContent = razonesList[randomIndex];
    if (modal) modal.style.display = 'flex';

    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 16,
            symbols: ['❤', '✦', '✧', '✨'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1', '#ffd966'],
            spread: 130,
            source: document.getElementById('randomBtn')
        });
    }
}

function cerrarModal() {
    const modal = document.getElementById('randomModal');
    if (modal) modal.style.display = 'none';
}

function showToast(message, isError = false, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.borderLeftColor = isError ? '#dc3545' : 'var(--accent-coral)';

    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

function initRazones() {
    const randomBtn = document.getElementById('randomBtn');
    const closeModal = document.getElementById('closeModal');
    const modal = document.getElementById('randomModal');

    randomBtn?.addEventListener('click', mostrarRazonAleatoria);
    closeModal?.addEventListener('click', cerrarModal);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) cerrarModal();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal?.style.display === 'flex') {
            cerrarModal();
        }
    });

    cargarFavoritos();
    renderRazones();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRazones);
} else {
    initRazones();
}

window.toggleFavorito = toggleFavorito;
window.mostrarRazonAleatoria = mostrarRazonAleatoria;
window.cerrarModal = cerrarModal;
