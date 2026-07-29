// services/progress/progress.service.js
// Gestión centralizada de progreso de usuario en Supabase
// Tabla: user_progress (user_id, type, data, updated_at)

var ProgressService = (function () {

    function getUserId() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user ? user.uid || user.id : null;
    }

    // ==========================================
    // PROGRESO GENÉRICO
    // ==========================================

    async function loadProgress(type) {
        var uid = getUserId();
        if (!uid) return null;
        try {
            var row = await SupabaseClient.getOne('user_progress', {
                eq: { user_id: uid, type: type }
            });
            return row ? row.data : null;
        } catch (e) { return null; }
    }

    async function saveProgress(type, data) {
        var uid = getUserId();
        if (!uid) return false;
        try {
            await SupabaseClient.upsert('user_progress', {
                user_id: uid,
                type: type,
                data: data,
                updated_at: new Date().toISOString()
            }, 'user_id,type');
            return true;
        } catch (e) { return false; }
    }

    // ==========================================
    // PREFERENCIAS DEL SIDEBAR
    // ==========================================

    async function loadSidebarPrefs() {
        var uid = getUserId();
        if (!uid) return null;
        try {
            var user = await SupabaseClient.getOne('user_profiles', {
                eq: { id: uid }
            });
            return user ? (user.preferences?.sidebar || null) : null;
        } catch (e) { return null; }
    }

    async function saveSidebarPrefs(prefs) {
        var uid = getUserId();
        if (!uid) return false;
        try {
            await SupabaseClient.update('user_profiles', {
                preferences: { sidebar: prefs }
            }, { eq: { id: uid } });
            return true;
        } catch (e) { return false; }
    }

    // ==========================================
    // CALENDARIO
    // ==========================================

    async function loadCalendarProgress() {
        var data = await loadProgress('calendar');
        return data || {};
    }

    async function saveCalendarProgress(progress) {
        return await saveProgress('calendar', progress);
    }

    // ==========================================
    // SERIES
    // ==========================================

    async function loadSeriesProgress() {
        var data = await loadProgress('series');
        return data || { data: {} };
    }

    async function saveSeriesProgress(progress) {
        return await saveProgress('series', progress);
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        loadProgress: loadProgress,
        saveProgress: saveProgress,
        loadSidebarPrefs: loadSidebarPrefs,
        saveSidebarPrefs: saveSidebarPrefs,
        loadCalendarProgress: loadCalendarProgress,
        saveCalendarProgress: saveCalendarProgress,
        loadSeriesProgress: loadSeriesProgress,
        saveSeriesProgress: saveSeriesProgress
    };
})();

if (typeof window !== 'undefined') {
    window.ProgressService = ProgressService;
}
