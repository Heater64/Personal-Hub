/* ==========================================
   BIENVENIDA DE DÍA ESPECIAL
   Hoja temática que aparece la primera vez
   que se entra un día con evento (aniversario,
   cumpleaños, Halloween, Navidad, o lo que se
   haya configurado en Admin → Configuración).

   Vive en components/ y no en Home.js para que
   se pueda abrir desde cualquier sitio (la
   vista previa `?evento=halloween` y la página
   de pruebas) sin arrastrar toda la portada.
   ========================================== */

import { specialEventsForDate, specialEventsToday, resolveEventPreview, SPECIAL_EVENT_TONES } from '../utils/specialDates.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { openSheet, closeSheets, h } from './ui.js';

/**
 * Abre la hoja temática de una lista de eventos (el primero es el titular).
 * `preview` añade una aviso de que es una simulación, no el día real.
 */
export function openSpecialEventSheet(events, router, { preview = false } = {}) {
  const event = events[0];
  if (!event) return null;
  const [accent, soft] = SPECIAL_EVENT_TONES[event.type] || SPECIAL_EVENT_TONES.custom;
  const overlay = openSheet(event.title, () => h('div', { class: `special-event special-event--${event.type}` },
    event.image
      ? h('div', { class: 'special-event__photo' },
          h('img', { src: event.image, alt: '', loading: 'lazy', decoding: 'async' }))
      : null,
    h('div', { class: 'special-event__icon' }, event.icon),
    h('p', { class: 'special-event__message' }, event.description),
    events.length > 1 ? h('div', { class: 'special-event__list' }, ...events.slice(1).map(item =>
      h('div', { class: 'special-event__item' },
        h('span', { class: 'special-event__item-icon', 'aria-hidden': 'true' }, item.icon),
        h('span', { class: 'special-event__item-body' },
          h('b', null, item.title),
          item.description ? h('small', null, item.description) : null,
          item.image ? h('img', { class: 'special-event__item-photo', src: item.image, alt: '', loading: 'lazy', decoding: 'async' }) : null
        )
      )
    )) : null,
    preview
      ? h('div', { class: 'special-event__note special-event__note--preview' }, '👀 Vista previa: así se verá este día cuando llegue de verdad')
      : h('div', { class: 'special-event__note' }, 'Un día para guardar un momento bonito juntos 💌'),
    h('button', {
      class: 'btn special-event__action', type: 'button',
      onclick: () => { closeSheets(); router?.navigate?.('/calendario'); }
    }, 'Abrir nuestro calendario')
  ));
  overlay.classList.add('overlay--special-event');
  overlay.style.setProperty('--event-accent', accent);
  overlay.style.setProperty('--event-soft', soft);
  return overlay;
}

/** Abre la bienvenida de una fecha concreta sin marcarla como vista. */
export function previewSpecialEventSheet(value, router) {
  const iso = resolveEventPreview(value);
  if (!iso) return null;
  const events = specialEventsForDate(iso);
  if (!events.length) return null;
  return openSpecialEventSheet(events, router, { preview: true });
}

/**
 * Primera vez que se entra HOY en un día con evento: abre la hoja y marca
 * esa ocurrencia como vista (por usuario), para no repetirla al saltar
 * entre pestañas. Espera a que no haya una bienvenida de ánimo encima.
 */
export function maybeShowSpecialEvent(page, router) {
  const stored = getUserPref('specialEventsSeen', '{}');
  let seen = {};
  try { seen = JSON.parse(stored || '{}') || {}; } catch { /* clave dañada */ }
  const events = specialEventsToday().filter(item => !seen[item.key]);
  if (!events.length) return;

  const show = () => {
    if (!page.isConnected) return;
    if (document.querySelector('.welcome-overlay')) {
      setTimeout(show, 400);
      return;
    }
    events.forEach(event => { seen[event.key] = true; });
    setUserPref('specialEventsSeen', JSON.stringify(seen));
    openSpecialEventSheet(events, router);
  };
  if (window.requestIdleCallback) window.requestIdleCallback(show, { timeout: 1200 });
  else setTimeout(show, 350);
}
