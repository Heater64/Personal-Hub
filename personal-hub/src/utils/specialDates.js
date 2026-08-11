/* ==========================================
   Personal Hub — Fechas especiales configurables
   Fuente de verdad: tabla content (clave 'hub_dates'),
   editables desde el panel Admin → Configuración.
   Este módulo da acceso síncrono (caché) para que las
   páginas rendericen al momento y se actualicen cuando
   llegan los datos remotos.
   ========================================== */

import { db } from '../services/db.service.js';

const DEFAULTS = { anniversary: '2024-07-10', hubStart: '2024-05-10', birthday: '2024-11-24' };

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
