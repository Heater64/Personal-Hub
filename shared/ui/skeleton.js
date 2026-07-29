// js/ui/skeleton.js
// Helpers de skeleton loading (esqueletos de carga)
(function () {
  'use strict';

  function bloque(opts) {
    opts = opts || {};
    var ancho = opts.ancho || '100%';
    var alto = opts.alto || '14px';
    var radio = opts.radio || '8px';
    var margen = opts.margen || '8px 0';
    return '<div class="skeleton" style="width:' + ancho + ';height:' + alto + ';border-radius:' + radio + ';margin:' + margen + '"></div>';
  }

  function tarjeta(opciones) {
    opciones = opciones || {};
    var lineas = opciones.lineas || 3;
    var html = '<div class="skeleton-card">';
    html += bloque({ ancho: '40%', alto: '18px', margen: '0 0 12px' });
    for (var i = 0; i < lineas; i++) {
      html += bloque({ ancho: i === lineas - 1 ? '60%' : '100%' });
    }
    html += '</div>';
    return html;
  }

  function lista(conteo, opciones) {
    conteo = conteo || 3;
    var html = '';
    for (var i = 0; i < conteo; i++) html += tarjeta(opciones);
    return html;
  }

  function mostrar(contenedor, html) {
    if (!contenedor) return;
    contenedor.innerHTML = html;
    if (window.HubAnimaciones) window.HubAnimaciones.entrada(contenedor);
  }

  window.Skeleton = {
    bloque: bloque,
    tarjeta: tarjeta,
    lista: lista,
    mostrar: mostrar
  };
})();
