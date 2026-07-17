// js/ui/pull-to-refresh.js
// Pull-to-refresh accesible y ligero (estilo nativo)
(function () {
  'use strict';

  function init(el, onRefresh, opciones) {
    if (!el || typeof onRefresh !== 'function') return;
    var op = opciones || {};
    var umbral = op.umbral || 70;
    var max = op.max || 110;

    var startY = 0;
    var arrastrando = false;
    var refrescando = false;
    var indicador = null;

    function crearIndicador() {
      if (indicador) return indicador;
      indicador = document.createElement('div');
      indicador.className = 'ptr-indicator';
      indicador.innerHTML = '<span class="ptr-spinner"></span><span class="ptr-text">Desliza para actualizar</span>';
      el.parentNode.insertBefore(indicador, el);
      return indicador;
    }

    function puedeScrollArriba() {
      return el.scrollTop > 0;
    }

    el.addEventListener('touchstart', function (e) {
      if (refrescando || puedeScrollArriba()) return;
      startY = e.touches[0].clientY;
      arrastrando = true;
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!arrastrando || refrescando) return;
      var dy = e.touches[0].clientY - startY;
      if (dy <= 0) { resetIndicador(); return; }
      if (puedeScrollArriba()) { resetIndicador(); return; }
      var desplaz = Math.min(dy * 0.5, max);
      var ind = crearIndicador();
      ind.style.transform = 'translateY(' + desplaz + 'px)';
      ind.style.opacity = String(Math.min(1, desplaz / umbral));
      ind.querySelector('.ptr-text').textContent = desplaz >= umbral ? 'Suelta para actualizar' : 'Desliza para actualizar';
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      if (!arrastrando || refrescando) return;
      arrastrando = false;
      var ind = crearIndicador();
      var desplaz = parseFloat((ind.style.transform.match(/translateY\(([-\d.]+)px\)/) || [0, 0])[1]) || 0;
      if (desplaz >= umbral) {
        refrescando = true;
        ind.classList.add('ptr-refreshing');
        ind.querySelector('.ptr-text').textContent = 'Actualizando...';
        Promise.resolve(onRefresh()).then(function () {
          refrescando = false;
          resetIndicador();
          if (window.Haptica) window.Haptica.completado();
        }).catch(function () {
          refrescando = false;
          resetIndicador();
        });
      } else {
        resetIndicador();
      }
    });

    function resetIndicador() {
      if (!indicador) return;
      indicador.style.transform = 'translateY(0)';
      indicador.style.opacity = '0';
      indicador.classList.remove('ptr-refreshing');
    }
  }

  window.PullToRefresh = { init: init };
})();
