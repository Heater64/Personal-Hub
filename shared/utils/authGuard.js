// shared/utils/authGuard.js
// Protege páginas: si no hay sesión, redirige al login

(function() {
    let guardReady = false;

    function getLoginPath() {
        const path = window.location.pathname;
        if (path.includes('/games/')) return '../login.html';
        if (path.includes('/features/')) return '../login.html';
        if (path.includes('/pages/')) return '../login.html';
        return 'login.html';
    }

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/games/')) return '..';
        if (path.includes('/features/')) return '..';
        if (path.includes('/pages/')) return '..';
        return '.';
    }

    function redirectToLogin() {
        const currentPath = window.location.pathname;
        const filename = currentPath.split('/').pop() || 'index.html';

        if (filename === 'login.html' || filename === '') return;

        const basePath = getBasePath();
        const loginPath = `${basePath}/login.html`;
        const redirectParam = encodeURIComponent(currentPath);
        window.location.href = `${loginPath}?redirect=${redirectParam}`;
    }

    function checkAuth() {
        if (typeof window.auth === 'undefined' || !window.auth) {
            setTimeout(checkAuth, 200);
            return;
        }

        if (guardReady) return;
        guardReady = true;

        window.auth.onAuthStateChanged(function(user) {
            if (!user) {
                redirectToLogin();
            }
        });
    }

    // Si la página es login, no hacer nada
    const isLoginPage = window.location.pathname.includes('login.html');
    if (isLoginPage) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }
})();