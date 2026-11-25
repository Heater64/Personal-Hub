/* ==========================================
   Ilustraciones de Mis sorpresas

   Los SVG viven en `assets/sorpresas/*.svg` (128×128, gradientes, fondo
   transparente) y se importan en crudo para poder inyectarlos dentro de
   las tarjetas, donde pequeños detalles del mismo color heredan el tono
   del estado.

   Como una misma ilustración puede aparecer varias veces en pantalla
   (lista + editor + detalle), cada inyección reescribe los ids de los
   degradados con un sufijo único: sin eso, varios `<linearGradient
   id="srpRegaloCaja">` en el DOM se referencian entre sí y la segunda
   tarjeta pierde su degradado.
   ========================================== */

import regalo from '../assets/sorpresas/regalo.svg?raw';
import regaloIdea from '../assets/sorpresas/regalo-idea.svg?raw';
import regaloPendiente from '../assets/sorpresas/regalo-pendiente.svg?raw';
import regaloComprado from '../assets/sorpresas/regalo-comprado.svg?raw';
import regaloPreparado from '../assets/sorpresas/regalo-preparado.svg?raw';
import regaloEntregado from '../assets/sorpresas/regalo-entregado.svg?raw';
import persona from '../assets/sorpresas/persona.svg?raw';
import cumpleanos from '../assets/sorpresas/cumpleanos.svg?raw';
import agendaRegalos from '../assets/sorpresas/agenda-regalos.svg?raw';
import presupuesto from '../assets/sorpresas/presupuesto.svg?raw';
import regalosVacios from '../assets/sorpresas/regalos-vacios.svg?raw';

const ART = {
  regalo,
  'regalo-idea': regaloIdea,
  'regalo-pendiente': regaloPendiente,
  'regalo-comprado': regaloComprado,
  'regalo-preparado': regaloPreparado,
  'regalo-entregado': regaloEntregado,
  persona,
  cumpleanos,
  'agenda-regalos': agendaRegalos,
  presupuesto,
  'regalos-vacios': regalosVacios,
};

export const GIFT_ART_NAMES = Object.keys(ART);

let injection = 0;

/** Ids de degradado/filtro del archivo, con el sufijo de esta inyección. */
function uniqueIds(svg, suffix) {
  const ids = [...svg.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map(match => match[1]);
  let out = svg;
  for (const id of new Set(ids)) {
    out = out
      .replaceAll(`id="${id}"`, `id="${id}-${suffix}"`)
      .replaceAll(`url(#${id})`, `url(#${id}-${suffix})`);
  }
  return out;
}

/**
 * Ilustración en línea lista para insertar en una plantilla.
 * @param {string} name clave de `GIFT_ART_NAMES`
 * @param {{ size?: number, className?: string, label?: string }} options
 */
export function giftArt(name, { size = 64, className = '', label = '' } = {}) {
  const source = ART[name] || ART.regalo;
  const suffix = `i${++injection}`;
  const svg = uniqueIds(source, suffix)
    .replace('<svg ', `<svg class="srp-art__svg${className ? ` ${className}` : ''}" width="${size}" height="${size}" `)
    .replace('aria-hidden="true"', label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"');
  return svg;
}

/** Ilustración del estado de un regalo. */
export function artForState(state) {
  const map = {
    pendiente: 'regalo-idea',
    comprar: 'regalo-pendiente',
    comprado: 'regalo-comprado',
    preparado: 'regalo-preparado',
    entregado: 'regalo-entregado',
  };
  return map[state] || 'regalo';
}
