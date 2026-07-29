// js/core/haptica.js
// Sistema de vibración estructurado (háptica nativa)
(function () {
  'use strict';

  function puedeVibrar() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  // Patrones en ms (vibra, pausa, vibra...)
  var PATRONES = {
    toque:      [10],
    seleccion:  [12],
    exito:      [15, 40, 25],
    aviso:      [25, 30, 25],
    error:      [40, 60, 40, 60, 40],
    logro:      [20, 50, 20, 50, 60],
    fallo:      [60, 50, 60, 50, 90],
    completado: [15, 30, 15, 30, 40]
  };

  function vibrar(patron) {
    if (!puedeVibrar()) return false;
    try {
      var p = typeof patron === 'string' ? (PATRONES[patron] || PATRONES.toque) : patron;
      navigator.vibrate(p);
      return true;
    } catch (e) {
      return false;
    }
  }

  var Haptica = {
    toque:      function () { return vibrar('toque'); },
    seleccion:  function () { return vibrar('seleccion'); },
    exito:      function () { return vibrar('exito'); },
    aviso:      function () { return vibrar('aviso'); },
    error:      function () { return vibrar('error'); },
    logro:      function () { return vibrar('logro'); },
    fallo:      function () { return vibrar('fallo'); },
    completado: function () { return vibrar('completado'); },
    patron:     function (p) { return vibrar(p); }
  };

  window.Haptica = Haptica;
})();
