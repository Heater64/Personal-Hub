// shared/utils/authGuard.js
// Protege páginas: si no hay sesión (SessionManager o Firebase Auth), redirige al login

(function() {
    let guardReady = false;
    var isAuthenticated = false;

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

    function isLoggedInViaSessionManager() {
        return typeof SessionManager !== 'undefined' && SessionManager.isLoggedIn();
    }

    function checkAuth() {
        if (isAuthenticated) return;
        if (guardReady) return;

        // 1. Comprobar SessionManager primero
        if (isLoggedInViaSessionManager()) {
            isAuthenticated = true;
            guardReady = true;
            return;
        }

        // 2. Comprobar Firebase Auth
        if (typeof window.auth !== 'undefined' && window.auth) {
            guardReady = true;
            window.auth.onAuthStateChanged(function(user) {
                if (!user) {
                    if (!isLoggedInViaSessionManager()) {
                        redirectToLogin();
                    } else {
                        isAuthenticated = true;
                    }
                } else {
                    isAuthenticated = true;
                }
            });
        } else {
            setTimeout(checkAuth, 200);
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