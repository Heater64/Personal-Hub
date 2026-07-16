// services/offline/offline.service.js
// Servicio de gestión offline y sincronización

var OfflineService = (function () {
    'use strict';

    var state = {
        isOnline: true,
        wasOffline: false,
        pendingChanges: [],
        syncInProgress: false,
        listeners: []
    };

    var db = null;
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
        db = window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
        
        // Listen for online/offline events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Initial state
        state.isOnline = navigator.onLine;
        updateUI();

        // Load pending changes from IndexedDB
        loadPendingChanges();

        // Periodic sync attempt
        startSyncInterval();

        // Periodic online check (for cases where online event doesn't fire)
        startOnlineCheck();
    }

    function handleOnline() {
        if (!state.isOnline) {
            state.wasOffline = true;
            state.isOnline = true;
            console.log('[OfflineService] Back online');
            updateUI();
            notify();
            
            // Attempt sync
            if (state.pendingChanges.length > 0) {
                syncPendingChanges();
            }
        }
    }

    function handleOffline() {
        if (state.isOnline) {
            state.isOnline = false;
            console.log('[OfflineService] Gone offline');
            updateUI();
            notify();
        }
    }

    function addPendingChange(change) {
        var pendingChange = {
            id: generateId(),
            type: change.type,
            collection: change.collection,
            docId: change.docId,
            data: change.data,
            timestamp: Date.now(),
            retries: 0
        };
        
        state.pendingChanges.push(pendingChange);
        savePendingChanges();
        updateUI();
        notify();
    }

    function loadPendingChanges() {
        try {
            var stored = localStorage.getItem('offline_pending_changes');
            if (stored) {
                state.pendingChanges = JSON.parse(stored);
                console.log('[OfflineService] Loaded', state.pendingChanges.length, 'pending changes');
            }
        } catch (e) {
            console.warn('[OfflineService] Failed to load pending changes:', e);
            state.pendingChanges = [];
        }
    }

    function savePendingChanges() {
        try {
            localStorage.setItem('offline_pending_changes', JSON.stringify(state.pendingChanges));
        } catch (e) {
            console.warn('[OfflineService] Failed to save pending changes:', e);
        }
    }

    function syncPendingChanges() {
        if (!state.isOnline || state.syncInProgress || state.pendingChanges.length === 0 || !db) {
            return Promise.resolve();
        }

        state.syncInProgress = true;
        updateUI();
        notify();

        console.log('[OfflineService] Syncing', state.pendingChanges.length, 'changes');

        var promises = state.pendingChanges.map(function (change) {
            return syncSingleChange(change);
        });

        return Promise.all(promises)
            .then(function (results) {
                // Remove successful changes
                var successCount = 0;
                results.forEach(function (result, index) {
                    if (result.success) {
                        state.pendingChanges[index] = null;
                        successCount++;
                    }
                });
                
                // Filter out nulls
                state.pendingChanges = state.pendingChanges.filter(function (c) { return c !== null; });
                savePendingChanges();
                
                state.syncInProgress = false;
                updateUI();
                notify();
                
                console.log('[OfflineService] Sync complete:', successCount, 'successful,', state.pendingChanges.length, 'remaining');
                
                if (state.pendingChanges.length === 0 && state.wasOffline) {
                    state.wasOffline = false;
                    if (window.showToast) {
                        window.showToast('Todo sincronizado ✓');
                    }
                }
            })
            .catch(function (err) {
                console.error('[OfflineService] Sync failed:', err);
                state.syncInProgress = false;
                updateUI();
                notify();
            });
    }

    function syncSingleChange(change) {
        if (!db) return Promise.resolve({ success: false, error: 'No DB' });

        var collectionRef = db.collection(change.collection);
        var docRef = change.docId ? collectionRef.doc(change.docId) : null;

        var operation;
        switch (change.type) {
            case 'set':
                operation = docRef ? docRef.set(change.data, { merge: true }) : collectionRef.add(change.data);
                break;
            case 'update':
                operation = docRef ? docRef.update(change.data) : Promise.reject(new Error('No docId for update'));
                break;
            case 'delete':
                operation = docRef ? docRef.delete() : Promise.reject(new Error('No docId for delete'));
                break;
            default:
                return Promise.resolve({ success: false, error: 'Unknown type' });
        }

        return operation
            .then(function () {
                return { success: true };
            })
            .catch(function (err) {
                console.warn('[OfflineService] Failed to sync change:', change.id, err);
                change.retries++;
                if (change.retries > 5) {
                    // Max retries reached, keep in queue but mark as failed
                    console.error('[OfflineService] Max retries for change:', change.id);
                }
                return { success: false, error: err.message };
            });
    }

    function startSyncInterval() {
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(function () {
            if (state.isOnline && state.pendingChanges.length > 0 && !state.syncInProgress) {
                syncPendingChanges();
            }
        }, 30000); // Every 30 seconds
    }

    function startOnlineCheck() {
        if (onlineCheckInterval) clearInterval(onlineCheckInterval);
        onlineCheckInterval = setInterval(function () {
            var wasOnline = state.isOnline;
            state.isOnline = navigator.onLine;
            if (!wasOnline && state.isOnline) {
                handleOnline();
            } else if (wasOnline && !state.isOnline) {
                handleOffline();
            }
        }, 5000); // Every 5 seconds
    }

    function updateUI() {
        // Update offline indicator
        var indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            if (!state.isOnline) {
                indicator.hidden = false;
                indicator.innerHTML = 
                    '<i data-lucide="wifi-off" class="offline-indicator__icon"></i>' +
                    '<span class="offline-indicator__text">Sin conexión</span>' +
                    '<span class="offline-indicator__subtext">Los cambios se guardarán localmente</span>';
            } else if (state.wasOffline && state.pendingChanges.length > 0) {
                indicator.hidden = false;
                indicator.innerHTML = 
                    '<i data-lucide="sync" class="offline-indicator__icon syncing"></i>' +
                    '<span class="offline-indicator__text">Sincronizando...</span>' +
                    '<span class="offline-indicator__subtext">' + state.pendingChanges.length + ' cambios pendientes</span>';
            } else if (state.wasOffline && state.pendingChanges.length === 0) {
                indicator.hidden = false;
                indicator.innerHTML = 
                    '<i data-lucide="wifi" class="offline-indicator__icon online"></i>' +
                    '<span class="offline-indicator__text">Conexión restaurada</span>' +
                    '<span class="offline-indicator__subtext">Todo sincronizado ✓</span>';
                setTimeout(function () {
                    indicator.hidden = true;
                }, 3000);
            } else {
                indicator.hidden = true;
            }
            if (window.lucide) window.lucide.createIcons({ root: indicator });
        }

        // Update pending changes indicator
        var pendingEl = document.getElementById('pendingChanges');
        var pendingCount = document.querySelector('.pending-changes__count');
        if (pendingEl && pendingCount) {
            if (state.pendingChanges.length > 0) {
                pendingEl.hidden = false;
                pendingCount.textContent = state.pendingChanges.length;
            } else {
                pendingEl.hidden = true;
            }
        }

        // Update sync status in header if exists
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

        // Update connection status dot in sidebar
        var sidebarStatus = document.querySelector('.sidebar__network-status');
        if (sidebarStatus) {
            sidebarStatus.className = 'sidebar__network-status ' + (state.isOnline ? 'sidebar__network-status--online' : 'sidebar__network-status--offline');
            sidebarStatus.innerHTML = '<i data-lucide="' + (state.isOnline ? 'wifi' : 'wifi-off') + '"></i> ' + (state.isOnline ? 'En línea' : 'Sin conexión');
            if (window.lucide) window.lucide.createIcons({ root: sidebarStatus });
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

    // Public API
    var service = {
        init: init,
        getState: getState,
        subscribe: subscribe,
        addPendingChange: addPendingChange,
        syncPendingChanges: syncPendingChanges,
        forceSync: syncPendingChanges,
        destroy: destroy
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if (typeof window !== 'undefined') {
        window.OfflineService = service;
    }

    return service;
})();

console.log('📴 offline.service.js cargado');