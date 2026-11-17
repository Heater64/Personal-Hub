/* ==========================================
   WidgetsSheet.js — la pestaña de widgets.

   La vista previa imita el layout nativo de verdad: el pequeño no es el grande
   con letra menor, sino otra composición (sin fotos, sin años…). Al cambiar de
   tamaño se vuelve a dibujar, para que se vea lo que se va a colocar.
   ========================================== */

import { openSheet } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import { pinWidget } from '../services/widgets.service.js';

const WIDGETS = [
  { id: 'days', title: 'Días juntos', desc: 'El contador con vuestras caras.' },
  { id: 'distance', title: 'Distancia', desc: 'Los kilómetros que os separan.' },
  { id: 'together', title: 'Tiempo juntos', desc: 'Años, meses y días sueltos.' },
];

const SIZES = { compact: 'Pequeño', wide: 'Grande' };

const face = person =>
  `<span class="wprev__face">${person?.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="">` : ''}</span>`;

/** Dibuja la miniatura de un widget en el tamaño indicado. */
function preview(id, size, data) {
  const { me, partner, stats, days, km, ago } = data;
  const wide = size === 'wide';
  const total = Number.isFinite(days) ? days : 501;
  const distance = km ?? '301 km';

  if (id === 'days') {
    return `
      <div class="wprev wprev--days wprev--${wide ? 'wide' : 'compact'}">
        ${wide ? `<div class="wprev__faces">${face(me)}${face(partner)}</div>` : ''}
        <p class="wprev__big"><b>${total}</b> <span>días</span></p>
        <p class="wprev__sub">juntos</p>
      </div>`;
  }

  if (id === 'distance') {
    return wide
      ? `
      <div class="wprev wprev--distance wprev--wide">
        <p class="wprev__label">estáis a</p>
        <p class="wprev__big"><b>${escapeHtml(String(distance))}</b></p>
        <div class="wprev__faces wprev__faces--small">${face(me)}${face(partner)}</div>
        <p class="wprev__caption">${escapeHtml(ago || 'hace 2 min')}</p>
      </div>`
      : `
      <div class="wprev wprev--distance wprev--compact">
        <p class="wprev__big"><b>${escapeHtml(String(distance))}</b></p>
        <p class="wprev__label">estáis a</p>
      </div>`;
  }

  const y = stats?.years ?? 1;
  const m = stats?.months ?? 4;
  const d = stats?.days ?? 13;

  return wide
    ? `
      <div class="wprev wprev--together wprev--wide">
        <p class="wprev__label">han estado juntos por</p>
        <p class="wprev__triple">
          <span><b>${y}</b>años</span><span><b>${m}</b>meses</span><span><b>${d}</b>días</span>
        </p>
        <p class="wprev__caption">años, meses y días</p>
      </div>`
    : `
      <div class="wprev wprev--together wprev--compact">
        <p class="wprev__triple"><span><b>${m}</b>meses</span><span><b>${d}</b>días</span></p>
        <p class="wprev__caption">han estado juntos por</p>
      </div>`;
}

/**
 * Abre la hoja de widgets.
 * `me`/`partner`: { name, avatar } · `stats`: { years, months, days } ·
 * `days`: total · `km`: texto de la distancia.
 */
export function openWidgetsSheet({ me, partner, stats, days, km } = {}) {
  const data = { me, partner, stats, days, km, ago: '' };

  openSheet('Widgets', () => {
    const wrap = document.createElement('div');
    wrap.className = 'wsheet';
    wrap.innerHTML = `
      <p class="wsheet__intro">Elige el widget y su tamaño. Android te pedirá confirmación antes de colocarlo.</p>
      ${WIDGETS.map(
        w => `
        <article class="wsheet__item" data-widget-card="${w.id}">
          <div class="wsheet__preview">${preview(w.id, 'wide', data)}</div>
          <div class="wsheet__info">
            <h3>${escapeHtml(w.title)}</h3>
            <p>${escapeHtml(w.desc)}</p>
            <div class="wsheet__sizes" role="group" aria-label="Tamaño de ${escapeHtml(w.title)}">
              ${Object.entries(SIZES)
                .map(
                  ([size, label]) =>
                    `<button type="button" class="wsheet__size${size === 'wide' ? ' is-on' : ''}" data-size="${size}">${label}</button>`
                )
                .join('')}
            </div>
            <button type="button" class="wsheet__add" data-add-widget="${w.id}">Añadir a la pantalla de inicio</button>
            <p class="wsheet__status" data-status="${w.id}" hidden></p>
          </div>
        </article>`
      ).join('')}
      <p class="wsheet__note">Si el diálogo no aparece, mantén pulsado un hueco del escritorio → Widgets → Hub🧸. También puedes cambiar el tamaño de un widget ya puesto arrastrando sus esquinas.</p>
    `;

    // Cambiar de tamaño redibuja la miniatura con la composición de ese tamaño.
    wrap.querySelectorAll('[data-widget-card]').forEach(card => {
      const widget = card.dataset.widgetCard;
      const holder = card.querySelector('.wsheet__preview');

      card.querySelectorAll('.wsheet__size').forEach(btn => {
        btn.addEventListener('click', () => {
          card.querySelectorAll('.wsheet__size').forEach(b => b.classList.remove('is-on'));
          btn.classList.add('is-on');
          holder.innerHTML = preview(widget, btn.dataset.size, data);
        });
      });
    });

    // Colocar el widget elegido.
    wrap.querySelectorAll('[data-add-widget]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('[data-widget-card]');
        const widget = btn.dataset.addWidget;
        const size = card.querySelector('.wsheet__size.is-on')?.dataset.size || 'wide';
        const status = card.querySelector(`[data-status="${widget}"]`);

        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Abriendo…';

        const { pinned, reason } = await pinWidget(widget, size);

        btn.disabled = false;
        btn.textContent = original;
        if (status) {
          status.hidden = false;
          status.textContent = pinned
            ? 'Listo: confirma en el diálogo de Android.'
            : reason === 'unsupported'
              ? 'Tu launcher no permite añadirlo desde aquí: hazlo desde el menú de widgets.'
              : 'No se pudo abrir el diálogo. Prueba desde el menú de widgets.';
        }
      });
    });

    return wrap;
  });
}
