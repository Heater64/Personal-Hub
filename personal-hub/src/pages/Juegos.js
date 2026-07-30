/* ==========================================
   Personal Hub v2 — Juegos Page
   Hub de juegos con tarjetas para cada juego
   ========================================== */

const GAMES = [
  { id: 'memoria', icon: 'brain', title: 'Memoria', desc: 'Encuentra todas las parejas de cartas.', href: '/games/memoria.html' },
  { id: 'ahorcado', icon: 'skull', title: 'Ahorcado', desc: 'Adivina la palabra antes de que sea demasiado tarde.', href: '/games/ahorcado.html' },
  { id: 'snake', icon: 'snake', title: 'Snake', desc: 'Clásico juego de la serpiente. ¡No te choques!', href: '/games/snake.html' },
  { id: 'buscaminas', icon: 'landmine', title: 'Buscaminas', desc: 'Descubre las minas sin explotar.', href: '/games/buscaminas.html' },
  { id: 'breakout', icon: 'rectangle-horizontal', title: 'Breakout', desc: 'Rompe todos los ladrillos con la pelota.', href: '/games/breakout.html' },
  { id: 'laberinto', icon: 'git-branch', title: 'Laberinto', desc: 'Encuentra la salida del laberinto.', href: '/games/laberinto.html' },
  { id: 'meteoritos', icon: 'asteroid', title: 'Meteoritos', desc: 'Esquiva los meteoritos en el espacio.', href: '/games/meteoritos.html' },
  { id: 'cuchillos', icon: 'knife', title: 'Cuchillos', desc: 'Lanza cuchillos con precisión.', href: '/games/cuchillos.html' },
  { id: 'agujero-negro', icon: 'circle', title: 'Agujero Negro', desc: 'No dejes que te trague el agujero negro.', href: '/games/agujero-negro.html' },
  { id: 'tiroarco', icon: 'target', title: 'Tiro al Arco', desc: 'Apunta y dispara al centro de la diana.', href: '/games/tiroarco.html' },
  { id: 'torre', icon: 'building', title: 'Torre', desc: 'Construye la torre más alta posible.', href: '/games/torre.html' }
];

const ICONS = {
  'brain': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2.1-1 2.8l.2 3.2a3 3 0 0 1-3 3h-.4a3 3 0 0 1-3-3l.2-3.2A4 4 0 0 1 8 6a4 4 0 0 1 4-4z"/><path d="M12 12v10"/><path d="M8 16a4 4 0 0 1-4-4c0-1.1.4-2.1 1-2.8"/><path d="M16 16a4 4 0 0 0 4-4c0-1.1-.4-2.1-1-2.8"/></svg>',
  'skull': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v-1a4 4 0 0 1 4-4 4 4 0 0 1 4 4v1"/><path d="M12 2C8 2 4 5 4 10c0 3.5 2 5.5 3 7l1 3h8l1-3c1-1.5 3-3.5 3-7 0-5-4-8-8-8z"/></svg>',
  'snake': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
  'landmine': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="16" r="4"/><path d="M12 2v6"/><path d="M12 8a4 4 0 0 1 4 4"/><path d="M5 12a2 2 0 0 1 2-2"/><path d="M17 12a2 2 0 0 0-2-2"/></svg>',
  'rectangle-horizontal': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  'git-branch': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  'asteroid': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/><path d="M8 16c1.5 1 3 1.5 5 1 2-.5 3-2 3.5-3"/></svg>',
  'knife': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 21 7-7"/><path d="M12 10 8 6l4-4 6 6-4 4 2 2 4-4 2 2-6 6-2-2 4-4-2-2-4 4-2-2 4-4z"/></svg>',
  'circle': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  'target': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  'building': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="8"/><line x1="15" y1="6" x2="15" y2="8"/><line x1="9" y1="10" x2="9" y2="12"/><line x1="15" y1="10" x2="15" y2="12"/><line x1="9" y1="14" x2="9" y2="16"/><line x1="15" y1="14" x2="15" y2="16"/><line x1="6" y1="20" x2="18" y2="22"/></svg>',
  'chevron-right': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
};

export function JuegosPage(router) {
  const page = document.createElement('div');
  page.className = 'juegos-page';

  page.innerHTML = `
    <!-- Header -->
    <div class="juegos-header glass-card">
      <div class="juegos-header-content">
        <h2>Juegos</h2>
        <p class="text-muted">Todos los juegos del calendario y más, en un solo lugar.</p>
      </div>
    </div>

    <!-- Game grid -->
    <div class="juegos-grid">
      ${GAMES.map(game => `
        <button class="card juego-card glass-card" data-href="${game.href}">
          <div class="juego-card-icon">${ICONS[game.icon] || ''}</div>
          <div class="juego-card-body">
            <h3 class="juego-card-title">${game.title}</h3>
            <p class="juego-card-desc">${game.desc}</p>
          </div>
          <span class="juego-play-hint">Jugar</span>
        </button>
      `).join('')}
    </div>

    <!-- Footer -->
    <footer class="juegos-footer">
      <p>Los juegos se desbloquean en el calendario 🎮</p>
    </footer>
  `;

  // Bind game card clicks — open in new tab (standalone HTML files)
  page.querySelectorAll('.juego-card').forEach(card => {
    card.addEventListener('click', () => {
      const href = card.dataset.href;
      if (href) {
        window.open(href, '_blank');
      }
    });
  });

  return page;
}
