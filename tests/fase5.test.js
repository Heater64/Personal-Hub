/* ==========================================
   Fase 5 · Pro sin migraciones

   Dos capas: los cálculos puros (pro-insights) y los contratos de las
   pantallas que los usan, para que un refactor no se lleve por delante la
   razón del día, los récords, la watchlist o los widgets nuevos.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpenWhenWidget, getReasonWidget } from '../api/_widget-content.js';
import { LETTERS } from '../tamp/src/data/openwhen-seed.data.js';
import { OPENWHEN_READ_PREFIX } from '../tamp/src/utils/stats-metrics.js';

import {
  gameRecords,
  bestStreak,
  lastNDays,
  reasonOfDay,
  sameDayInPast,
  parsePhotoDate,
  GAME_RECORDS,
} from '../tamp/src/utils/pro-insights.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(ROOT, relative), 'utf8');
const exists = relative => access(path.join(ROOT, relative));

/* ---------- cálculos ---------- */

test('los récords salen de las claves que ya escriben los minijuegos', () => {
  const fake = {
    getItem: key =>
      ({ snakeHighScore: '120', memoriaBest: '75', tetrisHighScore: '0' })[key] ?? null,
  };
  const records = gameRecords(fake);

  assert.equal(records.length, 2, 'solo los récords jugados y mayores que cero');
  assert.deepEqual(
    records.map(r => r.id),
    ['snake', 'memoria']
  );
  assert.equal(records[0].text, '120');
  assert.equal(records[1].text, '1:15', 'los segundos se pintan como tiempo');
  assert.equal(records[1].mejor, 'bajo');
  assert.ok(GAME_RECORDS.every(record => record.key && record.unit));
  assert.equal(gameRecords(null).length, 0);
});

test('la mejor racha cuenta días consecutivos, no días sueltos', () => {
  const history = {
    '2026-03-01': 'happy',
    '2026-03-02': 'calm',
    '2026-03-04': 'happy',
    '2026-03-05': 'happy',
    '2026-03-06': 'happy',
    '2026-03-09': null,
  };

  assert.equal(bestStreak(history), 3);
  assert.equal(bestStreak({}), 0);
});

test('la tira de 14 días termina hoy y respeta los huecos', () => {
  const strip = lastNDays({ '2026-03-10': 'happy' }, 14, '2026-03-10');

  assert.equal(strip.length, 14);
  assert.equal(strip.at(-1).date, '2026-03-10');
  assert.equal(strip.at(-1).mood, 'happy');
  assert.equal(strip[0].date, '2026-02-25');
  assert.equal(strip[0].mood, null);
});

test('la razón del día es estable durante el día y cambia de una lista a otra', () => {
  const list = [{ text: 'una' }, { text: 'dos' }, { text: 'tres' }];
  const a = reasonOfDay(list, '2026-11-19');
  const b = reasonOfDay(list, '2026-11-19');

  assert.equal(a.item.text, b.item.text);
  assert.equal(a.date, '2026-11-19');
  assert.equal(reasonOfDay([], '2026-11-19'), null);
});

function widgetContentDatabase(content, visits = []) {
  return {
    from(table) {
      if (table === 'content') {
        return {
          select() { return this; },
          eq(_field, id) {
            return {
              async maybeSingle() { return { data: content[id] ? { data: content[id] } : null }; },
            };
          },
        };
      }
      assert.equal(table, 'analytics_visits');
      return {
        select() { return this; },
        eq(field, userId) {
          assert.equal(field, 'user_id');
          const owned = visits.filter(visit => visit.user_id === userId);
          return {
            like(column, pattern) {
              assert.equal(column, 'page');
              const matching = owned.filter(visit => visit.page.startsWith(pattern.slice(0, -1)));
              return {
                order(column) {
                  assert.equal(column, 'id');
                  return {
                    async range(start, end) { return { data: matching.slice(start, end + 1) }; },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('el widget de razón usa el día indicado y respeta fechas de desbloqueo y listas vacías', async () => {
  const today = '2026-07-17';
  const db = widgetContentDatabase({
    razones: { reasons: [{ text: 'futura', date: '2026-07-18' }, { reason: ' disponible ', date: today }] },
  });
  assert.deepEqual(await getReasonWidget(db, 'a', { role: 'admin' }, today), { text: 'disponible', date: today });
  assert.equal(await getReasonWidget(db, 'a', { role: 'user' }, '2026-07-16'), null);
  assert.equal(await getReasonWidget(
    widgetContentDatabase({ razones: { reasons: [] } }), 'a', { role: 'user' }, today
  ), null);
});

test('el widget de Open When filtra borradores y descontabiliza solo lecturas de la misma cuenta', async () => {
  const draft = { id: 'primer-borrador', category: 'noche', status: 'pronto' };
  const read = { id: 'leida', category: 'amor' };
  const next = { id: 'sin-leer', category: 'alegria' };
  const hiddenSeed = LETTERS.find(letter => letter.status !== 'pronto');
  const db = widgetContentDatabase({
    openwhen_letters: { letters: [draft, read, next, { ...hiddenSeed, status: 'pronto' }] },
  }, [
    ...Array.from({ length: 500 }, () => ({ user_id: 'ella', page: `${OPENWHEN_READ_PREFIX}otra` })),
    { user_id: 'ella', page: `${OPENWHEN_READ_PREFIX}${read.id}` },
    { user_id: 'él', page: `${OPENWHEN_READ_PREFIX}${next.id}` },
  ]);
  const visibleSeedCount = LETTERS.filter(letter => letter.status !== 'pronto').length - 1;
  assert.deepEqual(await getOpenWhenWidget(db, 'ella', { role: 'user' }), {
    pending: visibleSeedCount + 1, category: 'alegria', emoji: '🥰',
  });
  assert.deepEqual(await getOpenWhenWidget(db, 'él', { role: 'admin' }), {
    pending: LETTERS.length + 2, category: 'noche', emoji: '🌙',
  });
});

test('«un año hoy» solo trae fotos del mismo día de años anteriores', () => {
  const photos = [
    { url: 'a.jpg', dateText: '19 nov 2024' },
    { url: 'b.jpg', dateText: '19 nov 2026' },
    { url: 'c.jpg', dateText: '3 jul 2025' },
    { url: 'd.jpg', dateText: '19 nov 2023' },
  ];
  const matches = sameDayInPast(photos, '2026-11-19');

  assert.deepEqual(
    matches.map(photo => photo.url),
    ['a.jpg', 'd.jpg'],
    'sin la foto de este año y ordenadas por antigüedad'
  );
  assert.equal(matches[0].yearsAgo, 2);
  assert.equal(matches[1].yearsAgo, 3);
  assert.deepEqual(parsePhotoDate('3 jul 2026'), { day: 3, month: 7, year: 2026 });
  assert.equal(parsePhotoDate('sin fecha'), null);
});

/* ---------- pantallas ---------- */

test('Sentimientos añade mejor racha, tira de días y widget', async () => {
  const page = await read('tamp/src/pages/Sentimientos.js');

  assert.match(page, /import \{ bestStreak, lastNDays \}/);
  assert.match(page, /best: bestStreak\(historyMap\)/);
  assert.match(page, /recent: lastNDays\(historyMap, 14, todayISO\(\)\)/);
  assert.match(page, /mejor racha/);
  assert.match(page, /pro-strip/);
  assert.match(page, /saveStreakWidget\(\{ days: stats\.streak, best: stats\.best \}\)/);
});

test('Razones pinta la razón del día con el helper y la guarda para el widget', async () => {
  const page = await read('tamp/src/pages/Razones.js');

  assert.match(page, /import \{ reasonOfDay \}/);
  assert.match(page, /id="razonDelDia"/);
  assert.match(page, /Razón del día/);
  assert.match(page, /reasonOfDay\(abiertas, todayISO\(\)\)/);
  assert.match(page, /saveReasonWidget\(\{ text: pick\.item\.text/);
});

test('Juegos lee los récords de localStorage sin tocar los juegos', async () => {
  const page = await read('tamp/src/pages/Juegos.js');

  assert.match(page, /import \{ gameRecords \}/);
  assert.match(page, /gameRecords\(typeof localStorage !== 'undefined'/);
  assert.match(page, /Récords/);
  assert.match(page, /pro-record/);
});

test('Inicio monta «Un año hoy» con las fotos que ya existen', async () => {
  const page = await read('tamp/src/pages/Home.js');

  assert.match(page, /import \{ visiblePhotos, photoDate \}/);
  assert.match(page, /sameDayInPast\(photos, todayISO\(\)\)/);
  assert.match(page, /Tal día como hoy/);
  assert.match(page, /\$\{yearAgoHTML\(\)\}/);
});

test('Juntos añade próximas fechas y estado del móvil de la otra persona', async () => {
  const page = await read('tamp/src/pages/Juntos.js');

  assert.match(page, /upcomingSpecialDates\(3\)/);
  assert.match(page, /import \{ fetchPartnerLocation \}/);
  assert.match(page, /id="juntosDevice"/);
  assert.match(page, /async function fillPartnerDevice\(\)/);
  assert.match(page, /void fillPartnerDevice\(\)/);
  assert.match(page, /loc\.charging/);
});

test('la watchlist compartida vive en una fila de `content` y se edita desde Series', async () => {
  const service = await read('tamp/src/services/pro.service.js');
  const page = await read('tamp/src/pages/Series.js');

  assert.match(service, /const DOC_ID = 'series_watchlist'/);
  assert.match(service, /from\('content'\)/);
  assert.match(service, /onConflict: 'id'/);
  assert.match(service, /export function toggleInWatchlist/);
  assert.match(page, /loadSharedWatchlist/);
  assert.match(page, /id="srSharedWatchlist"/);
  assert.match(page, /id="srWatchlistBtn"/);
});

test('los tres widgets nuevos tienen datos, hoja y lado nativo', async () => {
  const service = await read('tamp/src/services/widgets.service.js');
  const sheet = await read('tamp/src/components/WidgetsSheet.js');
  const renderer = await read(
    'android/app/src/main/java/com/heater64/personalhub/WidgetRenderer.java'
  );
  const manifest = await read('android/app/src/main/AndroidManifest.xml');

  for (const fn of ['saveReasonWidget', 'saveOpenWhenWidget', 'saveStreakWidget']) {
    assert.match(service, new RegExp(`export async function ${fn}`));
  }
  assert.match(service, /reason: KEY_REASON/);
  assert.match(service, /openwhen: KEY_OPENWHEN/);
  assert.match(service, /streak: KEY_STREAK/);

  for (const id of ['reason', 'openwhen', 'streak']) {
    assert.match(sheet, new RegExp(`id: '${id}'`));
  }

  assert.match(renderer, /static void renderProText/);
  assert.match(renderer, /"widget_reason"\.equals\(key\)/);
  assert.match(renderer, /"widget_openwhen"\.equals\(key\)/);
  assert.match(renderer, /R\.plurals\.widget_streak_days/);

  for (const provider of [
    'ReasonRectWidgetProvider',
    'ReasonCompactWidgetProvider',
    'OpenWhenRectWidgetProvider',
    'OpenWhenCompactWidgetProvider',
    'StreakRectWidgetProvider',
    'StreakCompactWidgetProvider',
  ]) {
    assert.match(manifest, new RegExp(`\\.${provider}`));
    await exists(`android/app/src/main/java/com/heater64/personalhub/${provider}.java`);
  }

  await exists('android/app/src/main/res/layout/widget_pro_rect.xml');
  await exists('android/app/src/main/res/layout/widget_pro_compact.xml');
});

test('las miniaturas de los tres widgets nuevos nunca salen vacías', async () => {
  const sheet = await read('tamp/src/components/WidgetsSheet.js');
  const css = await read('tamp/src/styles/home.css');

  assert.match(sheet, /const PREVIEW_SAMPLES = \{/);
  for (const id of ['reason', 'openwhen', 'streak']) {
    assert.match(
      sheet,
      new RegExp(`${id}: ${id} \\|\\| saved\\('${id}'\\) \\|\\| PREVIEW_SAMPLES\\.${id}`),
      `${id} cae al ejemplo neutro cuando no hay paquete guardado`
    );
  }
  assert.match(sheet, /wprev__pro-text--sm/);
  assert.match(css, /\.wprev__pro-text--sm \{/);
});

test('Open When deja en el widget las cartas que quedan por descubrir', async () => {
  const page = await read('tamp/src/pages/OpenWhen.js');

  assert.match(page, /import \{ saveOpenWhenWidget \}/);
  assert.match(page, /pending: newTotal\(\)/);
  assert.match(page, /savePendingWidget\(\);/);
});
