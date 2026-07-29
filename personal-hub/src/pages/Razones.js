/* ==========================================
   Personal Hub v2 — Razones Page
   Grid de tarjetas con razones, favoritos, razón aleatoria
   ========================================== */

import { showToast } from '../components/Toast.js';

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
  'No son las únicas razones pero así te obligaré a entrar de vez en cuando para ver las nuevas jsjsj',
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}

function saveFavs(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

export function RazonesPage(router) {
  const page = document.createElement('div');
  page.className = 'razones-page';

  let favoritos = loadFavs();

  function renderGrid() {
    const grid = document.getElementById('razonesGrid');
    if (!grid) return;
    grid.innerHTML = RAZONES.map((r, i) => {
      const esFav = favoritos.includes(i);
      return `
        <div class="razon-card" data-index="${i}" style="animation-delay: ${i * 0.05}s">
          <div class="razon-number">${String(i + 1).padStart(2, '0')}</div>
          <div class="razon-content">${escapeHtml(r)}</div>
          <div class="razon-footer">
            <button type="button" class="fav-btn ${esFav ? 'active' : ''}" data-index="${i}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${esFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>Favorito</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind fav buttons
    grid.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (favoritos.includes(idx)) {
          favoritos = favoritos.filter(i => i !== idx);
          showToast('Eliminado de favoritos', 'info');
        } else {
          favoritos.push(idx);
          showToast('Añadido a favoritos', 'info');
        }
        saveFavs(favoritos);
        renderGrid();
      });
    });
  }

  let _escapeHandler = null;

  function openRandomModal() {
    const idx = Math.floor(Math.random() * RAZONES.length);
    document.getElementById('randomText').textContent = RAZONES[idx];
    document.getElementById('randomModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (!_escapeHandler) {
      _escapeHandler = (e) => { if (e.key === 'Escape') closeRandomModal(); };
      document.addEventListener('keydown', _escapeHandler);
    }
  }

  function closeRandomModal() {
    document.getElementById('randomModal').style.display = 'none';
    document.body.style.overflow = '';
    if (_escapeHandler) {
      document.removeEventListener('keydown', _escapeHandler);
      _escapeHandler = null;
    }
  }

  // Render page
  page.innerHTML = `
    <div class="razones-header">
      <h1>Razones por las que te quiero</h1>
      <p>Un pequeño recordatorio de todo lo que te hace especial para mí.</p>
    </div>

    <div class="razones-grid" id="razonesGrid"></div>

    <!-- FAB: Razón aleatoria -->
    <button type="button" class="razones-fab" id="randomFab" title="Razón aleatoria">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
    </button>

    <!-- Modal -->
    <div class="razones-modal" id="randomModal" style="display:none">
      <div class="razones-modal-content">
        <button type="button" class="razones-modal-close" id="closeModalBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="razones-modal-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <h3>Una razón especial</h3>
        <p class="razones-modal-text" id="randomText"></p>
        <button type="button" class="razones-modal-btn" id="anotherReasonBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg> Otra razón</button>
      </div>
    </div>
  `;

  // Render grid after DOM insertion
  requestAnimationFrame(() => {
    renderGrid();

    // Random FAB
    document.getElementById('randomFab').addEventListener('click', openRandomModal);

    // Modal close
    document.getElementById('closeModalBtn').addEventListener('click', closeRandomModal);
    document.getElementById('randomModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('randomModal')) closeRandomModal();
    });

    // Another reason button
    document.getElementById('anotherReasonBtn').addEventListener('click', () => {
      const idx = Math.floor(Math.random() * RAZONES.length);
      const textEl = document.getElementById('randomText');
      textEl.textContent = RAZONES[idx];
      // Re-trigger animation
      textEl.style.animation = 'none';
      requestAnimationFrame(() => {
        textEl.style.animation = 'razonesFadeInUp 0.4s ease forwards';
      });
    });

  });

  return page;
}
