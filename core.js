// ==========================================
// core.js · Funciones auxiliares y lightbox global
// ==========================================

// ========== ESCAPE HTML ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== TOAST MESSAGE ==========
function showMessage(text, isError = false) {
    let existingToast = document.querySelector('.toast-message');
    if(existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = text;
    if(isError) toast.style.borderLeftColor = '#ff4d4d';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== LIGHTBOX GENERAL ==========
function openLightbox(src, caption = '') {
    const content = document.getElementById('lightboxContent');
    const captionEl = document.getElementById('lightboxCaption');
    if (content) content.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy">`;
    if (captionEl) captionEl.textContent = caption;
    const box = document.getElementById('lightbox');
    if (box) box.classList.add('open');
}

function closeLightbox() {
    const box = document.getElementById('lightbox');
    if (box) box.classList.remove('open');
}

// ========== CERRAR LIGHTBOXES CON ESC ==========
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLightbox();
        const lyricsLightbox = document.getElementById('lyricsLightbox');
        if(lyricsLightbox) lyricsLightbox.classList.remove('open');
        const noteLightbox = document.getElementById('noteLightbox');
        if(noteLightbox) noteLightbox.classList.remove('open');
    }
});