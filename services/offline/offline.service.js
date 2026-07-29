// services/offline/offline.service.js
// Servicio de gestión offline y sincronización con Supabase

var OfflineService = (function () {
    'use strict';

    var state = {
        isOnline: true,
        wasOffline: false,
        pendingChanges: [],
        syncInProgress: false,
        listeners: []
    };

    var syncInterval = null;
    var onlineCheckInterval = null;

    function subscribe(callback) {
        if (typeof callback !== 'function') return function () {};
        state.listeners.push(callback);
        return function () {
            state.listeners = state.listeners.filter(function (l) { return l !== callback; });
        };
    }

    function notify() {
        state.listeners.forEach(function (cb) {
            try { cb(getState()); } catch (e) {}
        });
    }

    function getState() {
        return {
            isOnline: state.isOnline,
            wasOffline: state.wasOffline,
            pendingCount: state.pendingChanges.length,
            syncInProgress: state.syncInProgress
        };
    }

    function init() {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        state.isOnline = navigator.onLine;
        updateUI();
        loadPendingChanges();
        startSyncInterval();
        startOnlineCheck();
    }

    function handleOnline() {
        if (!state.isOnline) {
            state.wasOffline = true;
            state.isOnline = true;
            updateUI();
            notify();
            if (state.pendingChanges.length > 0) syncPendingChanges();
        }
    }

    function handleOffline() {
        if (state.isOnline) { state.isOnline = false; updateUI(); notify(); }
    }

    function addPendingChange(change) {
        state.pendingChanges.push({
            id: generateId(), type: change.type, table: change.table,
            data: change.data, timestamp: Date.now(), retries: 0
        });
        savePendingChanges();
        updateUI();
        notify();
    }

    function loadPendingChanges() {
        try {
            var stored = localStorage.getItem('offline_pending_changes');
            if (stored) state.pendingChanges = JSON.parse(stored);
        } catch (e) { state.pendingChanges = []; }
    }

    function savePendingChanges() {
        try { localStorage.setItem('offline_pending_changes', JSON.stringify(state.pendingChanges)); } catch (e) {}
    }

    function syncPendingChanges() {
        if (!state.isOnline || state.syncInProgress || state.pendingChanges.length === 0) return Promise.resolve();
        state.syncInProgress = true;
        updateUI();
        notify();

        var promises = state.pendingChanges.map(function (change) { return syncSingleChange(change); });

        return Promise.all(promises).then(function (results) {
            results.forEach(function (result, index) { if (result.success) state.pendingChanges[index] = null; });
            state.pendingChanges = state.pendingChanges.filter(function (c) { return c !== null; });
            savePendingChanges();
            state.syncInProgress = false;
            updateUI();
            notify();
            if (state.pendingChanges.length === 0 && state.wasOffline) {
                state.wasOffline = false;
                if (typeof window.showToast === 'function') window.showToast('Todo sincronizado ✓');
            }
        }).catch(function () {});
    }

    function syncSingleChange(change) {
        if (typeof SupabaseClient === 'undefined') return Promise.resolve({ success: false, error: 'No SupabaseClient' });

        var operation;
        switch (change.type) {
            case 'upsert':
                operation = SupabaseClient.upsert(change.table, change.data, change.onConflict);
                break;
            case 'insert':
                operation = SupabaseClient.insert(change.table, change.data);
                break;
            case 'update':
                operation = SupabaseClient.update(change.table, change.data, change.match || {});
                break;
            case 'delete':
                operation = SupabaseClient.delete(change.table, change.match || {});
                break;
            default:
                return Promise.resolve({ success: false, error: 'Unknown type' });
        }

        return operation.then(function () { return { success: true }; }).catch(function (err) {
            change.retries++;
            return { success: false, error: err.message };
        });
    }

    function startSyncInterval() {
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(function () {
            if (state.isOnline && state.pendingChanges.length > 0 && !state.syncInProgress) syncPendingChanges();
        }, 30000);
    }

    function startOnlineCheck() {
        if (onlineCheckInterval) clearInterval(onlineCheckInterval);
        onlineCheckInterval = setInterval(function () {
            var wasOnline = state.isOnline;
            state.isOnline = navigator.onLine;
            if (!wasOnline && state.isOnline) handleOnline();
            else if (wasOnline && !state.isOnline) handleOffline();
        }, 5000);
    }

    function updateUI() {
        var indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            if (!state.isOnline) {
                indicator.hidden = false;
                indicator.innerHTML = '<i data-lucide="wifi-off" class="offline-indicator__icon"></i><span class="offline-indicator__text">Sin conexión</span><span class="offline-indicator__subtext">Los cambios se guardarán localmente</span>';
            } else if (state.wasOffline && state.pendingChanges.length > 0) {
                indicator.hidden = false;
                indicator.innerHTML = '<i data-lucide="sync" class="offline-indicator__icon syncing"></i><span class="offline-indicator__text">Sincronizando...</span><span class="offline-indicator__subtext">' + state.pendingChanges.length + ' cambios pendientes</span>';
            } else if (state.wasOffline && state.pendingChanges.length === 0) {
                indicator.hidden = false;
                indicator.innerHTML = '<i data-lucide="wifi" class="offline-indicator__icon online"></i><span class="offline-indicator__text">Conexión restaurada</span><span class="offline-indicator__subtext">Todo sincronizado ✓</span>';
                setTimeout(function () { indicator.hidden = true; }, 3000);
            } else { indicator.hidden = true; }
            if (window.lucide) window.lucide.createIcons({ root: indicator });
        }

        var pendingEl = document.getElementById('pendingChanges');
        var pendingCount = document.querySelector('.pending-changes__count');
        if (pendingEl && pendingCount) {
            pendingEl.hidden = state.pendingChanges.length === 0;
            pendingCount.textContent = state.pendingChanges.length;
        }

        var syncStatus = document.querySelector('.sync-status');
        if (syncStatus) {
            if (!state.isOnline) {
                syncStatus.className = 'sync-status sync-status--offline';
                syncStatus.innerHTML = '<span class="sync-status__dot"></span> Sin conexión';
            } else if (state.syncInProgress) {
                syncStatus.className = 'sync-status sync-status--syncing';
                syncStatus.innerHTML = '<span class="sync-status__spinner"></span> Sincronizando...';
            } else if (state.pendingChanges.length > 0) {
                syncStatus.className = 'sync-status sync-status--offline';
                syncStatus.innerHTML = '<span class="sync-status__dot"></span> ' + state.pendingChanges.length + ' pendientes';
            } else {
                syncStatus.className = 'sync-status sync-status--synced';
                syncStatus.innerHTML = '<span class="sync-status__dot"></span> Sincronizado';
            }
        }
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function destroy() {
        if (syncInterval) clearInterval(syncInterval);
        if (onlineCheckInterval) clearInterval(onlineCheckInterval);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    }

    var service = { init: init, getState: getState, subscribe: subscribe, addPendingChange: addPendingChange, syncPendingChanges: syncPendingChanges, forceSync: syncPendingChanges, destroy: destroy };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
    if (typeof window !== 'undefined') { window.OfflineService = service; }
    return service;
})();
