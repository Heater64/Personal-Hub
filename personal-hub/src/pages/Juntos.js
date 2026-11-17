/* ==========================================
   JUNTOS — la pantalla del aniversario.

   Se abre al tocar el widget de días en la pantalla de inicio (deep link
   `personalhub://juntos`). Es la versión a pantalla completa del contador:
   fecha, la píldora de cristal con años/meses/días y, abajo, el mismo tiempo
   dicho de otra forma.
   ========================================== */

import { daysSinceAnniversary, loadSpecialDates, specialDates } from '../utils/specialDates.js';
import { togetherBreakdown } from '../services/widgets.service.js';
import { icon } from '../components/ui.js';
import { escapeHtml } from '../utils/escape.js';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function fechaLarga(iso) {
  const [year, month, day] = String(iso || '')
    .split('-')
    .map(Number);
  if (!year || !month || !day) return '';
  return `${day} de ${MESES[month - 1]} de ${year}`;
}

/** Todo lo que se pinta, en un solo sitio. */
function medidas() {
  const total = Math.max(0, daysSinceAnniversary());
  const breakdown = togetherBreakdown(total);
  return {
    total,
    years: breakdown.years,
    months: breakdown.months,
    days: breakdown.days,
    totalMonths: Math.floor(total / 30.4375),
    weeks: Math.floor(total / 7),
  };
}

/** «1 año» / «4 meses» / «13 días», con singular si toca. */
function unidad(valor, singular, plural) {
  return `<b>${valor}</b><span>${valor === 1 ? singular : plural}</span>`;
}

export function JuntosPage(router) {
  const page = document.createElement('div');
  page.className = 'juntos-page';

  const render = () => {
    const m = medidas();
    const aniversario = fechaLarga(specialDates().anniversary);

    page.innerHTML = `
      <div class="juntos__bg" aria-hidden="true">
        <span class="juntos__glow juntos__glow--a"></span>
        <span class="juntos__glow juntos__glow--b"></span>
        <span class="juntos__glow juntos__glow--c"></span>
      </div>

      <header class="juntos__top">
        <button class="juntos__back" type="button" data-back aria-label="Volver">${icon('chev', 20)}</button>
        <p class="juntos__date">${escapeHtml(aniversario)}</p>
        <span class="juntos__spacer" aria-hidden="true"></span>
      </header>

      <section class="juntos__pill" aria-label="Tiempo juntos">
        <p class="juntos__pill-label">han estado juntos por</p>
        <p class="juntos__pill-value">
          ${m.years > 0 ? unidad(m.years, 'año', 'años') : ''}
          ${unidad(m.months, 'mes', 'meses')}
          ${unidad(m.days, 'día', 'días')}
        </p>
      </section>

      <section class="juntos__verse" aria-label="En otras palabras">
        <p class="juntos__verse-label">en otras palabras</p>
        <p class="juntos__verse-numbers">
          <span>${unidad(m.totalMonths, 'mes', 'meses')}</span>
          <span class="juntos__dot" aria-hidden="true">·</span>
          <span>${unidad(m.weeks, 'semana', 'semanas')}</span>
          <span class="juntos__dot" aria-hidden="true">·</span>
          <span>${unidad(m.total, 'día', 'días')}</span>
        </p>
      </section>
    `;
  };

  render();

  // Las fechas reales llegan de Supabase: si el aniversario cambió en el panel,
  // esta pantalla tiene que decir lo mismo que la portada.
  loadSpecialDates()
    .then(() => render())
    .catch(() => {});

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
  });

  page.cleanup = () => {};
  return page;
}
