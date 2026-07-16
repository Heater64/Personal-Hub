// js/pages/juegos.js

const STORAGE_KEY = 'personalHub.giftProgress';

const GAMES = [
    { id: 'memoria', title: 'Memoria', desc: 'Encuentra todas las parejas', file: '../games/memoria.html', giftId: 'juego_memoria', day: 6, emoji: '🧠' },
    { id: 'ahorcado', title: 'Ahorcado', desc: 'Adivina la palabra secreta', file: '../games/ahorcado.html', giftId: 'juego_ahorcado', day: 8, emoji: '💀' },
    { id: 'tiroarco', title: 'Tiro con Arco', desc: 'Ajusta ángulo y potencia', file: '../games/tiroarco.html', giftId: 'juego_tiroarco', day: 9, emoji: '🏹' },
    { id: 'snake', title: 'Snake', desc: 'Come la comida y no choques', file: '../games/snake.html', giftId: 'juego_snake', day: 10, emoji: '🐍' },
    { id: 'buscaminas', title: 'Buscaminas', desc: 'Encuentra las minas sin pisarlas', file: '../games/buscaminas.html', giftId: 'juego_buscaminas', day: 11, emoji: '💣' },
    { id: 'laberinto', title: 'Laberinto', desc: 'Encuentra la salida', file: '../games/laberinto.html', giftId: 'juego_laberinto', day: 12, emoji: '🏃' },
    { id: 'meteoritos', title: 'Evita los Meteoritos', desc: 'Esquiva los meteoritos', file: '../games/meteoritos.html', giftId: 'juego_meteoritos', day: 13, emoji: '🌌' },
    { id: 'cuchillos', title: 'Lanza Cuchillos', desc: 'Acierta en el blanco', file: '../games/cuchillos.html', giftId: 'juego_cuchillos', day: 14, emoji: '🎯' },
    { id: 'torre', title: 'Equilibra la Torre', desc: 'Construye la torre más alta', file: '../games/torre.html', giftId: 'juego_torre', day: 15, emoji: '⚖️' },
    { id: 'breakout', title: 'Breakout', desc: 'Destruye todos los bloques', file: '../games/breakout.html', giftId: 'juego_breakout', day: 16, emoji: '🧊' },
    { id: 'agujero-negro', title: 'Agujero Negro', desc: 'Absorbe objetos y crece', file: '../games/agujero-negro.html', giftId: 'juego_agujero_negro', day: 21, emoji: '🕳️' },
];

function getProgressMap() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function isGameUnlocked(game) {
    const progress = getProgressMap();
    const entry = progress[game.giftId];
    return entry && entry.opened === true;
}

function getCoverPath(gameId) {
    return `../assets/games/${gameId}.jpg`;
}

function renderGames() {
    const container = document.getElementById('juegosGrid');
    if (!container) return;

    const unlocked = GAMES.filter(isGameUnlocked);

    if (unlocked.length === 0) {
        container.innerHTML = `<p class="juegos-empty">Aún no has desbloqueado ningún juego. ¡Abre las casillas del <a href="calendario.html">calendario</a> para descubrirlos!</p>`;
        return;
    }

    container.innerHTML = unlocked.map((game, index) => {
        const coverPath = getCoverPath(game.id);
        const dayLabel = `Día ${game.day}`;

        return `
            <a class="juego-card"
               href="${game.file}"
               data-index="${index}">

                <div class="juego-card__cover">
                    <img src="${coverPath}"
                         alt="${game.title}"
                         loading="lazy"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="juego-card__cover-placeholder" style="display:none;">
                        ${game.emoji}
                    </div>
                    <div class="juego-card__day">${dayLabel}</div>
                </div>

                <div class="juego-card__body">
                    <h3 class="juego-card__title">${game.emoji} ${game.title}</h3>
                    <p class="juego-card__desc">${game.desc}</p>
                </div>
            </a>
        `;
    }).join('');
}

function boot() {
    renderGames();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
