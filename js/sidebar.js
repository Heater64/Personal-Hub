(function () {
    const prefetchedPages = new Set();
    let editing = false;
    let hiddenSections = [];
    let authReadyChecked = false;

    const NAV_ITEMS = [
        { key: 'home', label: 'Inicio', icon: 'home', href: 'index.html' },
        { key: 'rincon', label: 'TuRincónFav', icon: 'heart', href: 'pages/rincon.html' },
        { key: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: 'pages/sentimientos.html' },
        { key: 'puffy', label: 'OsitosWorld', icon: 'paw-print', href: 'pages/ositos-world.html' },
    ];

    // El perfil ahora es una sección completa (features/profile/profile.html),
    // accesible desde la fila de usuario del sidebar y el botón del bottom-nav.
    // Los items de navegación rápida (calendario, razones, openwhen, maldia)
    // están dentro de la propia página de perfil.

    function getDB() {
        if (window.db) return window.db;
        if (typeof db !== 'undefined') return db;
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try { return firebase.firestore(); } catch {}
        }
        return null;
    }

    function isHidden(key) { return hiddenSections.includes(key); }

    function getCurrentUid() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user ? user.uid : null;
    }

    // Sincronizar Firebase Auth → SessionManager si es necesario
    async function ensureSessionFromFirebase() {
        if (typeof SessionManager === 'undefined' || !SessionManager) return false;
        if (SessionManager.isLoggedIn()) return true;
        if (!window.auth || !window.auth.currentUser) return false;

        var firebaseUser = window.auth.currentUser;
        var email = firebaseUser.email || '';
        if (!email) return false;

        try {
            var snap = await window.db.collection('users')
                .where('username', '==', email).limit(1).get();
            if (!snap.empty) {
                var doc = snap.docs[0];
                var data = doc.data();
                SessionManager.createSession({
                    id: doc.id, username: data.username, name: data.name || data.username,
                    photo: data.photo || '', role: data.role || 'user',
                    enabled: data.enabled !== false, preferences: data.preferences || {},
                    profile: data.profile || {}
                });
                return true;
            }
        } catch (e) {}
        return false;
    }

    function getUserName() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!user) return '';
        return user.displayName || user.email || '';
    }

    function getUserInitial() {
        var name = getUserName();
        return name.charAt(0).toUpperCase() || '?';
    }

    function getIsAdmin() {
        try {
            var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!user) return false;
            if (typeof window.isAdminUser === 'function') {
                return window.isAdminUser(user);
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    async function toggleHidden(key) {
        if (hiddenSections.includes(key)) {
            hiddenSections = hiddenSections.filter(k => k !== key);
        } else {
            hiddenSections.push(key);
        }
        renderSidebar();
        renderBottomNav();

        var uid = getCurrentUid();
        if (uid && typeof ProfileSystem !== 'undefined') {
            await ProfileSystem.savePreferences(uid, { hiddenSections: hiddenSections });
        }
    }

    async function loadConfig() {
        var uid = getCurrentUid();

        if (uid && typeof ProfileSystem !== 'undefined') {
            var prefs = await ProfileSystem.loadPreferences(uid);
            if (prefs && Array.isArray(prefs.hiddenSections)) {
                hiddenSections = prefs.hiddenSections;
                renderSidebar();
                renderBottomNav();
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
                        await ProfileSystem.savePreferences(uid, { hiddenSections: hiddenSections });
                    }
                }
            } catch (e) {
                if (e.code !== 'permission-denied') {
                    console.error('Error cargando de Firebase:', e);
                }
            }
        }
        renderSidebar();
        renderBottomNav();
    }

    function checkAuthForEditing() {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (user && getIsAdmin()) {
            editing = true;
            renderSidebar();
            renderBottomNav();
        }
    }

    function startListeningAuth() {
        if (typeof window.auth === 'undefined' || !window.auth) {
            setTimeout(startListeningAuth, 500);
            return;
        }
        window.auth.onAuthStateChanged(function (user) {
            const wasEditing = editing;
            if (user && getIsAdmin()) {
                editing = true;
            } else {
                editing = false;
            }
            if (wasEditing !== editing) {
                renderSidebar();
                renderBottomNav();
            }
            authReadyChecked = true;
        });
    }

    function buildHref(root, href) {
        if (!root || root === '.') return href;
        if (href.startsWith('http://') || href.startsWith('https://')) return href;
        return root + '/' + href;
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

    // ==========================================
    // SIDEBAR (escritorio)
    // ==========================================

    function renderSidebar() {
        const sidebar = document.querySelector('[data-sidebar]');
        const body = document.body;
        if (!sidebar || !body) return;

        const root = body.dataset.sidebarRoot || '.';
        const currentPage = body.dataset.sidebarPage || 'home';
        const year = new Date().getFullYear();
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const isAdmin = user && getIsAdmin();

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

        const userEmail = user ? user.email : '';
        const userName = user ? (user.displayName || user.email || '') : '';

        const adminNavHtml = isAdmin ? `
            <div class="sidebar__section-divider">Admin</div>
            <div class="sidebar__link-wrap">
                <a class="sidebar__link${currentPage === 'admin' ? ' is-active' : ''}" href="${buildHref(root, 'pages/admin.html')}" data-section="admin">
                    <i data-lucide="settings"></i>
                    <span>Panel Admin</span>
                </a>
            </div>
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
                ${user ? `
                    <div class="sidebar__user" id="sidebarUserRow" role="button" tabindex="0" title="Ver perfil" style="cursor:pointer">
                        <div class="sidebar__user-avatar">
                            ${userName.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div class="sidebar__user-info">
                            <span class="sidebar__user-name">${userName}</span>
                            <span class="sidebar__user-role">${isAdmin ? '✨ Admin' : '🤍 Princesa'}</span>
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
            logoutBtn.addEventListener('click', async function (e) {
                e.stopPropagation();
                if (typeof logoutUser === 'function') {
                    await logoutUser();
                    window.location.href = buildHref(root, 'login.html');
                }
            });
        }

        // Abrir perfil al pulsar la fila de usuario → navega a la seccion
        const userRow = document.getElementById('sidebarUserRow');
        if (userRow) {
            const irPerfil = function (e) {
                if (e.target.closest('#sidebarLogoutBtn')) return;
                window.location.href = buildHref(root, 'features/profile/profile.html');
            };
            userRow.addEventListener('click', irPerfil);
            userRow.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irPerfil(e); }
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

    // ==========================================
    // BOTTOM NAV (móvil) - SIEMPRE VISIBLE
    // ==========================================

    function renderBottomNav() {
        const nav = document.getElementById('bottomNav');
        if (!nav) {
            setTimeout(function() {
                const navAgain = document.getElementById('bottomNav');
                if (navAgain) {
                    renderBottomNav();
                }
            }, 100);
            return;
        }

        const body = document.body;
        const currentPage = body.dataset.sidebarPage || 'home';
        const root = body.dataset.sidebarRoot || '.';
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const isLoggedIn = !!user;

        // Items de la barra inferior
        const bottomItems = [
            { key: 'home', label: 'Inicio', icon: 'home', href: 'index.html' },
            { key: 'rincon', label: 'Rincón', icon: 'heart', href: 'pages/rincon.html' },
            { key: 'sentimientos', label: 'Sentimientos', icon: 'heart-handshake', href: 'pages/sentimientos.html' },
            { key: 'puffy', label: 'OsitosWorld', icon: 'paw-print', href: 'pages/ositos-world.html' },
            { key: 'perfil', label: isLoggedIn ? 'Perfil' : 'Login', icon: isLoggedIn ? 'user' : 'log-in', href: isLoggedIn ? 'features/profile/profile.html' : 'login.html', isProfile: true },
        ];

        const visibleItems = bottomItems.filter(item => {
            if (item.isProfile) return true;
            return !isHidden(item.key);
        });

        nav.innerHTML = visibleItems.map((item, index) => {
            const href = item.isProfile ? (isLoggedIn ? '#' : buildHref(root, 'login.html')) : buildHref(root, item.href);
            const isActive = item.key === currentPage ||
                             (item.key === 'perfil' && (currentPage === 'login' || currentPage === 'profile'));
            const isCenter = index === Math.floor(visibleItems.length / 2);
            const isProfile = item.isProfile || false;
            
            const classes = [
                'bottom-nav-item',
                isActive ? 'active' : '',
                isCenter ? 'center' : '',
                isProfile ? 'profile-btn' : ''
            ].filter(Boolean).join(' ');

            let iconHtml = '';
            if (isProfile && isLoggedIn) {
                const initial = getUserInitial();
                iconHtml = `
                    <div class="bottom-avatar">${initial}</div>
                `;
            } else if (isProfile && !isLoggedIn) {
                iconHtml = `<i data-lucide="log-in"></i>`;
            } else {
                iconHtml = `<i data-lucide="${item.icon}"></i>`;
            }

            return `
                <a class="${classes}" 
                   href="${href}" 
                   data-section="${item.key}"
                   ${isProfile && isLoggedIn ? 'id="bottomProfileBtn"' : ''}
                   aria-current="${isActive ? 'page' : 'false'}">
                    ${iconHtml}
                    <span class="label">${item.label}</span>
                </a>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: nav });
        }

        const profileBtn = document.getElementById('bottomProfileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (!isLoggedIn) { window.location.href = buildHref(root, 'login.html'); return; }
                window.location.href = buildHref(root, 'features/profile/profile.html');
            });
        }
    }

    // ==========================================
    // SIDEBAR TOGGLE
    // ==========================================

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

    // ==========================================
    // FORZAR RENDERIZADO
    // ==========================================

    function forceRender() {
        console.log('🔄 Forzando renderizado de barra inferior');
        if (typeof renderBottomNav === 'function') {
            renderBottomNav();
        }
        if (typeof renderSidebar === 'function') {
            renderSidebar();
        }
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    window.addEventListener('pageshow', function(event) {
        if (event.persisted || document.readyState === 'complete') {
            setTimeout(forceRender, 100);
        }
    });

    if (window.MutationObserver) {
        const observer = new MutationObserver(function() {
            const nav = document.getElementById('bottomNav');
            if (nav && nav.children.length === 0) {
                forceRender();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(forceRender, 150);
    });

    window.forceRenderNav = forceRender;

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================

    document.addEventListener('DOMContentLoaded', async () => {
        bindToggle();
        if (typeof waitForFirebase === 'function') await waitForFirebase();
        await ensureSessionFromFirebase();
        await loadConfig();
        startListeningAuth();

        if (typeof window.auth !== 'undefined' && window.auth) {
            window.auth.onAuthStateChanged(function (user) {
                setTimeout(function () {
                    if (user && typeof SessionManager !== 'undefined' && !SessionManager.isLoggedIn()) {
                        ensureSessionFromFirebase().then(function () { loadConfig(); });
                    } else {
                        loadConfig();
                    }
                }, 300);
            });
        }
    });

    window.renderSidebar = renderSidebar;
    window.renderBottomNav = renderBottomNav;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.toggleSidebar = toggleSidebar;
})();