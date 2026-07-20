// js/core/authGuard.js
// Protege páginas: si no hay sesión (Firebase Auth o SessionManager), redirige al login

(function () {
    let guardReady = false;

    // Cache: si ya verificamos que hay sesión, no volver a comprobar
    var isAuthenticated = false;

    function getLoginPath() {
        var path = window.location.pathname;
        if (path.indexOf('/games/') !== -1) return '../login.html';
        if (path.indexOf('/pages/') !== -1) return '../login.html';
        if (path.indexOf('/features/') !== -1) return '../login.html';
        return 'login.html';
    }

    function redirectToLogin() {
        var currentPath = window.location.pathname;
        var filename = currentPath.split('/').pop() || 'index.html';
        if (filename === 'login.html') return;
        var loginPath = getLoginPath();
        var redirectParam = encodeURIComponent(currentPath);
        window.location.href = loginPath + '?redirect=' + redirectParam;
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
            window.auth.onAuthStateChanged(function (user) {
                if (!user) {
                    // No está autenticado en Firebase ni SessionManager
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
            // Firebase Auth no está listo aún
            setTimeout(checkAuth, 200);
        }
    }

    // Si la página es login, no hacer nada
    var filename = window.location.pathname.split('/').pop() || '';
    if (filename === 'login.html' || filename === '') {
        // empty check — don't run guard
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAuth);
        } else {
            checkAuth();
        }
    }
})();
