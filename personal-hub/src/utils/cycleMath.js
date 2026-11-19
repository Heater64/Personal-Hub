/* ==========================================
   Personal Hub — cycleMath
   Cálculos del ciclo menstrual, SIN DOM y SIN Supabase: es la parte
   que se puede razonar (y testear) en aislamiento.

   Todo lo que sale de aquí es una ESTIMACIÓN. Nunca se presenta como
   certeza ni como método anticonceptivo.
   ========================================== */

const DAY_MS = 86400000;

export const DEFAULT_SETTINGS = {
  avgCycleLength: 28,
  avgPeriodLength: 5,
  lutealPhaseLength: 14
};

const MIN_CYCLE_DAYS = 15;   // un "ciclo" más corto suele ser un registro partido
const MAX_CYCLE_DAYS = 90;   // más largo suele ser un hueco sin registrar

/* ==========================================
   FECHAS (YYYY-MM-DD, sin husos horarios)
   ========================================== */

export function isValidISO(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const ms = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  // Rechaza 2026-02-31 (Date lo convertiría en marzo)
  return new Date(ms).toISOString().slice(0, 10) === text;
}

export function isoToMs(iso) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : NaN;
}

export function msToISO(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysISO(iso, days) {
  const ms = isoToMs(iso);
  if (!Number.isFinite(ms)) return '';
  return msToISO(ms + Number(days || 0) * DAY_MS);
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(fromISO, toISO) {
  const a = isoToMs(fromISO);
  const b = isoToMs(toISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

/* ==========================================
   ESTADÍSTICA BÁSICA
   ========================================== */

export function average(values = []) {
  const list = values.filter((v) => Number.isFinite(v));
  if (!list.length) return null;
  return list.reduce((sum, v) => sum + v, 0) / list.length;
}

export function median(values = []) {
  const list = values.filter((v) => Number.isFinite(v)).toSorted((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

export function stdev(values = []) {
  const mean = average(values);
  const list = values.filter((v) => Number.isFinite(v));
  if (mean === null || list.length < 2) return 0;
  const variance = list.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (list.length - 1);
  return Math.sqrt(variance);
}

/**
 * Media ponderada: el dato más reciente pesa 1 y cada anterior
 * `decay` veces menos (0.75 → 0.75, 0.56, 0.42…). Da más peso a lo
 * reciente sin tirar el historial.
 */
export function weightedAverage(values = [], decay = 0.75) {
  const list = values.filter((v) => Number.isFinite(v));
  if (!list.length) return null;
  let weighted = 0;
  let total = 0;
  list.forEach((value, i) => {
    const weight = Math.pow(decay, list.length - 1 - i);
    weighted += value * weight;
    total += weight;
  });
  return total ? weighted / total : null;
}

/* ==========================================
   NORMALIZACIÓN
   ========================================== */

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(settings = {}) {
  return {
    avgCycleLength: clampInt(settings.avgCycleLength ?? settings.avg_cycle_length, 15, 90, DEFAULT_SETTINGS.avgCycleLength),
    avgPeriodLength: clampInt(settings.avgPeriodLength ?? settings.avg_period_length, 1, 15, DEFAULT_SETTINGS.avgPeriodLength),
    lutealPhaseLength: clampInt(settings.lutealPhaseLength ?? settings.luteal_phase_length, 7, 20, DEFAULT_SETTINGS.lutealPhaseLength)
  };
}

/** Periodos ordenados y saneados: { id, start, end, confirmed, notes }. */
export function normalizePeriods(periods = []) {
  return (periods || [])
    .filter((p) => isValidISO(p?.start_date || p?.start))
    .map((p) => {
      const start = p.start_date || p.start;
      const rawEnd = p.end_date || p.end || null;
      const end = isValidISO(rawEnd) && rawEnd >= start ? rawEnd : null;
      return {
        id: p.id || null,
        start,
        end,
        confirmed: p.is_confirmed !== false,
        notes: p.notes || ''
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Duraciones entre inicios consecutivos (solo ciclos plausibles). */
export function cycleLengths(periods = []) {
  const starts = normalizePeriods(periods).map((p) => p.start);
  const out = [];
  for (let i = 1; i < starts.length; i += 1) {
    const length = daysBetween(starts[i - 1], starts[i]);
    if (Number.isFinite(length) && length >= MIN_CYCLE_DAYS && length <= MAX_CYCLE_DAYS) out.push(length);
  }
  return out;
}

/** Duración de cada menstruación. Un periodo abierto dura hasta `today`. */
export function periodDurations(periods = [], today = null) {
  const out = [];
  for (const p of normalizePeriods(periods)) {
    if (p.end) {
      const length = daysBetween(p.start, p.end) + 1;
      if (length >= 1 && length <= 20) out.push(length);
    } else if (isValidISO(today) && today >= p.start) {
      const length = daysBetween(p.start, today) + 1;
      if (length >= 1 && length <= 20) out.push(length);
    }
  }
  return out;
}

/* ==========================================
   FIABILIDAD
   ========================================== */

export function confidenceFor(lengths = [], spread = 0) {
  const cycles = lengths.length;
  if (!cycles) {
    return {
      level: 'none',
      label: 'Sin datos suficientes',
      cycles: 0,
      spread: 0,
      explanation: 'Todavía no hay un ciclo cerrado. Apunta el inicio de tu regla y el del siguiente y empiezo a calcular.'
    };
  }
  if (cycles < 3 || spread > 9) {
    return {
      level: 'low',
      label: 'Orientativa',
      cycles,
      spread,
      explanation: cycles < 2
        ? 'Con un solo ciclo no puedo ver cuánto te varía. De momento uso tu duración habitual.'
        : cycles < 3
          ? `Tengo ${cycles} ciclos apuntados: aún es pronto para ver cuánto te varían.`
          : `Tus ciclos varían ${spread} días entre sí, así que la fecha puede moverse. Iré afinándola con cada uno.`
    };
  }
  if (cycles < 6 || spread > 5) {
    return {
      level: 'medium',
      label: 'Bastante ajustada',
      cycles,
      spread,
      explanation: `Tengo ${cycles} ciclos apuntados y entre uno y otro varían ${spread} días. Con cada ciclo nuevo la fecha se ajusta un poco más.`
    };
  }
  return {
    level: 'high',
          label: 'Muy ajustada',
      cycles,
      spread,
      explanation: `Con ${cycles} ciclos y solo ${spread} días de diferencia entre ellos, la fecha está bien ajustada. Aun así es una estimación, no una promesa.`
  };
}

/* ==========================================
   FASE DEL CICLO
   ========================================== */

function phaseFor({ day, last, currentOvulation, avgPeriod, cycleDay }) {
  if (!last || !cycleDay) return { id: 'none', label: 'Sin datos', hint: 'Registra el inicio de tu menstruación.' };
  if (cycleDay <= avgPeriod) {
    return { id: 'menstrual', label: 'Menstruación', hint: `Días de sangrado estimados: ${avgPeriod}.` };
  }
  if (currentOvulation) {
    const toOvulation = daysBetween(currentOvulation, day);
    if (toOvulation >= -1 && toOvulation <= 1) {
      return { id: 'ovulation', label: 'Ovulación estimada', hint: 'Es una estimación, no una garantía de fertilidad.' };
    }
    if (toOvulation >= -5 && toOvulation < -1) {
      return { id: 'fertile', label: 'Ventana fértil estimada', hint: 'Aproximada. No sirve como método anticonceptivo.' };
    }
    if (toOvulation > 1) {
      return { id: 'luteal', label: 'Fase lútea', hint: `Desde la ovulación hasta el siguiente periodo (${avgPeriod} días de sangrado previstos).` };
    }
  }
  return { id: 'follicular', label: 'Fase folicular', hint: 'Desde el final del sangrado hasta la ovulación estimada.' };
}

/* ==========================================
   PREDICCIÓN
   ========================================== */

export function computeCycle({ periods = [], settings = {}, today } = {}) {
  const cfg = normalizeSettings(settings);
  const day = isValidISO(today) ? today : msToISO(Date.now());
  const list = normalizePeriods(periods);
  const lengths = cycleLengths(list);
  const durations = periodDurations(list, day);

  const weightedCycle = weightedAverage(lengths);
  const avgCycle = lengths.length ? Math.round(weightedCycle) : cfg.avgCycleLength;
  const avgPeriod = durations.length ? Math.round(average(durations)) : cfg.avgPeriodLength;

  const last = list.length ? list[list.length - 1] : null;
  const rawNext = last ? addDaysISO(last.start, avgCycle) : null;

  // Si la fecha estimada ya pasó sin registro, se avanza el calendario
  // (nunca se inventa un registro, solo se estima el siguiente ciclo).
  let nextStart = rawNext;
  let cyclesAhead = 0;
  while (nextStart && daysBetween(nextStart, day) > 0 && cyclesAhead < 24) {
    nextStart = addDaysISO(nextStart, avgCycle);
    cyclesAhead += 1;
  }

  const daysUntilNext = nextStart ? daysBetween(day, nextStart) : null;
  const daysLate = rawNext ? Math.max(0, daysBetween(rawNext, day)) : 0;
  const cycleDay = last ? daysBetween(last.start, day) + 1 : null;

  const currentOvulation = last ? addDaysISO(last.start, avgCycle - cfg.lutealPhaseLength) : null;
  const ovulation = nextStart ? addDaysISO(nextStart, -cfg.lutealPhaseLength) : null;
  const fertileStart = ovulation ? addDaysISO(ovulation, -5) : null;
  const fertileEnd = ovulation ? addDaysISO(ovulation, 1) : null;
  const currentFertileStart = currentOvulation ? addDaysISO(currentOvulation, -5) : null;
  const currentFertileEnd = currentOvulation ? addDaysISO(currentOvulation, 1) : null;

  const spread = lengths.length ? Math.max(...lengths) - Math.min(...lengths) : 0;
  const confidence = confidenceFor(lengths, spread);
  const phase = phaseFor({ day, last, currentOvulation, avgPeriod, cycleDay });

  return {
    today: day,
    hasData: !!last,
    lastStart: last ? last.start : null,
    lastEnd: last ? last.end : null,
    cycleDay,
    avgCycle,
    avgPeriod,
    luteal: cfg.lutealPhaseLength,
    cycle: {
      count: lengths.length,
      values: lengths,
      avg: lengths.length ? Number(average(lengths).toFixed(1)) : null,
      median: lengths.length ? median(lengths) : null,
      min: lengths.length ? Math.min(...lengths) : null,
      max: lengths.length ? Math.max(...lengths) : null,
      spread,
      stdev: Number(stdev(lengths).toFixed(1))
    },
    period: {
      count: durations.length,
      values: durations,
      avg: durations.length ? Number(average(durations).toFixed(1)) : null
    },
    nextStart,
    daysUntilNext,
    daysLate,
    isOverdue: daysLate > 0,
    ovulation,
    fertileStart,
    fertileEnd,
    currentOvulation,
    currentFertileStart,
    currentFertileEnd,
    phase,
    confidence,
    irregular: lengths.length >= 3 && spread > 7,
    estimated: true
  };
}

/**
 * Rangos estimados de los próximos ciclos (menstruación, ovulación y
 * ventana fértil), para pintar el calendario. Solo hacia delante.
 */
export function estimatedPeriods({ periods = [], settings = {}, today, count = 6 } = {}) {
  const cycle = computeCycle({ periods, settings, today });
  if (!cycle.nextStart) return [];
  const ranges = [];
  let start = cycle.nextStart;
  for (let i = 0; i < count; i += 1) {
    const end = addDaysISO(start, Math.max(1, cycle.avgPeriod) - 1);
    const ovulation = addDaysISO(start, -cycle.luteal);
    ranges.push({
      start,
      end,
      ovulation,
      fertileStart: addDaysISO(ovulation, -5),
      fertileEnd: addDaysISO(ovulation, 1),
      estimated: true
    });
    start = addDaysISO(start, cycle.avgCycle);
  }
  return ranges;
}

/** Día del ciclo de una fecha, según el último inicio anterior. */
export function cycleDayFor(dateISO, periods = []) {
  if (!isValidISO(dateISO)) return null;
  const starts = normalizePeriods(periods).map((p) => p.start).filter((start) => start <= dateISO);
  if (!starts.length) return null;
  const last = starts[starts.length - 1];
  return daysBetween(last, dateISO) + 1;
}

/* ==========================================
   ESTADÍSTICAS
   ========================================== */

export function filterSince({ periods = [], logs = [] }, sinceISO) {
  if (!isValidISO(sinceISO)) return { periods, logs };
  return {
    periods: (periods || []).filter((p) => (p.start_date || p.start) >= sinceISO),
    logs: (logs || []).filter((l) => (l.log_date || l.date) >= sinceISO)
  };
}

function countBy(items = [], keyFn, valueFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const value = valueFn ? valueFn(item) : key;
    const entry = counts.get(key) || { id: key, count: 0, total: 0, label: value };
    entry.count += 1;
    entry.total += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function computeStats({ periods = [], logs = [] } = {}) {
  const list = normalizePeriods(periods);
  const lengths = cycleLengths(list);
  const durations = periodDurations(list, msToISO(Date.now()));
  const safeLogs = (logs || []).filter((l) => isValidISO(l?.log_date || l?.date));

  const flowCounts = countBy(
    safeLogs.filter((l) => l.flow),
    (l) => l.flow
  );

  const symptomTotals = new Map();
  for (const log of safeLogs) {
    for (const symptom of log.symptoms || []) {
      const entry = symptomTotals.get(symptom) || { id: symptom, count: 0, daysSum: 0, cycleSum: 0 };
      entry.count += 1;
      const cycleDay = cycleDayFor(log.log_date || log.date, list);
      if (cycleDay) {
        entry.daysSum += 1;
        entry.cycleSum += cycleDay;
      }
      symptomTotals.set(symptom, entry);
    }
  }
  const symptoms = [...symptomTotals.values()]
    .map((entry) => ({
      id: entry.id,
      count: entry.count,
      avgCycleDay: entry.daysSum ? Math.round(entry.cycleSum / entry.daysSum) : null
    }))
    .sort((a, b) => b.count - a.count);

  const moodTotals = new Map();
  for (const log of safeLogs) {
    for (const mood of log.mood || []) {
      moodTotals.set(mood, (moodTotals.get(mood) || 0) + 1);
    }
  }
  const moods = [...moodTotals.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  return {
    cycles: {
      count: lengths.length,
      values: lengths,
      avg: lengths.length ? Number(average(lengths).toFixed(1)) : null,
      median: lengths.length ? median(lengths) : null,
      min: lengths.length ? Math.min(...lengths) : null,
      max: lengths.length ? Math.max(...lengths) : null,
      spread: lengths.length ? Math.max(...lengths) - Math.min(...lengths) : 0
    },
    periods: {
      count: durations.length,
      values: durations,
      avg: durations.length ? Number(average(durations).toFixed(1)) : null,
      min: durations.length ? Math.min(...durations) : null,
      max: durations.length ? Math.max(...durations) : null
    },
    flow: flowCounts,
    symptoms,
    moods,
    logs: safeLogs.length
  };
}
