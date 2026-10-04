import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandCalendarCatalog } from '../personal-hub/src/data/calendar-expansion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function projectPath(...parts) {
  return path.join(ROOT, ...parts);
}

const hub = (...parts) => projectPath('personal-hub', ...parts);

test('el catálogo expandido cubre del 15 de agosto al 1 de octubre', () => {
  const catalog = expandCalendarCatalog({});
  const dates = [];
  for (const [monthKey, month] of Object.entries(catalog.months)) {
    for (const [day, giftId] of Object.entries(month.calendarMapping || {})) {
      if (giftId) dates.push(`${monthKey}-${String(day).padStart(2, '0')}`);
    }
  }

  assert.equal(dates.length, 48);
  const numericDates = dates.map(date => Number(date.replaceAll('-', '')));
  assert.equal(Math.min(...numericDates), Number('20260815'));
  assert.equal(Math.max(...numericDates), Number('20261001'));
  assert.equal(new Set(dates).size, dates.length);
});

test('los juegos del calendario apuntan a archivos existentes', () => {
  const catalog = expandCalendarCatalog({});
  const gameGifts = catalog.gifts.filter(gift => gift.type === 'game');

  assert.equal(gameGifts.length, 9);
  for (const gift of gameGifts) {
    assert.match(gift.redirectUrl, /^games\/[\w-]+\.html$/);
    assert.equal(existsSync(hub('public', gift.redirectUrl)), true, gift.redirectUrl);
  }
});

test('cada juego listado en Juegos tiene su página pública', async () => {
  // El catálogo vive en data/ para que Rincón no arrastre Juegos.js + juegos.css.
  const source = await readFile(hub('src', 'data', 'games.catalog.js'), 'utf8');
  const juegos = await readFile(hub('src', 'pages', 'Juegos.js'), 'utf8');
  const hrefs = [...source.matchAll(/href:\s*'([^']+\.html)'/g)].map(match => match[1]);

  assert.equal(hrefs.length, 19);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.match(juegos, /from '\.\.\/data\/games\.catalog\.js'/);
  for (const href of hrefs) {
    const relativePath = href.replace(/^\//, '');
    assert.equal(existsSync(hub('public', relativePath)), true, href);
  }
});

test('Rincón no importa en estático Canciones ni Juegos (evita CSS/JS pesados)', async () => {
  // Tras partir la pagina, los modulos viven en src/pages/rincon/: se revisan
  // TODOS, no solo el orquestador, porque cualquiera podria reintroducir el peso.
  const rincon = await readFile(hub('src', 'pages', 'Rincon.js'), 'utf8');
  const modulos = readdirSync(hub('src', 'pages', 'rincon'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(hub('src', 'pages', 'rincon', f), 'utf8'))
    .join('\n');
  const todo = rincon + '\n' + modulos;

  assert.doesNotMatch(todo, /import\s+\{[^}]*\}\s+from\s+'\.{1,2}\/(pages\/)?Canciones\.js'/);
  assert.doesNotMatch(todo, /import\s+\{[^}]*\}\s+from\s+'\.{1,2}\/(pages\/)?Juegos\.js'/);
  assert.match(todo, /from '\.{1,2}\/(data\/)?games\.catalog\.js'/);
  // dinámico OK para portadas: vive en songCovers.js
  assert.match(todo, /import\('\.\.\/Canciones\.js'\)/);
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
  const source = await readFile(hub('src', 'services', 'sync.service.js'), 'utf8');
  assert.doesNotMatch(source, /hasData\(local\)/);
  assert.match(source, /hasData\(readLocal\(\)\)/);
});

test('la API de push valida sesión y enabled, y usa la tabla dedicada', async () => {
  const pushApi = await readFile(projectPath('api', 'push.js'), 'utf8');

  // Suscripciones en tabla propia, no dentro de `content`.
  assert.match(pushApi, /const PUSH_TABLE = 'push_subscriptions';/);
  // Fallback legacy si la migración 018 todavía no está aplicada.
  assert.match(pushApi, /42P01/);
  assert.match(pushApi, /getLegacySubscriptions/);
  // Autenticación unificada: token + profiles.enabled.
  assert.match(pushApi, /async function authenticate\(req, res\)/);
  assert.match(pushApi, /enabled !== false/);
  // El envío diario sigue siendo exclusivo de admin y con cron GET/POST.
  assert.match(pushApi, /action === 'send' && !\['GET', 'POST'\]\.includes\(req\.method\)/);
  assert.match(pushApi, /process\.env\.CRON_SECRET/);
  assert.match(pushApi, /email_confirmed_at/);
  // La baja se hace por endpoint concreto, no borra la de otra persona.
  assert.doesNotMatch(pushApi, /else if \(endpoint\)/);
});

test('la familia azul existe como override por data-paleta (modo intacto)', async () => {
  const css = await readFile(hub('src', 'styles', 'design-tokens.css'), 'utf8');

  // La paleta se selecciona con data-paleta; el modo (claro/oscuro) con data-theme.
  assert.match(css, /:root\[data-paleta="azul"\]/);
  assert.match(css, /:root\[data-paleta="azul"\]\[data-theme="light"\]/);
  assert.match(css, /:root\[data-theme="light"\]/);
  // El override no pisa tokens estructurales, solo color/acento.
  const bloque = css.slice(css.indexOf(':root[data-paleta="azul"]'), css.indexOf(':root[data-paleta="azul"][data-theme="light"]'));
  assert.ok(bloque.includes('--accent'), 'la paleta azul debe redefinir el acento');
  assert.ok(!/--sp-|--fs-|--nav-h|--blur-/.test(bloque), 'la paleta no debe tocar tokens de espaciado/tipografía');
});

test('el servicio de temas expone 3 paletas y 3 modos con escritura dual y legacy', async () => {
  const svc = await readFile(hub('src', 'services', 'theme.service.js'), 'utf8');

  // Escritura dual: data-paleta + data-theme, y el atributo legacy data-tema.
  for (const s of ['dataset.paleta', 'dataset.theme', 'dataset.tema', 'getPaletas()', 'getModos()']) {
    assert.ok(svc.includes(s), `theme.service.js debe usar ${s}`);
  }
  // 3 paletas x 2 modos, más 'auto' como resolución automática.
  const linea = svc.split(/\r?\n/).find(l => l.includes('return [') && l.includes('coral-oscuro'));
  assert.ok(linea, 'getAvailable() debe devolver la lista de combinaciones');
  const disponibles = [...linea.matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
  assert.equal(disponibles.length, 7, 'getAvailable() debe listar 6 combinaciones + auto');
  assert.equal(new Set(disponibles).size, disponibles.length, 'sin ids duplicados');
  assert.deepEqual(disponibles, [
    'coral-oscuro', 'coral-claro', 'frambuesa-oscuro', 'frambuesa-claro',
    'azul-oscuro', 'azul-claro', 'auto'
  ]);

  const boot = await readFile(hub('index.html'), 'utf8');
  for (const s of ['dataset.paleta', 'dataset.theme', 'dataset.tema']) {
    assert.ok(boot.includes(s), `index.html debe aplicar ${s} antes del primer pintado`);
  }
});

test('el arranque resuelve el modo por SO cuando no hay tema guardado', async () => {
  const boot = await readFile(hub('index.html'), 'utf8');
  assert.ok(!boot.includes('if (!t) return'));
  assert.ok(boot.includes('prefers-color-scheme'));
});

test('perfil y admin ofrecen el catálogo de paletas sin re-declararlo', async () => {
  const svc = await readFile(hub('src', 'services', 'theme.service.js'), 'utf8');
  // La fuente de verdad es theme.service: 3 paletas y 3 modos, nada más.
  const paletaCount = (svc.match(/\{\s*id:\s*'(?:coral|frambuesa|azul)'/g) || []).length;
  assert.equal(paletaCount, 3, 'theme.service debe definir 3 paletas');
  assert.ok(svc.includes("export const MODOS = ["), 'y 3 modos (auto/dark/light)');

  for (const file of ['Profile.js', 'Admin.js']) {
    const source = await readFile(hub('src', 'pages', file), 'utf8');
    assert.ok(source.includes('theme.getPaletas()'), `${file} debe enumerar theme.getPaletas()`);
    // Nada de catálogos duplicados a mano: si alguien los re-declara, se desincronizan.
    assert.doesNotMatch(source, /id:\s*'coral'/, `${file} no debe re-declarar la paleta coral`);
  }

  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  assert.ok(admin.includes('data-theme-set="paleta"'));
  assert.ok(admin.includes('data-theme-set="modo"'));
  assert.ok(admin.includes('setPaleta'), 'el handler debe usar setPaleta');
  assert.ok(admin.includes('setModo'), 'el handler debe usar setModo');
});

test('pageheader con tokens y barra movil contextual', async () => {
  const comp = await readFile(hub('src', 'components', 'PageHeader.js'), 'utf8');
  assert.ok(comp.includes('renderPageHeader'));
  assert.ok(comp.includes('<h1 class="scr-title">'));
  assert.ok(comp.includes('mobileHidden'));
  assert.ok(comp.includes('escapeHtml(title'), 'el título se escapa');

  // La clase que emite para móvil tiene que existir en el CSS, o la bandera es decorativa.
  const ui = await readFile(hub('src', 'styles', 'ui.css'), 'utf8');
  const pos = ui.indexOf('.scr-head--mobile-hidden');
  assert.notEqual(pos, -1, 'ui.css debe estilizar .scr-head--mobile-hidden');
  const bloque = ui.slice(Math.max(0, pos - 200), pos + 60);
  assert.match(bloque, /@media\s*\(max-width:\s*768px\)/, 'la regla debe vivir dentro del breakpoint móvil');
  assert.match(bloque, /\.scr-head--mobile-hidden\s*\{\s*display:\s*none;\s*\}/);

  // Clases del marcado con estilo basado en tokens.
  assert.ok(ui.includes('.scr-title'));
  assert.ok(ui.includes('.head-actions'));
  assert.ok(ui.includes('var(--'), 'ui.css debe usar tokens, no colores sueltos');
});

test('bottomnav mobile-first y compacta con etiquetas recortadas', async () => {
  const nav = await readFile(hub('src', 'styles', 'nav.css'), 'utf8');

  assert.ok(nav.includes('.bottom-nav'), 'debe existir la barra inferior');
  // Mobile-first: se oculta a partir de 768px (donde aparece el sidebar).
  const ocultar = nav.slice(nav.indexOf('.bottom-nav { display: none;') - 60, nav.indexOf('.bottom-nav { display: none;'));
  assert.match(ocultar, /@media\s*\(min-width:\s*768px\)/);
  // Compacta: etiquetas recortadas y safe-area para el gesto inferior del iPhone.
  assert.match(nav, /text-overflow:\s*ellipsis|overflow:\s*hidden/);
  assert.match(nav, /env\(safe-area-inset-bottom/);
});

test('el documento nunca se desplaza: el scroll es de .main', async () => {
  const reset = await readFile(hub('src', 'styles', 'reset.css'), 'utf8');
  const main = await readFile(hub('src', 'styles', 'main.css'), 'utf8');

  // La franja negra al pie no era un elemento: al hacer clicables las tarjetas
  // se añadió scrollIntoView, que desplazaba también el <html>. Eso arrastraba
  // toda la app (menú lateral incluido) y dejaba el hueco del documento a la
  // vista. Causa: las regiones .sr-only son position:absolute y, al no tener
  // un ancestro posicionado dentro de .main, escapaban de su recorte y
  // alargaban el documento.
  assert.match(reset, /html \{[\s\S]*?height: 100%;[\s\S]*?overflow: hidden;/,
    'el documento no puede desplazarse: el scroll lo lleva .main');
  assert.match(main, /\.main \{ position: relative;/,
    '.main es el bloque contenedor, así lo posicionado absolute queda dentro de su recorte');
  assert.match(reset, /body \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/,
    'y el body sigue bloqueado como antes');
});

test('la acción rápida flotante se ha retirado', async () => {
  const main = await readFile(hub('src', 'styles', 'main.css'), 'utf8');
  const nav = await readFile(hub('src', 'styles', 'nav.css'), 'utf8');
  const app = await readFile(hub('src', 'components', 'App.js'), 'utf8');
  const bottomNav = await readFile(hub('src', 'components', 'BottomNav.js'), 'utf8');

  // Solo abría un menú con secciones que ya están en la barra.
  assert.doesNotMatch(nav, /\.fab \{/, 'no quedan estilos del botón flotante');
  assert.doesNotMatch(app, /className = 'fab'/, 'ni se monta suelto en el shell');
  assert.doesNotMatch(app, /quickAddMenu/, 'y el shell ya no lo llama');
  assert.doesNotMatch(bottomNav, /bn-fab|data-quick-add|onQuickAdd/, 'ni como pestaña de la barra');
  assert.doesNotMatch(main, /nav-h\) \+ 90px/, 'el contenido ya no reserva hueco para un botón flotante');
});

test('inicio arranca por la tarjeta de días, sin cabecera ni frases viejas', async () => {
  const home = await readFile(hub('src', 'pages', 'Home.js'), 'utf8');
  // La pantalla ya no lleva cabecera: el saludo de la tarjeta hace de encabezado.
  assert.ok(!home.includes('renderPageHeader'), 'Inicio no debe montar la cabecera de página');
  assert.ok(!home.includes('longDate'), 'la fecha larga solo alimentaba esa cabecera');
  assert.ok(!home.includes('home-hero__phrase'));
  assert.ok(!home.includes('home-hero__particle'));
  assert.ok(home.includes('homeCounter'));
  assert.ok(home.includes('Datos curiosos'));
  // Pero sigue habiendo un único h1 en la pantalla, para lectores de pantalla.
  assert.equal([...home.matchAll(/<h1/g)].length, 1, 'Inicio debe tener exactamente un h1');
  assert.ok(home.includes('class="sr-only"'), 'ese h1 es solo para lectores de pantalla');
  // Las fechas del día salen de la zona horaria de España, no de la del navegador.
  assert.ok(home.includes('todayISO()'));
});

test('el saludo de inicio va en la tarjeta de días, con apodo y sin duplicarse', async () => {
  const home = await readFile(hub('src', 'pages', 'Home.js'), 'utf8');

  // Apodo según el rol de la sesión: admin vs. la otra cuenta.
  assert.ok(
    home.includes("userStore.isAdmin ? 'admin' : 'mi princesa'"),
    'el apodo debe salir de userStore.isAdmin'
  );
  assert.ok(home.includes("from '../stores/user.store.js'"), 'Home debe importar el userStore');

  // El saludo se pinta dentro de la tarjeta de días.
  const tarjeta = home.slice(home.indexOf('<section class="home-hero"'));
  const posSaludo = tarjeta.indexOf('home-hero__greet');
  const posContador = tarjeta.indexOf('home-hero__main');
  assert.notEqual(posSaludo, -1, 'debe existir home-hero__greet');
  assert.ok(posSaludo < posContador, 'el saludo va ANTES del contador de días');

  // Y el título de la pantalla ya no repite el saludo: la tarjeta es lo primero.
  assert.ok(!home.includes('renderPageHeader'), 'no debe quedar cabecera con otro saludo');

  // Las tres franjas del día, en hora de España.
  for (const s of ['Buenos días', 'Buenas tardes', 'Buenas noches']) {
    assert.ok(home.includes(s), `falta el saludo «${s}»`);
  }
  assert.ok(home.includes('TIME_GREETING[timeKey]'));
  assert.ok(home.includes('hourInSpain()'), 'la franja horaria debe ser la de España');

  // Y está estilizado con tokens, no con colores sueltos.
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');
  assert.ok(css.includes('.home-hero__greet'), 'home.css debe estilizar .home-hero__greet');
  const regla = css.slice(css.indexOf('.home-hero__greet {'), css.indexOf('.home-hero__greet-name'));
  assert.match(regla, /var\(--/);
  assert.ok(css.includes('.home-hero__greet-name'));
});

test('rincon con cabecera y carrusel manual accesible', async () => {
  // La landing vive en su propio modulo desde el split de Rincón.
  const landing = await readFile(hub('src', 'pages', 'rincon', 'landing.js'), 'utf8');
  const rincon = await readFile(hub('src', 'pages', 'Rincon.js'), 'utf8');
  assert.ok(landing.includes('renderPageHeader'));
  assert.ok(landing.includes('El Rincón'));
  assert.ok(landing.includes('aria-roledescription'));
  // Anti-autoplay acotado al carrusel "Descubre hoy" (getDescubreHoySet + renderLanding
  // hasta el binding de tarjetas): un setInterval legítimo en otra vista no debe romperlo.
  const start = landing.indexOf('function getDescubreHoySet()');
  const end = landing.indexOf('// Bind section card clicks', start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const carousel = landing.slice(start, end);
  assert.ok(!carousel.includes('setInterval'));
  const code = carousel.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/autoplay/i.test(code));
  assert.ok((landing + rincon).includes('rincon-hero-crown') === false);
});

test('interiores con cabecera y minecraft con h1-h2', async () => {
  const rincon = await readFile(hub('src', 'pages', 'Rincon.js'), 'utf8');
  const interiores = await readFile(hub('src', 'pages', 'rincon', 'curiosities.js'), 'utf8');
  // Las pestañas del dispatcher siguen en el orquestador; Curiosidades, en su modulo.
  for (const t of ['Galería', 'Memes', 'Audios']) assert.ok(rincon.includes(t));
  assert.ok(interiores.includes('Curiosidades'));
  const mc = await readFile(hub('src', 'pages', 'Minecraft.js'), 'utf8');
  assert.ok(mc.includes('renderPageHeader'));
  assert.ok(mc.includes("'Minecraft'"));
  assert.ok(mc.includes('Nuestros mundos'));
});

test('interiores ocultan cabecera en movil y minecraft simplifica backs', async () => {
  const rincon = await readFile(hub('src', 'pages', 'Rincon.js'), 'utf8');
  const interiores = await readFile(hub('src', 'pages', 'rincon', 'curiosities.js'), 'utf8');
  assert.ok((rincon + interiores).includes('mobileHidden'));
  const mc = await readFile(hub('src', 'pages', 'Minecraft.js'), 'utf8');
  assert.ok(mc.includes('mobileHidden'), 'Minecraft también oculta su cabecera en móvil');
  assert.ok(mc.includes('data-mc-back'), 'Minecraft debe tener botón de vuelta');
  // El botón de vuelta se usa en el marcado: tiene que estar estilizado.
  const css = await readFile(hub('src', 'styles', 'minecraft.css'), 'utf8');
  assert.ok(css.includes('.rincon-back-btn'), 'minecraft.css debe estilizar .rincon-back-btn');
  // Y con tokens, no con colores sueltos.
  const rule = css.slice(css.indexOf('.rincon-back-btn'), css.indexOf('.mc-head'));
  assert.match(rule, /var\(--/);
});

test('las páginas de carga diferida se enrutan con el helper lazy', async () => {
  const main = await readFile(hub('src', 'main.js'), 'utf8');

  assert.ok(main.includes('const lazy = (loader)'), 'debe existir el helper lazy');
  for (const ruta of ['/openwhen', '/admin', '/rincon', '/canciones', '/juegos', '/calendario', '/series']) {
    const idx = main.indexOf(`router.addRoute('${ruta}'`);
    assert.notEqual(idx, -1, `falta la ruta ${ruta}`);
    const linea = main.slice(idx, main.indexOf('\n', idx));
    assert.ok(linea.includes('lazy('), `${ruta} debería cargarse con lazy()`);
  }
  // Y las ligeras se pueden seguir importando de forma estática.
  for (const page of ['Login', 'Home', 'Profile', 'Razones', 'MalDia']) {
    assert.ok(main.includes(`from './pages/${page}.js'`), `${page} debería seguir siendo estático`);
  }
});

test('cada página diferida importa su propio CSS y main.css solo trae lo compartido', async () => {
  const main = await readFile(hub('src', 'styles', 'main.css'), 'utf8');
  const diferidas = {
    'Admin.js': 'admin.css', 'Rincon.js': 'rincon.css', 'Minecraft.js': 'minecraft.css',
    'Canciones.js': 'canciones.css', 'Sentimientos.js': 'sentimientos.css',
    'Juegos.js': 'juegos.css', 'OnlineGame.js': 'online-games.css',
    'Calendario.js': 'calendario.css', 'OpenWhen.js': 'openwhen.css',
    'Series.js': 'series.css', 'ThoseEyes.js': 'thoseeyes.css',
    'JustTheWayYouAre.js': 'justthewayyouare.css', 'OsitosWorld.js': 'ositos.css'
  };

  for (const [page, css] of Object.entries(diferidas)) {
    const source = await readFile(hub('src', 'pages', page), 'utf8');
    assert.ok(
      source.includes(`import '../styles/${css}';`),
      `${page} debe importar ../styles/${css} para que viaje en su chunk`
    );
    // Si además se importa en main.css, el CSS vuelve al bundle inicial.
    assert.ok(!main.includes(css), `main.css no debe importar ${css}: pesa ${css} en el bundle inicial`);
    assert.equal(existsSync(hub('src', 'styles', css)), true, css);
  }

  // Lo transversal (tokens, reset, componentes, shell) sí sigue en el bundle inicial.
  for (const compartido of ['design-tokens.css', 'reset.css', 'typography.css', 'ui.css', 'nav.css', 'lightbox.css']) {
    assert.ok(main.includes(compartido), `main.css debe conservar ${compartido}`);
  }
});

test('el catálogo de Open When vive en un módulo sin dependencias de UI', async () => {
  const data = await readFile(hub('src', 'data', 'openwhen.data.js'), 'utf8');
  const page = await readFile(hub('src', 'pages', 'OpenWhen.js'), 'utf8');

  // El módulo de datos no puede arrastrar componentes: si los importara, Home.js
  // y el service de notificaciones voltarían a traer la página entera.
  assert.doesNotMatch(data, /from '\.\.\/components\//);
  assert.doesNotMatch(data, /from '\.\.\/pages\//);
  assert.ok(data.includes('export const LETTERS = ['));
  assert.ok(data.includes('export const CATEGORIES = ['));
  assert.ok(data.includes('export const TYPE_META = {'));
  assert.ok(data.includes('export async function loadAllOpenWhenLetters()'));

  // 37 cartas de fábrica, con id único.
  const ids = [...data.slice(data.indexOf('export const LETTERS = [')).matchAll(/^\s{4}id: '([^']+)'/gm)].map(m => m[1]);
  assert.equal(ids.length, 37);
  assert.equal(new Set(ids).size, ids.length, 'las cartas de fábrica necesitan id único');

  // La página reexporta para no romper a quien importaba desde ahí.
  assert.ok(page.includes("from '../data/openwhen.data.js'"));
  assert.ok(page.includes('export { CATEGORIES, TYPE_META, LETTERS, loadAllOpenWhenLetters };'));

  // Y nadie del chunk inicial importa ya la página Open When.
  for (const [file, rel] of [['Home.js', '../data/openwhen.data.js'], ['Admin.js', '../data/openwhen.data.js']]) {
    const source = await readFile(hub('src', 'pages', file), 'utf8');
    assert.ok(source.includes(rel), `${file} debe leer el catálogo del módulo de datos`);
  }
  const notif = await readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');
  assert.ok(notif.includes("from '../data/openwhen.data.js'"));
  assert.doesNotMatch(notif, /from '\.\.\/pages\//, 'un servicio no debe importar páginas');
});

test('las cartas de Open When pueden llevar audio, fotos y vídeo dentro', async () => {
  const page = await readFile(hub('src', 'pages', 'OpenWhen.js'), 'utf8');
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // La hoja sabe pintar los tres tipos de adjunto dentro de la carta.
  assert.ok(page.includes("kind === 'audio'"), 'falta el audio en la hoja');
  assert.ok(page.includes("kind === 'video'"), 'falta el vídeo en la hoja');
  assert.ok(page.includes("kind === 'album'"), 'faltan las fotos en la hoja');
  // El audio de archivo usa un <audio> y avisa al terminar (hasEnded).
  assert.ok(page.includes('function startAudioFile'));
  assert.ok(page.includes('hasEnded'));
  // El editor del Admin deja adjuntarlos sin tocar código y sube a Storage.
  assert.ok(admin.includes('owAdminMediaKind'), 'falta el selector de multimedia');
  assert.ok(admin.includes('uploadAudios'));
  assert.ok(admin.includes('uploadMemes'));
  assert.doesNotMatch(admin, /se crean desde el código/);
});

test('el retroceso cierra las capas sin salir de la página', async () => {
  const overlays = await readFile(hub('src', 'utils', 'overlayHistory.js'), 'utf8');
  const ui = await readFile(hub('src', 'components', 'ui.js'), 'utf8');
  const ml = await readFile(hub('src', 'components', 'MediaLightbox.js'), 'utf8');
  const router = await readFile(hub('src', 'router.js'), 'utf8');
  const page = await readFile(hub('src', 'pages', 'OpenWhen.js'), 'utf8');

  // Capa común: una entrada de historial por overlay, cierre idempotente.
  assert.ok(overlays.includes('export function pushOverlayHistory'));
  assert.ok(overlays.includes('export function finalizeOverlayClose'));
  // Hojas y visor registran su entrada y la deshacen al cerrarse.
  assert.ok(ui.includes('pushOverlayHistory(closeSheets)'));
  assert.ok(ui.includes('finalizeOverlayClose(closeSheets)'));
  assert.ok(ml.includes('pushOverlayHistory(closeLightbox)'));
  assert.ok(ml.includes('finalizeOverlayClose(closeLightbox)'));
  // El router no vuelve a montar la página en un popstate de la misma ruta
  // y su Atrás desapila primero las vistas internas.
  assert.match(router, /getCurrentPath\(\) === this\.currentRoute\.path/);
  assert.ok(router.includes('history.state?.__phInPage'));
  // La categoría de Open When deja su propia entrada de historial.
  assert.ok(page.includes('__owView'));
});

test('la telemetría es opt-in y sanea antes de enviar', async () => {
  const telemetry = await readFile(hub('src', 'services', 'telemetry.js'), 'utf8');

  // Opt-in de verdad: sin endpoint no hay fetch ni sendBeacon en el arranque.
  assert.match(telemetry, /const ENDPOINT = import\.meta\.env\.VITE_TELEMETRY_URL;/);
  const antesDeFlush = telemetry.slice(0, telemetry.indexOf('function flush()'));
  for (const bloqueado of ['sendBeacon', 'fetch']) {
    // Solo pueden aparecer dentro de flush(), nunca al importar el módulo.
    assert.doesNotMatch(
      antesDeFlush,
      new RegExp(`\\b${bloqueado}\\s*\\(`),
      `no debe llamarse a ${bloqueado}() antes de flush()`
    );
  }
  assert.ok(telemetry.includes('function flush()'), 'debe existir un envío explícito');
  assert.ok(telemetry.includes('if (!ENDPOINT || buffer.length === 0) return;'), 'flush() aborta sin endpoint');

  // Saneado: nada de correos, tokens ni URLs con credenciales salen nunca.
  assert.match(telemetry, /sanitizeMessage/);
  assert.match(telemetry, /@\[\\w-\]/, 'debe detectar correos');
  assert.match(telemetry, /parece un token/);
  assert.match(telemetry, /credenciales/);
  assert.ok(telemetry.includes('MAX_EVENTS'), 'el buffer debe estar acotado');

  // Y se arranca antes de montar la app para no perder fallos de arranque.
  const main = await readFile(hub('src', 'main.js'), 'utf8');
  assert.ok(main.includes("from './services/telemetry.js'"));
  const posInit = main.indexOf('initTelemetry();');
  const posRouter = main.indexOf('new Router(');
  assert.ok(posInit !== -1 && posInit < posRouter, 'initTelemetry() debe ir antes de crear el Router');
});

test('el README documenta el orden de migraciones y el rollback', async () => {
  const readme = await readFile(projectPath('README.md'), 'utf8');

  for (const s of ['sql/', '017_enabled_autoritativo.sql', '018_push_subscriptions.sql']) {
    assert.ok(readme.includes(s), `el README debe mencionar ${s}`);
  }
  // sql/ es la fuente de verdad; supabase-schema.sql es histórico.
  assert.match(readme, /FUENTE DE VERDAD/i);
  assert.match(readme, /HIST[ÓO]RICA/i);
  // Y no puede recomendar el orden viejo.
  assert.doesNotMatch(readme, /aplicar `supabase-schema\.sql`/i);

  for (const v of ['VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'VAPID_PRIVATE_KEY']) {
    assert.ok(readme.includes(v), `el README debe documentar ${v}`);
  }
  assert.ok(/nunca.*cliente|Nunca.*cliente/i.test(readme), 'debe advertir contra filtrar secretos al cliente');
});

test('el catálogo de ánimos es el nuevo y el histórico conserva el antiguo', async () => {
  const { MOODS, LEGACY_MOODS, ALL_MOODS, findMood } = await import('../personal-hub/src/data/moods.data.js');

  // Lo que se puede registrar AHORA: los cinco nuevos, en el orden pedido.
  assert.deepEqual(MOODS.map(m => m.id), ['preocupada', 'enfadada', 'triste', 'bien', 'carino']);
  assert.deepEqual(MOODS.map(m => m.emoji), ['😟', '😡', '🥹', '😊', '🤍']);
  assert.deepEqual(MOODS.map(m => m.label), ['Preocupada', 'Enfadada', 'Triste', 'Bien', 'Necesito cariño']);

  // Escala 0..4 (4 = mejor) para que las medias sigan siendo comparables.
  const scores = MOODS.map(m => m.score);
  assert.equal(Math.max(...scores), 4);
  assert.equal(Math.min(...scores), 0);
  assert.equal(new Set(scores).size, scores.length, 'cada estado tiene su score');

  // El catálogo anterior se conserva para LEER, no para ofrecer.
  assert.equal(LEGACY_MOODS.length, 5);
  for (const legacy of LEGACY_MOODS) {
    assert.ok(legacy.legacy, `${legacy.id} debe ir marcado como antiguo`);
    assert.equal(findMood(legacy.id), null, `${legacy.id} no se puede volver a registrar`);
    assert.equal(MOODS.some(m => m.id === legacy.id), false);
  }
  // Ningún id nuevo pisa a un id antiguo.
  const idsAntiguos = new Set(LEGACY_MOODS.map(m => m.id));
  for (const m of MOODS) assert.ok(!idsAntiguos.has(m.id), `${m.id} colisiona con el catálogo antiguo`);

  // Unificado: primero el vigente, detrás el histórico (orden de las barras).
  assert.equal(ALL_MOODS.length, 10);
  assert.deepEqual(ALL_MOODS.slice(0, 5).map(m => m.id), MOODS.map(m => m.id));
  assert.deepEqual(ALL_MOODS.slice(5).map(m => m.id), LEGACY_MOODS.map(m => m.id));
});

test('un estado ya registrado se sigue viendo tal cual se puso', async () => {
  const { resolveMood, moodEmoji } = await import('../personal-hub/src/data/moods.data.js');

  // 1. Fila con etiqueta propia (lo que guarda la tabla moods): manda la fila.
  const conDatos = resolveMood({ mood: 'great', label: 'Muy bieeeen', emoji: '🤍', score: 4 });
  assert.equal(conDatos.label, 'Muy bieeeen');
  assert.equal(conDatos.emoji, '🤍');
  assert.equal(conDatos.legacy, true);

  // 2. Fila sin etiqueta (p.ej. creada por una versión vieja): cae al catálogo
  //    anterior, y NUNCA devuelve null aunque el id ya no exista en MOODS.
  const sinDatos = resolveMood({ mood: 'meh' });
  assert.equal(sinDatos.label, 'Un poquito mal');
  assert.ok(sinDatos.emoji);

  // 3. Id desconocido de verdad: null, no una etiqueta inventada.
  assert.equal(resolveMood({ mood: 'no-existe' }), null);
  assert.equal(resolveMood(null), null);

  // 4. Un estado nuevo se resuelve con el catálogo vigente.
  assert.equal(resolveMood({ mood: 'triste' }).label, 'Triste');
  // Y el emoji nunca sale vacío, que es lo que se pinta en las celdas.
  assert.ok(moodEmoji({ mood: 'love' }));
  assert.equal(moodEmoji(null), '');

  // 5. Si algún día se toca una etiqueta antigua, la fila gana: el histórico
  //    no cambia por retocar el catálogo.
  assert.equal(resolveMood({ mood: 'meh', label: 'Era "un poco mal"' }).label, 'Era "un poco mal"');
});

test('el store de ánimos delega en el módulo de datos', async () => {
  const store = await readFile(hub('src', 'stores', 'mood.store.js'), 'utf8');

  // El catálogo no puede volver a declararse dentro del store.
  assert.ok(store.includes("from '../data/moods.data.js'"));
  assert.doesNotMatch(store, /^const MOODS = \[/m);
  assert.doesNotMatch(store, /^const LEGACY_MOODS = \[/m);
  assert.ok(store.includes('return findMood(id);'), 'getMoodById usa el catálogo vigente');
  assert.ok(store.includes('return resolveMood(entry);'), 'resolveMood delega en la lógica pura');
});

test('el historial guarda la etiqueta, no solo el id, y acepta el formato viejo', async () => {
  const store = await readFile(hub('src', 'stores', 'mood.store.js'), 'utf8');

  // Si se guardara solo el id, cambiar el catálogo dejaría el pasado mudo.
  assert.match(store, /const entry = \{ moodId: mood\.id, date: today, label: mood\.label, emoji: mood\.emoji, score: mood\.score \};/);
  assert.match(store, /e\.moodId \|\| e\.mood/, 'getHistory debe aceptar mood y moodId');
});

test('el admin no vuelve a declarar el catálogo de ánimos', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // Los tres mapas duplicados que se desincronizaban del store.
  assert.doesNotMatch(admin, /MOOD_EMOJIS/, 'el admin debe leer los emoji del store');
  assert.doesNotMatch(admin, /MOOD_LABELS/, 'el admin debe leer las etiquetas del store');
  assert.doesNotMatch(admin, /MOOD_SCORES/, 'el admin debe leer los scores del store');
  assert.doesNotMatch(admin, /\['great','good','meh','bad','love'\]/, 'el orden fijo de barras quedó obsoleto');

  assert.ok(admin.includes('moodStore.resolveMood'), 'debe usar resolveMood');
  assert.ok(admin.includes('getLegacyMoods()'), 'las barras deben incluir el histórico');

  // Y el CSS tiene una clase por cada estado, para que las barras lleven color.
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');
  for (const id of ['bien', 'carino', 'triste', 'preocupada', 'enfadada']) {
    assert.ok(css.includes(`.moods-bar-fill.mood-${id}`), `falta el color de la barra .mood-${id}`);
  }
});

test('las tarjetas de Explorar en Sentimientos van de una en una', async () => {
  const css = await readFile(hub('src', 'styles', 'sentimientos.css'), 'utf8');

  // Una sola columna en TODOS los tamaños: ni 2×2 ni 4 en paralelo.
  const rejilla = css.slice(css.indexOf('.sent-cards-grid {'), css.indexOf('.sent-card {'));
  assert.match(rejilla, /grid-template-columns:\s*minmax\(0, 1fr\)/, 'la rejilla es de una columna');
  assert.doesNotMatch(css, /\.sent-cards-grid\s*\{[^}]*repeat\(/, 'no debe volver a una rejilla de varias columnas');

  // Al ocupar el ancho completo, la portada pasa a un cuadro a la izquierda.
  const card = css.slice(css.indexOf('.sent-card {'), css.indexOf('.sent-card-body'));
  assert.match(card, /flex-direction:\s*row/);
  const cover = css.slice(css.indexOf('.sent-card-cover {'), css.indexOf('.sent-card:hover'));
  assert.match(cover, /width:\s*84px/);
  assert.match(cover, /height:\s*84px/);
  assert.match(cover, /border-right:/, 'la separación va ahora en vertical');

  // Ni el icono se queda pequeño en una portada más grande.
  const sent = await readFile(hub('src', 'pages', 'Sentimientos.js'), 'utf8');
  assert.match(sent, /sent-card-cover">\$\{icon\(card\.icon, 30\)\}/);
});

test('el historial de sentimientos escapa lo que viene de la base de datos', async () => {
  const sent = await readFile(hub('src', 'pages', 'Sentimientos.js'), 'utf8');

  assert.ok(sent.includes("from '../utils/escape.js'"), 'Sentimientos debe importar escapeHtml');
  // La etiqueta y el emoji del historial vienen de Supabase ahora, no del catálogo.
  assert.ok(sent.includes('escapeHtml(mood.label)'), 'la etiqueta del calendario va escapada');
  assert.ok(sent.includes('escapeHtml(mood.emoji)'), 'el emoji del calendario va escapado');
  // Y se resuelve, no se busca por catálogo: así el pasado no depende del actual.
  assert.ok(sent.includes('moodStore.resolveMood(historyMap[dateStr])'));
  assert.equal((sent.match(/getMoodById/g) || []).length, 1, 'getMoodById solo para el estado recién elegido');
});

test('el apodo del saludo va en letra elegante, no en la de la interfaz', async () => {
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');
  const nombre = css.slice(css.indexOf('.home-hero__greet-name {'));

  // Playfair Display es la serif que el proyecto ya carga: sin descargas nuevas.
  assert.match(nombre, /font-family:\s*var\(--font-display/, 'el apodo usa la fuente display');
  assert.match(nombre, /font-style:\s*italic/, 'y en cursiva, que es lo que la hace elegante');
  assert.ok(!nombre.slice(0, nombre.indexOf('}')).includes('--font-ui'), 'no debe caer en la fuente de la interfaz');

  // La fuente elegante solo para el apodo: el resto del saludo sigue siendo Inter.
  const saludo = css.slice(css.indexOf('.home-hero__greet {'), css.indexOf('.home-hero__greet-name {'));
  assert.match(saludo, /font-family:\s*var\(--font-ui\)/, 'el saludo conserva la tipografía de la interfaz');
});

test('la migracion 019 cierra la fuga de moods sin poder borrar datos', async () => {
  const sql = await readFile(projectPath('sql', '019_aislamiento_verificado.sql'), 'utf8');

  // La fuga medida: dada (is_admin=false) leia 7 filas de moods de admin.
  // Se corrige sin depender del nombre de la politica sobrante, que no
  // aparece en ningun fichero del repo.
  assert.match(sql, /FROM pg_policies/, 'busca las politicas reales de la tabla');
  assert.match(
    sql,
    /policyname NOT IN \([\s\S]*?'moods_select_policy'[\s\S]*?'moods_delete_policy'/,
    'descarta cualquier politica que no sea una de las cuatro previstas',
  );
  assert.match(sql, /DROP POLICY %I ON public\.moods/, 'borra la sobrante por nombre, en tiempo de ejecucion');

  // Y deja moods con las cuatro correctas, mirando al dueno.
  for (const p of ['select', 'insert', 'update', 'delete']) {
    assert.match(sql, new RegExp(`CREATE POLICY "moods_${p}_policy"`), `moods_${p}_policy debe recrearse`);
  }
  assert.match(sql, /USING \(public\.is_enabled\(\) AND \(user_id::uuid = auth\.uid\(\) OR public\.is_admin\(\)\)\)/);

  // push: api/push.js usa service_role y 018 no le dio permiso. Sin esto
  // el alta de suscripciones push estaba rota.
  assert.match(sql, /GRANT ALL ON public\.push_subscriptions TO service_role/);

  // Guarantee dura: una migracion de seguridad no puede destruir datos.
  const sinComentario = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(sinComentario, /\bDROP\s+TABLE\b/i, 'no puede tirar ninguna tabla');
  assert.doesNotMatch(sinComentario, /\bTRUNCATE\b/i, 'no puede vaciar ninguna tabla');
  assert.doesNotMatch(sinComentario, /\bDELETE\s+FROM\b/i, 'no puede borrar filas');
  assert.doesNotMatch(sinComentario, /\bDROP\s+(COLUMN|FUNCTION)\b/i, 'no puede quitar columnas ni funciones');
});

test('los regalos del calendario se recorren con flechas sin cerrar', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const ui = await readFile(hub('src', 'components', 'ui.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  // Solo los regalos DEL DÍA: las flechas nosaltan a otra fecha.
  assert.doesNotMatch(cal, /function browseList/, 'la lista era de todo el catálogo y ya no debe existir');
  const open = cal.slice(cal.indexOf('function openExperience'), cal.indexOf('function markGiftSeen'));
  assert.match(open, /const list = dayIds\(dateStr\)/, 'la lista sale de los regalos del día');
  assert.match(open, /\.map\(id => \(\{ gift: giftOf\(id\), dateStr \}\)\)/, 'con el regalo resuelto');
  assert.doesNotMatch(open, /catalog\?\.months|catalog\.months/, 'no debe construir la lista desde los meses');

  // Moverse con las flechas ES mirar el regalo: tiene que quedar como visto.
  const go = open.slice(open.indexOf('const go = (delta)'), open.indexOf('function paint()'));
  assert.match(go, /markGiftSeen\(list\[index\]\.gift\.id\)/, 'navegar marca el regalo como visto');

  // Flechas laterales: dos botones y un contador de posicion.
  assert.match(cal, /exp-browse__arrow--prev/);
  assert.match(cal, /exp-browse__arrow--next/);
  assert.match(cal, /\$\{index \+ 1\} de \$\{list\.length\}/, 'indica en cual de los regalos va');
  assert.match(open, /if \(list\.length < 2\) navEl\.hidden = true/, 'con un solo regalo no hay flechas');

  // Y se puede con el teclado, que es lo que hace comodo recorrerlos.
  assert.match(cal, /event\.key === 'ArrowLeft'/, 'flecha izquierda');
  assert.match(cal, /event\.key === 'ArrowRight'/, 'flecha derecha');
  // Sin secuestrar las flechas mientras se escribe una respuesta.
  assert.match(cal, /const typing = event\.target\.closest\?\.\('input,textarea,select,\[contenteditable\]'\)/);

  // No es ciclico y en los extremos la flecha se desactiva: dar la vuelta
  // de diciembre a agosto confunde mas que ayuda.
  assert.match(cal, /if \(next < 0 \|\| next >= list\.length\) return;/, 'no da la vuelta');
  assert.match(cal, /btnPrev\.disabled = index === 0/);
  assert.match(cal, /btnNext\.disabled = index === list\.length - 1/);

  // Redibuja en el sitio: si cerrara el sheet al cambiar, seria un "_exit"
  // y habria que volver a abrir cada regalo.
  assert.doesNotMatch(cal.slice(cal.indexOf('function openExperience'), cal.indexOf('/** Marca solo el regalo abierto')), /closeSheets\(\)[^)]*\)\s*;\s*\}\s*$/m, 'no cierra el sheet al navegar');

  // El icono de flecha tiene que existir de verdad: icon() cae en silencio
  // a una estrella si el nombre no esta en ICONS.
  for (const name of ['chevron-left', 'chevron-right']) {
    assert.ok(ui.includes(`'${name}':`), `falta el icono ${name} en ICONS`);
  }

  // En movil las flechas bajan a una fila (pulgar); en ancho, a los lados.
  assert.match(css, /\.exp-browse__nav \{ display: flex/, 'fila de flechas en movil');
  assert.match(css, /\.exp-browse__nav \{ display: contents/, 'flechas laterales en ancho');
  assert.match(css, /\.exp-browse__stage \{ padding-inline: 56px/, 'el texto no puede quedar debajo de la flecha');
});

test('cada tipo de regalo se ve distinto, no solo con un color', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  // 21 tipos con solo 5 tonos: sin una clase por tipo, una carta y un
  // mensaje se ven iguales. La chapa lleva tono + tipo, y el contenido el tipo.
  assert.match(cal, /kind\.className = `exp-kind is-\$\{tone\} exp-kind--\$\{actual\.gift\.type\}`/);
  assert.match(cal, /stage\.className = `exp-browse__stage exp--\$\{actual\.gift\.type\}`/);
  assert.match(cal, /kindLabel\.textContent = meta\.label/, 'la chapa nombra el tipo');
  assert.match(cal, /kindIcon\.innerHTML = icon\(meta\.icon, 15\)/, 'con su icono');

  // El tono se activa con is-*, que es como los define el fichero: con
  // exp-kind--rose, --tone no resolveria y la chapa saldria gris.
  assert.match(css, /\.is-rose\s*\{ --tone:/, 'los tonos existen como .is-*');
  assert.match(css, /\.exp-kind \{[\s\S]*?var\(--tone-soft/, 'la chapa usa los tokens de tono');

  // Y cada familia tiene forma propia, no solo un color distinto.
  const familias = [
    ['letter', /--font-display/, 'la carta va en tipografia de imprenta'],
    ['riddle', /border: 2px solid var\(--tone/, 'el acertijo va enmarcado'],
    ['polaroid', /rotate\(-0\.7deg\)/, 'la foto va como polaroid'],
    ['memory', /rotate\(0\.7deg\)/, 'el recuerdo va al otro lado'],
    ['video', /background: #000/, 'el video va en negro de cine'],
    ['coupon', /border: 2px dashed/, 'el vale va troceado'],
    ['wishlist', /border: 1px dashed/, 'la lista va con guiones'],
    ['affirmation', /text-align: center/, 'el mensaje va centrado'],
    ['relax', /\.exp--relax \.exp-text \{/, 'la desconexion tiene estilo propio'],
    ['surprise', /\.exp--surprise \.exp-surprise \{/, 'la sorpresa tiene estilo propio'],
    ['craft', /\.exp--craft \.exp-text/, 'la manualidad tiene estilo propio'],
  ];
  for (const [tipo, patron, motivo] of familias) {
    assert.ok(new RegExp(`\\.exp--${tipo}[ ,{]`).test(css), `falta el estilo de ${tipo}`);
    assert.match(css, patron, motivo);
  }
});

test('el sistema de respuestas es alcanzable y el día avisa de lo que falta', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // El fallo de origen: renderAsk exigia data.question, pero el unico campo
  // question del Admin era el de riddle, que renderAsk excluia. Sistema muerto.
  // Ahora la regla es una sola y compartida por todos: tiene question.
  assert.match(cal, /function hasAskBox\(gift\) \{\s*return !!gift\?\.data\?\.question;/,
    'la caja se abre con tener question, sin listas de tipos');
  assert.doesNotMatch(cal, /if \(!question \|\| gift\.type === 'riddle'/, 'ya no se excluye por tipo');
  // Y el que decide si sale la caja es el mismo que decide el sobre y el
  // contador: si se desincronizan, promete una caja que no aparece.
  assert.match(cal, /if \(!hasAskBox\(gift\)\) return null;/);
  assert.match(cal, /const pendingAnswer = \(gift\) => hasAskBox\(gift\)/);
  assert.match(cal, /const preguntas = \(catalog\?\.gifts \|\| \[\]\)\.filter\(hasAskBox\);/);
  assert.match(cal, /\.filter\(hasAskBox\)/);

  // El Admin debe ofrecer el campo en todos los tipos salvo math, que usa
  // `problem` y no pregunta nada.
  assert.match(admin, /if \(type === 'math'\) return baseFields\(type\);/);
  assert.match(admin, /\['question', 'Pregunta para ella \(opcional\) 💌', 'textarea'\]/);

  // loadMyResponses era de modulo y llamaba a paintAll, que vive en el cierre
  // de la pagina: la promesa rechazaba y el catch dejaba la cache vacia, asi
  // que el calendario volvía a decir que habia 65 preguntas pendientes.
  assert.match(cal, /function loadMyResponses\(\) \{\s*return db\.getMyGiftResponses\(\)/,
    'devuelve la promesa y no repinta por su cuenta');
  assert.doesNotMatch(cal.slice(cal.indexOf('function loadMyResponses()'), cal.indexOf('HELPERS DE FECHA')), /paintAll/, 'no puede llamar a paintAll desde el modulo');
  assert.match(cal, /loadMyResponses\(\)\.then\(paintAll\);/, 'quien la llama se encarga de repintar');

  // Y guardar una respuesta tiene que actualizar la cache: si solo se guarda
  // en Supabase, el sobre y el contador seguirian diciendo que falta.
  assert.match(cal, /function setResponse\(/, 'unico punto de escritura');
  assert.match(cal, /setResponse\(gift\.id, text,/, 'renderAsk lo usa');

  // Editable: antes el textarea se bloqueaba para siempre en cuanto enviabas.
  assert.doesNotMatch(cal, /disable\('Respondida ❤'\)/);
  assert.match(cal, /Guardar cambios/, 'el boton pasa a guardar cambios');
});

test('un día a medias se distingue de uno sin abrir', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  assert.match(cal, /const isPartial = \(ids\) => \{[\s\S]*?n > 0 && n < ids\.length/, 'parcial = alguno abierto y alguno no');
  assert.match(cal, /function openState\(dateStr, ids\) \{[\s\S]*?if \(isPartial\(ids\)\) return 'partial';/);
  // El estado se decide en un sitio unico para que la marca y el aria-label
  // no puedan contradecirse.
  assert.match(cal, /return openState\(dateStr, ids\);/, 'ambos caminos pasan por openState');
  assert.match(cal, /if \(state === 'partial'\) classes\.push\('is-partial'\)/);
  assert.match(cal, /state === 'partial' \? `\$\{day\} — \$\{abiertos\} de \$\{count\} regalos abiertos`/, 'y lo dice con palabras');
  assert.match(cal, /\$\{abiertos > 0 \? `<div class="cal-dayprogress\$\{abiertos === ids\.length \? ' is-done' : ''\}"[\s\S]*?` : ''\}/,
    'oculta la barra de progreso en los días sin ningún regalo abierto');
  assert.match(css, /\.cal-day__part \{/, 'con su propia marca, no un punto más');
});

test('la barra de progreso no se lee como una línea negra al pie del calendario', async () => {
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  // La barra global ocupa todo el ancho de la tarjeta pegada a su borde
  // inferior. Con pista oscura y el 99% vacía (4 de 393) se leía como una barra
  // negra siempre presente, así que la pista ya no se pinta: solo el relleno.
  const bars = [...css.matchAll(/\.cal-progress__bar,\s*\.cal-dayprogress__bar \{([\s\S]*?)\}/g)];
  assert.ok(bars.length, 'las barras comparten estilo');
  const bar = bars[bars.length - 1][1]; // manda el último bloque: el que gana en cascada
  assert.match(bar, /height: 6px;/, 'la barra es fina, no un bloque oscuro');
  assert.match(bar, /background: transparent;/, 'la pista no se pinta: no hay franja oscura que leer como barra');
  assert.doesNotMatch(css, /\.cal-progress__bar[^{]*\{[^}]*height: 10px;/,
    'ninguna variante reintroduce la barra gruesa');

  // El relleno es lo único visible, y no se desaparece con un avance pequeño.
  // (La regla de reduced-motion comparte selector pero no pinta el relleno.)
  const fills = [...css.matchAll(/\.cal-progress__bar span,\s*\.cal-dayprogress__bar span \{([\s\S]*?)\}/g)]
    .map(m => m[1])
    .filter(body => /height: 100%/.test(body));
  assert.ok(fills.length, 'el relleno de las barras tiene estilo propio');
  const fill = fills[fills.length - 1];
  assert.match(fill, /min-width: 6px;/, 'con avance mínimo el relleno sigue viéndose');

  // Y el pie va separado de la cuadrícula para que lea como bloque y no como línea.
  const foots = [...css.matchAll(/\.cal-progress \{([\s\S]*?)\}/g)];
  assert.ok(foots.length, 'el pie del calendario tiene estilo propio');
  const foot = foots[foots.length - 1][1];
  assert.match(foot, /border-top: 1px solid var\(--border-soft\);/,
    'un filo lo separa de la cuadrícula');
  assert.match(foot, /padding-top: 16px;/, 'con aire para que no toque el borde inferior');

  // La barra del día ya no tira del título hacia arriba con margen negativo.
  assert.match(css, /\.cal-dayprogress \{\s*margin: 0 0 var\(--sp-12\);/,
    'el progreso del día no se solapa con el título de la fecha');
});

test('el calendario muestra los regalos en la cuadrícula y permite cambiar de vista', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  assert.match(cal, /const CALENDAR_VIEWS = \[\s*\{ id: 'month', label: 'Mes' \},\s*\{ id: 'week', label: 'Semana' \}\s*\];/);
  assert.doesNotMatch(cal, /\{ id: 'day', label: 'Día' \}|CALENDAR_VIEW\.DAY|cal-grid--day/, 'solo hay vistas de mes y semana');
  assert.match(cal, /data-calendar-view="\$\{id\}"/);
  assert.match(cal, /const firstCell = new Date\(year, month - 1, 1\)/);
  assert.match(cal, /firstCell\.setDate\(firstCell\.getDate\(\) - mondayIndex\(selectedParts\[0\], selectedParts\[1\], selectedParts\[2\]\)\)/,
    'la semana empieza en lunes');
  assert.doesNotMatch(cal, /cal-event|data-gift-id|data-day-more/, 'la cuadrícula no muestra etiquetas ni listas de regalos');
  assert.match(cal, /state === 'opened' \? `<span class="cal-day__ok"[\s\S]*?state === 'partial' \? `<span class="cal-day__part"/,
    'los días abiertos muestran check y los parciales su progreso');
  assert.match(cal, /count && state !== 'opened' && state !== 'partial'[\s\S]*?cal-day__dot/,
    'los días pendientes y bloqueados muestran solo el punto');
  assert.match(cal, /<button type="button" class="\$\{classes\.join\(' '\)\}" data-date="\$\{dateStr\}" aria-label=.*aria-pressed="\$\{dateStr === selected\}"\$\{adjacent \? ' disabled' : ''\}>/,
    'toda la tarjeta es un boton accesible, y solo se deshabilitan los dias adyacentes');
  assert.match(cal, /host\.querySelectorAll\('\.cal-day\[data-date\]'\)/,
    'el listener cubre la tarjeta completa');
  assert.match(cal, /onclick: \(\) => openExperience\(gift, dateStr\)/,
    'los regalos siguen disponibles en el detalle del día');
  assert.match(cal, /function selectCalendarDate\(dateStr\) \{[\s\S]*?paintDay\(\);\s*page\.querySelector\('#calDay'\)\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\);/,
    'al seleccionar un día se muestra automáticamente su agenda');
  assert.match(cal, /page\.querySelector\('#calDay'\)\?\.removeAttribute\('hidden'\)/,
    'el panel del día sigue disponible al seleccionar fechas en Mes o Semana');
  assert.doesNotMatch(css, /\.cal-grid--day/, 'no quedan estilos para la vista diaria eliminada');
  assert.match(css, /\.cal-day \{[\s\S]*?min-height: 80px;/, 'la cuadrícula mensual es compacta en escritorio');
  assert.match(css, /\.cal-grid--week \.cal-day \{ min-height: 128px; \}/, 'la vista semanal evita celdas excesivamente altas');
  assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*?\.cal-day \{ min-height: 96px;/, 'móvil conserva celdas cómodas al tacto');
  assert.doesNotMatch(css, /\.cal-day__select/, 'el número ya no es la única zona clicable');
  assert.match(css, /\.cal-day \{[\s\S]*?cursor: pointer;/, 'la tarjeta comunica que se puede pulsar');
  assert.doesNotMatch(css, /\.cal-event/, 'el calendario no reserva estilos para etiquetas de regalos en la cuadrícula');
  assert.match(css, /\.calendario-page \{\s*width: 100%;\s*max-width: 860px;\s*min-width: 0;\s*margin: 0 auto;/,
    'el calendario queda centrado y acotado en escritorio');
  assert.match(css, /\.content:has\(> \.calendario-page\) \{ max-width: 1680px; \}/,
    'el contenedor conserva su ancho responsive general');
  assert.match(css, /@media \(max-width: 480px\) \{[\s\S]*?\.cal-weekdays, \.cal-grid \{ gap: 4px; \}/,
    'la cuadrícula sigue siendo compacta en móvil');
});

test('el calendario conserva su cabecera y el regalo destacado sobre la cuadrícula', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  assert.match(cal, /\$\{renderHead\(\)\}\s*<div id="calSpot"><\/div>\s*<div id="calMonth"><\/div>/,
    'la cabecera y el regalo destacado van antes del calendario');
  assert.match(cal, /<h1 class="scr-title">Calendario<\/h1>/);
  assert.match(cal, /Un regalo cada día, pensado para ti/);
  assert.equal((cal.match(/id="calSearchBtn"/g) || []).length, 1, 'la lupa solo aparece en la cabecera principal');
  assert.equal((cal.match(/id="calAnswersBtn"/g) || []).length, 1, 'el correo solo aparece en la cabecera principal');
  assert.equal((cal.match(/id="calDevBtn"/g) || []).length, 1, 'los ajustes solo aparecen en la cabecera principal');
  assert.doesNotMatch(cal.slice(cal.indexOf('host.innerHTML = `', cal.indexOf('function paintMonth()')), cal.indexOf('host.querySelectorAll(\'.cal-day__select', cal.indexOf('function paintMonth()'))), /cal-head__tools/,
    'la cabecera interior conserva la navegación y las vistas, no duplica acciones');
  assert.match(cal, /function paintSpot\(\)/);
  assert.match(cal, /class="cal-spot__when"/);
  assert.match(cal, /class="cal-spot__title"/);
  assert.match(cal, /class="cal-spot__type"/);
  assert.match(cal, /function paintAll\(\) \{\s*paintHeadBadge\(\);\s*paintSpot\(\);/,
    'el regalo destacado se actualiza al repintar el calendario');
  assert.match(cal, /page\.cleanup = \(\) => \{\s*stopSpotRotation\(\);/,
    'se detiene su rotación al salir de la página');
  assert.match(css, /\.cal-spot__body \{/);
});

test('el Admin ya no destruye el texto de las cartas al guardar', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // Las cartas guardan su texto en `message` (43 de 47); el formulario pedía
  // `content`, así que al guardar se perdía. El texto se leía de las dos
  // claves y se escribe en la buena.
  assert.match(admin, /case 'letter':\s*return \[\['message', 'Contenido de la carta'/,
    'la carta se edita sobre la clave que usan los datos');
  assert.match(admin, /data0\[key\] \|\| \(key === 'message' \? data0\.content : ''\)/,
    'y si viene en content, también se muestra');

  // El fallo de raiz: payloadData se armaba desde cero, con lo que el
  // formulario no conociera se perdia. Ahora parte de lo que ya habia.
  assert.match(admin, /const payloadData = \(!isNew && gift && type === gift\.type && gift\.data\)/,
    'parte de los datos existentes en vez de reconstruirlos');
  assert.match(admin, /\? \{ \.\.\.gift\.data \}/, 'copiandolos');
  assert.match(admin, /: \{\};/, 'y si cambia el tipo, empieza de cero');
});

test('la categoría "Reto real" está fusionada con "Reto" y no puede volver', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const expansion = await readFile(hub('src', 'data', 'calendar-expansion.js'), 'utf8');
  const gifts = await readFile(hub('src', 'services', 'gifts.service.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  // El tipo desaparece del catalogo, del panel y del generador. Si alguien
  // lo reintroduce, la categoria vuelve a existir y se pueden volver a crear
  // regalos de un tipo que ya no existe en los datos.
  assert.doesNotMatch(cal, /offline:\s*\{ icon:/, 'Calendario no debe declarar el tipo offline');
  assert.doesNotMatch(cal, /offline: '/, 'ni su tono');
  assert.doesNotMatch(admin, /label: 'Reto real'/, 'el Admin no debe ofrecerlo en el desplegable');
  assert.doesNotMatch(admin, /case 'offline'/, 'ni su esquema de campos');
  assert.doesNotMatch(expansion, /type: 'offline'/, 'el generador no debe crearlo');
  assert.doesNotMatch(css, /\.exp--offline/, 'ni sus estilos');

  // Pero los textos no se pierden: viven ahora dentro de los retos.
  assert.match(expansion, /\['Reto real',/, 'los textos de reto real siguen vivos como Reto');
  assert.match(expansion, /\['Reto fuera de la web',/, 'y los de reto fuera de la web');

  // El campo instructions venía del esquema de offline: si disappears al
  // fusionar, abrir y guardar uno de esos retos en el Admin lo borraría.
  assert.match(admin, /case 'challenge':[\s\S]*?'instructions'/, 'Reto conserva el campo instructions');

  // Las copias ya guardadas en el cliente (localStorage, service worker, un
  // movil sin abrir desde el cambio) siguen trayendo type: 'offline'. Sin
  // normalizar al cargar, esos regalos cairian en el tipo por defecto.
  assert.match(gifts, /const LEGACY_TYPES = \{ offline: 'challenge' \}/);
  assert.match(gifts, /normalizeLegacyTypes\(data\);/, 'y se aplica al cargar el catalogo');
});

test('la migracion 020 cierra las politicas permisivas sin romper el panel de admin', async () => {
  const sql = await readFile(projectPath('sql', '020_policies_permisivas.sql'), 'utf8');

  // El fallo era el mismo que en moods: politicas PERMISIVAS que se
  // combinan con OR y anulan las restrictivas. Se barean por pg_policies,
  // sin fiarse del nombre, que es lo que fallo con 016.
  assert.match(sql, /FROM pg_policies/, 'busca las politicas reales de cada tabla');
  assert.match(sql, /policyname NOT IN/, 'solo conserva las de la lista blanca');
  assert.match(sql, /DROP POLICY %I ON public\.%I/, 'las elimina en tiempo de ejecucion');

  // playlists era la fuga grave: read/update/delete con USING (true).
  for (const mala of ['playlists_read_all', 'playlists_write_all', 'playlists_update_all', 'playlists_delete_all']) {
    assert.ok(!new RegExp(`CREATE POLICY "${mala}"`).test(sql), `${mala} no debe recrearse nunca`);
  }
  for (const buena of ['select', 'insert', 'update', 'delete']) {
    assert.match(sql, new RegExp(`CREATE POLICY "playlists_${buena}_owner"`), `playlists_${buena}_owner debe recrearse`);
  }
  assert.match(sql, /WITH CHECK \(public\.is_enabled\(\) AND \(created_by = auth\.uid\(\) OR public\.is_admin\(\)\)\)/);

  // lists blancos completas: si se olvidara una de lectura del admin, el
  // panel se quedaria sin ver la actividad.
  for (const p of ['activity_log_select_admin', 'analytics_visits_select_admin', 'analytics_events_select_admin']) {
    assert.ok(sql.includes(`"${p}"`), `${p} debe seguir en la lista blanca`);
  }
  assert.match(sql, /user_id = auth\.uid\(\)::text/, 'la telemetria se escribe en nombre propio');

  // La auditoria de 019 solo miraba USING y salia null en los INSERT, que
  // se deciden con WITH CHECK. Esta tiene que mirar las dos.
  assert.match(sql, /with_check/, 'la auditoria debe incluir WITH CHECK');
  // Ni una gota de datos.
  const sinComentario = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sinComentario, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sinComentario, /\bTRUNCATE\b/i);
  assert.doesNotMatch(sinComentario, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(sinComentario, /\bUPDATE\s+public\./i, 'esta migracion es solo de politicas');
});

test('se puede encontrar un regalo sin recorrer el calendario dia a dia', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  // El indice se construye una vez por catalogo, no en cada pulsacion: con
  // 393 regalos, rehacerlo por tecla se notaba.
  assert.match(cal, /if \(searchIndex && searchIndexFor === catalog\) return searchIndex;/);
  assert.match(cal, /searchIndexFor = catalog;/);

  // Se indexa lo que de verdad se busca: titulo, tipo, mes y el texto del
  // regalo. Sin el mes, "diciembre" no encontraba nada.
  for (const campo of ['gift.title', 'metaOf(gift.type).label', 'const mes =', 'data.message', 'data.fact', 'data.question']) {
    assert.match(cal, new RegExp(campo.replace(/[().]/g, (c) => `\\${c}`)), `el indice debe incluir ${campo}`);
  }

  // Varias palabras: todas tienen que aparecer ("carta playa").
  assert.match(cal, /terms\.every\(\(term\) => entry\.texto\.includes\(term\)\)/);
  assert.match(cal, /limit = 60/, 'el resultado se acota para no pintar 393 nodos');
  assert.match(cal, /Mostrando \$\{encontrados\.length\} de \$\{total\} coincidencias\./);

  // Un dia bloqueado NO se abre: la sorpresa no se gasta buscandola. Y el
  // candado va antes de abrir nada, no despues.
  const bloqueado = cal.slice(cal.indexOf('function openSearch'));
  assert.match(bloqueado, /if \(bloqueado\) \{[\s\S]*?toast\([\s\S]*?return;[\s\S]*?\}/,
    'un regalo bloqueado avisa y no se abre');
  assert.ok(
    bloqueado.indexOf('if (bloqueado) {') < bloqueado.indexOf('openExperience(gift, dateStr)'),
    'el bloqueo se comprueba antes de abrir el regalo',
  );

  // Facil de llegar y de usar sin raton.
  assert.match(cal, /event\.key\?\.toLowerCase\(\) === 'k' && \(event\.metaKey \|\| event\.ctrlKey\)/, 'atajo Ctrl/⌘+K');
  assert.match(cal, /event\.key !== '\/'\) return;/, 'atajo "/"');
  assert.match(cal, /if \(enCampo\) return;/, 'no pisa lo que se esta escribiendo');
  assert.match(cal, /document\.addEventListener\('keydown', onShortcut\)/);
  assert.match(cal, /document\.removeEventListener\('keydown', onShortcut\)/, 'y se quita al salir de la pagina');
  assert.match(cal, /if \(event\.key !== 'ArrowDown' && event\.key !== 'ArrowUp'\) return;/, 'se recorre con flechas');
  assert.match(cal, /function searchSuggestions\(\)/, 'ofrece palabras que si devuelven algo');
  assert.match(cal, /onclick: \(\) => \{ searchInput\.value = word;/, 'al pulsar una sugerencia se busca');
  assert.match(css, /\.cal-search__chips\[hidden\] \{ display: none; \}/);
});

test('los tres detalles finos del visor de regalos estan resueltos', async () => {
  const cal = await readFile(hub('src', 'pages', 'Calendario.js'), 'utf8');
  const ui = await readFile(hub('src', 'components', 'ui.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'calendario.css'), 'utf8');

  // 1) El tirón al cambiar de regalo. El contenido normal anima su altura,
  //    pero video y movimiento reducido usan layout fluido: sus dimensiones
  //    pueden llegar tarde y no debe quedar un recorte sin transitionend.
  assert.match(cal, /const alturaVieja = stage\.offsetHeight;/);
  assert.match(cal, /const animateHeight = actual\.gift\.type !== 'video' && !prefersReducedMotion;/);
  assert.match(cal, /stage\.style\.overflow = animateHeight \? 'hidden' : '';/);
  assert.match(cal, /const alturaNueva = stage\.scrollHeight;/);
  assert.match(cal, /if \(ev\.target !== stage \|\| ev\.propertyName !== 'height'\) return;/);
  assert.match(cal, /stage\.style\.height = '';      \/\/ vuelve a crecer con el contenido/);
  assert.match(css, /transition: height 0\.22s/);
  assert.match(css, /\.exp-media \.ml-video-wrap \{\s*display: block;/, 'el reproductor usa layout fluido');
  assert.match(css, /\.exp-media \.ml-media \{\s*width: 100%;\s*height: auto;/, 'el video conserva su proporcion');
  // Y si el sistema pide menos movimiento, no se interpola.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.exp-browse__stage \{ transition: none; \}/);

  // 2) El foco se salia del sheet. Ahora Tab queda dentro, en los dos
  //    sentidos, y al cerrar vuelve donde estaba.
  assert.match(ui, /if \(event\.key !== 'Tab'\) return;/);
  assert.match(ui, /if \(event\.shiftKey && actual === first\) \{[\s\S]*?last\.focus/);
  assert.match(ui, /\} else if \(!event\.shiftKey && actual === last\) \{[\s\S]*?first\.focus/);
  assert.match(ui, /if \(!sheetEl\.contains\(actual\)\)/, 'el foco se devuelve si se ha quedado fuera');
  assert.match(ui, /if \(lastFocused && typeof lastFocused\.focus === 'function'\)/, 'al cerrar se recupera el foco');

  // 3) El aria-live esta en el panel entero, que se repinta en cada flecha
  //    (navegar marca el regalo como visto). Ahora solo habla el dia.
  assert.match(cal, /<p class="sr-only" id="calAnnounce" aria-live="polite">/);
  assert.match(cal, /if \(dateStr === lastAnnouncedDay\) return;/, 'no re-anuncia el mismo dia');
  assert.doesNotMatch(cal, /<section id="calDay" aria-live/, 'el panel entero no debe ser region viva');
  // Y solo cuando ya hay catalogo: si no, se quedaria marcado como dicho
  // mientras decia "sin regalo".
  assert.match(cal, /if \(!catalog\) return;/);
});

test('los eventos especiales abren una bienvenida temática única por usuario', async () => {
  const dates = await readFile(hub('src', 'utils', 'specialDates.js'), 'utf8');
  const home = await readFile(hub('src', 'pages', 'Home.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');

  assert.match(dates, /export function specialEventsForDate\(iso = todayISO\(\)\)/);
  assert.match(dates, /\{ id: 'halloween', monthDay: '10-31'/);
  assert.match(dates, /\{ id: 'christmas', monthDay: '12-25'/);
  assert.match(dates, /export const FIXED_IDS = \['anniversary', 'hubStart', 'birthday', 'userBirthday'\]/);
  assert.match(dates, /for \(const event of cfg\.events \|\| \[\]\)/);
  assert.match(dates, /key: `event:\$\{identity\}:\$\{suffix\}`/);
  // La hoja vive en su propio componente: Inicio solo la dispara.
  assert.match(home, /import \{ maybeShowSpecialEvent, previewSpecialEventSheet \} from '\.\.\/components\/SpecialEventSheet\.js'/);
  assert.match(home, /maybeShowSpecialEvent\(page, router\)/);
  assert.match(sheet, /specialEventsToday\(\)\.filter\(item => !seen\[item\.key\]\)/);
  assert.match(sheet, /getUserPref\('specialEventsSeen', '\{\}'\)/);
  assert.match(sheet, /setUserPref\('specialEventsSeen', JSON\.stringify\(seen\)\)/);
  assert.match(sheet, /class: `special-event special-event--\$\{event\.type} special-event--media-/);
  assert.match(sheet, /Abrir el calendario/);
  assert.match(css, /\.overlay--special-event \.sheet/);
  assert.match(css, /\.special-event__icon/);
  assert.match(css, /\.special-event__kicker/);
  // El check-in de ánimo publica su estado; no hay sondeo ni timeout que
  // pueda abrir la tarjeta mientras la bienvenida sigue pendiente.
  assert.match(sheet, /export function setMoodWelcomeState\(state\)/);
  assert.match(sheet, /pendingEventRequests/);
  assert.match(sheet, /moodWelcomeState !== 'clear'/);
  assert.match(sheet, /document\.querySelector\('\.welcome-overlay'\)/);
  assert.doesNotMatch(sheet, /MOOD_WELCOME_MAX_WAIT|setTimeout\(tick/);
});

test('el check-in coordina sus estados y avisa cuando ya se puede abrir el evento', async () => {
  const welcome = await readFile(hub('src', 'components', 'WelcomeScreen.js'), 'utf8');
  const app = await readFile(hub('src', 'components', 'App.js'), 'utf8');
  assert.match(welcome, /ph:mood-welcome-done/,
    'al cerrar el ánimo se libera el día especial');
  assert.match(app, /setMoodWelcomeState\('showing'\)/,
    'el Inicio informa antes de montar el check-in');
  assert.match(app, /setMoodWelcomeState\('clear'\)/,
    'el inicio informa cuando el ánimo ya se respondió o no aplica');
});

// Carga specialDates.js con las dos dependencias externa sustituidas por
// dobles (Supabase y el reloj), para poder ejercitarlo de verdad en Node:
// aquí los fallos se ven, no solo el texto.
// celebration.js no importa nada: se pega dentro del doble tal cual, sin sus
// `export`, para que lo que se prueba sea el código de verdad.
async function celebrationSource() {
  return (await readFile(hub('src', 'utils', 'celebration.js'), 'utf8')).replace(/^export /gm, '');
}

async function loadSpecialDates() {
  let src = await readFile(hub('src', 'utils', 'specialDates.js'), 'utf8');
  src = src
    .replace("import { db } from '../services/db.service.js';",
      'const db = { getHubDates: () => Promise.resolve(globalThis.__CFG__) };')
    .replace("import { todayISO } from './format.js';",
      "const todayISO = () => globalThis.__TODAY__;")
    .replace("import { normalizeDecor, normalizeVideoMode, mediaList } from './celebration.js';",
      await celebrationSource());
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  // specialDates() lee de una caché: hay que recargarla con cada config.
  return { ...mod, use: async cfg => { globalThis.__CFG__ = cfg; await mod.loadSpecialDates(); } };
}

test('la bienvenida de un día se puede editar entero desde la config', async () => {
  const { use, specialEventsForDate } = await loadSpecialDates();

  await use({});
  assert.equal(specialEventsForDate('2026-10-31')[0].icon, '🎃', 'sin config, Halloween es el de fábrica');

  // Texto, emoji, foto y color propios en un día temático…
  await use({ seasonal: [{ id: 'halloween', monthDay: '11-01', title: 'Nochevieja', icon: '🥂', type: 'christmas', description: 'Brindamos por nosotros.', image: 'https://x/f.jpg' }] });
  assert.equal(specialEventsForDate('2026-10-31').length, 0, 'al mover la fecha, el día viejo deja de saltar');
  const nochevieja = specialEventsForDate('2026-11-01')[0];
  assert.equal(nochevieja.title, 'Nochevieja');
  assert.equal(nochevieja.icon, '🥂');
  assert.equal(nochevieja.type, 'christmas');
  assert.equal(nochevieja.image, 'https://x/f.jpg');

  // …y apagar un día para que no salga.
  await use({ seasonal: [{ id: 'halloween', enabled: false }] });
  assert.equal(specialEventsForDate('2026-10-31').length, 0, 'un día apagado no salta ni en su fecha');

  // Añadir un temático que no venía de fábrica.
  await use({ seasonal: [{ id: 'sanvalentin', monthDay: '02-14', title: 'San Valentín', icon: '💘', description: 'Nos queremos.' }] });
  assert.equal(specialEventsForDate('2026-02-14')[0].title, 'San Valentín');

  // Los cuatro principales también.
  await use({
    anniversary: '2025-07-03', recurring: { anniversary: true }, titles: { anniversary: 'Nuestro aniversario' },
    looks: { anniversary: { icon: '💍', description: 'Un año más.', type: 'halloween', image: 'https://x/a.jpg' } }
  });
  const anniv = specialEventsForDate('2026-07-03')[0];
  assert.equal(anniv.title, 'Nuestro aniversario');
  assert.equal(anniv.icon, '💍');
  assert.equal(anniv.description, 'Un año más.');
  assert.equal(anniv.image, 'https://x/a.jpg');

  // Un campo vacío devuelve el valor de fábrica, no deja el día sin emoji.
  await use({ anniversary: '2025-07-03', recurring: { anniversary: true }, looks: { anniversary: { icon: '   ' } } });
  assert.equal(specialEventsForDate('2026-07-03')[0].icon, '🤍');

  // Un tipo inventado no puede colarse: rompería el color de la hoja.
  await use({ events: [{ id: 'x', title: 'Viaje', date: '2026-08-08', type: 'inventado', description: 'A la playa' }] });
  assert.equal(specialEventsForDate('2026-08-08')[0].type, 'custom');

  // Varios días el mismo día: el primero es el titular, el resto se listan.
  await use({ anniversary: '2026-07-03', recurring: { anniversary: true }, events: [{ id: 'a', title: 'Cena', date: '2026-07-03' }] });
  const both = specialEventsForDate('2026-07-03');
  assert.equal(both.length, 2);
  assert.ok(both[0].key.startsWith('date:'));
  assert.ok(both[1].key.startsWith('event:'));

  // Reeditar el texto no cambia la clave: la bienvenida no sale dos veces.
  await use({ events: [{ id: 'a', title: 'Cena', date: '2026-08-08', description: 'x' }] });
  const key = specialEventsForDate('2026-08-08')[0].key;
  await use({ events: [{ id: 'a', title: 'Cena', date: '2026-08-08', description: 'otro texto' }] });
  assert.equal(specialEventsForDate('2026-08-08')[0].key, key, 'la clave debe depender del id, no del texto');
});

test('guardar sanea los eventos: nada de campos raros ni filas a medias', async () => {
  // saveHubDates es la puerta de entrada: si aquí se cuela un mes-día roto o
  // un evento sin título, la bienvenida sale vacía o no sale.
  let src = await readFile(hub('src', 'services', 'db.service.js'), 'utf8');
  const guardado = [];
  src = src
    .replace("import { supabase } from './supabase.js';", 'const supabase = { from: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) };')
    .replace("import { auth } from './auth.service.js';", 'const auth = { getUser: () => null, isAdmin: () => true, onAuthChange: () => {}, isReady: () => Promise.resolve() };')
    .replace("import { escapeHtml } from '../utils/escape.js';", 'const escapeHtml = s => s;')
    .replace("import { userPrefKey } from '../utils/userStorage.js';", 'const userPrefKey = k => k;')
    .replace("import { normalizeDecor, normalizeVideoMode, mediaList, MAX_EMOJIS } from '../utils/celebration.js';",
      await celebrationSource())
    .replace('await saveContent(\'hub_dates\', clean);', 'globalThis.__SAVED__ = clean;');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  globalThis.__SAVED__ = null;

  const base = { anniversary: '2025-07-03', hubStart: '2024-05-10', birthday: '2012-09-03', userBirthday: '2009-08-03' };
  await mod.db.saveHubDates({
    ...base,
    titles: {}, recurring: {},
    // Basura a propósito: sin título, sin fecha, mes-día inválido, tipo raro.
    events: [
      { id: 'a', title: 'Viaje', date: '2026-08-08', type: 'inventado', icon: '  🏖️  ',
        description: '  Primera vez  ', video: 'no-es-una-url', decor: 'inventado',
        gallery: ['https://x/1.jpg', '  ', 'tampoco-es-url'], emojis: '  🎃 👻  ' },
      { id: 'b', title: '   ', date: '2026-08-09' },
      { id: 'c', title: 'Sin fecha', date: '' }
    ],
    seasonal: [
      { id: 'h', monthDay: '10-31', title: 'Halloween', icon: '🎃', description: 'Sustos' },
      { id: 'malo', monthDay: '31-10', title: 'Invertido' },
      { id: 'vacio', monthDay: '', title: 'Sin día' }
    ],
    looks: {
      anniversary: { icon: '💍', description: 'Un año más.', type: 'halloween', image: '  ' },
      hubStart: { icon: '', description: '  ', type: '', image: '' }
    }
  });

  const saved = globalThis.__SAVED__;
  assert.equal(saved.events.length, 1, 'solo se guarda el evento con título y fecha');
  assert.equal(saved.events[0].description, 'Primera vez', 'el texto se guarda recortado');
  assert.equal(saved.events[0].icon, '🏖️', 'el emoji se guarda recortado');
  assert.equal(saved.events[0].video, '', 'un vídeo que no es URL no se guarda');
  assert.equal(saved.events[0].decor, 'confeti', 'un ambiente inventado cae al de fábrica');
  assert.deepEqual(saved.events[0].gallery, ['https://x/1.jpg'], 'solo quedan las fotos que son URL');
  assert.equal(saved.events[0].emojis, '🎃 👻', 'los emojis que caen se guardan limpios');
  assert.equal(saved.seasonal.length, 1, 'un mes-día invertido o vacío no se guarda');
  assert.equal(saved.seasonal[0].monthDay, '10-31');
  // Un aspecto con contenido se guarda; la foto en blanco queda vacía para
  // que ese día salga sin foto, y un aspecto totalmente vacío se descarta
  // (vuelve a los valores de fábrica).
  assert.deepEqual(saved.looks, {
    anniversary: {
      icon: '💍', description: 'Un año más.', type: 'halloween', image: '',
      video: '', videoMode: 'portada', gallery: [], decor: 'confeti', emojis: ''
    }
  }, 'un aspecto vacío no se guarda y los medios salen limpios');
});

test('el Perfil no borra lo que se editó en el Admin al guardar desde el móvil', async () => {
  const profile = await readFile(hub('src', 'pages', 'Profile.js'), 'utf8');

  // El editor del Perfil solo toca título/fecha/repetición: si no reenvía el
  // resto, cada guardado desde el móvil borraría fotos, textos y temáticos.
  assert.match(profile, /const current = specialDates\(\);/);
  assert.match(profile, /looks: current\.looks \|\| \{\}/);
  assert.match(profile, /seasonal: current\.seasonal \|\| \[\]/);
});

test('el Admin puede editar el aspecto, añadir y quitar días temáticos', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');
  const dbSvc = await readFile(hub('src', 'services', 'db.service.js'), 'utf8');
  const profile = await readFile(hub('src', 'pages', 'Profile.js'), 'utf8');

  // Los tres bloques del panel.
  assert.match(admin, /id="datesLooksList"/, 'editor del aspecto de los cuatro días');
  assert.match(admin, /id="datesSeasonalList"/, 'lista de días temáticos');
  assert.match(admin, /id="addDatesSeasonalBtn"/, 'botón para añadir un temático');
  assert.match(admin, /id="addDatesEventBtn"/, 'botón para añadir un evento');
  // Emoji, color, texto y foto, tanto en eventos como en temáticos.
  assert.match(admin, /\.dates-look-icon/);
  assert.match(admin, /\.dates-look-type/);
  assert.match(admin, /\.dates-look-desc/);
  assert.match(admin, /\.dates-look-image/);
  // El mes-día se valida en vez de descartarse en silencio.
  assert.ok(admin.includes("blockSave('Falta el mes y el día, tipo 10-31', badSeasonal);"), 'un día temático necesita mes-día');
  // Se guarda todo junto.
  assert.match(admin, /db\.saveHubDates\(\{ anniversary, hubStart, birthday, userBirthday, events, seasonal, looks, titles, recurring \}\)/);
  // El guardado sanea lo que llega.
  assert.match(dbSvc, /function cleanEvent\(event\)/);
  assert.match(dbSvc, /function cleanSeasonal\(event\)/);
  assert.match(dbSvc, /const monthDay = text\(event\?\.monthDay\)/, 'el mes-día se recorta y se valida');
  // El Perfil reenvía lo que no edita: si no, al guardar desde el móvil se perdía.
  assert.match(profile, /looks: current\.looks \|\| \{\}/);
  assert.match(profile, /seasonal: current\.seasonal \|\| \[\]/);
  assert.match(css, /\.dates-event-look/);
  assert.match(css, /\.dates-look-preview/);
});

test('la foto de un día sale en la hoja y el emoji si no hay foto', async () => {
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');

  assert.match(sheet, /!conVideoPortada && portada\s*\n\s*\? h\('div', \{ class: 'special-event__photo' \}/,
    'la foto va antes del emoji y el vídeo de portada la sustituye');
  assert.match(sheet, /class: 'special-event__item-photo'/, 'los días secundarios también llevan su foto');
  assert.match(css, /\.special-event__photo/);
  assert.match(css, /\.special-event__item-photo/);
});

test('un día temático se puede ver antes de que llegue (?evento=)', async () => {
  const dates = await readFile(hub('src', 'utils', 'specialDates.js'), 'utf8');
  const home = await readFile(hub('src', 'pages', 'Home.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');

  // Alias legibles + fechas sueltas, con año en curso para mes-día.
  assert.match(dates, /export function resolveEventPreview\(value\)/);
  assert.match(dates, /halloween: '10-31'/);
  assert.match(dates, /navidad: '12-25'/);
  assert.match(dates, /test\(raw\) \? raw : null/,
    'una fecha completa se acepta tal cual');
  // La vista previa no marca nada como visto: es mirar, no vivir el día.
  assert.match(sheet, /export function previewSpecialEventSheet\(value, router\)/);
  assert.match(sheet, /openSpecialEventSheet\(events, router, \{ preview: true \}\)/);
  assert.match(sheet, /Vista previa/);
  // Inicio la abre desde la query y limpia el parámetro para no repetirla.
  assert.match(home, /router\?\.currentRoute\?\.query\?\.evento/);
  assert.match(home, /previewSpecialEventSheet\(requested, router\)/);
  assert.match(home, /params\.delete\('evento'\)/);
  assert.match(home, /if \(!previewRequestedEvent\(router\)\) maybeShowSpecialEvent\(page, router\)/);
});

test('el saludo de inicio y los días juntos usan el mismo cuerpo grande', async () => {
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');
  const saludo = css.slice(css.indexOf('.home-hero__greet {'), css.indexOf('.home-hero__greet-name {'));
  const contador = css.slice(css.indexOf('.home-hero__num {'), css.indexOf('.home-hero__quote {'));
  const size = (bloque) => (bloque.match(/font-size: var\(--fs-([\w-]+)\)/) || [])[1];

  // Lo que importa es que el saludo y el contador midan lo mismo (el bloque
  // de días se lee junto al saludo), no un tamaño concreto: si mañana se
  // agranda o se baja, el test sigue diciendo la verdad.
  assert.equal(size(saludo), size(contador), 'saludo y contador deben usar el mismo cuerpo');
  assert.equal(size(saludo), '2xl', 'un cuerpo grande pero no excesivo');
  // El número y su etiqueta ("455 DÍAS JUNTOS") también comparten cuerpo.
  assert.equal((contador.match(/font-size: var\(--fs-([\w-]+)\)/g) || []).length, 2);
  assert.match(css, /\.home-hero__greet \{ font-size: clamp\(/, 'el saludo también se ajusta a pantallas estrechas');
});

test('el resumen abre con los atajos de gestión y sin tarjetas de métricas', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');
  const dash = admin.slice(admin.indexOf('async function loadDashboard'), admin.indexOf('async function loadMoods'));

  // Arriba del resumen va lo único accionable: accesos rápidos y atajos.
  assert.ok(dash.includes('Atajos de gestión'), 'el bloque de atajos sigue en el resumen');
  assert.equal((dash.match(/data-shortcut=/g) || []).length, 1, 'el panel de atajos no debe estar dos veces');
  // Los accesos rápidos se movieron al principio: primero lo accionable,
  // después el resumen para mirar (gráfico, dona, actividad...). Se comparan
  // los puntos donde se pintan, no los comentarios que los nombran.
  const iAccesos = dash.indexOf('quickActions.map');
  const iAtajos = dash.indexOf('shortcuts.map');
  const iGrafico = dash.indexOf('dashActivityChart');
  assert.ok(iAccesos < iAtajos, 'los accesos rápidos van antes que los atajos');
  assert.ok(iAtajos < iGrafico, 'los accesos van antes que el gráfico');
  assert.equal((dash.match(/quickActions\.map/g) || []).length, 1, 'los accesos rápidos no deben estar dos veces');
  // La rejilla de métricas desaparece del panel (y su CSS con ella).
  assert.doesNotMatch(dash, /dash-metrics/, 'no debe quedar la rejilla de métricas');
  assert.doesNotMatch(dash, /dash-metric-value/, 'no debe quedar el marcado de las tarjetas');
  assert.doesNotMatch(css, /\.dash-metric\b/, 'el CSS de las tarjetas sobra si no se pintan');
  // Los atajos siguen llevando a su sub-pestaña exacta, no solo a la sección.
  assert.match(dash, /sub: 'regalos'/);
  assert.match(dash, /sub: 'openwhen'/);
  assert.match(dash, /sub: 'razones'/, '"Frases" apunta a Razones');
  assert.match(admin, /\[data-shortcut\]/);
});

test('el menú del admin agrupa las secciones y ninguna queda sin acceso', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');

  // El menú sale de NAV_GROUPS: lo del día a día primero, el resto
  // agrupado pero nunca escondido.
  const nav = admin.slice(admin.indexOf('const NAV_GROUPS = ['), admin.indexOf('];', admin.indexOf('const NAV_GROUPS = [')) + 2);
  const groups = [...nav.matchAll(/label: '([^']+)',\s+hint:/g)].map(m => m[1]);
  assert.deepEqual(groups, ['Principal', 'Personas', 'Herramientas']);
  const navIds = [...nav.matchAll(/id: '([a-z]+)',\s+icon:/g)].map(m => m[1]);
  assert.deepEqual(navIds, ['dashboard', 'contenido', 'multimedia', 'moods', 'usuarios', 'notificaciones', 'actividad', 'config']);

  // Toda sección que se puede cargar tiene su entrada en el menú.
  const loaders = admin.slice(admin.indexOf('const loaders = {'), admin.indexOf('};', admin.indexOf('const loaders = {')));
  const sections = [...loaders.matchAll(/(?:^|[\s{,])([a-z]+):\s*load[A-Z]/g)].map(m => m[1]);
  assert.equal(sections.length, navIds.length, 'el menú y los cargadores deben cubrir lo mismo');
  for (const s of sections) {
    assert.ok(navIds.includes(s), `la sección "${s}" no tiene entrada en el menú`);
  }

  // El menú lateral es lo que navega: no queda ninguna barra de secciones.
  assert.match(admin, /class="admin-sidebar-item" data-section=/);
  assert.doesNotMatch(admin, /admin-topbar-tab/, 'la barra de secciones se ha sustituido por el menú lateral');
  assert.doesNotMatch(css, /\.admin-topbar-tab/, 'el CSS de la barra vieja sobra');
  assert.match(css, /\.admin-sidebar\b/);
  assert.match(css, /\.admin-nav-group-label/);

  // Todas las entradas a una sección pasan por activateNav: así el menú
  // queda marcado, la cabecera pegajosa con el título y el saludo solo en el
  // resumen, venga de dónde venga el clic.
  assert.match(admin, /function loadSection\(section\) \{[\s\S]{0,400}?activateNav\(section\)/);
  assert.match(admin, /topTitle\.innerHTML/);
  assert.match(admin, /welcomeBox\.classList\.toggle\('is-hidden', id !== 'dashboard'\)/);
  assert.match(css, /\.admin-welcome\.is-hidden/);

  // En móvil el menú es un cajón: botón, velo y bloqueo de scroll, y
  // el bloqueo se suelta al navegar para no dejar la web entera sin scroll.
  assert.match(admin, /class="admin-nav-scrim" id="adminNavScrim"/);
  assert.match(admin, /class="admin-nav-toggle" id="adminNavToggle"/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*?translateX\(-100%\)/);
  assert.match(admin, /page\.cleanup = \(\) => \{[\s\S]*?classList\.remove\('admin-nav-locked'\)/);

  // El cajón arranca bajo la barra móvil de la app: es la única vía de
  // vuelta atrás y taparla dejaría al usuario sin salida.
  assert.ok(css.includes('top: var(--header-height, 56px)'), 'el cajón debe empezar bajo la barra móvil');

  // El shell mide las páginas como columna de lectura; el panel pide más ancho
  // al montarse y lo devuelve al navegar.
  assert.ok(css.includes('.app-shell.has-admin .content { max-width: 1180px; }'));
  assert.ok(admin.includes("classList.add('has-admin')"), 'el panel debe pedir más ancho al shell');
  const cleanup = admin.slice(admin.indexOf('page.cleanup = () => {'), admin.indexOf('};', admin.indexOf('page.cleanup = () => {')));
  assert.ok(cleanup.includes("classList.remove('has-admin')"), 'al navegar hay que devolver el ancho al shell');

  // El título de la cabecera solo aparece al hacer scroll, cuando el
  // encabezado de la sección ya no se ve. El scroll lo lleva .main, no la
  // ventana, y no burbujea: se escucha en captura sobre document.
  assert.ok(css.includes('.admin-topbar.is-scrolled .admin-topbar-title'));
  assert.ok(admin.includes("addEventListener('scroll', onTopScroll, { passive: true, capture: true })"));
  assert.ok(admin.includes("page.closest('.main')?.scrollTop"), 'hay que leer el scroll del shell, no el de la ventana');
  assert.ok(admin.includes("removeEventListener('scroll', onTopScroll, true)"), 'el listener de scroll se suelta al navegar');

  // Los bloques fantasma usaban .skeleton-card, que no existía en el CSS:
  // durante la carga se veían huecos en vez de una señal de espera.
  assert.ok(css.includes('.skeleton-card {'));
});

test('la configuración del admin se lee por bloques y las fechas van en pestañas', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');
  const cfg = admin.slice(admin.indexOf('async function loadConfiguracion'), admin.indexOf('async function renderDbStatus'));

  // Grupos con rótulo y tarjetas con su icono: antes era una lista plana de
  // paneles sin orden ni jerarquía.
  assert.ok(cfg.includes('config-group-label'), 'los ajustes van agrupados');
  const grupos = [...cfg.matchAll(/class="config-group-label">([^<]+)</g)].map(m => m[1]);
  assert.deepEqual(grupos, ['Del día a día', 'Sistema']);
  assert.ok((cfg.match(/class="admin-panel config-card/g) || []).length >= 5, 'cada bloque es una tarjeta');

  // La paleta se elige con su propio color, no con botones de texto.
  assert.ok(cfg.includes('config-swatch-dot'), 'las paletas muestran su color');
  assert.ok(cfg.includes("style=\"--swatch:"), 'el color sale de theme.service');
  assert.ok(css.includes('.config-swatch.active .config-swatch-dot'), 'la paleta puesta se distingue');
  assert.ok(css.includes('grid-template-columns: repeat(3, 1fr);'), 'las tres paletas van en fila');
  // Los dos botones de píldora viejos quedaron sin usar y su CSS se fue con ellos.
  assert.equal((admin.match(/admin-seg/g) || []).length, 0);

  // Las cuatro listas de fechas caben en una tarjeta con pestañas y solo se
  // muestra una: con los cuatro editores seguidos la página era un bloque
  // larguísimo sin respiro.
  const tabs = [...cfg.matchAll(/data-config-tab="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['fechas', 'eventos', 'aspecto', 'tematicos']);
  const panes = [...cfg.matchAll(/data-config-pane="([a-z]+)"([^>]*)>/g)].map(m => [m[1], m[2].includes('hidden')]);
  assert.deepEqual(panes, [['fechas', false], ['eventos', true], ['aspecto', true], ['tematicos', true]],
    'solo la primera pestaña arranca abierta');
  assert.match(admin, /function showConfigTab|const showConfigTab = \(id\)/);
  assert.ok(admin.includes("pane.hidden = pane.dataset.configPane !== id"), 'la pestaña decide qué se ve');
  // Guardar fechas queda siempre a la vista, esté en la pestaña en la que estés.
  const save = cfg.indexOf('id="saveDatesBtn"');
  const panesEnd = cfg.lastIndexOf('data-config-pane=');
  assert.ok(save > panesEnd, 'el botón de guardar se queda fuera de las pestañas');

  // Los días temáticos se editan aunque nunca se hayan guardado: la lista
  // arranca de lo que resuelve la app (fábrica + guardado), no solo del
  // guardado, o Halloween y Navidad parecía no existir.
  assert.match(admin, /let editingSeasonal = seasonalEvents\(hubDates\)/);

  // Los ids y clases que usan los editors de fechas se conservan.
  for (const id of ['datesLooksList', 'datesSeasonalList', 'datesEventsList', 'addDatesSeasonalBtn', 'addDatesEventBtn', 'saveDatesBtn']) {
    assert.ok(cfg.includes(`id=\"${id}\"`), `falta #${id}`);
  }
});

test('los cuatro días son tarjetas con interruptor y el pie avisa de cambios sin guardar', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');
  const cfg = admin.slice(admin.indexOf('async function loadConfiguracion'), admin.indexOf('async function renderDbStatus'));

  // Cada día es una tarjeta completa: nombre, título, fecha y su interruptor.
  assert.equal((cfg.match(/class="dates-card"/g) || []).length, 4, 'los cuatro días, una tarjeta cada uno');
  assert.equal((cfg.match(/class="dates-switch"/g) || []).length, 4, 'cada día con su interruptor');
  for (const id of ['dateAnniversary', 'dateHubStart', 'dateBirthday', 'dateUserBirthday']) {
    assert.ok(cfg.includes(`id="${id}Recur"`), `falta el interruptor de ${id}`);
  }
  assert.ok(css.includes('.dates-cards {'), 'las tarjetas del editor de fechas');
  assert.ok(css.includes('.dates-switch input:checked + .dates-switch-track'), 'el interruptor se pinta encendido');
  // La rejilla suelta y la casilla con texto se fueron con el rediseño.
  assert.equal((admin.match(/dates-editor/g) || []).length, 0);
  assert.equal((admin.match(/dates-recur/g) || []).length, 0);

  // Las cuatro pestañas se reparten el ancho de la tarjeta en vez de ser
  // píldoras sueltas colgando de una esquina.
  assert.ok(css.includes('grid-template-columns: repeat(4, 1fr);'));

  // Y el pie dice si lo editado está guardado o no.
  assert.ok(cfg.includes('id="datesSaveState"'), 'el pie dice el estado');
  assert.ok(admin.includes("classList.add('is-dirty')"), 'al editar se marca como pendiente');
  assert.ok(admin.includes("classList.remove('is-dirty')"), 'al guardar se limpia');
  assert.ok(css.includes('.config-save.is-dirty'), 'y el aviso se ve');
});

test('el saludo de Inicio baja el apodo a su propia línea solo en móvil', async () => {
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');
  const home = await readFile(hub('src', 'pages', 'Home.js'), 'utf8');

  // Saludo y apodo son dos trozos de la misma frase: el span es lo que se parte.
  assert.match(home, /class="home-hero__greet"/);
  assert.match(home, /class="home-hero__greet-name"/);
  assert.ok(home.includes('mi princesa'), 'el apodo se sigue mostrando');

  // La regla base del apodo no corta la línea: en escritorio va todo en una.
  const baseIni = css.indexOf('.home-hero__greet-name {');
  assert.notEqual(baseIni, -1, 'el apodo tiene su propia regla');
  const base = css.slice(baseIni, css.indexOf('}', baseIni));
  assert.doesNotMatch(base, /display:\s*block/, 'fuera de móvil el apodo no baja de línea');

  // El corte solo existe dentro de la media query de móvil.
  const corte = '.home-hero__greet-name { display: block; }';
  const enMovil = css.indexOf(corte);
  assert.ok(enMovil > baseIni, 'en móvil el apodo baja a su línea');
  assert.ok(css.lastIndexOf('@media (max-width: 767px)', enMovil) !== -1,
    'ese corte vive dentro de la media query de móvil');
});

test('desde el Admin se ve la bienvenida sin esperar al día', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');

  // La hoja vive en components/, así que el panel la puede abrir sin Home.
  assert.match(admin, /import \{ openSpecialEventSheet[^}]*\} from '\.\.\/components\/SpecialEventSheet\.js';/);
  // Un botón por acción: poner la fecha de hoy y abrir la hoja con lo escrito.
  assert.match(admin, /class="dates-event-today"/, 'los eventos tienen botón «Hoy»');
  assert.match(admin, /class="dates-event-preview"/, 'los eventos se pueden ver');
  assert.match(admin, /class="dates-se-today"/, 'los temáticos también');
  assert.match(admin, /class="dates-se-preview"/);
  // «Hoy» pone hoy: fecha entera en eventos, mes-día en temáticos.
  assert.match(admin, /input\.value = todayISO\(\);/);
  assert.match(admin, /input\.value = todayISO\(\)\.slice\(5\);/);
  // «Ver» es una simulación: no marca el día como visto ni espera al real.
  assert.match(admin, /openSpecialEventSheet\(\[\{/);
  assert.match(admin, /\}\], router, \{ preview: true \}\);/);
  assert.match(css, /\.dates-event-today,/);
  assert.match(css, /\.dates-event-preview,/);
  assert.match(css, /\.dates-when \{/);
});

test('la línea de estado dice si el día sale hoy o por qué no sale', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // Evento con fecha completa: hoy, futuro, pasado con y sin repetición.
  assert.match(admin, /'✓ Sale hoy en el Inicio\.'/);
  assert.match(admin, /`Sale el \$\{readableDate\(date\)\}\.`/);
  assert.match(admin, /`⚠️ La fecha ya pasó \(\$\{readableDate\(date\)\}\): no volverá a salir\.`/);
  assert.match(admin, /repetirá el \$\{readableMonthDay\(date\.slice\(5\)\)\}/);
  // El año no se cuela en el mes-día: si se cuela, el texto sale vacío.
  assert.doesNotMatch(admin, /readableMonthDay\(date\.slice\(5\) \+/);
  // Día temático: apagado, sin formato, hoy, futuro y año ya pasado.
  assert.match(admin, /'Apagado: ese día no saltará\.'/);
  assert.match(admin, /'Pon el mes y el día \(p\. ej\. 10-31\)\.'/);
  assert.match(admin, /`Sale el \$\{cada\}\.`/);
  assert.match(admin, /`Este año ya pasó: el año que viene, el \$\{cada\}\.`/);
  // Y se repinta solo: no hace falta guardar para leerlo.
  assert.match(admin, /list\.addEventListener\('input', refreshWhens\)/);
  assert.match(admin, /list\.addEventListener\('change', refreshWhens\)/);
});

test('un evento con nombre y sin fecha no se pierde en silencio', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // cleanEvent() lo descarta al guardar (así se guarda), así que se avisa antes
  // en lugar de dar un «guardado» que miente.
  assert.ok(admin.includes("if (sinFecha) {"), 'un evento con nombre y sin fecha para el guardado');
  assert.ok(admin.includes("blockSave('Ese evento no tiene fecha', sinFecha);"), 'y se avisa de eso, no de otra cosa');
  assert.ok(admin.includes("blockSave('Falta el mes y el día, tipo 10-31', badSeasonal);"),
    'un día temático sin mes-día también se avisa');
  assert.ok(admin.includes('return;'), 'y en los dos casos no se sigue guardando a medias');
});

test('los textos del panel dicen dónde sale la bienvenida', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // Solo se abre desde el Inicio (maybeShowSpecialEvent vive en Home.js), así
  // que decir «del Perfil» mandaba al sitio equivocado.
  assert.match(admin, /bienvenida del Inicio\./);
  assert.doesNotMatch(admin, /bienvenida del Perfil/);
  assert.doesNotMatch(admin, /Se muestran en el Perfil/);
});
test('la bienvenida de hoy se puede volver a ver desde el Admin', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');

  // Con ♻️ la marca de «visto» es por año (event:<id>:<año>), así que cambiar
  // la fecha del evento no la reseteaba: el día ya visto no volvía a salir en
  // todo el año y no había forma de verlo de nuevo.
  assert.match(sheet, /export function replaySpecialEventSheet/);
  assert.match(sheet, /events\.forEach\(event => \{ delete seen\[event\.key\]; \}\)/);
  // Abre la hoja real (sin el aviso de simulación), no una previsualización.
  assert.match(sheet, /return openSpecialEventSheet\(events, router\);\n\}/);
  assert.doesNotMatch(sheet, /export function replaySpecialEventSheet[\s\S]*?preview: true/);
  // El botón va en la pestaña de Eventos y dice qué sale hoy al lado.
  assert.match(admin, /id="replayWelcomeBtn"/);
  assert.match(admin, /replaySpecialEventSheet\(router\)/);
  assert.match(admin, /Hoy: \$\{hoy\.map\(e => e\.title\)\.join\(' · '\)\}/);
  // La caché global se rellena al abrir Configuración: sin esto el botón
  // decía que hoy no había nada aunque las fechas estuvieran puestas.
  assert.match(admin, /await loadSpecialDates\(\)\.catch\(\(\) => \{\}\);/);
});
test('al abrir la tarjeta cae confeti desde arriba y se retira al cerrar', async () => {
  const cel = await readFile(hub('src', 'components', 'Celebration.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');

  // El canvas queda dentro de la tarjeta, encima de la decoración y sin robar clics.
  assert.match(cel, /canvas\.className = 'celebration-canvas special-event__celebration'/);
  assert.match(css, /\.special-event__celebration \{[\s\S]*?position: absolute;[\s\S]*?pointer-events: none;/,
    'la celebración queda dentro de la tarjeta y no cubre el check-in de ánimo');
  assert.match(cel, /const host = root \|\| document\.body/);
  assert.match(cel, /host\.appendChild\(canvas\)/);
  assert.match(sheet, /root: eventContent/);
  // Las partículas caen desde arriba de verdad (y negative) y tienen gravedad.
  assert.match(cel, /y: -20 - Math\.random\(\) \* 120/);
  assert.match(cel, /p\.y \+= p\.vy \* dt;/);
  // Se retira sola y al cerrar la hoja, que es cuando deja de fazer falta.
  assert.match(cel, /export function stopCelebration\(\)/);
  assert.match(cel, /if \(canvas\?\.isConnected\) canvas\.remove\(\);/);
  assert.match(sheet, /function stopSheetMedia\(\)[\s\S]*?stopCelebration\(\);/);
  assert.match(sheet, /\}, stopSheetMedia\);/, 'se registra como limpieza de la hoja');
  // Abrir otra celebración no apila una segunda capa de papel.
  assert.ok(cel.includes('if (!info.shape) return stopCelebration();'), '«sin decoración» limpia lo que hubiera');
  assert.ok(cel.includes('stopCelebration();\n\n  const cv = createCanvas(root);'),
    'y se cancela la celebración anterior antes de empezar otra');
  // Con «movimiento reducido» se pinta un cuadro y se acaba: el gesto sí, la animación no.
  assert.match(cel, /prefers-reduced-motion: reduce/);
  assert.match(cel, /if \(prefersStill\(\)\) \{[\s\S]*?setTimeout\(stopCelebration, 1600\);/);
});

test('el ambiente de cada día se elige y «ninguno» no celebra', async () => {
  const cel = await readFile(hub('src', 'utils', 'celebration.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');

  for (const id of ['confeti', 'nieve', 'hojas', 'corazones', 'estrellas', 'emoji', 'ninguno']) {
    assert.ok(cel.includes(`{ id: '${id}'`), `el ambiente ${id} existe`);
  }
  assert.match(cel, /\{ id: 'ninguno'[^}]*shape: null \}/, '«sin decoración» es el único sin partículas');
  // Un ambiente inventado no puede dejar la pantalla muda sin querer.
  assert.match(cel, /return DECORATIONS\.some\(d => d\.id === value\) \? value : 'confeti';/);
  assert.match(sheet, /playCelebration\(\{ \.\.\.celebration,/);
});

test('los emojis que caen son los del día o los de su fiesta', async () => {
  const cel = await readFile(hub('src', 'utils', 'celebration.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');
  const engine = await readFile(hub('src', 'components', 'Celebration.js'), 'utf8');

  // Hay una lista por fiesta: Halloween de calabazas y fantasmas, Navidad de
  // árboles, San Valentín de corazones, y así con el resto.
  for (const tipo of ['halloween', 'christmas', 'birthday', 'anniversary', 'valentine', 'custom']) {
    assert.match(cel, new RegExp(`\\b${tipo}: '`), `${tipo} tiene sus emojis`);
  }
  // Si el día trae los suyos, mandan esos; si no, los de su fiesta.
  assert.match(cel, /return own\.length \? own : \(THEME_EMOJIS\[type\] \|\| THEME_EMOJIS\.custom\)/);
  assert.match(sheet, /const emojis = emojisFor\(event\.emojis, event\.type\);/);
  // Y el canvas sabe pintarlos.
  assert.match(engine, /p\.kind === 'glyph'/);
  assert.match(engine, /if \(glyphs\.length\) p\.glyph = glyphs\[\(Math\.random\(\) \* glyphs\.length\) \| 0\];/);
});

test('la tarjeta lleva vídeo de portada o de fondo, a elegir', async () => {
  const cel = await readFile(hub('src', 'utils', 'celebration.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'home.css'), 'utf8');

  assert.match(cel, /export const VIDEO_MODES = \[\s*\{ id: 'portada'/);
  assert.match(cel, /return value === 'fondo' \? 'fondo' : 'portada';/);
  // Fondo: una capa con degradado detrás del texto; portada: reproductor grande.
  assert.match(sheet, /class: 'special-event__film'/);
  assert.match(sheet, /class: 'special-event__scrim'/);
  assert.match(sheet, /class: 'special-event__video'/);
  assert.match(css, /\.special-event__film \{[\s\S]*?position: absolute;/);
  assert.match(css, /\.special-event__scrim \{[\s\S]*?linear-gradient\(/);
  // Con vídeo de portada la foto grande no cabe encima; de fondo, sí.
  assert.match(sheet, /const conVideoPortada = Boolean\(video\) && videoMode === 'portada';/);
  assert.match(sheet, /!conVideoPortada && portada/);
  // muted y playsInline son propiedades: como atributo el vídeo salía con sonido.
  assert.match(sheet, /video\.muted = true;\s*\n\s*video\.defaultMuted = true;\s*\n\s*video\.playsInline = true;/);
  // Una URL muerta no puede dejar un rectángulo negro en medio de la tarjeta.
  assert.match(sheet, /video\.addEventListener\('error',[\s\S]*?\.special-event__film'\)\?\.remove\(\);/);
});

test('las fotos del día hacen una tira que cambia la grande', async () => {
  const cel = await readFile(hub('src', 'utils', 'celebration.js'), 'utf8');
  const sheet = await readFile(hub('src', 'components', 'SpecialEventSheet.js'), 'utf8');
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  // Solo http(s) y con tope: una URL rota deja un hueco en la tira.
  assert.match(cel, /export const MAX_GALLERY = 12;/);
  assert.match(cel, /filter\(url => \/\^https\?:\\\/\\\/\/i\.test\(url\)\)/);
  // La primera foto es la grande; el resto, miniaturas que la cambian.
  assert.match(sheet, /const portada = event\.image \|\| gallery\[0\] \|\| '';/);
  assert.match(sheet, /const resto = event\.image \? gallery : gallery\.slice\(1\);/);
  assert.match(sheet, /class: 'special-event__gallery'/);
  assert.match(sheet, /querySelector\('\.special-event__photo img'\)[\s\S]*?\.setAttribute\('src', src\)/);
  // Y el Admin ofrece los campos: vídeo, modo, fotos y emojis.
  assert.match(admin, /class="dates-look-video"/);
  assert.match(admin, /class="dates-look-videomode"/);
  assert.match(admin, /class="dates-look-gallery"/);
  assert.match(admin, /class="dates-look-decor"/);
  assert.match(admin, /class="dates-look-emojis"/);
  assert.match(admin, /decorOptions, videoModeOptions, THEME_EMOJIS/);
});

test('un día temático trae su propio confeti y su lista de emojis', async () => {
  const cel = await readFile(hub('src', 'utils', 'celebration.js'), 'utf8');
  const dates = await readFile(hub('src', 'utils', 'specialDates.js'), 'utf8');
  const db = await readFile(hub('src', 'services', 'db.service.js'), 'utf8');

  // Los medios y la decoración viajan con el día por los tres caminos que hay.
  assert.match(dates, /function mediaFields\(source = \{\}\) \{[\s\S]*?video: pick\(source\.video, ''\),[\s\S]*?gallery: mediaList\(source\.gallery\),[\s\S]*?decor: normalizeDecor\(source\.decor\)/);
  assert.equal((dates.match(/\.\.\.mediaFields\(/g) || []).length, 4,
    'los cuatro días, los eventos y los dos tipos de temáticos');
  // Y al guardar se limpian: nada de URLs inventadas ni ambientes raros.
  assert.match(db, /function cleanMedia\(source\) \{/);
  assert.match(db, /video: \/\^https\?:\\\/\\\/\/i\.test\(video\) \? video : ''/);
  assert.match(db, /gallery: mediaList\(source\?\.gallery\)/);
  assert.match(db, /decor: normalizeDecor\(source\?\.decor\)/);
  assert.match(db, /emojis: text\(source\?\.emojis\)/);
  assert.match(cel, /export const MAX_EMOJIS = 20;/);
});
test('lo escrito en las fechas no se pierde ni si el guardado falla', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');

  // Al escribir se guarda un borrador en este navegador: si Supabase rechaza
  // el guardado o se cierra la pestaña, lo escrito sigue ahí.
  assert.match(admin, /const DRAFT_KEY = 'ph\.draft\.hub_dates';/);
  assert.match(admin, /localStorage\.setItem\(DRAFT_KEY, JSON\.stringify\(\{ at: Date\.now\(\), dates: collectDates\(\) \}\)\)/);
  assert.match(admin, /const markDirty = \(\) => \{[\s\S]*?saveDraft\(\);/,
    'cada cambio marca sucio y guarda');
  assert.match(admin, /const markSaved = \(\) => \{[\s\S]*?clearDraft\(\);/,
    'y guardar bien lo borra');
  // Si el guardado falla, el borrador se refresca y se dice que no se perdió nada.
  assert.match(admin, /catch \(err\) \{[\s\S]*?saveDraft\(\);[\s\S]*?is-blocked/);
  assert.match(admin, /Lo tienes a salvo en este navegador/);
  assert.match(admin, /caducada[\s\S]*?vuelve a iniciar sesi\u00f3n y pulsa Guardar/,
    'y si es la sesi\u00f3n, se dice exactamente qu\u00e9 hacer');
  // Al volver a abrir el panel aparece el aviso con su fecha y dos botones.
  assert.match(admin, /id="datesDraftRow"/);
  assert.match(admin, /id="restoreDraftBtn"/);
  assert.match(admin, /id="discardDraftBtn"/);
  assert.match(admin, /Hay cambios sin subir del/);
  assert.match(admin, /page\.querySelector\('#restoreDraftBtn'\)\?\.addEventListener[\s\S]*?renderDateEvents\(\);[\s\S]*?renderSeasonal\(\);[\s\S]*?renderDateLooks\(\);/,
    'recuperar repinta las tres listas del borrador');
  assert.match(css, /\.config-draft \{/);
});

test('si falta un dato, se señala la fila y se explica cuál', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');

  // Un aviso suelto en la esquina era lo que hacía que el botón pareciera no
  // funcionar: ahora la fila culpable se marca y la vista va hasta ella.
  assert.match(admin, /const blockSave = \(motivo, row\) => \{[\s\S]*?row\?\.classList\.add\('is-wrong'\);[\s\S]*?row\?\.scrollIntoView\(\{ block: 'center'/);
  assert.match(admin, /saveState\.textContent = `No se puede guardar: \$\{motivo\.toLowerCase\(\)\}`/);
  assert.match(admin, /blockSave\('Ese evento no tiene fecha', sinFecha\);/);
  assert.match(admin, /blockSave\('Falta el mes y el d\u00eda, tipo 10-31', badSeasonal\);/);
  assert.match(css, /\.dates-event-row\.is-wrong \{/);
  assert.match(css, /\.config-save\.is-blocked/);
  // El botón y el borrador comparten una única lectura del panel, para que lo
  // que se recupera sea justo lo que se iba a subir.
  assert.match(admin, /function collectDates\(\) \{[\s\S]*?return \{[\s\S]*?events,[\s\S]*?seasonal,[\s\S]*?looks,/);
  assert.match(admin, /db\.saveHubDates\(\{ anniversary, hubStart, birthday, userBirthday, events, seasonal, looks, titles, recurring \}\)/);
});
test('el visor y los filtros de Galería detienen medios al cerrar o repintar', async () => {
  const lightbox = await readFile(hub('src', 'components', 'MediaLightbox.js'), 'utf8');
  const memes = await readFile(hub('src', 'pages', 'rincon', 'memes.js'), 'utf8');
  const rincon = await readFile(hub('src', 'pages', 'Rincon.js'), 'utf8');

  assert.match(lightbox, /if \(!destroyed && video\.paused && autoplay\)/,
    'una carga tardía no vuelve a iniciar un vídeo ya cerrado');
  assert.match(lightbox, /video\.autoplay = false;[\s\S]*?video\.pause\(\);[\s\S]*?querySelectorAll\('source'\)/,
    'destroy detiene y descarga el vídeo activo');
  assert.match(memes, /function rerenderGallery\(\) \{[\s\S]*?closeLightbox\(\);[\s\S]*?pauseSlideshow\(\);[\s\S]*?querySelectorAll\('audio, video'\)/,
    'el re-render limpia el visor, la presentación y medios montados');
  assert.match(memes, /stopGalleryPlayback\(\);[\s\S]*?state\.galeriaFilter = btn\.dataset\.filter/,
    'cambiar el filtro para la reproducción antes de desmontar');
  assert.match(rincon, /page\.querySelectorAll\('audio, video'\)\.forEach\(media => \{[\s\S]*?media\.pause\(\); media\.currentTime = 0/,
    'al salir de la sección se paran audio y vídeo');
});

test('el check-in de ánimo aparece en el primer inicio diario y se reinicia al cambiar el día', async () => {
  const app = await readFile(hub('src', 'components', 'App.js'), 'utf8');
  const welcome = await readFile(hub('src', 'components', 'WelcomeScreen.js'), 'utf8');

  assert.match(app, /if \(!user\) return false;[\s\S]*?if \(userStore\.isAdmin\) return false;/,
    'solo se ofrece a la princesa, nunca al admin ni a quien cerró sesión');
  assert.match(app, /if \(moodStore\.hasSeenToday\(\)\) return false;/,
    'no vuelve a aparecer tras responder o posponerlo ese día');
  assert.match(app, /const nextDayCheck = spainMsOnDate\(nextDayISO\(now\), 0\)/,
    'se vuelve a comprobar a medianoche de España, no a una hora fija de la mañana');
  assert.match(app, /if \(!moodStore\.hasSeenToday\(\)\) \{\s+if \(!showWelcome\(\)\)/,
    'se muestra en el primer inicio en que todavía no se ha registrado el día');
  assert.match(app, /setMoodWelcomeState\('showing'\)/,
    'la bienvenida anuncia que está visible antes de esperar a que acabe la animación');
  assert.match(app, /scheduleNextDay\(\);/,
    'el check-in se vuelve a comprobar al siguiente día');
  assert.doesNotMatch(app, /8:00 AM|today8AM|tomorrow8AM|testWelcomeHour/,
    'el check-in no queda bloqueado por horario de mañana');
  assert.match(app, /await awaitMoodSync\(\);[\s\S]*?if \(!userStore\.getUser\(\) \|\| userStore\.isAdmin\) \{\s+setMoodWelcomeState\('clear'\);\s+return;/,
    'espera la sincronización del ánimo y excluye admin antes de preguntar');
  assert.match(app, /if \(getUserPref\('welcomeShownDate'\) === today\) return false;/,
    'la pestaña abierta no presenta el modal varias veces en el mismo día');
  assert.match(app, /setUserPref\('welcomeShownDate', today\)/,
    'se evita duplicar el modal en el mismo día');
  assert.match(welcome, /await moodStore\.saveMood\(selectedMood\)/,
    'la selección guarda el estado de ánimo diario');
  assert.match(welcome, /moodStore\.markSeen\(\);/,
    'posponer también cuenta como check-in de hoy');
});

test('registrar el estado de ánimo avisa, y el aviso se puede apagar', async () => {
  const notif = await readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');
  const store = await readFile(hub('src', 'stores', 'mood.store.js'), 'utf8');
  const profile = await readFile(hub('src', 'pages', 'Profile.js'), 'utf8');
  const sw = await readFile(hub('public', 'sw.js'), 'utf8');

  // El aviso va en el STORE, no en las pantallas: es el unico punto por el
  // que se escribe un estado, asi que se avisa igual desde Sentimientos, desde
  // el perfil y desde la pantalla de bienvenida.
  assert.match(store, /_notifyMood\(mood\);/, 'saveMood avisa');
  assert.match(store, /this\._notifyMood\(prev\);/, 'y quitarlo tambien avisa del estado que queda');
  assert.match(store, /import \{ notifyMoodSaved \} from '\.\.\/services\/notifications\.service\.js';/, 'import estatico: el modulo ya esta en el bundle');
  assert.match(store, /notifyMoodSaved\(mood\)\.catch\(\(\) => \{ \/\* sin notificaciones/, 'un fallo del aviso no rompe el guardado');

  // Interruptor propio: es un aviso mas y se apaga sin apagar los demas.
  assert.match(notif, /moods: true,\s+\/\/ aviso cada vez/);
  assert.match(notif, /if \(!getNotifSettings\(\)\.moods\) return false;/);
  assert.match(profile, /id="notifMoods" \$\{s\.moods \? 'checked' : ''\}/, 'el interruptor existe en el perfil');
  assert.match(profile, /setNotifSettings\(\{ moods: e\.target\.checked \}\)/);

  // Aviso con contenido util: como se siente y donde pulsar.
  assert.match(notif, /const title = mood \? `\$\{mood\.emoji\} \$\{mood\.label\}`/);
  assert.match(notif, /'\/sentimientos', \{ tag: MOOD_TAG, ignoreQuiet: true \}/, 'enlace a Sentimientos y tag propio');
  // Tag propio = los avisos se reemplazan en vez de apilarse.
  assert.match(notif, /const MOOD_TAG = 'mood';/);
  // Una frase por animo, y distinta cada dia pero fija dentro del dia.
  for (const id of ['preocupada', 'enfadada', 'triste', 'bien', 'carino']) {
    assert.match(notif, new RegExp('^  ' + id + ':', 'm'), 'debe haber frases para ' + id);
  }
  assert.match(notif, /const day = Number\(String\(todayISO\(\)\)\.replace/, 'la frase varia con el dia');
  assert.match(notif, /return pool\[day % pool\.length\];/);

  // Y no se promete en el horario de silencio algo que luego no ocurre.
  assert.match(profile, /El de tu estado de ánimo sale siempre/, 'el texto del silencio no puede mentir');
  assert.match(sw, /clients\.openWindow\('\/#'/, 'el aviso abre la ruta hash');
});
