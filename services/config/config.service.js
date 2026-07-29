// services/config/config.service.js
// Lectura centralizada de datos de configuración desde Supabase
// Almacenamiento: tabla 'content' con columnas id (text PK) y data (jsonb)

var ConfigService = (function () {

    var cache = {};
    var TABLE = 'content';

    async function loadConfig(id) {
        if (cache[id]) return cache[id];
        var row = await SupabaseClient.getOne(TABLE, { eq: { id: id } });
        if (row && row.data) {
            cache[id] = row.data;
            return row.data;
        }
        return null;
    }

    function clearCache(key) {
        if (key) delete cache[key];
        else cache = {};
    }

    // Fallback a datos locales si Supabase no responde
    function lsGet(key, fallback) {
        try {
            var raw = localStorage.getItem('ph.config.' + key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }

    function lsSet(key, data) {
        try { localStorage.setItem('ph.config.' + key, JSON.stringify(data)); } catch (e) {}
    }

    async function saveConfig(id, data) {
        var ok = await SupabaseClient.upsert(TABLE, { id: id, data: data, updated_at: new Date().toISOString() }, 'id');
        if (ok) {
            cache[id] = data;
            lsSet(id, data);
        }
        return ok;
    }

    // ==========================================
    // CONFIG COLLECTIONS
    // ==========================================

    async function loadNews() {
        var data = await loadConfig('noticias') || lsGet('noticias', {});
        return data.news || [];
    }

    async function loadSongs() {
        var data = await loadConfig('canciones') || lsGet('canciones', {});
        return data.songs || [];
    }

    async function loadReasons() {
        var data = await loadConfig('razones') || lsGet('razones', {});
        return data.reasons || [];
    }

    async function loadGifts() {
        var data = await loadConfig('gifts') || lsGet('gifts', { gifts: [], months: {} });
        return data.gifts || [];
    }

    async function loadMaldiaPhrases() {
        var data = await loadConfig('maldia_frases') || lsGet('maldia_frases', {});
        return data.phrases || [];
    }

    async function loadMaldiaMessages() {
        var data = await loadConfig('maldia_mensajes') || lsGet('maldia_mensajes', {});
        return data.messages || [];
    }

    async function loadPodio() {
        var data = await loadConfig('podio') || lsGet('podio', {});
        return data || { series: [], movies: [] };
    }

    async function loadSeriesData() {
        var data = await loadConfig('series') || lsGet('series', {});
        return data.items || [];
    }

    async function loadChangelog() {
        var data = await loadConfig('changelog') || lsGet('changelog', {});
        return data.items || [];
    }

    async function loadNotifications() {
        var data = await loadConfig('notificaciones') || lsGet('notificaciones', {});
        return data.items || [];
    }

    // ==========================================
    // WRITE CONFIG (admin)
    // ==========================================

    async function saveReasons(reasons) {
        return await saveConfig('razones', { reasons: reasons });
    }

    async function saveSongs(songs) {
        return await saveConfig('canciones', { songs: songs });
    }

    async function saveNews(news) {
        return await saveConfig('noticias', { news: news });
    }

    async function saveMaldiaPhrases(phrases) {
        return await saveConfig('maldia_frases', { phrases: phrases });
    }

    async function saveMaldiaMessages(messages) {
        return await saveConfig('maldia_mensajes', { messages: messages });
    }

    async function savePodio(podio) {
        return await saveConfig('podio', podio);
    }

    async function saveChangelog(items) {
        return await saveConfig('changelog', { items: items });
    }

    async function saveNotifications(items) {
        return await saveConfig('notificaciones', { items: items });
    }

    async function saveGifts(data) {
        // gifts data: { gifts: [...], months: {} }
        return await saveConfig('gifts', data);
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
        saveGifts: saveGifts,
        clearCache: clearCache,
        // Raw access for other services
        loadConfig: loadConfig,
        saveConfig: saveConfig
    };

})();

if (typeof window !== 'undefined') {
    window.ConfigService = ConfigService;
}
