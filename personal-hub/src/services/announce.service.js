/* ==========================================
   Personal Hub v2 — Aviso de contenido nuevo (admin → ella)

   Cuando el panel guarda contenido, este módulo pide al servidor que envíe el
   push. Va aparte de notifications.service.js a propósito: db.service.js (quien
   guarda el contenido) lo importa, y notifications.service.js ya arrastra
   novelties → db: meterlo allí cerraría un ciclo de imports.

   Nunca lanza: un aviso que falla no puede hacer que falle el guardado. El
   servidor decide a quién llega, con qué interruptor y si está en silencio.
   ========================================== */

import { supabase } from './supabase.js';

const KINDS = ['openwhen', 'calendar', 'reason', 'content'];

/**
 * Pide al servidor que anuncie contenido recién publicado.
 *
 * @param {'openwhen'|'calendar'|'reason'|'content'} kind
 * @param {{count?: number, section?: string, url?: string}} meta
 *   count   cuántos elementos se han añadido (para el singular/plural)
 *   section nombre de la sección, solo para `content`
 *   url     destino interno, solo para `content`
 * @returns {Promise<boolean>} true si el servidor aceptó el envío
 */
export async function announcePublished(kind, { count = 1, section = '', url = '' } = {}) {
  if (!KINDS.includes(kind)) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const res = await fetch('/api/push?action=announce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ kind, count, section, url })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn('[announce] el servidor no aceptó el aviso:', kind, res.status, body?.error || '');
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[announce] no se pudo avisar del contenido nuevo:', err?.message);
    return false;
  }
}
