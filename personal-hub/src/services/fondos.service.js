/* ==========================================
   FOTOS DE «DÍAS JUNTOS»
   ==========================================
   Sube las fotos que elige la persona (de su móvil o de su ordenador) a
   Supabase Storage y devuelve su URL pública.

   Se guardan en el bucket `avatars`, que ya existe y tiene las políticas
   correctas: lectura pública y escritura SOLO dentro de `avatars/<tu-id>/`.
   Así no hay que crear buckets nuevos ni tocar RLS, y cada quien solo puede
   pisar sus propias fotos.

   El bucket corta en 2 MB, así que la imagen se reescala y recomprime en el
   propio móvil antes de subirla (una foto de 12 MB de cámara baja a ~300 KB).

   Hay DOS listas, porque los dos sitios no tienen la misma forma: la tarjeta
   del Inicio es una franja apaisada y la pantalla Juntos es vertical, y la
   misma foto se recorta bien en una y mal en la otra. Cada lista es de hasta 5
   fotos y sí se comparte entre las dos personas (`couples.data`, ver sql/031):
   lo que se añade en un móvil aparece en el otro. El archivo se sube a la
   carpeta de quien lo sube; lo que se comparte es la lista de URLs.
   ========================================== */

import { supabase } from './supabase.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { parseStorageUrl } from './media.service.js';

const BUCKET = 'avatars';
/** Tope de fotos por sitio (se turnan cada 5 s). */
export const MAX_FOTOS = 5;

/**
 * Los dos sitios donde se ponen fotos. `clave` es dónde vive la lista dentro
 * de la fila de la pareja, `pref` la copia de este móvil y `archivo` el prefijo
 * con el que se guardan las imágenes subidas.
 */
export const SLOTS = {
  // Tarjeta «días juntos» del Inicio: franja ancha, mejor fotos apaisadas.
  portada: { clave: 'portada', pref: 'portadaFotos', archivo: 'portada' },
  // Fondo a pantalla completa de Juntos: vertical.
  juntos: { clave: 'juntos', pref: 'juntosFotos', archivo: 'juntos' },
};

// Preferencia de la versión anterior (una sola foto, solo en este móvil).
const PORTADA_ANTIGUA = 'homeHeroFoto';
const PORTADA_MIGRADA = 'portadaCompartidaMigrada';
const LADO_MAX = 1600;
const CALIDAD = 0.82;
const PESO_MAX = 1.8 * 1024 * 1024; // margen bajo el límite de 2 MB del bucket

/** Definición del sitio pedido; revienta si el nombre no existe. */
function slotDe(slot) {
  const def = SLOTS[slot];
  if (!def) throw new Error('Sitio de fotos desconocido.');
  return def;
}

/** Lee el archivo como imagen (createImageBitmap respeta la orientación EXIF). */
async function cargarImagen(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* algún navegador viejo: se intenta con <img> */
    }
  }

  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto. Prueba con otra.'));
    };
    img.src = url;
  });
}

/** Reescala a 1600 px de lado mayor y guarda en JPEG, bajando calidad si pesa. */
async function comprimir(file) {
  const img = await cargarImagen(file);
  const ancho = img.width || img.naturalWidth;
  const alto = img.height || img.naturalHeight;
  if (!ancho || !alto) throw new Error('La imagen no tiene tamaño.');

  const escala = Math.min(1, LADO_MAX / Math.max(ancho, alto));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ancho * escala));
  canvas.height = Math.max(1, Math.round(alto * escala));

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();

  let calidad = CALIDAD;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad));

  while (blob && blob.size > PESO_MAX && calidad > 0.5) {
    calidad -= 0.12;
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad));
  }

  if (!blob) throw new Error('No se pudo preparar la foto.');
  return blob;
}

/** Ruta de la foto dentro del bucket, siempre en la carpeta del usuario. */
function ruta(userId, carpeta) {
  return `${userId}/${carpeta}`;
}

/**
 * Sube la foto a la carpeta de la persona y devuelve la URL con un `?v=` que
 * cambia en cada subida: así el service worker y el navegador no siguen
 * enseñando la foto anterior.
 */
async function subirImagen(file, carpeta) {
  if (!file) throw new Error('Elige una foto primero.');
  if (!file.type?.startsWith('image/')) throw new Error('Eso no es una imagen.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Inicia sesión para elegir tu foto.');

  const blob = await comprimir(file);

  const { error } = await supabase.storage.from(BUCKET).upload(ruta(user.id, carpeta), blob, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    throw new Error(
      error.message?.includes('Bucket')
        ? 'El almacenamiento no está disponible ahora mismo.'
        : 'No se pudo subir la foto. Inténtalo otra vez.'
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta(user.id, carpeta));
  return `${data.publicUrl}?v=${Date.now()}`;
}

/* ==========================================
   LAS LISTAS — una por sitio, compartida por la pareja
   ========================================== */

/** Lista limpia: solo http(s), sin repetidas y como mucho MAX_FOTOS. */
function limpiarFotos(value) {
  const lista = Array.isArray(value) ? value : [];
  const vistas = new Set();
  return lista
    .filter(url => typeof url === 'string' && /^https?:\/\//i.test(url))
    .filter(url => {
      if (vistas.has(url)) return false;
      vistas.add(url);
      return true;
    })
    .slice(0, MAX_FOTOS);
}

/** Copia de este móvil: se enseña si la lista compartida no responde. */
function leerCopiaLocal(slot) {
  const def = slotDe(slot);
  try {
    return limpiarFotos(JSON.parse(getUserPref(def.pref, '[]')));
  } catch {
    return [];
  }
}

/**
 * La fila de la pareja (`couples`, 029/030) con su JSON. Devuelve null si no
 * hay pareja, si no hay sesión o si la migración que añade `couples.data`
 * (031) todavía no está aplicada.
 *
 * El id de la pareja se pide a la función `current_couple_id()` y NO a
 * `couple_members`: esa tabla se quedó sin GRANT para `authenticated`, así
 * que PostgREST devolvía 403 y la lista compartida nunca se leía (todo
 * acababa como «solo en este móvil»). La función sí tiene permiso y devuelve
 * exactamente el mismo id que usa la RLS de `couples`.
 */
async function filaPareja() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: coupleId, error: errorId } = await supabase.rpc('current_couple_id');
    if (errorId || !coupleId) return null;

    const { data: pareja, error: errorPareja } = await supabase
      .from('couples')
      .select('data')
      .eq('id', coupleId)
      .maybeSingle();
    if (errorPareja || !pareja) return null;

    const data = pareja.data && typeof pareja.data === 'object' ? pareja.data : {};
    return { id: coupleId, data };
  } catch {
    return null;
  }
}

/**
 * Fotos de un sitio: `{ fotos, compartidas }`. `compartidas` dice si la lista
 * viene de la pareja (se ve en los dos móviles) o de la copia de este
 * dispositivo (falta la migración o no hay red).
 */
export async function cargarFotos(slot) {
  const def = slotDe(slot);
  const fila = await filaPareja();
  if (fila) {
    const bloque = fila.data?.[def.clave];
    const compartidas = limpiarFotos(bloque?.fotos);
    if (compartidas.length) return { fotos: compartidas, compartidas: true };

    // La lista de la pareja está vacía. Si este móvil tiene fotos de antes
    // (las que se añadieron mientras `couples.data` no existía), se pasan a
    // la compartida UNA vez para no perderlas. Solo cuando ese sitio nunca se
    // ha escrito (`actualizada` no existe): si alguien vació la lista a
    // propósito, se queda vacía y no resucita desde copias viejas.
    const local = leerCopiaLocal(slot);
    if (local.length && !bloque?.actualizada) return guardarFotos(slot, local);

    return { fotos: [], compartidas: true };
  }
  return { fotos: leerCopiaLocal(slot), compartidas: false };
}

/**
 * Guarda la lista de un sitio. Escribe siempre la copia del móvil (para poder
 * enseñar algo sin red) y, si hay pareja, la fila compartida.
 */
export async function guardarFotos(slot, fotos) {
  const def = slotDe(slot);
  const lista = limpiarFotos(fotos);
  try {
    setUserPref(def.pref, JSON.stringify(lista));
  } catch {
    /* cuota llena: la lista compartida sigue siendo la buena */
  }

  const fila = await filaPareja();
  if (!fila) return { fotos: lista, compartidas: false };

  const bloque = {
    ...(fila.data?.[def.clave] || {}),
    fotos: lista,
    actualizada: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('couples')
    .update({ data: { ...fila.data, [def.clave]: bloque } })
    .eq('id', fila.id);
  if (error) {
    console.warn(`[fotos:${def.clave}] no se pudo guardar la lista compartida:`, error.message);
    return { fotos: lista, compartidas: false };
  }
  return { fotos: lista, compartidas: true };
}

/** Añade las fotos elegidas a la lista del sitio (hasta el tope). */
export async function agregarFotos(slot, files) {
  const def = slotDe(slot);
  const imagenes = [...(files || [])].filter(file => file?.type?.startsWith('image/'));
  if (!imagenes.length) throw new Error('Elige una imagen válida.');

  const { fotos } = await cargarFotos(slot);
  const hueco = MAX_FOTOS - fotos.length;
  if (hueco <= 0) {
    throw new Error(`Solo caben ${MAX_FOTOS} fotos. Quita alguna para añadir otra.`);
  }

  const nuevas = [];
  for (const file of imagenes.slice(0, hueco)) {
    const nombre = `${def.archivo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    nuevas.push(await subirImagen(file, nombre));
  }
  return guardarFotos(slot, [...fotos, ...nuevas]);
}

/**
 * Quita una foto de la lista del sitio. El archivo se borra del bucket como
 * mejor esfuerzo: la RLS solo deja borrar en la carpeta propia (o al admin),
 * así que la foto que subió la otra persona puede quedarse en Storage sin
 * aparecer ya en la lista.
 */
export async function quitarFoto(slot, url) {
  if (!url) throw new Error('Esa foto ya no está.');

  const { fotos } = await cargarFotos(slot);
  const res = await guardarFotos(
    slot,
    fotos.filter(foto => foto !== url)
  );

  const ref = parseStorageUrl(url);
  if (ref) {
    try {
      await supabase.storage.from(ref.bucket).remove([ref.path]);
    } catch {
      /* sin permiso para borrar el archivo ajeno: la lista ya no lo enseña */
    }
  }
  return res;
}

/**
 * Primera vez: la foto que este móvil tenía antes (cuando la portada era
 * local) pasa a la lista de la tarjeta del Inicio, para no perderla. Se
 * intenta una sola vez por usuario y dispositivo.
 */
export async function migrarPortadaLocal() {
  if (getUserPref(PORTADA_MIGRADA, '')) return;
  const antigua = String(getUserPref(PORTADA_ANTIGUA, '') || '');
  if (!antigua) return;

  const fila = await filaPareja();
  if (!fila) return; // sin pareja todavía: se reintenta en el próximo arranque

  const actuales = limpiarFotos(fila.data?.portada?.fotos);
  if (!actuales.length) await guardarFotos('portada', [antigua]);
  setUserPref(PORTADA_MIGRADA, '1');
}
