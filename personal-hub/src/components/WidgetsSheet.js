/* ==========================================
   WidgetsSheet.js — la pestaña de widgets.

   La vista previa imita el layout nativo de verdad: cada tamaño es una
   composición propia (el pequeño solo enseña el dato, el rectangular es
   horizontal, el grande apila caras y texto). Los datos son los de
   PersonalHub: si falta algo, se ve el mismo estado vacío del widget.

   En el navegador la hoja sirve para revisar las miniaturas; colocar el
   widget en el escritorio solo lo puede hacer el APK (requestPinAppWidget).
   ========================================== */

import { openSheet } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import { pinWidget, readSavedWidget, widgetPreview } from '../services/widgets.service.js';
import { isNative } from '../services/native.service.js';
import { todayISO } from '../utils/format.js';

const SIZES = [
  { id: 'compact', label: 'Pequeño' },
  { id: 'rect', label: 'Rectangular' },
  { id: 'large', label: 'Grande' },
];

const WIDGETS = [
  {
    id: 'days',
    title: 'Días juntos',
    desc: 'El contador con vuestras caras.',
    sizes: SIZES,
    defaultSize: 'rect',
  },
  {
    id: 'distance',
    title: 'Distancia',
    desc: 'Los kilómetros que os separan.',
    // El provider grande de distancia sigue llamándose «wide» en el puente.
    sizes: SIZES.map(size => (size.id === 'large' ? { id: 'wide', label: size.label } : size)),
    defaultSize: 'rect',
  },
  {
    id: 'countdown',
    title: 'Cuenta atrás',
    desc: 'Lo que falta para las fechas que elijas: Android te pregunta al colocarlo.',
    sizes: SIZES,
    defaultSize: 'rect',
  },
  {
    id: 'mood',
    title: 'Estado de ánimo',
    desc: 'El ánimo de ella, solo el de ella.',
    sizes: SIZES,
    defaultSize: 'rect',
  },
  {
    id: 'cycle',
    title: 'Ciclo',
    desc: 'La fase y cuándo llega la próxima regla.',
    sizes: SIZES,
    defaultSize: 'rect',
  },
  {
    id: 'watching',
    title: 'Seguir viendo',
    desc: 'La serie que estáis viendo, por donde vais.',
    sizes: SIZES,
    defaultSize: 'rect',
  },
  {
    id: 'gifts',
    title: 'Sorpresas',
    desc: 'Lo que os espera hoy en el calendario.',
    sizes: SIZES,
    defaultSize: 'rect',
  },
  // Fase 5: tres widgets de texto, solo en cuadrado y apaisado.
  {
    id: 'reason',
    title: 'Razón del día',
    desc: 'La razón que os toca hoy, siempre a mano.',
    sizes: SIZES.filter(size => size.id !== 'large'),
    defaultSize: 'rect',
  },
  {
    id: 'openwhen',
    title: 'Open When',
    desc: 'Cuántas cartas te quedan por descubrir.',
    sizes: SIZES.filter(size => size.id !== 'large'),
    defaultSize: 'rect',
  },
  {
    id: 'streak',
    title: 'Racha',
    desc: 'Los días seguidos con ánimo registrado.',
    sizes: SIZES.filter(size => size.id !== 'large'),
    defaultSize: 'rect',
  },
];

/**
 * Ejemplos neutros para las miniaturas de razón, Open When y racha.
 *
 * Su paquete lo escribe su propia pantalla, así que al abrir la hoja desde
 * Inicio todavía no existe (y en el navegador nunca, porque Preferences solo
 * vive en el APK). Sin este respaldo la miniatura enseñaba un guion.
 */
const PREVIEW_SAMPLES = {
  reason: { text: 'Por cómo me haces reír incluso en los días grises.' },
  openwhen: { pending: 3 },
  streak: { days: 7, best: 12 },
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «3 jul 2026», igual que lo pinta el widget de Android. */
function shortDate(iso) {
  const [year, month, day] = String(iso || '')
    .split('-')
    .map(Number);
  if (!year || !month || !day) return '';
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Las dos primeras emociones y «+N»: lo mismo que pinta el widget. */
function moodLabel(mood) {
  if (!mood) return 'sin registrar';
  const labels = (mood.items || []).map(item => item?.label).filter(Boolean);
  if (labels.length > 2) return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2}`;
  if (labels.length) return labels.join(' · ');
  return mood.label || 'Registrado';
}

const face = (person, variant = '') =>
  `<span class="wprev__face${variant ? ` wprev__face--${variant}` : ''}">${
    person?.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="">` : ''
  }</span>`;

const plural = (value, one, many) => `${value} ${value === 1 ? one : many}`;

/** «1 año y 4 meses», el mismo texto que calcula el lado Android. */
function breakdownLabel(stats) {
  const years = Number(stats?.years) || 0;
  const months = Number(stats?.months) || 0;
  if (!years && !months) return '';
  if (years && months) return `${plural(years, 'año', 'años')} y ${plural(months, 'mes', 'meses')}`;
  if (years) return plural(years, 'año', 'años');
  return plural(months, 'mes', 'meses');
}

/** «ahora mismo» / «hace 5 min» / «hace 2 h», como el widget real. */
function agoLabel(ms) {
  if (!Number.isFinite(ms)) return 'abre la app';
  const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return 'abre la app para actualizar';
}

/** Dibuja la miniatura de un widget en el tamaño indicado. */
function preview(id, size, data) {
  const { me, partner, days, breakdown, km, kmAt, next, mood, cycle, watch, gifts } = data;
  const count = Number.isFinite(days) ? String(days) : '—';
  const breakdownText = Number.isFinite(days) ? breakdownLabel(breakdown) : '';
  const compact = size === 'compact';
  const stacked = size === 'large' || size === 'wide';

  if (id === 'days') {
    const kicker = '<p class="wprev__kicker">DÍAS JUNTOS</p>';

    // Pequeño: una sola idea, el número.
    if (compact) {
      return `
        <div class="wprev wprev--days wprev--compact">
          ${kicker}
          <p class="wprev__count">${count}</p>
          ${count === '—' ? '<p class="wprev__hint">abre la app</p>' : ''}
        </div>`;
    }

    // Rectangular: horizontal, con acento coral y las caras a la derecha.
    if (!stacked) {
      return `
        <div class="wprev wprev--days wprev--rect">
          <span class="wprev__accent" aria-hidden="true"></span>
          <div class="wprev__col">
            ${kicker}
            <p class="wprev__row"><span class="wprev__count">${count}</span><span class="wprev__unit">días</span></p>
            ${
              breakdownText
                ? `<p class="wprev__meta">${escapeHtml(breakdownText)}</p>`
                : count === '—'
                  ? '<p class="wprev__meta">abre la app</p>'
                  : ''
            }
          </div>
          <div class="wprev__faces wprev__faces--rect">${face(me)}${face(partner)}</div>
        </div>`;
    }

    // Grande: misma fila coral que el rectangular, con sitio para las caras.
    // El widget de 4×2 es apaisado: no apila el contenido en vertical.
    return `
      <div class="wprev wprev--days wprev--large">
        <span class="wprev__accent" aria-hidden="true"></span>
        <div class="wprev__col">
          ${kicker}
          <p class="wprev__row"><span class="wprev__count">${count}</span><span class="wprev__unit">días</span></p>
          ${
            breakdownText
              ? `<p class="wprev__meta">${escapeHtml(breakdownText)}</p>`
              : count === '—'
                ? '<p class="wprev__meta">abre la app</p>'
                : ''
          }
        </div>
        <div class="wprev__faces wprev__faces--rect">${face(me)}${face(partner)}</div>
      </div>`;
  }

  if (id === 'countdown') {
    const count = !next ? '—' : next.days === 0 ? 'hoy' : String(next.days);
    const unit = next && next.days > 0 ? '<span class="wprev__unit">días</span>' : '';
    const title = next ? next.title : 'sin fechas próximas';
    const dateText = next ? shortDate(next.date) : '';

    if (compact) {
      return `
        <div class="wprev wprev--countdown wprev--compact">
          <p class="wprev__kicker">${escapeHtml(title)}</p>
          <p class="wprev__row"><span class="wprev__count">${count}</span>${unit}</p>
        </div>`;
    }

    if (!stacked) {
      return `
        <div class="wprev wprev--countdown wprev--rect">
          <span class="wprev__accent" aria-hidden="true"></span>
          <div class="wprev__col">
            <p class="wprev__kicker">${escapeHtml(title)}</p>
            <p class="wprev__row"><span class="wprev__count">${count}</span>${unit}</p>
            ${dateText ? `<p class="wprev__meta">${escapeHtml(dateText)}</p>` : ''}
          </div>
        </div>`;
    }

    return `
      <div class="wprev wprev--countdown wprev--large">
        <span class="wprev__accent" aria-hidden="true"></span>
        <div class="wprev__col">
          <p class="wprev__kicker">FALTAN</p>
          <p class="wprev__row"><span class="wprev__count">${count}</span>${unit}</p>
          <p class="wprev__meta">${escapeHtml(dateText ? `${title} · ${dateText}` : title)}</p>
        </div>
      </div>`;
  }

  if (id === 'cycle') {
    const c = cycle;
    const phase = c?.phase || 'sin registros';
    const day = c ? String(c.day) : '—';
    const detail = c ? `día ${c.day} de ~${c.length || '—'}` : '';
    const next = c ? `próxima regla en ${c.days} d` : '';

    if (compact) {
      return `
        <div class="wprev wprev--cycle wprev--compact">
          <p class="wprev__kicker">CICLO</p>
          <p class="wprev__count wprev__count--sm">${escapeHtml(day)}</p>
          <p class="wprev__meta">${escapeHtml(phase)}</p>
        </div>`;
    }

    if (!stacked) {
      return `
        <div class="wprev wprev--cycle wprev--rect">
          <span class="wprev__accent" aria-hidden="true"></span>
          <div class="wprev__col">
            <p class="wprev__kicker">CICLO</p>
            <p class="wprev__title">${escapeHtml(phase)}</p>
            ${detail ? `<p class="wprev__meta wprev__meta--rose">${escapeHtml(detail)}</p>` : ''}
            ${next ? `<p class="wprev__meta">${escapeHtml(next)}</p>` : ''}
          </div>
        </div>`;
    }

    return `
      <div class="wprev wprev--cycle wprev--large">
        <span class="wprev__accent" aria-hidden="true"></span>
        <div class="wprev__col">
          <p class="wprev__kicker">CICLO</p>
          <p class="wprev__title">${escapeHtml(phase)}</p>
          ${detail ? `<p class="wprev__meta wprev__meta--rose">${escapeHtml(detail)}</p>` : ''}
          ${next ? `<p class="wprev__meta">${escapeHtml(next)}</p>` : ''}
        </div>
      </div>`;
  }

  if (id === 'watching') {
    const first = watch;
    const title = first?.item?.titulo || 'nada en marcha';
    const poster = first?.item?.portada || '';
    const episode = first ? `Ep. ${first.watched} de ${first.total}` : '';
    const percent = first ? `${first.percent} % visto` : '';

    return `
      <div class="wprev wprev--watching wprev--${compact ? 'compact' : stacked ? 'large' : 'rect'}">
        <span class="wprev__poster">${poster ? `<img src="${escapeHtml(poster)}" alt="">` : ''}</span>
        <div class="wprev__col">
          ${!compact ? '<p class="wprev__kicker">SEGUIR VIENDO</p>' : ''}
          <p class="wprev__title">${escapeHtml(title)}</p>
          ${episode ? `<p class="wprev__meta">${escapeHtml(episode)}</p>` : ''}
          ${!compact && percent ? `<p class="wprev__meta wprev__meta--rose">${escapeHtml(percent)}</p>` : ''}
        </div>
      </div>`;
  }

  if (id === 'gifts') {
    const total = Number(gifts?.total) || 0;
    const pending = Number(gifts?.pending) || 0;
    const count = total ? String(pending) : '—';
    const label = !total
      ? 'sin sorpresas hoy'
      : pending > 0
        ? pending === 1
          ? 'sorpresa'
          : 'sorpresas'
        : 'ya las abriste';
    const hint = !total ? '' : pending > 0 ? 'en el calendario' : 'vuelve mañana';

    if (compact) {
      return `
        <div class="wprev wprev--gifts wprev--compact">
          <p class="wprev__emoji wprev__emoji--sm">🎁</p>
          <p class="wprev__count wprev__count--sm">${escapeHtml(count)}</p>
          <p class="wprev__meta">${escapeHtml(label)}</p>
        </div>`;
    }

    if (!stacked) {
      return `
        <div class="wprev wprev--gifts wprev--rect">
          <span class="wprev__accent" aria-hidden="true"></span>
          <div class="wprev__col">
            <p class="wprev__kicker">HOY</p>
            <p class="wprev__count wprev__count--sm">${escapeHtml(count)}</p>
            <p class="wprev__meta">${escapeHtml(label)}</p>
          </div>
        </div>`;
    }

    return `
      <div class="wprev wprev--gifts wprev--large">
        <span class="wprev__accent" aria-hidden="true"></span>
        <div class="wprev__col">
          <p class="wprev__kicker">HOY</p>
          <p class="wprev__row"><span class="wprev__count wprev__count--sm">${escapeHtml(count)}</span></p>
          <p class="wprev__meta">${escapeHtml(label)}</p>
          ${hint ? `<p class="wprev__meta">${escapeHtml(hint)}</p>` : ''}
        </div>
        <p class="wprev__emoji">🎁</p>
      </div>`;
  }

  if (id === 'mood') {
    const emoji = mood ? mood.items?.[0]?.emoji || mood.emoji : '—';
    const label = moodLabel(mood);
    const meta = mood ? 'hoy' : 'toca para registrar';

    if (compact) {
      return `
        <div class="wprev wprev--mood wprev--compact">
          <p class="wprev__emoji">${escapeHtml(emoji)}</p>
          <p class="wprev__mood-label">${escapeHtml(label)}</p>
          <p class="wprev__meta">${escapeHtml(meta)}</p>
        </div>`;
    }

    if (!stacked) {
      return `
        <div class="wprev wprev--mood wprev--rect">
          <p class="wprev__emoji">${escapeHtml(emoji)}</p>
          <div class="wprev__col">
            <p class="wprev__kicker">HOY</p>
            <p class="wprev__mood-label">${escapeHtml(label)}</p>
            <p class="wprev__meta">${escapeHtml(meta)}</p>
          </div>
        </div>`;
    }

    return `
      <div class="wprev wprev--mood wprev--large">
        <p class="wprev__emoji">${escapeHtml(emoji)}</p>
        <div class="wprev__col">
          <p class="wprev__kicker">HOY</p>
          <p class="wprev__mood-label">${escapeHtml(label)}</p>
          <p class="wprev__meta">${escapeHtml(meta)}</p>
        </div>
      </div>`;
  }

  if (id === 'distance') {
    const value = km || '—';
    const when = km ? agoLabel(kmAt) : 'abre la app';
    const kicker = '<p class="wprev__kicker wprev__kicker--coral">ESTÁIS A</p>';

    if (compact) {
      return `
        <div class="wprev wprev--distance wprev--compact">
          ${kicker}
          <p class="wprev__count wprev__count--distance">${escapeHtml(value)}</p>
          ${km ? '' : '<p class="wprev__hint">abre la app</p>'}
        </div>`;
    }

    if (!stacked) {
      return `
        <div class="wprev wprev--distance wprev--rect">
          <span class="wprev__accent" aria-hidden="true"></span>
          <div class="wprev__col">
            ${kicker}
            <p class="wprev__row"><span class="wprev__count wprev__count--distance">${escapeHtml(value)}</span></p>
            <p class="wprev__meta">${escapeHtml(when)}</p>
          </div>
          <div class="wprev__faces wprev__faces--rect">${face(me)}${face(partner)}</div>
        </div>`;
    }

    return `
      <div class="wprev wprev--distance wprev--large">
        <span class="wprev__accent" aria-hidden="true"></span>
        <div class="wprev__col">
          ${kicker}
          <p class="wprev__row"><span class="wprev__count wprev__count--distance">${escapeHtml(value)}</span></p>
          <p class="wprev__meta">${escapeHtml(when)}</p>
        </div>
        <div class="wprev__faces wprev__faces--rect">${face(me)}${face(partner)}</div>
      </div>`;
  }

  // ---- Widgets Pro: misma composición, distinto significado ----
  if (id === 'reason' || id === 'openwhen' || id === 'streak') {
    return proPreview(id, compact, data);
  }

  return '';
}

/**
 * Miniatura de los widgets Pro (razón del día, Open When y racha).
 *
 * Los tres comparten composición: rótulo, valor y etiqueta. El cuadrado se
 * queda con el rótulo corto y el valor (el CSS ya ocultaba la etiqueta a ese
 * tamaño); el apaisado añade la etiqueta. Si el valor es texto se recorta como
 * en el widget real; si es una cifra usa el número grande de siempre.
 */
function proPreview(id, compact, data) {
  const numeric = id !== 'reason';
  let short;
  let kicker;
  let value;
  let caption;

  if (id === 'reason') {
    short = 'razón';
    kicker = 'RAZÓN DEL DÍA';
    value = String(data.reason?.text || '').trim() || '—';
    caption = 'de vuestra lista';
  } else if (id === 'openwhen') {
    const pending = Number(data.openwhen?.pending) || 0;
    short = 'open when';
    kicker = 'OPEN WHEN';
    value = String(pending);
    caption = pending === 1 ? 'carta por descubrir' : 'cartas por descubrir';
  } else {
    const days = Number(data.streak?.days) || 0;
    const best = Math.max(days, Number(data.streak?.best) || 0);
    short = 'racha';
    kicker = 'RACHA';
    value = String(days);
    caption = days > 0
      ? `${days === 1 ? 'día seguido' : 'días seguidos'}${best > days ? ` · mejor: ${best}` : ''}`
      : 'empieza hoy';
  }

  const valueHTML = numeric
    ? `<span class="wprev__count wprev__count--pro">${escapeHtml(value)}</span>`
    : `<p class="wprev__pro-text${compact ? ' wprev__pro-text--sm' : ''}">${escapeHtml(value)}</p>`;

  return `
    <div class="wprev wprev--pro${compact ? ' wprev--compact' : ''}">
      <span class="wprev__kicker">${escapeHtml(compact ? short : kicker)}</span>
      ${valueHTML}
      ${compact ? '' : `<span class="wprev__caption">${escapeHtml(caption)}</span>`}
    </div>`;
}

/**
 * Abre la hoja de widgets.
 * `me`/`partner`: { name, avatar } · `days`: total · `km`: texto de la
 * distancia · `kmAt`: cuándo se supo esa distancia.
 */
export function openWidgetsSheet({
  me,
  partner,
  days,
  breakdown,
  km,
  kmAt,
  next,
  mood,
  cycle,
  watch,
  gifts,
  reason,
  openwhen,
  streak,
} = {}) {
  // Lo que Inicio no tiene a mano se toma del último paquete guardado: la
  // razón del día, las cartas o la racha los escribe su propia pantalla, y sin
  // este respaldo sus miniaturas salían vacías en la web.
  const saved = widget => readSavedWidget(widget) || null;
  // El ánimo del paquete solo vale si es de hoy: la miniatura dice «hoy», y
  // enseñar el de ayer con esa palabra sería mentir.
  const savedMood = saved('mood');
  const moodToday = savedMood && savedMood.date === todayISO() ? savedMood : null;

  const data = {
    me,
    partner,
    days,
    breakdown,
    km,
    kmAt,
    next,
    mood: mood || moodToday,
    cycle: cycle || saved('cycle'),
    watch,
    gifts: gifts || saved('gifts'),
    reason: reason || saved('reason') || PREVIEW_SAMPLES.reason,
    openwhen: openwhen || saved('openwhen') || PREVIEW_SAMPLES.openwhen,
    streak: streak || saved('streak') || PREVIEW_SAMPLES.streak,
  };
  const native = isNative();

  openSheet('Widgets', () => {
    const wrap = document.createElement('div');
    wrap.className = 'wsheet';
    wrap.innerHTML = `
      <p class="wsheet__intro">${
        native
          ? 'Elige el widget y su tamaño. Android te pedirá confirmación antes de colocarlo.'
          : 'Elige el widget y su tamaño para revisarlo. Colocarlo en la pantalla de inicio se hace desde la app de Android.'
      }</p>
      ${
        // El simulador de letra solo tiene sentido fuera del APK: allí el
        // widget se pinta con la letra real del móvil.
        native
          ? ''
          : `<div class="wsheet__fonts" role="group" aria-label="Tamaño de letra del sistema">
        <span>Letra</span>
        <button type="button" data-font="1" class="is-on">1,0×</button>
        <button type="button" data-font="1.3">1,3×</button>
        <button type="button" data-font="1.5">1,5×</button>
      </div>`
      }
      ${WIDGETS.map(
        w => `
        <article class="wsheet__item" data-widget-card="${w.id}">
          <div class="wsheet__preview">${preview(w.id, w.defaultSize, data)}</div>
          <div class="wsheet__info">
            <h3>${escapeHtml(w.title)}</h3>
            <p>${escapeHtml(w.desc)}</p>
            <div class="wsheet__sizes" role="group" aria-label="Tamaño de ${escapeHtml(w.title)}">
              ${w.sizes
                .map(
                  s =>
                    `<button type="button" class="wsheet__size${s.id === w.defaultSize ? ' is-on' : ''}" data-size="${s.id}">${s.label}</button>`
                )
                .join('')}
            </div>
            ${
              native
                ? `<button type="button" class="wsheet__add" data-add-widget="${w.id}">Añadir a la pantalla de inicio</button>
                   <p class="wsheet__status" data-status="${w.id}" hidden></p>`
                : '<p class="wsheet__hint">Disponible solo en la app de Android.</p>'
            }
          </div>
        </article>`
      ).join('')}
      <p class="wsheet__note">${
        native
          ? 'Si el diálogo no aparece, mantén pulsado un hueco del escritorio → Widgets → Hub🧸. También puedes cambiar el tamaño de un widget ya puesto arrastrando sus esquinas.'
          : 'Esta hoja enseña el mismo diseño que se coloca en el escritorio: cuadrado en 1×1 y apaisado en 3×1 y en 4×2, sin apilar el contenido.'
      }</p>
    `;

    // Letra del sistema: la miniatura se agranda con el widget (zoom), así que
    // la relación texto/hueco es la misma que con fontScale en el móvil.
    wrap.querySelectorAll('[data-font]').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('is-on', b === btn));
        if (btn.dataset.font === '1') delete wrap.dataset.font;
        else wrap.dataset.font = btn.dataset.font;
      });
    });

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

    // Dentro del APK la miniatura es el widget de verdad: el lado nativo infla
    // el mismo RemoteViews y lo devuelve como imagen. Si no responde, se queda
    // la maqueta de arriba en vez de un hueco vacío.
    if (native) {
      wrap.classList.add('wsheet--real');
      wrap.querySelectorAll('[data-widget-card]').forEach(card => {
        const widget = card.dataset.widgetCard;
        const holder = card.querySelector('.wsheet__preview');
        const title = card.querySelector('h3')?.textContent || 'widget';
        const draw = async () => {
          const size = card.querySelector('.wsheet__size.is-on')?.dataset.size || 'rect';
          const image = await widgetPreview(widget, size);
          if (!holder.isConnected) return;
          if (!image) {
            // Si el widget no se deja dibujar aquí, se dice en vez de enseñar
            // una maqueta que podría parecerse y no serlo.
            holder.innerHTML =
              '<p class="wsheet__preview-fail">No se pudo dibujar. Mira el widget ya colocado en la pantalla de inicio.</p>';
            return;
          }
          holder.innerHTML = `<img class="wsheet__real" src="${image}" alt="Vista previa de ${escapeHtml(title)}">`;
        };
        draw();
        card.querySelectorAll('.wsheet__size').forEach(btn => btn.addEventListener('click', draw));
      });
    }

    // Colocar el widget elegido (solo dentro del APK).
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
