(function () {
    const prefetchedPages = new Set();
    const PASSWORD = 'sY2LkBmX';
    let editing = false;
    let hiddenSections = [];
    let clickCount = 0;
    let clickTimer = null;

    const NAV_ITEMS = [
    { key: 'home', label: 'Inicio', icon: 'home', href: 'index.html' },
    { key: 'canciones', label: 'Canciones', icon: 'music', href: 'pages/canciones.html' },
    { key: 'rincon', label: 'TuRincónFav', icon: 'heart', href: 'pages/rincon.html' },
    { key: 'thoseeyes', label: 'Those Eyes', icon: 'eye', href: 'pages/thoseeyes.html' },
    { key: 'series', label: 'Series', icon: 'tv', href: 'pages/series.html' },
    { key: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: 'pages/sentimientos.html' },
    { key: '4eso', label: 'Apuntes 4ESO', icon: 'book-open', href: 'https://web-4eso.vercel.app/dashboard.html' },
];

    function getDB() {
        if (window.db) return window.db;
        if (typeof db !== 'undefined') return db;
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try { return firebase.firestore(); } catch {}
        }
        return null;
    }

    function isHidden(key) { return hiddenSections.includes(key); }

    async function toggleHidden(key) {
        if (hiddenSections.includes(key)) {
            hiddenSections = hiddenSections.filter(k => k !== key);
        } else {
            hiddenSections.push(key);
        }
        renderSidebar();
        const fb = getDB();
        if (!fb) { console.error('Firebase no disponible'); return; }
        try {
            await fb.collection('config').doc('sidebar').set({ hiddenSections }, { merge: true });
        } catch (e) { console.error('Error guardando en Firebase:', e); }
    }

    async function loadConfig() {
        const fb = getDB();
        if (fb) {
            try {
                const doc = await fb.collection('config').doc('sidebar').get();
                if (doc.exists && Array.isArray(doc.data().hiddenSections)) {
                    hiddenSections = doc.data().hiddenSections;
                }
            } catch (e) { console.error('Error cargando de Firebase:', e); }
        }
        renderSidebar();
    }

    function subscribeUpdates() {
        const fb = getDB();
        if (!fb) return;
        fb.collection('config').doc('sidebar').onSnapshot((doc) => {
            const newHidden = doc.exists && Array.isArray(doc.data().hiddenSections) ? doc.data().hiddenSections : [];
            if (JSON.stringify(newHidden) !== JSON.stringify(hiddenSections)) {
                hiddenSections = newHidden;
                renderSidebar();
            }
        });
    }

    function showPasswordModal() {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-pwd-overlay';
        overlay.innerHTML = `
            <div class="sidebar-pwd-modal">
                <input type="password" id="sidebarPwdInput" placeholder="Contraseña" autofocus>
                <div class="sidebar-pwd-actions">
                    <button id="sidebarPwdOk">OK</button>
                    <button id="sidebarPwdCancel">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#sidebarPwdInput');
        const ok = overlay.querySelector('#sidebarPwdOk');
        const cancel = overlay.querySelector('#sidebarPwdCancel');

        async function check() {
            if (input.value === PASSWORD) {
                editing = true;
                overlay.remove();
                renderSidebar();
            } else {
                input.style.borderColor = '#dc3545';
                input.value = '';
                input.placeholder = 'Contraseña incorrecta';
            }
        }

        ok.addEventListener('click', check);
        cancel.addEventListener('click', () => overlay.remove());
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); if (e.key === 'Escape') overlay.remove(); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        setTimeout(() => input.focus(), 100);
    }

    function buildHref(root, href) {
        if (!root || root === '.') return href;
        if (href.startsWith('http://') || href.startsWith('https://')) return href;
        return `${root}/${href}`;
    }

    function prefetchPage(href) {
        if (!href || href.startsWith('#')) return;
        let url;
        try { url = new URL(href, window.location.href); } catch { return; }
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

        const visibleItems = NAV_ITEMS.filter(item => !isHidden(item.key));
        const hiddenItems = NAV_ITEMS.filter(item => isHidden(item.key));

        const navHtml = visibleItems.map(item => {
            const href = buildHref(root, item.href);
            const classes = ['sidebar__link', item.key === currentPage ? 'is-active' : ''].filter(Boolean).join(' ');
            const isExternal = href.startsWith('http://') || href.startsWith('https://');
            return `
                <div class="sidebar__link-wrap">
                    <a class="${classes}" href="${href}" data-section="${item.key}"${isExternal ? ' target="_blank" rel="noopener"' : ''}>
                        <i data-lucide="${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                    <button class="sidebar__hide-btn" data-key="${item.key}">
                        <i data-lucide="eye-off"></i>
                    </button>
                </div>
            `;
        }).join('');

        const hiddenNavHtml = editing && hiddenItems.length > 0 ? `
            <div class="sidebar__section-divider">Ocultos</div>
            ${hiddenItems.map(item => {
                const href = buildHref(root, item.href);
                const isExternal = href.startsWith('http://') || href.startsWith('https://');
                return `
                    <div class="sidebar__link-wrap sidebar__link-wrap--hidden">
                        <a class="sidebar__link" href="${href}" data-section="${item.key}"${isExternal ? ' target="_blank" rel="noopener"' : ''}>
                            <i data-lucide="${item.icon}"></i>
                            <span>${item.label}</span>
                        </a>
                        <button class="sidebar__show-btn" data-key="${item.key}">
                            <i data-lucide="eye"></i>
                        </button>
                    </div>
                `;
            }).join('')}
        ` : '';

        sidebar.innerHTML = `
            <div class="sidebar__brand">
                <span class="sidebar__eyebrow">Personal Hub</span>
                <h1 id="sidebarHomeTitle">HOME</h1>
                <p>Todo lo bonito, en un solo sitio. En ti.</p>
            </div>
            <nav class="sidebar__nav" aria-label="Navegación principal">
                ${navHtml}
                ${hiddenNavHtml}
            </nav>
            <div class="sidebar__footer">
                <small>De hecho te amo</small>
                <span>${year} · hecho por tu peluche</span>
            </div>
        `;

        sidebar.classList.toggle('sidebar-editing', editing);

        if (typeof lucide !== 'undefined') lucide.createIcons();

        sidebar.querySelectorAll('.sidebar__hide-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHidden(btn.dataset.key);
            });
        });
        sidebar.querySelectorAll('.sidebar__show-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHidden(btn.dataset.key);
            });
        });

        sidebar.querySelectorAll('.sidebar__link').forEach((link) => {
            link.addEventListener('mouseenter', () => prefetchPage(link.href), { once: true });
            link.addEventListener('focus', () => prefetchPage(link.href), { once: true });
            link.addEventListener('click', () => { if (window.innerWidth < 768) closeSidebar(); });
        });

        const title = document.getElementById('sidebarHomeTitle');
        if (title && !title.dataset.tripleBound) {
            title.dataset.tripleBound = 'true';
            title.addEventListener('click', () => {
                clickCount++;
                if (clickTimer) clearTimeout(clickTimer);
                clickTimer = setTimeout(() => { clickCount = 0; }, 600);
                if (clickCount >= 3) {
                    clickCount = 0;
                    showPasswordModal();
                }
            });
        }
    }

    function closeSidebar() { document.body.classList.remove('sidebar-open'); }
    function openSidebar() { document.body.classList.add('sidebar-open'); }
    function toggleSidebar() { document.body.classList.toggle('sidebar-open'); }

    function bindToggle() {
        const toggle = document.querySelector('[data-sidebar-toggle]');
        const overlay = document.querySelector('[data-sidebar-overlay]');
        if (toggle && !toggle.dataset.bound) {
            toggle.dataset.bound = 'true';
            toggle.addEventListener('click', toggleSidebar);
        }
        if (overlay && !overlay.dataset.bound) {
            overlay.dataset.bound = 'true';
            overlay.addEventListener('click', closeSidebar);
        }
        window.addEventListener('resize', () => { if (window.innerWidth >= 768) closeSidebar(); });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        bindToggle();
        if (typeof waitForFirebase === 'function') await waitForFirebase();
        await loadConfig();
        subscribeUpdates();
    });

    window.renderSidebar = renderSidebar;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.toggleSidebar = toggleSidebar;
})();
