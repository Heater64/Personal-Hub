// ==========================================
// core.js · utilidades comunes compartidas
// ==========================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (match) {
        if (match === '&') return '&amp;';
        if (match === '<') return '&lt;';
        if (match === '>') return '&gt;';
        return match;
    });
}

function showMessage(text, isError = false) {
    let existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = text;
    if (isError) toast.style.borderLeftColor = '#ff4d4d';
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2600);
}

function showToast(text, isError = false) {
    showMessage(text, isError);
}

function openSafeUrl(url, onErrorMessage = 'Enlace no válido') {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        showMessage(onErrorMessage, true);
        return false;
    }
    window.open(url, '_blank', 'noopener noreferrer');
    return true;
}

function openLightbox(src, caption = '') {
    const content = document.getElementById('lightboxContent');
    const captionEl = document.getElementById('lightboxCaption');
    const box = document.getElementById('lightbox');
    if (!content || !box) return;

    content.innerHTML = '';
    const image = document.createElement('img');
    image.src = src;
    image.alt = caption || '';
    image.loading = 'eager';
    content.appendChild(image);

    if (captionEl) captionEl.textContent = caption;
    box.classList.add('open');
}

function closeLightbox() {
    const box = document.getElementById('lightbox');
    const content = document.getElementById('lightboxContent');
    if (content) content.innerHTML = '';
    if (box) box.classList.remove('open');
}

function initCoreUi() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    const lightbox = document.getElementById('lightbox');
    if (lightbox && !lightbox.dataset.bound) {
        lightbox.dataset.bound = 'true';
        lightbox.addEventListener('click', function (event) {
            if (event.target === lightbox) {
                closeLightbox();
            }
        });
    }
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
});

document.addEventListener('DOMContentLoaded', initCoreUi);

window.escapeHtml = escapeHtml;
window.showMessage = showMessage;
window.showToast = showToast;
window.openSafeUrl = openSafeUrl;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.initCoreUi = initCoreUi;
