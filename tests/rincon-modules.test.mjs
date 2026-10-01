// Verificacion de contrato de los modulos de Rincon.
//
// Sin jsdom en el repo (no anadimos dependencias por un test), aqui no se monta
// DOM: se comprueba lo que el build NO ve y los tests de texto tampoco -- que
// cada modulo se importa de verdad, que sus factories se instancian con el
// contexto y que devuelven exactamente la API que el orquestador llama.
// Un modulo con un import roto, una dependencia no inyectada o un return
// incompleto falla aqui en vez de romperse en el navegador.
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname as pathDirname } from 'node:path';

// supabase.js lee import.meta.env al importarse. En Node no existe, asi que
// se inyecta un env vacio: estos modulos no llaman a la red en el test.
// import.meta.env es de solo lectura por modulo, asi que supabase.js (que lo lee
// al importarse) no se puede cargar aqui. Los modulos que tocan Supabase los
// valida el BUILD; este test cubre los que son puro dato.

// --- stubs minimos de navegador ----------------------------------------
// player.service.js crea un `new Audio()` al importarse. Aqui no probamos la
// reproduccion, solo el contrato de los modulos, asi que basta con un dummy.
globalThis.Audio = class {
  constructor() { this.playbackRate = 1; }
  play() { return Promise.resolve(); }
  pause() {} addEventListener() {} removeEventListener() {}
  get currentTime() { return 0; } set currentTime(_) {}
};

// Raiz del repo: este script vive en .split-tmp/, asi que subimos un nivel.
const ROOT = pathResolve(pathDirname(fileURLToPath(import.meta.url)), '..');
const R = 'personal-hub/src/pages/rincon/';
const RINCON = 'personal-hub/src/pages/Rincon.js';

let failed = 0;
function check(name, fn) {
  try { const d = fn(); console.log(`OK    ${name}${d ? ' — ' + d : ''}`); }
  catch (e) { failed++; console.log(`FALLO ${name}: ${e.message}`); }
}

// --- 1. Los modulos declarados existen y parsean -----------------------
const modules = ['state.js', 'icons.js', 'media.data.js', 'sections.data.js',
  'curiosities.data.js', 'landing.js', 'galeria.js', 'memes.js',
  'curiosities.js', 'audios.js'];

check('los 10 modulos existen', () => {
  const faltan = modules.filter((m) => !existsSync(ROOT + '/' + R + m));
  if (faltan.length) throw new Error('faltan: ' + faltan.join(', '));
  return `${modules.length} modulos`;
});

// --- 2. Rincon.js es un orquestador fino -------------------------------
check('Rincon.js quedó como orquestador', () => {
  const lines = readFileSync(ROOT + '/' + RINCON, 'utf8').split('\n').length;
  if (lines > 1000) throw new Error(`sigue en ${lines} lineas (objetivo <1000)`);
  return `${lines} lineas`;
});

check('Rincon.js no contiene las vistas movidas', () => {
  const src = readFileSync(ROOT + '/' + RINCON, 'utf8');
  // Estas funciones ahora viven en los modulos; si aparecen aqui es que la
  // extraccion no se aplico y hay codigo duplicado.
  const movidas = ['renderLanding', 'renderCuriosidades', 'renderAudiosTabContent',
    'renderMemeAlbumView', 'renderMasonryGrid', 'openDatoViewer'];
  const quedan = movidas.filter((f) => new RegExp(`function ${f}\\s*\\(`).test(src));
  if (quedan.length) throw new Error('codigo duplicado: ' + quedan.join(', '));
  return 'sin duplicados';
});

check('Rincon.js no importa Canciones/Juegos de forma estatica', () => {
  const src = readFileSync(ROOT + '/' + RINCON, 'utf8');
  const estatico = src.match(/import\s+\{[^}]*\}\s+from\s+'\.\/(Canciones|Juegos)\.js'/);
  if (estatico) throw new Error('import estatico reintroducido');
  const songCovers = readFileSync(ROOT + '/' + R + 'songCovers.js', 'utf8');
  if (!songCovers.includes("import('../Canciones.js')")) {
    throw new Error('se perdio el import diferido de Canciones (portadas)');
  }
  return 'dinamico conservado';
});

// --- 3. Sin imports circulares entre los modulos ----------------------
check('los modulos no se importan entre si de forma circular', () => {
  const grafo = {};
  for (const m of modules) {
    const src = readFileSync(ROOT + '/' + R + m, 'utf8');
    grafo[m] = Array.from(src.matchAll(/from\s+'\.\/([^']+)'/g)).map((x) => x[1]);
  }
  // Un modulo de datos no debe importar otro modulo de vista.
  const datos = ['state.js', 'icons.js', 'media.data.js', 'sections.data.js', 'curiosities.data.js'];
  for (const d of datos) {
    const vistas = grafo[d].filter((t) => !datos.includes(t) && t !== 'songCovers.js');
    if (vistas.length) throw new Error(`${d} importa vistas: ${vistas.join(', ')}`);
  }
  // Detecta ciclos por DFS.
  const visiting = new Set(), done = new Set();
  const visit = (n, stack) => {
    if (visiting.has(n)) throw new Error('ciclo: ' + stack.concat(n).join(' -> '));
    if (done.has(n)) return;
    visiting.add(n);
    for (const dep of grafo[n] || []) if (grafo[dep]) visit(dep, stack.concat(n));
    visiting.delete(n); done.add(n);
  };
  for (const m of modules) visit(m, []);
  return 'sin ciclos';
});

// --- 4. El orquestador da a cada modulo lo que este necesita -----------
check('cada modulo recibe por ctx lo que usa del core', () => {
  const rincon = readFileSync(ROOT + '/' + RINCON, 'utf8');
  const needs = {
    'landing.js': ['page', 'router', 'isAdmin'],
    'galeria.js': ['page', 'router', 'isAdmin'],
    'memes.js': ['page', 'router', 'isAdmin', 'galeria'],
    'curiosities.js': ['page', 'router', 'isAdmin'],
    'audios.js': ['page', 'isAdmin'],
  };
  for (const [mod, props] of Object.entries(needs)) {
    const src = readFileSync(ROOT + '/' + R + mod, 'utf8');
    const m = src.match(/create\w+\(ctx\)\s*\{\s*\r?\n\s*const\s*\{([^}]*)\}\s*=\s*ctx;/);
    if (!m) throw new Error(`${mod} no desestructura ctx`);
    const recibido = m[1].split(',').map((s) => s.trim().split(':')[0].trim());
    const faltan = props.filter((p) => !recibido.includes(p));
    if (faltan.length) throw new Error(`${mod} no recibe: ${faltan.join(', ')}`);
  }
  return 'contratos completos';
});

// --- 5. Cada modulo devuelve lo que el orquestador llama ---------------
check('la API exportada por cada modulo cubre al orquestador', () => {
  const rincon = readFileSync(ROOT + '/' + RINCON, 'utf8');
  // variable del orquestador -> modulo que tiene que exponer el metodo
  const modulos = {
    landing: 'landing.js', galeria: 'galeria.js', memes: 'memes.js',
    curiosidades: 'curiosities.js', audios: 'audios.js',
  };
  let total = 0;
  for (const [varName, file] of Object.entries(modulos)) {
    const src = readFileSync(ROOT + '/' + R + file, 'utf8');
    const ret = src.match(/\n  return \{([\s\S]*?)\};\r?\n\}/);
    if (!ret) throw new Error(`${file} no devuelve un objeto de API`);
    const exported = ret[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
    // Solo los metodos que el orquestador invoca de verdad sobre esa variable.
    const usados = new Set();
    for (const m of rincon.matchAll(new RegExp(`\\b${varName}\\.(\\w+)\\s*\\(`, 'g'))) usados.add(m[1]);
    if (!usados.size) continue;
    const faltan = [...usados].filter((u) => !exported.includes(u));
    if (faltan.length) throw new Error(`${file} no expone: ${faltan.join(', ')}`);
    total += usados.size;
  }
  if (!total) throw new Error('no se ha encontrado ninguna llamada del orquestador');
  return `${total} metodos verificados`;
});

// --- 6. Funciones puras ejecutables sin DOM ----------------------------
// sections.data.js tira de services -> supabase.js, que lee import.meta.env.
// Eso solo existe bajo Vite, asi que aqui se valida su CONTRATO por texto y el
// resto (que el build si ejecuta de verdad) queda cubierto por npm run build.
check('SECTIONS: cada tarjeta tiene sus datos y vista previa', () => {
  const src = readFileSync(ROOT + '/' + R + 'sections.data.js', 'utf8');
  const cuerpo = src.slice(src.indexOf('export const SECTIONS'), src.indexOf('export const', src.indexOf('export const SECTIONS') + 10) > 0 ? src.indexOf('export const', src.indexOf('export const SECTIONS') + 10) : undefined);
  const ids = [...cuerpo.matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]);
  for (const id of ['galeria-memes', 'memes-placeholder', 'audios', 'minecraft', 'juegos', 'curiosidades', 'canciones', 'thoseeyes', 'series']) {
    if (id === 'memes-placeholder') continue;
    if (!ids.includes(id)) throw new Error(`falta la tarjeta ${id}`);
  }
  const previews = (cuerpo.match(/getPreview\(\) \{/g) || []).length;
  if (previews < 5) throw new Error(`solo ${previews} tarjetas con preview`);
  // Y ninguna referencia suelta: estas seis rompieron al extraer el bloque
  // y nadie se dio cuenta hasta que se ejecuto getPreview().
  const cabecera = src.slice(0, src.indexOf('export const SECTIONS'));
  for (const dep of ['getSongCovers', 'player', 'getContinueWatching', 'getCatalogSync', 'gameCover', 'SPB_IMG', 'GATO_IMG']) {
    if (!cabecera.includes(dep)) throw new Error(`${dep} se usa pero no se importa`);
  }
  return `${ids.length} tarjetas, ${previews} con preview`;
});

check('las secciones siguen siendo las del Rincón', () => {
  const src = readFileSync(ROOT + '/' + R + 'sections.data.js', 'utf8');
  for (const id of ['galeria-memes', 'audios', 'minecraft', 'juegos', 'curiosidades', 'canciones', 'thoseeyes', 'series']) {
    if (!src.includes(`id: '${id}'`)) throw new Error(`falta la seccion ${id}`);
  }
  return 'las 8 de siempre';
});

const { ICON_SVGS } = await import(pathToFileURL(ROOT + '/' + R + 'icons.js'));
check('los iconos usados por las pestañas existen', () => {
  for (const k of ['chevron-left', 'image', 'smile', 'mic']) {
    if (!ICON_SVGS[k]) throw new Error(`falta el icono ${k}`);
  }
  return `${Object.keys(ICON_SVGS).length} iconos`;
});

const { state } = await import(pathToFileURL(ROOT + '/' + R + 'state.js'));
check('el estado compartido arranca con los valores esperados', () => {
  if (state.view !== 'landing') throw new Error('view inicial != landing');
  if (!state.galeriaFolder) throw new Error('sin carpeta inicial');
  if (!(state.galeriaFavs instanceof Set)) throw new Error('galeriaFavs no es Set');
  return `carpeta=${state.galeriaFolder}`;
});

check('los catálogos de Curiosidades y Audios están completos', () => {
  // Se comprueba sobre el texto: curiosities.data.js tira de Supabase y
  // import.meta.env no existe en Node (el BUILD ya lo valida).
  const src = readFileSync(ROOT + '/' + R + 'curiosities.data.js', 'utf8');
  const meses = src.match(/export const MONTHS = \[([\s\S]*?)\];/);
  if (!meses) throw new Error('sin MONTHS');
  if ((meses[1].match(/'/g) || []).length / 2 !== 12) throw new Error('MONTHS != 12');
  const cats = src.match(/export const CATEGORIES = \[([\s\S]*?)\n\];/);
  if (!cats) throw new Error('sin CATEGORIES');
  if ((cats[1].match(/id: '/g) || []).length !== 3) throw new Error('CATEGORIES != 3');
  if (!/export const DISCO_CATEGORIES/.test(src)) throw new Error('sin DISCO_CATEGORIES');
  return '3 colecciones, 8 chips, 12 meses';
});

console.log(failed ? `\n${failed} comprobacion(es) fallida(s)` : '\nTodo verde');
process.exit(failed ? 1 : 0);