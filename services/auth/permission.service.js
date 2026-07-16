// services/auth/permission.service.js
// Servicio centralizado de permisos
// Todas las comprobaciones de permisos pasan por aquí

var PermissionService = (function () {

    var PERMISSIONS = {
        admin: [
            'access_admin',
            'manage_users',
            'manage_content',
            'edit_songs',
            'edit_news',
            'edit_reasons',
            'edit_gifts',
            'edit_series',
            'edit_maldia',
            'view_analytics',
            'view_activity_log',
            'view_passwords',
            'manage_passwords',
            'delete_content'
        ],
        user: [
            'access_app',
            'edit_profile',
            'edit_preferences'
        ]
    };

    function getRole() {
        return SessionManager.getRole() || 'user';
    }

    function getPermissions() {
        var role = getRole();
        return PERMISSIONS[role] || PERMISSIONS.user;
    }

    function hasPermission(permission) {
        var perms = getPermissions();
        return perms.indexOf(permission) !== -1;
    }

    function requirePermission(permission) {
        if (!hasPermission(permission)) {
            throw new Error('Permiso denegado: ' + permission);
        }
        return true;
    }

    // ==========================================
    // PERMISOS ESPECÍFICOS
    // ==========================================

    function canAccessAdmin() {
        return hasPermission('access_admin');
    }

    function canManageUsers() {
        return hasPermission('manage_users');
    }

    function canManageContent() {
        return hasPermission('manage_content');
    }

    function canEditSongs() {
        return hasPermission('edit_songs');
    }

    function canEditNews() {
        return hasPermission('edit_news');
    }

    function canEditReasons() {
        return hasPermission('edit_reasons');
    }

    function canEditGifts() {
        return hasPermission('edit_gifts');
    }

    function canEditSeries() {
        return hasPermission('edit_series');
    }

    function canEditMaldia() {
        return hasPermission('edit_maldia');
    }

    function canViewAnalytics() {
        return hasPermission('view_analytics');
    }

    function canViewActivityLog() {
        return hasPermission('view_activity_log');
    }

    function canViewPasswords() {
        return hasPermission('view_passwords');
    }

    function canManagePasswords() {
        return hasPermission('manage_passwords');
    }

    function canDeleteContent() {
        return hasPermission('delete_content');
    }

    function canEditProfile() {
        return hasPermission('edit_profile');
    }

    function canEditPreferences() {
        return hasPermission('edit_preferences');
    }

    return {
        hasPermission: hasPermission,
        requirePermission: requirePermission,
        getRole: getRole,
        getPermissions: getPermissions,
        canAccessAdmin: canAccessAdmin,
        canManageUsers: canManageUsers,
        canManageContent: canManageContent,
        canEditSongs: canEditSongs,
        canEditNews: canEditNews,
        canEditReasons: canEditReasons,
        canEditGifts: canEditGifts,
        canEditSeries: canEditSeries,
        canEditMaldia: canEditMaldia,
        canViewAnalytics: canViewAnalytics,
        canViewActivityLog: canViewActivityLog,
        canViewPasswords: canViewPasswords,
        canManagePasswords: canManagePasswords,
        canDeleteContent: canDeleteContent,
        canEditProfile: canEditProfile,
        canEditPreferences: canEditPreferences
    };
})();

if (typeof window !== 'undefined') {
    window.PermissionService = PermissionService;
}
