/* ==========================================
   Mis sorpresas — pruebas de la lógica pura

   Cubren filtros, orden, totales, presupuesto y agenda sin navegador ni
   Supabase. La interfaz y la RLS se comprueban aparte.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  giftStateMeta,
  offeredGiftStates,
  storableGiftState,
  giftsForFilter,
  filterGifts,
  giftSummary,
  budgetReport,
  peopleOccasions,
  personGiftBuckets,
  nextAnnualDate,
  shiftMonth,
  daysUntil,
  realCost,
} from '../tamp/src/utils/gift-organizer.js';

const TODAY = '2026-11-25';

const gift = (id, values = {}) => ({
  id,
  title: `Regalo ${id}`,
  day: '2026-12-10',
  state: 'pendiente',
  price: null,
  actual_price: null,
  created_at: '2026-11-01T10:00:00Z',
  ...values,
});

const people = [
  { id: 'p1', name: 'Sofía', birthday: '1994-12-12' },
  { id: 'p2', name: 'Carlos', birthday: '1990-01-06' },
];

test('los estados antiguos siguen leyéndose y guardándose', () => {
  assert.equal(giftStateMeta('preparado').label, 'Preparado');
  assert.equal(giftStateMeta('desconocido').label, 'Idea');
  assert.deepEqual(offeredGiftStates({ states: false }), ['pendiente', 'preparado', 'entregado']);
  assert.deepEqual(offeredGiftStates({ starred: true, states: true }), [
    'pendiente',
    'comprar',
    'comprado',
    'preparado',
    'entregado',
  ]);
  // Sin la 039, «Comprado» se guarda con el valor heredado.
  assert.equal(storableGiftState('comprado', { starred: true, states: false }), 'preparado');
  assert.equal(storableGiftState('comprar', { starred: true, states: false }), 'pendiente');
  assert.equal(storableGiftState('comprado', { starred: true, states: true }), 'comprado');
});

test('archivados y papelera no se mezclan con la lista activa', () => {
  const rows = [
    gift('a'),
    gift('b', { archived_at: '2026-11-02T00:00:00Z' }),
    gift('c', { removed_at: '2026-11-03T00:00:00Z' }),
    gift('d', { state: 'entregado' }),
  ];
  assert.deepEqual(giftsForFilter(rows, 'archivados').map(row => row.id), ['b']);
  assert.deepEqual(giftsForFilter(rows, 'papelera').map(row => row.id), ['c']);
  assert.deepEqual(giftsForFilter(rows, 'activos').map(row => row.id), ['a']);
  assert.deepEqual(giftsForFilter(rows, 'todos').map(row => row.id), ['a', 'd']);
});

test('búsqueda y orden por precio, persona y estado', () => {
  const rows = [
    gift('a', { title: 'Auriculares', person_id: 'p1', price: 30 }),
    gift('b', { title: 'Libro de cocina', person_id: 'p2', price: 90, state: 'comprar' }),
    gift('c', { title: 'Bufanda', person_id: 'p1', price: 15, state: 'entregado' }),
  ];
  const byName = filterGifts({ gifts: rows, people, sort: 'nombre' });
  assert.deepEqual(byName.map(row => row.id), ['a', 'c', 'b']);

  const byPrice = filterGifts({ gifts: rows, people, sort: 'precio' });
  assert.deepEqual(byPrice.map(row => row.id), ['b', 'a', 'c']);

  const byPerson = filterGifts({ gifts: rows, people, sort: 'persona' });
  assert.deepEqual(byPerson.map(row => row.id), ['b', 'a', 'c']); // Carlos antes que Sofía

  const search = filterGifts({ gifts: rows, people, query: 'sofia' });
  assert.deepEqual(search.map(row => row.id), ['a', 'c']);

  const byState = filterGifts({ gifts: rows, people, sort: 'estado' });
  assert.deepEqual(byState.map(row => row.id), ['a', 'b', 'c']);
});

test('el resumen distingue previsto de comprado', () => {
  const rows = [
    gift('idea', { state: 'pendiente', price: 50 }),
    gift('shop', { state: 'comprar', price: 20 }),
    gift('bought', { state: 'comprado', price: 100, actual_price: 85 }),
    gift('done', { state: 'entregado', price: 10 }),
  ];
  const summary = giftSummary(rows);
  assert.equal(summary.pendingCount, 2);
  assert.equal(summary.planned, 70);
  assert.equal(summary.boughtCount, 2);
  assert.equal(summary.boughtValue, 95); // 85 real + 10 estimado
});

test('una idea nunca cuenta como gasto', () => {
  const rows = [
    gift('idea', { state: 'pendiente', price: 200, day: '2026-12-01', person_id: 'p1' }),
    gift('buy', { state: 'comprar', price: 80, day: '2026-12-02', person_id: 'p1' }),
    gift('bought', { state: 'comprado', price: 60, actual_price: 55, day: '2026-12-03', person_id: 'p2' }),
  ];
  const report = budgetReport({ gifts: rows, people, month: '2026-12', budget: 100 });
  assert.equal(report.spent, 55);
  assert.equal(report.planned, 280);
  assert.equal(report.available, 45);
  assert.equal(report.overflow, false);
  assert.equal(report.byPerson[0].name, 'Carlos');
  assert.equal(report.history.length, 6);
  assert.equal(report.history.at(-1).month, '2026-12');
});

test('agenda de personas: cumpleaños y fechas propias en orden, sin regalos', () => {
  const withDates = [
    { ...people[0], important_dates: [{ label: 'Aniversario', date: '2018-12-05' }] },
    people[1],
  ];
  const events = peopleOccasions({ people: withDates, today: TODAY });
  const titles = events.map(event => event.title);

  assert.ok(titles.includes('Cumpleaños de Sofía'));
  assert.ok(titles.includes('Cumpleaños de Carlos'));
  assert.ok(titles.includes('Aniversario'));

  // La agenda es solo de personas: ni fechas de entrega de regalos ni
  // fiestas sueltas que la convertirían en otra lista de regalos.
  assert.ok(!titles.includes('Navidad'));
  assert.ok(!titles.includes('Reyes'));
  assert.ok(events.every(event => event.kind === 'birthday' || event.kind === 'date'));

  // Orden cronológico estricto.
  const dates = events.map(event => event.date);
  assert.deepEqual(dates, [...dates].sort());

  const sofia = events.find(event => event.title === 'Cumpleaños de Sofía');
  assert.equal(sofia.date, '2026-12-12');
  assert.equal(sofia.years, 32);
  assert.equal(sofia.personId, 'p1');

  // Carlos cumple el 6 de enero: ya pasó este año, toca el siguiente.
  const carlos = events.find(event => event.title === 'Cumpleaños de Carlos');
  assert.equal(carlos.date, '2027-01-06');
});

test('ficha de persona: grupos e importes', () => {
  const rows = [
    gift('a', { person_id: 'p1', state: 'pendiente', price: 40 }),
    gift('b', { person_id: 'p1', state: 'comprar', price: 10 }),
    gift('c', { person_id: 'p1', state: 'preparado', price: 25 }),
    gift('d', { person_id: 'p1', state: 'entregado', price: 5 }),
    gift('e', { person_id: 'p2', state: 'pendiente', price: 99 }),
  ];
  const buckets = personGiftBuckets('p1', rows);
  assert.equal(buckets.ideas.length, 1);
  assert.equal(buckets.pending.length, 1);
  assert.equal(buckets.bought.length, 1);
  assert.equal(buckets.delivered.length, 1);
  assert.equal(buckets.planned, 50);
  assert.equal(buckets.spent, 30);
  assert.equal(realCost(rows[2]), 25);
});

test('fechas: próxima ocurrencia y meses', () => {
  assert.equal(nextAnnualDate('12-25', TODAY), '2026-12-25');
  assert.equal(nextAnnualDate('01-06', TODAY), '2027-01-06');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(daysUntil('2026-11-25', TODAY), 0);
  assert.equal(daysUntil('2026-11-28', TODAY), 3);
});
