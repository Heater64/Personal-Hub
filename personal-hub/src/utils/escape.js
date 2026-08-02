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
