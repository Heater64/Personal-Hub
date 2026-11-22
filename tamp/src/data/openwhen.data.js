/* ==========================================
   Personal Hub v2 — Datos de Open When
   Catálogo y cartas base, sin dependencias de UI,
   para que servicios, Home y Admin los importen sin
   arrastrar la página Open When completa al bundle inicial.
   ========================================== */

import { db } from '../services/db.service.js';
import { CATEGORIES } from './openwhen-categories.data.js';
import { LETTERS } from './openwhen-seed.data.js';

export { CATEGORIES, LETTERS };

export const TYPE_META = {
  carta: { emoji: '💌', label: 'Carta' },
  nota: { emoji: '🎙️', label: 'Nota de voz' },
  video: { emoji: '🎥', label: 'Vídeo' },
  foto: { emoji: '📸', label: 'Foto' },
  album: { emoji: '🖼️', label: 'Álbum' },
  juego: { emoji: '🎮', label: 'Juego' },
  reto: { emoji: '🧩', label: 'Reto' },
  cancion: { emoji: '🎵', label: 'Canción' },
  mensaje: { emoji: '💬', label: 'Mensaje' },
  sorpresa: { emoji: '🎁', label: 'Sorpresa' }
};


/**
 * Lista completa de cartas: las personalizadas del Admin (Supabase)
 * sobrescriben a las de la app por id; el resto se mantienen.
 */
export async function loadAllOpenWhenLetters() {
  let custom = [];
  try {
    const loaded = await db.getOpenWhenLetters();
    if (Array.isArray(loaded)) custom = loaded;
  } catch {
    custom = [];
  }
  const byId = new Map();
  custom.forEach(l => { if (l && l.id) byId.set(l.id, l); });
  LETTERS.forEach(l => { if (!byId.has(l.id)) byId.set(l.id, l); });
  return [...byId.values()];
}
