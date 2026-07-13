var SyncQueue = (function () {
    var queue = [];
    var processing = false;
    var STORAGE_KEY = 'personalHub.syncQueue';

    function loadQueue() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) queue = JSON.parse(saved);
        } catch (e) { queue = []; }
    }

    function saveQueue() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
        } catch (e) {}
    }

    function enqueue(action, collection, docId, data) {
        queue.push({
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            action: action,
            collection: collection,
            docId: docId,
            data: data,
            timestamp: new Date().toISOString(),
            retries: 0
        });
        saveQueue();
        processQueue();
    }

    async function processQueue() {
        if (processing || queue.length === 0) return;
        processing = true;

        while (queue.length > 0) {
            var item = queue[0];
            var uid = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!uid || !window.db) {
                processing = false;
                return;
            }

            try {
                var ref = window.db.collection(item.collection).doc(item.docId);
                if (item.action === 'set') {
                    await ref.set(item.data, { merge: true });
                } else if (item.action === 'update') {
                    await ref.update(item.data);
                } else if (item.action === 'delete') {
                    await ref.delete();
                }
                queue.shift();
                saveQueue();
            } catch (e) {
                item.retries++;
                if (item.retries >= 5) {
                    console.warn('Sync: descartando operación tras 5 reintentos:', item);
                    queue.shift();
                    saveQueue();
                } else {
                    processing = false;
                    return;
                }
            }
        }

        processing = false;
    }

    function getQueueLength() {
        return queue.length;
    }

    loadQueue();

    window.addEventListener('online', function () {
        processQueue();
    });

    return {
        enqueue: enqueue,
        processQueue: processQueue,
        getQueueLength: getQueueLength
    };
})();

if (typeof window !== 'undefined') {
    window.SyncQueue = SyncQueue;
}
