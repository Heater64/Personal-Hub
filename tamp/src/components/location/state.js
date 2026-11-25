/* ==========================================
   location/state.js — reglas puras del módulo de ubicación.

   Nada de DOM ni de red: así la tarjeta, el mapa y los ajustes cuentan
   exactamente lo mismo y estas reglas se pueden razonar (y probar) aparte.
   ========================================== */

/**
 * Radios de un toque. Cualquier otro valor entre 10 m y 1 km se escribe a
 * mano con «Personalizado» (es el rango que admite `couple_places`).
 */
export const RADIUS_OPTIONS = [10, 20, 50, 75, 150, 500, 1000];
export const RADIUS_MIN = 10;
export const RADIUS_MAX = 1000;

/** Redondea y deja el radio dentro de lo que acepta la base de datos. */
export function clampRadius(value) {
  const meters = Math.round(Number(value));
  if (!Number.isFinite(meters)) return 150;
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, meters));
}

export function radiusLabel(meters) {
  return meters >= 1000 ? '1 km' : `${meters} m`;
}

/* ==========================================
   Estado de un móvil
   ==========================================
   Orden de prioridad: primero lo que la persona ha decidido (no compartir,
   pausa por batería, GPS apagado) y solo después la antigüedad del dato.

   Una ubicación vieja NUNCA se traduce en «sin conexión»: puede llevar el
   móvil en el bolsillo con la app cerrada y seguir compartiendo cada cinco
   minutos. Por eso `stale` es «desactualizada», no «offline».
   ========================================== */

export const DEVICE_STATE = {
  live: { label: 'Ubicación actualizada', tone: 'ok' },
  stale: { label: 'Ubicación desactualizada', tone: 'warn' },
  paused: { label: 'Ubicación en pausa', tone: 'warn' },
  'location-off': { label: 'Ubicación desactivada', tone: 'warn' },
  permission: { label: 'Permisos insuficientes', tone: 'danger' },
  'not-sharing': { label: 'No comparte su ubicación', tone: 'muted' },
  missing: { label: 'Información no disponible', tone: 'muted' },
};

/**
 * @param {object|null} person  posición normalizada (location.service)
 * @param {{stale?: boolean}} flags
 * @returns {{key: string, label: string, tone: string, hint: string}}
 */
export function deviceState(person, { stale = false } = {}) {
  const state = key => ({ key, ...DEVICE_STATE[key] });
  if (!person) return { ...state('missing'), hint: 'Todavía no ha compartido su posición.' };
  if (person.sharing === false) {
    return { ...state('not-sharing'), hint: 'Lo ha desactivado en sus ajustes.' };
  }
  if (person.batteryPaused) {
    return { ...state('paused'), hint: 'Batería baja: se reanuda sola al cargar un poco.' };
  }
  // El GPS del sistema apagado no es un permiso denegado: es una decisión
  // del móvil, y se puede volver a encender desde sus ajustes.
  if (person.locationServices === 'disabled') {
    return { ...state('location-off'), hint: 'La ubicación del sistema está apagada.' };
  }
  if (!Number.isFinite(person.lat) || !Number.isFinite(person.lng)) {
    return { ...state('missing'), hint: 'Su móvil no ha enviado una posición todavía.' };
  }
  if (stale) {
    return { ...state('stale'), hint: 'Esta es la última posición conocida.' };
  }
  return { ...state('live'), hint: 'Ahora mismo.' };
}

/** Batería: número, color y texto de carga. */
export function batteryInfo(person) {
  if (!Number.isFinite(person?.battery)) return null;
  const level = Math.max(0, Math.min(100, Math.round(person.battery)));
  return {
    level,
    tone: level <= 15 ? 'low' : level <= 40 ? 'mid' : 'ok',
    charging: person.charging === true,
    text: person.charging === true ? 'Cargando' : 'Con batería',
  };
}

/* ==========================================
   Lugares
   ========================================== */

const PLACE_ICON_RULES = [
  [/(casa|hogar|home|piso|departamento)/i, 'home'],
  [/(trabajo|oficina|curro|cole|insti|universidad)/i, 'book'],
  [/(gym|gimnasio|deporte|parque|correr)/i, 'run'],
  [/(caf[eé]|bar|restaurante|cena|comida)/i, 'coffee'],
  [/(compra|super|mercado|tienda)/i, 'cart'],
  [/(playa|mar|piscina|agua)/i, 'water'],
  [/(cine|museo|teatro|plan)/i, 'star'],
  [/(amor|nuestro|especial|aniversario)/i, 'heart'],
  [/(veterinario|mascota|perro|gato)/i, 'paw'],
];

/** Iconos que se pueden elegir para un lugar. */
export const PLACE_ICONS = ['pin', 'home', 'heart', 'coffee', 'cart', 'book', 'run', 'water', 'star', 'paw'];

/** Icono representativo: el elegido por la persona o uno deducido del nombre. */
export function placeIcon(name, chosen) {
  if (chosen && PLACE_ICONS.includes(chosen)) return chosen;
  const text = String(name || '');
  const rule = PLACE_ICON_RULES.find(([pattern]) => pattern.test(text));
  return rule ? rule[1] : 'pin';
}
