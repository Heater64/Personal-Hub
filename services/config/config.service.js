// services/config/config.service.js
// Lectura centralizada de datos de configuración desde Firestore
// Cada función es un singleton que cachea el resultado

var ConfigService = (function () {

    var cache = {};

    async function loadConfig(collection, docId) {
        var key = collection + '/' + docId;
        if (cache[key]) return cache[key];
        var data = await FirestoreService.getDoc(collection, docId);
        if (data) cache[key] = data;
        return data;
    }

    function clearCache(key) {
        if (key) delete cache[key];
        else cache = {};
    }

    // ==========================================
    // CONFIG COLLECTIONS
    // ==========================================

    async function loadNews() {
        var data = await loadConfig('config_noticias', 'data');
        return data && data.news ? data.news : [];
    }

    async function loadSongs() {
        var data = await loadConfig('config_canciones_recuerdan', 'data');
        return data && data.songs ? data.songs : [];
    }

    async function loadReasons() {
        var data = await loadConfig('config_razones', 'data');
        return data && data.reasons ? data.reasons : [];
    }

    async function loadGifts() {
        var data = await loadConfig('config_gifts', 'catalog');
        return data && data.gifts ? data.gifts : [];
    }

    async function loadMaldiaPhrases() {
        var data = await loadConfig('config_maldia_frases', 'data');
        return data && data.phrases ? data.phrases : [];
    }

    async function loadMaldiaMessages() {
        var data = await loadConfig('config_maldia_mensajes', 'data');
        return data && data.messages ? data.messages : [];
    }

    async function loadPodio() {
        var data = await loadConfig('config', 'podio');
        return data || { series: [], movies: [] };
    }

    async function loadSeriesData() {
        var data = await loadConfig('seriesData', 'all');
        return data && data.items ? data.items : [];
    }

    // ==========================================
    // CHANGELOG / NOVEDADES (sistema de actualizaciones)
    // ==========================================
    async function loadChangelog() {
        var data = await loadConfig('config_changelog', 'data');
        return data && data.items ? data.items : [];
    }

    // ==========================================
    // NOTIFICACIONES (in-app, desde Firestore)
    // ==========================================
    async function loadNotifications() {
        var data = await loadConfig('config_notificaciones', 'data');
        return data && data.items ? data.items : [];
    }

    // ==========================================
    // WRITE CONFIG (admin)
    // ==========================================

    async function saveReasons(reasons) {
        var ok = await FirestoreService.setDoc('config_razones', 'data', { reasons: reasons });
        if (ok) clearCache('config_razones/data');
        return ok;
    }

    async function saveSongs(songs) {
        var ok = await FirestoreService.setDoc('config_canciones_recuerdan', 'data', { songs: songs });
        if (ok) clearCache('config_canciones_recuerdan/data');
        return ok;
    }

    async function saveNews(news) {
        var ok = await FirestoreService.setDoc('config_noticias', 'data', { news: news });
        if (ok) clearCache('config_noticias/data');
        return ok;
    }

    async function saveMaldiaPhrases(phrases) {
        var ok = await FirestoreService.setDoc('config_maldia_frases', 'data', { phrases: phrases });
        if (ok) clearCache('config_maldia_frases/data');
        return ok;
    }

    async function saveMaldiaMessages(messages) {
        var ok = await FirestoreService.setDoc('config_maldia_mensajes', 'data', { messages: messages });
        if (ok) clearCache('config_maldia_mensajes/data');
        return ok;
    }

    async function savePodio(podio) {
        var ok = await FirestoreService.setDoc('config', 'podio', podio);
        if (ok) clearCache('config/podio');
        return ok;
    }

    async function saveChangelog(items) {
        var ok = await FirestoreService.setDoc('config_changelog', 'data', { items: items });
        if (ok) clearCache('config_changelog/data');
        return ok;
    }

    async function saveNotifications(items) {
        var ok = await FirestoreService.setDoc('config_notificaciones', 'data', { items: items });
        if (ok) clearCache('config_notificaciones/data');
        return ok;
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        loadNews: loadNews,
        loadSongs: loadSongs,
        loadReasons: loadReasons,
        loadGifts: loadGifts,
        loadMaldiaPhrases: loadMaldiaPhrases,
        loadMaldiaMessages: loadMaldiaMessages,
        loadPodio: loadPodio,
        loadSeriesData: loadSeriesData,
        loadChangelog: loadChangelog,
        loadNotifications: loadNotifications,
        saveReasons: saveReasons,
        saveSongs: saveSongs,
        saveNews: saveNews,
        saveMaldiaPhrases: saveMaldiaPhrases,
        saveMaldiaMessages: saveMaldiaMessages,
        savePodio: savePodio,
        saveChangelog: saveChangelog,
        saveNotifications: saveNotifications,
        clearCache: clearCache
    };

})();

if (typeof window !== 'undefined') {
    window.ConfigService = ConfigService;
}

console.log('📁 config.service.js cargado');
