/* ==========================================
   FONDO PERSONAL DE «JUNTOS»
   ==========================================
   Sube la foto que elige la persona (de su móvil o de su ordenador) a
   Supabase Storage y devuelve su URL pública.

   Se guarda en el bucket `avatars`, que ya existe y tiene las políticas
   correctas: lectura pública y escritura SOLO dentro de `avatars/<tu-id>/`.
   Así no hay que crear buckets nuevos ni tocar RLS, y cada quien solo puede
   pisar su propia foto.

   El bucket corta en 2 MB, así que la imagen se reescala y recomprime en el
   propio móvil antes de subirla (una foto de 12 MB de cámara baja a ~300 KB).
   ========================================== */

import { supabase } from './supabase.js';

const BUCKET = 'avatars';
const CARPETA = 'fondo-juntos.jpg';
const LADO_MAX = 1600;
const CALIDAD = 0.82;
const PESO_MAX = 1.8 * 1024 * 1024; // margen bajo el límite de 2 MB del bucket

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

/** Ruta del fondo dentro del bucket, siempre en la carpeta del usuario. */
function ruta(userId) {
  return `${userId}/${CARPETA}`;
}

/**
 * Sube (o reemplaza) el fondo personal y devuelve la URL con un `?v=`
 * que cambia en cada subida: así el service worker y el navegador no
 * siguen enseñando la foto anterior.
 */
export async function subirFondoJuntos(file) {
  if (!file) throw new Error('Elige una foto primero.');
  if (!file.type?.startsWith('image/')) throw new Error('Eso no es una imagen.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Inicia sesión para elegir tu foto.');

  const blob = await comprimir(file);

  const { error } = await supabase.storage.from(BUCKET).upload(ruta(user.id), blob, {
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

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta(user.id));
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Borra el fondo guardado (la pantalla vuelve al degradado o al tema). */
export async function borrarFondoJuntos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.storage.from(BUCKET).remove([ruta(user.id)]);
}
