/* ==========================================
   Rincón — portadas de Canciones
   La landing y las tarjetas de sección necesitan las mismas portadas. Viven
   aquí, con import() diferido: así Canciones.js y canciones.css NO entran en
   el chunk inicial de Rincón (era el motivo del PR #6) y ambas vistas
   comparten la misma caché.
   ========================================== */

let _songCovers = [];
let _songCoversWarm = null;

/** Portadas ya resueltas. Array vacío hasta que warmSongCovers termina. */
export function getSongCovers() {
  return _songCovers;
}

/** Dispara el import() diferido de Canciones.js. Idempotente. */
export function warmSongCovers() {
  if (!_songCoversWarm) {
    _songCoversWarm = import('../Canciones.js')
      .then((m) => (typeof m.warmSongCovers === 'function' ? m.warmSongCovers() : []))
      .catch(() => [])
      .then((covers) => { _songCovers = Array.isArray(covers) ? covers : []; return _songCovers; });
  }
  return _songCoversWarm;
}