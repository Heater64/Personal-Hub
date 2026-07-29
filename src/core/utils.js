/**
 * Shared utility helpers
 */
window.Utils = {
  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return '&#039;';
    });
  },

  formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  showToast(message, isError = false, duration = 3000) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'toast-message';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.borderLeftColor = isError ? '#dc3545' : 'var(--accent-coral)';
    toast.style.background = isError ? 'rgba(220,53,69,0.15)' : '';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
  },

  pulseElement(el) {
    if (!el) return;
    el.style.transform = 'scale(0.95)';
    setTimeout(() => { el.style.transform = ''; }, 150);
  },

  getTodayString() {
    return new Date().toISOString().split('T')[0];
  },

  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  },

  // Lightbox helper
  openLightbox(html) {
    let lb = document.getElementById('lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'lightbox';
      lb.className = 'lightbox';
      lb.innerHTML = '<button class="lightbox-close" id="lbClose">&times;</button><div class="lightbox-content" id="lbContent"></div>';
      document.body.appendChild(lb);
      lb.addEventListener('click', (e) => { if (e.target === lb) Utils.closeLightbox(); });
      document.getElementById('lbClose').addEventListener('click', Utils.closeLightbox);
    }
    document.getElementById('lbContent').innerHTML = html;
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) {
      lb.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
};

// Make showToast globally accessible
window.showToast = Utils.showToast;
