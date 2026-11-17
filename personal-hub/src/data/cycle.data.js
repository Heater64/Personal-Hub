/* ==========================================
   Personal Hub — Datos del módulo Menstruación
   Catálogos puros: sin DOM, sin Supabase. Los ids son estables y se
   guardan tal cual en la base de datos, así que no se renombran.
   ========================================== */

export const SYMPTOMS = [
  { id: 'colicos', label: 'Cólicos', emoji: '🌀' },
  { id: 'dolor-abdominal', label: 'Dolor abdominal', emoji: '😖' },
  { id: 'dolor-cabeza', label: 'Dolor de cabeza', emoji: '🤕' },
  { id: 'dolor-lumbar', label: 'Dolor lumbar', emoji: '🪑' },
  { id: 'cansancio', label: 'Cansancio', emoji: '😴' },
  { id: 'sensibilidad-mamaria', label: 'Sensibilidad mamaria', emoji: '💗' },
  { id: 'hinchazon', label: 'Hinchazón', emoji: '🎈' },
  { id: 'nauseas', label: 'Náuseas', emoji: '🤢' },
  { id: 'acne', label: 'Acné', emoji: '🫧' },
  { id: 'apetito', label: 'Cambios en el apetito', emoji: '🍫' },
  { id: 'otros', label: 'Otros síntomas', emoji: '✳️' },
];

export const MOODS = [
  { id: 'feliz', label: 'Feliz', emoji: '😊' },
  { id: 'tranquila', label: 'Tranquila', emoji: '🌿' },
  { id: 'normal', label: 'Normal', emoji: '🙂' },
  { id: 'triste', label: 'Triste', emoji: '😢' },
  { id: 'irritable', label: 'Irritable', emoji: '😤' },
  { id: 'estresada', label: 'Estresada', emoji: '😵' },
  { id: 'sensible', label: 'Sensible', emoji: '🥺' },
  { id: 'ansiosa', label: 'Ansiosa', emoji: '😰' },
];

export const FLOW_LEVELS = [
  { id: 'light', label: 'Ligero', level: 1 },
  { id: 'medium', label: 'Medio', level: 2 },
  { id: 'heavy', label: 'Abundante', level: 3 },
];

export const ENERGY_LEVELS = [
  { id: 'low', label: 'Baja', level: 1 },
  { id: 'normal', label: 'Normal', level: 2 },
  { id: 'high', label: 'Alta', level: 3 },
];

export const SLEEP_LABELS = {
  1: 'Muy mal',
  2: 'Mal',
  3: 'Normal',
  4: 'Bien',
  5: 'Muy bien',
};

/** Campos que se pueden compartir con la pareja. `id` = clave del snapshot. */
export const SHARE_FIELDS = [
  {
    id: 'next_period',
    label: 'Próxima menstruación estimada',
    hint: 'Fecha estimada y días restantes.',
  },
  { id: 'cycle_status', label: 'Estado actual del ciclo', hint: 'Menstruación, fértil, lútea…' },
  { id: 'cycle_day', label: 'Día del ciclo', hint: 'El número de día, sin fechas.' },
  {
    id: 'period',
    label: 'Menstruación registrada',
    hint: 'Los días de sangrado registrados y el flujo.',
  },
  { id: 'symptoms', label: 'Síntomas', hint: 'Lo que has marcado cada día.' },
  { id: 'notes', label: 'Notas personales', hint: 'Tus notas del registro diario.' },
  { id: 'stats', label: 'Estadísticas', hint: 'Duraciones medias y número de ciclos.' },
];

export const SHARE_FIELD_IDS = SHARE_FIELDS.map(field => field.id);

/** Mensajes de apoyo por defecto (la pareja los ve si ella los activa). */
export const SUPPORT_MESSAGES = [
  'Aquí estoy, sin prisa. Dime qué necesitas.',
  'Manta, agua caliente y una peli. ¿Te apetece?',
  'No tienes que poder con todo hoy.',
  'Te llevo algo rico. Solo dilo.',
  'Te quiero también los días de cólicos.',
];

export const EDUCATION = [
  {
    id: 'ciclo',
    title: 'Cómo funciona el ciclo menstrual',
    body: 'El ciclo va del primer día de una menstruación al primer día de la siguiente. Lo habitual está entre 21 y 35 días, pero cada cuerpo tiene su ritmo. Aquí se calcula con tus propios registros, no con una media general.',
  },
  {
    id: 'menstrual',
    title: 'Fase menstrual',
    body: 'Es el sangrado. Suele durar entre 3 y 7 días y puede acompañarse de cólicos, cansancio o dolor lumbar. No hace falta que todo sea igual cada mes.',
  },
  {
    id: 'folicular',
    title: 'Fase folicular',
    body: 'Va desde el final del sangrado hasta la ovulación. Los estrógenos suben y muchas personas notan más energía. Su duración es la que más varía de un ciclo a otro.',
  },
  {
    id: 'ovulacion',
    title: 'Qué significa la ovulación',
    body: 'Es la liberación de un óvulo, aproximadamente a mitad del ciclo. En estas estimaciones se calcula restando la fase lútea a la fecha prevista del siguiente periodo. No se puede confirmar con un calendario.',
  },
  {
    id: 'lutea',
    title: 'Fase lútea',
    body: 'Va de la ovulación al siguiente sangrado. Suele ser bastante estable (12-14 días), por eso se usa como referencia para estimar la ovulación. Es la fase en la que aparecen más síntomas premenstruales.',
  },
  {
    id: 'variaciones',
    title: 'Por qué pueden variar los ciclos',
    body: 'Estrés, cambios de sueño, viajes, enfermedad, peso o simplemente la edad. Variaciones de pocos días son normales. Si notas cambios bruscos y sostenidos, lo razonable es hablarlo con un profesional sanitario.',
  },
  {
    id: 'predicciones',
    title: 'Qué significan las predicciones',
    body: 'Son estimaciones calculadas con tus ciclos anteriores. Cuantos más registros, más se ajustan. Nunca son una certeza, no confirman la ovulación y no sirven como método anticonceptivo.',
  },
];

export function symptomById(id) {
  return SYMPTOMS.find(item => item.id === id) || { id, label: id, emoji: '✳️' };
}

/**
 * Nombre visible de un síntoma.
 * Los que escribe ella se guardan en el propio registro como `custom:<texto>`,
 * así que aquí se devuelve el texto tal cual, sin el prefijo.
 */
export function symptomLabel(id) {
  const key = String(id || '');
  if (key.startsWith('custom:')) return key.slice(7);
  return symptomById(key).label;
}

export function moodById(id) {
  return MOODS.find(item => item.id === id) || { id, label: id, emoji: '🙂' };
}

export function flowLabel(id) {
  return FLOW_LEVELS.find(item => item.id === id)?.label || '';
}

export function energyLabel(id) {
  return ENERGY_LEVELS.find(item => item.id === id)?.label || '';
}

export function sleepLabel(value) {
  return SLEEP_LABELS[Number(value)] || '';
}

/** Sanea una lista de ids contra un catálogo (descarta lo desconocido). */
export function sanitizeIds(values, catalog) {
  const allowed = new Set(catalog.map(item => item.id));
  return [...new Set((Array.isArray(values) ? values : []).filter(id => allowed.has(id)))];
}
