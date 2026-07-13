// js/core/authGuard.js
// Protege páginas: si no hay sesión, redirige al login
// Debe cargarse DESPUÉS de firebase-config.js

(function () {
    let guardReady = false;

    function getLoginPath() {
        var path = window.location.pathname;
        var depth = (path.match(/\//g) || []).length - 1;
        if (path.indexOf('/games/') !== -1) {
            return '../login.html';
        }
        if (path.indexOf('/pages/') !== -1) {
            return '../login.html';
        }
        return 'login.html';
    }

    function redirectToLogin() {
        var currentPath = window.location.pathname;
        var filename = currentPath.split('/').pop() || 'index.html';

        // Evitar bucle infinito
        if (filename === 'login.html') return;

        var loginPath = getLoginPath();
        var redirectParam = encodeURIComponent(currentPath);
        window.location.href = loginPath + '?redirect=' + redirectParam;
    }

    function checkAuth() {
        if (typeof window.auth === 'undefined' || !window.auth) {
            setTimeout(checkAuth, 200);
            return;
        }

        if (guardReady) return;
        guardReady = true;

        window.auth.onAuthStateChanged(function (user) {
            if (!user) {
                redirectToLogin();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }
})();
