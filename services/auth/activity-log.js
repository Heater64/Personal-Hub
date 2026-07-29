// services/auth/activity-log.js
// Registro de actividad (solo visible para admin) via Supabase

var ActivityLog = (function () {
    var TABLE = 'activity_log';

    function getUid() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user ? user.uid || user.id : null;
    }

    async function log(action, userId, details) {
        try {
            await SupabaseClient.insert(TABLE, {
                action: action,
                user_id: userId || getUid() || '',
                details: details || '',
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent.slice(0, 200)
            });
        } catch (e) {}
    }

    async function getRecent(limit) {
        limit = limit || 50;
        try {
            return await SupabaseClient.get(TABLE, {
                order: 'timestamp.desc',
                limit: limit
            });
        } catch (e) {
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
