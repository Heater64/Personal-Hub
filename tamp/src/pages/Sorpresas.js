/* ==========================================
   MIS SORPRESAS — organizador personal de regalos

   Un espacio privado por usuario (la RLS de `tamp_entries` y
   `tamp_people` solo devuelve filas con author_id = auth.uid(); esta
   pantalla no sustituye esa garantía, la acompaña):

     · Regalos  — ideas, pendientes, comprados, preparados y entregados.
     · Personas — destinatarios con cumpleaños, gustos y notas.
     · Agenda   — próximas ocasiones, en lista o en calendario.
     · Presupuesto y estadísticas, archivo y papelera.

   La lógica de negocio (filtros, ordenación, totales, presupuesto y
   agenda) está en utils/gift-organizer.js y los estados siguen siendo
   los del modelo de datos existente. Aquí solo hay interfaz y
   persistencia con los servicios que ya usa la app.
   ========================================== */

import '../styles/sorpresas.css';
import {
  entries,
  writeEntry,
  deleteEntryForever,
  supportsGiftFields,
  supportsGiftExtras,
  supportsGiftStates,
  supportsGiftOrganizer,
} from '../services/agenda.js';
import {
  supportsPeople,
  supportsPeopleOrganizer,
  supportsPersonColumn,
  listPeople,
  savePerson,
  removePerson,
} from '../services/people.js';
import {
  supportsGiftSettings,
  getGiftSettings,
  saveMonthlyBudget,
} from '../services/gift-settings.js';
import { escapeHtml as esc, safeUrl } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import { giftArt, artForState } from '../utils/gift-art.js';
import {
  GIFT_FILTERS,
  GIFT_SORTS,
  giftStateMeta,
  offeredGiftStates,
  storableGiftState,
  filterGifts,
  giftSummary,
  budgetReport,
  peopleOccasions,
  personGiftBuckets,
  nextOccasionOf,
  shiftMonth,
  daysUntil,
  estimatedValue,
  isLive,
} from '../utils/gift-organizer.js';
import { h, icon, openSheet, closeSheets, toast } from '../components/ui.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { emptyStateHTML, skeletonCardsHTML } from '../components/states.js';

const PRIORITY_LABELS = { '': '', baja: 'Baja', media: 'Media', alta: 'Alta' };

function countdown(iso, short = false) {
  if (!iso) return '';
  const days = daysUntil(iso, todayISO());
  if (short) {
    if (days === 0) return '¡Hoy!';
    if (days === 1) return 'Mañana';
    return days > 1 ? `${days} días` : 'Pasada';
  }
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days > 1) return `En ${days} días`;
  if (days === -1) return 'Ayer';
  return `Hace ${-days} días`;
}

/** 12 dic */
function fmtDay(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace('.', '');
}

/** 12 de diciembre de 2026 */
function fmtLongDay(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
}

/** Cumpleaños sin año: «12 de diciembre». */
function fmtBirthday(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso.slice(0, 4)}-${iso.slice(5, 10)}T12:00:00Z`));
}

function monthLabel(key) {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${key}-01T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthShort(key) {
  return new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${key}-01T12:00:00Z`))
    .replace('.', '');
}

const eurFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const fmtEur = value => eurFormat.format(Number(value) || 0);

/**
 * Foto: se recorta y se guarda como data URL JPEG dentro de la fila, no en
 * un bucket. Así la privacidad depende de la misma RLS que el resto del
 * regalo: una imagen en un bucket compartido la vería la pareja.
 */
function photoFromFile(file, max = 640) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Solo se permiten imágenes'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('La foto no puede superar los 5 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la foto'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('No se pudo leer la foto'));
      image.onload = () => {
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const parseLinks = value =>
  String(value || '')
    .split(/\s*[\n,]\s*/)
    .map(item => item.trim())
    .filter(Boolean);

export function SorpresasPage(router) {
  const page = document.createElement('div');
  page.className = 'srp-page';

  let rows = [];
  let people = [];
  let settings = { monthly_budget: null };
  let peopleById = new Map();
  let loaded = false;
  let failed = false;
  let active = true;

  let tab = 'regalos';
  let screen = 'tabs';
  let currentGiftId = null;
  let currentPersonId = null;
  let archiveMode = 'archivados';
  let filter = 'todos';
  let sort = 'fecha';
  let query = '';
  let personFilter = 'todas';
  let peopleQuery = '';
  let budgetMonth = todayISO().slice(0, 7);
  let agendaMode = 'lista';
  let agendaMonth = todayISO().slice(0, 7);

  const caps = {
    gift: false,
    extras: false,
    states: false,
    organizer: false,
    people: false,
    personColumn: false,
    peopleOrganizer: false,
    settings: false,
  };

  /* ==========================================
     MARCO DE LA PANTALLA
     ========================================== */

  page.innerHTML = `
    <div class="srp-head" id="srpHead">
      ${renderPageHeader({
        title: 'Mis sorpresas',
        subtitle: 'Tu espacio privado de regalos',
        back: true,
        backLabel: 'Volver a Sentimientos',
        actions: `
          <span class="srp-privacy" title="Solo tú puedes ver y editar este espacio">
            ${icon('lock', 13)}<span class="srp-privacy__text">Solo tú</span>
          </span>
          <button type="button" class="icon-btn srp-head__more" data-more aria-label="Más opciones" title="Más opciones">${icon('more', 19)}</button>
          <button type="button" class="btn btn--sm srp-head__new" data-new-gift>${icon('plus', 15)}<span>Nueva</span></button>
        `,
      })}
    </div>
    <button type="button" class="srp-summary" id="srpSummary" data-summary aria-label="Abrir presupuesto y estadísticas" hidden></button>
    <div class="srp-tabs" id="srpTabs" role="tablist" aria-label="Secciones de Mis sorpresas" hidden>
      <button type="button" role="tab" data-tab="regalos" aria-selected="true" class="is-on">${icon('gift', 16)}<span>Regalos</span></button>
      <button type="button" role="tab" data-tab="personas" aria-selected="false">${icon('user', 16)}<span>Personas</span></button>
      <button type="button" role="tab" data-tab="agenda" aria-selected="false">${icon('calendar', 16)}<span>Agenda</span></button>
    </div>
    <div class="srp-body" id="srpBody"></div>
  `;

  const headEl = page.querySelector('#srpHead');
  const summaryEl = page.querySelector('#srpSummary');
  const tabsEl = page.querySelector('#srpTabs');
  const bodyEl = page.querySelector('#srpBody');

  /* ==========================================
     HELPERS DE PRESENTACIÓN
     ========================================== */

  const stateCaps = () => ({ starred: caps.extras, states: caps.states });
  const statuses = () =>
    Object.fromEntries(offeredGiftStates(stateCaps()).map(state => [state, giftStateMeta(state)]));
  const statusOf = gift => giftStateMeta(gift?.state);
  const storableState = state => storableGiftState(state, stateCaps());
  const personOf = gift =>
    caps.personColumn && gift?.person_id ? peopleById.get(gift.person_id) : null;
  const findGift = id => rows.find(row => row.id === id);
  const findPerson = id => people.find(person => person.id === id);

  function avatarHTML(person, size = 44) {
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`;
    const photo = person?.photo ? safeUrl(person.photo) : '';
    if (photo) {
      return `<span class="srp-avatar" style="${style}"><img src="${photo}" alt=""></span>`;
    }
    const initial = (person?.name || '').trim().charAt(0).toUpperCase();
    return `<span class="srp-avatar" style="${style}" aria-hidden="true">${
      initial ? esc(initial) : icon('user', Math.round(size * 0.45))
    }</span>`;
  }

  function emptyBlock({ art = 'regalos-vacios', title, text, action = '' }) {
    return `
      <div class="srp-empty">
        <span class="srp-empty__art">${giftArt(art, { size: 112 })}</span>
        <b>${esc(title)}</b>
        ${text ? `<p>${esc(text)}</p>` : ''}
        ${action}
      </div>
    `;
  }

  const newGiftButton = '<button type="button" class="btn" data-new-gift>Nueva idea</button>';

  /* ==========================================
     CARGA DE DATOS
     ========================================== */

  async function load() {
    try {
      const peopleSupported = await supportsPeople();
      const [loadedRows, loadedPeople] = await Promise.all([
        entries('surprise'),
        peopleSupported ? listPeople() : Promise.resolve([]),
      ]);
      rows = loadedRows;
      people = loadedPeople;
      peopleById = new Map(people.map(person => [person.id, person]));

      caps.people = peopleSupported;
      [caps.gift, caps.extras] = await Promise.all([supportsGiftFields(), supportsGiftExtras()]);
      caps.states = caps.extras && (await supportsGiftStates());
      caps.personColumn = peopleSupported && (await supportsPersonColumn());
      caps.peopleOrganizer = peopleSupported && (await supportsPeopleOrganizer());
      caps.organizer = await supportsGiftOrganizer();
      caps.settings = caps.organizer && (await supportsGiftSettings());
      settings = caps.settings ? await getGiftSettings() : { monthly_budget: null };

      if (caps.personColumn && caps.gift) {
        // Un regalo cuya persona ya no existe se sigue mostrando, sin
        // destinatario: no se borra nada al quitar a alguien.
        peopleById = new Map(people.map(person => [person.id, person]));
      }

      loaded = true;
      failed = false;
      if (!active) return;
      draw();
    } catch {
      if (!active) return;
      failed = true;
      draw();
    }
  }

  /* ==========================================
     RENDER
     ========================================== */

  function draw() {
    if (!active) return;
    const inner = screen !== 'tabs';
    page.classList.toggle('srp-page--inner', inner);
    headEl.hidden = false;
    summaryEl.hidden = inner || !loaded;
    tabsEl.hidden = inner || !loaded;
    syncTabs();
    if (loaded) drawSummary();
    bodyEl.replaceChildren(viewForScreen());
  }

  function syncTabs() {
    tabsEl.querySelectorAll('[data-tab]').forEach(button => {
      const on = button.dataset.tab === tab;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    if (caps.people) {
      tabsEl.querySelector('[data-tab="personas"]').hidden = false;
    } else {
      tabsEl.querySelector('[data-tab="personas"]').hidden = true;
    }
  }

  function drawSummary() {
    const summary = giftSummary(rows);
    summaryEl.innerHTML = `
      <span class="srp-summary__item">
        <b>${summary.pendingCount}</b>
        <span>Pendientes</span>
      </span>
      <span class="srp-summary__sep" aria-hidden="true"></span>
      <span class="srp-summary__item">
        <b>${caps.gift ? esc(fmtEur(summary.planned)) : '—'}</b>
        <span>Importe previsto</span>
      </span>
      <span class="srp-summary__sep" aria-hidden="true"></span>
      <span class="srp-summary__item">
        <b>${summary.boughtCount}</b>
        <span>Comprados</span>
      </span>
      <span class="srp-summary__go" aria-hidden="true">${icon('chev', 16)}</span>
    `;
  }

  function viewForScreen() {
    if (failed) {
      const wrap = h('div');
      wrap.innerHTML = emptyStateHTML({
        icon: 'cloud',
        title: 'No se pudo cargar',
        text: 'Comprueba la conexión y vuelve a intentarlo.',
        action: { label: 'Reintentar', id: 'srpRetry' },
      });
      wrap.querySelector('#srpRetry')?.addEventListener('click', () => {
        bodyEl.innerHTML = skeletonCardsHTML({ count: 4 });
        void load();
      });
      return wrap;
    }
    if (!loaded) {
      const wrap = h('div');
      wrap.innerHTML = skeletonCardsHTML({ count: 4 });
      return wrap;
    }
    if (screen === 'gift') return giftDetailView(currentGiftId);
    if (screen === 'person') return personDetailView(currentPersonId);
    if (screen === 'budget') return budgetView();
    if (screen === 'archive') return archiveView();
    if (tab === 'personas') return peopleView();
    if (tab === 'agenda') return agendaView();
    return giftsView();
  }

  function subheadHTML(title, { back = true, actions = '' } = {}) {
    return `
      <div class="srp-subhead">
        ${
          back
            ? `<button type="button" class="icon-btn srp-subhead__back" data-screen-back aria-label="Volver">${icon('back', 18)}</button>`
            : ''
        }
        <h2 class="srp-subhead__title">${esc(title)}</h2>
        ${actions ? `<div class="srp-subhead__actions">${actions}</div>` : ''}
      </div>
    `;
  }

  function go(next, payload = null) {
    screen = next;
    if (next === 'gift') currentGiftId = payload;
    if (next === 'person') currentPersonId = payload;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    draw();
  }

  function backToTabs() {
    screen = 'tabs';
    currentGiftId = null;
    currentPersonId = null;
    draw();
  }

  /* ==========================================
     VISTA · REGALOS
     ========================================== */

  function giftCardHTML(gift, { trash = false, archived = false } = {}) {
    const person = personOf(gift);
    const meta = statusOf(gift);
    const photo = caps.gift ? safeUrl(gift.photo) : '';
    const art = photo
      ? `<img src="${photo}" alt="" loading="lazy" decoding="async">`
      : giftArt(meta.art, { size: 52 });
    const price = caps.gift && (gift.price != null || gift.actual_price != null)
      ? fmtEur(estimatedValue(gift))
      : '';
    const when = gift.day ? `${fmtDay(gift.day)} · ${countdown(gift.day, true)}` : '';
    const flags = [
      person?.name || 'Sin asignar',
      when,
    ].filter(Boolean).join(' · ');

    return `
      <article class="srp-gift is-${meta.tone}${trash ? ' is-trashed' : ''}${archived ? ' is-archived' : ''}">
        <button type="button" class="srp-gift__open" data-gift-open="${esc(gift.id)}" aria-label="Abrir ${esc(gift.title)}">
          <span class="srp-gift__art${photo ? ' has-photo' : ''}">${art}</span>
          <span class="srp-gift__copy">
            <span class="srp-gift__title">
              ${gift.starred && caps.extras ? `<span class="srp-gift__star" aria-label="Favorito">${icon('star', 12)}</span>` : ''}
              <span>${esc(gift.title)}</span>
            </span>
            <span class="srp-gift__sub">${esc(flags)}</span>
            <span class="srp-gift__meta">
              <span class="srp-pill is-${meta.tone}">${esc(meta.label)}</span>
              ${gift.occasion ? `<span class="srp-gift__tag">${esc(gift.occasion)}</span>` : ''}
              ${price ? `<span class="srp-gift__price">${esc(price)}</span>` : ''}
            </span>
          </span>
        </button>
        <button type="button" class="srp-gift__more" data-gift-menu="${esc(gift.id)}" aria-label="Acciones de ${esc(gift.title)}">${icon('more', 18)}</button>
      </article>
    `;
  }

  function giftsView() {
    const wrap = h('div', { class: 'srp-view' });

    if (!rows.some(isLive) && !rows.some(row => row.archived_at || row.removed_at)) {
      wrap.innerHTML = emptyBlock({
        title: 'Aún no tienes sorpresas',
        text: 'Crea tu primera idea, asígnala a alguien y añade una fecha. Solo tú puedes verla.',
        action: newGiftButton,
      });
      return wrap;
    }

    const activeFilter = GIFT_FILTERS.find(item => item.id === filter);
    const activeSort = GIFT_SORTS.find(item => item.id === sort);
    const isFiltered = filter !== 'todos' || !!query.trim() || personFilter !== 'todas';

    wrap.innerHTML = `
      <div class="srp-toolbar">
        <label class="srp-search">
          ${icon('search', 17)}
          <input type="search" id="srpSearch" placeholder="Buscar regalo, persona u ocasión…" aria-label="Buscar regalos" autocomplete="off" value="${esc(query)}">
        </label>
        <button type="button" class="srp-filter-btn${isFiltered ? ' is-on' : ''}" id="srpFilterBtn" data-filters aria-label="Filtrar y ordenar">
          ${icon('filter', 17)}<span>Filtros</span>
          ${isFiltered ? '<span class="srp-filter-btn__dot" aria-hidden="true"></span>' : ''}
        </button>
      </div>
      <div class="srp-active-filters" id="srpActiveFilters"></div>
      <p class="srp-count" id="srpCount" role="status" aria-live="polite"></p>
      <div class="srp-list" id="srpGiftList"></div>
    `;

    const search = wrap.querySelector('#srpSearch');
    search.addEventListener('input', () => {
      query = search.value;
      drawGiftList();
    });

    function drawActiveFilters() {
      const holder = wrap.querySelector('#srpActiveFilters');
      const bits = [];
      if (filter !== 'todos') bits.push(activeFilter?.label || filter);
      if (personFilter !== 'todas') {
        bits.push(findPerson(personFilter)?.name || 'Persona');
      }
      if (sort !== 'fecha') bits.push(`Orden: ${activeSort?.label || sort}`);
      holder.innerHTML = bits.length
        ? `<span class="srp-active-filters__label">${bits.map(esc).join(' · ')}</span>
           <button type="button" class="srp-linkbtn" data-clear-filters>Limpiar</button>`
        : '';
      wrap.querySelector('#srpFilterBtn')?.classList.toggle('is-on', bits.length > 0 || !!query.trim());
    }

    function drawGiftList() {
      const list = wrap.querySelector('#srpGiftList');
      const count = wrap.querySelector('#srpCount');
      if (!list || !count) return;
      const items = filterGifts({
        gifts: rows,
        people,
        filter,
        sort,
        query,
        personId: personFilter,
      });

      const total = items.reduce((sum, gift) => sum + estimatedValue(gift), 0);
      count.textContent = items.length
        ? `${items.length} ${items.length === 1 ? 'regalo' : 'regalos'}${caps.gift ? ` · ${fmtEur(total)}` : ''}`
        : '';

      if (!items.length) {
        list.innerHTML = emptyBlock({
          art: 'regalos-vacios',
          title: isFiltered ? 'Sin resultados' : 'Sin regalos en esta vista',
          text: isFiltered
            ? 'Prueba con otro filtro, otra persona o cambia la búsqueda.'
            : 'Cuando añadas regalos aparecerán aquí, con su estado y su fecha.',
        });
        return;
      }
      list.innerHTML = items.map(gift => giftCardHTML(gift)).join('');
      drawActiveFilters();
    }

    drawActiveFilters();
    drawGiftList();
    return wrap;
  }

  function filtersSheet() {
    openSheet('Filtrar y ordenar', () => {
      const wrap = h('div', { class: 'srp-filters' });
      wrap.innerHTML = `
        <p class="srp-field-label">Estado</p>
        <div class="srp-filter-grid" role="group" aria-label="Filtrar por estado" id="srpFilterGrid">
          ${GIFT_FILTERS.map(
            item => `<button type="button" class="srp-chip${filter === item.id ? ' is-on' : ''}" data-choose-filter="${item.id}" aria-pressed="${filter === item.id}">${esc(item.label)}</button>`,
          ).join('')}
        </div>
        <p class="srp-field-label">Ordenar por</p>
        <div class="srp-sort-list" role="group" aria-label="Ordenar regalos" id="srpSortList">
          ${GIFT_SORTS.map(
            item => `<button type="button" class="srp-sort-row${sort === item.id ? ' is-on' : ''}" data-choose-sort="${item.id}" aria-pressed="${sort === item.id}">
              <span>${esc(item.label)}</span>${sort === item.id ? icon('check', 16) : ''}
            </button>`,
          ).join('')}
        </div>
        ${
          people.length
            ? `<p class="srp-field-label">Destinatario</p>
               <select class="srp-select" id="srpPersonFilter" aria-label="Filtrar por destinatario">
                 <option value="todas">Todas las personas</option>
                 ${people
                   .map(
                     person =>
                       `<option value="${esc(person.id)}"${personFilter === person.id ? ' selected' : ''}>${esc(person.name)}</option>`,
                   )
                   .join('')}
               </select>`
            : ''
        }
        <div class="srp-sheet-actions">
          <button type="button" class="btn btn-block" data-close-sheet>Ver resultados</button>
          <button type="button" class="btn btn-soft btn-block" data-clear-filters>Quitar filtros</button>
        </div>
      `;

      wrap.querySelector('#srpFilterGrid').addEventListener('click', event => {
        const button = event.target.closest('[data-choose-filter]');
        if (!button) return;
        filter = button.dataset.chooseFilter;
        wrap.querySelectorAll('[data-choose-filter]').forEach(el => {
          const on = el.dataset.chooseFilter === filter;
          el.classList.toggle('is-on', on);
          el.setAttribute('aria-pressed', String(on));
        });
        draw();
      });

      wrap.querySelector('#srpSortList').addEventListener('click', event => {
        const button = event.target.closest('[data-choose-sort]');
        if (!button) return;
        sort = button.dataset.chooseSort;
        draw();
      });

      wrap.querySelector('#srpPersonFilter')?.addEventListener('change', event => {
        personFilter = event.target.value;
        draw();
      });

      return wrap;
    });
  }

  function clearFilters() {
    filter = 'todos';
    sort = 'fecha';
    query = '';
    personFilter = 'todas';
    closeSheets();
    draw();
  }

  function giftMenuSheet(gift) {
    const isTrashed = !!gift.removed_at;
    const isArchived = !!gift.archived_at && !isTrashed;
    const person = personOf(gift);

    const actions = [];
    if (isTrashed) {
      actions.push(
        ['Restaurar', () => restoreGift(gift)],
        ['Eliminar definitivamente', () => purgeGift(gift), 'danger'],
      );
    } else if (isArchived) {
      actions.push(
        ['Ver detalle', () => go('gift', gift.id)],
        ['Desarchivar', () => toggleArchive(gift)],
        ['Editar', () => giftEditor(gift)],
        ['Enviar a la papelera', () => trashGift(gift), 'danger'],
      );
    } else {
      actions.push(
        ['Ver detalle', () => go('gift', gift.id)],
        ['Editar', () => giftEditor(gift)],
        ['Cambiar estado', () => statusSheet(gift)],
        ['Duplicar', () => duplicateGift(gift)],
        ['Archivar', () => toggleArchive(gift)],
        ['Eliminar', () => trashGift(gift), 'danger'],
      );
    }

    openSheet(person ? `Regalo para ${person.name}` : gift.title, () =>
      h(
        'div',
        { class: 'srp-sheet-menu' },
        h('p', { class: 'srp-sheet-menu__title' }, gift.title),
        ...actions.map(([label, run, tone]) =>
          h(
            'button',
            {
              type: 'button',
              class: `srp-sheet-menu__item${tone === 'danger' ? ' is-danger' : ''}`,
              onclick: () => {
                closeSheets();
                run();
              },
            },
            label,
          ),
        ),
      ),
    );
  }

  function statusSheet(gift) {
    const list = statuses();
    openSheet('Cambiar estado', () =>
      h(
        'div',
        null,
        h('p', { class: 'srp-sheet-menu__title' }, gift.title),
        h('p', { class: 'srp-hint' }, 'Puedes corregir el estado cuando quieras. No se borra nada.'),
        h(
          'div',
          { class: 'srp-state-menu' },
          Object.entries(list).map(([value, meta]) =>
            h(
              'button',
              {
                type: 'button',
                class: `srp-state is-${meta.tone}${gift.state === value ? ' is-current' : ''}`,
                'aria-pressed': String(gift.state === value),
                onclick: () => updateStatus(gift, value),
              },
              h('span', { class: 'srp-state__dot', 'aria-hidden': 'true' }),
              meta.label,
            ),
          ),
        ),
      ),
    );
  }

  async function updateStatus(gift, state) {
    try {
      await writeEntry('surprise', { state: storableState(state) }, gift);
      closeSheets();
      toast(`Estado: ${statusOf({ state: storableState(state) }).label}`);
      await load();
    } catch (error) {
      toast(error?.message?.includes('otro dispositivo') ? error.message : 'No se pudo cambiar el estado');
    }
  }

  /* ==========================================
     VISTA · DETALLE DEL REGALO
     ========================================== */

  function giftDetailView(id) {
    const gift = findGift(id);
    const wrap = h('div', { class: 'srp-view srp-detail' });
    if (!gift) {
      wrap.innerHTML = `${subheadHTML('Regalo')}${emptyBlock({
        title: 'Regalo no encontrado',
        text: 'Puede que se haya eliminado en otro dispositivo.',
      })}`;
      return wrap;
    }

    const person = personOf(gift);
    const meta = statusOf(gift);
    const photo = caps.gift ? safeUrl(gift.photo) : '';
    const links = caps.organizer ? parseLinks(gift.extra_links) : [];
    const steps = Object.entries(statuses());
    const price = caps.gift ? (gift.price != null ? fmtEur(gift.price) : '') : '';
    const actual = caps.organizer && gift.actual_price != null ? fmtEur(gift.actual_price) : '';
    const shopLink = caps.gift ? safeUrl(gift.link) : '';

    const info = [
      ['Destinatario', person?.name || 'Sin asignar'],
      ['Fecha prevista', gift.day ? fmtLongDay(gift.day) : ''],
      ['Ocasión', gift.occasion || ''],
      ['Prioridad', PRIORITY_LABELS[gift.priority] || ''],
      ['Precio estimado', price],
      ['Precio real', actual],
      ['Tienda', gift.store || ''],
      ['Estado', meta.label],
    ].filter(([, value]) => value);

    wrap.innerHTML = `
      ${subheadHTML('Detalle del regalo', {
        actions: `<button type="button" class="icon-btn" data-gift-menu="${esc(gift.id)}" aria-label="Acciones">${icon('more', 18)}</button>`,
      })}
      ${
        photo
          ? `<div class="srp-detail__photo"><img src="${photo}" alt="Foto de ${esc(gift.title)}"></div>`
          : `<div class="srp-detail__art">${giftArt(meta.art, { size: 96 })}</div>`
      }
      <div class="srp-detail__title">
        <h3>${esc(gift.title)}</h3>
        <span class="srp-pill is-${meta.tone}">${esc(meta.label)}</span>
      </div>
      ${gift.removed_at ? '<p class="srp-warning">Está en la papelera. Restáuralo para seguir usándolo.</p>' : ''}
      ${
        gift.archived_at && !gift.removed_at
          ? '<p class="srp-warning">Archivado: no aparece en la lista diaria.</p>'
          : ''
      }

      <section class="srp-detail__block">
        <p class="srp-field-label">Estado rápido</p>
        <div class="srp-steps" role="group" aria-label="Cambiar estado del regalo">
          ${steps
            .map(
              ([value, stepMeta]) => `
                <button type="button" class="srp-step is-${stepMeta.tone}${gift.state === value ? ' is-current' : ''}"
                  data-set-status="${value}" aria-pressed="${gift.state === value}">
                  <span class="srp-step__dot" aria-hidden="true"></span>${esc(stepMeta.label)}
                </button>`,
            )
            .join('')}
        </div>
      </section>

      ${
        info.length
          ? `<section class="srp-detail__block">
               <p class="srp-field-label">Información</p>
               <dl class="srp-info">
                 ${info.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}
               </dl>
             </section>`
          : ''
      }

      ${
        gift.detail
          ? `<section class="srp-detail__block">
               <p class="srp-field-label">Descripción</p>
               <p class="srp-prose">${esc(gift.detail)}</p>
             </section>`
          : ''
      }

      ${
        shopLink || links.length
          ? `<section class="srp-detail__block">
               <p class="srp-field-label">Enlaces</p>
               <div class="srp-links">
                 ${
                   shopLink
                     ? `<a class="srp-link" href="${shopLink}" target="_blank" rel="noopener noreferrer">${icon('external', 15)}<span>Ver en la tienda</span></a>`
                     : ''
                 }
                 ${links
                   .map(value => {
                     const url = safeUrl(value);
                     if (!url) return '';
                     let label = value;
                     try {
                       label = new URL(value).hostname.replace(/^www\./, '');
                     } catch {
                       /* texto tal cual */
                     }
                     return `<a class="srp-link" href="${url}" target="_blank" rel="noopener noreferrer">${icon('external', 15)}<span>${esc(label)}</span></a>`;
                   })
                   .join('')}
               </div>
             </section>`
          : ''
      }

      ${
        gift.notes
          ? `<section class="srp-detail__block">
               <p class="srp-field-label">Información adicional</p>
               <p class="srp-prose">${esc(gift.notes)}</p>
             </section>`
          : ''
      }

      <div class="srp-detail__actions">
        <button type="button" class="btn btn-block" data-edit-gift="${esc(gift.id)}">${icon('edit', 15)} Editar regalo</button>
        ${
          gift.removed_at
            ? `<button type="button" class="btn btn-soft btn-block" data-restore-gift="${esc(gift.id)}">Restaurar</button>
               <button type="button" class="btn btn-danger btn-block" data-purge-gift="${esc(gift.id)}">Eliminar definitivamente</button>`
            : `<button type="button" class="btn btn-soft btn-block" data-archive-gift="${esc(gift.id)}">
                 ${gift.archived_at ? 'Desarchivar' : 'Archivar'}
               </button>
               <button type="button" class="btn btn-danger btn-block" data-trash-gift="${esc(gift.id)}">Eliminar</button>`
        }
      </div>
    `;
    return wrap;
  }

  /* ==========================================
     EDITOR DE REGALO
     ========================================== */

  function giftEditor(gift = null, preset = {}) {
    const editing = !!gift;
    let detachGuard = () => {};
    openSheet(
      editing ? 'Editar regalo' : 'Nuevo regalo',
      () => {
      const form = h('form', { class: 'srp-form', novalidate: true });
      let photoValue = gift?.photo || '';
      let state = gift ? storableState(gift.state) : 'pendiente';
      let starred = !!(gift && gift.starred);

      /* --- Información principal --- */
      const title = h('input', {
        type: 'text',
        name: 'title',
        maxlength: '140',
        required: true,
        placeholder: 'Ej. Auriculares con cancelación de ruido',
        value: gift?.title || '',
      });
      const detail = h('textarea', {
        name: 'detail',
        maxlength: '4000',
        placeholder: 'Talla, color, modelo, dónde conseguirlo…',
      });
      detail.value = gift?.detail || '';

      const personSelect = caps.personColumn
        ? h(
            'select',
            { name: 'person_id' },
            h('option', { value: '' }, 'Sin asignar'),
            ...people.map(person =>
              h(
                'option',
                {
                  value: person.id,
                  selected: gift ? gift.person_id === person.id : preset.personId === person.id,
                },
                person.name,
              ),
            ),
          )
        : null;

      const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const photoBox = h('button', {
        type: 'button',
        class: 'srp-photo',
        'aria-label': 'Añadir o cambiar la foto del regalo',
        onclick: () => photoInput.click(),
      });
      const photoActions = h('div', { class: 'srp-photo__actions' });
      const drawPhoto = () => {
        photoBox.innerHTML = photoValue
          ? `<img src="${safeUrl(photoValue)}" alt="Foto del regalo">`
          : `${giftArt(artForState(state), { size: 64 })}<span>Añadir foto</span>`;
        photoActions.replaceChildren();
        if (photoValue) {
          photoActions.append(
            h('button', { type: 'button', class: 'btn btn-soft btn--sm', onclick: () => photoInput.click() }, 'Cambiar'),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-soft btn--sm',
                onclick: () => {
                  photoValue = '';
                  drawPhoto();
                },
              },
              'Quitar',
            ),
          );
        }
      };
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files?.[0];
        photoInput.value = '';
        if (!file) return;
        try {
          photoValue = await photoFromFile(file);
          drawPhoto();
        } catch (error) {
          toast(error.message);
        }
      });
      drawPhoto();

      /* --- Organización --- */
      const day = h('input', {
        type: 'date',
        name: 'day',
        required: true,
        value: gift?.day || preset.day || todayISO(),
      });
      const occasion = caps.organizer
        ? h('input', {
            type: 'text',
            name: 'occasion',
            maxlength: '80',
            placeholder: 'Cumpleaños, aniversario, Navidad…',
            value: gift?.occasion || preset.occasion || '',
          })
        : null;
      const priority = caps.organizer
        ? h(
            'select',
            { name: 'priority' },
            h('option', { value: '' }, 'Sin prioridad'),
            Object.entries(PRIORITY_LABELS)
              .filter(([value]) => value)
              .map(([value, label]) =>
                h('option', { value, selected: (gift?.priority || '') === value }, label),
              ),
          )
        : null;

      const offered = statuses();
      const stateMenu = h('div', { class: 'srp-state-menu' });
      const drawStates = () => {
        stateMenu.innerHTML = '';
        for (const [value, meta] of Object.entries(offered)) {
          stateMenu.append(
            h(
              'button',
              {
                type: 'button',
                class: `srp-state is-${meta.tone}${state === value ? ' is-current' : ''}`,
                'aria-pressed': String(state === value),
                onclick: () => {
                  state = value;
                  drawStates();
                  drawPhoto();
                },
              },
              h('span', { class: 'srp-state__dot', 'aria-hidden': 'true' }),
              meta.label,
            ),
          );
        }
      };
      drawStates();

      /* --- Económica --- */
      const price = caps.gift
        ? h('input', {
            type: 'number',
            name: 'price',
            min: '0',
            max: '100000',
            step: '0.01',
            inputmode: 'decimal',
            placeholder: '0,00',
            value: gift?.price ?? '',
          })
        : null;
      const actualPrice = caps.organizer
        ? h('input', {
            type: 'number',
            name: 'actual_price',
            min: '0',
            max: '100000',
            step: '0.01',
            inputmode: 'decimal',
            placeholder: 'Lo que costó de verdad',
            value: gift?.actual_price ?? '',
          })
        : null;
      const link = caps.gift
        ? h('input', {
            type: 'url',
            name: 'link',
            maxlength: '2000',
            placeholder: 'https://…',
            value: gift?.link || '',
          })
        : null;
      const store = caps.organizer
        ? h('input', {
            type: 'text',
            name: 'store',
            maxlength: '120',
            placeholder: 'Ej. Fnac, Amazon, tienda del barrio',
            value: gift?.store || '',
          })
        : null;

      /* --- Adicional --- */
      const notes = caps.organizer
        ? h('textarea', { name: 'notes', maxlength: '4000', placeholder: 'Notas, tallas, dónde esconderlo…' })
        : null;
      if (notes) notes.value = gift?.notes || '';
      const extraLinks = caps.organizer
        ? h('textarea', {
            name: 'extra_links',
            maxlength: '2000',
            placeholder: 'Un enlace por línea',
          })
        : null;
      if (extraLinks) extraLinks.value = gift?.extra_links || '';

      const starButton = caps.extras
        ? h(
            'button',
            {
              type: 'button',
              class: `srp-star-toggle${starred ? ' is-on' : ''}`,
              'aria-pressed': String(starred),
              onclick: () => {
                starred = !starred;
                starButton.classList.toggle('is-on', starred);
                starButton.setAttribute('aria-pressed', String(starred));
                starButton.innerHTML = `${icon('star', 15)} ${starred ? 'Favorito' : 'Marcar como favorito'}`;
              },
            },
            icon('star', 15),
            starred ? ' Favorito' : ' Marcar como favorito',
          )
        : null;

      const error = h('p', { class: 'srp-error', role: 'alert' });
      const submit = h('button', { type: 'submit', class: 'btn btn-block' }, editing ? 'Guardar cambios' : 'Guardar regalo');
      const cancel = h('button', { type: 'button', class: 'btn btn-soft btn-block' }, 'Cancelar');

      form.append(...[
        h('div', { class: 'srp-photo-wrap' }, photoBox, photoActions, photoInput),
        h('label', { class: 'srp-field' }, h('span', null, 'Nombre del regalo'), title),
        personSelect
          ? h('label', { class: 'srp-field' }, h('span', null, 'Para quién'), personSelect)
          : null,
        h('label', { class: 'srp-field' }, h('span', null, 'Descripción'), detail),

        h('p', { class: 'srp-form__section' }, 'Organización'),
        h('div', { class: 'srp-field' }, h('span', null, 'Estado'), stateMenu),
        h(
          'div',
          { class: 'srp-form__row' },
          h('label', { class: 'srp-field' }, h('span', null, 'Fecha prevista'), day),
          occasion ? h('label', { class: 'srp-field' }, h('span', null, 'Ocasión'), occasion) : null,
        ),
        priority ? h('label', { class: 'srp-field' }, h('span', null, 'Prioridad'), priority) : null,

        caps.gift
          ? h('p', { class: 'srp-form__section' }, 'Información económica')
          : null,
        caps.gift
          ? h(
              'div',
              { class: 'srp-form__row' },
              h('label', { class: 'srp-field' }, h('span', null, 'Precio estimado (€)'), price),
              actualPrice
                ? h('label', { class: 'srp-field' }, h('span', null, 'Precio real (€)'), actualPrice)
                : null,
            )
          : null,
        caps.gift ? h('label', { class: 'srp-field' }, h('span', null, 'Enlace de compra'), link) : null,
        store ? h('label', { class: 'srp-field' }, h('span', null, 'Tienda'), store) : null,

        caps.organizer
          ? h('details', { class: 'srp-details' },
              h('summary', null, 'Información adicional'),
              h('div', { class: 'srp-details__body' },
                notes ? h('label', { class: 'srp-field' }, h('span', null, 'Notas'), notes) : null,
                extraLinks
                  ? h('label', { class: 'srp-field' }, h('span', null, 'Enlaces adicionales'), extraLinks)
                  : null,
              ),
            )
          : null,

        starButton,
        error,
        submit,
        cancel,
      ].filter(Boolean));

      /* Cambios sin guardar: cerrar la hoja (X, fondo o Escape) pide
         confirmación. Cancelar también. */
      let dirty = false;
      form.addEventListener('input', () => {
        dirty = true;
      });
      form.addEventListener('change', () => {
        dirty = true;
      });
      const confirmLeave = () => {
        if (!dirty) return true;
        const goOut = window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?');
        if (goOut) dirty = false;
        return goOut;
      };

      // El formulario aún no está dentro del overlay cuando se construye:
      // los listeners viven en el documento y comprueban el overlay al vuelo.
      const onCapture = event => {
        const overlay = form.closest('.overlay');
        if (!overlay || !dirty) return;
        if (event.target === overlay || event.target.closest('.sheet-head')) {
          if (!confirmLeave()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      };
      const onKey = event => {
        if (event.key === 'Escape' && dirty && !confirmLeave()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      document.addEventListener('click', onCapture, true);
      document.addEventListener('keydown', onKey, true);
      detachGuard = () => {
        document.removeEventListener('click', onCapture, true);
        document.removeEventListener('keydown', onKey, true);
      };

      cancel.addEventListener('click', () => {
        if (!confirmLeave()) return;
        dirty = false;
        closeSheets();
      });

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const values = {
          title: title.value.trim(),
          detail: detail.value.trim(),
          day: day.value,
          state: storableState(state),
          ...(caps.personColumn && personSelect && { person_id: personSelect.value || null }),
          ...(caps.gift && {
            price: price.value === '' ? null : Number(price.value),
            link: link.value.trim(),
            photo: photoValue,
          }),
          ...(caps.extras && { starred }),
          ...(caps.organizer && {
            occasion: occasion.value.trim(),
            store: store.value.trim(),
            actual_price: actualPrice.value === '' ? null : Number(actualPrice.value),
            priority: priority.value,
            extra_links: extraLinks.value.trim(),
            notes: notes.value.trim(),
          }),
        };

        if (!values.title) {
          error.textContent = 'Ponle un nombre al regalo.';
          title.focus();
          return;
        }
        if (!values.day) {
          error.textContent = 'Elige una fecha para el regalo.';
          day.focus();
          return;
        }
        if (values.price != null && (!Number.isFinite(values.price) || values.price < 0)) {
          error.textContent = 'El precio no puede ser negativo.';
          price.focus();
          return;
        }
        if (values.actual_price != null && (!Number.isFinite(values.actual_price) || values.actual_price < 0)) {
          error.textContent = 'El precio real no puede ser negativo.';
          actualPrice.focus();
          return;
        }
        if (values.link && !/^https?:\/\/\S+$/i.test(values.link)) {
          error.textContent = 'El enlace debe empezar por http:// o https://';
          link.focus();
          return;
        }
        const badLink = parseLinks(values.extra_links || '').find(value => !/^https?:\/\/\S+$/i.test(value));
        if (badLink) {
          error.textContent = `Este enlace no es válido: ${badLink}`;
          extraLinks.focus();
          return;
        }

        error.textContent = '';
        submit.disabled = true;
        cancel.disabled = true;
        try {
          await writeEntry('surprise', values, gift);
          dirty = false;
          detachGuard();
          closeSheets();
          toast(editing ? 'Regalo actualizado' : 'Regalo guardado');
          await load();
        } catch (err) {
          error.textContent = err?.message?.includes('otro dispositivo')
            ? err.message
            : 'No se ha guardado. Vuelve a intentarlo.';
          submit.disabled = false;
          cancel.disabled = false;
        }
      });

      return form;
      },
      () => detachGuard(),
    );
  }

  /* ==========================================
     VISTA · PERSONAS
     ========================================== */

  function personCardHTML(person) {
    const buckets = personGiftBuckets(person.id, rows);
    const next = nextOccasionOf(person, todayISO());
    const birthday = person.birthday ? fmtBirthday(person.birthday) : '';
    const count = buckets.all.length;
    const pending = buckets.ideas.length + buckets.pending.length;
    const meta = [
      birthday ? `Cumple el ${birthday}` : 'Sin cumpleaños',
      next ? countdown(next.date, true) : '',
    ].filter(Boolean).join(' · ');

    return `
      <article class="srp-person-card">
        <button type="button" class="srp-person-card__open" data-person-open="${esc(person.id)}" aria-label="Abrir la ficha de ${esc(person.name)}">
          ${avatarHTML(person, 52)}
          <span class="srp-person-card__copy">
            <span class="srp-person-card__name">${esc(person.name)}</span>
            <span class="srp-person-card__meta">${esc(meta)}</span>
            <span class="srp-person-card__stats">
              <span><b>${count}</b> ${count === 1 ? 'regalo' : 'regalos'}</span>
              <span><b>${pending}</b> pendientes</span>
              ${next ? `<span class="srp-person-card__next">${esc(next.title)}</span>` : ''}
            </span>
          </span>
          <span class="srp-person-card__chev" aria-hidden="true">${icon('chev', 16)}</span>
        </button>
      </article>
    `;
  }

  function peopleView() {
    const wrap = h('div', { class: 'srp-view' });

    if (!caps.people) {
      wrap.innerHTML = `
        <div class="empty">
          <b>Personas no disponible</b>
          <p>Aplica la migración 038 para organizar tus regalos por destinatario.</p>
        </div>`;
      return wrap;
    }

    if (!people.length) {
      wrap.innerHTML = emptyBlock({
        art: 'persona',
        title: 'Aún no hay personas',
        text: 'Añade a quién le regalas con su cumpleaños y sus gustos. Solo tú verás esta lista.',
        action: '<button type="button" class="btn" data-person-new>Añadir persona</button>',
      });
      return wrap;
    }

    wrap.innerHTML = `
      <div class="srp-toolbar">
        <label class="srp-search">
          ${icon('search', 17)}
          <input type="search" id="srpPeopleSearch" placeholder="Buscar persona…" aria-label="Buscar personas" autocomplete="off" value="${esc(peopleQuery)}">
        </label>
        <button type="button" class="srp-filter-btn" data-person-new>${icon('plus', 16)}<span>Añadir</span></button>
      </div>
      <p class="srp-count" id="srpPeopleCount"></p>
      <div class="srp-people-list" id="srpPeopleList"></div>
    `;

    const search = wrap.querySelector('#srpPeopleSearch');
    const list = wrap.querySelector('#srpPeopleList');
    const count = wrap.querySelector('#srpPeopleCount');

    const drawPeople = () => {
      const needle = peopleQuery
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const items = people.filter(person =>
        !needle
          ? true
          : `${person.name} ${person.likes || ''} ${person.interests || ''}`
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .includes(needle),
      );
      count.textContent = `${items.length} ${items.length === 1 ? 'persona' : 'personas'}`;
      list.innerHTML = items.length
        ? items.map(personCardHTML).join('')
        : emptyBlock({
            art: 'persona',
            title: 'Sin resultados',
            text: 'Ninguna persona coincide con la búsqueda.',
          });
    };

    search.addEventListener('input', () => {
      peopleQuery = search.value;
      drawPeople();
    });
    drawPeople();
    return wrap;
  }

  function personDetailView(id) {
    const person = findPerson(id);
    const wrap = h('div', { class: 'srp-view srp-person' });
    if (!person) {
      wrap.innerHTML = `${subheadHTML('Persona')}${emptyBlock({
        art: 'persona',
        title: 'Persona no encontrada',
        text: 'Puede que la hayas quitado en otro dispositivo.',
      })}`;
      return wrap;
    }

    const buckets = personGiftBuckets(person.id, rows);
    const next = nextOccasionOf(person, todayISO());
    const dates = Array.isArray(person.important_dates) ? person.important_dates : [];
    const group = (title, items) =>
      items.length
        ? `<section class="srp-person__group">
             <div class="srp-section-title"><span>${title}</span><b>${items.length}</b></div>
             <div class="srp-list">${items.map(gift => giftCardHTML(gift)).join('')}</div>
           </section>`
        : '';

    wrap.innerHTML = `
      ${subheadHTML('Persona', {
        actions: `<button type="button" class="icon-btn" data-person-menu="${esc(person.id)}" aria-label="Opciones de ${esc(person.name)}">${icon('more', 18)}</button>`,
      })}
      <div class="srp-person__hero">
        ${avatarHTML(person, 84)}
        <div class="srp-person__hero-copy">
          <h3>${esc(person.name)}</h3>
          <p>${person.birthday ? `Cumpleaños: ${esc(fmtBirthday(person.birthday))}` : 'Sin cumpleaños registrado'}</p>
          ${next ? `<p class="srp-person__next">${esc(next.title)} · ${esc(fmtDay(next.date))} · ${esc(countdown(next.date))}</p>` : ''}
        </div>
      </div>

      <div class="srp-person__stats">
        <div><b>${caps.gift ? esc(fmtEur(buckets.planned)) : buckets.all.length}</b><span>Previsto</span></div>
        <div class="srp-person__sep"></div>
        <div><b>${caps.gift ? esc(fmtEur(buckets.spent)) : buckets.delivered.length}</b><span>Gastado</span></div>
        <div class="srp-person__sep"></div>
        <div><b>${buckets.all.length}</b><span>Regalos</span></div>
      </div>

      <button type="button" class="btn btn-block" data-new-gift-for="${esc(person.id)}">${icon('plus', 15)} Nuevo regalo para ${esc(person.name.split(' ')[0])}</button>

      ${group('Ideas', buckets.ideas)}
      ${group('Pendientes de comprar', buckets.pending)}
      ${group('Comprados y preparados', buckets.bought)}
      ${group('Historial de entregados', buckets.delivered)}

      ${
        buckets.all.length === 0
          ? `<div class="srp-person__empty">${giftArt('regalos-vacios', { size: 84 })}<p>Todavía no hay regalos para ${esc(person.name)}.</p></div>`
          : ''
      }

      ${dates.length
        ? `<section class="srp-detail__block">
             <p class="srp-field-label">Fechas importantes</p>
             <dl class="srp-info">
               ${dates
                 .map(
                   item =>
                     `<div><dt>${esc(item.label || 'Fecha')}</dt><dd>${esc(fmtBirthday(item.date || ''))}</dd></div>`,
                 )
                 .join('')}
             </dl>
           </section>`
        : ''}

      ${person.likes
        ? `<section class="srp-detail__block"><p class="srp-field-label">Gustos</p><p class="srp-prose">${esc(person.likes)}</p></section>`
        : ''}
      ${person.interests
        ? `<section class="srp-detail__block"><p class="srp-field-label">Intereses</p><p class="srp-prose">${esc(person.interests)}</p></section>`
        : ''}
      ${person.notes
        ? `<section class="srp-detail__block"><p class="srp-field-label">Notas personales</p><p class="srp-prose">${esc(person.notes)}</p></section>`
        : ''}

      <div class="srp-detail__actions">
        <button type="button" class="btn btn-soft btn-block" data-person-edit="${esc(person.id)}">Editar persona</button>
      </div>
    `;
    return wrap;
  }

  function personMenuSheet(person) {
    openSheet(person.name, () =>
      h(
        'div',
        { class: 'srp-sheet-menu' },
        h(
          'button',
          {
            type: 'button',
            class: 'srp-sheet-menu__item',
            onclick: () => {
              closeSheets();
              go('person', person.id);
            },
          },
          'Ver ficha',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'srp-sheet-menu__item',
            onclick: () => {
              closeSheets();
              personEditor(person);
            },
          },
          'Editar persona',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'srp-sheet-menu__item',
            onclick: () => {
              closeSheets();
              giftEditor(null, { personId: person.id });
            },
          },
          'Nuevo regalo para esta persona',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'srp-sheet-menu__item is-danger',
            onclick: () => {
              closeSheets();
              void deletePerson(person);
            },
          },
          'Quitar persona',
        ),
      ),
    );
  }

  function personEditor(person = null) {
    openSheet(person ? 'Editar persona' : 'Nueva persona', () => {
      const form = h('form', { class: 'srp-form', novalidate: true });
      let photoValue = person?.photo || '';
      const dates = (Array.isArray(person?.important_dates) ? person.important_dates : []).map(item => ({
        label: item.label || '',
        date: item.date || '',
      }));

      const preview = h('button', { type: 'button', class: 'srp-photo srp-photo--round' });
      const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const photoActions = h('div', { class: 'srp-photo__actions' });

      const name = h('input', {
        type: 'text',
        name: 'name',
        maxlength: '60',
        required: true,
        placeholder: 'Ej. Mamá, Carlos, Sofía…',
        value: person?.name || '',
      });
      const birthday = h('input', {
        type: 'date',
        name: 'birthday',
        value: person?.birthday || '',
      });
      const likes = caps.peopleOrganizer
        ? h('textarea', { name: 'likes', maxlength: '2000', placeholder: 'Colores, marcas, cosas que le gustan…' })
        : null;
      if (likes) likes.value = person?.likes || '';
      const interests = caps.peopleOrganizer
        ? h('textarea', { name: 'interests', maxlength: '2000', placeholder: 'Aficiones, series, música, deportes…' })
        : null;
      if (interests) interests.value = person?.interests || '';
      const notes = h('textarea', {
        name: 'notes',
        maxlength: '2000',
        placeholder: 'Tallas, alergias, ideas que ha mencionado…',
      });
      notes.value = person?.notes || '';

      const drawPhoto = () => {
        const personLike = { name: name.value.trim() || person?.name || '', photo: photoValue };
        preview.innerHTML = avatarHTML(personLike, 84);
        photoActions.replaceChildren();
        photoActions.append(
          h('button', { type: 'button', class: 'btn btn-soft btn--sm', onclick: () => fileInput.click() }, photoValue ? 'Cambiar foto' : 'Añadir foto'),
        );
        if (photoValue) {
          photoActions.append(
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-soft btn--sm',
                onclick: () => {
                  photoValue = '';
                  drawPhoto();
                },
              },
              'Quitar foto',
            ),
          );
        }
      };
      name.addEventListener('input', drawPhoto);
      preview.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
          photoValue = await photoFromFile(file, 512);
          drawPhoto();
        } catch (error) {
          toast(error.message);
        }
      });
      drawPhoto();

      const datesBox = h('div', { class: 'srp-dates' });
      const drawDates = () => {
        datesBox.replaceChildren();
        dates.forEach((item, index) => {
          const label = h('input', {
            type: 'text',
            maxlength: '40',
            placeholder: 'Aniversario, santo…',
            value: item.label,
            'aria-label': `Nombre de la fecha ${index + 1}`,
          });
          const date = h('input', { type: 'date', value: item.date, 'aria-label': `Fecha importante ${index + 1}` });
          label.addEventListener('input', () => {
            item.label = label.value;
          });
          date.addEventListener('change', () => {
            item.date = date.value;
          });
          datesBox.append(
            h(
              'div',
              { class: 'srp-date-row' },
              label,
              date,
              h(
                'button',
                {
                  type: 'button',
                  class: 'icon-btn',
                  'aria-label': 'Quitar fecha',
                  onclick: () => {
                    dates.splice(index, 1);
                    drawDates();
                  },
                },
                icon('x', 15),
              ),
            ),
          );
        });
        datesBox.append(
          h(
            'button',
            {
              type: 'button',
              class: 'srp-linkbtn',
              onclick: () => {
                dates.push({ label: '', date: '' });
                drawDates();
              },
            },
            '+ Añadir fecha importante',
          ),
        );
      };
      if (caps.peopleOrganizer) drawDates();

      const error = h('p', { class: 'srp-error', role: 'alert' });
      const submit = h('button', { type: 'submit', class: 'btn btn-block' }, person ? 'Guardar cambios' : 'Añadir persona');
      const cancel = h('button', { type: 'button', class: 'btn btn-soft btn-block' }, 'Cancelar');

      form.append(...[
        h('div', { class: 'srp-photo-wrap' }, preview, photoActions, fileInput),
        h('label', { class: 'srp-field' }, h('span', null, 'Nombre'), name),
        h('label', { class: 'srp-field' }, h('span', null, 'Cumpleaños'), birthday),
        caps.peopleOrganizer ? h('p', { class: 'srp-form__section' }, 'Fechas importantes') : null,
        caps.peopleOrganizer ? datesBox : null,
        caps.peopleOrganizer
          ? h('p', { class: 'srp-form__section' }, 'Gustos e intereses')
          : null,
        likes ? h('label', { class: 'srp-field' }, h('span', null, 'Gustos'), likes) : null,
        interests ? h('label', { class: 'srp-field' }, h('span', null, 'Intereses'), interests) : null,
        h('label', { class: 'srp-field' }, h('span', null, 'Notas'), notes),
        error,
        submit,
        cancel,
      ].filter(Boolean));

      cancel.addEventListener('click', closeSheets);

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const values = {
          name: name.value.trim(),
          birthday: birthday.value || null,
          photo: photoValue,
          notes: notes.value.trim(),
          ...(caps.peopleOrganizer && {
            likes: likes.value.trim(),
            interests: interests.value.trim(),
            important_dates: dates.filter(item => item.date),
          }),
        };
        if (!values.name) {
          error.textContent = 'Escribe un nombre.';
          name.focus();
          return;
        }
        error.textContent = '';
        submit.disabled = true;
        cancel.disabled = true;
        try {
          await savePerson(values, person);
          closeSheets();
          toast(person ? 'Persona actualizada' : 'Persona añadida');
          await load();
        } catch (err) {
          error.textContent = err?.message?.includes('otro dispositivo')
            ? err.message
            : 'No se ha guardado. Vuelve a intentarlo.';
          submit.disabled = false;
          cancel.disabled = false;
        }
      });

      return form;
    });
  }

  async function deletePerson(person) {
    if (!window.confirm(`¿Quitar a ${person.name}? Sus regalos se quedan sin asignar.`)) return;
    try {
      await removePerson(person);
      screen = 'tabs';
      toast('Persona quitada');
      await load();
    } catch (error) {
      toast(error?.message?.includes('otro dispositivo') ? error.message : 'No se pudo quitar la persona');
    }
  }

  /* ==========================================
     VISTA · AGENDA
     ========================================== */

  function occasionMeta(event) {
    const person = event.personId ? findPerson(event.personId) : null;
    if (event.kind === 'birthday') {
      return event.years ? `Cumple ${event.years} años` : 'Cumpleaños';
    }
    return [person?.name, event.years ? `${event.years} años` : ''].filter(Boolean).join(' · ') || 'Fecha importante';
  }

  function agendaView() {
    const wrap = h('div', { class: 'srp-view srp-agenda' });
    const today = todayISO();
    // Solo personas: cumpleaños y fechas propias. Los regalos y sus fechas
    // de entrega se consultan en la pestaña Regalos.
    const events = peopleOccasions({ people, today });

    wrap.innerHTML = `
      <p class="srp-agenda__intro">Cumpleaños y fechas de tus personas, en orden. Los regalos viven en su propia pestaña.</p>
      <div class="srp-agenda__head">
        <div class="srp-seg" role="group" aria-label="Vista de la agenda">
          <button type="button" data-agenda-mode="lista" class="${agendaMode === 'lista' ? 'is-on' : ''}" aria-pressed="${agendaMode === 'lista'}">Agenda</button>
          <button type="button" data-agenda-mode="mes" class="${agendaMode === 'mes' ? 'is-on' : ''}" aria-pressed="${agendaMode === 'mes'}">Mes</button>
        </div>
        ${
          agendaMode === 'mes'
            ? `<div class="srp-month-nav">
                 <button type="button" class="icon-btn" data-agenda-month="-1" aria-label="Mes anterior">${icon('back', 17)}</button>
                 <b>${esc(monthLabel(agendaMonth))}</b>
                 <button type="button" class="icon-btn" data-agenda-month="1" aria-label="Mes siguiente">${icon('chev', 17)}</button>
               </div>`
            : ''
        }
      </div>
      <div id="srpAgendaBody"></div>
    `;

    const body = wrap.querySelector('#srpAgendaBody');

    if (!events.length) {
      body.innerHTML = emptyBlock({
        art: 'agenda-regalos',
        title: 'Sin cumpleaños todavía',
        text: people.length
          ? 'Añade el cumpleaños o una fecha importante a tus personas y aparecerán aquí en orden.'
          : 'Primero añade a alguien en Personas y después su cumpleaños.',
        action: `<button type="button" class="btn" data-tab="personas">${
          people.length ? 'Ir a Personas' : 'Añadir persona'
        }</button>`,
      });
      return wrap;
    }

    if (agendaMode === 'mes') {
      body.innerHTML = calendarHTML(events, agendaMonth, today);
      return wrap;
    }

    let lastMonth = '';
    const html = [];
    for (const event of events) {
      const key = event.date.slice(0, 7);
      if (key !== lastMonth) {
        lastMonth = key;
        html.push(`<div class="srp-section-title"><span>${esc(monthLabel(key))}</span></div>`);
      }
      const days = daysUntil(event.date, today);
      html.push(`
        <button type="button" class="srp-occasion" data-person-open="${esc(event.personId || '')}">
          <span class="srp-occasion__date">
            <b>${esc(event.date.slice(8, 10))}</b>
            <span>${esc(monthShort(event.date))}</span>
          </span>
          <span class="srp-occasion__art">${giftArt(event.art, { size: 34 })}</span>
          <span class="srp-occasion__copy">
            <span class="srp-occasion__title">${esc(event.title)}</span>
            <span class="srp-occasion__meta">${esc(occasionMeta(event))}</span>
          </span>
          <span class="srp-occasion__when${days <= 7 && days >= 0 ? ' is-soon' : ''}">${esc(countdown(event.date, true))}</span>
        </button>
      `);
    }
    body.innerHTML = html.join('');
    return wrap;
  }

  function calendarHTML(events, month, today) {
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const startOffset = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const byDay = new Map();
    for (const event of events) {
      if (!event.date.startsWith(month)) continue;
      const day = Number(event.date.slice(8, 10));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(event);
    }

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push('<span class="srp-cal__pad"></span>');
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${month}-${String(day).padStart(2, '0')}`;
      const dayEvents = byDay.get(day) || [];
      cells.push(`
        <button type="button" class="srp-cal__day${iso === today ? ' is-today' : ''}${dayEvents.length ? ' has-events' : ''}"
          data-cal-day="${iso}" aria-label="${esc(fmtLongDay(iso))}${dayEvents.length ? `, ${dayEvents.length} ocasiones` : ''}">
          <span>${day}</span>
          ${dayEvents.length ? `<span class="srp-cal__dot" aria-hidden="true"></span>` : ''}
        </button>
      `);
    }

    const future = events.filter(event => event.date >= today).slice(0, 5);
    return `
      <div class="srp-cal">
        <div class="srp-cal__weekdays" aria-hidden="true">
          ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => `<span>${day}</span>`).join('')}
        </div>
        <div class="srp-cal__grid">${cells.join('')}</div>
      </div>
      <p class="srp-field-label">Próximas</p>
      <div class="srp-list">
        ${future
          .map(
            event => `<button type="button" class="srp-occasion" data-person-open="${esc(event.personId || '')}">
              <span class="srp-occasion__date"><b>${esc(event.date.slice(8, 10))}</b><span>${esc(monthShort(event.date))}</span></span>
              <span class="srp-occasion__copy">
                <span class="srp-occasion__title">${esc(event.title)}</span>
                <span class="srp-occasion__meta">${esc(occasionMeta(event))}</span>
              </span>
              <span class="srp-occasion__when">${esc(countdown(event.date, true))}</span>
            </button>`,
          )
          .join('')}
      </div>
    `;
  }

  /* ==========================================
     VISTA · PRESUPUESTO Y ESTADÍSTICAS
     ========================================== */

  function budgetView() {
    const wrap = h('div', { class: 'srp-view srp-budget' });
    const budgetValue = Number(settings.monthly_budget) || 0;
    const report = budgetReport({
      gifts: rows,
      people,
      month: budgetMonth,
      budget: budgetValue,
    });
    const maxPerson = Math.max(1, ...report.byPerson.map(entry => entry.total));
    const maxHistory = Math.max(1, ...report.history.map(entry => entry.total));
    const used = report.budget ? Math.min(100, Math.round((report.spent / report.budget) * 100)) : 0;

    wrap.innerHTML = `
      ${subheadHTML('Presupuesto y estadísticas')}
      <div class="srp-budget__range">
        <select id="srpBudgetMonthSel" aria-label="Mes">
          ${Array.from({ length: 12 }, (_, index) => {
            const value = String(index + 1).padStart(2, '0');
            const name = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })
              .format(new Date(`2024-${value}-01T12:00:00Z`));
            return `<option value="${value}"${budgetMonth.slice(5) === value ? ' selected' : ''}>${esc(name)}</option>`;
          }).join('')}
        </select>
        <select id="srpBudgetYearSel" aria-label="Año">
          ${[...new Set([
            String(new Date().getFullYear()),
            budgetMonth.slice(0, 4),
            ...rows.map(gift => String(gift.day || '').slice(0, 4)).filter(Boolean),
          ])]
            .sort()
            .reverse()
            .map(year => `<option value="${esc(year)}"${budgetMonth.slice(0, 4) === year ? ' selected' : ''}>${esc(year)}</option>`)
            .join('')}
        </select>
      </div>

      ${
        caps.settings
          ? `<form class="srp-budget__form" id="srpBudgetForm">
               <label class="srp-field">
                 <span>Presupuesto mensual (opcional)</span>
                 <input type="number" id="srpBudgetInput" min="0" max="100000" step="1" inputmode="decimal" placeholder="Sin límite" value="${budgetValue || ''}">
               </label>
               <button type="submit" class="btn btn--sm">Guardar</button>
             </form>`
          : `<p class="srp-hint">Configura un presupuesto mensual cuando apliques la migración 046.</p>`
      }

      <div class="srp-budget__stats">
        <div class="srp-stat"><b>${esc(fmtEur(report.planned))}</b><span>Previsto ahora</span></div>
        <div class="srp-stat"><b>${esc(fmtEur(report.spent))}</b><span>Gastado real</span></div>
        <div class="srp-stat"><b>${report.budget ? esc(fmtEur(report.available)) : '—'}</b><span>Disponible</span></div>
      </div>
      ${report.budget
        ? `<div class="srp-progress${report.overflow ? ' is-over' : ''}">
             <div class="srp-progress__head"><span>${esc(fmtEur(report.spent))} de ${esc(fmtEur(report.budget))}</span><b>${used}%</b></div>
             <div class="srp-progress__bar"><i style="width:${used}%"></i></div>
             ${report.overflow ? '<p class="srp-warning">Has superado el presupuesto de este mes.</p>' : ''}
           </div>`
        : ''}
      <p class="srp-hint">El importe previsto son los regalos aún sin comprar. El gastado, lo que ya has comprado: una idea nunca cuenta como gasto.</p>

      <section class="srp-detail__block">
        <p class="srp-field-label">Gasto por destinatario</p>
        ${
          report.byPerson.length
            ? report.byPerson
                .map(
                  entry => `
                    <button type="button" class="srp-bar-row"${entry.id ? ` data-person-open="${esc(entry.id)}"` : ' disabled'}>
                      <span class="srp-bar-row__label">${esc(entry.name)}</span>
                      <span class="srp-bar"><i style="width:${Math.round((entry.total / maxPerson) * 100)}%"></i></span>
                      <b>${esc(fmtEur(entry.total))}</b>
                    </button>`,
                )
                .join('')
            : '<p class="srp-hint">Sin compras este mes.</p>'
        }
      </section>

      <section class="srp-detail__block">
        <p class="srp-field-label">Por estado</p>
        ${
          report.byState.length
            ? report.byState
                .map(
                  entry => `
                    <div class="srp-bar-row">
                      <span class="srp-pill is-${entry.tone}">${esc(entry.label)}</span>
                      <span class="srp-bar"><i style="width:${Math.round((entry.count / Math.max(1, report.pendingCount + report.boughtCount)) * 100)}%"></i></span>
                      <b>${entry.count}</b>
                    </div>`,
                )
                .join('')
            : '<p class="srp-hint">No hay regalos con fecha en este mes.</p>'
        }
      </section>

      <section class="srp-detail__block">
        <p class="srp-field-label">Últimos meses</p>
        ${report.history
          .map(
            entry => `
              <div class="srp-bar-row">
                <span class="srp-bar-row__label">${esc(monthShort(entry.month))} ${esc(entry.month.slice(2, 4))}</span>
                <span class="srp-bar"><i style="width:${Math.round((entry.total / maxHistory) * 100)}%"></i></span>
                <b>${esc(fmtEur(entry.total))}</b>
              </div>`,
          )
          .join('')}
      </section>
    `;

    const monthSelect = wrap.querySelector('#srpBudgetMonthSel');
    const yearSelect = wrap.querySelector('#srpBudgetYearSel');
    const syncBudgetMonth = () => {
      budgetMonth = `${yearSelect.value}-${monthSelect.value}`;
      draw();
    };
    monthSelect?.addEventListener('change', syncBudgetMonth);
    yearSelect?.addEventListener('change', syncBudgetMonth);

    wrap.querySelector('#srpBudgetForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const input = wrap.querySelector('#srpBudgetInput');
      try {
        const saved = await saveMonthlyBudget(input.value);
        settings.monthly_budget = saved;
        toast(saved ? 'Presupuesto guardado' : 'Presupuesto quitado');
        draw();
      } catch (error) {
        toast(error?.message || 'No se pudo guardar el presupuesto');
      }
    });

    return wrap;
  }

  /* ==========================================
     VISTA · ARCHIVO Y PAPELERA
     ========================================== */

  function archiveView() {
    const wrap = h('div', { class: 'srp-view srp-archive' });
    const archived = rows.filter(gift => isLive(gift) && gift.archived_at);
    const trashed = rows.filter(gift => !!gift.removed_at);
    const items = archiveMode === 'archivados' ? archived : trashed;

    wrap.innerHTML = `
      ${subheadHTML('Archivo y papelera')}
      <div class="srp-seg" role="group" aria-label="Archivo o papelera">
        <button type="button" data-archive-mode="archivados" class="${archiveMode === 'archivados' ? 'is-on' : ''}" aria-pressed="${archiveMode === 'archivados'}">Archivados · ${archived.length}</button>
        <button type="button" data-archive-mode="papelera" class="${archiveMode === 'papelera' ? 'is-on' : ''}" aria-pressed="${archiveMode === 'papelera'}">Papelera · ${trashed.length}</button>
      </div>
      <p class="srp-hint">${
        archiveMode === 'archivados'
          ? 'Los regalos archivados no aparecen en la lista diaria. Puedes desarchivarlos cuando quieras.'
          : 'La papelera conserva los regalos 30 días. También puedes eliminarlos definitivamente.'
      }</p>
      <div class="srp-list">
        ${
          items.length
            ? items
                .map(
                  gift => `
                    <article class="srp-gift is-${statusOf(gift).tone}">
                      <button type="button" class="srp-gift__open" data-gift-open="${esc(gift.id)}" aria-label="Abrir ${esc(gift.title)}">
                        <span class="srp-gift__art${caps.gift && gift.photo ? ' has-photo' : ''}">
                          ${
                            caps.gift && gift.photo
                              ? `<img src="${safeUrl(gift.photo)}" alt="" loading="lazy">`
                              : giftArt(statusOf(gift).art, { size: 48 })
                          }
                        </span>
                        <span class="srp-gift__copy">
                          <span class="srp-gift__title"><span>${esc(gift.title)}</span></span>
                          <span class="srp-gift__sub">${esc(personOf(gift)?.name || 'Sin asignar')}${gift.day ? ` · ${esc(fmtDay(gift.day))}` : ''}</span>
                        </span>
                      </button>
                      <span class="srp-archive__actions">
                        ${
                          archiveMode === 'archivados'
                            ? `<button type="button" class="btn btn-soft btn--sm" data-unarchive-gift="${esc(gift.id)}">Desarchivar</button>`
                            : `<button type="button" class="btn btn-soft btn--sm" data-restore-gift="${esc(gift.id)}">Recuperar</button>
                               <button type="button" class="btn btn-danger btn--sm" data-purge-gift="${esc(gift.id)}">Eliminar</button>`
                        }
                      </span>
                    </article>`,
                )
                .join('')
            : emptyBlock({
                art: 'regalos-vacios',
                title: archiveMode === 'archivados' ? 'No hay regalos archivados' : 'La papelera está vacía',
                text:
                  archiveMode === 'archivados'
                    ? 'Archiva un regalo desde su menú para guardarlo fuera de la lista.'
                    : 'Los regalos que elimines se guardan aquí durante 30 días.',
              })
        }
      </div>
    `;
    return wrap;
  }

  /* ==========================================
     ACCIONES
     ========================================== */

  async function toggleArchive(gift) {
    try {
      await writeEntry(
        'surprise',
        { archived_at: gift.archived_at ? null : new Date().toISOString() },
        gift,
      );
      closeSheets();
      toast(gift.archived_at ? 'Regalo desarchivado' : 'Regalo archivado');
      await load();
    } catch {
      toast('No se pudo archivar el regalo');
    }
  }

  async function restoreGift(gift) {
    try {
      await writeEntry('surprise', { removed_at: null }, gift);
      closeSheets();
      toast('Regalo recuperado');
      await load();
    } catch {
      toast('No se pudo recuperar. Actualiza la página.');
    }
  }

  async function trashGift(gift) {
    try {
      await writeEntry('surprise', { removed_at: new Date().toISOString() }, gift);
      closeSheets();
      toast('Regalo en la papelera', {
        label: 'Deshacer',
        fn: () => {
          const row = findGift(gift.id);
          if (row) void restoreGift(row);
        },
      });
      await load();
    } catch {
      toast('No se pudo enviar a la papelera');
    }
  }

  async function purgeGift(gift) {
    if (!window.confirm(`¿Eliminar «${gift.title}» definitivamente? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteEntryForever('surprise', gift.id);
      closeSheets();
      screen = 'tabs';
      toast('Regalo eliminado definitivamente');
      await load();
    } catch {
      toast('No se pudo eliminar el regalo');
    }
  }

  async function duplicateGift(gift) {
    try {
      await writeEntry(
        'surprise',
        {
          title: `${gift.title} (copia)`.slice(0, 140),
          detail: gift.detail,
          day: gift.day,
          state: 'pendiente',
          ...(caps.personColumn && { person_id: gift.person_id }),
          ...(caps.gift && { price: gift.price, link: gift.link, photo: gift.photo }),
          ...(caps.extras && { starred: false }),
          ...(caps.organizer && {
            occasion: gift.occasion,
            store: gift.store,
            actual_price: null,
            priority: gift.priority,
            extra_links: gift.extra_links,
            notes: gift.notes,
          }),
        },
        null,
      );
      closeSheets();
      toast('Copia creada');
      await load();
    } catch {
      toast('No se pudo duplicar');
    }
  }

  function moreMenu() {
    openSheet('Más opciones', () =>
      h(
        'div',
        { class: 'srp-sheet-menu' },
        h('button', {
          type: 'button',
          class: 'srp-sheet-menu__item',
          html: `${icon('chart', 17)} Presupuesto y estadísticas`,
          onclick: () => {
            closeSheets();
            budgetMonth = todayISO().slice(0, 7);
            go('budget');
          },
        }),
        h('button', {
          type: 'button',
          class: 'srp-sheet-menu__item',
          html: `${icon('archive', 17)} Archivo`,
          onclick: () => {
            closeSheets();
            archiveMode = 'archivados';
            go('archive');
          },
        }),
        h('button', {
          type: 'button',
          class: 'srp-sheet-menu__item',
          html: `${icon('trash', 17)} Papelera`,
          onclick: () => {
            closeSheets();
            archiveMode = 'papelera';
            go('archive');
          },
        }),
        h(
          'p',
          { class: 'srp-hint srp-sheet-menu__note' },
          'Todo lo que guardas aquí es privado: solo tu cuenta puede verlo.',
        ),
      ),
    );
  }

  /* ==========================================
     EVENTOS
     ========================================== */

  page.addEventListener('click', event => {
    const target = event.target;

    if (target.closest('[data-back]')) {
      router.navigate('/sentimientos');
      return;
    }
    if (target.closest('[data-screen-back]')) {
      backToTabs();
      return;
    }
    if (target.closest('[data-more]')) {
      moreMenu();
      return;
    }
    if (target.closest('[data-summary]')) {
      budgetMonth = todayISO().slice(0, 7);
      go('budget');
      return;
    }

    const tabButton = target.closest('[data-tab]');
    if (tabButton) {
      tab = tabButton.dataset.tab;
      screen = 'tabs';
      syncTabs();
      draw();
      return;
    }

    if (target.closest('[data-new-gift]')) {
      giftEditor();
      return;
    }
    const newForPerson = target.closest('[data-new-gift-for]');
    if (newForPerson) {
      giftEditor(null, { personId: newForPerson.dataset.newGiftFor });
      return;
    }
    if (target.closest('[data-person-new]')) {
      personEditor();
      return;
    }
    if (target.closest('[data-filters]')) {
      filtersSheet();
      return;
    }
    if (target.closest('[data-clear-filters]')) {
      clearFilters();
      return;
    }
    if (target.closest('[data-close-sheet]')) {
      closeSheets();
      return;
    }

    const giftMenu = target.closest('[data-gift-menu]');
    if (giftMenu) {
      const gift = findGift(giftMenu.dataset.giftMenu);
      if (gift) giftMenuSheet(gift);
      return;
    }
    const giftOpen = target.closest('[data-gift-open]');
    if (giftOpen) {
      go('gift', giftOpen.dataset.giftOpen);
      return;
    }
    const editGift = target.closest('[data-edit-gift]');
    if (editGift) {
      const gift = findGift(editGift.dataset.editGift);
      if (gift) giftEditor(gift);
      return;
    }
    const setStatusButton = target.closest('[data-set-status]');
    if (setStatusButton) {
      const gift = findGift(currentGiftId);
      if (gift) void updateStatus(gift, setStatusButton.dataset.setStatus);
      return;
    }
    const trashButton = target.closest('[data-trash-gift]');
    if (trashButton) {
      const gift = findGift(trashButton.dataset.trashGift);
      if (gift) void trashGift(gift);
      return;
    }
    const archiveButton = target.closest('[data-archive-gift]');
    if (archiveButton) {
      const gift = findGift(archiveButton.dataset.archiveGift);
      if (gift) void toggleArchive(gift);
      return;
    }
    const unarchiveButton = target.closest('[data-unarchive-gift]');
    if (unarchiveButton) {
      const gift = findGift(unarchiveButton.dataset.unarchiveGift);
      if (gift) void toggleArchive(gift);
      return;
    }
    const restoreButton = target.closest('[data-restore-gift]');
    if (restoreButton) {
      const gift = findGift(restoreButton.dataset.restoreGift);
      if (gift) void restoreGift(gift);
      return;
    }
    const purgeButton = target.closest('[data-purge-gift]');
    if (purgeButton) {
      const gift = findGift(purgeButton.dataset.purgeGift);
      if (gift) void purgeGift(gift);
      return;
    }

    const personOpen = target.closest('[data-person-open]');
    if (personOpen) {
      go('person', personOpen.dataset.personOpen);
      return;
    }
    const personEdit = target.closest('[data-person-edit]');
    if (personEdit) {
      const person = findPerson(personEdit.dataset.personEdit);
      if (person) personEditor(person);
      return;
    }
    const personMenu = target.closest('[data-person-menu]');
    if (personMenu) {
      const person = findPerson(personMenu.dataset.personMenu);
      if (person) personMenuSheet(person);
      return;
    }

    const agendaModeButton = target.closest('[data-agenda-mode]');
    if (agendaModeButton) {
      agendaMode = agendaModeButton.dataset.agendaMode;
      draw();
      return;
    }
    const agendaMonthButton = target.closest('[data-agenda-month]');
    if (agendaMonthButton) {
      agendaMonth = shiftMonth(agendaMonth, Number(agendaMonthButton.dataset.agendaMonth));
      draw();
      return;
    }
    const calendarDay = target.closest('[data-cal-day]');
    if (calendarDay) {
      const iso = calendarDay.dataset.calDay;
      const events = peopleOccasions({ people, today: todayISO() }).filter(
        item => item.date === iso,
      );
      if (!events.length) {
        openSheet(fmtLongDay(iso), () =>
          h(
            'div',
            null,
            h('p', { class: 'srp-hint' }, 'No hay ningún cumpleaños ni fecha importante este día.'),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-block',
                onclick: () => {
                  closeSheets();
                  tab = 'personas';
                  screen = 'tabs';
                  draw();
                },
              },
              'Ir a Personas',
            ),
          ),
        );
      } else if (events.length === 1) {
        go('person', events[0].personId);
      } else {
        openSheet(
          fmtLongDay(iso),
          () =>
            h(
              'div',
              { class: 'srp-list' },
              ...events.map(event =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'srp-occasion',
                    onclick: () => {
                      closeSheets();
                      go('person', event.personId);
                    },
                  },
                  h(
                    'span',
                    { class: 'srp-occasion__copy' },
                    h('span', { class: 'srp-occasion__title' }, event.title),
                    h('span', { class: 'srp-occasion__meta' }, occasionMeta(event)),
                  ),
                ),
              ),
            ),
        );
      }
      return;
    }

    const archiveModeButton = target.closest('[data-archive-mode]');
    if (archiveModeButton) {
      archiveMode = archiveModeButton.dataset.archiveMode;
      draw();
      return;
    }
    const budgetStep = target.closest('[data-budget-month]');
    if (budgetStep) {
      budgetMonth = shiftMonth(budgetMonth, Number(budgetStep.dataset.budgetMonth));
      draw();
    }
  });

  /* ==========================================
     ARRANQUE
     ========================================== */

  bodyEl.innerHTML = skeletonCardsHTML({ count: 4 });
  void load();

  page.cleanup = () => {
    active = false;
    closeSheets();
  };

  return page;
}
