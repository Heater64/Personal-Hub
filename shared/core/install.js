// js/core/install.js
// Banner de instalación profesional (se muestra una sola vez)
(function () {
  'use strict';

  var VISTO_FLAG = 'personalHub.installBanner.visto';
  var deferredPrompt = null;

  function yaVisto() {
    try { return localStorage.getItem(VISTO_FLAG) === '1'; }
    catch (e) { return false; }
  }
  function marcarVisto() {
    try { localStorage.setItem(VISTO_FLAG, '1'); } catch (e) {}
  }

  function esInstalable() {
    return 'serviceWorker' in navigator &&
      (window.matchMedia('(display-mode: browser)').matches || !window.navigator.standalone);
  }

  function init() {
    if (yaVisto()) return;
    if (!esInstalable()) { marcarVisto(); return; }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      mostrarBanner();
    });

    window.addEventListener('appinstalled', function () {
      marcarVisto();
      ocultarBanner();
    });
  }

  function mostrarBanner() {
    if (document.querySelector('.install-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-banner__icon"><i data-lucide="download"></i></div>
      <div class="install-banner__body">
        <p class="install-banner__title">Instala Personal Hub</p>
        <p class="install-banner__text">Accede más rápido, úsala sin internet y recibe novedades. Es gratis.</p>
      </div>
      <div class="install-banner__actions">
        <button class="install-banner__btn install-banner__btn--ghost" id="installDismiss">Ahora no</button>
        <button class="install-banner__btn install-banner__btn--primary" id="installAccept">Instalar</button>
      </div>`;
    document.body.appendChild(banner);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: banner });

    banner.querySelector('#installDismiss').addEventListener('click', function () {
      marcarVisto();
      ocultarBanner(banner);
    });
    banner.querySelector('#installAccept').addEventListener('click', function () {
      if (!deferredPrompt) { marcarVisto(); ocultarBanner(banner); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        marcarVisto();
        ocultarBanner(banner);
      });
    });
  }

  function ocultarBanner(banner) {
    banner = banner || document.querySelector('.install-banner');
    if (!banner) return;
    banner.classList.add('install-banner--hide');
    setTimeout(function () { banner.remove(); }, 300);
  }

  // Reemplaza el botón inline #installBtn (index.html) por este flujo
  function initLegacyButton(btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.hidden = true;
    if (deferredPrompt) btn.hidden = false;
    window.addEventListener('beforeinstallprompt', function () {
      if (btn) btn.hidden = false;
    });
    if (btn) btn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
    });
  }

  window.InstallManager = {
    init: init,
    initLegacyButton: initLegacyButton
  };
})();
