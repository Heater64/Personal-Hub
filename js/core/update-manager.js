// js/core/update-manager.js
// Detección de actualizaciones + banner de novedades + actualización silenciosa
(function () {
  'use strict';

  var VERSION_URL = 'version.json';
  var CHECK_INTERVAL = 60 * 1000; // cada minuto
  var SEEN_FLAG = 'personalHub.whatsnew.vistos';
  var PENDING_FLAG = 'personalHub.pending.whatsnew';

  var swRegistration = null;

  async function obtenerVersionApp() {
    try {
      var res = await fetch(VERSION_URL, { cache: 'no-cache' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  function versionActual() {
    try { return localStorage.getItem('personalHub.version') || '0'; }
    catch (e) { return '0'; }
  }
  function guardarVersion(v) {
    try { localStorage.setItem('personalHub.version', v); } catch (e) {}
  }

  function vistos() {
    try { return JSON.parse(localStorage.getItem(SEEN_FLAG) || '[]'); }
    catch (e) { return []; }
  }
  function marcarVisto(v) {
    try {
      var s = vistos();
      if (s.indexOf(v) === -1) { s.push(v); localStorage.setItem(SEEN_FLAG, JSON.stringify(s)); }
    } catch (e) {}
  }

  async function init() {
    if (!('serviceWorker' in navigator)) return;
    try {
      swRegistration = await navigator.serviceWorker.ready;
    } catch (e) { return; }

    // Escuchar mensajes del SW (p. ej. que hay nueva versión)
    navigator.serviceWorker.addEventListener('message', function (ev) {
      var d = ev.data || {};
      if (d.type === 'NEW_VERSION') {
        onNuevaVersion(d.version, d.changelog);
      }
    });

    // Comprobación periódica de version.json
    await comprobar();
    setInterval(comprobar, CHECK_INTERVAL);
    window.addEventListener('online', comprobar);
  }

  async function comprobar() {
    var data = await obtenerVersionApp();
    if (!data || !data.version) return;
    var actual = versionActual();
    if (actual && actual !== data.version) {
      onNuevaVersion(data.version, data.changelog || []);
    }
  }

  function onNuevaVersion(version, changelog) {
    guardarVersion(version);
    var vistosSet = vistos();
    if (vistosSet.indexOf(version) !== -1) {
      // Ya se mostró; solo precachear silenciosamente
      precachearSilencioso();
      return;
    }
    // Intentar enriquecer con el changelog de Firestore si existe
    obtenerChangelogFirestore().then(function (remoto) {
      var lista = (remoto && remoto.length) ? remoto : (changelog || []);
      // Marcar pendiente para mostrar al abrir/cargar
      try { localStorage.setItem(PENDING_FLAG, JSON.stringify({ version: version, changelog: lista })); } catch (e) {}
      mostrarBannerNovedades(version, lista);
    });
    precachearSilencioso();
  }

  async function obtenerChangelogFirestore() {
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.loadChangelog) {
        return await ConfigService.loadChangelog();
      }
    } catch (e) {}
    return [];
  }

  function precachearSilencioso() {
    if (swRegistration && swRegistration.active) {
      swRegistration.active.postMessage({ type: 'PRECACHE_UPDATE' });
    }
  }

  function aplicarActualizacion() {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Recargar para activar la nueva versión
      window.location.reload();
    } else {
      precachearSilencioso();
      window.location.reload();
    }
  }

  function mostrarBannerNovedades(version, changelog) {
    var items = (changelog || []).map(function (c) {
      return '<li><span class="wn-check">✓</span> ' + escapar(c) + '</li>';
    }).join('');

    var banner = document.createElement('div');
    banner.className = 'whatsnew-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Novedades de la actualización');
    banner.innerHTML = `
      <div class="wn-header">
        <span class="wn-icon">✨</span>
        <span class="wn-title">¡Hay una nueva versión!</span>
        <span class="wn-version">v${escapar(version)}</span>
      </div>
      ${items ? '<ul class="wn-list">' + items + '</ul>' : ''}
      <div class="wn-actions">
        <button class="wn-btn wn-btn--ghost" id="wnDismiss">Ahora no</button>
        <button class="wn-btn wn-btn--primary" id="wnUpdate">Actualizar</button>
      </div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('whatsnew-banner--visible'); });

    banner.querySelector('#wnDismiss').addEventListener('click', function () {
      cerrar(banner);
      marcarVisto(version);
      try { localStorage.removeItem(PENDING_FLAG); } catch (e) {}
    });
    banner.querySelector('#wnUpdate').addEventListener('click', function () {
      cerrar(banner);
      aplicarActualizacion();
    });
  }

  function cerrar(banner) {
    banner.classList.remove('whatsnew-banner--visible');
    setTimeout(function () { banner.remove(); }, 250);
  }

  // Mostrar banner pendiente (al cargar la app, si no se mostró antes)
  function mostrarPendiente() {
    try {
      var raw = localStorage.getItem(PENDING_FLAG);
      if (!raw) return;
      var info = JSON.parse(raw);
      if (vistos().indexOf(info.version) !== -1) { localStorage.removeItem(PENDING_FLAG); return; }
      mostrarBannerNovedades(info.version, info.changelog || []);
    } catch (e) {}
  }

  function escapar(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"]/g, function (m) {
      return m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : '&quot;';
    });
  }

  window.UpdateManager = {
    init: init,
    comprobar: comprobar,
    mostrarPendiente: mostrarPendiente,
    precachearSilencioso: precachearSilencioso
  };
})();
