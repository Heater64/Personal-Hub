/* ==========================================
   search.data.js — índice de la búsqueda global

   La búsqueda no inventa módulos: solo indexa lo que ya existe.
     · las 11 tarjetas de los dos hubs (con su mundo)
     · las rutas reales del registro, filtradas por rol

   Las tarjetas y las rutas comparten puerta: si una tarjeta ya lleva a una
   ruta, esa ruta no se repite como entrada aparte. Así buscar «juegos» no
   devuelve dos veces la misma pantalla.
   ========================================== */

import { ROUTES, roleFor, isVisibleTo } from '../routes.js';
import { MUNDOS, MUNDO_DE } from './mundos.data.js';

/**
 * Las tarjetas de Rincón y Sentimientos, con las palabras que la gente
 * escribiría para encontrarlas. `path` es la ruta real a la que llevan.
 */
export const SEARCH_CARDS = Object.freeze([
  {
    id: 'galeria-memes',
    label: 'Galería y Memes',
    path: '/galeria',
    keywords: 'fotos recuerdos album imagenes galeria memes humor',
  },
  {
    id: 'juegos',
    label: 'Juegos',
    path: '/juegos',
    keywords: 'jugar partidas snake buscaminas ahorcado retos',
  },
  {
    id: 'curiosidades',
    label: 'Curiosidades',
    path: '/curiosidades',
    keywords: 'datos lugares historia gatos animales comida',
  },
  {
    id: 'canciones',
    label: 'Canciones',
    path: '/canciones',
    keywords: 'musica playlist banda sonora canciones favoritas',
  },
  {
    id: 'series',
    label: 'Series',
    path: '/series',
    keywords: 'peliculas capitulos ver pendientes seguir viendo',
  },
  {
    id: 'ositos',
    label: 'OsitosWorld',
    path: '/ositos',
    keywords: 'personajes osos favoritos intro mundo',
  },
  {
    id: 'razones',
    label: 'Razones',
    path: '/razones',
    keywords: 'razones quererte amor detalles',
  },
  {
    id: 'openwhen',
    label: 'Open When',
    path: '/openwhen',
    keywords: 'cartas sobres abrir cuando escribir',
  },
  {
    id: 'calendario',
    label: 'Calendario',
    path: '/calendario',
    keywords: 'regalos sorpresas dias especiales planes fechas compartido',
  },
  {
    id: 'maldia',
    label: 'Mal Día',
    path: '/maldia',
    keywords: 'abrazo triste mal dia frases consuelo',
  },
  {
    id: 'sorpresas',
    label: 'Mis sorpresas',
    path: '/sorpresas',
    keywords: 'regalos sorpresas planes detalles abrir',
  },
  {
    id: 'menstruacion',
    label: 'Menstruación',
    path: '/menstruacion',
    keywords: 'ciclo regla periodo sintomas bienestar',
  },
]);

/** Palabras extra para las rutas que no son tarjeta de ningún hub. */
const ROUTE_KEYWORDS = {
  '/': 'inicio hoy casa dia portada',
  '/perfil': 'perfil cuenta ajustes avatar nombre',
  '/rincon': 'rincon descubrir todo lo bonito',
  '/memes': 'memes humor videos graciosos',
  '/audios': 'audios notas de voz grabaciones',
  '/minecraft': 'minecraft bloques construir',
  '/sentimientos': 'sentimientos animo estado de animo emociones',
  '/juntos': 'juntos aniversario dias contador',
  '/mapa': 'mapa distancia ubicacion donde esta',
  '/thoseeyes': 'those eyes ojos mirada fotos',
  '/justthewayyouare': 'just the way you are cancion dedicatoria',
  '/admin': 'panel peluche admin gestion',
};

/** Sin acentos, sin mayúsculas y sin signos: «Galería» = «galeria». */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const mundoLabel = id => MUNDOS.find(mundo => mundo.id === id)?.label || '';

/** Todo lo que se puede encontrar, según el rol de quien busca. */
export function modulos({ isAdmin = false } = {}) {
  const rol = roleFor(Boolean(isAdmin));
  const entradas = [];
  const rutasCubiertas = new Set();

  for (const card of SEARCH_CARDS) {
    entradas.push({
      id: card.id,
      label: card.label,
      path: card.path,
      world: mundoLabel(MUNDO_DE[card.id]),
      keywords: `${card.keywords} ${card.label}`,
    });
    rutasCubiertas.add(card.path);
  }

  for (const route of ROUTES) {
    if (route.public || route.path.includes(':')) continue;
    if (rutasCubiertas.has(route.path)) continue;
    if (!isVisibleTo(route.path, rol)) continue;
    entradas.push({
      id: route.path,
      label: route.label,
      path: route.path,
      world: '',
      keywords: `${ROUTE_KEYWORDS[route.path] || ''} ${route.label}`,
    });
  }

  return entradas;
}

function puntuar(entrada, query) {
  const label = normalizar(entrada.label);
  const keywords = normalizar(entrada.keywords);
  if (label === query) return 5;
  if (label.startsWith(query)) return 4;
  if (label.includes(query)) return 3;
  if (keywords.split(' ').some(palabra => palabra.startsWith(query))) return 2;
  if (keywords.includes(query)) return 1;
  return 0;
}

/**
 * Busca módulos. Sin texto devuelve las sugerencias de arranque (los dos
 * hubs primero, que es donde vive casi todo).
 */
export function buscarModulos(query, opciones = {}) {
  const q = normalizar(query);
  const todas = modulos(opciones);
  if (!q) return todas.slice(0, 8);

  return todas
    .map(entrada => ({ entrada, score: puntuar(entrada, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entrada.label.localeCompare(b.entrada.label, 'es'))
    .slice(0, 8)
    .map(({ entrada }) => entrada);
}
