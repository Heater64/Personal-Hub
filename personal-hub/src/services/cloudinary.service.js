/* ==========================================
   Personal Hub — Cloudinary Upload Service
   Dos modos:

   1) UNSIGNED (preferido para archivos grandes):
      subida directa navegador → Cloudinary con un
      "unsigned upload preset". Sin límite de tamaño
      (vale para vídeos). Requiere:
        VITE_CLOUDINARY_CLOUD_NAME
        VITE_CLOUDINARY_UPLOAD_PRESET

   2) SIGNED (por defecto): el archivo se envía a
      /api/upload-cloudinary (función de Vercel), que
      sube con las credenciales del servidor
      (CLOUDINARY_URL). Límite ~3 MB (límite de body
      de Vercel). No necesita variables en el cliente.

   Ambos soportan imágenes, vídeos, audio y PDFs.
   ========================================== */

import { supabase } from './supabase.js';

const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dcsent4fs').trim();
const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
const DEFAULT_FOLDER = 'personal-hub';
const SIGNED_LIMIT_BYTES = 3 * 1024 * 1024; // ~3 MB (margen bajo el límite de Vercel)
const API_UPLOAD_PATH = '/api/upload-cloudinary';

export function isCloudinaryConfigured() {
  return !!(CLOUD_NAME && UPLOAD_PRESET);
}

export function getCloudinaryConfig() {
  return {
    cloudName: CLOUD_NAME,
    uploadPreset: UPLOAD_PRESET,
    mode: UPLOAD_PRESET ? 'unsigned' : 'signed',
    configured: true, // siempre hay una vía: firmada (servidor) o preset
    signedLimitMB: Math.round(SIGNED_LIMIT_BYTES / (1024 * 1024))
  };
}

export function cloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
}

export function cloudinaryMediaLibraryUrl() {
  return `https://cloudinary.com/console/media_library`;
}

/** Clasifica el archivo por MIME para el icono/preview y las transformaciones. */
export function fileKind(file) {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
}

export function kindLabel(kind) {
  return { image: 'Imagen', video: 'Vídeo', audio: 'Audio', pdf: 'PDF', file: 'Archivo' }[kind] || 'Archivo';
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Token de sesión actual para llamar a las API admin de Vercel. */
async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
  } catch {
    return '';
  }
}

/**
 * Sube un archivo a Cloudinary con un UNSIGNED preset (directo, sin límite
 * de tamaño). Requiere VITE_CLOUDINARY_UPLOAD_PRESET configurado.
 * @returns {Promise<{secure_url:string, public_id:string, format:string, resource_type:string, bytes:number}>}
 */
export function uploadToCloudinary(file, { folder = DEFAULT_FOLDER, tags = [], onProgress } = {}) {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(new Error('No hay unsigned preset configurado. Crea uno en Cloudinary → Settings → Upload y añade VITE_CLOUDINARY_UPLOAD_PRESET.'));
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', folder);
  if (tags.length) form.append('tags', tags.join(','));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', cloudinaryUploadUrl());
    xhr.responseType = 'json';

    xhr.upload.addEventListener('progress', (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        resolve({
          secure_url: data.secure_url,
          public_id: data.public_id,
          format: data.format,
          resource_type: data.resource_type,
          bytes: data.bytes
        });
      } else {
        reject(new Error(data?.error?.message || `Cloudinary respondió ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red al subir a Cloudinary')));
    xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

    xhr.send(form);
  });
}

/**
 * Sube un archivo a Cloudinary vía el servidor (firmado, CLOUDINARY_URL).
 * Límite ~3 MB por el body de Vercel. Muestra progreso por fases.
 * @returns {Promise<{secure_url:string, public_id:string, format:string, resource_type:string, bytes:number}>}
 */
export async function uploadToCloudinarySigned(file, { folder = DEFAULT_FOLDER, onProgress } = {}) {
  if (file.size > SIGNED_LIMIT_BYTES) {
    throw new Error(`El archivo pesa ${formatBytes(file.size)}: por la subida firmada el límite es ~3 MB. Para archivos grandes crea un unsigned preset (Cloudinary → Settings → Upload).`);
  }

  const dataUri = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
  onProgress?.(25);

  const token = await getAccessToken();
  let res;
  try {
    res = await fetch(API_UPLOAD_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ file: dataUri, folder })
    });
  } catch {
    throw new Error('No se pudo contactar con /api/upload-cloudinary. En local, arranca con `vercel dev`; en producción, despliega la API.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error || `El servidor respondió ${res.status}`);
  }
  onProgress?.(100);
  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
    format: data.format,
    resource_type: data.resource_type,
    bytes: data.bytes
  };
}

/** Sube con la mejor vía disponible (firmada por defecto, preset si está configurado). */
export async function uploadFile(file, opts) {
  if (isCloudinaryConfigured()) return uploadToCloudinary(file, opts);
  return uploadToCloudinarySigned(file, opts);
}
