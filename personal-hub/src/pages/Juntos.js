/* ==========================================
   JUNTOS — la pantalla del aniversario.

   Se abre al tocar el widget de días en la pantalla de inicio (deep link
   `personalhub://juntos`). Es la versión a pantalla completa del contador:
   fecha, la píldora de cristal con años/meses/días y, abajo, el mismo tiempo
   dicho de otra forma.

   Arriba a la derecha hay un engranaje: elige fondo (cinco ambientes) y lleva
   a la fecha del aniversario cuando quien mira es el admin.
   ========================================== */

import { daysSinceAnniversary, loadSpecialDates, specialDates } from '../utils/specialDates.js';
import { togetherBreakdown } from '../services/widgets.service.js';
import { icon, openSheet } from '../components/ui.js';
import { escapeHtml } from '../utils/escape.js';
import { userStore } from '../stores/user.store.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';

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

/**
 * Ambientes del fondo. Cada uno son tres focos y un color base: la misma
 * composición que la versión original, con otra luz.
 */
const FONDOS = [
  { id: 'plaza', label: 'Plaza', base: '#0b0710', a: '#f0b23c', b: '#7b4bb3', c: '#a8462f' },
  { id: 'luna', label: 'Luna', base: '#06081a', a: '#8ea8ff', b: '#3a4fd0', c: '#1b2560' },
  { id: 'bosque', label: 'Bosque', base: '#050d0b', a: '#4fbf8b', b: '#1f6b5a', c: '#c8a24a' },
  { id: 'corazon', label: 'Corazón', base: '#12040c', a: '#ff8fb1', b: '#c0306a', c: '#5a1140' },
  { id: 'rosa', label: 'Rosa', base: '#0d0a12', a: '#d4789b', b: '#6a2f7d', c: '#e0a3b7' },
];

const PREF_FONDO = 'juntosTheme';

function fondoActual() {
  const id = getUserPref(PREF_FONDO, 'plaza');
  return FONDOS.find(f => f.id === id) || FONDOS[0];
}

function estiloFondo(fondo) {
  return `--j-base:${fondo.base};--j-a:${fondo.a};--j-b:${fondo.b};--j-c:${fondo.c}`;
}

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
    const fondo = fondoActual();

    page.style.cssText = estiloFondo(fondo);

    page.innerHTML = `
      <div class="juntos__bg" aria-hidden="true">
        <span class="juntos__glow juntos__glow--a"></span>
        <span class="juntos__glow juntos__glow--b"></span>
        <span class="juntos__glow juntos__glow--c"></span>
      </div>

      <header class="juntos__top">
        <button class="juntos__back" type="button" data-back aria-label="Volver">${icon('chev', 20)}</button>
        <p class="juntos__date">${escapeHtml(aniversario)}</p>
        <button class="juntos__gear" type="button" data-settings aria-label="Ajustes">${icon('gear', 19)}</button>
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

  /** Engranaje: fondo y fecha del aniversario. */
  const abrirAjustes = () => {
    openSheet('Ajustes', () => {
      const wrap = document.createElement('div');
      wrap.className = 'jsettings';

      const activo = fondoActual().id;
      wrap.innerHTML = `
        <p class="jsettings__group">cambiar fondo</p>
        <div class="jsettings__grid" role="list">
          ${FONDOS.map(
            f => `
            <button type="button" class="jthumb${f.id === activo ? ' is-on' : ''}" role="listitem"
              data-fondo="${f.id}" style="${estiloFondo(f)}" aria-pressed="${f.id === activo}">
              <span class="jthumb__dot jthumb__dot--a"></span>
              <span class="jthumb__dot jthumb__dot--b"></span>
              <span class="jthumb__name">${f.label}</span>
            </button>`
          ).join('')}
        </div>

        <p class="jsettings__group">aniversario</p>
        <div class="jsettings__row">
          <span class="jsettings__row-body">
            <b>${escapeHtml(fechaLarga(specialDates().anniversary) || 'Sin fecha')}</b>
            <span>${userStore.isAdmin ? 'Cámbiala en el panel' : 'Solo el admin puede cambiarla'}</span>
          </span>
          ${
            userStore.isAdmin
              ? '<button type="button" class="jsettings__go" data-go-admin>Ir al panel</button>'
              : ''
          }
        </div>
      `;

      // Elegir fondo: se guarda por usuario y se repinta en el acto.
      wrap.querySelectorAll('[data-fondo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.fondo;
          const fondo = FONDOS.find(f => f.id === id) || FONDOS[0];
          setUserPref(PREF_FONDO, fondo.id);
          page.style.cssText = estiloFondo(fondo);
          wrap.querySelectorAll('[data-fondo]').forEach(b => {
            const on = b === btn;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
          });
        });
      });

      wrap
        .querySelector('[data-go-admin]')
        ?.addEventListener('click', () => router.navigate('/admin'));

      return wrap;
    });
  };

  render();

  // Las fechas reales llegan de Supabase: si el aniversario cambió en el panel,
  // esta pantalla tiene que decir lo mismo que la portada.
  loadSpecialDates()
    .then(() => render())
    .catch(() => {});

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
    if (event.target.closest('[data-settings]')) abrirAjustes();
  });

  page.cleanup = () => {};
  return page;
}
