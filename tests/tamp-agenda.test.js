/* ==========================================
   Tests de contrato — Tamp: calendario, sorpresas y Mal Día

   La privacidad de las sorpresas no puede depender de que la interfaz
   esconda tarjetas: vive en la política de lectura de `tamp_entries`. Si
   alguien la reescribe «para simplificar», el otro miembro de la pareja
   empieza a ver los regalos y ningún test de la app se entera.

   Capas: el SQL de la migración, la documentación que se lee antes de
   aplicarla, las tres pantallas y el buscador global.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buscarModulos, modulos } from '../tamp/src/data/search.data.js';
import {
  giftStateMeta,
  offeredGiftStates,
  storableGiftState,
} from '../tamp/src/utils/gift-states.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);
const read = (...parts) => readFile(projectPath(...parts), 'utf8');
const migration = () => read('sql', '034_agenda_tamp.sql');

test('034 crea tamp_entries con RLS y sin acceso anónimo', async () => {
  const sql = await migration();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.tamp_entries/);
  assert.match(sql, /ALTER TABLE public\.tamp_entries ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.tamp_entries FROM PUBLIC, anon, authenticated/);
  for (const kind of ['event', 'surprise', 'feeling']) {
    assert.ok(sql.includes(`'${kind}'`), `falta el tipo ${kind}`);
  }
});

test('las sorpresas solo las lee su autor; el resto, la pareja', async () => {
  const sql = await migration();
  assert.match(
    sql,
    /CREATE POLICY tamp_entries_read[\s\S]*?couple_id=public\.current_couple_id\(\)/
  );
  assert.match(sql, /kind <> 'surprise' OR author_id=auth\.uid\(\)/);

  // Las dos puertas de escritura (alta y edición) comprueban pareja,
  // cuenta habilitada y autoría.
  const policies = sql.match(/CREATE POLICY tamp_entries_(?:add|edit)[\s\S]*?\);/g) || [];
  assert.equal(policies.length, 2, 'faltan las políticas de alta o edición');
  for (const policy of policies) {
    assert.match(policy, /public\.is_enabled\(\)/);
    assert.match(policy, /couple_id=public\.current_couple_id\(\)/);
    assert.match(policy, /author_id=auth\.uid\(\)/);
  }
});

test('solo el admin crea y edita los eventos del calendario compartido', async () => {
  const sql = await migration();
  assert.match(
    sql,
    /CREATE POLICY tamp_entries_add[\s\S]*?kind <> 'event' OR public\.is_admin\(\)/
  );
  assert.match(
    sql,
    /CREATE POLICY tamp_entries_edit[\s\S]*?CASE WHEN kind='event' THEN public\.is_admin\(\) ELSE author_id=auth\.uid\(\) END/
  );
});

test('el cliente no puede reescribir la autoría ni saltarse la papelera', async () => {
  const sql = await migration();
  const insert = sql.match(/GRANT INSERT \(([^)]*)\) ON (?:TABLE )?public\.tamp_entries TO authenticated/);
  const update = sql.match(/GRANT UPDATE \(([^)]*)\) ON (?:TABLE )?public\.tamp_entries TO authenticated/);
  assert.ok(insert, 'falta el GRANT INSERT por columnas');
  assert.ok(update, 'falta el GRANT UPDATE por columnas');

  for (const columns of [insert[1], update[1]]) {
    assert.doesNotMatch(columns, /author_id|couple_id|created_at|updated_at/);
  }
  assert.match(sql, /removed_at > now\(\)-interval '30 days'/);
});

test('034 está documentada donde se busca antes de aplicarla', async () => {
  const readme = await read('sql', 'README.md');
  assert.ok(readme.includes('034_agenda_tamp.sql'), 'sql/README.md debe listar la 034');
  assert.ok(readme.includes('tamp_entries'), 'sql/README.md debe explicar qué crea');
});

test('035 añade presupuesto, enlace y foto sin tocar la privacidad', async () => {
  const sql = await read('sql', '035_sorpresas_regalos.sql');

  for (const column of ['price', 'link', 'photo']) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`), `falta la columna ${column}`);
  }

  // 034 concede INSERT/UPDATE por columnas: sin estos GRANT la app leería
  // los campos pero no podría guardarlos.
  assert.match(sql, /GRANT INSERT \(price, link, photo\) ON (?:TABLE )?public\.tamp_entries TO authenticated/);
  assert.match(sql, /GRANT UPDATE \(price, link, photo\) ON (?:TABLE )?public\.tamp_entries TO authenticated/);

  // Los campos son de una sorpresa: ni un evento compartido ni un Mal Día.
  assert.match(sql, /kind = 'surprise' OR \(price IS NULL AND link = '' AND photo = ''\)/);

  // Esta migración no reescribe la RLS de 034: la privacidad no se toca.
  assert.doesNotMatch(sql, /CREATE POLICY|DROP POLICY|ROW LEVEL SECURITY/);

  const readme = await read('sql', 'README.md');
  assert.ok(readme.includes('035_sorpresas_regalos.sql'), 'sql/README.md debe listar la 035');
});

test('036 ata los archivos al espacio y al tipo permitido', async () => {
  const sql = await read('sql', '036_tamp_media.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.tamp_media/);
  assert.match(sql, /public_id LIKE 'tamp\/' \|\| couple_id::text/);
  assert.match(sql, /ALTER TABLE public\.tamp_media ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /visibility = 'shared' OR author_id = auth\.uid\(\)/);
  const api = await read('api', 'tamp-media.js');
  assert.match(api, /CLOUDINARY_API_SECRET/);
  assert.match(api, /type: 'authenticated'/);
});

test('039 arregla el CHECK de estados y publica su sonda', async () => {
  const sql = await read('sql', '039_sorpresas_estados_check.sql');

  // El CHECK de 034 nació sin nombre y Postgres lo llamó tamp_entries_check1;
  // borrar solo `tamp_entries_state_check` dejaba vivo el viejo. La 039 los
  // busca todos por su definición, no por su nombre.
  assert.match(sql, /FROM pg_constraint/);
  assert.match(sql, /pg_get_constraintdef\(oid\) ILIKE '%state%'/);
  assert.match(sql, /DROP CONSTRAINT %I/);
  assert.match(
    sql,
    /state IN \('pendiente', 'comprar', 'comprado', 'preparado', 'entregado'\)/
  );

  // Sonda que la app consulta por RPC: lee el CHECK y no escribe nada.
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.tamp_gift_states_supported\(\)/);
  assert.match(sql, /RETURNS boolean/);
  assert.match(sql, /NOT LIKE '%''comprar''%'/);
  assert.match(sql, /NOT LIKE '%''comprado''%'/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.tamp_gift_states_supported\(\) TO authenticated/
  );
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.tamp_gift_states_supported\(\)/);
});

test('sin la 039 la pantalla esconde «Por comprar» y «Comprado»', async () => {
  // La sonda pregunta a la RPC de la 039; sin ella, la app se queda sin los
  // dos estados nuevos en vez de ofrecerlos y fallar al guardar.
  const service = await read('tamp', 'src', 'services', 'agenda.js');
  assert.match(service, /export async function supportsGiftStates\(\)/);
  assert.match(service, /rpc\('tamp_gift_states_supported'\)/);

  const withExtras = { starred: true, states: false };
  assert.deepEqual(offeredGiftStates(withExtras), ['pendiente', 'entregado']);
  assert.deepEqual(offeredGiftStates({ starred: true, states: true }), [
    'pendiente',
    'comprar',
    'comprado',
    'entregado',
  ]);
  // Sin la 037 se mantiene el juego antiguo de tres valores de 034.
  assert.deepEqual(offeredGiftStates({ starred: false, states: false }), [
    'pendiente',
    'preparado',
    'entregado',
  ]);

  // Lo que se guarda tampoco puede ser un valor que el CHECK rechaza.
  assert.equal(storableGiftState('comprar', withExtras), 'pendiente');
  assert.equal(storableGiftState('comprado', withExtras), 'preparado');
  assert.equal(storableGiftState('comprar', { starred: true, states: true }), 'comprar');

  // Una fila antigua sigue mostrando su etiqueta aunque no se ofrezca.
  assert.equal(giftStateMeta('preparado').label, 'Comprado');
  assert.equal(giftStateMeta('comprar').label, 'Por comprar');

  const page = await read('tamp', 'src', 'pages', 'Sorpresas.js');
  assert.match(page, /supportsGiftStates/);
  assert.match(page, /offeredGiftStates\(/);
  assert.doesNotMatch(page, /label: 'Por comprar'/, 'las etiquetas viven en utils/gift-states.js');
});

test('sin la 035 los campos de regalo se apagan, no rompen la pantalla', async () => {
  const service = await read('tamp', 'src', 'services', 'agenda.js');
  assert.match(service, /export async function supportsGiftFields/);
  assert.match(service, /42703/, 'la sonda debe reconocer la columna inexistente');

  const page = await read('tamp', 'src', 'pages', 'Sorpresas.js');
  assert.match(page, /supportsGiftFields/);
  // Los tres valores solo viajan al escribir cuando la migración está puesta.
  assert.match(page, /\.\.\.\(giftsSupported && \{/);
});

test('las tres pantallas existen y Sentimientos lleva a ellas', async () => {
  const main = await read('tamp', 'src', 'main.js');
  assert.ok(main.includes("'/calendario'"));
  assert.ok(main.includes("'/sorpresas'"));
  assert.ok(main.includes("'/maldia'"));
  for (const page of ['SharedPage', 'SorpresasPage', 'MalDiaPage']) {
    assert.ok(main.includes(`m.${page}`), `main.js no monta ${page}`);
  }

  // Mis sorpresas se rehizo con la experiencia de regalos de DailyHub, pero
  // sigue leyendo por el servicio de la agenda: si alguien consulta
  // `tamp_entries` a mano se salta el filtro por autor que hace el servicio.
  const sorpresas = await read('tamp', 'src', 'pages', 'Sorpresas.js');
  assert.match(sorpresas, /entries\('surprise'\)/);
  assert.doesNotMatch(sorpresas, /\.from\('tamp_entries'\)/);

  const routes = await read('tamp', 'src', 'routes.js');
  for (const route of ['/calendario', '/sorpresas', '/maldia']) {
    assert.ok(routes.includes(`path: '${route}'`), `routes.js no registra ${route}`);
  }

  const sentimientos = await read('tamp', 'src', 'pages', 'Sentimientos.js');
  for (const href of ['/calendario', '/sorpresas', '/maldia']) {
    assert.ok(sentimientos.includes(`href: '${href}'`), `Sentimientos no enlaza ${href}`);
  }
});

test('el enlace directo del Calendario respeta la vista mensual', async () => {
  const main = await read('tamp', 'src', 'main.js');
  const agenda = await read('tamp', 'src', 'pages', 'Agenda.js');

  // view=month debe seguir entrando al calendario compartido y ese módulo
  // debe leer el parámetro para no abrir por defecto el resumen diario.
  assert.match(main, /if \(query\.gift \|\| query\.view === 'recibidos'\)/);
  assert.match(main, /return \(await import\('\.\/pages\/Agenda\.js'\)\.then\(m => m\.SharedPage\)\)\(router\);/);
  assert.match(agenda, /let monthView = isCalendar && router\?\.currentRoute\?\.query\?\.view === 'month';/);
});

test('Sentimientos permite varias emociones por estado y muestra la última del historial', async () => {
  const page = await read('tamp', 'src', 'pages', 'Sentimientos.js');
  const store = await read('tamp', 'src', 'stores', 'mood.store.js');

  assert.match(page, /selection = toggleMoodSelection\(selection, btn\.dataset\.mood\)/,
    'cada emoción se alterna sin borrar las demás');
  assert.match(page, /selection = toggleMoodSelection\(selection, item\)/,
    'la emoción escrita se suma a la selección');
  assert.match(page, /selection = selection\.filter\(item => item\.id !== customMood\.id\)/,
    'quitar la emoción escrita conserva las demás');
  assert.match(page, /Puedes marcar varias/,
    'la interfaz anuncia que admite selección múltiple');
  assert.match(page, /const remoteDates = new Set\(\)/,
    'el historial remoto toma solo la fila más reciente por fecha');
  assert.match(store, /\.order\('date', \{ ascending: false \}\)\s*\.order\('created_at', \{ ascending: false \}\)/,
    'Supabase entrega primero el estado más reciente de cada día');
});

test('el buscador global encuentra el calendario compartido y las sorpresas', () => {
  const paths = modulos({ isAdmin: true }).map(module => module.path);
  assert.ok(paths.includes('/calendario'), 'el buscador no indexa /calendario');
  assert.ok(paths.includes('/sorpresas'), 'el buscador no indexa /sorpresas');

  assert.equal(buscarModulos('compartido')[0]?.path, '/calendario');
  assert.equal(buscarModulos('sorpresas')[0]?.path, '/sorpresas');

  const sorpresas = modulos({ isAdmin: true }).find(module => module.path === '/sorpresas');
  assert.equal(sorpresas?.world, 'Planes', 'las sorpresas pertenecen al mundo Planes');
});

test('Inicio reutiliza nextEvent y enlaza al calendario compartido', async () => {
  const home = await read('tamp', 'src', 'pages', 'Home.js');
  assert.match(home, /from '\.\.\/services\/agenda\.js'/);
  assert.match(home, /\bnextEvent\(/);
  assert.ok(home.includes('data-route="/calendario"'), 'la tarjeta debe abrir /calendario');
  assert.doesNotMatch(
    home,
    /\.from\('tamp_entries'\)/,
    'Inicio no debe consultar tamp_entries por su cuenta: usa el servicio de la agenda'
  );
});

test('Inicio usa la última emoción de la pareja y resuelve sus avatares privados', async () => {
  const home = await read('tamp', 'src', 'pages', 'Home.js');
  const db = await read('tamp', 'src', 'services', 'db.service.js');

  assert.match(home, /sameDayInPast\(photos, todayISO\(\)\)/,
    'Tal día como hoy debe usar la fecha española del producto');
  assert.match(home, /paintFace\(el, profile, fallbackAvatar, blockedAvatar\)/,
    'el avatar del mapa debe pasar por mediaUrl para firmar Storage');
  const moods = await read('tamp', 'src', 'stores', 'mood.store.js');
  assert.match(moods, /\.order\('date', \{ ascending: false \}\)\s*\.order\('created_at', \{ ascending: false \}\)/,
    'los estados de hoy deben priorizar el último registro de cada persona');
});

test('Rincón respeta sus accesos directos y no arrastra el detalle anterior de Curiosidades', async () => {
  const rincon = await read('tamp', 'src', 'pages', 'Rincon.js');
  const audios = await read('tamp', 'src', 'pages', 'rincon', 'audios.js');

  assert.match(rincon, /query\?\.tab === 'memes'[\s\S]*?state\.view = 'memes'/,
    'el acceso directo desde Inicio debe poner Memes como vista activa');
  assert.match(rincon, /currentBase === '\/rincon' && state\.view === 'memes' \? 'memes'/,
    'la pestaña activa debe respetar tab=memes aunque la ruta base sea /rincon');
  assert.match(rincon, /state\.curiosidadTab = 'landing';\s*state\.curioDetail = null;/,
    'abrir Curiosidades como sección nueva debe limpiar un detalle viejo');
  assert.match(rincon, /state\.curiosidadTab = router\.currentRoute\.query\.cat;\s*state\.curioDetail = null;/,
    'los enlaces directos a una colección deben mostrar esa colección');
  assert.match(audios, /state\.audiosError = 'No se pudieron cargar los audios/,
    'un fallo remoto debe quedar identificado para el usuario');
  assert.match(audios, /id="audiosRetryBtn"/,
    'Audios ofrece reintentar en lugar de quedarse en un estado vacío o cargando');
  assert.match(audios, /state\.audiosLoadPromise\) return state\.audiosLoadPromise/,
    'entradas y reintentos simultáneos comparten la misma carga');
});

test('el calendario general pinta planes y regalos recibidos en la misma rejilla', async () => {
  const agenda = await read('tamp', 'src', 'pages', 'Agenda.js');
  assert.match(agenda, /loadGiftsCatalog/);
  assert.match(agenda, /function giftsForDay\(day\)/);
  assert.match(agenda, /items\.push\(\{ day, row: gift, gift: true \}\)/);
  assert.match(agenda, /ag-calendar-legend/);
  assert.doesNotMatch(agenda, /data-received/);
});

test('cerrar un regalo abierto desde el calendario vuelve a la cuadrícula única', async () => {
  const main = await read('tamp', 'src', 'main.js');
  const agenda = await read('tamp', 'src', 'pages', 'Agenda.js');
  assert.match(main, /query\.gift \|\| query\.view === 'recibidos'/);
  assert.match(agenda, /loadGiftsCatalog/);
  assert.match(agenda, /function giftsForDay\(day\)/);
});

test('el Mal Día antiguo (chat) ya no está', async () => {
  await assert.rejects(read('tamp', 'src', 'pages', 'MalDia.js'), /ENOENT/);
  await assert.rejects(read('tamp', 'src', 'styles', 'maldia.css'), /ENOENT/);
});
