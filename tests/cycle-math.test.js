/* ==========================================
   Algoritmo del ciclo (src/utils/cycleMath.js)
   Contrato de las estimaciones: fechas, medias, ventana fértil y
   niveles de confianza. Sin DOM ni Supabase.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDaysISO, daysBetween, isValidISO,
  average, median, weightedAverage,
  normalizePeriods, cycleLengths, periodDurations,
  computeCycle, estimatedPeriods, cycleDayFor,
  computeStats, filterSince, confidenceFor
} from '../personal-hub/src/utils/cycleMath.js';

const TODAY = '2026-11-17';

const period = (start, end = null) => ({ start_date: start, end_date: end });

test('las fechas se comparan por días de calendario, sin husos', () => {
  assert.equal(isValidISO('2026-11-17'), true);
  assert.equal(isValidISO('2026-02-31'), false, 'una fecha imposible no es válida');
  assert.equal(isValidISO('17/11/2026'), false);
  assert.equal(daysBetween('2026-01-01', '2026-01-29'), 28);
  assert.equal(daysBetween('2026-01-29', '2026-01-01'), -28);
  assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
});

test('las medias respetan lo reciente y la mediana', () => {
  assert.equal(average([28, 30]), 29);
  assert.equal(median([28, 30, 32]), 30);
  assert.equal(median([28, 30]), 29);
  // 28 (viejo, peso 0.75) y 30 (reciente, peso 1) → 29.14
  assert.equal(Number(weightedAverage([28, 30]).toFixed(2)), 29.14);
  assert.equal(weightedAverage([]), null);
});

test('los ciclos salen de los inicios consecutivos y se descartan huecos imposibles', () => {
  const periods = [
    period('2026-08-01'), period('2026-08-30'), period('2026-09-28'),
    period('2026-11-20') // 53 días: un ciclo largo, se conserva (la variación es información)
  ];
  assert.deepEqual(cycleLengths(periods), [29, 29, 53]);
  const impossible = [period('2026-01-01'), period('2026-05-01')];
  assert.deepEqual(cycleLengths(impossible), [], 'un hueco de 120 días no es un ciclo');
  assert.deepEqual(normalizePeriods(periods).map((p) => p.start),
    ['2026-08-01', '2026-08-30', '2026-09-28', '2026-11-20']);
});

test('la duración de la menstruación usa el fin, o hoy si sigue abierta', () => {
  const durations = periodDurations([
    period('2026-10-01', '2026-10-05'),
    period('2026-11-14')
  ], '2026-11-17');
  assert.deepEqual(durations, [5, 4]);
});

test('sin datos no hay predicción ni se inventan fechas', () => {
  const result = computeCycle({ periods: [], today: TODAY });
  assert.equal(result.hasData, false);
  assert.equal(result.nextStart, null);
  assert.equal(result.cycleDay, null);
  assert.equal(result.confidence.level, 'none');
  assert.equal(result.estimated, true);
  assert.deepEqual(estimatedPeriods({ periods: [], today: TODAY }), []);
});

test('con tres ciclos se predice la próxima menstruación y sus fases', () => {
  const periods = [
    period('2026-09-01', '2026-09-05'),
    period('2026-09-29', '2026-10-03'),
    period('2026-10-27', '2026-10-31')
  ];
  const result = computeCycle({ periods, today: TODAY });

  assert.equal(result.avgCycle, 28);
  assert.equal(result.avgPeriod, 5);
  assert.equal(result.lastStart, '2026-10-27');
  assert.equal(result.nextStart, '2026-11-24');
  assert.equal(result.daysUntilNext, 7);
  assert.equal(result.cycleDay, 22);
  assert.equal(result.ovulation, '2026-11-10');
  assert.equal(result.fertileStart, '2026-11-05');
  assert.equal(result.fertileEnd, '2026-11-11');
  assert.equal(result.confidence.level, 'low', 'con dos ciclos completos la confianza aún es baja');
  assert.equal(result.estimated, true);
});

test('una fecha estimada pasada avanza el calendario sin inventar registros', () => {
  const periods = [period('2026-09-01', '2026-09-05'), period('2026-09-30', '2026-10-04')];
  const result = computeCycle({ periods, today: TODAY });
  assert.ok(result.nextStart >= TODAY, 'la próxima estimada nunca queda en el pasado');
  assert.ok(result.daysLate > 0, 'se avisa de que el periodo esperado se retrasa');
  assert.equal(result.period.count, 2, 'los periodos registrados no cambian');
});

test('la fiabilidad sube con más ciclos y baja con variabilidad alta', () => {
  assert.equal(confidenceFor([], 0).level, 'none');
  assert.equal(confidenceFor([28, 35], 7).level, 'low');
  assert.equal(confidenceFor([28, 29, 30, 27], 3).level, 'medium');
  assert.equal(confidenceFor([28, 28, 29, 27, 28, 28], 2).level, 'high');

  const irregular = computeCycle({
    periods: [
      period('2026-06-01'), period('2026-06-25'), period('2026-07-30'),
      period('2026-08-26'), period('2026-10-01')
    ],
    today: TODAY
  });
  assert.equal(irregular.irregular, true);
  assert.equal(irregular.confidence.explanation.includes('varían'), true);
});

test('los rangos estimados son consecutivos y respetan la fase lútea', () => {
  const periods = [
    period('2026-09-01', '2026-09-05'),
    period('2026-09-29', '2026-10-03'),
    period('2026-10-27', '2026-10-31')
  ];
  const ranges = estimatedPeriods({ periods, today: TODAY, count: 3 });
  assert.equal(ranges.length, 3);
  assert.equal(ranges[0].start, '2026-11-24');
  assert.equal(ranges[0].end, '2026-11-28');
  assert.equal(ranges[0].ovulation, '2026-11-10');
  assert.equal(ranges[0].fertileStart, '2026-11-05');
  assert.equal(daysBetween(ranges[0].start, ranges[1].start), 28);

  const luteal = estimatedPeriods({
    periods,
    today: TODAY,
    count: 1,
    settings: { lutealPhaseLength: 12 }
  });
  assert.equal(luteal[0].ovulation, '2026-11-12', 'la fase lútea configurable mueve la ovulación');
});

test('el día del ciclo se ancla al último inicio registrado', () => {
  const periods = [period('2026-10-27'), period('2026-10-01')];
  assert.equal(cycleDayFor('2026-10-27', periods), 1);
  assert.equal(cycleDayFor('2026-11-02', periods), 7);
  assert.equal(cycleDayFor('2026-09-20', periods), null);
});

test('las estadísticas cuentan ciclos, flujo, síntomas y ánimos', () => {
  const periods = [
    period('2026-09-01', '2026-09-05'),
    period('2026-09-29', '2026-10-03'),
    period('2026-10-27', '2026-10-31')
  ];
  const logs = [
    { log_date: '2026-09-02', flow: 'heavy', symptoms: ['colicos', 'cansancio'], mood: ['irritable'] },
    { log_date: '2026-09-03', flow: 'medium', symptoms: ['colicos'], mood: ['triste'] },
    { log_date: '2026-09-20', symptoms: ['hinchazon'], mood: ['feliz'] }
  ];
  const stats = computeStats({ periods, logs });

  assert.equal(stats.cycles.count, 2);
  assert.equal(stats.cycles.avg, 28);
  assert.equal(stats.periods.avg, 5);
  assert.equal(stats.logs, 3);
  assert.equal(stats.flow[0].id, 'heavy');
  assert.equal(stats.symptoms[0].id, 'colicos');
  assert.equal(stats.symptoms[0].count, 2);
  assert.equal(stats.symptoms[0].avgCycleDay, 3, 'los cólicos aparecen de media en el día 3 (días 2 y 3)');
  assert.equal(stats.moods[0].count, 1);
});

test('el filtro por meses deja fuera lo anterior al corte', () => {
  const cutoff = '2026-09-01';
  const filtered = filterSince({
    periods: [period('2026-08-01'), period('2026-09-05', '2026-09-09')],
    logs: [{ log_date: '2026-07-01' }, { log_date: '2026-09-10' }]
  }, cutoff);
  assert.equal(filtered.periods.length, 1);
  assert.equal(filtered.logs.length, 1);
  assert.equal(filtered.logs[0].log_date, '2026-09-10');
});
