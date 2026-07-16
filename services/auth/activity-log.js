// services/auth/activity-log.js
// Registro de actividad (solo visible para admin)

var ActivityLog = (function () {
    var COLLECTION = 'activityLog';

    function getDB() {
        return window.db || null;
    }

    async function log(action, userId, details) {
        var db = getDB();
        if (!db) return;

        try {
            await db.collection(COLLECTION).add({
                action: action,
                userId: userId || '',
                details: details || '',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent.slice(0, 200)
            });
        } catch (e) {
            console.warn('[ActivityLog] Error:', e);
        }
    }

    async function getRecent(limit) {
        if (!PermissionService.canViewActivityLog()) {
            return [];
        }

        var db = getDB();
        if (!db) return [];

        try {
            var snap = await db.collection(COLLECTION)
                .orderBy('timestamp', 'desc')
                .limit(limit || 50)
                .get();

            var entries = [];
            snap.forEach(function (doc) {
                entries.push({ id: doc.id, ...doc.data() });
            });
            return entries;
        } catch (e) {
            console.warn('[ActivityLog] Error:', e);
            return [];
        }
    }

    function formatAction(action) {
        var map = {
            'login': 'Inicio de sesión',
            'logout': 'Cierre de sesión',
            'user_created': 'Usuario creado',
            'user_deleted': 'Usuario eliminado',
            'user_updated': 'Usuario actualizado',
            'user_enabled': 'Usuario activado',
            'user_disabled': 'Usuario desactivado',
            'password_changed': 'Contraseña cambiada',
            'role_changed': 'Rol cambiado'
        };
        return map[action] || action;
    }

    return {
        log: log,
        getRecent: getRecent,
        formatAction: formatAction
    };
})();

if (typeof window !== 'undefined') {
    window.ActivityLog = ActivityLog;
}
