// razones.js · Versión mejorada con Firebase y UI Umbra

// Lista de razones (prioriza window.razonesData de data.js)
const DEFAULT_RAZONES = [
    "Por la forma en que iluminas mi día con solo una sonrisa.",
    "Porque siempre sabes cómo hacerme reír, incluso en los días difíciles.",
    "Por tu paciencia infinita y tu forma de escuchar.",
    "Porque eres mi lugar seguro en este mundo caótico.",
    "Por la pasión que pones en todo lo que haces.",
    "Porque contigo el tiempo vuela y cada segundo vale la pena.",
    "Por esos pequeños detalles que solo tú tienes conmigo.",
    "Porque me inspiras a ser una mejor versión de mí mismo cada día.",
    "Por tu inteligencia y la forma en que ves el mundo.",
    "Simplemente, por ser tú, sin filtros ni pretensiones."
];

// Usar datos de data.js si existen (window.razonesData)
const razonesList = (typeof window.razonesData !== 'undefined' && window.razonesData.length > 0) 
    ? window.razonesData 
    : DEFAULT_RAZONES;

let favoritos = []; // Array de índices favoritos
let db = null;

// Inicializar Firebase
function initFirebase() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        db = firebase.firestore();
        cargarFavoritos();
    } else {
        console.warn('Firebase no disponible, los favoritos no se guardarán');
        renderRazones();
    }
}

// Cargar favoritos desde Firestore
async function cargarFavoritos() {
    if (!db) {
        renderRazones();
        return;
    }
    
    try {
        const docRef = db.collection('razones').doc('favoritos');
        const doc = await docRef.get();
        
        if (doc.exists && doc.data().indices) {
            favoritos = doc.data().indices;
        } else {
            favoritos = [];
            await docRef.set({ indices: [] });
        }
    } catch (error) {
        console.error('Error cargando favoritos:', error);
        favoritos = [];
    }
    
    renderRazones();
}

// Guardar favoritos en Firestore
async function guardarFavoritos() {
    if (!db) return;
    
    try {
        const docRef = db.collection('razones').doc('favoritos');
        await docRef.set({ indices: favoritos }, { merge: true });
    } catch (error) {
        console.error('Error guardando favoritos:', error);
        showToast('No se pudieron guardar los favoritos', true);
    }
}

// Alternar favorito
function toggleFavorito(index) {
    if (favoritos.includes(index)) {
        favoritos = favoritos.filter(i => i !== index);
        showToast('❤️ Eliminado de favoritos');
    } else {
        favoritos.push(index);
        showToast('✨ ¡Añadido a favoritos! ✨');
        
        // Lanzar partículas
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

// Renderizar todas las razones
function renderRazones() {
    const grid = document.getElementById('razonesGrid');
    if (!grid) return;
    
    grid.innerHTML = razonesList.map((razon, index) => {
        const esFavorito = favoritos.includes(index);
        return `
            <div class="razon-card" data-index="${index}" style="animation: fadeInUp 0.5s forwards ${index * 0.05}s; opacity: 0;">
                <div class="razon-number">${(index + 1).toString().padStart(2, '0')}</div>
                <div class="razon-content">${escapeHtml(razon)}</div>
                <div class="razon-footer">
                    <button class="fav-btn ${esFavorito ? 'active' : ''}" data-index="${index}">
                        <i data-lucide="heart" ${esFavorito ? 'fill="currentColor"' : ''}></i>
                        <span>${esFavorito ? 'Favorito' : 'Favorito'}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Inicializar iconos Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Añadir event listeners a los botones de favorito
    document.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            toggleFavorito(index);
        });
    });
    
    // Añadir evento de clic a las tarjetas (animación de pulsación)
    document.querySelectorAll('.razon-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.fav-btn')) return;
            
            if (typeof pulseElement === 'function') {
                pulseElement(card);
            }
            
            // Opcional: mostrar la razón en un toast o algo similar
            const index = parseInt(card.dataset.index);
            showToast(`💭 ${razonesList[index].substring(0, 60)}...`, false, 2000);
        });
    });
}

// Mostrar razón aleatoria en modal
function mostrarRazonAleatoria() {
    const randomIndex = Math.floor(Math.random() * razonesList.length);
    const randomText = razonesList[randomIndex];
    const modal = document.getElementById('randomModal');
    const textEl = document.getElementById('randomText');
    
    if (textEl) textEl.textContent = randomText;
    if (modal) modal.style.display = 'flex';
    
    // Lanzar partículas
    if (typeof launchParticles === 'function') {
        const btn = document.getElementById('randomBtn');
        launchParticles({
            amount: 16,
            symbols: ['❤', '✦', '✧', '✨'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1', '#ffd966'],
            spread: 130,
            source: btn
        });
    }
}

// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('randomModal');
    if (modal) modal.style.display = 'none';
}

// Mostrar toast (notificación)
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

// Inicializar todo
function initRazones() {
    // Configurar eventos del modal
    const randomBtn = document.getElementById('randomBtn');
    const closeModal = document.getElementById('closeModal');
    const modal = document.getElementById('randomModal');
    
    if (randomBtn) {
        randomBtn.addEventListener('click', mostrarRazonAleatoria);
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', cerrarModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModal();
        });
    }
    
    // Escapar con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            cerrarModal();
        }
    });
    
    // Inicializar Firebase y cargar datos
    initFirebase();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRazones);
} else {
    initRazones();
}

// Exportar funciones globales (por si se necesitan desde consola o eventos inline)
window.toggleFavorito = toggleFavorito;
window.mostrarRazonAleatoria = mostrarRazonAleatoria;
window.cerrarModal = cerrarModal;