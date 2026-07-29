// services/analytics/analytics.js
// Analíticas de página via Supabase

var Analytics = (function () {
    var SESSION_KEY = 'personalHub.sessionId';
    var VISIT_COOLDOWN = 30000;
    var lastVisit = 0;

    function getSessionId() {
        var sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    function getPageName() {
        var path = window.location.pathname;
        var page = path.split('/').pop() || 'index';
        return page.replace('.html', '');
    }

    function getUserId() {
        var user = (typeof SessionManager !== 'undefined') ? SessionManager.getUserObject() : null;
        return user ? user.uid : null;
    }

    async function trackVisit() {
        var now = Date.now();
        if (now - lastVisit < VISIT_COOLDOWN) return;
        lastVisit = now;

        var uid = getUserId();
        if (!uid || typeof SupabaseClient === 'undefined') return;

        try {
            await SupabaseClient.insert('analytics_visits', {
                user_id: uid,
                page: getPageName(),
                session_id: getSessionId(),
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent.slice(0, 200)
            });
        } catch (e) {
            if (window.SyncQueue) {
                window.SyncQueue.enqueue('insert', 'analytics_visits', {
                    user_id: uid,
                    page: getPageName(),
                    session_id: getSessionId(),
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    async function trackEvent(category, action, label) {
        var uid = getUserId();
        if (!uid || typeof SupabaseClient === 'undefined') return;
        try {
            await SupabaseClient.insert('analytics_events', {
                user_id: uid,
                category: category,
                action: action,
                label: label || '',
                page: getPageName(),
                timestamp: new Date().toISOString()
            });
        } catch (e) {}
    }

    async function trackAction(action, details) {
        var uid = getUserId();
        if (!uid || typeof SupabaseClient === 'undefined') return;
        try {
            await SupabaseClient.insert('admin_actions', {
                user_id: uid,
                action: action,
                details: details || '',
                timestamp: new Date().toISOString()
            });
        } catch (e) {}
    }

    function initAutoTracking() {
        if (document.readyState === 'complete') { trackVisit(); }
        else { window.addEventListener('load', trackVisit); }
    }

    initAutoTracking();

    return { trackVisit: trackVisit, trackEvent: trackEvent, trackAction: trackAction };
})();

if (typeof window !== 'undefined') { window.Analytics = Analytics; }
