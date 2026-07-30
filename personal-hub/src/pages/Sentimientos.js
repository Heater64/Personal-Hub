/* ==========================================
   Personal Hub v2 — Sentimientos Page
   Hub de emociones con tarjetas de navegación
   ========================================== */

const CARDS = [
  {
    id: 'razones',
    icon: 'sparkles',
    title: 'Razones',
    desc: 'Algunas razones por las que te quiero, con favoritos y sorpresas.',
    meta: ['Razones', 'Favoritos'],
    href: '/razones'
  },
  {
    id: 'openwhen',
    icon: 'mail',
    title: 'Open When',
    desc: 'Cartas para abrir según el momento que estás viviendo.',
    meta: ['Cartas', 'Cada ocasión'],
    href: '/openwhen'
  },
  {
    id: 'calendario',
    icon: 'calendar-days',
    title: 'Calendario',
    desc: '31 días, 31 sorpresas. Toca, escucha y siente cada experiencia.',
    meta: ['Sorpresas', 'Desbloqueo'],
    href: '/calendario'
  },
  {
    id: 'maldia',
    icon: 'sun-medium',
    title: 'Mal Día',
    desc: 'Frases con cariño, música y más para cuando lo necesites.',
    meta: ['Emergencia', 'Música'],
    href: '/maldia'
  }
];

const ICON_SVGS = {
  'sparkles': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles-icon lucide-sparkles"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>',
  'mail': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  'calendar-days': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01v.01H8V14Z"/><path d="M12 14h.01v.01H12V14Z"/><path d="M16 14h.01v.01H16V14Z"/><path d="M8 18h.01v.01H8V18Z"/><path d="M12 18h.01v.01H12V18Z"/><path d="M16 18h.01v.01H16V18Z"/></svg>',
  'sun-medium': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 3v1m0 16v1m-9-9H2m20 0h-1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/></svg>'
};

export function SentimientosPage(router) {
  const page = document.createElement('div');
  page.className = 'sentimientos-page';

  page.innerHTML = `
    <div class="sentimientos-header glass-card">
      <h1>Sentimientos</h1>
      <p>Un espacio solo para ti, donde guardo las cosas más bonitas que siento.</p>
    </div>

    <div class="sentimientos-grid">
      ${CARDS.map(card => `
        <button type="button" class="card sentimientos-card glass-card" data-href="${card.href}">
          <div class="sentimientos-card-icon">${ICON_SVGS[card.icon] || ''}</div>
          <h3 class="sentimientos-card-title">${card.title}</h3>
          <p class="sentimientos-card-desc">${card.desc}</p>
          <div class="sentimientos-card-meta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            <span>${card.meta[0]}</span>
            <span class="sentimientos-meta-divider"></span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>${card.meta[1]}</span>
          </div>
        </button>
      `).join('')}
    </div>
  `;

  // Bind card clicks
  page.querySelectorAll('.sentimientos-card').forEach(card => {
    card.addEventListener('click', () => {
      const href = card.dataset.href;
      if (href) router.navigate(href);
    });
  });

  return page;
}
