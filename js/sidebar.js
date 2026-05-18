(function () {
    const prefetchedPages = new Set();

    const NAV_ITEMS = [
    { key: 'home', label: 'Inicio', icon: 'home', href: 'index.html' },
    { key: 'canciones', label: 'Canciones', icon: 'music', href: 'pages/canciones.html' },
    { key: 'rincon', label: 'TuRincónFav', icon: 'heart', href: 'pages/rincon.html' },
    { key: 'thoseeyes', label: 'Those Eyes', icon: 'eye', href: 'pages/thoseeyes.html' },
    { key: 'series', label: 'Series', icon: 'tv', href: 'pages/series.html' },
    { key: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: 'pages/sentimientos.html' }, // NUEVA
];

    function buildHref(root, href) {
        if (!root || root === '.') return href;
        return `${root}/${href}`;
    }

    function prefetchPage(href) {
        if (!href || href.startsWith('#')) return;

        let url;
        try {
            url = new URL(href, window.location.href);
        } catch {
            return;
        }

        if (url.origin !== window.location.origin || url.href === window.location.href) return;
        if (prefetchedPages.has(url.href)) return;

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url.href;
        link.as = 'document';
        document.head.appendChild(link);
        prefetchedPages.add(url.href);
    }

    function renderSidebar() {
    const sidebar = document.querySelector('[data-sidebar]');
    const body = document.body;
    if (!sidebar || !body) return;

    const root = body.dataset.sidebarRoot || '.';
    const currentPage = body.dataset.sidebarPage || 'home';
    const year = new Date().getFullYear();

    sidebar.innerHTML = `
        <div class="sidebar__brand">
            <span class="sidebar__eyebrow">Personal Hub</span>
            <h1>HOME</h1>
            <p>Todo lo bonito, en un solo sitio. En ti.</p>
        </div>
        <nav class="sidebar__nav" aria-label="Navegación principal">
            ${NAV_ITEMS.map((item) => {
                const href = buildHref(root, item.href);
                const classes = [
                    'sidebar__link',
                    item.key === currentPage ? 'is-active' : ''
                ].filter(Boolean).join(' ');

                return `
                    <a class="${classes}" href="${href}" data-section="${item.key}">
                        <i data-lucide="${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `;
            }).join('')}
        </nav>
        <div class="sidebar__footer">
            <small>De hecho te amo</small>
            <span>${year} · hecho por tu peluche</span>
        </div>
    `;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
    }

    function openSidebar() {
        document.body.classList.add('sidebar-open');
    }

    function toggleSidebar() {
        document.body.classList.toggle('sidebar-open');
    }

    function bindSidebar() {
        const toggle = document.querySelector('[data-sidebar-toggle]');
        const overlay = document.querySelector('[data-sidebar-overlay]');
        const sidebar = document.querySelector('[data-sidebar]');
        if (!sidebar) return;

        if (toggle && !toggle.dataset.bound) {
            toggle.dataset.bound = 'true';
            toggle.addEventListener('click', toggleSidebar);
        }

        if (overlay && !overlay.dataset.bound) {
            overlay.dataset.bound = 'true';
            overlay.addEventListener('click', closeSidebar);
        }

        sidebar.querySelectorAll('.sidebar__link').forEach((link) => {
            link.addEventListener('mouseenter', () => prefetchPage(link.href), { once: true });
            link.addEventListener('focus', () => prefetchPage(link.href), { once: true });

            link.addEventListener('click', () => {
                if (window.innerWidth < 768) {
                    closeSidebar();
                }
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                closeSidebar();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        renderSidebar();
        bindSidebar();
    });

    window.renderSidebar = renderSidebar;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.toggleSidebar = toggleSidebar;
})();
