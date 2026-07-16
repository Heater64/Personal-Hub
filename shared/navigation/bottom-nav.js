// shared/navigation/bottom-nav.js
// Navegación inferior para móviles

const BOTTOM_NAV_ITEMS = [
    { key: 'home', label: 'Inicio', icon: 'home', href: '/index.html' },
    { key: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: '/features/sentimientos/sentimientos.html' },
    { key: 'calendario', label: 'Calendario', icon: 'calendar-days', href: '/features/calendario/calendario.html' },
    { key: 'juegos', label: 'Juegos', icon: 'gamepad-2', href: '/features/juegos/juegos.html' },
    { key: 'perfil', label: 'Perfil', icon: 'user', href: '/features/profile/profile.html' },
];

export function initBottomNav() {
    // Solo mostrar en móviles
    if (window.innerWidth > 768) return;

    if (document.querySelector('.bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Navegación inferior');

    const currentPath = window.location.pathname;

    nav.innerHTML = BOTTOM_NAV_ITEMS.map(item => {
        const isActive = currentPath.includes(item.key) ||
                         (item.key === 'home' && (currentPath === '/' || currentPath === '/index.html'));
        return `
            <a href="${item.href}"
               class="bottom-nav__item ${isActive ? 'is-active' : ''}"
               data-key="${item.key}"
               aria-current="${isActive ? 'page' : 'false'}">
                <i data-lucide="${item.icon}" class="bottom-nav__icon"></i>
                <span class="bottom-nav__label">${item.label}</span>
                <span class="bottom-nav__indicator"></span>
            </a>
        `;
    }).join('');

    document.body.appendChild(nav);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: nav });
    }
}

// Inicializar automáticamente
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBottomNav);
} else {
    initBottomNav();
}