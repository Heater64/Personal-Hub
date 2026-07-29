/**
 * Juegos Page — Games hub from calendar unlocks
 */
(function() {
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
    try { return JSON.parse(localStorage.getItem('personalHub.giftProgress') || '{}'); } catch { return {}; }
  }

  function isUnlocked(giftId) {
    const p = getProgressMap();
    return p[giftId]?.opened === true;
  }

  const page = {
    name: 'juegos',

    mount(container) {
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      const unlocked = GAMES.filter(g => isUnlocked(g.giftId));

      if (unlocked.length === 0) {
        return `
          <div class="juegos-page" style="padding-top:18px;">
            <div class="juegos-intro">
              <h2>🎮 Tus Juegos 🎮</h2>
              <p>Los juegos se desbloquean al abrirlos en el calendario.<br>¡Cada día una sorpresa nueva!</p>
            </div>
            <p style="text-align:center;padding:60px 20px;color:var(--umbra-ash);">
              Aún no has desbloqueado ningún juego. ¡Abre las casillas del 
              <a href="#calendario" style="color:var(--accent-coral);">calendario</a> para descubrirlos!
            </p>
          </div>
        `;
      }

      return `
        <div class="juegos-page" style="padding-top:18px;">
          <div class="juegos-intro">
            <h2>🎮 Tus Juegos 🎮</h2>
            <p>¡Tus juegos desbloqueados del calendario!</p>
          </div>
          <div class="juegos-grid">
            ${unlocked.map((g, i) => `
              <a class="juego-card" href="${g.file}" style="animation-delay:${i * 0.03}s;">
                <div class="juego-card__cover">
                  <div class="juego-card__cover-placeholder">${g.emoji}</div>
                  <div class="juego-card__day">Día ${g.day}</div>
                </div>
                <div class="juego-card__body">
                  <h3 class="juego-card__title">${g.emoji} ${g.title}</h3>
                  <p class="juego-card__desc">${g.desc}</p>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    },

    afterMount(container) {
      // No additional setup needed beyond render
    }
  };

  if (window.AppRouter) {
    AppRouter.register('juegos', () => page);
  }
})();
