var GameSession = (function () {
    var SESSIONS_COLLECTION = 'gameSessions';
    var activeSession = null;
    var unsubscribe = null;
    var listeners = [];

    function getCurrentUid() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user ? user.uid : null;
    }

    async function createSession(gameId, config) {
        var uid = getCurrentUid();
        if (!uid || !window.db) return null;

        try {
            var session = {
                gameId: gameId,
                status: 'waiting',
                players: [{
                    uid: uid,
                    joinedAt: new Date().toISOString()
                }],
                state: config || {},
                currentTurn: uid,
                turnOrder: [uid],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            var ref = await window.db.collection(SESSIONS_COLLECTION).add(session);
            session.id = ref.id;
            activeSession = session;
            return session;
        } catch (e) {
            console.error('Error creando sesión:', e);
            return null;
        }
    }

    async function joinSession(sessionId) {
        var uid = getCurrentUid();
        if (!uid || !window.db) return null;

        try {
            var doc = await window.db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
            if (!doc.exists) return null;

            var session = { id: doc.id, ...doc.data() };
            if (session.status !== 'waiting') return null;
            if (session.players.length >= 2) return null;
            if (session.players.find(function (p) { return p.uid === uid; })) return session;

            session.players.push({
                uid: uid,
                joinedAt: new Date().toISOString()
            });
            session.turnOrder.push(uid);
            session.status = 'playing';
            session.updatedAt = new Date().toISOString();

            await window.db.collection(SESSIONS_COLLECTION).doc(sessionId).update({
                players: session.players,
                turnOrder: session.turnOrder,
                status: session.status,
                updatedAt: session.updatedAt
            });

            activeSession = session;
            return session;
        } catch (e) {
            console.error('Error uniéndose a sesión:', e);
            return null;
        }
    }

    async function updateGameState(sessionId, newState) {
        var uid = getCurrentUid();
        if (!uid || !window.db) return false;

        try {
            await window.db.collection(SESSIONS_COLLECTION).doc(sessionId).update({
                state: newState,
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (e) {
            console.error('Error actualizando estado:', e);
            return false;
        }
    }

    async function endTurn(sessionId, newState) {
        var uid = getCurrentUid();
        if (!uid || !window.db || !activeSession) return false;

        try {
            var currentIndex = activeSession.turnOrder.indexOf(uid);
            var nextIndex = (currentIndex + 1) % activeSession.turnOrder.length;
            var nextTurn = activeSession.turnOrder[nextIndex];

            var update = {
                state: newState || activeSession.state,
                currentTurn: nextTurn,
                updatedAt: new Date().toISOString()
            };

            await window.db.collection(SESSIONS_COLLECTION).doc(sessionId).update(update);
            activeSession.currentTurn = nextTurn;
            if (newState) activeSession.state = newState;
            return true;
        } catch (e) {
            console.error('Error terminando turno:', e);
            return false;
        }
    }

    async function endSession(sessionId, winner) {
        if (!window.db) return;
        try {
            var update = {
                status: 'finished',
                winner: winner || null,
                updatedAt: new Date().toISOString()
            };
            await window.db.collection(SESSIONS_COLLECTION).doc(sessionId).update(update);
            if (activeSession && activeSession.id === sessionId) {
                activeSession.status = 'finished';
            }
        } catch (e) {
            console.error('Error terminando sesión:', e);
        }
    }

    function subscribeToSession(sessionId, callback) {
        listeners.push(callback);
        if (!window.db) return function () {};

        if (unsubscribe) unsubscribe();

        unsubscribe = window.db.collection(SESSIONS_COLLECTION).doc(sessionId)
            .onSnapshot(function (doc) {
                if (doc.exists) {
                    var data = { id: doc.id, ...doc.data() };
                    activeSession = data;
                    listeners.forEach(function (cb) { try { cb(data); } catch (e) {} });
                }
            }, function (err) {
                console.warn('Error en sesión snapshot:', err);
            });

        return function () {
            listeners = listeners.filter(function (l) { return l !== callback; });
        };
    }

    function getActiveSession() {
        return activeSession;
    }

    function isMyTurn() {
        var uid = getCurrentUid();
        return activeSession && activeSession.currentTurn === uid;
    }

    function disconnect() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        activeSession = null;
        listeners = [];
    }

    return {
        createSession: createSession,
        joinSession: joinSession,
        updateGameState: updateGameState,
        endTurn: endTurn,
        endSession: endSession,
        subscribeToSession: subscribeToSession,
        getActiveSession: getActiveSession,
        isMyTurn: isMyTurn,
        disconnect: disconnect
    };
})();

if (typeof window !== 'undefined') {
    window.GameSession = GameSession;
}
