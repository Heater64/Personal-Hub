/* ==========================================
   Rincón — datos de fotos y portadas
   Fotos de Curiosidades (Wikimedia Commons CC/PD), degradados de portada
   para las tarjetas sin fotos reales y las proporciones del masonry.
   Todo dato puro: ni DOM ni estado.
   ========================================== */

export const MASONRY_RATIOS = ['4/3', '3/4', '1/1', '3/2', '2/3', '4/5', '5/4', '16/9', '9/16'];


/** Portada decorativa en SVG (degradado diagonal) para tarjetas sin fotos reales. */
export function gradientPoster(from, to) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* Fotos reales de las 3 secciones de Curiosidades (Commons CC/PD). */
const SPB_IMG = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Trinity_Bridge_at_night%2C_Saint_Petersburg%2C_Russia.jpg/960px-Trinity_Bridge_at_night%2C_Saint_Petersburg%2C_Russia.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Saint_Isaac%27s_Cathedral_Sept._2012_Interior.jpg/960px-Saint_Isaac%27s_Cathedral_Sept._2012_Interior.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Moyka_river_in_Saint_Petersburg_view_south_from_Pevchesky_bridge.jpg/960px-Moyka_river_in_Saint_Petersburg_view_south_from_Pevchesky_bridge.jpg'
];
const SPB_CAPTIONS = ['Puente de la Trinidad', 'Catedral de San Isaac', 'Río Moyka'];
const GATO_IMG = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Six_weeks_old_cat_%28aka%29.jpg/960px-Six_weeks_old_cat_%28aka%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/960px-Felis_catus-cat_on_snow.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Sleeping_cat_on_her_back.jpg/960px-Sleeping_cat_on_her_back.jpg'
];
const GATO_CAPTIONS = ['Un pequeño', 'Gato en la nieve', 'Gato durmiendo'];
export { SPB_IMG, SPB_CAPTIONS, GATO_IMG, GATO_CAPTIONS };
