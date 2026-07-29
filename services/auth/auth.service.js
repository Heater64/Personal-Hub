// services/auth/auth.service.js
// Servicio de autenticación via Supabase Auth REST API
// Las llamadas auth se hacen mediante fetch a la API de Supabase Auth

var AuthService = (function () {

    var SUPABASE_URL = 'https://ydkyvfifadtwgmwgrslo.supabase.co';
    var AUTH_URL = SUPABASE_URL + '/auth/v1';

    function getAnonHeaders() {
        var key = (typeof SupabaseClient !== 'undefined')
            ? SupabaseClient.getAnonKey()
            : 'sb_publishable_CymwHz4Lp2ieYb2_PPubNw_MmRIlYeI';
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'apikey': key,
            'Authorization': 'Bearer ' + key
        };
    }

    async function signInWithPassword(email, password) {
        var res = await fetch(AUTH_URL + '/token?grant_type=password', {
            method: 'POST',
            headers: getAnonHeaders(),
            body: JSON.stringify({ email: email, password: password })
        });

        if (!res.ok) {
            var err = await res.json();
            throw new Error(err.error_description || err.msg || 'Error al iniciar sesión');
        }

        var data = await res.json();
        // Guardar sesión en SessionManager
        if (typeof SessionManager !== 'undefined') {
            var user = data.user || {};
            SessionManager.createSession({
                id: user.id,
                username: user.email,
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
                photo: user.user_metadata?.avatar_url || '',
                role: user.email === 'admin@personalhub.com' ? 'admin' : 'user',
                enabled: true,
                preferences: {},
                profile: user.user_metadata || {}
            });
        }
        return data;
    }

    async function signUp(email, password) {
        var res = await fetch(AUTH_URL + '/signup', {
            method: 'POST',
            headers: getAnonHeaders(),
            body: JSON.stringify({ email: email, password: password })
        });

        if (!res.ok) {
            var err = await res.json();
            throw new Error(err.msg || 'Error al registrarse');
        }
        return await res.json();
    }

    async function signOut() {
        var session = typeof SessionManager !== 'undefined' ? SessionManager.getSession() : null;
        var token = session?.access_token || '';

        if (token) {
            try {
                await fetch(AUTH_URL + '/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': getAnonHeaders()['apikey'],
                        'Authorization': 'Bearer ' + token
                    }
                });
            } catch (e) {}
        }

        if (typeof SessionManager !== 'undefined') {
            SessionManager.destroySession();
        }
        return true;
    }

    async function getSession() {
        var session = typeof SessionManager !== 'undefined' ? SessionManager.getSession() : null;
        if (!session) return null;

        // Verificar si el token sigue siendo válido
        try {
            var res = await fetch(AUTH_URL + '/user', {
                headers: {
                    'apikey': getAnonHeaders()['apikey'],
                    'Authorization': 'Bearer ' + (session.access_token || '')
                }
            });
            if (!res.ok) {
                SessionManager.destroySession();
                return null;
            }
            return session;
        } catch (e) {
            return session; // Si no hay conexión, confiar en la sesión local
        }
    }

    var currentUser = null;

    function getCurrentUser() {
        if (currentUser) return currentUser;
        var session = typeof SessionManager !== 'undefined' ? SessionManager.getUserObject() : null;
        if (session) {
            currentUser = {
                uid: session.uid,
                email: session.username,
                displayName: session.name,
                photoURL: session.photo,
                role: session.role,
                enabled: session.enabled !== false
            };
            return currentUser;
        }
        return null;
    }

    function isAdminUser(user) {
        if (!user) user = getCurrentUser();
        if (!user) return false;
        return user.role === 'admin' || user.email === 'admin@personalhub.com';
    }

    async function requireAuth() {
        var user = getCurrentUser();
        if (user) return user;
        throw new Error('No autenticado');
    }

    function waitForAuth() {
        return new Promise(function (resolve) {
            if (getCurrentUser()) {
                resolve(true);
                return;
            }
            var checkInterval = setInterval(function () {
                if (getCurrentUser()) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 100);
            setTimeout(function () {
                clearInterval(checkInterval);
                resolve(false);
            }, 5000);
        });
    }

    // ==========================================
    // EXPORTAR FUNCIONES GLOBALES
    // ==========================================

    function install() {
        window.getCurrentUser = getCurrentUser;
        window.isAdminUser = isAdminUser;
        window.logoutUser = signOut;
        window.requireAuth = requireAuth;
        window.waitForAuth = waitForAuth;
        window.loginWithEmail = function (email, password) {
            return signInWithPassword(email, password);
        };
        window.onAuthStateChanged = (typeof SessionManager !== 'undefined')
            ? SessionManager.onAuthStateChanged
            : function () {};
    }

    install();

    return {
        login: signInWithPassword,
        signUp: signUp,
        logout: signOut,
        getCurrentUser: getCurrentUser,
        isAdminUser: isAdminUser,
        requireAuth: requireAuth,
        waitForAuth: waitForAuth,
        getSession: getSession,
        install: install
    };
})();

if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
