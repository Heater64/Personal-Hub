// services/firestore/firestore.service.js
// Capa de abstracción sobre Firestore
// Provee helpers tipados para CRUD y lecturas de configuración

var FirestoreService = (function () {

    function getDB() {
        return window.db || null;
    }

    function getUserUid() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        return user ? user.uid : null;
    }

    // ==========================================
    // OPERACIONES CRUD GENÉRICAS
    // ==========================================

    async function getDoc(collection, docId) {
        var db = getDB();
        if (!db) return null;
        try {
            var snap = await db.collection(collection).doc(docId).get();
            return snap.exists ? snap.data() : null;
        } catch (err) {
            console.warn('[FirestoreService] getDoc error:', collection, docId, err);
            return null;
        }
    }

    async function setDoc(collection, docId, data, merge) {
        var db = getDB();
        if (!db) return false;
        try {
            var opts = merge !== false ? { merge: true } : undefined;
            await db.collection(collection).doc(docId).set(data, opts);
            return true;
        } catch (err) {
            console.warn('[FirestoreService] setDoc error:', collection, docId, err);
            return false;
        }
    }

    async function updateDoc(collection, docId, data) {
        var db = getDB();
        if (!db) return false;
        try {
            await db.collection(collection).doc(docId).update(data);
            return true;
        } catch (err) {
            console.warn('[FirestoreService] updateDoc error:', collection, docId, err);
            return false;
        }
    }

    async function deleteDoc(collection, docId) {
        var db = getDB();
        if (!db) return false;
        try {
            await db.collection(collection).doc(docId).delete();
            return true;
        } catch (err) {
            console.warn('[FirestoreService] deleteDoc error:', collection, docId, err);
            return false;
        }
    }

    async function addDoc(collection, data) {
        var db = getDB();
        if (!db) return null;
        try {
            var ref = await db.collection(collection).add(data);
            return ref.id;
        } catch (err) {
            console.warn('[FirestoreService] addDoc error:', collection, err);
            return null;
        }
    }

    async function getDocs(collection) {
        var db = getDB();
        if (!db) return [];
        try {
            var snap = await db.collection(collection).get();
            var results = [];
            snap.forEach(function (doc) {
                results.push({ id: doc.id, ...doc.data() });
            });
            return results;
        } catch (err) {
            console.warn('[FirestoreService] getDocs error:', collection, err);
            return [];
        }
    }

    function onSnapshot(collection, docId, callback) {
        var db = getDB();
        if (!db || typeof callback !== 'function') return function () {};
        return db.collection(collection).doc(docId).onSnapshot(
            function (snap) {
                callback(snap.exists ? snap.data() : null);
            },
            function (err) {
                console.warn('[FirestoreService] onSnapshot error:', collection, docId, err);
                callback(null);
            }
        );
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        getDB: getDB,
        getUserUid: getUserUid,
        getDoc: getDoc,
        setDoc: setDoc,
        updateDoc: updateDoc,
        deleteDoc: deleteDoc,
        addDoc: addDoc,
        getDocs: getDocs,
        onSnapshot: onSnapshot
    };

})();

if (typeof window !== 'undefined') {
    window.FirestoreService = FirestoreService;
}

console.log('📁 firestore.service.js cargado');
