/* ==========================================
   ACCIONES DE UN EVENTO IMPORTANTE

   Lo que la hoja de un evento ofrece como botones, definido por el admin:
   [{ label, route }]. El destino puede ser una pantalla de la app
   ('/calendario?day=…') o una web ('https://…'): cualquier otra cosa se
   descarta, aquí y al leer, para que un evento guardado a mano no pueda
   colar un esquema peligroso en un botón.

   Módulo puro (sin Supabase ni DOM): lo usan el guardado (db.service), la
   lectura (specialDates) y la hoja (SpecialEventSheet), y se prueba en Node.
   ========================================== */

/** Máximo de botones por evento: más de tres no se leen en la hoja. */
export const MAX_EVENT_ACTIONS = 3;

/** ¿El destino es una web de fuera? */
export function isExternalAction(route) {
  return /^https?:\/\//i.test(String(route || ''));
}

/** ¿Es un destino aceptable? Una ruta de la app o una web http(s). */
export function isActionRoute(route) {
  const value = String(route || '').trim();
  if (!value) return false;
  // '//' es una URL de otro origen disfrazada de ruta: fuera.
  if (value.startsWith('//')) return false;
  return value.startsWith('/') || isExternalAction(value);
}

/** Deja solo acciones con texto y destino válidos, en orden y sin repetir texto. */
export function cleanEventActions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const vistos = new Set();
  for (const action of list) {
    const label = String(action?.label || '').trim().slice(0, 30);
    const route = String(action?.route || '').trim().slice(0, 200);
    if (!label || !isActionRoute(route)) continue;
    const clave = label.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ label, route });
    if (out.length >= MAX_EVENT_ACTIONS) break;
  }
  return out;
}
