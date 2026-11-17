/* ==========================================
   WidgetsSheet.js — la pestaña de widgets.

   Enseña los widgets disponibles tal y como se van a ver, deja elegir tamaño
   y coloca el elegido con el diálogo del sistema. La vista previa es HTML: un
   widget real no se puede dibujar dentro de la app.
   ========================================== */

import { openSheet } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import { pinWidget } from '../services/widgets.service.js';

const WIDGETS = [
  {
    id: 'days',
    title: 'Días juntos',
    desc: 'El contador con las dos caras.',
    preview: (me, partner) => `
      <div class="wprev wprev--days">
        <div class="wprev__faces">
          <span class="wprev__face">${me?.avatar ? `<img src="${escapeHtml(me.avatar)}" alt="">` : ''}</span>
          <span class="wprev__face">${partner?.avatar ? `<img src="${escapeHtml(partner.avatar)}" alt="">` : ''}</span>
        </div>
        <p class="wprev__big"><b>501</b> <span>días</span></p>
        <p class="wprev__sub">juntos</p>
      </div>`,
    sizes: { compact: 'Pequeño', wide: 'Grande' },
  },
  {
    id: 'distance',
    title: 'Distancia',
    desc: 'Los kilómetros que os separan ahora.',
    preview: (me, partner) => `
      <div class="wprev wprev--distance">
        <p class="wprev__label">estáis a</p>
        <p class="wprev__big"><b>301</b> <span>km</span></p>
        <div class="wprev__faces wprev__faces--small">
          <span class="wprev__face">${me?.avatar ? `<img src="${escapeHtml(me.avatar)}" alt="">` : ''}</span>
          <span class="wprev__face">${partner?.avatar ? `<img src="${escapeHtml(partner.avatar)}" alt="">` : ''}</span>
        </div>
      </div>`,
    sizes: { compact: 'Pequeño', wide: 'Grande' },
  },
  {
    id: 'together',
    title: 'Tiempo juntos',
    desc: 'Años, meses y días sueltos.',
    preview: (me, partner, stats) => `
      <div class="wprev wprev--together">
        <p class="wprev__label">han estado juntos por</p>
        <p class="wprev__triple">
          <span><b>${stats?.years ?? 1}</b>a</span>
          <span><b>${stats?.months ?? 4}</b>m</span>
          <span><b>${stats?.days ?? 13}</b>d</span>
        </p>
      </div>`,
    sizes: { compact: 'Pequeño', wide: 'Grande' },
  },
];

/**
 * Abre la hoja de widgets.
 * `me` y `partner` son `{ name, avatar }` para las vistas previas.
 */
export function openWidgetsSheet({ me, partner, stats } = {}) {
  openSheet('Widgets', () => {
    const wrap = document.createElement('div');
    wrap.className = 'wsheet';
    wrap.innerHTML = `
      <p class="wsheet__intro">Elige el widget y su tamaño. Android te pedirá confirmación antes de colocarlo.</p>
      ${WIDGETS.map(
        (w, i) => `
        <article class="wsheet__item" data-widget-card="${w.id}">
          <div class="wsheet__preview">${w.preview(me, partner, stats)}</div>
          <div class="wsheet__info">
            <h3>${escapeHtml(w.title)}</h3>
            <p>${escapeHtml(w.desc)}</p>
            <div class="wsheet__sizes" role="group" aria-label="Tamaño de ${escapeHtml(w.title)}">
              ${Object.entries(w.sizes)
                .map(
                  ([size, label], j) =>
                    `<button type="button" class="wsheet__size${j === 1 ? ' is-on' : ''}" data-size="${size}">${label}</button>`
                )
                .join('')}
            </div>
            <button type="button" class="wsheet__add" data-add-widget="${w.id}">Añadir a la pantalla de inicio</button>
            <p class="wsheet__status" data-status="${w.id}" hidden></p>
          </div>
        </article>
        ${i === 0 ? '' : ''}`
      ).join('')}
      <p class="wsheet__note">Si el diálogo no aparece, mantén pulsado un hueco del escritorio → Widgets → Hub🧸. También puedes cambiar el tamaño de un widget ya puesto arrastrando sus esquinas.</p>
    `;

    // Elección de tamaño por widget (una sola opción activa).
    wrap.querySelectorAll('[data-widget-card]').forEach(card => {
      card.querySelectorAll('.wsheet__size').forEach(btn => {
        btn.addEventListener('click', () => {
          card.querySelectorAll('.wsheet__size').forEach(b => b.classList.remove('is-on'));
          btn.classList.add('is-on');
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
