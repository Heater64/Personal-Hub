// services/sync/sync.js
// Cola de sincronización offline para Supabase

var SyncQueue = (function () {
    var queue = [];
    var processing = false;
    var STORAGE_KEY = 'personalHub.syncQueue';

    function loadQueue() {
        try { var saved = localStorage.getItem(STORAGE_KEY); if (saved) queue = JSON.parse(saved); } catch (e) { queue = []; }
    }

    function saveQueue() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch (e) {} }

    function enqueue(action, table, data, match) {
        queue.push({
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            action: action,
            table: table,
            data: data,
            match: match || null,
            timestamp: new Date().toISOString(),
            retries: 0
        });
        saveQueue();
        processQueue();
    }

    async function processQueue() {
        if (processing || queue.length === 0 || typeof SupabaseClient === 'undefined') return;
        processing = true;

        while (queue.length > 0) {
            var item = queue[0];
            try {
                var ok = false;
                if (item.action === 'upsert') { ok = await SupabaseClient.upsert(item.table, item.data, item.match); }
                else if (item.action === 'insert') { ok = await SupabaseClient.insert(item.table, item.data); }
                else if (item.action === 'update') { ok = await SupabaseClient.update(item.table, item.data, item.match || {}); }
                else if (item.action === 'delete') { ok = await SupabaseClient.delete(item.table, item.match || {}); }
                if (ok !== false) { queue.shift(); saveQueue(); }
                else { item.retries++; if (item.retries >= 5) { queue.shift(); saveQueue(); } else { processing = false; return; } }
            } catch (e) {
                item.retries++;
                if (item.retries >= 5) { queue.shift(); saveQueue(); }
                else { processing = false; return; }
            }
        }
        processing = false;
    }

    function getQueueLength() { return queue.length; }

    loadQueue();
    window.addEventListener('online', function () { processQueue(); });

    return { enqueue: enqueue, processQueue: processQueue, getQueueLength: getQueueLength };
})();

if (typeof window !== 'undefined') { window.SyncQueue = SyncQueue; }
