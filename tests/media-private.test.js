/* ==========================================
   Multimedia privada — firmas, caché y renovación

   La capa de URLs firmadas es la que permite poner los buckets en privado
   sin tocar ni un dato guardado. Aquí se comprueba, sin red y sin navegador:

   1. Qué se considera una URL de Storage (pública, ya firmada, con query…).
   2. Que se firma una sola vez por objeto y no en cada render.
   3. Que la firma se renueva ANTES de caducar.
   4. Que un fallo de firma no rompe nada: se sigue devolviendo la URL
      original (compatibilidad con el bucket público).
   5. Que un objeto borrado no se reintenta en bucle.
   6. Que el respaldo global reintenta una imagen rota con su URL firmada.
   7. Que `sql/030_media_privado.sql` es idempotente, no borra objetos y
      trae el paso a paso y el rollback.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MEDIA_BUCKETS,
  parseStorageUrl,
  storageUrlsIn,
  createMediaService,
  installMediaFallback,
} from '../tamp/src/services/media.service.js';

const BASE = 'https://demo.supabase.co/storage/v1/object';
const publicUrl = (bucket, path) => `${BASE}/public/${bucket}/${path}`;

/** Firmante falso: deja constancia de cada lote y devuelve URLs estables. */
function makeSigner(options = {}) {
  const { fail = null, missing = new Set(), ttl = 3600 } = options;
  const calls = [];
  const signer = async (bucket, paths, receivedTtl) => {
    calls.push({ bucket, paths: [...paths], ttl: receivedTtl });
    if (fail) throw fail;
    return paths.map(path =>
      missing.has(`${bucket}/${path}`)
        ? null
        : `${BASE}/sign/${bucket}/${path}?token=${calls.length}`
    );
  };
  return { signer, calls, ttl };
}

/** Servicio con reloj controlado: sin esto no se puede probar la caducidad. */
function makeService(options = {}) {
  let clock = 1_700_000_000_000;
  const now = () => clock;
  const advance = seconds => {
    clock += seconds * 1000;
  };
  const fake = makeSigner(options);
  const service = createMediaService({
    signer: fake.signer,
    now,
    ttlSeconds: options.ttlSeconds ?? 3600,
    renewMarginSeconds: options.renewMarginSeconds ?? 600,
    retryAfterMs: options.retryAfterMs ?? 60_000,
    batchSize: options.batchSize ?? 50,
    autoRenew: false,
  });
  return { service, calls: fake.calls, advance };
}

// ── 1 · Reconocer una URL de Storage ─────────────────────────────

test('parseStorageUrl reconoce la forma pública y la firmada, sin query', () => {
  const pub = parseStorageUrl(publicUrl('galeria', 'galeria/uid/123-abc.jpg'));
  assert.deepEqual(pub, {
    bucket: 'galeria',
    path: 'galeria/uid/123-abc.jpg',
    mode: 'public',
  });

  const signed = parseStorageUrl(`${BASE}/sign/memes/memes/uid/1.jpg?token=xyz`);
  assert.deepEqual(signed, { bucket: 'memes', path: 'memes/uid/1.jpg', mode: 'sign' });

  // El `?v=` de los fondos no forma parte del objeto.
  assert.equal(
    parseStorageUrl(`${publicUrl('avatars', 'uid/fondo-juntos.jpg')}?v=1730000000000`).path,
    'uid/fondo-juntos.jpg'
  );

  // La ruta con subcarpetas y caracteres codificados se decodifica entera.
  assert.equal(
    parseStorageUrl(publicUrl('audios', 'audios/uid/mi%20nota.m4a')).path,
    'audios/uid/mi nota.m4a'
  );
});

test('parseStorageUrl ignora todo lo que no es un bucket de la app', () => {
  assert.equal(parseStorageUrl('https://res.cloudinary.com/demo/image/upload/a.jpg'), null);
  assert.equal(parseStorageUrl('/fondos/juntos.webp'), null);
  assert.equal(parseStorageUrl(''), null);
  assert.equal(parseStorageUrl(null), null);
  assert.equal(parseStorageUrl(42), null);
  assert.equal(parseStorageUrl('no es una url'), null);
  // Bucket de Storage ajeno a la app: no se firma ni se toca.
  assert.equal(parseStorageUrl(publicUrl('otro-bucket', 'x.jpg')), null);
});

test('la lista de buckets privados es la que se migra', () => {
  assert.deepEqual([...MEDIA_BUCKETS].sort(), ['audios', 'avatars', 'galeria', 'memes']);
});

test('storageUrlsIn saca solo las URLs de Storage y sin repetir', () => {
  const markup = `
    <img src="${publicUrl('galeria', 'a.jpg')}">
    <img src="https://res.cloudinary.com/demo/image/upload/b.jpg">
    <img src="${publicUrl('galeria', 'a.jpg')}">
    <video src="${BASE}/sign/memes/c.mp4?token=1"></video>`;

  assert.deepEqual(storageUrlsIn(markup), [
    publicUrl('galeria', 'a.jpg'),
    `${BASE}/sign/memes/c.mp4?token=1`,
  ]);
  assert.deepEqual(storageUrlsIn(null), []);
});

// ── 2 · Firmar una vez y cachear ────────────────────────────────

test('prepare firma por lote y mediaUrl devuelve la URL firmada', async () => {
  const { service, calls } = makeService();
  const original = publicUrl('galeria', 'galeria/uid/1.jpg');

  const result = await service.prepare([original]);
  assert.equal(result.signed, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].paths, ['galeria/uid/1.jpg']);
  assert.equal(service.url(original), `${BASE}/sign/galeria/galeria/uid/1.jpg?token=1`);
});

test('no se vuelve a firmar en cada render', async () => {
  const { service, calls } = makeService();
  const photos = [
    publicUrl('galeria', 'galeria/uid/1.jpg'),
    publicUrl('galeria', 'galeria/uid/2.jpg'),
  ];

  await service.prepare(photos);
  for (let i = 0; i < 200; i++) service.url(photos[i % 2]);
  await service.prepare(photos); // repintar la vista no debe pedir nada

  assert.equal(calls.length, 1, 'una sola petición para las dos fotos');
  assert.equal(calls[0].paths.length, 2);
});

test('las URLs que no son de Storage pasan intactas', async () => {
  const { service, calls } = makeService();
  const cloudinary = 'https://res.cloudinary.com/demo/image/upload/c_limit,w_800/a.jpg';

  const result = await service.prepare([cloudinary, publicUrl('galeria', 'b.jpg')]);
  assert.equal(result.signed, 1);
  assert.equal(service.url(cloudinary), cloudinary);
  assert.equal(calls.length, 1);
});

test('los lotes se acotan para no pedir 300 objetos de golpe', async () => {
  const { service, calls } = makeService({ batchSize: 2 });
  const many = Array.from({ length: 5 }, (_, i) => publicUrl('galeria', `f${i}.jpg`));

  await service.prepare(many);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(c => c.paths.length), [2, 2, 1]);
});

test('cada bucket se firma por separado', async () => {
  const { service, calls } = makeService();
  await service.prepare([
    publicUrl('galeria', 'a.jpg'),
    publicUrl('avatars', 'uid/me.jpg'),
    publicUrl('audios', 'audios/uid/n.m4a'),
  ]);

  assert.deepEqual(calls.map(c => c.bucket).sort(), ['audios', 'avatars', 'galeria']);
  for (const call of calls) assert.equal(call.paths.length, 1);
});

// ── 3 · Renovación antes de caducar ─────────────────────────────

test('renewDue renueva las firmas dentro del margen y no antes', async () => {
  const { service, calls, advance } = makeService({ ttlSeconds: 3600, renewMarginSeconds: 600 });
  const photo = publicUrl('galeria', 'a.jpg');
  await service.prepare([photo]);
  assert.equal(calls.length, 1);

  // A mitad de vida: nada que renovar.
  advance(1800);
  assert.equal(await service.renewDue(), 0);
  assert.equal(calls.length, 1);

  // Dentro del margen (quedan 300 s de 3600): se renueva ya.
  advance(2400);
  assert.equal(await service.renewDue(), 1);
  assert.equal(calls.length, 2);
  assert.match(service.url(photo), /token=2$/);
});

test('prepare también renueva si se llama dentro del margen', async () => {
  const { service, calls, advance } = makeService({ ttlSeconds: 100, renewMarginSeconds: 30 });
  const photo = publicUrl('memes', 'a.jpg');
  await service.prepare([photo]);
  advance(75); // quedan 25 s < 30 de margen
  await service.prepare([photo]);
  assert.equal(calls.length, 2);
});

test('una firma caducada no se usa aunque la caché la tenga', async () => {
  const { service, calls, advance } = makeService({ ttlSeconds: 60, renewMarginSeconds: 0 });
  const photo = publicUrl('audios', 'a.m4a');
  await service.prepare([photo]);
  advance(61);

  // Sin renovar: se devuelve la original en vez de una firmada muerta.
  assert.equal(service.url(photo), photo);
  // Y deja pedida la nueva (una sola vez).
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.length, 2);
});

// ── 4 · Degradación elegante ────────────────────────────────────

test('si firmar falla, la vista sigue teniendo la URL original', async () => {
  const { service, calls, advance } = makeService({ fail: new Error('sin red') });
  const photo = publicUrl('galeria', 'a.jpg');

  const result = await service.prepare([photo]);
  assert.equal(result.failed, 1);
  assert.equal(result.signed, 0);
  assert.equal(service.url(photo), photo, 'con el bucket público la foto se ve igual');

  // Enfriamiento: no se martillea al servidor en cada render.
  await service.prepare([photo]);
  assert.equal(calls.length, 1);

  // Pasado el enfriamiento se vuelve a intentar.
  advance(61);
  await service.prepare([photo]);
  assert.equal(calls.length, 2);
});

test('un objeto que ya no existe se marca y no se reintenta', async () => {
  const { service, calls } = makeService({ missing: new Set(['galeria/borrada.jpg']) });
  const gone = publicUrl('galeria', 'borrada.jpg');

  const result = await service.prepare([gone]);
  assert.equal(result.failed, 1);
  assert.equal(service.url(gone), gone);

  await service.prepare([gone]);
  assert.equal(calls.length, 1, 'no se pide dos veces un objeto inexistente');
  assert.equal(service.stats().missing, 1);
});

test('un 404 del firmante también se trata como objeto inexistente', async () => {
  const { service, calls } = makeService({
    fail: Object.assign(new Error('Object not found'), { statusCode: '404' }),
  });
  const gone = publicUrl('galeria', 'x.jpg');
  await service.prepare([gone]);
  await service.prepare([gone]);
  assert.equal(calls.length, 1);
});

test('prepare nunca lanza, aunque el firmante explote', async () => {
  const service = createMediaService({
    signer: () => {
      throw new Error('boom');
    },
    autoRenew: false,
  });
  await assert.doesNotReject(() => service.prepare([publicUrl('galeria', 'a.jpg')]));
});

test('sin firmante configurado se comporta como antes (todo público)', async () => {
  const service = createMediaService({ autoRenew: false });
  const photo = publicUrl('galeria', 'a.jpg');
  const result = await service.prepare([photo]);
  assert.equal(result.failed, 1);
  assert.equal(service.url(photo), photo);
});

// ── 5 · Avisos, reinicio y respaldo global ──────────────────────

test('onMediaReady avisa una vez por lote firmado y reset limpia', async () => {
  let ready = 0;
  const { service } = makeService();
  const off = service.onReady(() => {
    ready += 1;
  });

  await service.prepare([publicUrl('galeria', 'a.jpg'), publicUrl('galeria', 'b.jpg')]);
  assert.equal(ready, 1, 'un lote → un aviso, no uno por foto');

  service.reset();
  assert.equal(service.stats().cached, 0);
  assert.equal(service.url(publicUrl('galeria', 'a.jpg')), publicUrl('galeria', 'a.jpg'));

  off();
});

test('el respaldo global reintenta una imagen rota con su URL firmada', async () => {
  const { service } = makeService();
  const photo = publicUrl('galeria', 'rota.jpg');
  const signed = await service.prepare([photo]).then(() => service.url(photo));
  assert.notEqual(signed, photo);

  const listeners = [];
  const document = { addEventListener: (type, fn) => listeners.push(fn) };
  installMediaFallback(document, service);

  assert.equal(listeners.length, 1, 'un solo listener global');

  const img = {
    tagName: 'IMG',
    dataset: {},
    attrs: { src: photo },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };

  listeners[0]({ target: img });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(img.attrs.src, signed, 'la imagen se recupera con la URL firmada');
  assert.equal(img.dataset.mediaRetried, '1');

  // Un segundo error del mismo elemento no entra en bucle.
  img.attrs.src = photo;
  listeners[0]({ target: img });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(img.attrs.src, photo);
});

test('el respaldo global ignora URLs ajenas a Storage', () => {
  const { service } = makeService();
  const listeners = [];
  installMediaFallback({ addEventListener: (type, fn) => listeners.push(fn) }, service);

  const img = {
    tagName: 'IMG',
    dataset: {},
    getAttribute: () => 'https://res.cloudinary.com/demo/a.jpg',
    setAttribute: () => {},
  };
  listeners[0]({ target: img });
  assert.equal(img.dataset.mediaRetried, undefined);
});

// ── 6 · La migración SQL ────────────────────────────────────────

const sql = readFileSync(new URL('../sql/030_media_privado.sql', import.meta.url), 'utf8');

test('030 pone los cuatro buckets en privado', () => {
  assert.match(sql, /UPDATE\s+storage\.buckets/i);
  assert.match(sql, /SET\s+public\s*=\s*false/i);
  for (const bucket of MEDIA_BUCKETS) {
    assert.ok(sql.includes(`'${bucket}'`), `falta el bucket ${bucket}`);
  }
});

test('030 restringe la lectura a sesiones autenticadas', () => {
  for (const bucket of MEDIA_BUCKETS) {
    assert.match(
      sql,
      new RegExp(`CREATE POLICY ${bucket}_select_authenticated[\\s\\S]*?FOR SELECT TO authenticated`, 'i'),
      `la lectura de ${bucket} debe ser TO authenticated`
    );
  }
  assert.match(sql, /public\.is_enabled\(\)/, 'la lectura usa la misma puerta que el resto de datos');
});

test('030 es idempotente: borra cada política antes de crearla', () => {
  const drops = sql.match(/DROP POLICY IF EXISTS/g) || [];
  const creates = sql.match(/CREATE POLICY/g) || [];
  assert.ok(drops.length >= creates.length, 'cada CREATE POLICY necesita su DROP IF EXISTS');
});

test('030 no borra, mueve ni reescribe objetos ni datos de la app', () => {
  const statements = sql.replace(/--[^\n]*/g, ''); // sin comentarios
  assert.doesNotMatch(statements, /DELETE\s+FROM\s+storage\.objects/i);
  assert.doesNotMatch(statements, /TRUNCATE/i);
  assert.doesNotMatch(statements, /DROP\s+TABLE/i);
  assert.doesNotMatch(statements, /UPDATE\s+public\.(content|profiles|moods)/i);
  assert.doesNotMatch(statements, /storage\.objects\s*\([^)]*\)\s*VALUES/i, 'no inserta filas de objetos');
});

test('030 no abre escritura a anon', () => {
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(statements, /TO\s+anon/i);
  assert.doesNotMatch(statements, /TO\s+public/i);
});

test('030 documenta el orden de aplicación y el rollback', () => {
  assert.match(sql, /ORDEN DE APLICACIÓN/i);
  assert.match(sql, /Desplegar primero el código/i);
  assert.match(sql, /ROLLBACK/i);
  assert.match(sql, /SET\s+public\s*=\s*true/i, 'el rollback vuelve a dejar los buckets públicos');
  assert.match(sql, /VERIFICACIÓN/i);
});
