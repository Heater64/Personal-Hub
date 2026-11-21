import { supabase } from './supabase.js';

const LIMITS = { image: 20e6, gif: 20e6, audio: 25e6, pdf: 25e6, video: 100e6 };

function kindOf(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (type === 'image/gif') return 'gif';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return null;
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Inicia sesión para subir un archivo.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function api(body) {
  const response = await fetch('/api/tamp-media', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo preparar la subida.');
  return result;
}

function uploadSigned(file, signed, signal, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', signed.upload_url);
    request.responseType = 'json';
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onerror = () => reject(new Error('No se pudo conectar con Cloudinary.'));
    request.onabort = () => reject(new DOMException('Subida cancelada.', 'AbortError'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve(request.response || {});
      else reject(new Error('Cloudinary rechazó el archivo.'));
    };
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    const data = new FormData();
    for (const [key, value] of Object.entries(signed)) {
      if (['upload_url', 'cloud_name', 'api_key'].includes(key)) continue;
      data.append(key, value);
    }
    data.append('api_key', signed.api_key);
    data.append('file', file);
    request.send(data);
  });
}

export function validateFile(file) {
  const kind = kindOf(file);
  if (!kind) throw new Error('Formato no compatible. Usa imagen, GIF, vídeo, audio o PDF.');
  if (file.size > LIMITS[kind]) throw new Error(`El límite para ${kind} es ${Math.round(LIMITS[kind] / 1e6)} MB.`);
  return kind;
}

export async function uploadTampMedia(file, { visibility = 'shared', title = '', signal, onProgress } = {}) {
  const kind = validateFile(file);
  const signed = await api({ action: 'sign', kind, bytes: file.size, visibility });
  await uploadSigned(file, signed, signal, onProgress);
  return api({ action: 'commit', kind, visibility, public_id: signed.public_id, title });
}

export async function listTampMedia() {
  const response = await fetch('/api/tamp-media', { headers: await authHeaders() });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los archivos.');
  return result.items || [];
}

export async function removeTampMedia(id) {
  const response = await fetch('/api/tamp-media', { method: 'DELETE', headers: await authHeaders(), body: JSON.stringify({ id }) });
  if (!response.ok) throw new Error('No se pudo enviar el archivo a la papelera.');
}

