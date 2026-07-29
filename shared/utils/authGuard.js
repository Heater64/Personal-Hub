// shared/utils/authGuard.js
// Protege páginas: si no hay sesión (SessionManager), redirige al login

(function() {
    let guardReady = false;

    function getLoginPath() {
        const path = window.location.pathname;
        if (path.includes('/games/')) return '../login.html';
        if (path.includes('/pages/')) return '../login.html';
        return 'login.html';
    }

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/games/')) return '..';
        if (path.includes('/pages/')) return '..';
        return '.';
    }

    function redirectToLogin() {
        const currentPath = window.location.pathname;
        const filename = currentPath.split('/').pop() || 'index.html';
        if (filename === 'login.html') return;
        const basePath = getBasePath();
        const loginPath = basePath + '/login.html';
        const redirectParam = encodeURIComponent(currentPath);
        window.location.href = loginPath + '?redirect=' + redirectParam;
    }

    function isLoggedIn() {
        return typeof SessionManager !== 'undefined' && SessionManager.isLoggedIn();
    }

    function checkAuth() {
        if (guardReady) return;
        if (isLoggedIn()) {
            guardReady = true;
            return;
        }

        // Check if there's a session in progress (set by login page)
        guardReady = true;
        if (!isLoggedIn()) {
            redirectToLogin();
        }
    }

    const isLoginPage = window.location.pathname.includes('login.html');
    if (isLoginPage) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }
})();
