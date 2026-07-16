// shared/navigation/sidebar.js
// Sidebar - Navegación lateral

(function() {
    const prefetchedPages = new Set();
    let editing = false;
    let hiddenSections = [];
    let authReadyChecked = false;

    const NAV_ITEMS = [
        { key: 'home', label: 'Inicio', icon: 'home', href: '/index.html' },
        { key: 'canciones', label: 'Canciones', icon: 'music', href: '/features/canciones/canciones.html' },
        { key: 'rincon', label: 'TuRincónFav', icon: 'heart', href: '/features/rincon/rincon.html' },
        { key: 'thoseeyes', label: 'Those Eyes', icon: 'eye', href: '/features/thoseeyes/thoseeyes.html' },
        { key: 'series', label: 'Series', icon: 'tv', href: '/features/series/series.html' },
        { key: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: '/features/sentimientos/sentimientos.html' },
        { key: 'juegos', label: 'Juegos', icon: 'gamepad-2', href: '/features/juegos/juegos.html' },
        { key: 'ositos', label: 'OsitosWorld', icon: 'star', href: '/features/ositos/ositos-world.html' },
        { key: 'admin', label: 'Admin', icon: 'settings', href: '/features/admin/admin.html', admin: true },
    ];

    function getDB() {
        if (window.db) return window.db;
        if (typeof db !== 'undefined') return db;
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try { return firebase.firestore(); } catch {}
        }
        return null;
    }

    function getCurrentUid() {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user ? user.uid : null;
    }

    function isHidden(key) {
        return hiddenSections.includes(key);
    }

    function isAdmin() {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user && typeof isAdminUser === 'function' && isAdminUser(user);
    }

    async function toggleHidden(key) {
        if (hiddenSections.includes(key)) {
            hiddenSections = hiddenSections.filter(k => k !== key);
        } else {
            hiddenSections.push(key);
        }
        renderSidebar();

        const uid = getCurrentUid();
        if (uid && typeof ProfileSystem !== 'undefined') {
            await ProfileSystem.savePreferences(uid, { hiddenSections });
        }
    }

    async function loadConfig() {
        const uid = getCurrentUid();

        if (uid && typeof ProfileSystem !== 'undefined') {
            const prefs = await ProfileSystem.loadPreferences(uid);
            if (prefs && Array.isArray(prefs.hiddenSections)) {
                hiddenSections = prefs.hiddenSections;
                renderSidebar();
                return;
            }
        }

        const fb = getDB();
        if (fb) {
            try {
                const doc = await fb.collection('config').doc('sidebar').get();
                if (doc.exists && Array.isArray(doc.data().hiddenSections)) {
                    hiddenSections = doc.data().hiddenSections;
                    if (uid && typeof ProfileSystem !== 'undefined') {
                        await ProfileSystem.savePreferences(uid, { hiddenSections });
                    }
                }
            } catch (e) {
                if (e.code !== 'permission-denied') {
                    console.error('Error cargando sidebar:', e);
                }
            }
        }
        renderSidebar();
    }

    function startListeningAuth() {
        if (typeof window.auth === 'undefined' || !window.auth) {
            setTimeout(startListeningAuth, 500);
            return;
        }

        window.auth.onAuthStateChanged(function(user) {
            const wasEditing = editing;
            editing = user && typeof isAdminUser === 'function' && isAdminUser(user);
            if (wasEditing !== editing) {
                renderSidebar();
            }
            authReadyChecked = true;
        });
    }

    function buildHref(root, href) {
        if (!root || root === '.') return href;
        if (href.startsWith('http://') || href.startsWith('https://')) return href;
        if (href.startsWith('/')) return href;
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
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const isAdminUser = user && typeof isAdminUser === 'function' && isAdminUser(user);
        const year = new Date().getFullYear();

        const visibleItems = NAV_ITEMS.filter(item => {
            if (item.admin && !isAdminUser) return false;
            return !isHidden(item.key);
        });

        const hiddenItems = NAV_ITEMS.filter(item => {
            if (item.admin && !isAdminUser) return false;
            return isHidden(item.key);
        });

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

        const userEmail = user ? user.email : '';
        const userName = user ? (user.displayName || user.email || '') : '';

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
                ${user ? `
                    <div class="sidebar__user">
                        <div class="sidebar__user-avatar">
                            ${userName.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div class="sidebar__user-info">
                            <span class="sidebar__user-name">${userName}</span>
                            <span class="sidebar__user-role">${isAdminUser ? '✨ Admin' : '🤍 Princesa'}</span>
                        </div>
                        <button class="sidebar__logout-btn" id="sidebarLogoutBtn" title="Cerrar sesión">
                            <i data-lucide="log-out"></i>
                        </button>
                    </div>
                ` : ''}
                <div class="sidebar__footer-meta">
                    <small>De hecho te amo</small>
                    <span>${year} · hecho por tu peluche</span>
                </div>
            </div>
        `;

        const logoutBtn = document.getElementById('sidebarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function(e) {
                e.stopPropagation();
                if (typeof logoutUser === 'function') {
                    await logoutUser();
                    window.location.href = buildHref(root, 'login.html');
                }
            });
        }

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
        startListeningAuth();

        if (typeof window.auth !== 'undefined' && window.auth) {
            window.auth.onAuthStateChanged(function() {
                setTimeout(loadConfig, 300);
            });
        }
    });

    window.renderSidebar = renderSidebar;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.toggleSidebar = toggleSidebar;
})();