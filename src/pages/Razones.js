/**
 * Razones Page — Reasons why I love you
 */
(function() {
  const FAV_KEY = 'personalHub.razonesFavoritas';

  const RAZONES = [
    'Por lo lista, lo hermosa y lo increíble que eres.',
    'Por todo lo que me has enseñado y lo que me sigues enseñando cada día.',
    'Por toda la paciencia que tienes conmigo.',
    'Por lo mucho que me cuidas y te preocupas por mí.',
    'Por lo cariñosa que eres en cada momento.',
    'Por lo divertida y graciosa que eres.',
    'Por cómo me miras, como si fuera lo más especial del mundo.',
    'Porque contigo cualquier plan es el mejor plan.',
    'Por cómo haces que los días grises se vuelvan coloridos.',
    'Por tu forma de ser, única e irrepetible.',
    'No son las únicas razones pero así te obligaré a entrar de vez en cuando para ver las nuevas jsjsj 👑🤍',
  ];

  let favoritos = [];

  function loadFavs() {
    try { favoritos = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { favoritos = []; }
  }

  function saveFavs() {
    localStorage.setItem(FAV_KEY, JSON.stringify(favoritos));
  }

  const page = {
    name: 'razones',

    mount(container) {
      loadFavs();
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <section class="page-section">
          <div class="razones-header">
            <h1>Razones por las que te quiero</h1>
            <p>Un pequeño recordatorio de todo lo que te hace especial para mí.</p>
          </div>
          <div class="razones-grid" id="razonesGrid">
            ${RAZONES.map((r, i) => {
              const esFav = favoritos.includes(i);
              return `
                <div class="razon-card" data-index="${i}" style="animation: fadeInUp 0.5s forwards ${i * 0.05}s; opacity: 0;">
                  <div class="razon-number">${String(i+1).padStart(2,'0')}</div>
                  <div class="razon-content">${Utils.escapeHtml(r)}</div>
                  <div class="razon-footer">
                    <button class="fav-btn ${esFav ? 'active' : ''}" data-index="${i}">
                      <i data-lucide="heart" ${esFav ? 'fill="currentColor"' : ''}></i>
                      <span>Favorito</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <button class="random-trigger" id="randomBtn" title="Razón aleatoria">
          <i data-lucide="shuffle"></i>
        </button>

        <div class="modal" id="randomModal" style="display:none;">
          <div class="modal-content glass">
            <button class="close-modal" id="closeModalBtn">&times;</button>
            <div class="modal-icon"><i data-lucide="heart"></i></div>
            <h3>Una razón especial</h3>
            <p id="randomText" class="modal-text"></p>
          </div>
        </div>
      `;
    },

    afterMount(container) {
      // Fav buttons
      container.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          if (favoritos.includes(idx)) {
            favoritos = favoritos.filter(i => i !== idx);
            Utils.showToast('Eliminado de favoritos');
          } else {
            favoritos.push(idx);
            Utils.showToast('Añadido a favoritos');
            Utils.pulseElement(btn);
          }
          saveFavs();
          // Re-render
          const grid = document.getElementById('razonesGrid');
          if (grid) {
            grid.innerHTML = RAZONES.map((r, i) => {
              const esFav = favoritos.includes(i);
              return `
                <div class="razon-card" data-index="${i}" style="animation: fadeInUp 0.5s forwards ${i * 0.05}s; opacity: 0;">
                  <div class="razon-number">${String(i+1).padStart(2,'0')}</div>
                  <div class="razon-content">${Utils.escapeHtml(r)}</div>
                  <div class="razon-footer">
                    <button class="fav-btn ${esFav ? 'active' : ''}" data-index="${i}">
                      <i data-lucide="heart" ${esFav ? 'fill="currentColor"' : ''}></i>
                      <span>Favorito</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('');
            this.afterMount(container);
          }
        });
      });

      // Random button
      document.getElementById('randomBtn')?.addEventListener('click', () => {
        const idx = Math.floor(Math.random() * RAZONES.length);
        document.getElementById('randomText').textContent = RAZONES[idx];
        document.getElementById('randomModal').style.display = 'flex';
      });

      // Close modal
      document.getElementById('closeModalBtn')?.addEventListener('click', () => {
        document.getElementById('randomModal').style.display = 'none';
      });
      document.getElementById('randomModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('randomModal')) {
          document.getElementById('randomModal').style.display = 'none';
        }
      });
    }
  };

  if (window.AppRouter) {
    AppRouter.register('razones', () => page);
  }
})();
