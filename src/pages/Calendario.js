/**
 * Calendario Page — Gift calendar with unlock by date and interactive experiences
 */
(function() {
  const GIFTS_PATH = '../data/gifts.json';
  const PROGRESS_KEY = 'personalHub.giftProgress';

  let catalog = null;
  let currentMonthKey = null;
  let progressMap = {};

  function loadProgress() {
    try { progressMap = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { progressMap = {}; }
  }

  function saveProgress() {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
  }

  async function loadGifts() {
    try {
      const res = await fetch(GIFTS_PATH, { cache: 'no-cache' });
      const data = await res.json();
      catalog = data;
      // Build giftsById lookup
      catalog.giftsById = {};
      (catalog.gifts || []).forEach(g => { if (g.id) catalog.giftsById[g.id] = g; });
      return catalog;
    } catch (err) {
      Utils.showToast('Error cargando calendario', true);
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

  const page = {
    name: 'calendario',

    async mount(container) {
      // Show loading state immediately
      container.innerHTML = `<div class="calendario-intro" style="text-align:center;padding:60px 20px;">
        <div style="font-size:2rem;margin-bottom:12px;animation:pulse 1.5s ease infinite;">⏳</div>
        <p style="color:var(--umbra-ash);">Cargando calendario...</p>
      </div>`;

      loadProgress();
      await loadGifts();

      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      const months = catalog?.months ? Object.keys(catalog.months) : [];
      const defaultMonth = months[0] || '2026-07';
      currentMonthKey = defaultMonth;
      const monthData = catalog?.months?.[defaultMonth];
      const mapping = monthData?.calendarMapping || {};
      const daysInMonth = monthData ? (() => {
        const [y, m] = defaultMonth.split('-').map(Number);
        return new Date(y, m, 0).getDate();
      })() : 31;

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

        let typeLabel = gift?.type || '';
        let typeIcon = '✨';
        const typeMap = { letter: '✉️', cassette: '🎵', giftBox: '🎁', polaroid: '📷', clickStar: '🎮', game: '🎮', surprise: '🎊', video: '🎬', quiz: '🤔', wishlist: '📝' };
        typeIcon = typeMap[typeLabel] || '✨';

        gridHTML += `
          <button class="day-card ${isOpened ? 'opened' : ''} ${isAvailable ? 'available' : ''} ${isLocked || isEmpty ? 'locked' : ''}" 
                  data-day="${day}" data-gift-id="${giftId || ''}" ${isLocked || isEmpty ? 'disabled' : ''}>
            <span class="day-number">${day}</span>
            ${gift?.title && !isLocked ? `<div class="day-gift-name">${Utils.escapeHtml(gift.title.substring(0, 18))}</div>` : ''}
            ${!isLocked && gift?.type ? `<span class="day-type-badge">${typeIcon} ${typeLabel}</span>` : ''}
            <span class="day-status">${isOpened ? '♥' : isAvailable ? '✨' : isEmpty ? '·' : '🔒'}</span>
          </button>
        `;
      }

      return `
        <div class="calendario-page">
          <div class="calendario-intro">
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
          <div id="calendarGrid" class="calendar-grid">${gridHTML}</div>
        </div>

        <!-- Experience Modal -->
        <div id="experienceLayer" class="experience-layer" style="display:none;">
          <div class="experience-modal-inner">
            <button class="experience-modal-close" id="closeExpModal">&times;</button>
            <h3 class="experience-modal-title" id="expTitle">Sorpresa</h3>
            <div class="experience-modal-body" id="expBody"></div>
            <div class="experience-modal-footer">
              <button class="experience-modal-footer-btn" id="expCloseBtn">Cerrar</button>
            </div>
          </div>
        </div>

        <style>
          .month-selector { display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:16px 0; }
          .month-btn { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:40px;padding:8px 20px;color:var(--umbra-ash);cursor:pointer;font-size:0.8rem;transition:all 0.2s; }
          .month-btn:hover { border-color:rgba(255,255,255,0.2);color:var(--umbra-light); }
          .month-btn.active { background:rgba(198,90,58,0.15);border-color:var(--accent-coral);color:var(--accent-coral); }
          .month-title { font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:500;color:var(--umbra-light);text-align:center;margin:8px 0 4px; }
          .month-title::after { content:' ✧';color:var(--accent-coral);font-size:0.7em;opacity:0.7; }
          .calendar-grid { display:grid;gap:20px;grid-template-columns:repeat(4,1fr); }
          @media (min-width:1200px) { .calendar-grid { grid-template-columns:repeat(5,1fr); } }
          @media (max-width:768px) { .calendar-grid { grid-template-columns:repeat(3,1fr);gap:14px; } }
          @media (max-width:480px) { .calendar-grid { grid-template-columns:repeat(2,1fr);gap:12px; } }
          .day-card { position:relative;aspect-ratio:1/1;padding:20px;border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;transition:all 0.3s cubic-bezier(0.2,0.9,0.4,1.1);gap:2px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06); }
          .day-card.locked { opacity:0.45;cursor:not-allowed;filter:grayscale(0.3); }
          .day-card.available { background:radial-gradient(circle at top right,rgba(76,175,80,0.15),transparent 50%),rgba(255,255,255,0.08);border:2px solid #4caf50;box-shadow:0 0 30px rgba(76,175,80,0.12); }
          .day-card.opened { background:radial-gradient(circle at top right,rgba(198,90,58,0.18),transparent 40%),rgba(255,255,255,0.04);border:2px solid var(--accent-coral); }
          .day-card.opened::after { content:'♥';position:absolute;top:10px;right:12px;color:var(--accent-coral);font-size:1.2rem; }
          .day-number { font-family:'Playfair Display',Georgia,serif;font-size:clamp(2rem,5vw,3.2rem);line-height:1;color:var(--umbra-light);font-weight:500; }
          .day-gift-name { font-size:0.55rem;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.8; }
          .day-type-badge { font-size:0.55rem;background:rgba(255,255,255,0.08);border-radius:20px;padding:2px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90%; }
          .day-status { font-size:0.9rem;margin-top:2px; }
          .experience-layer { position:fixed;inset:0;background:rgba(8,8,10,0.96);backdrop-filter:blur(20px);display:none;align-items:center;justify-content:center;z-index:2100;padding:20px; }
          .experience-modal-inner { position:relative;width:min(560px,96vw);min-height:200px;max-height:90vh;display:flex;flex-direction:column;padding:48px 32px 32px;background:linear-gradient(180deg,rgba(28,28,34,0.99),rgba(12,12,15,0.99));border:1px solid var(--accent-border);border-radius:28px;box-shadow:0 32px 64px rgba(0,0,0,0.55);overflow:hidden; }
          .experience-modal-title { font-family:'Playfair Display',serif;font-size:clamp(1.4rem,4vw,1.8rem);font-weight:500;text-align:center;color:var(--umbra-light);margin:0 0 20px;flex-shrink:0; }
          .experience-modal-body { flex:1;overflow-y:auto;display:flex;justify-content:center;align-items:flex-start;padding:8px 0; }
          .experience-modal-close { position:absolute;top:16px;right:16px;width:40px;height:40px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:var(--umbra-ash);font-size:1.2rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s; }
          .experience-modal-close:hover { background:rgba(198,90,58,0.25);border-color:var(--accent-coral);color:var(--accent-coral);transform:rotate(90deg); }
          .experience-modal-footer { flex-shrink:0;text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);margin-top:16px; }
          .experience-modal-footer-btn { background:transparent;border:1px solid var(--accent-border);border-radius:40px;padding:10px 28px;color:var(--umbra-light);cursor:pointer;transition:all 0.2s; }
          .experience-modal-footer-btn:hover { background:rgba(198,90,58,0.15);border-color:var(--accent-coral); }
          .gift-module { width:100%;max-width:100%;display:flex;justify-content:center; }
          @media (max-width:768px) { .experience-modal-inner { border-radius:16px;padding:40px 20px 24px; } }
        </style>
      `;
    },

    afterMount(container) {
      // Month selector
      container.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const month = btn.dataset.month;
          currentMonthKey = month;
          // Re-render the whole page
          const view = document.getElementById('view');
          if (view) view.innerHTML = this.render();
          this.afterMount(view);
        });
      });

      // Day card click
      container.querySelectorAll('.day-card:not(.locked)').forEach(card => {
        card.addEventListener('click', () => {
          if (card.disabled) return;
          const day = card.dataset.day;
          const giftId = card.dataset.giftId;
          if (!giftId || !catalog?.giftsById?.[giftId]) {
            Utils.showToast('📅 Este día no tiene sorpresa');
            return;
          }
          openGift(giftId, day);
        });
      });

      // Locked day click
      container.querySelectorAll('.day-card.locked').forEach(card => {
        card.addEventListener('click', () => {
          const giftId = card.dataset.giftId;
          if (giftId && catalog?.giftsById?.[giftId]) {
            Utils.showToast('🔒 Aún no disponible');
          } else {
            Utils.showToast('📅 Este día no tiene sorpresa');
          }
        });
      });
    }
  };

  function openGift(giftId, day) {
    const gift = catalog?.giftsById?.[giftId];
    if (!gift) return;

    // Mark as opened
    if (!progressMap[giftId]?.opened) {
      progressMap[giftId] = { opened: true, openedAt: new Date().toISOString() };
      saveProgress();
    }

    // If it's a redirect game, go to the game
    if (gift.redirect && gift.redirectUrl) {
      window.location.href = gift.redirectUrl.startsWith('/') ? gift.redirectUrl : `../${gift.redirectUrl}`;
      return;
    }

    // Show experience modal
    const modal = document.getElementById('experienceLayer');
    const title = document.getElementById('expTitle');
    const body = document.getElementById('expBody');

    title.textContent = gift.title || 'Sorpresa';
    body.innerHTML = '';

    // Render based on type
    const data = gift.data || {};
    switch (gift.type) {
      case 'letter':
        body.innerHTML = `
          <div style="max-width:420px;width:100%;background:#f9e5c0;padding:clamp(20px,5vw,32px);border-radius:12px;color:#2c2c2c;">
            <div style="font-family:'Georgia',serif;font-size:clamp(0.9rem,2vw,1.05rem);line-height:1.8;white-space:pre-wrap;">
              ${Utils.escapeHtml(data.content || 'Mensaje vacío')}
            </div>
          </div>`;
        break;
      case 'cassette':
        body.innerHTML = `
          <div style="width:100%;max-width:420px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div style="width:44px;height:44px;background:linear-gradient(135deg,var(--accent-coral),#b34a2e);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i data-lucide="music" style="color:white;width:22px;height:22px;"></i>
              </div>
              <div style="flex:1;"><div style="color:var(--umbra-light);font-weight:500;">${Utils.escapeHtml(data.message || '🎵')}</div><div style="color:var(--umbra-ash);font-size:0.7rem;">Canción para ti</div></div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border-radius:16px;padding:16px;border:1px solid rgba(255,255,255,0.04);">
              ${data.audioUrl ? `<audio controls preload="metadata" style="width:100%;">
                <source src="${Utils.escapeHtml(data.audioUrl)}" type="audio/mpeg">
              </audio>` : '<p style="text-align:center;color:var(--umbra-ash);">No hay audio disponible aún</p>'}
            </div>
          </div>`;
        break;
      case 'giftBox':
        body.innerHTML = `
          <div style="text-align:center;max-width:400px;">
            ${data.image ? `<img src="${Utils.escapeHtml(data.image)}" alt="Regalo" style="max-width:100%;border-radius:16px;margin-bottom:16px;">` : ''}
            <p style="color:var(--umbra-light);font-size:1.1rem;">${Utils.escapeHtml(data.message || '🎁')}</p>
          </div>`;
        break;
      case 'video':
        body.innerHTML = `
          <div style="max-width:500px;width:100%;">
            ${data.videoUrl ? `<video controls playsinline style="width:100%;border-radius:16px;" poster="${Utils.escapeHtml(data.poster || '')}">
              <source src="${Utils.escapeHtml(data.videoUrl)}" type="video/mp4">
            </video>` : '<p style="text-align:center;color:var(--umbra-ash);">Video no disponible</p>'}
            ${data.caption ? `<p style="color:var(--umbra-ash);text-align:center;margin-top:12px;font-style:italic;">${Utils.escapeHtml(data.caption)}</p>` : ''}
          </div>`;
        break;
      case 'surprise':
        body.innerHTML = `<div style="text-align:center;padding:40px;">
          <div style="font-size:4rem;margin-bottom:20px;">🎊</div>
          <p style="color:var(--umbra-light);font-size:1.2rem;">${Utils.escapeHtml(data.message || '¡Sorpresa!')}</p>
        </div>`;
        break;
      case 'wishlist':
        const items = data.items || [];
        body.innerHTML = `
          <div style="max-width:400px;width:100%;">
            <h4 style="text-align:center;margin-bottom:16px;color:var(--umbra-light);">📝 Lista de deseos</h4>
            <ul style="list-style:none;padding:0;">
              ${items.map((item, i) => `
                <li style="padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
                  <span style="color:var(--accent-coral);">${i + 1}.</span>
                  <span style="color:var(--umbra-light);">${Utils.escapeHtml(item)}</span>
                </li>
              `).join('')}
            </ul>
          </div>`;
        break;
      default:
        body.innerHTML = `<p style="text-align:center;color:var(--umbra-light);">✨ ${Utils.escapeHtml(gift.title || 'Sorpresa')} ✨</p>
          <p style="text-align:center;color:var(--umbra-ash);">${Utils.escapeHtml(data.message || 'Disfruta de este regalo.')}</p>`;
    }

    modal.style.display = 'flex';

    // Close handlers
    const closeModal = () => {
      modal.style.display = 'none';
      body.innerHTML = '';
    };

    document.getElementById('closeExpModal').onclick = closeModal;
    document.getElementById('expCloseBtn').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  }

  if (window.AppRouter) {
    AppRouter.register('calendario', () => page);
  }
})();
