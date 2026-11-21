/* ==========================================
   Mis sorpresas — tus ideas y regalos pendientes

   La sección de regalos de DailyHub y nada más: personas con foto y
   cumpleaños, tarjetas wishlist con presupuesto y enlace, estados de
   compra (Idea · Por comprar · Comprado · Entregado), favorita, agenda
   con cuenta atrás y estadísticas de gasto. Sin hábitos, sin Modo Clase
   y sin repeticiones de calendario.

   La privacidad no vive aquí: cada sorpresa solo la devuelve la
   política de lectura de `tamp_entries` (kind='surprise' y
   author_id = auth.uid()). Esta pantalla no la sustituye.
   ========================================== */

import '../styles/sorpresas.css';
import {
  entries,
  writeEntry,
  supportsGiftFields,
  supportsGiftExtras,
  supportsGiftStates,
} from '../services/agenda.js';
import {
  supportsPeople,
  supportsPersonColumn,
  listPeople,
  savePerson,
  removePerson,
} from '../services/people.js';
import { escapeHtml as esc, safeUrl } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import {
  offeredGiftStates,
  giftStateMeta,
  storableGiftState,
} from '../utils/gift-states.js';
import { h, icon, openSheet, closeSheets, toast } from '../components/ui.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { emptyStateHTML, skeletonCardsHTML } from '../components/states.js';

const DAY = 86400000;

const NEW_ACTION = { label: 'Nueva sorpresa', id: 'srpNew' };

const parseDay = iso => Date.parse(`${iso}T12:00:00Z`);

/** Días que faltan (negativo si ya pasó), contando con la fecha de España. */
function daysUntil(iso) {
  return Math.round((parseDay(iso) - parseDay(todayISO())) / DAY);
}

/** 12 dic */
function fmtDay(iso) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace('.', '');
}

function monthLabel(key) {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${key}-01T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cuenta atrás larga («En 12 días») o corta para listas («12 días»). */
function countdown(iso, short = false) {
  const days = daysUntil(iso);
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

const eurFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const fmtEur = value => eurFormat.format(Number(value) || 0);

/**
 * Foto: se recorta a 640 px y se guarda como data URL JPEG. Viaja dentro de
 * la fila, no a un bucket, para que la RLS de 034 siga siendo la única
 * puerta: una imagen en un bucket compartido la vería la pareja.
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

/* Cumpleaños: la próxima vez que cae esa fecha, este año o el que viene. */
function nextBirthday(ymd, from = todayISO()) {
  if (!ymd || ymd.length < 10) return null;
  const mmdd = ymd.slice(5);
  const year = Number(from.slice(0, 4));
  const candidate = `${year}-${mmdd}`;
  return candidate < from ? `${year + 1}-${mmdd}` : candidate;
}

/** «Faltan 12 días para el cumple de Sofía 🎂», como en la ficha de DailyHub. */
function birthdayLine(person) {
  const next = nextBirthday(person?.birthday);
  if (!next) return '';
  const days = daysUntil(next);
  const name = person.name.split(' ')[0];
  if (days === 0) return `¡Hoy es el cumple de ${name}! 🎂`;
  if (days === 1) return `Falta 1 día para el cumple de ${name} 🎂`;
  return `Faltan ${days} días para el cumple de ${name} 🎂`;
}

export function SorpresasPage() {
  const page = document.createElement('div');

  let rows = [];
  let people = [];
  let peopleReady = false;
  let personColumn = false;
  let view = 'regalos';
  // Como en DailyHub, la primera carga abre en Personas cuando ya hay
  // personas: el cumpleaños de todos se ve de un vistazo. Después manda la
  // pestaña que elija el usuario.
  let viewChosen = false;
  let filter = 'activos';
  let personFilter = 'todas';
  let sort = 'fecha';
  let query = '';
  let active = true;
  // Presupuesto, enlace y foto solo existen con la 035 aplicada.
  let giftsSupported = false;
  // Favorita y estados de compra solo existen con la 037 aplicada.
  let extrasSupported = false;
  // «Por comprar» y «Comprado» solo se ofrecen si el CHECK los acepta (039).
  let statesSupported = false;

  const stateCaps = () => ({ starred: extrasSupported, states: statesSupported });
  const statuses = () =>
    Object.fromEntries(offeredGiftStates(stateCaps()).map(state => [state, giftStateMeta(state)]));
  // Para pintar filas guardadas se entiende cualquier estado, se ofrezca o no.
  const statusOf = row => giftStateMeta(row.state);

  const personOf = row =>
    personColumn && row.person_id ? people.find(person => person.id === row.person_id) : null;

  const live = () => rows.filter(row => !row.removed_at);
  const trashed = () => rows.filter(row => !!row.removed_at);
  const findRow = id => rows.find(row => row.id === id);
  const isDone = row => row.state === 'entregado';

  function avatarHTML(person, size = 44) {
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`;
    const photo = person?.photo ? safeUrl(person.photo) : '';
    if (photo) {
      return `<span class="srp-avatar" style="${style}"><img src="${photo}" alt=""></span>`;
    }
    const initial = (person?.name || '').trim().charAt(0).toUpperCase();
    const content = initial || icon('user', Math.round(size * 0.45));
    return `<span class="srp-avatar" style="${style}" aria-hidden="true">${initial ? esc(initial) : content}</span>`;
  }

  /** Cumpleaños de todos, del más próximo al más lejano. */
  function birthdays() {
    return people
      .filter(person => person.birthday)
      .map(person => ({ person, day: nextBirthday(person.birthday) }))
      .filter(item => item.day)
      .sort((first, second) => first.day.localeCompare(second.day));
  }

  /** Estado guardable: cae a Idea/Preparado cuando el CHECK no acepta los nuevos. */
  const storableState = state => storableGiftState(state, stateCaps());

  const isBought = row => row.state === 'comprado' || row.state === 'preparado';
  const weightOf = row => (isDone(row) ? 2 : isBought(row) ? 1 : 0);

  function compareRows(first, second) {
    if (sort === 'precio') return (Number(second.price) || 0) - (Number(first.price) || 0);
    return (
      weightOf(first) - weightOf(second) ||
      first.day.localeCompare(second.day) ||
      first.title.localeCompare(second.title, 'es')
    );
  }

  const giftsOf = personId => live().filter(row => row.person_id === personId);

  page.innerHTML = `
    ${renderPageHeader({
      title: 'Mis sorpresas',
      subtitle: 'Tus ideas y regalos, solo para ti',
      actions: `
        <button type="button" class="icon-btn" id="srpAgendaBtn" aria-label="Agenda de sorpresas" title="Agenda">${icon('cake', 19)}</button>
        <button type="button" class="icon-btn" id="srpStatsBtn" aria-label="Estadísticas de sorpresas" title="Estadísticas">${icon('chart', 19)}</button>
        <button type="button" class="icon-btn" id="srpTrashBtn" aria-label="Papelera" title="Papelera">${icon('archive', 19)}</button>
        <button type="button" class="btn btn--sm" id="srpNewBtn">${icon('plus', 15)} <span>Nueva</span></button>
      `,
    })}
    <div class="seg srp-seg" role="group" aria-label="Vistas de Mis sorpresas">
      <button type="button" data-view="regalos" aria-pressed="true" class="is-on">Sorpresas</button>
      <button type="button" data-view="personas" id="srpPeopleTab" aria-pressed="false" hidden>Personas</button>
      <button type="button" data-view="agenda" aria-pressed="false">Agenda</button>
      <button type="button" data-view="resumen" aria-pressed="false">Resumen</button>
    </div>
    <div id="srpView"></div>
  `;

  const viewEl = page.querySelector('#srpView');

  /** Estado vacío de una vista, con su acción enganchada cuando la lleva. */
  function showEmpty(container, options) {
    container.innerHTML = emptyStateHTML(options);
    container.querySelector(`#${NEW_ACTION.id}`)?.addEventListener('click', () => editor());
  }

  /* ==========================================
     VISTA · SORPRESAS (todos los regalos)
     ========================================== */

  const upcomingList = () =>
    live()
      .filter(row => !isDone(row))
      .sort((first, second) => first.day.localeCompare(second.day));

  const linkDomain = value => {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  function cardHTML(row) {
    const meta = statusOf(row);
    const photo = giftsSupported ? safeUrl(row.photo) : '';
    const price = giftsSupported && row.price != null ? fmtEur(row.price) : '';
    const link = giftsSupported ? safeUrl(row.link) : '';
    const starred = extrasSupported && row.starred;
    const person = personOf(row);
    const when = row.removed_at
      ? `${fmtDay(row.day)} · en la papelera`
      : `${fmtDay(row.day)} · ${countdown(row.day)}`;
    const who = `${person ? person.name : 'Sin asignar'} · ${when}`;
    const art = photo
      ? `<span class="srp-art has-photo"><img src="${photo}" alt=""></span>`
      : `<span class="srp-art"><span class="srp-art__emoji" aria-hidden="true">🎁</span></span>`;
    const copy = `
      ${art}
      <span class="srp-card__copy">
        <span class="srp-card__title">${
          starred && !row.removed_at
            ? `<span class="srp-card__star" aria-label="Favorita" title="Favorita">${icon('star', 13)}</span>`
            : ''
        }<span>${esc(row.title)}</span></span>
        <span class="srp-card__who">${esc(who)}</span>
      </span>
    `;

    const foot = row.removed_at
      ? `<button type="button" class="btn btn-soft btn--sm" data-restore="${esc(row.id)}">Recuperar</button>`
      : `<button type="button" class="srp-status is-${meta.tone}" data-status="${esc(row.id)}" aria-label="Estado: ${esc(meta.label)}. Cambiar de estado">
           <span aria-hidden="true">${meta.emoji}</span>${esc(meta.label)}
         </button>
         ${
           giftsSupported
             ? `<span class="srp-price${price ? '' : ' is-none'}">${price || 'Sin presupuesto'}</span>`
             : ''
         }
         ${
           link
             ? `<a class="srp-link-btn" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Comprar o ver el enlace de ${esc(row.title)} en ${esc(linkDomain(link))}">${icon('external', 14)}<span>Comprar / Ver enlace</span></a>`
             : ''
         }`;

    return `
      <article class="srp-card" data-gift-id="${esc(row.id)}">
        ${
          row.removed_at
            ? `<div class="srp-card__body">${copy}</div>`
            : `<button type="button" class="srp-card__body" data-open="${esc(row.id)}" aria-label="Abrir la sorpresa ${esc(row.title)}">${copy}</button>`
        }
        <div class="srp-card__foot">${foot}</div>
      </article>
    `;
  }

  function regalosView() {
    const wrap = h('div');

    if (!rows.length) {
      showEmpty(wrap, {
        icon: 'gift',
        title: 'Aún no tienes sorpresas',
        text: 'Crea tu primera idea de regalo y asígnala a una persona.',
        action: NEW_ACTION,
      });
      return wrap;
    }

    const search = h('input', {
      class: 'srp-search',
      type: 'search',
      placeholder: 'Buscar sorpresa…',
      'aria-label': 'Buscar sorpresa',
      autocomplete: 'off',
      value: query,
    });
    search.addEventListener('input', () => {
      query = search.value;
      drawCards();
    });
    const sortButton = h('button', {
      type: 'button',
      class: 'icon-btn srp-sort',
      'aria-label': 'Cambiar orden',
      title: sort === 'fecha' ? 'Ordenado por fecha' : 'Ordenado por precio',
      onclick: () => {
        sort = sort === 'fecha' ? 'precio' : 'fecha';
        sortButton.title = sort === 'fecha' ? 'Ordenado por fecha' : 'Ordenado por precio';
        sortButton.innerHTML = icon(sort === 'fecha' ? 'calendar' : 'external', 18);
        drawCards();
      },
      html: icon(sort === 'fecha' ? 'calendar' : 'external', 18),
    });
    wrap.append(h('div', { class: 'srp-toolbar' }, search, sortButton));

    if (peopleReady && people.length) {
      const personChips = h('div', {
        class: 'chips srp-chips',
        role: 'group',
        'aria-label': 'Filtrar por persona',
      });
      const drawPersonChips = () => {
        const chips = [{ id: 'todas', label: 'Todos' }].concat(
          people.map(person => ({ id: person.id, label: person.name }))
        );
        personChips.innerHTML = chips
          .map(
            chip => `<button type="button" class="chip${personFilter === chip.id ? ' is-active' : ''}"
              aria-pressed="${personFilter === chip.id}" data-person-filter="${esc(chip.id)}">${esc(chip.label)}</button>`
          )
          .join('');
      };
      personChips.addEventListener('click', event => {
        const chip = event.target.closest('[data-person-filter]');
        if (!chip) return;
        personFilter = chip.dataset.personFilter;
        drawPersonChips();
        drawCards();
      });
      drawPersonChips();
      wrap.append(personChips);
    }

    const statusChips = h('div', {
      class: 'chips srp-chips',
      role: 'group',
      'aria-label': 'Filtrar por estado',
    });
    const drawStatusChips = () => {
      const chips = [
        { id: 'activos', label: 'Activos' },
        { id: 'archivo', label: 'Archivo' },
      ]
        .concat(
          Object.entries(statuses())
            .filter(([value]) => value !== 'entregado')
            .map(([value, meta]) => ({ id: value, label: meta.label }))
        )
        .concat([{ id: 'papelera', label: 'Papelera' }]);
      statusChips.innerHTML = chips
        .map(
          chip => `<button type="button" class="chip${filter === chip.id ? ' is-active' : ''}"
            aria-pressed="${filter === chip.id}" data-filter="${esc(chip.id)}">${esc(chip.label)}</button>`
        )
        .join('');
    };
    statusChips.addEventListener('click', event => {
      const chip = event.target.closest('[data-filter]');
      if (!chip) return;
      filter = chip.dataset.filter;
      drawStatusChips();
      drawCards();
    });
    drawStatusChips();
    wrap.append(statusChips);

    const count = h('p', { class: 'srp-total' });
    wrap.append(count);

    const grid = h('div', { class: 'srp-grid' });
    wrap.append(grid);

    function drawCards() {
      const base = filter === 'papelera' ? trashed() : live();
      const needle = query.trim().toLowerCase();
      const items = base
        .filter(row => {
          if (filter === 'activos') return !isDone(row);
          if (filter === 'archivo') return isDone(row);
          if (filter !== 'papelera') return row.state === filter;
          return true;
        })
        .filter(row => personFilter === 'todas' || row.person_id === personFilter)
        .filter(row => {
          if (!needle) return true;
          const person = personOf(row);
          return `${row.title} ${row.detail || ''} ${person ? person.name : ''}`
            .toLowerCase()
            .includes(needle);
        })
        .sort(compareRows);

      count.textContent = items.length
        ? `${items.length} ${items.length === 1 ? 'sorpresa' : 'sorpresas'}${
            giftsSupported
              ? ` · ${fmtEur(items.reduce((sum, row) => sum + (Number(row.price) || 0), 0))}`
              : ''
          }`
        : '';

      if (!items.length) {
        const filteredView =
          needle ||
          personFilter !== 'todas' ||
          (filter !== 'activos' && filter !== 'papelera');
        if (needle || filteredView)
          showEmpty(grid, {
            icon: 'search',
            title: 'Sin resultados',
            text: 'Prueba con otro filtro o busca por otro nombre.',
          });
        else if (filter === 'papelera')
          showEmpty(grid, {
            icon: 'archive',
            title: 'Papelera vacía',
            text: 'Las sorpresas que elimines se guardan 30 días.',
          });
        else if (filter === 'archivo')
          showEmpty(grid, {
            icon: 'archive',
            title: 'Archivo vacío',
            text: 'Las sorpresas entregadas se guardarán aquí, fuera de la lista diaria.',
          });
        else
          showEmpty(grid, {
            icon: 'gift',
            title: 'Aún no tienes sorpresas',
            text: 'Crea tu primera idea de regalo y asígnala a una persona.',
            action: NEW_ACTION,
          });
        return;
      }

      grid.innerHTML = items.map(cardHTML).join('');
    }

    drawCards();
    return wrap;
  }

  /* ==========================================
     VISTA · PERSONAS
     ========================================== */

  function birthdayPanelHTML() {
    const list = birthdays();
    if (!list.length) return '';
    return `
      <section class="srp-panel srp-bdays">
        <div class="srp-panel__head">
          <b>Cumpleaños</b>
          <span>De todos</span>
        </div>
        ${list
          .map(({ person, day }) => {
            const days = daysUntil(day);
            return `
              <button type="button" class="srp-bday" data-person="${esc(person.id)}">
                ${avatarHTML(person, 36)}
                <span class="srp-bday__copy">
                  <b>${esc(person.name)}</b>
                  <span>Cumple el ${esc(fmtDay(day))}</span>
                </span>
                <span class="srp-count${days <= 7 ? ' is-soon' : ''}">${countdown(day, true)}</span>
              </button>`;
          })
          .join('')}
      </section>
    `;
  }

  function personasView() {
    const wrap = h('div');

    if (!people.length) {
      showEmpty(wrap, {
        icon: 'user',
        title: 'Aún no hay personas',
        text: 'Añade a quién le regalas, con su foto y su cumpleaños, y asigna cada sorpresa.',
        action: { label: 'Añadir persona', id: 'srpNewPerson' },
      });
      wrap.querySelector('#srpNewPerson')?.addEventListener('click', () => personEditor());
      return wrap;
    }

    const bdays = birthdayPanelHTML();
    if (bdays) wrap.insertAdjacentHTML('beforeend', bdays);

    const grid = h('div', { class: 'srp-people' });
    grid.innerHTML = people
      .map(person => {
        const count = giftsOf(person.id).length;
        const next = person.birthday ? nextBirthday(person.birthday) : null;
        return `
          <button type="button" class="srp-person" data-person="${esc(person.id)}">
            ${avatarHTML(person, 54)}
            <b>${esc(person.name)}</b>
            <span>${count} ${count === 1 ? 'sorpresa' : 'sorpresas'}</span>
            <span class="srp-person__bday">${
              next ? `Cumple el ${esc(fmtDay(next))}` : 'Sin cumpleaños'
            }</span>
            ${next ? `<span class="srp-person__count">${esc(countdown(next, true))}</span>` : ''}
          </button>`;
      })
      .join('');
    grid.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="srp-person is-add" data-person-new>${icon('plus', 22)}<b>Añadir persona</b></button>`
    );
    wrap.append(grid);

    const upcoming = upcomingList().slice(0, 6);
    const heading = h('div', { class: 'section-title' });
    heading.append(h('span', null, 'Próximos regalos'));
    const seeAll = h('button', { type: 'button', class: 'link' }, 'Ver todos');
    seeAll.addEventListener('click', () => {
      view = 'regalos';
      filter = 'activos';
      syncSeg();
      render();
    });
    heading.append(seeAll);
    wrap.append(heading);

    if (!upcoming.length) {
      wrap.insertAdjacentHTML(
        'beforeend',
        emptyStateHTML({
          icon: 'gift',
          title: 'Sin ideas todavía',
          text: 'Añade tu primera idea y asígnala a una persona.',
          action: NEW_ACTION,
        })
      );
      wrap.querySelector('#srpNew')?.addEventListener('click', () => editor());
    } else {
      const giftGrid = h('div', { class: 'srp-grid' });
      giftGrid.innerHTML = upcoming.map(cardHTML).join('');
      wrap.append(giftGrid);
    }

    return wrap;
  }

  function personSheet(person) {
    const theirs = giftsOf(person.id).sort(compareRows);
    const next = person.birthday ? nextBirthday(person.birthday) : null;
    const line = birthdayLine(person);
    const pending = theirs.filter(row => !isDone(row) && !isBought(row));
    const bought = theirs.filter(row => isBought(row) && !isDone(row));
    const delivered = theirs.filter(isDone);
    const planned = pending.reduce((sum, row) => sum + (Number(row.price) || 0), 0);
    const spent = bought
      .concat(delivered)
      .reduce((sum, row) => sum + (Number(row.price) || 0), 0);
    const groups = [
      ['Pendientes', pending],
      ['Compradas', bought],
      ['Entregadas', delivered],
    ];

    openSheet(person.name, () =>
      h(
        'div',
        null,
        h(
          'div',
          { class: 'srp-person-head' },
          h('span', { html: avatarHTML(person, 72) }),
          h(
            'div',
            { class: 'srp-person-head__copy' },
            h(
              'b',
              null,
              next ? `${fmtDay(next)} · ${countdown(next)}` : 'Sin cumpleaños'
            ),
            h(
              'span',
              null,
              `${theirs.length} ${theirs.length === 1 ? 'sorpresa' : 'sorpresas'}`
            )
          )
        ),
        line ? h('p', { class: 'srp-bday-card' }, line) : null,
        person.notes ? h('p', { class: 'srp-note' }, person.notes) : null,
        theirs.length && giftsSupported
          ? h(
              'div',
              { class: 'srp-person-stats' },
              h(
                'div',
                null,
                h('b', null, fmtEur(planned)),
                h('span', null, `planificado · ${pending.length} ${pending.length === 1 ? 'sorpresa' : 'sorpresas'}`)
              ),
              h('div', { class: 'srp-person-stats__sep' }),
              h(
                'div',
                null,
                h('b', null, fmtEur(spent)),
                h('span', null, 'gastado en total')
              )
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-block',
            onclick: () => {
              closeSheets();
              editor(null, person.id);
            },
          },
          `Añadir regalo para ${person.name.split(' ')[0]}`
        ),
        ...groups
          .filter(([, items]) => items.length)
          .flatMap(([label, items]) => [
            h('div', { class: 'section-title' }, h('span', null, `${label} · ${items.length}`)),
            h(
              'div',
              { class: 'srp-person-list' },
              items.map(row =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'srp-person-item',
                    onclick: () => {
                      closeSheets();
                      editor(row);
                    },
                  },
                  h(
                    'span',
                    { class: 'srp-person-item__copy' },
                    h('b', null, row.title),
                    h(
                      'span',
                      null,
                      `${fmtDay(row.day)} · ${statusOf(row).label}${
                        giftsSupported && Number(row.price) ? ` · ${fmtEur(row.price)}` : ''
                      }`
                    )
                  ),
                  h('span', { class: 'ic', html: icon('chev', 15) })
                )
              )
            ),
          ]),
        h(
          'div',
          { class: 'srp-sheet-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-soft btn-block',
              onclick: () => {
                closeSheets();
                personEditor(person);
              },
            },
            'Editar persona'
          ),
          h(
            'button',
            { type: 'button', class: 'btn btn-danger btn-block', onclick: () => deletePerson(person) },
            'Quitar persona'
          )
        )
      )
    );
  }

  async function deletePerson(person) {
    if (!confirm(`¿Quitar a ${person.name}? Sus sorpresas se quedan sin asignar.`)) return;
    try {
      await removePerson(person);
      closeSheets();
      toast('Persona quitada');
      await load();
    } catch (error) {
      toast(
        error?.message?.includes('otro dispositivo') ? error.message : 'No se pudo quitar la persona'
      );
    }
  }

  function personEditor(person = null) {
    openSheet(person ? 'Editar persona' : 'Nueva persona', () => {
      // `novalidate`: los avisos los pinta la propia hoja (role="alert");
      // si el navegador bloquea el submit por `required`, no se ve ninguno.
      const form = h('form', { class: 'srp-form', novalidate: true });
      let photoValue = person?.photo || '';

      const preview = h('button', { type: 'button', class: 'srp-person-photo' });
      const pick = h('button', { type: 'button', class: 'btn btn-soft btn--sm' });
      const clear = h('button', { type: 'button', class: 'btn btn-soft btn--sm' }, 'Quitar foto');
      const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });

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
      const notes = h('textarea', {
        name: 'notes',
        maxlength: '2000',
        placeholder: 'Gustos, tallas, ideas que le gustan…',
      });
      notes.value = person?.notes || '';

      const drawPhoto = () => {
        const personLike = { name: name.value.trim() || person?.name || '', photo: photoValue };
        preview.innerHTML = avatarHTML(personLike, 88);
        if (!photoValue) {
          preview.insertAdjacentHTML(
            'beforeend',
            `<span class="srp-person-photo__flag" aria-hidden="true">${icon('plus', 13)}</span>`
          );
        }
        pick.textContent = photoValue ? 'Cambiar foto' : 'Añadir foto';
        clear.hidden = !photoValue;
      };
      name.addEventListener('input', drawPhoto);
      preview.addEventListener('click', () => fileInput.click());
      pick.addEventListener('click', () => fileInput.click());
      clear.addEventListener('click', () => {
        photoValue = '';
        drawPhoto();
      });
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

      const error = h('p', { class: 'srp-error', role: 'alert' });
      const submit = h(
        'button',
        { type: 'submit', class: 'btn btn-block' },
        person ? 'Guardar cambios' : 'Guardar persona'
      );
      const cancel = h(
        'button',
        { type: 'button', class: 'btn btn-soft btn-block', onclick: closeSheets },
        'Cancelar'
      );

      form.append(
        h('div', { class: 'srp-person-photo-wrap' }, preview, pick, clear, fileInput),
        h('label', { class: 'srp-field' }, h('span', null, 'Nombre'), name),
        h(
          'label',
          { class: 'srp-field' },
          h('span', null, 'Cumpleaños'),
          birthday
        ),
        h('label', { class: 'srp-field' }, h('span', null, 'Información'), notes),
        error,
        submit,
        cancel
      );

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const values = {
          name: name.value.trim(),
          birthday: birthday.value || null,
          photo: photoValue,
          notes: notes.value.trim(),
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

  /* ==========================================
     VISTA · AGENDA
     ========================================== */

  function agendaView() {
    const wrap = h('div');
    const events = [];

    for (const { person, day } of birthdays()) {
      events.push({
        kind: 'Cumpleaños',
        iconName: 'cake',
        label: `Cumpleaños de ${person.name}`,
        date: day,
        personId: person.id,
      });
    }
    for (const row of upcomingList()) {
      events.push({
        kind: statusOf(row).label,
        iconName: 'gift',
        label: row.title,
        date: row.day,
        rowId: row.id,
        personId: row.person_id || null,
      });
    }
    events.sort((first, second) => (first.date < second.date ? -1 : first.date > second.date ? 1 : 0));

    if (!events.length) {
      showEmpty(wrap, {
        icon: 'calendar',
        title: 'Sin ocasiones a la vista',
        text: 'Añade cumpleaños a tus personas y ponles fecha a tus sorpresas; aquí verás la cuenta atrás.',
        action: NEW_ACTION,
      });
      return wrap;
    }

    const html = [];
    let month = '';
    for (const event of events.slice(0, 40)) {
      const key = event.date.slice(0, 7);
      if (key !== month) {
        month = key;
        html.push(`<div class="srp-section">${esc(monthLabel(key))}</div>`);
      }
      const days = daysUntil(event.date);
      const person = event.personId ? people.find(item => item.id === event.personId) : null;
      html.push(`
        <button type="button" class="srp-row" ${
          person ? `data-person="${esc(person.id)}"` : `data-open="${esc(event.rowId)}"`
        } aria-label="${esc(event.label)}">
          <span class="srp-row__ic">${icon(event.iconName, 17)}</span>
          <span class="srp-row__copy">
            <b>${esc(event.label)}</b>
            <span>${esc(fmtDay(event.date))} · ${esc(event.kind)}</span>
          </span>
          <span class="srp-count${days <= 7 && days >= 0 ? ' is-soon' : ''}">${countdown(event.date, true)}</span>
        </button>
      `);
    }
    wrap.innerHTML = html.join('');
    return wrap;
  }

  /* ==========================================
     VISTA · RESUMEN (estadísticas)
     ========================================== */

  function summaryView() {
    const wrap = h('div');
    const list = live();

    if (!list.length) {
      showEmpty(wrap, {
        icon: 'chart',
        title: 'Sin datos todavía',
        text: 'Guarda sorpresas con precio y aquí verás cuánto planificas y cuánto gastas.',
        action: NEW_ACTION,
      });
      return wrap;
    }

    const spent = list
      .filter(row => isDone(row) || isBought(row))
      .reduce((sum, row) => sum + (Number(row.price) || 0), 0);
    const planned = list
      .filter(row => !isDone(row) && !isBought(row))
      .reduce((sum, row) => sum + (Number(row.price) || 0), 0);
    const priced = list.filter(row => Number(row.price) > 0);
    const average = priced.length
      ? priced.reduce((sum, row) => sum + Number(row.price), 0) / priced.length
      : 0;
    const delivered = list.filter(isDone).length;

    const byYear = new Map();
    for (const row of list) {
      if (!isDone(row) && !isBought(row)) continue;
      const year = (row.day || todayISO()).slice(0, 4);
      byYear.set(year, (byYear.get(year) || 0) + (Number(row.price) || 0));
    }
    const years = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
    const maxYear = Math.max(1, ...years.map(entry => entry[1]));

    const byPerson = people
      .map(person => ({
        person,
        total: list
          .filter(row => row.person_id === person.id && (isDone(row) || isBought(row)))
          .reduce((sum, row) => sum + (Number(row.price) || 0), 0),
      }))
      .filter(entry => entry.total > 0)
      .sort((first, second) => second.total - first.total)
      .slice(0, 5);
    const maxPerson = Math.max(1, ...byPerson.map(entry => entry.total));

    const statCard = (value, label) => `
      <div class="srp-stat">
        <b>${esc(value)}</b>
        <span>${esc(label)}</span>
      </div>
    `;

    wrap.innerHTML = `
      <div class="srp-stats">
        ${statCard(giftsSupported ? fmtEur(spent) : delivered, 'Gastado en total')}
        ${statCard(
          giftsSupported ? fmtEur(planned) : list.filter(row => row.state === 'pendiente').length,
          'Planificado ahora'
        )}
        ${statCard(giftsSupported && priced.length ? fmtEur(average) : '—', 'Regalo medio')}
        ${statCard(list.length, 'Sorpresas')}
      </div>

      <section class="srp-panel">
        <div class="srp-panel__head">
          <b>Gasto por año</b>
          <span>Compras y entregas</span>
        </div>
        ${
          years.length
            ? years
                .map(
                  ([year, total]) => `
          <div class="srp-breakdown">
            <b class="srp-year">${esc(year)}</b>
            <div class="bar"><i style="width:${Math.round((total / maxYear) * 100)}%"></i></div>
            <b>${esc(fmtEur(total))}</b>
          </div>`
                )
                .join('')
            : '<p class="srp-hint">Aún no hay compras registradas.</p>'
        }
      </section>

      ${
        byPerson.length
          ? `<section class="srp-panel">
        <div class="srp-panel__head"><b>A quién más regalas</b></div>
        ${byPerson
          .map(
            entry => `
          <button type="button" class="srp-breakdown is-button" data-person="${esc(entry.person.id)}">
            <span class="srp-who">${avatarHTML(entry.person, 24)}${esc(entry.person.name)}</span>
            <div class="bar"><i style="width:${Math.round((entry.total / maxPerson) * 100)}%"></i></div>
            <b>${esc(fmtEur(entry.total))}</b>
          </button>`
          )
          .join('')}
      </section>`
          : ''
      }

      <section class="srp-panel">
        <div class="srp-panel__head"><b>Por estado</b></div>
        ${Object.entries(statuses())
          .map(([key, meta]) => {
            const count = list.filter(row => row.state === key).length;
            const pct = Math.round((count / list.length) * 100);
            return `
              <div class="srp-breakdown">
                <span class="srp-status is-${meta.tone}"><span aria-hidden="true">${meta.emoji}</span>${esc(meta.label)}</span>
                <div class="bar"><i style="width:${pct}%"></i></div>
                <b>${count}</b>
              </div>`;
          })
          .join('')}
      </section>
    `;
    return wrap;
  }

  /* ==========================================
     RENDER
     ========================================== */

  function render() {
    if (!active) return;
    viewEl.replaceChildren();
    if (view === 'agenda') viewEl.append(agendaView());
    else if (view === 'resumen') viewEl.append(summaryView());
    else if (view === 'personas' && peopleReady) viewEl.append(personasView());
    else viewEl.append(regalosView());
  }

  function syncSeg() {
    page.querySelectorAll('[data-view]').forEach(button => {
      const on = button.dataset.view === view;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  function setView(next) {
    if (view === next) return;
    viewChosen = true;
    view = next;
    filter = 'activos';
    syncSeg();
    render();
  }

  /* ==========================================
     DATOS
     ========================================== */

  async function load() {
    try {
      peopleReady = await supportsPeople();
      personColumn = peopleReady ? await supportsPersonColumn() : false;
      const [loadedRows, loadedPeople] = await Promise.all([
        entries('surprise'),
        peopleReady ? listPeople() : Promise.resolve([]),
      ]);
      rows = loadedRows;
      people = loadedPeople;
      [giftsSupported, extrasSupported] = await Promise.all([
        supportsGiftFields(),
        supportsGiftExtras(),
      ]);
      statesSupported = extrasSupported && (await supportsGiftStates());
      page.querySelector('#srpPeopleTab').hidden = !peopleReady;
      if (!viewChosen) {
        viewChosen = true;
        if (peopleReady && people.length) view = 'personas';
        syncSeg();
      }
      if (!peopleReady && view === 'personas') {
        view = 'regalos';
        syncSeg();
      }
      render();
    } catch {
      if (!active) return;
      showEmpty(viewEl, {
        icon: 'cloud',
        title: 'No se pudo cargar',
        text: 'Comprueba la conexión y vuelve a intentarlo.',
        action: { label: 'Reintentar', id: 'srpRetry' },
      });
      viewEl.querySelector('#srpRetry')?.addEventListener('click', () => {
        viewEl.innerHTML = skeletonCardsHTML({ count: 4 });
        void load();
      });
    }
  }

  async function setStatus(row, state) {
    const next = storableState(state);
    try {
      await writeEntry('surprise', { state: next }, row);
      closeSheets();
      toast(`Estado: ${statusOf({ state: next }).label}`);
      await load();
    } catch (error) {
      toast(
        error?.message?.includes('otro dispositivo')
          ? error.message
          : 'No se ha guardado. Inténtalo de nuevo.'
      );
    }
  }

  async function toggleStar(row) {
    try {
      await writeEntry('surprise', { starred: !row.starred }, row);
      closeSheets();
      toast(row.starred ? 'Quitada de favoritas' : 'Marcada como favorita');
      await load();
    } catch {
      toast('No se pudo cambiar la favorita');
    }
  }

  async function restoreRow(row) {
    try {
      await writeEntry('surprise', { removed_at: null }, row);
      toast('Sorpresa recuperada');
      await load();
    } catch {
      toast('No se pudo recuperar. Actualiza la página.');
    }
  }

  async function restoreById(id) {
    const row = findRow(id);
    if (row) await restoreRow(row);
  }

  async function trashRow(row) {
    try {
      await writeEntry('surprise', { removed_at: new Date().toISOString() }, row);
      closeSheets();
      const id = row.id;
      toast('Sorpresa en la papelera', { label: 'Deshacer', fn: () => restoreById(id) });
      await load();
    } catch {
      toast('No se pudo enviar a la papelera');
    }
  }

  async function duplicateRow(row) {
    try {
      await writeEntry(
        'surprise',
        {
          title: `${row.title} (copia)`.slice(0, 140),
          detail: row.detail,
          day: row.day,
          state: 'pendiente',
          ...(personColumn && { person_id: row.person_id }),
          ...(giftsSupported && { price: row.price, link: row.link, photo: row.photo }),
          ...(extrasSupported && { starred: false }),
        },
        null
      );
      closeSheets();
      toast('Copia creada');
      await load();
    } catch {
      toast('No se pudo duplicar');
    }
  }

  /* ==========================================
     HOJAS
     ========================================== */

  function openStatusSheet(row) {
    const list = statuses();
    openSheet('Estado de la sorpresa', () =>
      h(
        'div',
        null,
        h('p', { class: 'srp-sheet-title' }, row.title),
        h(
          'p',
          { class: 'srp-hint' },
          row.day ? `${fmtDay(row.day)} · ${countdown(row.day)}. Solo lo ves tú.` : 'Solo lo ves tú.'
        ),
        h(
          'div',
          { class: 'srp-status-menu' },
          Object.entries(list).map(([value, meta]) =>
            h(
              'button',
              {
                type: 'button',
                class: `srp-status is-${meta.tone}${row.state === value ? ' is-current' : ''}`,
                'aria-pressed': String(row.state === value),
                onclick: () => setStatus(row, value),
              },
              h('span', { 'aria-hidden': 'true' }, meta.emoji),
              meta.label
            )
          )
        ),
        h(
          'div',
          { class: 'srp-sheet-actions' },
          extrasSupported
            ? h(
                'button',
                { type: 'button', class: 'btn btn-soft btn-block', onclick: () => toggleStar(row) },
                row.starred ? 'Quitar de favoritas' : 'Marcar como favorita'
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-soft btn-block',
              onclick: () => {
                closeSheets();
                editor(row);
              },
            },
            'Editar sorpresa'
          ),
          h(
            'button',
            { type: 'button', class: 'btn btn-soft btn-block', onclick: () => duplicateRow(row) },
            'Duplicar'
          ),
          h(
            'button',
            { type: 'button', class: 'btn btn-danger btn-block', onclick: () => trashRow(row) },
            'Enviar a la papelera'
          )
        )
      )
    );
  }

  function editor(row = null, presetPersonId = null) {
    openSheet(row ? 'Editar sorpresa' : 'Nueva idea de regalo', () => {
      const form = h('form', { class: 'srp-form', novalidate: true });

      const title = h('input', {
        type: 'text',
        name: 'title',
        maxlength: '140',
        required: true,
        placeholder: 'Ej. Auriculares',
        value: row?.title || '',
      });
      const detail = h('textarea', {
        name: 'detail',
        maxlength: '4000',
        placeholder: 'Talla, color, detalles…',
      });
      detail.value = row?.detail || '';
      const day = h('input', {
        type: 'date',
        name: 'day',
        required: true,
        value: row?.day || todayISO(),
      });

      const price = h('input', {
        type: 'number',
        name: 'price',
        min: '0',
        max: '100000',
        step: '0.01',
        inputmode: 'decimal',
        placeholder: '0,00',
        value: row?.price ?? '',
      });
      const link = h('input', {
        type: 'url',
        name: 'link',
        maxlength: '2000',
        placeholder: 'Pegar enlace…',
        value: row?.link || '',
      });

      let photoValue = row?.photo || '';
      const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const dropZone = h('button', {
        type: 'button',
        class: 'srp-drop',
        'aria-label': 'Añadir o cambiar la imagen del regalo',
        onclick: () => photoInput.click(),
      });
      const photoActions = h('div', { class: 'srp-drop-actions' });
      const drawPhoto = () => {
        dropZone.innerHTML = photoValue
          ? `<img src="${safeUrl(photoValue)}" alt="Foto del regalo">`
          : `<span class="srp-drop__ic">${icon('image', 26)}</span><span>Añadir imagen</span>`;
        photoActions.innerHTML = '';
        // Como en DailyHub, la zona de imagen ya es el botón de añadir: los
        // botones solo aparecen cuando hay foto que cambiar o quitar.
        if (photoValue) {
          photoActions.append(
            h(
              'button',
              { type: 'button', class: 'btn btn-soft btn--sm', onclick: () => photoInput.click() },
              'Cambiar'
            ),
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
              'Quitar'
            )
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

      const personSelect = peopleReady
        ? h(
            'select',
            { name: 'person_id' },
            h('option', { value: '' }, 'Sin asignar'),
            ...people.map(person =>
              h(
                'option',
                {
                  value: person.id,
                  selected: row ? row.person_id === person.id : presetPersonId === person.id,
                },
                person.name
              )
            )
          )
        : null;

      // La lista no cambia mientras la hoja está abierta: se calcula una vez.
      const offered = statuses();
      let state = row ? storableState(row.state) : 'pendiente';
      // «preparado» es el valor antiguo de «Comprado»: si el estado nuevo se
      // ofrece, al editar se muestra como ese.
      if (state === 'preparado' && offered.comprado) state = 'comprado';
      const statusButtons = h('div', { class: 'srp-status-menu' });
      const drawStatusButtons = () => {
        statusButtons.innerHTML = '';
        for (const [value, meta] of Object.entries(offered)) {
          statusButtons.append(
            h(
              'button',
              {
                type: 'button',
                class: `srp-status is-${meta.tone}${state === value ? ' is-current' : ''}`,
                'aria-pressed': String(state === value),
                onclick: () => {
                  state = value;
                  drawStatusButtons();
                },
              },
              h('span', { 'aria-hidden': 'true' }, meta.emoji),
              meta.label
            )
          );
        }
      };
      drawStatusButtons();

      let starred = !!(row && row.starred);
      const starButton = h(
        'button',
        {
          type: 'button',
          class: 'btn btn-soft btn-block srp-fav-toggle',
          'aria-pressed': String(starred),
          onclick: () => {
            starred = !starred;
            starButton.classList.toggle('is-on', starred);
            starButton.setAttribute('aria-pressed', String(starred));
            starButton.innerHTML = `${icon('star', 16)} ${starred ? 'Favorita' : 'Marcar como favorita'}`;
          },
        },
        h('span', { class: 'ic', html: icon('star', 16) }),
        starred ? ' Favorita' : ' Marcar como favorita'
      );
      starButton.classList.toggle('is-on', starred);

      const error = h('p', { class: 'srp-error', role: 'alert' });
      const submit = h(
        'button',
        { type: 'submit', class: 'btn btn-block' },
        row ? 'Guardar cambios' : 'Guardar regalo'
      );
      const cancel = h(
        'button',
        { type: 'button', class: 'btn btn-soft btn-block', onclick: closeSheets },
        'Cancelar'
      );

      form.append(
        h('div', { class: 'srp-field' }, dropZone, photoActions, photoInput),
        h('label', { class: 'srp-field' }, h('span', null, '¿Qué quieres regalar?'), title),
        ...(personSelect
          ? [h('label', { class: 'srp-field' }, h('span', null, '¿Para quién?'), personSelect)]
          : []),
        h(
          'div',
          { class: 'srp-form__row' },
          h(
            'label',
            { class: 'srp-field' },
            h('span', null, 'Precio aproximado (€)'),
            price
          ),
          h('label', { class: 'srp-field' }, h('span', null, '¿Para cuándo?'), day)
        ),
        h('label', { class: 'srp-field' }, h('span', null, 'Enlace de la tienda'), link),
        h('div', { class: 'srp-field' }, h('span', null, 'Estado'), statusButtons),
        ...(extrasSupported ? [starButton] : []),
        h('label', { class: 'srp-field' }, h('span', null, 'Notas'), detail),
        error,
        submit,
        cancel
      );

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const values = {
          title: title.value.trim(),
          detail: detail.value.trim(),
          day: day.value,
          state: storableState(state),
          ...(personColumn && personSelect && { person_id: personSelect.value || null }),
          ...(giftsSupported && {
            price: price.value === '' ? null : Number(price.value),
            link: link.value.trim(),
            photo: photoValue,
          }),
          ...(extrasSupported && { starred }),
        };

        if (!values.title) {
          error.textContent = 'Ponle un título a la sorpresa.';
          title.focus();
          return;
        }
        if (!values.day) {
          error.textContent = 'Elige una fecha para la sorpresa.';
          day.parentElement?.querySelector('.datefield-input')?.focus();
          return;
        }
        if (values.price != null && (!Number.isFinite(values.price) || values.price < 0)) {
          error.textContent = 'El presupuesto no puede ser negativo.';
          price.focus();
          return;
        }
        if (values.link && !/^https?:\/\/\S+$/i.test(values.link)) {
          error.textContent = 'El enlace debe empezar por http:// o https://';
          link.focus();
          return;
        }

        error.textContent = '';
        submit.disabled = true;
        cancel.disabled = true;
        try {
          await writeEntry('surprise', values, row);
          closeSheets();
          toast(row ? 'Sorpresa actualizada' : 'Sorpresa guardada');
          await load();
        } catch (err) {
          error.textContent = err?.message?.includes('otro dispositivo')
            ? err.message
            : 'No se ha guardado. Puedes volver a intentarlo.';
          submit.disabled = false;
          cancel.disabled = false;
        }
      });

      return form;
    });
  }

  /* ==========================================
     EVENTOS
     ========================================== */

  page.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }

    const personButton = event.target.closest('[data-person-new], [data-person]');
    if (personButton) {
      if (personButton.hasAttribute('data-person-new')) {
        personEditor();
        return;
      }
      const person = people.find(item => item.id === personButton.dataset.person);
      if (person) personSheet(person);
      return;
    }

    const rowButton = event.target.closest('[data-open], [data-status], [data-restore]');
    if (!rowButton) return;
    const row = findRow(
      rowButton.dataset.open || rowButton.dataset.status || rowButton.dataset.restore
    );
    if (!row) return;
    if (rowButton.dataset.restore) void restoreRow(row);
    else if (rowButton.dataset.status) openStatusSheet(row);
    else editor(row);
  });

  page.querySelector('#srpNewBtn').addEventListener('click', () => editor());
  page.querySelector('#srpAgendaBtn').addEventListener('click', () => setView('agenda'));
  page.querySelector('#srpStatsBtn').addEventListener('click', () => setView('resumen'));
  page.querySelector('#srpTrashBtn').addEventListener('click', () => {
    view = 'regalos';
    filter = 'papelera';
    syncSeg();
    render();
  });

  viewEl.innerHTML = skeletonCardsHTML({ count: 4 });
  void load();

  page.cleanup = () => {
    active = false;
    closeSheets();
  };

  return page;
}
