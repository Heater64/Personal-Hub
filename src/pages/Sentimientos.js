/**
 * Sentimientos Page — Hub de emociones
 */
(function() {
  const page = {
    name: 'sentimientos',
    
    mount(container) {
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <div class="sentiment-hub">
          <div class="sentiment-header">
            <h1>Sentimientos</h1>
            <p>Un espacio solo para ti, donde guardo las cosas más bonitas que siento.</p>
          </div>

          <div class="cards-sentiment">
            <a class="card-sentiment" href="#razones" data-nav="razones">
              <div class="card-badge"></div>
              <div class="card-icon"><i data-lucide="sparkles"></i></div>
              <h3 class="card-title">Razones</h3>
              <p class="card-description">Algunas razones por las que te quiero, con favoritos y sorpresas.</p>
              <div class="card-meta">
                <i data-lucide="heart"></i>
                <span>Razones</span>
                <div class="meta-divider"></div>
                <i data-lucide="star"></i>
                <span>Favoritos</span>
              </div>
            </a>

            <a class="card-sentiment" href="#openwhen" data-nav="openwhen">
              <div class="card-badge"></div>
              <div class="card-icon"><i data-lucide="mail"></i></div>
              <h3 class="card-title">Open When</h3>
              <p class="card-description">Cartas para abrir según el momento que estás viviendo.</p>
              <div class="card-meta">
                <i data-lucide="mail-open"></i>
                <span>Cartas</span>
                <div class="meta-divider"></div>
                <i data-lucide="clock"></i>
                <span>Cada ocasión</span>
              </div>
            </a>

            <a class="card-sentiment" href="#calendario" data-nav="calendario">
              <div class="card-badge"></div>
              <div class="card-icon"><i data-lucide="calendar-days"></i></div>
              <h3 class="card-title">Calendario</h3>
              <p class="card-description">31 días, 31 sorpresas. Toca, escucha y siente cada experiencia.</p>
              <div class="card-meta">
                <i data-lucide="gift"></i>
                <span>Sorpresas</span>
                <div class="meta-divider"></div>
                <i data-lucide="lock"></i>
                <span>Desbloqueo</span>
              </div>
            </a>

            <a class="card-sentiment" href="#maldia" data-nav="maldia">
              <div class="card-badge"></div>
              <div class="card-icon"><i data-lucide="sun-medium"></i></div>
              <h3 class="card-title">Mal Día</h3>
              <p class="card-description">Frases con cariño, música y más para cuando lo necesites.</p>
              <div class="card-meta">
                <i data-lucide="heart-handshake"></i>
                <span>Emergencia</span>
                <div class="meta-divider"></div>
                <i data-lucide="music"></i>
                <span>Música</span>
              </div>
            </a>
          </div>
        </div>
      `;
    },

    afterMount(container) {
      container.querySelectorAll('.card-sentiment[data-nav]').forEach(card => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = card.dataset.nav;
        });
      });
    }
  };

  if (window.AppRouter) {
    AppRouter.register('sentimientos', () => page);
  }
})();
