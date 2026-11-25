/* ==========================================
   Mis sorpresas — lógica pura del organizador

   Todo lo que se puede calcular sin DOM ni red: estados, filtros,
   ordenación, totales, presupuesto y agenda. La pantalla solo pinta lo
   que sale de aquí, y los tests (tests/gift-organizer.test.js) cubren
   estas funciones sin navegador.

   El modelo de datos es el que ya existía (`tamp_entries` con
   kind='surprise'): `pendiente` · `comprar` · `comprado` · `preparado` ·
   `entregado`. `preparado` era el valor antiguo de «Comprado»; ahora es
   su propio estado («Preparado») y los registros viejos se siguen
   leyendo sin tocar la base.
   ========================================== */

const DAY = 86400000;

import {
  GIFT_STATE_ORDER,
  GIFT_STATE_META,
  giftStateMeta,
  offeredGiftStates,
  storableGiftState,
} from './gift-states.js';

export { GIFT_STATE_META, giftStateMeta, offeredGiftStates, storableGiftState };

// Los cinco estados canónicos, definidos una sola vez en gift-states.js.
export const GIFT_STATES = GIFT_STATE_ORDER;

export const isBoughtState = state => state === 'comprado' || state === 'preparado' || state === 'entregado';
export const isDoneState = state => state === 'entregado';
export const isPendingState = state => state === 'pendiente' || state === 'comprar';

/* ==========================================
   FECHAS
   ========================================== */

const parseDay = iso => Date.parse(`${iso}T12:00:00Z`);

/** Días que faltan (negativo si ya pasó). */
export function daysUntil(iso, today) {
  if (!iso || !today) return NaN;
  return Math.round((parseDay(iso) - parseDay(today)) / DAY);
}

/** Próxima vez que cae un día/mes (este año o el siguiente). */
export function nextAnnualDate(mmdd, today) {
  if (!mmdd || mmdd.length < 5) return null;
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${mmdd.slice(-5)}`;
  return candidate < today ? `${year + 1}-${mmdd.slice(-5)}` : candidate;
}

/** «MM-DD» de una fecha ISO completa o suelta. */
export function monthDay(iso) {
  if (!iso) return '';
  return iso.length >= 10 ? iso.slice(5, 10) : iso.slice(-5);
}

/** Clave de mes «YYYY-MM». */
export function monthKeyOf(iso) {
  return String(iso || '').slice(0, 7);
}

/** Suma meses a una clave «YYYY-MM» (delta puede ser negativo). */
export function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* ==========================================
   ESTADOS DE UN REGALO EN LA LISTA
   ========================================== */

export const isArchived = gift => !!gift?.archived_at;
export const isTrashed = gift => !!gift?.removed_at;
export const isLive = gift => !!gift && !isTrashed(gift) && !isArchived(gift);

/** Precio estimado (lo que crees que costará). */
export const estimatedValue = gift => {
  const value = Number(gift?.price);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/** Coste real: el precio real si existe; si no, el estimado de lo comprado. */
export function realCost(gift) {
  const actual = Number(gift?.actual_price);
  if (Number.isFinite(actual) && actual > 0) return actual;
  return isBoughtState(gift?.state) ? estimatedValue(gift) : 0;
}

/* ==========================================
   FILTROS Y ORDEN
   ========================================== */

export const GIFT_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'activos', label: 'Activos' },
  { id: 'pendiente', label: 'Ideas' },
  { id: 'comprar', label: 'Por comprar' },
  { id: 'comprado', label: 'Comprados' },
  { id: 'preparado', label: 'Preparados' },
  { id: 'entregado', label: 'Entregados' },
  { id: 'archivados', label: 'Archivados' },
];

export const GIFT_SORTS = [
  { id: 'fecha', label: 'Fecha prevista' },
  { id: 'creado', label: 'Fecha de creación' },
  { id: 'precio', label: 'Precio' },
  { id: 'nombre', label: 'Nombre' },
  { id: 'persona', label: 'Destinatario' },
  { id: 'estado', label: 'Estado' },
];

const normalize = value =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Base de la lista según el filtro. `papelera` es aparte porque vive en
 * la pantalla de archivo.
 */
export function giftsForFilter(gifts, filter) {
  if (filter === 'papelera') return gifts.filter(isTrashed);
  if (filter === 'archivados') return gifts.filter(gift => !isTrashed(gift) && isArchived(gift));
  const live = gifts.filter(isLive);
  if (filter === 'todos') return live;
  if (filter === 'activos') return live.filter(gift => gift.state !== 'entregado');
  return live.filter(gift => gift.state === filter);
}

/**
 * Búsqueda + filtro por persona + ordenación.
 * @param {{ gifts: any[], people?: any[], filter?: string, sort?: string,
 *           query?: string, personId?: string }} options
 */
export function filterGifts({ gifts = [], people = [], filter = 'todos', sort = 'fecha', query = '', personId = 'todas' } = {}) {
  const needle = normalize(query.trim());
  const byId = new Map(people.map(person => [person.id, person]));
  const items = giftsForFilter(gifts, filter)
    .filter(gift => personId === 'todas' || gift.person_id === personId)
    .filter(gift => {
      if (!needle) return true;
      const person = byId.get(gift.person_id);
      return normalize(
        `${gift.title || ''} ${gift.detail || ''} ${gift.notes || ''} ${gift.occasion || ''} ${gift.store || ''} ${person?.name || ''}`,
      ).includes(needle);
    });
  return sortGifts(items, sort, byId);
}

export function sortGifts(items, sort = 'fecha', byId = new Map()) {
  const copy = items.slice();
  const nameOf = gift => byId.get(gift.person_id)?.name || '';
  const stateStep = gift => giftStateMeta(gift.state).step;
  const compare = {
    fecha: (a, b) => String(a.day || '').localeCompare(String(b.day || '')),
    creado: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
    precio: (a, b) => estimatedValue(b) - estimatedValue(a),
    nombre: (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es'),
    persona: (a, b) => nameOf(a).localeCompare(nameOf(b), 'es') || String(a.title || '').localeCompare(String(b.title || ''), 'es'),
    estado: (a, b) => stateStep(a) - stateStep(b) || String(a.day || '').localeCompare(String(b.day || '')),
  }[sort] || ((a, b) => String(a.day || '').localeCompare(String(b.day || '')));

  return copy.sort((a, b) => compare(a, b) || String(a.id).localeCompare(String(b.id)));
}

/* ==========================================
   RESUMEN Y PRESUPUESTO
   ========================================== */

/**
 * Los tres indicadores de la tarjeta superior, con datos reales.
 * «Comprados» cuenta comprado + preparado + entregado; el importe
 * previsto es solo de lo que aún no se ha comprado.
 */
export function giftSummary(gifts = []) {
  const live = gifts.filter(isLive);
  const pending = live.filter(gift => isPendingState(gift.state));
  const bought = live.filter(gift => isBoughtState(gift.state));
  return {
    pendingCount: pending.length,
    planned: pending.reduce((sum, gift) => sum + estimatedValue(gift), 0),
    boughtCount: bought.length,
    boughtValue: bought.reduce((sum, gift) => sum + realCost(gift), 0),
    deliveredCount: live.filter(gift => isDoneState(gift.state)).length,
    totalCount: live.length,
  };
}

/**
 * Informe económico de un mes. Las ideas y los pendientes NUNCA cuentan
 * como gasto: el gasto real sale de los regalos ya comprados.
 * @param {{ gifts: any[], people?: any[], month: string, budget?: number }} options
 */
export function budgetReport({ gifts = [], people = [], month, budget = 0 } = {}) {
  const live = gifts.filter(isLive);
  const inMonth = live.filter(gift => monthKeyOf(gift.day) === month);
  const pending = inMonth.filter(gift => isPendingState(gift.state));
  const bought = inMonth.filter(gift => isBoughtState(gift.state));

  const planned = pending.reduce((sum, gift) => sum + estimatedValue(gift), 0);
  const spent = bought.reduce((sum, gift) => sum + realCost(gift), 0);
  const ceiling = Number(budget) > 0 ? Number(budget) : 0;

  const byPerson = people
    .map(person => ({
      id: person.id,
      name: person.name,
      total: bought
        .filter(gift => gift.person_id === person.id)
        .reduce((sum, gift) => sum + realCost(gift), 0),
    }))
    .filter(entry => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const orphan = bought
    .filter(gift => !people.some(person => person.id === gift.person_id))
    .reduce((sum, gift) => sum + realCost(gift), 0);
  if (orphan > 0) byPerson.push({ id: '', name: 'Sin asignar', total: orphan });

  const byState = GIFT_STATES.map(state => {
    const items = inMonth.filter(gift => gift.state === state);
    return {
      state,
      label: giftStateMeta(state).label,
      tone: giftStateMeta(state).tone,
      count: items.length,
      total: items.reduce((sum, gift) => sum + (isBoughtState(state) ? realCost(gift) : estimatedValue(gift)), 0),
    };
  }).filter(entry => entry.count > 0);

  const history = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5)).map(key => {
    const monthGifts = live.filter(gift => monthKeyOf(gift.day) === key && isBoughtState(gift.state));
    return { month: key, total: monthGifts.reduce((sum, gift) => sum + realCost(gift), 0) };
  });

  return {
    month,
    budget: ceiling,
    planned,
    spent,
    available: ceiling ? ceiling - spent : 0,
    pendingCount: pending.length,
    boughtCount: bought.length,
    byPerson,
    byState,
    history,
    overflow: ceiling > 0 && spent > ceiling,
  };
}

/* ==========================================
   AGENDA DE PERSONAS

   Cumpleaños y fechas propias de cada persona, en orden cronológico.
   Las fechas de entrega de los regalos NO viven aquí: esas ya están en la
   pestaña de regalos y mezclarlas convertía la agenda en otra lista de
   regalos. Tampoco se añaden fiestas sueltas: la agenda es de personas.
   ========================================== */

export function peopleOccasions({ people = [], today } = {}) {
  const events = [];

  for (const person of people) {
    if (person.birthday) {
      const date = nextAnnualDate(monthDay(person.birthday), today);
      if (date) {
        const birthYear = Number(String(person.birthday).slice(0, 4));
        const year = Number(date.slice(0, 4));
        events.push({
          id: `bday-${person.id}-${date}`,
          kind: 'birthday',
          title: `Cumpleaños de ${person.name}`,
          personId: person.id,
          date,
          art: 'cumpleanos',
          years: Number.isFinite(birthYear) && birthYear > 1900 ? year - birthYear : null,
        });
      }
    }

    for (const item of person.important_dates || []) {
      if (!item?.date) continue;
      const date = nextAnnualDate(monthDay(item.date), today);
      if (!date) continue;
      const originalYear = Number(String(item.date).slice(0, 4));
      events.push({
        id: `date-${person.id}-${date}-${item.label || ''}`,
        kind: 'date',
        title: item.label || 'Fecha importante',
        personId: person.id,
        date,
        art: 'agenda-regalos',
        years:
          Number.isFinite(originalYear) && originalYear > 1900
            ? Number(date.slice(0, 4)) - originalYear
            : null,
      });
    }
  }

  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'),
  );
}

/* ==========================================
   PERSONAS
   ========================================== */

/** Regalos de una persona, agrupados como en su ficha. */
export function personGiftBuckets(personId, gifts = []) {
  const theirs = gifts.filter(gift => isLive(gift) && gift.person_id === personId);
  return {
    ideas: theirs.filter(gift => gift.state === 'pendiente'),
    pending: theirs.filter(gift => gift.state === 'comprar'),
    bought: theirs.filter(gift => isBoughtState(gift.state) && !isDoneState(gift.state)),
    delivered: theirs.filter(gift => isDoneState(gift.state)),
    all: theirs,
    planned: theirs
      .filter(gift => isPendingState(gift.state))
      .reduce((sum, gift) => sum + estimatedValue(gift), 0),
    spent: theirs
      .filter(gift => isBoughtState(gift.state))
      .reduce((sum, gift) => sum + realCost(gift), 0),
  };
}

/** La próxima ocasión de una persona (cumpleaños o fecha propia). */
export function nextOccasionOf(person, today) {
  const options = [];
  if (person?.birthday) {
    const date = nextAnnualDate(monthDay(person.birthday), today);
    if (date) options.push({ date, title: 'Cumpleaños', art: 'cumpleanos' });
  }
  for (const item of person?.important_dates || []) {
    if (!item?.date) continue;
    const date = nextAnnualDate(monthDay(item.date), today);
    if (date) options.push({ date, title: item.label || 'Fecha importante', art: 'agenda-regalos' });
  }
  return options.sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
