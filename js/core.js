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

function ensureDecorLayer() {
    let layer = document.getElementById('globalDecorLayer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'globalDecorLayer';
    layer.className = 'decor-layer';
    document.body.appendChild(layer);
    return layer;
}

function resolveParticleOrigin(source) {
    if (!source) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    if (typeof source.x === 'number' && typeof source.y === 'number') {
        return source;
    }

    if (source.getBoundingClientRect) {
        const rect = source.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function launchParticles(options = {}) {
    const {
        amount = 12,
        symbols = ['❤', '✦', '✧'],
        colors = ['#c65a3a', '#ffb347', '#ff8aa1'],
        minSize = 10,
        maxSize = 22,
        spread = 150,
        duration = 1700,
        source = null
    } = options;

    const layer = ensureDecorLayer();
    const origin = resolveParticleOrigin(source);

    for (let index = 0; index < amount; index++) {
        const particle = document.createElement('span');
        particle.className = 'decor-particle';
        particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];

        const size = minSize + Math.random() * (maxSize - minSize);
        const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.55;
        const distance = 40 + Math.random() * spread;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance * -1;
        const rotate = -30 + Math.random() * 60;
        const opacity = 0.55 + Math.random() * 0.45;

        particle.style.left = `${origin.x}px`;
        particle.style.top = `${origin.y}px`;
        particle.style.fontSize = `${size}px`;
        particle.style.color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.opacity = opacity.toFixed(2);
        particle.style.setProperty('--dx', `${x}px`);
        particle.style.setProperty('--dy', `${y}px`);
        particle.style.setProperty('--rot', `${rotate}deg`);
        particle.style.setProperty('--dur', `${duration + Math.random() * 600}ms`);
        particle.style.setProperty('--scale-end', `${0.8 + Math.random() * 0.7}`);

        layer.appendChild(particle);
        setTimeout(() => particle.remove(), duration + 900);
    }
}

function pulseElement(element) {
    if (!element) return;
    element.classList.remove('pulse-pop');
    void element.offsetWidth;
    element.classList.add('pulse-pop');
    setTimeout(() => element.classList.remove('pulse-pop'), 420);
}

function triggerAmbientDecor() {
    const page = document.body?.dataset?.sidebarPage;
    if (page === 'home') {
        setTimeout(() => {
            launchParticles({
                amount: 10,
                symbols: ['❤', '✦', '✧'],
                colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
                spread: 120,
                source: { x: Math.min(window.innerWidth - 140, 420), y: 140 }
            });
        }, 320);
    }
}

function initCoreUi() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    ensureDecorLayer();

    const lightbox = document.getElementById('lightbox');
    if (lightbox && !lightbox.dataset.bound) {
        lightbox.dataset.bound = 'true';
        lightbox.addEventListener('click', function (event) {
            if (event.target === lightbox) {
                closeLightbox();
            }
        });
    }

    triggerAmbientDecor();
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
window.launchParticles = launchParticles;
window.pulseElement = pulseElement;
