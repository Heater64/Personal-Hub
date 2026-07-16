// services/progress/progress.service.js
// Gestión centralizada de progreso de usuario en Firestore
// Patrón: users/{uid}/progress/{type}

var ProgressService = (function () {

    var uid = null;

    function getUserUid() {
        if (uid) return uid;
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        uid = user ? user.uid : null;
        return uid;
    }

    function resetUid() { uid = null; }

    // ==========================================
    // PROGRESO GENÉRICO
    // ==========================================

    async function loadProgress(type) {
        var uid = getUserUid();
        if (!uid) return null;
        return await FirestoreService.getDoc('users/' + uid + '/progress', type);
    }

    async function saveProgress(type, data) {
        var uid = getUserUid();
        if (!uid) return false;
        return await FirestoreService.setDoc('users/' + uid + '/progress', type, data);
    }

    // ==========================================
    // CALENDARIO
    // ==========================================

    async function loadCalendarProgress() {
        var data = await loadProgress('calendar');
        return data && data.gifts ? data.gifts : {};
    }

    async function saveCalendarProgress(gifts) {
        return await saveProgress('calendar', {
            gifts: gifts,
            updatedAt: new Date().toISOString()
        });
    }

    // ==========================================
    // SERIES
    // ==========================================

    async function loadSeriesProgress() {
        var data = await loadProgress('series');
        return data && data.items ? data.items : {};
    }

    async function saveSeriesProgress(items) {
        return await saveProgress('series', {
            items: items,
            updatedAt: new Date().toISOString()
        });
    }

    // ==========================================
    // PREFERENCIAS (sidebar)
    // ==========================================

    async function loadSidebarPreferences() {
        var uid = getUserUid();
        if (!uid) return null;
        return await FirestoreService.getDoc('users/' + uid + '/preferences', 'sidebar');
    }

    async function saveSidebarPreferences(prefs) {
        var uid = getUserUid();
        if (!uid) return false;
        return await FirestoreService.setDoc('users/' + uid + '/preferences', 'sidebar', prefs);
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        loadProgress: loadProgress,
        saveProgress: saveProgress,
        loadCalendarProgress: loadCalendarProgress,
        saveCalendarProgress: saveCalendarProgress,
        loadSeriesProgress: loadSeriesProgress,
        saveSeriesProgress: saveSeriesProgress,
        loadSidebarPreferences: loadSidebarPreferences,
        saveSidebarPreferences: saveSidebarPreferences,
        resetUid: resetUid
    };

})();

if (typeof window !== 'undefined') {
    window.ProgressService = ProgressService;
}

console.log('📁 progress.service.js cargado');
