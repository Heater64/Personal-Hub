/* ==========================================
   Personal Hub v2 — HTML Escaping helper
   Único punto de escape HTML de la app para
   evitar XSS al interpolar datos en templates.
   ========================================== */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => HTML_ESCAPES[m] || m);
}

/**
 * Escapa un valor destined a un atributo de URL (src, href, poster…).
 *
 * Además de escapar comillas y angle brackets (que cerrarían el atributo),
 * descarta cualquier esquema ejecutable. Sin esto, un avatar con
 * `x" onerror="…` o un `javascript:` en la portada rompe el HTML.
 *
 * Acepta: http(s)://, data:image/*, blob:, rutas relativas y anclas.
 * Devuelve '' si no es una URL válida, de modo que el caller cae en su
 * fallback (initial, portada por defecto…) en vez de emitir algo roto.
 */
export function safeUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const url = value.trim();
  if (!url) return '';

  const lower = url.toLowerCase();

  // data: solo imágenes (svg+xml puede llevar script).
  if (lower.startsWith('data:')) {
    return /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(url)
      ? escapeHtml(url)
      : '';
  }

  // EsquemasRelative permitidos; el resto (javascript:, vbscript:,
  // file:, data: ya filtrado) se rechaza.
  if (/^(https?:|blob:)/i.test(url)) return escapeHtml(url);
  if (/^\/{1,2}[^/\\]/.test(url)) return escapeHtml(url);   // /ruta o //host
  if (url.startsWith('#')) return escapeHtml(url);

  // Relativa sin esquema: solo si no parece un intento de esquema.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';          // javascript:, vbscript:…
  if (url.startsWith('./') || url.startsWith('../') || !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return escapeHtml(url);
  }

  return '';
}
