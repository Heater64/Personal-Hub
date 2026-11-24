/* ==========================================
   Cabeceras de seguridad (vercel.json) e index.html

   Estas cabeceras solo existen en el despliegue: en local no hay servidor
   que las ponga, así que un error aquí no se ve hasta producción. Este test
   es la única red que impide que eso pase.

   Lo que vigila:
   1. Que la CSP exista para TODAS las rutas y mantenga las directivas que
      de verdad protegen (sin `object-src`, `base-uri`, `frame-ancestors`…).
   2. Que `script-src` no se abra a cualquier origen ni a `unsafe-eval`.
   3. Que todo origen externo que index.html carga (fuentes, KaTeX) esté
      permitido por la CSP: si se añade un CDN y no se declara, la app se
      queda sin ese recurso en producción y nadie se entera en local.
   4. Que `Permissions-Policy` siga permitiendo la geolocalización propia:
      la hoja «Dónde estáis» y el mapa necesitan `geolocation=(self)`. Con
      `geolocation=()` — lo que había — el navegador desactiva la API para
      la propia página y la distancia no funciona en el dominio real.
   5. Que el transporte siga forzado a HTTPS (HSTS).
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const indexHtml = readFileSync(new URL('../tamp/index.html', import.meta.url), 'utf8');

/** Cabeceras de la regla que cubre todas las rutas. */
function globalHeaders() {
  const rule = (vercel.headers || []).find(h => h.source === '/(.*)');
  assert.ok(rule, 'vercel.json debe tener una regla de cabeceras para /(.*)');
  return Object.fromEntries(rule.headers.map(h => [h.key.toLowerCase(), h.value]));
}

/** CSP → { directiva: [valores] }. */
function parseCsp(value) {
  const out = {};
  for (const part of String(value || '').split(';')) {
    const [name, ...rest] = part.trim().split(/\s+/);
    if (!name) continue;
    out[name.toLowerCase()] = rest;
  }
  return out;
}

const cspValue = () => globalHeaders()['content-security-policy'];
const csp = () => parseCsp(cspValue());

/** Orígenes externos (esquema + host) de las etiquetas indicadas. */
function externalOrigins(re) {
  const found = new Set();
  for (const tag of indexHtml.match(re) || []) {
    const url = (tag.match(/(?:src|href)="(https?:\/\/[^"]+)"/) || [])[1];
    if (!url) continue;
    found.add(new URL(url).origin);
  }
  return [...found];
}

const SCRIPT_TAGS = /<script\b[^>]*\bsrc="[^"]+"[^>]*>/gi;
const STYLE_TAGS = /<link\b[^>]*\brel="stylesheet"[^>]*>/gi;

test('la CSP cubre todas las rutas y mantiene las directivas de base', () => {
  assert.ok(cspValue(), 'falta Content-Security-Policy en vercel.json');

  const d = csp();
  assert.deepEqual(d['default-src'], ["'self'"]);
  assert.deepEqual(d['object-src'], ["'none'"], 'object-src none bloquea plugins y PDF embebidos');
  assert.deepEqual(d['base-uri'], ["'self'"], 'base-uri evita secuestrar las rutas relativas');
  assert.deepEqual(d['frame-ancestors'], ["'none'"], 'nadie debe poder enmarcar la app');
  assert.deepEqual(d['form-action'], ["'self'"]);
  assert.ok(d['manifest-src']?.includes("'self'"), 'el manifest de la PWA tiene que estar permitido');
});

test('script-src no se abre a cualquier origen ni permite eval', () => {
  const scriptSrc = csp()['script-src'] || [];
  assert.ok(scriptSrc.length, 'script-src debe estar declarado');

  for (const value of scriptSrc) {
    assert.notEqual(value, '*', 'un comodín en script-src anula la CSP');
    assert.notEqual(value, 'https:', 'un esquema suelto en script-src anula la CSP');
    assert.notEqual(value, "'unsafe-eval'", 'la app no usa eval ni new Function: no hace falta abrirlo');
  }

  assert.ok(scriptSrc.includes("'self'"), 'el bundle propio tiene que estar permitido');
});

test('script-src permite solo el bootstrap inline mediante su hash', () => {
  const scriptSrc = csp()['script-src'] || [];
  const inlineScripts = [...indexHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(inlineScripts.length, 1, 'index.html debe tener un único bootstrap inline');

  const normalizedSource = inlineScripts[0][1].replace(/\r\n?/g, '\n');
  const digest = createHash('sha256').update(normalizedSource).digest('base64');
  assert.ok(scriptSrc.includes(`'sha256-${digest}'`), 'CSP debe autorizar el hash exacto del bootstrap');
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), 'script-src no debe permitir scripts inline arbitrarios');
});

test('todo script externo está permitido por la CSP, también los que se cargan al vuelo', () => {
  const scriptSrc = csp()['script-src'] || [];
  const hosts = externalOrigins(SCRIPT_TAGS);

  for (const origin of hosts) {
    assert.ok(
      scriptSrc.includes(origin),
      `script-src no permite ${origin}: en producción ese script no se ejecuta`
    );
  }

  // KaTeX ya no viaja en index.html (pesaba en todas las pantallas): se inyecta
  // desde renderMath.js al abrir el calendario. Ese origen tiene que seguir
  // permitido o las fórmulas dejan de renderizarse solo en producción.
  const renderMath = readFileSync(
    new URL('../tamp/src/utils/renderMath.js', import.meta.url),
    'utf8'
  );
  const katex = renderMath.match(/https:\/\/cdn\.jsdelivr\.net/);
  assert.ok(katex, 'KaTeX se sirve desde jsDelivr');
  assert.ok(
    scriptSrc.includes('https://cdn.jsdelivr.net'),
    'script-src debe permitir jsDelivr, que es de donde llega KaTeX bajo demanda'
  );
});

test('toda hoja de estilos externa de index.html está permitida por la CSP', () => {
  const styleSrc = csp()['style-src'] || [];
  const hosts = externalOrigins(STYLE_TAGS);

  for (const origin of hosts) {
    assert.ok(
      styleSrc.includes(origin),
      `style-src no permite ${origin}: esa hoja no cargará en producción`
    );
  }

  // Las fuentes que declara Google Fonts y los ficheros de KaTeX.
  const fontSrc = csp()['font-src'] || [];
  assert.ok(fontSrc.includes('https://fonts.gstatic.com'), 'sin fonts.gstatic.com no hay tipografía');
  assert.ok(fontSrc.includes('https://cdn.jsdelivr.net'), 'KaTeX sirve sus fuentes desde jsDelivr');
});

test('las imágenes externas las carga img-src sin abrir connect-src', () => {
  const connectSrc = csp()['connect-src'] || [];
  const imgSrc = csp()['img-src'] || [];
  const sw = readFileSync(new URL('../tamp/public/sw.js', import.meta.url), 'utf8');

  assert.ok(connectSrc.includes("'self'"));
  assert.ok(connectSrc.includes('https://*.supabase.co'), 'la API de Supabase necesita https');
  assert.ok(connectSrc.includes('wss://*.supabase.co'), 'Realtime necesita wss');
  assert.ok(imgSrc.includes('https:'), 'mapas y portadas externas se muestran como imágenes HTTPS');
  assert.ok(!connectSrc.includes('https://*.tile.openstreetmap.org'),
    'las teselas se cargan como imágenes; no hace falta ampliar la política fetch');
  assert.ok(!connectSrc.includes('*'), 'connect-src abierto permite exfiltrar datos');
  assert.match(sw, /if \(url\.origin === self\.location\.origin\) \{[\s\S]{0,140}?cacheFirstThenNetwork\(request\)[\s\S]{0,80}?\} else \{[\s\S]{0,250}?return;/,
    'el service worker no debe convertir imágenes externas en fetch sujetos a connect-src');
  assert.match(sw, /CACHE_VERSION = '12'/,
    'el despliegue debe retirar las respuestas externas que quedaron mal cacheadas');
});

test('Permissions-Policy permite la geolocalización propia y niega cámara y micro', () => {
  const policy = globalHeaders()['permissions-policy'] || '';

  assert.match(policy, /geolocation=\(self\)/,
    'geolocation=() desactiva el GPS para la propia app: la distancia y el mapa dejan de funcionar');
  assert.match(policy, /camera=\(\)/, 'la app no usa cámara en directo: se mantiene cerrada');
  assert.match(policy, /microphone=\(\)/, 'la app no graba micrófono: se mantiene cerrado');
});

test('el transporte va forzado a HTTPS (HSTS)', () => {
  const hsts = globalHeaders()['strict-transport-security'];
  assert.ok(hsts, 'falta Strict-Transport-Security');
  const maxAge = Number((hsts.match(/max-age=(\d+)/) || [])[1]);
  assert.ok(maxAge >= 31536000, 'HSTS debe durar al menos un año');
});
