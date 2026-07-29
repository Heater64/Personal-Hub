// js/core/memoria.js
// Utilidad de optimización de memoria: gestión centralizada de timers, observers e intervalos
(function () {
  'use strict';

  var recursos = new Set();

  function registrarRecurso(limpiador) {
    if (typeof limpiador === 'function') recursos.add(limpiador);
  }

  // Crea un setInterval que se auto-limpia al descargar la página
  function intervalo(fn, ms) {
    var id = setInterval(fn, ms);
    registrarRecurso(function () { clearInterval(id); });
    return id;
  }

  function timeout(fn, ms) {
    var id = setTimeout(fn, ms);
    registrarRecurso(function () { clearTimeout(id); });
    return id;
  }

  function observer(obs) {
    if (obs && typeof obs.disconnect === 'function') {
      registrarRecurso(function () { obs.disconnect(); });
    }
    return obs;
  }

  function escucha(target, tipo, handler, opciones) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(tipo, handler, opciones);
    registrarRecurso(function () { target.removeEventListener(tipo, handler, opciones); });
  }

  // Render por lotes para listas grandes (evita bloquear el hilo principal)
  function renderPorLotes(items, renderFn, tamañoLote, contenedor, done) {
    var i = 0;
    function paso() {
      var fin = Math.min(i + tamañoLote, items.length);
      var frag = document.createDocumentFragment();
      for (; i < fin; i++) {
        var nodo = renderFn(items[i], i);
        if (nodo) frag.appendChild(nodo);
      }
      if (contenedor) contenedor.appendChild(frag);
      if (i < items.length) {
        (window.requestIdleCallback || window.setTimeout)(paso, 16);
      } else if (typeof done === 'function') {
        done();
      }
    }
    paso();
  }

  function liberar() {
    recursos.forEach(function (limpiar) {
      try { limpiar(); } catch (e) {}
    });
    recursos.clear();
  }

  window.addEventListener('pagehide', liberar);
  if (typeof window.beforeunload === 'undefined') {
    // noop
  } else {
    window.addEventListener('beforeunload', liberar);
  }

  window.Memoria = {
    registrar: registrarRecurso,
    intervalo: intervalo,
    timeout: timeout,
    observer: observer,
    escucha: escucha,
    renderPorLotes: renderPorLotes,
    liberar: liberar
  };
})();
