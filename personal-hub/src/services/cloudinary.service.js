/* ==========================================
   Personal Hub — Utilidades de archivos
   Clasificación por tipo y formato de
   tamaño para los listados de subida
   del panel de administración.
   ========================================== */

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
