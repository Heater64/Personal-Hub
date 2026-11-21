/* ==========================================
   media.service.js — URLs firmadas para el multimedia privado

   El problema que resuelve: las fotos, memes, audios y avatares viven en
   Supabase Storage y la app guarda su URL *pública* (la misma para siempre,
   también dentro de `content` y de localStorage). Cuando los buckets pasan a
   privados esa URL deja de servir, y no se puede "arreglar" reescribiendo los
   datos: se rompería todo lo guardado y las URLs firmadas caducan.

   Solución: la URL pública se queda como identificador estable y aquí se
   cambia por una URL firmada de corta duración, con caché por objeto:

   · `prepareMedia(urls)` firma por lote (una llamada por bucket) todo lo que
     aún no está en caché o está a punto de caducar.
   · `mediaUrl(url)` es síncrona: devuelve la firmada si está en caché y, si
     no, la original. Así una plantilla no tiene que esperar ni cambiar.
   · La caché se renueva sola antes de caducar (`renewDue`, cada minuto) y
     nunca re-firma en cada render: la misma URL se pide una vez.
   · Si firmar falla, se devuelve la URL original: con el bucket público todo
     sigue funcionando igual (compatibilidad) y con el privado la vista no se
     rompe, solo se queda sin esa imagen.
   · `installMediaFallback()` es la red de seguridad para las plantillas que
     pintan `<img>` directamente: si un recurso de Storage falla, se reintenta
     una vez con la URL firmada.

   Nada de esto toca el diseño ni los datos: es una capa de lectura.
   ========================================== */

/** Buckets cuyo contenido es privado (o lo será). */
export const MEDIA_BUCKETS = Object.freeze(['avatars', 'galeria', 'memes', 'audios']);

/** Vida de una URL firmada y margen de renovación, en segundos. */
export const DEFAULT_TTL_SECONDS = 3600;
export const DEFAULT_RENEW_MARGIN_SECONDS = 600;

/** Forma de una URL de Storage: /storage/v1/object/(public|sign)/<bucket>/<ruta> */
const STORAGE_PATH = /^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/;

/**
 * Descompone una URL de Supabase Storage en bucket + ruta.
 * Acepta la forma pública y la ya firmada, y descarta query (`?v=`, `?token=`)
 * para que el identificador sea siempre el mismo objeto.
 * Devuelve null para cualquier otra URL (Cloudinary, enlaces externos…).
 */
export function parseStorageUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;

  const match = url.pathname.match(STORAGE_PATH);
  if (!match) return null;

  let bucket;
  let path;
  try {
    bucket = decodeURIComponent(match[2]);
    path = decodeURIComponent(match[3]);
  } catch {
    return null;
  }
  if (!MEDIA_BUCKETS.includes(bucket) || !path) return null;

  return { bucket, path, mode: match[1] };
}

/** ¿Es un recurso de un bucket de la app? */
export function isStorageUrl(value) {
  return parseStorageUrl(value) !== null;
}

/**
 * URLs de Storage que aparecen en un fragmento de HTML. Sirve para firmar
 * justo antes de pintar sin que cada plantilla tenga que declarar su lista.
 */
export function storageUrlsIn(markup) {
  const text = typeof markup === 'string' ? markup : '';
  const found = text.match(/https?:\/\/[^\s"'`)<>]+/g) || [];
  return [...new Set(found.filter(isStorageUrl))];
}

/** Un error de "este objeto ya no está" no debe reintentarse en bucle. */
function isMissingError(error) {
  const message = String(error?.message || error?.error || error || '').toLowerCase();
  const status = String(error?.statusCode || error?.status || '');
  return status === '404' || message.includes('not found') || message.includes('no such object');
}

/**
 * Servicio de firmas. Se crea con `createMediaService` para poder inyectar un
 * firmante falso en los tests; la app usa la instancia exportada al final.
 */
export function createMediaService(options = {}) {
  const {
    signer = null,
    now = () => Date.now(),
    ttlSeconds = DEFAULT_TTL_SECONDS,
    renewMarginSeconds = DEFAULT_RENEW_MARGIN_SECONDS,
    retryAfterMs = 60_000,
    batchSize = 50,
    autoRenew = true,
    renewEveryMs = 60_000,
  } = options;

  /** clave `bucket/ruta` → { url, expiresAt, failedAt, missing } */
  const entries = new Map();
  /** clave → promesa en curso (evita pedir dos veces el mismo objeto) */
  const inflight = new Map();
  const listeners = new Set();
  let timer = null;

  const keyOf = (bucket, path) => `${bucket}/${path}`;

  function isFresh(entry) {
    return Boolean(entry?.url) && entry.expiresAt - now() > renewMarginSeconds * 1000;
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* un listener roto no puede tumbar una firma */
      }
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('ph:media-ready'));
      } catch {
        /* sin CustomEvent (tests, entornos raros) */
      }
    }
  }

  function ensureTimer() {
    if (!autoRenew || timer || typeof setInterval !== 'function') return;
    if (![...entries.values()].some(entry => entry.url)) return;
    timer = setInterval(() => {
      void renewDue();
    }, renewEveryMs);
    // En Node no debe mantener vivo el proceso de los tests.
    timer?.unref?.();
  }

  function stopTimer() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  /** Núcleo: firma una lista de { bucket, path } ya normalizada. */
  async function signRefs(refs) {
    const pending = [];
    for (const ref of refs) {
      const key = keyOf(ref.bucket, ref.path);
      const entry = entries.get(key);
      if (isFresh(entry)) continue;
      if (inflight.has(key)) continue;
      if (entry?.missing) continue;
      if (entry?.failedAt && now() - entry.failedAt < retryAfterMs) continue;
      pending.push({ ...ref, key });
    }
    if (!pending.length) return { signed: 0, failed: 0, pending: inflight.size };

    const buckets = new Map();
    for (const item of pending) {
      if (!buckets.has(item.bucket)) buckets.set(item.bucket, []);
      buckets.get(item.bucket).push(item);
    }

    let signed = 0;
    let failed = 0;

    await Promise.all(
      [...buckets.entries()].map(async ([bucket, items]) => {
        // Lotes acotados: una galería de 300 fotos no debe ir en una sola
        // petición gigante (ni en una respuesta gigante).
        for (let i = 0; i < items.length; i += batchSize) {
          const chunk = items.slice(i, i + batchSize);
          const work = (async () => {
            try {
              if (typeof signer !== 'function') throw new Error('Sin firmante configurado');
              const urls = await signer(
                bucket,
                chunk.map(item => item.path),
                ttlSeconds
              );
              chunk.forEach((item, index) => {
                const signedUrl = Array.isArray(urls) ? urls[index] : '';
                if (typeof signedUrl === 'string' && signedUrl) {
                  entries.set(item.key, { url: signedUrl, expiresAt: now() + ttlSeconds * 1000 });
                  signed += 1;
                } else {
                  // El firmante respondió, pero ese objeto no existe.
                  entries.set(item.key, { url: '', expiresAt: 0, missing: true });
                  failed += 1;
                }
              });
            } catch (error) {
              const missing = isMissingError(error);
              for (const item of chunk) {
                const previous = entries.get(item.key) || {};
                entries.set(item.key, {
                  url: previous.url || '',
                  expiresAt: 0,
                  failedAt: now(),
                  missing,
                });
                failed += 1;
              }
              if (missing) {
                console.warn('[media] objeto inexistente en Storage:', bucket, error?.message || error);
              } else {
                console.warn('[media] no se pudo firmar:', bucket, error?.message || error);
              }
            } finally {
              for (const item of chunk) inflight.delete(item.key);
            }
          })();

          for (const item of chunk) inflight.set(item.key, work);
          await work;
        }
      })
    );

    if (signed) notify();
    ensureTimer();
    return { signed, failed, pending: inflight.size };
  }

  /** Normaliza cualquier entrada (URL suelta, lista o markup) a refs. */
  function toRefs(values) {
    const list = Array.isArray(values) ? values : [values];
    const refs = [];
    for (const value of list) {
      const ref = parseStorageUrl(value);
      if (ref) refs.push(ref);
    }
    return refs;
  }

  /**
   * Firma lo que haga falta de la lista. Nunca lanza: devuelve cuántas firmó.
   * Es idempotente: repetirla con la caché fresca no hace ninguna petición.
   */
  async function prepare(values) {
    try {
      return await signRefs(toRefs(values));
    } catch (error) {
      console.warn('[media] prepare falló:', error?.message || error);
      return { signed: 0, failed: 0, pending: 0 };
    }
  }

  /**
   * URL para pintar. Síncrona a propósito: las plantillas no cambian.
   * Si aún no hay firma, devuelve la original (el bucket público sigue
   * funcionando) y deja la firma pedida en segundo plano.
   */
  function url(value) {
    const ref = parseStorageUrl(value);
    if (!ref) return value;

    const key = keyOf(ref.bucket, ref.path);
    const entry = entries.get(key);
    if (entry?.url && entry.expiresAt > now()) return entry.url;

    // Sin firma todavía: se pide una vez (deduplicado por `inflight`).
    if (typeof signer === 'function' && !entry?.missing) {
      const cooling = entry?.failedAt && now() - entry.failedAt < retryAfterMs;
      if (!cooling) void prepare([value]);
    }
    return value;
  }

  /** Renueva las firmas que están dentro del margen. La llama el temporizador. */
  async function renewDue() {
    const due = [];
    for (const [key, entry] of entries) {
      if (entry.missing || !entry.url) continue;
      if (entry.expiresAt - now() > renewMarginSeconds * 1000) continue;
      const separator = key.indexOf('/');
      const bucket = key.slice(0, separator);
      const path = key.slice(separator + 1);
      if (bucket && path) due.push({ bucket, path });
    }
    if (due.length) await signRefs(due);
    if (![...entries.values()].some(entry => entry.url)) stopTimer();
    return due.length;
  }

  function onReady(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function reset() {
    entries.clear();
    inflight.clear();
    listeners.clear();
    stopTimer();
  }

  function stats() {
    return {
      cached: [...entries.values()].filter(entry => entry.url).length,
      missing: [...entries.values()].filter(entry => entry.missing).length,
      pending: inflight.size,
      ttlSeconds,
    };
  }

  return { prepare, url, renewDue, onReady, reset, stats, parseStorageUrl };
}

/* ==========================================
   Firmante real — Supabase Storage
   Se importa en diferido para que este módulo se pueda probar (y usar) sin
   credenciales ni red.
   ========================================== */
async function supabaseSigner(bucket, paths, ttlSeconds) {
  const { supabase } = await import('./supabase.js');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, ttlSeconds);
  if (error) throw error;

  const env = import.meta.env || {};
  const base = String(env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');

  return (data || []).map(row => {
    // Un objeto borrado llega como fila con `error` y sin `signedUrl`:
    // se devuelve null para marcarlo como inexistente, no para reintentarlo.
    if (!row || row.error || !row.signedUrl) return null;
    const signed = String(row.signedUrl);
    if (/^https?:\/\//i.test(signed)) return signed;
    return `${base}${signed.startsWith('/') ? '' : '/'}${signed}`;
  });
}

export const media = createMediaService({ signer: supabaseSigner });

/** Lee una URL lista para pintar (firma en caché o la original). */
export const mediaUrl = value => media.url(value);

/** Firma por lote antes de pintar. Nunca lanza. */
export const prepareMedia = values => media.prepare(values);

/** Avisa cuando hay firmas nuevas (para repintar una sola vez). */
export const onMediaReady = listener => media.onReady(listener);

/** Vacía la caché (logout, cambio de cuenta). */
export const resetMediaCache = () => media.reset();

/**
 * Red de seguridad para las plantillas que escriben `src` a mano: si un
 * `<img>`, `<video>`, `<audio>` o `<source>` de Storage falla, se reintenta
 * una vez con la URL firmada cuando esté lista. Sin esto, un avatar privado
 * se quedaría roto hasta el siguiente render.
 */
export function installMediaFallback(target, service = media) {
  const host = target || (typeof document !== 'undefined' ? document : null);
  if (!host || typeof host.addEventListener !== 'function') return () => {};
  if (host.__phMediaFallback) return () => {};

  const handler = event => {
    const el = event.target;
    if (!el || !el.tagName) return;
    if (!['IMG', 'VIDEO', 'AUDIO', 'SOURCE'].includes(el.tagName)) return;
    if (el.dataset?.mediaRetried === '1') return;

    const raw = el.getAttribute?.('src') || '';
    if (!parseStorageUrl(raw)) return;

    // Se toma el control del error: varias plantillas tienen `onerror` que
    // borra el elemento o lo cambia por la inicial, y eso impediría reintentar.
    // Al parar la propagación en captura, el elemento sigue vivo para recibir
    // su URL firmada. Si la firma no llega, el error se vuelve a lanzar para
    // que la plantilla haga su respaldo de siempre.
    el.dataset.mediaRetried = '1';
    event.stopPropagation?.();

    void service.prepare([raw]).then(() => {
      const signed = service.url(raw);
      if (!signed || signed === raw) {
        if (typeof el.dispatchEvent === 'function' && typeof Event === 'function') {
          el.dispatchEvent(new Event('error'));
        }
        return;
      }
      el.setAttribute('src', signed);
      const mediaEl = el.tagName === 'SOURCE' ? el.parentElement : el;
      try {
        mediaEl?.load?.();
      } catch {
        /* un <img> no tiene load() */
      }
    });
  };

  host.__phMediaFallback = true;
  host.addEventListener('error', handler, true);
  return () => host.removeEventListener('error', handler, true);
}
