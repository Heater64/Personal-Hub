// services/auth/session-manager.js
// Session Manager centralizado
// Gestiona la sesión del usuario en localStorage
// Provee una interfaz compatible con el sistema anterior (getCurrentUser, etc.)

var SessionManager = (function () {
    var SESSION_KEY = 'personalHub.session';
    var listeners = [];
    var currentSession = null;

    function getSession() {
        if (currentSession) return currentSession;
        try {
            var raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                currentSession = JSON.parse(raw);
                return currentSession;
            }
        } catch (e) {
            currentSession = null;
        }
        return null;
    }

    function saveSession(session) {
        currentSession = session;
        if (session) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    function createSession(userData) {
        var session = {
            uid: userData.id || userData.uid,
            username: userData.username || '',
            name: userData.name || userData.username || '',
            photo: userData.photo || '',
            role: userData.role || 'user',
            enabled: userData.enabled !== false,
            preferences: userData.preferences || {},
            profile: userData.profile || {},
            loginTime: new Date().toISOString()
        };
        saveSession(session);
        notifyListeners(session);
        return session;
    }

    function destroySession() {
        currentSession = null;
        localStorage.removeItem(SESSION_KEY);
        notifyListeners(null);
    }

    function updateSession(updates) {
        var session = getSession();
        if (!session) return null;
        Object.keys(updates).forEach(function (key) {
            session[key] = updates[key];
        });
        saveSession(session);
        notifyListeners(session);
        return session;
    }

    function isLoggedIn() {
        var session = getSession();
        return session !== null && session.uid && session.enabled !== false;
    }

    function isAdmin() {
        var session = getSession();
        return session !== null && session.role === 'admin';
    }

    function getUid() {
        var session = getSession();
        return session ? session.uid : null;
    }

    function getUsername() {
        var session = getSession();
        return session ? session.username : null;
    }

    function getRole() {
        var session = getSession();
        return session ? session.role : null;
    }

    function getDisplayName() {
        var session = getSession();
        return session ? (session.name || session.username || '') : '';
    }

    function getPhoto() {
        var session = getSession();
        return session ? (session.photo || '') : '';
    }

    function getPreferences() {
        var session = getSession();
        return session ? (session.preferences || {}) : {};
    }

    function getUserObject() {
        var session = getSession();
        if (!session) return null;
        // Return an object compatible with what the old Firebase user provided
        return {
            uid: session.uid,
            email: session.username,
            displayName: session.name,
            photoURL: session.photo,
            role: session.role,
            enabled: session.enabled,
            username: session.username,
            name: session.name,
            photo: session.photo,
            preferences: session.preferences,
            profile: session.profile,
            loginTime: session.loginTime
        };
    }

    // ==========================================
    // LISTENER SYSTEM (replaces onAuthStateChanged)
    // ==========================================

    function onAuthStateChanged(callback) {
        if (typeof callback !== 'function') return function () {};
        listeners.push(callback);
        // Fire immediately with current state
        var user = getUserObject();
        try { callback(user); } catch (e) {}
        return function () {
            listeners = listeners.filter(function (l) { return l !== callback; });
        };
    }

    function notifyListeners(session) {
        var user = session ? getUserObject() : null;
        listeners.forEach(function (cb) {
            try { cb(user); } catch (e) {}
        });
    }

    // Listen for storage events (multi-tab sync)
    window.addEventListener('storage', function (e) {
        if (e.key === SESSION_KEY) {
            currentSession = null; // force re-read
            var session = getSession();
            notifyListeners(session);
        }
    });

    return {
        getSession: getSession,
        createSession: createSession,
        destroySession: destroySession,
        updateSession: updateSession,
        isLoggedIn: isLoggedIn,
        isAdmin: isAdmin,
        getUid: getUid,
        getUsername: getUsername,
        getRole: getRole,
        getDisplayName: getDisplayName,
        getPhoto: getPhoto,
        getPreferences: getPreferences,
        getUserObject: getUserObject,
        onAuthStateChanged: onAuthStateChanged
    };
})();

if (typeof window !== 'undefined') {
    window.SessionManager = SessionManager;
}
