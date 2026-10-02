/* ==========================================
   BIENVENIDA DE DÍA ESPECIAL
   Hoja temática que aparece la primera vez
   que se entra un día con evento (aniversario,
   cumpleaños, Halloween, Navidad, o lo que se
   haya configurado en Admin → Configuración).

   Lleva su decoración (confeti, nieve, hojas,
   corazones o estrellas), un vídeo de portada
   o de fondo y una tira de fotos.

   Vive en components/ y no en Home.js para que
   se pueda abrir desde cualquier sitio (la
   vista previa `?evento=halloween`, el panel
   Admin y la página de pruebas) sin arrastrar
   toda la portada.
   ========================================== */

import { specialEventsForDate, specialEventsToday, resolveEventPreview, SPECIAL_EVENT_TONES } from '../utils/specialDates.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { openSheet, closeSheets, h } from './ui.js';
import { playCelebration, stopCelebration } from './Celebration.js';
import { normalizeDecor, normalizeVideoMode, emojisFor } from '../utils/celebration.js';

// Un <video> que se deja sonando detrás de otra pantalla derrama el audio al
// móvil. Se apaga al cerrar la hoja, como ya se hacía con el visor de la galería.
let sheetMedia = [];
function stopSheetMedia() {
  sheetMedia.forEach(video => { try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* ya no está */ } });
  sheetMedia = [];
  stopCelebration();
}

/**
 * Abre la hoja temática de una lista de eventos (el primero es el titular).
 * `preview` añade una aviso de que es una simulación, no el día real.
 */
export function openSpecialEventSheet(events, router, { preview = false } = {}) {
  const event = events[0];
  if (!event) return null;
  stopSheetMedia();
  const [accent, soft] = SPECIAL_EVENT_TONES[event.type] || SPECIAL_EVENT_TONES.custom;
  const decor = normalizeDecor(event.decor);
  const video = event.video || '';
  const videoMode = normalizeVideoMode(event.videoMode);
  const gallery = Array.isArray(event.gallery) ? event.gallery.filter(Boolean) : [];

  const overlay = openSheet(event.title, () => {
    // Foto de portada: la primera de la galería hace de foto grande, para no
    // repetir la misma imagen dos veces si se han subido varias.
    const portada = event.image || gallery[0] || '';
    const resto = event.image ? gallery : gallery.slice(1);
    // Con el vídeo de portada el vídeo manda: no cabe foto encima. Con el de
    // fondo, la foto grande va delante y las miniaturas la cambian (el vídeo
    // se ve alrededor), que es como se leen mejor las fotos.
    const conVideoPortada = Boolean(video) && videoMode === 'portada';

    return h('div', { class: `special-event special-event--${event.type} special-event--media-${video && videoMode === 'fondo' ? 'fondo' : 'limpio'}` },
      // El vídeo va detrás de todo cuando es fondo, y es la portada cuando no.
      video && videoMode === 'fondo'
        ? h('video', {
            class: 'special-event__film',
            src: video,
            poster: portada || null,
            autoplay: true, muted: true, loop: true, playsinline: true,
            preload: 'metadata', 'aria-hidden': 'true'
          })
        : null,
      video && videoMode === 'fondo' ? h('div', { class: 'special-event__scrim' }) : null,
      conVideoPortada
        ? h('div', { class: 'special-event__video' },
            h('video', {
              src: video,
              poster: portada || null,
              autoplay: true, muted: true, loop: true, playsinline: true,
              controls: true, preload: 'metadata'
            }))
        : null,
      !conVideoPortada && portada
        ? h('div', { class: 'special-event__photo' },
            h('img', { src: portada, alt: '', loading: 'lazy', decoding: 'async' }))
        : null,
      h('div', { class: 'special-event__icon' }, event.icon),
      h('p', { class: 'special-event__message' }, event.description),
      resto.length && !conVideoPortada
        ? h('div', { class: 'special-event__gallery', role: 'group', 'aria-label': 'Fotos de este día' },
            ...resto.map((src, i) => h('button', {
              class: 'special-event__thumb', type: 'button',
              'data-gallery-index': String(i),
              onclick: (ev) => {
                ev.currentTarget.closest('.special-event')?.querySelector('.special-event__photo img')
                  ?.setAttribute('src', src);
              }
            }, h('img', { src, alt: '', loading: 'lazy', decoding: 'async' }))))
        : null,
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
    );
  }, stopSheetMedia);
  overlay.classList.add('overlay--special-event');
  overlay.style.setProperty('--event-accent', accent);
  overlay.style.setProperty('--event-soft', soft);

  // Los <video> de esta hoja se guardan para poder pararlos al cerrar.
  sheetMedia = [...overlay.querySelectorAll('video')];
  // muted y playsinline son propiedades del elemento, no atributos reflejados:
  // puestos como atributo, el vídeo arrancaba con sonido y a pantalla
  // completa, que es justo lo que un pop-up no quiere.
  sheetMedia.forEach(video => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    // Si la URL no existe o el navegador no decodifica ese formato, el
    // reproductor se retira: un rectángulo negro no es un error que ver.
    video.addEventListener('error', () => {
      video.closest('.special-event__video, .special-event__film')?.remove();
      const scrim = overlay.querySelector('.special-event__scrim');
      if (scrim) scrim.remove();
    }, { once: true });
  });
  // Los emojis que caen: los que se escribieron para ese día y, si no hay,
  // los de su fiesta (Halloween de calabazas y fantasmas, Navidad de árboles…).
  const emojis = emojisFor(event.emojis, event.type);
  if (!preview) playCelebration({ decor, accent, emojis, amount: videoMode === 'fondo' ? 60 : 110 });
  else playCelebration({ decor, accent, emojis, amount: 40, duration: 2600 });
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
 * Olvida que la bienvenida de hoy ya se vio y la abre otra vez, tal cual
 * saltaría. Para eventos con ♻️ la marca es por año, así que si el día se vio
 * y luego se cambia la fecha, la hoja ya no volverá a salir sola en todo el
 * año: con esto se puede volver a verla al momento.
 * Devuelve la hoja abierta, o null si hoy no hay ningún día configurado.
 */
export function replaySpecialEventSheet(router) {
  const events = specialEventsToday();
  if (!events.length) return null;
  const stored = getUserPref('specialEventsSeen', '{}');
  let seen = {};
  try { seen = JSON.parse(stored || '{}') || {}; } catch { /* clave dañada */ }
  events.forEach(event => { delete seen[event.key]; });
  setUserPref('specialEventsSeen', JSON.stringify(seen));
  return openSpecialEventSheet(events, router);
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