// shared/utils/core.js
// Utilidades centrales del sistema

/**
 * Calcula días desde una fecha
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {number}
 */
export function daysSince(dateStr) {
    const target = new Date(dateStr);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.floor((today - target) / (1000 * 60 * 60 * 24));
}

/**
 * Inicializa un contador de días
 * @param {string} containerId - ID del contenedor
 * @param {string} dateStr - Fecha de inicio
 * @param {string} label - Etiqueta
 */
export function initDayCounter(containerId, dateStr, label) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const days = daysSince(dateStr);
    el.innerHTML = `<span class="day-counter-number">${days}</span> ${label}`;
}

/**
 * Escape HTML (versión independiente)
 * @param {string} str - Texto a escapar
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Muestra un toast
 * @param {string} text - Mensaje
 * @param {boolean} isError - Si es error
 */
export function showToast(text, isError = false) {
    let existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = text;
    if (isError) toast.style.borderLeftColor = '#dc3545';
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2600);
}

/**
 * Abre una URL de forma segura
 * @param {string} url - URL a abrir
 * @param {string} errorMessage - Mensaje de error
 * @returns {boolean}
 */
export function openSafeUrl(url, errorMessage = 'Enlace no válido') {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        showToast(errorMessage, true);
        return false;
    }
    window.open(url, '_blank', 'noopener noreferrer');
    return true;
}

/**
 * Abre un lightbox con una imagen
 * @param {string} src - URL de la imagen
 * @param {string} caption - Pie de foto
 */
export function openLightbox(src, caption = '') {
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

/**
 * Cierra el lightbox
 */
export function closeLightbox() {
    const box = document.getElementById('lightbox');
    const content = document.getElementById('lightboxContent');
    if (content) content.innerHTML = '';
    if (box) box.classList.remove('open');
}

/**
 * Asegura que existe la capa de decoración
 * @returns {HTMLElement}
 */
export function ensureDecorLayer() {
    let layer = document.getElementById('globalDecorLayer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'globalDecorLayer';
    layer.className = 'decor-layer';
    document.body.appendChild(layer);
    return layer;
}

/**
 * Resuelve el origen de una partícula
 * @param {any} source - Fuente (elemento o coordenadas)
 * @returns {Object} - { x, y }
 */
export function resolveParticleOrigin(source) {
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

/**
 * Lanza partículas decorativas
 * @param {Object} options - Configuración
 */
export function launchParticles(options = {}) {
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

/**
 * Efecto pulse en un elemento
 * @param {HTMLElement} element - Elemento
 */
export function pulseElement(element) {
    if (!element) return;
    element.classList.remove('pulse-pop');
    void element.offsetWidth;
    element.classList.add('pulse-pop');
    setTimeout(() => element.classList.remove('pulse-pop'), 420);
}

/**
 * Formatea tiempo (mm:ss)
 * @param {number} seconds - Segundos
 * @returns {string}
 */
export function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

/**
 * Debounce
 * @param {Function} fn - Función
 * @param {number} delay - Delay en ms
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle
 * @param {Function} fn - Función
 * @param {number} limit - Límite en ms
 * @returns {Function}
 */
export function throttle(fn, limit = 300) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Obtiene el nombre de la página actual
 * @returns {string}
 */
export function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index';
    return page.replace('.html', '');
}

/**
 * Obtiene parámetros de la URL
 * @param {string} key - Clave del parámetro
 * @returns {string|null}
 */
export function getUrlParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
}