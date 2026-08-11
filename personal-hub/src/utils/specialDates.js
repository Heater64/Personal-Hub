/* ==========================================
   Personal Hub — Fechas especiales configurables
   Fuente de verdad: tabla content (clave 'hub_dates'),
   editables desde el panel Admin → Configuración.
   Este módulo da acceso síncrono (caché) para que las
   páginas rendericen al momento y se actualicen cuando
   llegan los datos remotos.
   ========================================== */

import { db } from '../services/db.service.js';

const DEFAULTS = {
  anniversary: '2026-07-03',     // aniversario de pareja: 03/07/2026 (día/mes/año)
  hubStart: '2024-05-10',        // inicio del Hub / primer mensaje
  birthday: '2012-09-03',        // cumpleaños de dada: 03/09/2012
  userBirthday: '2009-08-03'     // cumpleaños del admin: 03/08/2009
};

let cached = null;
let loading = null;

export function specialDates() {
  return cached || { ...DEFAULTS };
}

/** Carga las fechas desde Supabase y las deja en caché. Devuelve la promesa. */
export function loadSpecialDates() {
  if (!loading) {
    loading = db
      .getHubDates()
      .then(d => { cached = d; return d; })
      .catch(() => ({ ...DEFAULTS }))
      .finally(() => { loading = null; });
  }
  return loading;
}

/** Días transcurridos desde el aniversario (contador "días juntos"). */
export function daysSinceAnniversary() {
  return Math.floor((Date.now() - new Date(specialDates().anniversary + 'T00:00:00').getTime()) / 86400000);
}

/**
 * Invalida la caché y vuelve a cargar las fechas desde Supabase.
 * El Admin la llama tras guardar para que el inicio y la bienvenida
 * reflejen el cambio al instante (sin quedarse con el valor viejo).
 */
export function refreshSpecialDates() {
  cached = null;
  return loadSpecialDates();
}
