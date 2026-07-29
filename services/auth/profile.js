// services/auth/profile.js
// Gestión de perfiles de usuario via Supabase

var ProfileSystem = {};

ProfileSystem.ensureProfile = async function(user) {
    if (!user) return null;
    try {
        var uid = user.uid || user.id || user.sub;
        if (!uid) return null;
        var existing = await SupabaseClient.getOne('user_profiles', { eq: { id: uid } });
        if (existing) {
            await SupabaseClient.update('user_profiles', { last_login: new Date().toISOString() }, { eq: { id: uid } });
            return existing;
        }
        var isAdmin = typeof isAdminUser === 'function' && isAdminUser(user);
        var profile = {
            id: uid, email: user.email || '',
            name: user.name || user.displayName || user.username || (user.email ? user.email.split('@')[0] : ''),
            photo: user.photo || user.photoURL || '',
            role: isAdmin ? 'admin' : (user.role || 'user'),
            enabled: true,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            preferences: { sidebar: { hiddenSections: [] } },
            progress: { calendar: {}, games: {} }
        };
        await SupabaseClient.upsert('user_profiles', profile, 'id');
        await ProfileSystem.migrateLocalData(uid);
        return profile;
    } catch (err) { return null; }
};

ProfileSystem.migrateLocalData = async function(uid) {
    var migrated = [];
    try {
        var savedProgress = localStorage.getItem('personalHub.giftProgress');
        if (savedProgress) {
            await SupabaseClient.upsert('user_progress', {
                user_id: uid, type: 'calendar',
                data: { gifts: JSON.parse(savedProgress) },
                updated_at: new Date().toISOString()
            }, 'user_id,type');
            migrated.push('calendarProgress');
        }
    } catch (err) {}
    try {
        var seriesProgress = localStorage.getItem('seriesProgress');
        if (seriesProgress) {
            await SupabaseClient.upsert('user_progress', {
                user_id: uid, type: 'series',
                data: { data: JSON.parse(seriesProgress) },
                updated_at: new Date().toISOString()
            }, 'user_id,type');
            migrated.push('seriesProgress');
        }
    } catch (err) {}
    return migrated;
};

ProfileSystem.loadProgress = async function(uid, type) {
    if (!uid) return null;
    try {
        var row = await SupabaseClient.getOne('user_progress', { eq: { user_id: uid, type: type } });
        return row ? row.data : null;
    } catch (err) { return null; }
};

ProfileSystem.saveProgress = async function(uid, type, data) {
    if (!uid) return;
    try { await SupabaseClient.upsert('user_progress', { user_id: uid, type: type, data: data, updated_at: new Date().toISOString() }, 'user_id,type'); } catch (err) {}
};

ProfileSystem.loadPreferences = async function(uid) {
    if (!uid) return null;
    try {
        var row = await SupabaseClient.getOne('user_profiles', { eq: { id: uid } });
        return row ? row.preferences || null : null;
    } catch (err) { return null; }
};

ProfileSystem.savePreferences = async function(uid, prefs) {
    if (!uid) return;
    try { await SupabaseClient.update('user_profiles', { preferences: prefs }, { eq: { id: uid } }); } catch (err) {}
};

ProfileSystem.actualizarFoto = async function(uid, base64) {
    if (!uid) return false;
    try {
        await SupabaseClient.update('user_profiles', { photo: base64 }, { eq: { id: uid } });
        if (typeof window.Haptica !== 'undefined') window.Haptica.exito();
        return true;
    } catch (err) { return false; }
};

ProfileSystem.actualizarNombre = async function(uid, nombre) {
    if (!uid) return false;
    try {
        await SupabaseClient.update('user_profiles', { name: nombre }, { eq: { id: uid } });
        if (typeof window.Haptica !== 'undefined') window.Haptica.exito();
        return true;
    } catch (err) { return false; }
};

if (typeof window !== 'undefined') { window.ProfileSystem = ProfileSystem; }
