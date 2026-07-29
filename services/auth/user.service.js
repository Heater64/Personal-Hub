// services/auth/user.service.js
// CRUD de usuarios via Supabase y SessionManager
// Los usuarios autenticados se gestionan via Supabase Auth

var UserService = (function () {
    var TABLE = 'user_profiles';

    function requireAdmin() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!user || !(user.role === 'admin' || user.email === 'admin@personalhub.com')) {
            throw new Error('Solo el administrador puede gestionar usuarios.');
        }
    }

    // ==========================================
    // LISTAR USUARIOS
    // ==========================================

    async function listUsers() {
        try {
            var users = await SupabaseClient.get(TABLE, { order: 'created_at.desc' });
            return users.map(function (u) {
                return {
                    id: u.id,
                    username: u.username || '',
                    name: u.name || '',
                    email: u.email || '',
                    photo: u.photo || '',
                    role: u.role || 'user',
                    enabled: u.enabled !== false,
                    createdAt: u.created_at || '',
                    lastLogin: u.last_login || '',
                    preferences: u.preferences || {},
                    profile: u.profile || {}
                };
            });
        } catch (e) {
            return [];
        }
    }

    // ==========================================
    // CREAR USUARIO
    // ==========================================

    async function createUser(userData) {
        requireAdmin();
        if (!userData.username || !userData.password) {
            throw new Error('Usuario y contraseña son obligatorios.');
        }

        // Note: Real user creation should be done via Supabase Auth admin API
        // For now, we store the profile locally
        var now = new Date().toISOString();
        var profile = {
            username: userData.username.trim().toLowerCase(),
            email: userData.email || userData.username + '@personalhub.local',
            name: userData.name || userData.username,
            photo: userData.photo || '',
            role: userData.role || 'user',
            enabled: userData.enabled !== false,
            created_at: now,
            last_login: '',
            preferences: userData.preferences || { theme: 'dark', accessibility: {} },
            profile: userData.profile || {}
        };

        var result = await SupabaseClient.insert(TABLE, profile);
        if (!result || result.length === 0) throw new Error('Error al crear usuario');

        if (typeof ActivityLog !== 'undefined') {
            var admin = typeof SessionManager !== 'undefined' ? SessionManager.getUid() : null;
            ActivityLog.log('user_created', admin, 'Usuario creado: ' + profile.username);
        }

        return result[0];
    }

    // ==========================================
    // ACTUALIZAR USUARIO
    // ==========================================

    async function updateUser(userId, updates) {
        requireAdmin();
        var ok = await SupabaseClient.update(TABLE, updates, { eq: { id: userId } });
        if (!ok) throw new Error('Error al actualizar usuario');

        if (typeof ActivityLog !== 'undefined') {
            var admin = typeof SessionManager !== 'undefined' ? SessionManager.getUid() : null;
            var changes = Object.keys(updates).join(', ');
            ActivityLog.log('user_updated', admin, 'Usuario actualizado: ' + changes);
        }
        return true;
    }

    // ==========================================
    // ELIMINAR USUARIO
    // ==========================================

    async function deleteUser(userId) {
        requireAdmin();
        // Cannot delete yourself
        var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (currentUser && currentUser.uid === userId) {
            throw new Error('No puedes eliminarte a ti mismo.');
        }

        var ok = await SupabaseClient.delete(TABLE, { eq: { id: userId } });
        if (!ok) throw new Error('Error al eliminar usuario');

        if (typeof ActivityLog !== 'undefined') {
            var admin = typeof SessionManager !== 'undefined' ? SessionManager.getUid() : null;
            ActivityLog.log('user_deleted', admin, 'Usuario eliminado: ' + userId);
        }
        return true;
    }

    // ==========================================
    // CAMBIAR ESTADO (activar/desactivar)
    // ==========================================

    async function setEnabled(userId, enabled) {
        requireAdmin();
        return await updateUser(userId, { enabled: enabled });
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        listUsers: listUsers,
        createUser: createUser,
        updateUser: updateUser,
        deleteUser: deleteUser,
        setEnabled: setEnabled
    };
})();

if (typeof window !== 'undefined') {
    window.UserService = UserService;
}
