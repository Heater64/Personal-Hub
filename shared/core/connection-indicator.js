// js/core/connection-indicator.js
// Indicador de conexión online/offline + estado de sincronización
(function () {
  'use strict';

  var SYNC_KEY = 'personalHub.syncQueue';
  var contenedor = null;
  var ocultarTimer = null;

  function crearContenedor() {
    if (contenedor) return contenedor;
    contenedor = document.createElement('div');
    contenedor.className = 'conn-indicator';
    contenedor.setAttribute('role', 'status');
    contenedor.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedor);
    return contenedor;
  }

  function mostrar(texto, tipo, duracion) {
    var el = crearContenedor();
    el.className = 'conn-indicator conn-indicator--' + (tipo || 'info') + ' conn-indicator--visible';
    el.innerHTML = texto;
    if (ocultarTimer) clearTimeout(ocultarTimer);
    if (duracion) {
      ocultarTimer = setTimeout(ocultar, duracion);
    }
  }

  function ocultar() {
    if (!contenedor) return;
    contenedor.classList.remove('conn-indicator--visible');
  }

  function syncPendiente() {
    try {
      var q = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
      return Array.isArray(q) ? q.length : 0;
    } catch (e) { return 0; }
  }

  function alConectar() {
    var pend = syncPendiente();
    if (pend > 0) {
      mostrar('🟡 Sincronizando ' + pend + ' cambio' + (pend === 1 ? '' : 's') + '...', 'sync', 2500);
      // El SyncQueue procesa solo al volver online
      setTimeout(function () {
        if (syncPendiente() === 0) mostrar('🟢 Conectado', 'online', 2000);
      }, 1200);
    } else {
      mostrar('🟢 Conectado', 'online', 1800);
    }
  }

  function alDesconectar() {
    mostrar('🔴 Sin conexión — modo offline', 'offline', 0);
  }

  function init() {
    if (typeof window === 'undefined') return;
    // Estado inicial
    if (navigator.onLine) {
      mostrar('🟢 Conectado', 'online', 1800);
    } else {
      alDesconectar();
    }
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    // Reintentos de sincronización periódicos ya los maneja SyncQueue.online
  }

  window.ConnectionIndicator = {
    init: init,
    mostrar: mostrar,
    ocultar: ocultar,
    conectar: alConectar,
    desconectar: alDesconectar
  };
})();
