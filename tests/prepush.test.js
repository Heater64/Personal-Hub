import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandCalendarCatalog } from '../personal-hub/src/data/calendar-expansion.js';
import { selectDistinctSuggestions } from '../personal-hub/src/utils/discoverSuggestions.js';

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

test('el carrusel Descubre hoy no repite destinos y respeta el límite', () => {
  const options = [
    { title: 'Atardecer', internal: true, sectionId: 'galeria-memes' },
    { title: 'Memes', internal: true, sectionId: 'galeria-memes' },
    { title: 'Curiosidades', internal: true, sectionId: 'curiosidades' },
    { title: 'Juegos', route: '/juegos' },
    { title: 'Series', route: '/series' }
  ];

  const suggestions = selectDistinctSuggestions(options, 3, () => 0);

  assert.deepEqual(suggestions.map(item => item.title), ['Atardecer', 'Curiosidades', 'Juegos']);
  assert.equal(new Set(suggestions.map(item => item.sectionId || item.route)).size, 3);
  assert.deepEqual(selectDistinctSuggestions(options, 8, () => 0).map(item => item.title), [
    'Atardecer', 'Curiosidades', 'Juegos', 'Series'
  ]);
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

  assert.equal(hrefs.length, 19);
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

test('las políticas de playlists y telemetría aíslan al usuario autenticado', async () => {
  const schema = await readFile(projectPath('supabase-schema.sql'), 'utf8');
  const migration = await readFile(projectPath('sql', '016_aislamiento_playlists.sql'), 'utf8');

  assert.doesNotMatch(schema, /CREATE POLICY "playlists_(read_all|write_all|update_all|delete_all)"/);
  assert.match(schema, /playlists_select_owner/);
  assert.match(schema, /created_by = auth\.uid\(\)/);
  assert.match(schema, /activity_log_insert_own/);
  assert.match(schema, /analytics_visits_insert_own/);
  assert.match(schema, /analytics_events_insert_own/);
  assert.match(schema, /NEW\.enabled IS DISTINCT FROM OLD\.enabled/);
  assert.match(schema, /email_confirmed_at IS NOT NULL/);
  assert.match(migration, /playlists_select_owner/);

  const reglas = await readFile(projectPath('sql', '000_Reglas.sql'), 'utf8');
  assert.match(reglas, /email_confirmed_at IS NOT NULL/);
});

test('la sincronización no referencia una variable local inexistente', async () => {
  const source = await readFile(projectPath('personal-hub', 'src', 'services', 'sync.service.js'), 'utf8');
  assert.doesNotMatch(source, /hasData\(local\)/);
  assert.match(source, /hasData\(readLocal\(\)\)/);
});

test('la API de push exige sesión para desuscribirse y admite cron GET', async () => {
  const pushApi = await readFile(projectPath('api', 'push.js'), 'utf8');
  assert.match(pushApi, /action === 'send' && !\['GET', 'POST'\]\.includes\(req\.method\)/);
  assert.match(pushApi, /if \(!token\) return res\.status\(401\)/);
  assert.doesNotMatch(pushApi, /else if \(endpoint\)/);
  assert.match(pushApi, /!\[7, 8\]\.includes\(hourInSpain\(\)\)/);
  assert.match(pushApi, /email_confirmed_at/);
});

test('la familia azul existe como override por data-tema (modo intacto)', async () => {
  const css = await readFile(projectPath('personal-hub', 'src', 'styles', 'design-tokens.css'), 'utf8');
  for (const s of ['[data-tema="azul"]', '#2563EB', '#7DB7FF']) assert.match(css, new RegExp(s.replace(/[[\]]/g, '\\$&')));
  assert.match(css, /\[data-theme="light"\]/);
});

test('el servicio de temas maneja 4 paletas con escritura dual y legacy', async () => {
  const svc = await readFile(projectPath('personal-hub', 'src', 'services', 'theme.service.js'), 'utf8');
  for (const s of ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro', 'dataset.tema', 'dataset.theme']) assert.ok(svc.includes(s));
  const boot = await readFile(projectPath('personal-hub', 'index.html'), 'utf8');
  assert.ok(boot.includes('dataset.tema'));
});

test('el arranque resuelve el modo por SO cuando no hay tema guardado', async () => {
  const boot = await readFile(projectPath('personal-hub', 'index.html'), 'utf8');
  assert.ok(!boot.includes('if (!t) return'));
  assert.ok(boot.includes('prefers-color-scheme'));
});

test('perfil y admin ofrecen las 4 paletas + auto', async () => {
  const profile = await readFile(projectPath('personal-hub', 'src', 'pages', 'Profile.js'), 'utf8');
  for (const s of ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro']) assert.ok(profile.includes(s));
  const admin = await readFile(projectPath('personal-hub', 'src', 'pages', 'Admin.js'), 'utf8');
  for (const s of ['umbra-oscuro', 'umbra-claro', 'azul-claro', 'azul-oscuro']) assert.ok(admin.includes(s));
});

test('pageheader umbra con tokens y barra movil contextual', async () => {
  const comp = await readFile(projectPath('personal-hub', 'src', 'components', 'PageHeader.js'), 'utf8');
  assert.ok(comp.includes('renderPageHeader'));
  assert.ok(comp.includes('<h1'));
  const css = await readFile(projectPath('personal-hub', 'src', 'styles', 'page-header.css'), 'utf8');
  assert.ok(!css.includes('#') || css.includes('rgba('));
});
