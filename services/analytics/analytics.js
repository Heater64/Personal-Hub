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

    async function trackVisit() {
        var now = Date.now();
        if (now - lastVisit < VISIT_COOLDOWN) return;
        lastVisit = now;

        var uid = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!uid || !window.db) return;

        try {
            var sessionId = getSessionId();
            var page = getPageName();
            await window.db.collection('users').doc(uid.uid).collection('analytics').add({
                type: 'pageview',
                page: page,
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent.slice(0, 200)
            });
        } catch (e) {
            if (window.SyncQueue) {
                window.SyncQueue.enqueue('add', 'stats_visits', Date.now().toString(), {
                    page: getPageName(),
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    async function trackEvent(category, action, label) {
        var uid = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!uid || !window.db) return;

        try {
            await window.db.collection('stats_sessions').add({
                uid: uid.uid,
                category: category,
                action: action,
                label: label || '',
                page: getPageName(),
                timestamp: new Date().toISOString()
            });
        } catch (e) {}
    }

    async function trackAction(action, details) {
        var uid = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!uid || !window.db) return;

        try {
            await window.db.collection('stats_admin_actions').add({
                uid: uid.uid,
                action: action,
                details: details || '',
                timestamp: new Date().toISOString()
            });
        } catch (e) {}
    }

    function initAutoTracking() {
        if (document.readyState === 'complete') {
            trackVisit();
        } else {
            window.addEventListener('load', trackVisit);
        }
    }

    initAutoTracking();

    return {
        trackVisit: trackVisit,
        trackEvent: trackEvent,
        trackAction: trackAction
    };
})();

if (typeof window !== 'undefined') {
    window.Analytics = Analytics;
}
