// services/auth/auth.service.js
// Servicio de autenticación propio (sin Firebase Auth)
// Login con usuario + contraseña, gestionado por admin

var AuthService = (function () {

    async function login(username, password) {
        if (!username || !password) {
            throw new Error('Usuario y contraseña son obligatorios.');
        }

        var db = window.db;
        if (!db) {
            throw new Error('Firestore no está disponible.');
        }

        // Buscar usuario por username
        var snapshot = await db.collection('users')
            .where('username', '==', username.trim().toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            throw new Error('USER_NOT_FOUND');
        }

        var doc = snapshot.docs[0];
        var userData = doc.data();

        // Verificar si está activo
        if (userData.enabled === false) {
            throw new Error('USER_DISABLED');
        }

        // Descifrar y comparar contraseña
        var storedPassword = userData.password;
        if (Encryption.isEncrypted(storedPassword)) {
            storedPassword = Encryption.decrypt(storedPassword);
        }

        if (storedPassword !== password) {
            throw new Error('WRONG_PASSWORD');
        }

        // Actualizar último acceso
        await db.collection('users').doc(doc.id).update({
            lastLogin: new Date().toISOString()
        });

        // Crear sesión
        var session = SessionManager.createSession({
            id: doc.id,
            username: userData.username,
            name: userData.name || userData.username,
            photo: userData.photo || '',
            role: userData.role || 'user',
            enabled: userData.enabled !== false,
            preferences: userData.preferences || {},
            profile: userData.profile || {}
        });

        // Registrar actividad
        if (typeof ActivityLog !== 'undefined') {
            ActivityLog.log('login', doc.id, 'Inicio de sesión');
        }

        return session;
    }

    async function logout() {
        var session = SessionManager.getSession();
        if (session && typeof ActivityLog !== 'undefined') {
            ActivityLog.log('logout', session.uid, 'Cierre de sesión');
        }
        SessionManager.destroySession();
        return true;
    }

    function getCurrentUser() {
        return SessionManager.getUserObject();
    }

    function isAdminUser(user) {
        if (!user) {
            user = SessionManager.getUserObject();
        }
        if (!user) return false;
        return user.role === 'admin';
    }

    async function requireAuth() {
        if (SessionManager.isLoggedIn()) {
            return SessionManager.getUserObject();
        }
        throw new Error('No autenticado');
    }

    function waitForAuth() {
        return new Promise(function (resolve) {
            if (SessionManager.isLoggedIn()) {
                resolve(true);
                return;
            }
            var checkInterval = setInterval(function () {
                if (SessionManager.isLoggedIn()) {
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
    // (compatibles con el sistema anterior)
    // ==========================================

    function install() {
        window.getCurrentUser = getCurrentUser;
        window.isAdminUser = isAdminUser;
        window.logoutUser = logout;
        window.requireAuth = requireAuth;
        window.waitForAuth = waitForAuth;
        window.loginWithEmail = function () {
            throw new Error('Usar AuthService.login(username, password)');
        };
        // Alias for backward compat
        window.onAuthStateChanged = SessionManager.onAuthStateChanged;
    }

    install();

    return {
        login: login,
        logout: logout,
        getCurrentUser: getCurrentUser,
        isAdminUser: isAdminUser,
        requireAuth: requireAuth,
        waitForAuth: waitForAuth,
        install: install
    };
})();

if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
