/* ==========================================
   Mundos — cómo se agrupan los módulos

   Los dos hubs (Rincón y Sentimientos) tenían una rejilla plana de tarjetas.
   Aquí se declara a qué mundo pertenece cada tarjeta que YA existe, para
   pintarlas agrupadas sin cambiar rutas, datos ni pantallas.

   Reglas:
   · Un mundo es una etiqueta, no una pantalla: no hay rutas nuevas.
   · Todo módulo conserva su tarjeta, su icono y su enlace de siempre.
   · Un módulo sin mundo asignado no desaparece: cae al grupo «Más».
   · Los mundos sin módulos no se pintan (nada de huecos vacíos).

   Si algún día se quiere mover una tarjeta de mundo, es una línea aquí.
   ========================================== */

/** Los siete mundos de la misión, en el orden en que se muestran. */
export const MUNDOS = Object.freeze([
  { id: 'recuerdos', label: 'Recuerdos', hint: 'Fotos, memes y lo que ya vivimos' },
  { id: 'sentimientos', label: 'Sentimientos', hint: 'Cómo estamos y qué nos hace bien' },
  { id: 'planes', label: 'Planes', hint: 'Fechas, cartas y cosas por venir' },
  { id: 'entretenimiento', label: 'Entretenimiento', hint: 'Juegos, series y música' },
  { id: 'bienestar', label: 'Bienestar', hint: 'El ciclo y el cuidado' },
  { id: 'vida', label: 'Vida cotidiana', hint: 'El día a día de los dos' },
  { id: 'creatividad', label: 'Creatividad', hint: 'Mundos e ideas propias' },
]);

/**
 * Módulo (id de tarjeta) → mundo.
 * Los ids son los que ya usan `SECTIONS` (Rincón) y `CARDS` (Sentimientos);
 * no se inventa ninguno: hay un test que lo comprueba.
 */
export const MUNDO_DE = Object.freeze({
  // Rincón
  'galeria-memes': 'recuerdos',
  curiosidades: 'recuerdos',
  juegos: 'entretenimiento',
  series: 'entretenimiento',
  canciones: 'entretenimiento',
  ositos: 'creatividad',
  // Sentimientos
  razones: 'sentimientos',
  maldia: 'sentimientos',
  calendario: 'planes',
  agenda: 'planes',
  sorpresas: 'planes',
  openwhen: 'planes',
  menstruacion: 'bienestar',
});

/** El mundo de una tarjeta, o null si aún no tiene. */
export function mundoDe(id) {
  return MUNDO_DE[id] || null;
}

/**
 * Agrupa tarjetas por mundo, en el orden de `MUNDOS`.
 * Devuelve [{ id, label, hint, items }] solo con los mundos que tienen algo.
 * Nunca pierde una tarjeta: las que no tienen mundo van al grupo final.
 */
export function agruparPorMundo(items) {
  const porMundo = new Map();
  const sueltos = [];

  for (const item of Array.isArray(items) ? items : []) {
    const mundo = mundoDe(item?.id);
    if (!mundo) {
      sueltos.push(item);
      continue;
    }
    if (!porMundo.has(mundo)) porMundo.set(mundo, []);
    porMundo.get(mundo).push(item);
  }

  const grupos = MUNDOS.filter(mundo => porMundo.has(mundo.id)).map(mundo => ({
    id: mundo.id,
    label: mundo.label,
    hint: mundo.hint,
    items: porMundo.get(mundo.id),
  }));

  if (sueltos.length) {
    grupos.push({ id: 'mas', label: 'Más', hint: '', items: sueltos });
  }

  return grupos;
}
