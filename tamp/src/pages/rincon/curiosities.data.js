/* ==========================================
   Rincón — catálogos de Curiosidades
   Las tres colecciones (San Juan Pueblo, San Petersburgo y la Enciclopedia
   Gatuna) y los chips de filtro del buscador. Son dato puro: dependen de
   rincon-data.js y no tocan el DOM.
   ========================================== */

import { SPB_DATA, CURIOSIDADES_DATA } from '../../services/rincon-data.js';

/** Las tres secciones de la enciclopedia, con su icono y su color. */
export const CATEGORIES = [
  {
    id: 'spb',
    emoji: '🏔️',
    iconKey: 'mountain',
    title: 'San Juan Pueblo',
    desc: 'La historia, cultura y tradiciones de un lugar especial.',
    accentColor: 'var(--theme-accent-primary)',
    heroImg: (SPB_DATA?.galeriaSPB?.[0]?.src || ''),
    statsCount: (SPB_DATA?.quickStats?.length || 0) + (SPB_DATA?.curiosidades?.length || 0) + (SPB_DATA?.comidas?.length || 0)
  },
  {
    id: 'sp',
    emoji: '🚢',
    iconKey: 'ship',
    title: 'San Petersburgo',
    desc: 'La ciudad de los puentes, los palacios y las noches blancas.',
    accentColor: '#818cf8',
    heroImg: '',
    statsCount: (CURIOSIDADES_DATA.sanPetersburgo?.quickStats?.length || 0) + (CURIOSIDADES_DATA.sanPetersburgo?.datos?.length || 0)
  },
  {
    id: 'gatos',
    emoji: '🐱',
    iconKey: 'cat',
    title: 'Enciclopedia Gatuna',
    desc: 'Anatomía, superpoderes y curiosidades de uno de los animales más fascinantes.',
    accentColor: '#f59e0b',
    heroImg: '',
    statsCount: (CURIOSIDADES_DATA.gatos?.quickStats?.length || 0) + (CURIOSIDADES_DATA.gatos?.datos?.length || 0)
  }
];

/** Chips de categoría (con icono SVG, sin emojis). */
export const DISCO_CATEGORIES = [
  { id: 'todas', label: 'Todas', icon: 'sparkles', match: [] },
  { id: 'lugares', label: 'Lugares', icon: 'globe', match: ['honduras', 'atlántida', 'pueblo', 'río', 'rusia', 'ciudad', 'imperial', 'puentes'] },
  { id: 'historia', label: 'Historia', icon: 'landmark', match: ['historia', 'cronología', 'fundación', 'pirámides', 'muralla', 'antigüedad'] },
  { id: 'comida', label: 'Comida', icon: 'utensils-crossed', match: ['comida', 'gastronomía', 'gastronómico', 'chocolate', 'vainilla', 'cacao'] },
  { id: 'animales', label: 'Animales', icon: 'paw', match: ['felino', 'mascota', 'animal', 'tortugas', 'pulpos', 'mar', 'biología'] },
  { id: 'datos', label: 'Datos curiosos', icon: 'lightbulb', match: ['estadística', 'dato', 'curiosidad', 'espacio', 'astronautas'] },
  { id: 'ciencia', label: 'Ciencia', icon: 'flask', match: ['ciencia', 'aurora', 'física'] },
  { id: 'cultura', label: 'Cultura', icon: 'leaf', match: ['cultura', 'tradiciones', 'tolupán'] }
];

/** Etiqueta legible para cada categoría de CURIOSIDADES_EXTRA. */
export const EXTRA_CAT_LABELS = {
  historia: 'Historia', comida: 'Comida', animales: 'Animales',
  ciencia: 'Ciencia', datos: 'Datos curiosos', lugares: 'Lugares', cultura: 'Cultura'
};

/** Meses en castellano, para agrupar los audios por fecha. */
export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/** Alias histórico: el módulo de audios lo llama así. */
export const AUDIO_MONTHS = MONTHS;