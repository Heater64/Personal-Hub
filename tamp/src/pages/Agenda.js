/* ==========================================
   Calendario compartido · Mal Día
   Una sola pantalla para los planes compartidos y el diario de días
   difíciles (`tamp_entries`). Las sorpresas tienen su propio módulo
   (Sorpresas.js).
   ========================================== */

import '../styles/agenda.css';
import { entries, writeEntry, dateAt, occurs } from '../services/agenda.js';
import { specialEventsForDate, loadSpecialDates } from '../utils/specialDates.js';
import { escapeHtml as esc } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import { userStore } from '../stores/user.store.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { emptyStateHTML, skeletonHTML } from '../components/states.js';
import { icon } from '../components/ui.js';
import { loadGiftsCatalog } from '../services/gifts.service.js';

const DAY = 86400000;
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const KINDS = {
  event: {
    title: 'Calendario',
    subtitle: 'Planes, fechas y regalos recibidos en un solo sitio.',
    action: 'Nuevo plan',
    emptyTitle: 'Todavía no hay planes',
    emptyText: 'Añade el primero y aparecerá también en el Inicio.',
    icon: 'calendar',
    one: 'plan',
    plural: 'planes',
    section: 'Planes y regalos del mes',
  },
  feeling: {
    title: 'Mal día',
    subtitle: 'Un espacio para los días difíciles.',
    action: 'Anotar cómo me sentí',
    emptyTitle: 'Aún no hay registros',
    emptyText: 'Cuando tengas un mal día, anótalo aquí. Sirve para entenderte y para que tu pareja sepa cómo acompañarte.',
    icon: 'heart',
    one: 'registro',
    plural: 'registros',
    section: 'Todos los registros',
    privateNote: 'Solo vosotros podéis leerlo.',
  },
};

const REPEATS = {
  once: 'Una vez',
  daily: 'Cada día',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
};

const FEELING_STATES = {
  pendiente: { label: 'Pendiente', tone: 'idea' },
  hablado: { label: 'Hablado', tone: 'ready' },
  resuelto: { label: 'Resuelto', tone: 'done' },
};

const FEELING_STATE_OPTIONS = Object.fromEntries(
  Object.entries(FEELING_STATES).map(([value, state]) => [value, state.label])
);

const dayDate = day => new Date(`${day}T12:00:00Z`);
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

const dateFormat = (options) => new Intl.DateTimeFormat('es-ES', { ...options, timeZone: 'UTC' });
const FORMAT = {
  month: dateFormat({ month: 'long', year: 'numeric' }),
  day: dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }),
  weekday: dateFormat({ weekday: 'long' }),
  dayNumber: dateFormat({ day: 'numeric' }),
  shortMonth: dateFormat({ month: 'short' }),
};

const monthLabel = key => capitalize(FORMAT.month.format(new Date(`${key}-01T12:00:00Z`)));
const displayDay = day => FORMAT.day.format(dayDate(day));
const weekday = day => capitalize(FORMAT.weekday.format(dayDate(day)));

function countdown(day) {
  const days = Math.round((dayDate(day) - dayDate(todayISO())) / DAY);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days > 1) return `En ${days} días`;
  if (days === -1) return 'Ayer';
  return `Hace ${-days} días`;
}

function shiftMonth(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

const TRASH_HINT = 'Se borra sola a los 30 días.';

function options(values, current) {
  return Object.entries(values)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`
    )
    .join('');
}

function renderAgenda(kind, router = null) {
  const meta = KINDS[kind];
  const page = document.createElement('section');
  page.className = 'ag-page';

  const isCalendar = kind === 'event';
  // La pantalla siempre se abre en el vistazo de hoy. El botón cambia el
  // contenido de debajo del calendario sin crear otra ruta ni otra pantalla.
  const routeDay = router?.currentRoute?.query?.day;
  const initialDay = isCalendar && /^\d{4}-\d{2}-\d{2}$/.test(routeDay || '')
    ? routeDay
    : todayISO();
  let monthView = false;
  const isFeeling = !isCalendar;
  const own = userStore.getUser()?.id;
  const canCreate = !isCalendar || userStore.isAdmin;
  const canEdit = row => (isCalendar ? userStore.isAdmin : row.author_id === own);

  let rows = [];
  let loaded = false;
  let month = initialDay.slice(0, 7);
  let trash = false;
  let selected = '';
  let active = true;
  let giftsCatalog = null;
  if (isCalendar && !monthView) selected = initialDay;
  const actions = `${canCreate
    ? `
        <button type="button" class="icon-btn" data-trash aria-pressed="false" aria-label="Papelera" title="Papelera">${icon('archive', 18)}</button>
        <button type="button" class="btn btn--sm" data-new>${icon('plus', 15)} <span>${esc(meta.action)}</span></button>
      `
      : ''}`;

  page.innerHTML = `
    ${renderPageHeader({ title: meta.title, subtitle: meta.subtitle, actions })}
    ${isCalendar ? `
      <section class="ag-today-banner" aria-live="polite">
        <span class="ag-eyebrow" data-banner-kicker>Hoy</span>
        <h2 data-banner-title>Lo que tenemos para hoy</h2>
        <p data-today-summary>Cargando regalos y planes.</p>
      </section>` : ''}
    <section class="ag-hero" aria-live="polite">
      <div class="ag-hero__copy">
        <span class="ag-eyebrow" data-kicker></span>
        <h2 class="ag-hero__title" data-period></h2>
        <p class="ag-hero__hint" data-hint></p>
      </div>
      <div class="ag-hero__facts" data-facts></div>
    </section>
    <div class="ag-toolbar">
      <div class="ag-monthnav" data-nav>
        <button type="button" class="icon-btn" data-prev aria-label="Mes anterior">${icon('chevron-left', 18)}</button>
        <label class="ag-monthpick">
          <span class="sr-only">Elegir mes</span>
          <input type="month" data-month aria-label="Mes">
        </label>
        <button type="button" class="icon-btn" data-next aria-label="Mes siguiente">${icon('chevron-right', 18)}</button>
      </div>
      <div class="ag-toolbar__end">
        <button type="button" class="ag-textbtn" data-today>Hoy</button>
        <button type="button" class="ag-textbtn" data-refresh>Actualizar</button>
      </div>
    </div>
    <section class="ag-cal" data-calendar aria-label="Calendario del mes">
      <div class="ag-cal__week" aria-hidden="true">${WEEKDAYS.map(day => `<span>${day}</span>`).join('')}</div>
      <div class="ag-cal__days" data-days role="grid"></div>
      <div class="ag-cal__foot">
        <span data-selected-label></span>
        <button type="button" class="link" data-clear hidden>Ver todo el mes</button>
      </div>
      <div class="ag-calendar-legend" aria-label="Significado de los puntos del calendario">
        <span class="ag-calendar-legend__title">Puntos del calendario</span>
        <span class="ag-calendar-legend__item"><i class="ag-day__dot" aria-hidden="true"></i> Plan o evento</span>
        <span class="ag-calendar-legend__item"><i class="ag-day__dot is-special" aria-hidden="true"></i> Fecha especial</span>
        <span class="ag-calendar-legend__item"><i class="ag-day__dot is-gift" aria-hidden="true"></i> Regalo recibido</span>
      </div>
    </section>
    ${isCalendar ? '<button type="button" class="ag-month-link" data-toggle-view>Ver todo el mes</button>' : ''}
    <p class="ag-status" data-msg role="status"></p>
    <div class="ag-section" data-section hidden>
      <h2 class="ag-section__title" data-section-title></h2>
      <span class="ag-section__count" data-count></span>
    </div>
    <div class="ag-list" data-results></div>
    <dialog class="ag-dialog" aria-label="${esc(meta.action)}"></dialog>
  `;

  const el = selector => page.querySelector(selector);
  const dialog = el('dialog');
  const message = (text = '', isError = false) => {
    const node = el('[data-msg]');
    node.textContent = text;
    node.classList.toggle('is-error', Boolean(text) && isError);
  };

  /* ---------- datos del mes ---------- */

  function monthItems(list) {
    const items = [];
    for (let number = 1; number <= 31; number++) {
      const day = dateAt(month, number);
      if (!day.startsWith(month)) break;
      for (const special of specialEventsForDate(day)) {
        items.push({ day, row: { ...special, detail: special.description }, special: true });
      }
      for (const gift of giftsForDay(day)) items.push({ day, row: gift, gift: true });
      for (const row of list) if (occurs(row, day)) items.push({ day, row });
    }
    return items;
  }

  function giftsForDay(day) {
    if (!isCalendar || !giftsCatalog) return [];
    const [year, month, number] = day.split('-');
    const value = giftsCatalog.months?.[`${year}-${month}`]?.calendarMapping?.[String(Number(number))];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids.map(id => giftsCatalog.giftsById?.[id] || giftsCatalog.gifts?.find(gift => gift.id === id))
      .filter(Boolean)
      .map(gift => ({
        ...gift,
        id: gift.id,
        title: gift.title || 'Regalo recibido',
        detail: gift.data?.message || gift.data?.content || gift.description || '',
      }));
  }

  /* ---------- rejilla del mes ---------- */

  function paintCalendar(items) {
    const [year, monthNumber] = month.split('-').map(Number);
    const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const today = todayISO();
    const cells = [];
    const grouped = new Map();

    for (const item of items) {
      const list = grouped.get(item.day);
      if (list) list.push(item);
      else grouped.set(item.day, [item]);
    }

    for (let blank = 0; blank < firstWeekday; blank++) {
      cells.push('<span class="ag-day is-blank" aria-hidden="true"></span>');
    }

    for (let number = 1; number <= daysInMonth; number++) {
      const day = dateAt(month, number);
      const dayItems = grouped.get(day) || [];
      const special = dayItems.some(item => item.special);
      const dots = dayItems
        .slice(0, 3)
        .map(item => `<i class="ag-day__dot${item.special ? ' is-special' : ''}${item.gift ? ' is-gift' : ''}"></i>`)
        .join('');
      // El nombre cuenta lo que hay de verdad: un día con solo un regalo
      // no es «1 plan».
      const giftsCount = dayItems.filter(item => item.gift).length;
      const specialCount = dayItems.filter(item => item.special).length;
      const planCount = dayItems.length - giftsCount - specialCount;
      const labelParts = [];
      if (planCount) labelParts.push(`${planCount} ${planCount === 1 ? meta.one : meta.plural}`);
      if (giftsCount) labelParts.push(`${giftsCount} ${giftsCount === 1 ? 'regalo' : 'regalos'}`);
      if (specialCount) labelParts.push(`${specialCount} ${specialCount === 1 ? 'fecha especial' : 'fechas especiales'}`);
      const label = `${displayDay(day)}, ${labelParts.length ? labelParts.join(' y ') : 'sin planes ni regalos'}`;
      cells.push(`
        <button type="button" class="ag-day${day === today ? ' is-today' : ''}${day === selected ? ' is-selected' : ''}${dayItems.length ? ' has-plan' : ''}"
          data-day="${day}" role="gridcell" aria-pressed="${day === selected}" aria-label="${esc(label)}">
          <span class="ag-day__n">${number}</span>
          <span class="ag-day__dots" aria-hidden="true">${dots}</span>
        </button>
      `);
    }

    el('[data-days]').innerHTML = cells.join('');
    el('[data-month]').value = month;
    el('[data-selected-label]').textContent = selected ? displayDay(selected) : '';
    // El cambio de contenido se hace con el botón inferior; no duplicamos
    // otro enlace dentro del calendario.
    el('[data-clear]').hidden = true;
  }

  /* ---------- resumen ---------- */

  function paintHero(items, relevant) {
    const kicker = el('[data-kicker]');
    const period = el('[data-period]');
    const hint = el('[data-hint]');
    const facts = el('[data-facts]');

    if (trash) {
      kicker.textContent = 'Papelera';
      period.textContent = 'Papelera';
      hint.textContent = TRASH_HINT;
    } else if (isFeeling) {
      kicker.textContent = 'Diario';
      period.textContent = 'Cómo te has sentido';
      hint.textContent = meta.privateNote;
    } else {
      kicker.textContent = 'Mes';
      period.textContent = monthLabel(month);
      hint.textContent = `${items.length} ${items.length === 1 ? meta.one : meta.plural} este mes.`;
    }

    if (isFeeling) {
      const pending = relevant.filter(row => row.state === 'pendiente').length;
      const done = relevant.filter(row => row.state === 'resuelto').length;
      facts.innerHTML = `
        <div class="ag-fact"><b>${relevant.length}</b><span>registros</span></div>
        <div class="ag-fact"><b>${pending}</b><span>pendientes</span></div>
        <div class="ag-fact"><b>${done}</b><span>resueltos</span></div>
      `;
      return;
    }

    const source = trash ? relevant : items;
    const days = new Set(source.map(item => item.day)).size;
    const next = items.find(item => item.day >= todayISO());
    facts.innerHTML = `
      <div class="ag-fact"><b>${source.length}</b><span>${meta.plural}</span></div>
      <div class="ag-fact"><b>${days}</b><span>días con plan</span></div>
      ${
        next
          ? `<div class="ag-fact ag-fact--wide"><b>${esc(countdown(next.day))}</b><span>${esc(next.row.title)}</span></div>`
          : '<div class="ag-fact ag-fact--wide"><b>—</b><span>sin próximos</span></div>'
      }
    `;
  }

  /* ---------- tarjetas ---------- */

  function cardHTML(item) {
    const { row, day, special, gift } = item;
    const date = dayDate(day);
    const number = FORMAT.dayNumber.format(date);
    const short = FORMAT.shortMonth.format(date).replace('.', '');

    const bits = [];
    if (gift) {
      bits.push('Regalo recibido');
    } else if (special) {
      bits.push('Fecha especial');
    } else {
      bits.push(weekday(day));
      if (row.clock) bits.push(row.clock.slice(0, 5));
      if (isCalendar && row.frequency && row.frequency !== 'once') {
        bits.push(REPEATS[row.frequency] || row.frequency);
      }
    }
    if (isFeeling && !special) bits.push(row.author_id === own ? 'Tú' : 'Tu pareja');

    // El estado (pendiente/hablado/resuelto) es del diario de Mal Día: un
    // plan compartido no tiene ese campo editable y no debe llevar su píldora.
    const state = isFeeling ? FEELING_STATES[row.state] : null;
    // Las fechas especiales no viven en `tamp_entries`: no se pueden editar
    // desde aquí, así que no se ofrece un botón que no hace nada.
    const canTouch = !gift && !special && row.id && canEdit(row);

    return `
      <article class="ag-card${special ? ' is-special' : ''}${gift ? ' is-gift' : ''}">
        <div class="ag-card__day" aria-hidden="true">
          <span class="ag-card__d">${special && row.icon ? esc(row.icon) : number}</span>
          <span class="ag-card__m">${special ? 'especial' : esc(short)}</span>
        </div>
        <div class="ag-card__body">
          <p class="ag-card__meta">${esc(bits.join(' · '))}</p>
          <h3 class="ag-card__title">${esc(row.title)}</h3>
          ${row.detail && !gift ? `<p class="ag-card__text">${esc(row.detail)}</p>` : ''}
          ${row.place ? `<p class="ag-card__where">${icon('map', 14)}<span>${esc(row.place)}</span></p>` : ''}
          <div class="ag-card__foot">
            ${gift ? `<button type="button" class="ag-card__action" data-gift="${esc(row.id)}" data-day="${esc(day)}">${icon('gift', 14)}<span>Ver regalo</span></button>` : ''}
            ${state && !special ? `<span class="ag-pill is-${state.tone}">${esc(state.label)}</span>` : ''}
            ${
              canTouch
                ? `<button type="button" class="ag-card__action" data-id="${esc(row.id)}">${icon(trash ? 'check' : 'edit', 14)}<span>${trash ? 'Recuperar' : 'Editar'}</span></button>`
                : ''
            }
          </div>
        </div>
      </article>
    `;
  }

  function emptyHTML(hasSelection) {
    if (trash) {
      return emptyStateHTML({
        icon: 'archive',
        title: 'La papelera está vacía',
        text: 'Los registros borrados se guardan aquí 30 días.',
      });
    }
    if (isCalendar && !hasSelection && !monthView) {
      return emptyStateHTML({
        icon: meta.icon,
        title: 'Elige un día',
        text: 'Selecciona una fecha del calendario para ver los planes y regalos de ese día.',
      });
    }
    const createAction = canCreate ? { label: meta.action, id: 'agNewEmpty' } : null;
    if (hasSelection) {
      return emptyStateHTML({
        icon: meta.icon,
        title: 'Nada este día',
        text: 'Elige otro día del calendario o crea un plan para esta fecha.',
        action: createAction,
      });
    }
    return emptyStateHTML({
      icon: meta.icon,
      title: meta.emptyTitle,
      text: meta.emptyText,
      action: createAction,
    });
  }

  /* ---------- pintado ---------- */

  function paint() {
    const relevant = rows.filter(row => Boolean(row.removed_at) === trash);
    // En la vista mensual, seleccionar "Hoy" convierte la pantalla en una
    // vista diaria real: desaparecen la cuadrícula y el contenido del resto
    // del mes. El botón permite volver a abrir el mes completo.
    // El calendario permanece siempre visible. Solo cambia la lista que hay
    // debajo: el día seleccionado (por defecto hoy) o todo el mes.
    const showCalendar = isCalendar && !trash;

    let items = [];
    let list;
    if (isCalendar && !trash) {
      items = monthItems(relevant);
      list = monthView
        ? items
        : selected
          ? items.filter(item => item.day === selected)
          : [];
    } else {
      list = relevant
        .map(row => ({ row, day: row.day }))
        .sort(
          (first, second) =>
            second.day.localeCompare(first.day) ||
            String(second.row.created_at || '').localeCompare(String(first.row.created_at || ''))
        );
    }

    paintHero(items, relevant);
    const summaryItems = monthView
      ? items
      : selected
        ? items.filter(item => item.day === selected)
        : [];
    const todaySummary = el('[data-today-summary]');
    if (todaySummary && trash) {
      todaySummary.textContent = 'Aquí están los planes borrados de los últimos 30 días.';
    } else if (todaySummary) {
      const gifts = summaryItems.filter(item => item.gift).length;
      const plans = summaryItems.filter(item => !item.gift && !item.special).length;
      const specials = summaryItems.filter(item => item.special).length;
      const parts = [];
      if (gifts) parts.push(`${gifts} ${gifts === 1 ? 'regalo' : 'regalos'}`);
      if (plans) parts.push(`${plans} ${plans === 1 ? 'plan' : 'planes'}`);
      if (specials) parts.push(`${specials} ${specials === 1 ? 'fecha especial' : 'fechas especiales'}`);
      todaySummary.textContent = parts.length
        ? parts.join(' y ')
        : selected || monthView
          ? 'No hay regalos ni planes programados.'
          : 'Selecciona una fecha del calendario.';
    }
    const bannerKicker = el('[data-banner-kicker]');
    const bannerTitle = el('[data-banner-title]');
    if (bannerKicker && bannerTitle) {
      if (trash) {
        bannerKicker.textContent = 'Papelera';
        bannerTitle.textContent = 'Planes borrados';
      } else {
        bannerKicker.textContent = monthView
          ? monthLabel(month)
          : selected
            ? selected === todayISO() ? 'Hoy' : displayDay(selected)
            : monthLabel(month);
        bannerTitle.textContent = monthView
          ? 'Todo lo que tenemos este mes'
          : selected
            ? selected === todayISO() ? 'Lo que tenemos para hoy' : `Planes para el ${displayDay(selected)}`
            : 'Elige un día del calendario';
      }
    }
    const hero = el('.ag-hero');
    if (hero) hero.hidden = isCalendar;
    el('[data-calendar]').hidden = !showCalendar;
    if (showCalendar) paintCalendar(items);

    const toolbar = el('.ag-toolbar');
    // La navegación del mes siempre debe estar disponible en el calendario.
    if (toolbar) toolbar.hidden = false;
    // En la papelera no hay mes que recorrer ni vista que alternar: se dejan
    // «Hoy» y «Actualizar», que sí sirven.
    const monthNav = el('[data-nav]');
    if (monthNav) monthNav.hidden = trash;
    const monthLink = el('[data-toggle-view]');
    if (monthLink) {
      monthLink.textContent = monthView ? 'Ver solo hoy' : 'Ver todo el mes';
      monthLink.hidden = trash;
    }

    const trashBtn = el('[data-trash]');
    if (trashBtn) {
      trashBtn.classList.toggle('is-on', trash);
      trashBtn.setAttribute('aria-pressed', String(trash));
      trashBtn.setAttribute('aria-label', trash ? 'Volver al historial' : 'Papelera');
      trashBtn.setAttribute('title', trash ? 'Volver al historial' : 'Papelera');
    }

    el('[data-results]').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : emptyHTML(Boolean(selected));

    const section = el('[data-section]');
    section.hidden = !list.length;
    if (list.length) {
      let sectionTitle = meta.section;
      if (trash) sectionTitle = 'En la papelera';
      else if (selected) sectionTitle = selected === todayISO() ? 'Hoy' : displayDay(selected);
      el('[data-section-title]').textContent = sectionTitle;
      el('[data-count]').textContent = `${list.length}`;
    }
  }

  function showError() {
    message('');
    el('[data-section]').hidden = true;
    el('[data-results]').innerHTML = `
      <div class="ag-errorbox">
        ${icon('cloud', 22)}
        <div>
          <b>No se pudo cargar</b>
          <p>Comprueba la conexión y vuelve a intentarlo.</p>
        </div>
        <button type="button" class="btn btn--sm" data-retry>Reintentar</button>
      </div>
    `;
  }

  /* ---------- carga ---------- */

  let revision = 0;
  async function load() {
    const request = ++revision;
    message('');
    if (!loaded) {
      el('[data-results]').innerHTML = skeletonHTML({ rows: 4, label: 'Cargando' });
      el('[data-section]').hidden = true;
    }
    try {
      const [data, , gifts] = await Promise.all([
        entries(kind),
        isCalendar ? loadSpecialDates() : null,
        isCalendar ? loadGiftsCatalog() : null,
      ]);
      if (!active || request !== revision) return;
      rows = data;
      giftsCatalog = gifts || null;
      loaded = true;
      paint();
    } catch {
      if (active && request === revision) showError();
    }
  }

  /* ---------- formulario ---------- */

  function editor(row = null) {
    const title = row ? `Editar ${isCalendar ? 'plan' : 'registro'}` : meta.action;
    const kindLabel = isCalendar ? 'PLAN' : 'REGISTRO';
    const hint = isCalendar
      ? 'Los dos veréis este plan en el calendario y en el Inicio.'
      : 'Solo vosotros podéis leer este registro.';

    dialog.innerHTML = `
      <form class="ag-form">
        <div class="ag-form__head">
          <div>
            <span class="ag-eyebrow">${kindLabel}</span>
            <h2>${esc(title)}</h2>
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x', 16)}</button>
        </div>
        <p class="ag-form__hint">${esc(hint)}</p>
        <div class="ag-fields">
          <label class="ag-field ag-field--wide">
            <span>${isFeeling ? 'Qué ocurrió' : 'Título'}</span>
            <input name="title" required maxlength="140" value="${esc(row?.title || '')}" placeholder="${isCalendar ? 'Cena en casa, cine…' : 'Un día difícil'}" autocomplete="off">
          </label>
          <label class="ag-field ag-field--wide">
            <span>${isFeeling ? 'Cómo me sentí' : 'Detalles'} <span class="ag-optional">Opcional</span></span>
            <textarea name="detail" maxlength="4000" placeholder="${isFeeling ? 'Lo que necesitaba, lo que me ayudó…' : 'Lo que queréis recordar de este plan…'}">${esc(row?.detail || '')}</textarea>
          </label>
          <label class="ag-field">
            <span>Fecha</span>
            <input name="day" required type="date" value="${row?.day || selected || (month === todayISO().slice(0, 7) ? todayISO() : `${month}-01`)}">
          </label>
          <label class="ag-field">
            <span>Hora <span class="ag-optional">Opcional</span></span>
            <input name="clock" type="time" value="${row?.clock?.slice(0, 5) || ''}">
          </label>
          ${
            isCalendar
              ? `<label class="ag-field ag-field--wide">
                   <span>Lugar <span class="ag-optional">Opcional</span></span>
                   <input name="place" maxlength="200" value="${esc(row?.place || '')}" placeholder="Casa, parque, restaurante…">
                 </label>
                 <label class="ag-field">
                   <span>Repetir</span>
                   <select name="frequency">${options(REPEATS, row?.frequency || 'once')}</select>
                 </label>
                 <label class="ag-field" data-until>
                   <span>Repetir hasta <span class="ag-optional">Opcional</span></span>
                   <input name="until_day" type="date" value="${row?.until_day || ''}">
                 </label>`
              : ''
          }
          ${
            !isCalendar
              ? `<label class="ag-field">
                   <span>Estado</span>
                   <select name="state">${options(FEELING_STATE_OPTIONS, row?.state || 'pendiente')}</select>
                 </label>`
              : ''
          }
        </div>
        <p class="ag-error" role="alert"></p>
        <div class="ag-form__actions">
          <button class="btn" type="submit">${row ? 'Guardar cambios' : 'Guardar'}</button>
          <button class="btn-soft" type="button" data-close>Cancelar</button>
          ${row ? `<button type="button" class="btn-danger" data-remove>Enviar a la papelera</button>` : ''}
        </div>
      </form>
    `;

    const form = dialog.querySelector('form');
    const formError = form.querySelector('[role=alert]');
    form.elements.day.max = isFeeling ? todayISO() : '9999-12-31';
    dialog.querySelectorAll('[data-close]').forEach(button => {
      button.onclick = () => dialog.close();
    });

    const frequency = form.elements.frequency;
    const untilField = form.querySelector('[data-until]');
    const syncUntil = () => {
      if (untilField) untilField.hidden = frequency.value === 'once';
    };
    if (frequency) {
      frequency.addEventListener('change', syncUntil);
      syncUntil();
    }

    const persist = async values => {
      const buttons = [...form.querySelectorAll('button')];
      buttons.forEach(button => {
        button.disabled = true;
      });
      try {
        await writeEntry(kind, values, row);
        dialog.close();
        // Si se creaba desde la papelera, el plan nuevo no aparecía: se
        // vuelve a la vista normal.
        trash = false;
        if (values.day) {
          month = values.day.slice(0, 7);
          // Se va al día guardado: crear un plan para otra fecha y quedarse
          // en el día anterior parecía no haber guardado nada.
          if (!monthView) selected = values.day;
        }
        await load();
      } catch (error) {
        formError.textContent = error.message?.includes('otro dispositivo')
          ? error.message
          : 'No se ha guardado. Puedes volver a intentarlo.';
      } finally {
        buttons.forEach(button => {
          button.disabled = false;
        });
      }
    };

    form.onsubmit = event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      data.title = data.title.trim();
      if (!data.title) {
        form.elements.title.focus();
        return;
      }
      data.clock = data.clock || null;
      if (isCalendar) {
        data.until_day = data.frequency === 'once' ? null : data.until_day || null;
        if (data.until_day && data.until_day < data.day) {
          formError.textContent = 'La fecha final debe ser posterior al inicio.';
          return;
        }
      }
      void persist(data);
    };

    const remove = dialog.querySelector('[data-remove]');
    if (remove) {
      remove.onclick = () => {
        if (confirm('¿Enviar este registro a la papelera durante 30 días?')) {
          void persist({ removed_at: new Date().toISOString() });
        }
      };
    }

    dialog.showModal();
    form.elements.title.focus();
  }

  /* ---------- eventos ---------- */

  page.addEventListener('click', async event => {
    const dayButton = event.target.closest('[data-day]');
    if (dayButton?.matches('.ag-day')) {
      selected = selected === dayButton.dataset.day ? '' : dayButton.dataset.day;
      paint();
      return;
    }

    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.gift) {
      router?.navigate(`/calendario?view=recibidos&gift=${encodeURIComponent(button.dataset.gift)}&day=${encodeURIComponent(button.dataset.day || selected || todayISO())}`);
      return;
    }

    if (button.hasAttribute('data-toggle-view')) {
      monthView = !monthView;
      // Se conserva el mes que se está mirando: al volver al día, hoy si
      // pertenece a ese mes y si no el día 1.
      selected = monthView
        ? ''
        : month === todayISO().slice(0, 7)
          ? todayISO()
          : `${month}-01`;
      paint();
      return;
    }

    if (button.hasAttribute('data-new') || button.id === 'agNewEmpty') editor();
    if (button.hasAttribute('data-refresh') || button.hasAttribute('data-retry')) void load();
    if (button.hasAttribute('data-clear')) {
      selected = '';
      paint();
    }
    if (button.hasAttribute('data-today')) {
      month = todayISO().slice(0, 7);
      selected = todayISO();
      paint();
    }
    if (button.hasAttribute('data-prev')) {
      month = shiftMonth(month, -1);
      selected = '';
      paint();
    }
    if (button.hasAttribute('data-next')) {
      month = shiftMonth(month, 1);
      selected = '';
      paint();
    }
    if (button.hasAttribute('data-trash')) {
      trash = !trash;
      selected = '';
      paint();
    }

    if (button.dataset.id) {
      const row = rows.find(item => item.id === button.dataset.id);
      if (!row || !canEdit(row)) return;
      if (!trash) {
        editor(row);
        return;
      }
      button.disabled = true;
      try {
        await writeEntry(kind, { removed_at: null }, row);
        await load();
      } catch {
        message('No se pudo recuperar. Actualiza para comprobar el registro.', true);
        button.disabled = false;
      }
    }
  });

  page.addEventListener('change', event => {
    if (event.target.matches('[data-month]') && event.target.value) {
      month = event.target.value;
      selected = '';
      paint();
    }
  });

  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  page.cleanup = () => {
    active = false;
    dialog.close();
  };

  void load();
  return page;
}

export const SharedPage = router => renderAgenda('event', router);
export const MalDiaPage = () => renderAgenda('feeling');
