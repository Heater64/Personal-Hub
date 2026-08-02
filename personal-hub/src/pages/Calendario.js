/* ==========================================
   Personal Hub v2 — Calendario Page
   Calendario de experiencias con regalos
   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey } from '../utils/userStorage.js';

// Nota: en producción, copia data/gifts.json a personal-hub/public/data/gifts.json
// Para desarrollo con Vite, usa este path:
const GIFTS_PATH = '/data/gifts.json';
const PROGRESS_KEY = () => userPrefKey('giftProgress');

let catalog = null;
let currentMonthKey = null;
let progressMap = {};

function loadProgress() {
  try { progressMap = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}'); } catch { progressMap = {}; }
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY(), JSON.stringify(progressMap));
}

async function loadGifts() {
  try {
    const res = await fetch(GIFTS_PATH, { cache: 'no-cache' });
    const data = await res.json();
    catalog = data;
    catalog.giftsById = {};
    (catalog.gifts || []).forEach(g => { if (g.id) catalog.giftsById[g.id] = g; });
    return catalog;
  } catch {
    showToast('Error cargando calendario', 'error');
    return null;
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function isUnlocked(gift) {
  if (!gift || !gift.unlock) return false;
  if (gift.unlock.mode === 'date') {
    return getTodayStr() >= (gift.unlock.value || '');
  }
  return false;
}

function getDayState(day, giftId) {
  const gift = catalog?.giftsById?.[giftId];
  if (!gift) return 'empty';
  const prog = progressMap[giftId];
  if (prog?.opened) return 'opened';
  if (isUnlocked(gift)) return 'available';
  return 'locked';
}

const typeIconMap = {
  letter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  cassette: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  giftBox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  polaroid: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  clickStar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  game: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>',
  surprise: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  video: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  quiz: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  wishlist: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
};

function getTypeLabel(type) {
  const names = { letter: 'Carta', cassette: 'Música', giftBox: 'Regalo', polaroid: 'Foto', clickStar: 'Estrella', game: 'Juego', surprise: 'Sorpresa', video: 'Video', quiz: 'Quiz', wishlist: 'Lista' };
  return names[type] || type;
}

export function CalendarioPage(router) {
  const page = document.createElement('div');
  page.className = 'calendario-page';

  page.innerHTML = `
    <div class="calendario-intro" style="text-align:center;padding:60px 20px;">
      <div style="font-size:2rem;margin-bottom:12px;animation:pulse 1.5s ease infinite;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <p class="text-muted">Cargando calendario...</p>
    </div>
  `;

  loadProgress();
  loadGifts().then(() => {
    renderCalendar();
  });

  function renderCalendar() {
    const months = catalog?.months ? Object.keys(catalog.months) : [];
    const defaultMonth = months[0] || '2026-07';
    currentMonthKey = defaultMonth;
    const monthData = catalog?.months?.[defaultMonth];
    const mapping = monthData?.calendarMapping || {};
    const [y, m] = defaultMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    let gridHTML = '';
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day);
      const giftId = mapping[dayStr];
      const gift = catalog?.giftsById?.[giftId];
      const state = getDayState(day, giftId);
      const isLocked = state === 'locked';
      const isOpened = state === 'opened';
      const isAvailable = state === 'available';
      const isEmpty = state === 'empty';
      const typeLabel = gift?.type || '';

      gridHTML += `
        <button class="day-card ${isOpened ? 'opened' : ''} ${isAvailable ? 'available' : ''} ${isLocked || isEmpty ? 'locked' : ''}" 
                data-day="${day}" data-gift-id="${giftId || ''}" ${isLocked || isEmpty ? 'disabled' : ''}>
          <span class="day-number">${day}</span>
          ${gift?.title && !isLocked ? `<div class="day-gift-name">${escapeHtml(gift.title.substring(0, 18))}</div>` : ''}
          ${!isLocked && typeLabel ? `<span class="day-type-badge">${typeIconMap[typeLabel] || ''} ${getTypeLabel(typeLabel)}</span>` : ''}
          <span class="day-status">${isOpened ? '♥' : isAvailable ? '✦' : isEmpty ? '·' : ''}</span>
        </button>
      `;
    }

    page.innerHTML = `
      <div class="calendario-content">
        <div class="calendario-header">
          <h2>Calendario de experiencias</h2>
          <p>31 días, 31 sorpresas distintas. Toca, escucha, juega y siente.</p>
          ${months.length > 1 ? `
            <div class="month-selector">
              ${months.map(m => `
                <button class="month-btn ${m === currentMonthKey ? 'active' : ''}" data-month="${m}">
                  ${catalog.months[m]?.label || m}
                </button>
              `).join('')}
            </div>
          ` : ''}
          <div class="month-title">${monthData?.label || defaultMonth}</div>
        </div>
        <div class="calendar-grid">${gridHTML}</div>
      </div>

      <!-- Experience Modal -->
      <div class="experience-layer" id="experienceLayer" style="display:none;">
        <div class="experience-modal">
          <button class="experience-modal-close" id="closeExpModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3 class="experience-modal-title" id="expTitle">Sorpresa</h3>
          <div class="experience-modal-body" id="expBody"></div>
          <div class="experience-modal-footer">
            <button class="btn-primary" id="expCloseBtn">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Month selector
    page.querySelectorAll('.month-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMonthKey = btn.dataset.month;
        renderCalendar();
      });
    });

    // Day card click
    page.querySelectorAll('.day-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        if (card.disabled) return;
        const day = card.dataset.day;
        const giftId = card.dataset.giftId;
        if (!giftId || !catalog?.giftsById?.[giftId]) {
          showToast('Este día no tiene sorpresa', 'info');
          return;
        }
        openGift(giftId, day);
      });
    });

    // Locked day click
    page.querySelectorAll('.day-card.locked').forEach(card => {
      card.addEventListener('click', () => {
        const giftId = card.dataset.giftId;
        if (giftId && catalog?.giftsById?.[giftId]) {
          showToast('Aún no disponible', 'info');
        } else {
          showToast('Este día no tiene sorpresa', 'info');
        }
      });
    });
  }

  function openGift(giftId) {
    const gift = catalog?.giftsById?.[giftId];
    if (!gift) return;

    // Mark as opened
    if (!progressMap[giftId]?.opened) {
      progressMap[giftId] = { opened: true, openedAt: new Date().toISOString() };
      saveProgress();
    }

    // If it's a redirect game, go to the game
    if (gift.redirect && gift.redirectUrl) {
      window.open(gift.redirectUrl.startsWith('/') ? gift.redirectUrl : `../${gift.redirectUrl}`, '_blank');
      renderCalendar();
      return;
    }

    // Show experience modal
    const modal = page.querySelector('#experienceLayer');
    const title = modal.querySelector('#expTitle');
    const body = modal.querySelector('#expBody');

    title.textContent = gift.title || 'Sorpresa';
    body.innerHTML = '';

    const data = gift.data || {};
    const esc = escapeHtml;

    switch (gift.type) {
      case 'letter':
        body.innerHTML = `
          <div class="exp-letter">
            <div class="exp-letter-content">${esc(data.content || 'Mensaje vacío').replace(/\n/g, '<br>')}</div>
          </div>`;
        break;
      case 'cassette':
        body.innerHTML = `
          <div class="exp-cassette">
            <div class="exp-media-info">
              <div class="exp-media-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div><strong>${esc(data.message || 'Música')}</strong></div>
            </div>
            <div class="exp-audio-wrapper">
              ${data.audioUrl ? `<audio controls preload="metadata" style="width:100%"><source src="${esc(data.audioUrl)}" type="audio/mpeg"></audio>` : '<p class="text-muted">No hay audio disponible aún</p>'}
            </div>
          </div>`;
        break;
      case 'giftBox':
        body.innerHTML = `
          <div class="exp-gift" style="text-align:center">
            ${data.image ? `<img src="${esc(data.image)}" alt="Regalo" class="exp-gift-img">` : ''}
            <p>${esc(data.message || 'Regalo')}</p>
          </div>`;
        break;
      case 'video':
        body.innerHTML = `
          <div class="exp-video">
            ${data.videoUrl ? `<video controls playsinline style="width:100%;border-radius:12px" poster="${esc(data.poster || '')}"><source src="${esc(data.videoUrl)}" type="video/mp4"></video>` : '<p class="text-muted">Video no disponible</p>'}
            ${data.caption ? `<p class="text-muted" style="margin-top:8px;font-style:italic;">${esc(data.caption)}</p>` : ''}
          </div>`;
        break;
      case 'surprise':
        body.innerHTML = `<div class="exp-surprise"><p>${esc(data.message || '¡Sorpresa!')}</p></div>`;
        break;
      case 'wishlist':
        const items = data.items || [];
        body.innerHTML = `
          <div class="exp-wishlist">
            <h4>Lista de deseos</h4>
            <ul>${items.map((item, i) => `<li><span class="wishlist-num">${i + 1}.</span> ${esc(item)}</li>`).join('')}</ul>
          </div>`;
        break;
      case 'clickStar':
        body.innerHTML = `
          <div class="exp-surprise" style="text-align:center">
            <div style="font-size:4rem;margin-bottom:16px;cursor:pointer;transition:transform 0.2s" 
                 onclick="this.style.transform='scale(1.3)';setTimeout(()=>this.style.transform='scale(1)',200)">
              ⭐
            </div>
            <p>${esc(data.message || 'Toca la estrella ✧')}</p>
          </div>`;
        break;
      case 'polaroid':
        body.innerHTML = `
          <div class="exp-gift" style="text-align:center">
            ${data.image ? `<div style="background:#fff;padding:12px 12px 36px;border-radius:4px;box-shadow:0 8px 24px rgba(0,0,0,0.3);display:inline-block;max-width:100%;transform:rotate(-2deg);"><img src="${esc(data.image)}" alt="Foto" style="max-width:100%;max-height:50vh;border-radius:2px;display:block;"></div>` : `<div style="font-size:4rem;margin-bottom:12px;">📸</div>`}
            <p style="margin-top:12px;font-style:italic;">${esc(data.caption || data.message || 'Un momento especial')}</p>
          </div>`;
        break;
      case 'game':
        body.innerHTML = `
          <div class="exp-game" style="text-align:center;padding:20px 0;">
            <div style="font-size:4rem;margin-bottom:16px;">🎮</div>
            <p>${esc(data.message || '¡A jugar!')}</p>
            ${data.redirectUrl ? `<a href="${esc(data.redirectUrl)}" target="_blank" class="btn-primary" style="display:inline-flex;margin-top:16px;text-decoration:none;">Jugar ahora</a>` : ''}
          </div>`;
        break;
      case 'quiz':
        const questions = data.questions || [];
        let quizHTML = `<div class="exp-quiz" style="text-align:left;max-width:400px;margin:0 auto;">
          <div style="text-align:center;font-size:2rem;margin-bottom:12px;">❓</div>
          ${questions.length > 0 ? questions.map((q, qi) => `
            <div style="margin-bottom:16px;padding:14px;border-radius:12px;background:var(--theme-bg-card);">
              <p style="margin:0 0 8px;font-weight:500;">${esc(q.q || q.question || 'Pregunta ' + (qi + 1))}</p>
              ${(q.options || q.answers || []).map(o => `<div style="padding:6px 12px;margin:4px 0;border-radius:8px;border:var(--theme-border-subtle);font-size:0.85rem;">${esc(o)}</div>`).join('')}
            </div>
          `).join('') : `<p style="text-align:center;color:var(--theme-text-muted);">${esc(data.message || 'Quiz interactivo')}</p>`}
        </div>`;
        body.innerHTML = quizHTML;
        break;
      default:
        body.innerHTML = `<div class="exp-default"><p>${esc(gift.title || 'Sorpresa')}</p><p class="text-muted">${esc(data.message || 'Disfruta de este regalo.')}</p></div>`;
    }

    modal.style.display = 'flex';

    const closeModal = () => {
      modal.style.display = 'none';
      body.innerHTML = '';
      renderCalendar(); // Re-render to show opened state
    };

    modal.querySelector('#closeExpModal').onclick = closeModal;
    modal.querySelector('#expCloseBtn').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  }

  return page;
}
