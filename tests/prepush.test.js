import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandCalendarCatalog } from '../personal-hub/src/data/calendar-expansion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function projectPath(...parts) {
  return path.join(ROOT, ...parts);
}

test('el catálogo expandido cubre del 15 de agosto al 31 de diciembre', () => {
  const catalog = expandCalendarCatalog({});
  const dates = [];
  for (const [monthKey, month] of Object.entries(catalog.months)) {
    for (const [day, giftId] of Object.entries(month.calendarMapping || {})) {
      if (giftId) dates.push(`${monthKey}-${String(day).padStart(2, '0')}`);
    }
  }

  assert.equal(dates.length, 139);
  const numericDates = dates.map(date => Number(date.replaceAll('-', '')));
  assert.equal(Math.min(...numericDates), Number('20260815'));
  assert.equal(Math.max(...numericDates), Number('20261231'));
  assert.equal(new Set(dates).size, dates.length);
});

test('los juegos del calendario apuntan a archivos existentes', () => {
  const catalog = expandCalendarCatalog({});
  const gameGifts = catalog.gifts.filter(gift => gift.type === 'game');

  assert.equal(gameGifts.length, 9);
  for (const gift of gameGifts) {
    assert.match(gift.redirectUrl, /^games\/[\w-]+\.html$/);
    assert.equal(existsSync(projectPath('personal-hub', 'public', gift.redirectUrl)), true, gift.redirectUrl);
  }
});

test('cada juego listado en Juegos tiene su página pública', async () => {
  const source = await readFile(projectPath('personal-hub', 'src', 'pages', 'Juegos.js'), 'utf8');
  const hrefs = [...source.matchAll(/href:\s*'([^']+\.html)'/g)].map(match => match[1]);

  assert.equal(hrefs.length, 25);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const href of hrefs) {
    const relativePath = href.replace(/^\//, '');
    assert.equal(existsSync(projectPath('personal-hub', 'public', relativePath)), true, href);
  }
});

test('la configuración no contiene secretos de cron ni fallbacks conocidos', async () => {
  const [vercel, pushApi] = await Promise.all([
    readFile(projectPath('vercel.json'), 'utf8'),
    readFile(projectPath('api', 'push.js'), 'utf8')
  ]);
  const config = JSON.parse(vercel);

  assert.equal(config.env?.CRON_SECRET, undefined);
  assert.doesNotMatch(vercel, /CRON_SECRET\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(pushApi, /daily-welcome-push/);
  assert.match(pushApi, /process\.env\.CRON_SECRET/);
});

test('los directorios locales de herramientas quedan fuera del repositorio', async () => {
  const gitignore = await readFile(projectPath('.gitignore'), 'utf8');
  assert.match(gitignore, /^\.agents\/$/m);
  assert.match(gitignore, /^\.freebuff\/$/m);
});
