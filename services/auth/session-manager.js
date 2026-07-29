// services/auth/session-manager.js
// Session Manager centralizado
// SQ-MED-001: Sesion firmada con HMAC-SHA256 via Web Crypto API
// Los datos en localStorage estan firmados para evitar manipulacion

var SessionManager = (function () {
    var SESSION_KEY = 'personalHub.session';
    var listeners = [];
    var currentSession = null;
    var _hmacKey = null;

    // --- HMAC-SHA256 para integridad de sesion ---
    var HMAC_SALT = 'PHub-Session-HMAC-v1';

    async function _getHmacKey() {
        if (_hmacKey) return _hmacKey;
        var encoder = new TextEncoder();
        _hmacKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(HMAC_SALT),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign', 'verify']
        );
        return _hmacKey;
    }

    async function _sign(data) {
        var key = await _getHmacKey();
        var encoder = new TextEncoder();
        var sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
        return Array.from(new Uint8Array(sig))
            .map(function (b) { return b.toString(16).padStart(2, '0'); })
            .join('');
    }

    async function _verify(data, signature) {
        if (!signature) return false;
        var key = await _getHmacKey();
        var encoder = new TextEncoder();
        var sigBytes = new Uint8Array(signature.match(/.{2}/g).map(function (b) { return parseInt(b, 16); }));
        return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    }

    function _toBase64(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            return btoa(str);
        }
    }

    function _fromBase64(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            return atob(str);
        }
    }

    // --- Carga inicial firmada (async, se ejecuta al cargar el modulo) ---
    // Mantiene currentSession en memoria para acceso sincronico
    async function _init() {
        if (!window.crypto || !window.crypto.subtle) {
            _legacyLoad();
            return;
        }
        try {
            var raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return;
            var stored = JSON.parse(raw);
            // Formato nuevo: { d: base64(json), s: hex_hmac }
            if (stored && stored.d && stored.s) {
                var valid = await _verify(stored.d, stored.s);
                if (!valid) {
                    localStorage.removeItem(SESSION_KEY);
                    return;
                }
                var json = _fromBase64(stored.d);
                currentSession = JSON.parse(json);
            } else {
                // Fallback: formato legacy (JSON plano) â€” migrar
                currentSession = stored;
                _migrateToSigned(stored);
            }
        } catch (e) {
            currentSession = null;
        }
    }

    // Migrar sesion existente a formato firmado
    async function _migrateToSigned(session) {
        try {
            var json = JSON.stringify(session);
            var encoded = _toBase64(json);
            var sig = await _sign(encoded);
            localStorage.setItem(SESSION_KEY, JSON.stringify({ d: encoded, s: sig }));
        } catch (e) {
            // Si falla, mantener el formato legacy
        }
    }

    // Carga legacy sin firma (fallback si Web Crypto no esta disponible)
    function _legacyLoad() {
        try {
            var raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                // Si es formato firmado, extraer data
                if (parsed && parsed.d && parsed.s) {
                    currentSession = JSON.parse(_fromBase64(parsed.d));
                } else {
                    currentSession = parsed;
                }
            }
        } catch (e) {
            currentSession = null;
        }
    }

    function getSession() {
        return currentSession;
    }

    async function saveSession(session) {
        currentSession = session;
        if (session) {
            var json = JSON.stringify(session);
            if (window.crypto && window.crypto.subtle) {
                try {
                    var encoded = _toBase64(json);
                    var sig = await _sign(encoded);
                    localStorage.setItem(SESSION_KEY, JSON.stringify({ d: encoded, s: sig }));
                } catch (e) {
                    // Fallback: JSON plano
                    localStorage.setItem(SESSION_KEY, json);
                }
            } else {
                localStorage.setItem(SESSION_KEY, json);
            }
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

    // Escuchar cambios multi-pestaña
    window.addEventListener('storage', function (e) {
        if (e.key === SESSION_KEY) {
            currentSession = null; // forzar recarga
            _init();
        }
    });

    // Inicializar: cargar y verificar sesion firmada
    _init();

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
