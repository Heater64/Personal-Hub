// services/auth/user.service.js
// CRUD de usuarios en Firestore
// Solo el admin puede gestionar usuarios

var UserService = (function () {
    var COLLECTION = 'users';

    function getDB() {
        return window.db || null;
    }

    function requireAdmin() {
        if (!PermissionService.canManageUsers()) {
            throw new Error('Solo el administrador puede gestionar usuarios.');
        }
    }

    // ==========================================
    // LISTAR USUARIOS
    // ==========================================

    async function listUsers() {
        requireAdmin();
        var db = getDB();
        if (!db) return [];

        var snap = await db.collection(COLLECTION).get();
        var users = [];
        snap.forEach(function (doc) {
            var data = doc.data();
            users.push({
                id: doc.id,
                username: data.username || '',
                name: data.name || '',
                photo: data.photo || '',
                role: data.role || 'user',
                enabled: data.enabled !== false,
                password: data.password || '',
                createdAt: data.createdAt || '',
                lastLogin: data.lastLogin || '',
                lastPasswordChange: data.lastPasswordChange || '',
                preferences: data.preferences || {},
                profile: data.profile || {}
            });
        });
        return users;
    }

    // ==========================================
    // OBTENER UN USUARIO
    // ==========================================

    async function getUser(userId) {
        requireAdmin();
        var db = getDB();
        if (!db) return null;

        var doc = await db.collection(COLLECTION).doc(userId).get();
        if (!doc.exists) return null;

        var data = doc.data();
        return {
            id: doc.id,
            username: data.username || '',
            name: data.name || '',
            photo: data.photo || '',
            role: data.role || 'user',
            enabled: data.enabled !== false,
            password: data.password || '',
            createdAt: data.createdAt || '',
            lastLogin: data.lastLogin || '',
            lastPasswordChange: data.lastPasswordChange || '',
            preferences: data.preferences || {},
            profile: data.profile || {}
        };
    }

    // ==========================================
    // CREAR USUARIO
    // ==========================================

    async function createUser(userData) {
        requireAdmin();
        var db = getDB();
        if (!db) throw new Error('Firestore no disponible');

        if (!userData.username || !userData.password) {
            throw new Error('Usuario y contraseña son obligatorios.');
        }

        // Check duplicate username
        var existing = await db.collection(COLLECTION)
            .where('username', '==', userData.username.trim().toLowerCase())
            .limit(1)
            .get();

        if (!existing.empty) {
            throw new Error('El nombre de usuario ya existe.');
        }

        var now = new Date().toISOString();
        var user = {
            username: userData.username.trim().toLowerCase(),
            name: userData.name || userData.username,
            photo: userData.photo || '',
            role: userData.role || 'user',
            enabled: userData.enabled !== false,
            password: Encryption.encrypt(userData.password),
            createdAt: now,
            lastLogin: '',
            lastPasswordChange: now,
            preferences: userData.preferences || {
                theme: 'dark',
                accessibility: {}
            },
            profile: userData.profile || {}
        };

        var ref = await db.collection(COLLECTION).add(user);

        if (typeof ActivityLog !== 'undefined') {
            var admin = SessionManager.getUid();
            ActivityLog.log('user_created', admin, 'Usuario creado: ' + user.username);
        }

        return { id: ref.id, ...user };
    }

    // ==========================================
    // ACTUALIZAR USUARIO
    // ==========================================

    async function updateUser(userId, updates) {
        requireAdmin();
        var db = getDB();
        if (!db) throw new Error('Firestore no disponible');

        // If updating username, check uniqueness
        if (updates.username) {
            var newUsername = updates.username.trim().toLowerCase();
            var existing = await db.collection(COLLECTION)
                .where('username', '==', newUsername)
                .limit(1)
                .get();

            if (!existing.empty && existing.docs[0].id !== userId) {
                throw new Error('El nombre de usuario ya existe.');
            }
            updates.username = newUsername;
        }

        // If updating password, encrypt it
        if (updates.password) {
            if (!Encryption.isEncrypted(updates.password)) {
                updates.password = Encryption.encrypt(updates.password);
            }
            updates.lastPasswordChange = new Date().toISOString();
        }

        // If updating photo, store the URL
        if (updates.photo !== undefined) {
            // Photo is already a URL from Cloudinary or similar
        }

        await db.collection(COLLECTION).doc(userId).update(updates);

        if (typeof ActivityLog !== 'undefined') {
            var admin = SessionManager.getUid();
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
        var db = getDB();
        if (!db) throw new Error('Firestore no disponible');

        var user = await getUser(userId);
        if (!user) throw new Error('Usuario no encontrado.');

        if (user.role === 'admin') {
            // Check if there are other admins
            var allUsers = await listUsers();
            var adminCount = allUsers.filter(function (u) { return u.role === 'admin'; }).length;
            if (adminCount <= 1) {
                throw new Error('No se puede eliminar el último administrador.');
            }
        }

        await db.collection(COLLECTION).doc(userId).delete();

        if (typeof ActivityLog !== 'undefined') {
            var admin = SessionManager.getUid();
            ActivityLog.log('user_deleted', admin, 'Usuario eliminado: ' + user.username);
        }

        return true;
    }

    // ==========================================
    // CAMBIAR CONTRASEÑA
    // ==========================================

    async function changePassword(userId, newPassword) {
        requireAdmin();
        if (!PermissionService.canManagePasswords()) {
            throw new Error('Sin permiso para cambiar contraseñas.');
        }
        return await updateUser(userId, { password: newPassword });
    }

    // ==========================================
    // CAMBIAR ESTADO (activar/desactivar)
    // ==========================================

    async function setEnabled(userId, enabled) {
        requireAdmin();
        var db = getDB();
        if (!db) throw new Error('Firestore no disponible');

        await db.collection(COLLECTION).doc(userId).update({
            enabled: enabled
        });

        if (typeof ActivityLog !== 'undefined') {
            var admin = SessionManager.getUid();
            var action = enabled ? 'user_enabled' : 'user_disabled';
            ActivityLog.log(action, admin, 'Usuario ' + (enabled ? 'activado' : 'desactivado'));
        }

        return true;
    }

    // ==========================================
    // CAMBIAR ROL
    // ==========================================

    async function setRole(userId, role) {
        requireAdmin();
        if (role !== 'admin' && role !== 'user') {
            throw new Error('Rol inválido.');
        }
        return await updateUser(userId, { role: role });
    }

    // ==========================================
    // DESCIFRAR CONTRASEÑA (solo admin)
    // ==========================================

    async function getPassword(userId) {
        requireAdmin();
        if (!PermissionService.canViewPasswords()) {
            throw new Error('Sin permiso para ver contraseñas.');
        }
        var user = await getUser(userId);
        if (!user) return null;

        if (Encryption.isEncrypted(user.password)) {
            return Encryption.decrypt(user.password);
        }
        return user.password;
    }

    // ==========================================
    // SEED ADMIN USER
    // ==========================================

    async function seedAdmin() {
        var db = getDB();
        if (!db) return;

        var existing = await db.collection(COLLECTION)
            .where('username', '==', 'admin')
            .limit(1)
            .get();

        if (!existing.empty) return;

        var now = new Date().toISOString();
        await db.collection(COLLECTION).add({
            username: 'admin',
            name: 'Administrador',
            photo: '',
            role: 'admin',
            enabled: true,
            password: Encryption.encrypt('admin123'),
            createdAt: now,
            lastLogin: '',
            lastPasswordChange: now,
            preferences: { theme: 'dark', accessibility: {} },
            profile: {}
        });

        console.log('✅ Admin user seeded (admin / admin123)');
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        listUsers: listUsers,
        getUser: getUser,
        createUser: createUser,
        updateUser: updateUser,
        deleteUser: deleteUser,
        changePassword: changePassword,
        setEnabled: setEnabled,
        setRole: setRole,
        getPassword: getPassword,
        seedAdmin: seedAdmin
    };
})();

if (typeof window !== 'undefined') {
    window.UserService = UserService;
}
