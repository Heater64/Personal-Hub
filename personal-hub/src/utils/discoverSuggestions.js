/**
 * Selecciona sugerencias para el carrusel sin repetir el destino al que llevan.
 * La fuente puede contener varias piezas de contenido para una misma sección
 * (por ejemplo, una foto y una colección de memes de Galería).
 */
export function selectDistinctSuggestions(options, limit = 3, random = Math.random) {
  const pool = Array.isArray(options) ? [...options] : [];
  const selected = [];
  const destinations = new Set();

  while (pool.length && selected.length < limit) {
    const sample = Number(random());
    const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999) : 0;
    const index = Math.floor(normalized * pool.length);
    const [item] = pool.splice(index, 1);
    const destination = item?.sectionId ? `section:${item.sectionId}` : `route:${item?.route || item?.title || ''}`;

    if (!destination || destinations.has(destination)) continue;
    destinations.add(destination);
    selected.push(item);
  }

  return selected;
}
