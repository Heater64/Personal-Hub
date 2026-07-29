// js/core/notifications.js
// Notificaciones in-app (toast) con dedupe por día/evento
(function () {
  'use strict';

  var DIA_KEY = 'personalHub.notif.dia';
  var VISTAS_KEY = 'personalHub.notif.vistas';

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function vistas() {
    try { return JSON.parse(localStorage.getItem(VISTAS_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function yaMostrada(clave) {
    var v = vistas();
    return !!v[clave];
  }

  function marcar(clave) {
    try {
      var v = vistas();
      v[clave] = hoy();
      localStorage.setItem(VISTAS_KEY, JSON.stringify(v));
    } catch (e) {}
  }

  // Notificación diaria única (una por día por clave)
  function diaria(clave, texto, tipo, icono) {
    if (yaMostrada(clave)) return false;
    marcar(clave);
    mostrar(texto, tipo, icono);
    return true;
  }

  // Notificación única por clave (nunca repetida)
  function unaVez(clave, texto, tipo, icono) {
    if (yaMostrada(clave)) return false;
    marcar(clave);
    mostrar(texto, tipo, icono);
    return true;
  }

  function mostrar(texto, tipo, icono) {
    if (typeof Toast !== 'undefined' && Toast[type]) {
      Toast[type](texto);
    } else if (typeof showToast === 'function') {
      showToast(texto, tipo === 'error');
    }
    if (window.Haptica) {
      window.Haptica[tipo === 'error' ? 'error' : tipo === 'exito' ? 'exito' : 'aviso']();
    }
  }

  // Reinicia las notificaciones diarias (llamar al cambiar de día)
  function reiniciarDiarias() {
    var v = vistas();
    var cambio = false;
    Object.keys(v).forEach(function (k) {
      if (v[k] !== hoy()) { delete v[k]; cambio = true; }
    });
    if (cambio) { try { localStorage.setItem(VISTAS_KEY, JSON.stringify(v)); } catch (e) {} }
  }

  window.Notifications = {
    diaria: diaria,
    unaVez: unaVez,
    mostrar: mostrar,
    reiniciarDiarias: reiniciarDiarias
  };
})();
