/* ==========================================
   Personal Hub v2 — Rincón Page
   Landing: Hero + Descubre hoy + Living cards
   Sub-pages: Galería+Memes, Curiosidades (preserved)
   External: Juegos, Canciones, ThoseEyes, Series
   ========================================== */

import { GALLERY_FOLDERS, MEME_FOLDERS, SPB_DATA, CURIOSIDADES_DATA, isVideo, buildMediaItems, getVideoPoster } from '../services/rincon-data.js';
import { loadGiftsCatalog, getGiftsCatalog, unlockedCalendarVideos } from '../services/gifts.service.js';
import { createLightbox, openLightbox, playSlideshow, pauseSlideshow } from '../components/MediaLightbox.js';
import { db } from '../services/db.service.js';
import { uploadFile } from '../services/cloudinary.service.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { getContinueWatching, getCatalogSync } from '../services/seriesData.js';
import { startPosterRotation } from '../utils/posterRotator.js';
import { player } from '../services/player.service.js';
import { getAllSongs } from './Canciones.js';
import { GAMES } from './Juegos.js';
import { gameCover } from '../utils/gameCovers.js';
import {
  baseFolders, basePhotos, userPhotos, addUserPhotos,
  visiblePhotos, hiddenPhotos, hidePhoto, loadFavPhotos, saveFavPhotos, toggleFavPhoto,
  albumMeta, saveAlbumMeta, knownRatio, rememberRatio, photoDate, photoTs, albumYear
} from '../services/galleryData.js';
import {
  memeAlbums, memeItems, addMemesToAlbum, hideMeme, memePoster,
  albumMeta as memeMeta, saveAlbumMeta as saveMemeMeta, albumCover as memeAlbumCover,
  createMemeAlbum, renameMemeAlbum, deleteMemeAlbum,
  loadMemeFavs, saveMemeFavs, toggleMemeFav, albumSummary, libraryStats
} from '../services/memesData.js';
import { userStore } from '../stores/user.store.js';
import { onContentChange } from '../services/realtime.service.js';

// ==========================================
// STATE
// ==========================================
const state = {
  view: 'landing',
  galeriaFolder: Object.keys(GALLERY_FOLDERS)[0] || 'Atardeceres',
  galeriaFilter: 'todas',      // todas | favoritas | <carpeta>
  galeriaSort: 'recientes',    // recientes | antiguas
  galeriaUploads: [],          // fotos subidas por el usuario
  galeriaFavs: new Set(),      // URLs favoritas
  galleryToken: 0,             // token de render para batch
  calSynced: false,            // vídeos del calendario ya sincronizados en la galería
  memeView: 'albums',       // albums | album
  memeAlbumId: null,        // álbum abierto
  memeFilter: 'todos',      // todos | fotos | videos
  memeSort: 'recientes',    // recientes | antiguos | nombre
  memeQuery: '',            // búsqueda
  memeFavs: new Set(),      // URLs favoritas de memes
  renderToken: 0,
  curiosidadTab: 'landing',
  discoCat: 'todas',           // chip de categoría activo
  editMode: false,             // edición de portadas de tarjetas (solo admin)
  covers: {},                  // portadas personalizadas por tarjeta
  audios: [],                  // lista de audios del Rincón (día 3)
  audiosLoaded: false,         // carga inicial hecha
  audiosView: 'months',        // months | detail
  audiosMonth: null            // { year, month } abierto en detalle
};

const MASONRY_RATIOS = ['4/3', '3/4', '1/1', '3/2', '2/3', '4/5', '5/4', '16/9', '9/16'];

const START_DATE = '2025-07-03';

/** Portada decorativa en SVG (degradado diagonal) para tarjetas sin fotos reales. */
function gradientPoster(from, to) {
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

// ==========================================
// LIVING SECTION CARDS — rich content previews
// ==========================================
const SECTIONS = [
  {
    id: 'galeria-memes',
    icon: 'image',
    emoji: '🖼️',
    title: 'Galería y Memes',
    desc: 'Cada fotografía guarda un recuerdo. Y cada meme, una sonrisa.',
    internal: true,
    previewType: 'gallery',
    getPreview() {
      // Fotos del álbum + miniaturas de memes (los vídeos usan su póster),
      // mezcladas y rotando cada 10s como las demás tarjetas.
      const photos = Object.values(GALLERY_FOLDERS || {})
        .flat().map(u => isVideo(u) ? getVideoPoster(u) : u).filter(Boolean);
      const memes = Object.values(MEME_FOLDERS || {})
        .flat().map(u => isVideo(u) ? getVideoPoster(u) : u).filter(Boolean);
      const pool = [
        ...photos.sort(() => Math.random() - 0.5).slice(0, 6),
        ...memes.sort(() => Math.random() - 0.5).slice(0, 6)
      ].sort(() => Math.random() - 0.5);
      return {
        cover: pool[0] || '',
        posters: pool,
        stats: `${photos.length} recuerdos · ${memes.length} memes`
      };
    }
  },
  {
    id: 'juegos',
    icon: 'gamepad-2',
    emoji: '🎮',
    title: 'Juegos',
    desc: 'Snake, Buscaminas, Ahorcado… pequeños retos para disfrutar.',
    href: '/juegos',
    // Portada digital de cada juego (arte SVG propio)
    getPreview() {
      const posters = GAMES.map(g => gameCover(g.id, g.color, g.accent));
      return {
        cover: posters[Math.floor(Math.random() * posters.length)] || '',
        posters: [...posters].sort(() => Math.random() - 0.5)
      };
    }
  },
  {
    id: 'curiosidades',
    icon: 'globe',
    emoji: '💡',
    title: 'Curiosidades',
    desc: 'Siempre hay algo nuevo por descubrir.',
    dataHint: (SPB_DATA?.quickStats?.[0]?.label || 'Río San Juan') + ': ' + (SPB_DATA?.quickStats?.[0]?.sub || ''),
    internal: true,
    // Fotos reales de las 3 secciones: San Juan Pueblo, San Petersburgo y Gatos
    getPreview() {
      const photos = (SPB_DATA?.galeriaSPB || []).map(p => p.src).filter(Boolean);
      const posters = [...photos, ...SPB_IMG, ...GATO_IMG];
      return {
        cover: posters[Math.floor(Math.random() * posters.length)] || '',
        posters: [...posters].sort(() => Math.random() - 0.5)
      };
    }
  },
  {
    id: 'canciones',
    icon: 'music',
    emoji: '🎵',
    title: 'Canciones',
    desc: 'La banda sonora de muchos momentos juntos.',
    href: '/canciones',
    // Portadas de canciones al azar; si hay una sonando, se queda con esa.
    getPreview() {
      const covers = [...new Set(getAllSongs().map(s => s.cover).filter(Boolean))];
      const now = player.info?.cover || null;
      return {
        cover: now || covers[Math.floor(Math.random() * covers.length)] || '',
        posters: now ? [now] : [...covers].sort(() => Math.random() - 0.5),
        locked: now ? player.info : null,
        stats: now ? '♪ Sonando ahora' : ''
      };
    }
  },
  {
    id: 'thoseeyes',
    icon: 'music-2',
    emoji: '👀',
    title: 'Those Eyes',
    desc: 'Esa canción que es simplemente especial.',
    href: '/thoseeyes'
  },
  {
    id: 'series',
    icon: 'tv',
    emoji: '🎬',
    title: 'Series',
    desc: 'Historias que disfrutamos juntos.',
    href: '/series',
    // Dentro de esta tarjeta se muestran las portadas: los títulos en
    // "Seguir viendo" si hay progreso, o títulos aleatorios si no.
    getPreview() {
      const cont = getContinueWatching();
      const pool = cont.length
        ? cont.slice(0, 4)
        : [...getCatalogSync()].sort(() => Math.random() - 0.5).map(item => ({ item })).slice(0, 4);
      const posters = pool.map(c => c.item.portada).filter(Boolean);
      return {
        cover: posters[0] || '',
        posters,
        stats: cont.length ? '▶ Seguir viendo' : '',
        continueList: cont
      };
    }
  }
];

// ==========================================
// ICON SVGs
// ==========================================
const ICON_SVGS = {
  'image': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  'gamepad-2': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>',
  'globe': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  'music': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  'eye': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  'tv': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  'crown': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M2 20h20"/></svg>',
  'chevron-right': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  'chevron-left': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
  'star': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  'heart': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  'music-2': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>',
  'smile': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  'sparkles': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"/><path d="M8 8a5 5 0 0 0 5 5 5 5 0 0 0-5 5 5 5 0 0 0-5-5 5 5 0 0 0 5-5Z"/></svg>',
  'play': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  'eye-open': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  'landmark': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  'ship': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.38 11.38 0 0 0 21 12l-8.19-2.47a2.38 2.38 0 0 0-1.62 0L3 12a11.38 11.38 0 0 0 1.62 8M12 2v10"/></svg>',
  'cat': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-6.56c0-1.2.43-2.37 1-3.44 0 0-1.82-6.42-.42-7 1.4-.58 4.64.26 6.42 2.26.65-.17 1.33-.26 2-.26z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75z"/></svg>',
  'mountain': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
  'calendar-days': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  'users': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  'wind': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>',
  'flame': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22c4.4 0 8-3.6 8-8 0-2-.8-3.5-2-5 .2 1.5-.4 2.5-1.5 3C17 9 16 5.5 12 2c0 4-2 5.5-3.5 6.5C6.5 9.5 4 11 4 14c0 4.4 3.6 8 8 8z"/><path d="M12 22c-1.5 0-2.5-1-2.5-2.5S12 17 12 17s2.5 1 2.5 2.5S13.5 22 12 22z"/></svg>',
  'train': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="14" rx="4"/><path d="M4 11h16"/><path d="M8 21l-2 2"/><path d="M16 21l2 2"/><circle cx="8.5" cy="7" r="1" fill="currentColor"/><circle cx="15.5" cy="7" r="1" fill="currentColor"/></svg>',
  'snowflake': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20"/><path d="m4.9 5.5 14.2 13"/><path d="m19.1 5.5-14.2 13"/><path d="M12 6l3 3"/><path d="M12 18l-3-3"/><path d="m6 12 3-3"/><path d="m18 12-3 3"/></svg>',
  'moon': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  'ear': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8.5a6 6 0 0 1 12 0c0 3-2 4-3 5.5s-.5 3.5-1 5-1.5 1.5-2 0-1-3-1-3"/><path d="M9 8.5a3 3 0 0 1 6 0"/></svg>',
  'tooth': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5.5c-1-1.5-2.5-2-4-2S4.5 4.5 4.5 7c0 1.5 1 2.5 1.5 4s.5 4 0 6-1 4.5-2 5c1 .5 2 .5 3 0s1.5-3.5 2.5-5 2-2.5 2.5-2.5.5 1.5 2.5 2.5 2 4.5 3 5 2 .5 3 0c-1-.5-1.5-2.5-2-5s.5-4.5 0-6 1.5-2.5 1.5-4c0-2.5-1.5-3.5-3.5-3.5S13 4 12 5.5z"/></svg>',
  'footprints': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v-3c0-1.5 1-2.5 2.5-2.5S9 11.5 9 13v3"/><path d="M4 16c0 .8.7 1.5 1.5 1.5S7 16.8 7 16"/><path d="M9 16c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5"/><path d="M15 16v-3c0-1.5 1-2.5 2.5-2.5S20 11.5 20 13v3"/><path d="M15 16c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5"/><path d="M20 16c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5"/></svg>',
  'baby': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.5 1.3.8 2 .8s1.5-.3 2-.8"/><path d="M12 2a2 2 0 0 1 2 2c.5 1 1.5 1.5 2.5 2.5C17.5 8 18 9 18 10.5c0 2-1.5 4-4.5 4.5-2.5.4-5-1-5.5-3.5C7.6 9.5 8.5 8 9.5 7.5 10.5 7 11 6.5 11.5 6c.5-1 0-2 0-2a2 2 0 0 1 .5-2z"/></svg>',
  'zap': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  'map-pin': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  'history': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  'utensils-crossed': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 2v10.5M18 2v10.5M3 5.5C3 3.57 4.57 2 6.5 2S10 3.57 10 5.5V8H3V5.5z"/><path d="M3 12h14v2c0 2.21-1.79 4-4 4H7c-2.21 0-4-1.79-4-4v-2z"/></svg>',
  'camera': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  'message-square': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  'palette': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.82.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z"/></svg>',
  'sun': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  'soccer-ball': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><path d="m7 5 8 14"/><path d="m17 5-8 14"/><path d="m5 7 14 10"/><path d="m5 17 14-10"/></svg>',
  'arrow-right': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  'mic': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  'lock': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  'volume': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  'pause': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
};

// ==========================================
// MAIN PAGE
// ==========================================
export function RinconPage(router) {
  createLightbox();
  const page = document.createElement('div');
  page.className = 'rincon-page';

  state.view = 'landing';
  state.curiosidadTab = 'spb';
  // Cargar favoritas persistentes del usuario (user-scoped)
  state.galeriaFavs = loadFavPhotos();
  state.memeFavs = loadMemeFavs();
  const isAdmin = userStore.isAdmin;

  // Rotación de portadas de las tarjetas (Series, Canciones, Juegos, Curiosidades).
  // Se detiene al re-render o al salir de la página.
  let cardRotations = new Map();
  let offPlayerCard = () => {};
  const stopAllRotations = () => {
    cardRotations.forEach(stop => { try { stop(); } catch { /* no-op */ } });
    cardRotations.clear();
  };

  // Deep-link desde el Inicio (p. ej. /rincon?tab=memes o ?tab=curiosidades)
  if (router?.currentRoute?.query?.tab === 'memes') {
    state.view = 'memes';
  } else if (router?.currentRoute?.query?.tab === 'curiosidades') {
    state.view = 'curiosidades';
    state.curiosidadTab = 'landing';
  }

  function render() {
    switch (state.view) {
      case 'galeria-memes':
      case 'memes':
      case 'audios': renderGaleriaMemes(); break;
      case 'curiosidades': renderCuriosidades(); break;
      default: renderLanding();
    }
  }

  // ==========================================
  // HELPER: generate a random "Descubre hoy" item
  // ==========================================
  function getDescubreHoy() {
    const options = [];
    // A random gallery photo
    const photos = GALLERY_FOLDERS?.['Atardeceres'] || [];
    if (photos.length) {
      options.push({
        type: 'gallery',
        title: 'Un atardecer para ti',
        desc: 'Cada atardecer guarda un momento especial.',
        cover: photos[Math.floor(Math.random() * photos.length)],
        action: 'Ver galería',
        route: null, // internal -> sub-page switch
        internal: true,
        sectionId: 'galeria-memes'
      });
    }
    // A random meme collection
    const memeFolders = Object.keys(MEME_FOLDERS || {});
    if (memeFolders.length) {
      const f = memeFolders[Math.floor(Math.random() * memeFolders.length)];
      const urls = MEME_FOLDERS[f] || [];
      const preview = urls.length ? urls[Math.floor(Math.random() * urls.length)] : '';
      options.push({
        type: 'meme',
        title: `Colección: ${f}`,
        desc: `${urls.length} memes que siempre sacan una sonrisa.`,
        cover: isVideo(preview) ? getVideoPoster(preview) : preview,
        action: 'Ver colección',
        route: null,
        internal: true,
        sectionId: 'galeria-memes'
      });
    }
    // Curiosity
    if (SPB_DATA?.quickStats?.length) {
      const s = SPB_DATA.quickStats[Math.floor(Math.random() * SPB_DATA.quickStats.length)];
      options.push({
        type: 'curiosity',
        title: s.label,
        desc: s.sub,
        icon: ICON_SVGS[s.icon] || '✦',
        action: 'Descubrir más',
        route: null,
        internal: true,
        sectionId: 'curiosidades'
      });
    }
    // External sections
    const externals = [
      { id: 'juegos', title: 'Juegos', desc: 'Snake, Buscaminas, Ahorcado… ¿cuál probarás hoy?', emoji: '🎮', route: '/juegos' },
      { id: 'canciones', title: 'Canciones', desc: 'La banda sonora de momentos inolvidables.', emoji: '🎵', route: '/canciones' },
      { id: 'thoseeyes', title: 'Those Eyes', desc: 'Una experiencia inmersiva con nuestra canción.', emoji: '👀', route: '/thoseeyes' },
      { id: 'series', title: 'Series', desc: 'Tu tracker personal de series y películas.', emoji: '🎬', route: '/series' }
    ];
    options.push(...externals.map(e => ({ ...e, type: 'external', action: 'Entrar', internal: false })));

    return options[Math.floor(Math.random() * options.length)];
  }

  // ==========================================
  // 1. LANDING — Immersive, warm experience
  // ==========================================
  function renderLanding() {
    const daysSince = Math.floor((Date.now() - new Date(START_DATE).getTime()) / 86400000);
    const bgPhotos = GALLERY_FOLDERS?.['Atardeceres'] || [];
    const bgImage = bgPhotos.length ? bgPhotos[Math.floor(Math.random() * bgPhotos.length)] : '';
    const descubrir = getDescubreHoy();

    // Pre-compute section previews
    const sectionPreviews = SECTIONS.map(s => {
      if (s.getPreview) return s.getPreview();
      return {};
    });
    // Detén la rotación de portadas y la suscripción al reproductor del render anterior
    stopAllRotations();
    offPlayerCard();

    page.innerHTML = `
      <!-- ===== HERO ===== -->
      <header class="rincon-hero-v2">
        ${bgImage ? `<div class="rincon-hero-bg"><img src="${bgImage}" alt="" loading="eager"></div>` : ''}
        <div class="rincon-hero-overlay"></div>
        <div class="rincon-hero-body">
          <div class="rincon-hero-crown">${ICON_SVGS['crown']}</div>
          <h1 class="rincon-hero-title">Tu rincón favorito 🤍</h1>
          <p class="rincon-hero-sub">Donde cada día eres especial</p>
          <div class="rincon-hero-counter">
            ${ICON_SVGS['heart']}
            <span>${daysSince} días juntos</span>
          </div>
          <div class="rincon-hero-sparkles">🌸🐱</div>
        </div>
      </header>

      <!-- ===== DESCUBRE HOY ===== -->
      <section class="rincon-featured card" id="rinconFeatured" role="button" tabindex="0" aria-label="Descubre hoy: ${descubrir.title}">
        ${renderFeaturedCard(descubrir)}
      </section>

      <!-- ===== SECTION CARDS ===== -->
      <div class="rincon-section-header">
        <span class="rincon-section-chip">${ICON_SVGS['sparkles']}</span>
        <h2 class="rincon-section-title">Explora el Rincón</h2>
        <span class="rincon-section-line"></span>
        ${isAdmin ? `<button type="button" class="rincon-edit-toggle${state.editMode ? ' is-active' : ''}" id="rinconEditToggle" aria-pressed="${state.editMode}">${state.editMode ? '✓ Listo' : 'Editar portadas'}</button>` : ''}
      </div>
      <section class="rincon-cards-grid">
        ${SECTIONS.map((s, i) => renderSectionCard(s, i, sectionPreviews[i])).join('')}
      </section>
    `;

    // Animate section cards (staggered entrance)
    requestAnimationFrame(() => {
      page.querySelectorAll('.rincon-section-card-v2.animate-in').forEach(el => el.classList.add('visible'));
    });

    // Bind featured card click + keyboard
    const featuredCard = page.querySelector('#rinconFeatured');
    if (featuredCard) {
      const handleFeatured = () => {
        if (descubrir.internal && descubrir.sectionId) {
          state.view = descubrir.sectionId;
          if (descubrir.sectionId === 'curiosidades') state.curiosidadTab = 'landing';
          render();
        } else if (descubrir.route) {
          router.navigate(descubrir.route);
        }
      };
      featuredCard.addEventListener('click', handleFeatured);
      featuredCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFeatured(); }
      });
    }

    // Bind section card clicks (clic + teclado) y modo edición de portadas
    page.querySelectorAll('.rincon-section-card-v2').forEach(card => {
      const handler = () => {
        const id = card.dataset.section;
        const section = SECTIONS.find(s => s.id === id);
        // Tarjetas extra (Seguir viendo): navegan directo a su href
        if (!section) {
          const href = card.dataset.href;
          if (href && !state.editMode) router.navigate(href);
          return;
        }
        if (state.editMode) { openCoverEditor(id); return; }
        if (section.internal) {
          state.view = id;
          if (id === 'curiosidades') state.curiosidadTab = 'landing';
          render();
        } else if (section.href) {
          router.navigate(section.href);
        }
      };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
      });
    });

    // Botón 📷 de cada tarjeta (solo en modo edición)
    page.querySelectorAll('.rincon-card-edit').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openCoverEditor(btn.dataset.editCover); });
    });

    // Toggle "Editar portadas" (solo admin)
    const editToggle = page.querySelector('#rinconEditToggle');
    if (editToggle) editToggle.addEventListener('click', () => { state.editMode = !state.editMode; render(); });

    // ── Rotación de portadas dentro de las tarjetas (10s, fade suave) ──
    // Canciones/Series/Juegos/Curiosidades muestran portadas. Con "Seguir
    // viendo" o una canción sonando, la portada se queda en lo actual.
    const applySeriesText = (card, c) => {
      const t = card.querySelector('.rincon-card-title');
      const d = card.querySelector('.rincon-card-desc');
      if (t) t.textContent = c.item.titulo;
      if (d) d.textContent = `Ep. ${c.watched} de ${c.total} · ${c.percent}%`;
    };
    const applySongText = (card, info) => {
      const t = card.querySelector('.rincon-card-title');
      const d = card.querySelector('.rincon-card-desc');
      if (t) t.textContent = info.title || 'Canciones';
      if (d) d.textContent = info.artist || 'La banda sonora de muchos momentos juntos.';
    };
    const SONG_DESC = 'La banda sonora de muchos momentos juntos.';

    SECTIONS.map((s, i) => ({ section: s, preview: sectionPreviews[i] }))
      .filter(x => x.preview?.posters?.length)
      .forEach(({ section, preview }) => {
        const el = page.querySelector(`.rincon-section-card-v2[data-section="${section.id}"]`);
        if (!el) return;
        const locked = preview.locked || preview.continueList?.[0] || null;
        if (preview.posters.length > 1) {
          cardRotations.set(section.id, startPosterRotation(el, preview.posters, {
            onChange: (i) => {
              if (section.id === 'series') {
                const cont = preview.continueList || [];
                const c = cont.length ? cont[i % cont.length] : null;
                if (c) applySeriesText(el, c);
              }
            }
          }));
        }
        // Estado inicial fijado: título en curso (Series) o canción sonando (Canciones)
        if (section.id === 'series' && locked) applySeriesText(el, locked);
        if (section.id === 'canciones' && locked) applySongText(el, locked);
      });

    // Cambios en el reproductor: si empieza/cambia una canción, la tarjeta de
    // Canciones se queda con su portada; si se cierra (info → null), vuelve a rotar.
    offPlayerCard = player.subscribe((e) => {
      if (e.type !== 'change') return;
      const card = page.querySelector('.rincon-section-card-v2[data-section="canciones"]');
      const img = card?.querySelector('img.sr-rotating-poster');
      if (!card || !img) return;
      const cover = e.info?.cover;
      if (cover) {
        // Canción nueva: detén la rotación y quédate con su portada
        const stop = cardRotations.get('canciones');
        if (stop) { stop(); cardRotations.delete('canciones'); }
        img.style.transition = 'none';
        img.src = cover;
        applySongText(card, e.info);
        if (!card.querySelector('.rincon-card-stats')) {
          const body = card.querySelector('.rincon-card-body');
          if (body) {
            const chip = document.createElement('span');
            chip.className = 'rincon-card-stats';
            chip.textContent = '♪ Sonando ahora';
            body.appendChild(chip);
          }
        }
      } else if (e.info === null) {
        // Canción cerrada: vuelve a rotar portadas al azar
        const covers = [...new Set(getAllSongs().map(s => s.cover).filter(Boolean))];
        const shuffled = [...covers].sort(() => Math.random() - 0.5);
        if (shuffled.length > 1) {
          img.style.transition = 'none';
          img.src = shuffled[0]; // muestra una portada al azar de inmediato
          cardRotations.set('canciones', startPosterRotation(card, shuffled));
        }
        const t = card.querySelector('.rincon-card-title');
        const d = card.querySelector('.rincon-card-desc');
        const st = card.querySelector('.rincon-card-stats');
        if (t) t.textContent = 'Canciones';
        if (d) d.textContent = SONG_DESC;
        if (st) st.remove();
      }
    });
  }

  function renderFeaturedCard(item) {
    const cover = item.cover || '';
    const icon = item.emoji || item.icon || '✨';
    return `
      <div class="rincon-featured-label">Descubre hoy</div>
      <div class="rincon-featured-card">
        <div class="rincon-featured-visual">
          ${cover
            ? `<img src="${cover}" alt="" class="rincon-featured-img" loading="eager">`
            : `<div class="rincon-featured-icon">${icon}</div>`
          }
        </div>
        <div class="rincon-featured-info">
          <h3 class="rincon-featured-title">${item.title}</h3>
          <p class="rincon-featured-desc">${item.desc}</p>
          <span class="rincon-featured-action">
            ${item.action} ${ICON_SVGS['arrow-right']}
          </span>
        </div>
      </div>
    `;
  }

  /** Entrada de portada normalizada: {url, fit, x, y, z}. Acepta string (legacy) u objeto. */
  function coverEntry(id) {
    const raw = state.covers[id];
    if (!raw) return null;
    if (typeof raw === 'string') return { url: raw, fit: 'cover', x: 50, y: 50, z: 1 };
    const fit = raw.fit === 'contain' ? 'contain' : 'cover';
    const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d; };
    const nz = Number(raw.z);
    const z = Number.isFinite(nz) ? Math.min(3, Math.max(1, nz)) : 1;
    return { url: raw.url || '', fit, x: num(raw.x, 50), y: num(raw.y, 50), z };
  }

  function renderSectionCard(section, index, preview) {
    // La portada personalizada (subida/URL) tiene prioridad sobre la dinámica
    const entry = coverEntry(section.id);
    const cover = entry?.url || preview?.cover || '';
    const thumbs = preview?.thumbs || [];
    const stats = preview?.stats || '';
    const delay = index * 0.06;

    let visualHTML = '';
    if (!entry && preview?.posters?.length) {
      // Portadas rotatorias dentro de la tarjeta (Series): la primera se muestra
      // y la rotación la va cambiando; si una falla, cae al emoji de la sección.
      visualHTML = `<div class="rincon-card-img-wrap">
        <img class="sr-rotating-poster rincon-card-img" src="${preview.posters[0]}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="rincon-card-icon-wrap" style="display:none"><span class="rincon-card-emoji">${section.emoji || '✦'}</span></span>
      </div>`;
    } else if (thumbs.length >= 4 && (section.id === 'memes' || section.previewType === 'memes')) {
      // Collage of 4 miniatures
      visualHTML = `<div class="rincon-card-collage">
        ${thumbs.map((t, i) => `
          <div class="rincon-card-collage-cell">
            <img src="${t.url}" alt="" loading="lazy">
            ${t.isVideo ? `<span class="rincon-card-collage-play">${ICON_SVGS['play']}</span>` : ''}
          </div>
        `).join('')}
      </div>`;
    } else if (cover) {
      // Aplica encuadre (object-fit/object-position) y zoom (scale) solo si hay portada personalizada
      if (entry) {
        const zoomStyle = entry.z > 1 ? ` style="transform:scale(${entry.z})"` : '';
        visualHTML = `<div class="rincon-card-img-wrap">
          <div class="rincon-card-img-zoom"${zoomStyle}>
            <img src="${cover}" alt="" class="rincon-card-img" loading="lazy" style="object-fit:${entry.fit};object-position:${entry.x}% ${entry.y}%;">
          </div>
        </div>`;
      } else {
        visualHTML = `<div class="rincon-card-img-wrap">
          <img src="${cover}" alt="" class="rincon-card-img" loading="lazy">
        </div>`;
      }
    } else {
      visualHTML = `<div class="rincon-card-icon-wrap">
        <span class="rincon-card-emoji">${section.emoji || '✦'}</span>
      </div>`;
    }

    // En modo edición la tarjeta deja de ser un botón global (evita el patrón
    // botón-dentro-de-botón): el 📷 real es la única acción interactiva.
    const a11yAttrs = state.editMode ? '' : 'role="button" tabindex="0" aria-label="' + escapeHtml(section.title) + '"';
    return `
      <div class="rincon-section-card-v2 card animate-in${state.editMode ? ' is-editing' : ''}" data-section="${section.id}" data-href="${section.href ? escapeHtml(section.href) : ''}" ${a11yAttrs} style="--enter-delay:${delay}s">
        ${state.editMode ? `<button type="button" class="rincon-card-edit" data-edit-cover="${section.id}" aria-label="Cambiar portada de ${escapeHtml(section.title)}" title="Cambiar portada">📷</button>` : ''}
        ${visualHTML}
        <div class="rincon-card-body">
          <div class="rincon-card-header">
            <span class="rincon-card-icon-svg">${ICON_SVGS[section.icon] || ''}</span>
            <h3 class="rincon-card-title">${section.title}</h3>
          </div>
          <p class="rincon-card-desc">${section.desc}</p>
          ${stats ? `<span class="rincon-card-stats">${stats}</span>` : ''}
          ${section.dataHint ? `<span class="rincon-card-hint">${section.dataHint}</span>` : ''}
        </div>
      </div>
    `;
  }

  // ==========================================
  // EDITOR DE PORTADAS DE TARJETAS (solo admin)
  // ==========================================
  let activeCoverOverlay = null;

  function openCoverEditor(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    // Estado pendiente (no se persiste hasta pulsar Guardar)
    const current = coverEntry(sectionId);
    const pending = {
      url: current?.url || '',
      fit: current?.fit || 'cover',   // cover = Rellenar | contain = Ajustar
      x: current?.x ?? 50,
      y: current?.y ?? 50,
      z: current?.z ?? 1              // zoom: 1 = 100%, hasta 3 = 300%
    };
    let currentSrc = ''; // vacío a propósito: fuerza el primer applyPending() a asignar el src

    const overlay = document.createElement('div');
    overlay.className = 'rincon-cover-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Portada de ${section.title}`);
    overlay.innerHTML = `
      <div class="rincon-cover-modal" role="document">
        <div class="rincon-cover-head">
          <h3 class="rincon-cover-title">Portada · ${escapeHtml(section.title)}</h3>
          <button type="button" class="rincon-cover-close" data-cc="close" aria-label="Cerrar">✕</button>
        </div>
        <div class="rincon-cover-stage" id="coverStage" role="img" aria-label="Vista previa de la portada">
          <img class="rincon-cover-stage-img" id="coverStageImg" alt="Vista previa de la portada" draggable="false" tabindex="0">
          <span class="rincon-cover-emoji" id="coverStageEmoji" aria-hidden="true">${section.emoji || '✦'}</span>
        </div>
        <div class="rincon-cover-fitseg" id="coverFitSeg" hidden>
          <button type="button" class="rincon-cover-fitseg__btn${pending.fit === 'cover' ? ' is-active' : ''}" data-fit="cover" aria-pressed="${pending.fit === 'cover'}">Rellenar</button>
          <button type="button" class="rincon-cover-fitseg__btn${pending.fit === 'contain' ? ' is-active' : ''}" data-fit="contain" aria-pressed="${pending.fit === 'contain'}">Ajustar</button>
        </div>
        <div class="rincon-cover-zoomrow" id="coverZoomRow" hidden>
          <button type="button" class="rincon-cover-zoombtn" data-zoom="-1" aria-label="Alejar" title="Alejar">−</button>
          <input type="range" class="rincon-cover-zoomrange" id="coverZoomRange" min="100" max="300" step="10" value="100" aria-label="Zoom de la imagen">
          <span class="rincon-cover-zoomval" id="coverZoomValue">100%</span>
          <button type="button" class="rincon-cover-zoombtn" data-zoom="1" aria-label="Acercar" title="Acercar">+</button>
        </div>
        <p class="rincon-cover-hint">Arrastra para encuadrar y usa el zoom para el tamaño. La portada se sincronizará también en el móvil.</p>
        <div class="rincon-cover-actions">
          <button type="button" class="rincon-cover-btn is-primary" data-cc="upload">📷 Subir foto</button>
          <button type="button" class="rincon-cover-btn" data-cc="url">🔗 Usar URL</button>
          <button type="button" class="rincon-cover-btn is-danger" data-cc="remove" id="coverRemoveBtn" hidden>🗑 Quitar</button>
        </div>
        <input type="file" class="rincon-cover-file" accept="image/*" hidden>
        <div class="rincon-cover-urlrow" hidden>
          <input type="url" class="rincon-cover-url" placeholder="https://..." aria-label="URL de la imagen">
          <button type="button" class="rincon-cover-btn is-primary" data-cc="applyurl">Aplicar</button>
        </div>
        <div class="rincon-cover-foot">
          <button type="button" class="rincon-cover-btn is-done" data-cc="close">Cancelar</button>
          <button type="button" class="rincon-cover-btn is-save" data-cc="save" id="coverSaveBtn" disabled>Guardar portada</button>
        </div>
      </div>`;
    page.appendChild(overlay);
    const show = () => overlay.classList.add('is-visible');
    requestAnimationFrame(show);
    setTimeout(show, 50); // fallback si rAF está throttled (pestaña en segundo plano)
    activeCoverOverlay = overlay;
    document.body.classList.add('sheet-locked');

    const fileInput = overlay.querySelector('.rincon-cover-file');
    const urlInput = overlay.querySelector('.rincon-cover-url');
    const urlRow = overlay.querySelector('.rincon-cover-urlrow');
    const stage = overlay.querySelector('#coverStage');
    const stageImg = overlay.querySelector('#coverStageImg');
    const stageEmoji = overlay.querySelector('#coverStageEmoji');
    const fitSeg = overlay.querySelector('#coverFitSeg');
    const fitBtns = overlay.querySelectorAll('.rincon-cover-fitseg__btn');
    const zoomRow = overlay.querySelector('#coverZoomRow');
    const zoomRange = overlay.querySelector('#coverZoomRange');
    const zoomValue = overlay.querySelector('#coverZoomValue');
    const zoomBtns = overlay.querySelectorAll('.rincon-cover-zoombtn');
    const removeBtn = overlay.querySelector('#coverRemoveBtn');
    const saveBtn = overlay.querySelector('#coverSaveBtn');
    const lastFocus = document.activeElement;
    let onCoverKey = null; // se declara antes para poder limpiarlo en close()

    // ---- Refleja el estado pendiente en la UI ----
    const applyPending = () => {
      const has = !!pending.url;
      stageImg.hidden = !has;
      stageEmoji.hidden = has;
      fitSeg.hidden = !has;
      zoomRow.hidden = !has || pending.fit !== 'cover'; // el zoom solo aplica en Rellenar
      removeBtn.hidden = !has;
      saveBtn.disabled = !has;
      if (has) {
        if (currentSrc !== pending.url) { currentSrc = pending.url; stageImg.src = pending.url; }
        stageImg.style.objectFit = pending.fit;
        stageImg.style.objectPosition = `${pending.x}% ${pending.y}%`;
        stageImg.style.transform = pending.z > 1 ? `scale(${pending.z})` : '';
        zoomRange.value = String(Math.round(pending.z * 100));
        zoomValue.textContent = `${Math.round(pending.z * 100)}%`;
      }
      fitBtns.forEach(b => {
        const on = b.dataset.fit === pending.fit;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    };
    applyPending();

    // ---- Zoom: slider + botones − / + ----
    const setZoom = (z) => {
      pending.z = Math.min(3, Math.max(1, Math.round(z * 100) / 100));
      applyPending();
    };
    zoomRange.addEventListener('input', () => setZoom(Number(zoomRange.value) / 100));
    zoomBtns.forEach(b => b.addEventListener('click', () => {
      const delta = Number(b.dataset.zoom) * 0.1;
      setZoom(pending.z + delta);
    }));

    // Si la imagen no carga (URL rota/offline), muestra el emoji y avisa
    stageImg.addEventListener('error', () => {
      if (pending.url) {
        showToast('No se pudo cargar la imagen. Prueba con otra URL.', 'error');
        stageImg.hidden = true;
        stageEmoji.hidden = false;
      }
    });

    // ---- Arrastre para encuadrar (solo en modo Rellenar/cover) ----
    let drag = null;
    const clamp = (v) => Math.min(100, Math.max(0, v));

    const startDrag = (e) => {
      if (pending.fit !== 'cover' || !pending.url) return;
      const nw = stageImg.naturalWidth, nh = stageImg.naturalHeight;
      const rect = stage.getBoundingClientRect();
      if (!nw || !nh || !rect.width || !rect.height) return;
      const scale = Math.max(rect.width / nw, rect.height / nh);
      const dispW = nw * scale, dispH = nh * scale;
      // El zoom (scale z) amplía el desbordamiento visible: ox * z px de recorrido
      drag = {
        sx: e.clientX, sy: e.clientY,
        ox: Math.max(0, dispW - rect.width) * pending.z,
        oy: Math.max(0, dispH - rect.height) * pending.z
      };
      if (!drag.ox && !drag.oy) { drag = null; return; }
      stage.classList.add('is-dragging');
      try { stageImg.setPointerCapture(e.pointerId); } catch { /* eventos sintéticos o sin pointer activo */ }
      e.preventDefault();
    };
    const onDrag = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (drag.ox) pending.x = clamp(pending.x - (dx / drag.ox) * 100);
      if (drag.oy) pending.y = clamp(pending.y - (dy / drag.oy) * 100);
      stageImg.style.objectPosition = `${pending.x}% ${pending.y}%`;
      e.preventDefault();
    };
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      stage.classList.remove('is-dragging');
    };
    stageImg.addEventListener('pointerdown', startDrag);
    stageImg.addEventListener('pointermove', onDrag);
    stageImg.addEventListener('pointerup', endDrag);
    stageImg.addEventListener('pointercancel', endDrag);

    // ---- Teclado: flechas para encuadrar con precisión ----
    stageImg.addEventListener('keydown', (e) => {
      if (pending.fit !== 'cover' || !pending.url) return;
      // El step es %; con zoom el rango crece, así que lo escalamos para que el nudge sea constante en px
      const STEP = (e.shiftKey ? 10 : 2) / pending.z;
      let nx = pending.x, ny = pending.y;
      if (e.key === 'ArrowLeft') nx = clamp(nx - STEP);
      else if (e.key === 'ArrowRight') nx = clamp(nx + STEP);
      else if (e.key === 'ArrowUp') ny = clamp(ny - STEP);
      else if (e.key === 'ArrowDown') ny = clamp(ny + STEP);
      else return;
      e.preventDefault();
      pending.x = nx; pending.y = ny;
      stageImg.style.objectPosition = `${nx}% ${ny}%`;
    });

    const close = () => {
      overlay.classList.remove('is-visible');
      document.body.classList.remove('sheet-locked');
      if (onCoverKey) { document.removeEventListener('keydown', onCoverKey); onCoverKey = null; }
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      setTimeout(() => {
        overlay.remove();
        if (activeCoverOverlay === overlay) activeCoverOverlay = null;
      }, 260);
    };
    const busy = (b) => overlay.querySelectorAll('.rincon-cover-btn').forEach(bn => { bn.disabled = b; });

    // Escape cierra el editor
    onCoverKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onCoverKey);
    setTimeout(() => overlay.querySelector('.rincon-cover-close')?.focus(), 60);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { close(); return; }
      const btn = e.target.closest('[data-cc]');
      if (!btn) return;
      const act = btn.dataset.cc;
      if (act === 'close') { close(); return; }
      if (act === 'upload') { fileInput.click(); return; }
      if (act === 'url') { urlRow.hidden = false; urlInput.focus(); return; }
      if (act === 'applyurl') { applyUrl(); return; }
      if (act === 'remove') { commitRemove(); return; }
      if (act === 'save') { commitSave(); return; }
    });

    // Cambio de modo Rellenar / Ajustar
    fitBtns.forEach(b => b.addEventListener('click', () => {
      pending.fit = b.dataset.fit;
      if (pending.fit === 'contain') { pending.x = 50; pending.y = 50; pending.z = 1; } // centra y deshace zoom al ajustar
      applyPending();
    }));

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) { fileInput.value = ''; return; }
      busy(true);
      try {
        const urls = await db.uploadGalleryPhotos([file]);
        const url = urls?.[0];
        if (!url) throw new Error('No se pudo subir la imagen');
        pending.url = url;
        pending.x = 50; pending.y = 50; pending.fit = 'cover'; pending.z = 1;
        applyPending();
      } catch (err) {
        showToast(err?.message || 'Error al subir la imagen. Prueba con una URL.', 'error');
      } finally {
        fileInput.value = '';
        busy(false);
      }
    });

    async function applyUrl() {
      const url = urlInput.value.trim();
      if (!url) { showToast('Escribe una URL de imagen', 'info'); return; }
      busy(true);
      try {
        pending.url = url;
        pending.x = 50; pending.y = 50; pending.fit = 'cover'; pending.z = 1;
        applyPending();
      } finally { busy(false); }
    }

    async function commitRemove() {
      busy(true);
      try {
        const covers = { ...state.covers };
        delete covers[sectionId];
        await db.saveRinconCovers(covers);
        state.covers = covers;
        close();
        if (state.view === 'landing') render();
        showToast('Portada restaurada', 'success');
      } catch (err) {
        showToast(err?.message || 'Error al quitar la portada', 'error');
      } finally { busy(false); }
    }

    async function commitSave() {
      if (!pending.url) return;
      busy(true);
      try {
        const covers = { ...state.covers };
        covers[sectionId] = {
          url: pending.url,
          fit: pending.fit,
          x: Math.round(pending.x),
          y: Math.round(pending.y),
          z: Math.round(pending.z * 100) / 100
        };
        await db.saveRinconCovers(covers);
        state.covers = covers;
        close();
        if (state.view === 'landing') render();
        showToast('Portada actualizada ✓', 'success');
      } catch (err) {
        showToast(err?.message || 'Error al guardar la portada', 'error');
      } finally { busy(false); }
    }
  }

  // ==========================================
  // 2. GALERÍA + MEMES (PRESERVED)
  // ==========================================
  function renderGaleriaMemes() {
    // Las tarjetas "Memes" y "Audios" abren directamente su pestaña
    const initialTab = state.view === 'memes' ? 'memes' : state.view === 'audios' ? 'audios' : 'galeria';
    page.innerHTML = `
      <div class="rincon-subpage">
        <button class="rincon-back-btn" data-back="landing">
          ${ICON_SVGS['chevron-left']} Volver al Rincón
        </button>
        <nav class="rincon-subnav" aria-label="Secciones">
          <button class="rincon-subnav__btn${initialTab === 'galeria' ? ' active' : ''}" data-sub="galeria">
            <span class="rincon-subnav__icon-wrap">${ICON_SVGS['image']}</span> Galería
          </button>
          <button class="rincon-subnav__btn${initialTab === 'memes' ? ' active' : ''}" data-sub="memes">
            <span class="rincon-subnav__icon-wrap">${ICON_SVGS['smile']}</span> Memes
          </button>
          <button class="rincon-subnav__btn${initialTab === 'audios' ? ' active' : ''}" data-sub="audios">
            <span class="rincon-subnav__icon-wrap">${ICON_SVGS['mic']}</span> Audios
          </button>
        </nav>
        <div id="galeriaMemesContent">${
          initialTab === 'memes' ? renderMemesContent() :
          initialTab === 'audios' ? renderAudiosTabContent() : renderGaleriaContent()
        }</div>
      </div>
    `;

    page.querySelector('[data-back="landing"]').addEventListener('click', () => { state.view = 'landing'; render(); });
    page.querySelectorAll('.rincon-subnav__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('.rincon-subnav__btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sub = btn.dataset.sub;
        state.view = sub === 'memes' ? 'memes' : sub === 'audios' ? 'audios' : 'galeria-memes';
        const content = document.getElementById('galeriaMemesContent');
        if (sub === 'galeria') { content.innerHTML = renderGaleriaContent(); bindGaleriaEvents(content); }
        else if (sub === 'audios') { content.innerHTML = renderAudiosTabContent(); bindAudiosEvents(content); }
        else { content.innerHTML = renderMemesContent(); bindMemesEvents(content); }
      });
    });
    if (initialTab === 'memes') bindMemesEvents(page.querySelector('#galeriaMemesContent'));
    else if (initialTab === 'audios') bindAudiosEvents(page.querySelector('#galeriaMemesContent'));
    else bindGaleriaEvents(page.querySelector('#galeriaMemesContent'));
    // Sincroniza los vídeos desbloqueados del calendario cuando el catálogo llegue
    if (!getGiftsCatalog()) syncCalendarGallery();
  }

  /** Re-render de la galería una sola vez cuando el catálogo del calendario esté listo */
  function syncCalendarGallery() {
    loadGiftsCatalog().then(() => {
      if (state.calSynced || state.view !== 'galeria-memes') return;
      state.calSynced = true;
      const content = document.getElementById('galeriaMemesContent');
      if (!content) return;
      const y = window.scrollY; // preserva el scroll del usuario
      content.innerHTML = renderGaleriaContent();
      bindGaleriaEvents(content);
      if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }

  // ==========================================
  // GALERÍA — nueva experiencia fotográfica
  // ==========================================

  /** Vídeos desbloqueados del calendario (colección virtual 'Del calendario') */
  function calendarVideos() {
    return unlockedCalendarVideos().map(v => v.src);
  }

  /** Mapa src → cover (poster) de los vídeos del calendario con portada propia */
  function calendarVideoCovers() {
    const map = new Map();
    unlockedCalendarVideos().forEach(v => { if (v.cover) map.set(v.src, v.cover); });
    return map;
  }

  /** Fotos visibles según filtro + ordenación (ocultas siempre excluidas) */
  function getGalleryPhotos() {
    const folders = baseFolders();
    const hidden = new Set(hiddenPhotos());
    const calVideos = calendarVideos();
    let photos = [];
    if (state.galeriaFilter === 'favoritas') {
      photos = [...state.galeriaFavs].filter(u => !hidden.has(u));
    } else if (state.galeriaFilter === 'calendario') {
      // Si ya no quedan vídeos (ocultos todos), vuelve al álbum general
      if (!calVideos.length) state.galeriaFilter = 'todas';
      else photos = calVideos.filter(u => !hidden.has(u));
    } else if (state.galeriaFilter !== 'todas' && folders.includes(state.galeriaFilter)) {
      photos = visiblePhotos(state.galeriaFilter);
    } else {
      // Todas: cada carpeta base + subidas + vídeos del calendario (sin duplicar, sin ocultas)
      const seen = new Set();
      const pushUnique = (arr) => arr.forEach(u => { if (!seen.has(u) && !hidden.has(u)) { seen.add(u); photos.push(u); } });
      pushUnique(userPhotos());
      folders.forEach(f => pushUnique(basePhotos(f)));
      pushUnique(calVideos);
    }
    // Ordenación por fecha (Cloudinary v<ts> o Supabase <ms>-hash)
    if (state.galeriaSort === 'antiguas') photos.sort((a, b) => photoTs(a) - photoTs(b));
    else photos.sort((a, b) => photoTs(b) - photoTs(a));
    // Las subidas del usuario siempre van primero en 'recientes' (son lo nuevo)
    if (state.galeriaSort !== 'antiguas') {
      const ups = userPhotos();
      photos = [...ups.filter(u => photos.includes(u)), ...photos.filter(u => !ups.includes(u))];
    }
    return photos;
  }

  /** Título + descripción del álbum (con meta editable del usuario) */
  function galleryAlbum() {
    const folders = baseFolders();
    const meta = albumMeta();
    let title, desc, id;
    if (state.galeriaFilter === 'favoritas') { title = 'Favoritas'; desc = 'Las fotos que más me llegan al corazón.'; id = 'favoritas'; }
    else if (state.galeriaFilter === 'calendario') { title = 'Del calendario'; desc = 'Los vídeos que se desbloquean cada día en el Calendario.'; id = 'calendario'; }
    else if (state.galeriaFilter !== 'todas' && folders.includes(state.galeriaFilter)) { title = state.galeriaFilter; desc = ''; id = state.galeriaFilter; }
    else { title = meta.titulo || 'Nuestros recuerdos'; desc = meta.descripcion || 'Momentos que el cielo pinta solo para nosotros.'; id = 'todas'; }
    return {
      id,
      title: meta[`titulo:${id}`] || title,
      desc: meta[`desc:${id}`] || desc,
      portada: meta[`portada:${id}`] || ''
    };
  }

  function renderGaleriaContent() {
    const photos = getGalleryPhotos();
    const album = galleryAlbum();
    const folders = baseFolders();
    const calVideos = calendarVideos();
    const filterFolders = calVideos.length ? [...folders, 'calendario'] : folders;
    const filterLabel = (f) => f === 'calendario' ? '🎁 Del calendario' : f;
    const calCovers = calendarVideoCovers();
    const galleryThumb = (s) => isVideo(s) ? (calCovers.get(s) || getVideoPoster(s) || '') : s;
    // Portada: la elegida por el usuario, siempre que siga visible
    const cover = (album.portada && photos.includes(album.portada)) ? album.portada : (photos[0] || '');
    const year = photos.length ? albumYear(photos) : new Date().getFullYear();
    const favCount = state.galeriaFavs.size;
    const vidCount = photos.filter(isVideo).length;
    const fotoCount = photos.length - vidCount;
    // El hero solo recibe recursos que realmente tienen una miniatura. Así un
    // vídeo sin póster no provoca una petición accidental a la página actual.
    const heroPhotos = photos.slice(0, 5).map(galleryThumb).filter(Boolean);

    return `<div class="gallery-app">
      <!-- Añadir fotos (acción primaria, solo ADMIN) -->
      ${isAdmin ? `<div class="gallery-topbar">
        <button class="gallery-add-btn" id="galleryAddBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span class="gallery-add-label">Añadir fotos</span>
          <span class="gallery-add-only">＋</span>
        </button>
        <input type="file" id="galleryFileInput" accept="image/*" multiple hidden>
      </div>` : ''}

      <!-- Hero del álbum -->
      <div class="gallery-hero" id="galleryHero">
        ${heroPhotos.length ? `
          <div class="gallery-hero-slide is-active">
            <span class="gallery-hero-loader" aria-hidden="true"></span>
            <img src="${escapeHtml(galleryThumb(cover) || heroPhotos[0])}" alt="${escapeHtml(album.title)}" class="gallery-hero-bg" loading="eager" fetchpriority="high" decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()">
            <span class="gallery-hero-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>
          </div>
          ${heroPhotos.slice(1).map((src, i) => `<div class="gallery-hero-slide" data-slide="${i + 1}"><span class="gallery-hero-loader" aria-hidden="true"></span><img src="${escapeHtml(src)}" alt="" class="gallery-hero-bg" loading="lazy" decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="gallery-hero-fallback" aria-hidden="true">${ICON_SVGS['image']}</span></div>`).join('')}
        ` : ''}
        <div class="gallery-hero-shade"></div>
        ${isAdmin ? `
        <button class="gallery-hero-edit" id="galleryEditBtn" aria-label="Editar álbum" title="Editar álbum">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        <div class="gallery-hero-body">
          <h2 class="gallery-hero-title">${escapeHtml(album.title)}${state.galeriaFilter === 'favoritas' ? ' ❤️' : ''}</h2>
          ${album.desc ? `<p class="gallery-hero-desc">${escapeHtml(album.desc)}</p>` : ''}
          <div class="gallery-hero-meta">
            <span>${ICON_SVGS['camera']} ${fotoCount} ${fotoCount === 1 ? 'foto' : 'fotos'}${vidCount ? ` · ${vidCount} ${vidCount === 1 ? 'vídeo' : 'vídeos'}` : ''}</span>
            <span>${ICON_SVGS['calendar-days']} ${year}</span>
            <span>${ICON_SVGS['lock'] || '🔒'} Privado</span>
          </div>
          <div class="gallery-hero-actions">
            <button class="gallery-hero-btn gallery-hero-btn--primary" id="viewAllGalleryBtn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <span>Ver todas</span>
            </button>
            <button class="gallery-hero-btn gallery-hero-btn--ghost" id="gallerySlideshowBtn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Presentación</span>
            </button>
          </div>
        </div>
        ${heroPhotos.length > 1 ? `
          <div class="gallery-hero-dots">
            ${heroPhotos.map((_, i) => `<button class="gallery-hero-dot${i === 0 ? ' is-active' : ''}" data-dot="${i}" aria-label="Foto ${i + 1}"></button>`).join('')}
          </div>
        ` : ''}
      </div>

      <div class="gallery-collection-head">
        <div>
          <span class="gallery-collection-kicker">Tu colección</span>
          <h2 class="gallery-collection-title">Explora tus recuerdos</h2>
        </div>
        <span class="gallery-collection-count">${photos.length} ${photos.length === 1 ? 'momento' : 'momentos'}</span>
      </div>

      <!-- Filtros + ordenación -->
      <div class="gallery-toolbar">
        <div class="gallery-filters" id="galleryFilters">
          <button class="gallery-filter ${state.galeriaFilter === 'todas' ? 'is-active' : ''}" data-filter="todas">Todas</button>
          ${filterFolders.map(f => `<button class="gallery-filter ${state.galeriaFilter === f ? 'is-active' : ''}" data-filter="${escapeHtml(f)}">${escapeHtml(filterLabel(f))}</button>`).join('')}
          <button class="gallery-filter ${state.galeriaFilter === 'favoritas' ? 'is-active' : ''}" data-filter="favoritas">❤ Favoritas${favCount ? ` (${favCount})` : ''}</button>
        </div>
        <div class="gallery-sort">
          <button class="gallery-sort-btn" id="gallerySortBtn" aria-haspopup="listbox" aria-expanded="false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            <span id="gallerySortLabel">${state.galeriaSort === 'antiguas' ? 'Más antiguas' : 'Más recientes'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>

      <div class="gallery-masonry" id="galeriaGrid"></div>
      <div class="gallery-sentinel" id="gallerySentinel" aria-hidden="true"><span class="gallery-sentinel-spin"></span></div>
    </div>`;
  }

  function memeCollage(items, albumId, prioritize = false) {
    const previews = items.slice(0, 4);
    const cover = memeAlbumCover(albumId, items);
    const imageLoading = prioritize ? 'eager' : 'lazy';
    const imagePriority = prioritize ? ' fetchpriority="high"' : '';
    if (!previews.length) {
      return `<div class="meme-album-collage is-empty">
        <div class="meme-album-empty-icon">${ICON_SVGS['smile']}</div>
        <span>Álbum vacío</span>
      </div>`;
    }
    const cells = previews.map((src, i) => {
      const isVid = isVideo(src);
      const thumb = memePoster(src);
      const media = thumb
        ? `<span class="meme-cell-loader" aria-hidden="true"></span><img src="${escapeHtml(thumb)}" alt="" loading="${imageLoading}"${imagePriority} decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="meme-cell-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
        : `<span class="meme-cell-fallback" aria-hidden="true">${isVid ? ICON_SVGS['play'] : ICON_SVGS['image']}</span>`;
      return `<div class="meme-album-cell ${isVid ? 'is-video' : ''}${thumb ? '' : ' is-no-poster'}" data-cell-index="${i}">${media}${isVid ? `<span class="meme-cell-play" aria-hidden="true">${ICON_SVGS['play']}</span>` : ''}</div>`;
    }).join('');
    const emptyCells = [...Array(Math.max(0, 4 - previews.length))].map(() => '<div class="meme-album-cell is-empty"></div>').join('');
    const coverBadge = cover && !items.slice(0, 4).includes(cover)
      ? `<div class="meme-album-cover-mini"${memePoster(cover) ? ` style="background-image:url('${escapeHtml(memePoster(cover))}')"` : ''}></div>`
      : '';
    return `<div class="meme-album-collage">${cells}${emptyCells}${coverBadge}</div>`;
  }

  function memeSortAlbums(albums) {
    const list = [...albums];
    if (state.memeSort === 'nombre') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    } else if (state.memeSort === 'antiguos') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
      // recientes: los álbumes propios primero (recién creados), luego por total
      list.sort((a, b) => (b.isUser ? 1 : 0) - (a.isUser ? 1 : 0));
    }
    return list;
  }

  function renderMemesContent() {
    const albums = memeSortAlbums(memeAlbums().map(a => ({ ...a, items: memeItems(a.id) })));
    const stats = libraryStats();
    return `<div class="memes-immersive" id="memesRoot">
      <div class="memes-breadcrumb">
        <button class="memes-breadcrumb-item" data-nav="landing">El Rincón</button>
        <span class="memes-breadcrumb-sep">/</span>
        <span class="memes-breadcrumb-current">Memes</span>
      </div>
      <header class="memes-library-head">
        <div class="memes-library-titles">
          <h2 class="memes-library-title">Mis álbumes de memes ❤️</h2>
          <p class="memes-library-count">${stats.memes} memes · ${stats.albums} álbumes</p>
        </div>
        <div class="memes-library-tools">
          <div class="memes-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="memeSearchInput" placeholder="Buscar memes o álbumes…" aria-label="Buscar memes o álbumes" value="${escapeHtml(state.memeQuery)}">
          </div>
          ${isAdmin ? `
          <button class="meme-add-album" id="memeAddAlbumBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Crear álbum</span>
          </button>` : ''}
          <div class="meme-sort">
            <button class="meme-sort-btn" id="memeSortBtn" aria-haspopup="listbox" aria-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
              <span id="memeSortLabel">${state.memeSort === 'nombre' ? 'Nombre A-Z' : state.memeSort === 'antiguos' ? 'Más antiguos' : 'Más recientes'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
      </header>
      ${albums.length ? `
        <div class="meme-albums-grid" id="memesCollectionsGrid">
          ${albums.map((a, i) => {
            const s = albumSummary(a.items);
            const isFavCount = a.items.filter(u => state.memeFavs.has(u)).length;
            return `<div class="meme-album-card card animate-in" data-album="${escapeHtml(a.id)}" data-search="${escapeHtml((a.name + ' ' + a.items.join(' ')).toLowerCase())}" style="--enter-delay:${Math.min(i, 8) * 0.05}s" role="button" tabindex="0" aria-label="Abrir álbum ${escapeHtml(a.name)}">
              <div class="meme-album-media">${memeCollage(a.items, a.id, i === 0)}</div>
              <div class="meme-album-info">
                <div class="meme-album-name-row">
                  <h3 class="meme-album-name">${escapeHtml(a.name)}${a.isUser ? ' <span class="meme-album-own">●</span>' : ''}</h3>
                  <button class="meme-album-menu" data-menu="${escapeHtml(a.id)}" aria-label="Opciones de ${escapeHtml(a.name)}" title="Opciones del álbum">⋮</button>
                </div>
                <p class="meme-album-sub">${s.total} ${s.total === 1 ? 'meme' : 'memes'} · ${s.typeLabel}${isFavCount ? ` · ❤ ${isFavCount}` : ''}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="meme-search-empty" style="display:none">
          <div class="meme-empty-icon">${ICON_SVGS['smile']}</div>
          <h3>Sin resultados para «${escapeHtml(state.memeQuery)}»</h3>
          <p>Prueba con otro nombre de álbum o contenido.</p>
        </div>
        <section class="meme-library-cta">
          <div class="meme-cta-emoji">😄</div>
          <div>
            <h3>¿Tienes más memes?</h3>
            <p>Crea un nuevo álbum y organiza tus memes favoritos.</p>
          </div>
          <button class="meme-cta-btn" id="memeCtaBtn">+ Crear álbum</button>
        </section>
      ` : `
        <div class="meme-empty-library">
          <div class="meme-empty-icon">${ICON_SVGS['smile']}</div>
          <h3>Tu colección de memes está vacía</h3>
          <p>Guarda tus memes favoritos y organízalos en álbumes.</p>
          ${isAdmin ? `
          <button class="meme-add-album" id="memeEmptyAddBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Crear álbum</span>
          </button>` : ''}
        </div>
      `}
    </div>`;
  }

  // Handler del visor de curiosidades — se guarda para poder limpiarlo al salir de la página
  let datoViewerKeyHandler = null;

  // ----- Hero rotativo + indicadores -----
  let galleryHeroTimer = null; // se limpia en cada re-render para no acumular intervalos
  function bindGalleryHero(container, heroPhotos) {
    if (galleryHeroTimer) { clearInterval(galleryHeroTimer); galleryHeroTimer = null; }
    if (!heroPhotos.length) return;
    const hero = container.querySelector('#galleryHero');
    if (!hero) return;
    const slides = hero.querySelectorAll('.gallery-hero-slide');
    const dots = hero.querySelectorAll('.gallery-hero-dot');
    let current = 0;
    const show = (i) => {
      current = i;
      slides.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
      dots.forEach((d, idx) => d.classList.toggle('is-active', idx === i));
    };
    dots.forEach(d => d.addEventListener('click', () => show(Number(d.dataset.dot))));
    // Rotación automática sutil (solo si hay varias)
    if (slides.length > 1) {
      galleryHeroTimer = setInterval(() => show((current + 1) % slides.length), 6000);
    }
    // Pausar al interactuar
    const pause = () => { if (galleryHeroTimer) { clearInterval(galleryHeroTimer); galleryHeroTimer = null; } };
    const resume = () => {
      if (!galleryHeroTimer && slides.length > 1) galleryHeroTimer = setInterval(() => show((current + 1) % slides.length), 6000);
    };
    hero.addEventListener('pointerenter', pause);
    hero.addEventListener('pointerleave', resume);
  }

  // ----- Masonry con proporciones reales -----
  function renderMasonryGrid(grid, photos) {
    disconnectGalleryIO(grid);
    if (grid._galHandler) grid.removeEventListener('click', grid._galHandler);
    grid.innerHTML = '';
    grid.setAttribute('aria-busy', 'true');
    if (!photos.length) {
      grid.innerHTML = `
        <div class="gallery-empty">
          <div class="gallery-empty-icon">${ICON_SVGS['image']}</div>
          <h3>Tu galería está esperando nuevos recuerdos</h3>
          <p>Sube tus primeras fotos para empezar.</p>
          ${isAdmin ? `<button class="gallery-empty-btn" id="galleryEmptyAdd">${ICON_SVGS['plus'] || '＋'} Añadir fotos</button>` : ''}
        </div>`;
      grid.querySelector('#galleryEmptyAdd')?.addEventListener('click', () => document.getElementById('galleryFileInput')?.click());
      grid.setAttribute('aria-busy', 'false');
      return;
    }
    const favs = state.galeriaFavs;
    const mediaItems = buildMediaItems(photos, galleryAlbum().title).map(m => ({
      ...m,
      fav: favs.has(m.src),
      onToggleFav: () => togglePhotoFav(m.src)
    }));
    grid._galHandler = (e) => {
      const card = e.target.closest('.gallery-photo');
      if (!card) return;
      const favBtn = e.target.closest('.gallery-photo-fav');
      const menuBtn = e.target.closest('.gallery-photo-menu');
      if (favBtn) { e.stopPropagation(); togglePhotoFav(favBtn.dataset.url); return; }
      if (menuBtn) { e.stopPropagation(); openPhotoMenu(menuBtn.dataset.url, menuBtn); return; }
      openLightbox(mediaItems, Number(card.dataset.index));
    };
    grid._galMediaItems = mediaItems;
    grid.addEventListener('click', grid._galHandler);
    const token = ++state.galleryToken;

    // ===== SCROLL INFINITO (sin botón): renderiza todo, pero carga por lotes =====
    // Las imágenes ya usan loading="lazy", así que el navegador descarga primero
    // las visibles y el resto cuando se acercan al viewport (ahorro de recursos).
    const BATCH = 18;
    let offset = 0;
    let io = null;
    const sentinel = document.getElementById('gallerySentinel');

    function appendNext() {
      if (token !== state.galleryToken) return;
      const batch = photos.slice(offset, offset + BATCH);
      if (!batch.length) { finishLoad(); return; }
      offset += batch.length;
      const calCovers = calendarVideoCovers();
      batch.forEach((src, i) => {
        const idx = (offset - batch.length) + i;
        const ratio = knownRatio(src);
        const isVid = isVideo(src);
        const poster = isVid ? (calCovers.get(src) || getVideoPoster(src)) : '';
        const card = document.createElement('article');
        card.className = 'gallery-photo animate-in' + (isVid ? ' is-video' : '') + (isVid && !poster ? ' is-no-poster' : '');
        card.style.aspectRatio = ratio;
        card.style.setProperty('--enter-delay', `${(idx % BATCH) * 25}ms`);
        card.dataset.index = idx;
        const isFav = favs.has(src);
        const date = photoDate(src);
        card.innerHTML = `
          ${isVid && !poster
            ? `<span class="gallery-photo-placeholder" aria-hidden="true">${ICON_SVGS['play']}</span>`
            : `<span class="gallery-photo-loader" aria-hidden="true"></span><img src="${escapeHtml(poster || src)}" alt="Recuerdo ${idx + 1}" loading="${idx < 4 ? 'eager' : 'lazy'}"${idx < 4 ? ' fetchpriority="high"' : ''} decoding="async" onload="this.parentElement.classList.add('is-loaded');window.__galleryRemember && window.__galleryRemember(this)" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="gallery-photo-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`}
          ${isVid ? `<span class="gallery-photo-play" aria-hidden="true">${ICON_SVGS['play']}</span>` : ''}
          <div class="gallery-photo-shade"></div>
          ${date ? `<span class="gallery-photo-date">${escapeHtml(date)}</span>` : ''}
          <button class="gallery-photo-fav ${isFav ? 'is-on' : ''}" data-url="${escapeHtml(src)}" aria-label="${isFav ? 'Quitar de favoritas' : 'Marcar como favorita'}">${isFav ? '♥' : '♡'}</button>
          <button class="gallery-photo-menu" data-url="${escapeHtml(src)}" aria-label="Opciones de la foto" title="Opciones">⋮</button>
        `;
        grid.appendChild(card);
      });
      requestAnimationFrame(() => { grid.querySelectorAll('.gallery-photo.animate-in').forEach(el => el.classList.add('visible')); });
      // Sigue observando mientras queden fotos; finishLoad() desconecta al final
      if (offset >= photos.length) finishLoad();
    }

    function finishLoad() {
      if (io) { io.disconnect(); io = null; }
      grid.setAttribute('aria-busy', 'false');
      if (sentinel) sentinel.style.display = 'none';
    }

    appendNext();
    // Lote inicial más pequeño para pintar las visibles enseguida; el resto
    // se añade al acercarse al final (rootMargin = 600px de anticipación).
    if (offset < photos.length && sentinel && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) appendNext();
      }, { rootMargin: '600px 0px' });
      io.observe(sentinel);
    } else {
      finishLoad();
    }
    grid._galIO = io;
  }

  // Recordar proporción real (exposición global mínima para el onload inline)
  window.__galleryRemember = (img) => {
    if (img.naturalWidth) rememberRatio(img.currentSrc || img.src, img.naturalWidth, img.naturalHeight);
  };
  // Desconecta el observer del scroll infinito al re-renderizar
  function disconnectGalleryIO(grid) {
    if (grid?._galIO) { grid._galIO.disconnect(); grid._galIO = null; }
  }

  function togglePhotoFav(url) {
    const nowFav = toggleFavPhoto(url, state.galeriaFavs);
    if (nowFav) state.galeriaFavs.add(url); else state.galeriaFavs.delete(url);
    // Actualizar botones sin re-render completo
    document.querySelectorAll(`.gallery-photo-fav[data-url="${CSS.escape(url)}"]`).forEach(btn => {
      btn.classList.toggle('is-on', nowFav);
      btn.setAttribute('aria-label', nowFav ? 'Quitar de favoritas' : 'Marcar como favorita');
      btn.textContent = nowFav ? '♥' : '♡';
    });
    return nowFav;
  }

  // ----- Menú ⋮ por foto -----
  function openPhotoMenu(url, anchor) {
    const rect = anchor?.getBoundingClientRect();
    const isFav = state.galeriaFavs.has(url);
    const isUserUpload = userPhotos().includes(url);
    const body = `
      <div class="photo-menu">
        <button class="photo-menu-item" data-action="fav">${isFav ? '💔 Quitar de favoritas' : '❤️ Marcar como favorita'}</button>
        ${isAdmin ? `<button class="photo-menu-item" data-action="cover">📌 Establecer como portada</button>
        <button class="photo-menu-item is-danger" data-action="delete">🗑️ Eliminar foto</button>` : ''}
      </div>`;
    const overlay = document.createElement('div');
    overlay.className = 'photo-menu-overlay';
    overlay.innerHTML = `<div class="photo-menu-sheet">
      <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      ${body}
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.photo-menu-close')) close(); });
    overlay.querySelector('[data-action="fav"]')?.addEventListener('click', () => { togglePhotoFav(url); close(); });
    overlay.querySelector('[data-action="cover"]')?.addEventListener('click', () => {
      const album = galleryAlbum();
      saveAlbumMeta({ [`portada:${album.id}`]: url });
      close();
      showToast('Portada actualizada ✓', 'success');
      rerenderGallery();
    });
    overlay.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      close();
      const modal = document.createElement('div');
      modal.className = 'photo-menu-overlay';
      modal.innerHTML = `<div class="photo-menu-sheet photo-menu-sheet--confirm">
        <div class="photo-confirm-icon">🗑️</div>
        <h3>¿Eliminar esta foto?</h3>
        <p>Se quitará de tu galería${isUserUpload ? '' : ' (solo de tu vista)'}. Esta acción no se puede deshacer.</p>
        <div class="photo-confirm-actions">
          <button class="gallery-hero-btn" data-cancel>Cancelar</button>
          <button class="gallery-hero-btn gallery-hero-btn--danger" data-ok>Eliminar</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      modal.querySelector('[data-ok]').addEventListener('click', () => {
        hidePhoto(url);
        state.galeriaFavs.delete(url);
        saveFavPhotos(state.galeriaFavs);
        modal.remove();
        showToast('Foto eliminada ✓', 'success');
        rerenderGallery();
      });
    });
  }

  // ----- Edición del álbum -----
  function openAlbumEditor() {
    const album = galleryAlbum();
    const photos = getGalleryPhotos().slice(0, 30);
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay gallery-editor-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet gallery-editor">
      <div class="gallery-editor-head">
        <h3>Editar álbum</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <label class="gallery-editor-field"><span>Nombre</span><input type="text" id="galEditTitle" maxlength="40" value="${escapeHtml(album.title)}"></label>
      <label class="gallery-editor-field"><span>Descripción</span><textarea id="galEditDesc" rows="2" maxlength="120">${escapeHtml(album.desc)}</textarea></label>
      <div class="gallery-editor-field">
        <span>Portada</span>
        <div class="gallery-editor-covers">
          ${(() => {
            const calCovers = calendarVideoCovers();
            return photos.map((src, i) => {
              const isVid = isVideo(src);
              const thumb = isVid ? (calCovers.get(src) || getVideoPoster(src) || '') : src;
              return `<button class="gallery-editor-cover ${src === album.portada || (i === 0 && !album.portada) ? 'is-active' : ''}${isVid ? ' is-video' : ''}" data-src="${escapeHtml(src)}"${thumb ? ` style="background-image:url('${escapeHtml(thumb)}')"` : ''} aria-label="Usar ${isVid ? 'vídeo' : 'foto'} ${i + 1} como portada">${isVid ? `<span class="gallery-editor-cover-play">${ICON_SVGS['play']}</span>` : ''}</button>`;
            }).join('');
          })()}
        </div>
      </div>
      <div class="gallery-editor-actions">
        <button class="gallery-hero-btn" id="galEditCancel">Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--primary" id="galEditSave">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.photo-menu-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#galEditCancel').addEventListener('click', close);
    let chosenCover = album.portada;
    modal.querySelectorAll('.gallery-editor-cover').forEach(c => c.addEventListener('click', () => {
      modal.querySelectorAll('.gallery-editor-cover').forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
      chosenCover = c.dataset.src;
    }));
    modal.querySelector('#galEditSave').addEventListener('click', () => {
      saveAlbumMeta({
        [`titulo:${album.id}`]: modal.querySelector('#galEditTitle').value.trim() || album.title,
        [`desc:${album.id}`]: modal.querySelector('#galEditDesc').value.trim(),
        [`portada:${album.id}`]: chosenCover
      });
      close();
      showToast('Álbum actualizado ✓', 'success');
      rerenderGallery();
    });
  }

  // ----- Subida de fotos -----
  function bindGalleryUpload(container) {
    const input = container.querySelector('#galleryFileInput');
    container.querySelector('#galleryAddBtn')?.addEventListener('click', () => input?.click());
    if (input) {
      input.addEventListener('change', async () => {
        const files = [...input.files];
        input.value = '';
        if (!files.length) return;
        try {
          showToast('Subiendo fotos…', 'info');
          const urls = await db.uploadGalleryPhotos(files);
          if (urls.length) {
            addUserPhotos(urls);
            showToast(`${urls.length} ${urls.length === 1 ? 'foto añadida' : 'fotos añadidas'} ✓`, 'success');
            rerenderGallery();
          }
        } catch (err) {
          showToast(err?.message || 'Error al subir las fotos', 'error');
        }
      });
    }
  }

  function rerenderGallery() {
    const content = document.getElementById('galeriaMemesContent');
    if (!content) return;
    content.innerHTML = renderGaleriaContent();
    bindGaleriaEvents(content);
  }

  function bindGaleriaEvents(container) {
    if (!container) return;
    const photos = getGalleryPhotos();
    const heroPhotos = photos.slice(0, 5);
    const grid = document.getElementById('galeriaGrid');
    if (grid) renderMasonryGrid(grid, photos);
    bindGalleryHero(container, heroPhotos);
    bindGalleryUpload(container);

    const mediaItems = buildMediaItems(photos, galleryAlbum().title).map(m => ({
      ...m,
      fav: state.galeriaFavs.has(m.src),
      onToggleFav: () => togglePhotoFav(m.src)
    }));
    container.querySelector('#viewAllGalleryBtn')?.addEventListener('click', () => {
      const hero = container.querySelector('#galleryHero');
      if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (mediaItems.length) openLightbox(mediaItems, 0);
    });
    container.querySelector('#gallerySlideshowBtn')?.addEventListener('click', () => {
      if (!mediaItems.length) return;
      openLightbox(mediaItems, 0);
      // Presentación automática: fotos 5s; vídeos avanzan al terminar.
      playSlideshow();
    });
    container.querySelector('#galleryEditBtn')?.addEventListener('click', openAlbumEditor);

    // Filtros
    container.querySelectorAll('.gallery-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        state.galeriaFilter = btn.dataset.filter;
        rerenderGallery();
      });
    });
    // Ordenación
    const sortBtn = container.querySelector('#gallerySortBtn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        state.galeriaSort = state.galeriaSort === 'recientes' ? 'antiguas' : 'recientes';
        container.querySelector('#gallerySortLabel').textContent = state.galeriaSort === 'antiguas' ? 'Más antiguas' : 'Más recientes';
        rerenderGallery();
      });
    }
    // Teclado: Escape cierra menús de galería (sin acumular listeners)
    if (!window.__galEscBound) {
      window.__galEscBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.photo-menu-overlay').forEach(o => o.remove());
      });
    }
  }

  function openMemeAlbumMenu(albumId) {
    const albums = memeAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) return;
    const items = memeItems(albumId);
    const body = `
      <div class="photo-menu">
        <button class="photo-menu-item" data-action="open">📂 Abrir álbum</button>
        ${isAdmin && album.isUser ? `<button class="photo-menu-item" data-action="edit">✏️ Editar álbum</button>` : ''}
        ${isAdmin ? `<button class="photo-menu-item" data-action="add">＋ Añadir memes</button>` : ''}
        ${isAdmin ? `<button class="photo-menu-item" data-action="cover">📌 Cambiar portada</button>` : ''}
        ${isAdmin && album.isUser ? `<button class="photo-menu-item is-danger" data-action="delete">🗑️ Eliminar álbum</button>` : ''}
      </div>`;
    const overlay = document.createElement('div');
    overlay.className = 'photo-menu-overlay';
    overlay.innerHTML = `<div class="photo-menu-sheet">
      <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      ${body}
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.photo-menu-close')) close(); });
    overlay.querySelector('[data-action="open"]')?.addEventListener('click', () => { close(); openMemeAlbum(albumId); });
    overlay.querySelector('[data-action="edit"]')?.addEventListener('click', () => { close(); openMemeAlbumEditor(albumId); });
    overlay.querySelector('[data-action="add"]')?.addEventListener('click', () => { close(); openMemeAlbum(albumId); requestMemeUpload(); });
    overlay.querySelector('[data-action="cover"]')?.addEventListener('click', () => { close(); openMemeCoverPicker(albumId, items); });
    overlay.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      close();
      const modal = document.createElement('div');
      modal.className = 'photo-menu-overlay';
      modal.innerHTML = `<div class="photo-menu-sheet photo-menu-sheet--confirm">
        <div class="photo-confirm-icon">🗑️</div>
        <h3>¿Eliminar el álbum?</h3>
        <p>"${escapeHtml(album.name)}" y sus memes subidos se eliminarán. Esta acción no se puede deshacer.</p>
        <div class="photo-confirm-actions">
          <button class="gallery-hero-btn" data-cancel>Cancelar</button>
          <button class="gallery-hero-btn gallery-hero-btn--danger" data-ok>Eliminar</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      modal.querySelector('[data-ok]').addEventListener('click', () => {
        deleteMemeAlbum(albumId);
        modal.remove();
        showToast('Álbum eliminado ✓', 'success');
        rerenderMemes();
      });
    });
  }

  function openMemeCoverPicker(albumId, items) {
    if (!items.length) { showToast('Este álbum no tiene memes todavía', 'info'); return; }
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay gallery-editor-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet gallery-editor">
      <div class="gallery-editor-head"><h3>Elegir portada</h3><button class="photo-menu-close" aria-label="Cerrar">✕</button></div>
      <p class="gallery-editor-hint">Selecciona el meme que quieres como portada del álbum.</p>
      <div class="gallery-editor-covers">
        ${items.slice(0, 24).map((src, i) => `<button class="gallery-editor-cover ${src === memeAlbumCover(albumId, items) ? 'is-active' : ''}" data-src="${escapeHtml(src)}"${memePoster(src) ? ` style="background-image:url('${escapeHtml(memePoster(src))}')"` : ' style="background:#eee;display:flex;align-items:center;justify-content:center;font-size:1.4rem"'} aria-label="Usar meme ${i + 1} como portada">${memePoster(src) ? '' : '▶'}</button>`).join('')}
      </div>
      <div class="gallery-editor-actions">
        <button class="gallery-hero-btn" id="galEditCancel">Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--primary" id="galEditSave">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.photo-menu-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#galEditCancel').addEventListener('click', close);
    let chosen = memeAlbumCover(albumId, items);
    modal.querySelectorAll('.gallery-editor-cover').forEach(c => c.addEventListener('click', () => {
      modal.querySelectorAll('.gallery-editor-cover').forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
      chosen = c.dataset.src;
    }));
    modal.querySelector('#galEditSave').addEventListener('click', () => {
      saveMemeMeta({ [`portada:${albumId}`]: chosen });
      close();
      showToast('Portada actualizada ✓', 'success');
      rerenderMemes();
    });
  }

  function openMemeAlbumEditor(albumId = null) {
    const albums = memeAlbums();
    const album = albumId ? albums.find(a => a.id === albumId) : null;
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay gallery-editor-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet gallery-editor">
      <div class="gallery-editor-head">
        <h3>${album ? 'Editar álbum' : 'Nuevo álbum'}</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <label class="gallery-editor-field"><span>Nombre</span><input type="text" id="memeEditName" maxlength="40" placeholder="Ej. Animales, Random, Te amo…" value="${album ? escapeHtml(album.name) : ''}"></label>
      <label class="gallery-editor-field"><span>Descripción <em>(opcional)</em></span><textarea id="memeEditDesc" rows="2" maxlength="120" placeholder="Una frase que describa este álbum">${album ? escapeHtml((memeMeta()['desc:' + albumId]) || '') : ''}</textarea></label>
      <div class="gallery-editor-actions">
        <button class="gallery-hero-btn" id="galEditCancel">Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--primary" id="galEditSave">${album ? 'Guardar' : 'Crear álbum'}</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.photo-menu-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#galEditCancel').addEventListener('click', close);
    modal.querySelector('#galEditSave').addEventListener('click', () => {
      const name = modal.querySelector('#memeEditName').value.trim();
      const desc = modal.querySelector('#memeEditDesc').value.trim();
      if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
      if (album) {
        renameMemeAlbum(album.id, name, desc);
        saveMemeMeta({ [`desc:${album.id}`]: desc });
        showToast('Álbum actualizado ✓', 'success');
      } else {
        const created = createMemeAlbum(name, desc);
        saveMemeMeta({ [`desc:${created.id}`]: desc });
        showToast('Álbum creado ✓', 'success');
        close();
        rerenderMemes();
        openMemeAlbum(created.id);
        return;
      }
      close();
      rerenderMemes();
    });
  }

  function rerenderMemes() {
    const content = document.getElementById('galeriaMemesContent');
    if (!content) return;
    content.innerHTML = renderMemesContent();
    bindMemesEvents(content);
  }

  function requestMemeUpload() {
    document.getElementById('memeFileInput')?.click();
  }

  function bindMemeUpload(container, albumId) {
    const input = container.querySelector('#memeFileInput');
    if (!input) return;
    input.addEventListener('change', async () => {
      const files = [...input.files];
      input.value = '';
      if (!files.length) return;
      try {
        showToast('Subiendo memes…', 'info');
        const urls = await db.uploadMemes(files);
        if (urls.length) {
          addMemesToAlbum(albumId, urls);
          showToast(`${urls.length} ${urls.length === 1 ? 'meme añadido' : 'memes añadidos'} ✓`, 'success');
          // Mantener al usuario dentro del álbum tras subir
          openMemeAlbum(albumId);
        }
      } catch (err) {
        showToast(err?.message || 'Error al subir los memes', 'error');
      }
    });
  }

  function openMemeAlbum(albumId) {
    state.memeAlbumId = albumId;
    state.memeFilter = 'todos';
    const content = document.getElementById('galeriaMemesContent');
    if (!content) return;
    content.innerHTML = renderMemeAlbumView(albumId);
    bindMemeAlbumEvents(content, albumId);
  }

  function renderMemeAlbumView(albumId) {
    const albums = memeAlbums();
    const album = albums.find(a => a.id === albumId) || { id: albumId, name: albumId, isUser: false };
    const allItems = memeItems(albumId);
    let items = allItems;
    if (state.memeFilter === 'fotos') items = items.filter(u => !isVideo(u));
    if (state.memeFilter === 'videos') items = items.filter(u => isVideo(u));
    const s = albumSummary(allItems);
    const desc = (memeMeta()['desc:' + albumId]) || '';
    return `<div class="meme-album-view" id="memeAlbumRoot">
      <div class="memes-breadcrumb">
        <button class="memes-breadcrumb-item" data-nav="landing">El Rincón</button>
        <span class="memes-breadcrumb-sep">/</span>
        <button class="memes-breadcrumb-item" id="memeAlbumBackBtn">Memes</button>
        <span class="memes-breadcrumb-sep">/</span>
        <span class="memes-breadcrumb-current">${escapeHtml(album.name)}</span>
      </div>
      <header class="meme-album-head">
        <div>
          <h2 class="meme-album-title">${escapeHtml(album.name)}</h2>
          ${desc ? `<p class="meme-album-desc">${escapeHtml(desc)}</p>` : ''}
          <p class="meme-album-meta">${s.total} ${s.total === 1 ? 'meme' : 'memes'} · ${s.typeLabel}</p>
        </div>
        <div class="meme-album-actions">
          ${isAdmin ? `
          <button class="gallery-hero-btn gallery-hero-btn--primary" id="memeAlbumAddBtn">＋ Añadir</button>
          <button class="meme-album-menu-btn" id="memeAlbumMenuBtn" aria-label="Opciones del álbum">⋮</button>
          <input type="file" id="memeFileInput" accept="image/*,video/*" multiple hidden>` : ''}
        </div>
      </header>
      <div class="meme-album-filters" role="tablist" aria-label="Filtrar contenido">
        <button class="meme-filter-chip ${state.memeFilter === 'todos' ? 'is-active' : ''}" data-filter="todos">Todos (${allItems.length})</button>
        <button class="meme-filter-chip ${state.memeFilter === 'fotos' ? 'is-active' : ''}" data-filter="fotos">Fotos (${s.fotos})</button>
        <button class="meme-filter-chip ${state.memeFilter === 'videos' ? 'is-active' : ''}" data-filter="videos">Vídeos (${s.videos})</button>
      </div>
      <div class="meme-album-grid" id="memeAlbumGrid">${items.length ? '' : `<div class="meme-empty-album"><div class="meme-empty-icon">${ICON_SVGS['smile']}</div><h3>Este álbum está vacío</h3><p>Añade tus primeros memes para llenarlo de risas.</p>${isAdmin ? `<button class="meme-add-album" id="memeEmptyAddBtn">＋ Añadir memes</button>` : ''}</div>`}</div>
    </div>`;
  }

  function bindMemeAlbumEvents(container, albumId) {
    if (!container) return;
    const allItems = memeItems(albumId);
    let items = allItems;
    if (state.memeFilter === 'fotos') items = items.filter(u => !isVideo(u));
    if (state.memeFilter === 'videos') items = items.filter(u => isVideo(u));
    const mediaItems = buildMediaItems(items, albumId).map(m => ({
      ...m,
      fav: state.memeFavs.has(m.src),
      onToggleFav: () => toggleMemeItemFav(m.src)
    }));
    const grid = container.querySelector('#memeAlbumGrid');
    if (grid) {
      grid.setAttribute('aria-busy', 'true');
      if (grid._memeHandler) grid.removeEventListener('click', grid._memeHandler);
      grid._memeHandler = (e) => {
        const item = e.target.closest('.meme-album-item');
        if (!item) return;
        const favBtn = e.target.closest('.meme-item-fav');
        const delBtn = e.target.closest('.meme-item-del');
        if (favBtn) { e.stopPropagation(); toggleMemeItemFav(favBtn.dataset.url); return; }
        if (delBtn) { e.stopPropagation(); confirmDeleteMeme(albumId, delBtn.dataset.url); return; }
        openLightbox(mediaItems, Number(item.dataset.index));
      };
      grid.addEventListener('click', grid._memeHandler);
      // Si no hay items, el empty state ya está renderizado por renderMemeAlbumView
      if (items.length) {
      grid.innerHTML = items.map((src, i) => {
        const isVid = isVideo(src);
        const poster = memePoster(src);
        const isFav = state.memeFavs.has(src);
        const loading = i < 6 ? 'eager' : 'lazy';
        const priority = i < 6 ? ' fetchpriority="high"' : '';
        const media = poster
          ? `<span class="meme-item-loader" aria-hidden="true"></span><img src="${escapeHtml(poster)}" alt="Meme ${i + 1}" loading="${loading}"${priority} decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="meme-item-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
          : `<div class="meme-item-posterless">${isVid ? `<span class="meme-item-play">${ICON_SVGS['play']}</span>` : '🎞️'}</div>`;
        return `<article class="meme-album-item animate-in" style="--enter-delay:${(i % 12) * 25}ms" data-index="${i}">
          ${media}
          ${isVid && poster ? `<span class="meme-item-play">${ICON_SVGS['play']}</span>` : ''}
          <div class="meme-item-actions">
            <button class="meme-item-fav ${isFav ? 'is-on' : ''}" data-url="${escapeHtml(src)}" aria-label="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}">${isFav ? '♥' : '♡'}</button>
            ${isAdmin ? `<button class="meme-item-del" data-url="${escapeHtml(src)}" aria-label="Eliminar meme" title="Eliminar">🗑</button>` : ''}
          </div>
        </article>`;
      }).join('');
        requestAnimationFrame(() => { grid.querySelectorAll('.meme-album-item.animate-in').forEach(el => el.classList.add('visible')); });
      }
      grid.setAttribute('aria-busy', 'false');
    }
    container.querySelector('#memeAlbumBackBtn')?.addEventListener('click', () => { rerenderMemes(); });
    container.querySelectorAll('.memes-breadcrumb-item[data-nav="landing"]').forEach(btn => {
      btn.addEventListener('click', () => { state.view = 'landing'; render(); });
    });
    container.querySelector('#memeAlbumAddBtn')?.addEventListener('click', () => requestMemeUpload());
    container.querySelector('#memeEmptyAddBtn')?.addEventListener('click', () => requestMemeUpload());
    container.querySelector('#memeAlbumMenuBtn')?.addEventListener('click', () => openMemeAlbumMenu(albumId));
    container.querySelectorAll('.meme-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.memeFilter = chip.dataset.filter;
        const view = container.querySelector('#memeAlbumRoot');
        if (view) {
          container.innerHTML = renderMemeAlbumView(albumId);
          bindMemeAlbumEvents(container, albumId);
        }
      });
    });
    bindMemeUpload(container, albumId);
  }

  function toggleMemeItemFav(url) {
    const nowFav = toggleMemeFav(url, state.memeFavs);
    if (nowFav) state.memeFavs.add(url); else state.memeFavs.delete(url);
    document.querySelectorAll(`.meme-item-fav[data-url="${CSS.escape(url)}"]`).forEach(btn => {
      btn.classList.toggle('is-on', nowFav);
      btn.textContent = nowFav ? '♥' : '♡';
      btn.setAttribute('aria-label', nowFav ? 'Quitar de favoritos' : 'Marcar como favorito');
    });
  }

  function confirmDeleteMeme(albumId, url) {
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet photo-menu-sheet--confirm">
      <div class="photo-confirm-icon">🗑️</div>
      <h3>¿Eliminar este meme?</h3>
      <p>Se quitará del álbum. Esta acción no se puede deshacer.</p>
      <div class="photo-confirm-actions">
        <button class="gallery-hero-btn" data-cancel>Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--danger" data-ok>Eliminar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('[data-ok]').addEventListener('click', () => {
      hideMeme(albumId, url);
      state.memeFavs.delete(url);
      saveMemeFavs(state.memeFavs);
      modal.remove();
      showToast('Meme eliminado ✓', 'success');
      openMemeAlbum(albumId);
    });
  }

  // Filtra las tarjetas del grid sin re-render (no pierde el foco del buscador)
  function applyMemeSearch(query) {
    const grid = document.querySelector('.meme-albums-grid');
    if (!grid) return;
    const q = query.trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.meme-album-card').forEach(card => {
      const haystack = (card.textContent || '').toLowerCase();
      const show = !q || haystack.includes(q);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const emptyEl = document.querySelector('.meme-search-empty');
    if (emptyEl) emptyEl.style.display = visible ? 'none' : '';
    const countEl = document.querySelector('.memes-library-count');
    if (countEl && visible !== grid.querySelectorAll('.meme-album-card').length) {
      const total = libraryStats();
      countEl.textContent = `${visible} de ${total.memes} memes · ${total.albums} álbumes`;
    }
  }

  function bindMemesEvents(container) {
    if (!container) return;
    // Breadcrumb navigation
    container.querySelectorAll('.memes-breadcrumb-item[data-nav="landing"]').forEach(btn => {
      btn.addEventListener('click', () => { state.view = 'landing'; render(); });
    });
    // Buscador instantáneo (filtra el grid existente, sin perder el foco)
    const searchInput = container.querySelector('#memeSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.memeQuery = searchInput.value;
        applyMemeSearch(state.memeQuery);
      });
    }
    // Ordenación
    const sortBtn = container.querySelector('#memeSortBtn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        state.memeSort = state.memeSort === 'recientes' ? 'antiguos' : state.memeSort === 'antiguos' ? 'nombre' : 'recientes';
        rerenderMemes();
      });
    }
    // Crear álbum
    container.querySelector('#memeAddAlbumBtn')?.addEventListener('click', () => openMemeAlbumEditor());
    container.querySelector('#memeEmptyAddBtn')?.addEventListener('click', () => openMemeAlbumEditor());
    container.querySelector('#memeCtaBtn')?.addEventListener('click', () => openMemeAlbumEditor());
    // Tarjetas de álbum + menú
    container.querySelectorAll('.meme-album-card').forEach(card => {
      const openIt = () => openMemeAlbum(card.dataset.album);
      card.addEventListener('click', (e) => {
        if (e.target.closest('.meme-album-menu')) return;
        openIt();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); }
      });
    });
    container.querySelectorAll('.meme-album-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMemeAlbumMenu(btn.dataset.menu);
      });
    });
    // Entrada escalonada — las tarjetas deben recibir 'visible' para animarse
    requestAnimationFrame(() => {
      container.querySelectorAll('.meme-album-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  }

  // ==========================================
  // 3. CURIOSIDADES — Category landing → Detail views
  // ==========================================
  const CATEGORIES = [
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

  function renderCuriosidades() {
    if (state.curiosidadTab === 'landing') {
      renderCuriosidadesLanding();
    } else {
      renderCuriosidadesCategory(state.curiosidadTab);
    }
  }

  // Chips de categoría derivados de los tags reales de los datos
  const DISCO_CATEGORIES = [
    { id: 'lugares', label: 'Lugares', emoji: '🌍', match: ['honduras', 'atlántida', 'pueblo', 'río', 'rusia', 'ciudad', 'imperial', 'puentes'] },
    { id: 'historia', label: 'Historia', emoji: '📜', match: ['historia', 'cronología', 'fundación'] },
    { id: 'comida', label: 'Comida', emoji: '🍕', match: ['comida', 'gastronomía', 'gastronómico'] },
    { id: 'animales', label: 'Animales', emoji: '🐾', match: ['felino', 'mascota', 'animal'] },
    { id: 'datos', label: 'Datos curiosos', emoji: '💡', match: ['estadística', 'dato', 'curiosidad'] }
  ];

  // Selección determinista por fecha: misma curiosidad todo el día
  function getCuriosidadDelDia() {
    const all = buildAllCurioItems();
    if (!all.length) return null;
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return all[seed % all.length];
  }

  function renderCuriosidadesLanding() {
    const dayItem = getCuriosidadDelDia();
    page.innerHTML = `<div class="rincon-subpage">
      <button class="rincon-back-btn" data-back="landing">${ICON_SVGS['chevron-left']} Volver al Rincón</button>
      <header class="disco-landing-hero">
        <div class="disco-landing-icon">${ICON_SVGS['globe']}</div>
        <h2 class="disco-landing-title">Descubre y aprende</h2>
        <p class="disco-landing-sub">Una pequeña enciclopedia de cosas curiosas que nos gustan.</p>
      </header>
      <div class="discovery-search-wrap">
        <div class="discovery-search glass-card">
          <span class="discovery-search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input type="text" class="discovery-search-input" id="discoGlobalSearch" placeholder="Buscar datos, lugares, comida..." autocomplete="off">
          <button class="discovery-search-clear" id="discoGlobalClear" style="display:none" aria-label="Limpiar búsqueda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <p class="discovery-results-count" id="discoveryResultsCount"></p>
      </div>

      ${dayItem ? `
      <section class="disco-day-section" aria-label="Curiosidad del día">
        <span class="disco-day-eyebrow">✦ Curiosidad del día</span>
        <button class="disco-day-card card animate-in" role="button" tabindex="0">
          <span class="disco-day-icon">${ICON_SVGS[dayItem.icon] || '✦'}</span>
          <div class="disco-day-body">
            <h3 class="disco-day-title">${dayItem.title}</h3>
            <p class="disco-day-text">${dayItem.text}</p>
            <span class="disco-day-go">${dayItem.category} ${ICON_SVGS['arrow-right'] || '→'}</span>
          </div>
        </button>
      </section>` : ''}

      <div class="disco-category-row" aria-label="Filtrar por categoría">
        ${DISCO_CATEGORIES.map(c => `<button class="disco-filter-chip${state.discoCat === c.id ? ' is-active' : ''}" data-disco-cat="${c.id}" role="tab" aria-selected="${state.discoCat === c.id ? 'true' : 'false'}">${c.emoji} ${c.label}</button>`).join('')}
      </div>

      <section class="disco-collections-section">
        <div class="disco-collections-head">
          <h3 class="disco-section-title">Explora por colección</h3>
        </div>
        <div class="disco-cat-grid" id="discoCatGrid">
          ${CATEGORIES.map((cat, i) => renderCategoryCard(cat, i)).join('')}
        </div>
      </section>
    </div>`;

    page.querySelector('[data-back="landing"]').addEventListener('click', () => { state.view = 'landing'; render(); });

    // Animate cards
    requestAnimationFrame(() => {
      page.querySelectorAll('.disco-cat-card.animate-in, .disco-day-card.animate-in').forEach(el => el.classList.add('visible'));
    });

    // Category card clicks
    page.querySelectorAll('.disco-cat-card').forEach(card => {
      card.addEventListener('click', () => {
        state.curiosidadTab = card.dataset.cat;
        render();
      });
    });

    // Curiosidad del día → abre su colección
    const dayCard = page.querySelector('.disco-day-card');
    if (dayCard) {
      const openDay = () => {
        const cat = CATEGORIES.find(c => c.id === (dayItem?.catId || ''));
        if (cat) { state.curiosidadTab = cat.id; render(); }
      };
      dayCard.addEventListener('click', openDay);
      dayCard.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDay(); } });
    }

    // Global search + chips de categoría — filtran el mismo grid
    const allItems = buildAllCurioItems();
    const searchInput = page.querySelector('#discoGlobalSearch');
    const searchClear = page.querySelector('#discoGlobalClear');
    const resultsCount = page.querySelector('#discoveryResultsCount');
    const catGrid = page.querySelector('#discoCatGrid');

    const applyFilters = () => {
      const query = searchInput.value.trim().toLowerCase();
      const activeCat = DISCO_CATEGORIES.find(c => c.id === state.discoCat);
      let filtered = allItems;
      if (activeCat) {
        filtered = filtered.filter(item =>
          (item.tags || []).some(t => activeCat.match.some(m => t.includes(m)))
        );
      }
      if (query) {
        filtered = filtered.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.text.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          (item.tags || []).some(t => t.toLowerCase().includes(query))
        );
      }
      searchClear.style.display = query ? '' : 'none';
      if (query || activeCat) {
        updateResultsCount(filtered.length, allItems.length, resultsCount);
        renderSearchResults(catGrid, filtered);
      } else {
        updateResultsCount(allItems.length, allItems.length, resultsCount);
        restoreCategoryGrid(catGrid);
      }
    };

    updateResultsCount(allItems.length, allItems.length, resultsCount);
    // Si hay un chip activo persistido (p. ej. al volver a la página), aplicarlo
    if (state.discoCat !== 'todas') applyFilters();

    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 150);
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      applyFilters();
      searchInput.focus();
    });
    page.querySelectorAll('.disco-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const wasActive = chip.classList.contains('is-active');
        page.querySelectorAll('.disco-filter-chip').forEach(c => {
          c.classList.remove('is-active');
          c.setAttribute('aria-selected', 'false');
        });
        if (!wasActive) {
          chip.classList.add('is-active');
          chip.setAttribute('aria-selected', 'true');
          state.discoCat = chip.dataset.discoCat;
        } else {
          state.discoCat = 'todas';
        }
        applyFilters();
      });
    });
  }

  function renderCategoryCard(cat, index) {
    const img = cat.heroImg;
    const delay = index * 0.08;
    return `<button class="disco-cat-card card animate-in" style="--enter-delay:${delay}s;--disco-color:${cat.accentColor}" data-cat="${cat.id}">
      <div class="disco-cat-visual">
        ${img
          ? `<img src="${img}" alt="${cat.title}" loading="lazy" decoding="async">`
          : `<div class="disco-cat-emoji-wrap"><span class="disco-cat-emoji">${cat.emoji}</span></div>`
        }
      </div>
      <div class="disco-cat-body">
        <div class="disco-cat-header">
          <span class="disco-cat-icon" style="color:${cat.accentColor}">${ICON_SVGS[cat.iconKey] || ''}</span>
          <h3 class="disco-cat-title">${cat.title}</h3>
        </div>
        <p class="disco-cat-desc">${cat.desc}</p>
        <span class="disco-cat-count">${cat.statsCount} curiosidades</span>
      </div>
    </button>`;
  }

  function bindCategoryCardClicks(container) {
    container.querySelectorAll('.disco-cat-card').forEach(card => {
      card.addEventListener('click', () => {
        state.curiosidadTab = card.dataset.cat;
        render();
      });
    });
  }

  // Re-render the category grid (after clearing a search) and animate it in
  function restoreCategoryGrid(catGrid) {
    catGrid.innerHTML = CATEGORIES.map((cat, i) => renderCategoryCard(cat, i)).join('');
    bindCategoryCardClicks(catGrid);
    requestAnimationFrame(() => {
      catGrid.querySelectorAll('.disco-cat-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  }

  function renderSearchResults(grid, items) {
    const catColors = { 'San Juan Pueblo': 'var(--theme-accent-primary)', 'San Petersburgo': '#818cf8', 'Gatos': '#f59e0b' };
    const catEmojis = { 'San Juan Pueblo': '🏔️', 'San Petersburgo': '🚢', 'Gatos': '🐱' };
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">🔍 No se encontraron resultados. Prueba con otras palabras.</div>';
      return;
    }
    grid.innerHTML = items.map((item, i) => {
      const catColor = catColors[item.category] || 'var(--theme-accent-primary)';
      const catEmoji = catEmojis[item.category] || '✦';
      return `<article class="disco-search-card card animate-in" style="--enter-delay:${i * 40}ms;--disco-color:${catColor}">
        <div class="disco-search-accent"></div>
        <div class="disco-search-header">
          <span class="disco-search-icon" style="color:${catColor}">${ICON_SVGS[item.icon] || '✦'}</span>
          <div>
            <h4 class="disco-search-title">${escapeHtml(item.title)}</h4>
            <span class="disco-search-cat" style="color:${catColor}">${catEmoji} ${escapeHtml(item.category)}</span>
          </div>
        </div>
        <p class="disco-search-text">${escapeHtml(item.text.slice(0, 180))}${item.text.length > 180 ? '…' : ''}</p>
      </article>`;
    }).join('');
    requestAnimationFrame(() => {
      grid.querySelectorAll('.disco-search-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  }

  // ==========================================
  // CATEGORY DETAIL VIEW
  // ==========================================
  function renderCuriosidadesCategory(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) { state.curiosidadTab = 'landing'; render(); return; }

    const catColor = cat.accentColor;

    let contentHTML = '';
    if (catId === 'spb') {
      contentHTML = renderSPBDetail(catColor);
    } else if (catId === 'sp') {
      contentHTML = renderSanPetersburgoDetail(catColor);
    } else if (catId === 'gatos') {
      contentHTML = renderGatosDetail(catColor);
    }

    page.innerHTML = `<div class="rincon-subpage">
      <div class="disco-breadcrumb">
        <button class="disco-breadcrumb-item">El Rincón</button>
        <span class="disco-breadcrumb-sep">/</span>
        <button class="disco-breadcrumb-item" id="discoBackToLanding">Curiosidades</button>
        <span class="disco-breadcrumb-sep">/</span>
        <span class="disco-breadcrumb-current">${cat.title}</span>
        <span class="disco-breadcrumb-count">${cat.statsCount} datos</span>
      </div>
      ${contentHTML}
      ${renderRecommendations(catId)}
    </div>`;

    // Breadcrumb nav
    page.querySelectorAll('.disco-breadcrumb-item').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (i === 0) { state.view = 'landing'; state.curiosidadTab = 'landing'; }
        else { state.curiosidadTab = 'landing'; }
        render();
      });
    });

    // Recommendation cards
    page.querySelectorAll('.disco-reco-card').forEach(card => {
      card.addEventListener('click', () => {
        state.curiosidadTab = card.dataset.cat;
        render();
      });
    });

    // Animate visible cards
    requestAnimationFrame(() => {
      page.querySelectorAll('.disco-stat-card.animate-in, .disco-tl-card.animate-in, .disco-curio-card.animate-in, .disco-chip.animate-in').forEach(el => el.classList.add('visible'));
    });

    // Galería de fotos → lightbox
    page.querySelectorAll('.disco-gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        const all = [...page.querySelectorAll('.disco-gallery-item')];
        const items = all.map(el => ({
          type: 'image',
          src: el.dataset.src,
          caption: el.querySelector('.disco-gallery-caption')?.textContent || ''
        }));
        const idx = all.findIndex(el => el === item);
        if (items.length) openLightbox(items, Math.max(0, idx));
      });
    });

    // Datos destacados → visor individual (clic en cualquier dato abre el visor)
    const datoList = getCategoryDatos(catId);
    if (datoList.length) {
      page.querySelectorAll('.disco-dato-open, .disco-dato-featured').forEach(el => {
        el.addEventListener('click', () => openDatoViewer(datoList, Number(el.dataset.index)));
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDatoViewer(datoList, Number(el.dataset.index)); } });
      });
    }

    // Anatomía felina → visor individual (enciclopedia de gatos)
    const anatomiaList = (CURIOSIDADES_DATA.gatos?.anatomia || []).map((a, i) => ({ icon: a.icon, title: a.titulo, text: a.texto, num: i + 1 }));
    if (anatomiaList.length) {
      page.querySelectorAll('.disco-anatomy-hot').forEach(hot => {
        const open = () => openDatoViewer(anatomiaList, Number(hot.dataset.anatomyIndex));
        hot.addEventListener('click', open);
        hot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }
  }

  function renderIntroHero(catColor, iconKey, title, subtitle, intro, heroImg) {
    return `<header class="disco-intro-hero" style="--disco-color:${catColor}">
      ${heroImg ? `<div class="disco-intro-img"><img src="${heroImg}" alt="" loading="eager" decoding="async"></div>` : ''}
      <div class="disco-intro-body">
        <span class="disco-intro-icon" style="color:${catColor}">${ICON_SVGS[iconKey] || ''}</span>
        <h2 class="disco-intro-title">${title}</h2>
        ${subtitle ? `<p class="disco-intro-subtitle">${subtitle}</p>` : ''}
        <p class="disco-intro-text">${intro}</p>
      </div>
    </header>`;
  }

  function renderStatsGrid(quickStats, catColor) {
    return `<div class="disco-stats-grid">
      ${quickStats.map((s, i) => `<article class="disco-stat-card card animate-in" style="--enter-delay:${i * 60}ms;--disco-color:${catColor}">
        <div class="disco-stat-icon" style="color:${catColor}">${ICON_SVGS[s.icon] || '✦'}</div>
        <strong class="disco-stat-value">${s.label}</strong>
        <small class="disco-stat-sub">${s.sub}</small>
      </article>`).join('')}
    </div>`;
  }

  function renderTimeline(timeline, catColor) {
    return `<section class="disco-section">
      <h3 class="disco-section-title">Cronología</h3>
      <div class="disco-timeline">
        ${timeline.map((t, i) => `<article class="disco-tl-card animate-in" style="--enter-delay:${i * 80}ms;--disco-color:${catColor}">
          <span class="disco-tl-dot"></span>
          <div class="disco-tl-content">
            <span class="disco-tl-year">${t.year}</span>
            <p class="disco-tl-text">${t.desc}</p>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }

  function renderPhotoGallery(images, catColor, label, captions) {
    if (!Array.isArray(images) || !images.length) return '';
    return `<section class="disco-section">
      <h3 class="disco-section-title">${label}</h3>
      <div class="disco-gallery">
        ${images.map((src, i) => `
          <button type="button" class="disco-gallery-item" data-src="${src}" style="--disco-color:${catColor}" aria-label="Ver foto ampliada${captions?.[i] ? ': ' + escapeHtml(captions[i]) : ''}">
            <img src="${src}" alt="${captions?.[i] ? escapeHtml(captions[i]) : ''}" loading="lazy">
            ${captions?.[i] ? `<span class="disco-gallery-caption">${escapeHtml(captions[i])}</span>` : ''}
          </button>`).join('')}
      </div>
    </section>`;
  }

  function renderChips(items, catColor, label) {
    return `<section class="disco-section">
      <h3 class="disco-section-title">${label}</h3>
      <div class="disco-chips">
        ${items.map((item, i) => `<span class="disco-chip animate-in" style="--enter-delay:${i * 40}ms;--disco-color:${catColor}">${typeof item === 'string' ? (ICON_SVGS['utensils-crossed'] + ' ' + item) : (ICON_SVGS[item.icon] + ' ' + (item.titulo || item.title))}</span>`).join('')}
      </div>
    </section>`;
  }

  // Raza → tarjeta con foto real, origen y dato corto (enciclopedia gatuna)
  function renderRazas(razas, catColor) {
    if (!Array.isArray(razas) || !razas.length) return '';
    return `<section class="disco-section">
      <h3 class="disco-section-title">Razas felinas</h3>
      <div class="disco-razas-grid">
        ${razas.map((r, i) => `<article class="disco-raza-card card animate-in" style="--enter-delay:${i * 50}ms;--disco-color:${catColor}">
          <div class="disco-raza-img">
            <img src="${r.img}" alt="Gato de raza ${escapeHtml(r.nombre)}" loading="lazy">
          </div>
          <div class="disco-raza-body">
            <h4 class="disco-raza-nombre">${escapeHtml(r.nombre)}</h4>
            <span class="disco-raza-origen">${ICON_SVGS['map-pin'] || '📍'} ${escapeHtml(r.origen)}</span>
            <p class="disco-raza-dato">${escapeHtml(r.dato)}</p>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }

  // Gatos famosos → tarjetas horizontales con foto (enciclopedia gatuna)
  function renderFamosos(famosos, catColor) {
    if (!Array.isArray(famosos) || !famosos.length) return '';
    return `<section class="disco-section">
      <h3 class="disco-section-title">Gatos famosos</h3>
      <div class="disco-famosos-list">
        ${famosos.map((f, i) => `<article class="disco-famoso-card card animate-in" style="--enter-delay:${i * 60}ms;--disco-color:${catColor}">
          <div class="disco-famoso-img">
            <img src="${f.img}" alt="${escapeHtml(f.nombre)}" loading="lazy">
          </div>
          <div class="disco-famoso-body">
            <h4 class="disco-famoso-nombre">${ICON_SVGS['crown'] || '👑'} ${escapeHtml(f.nombre)}</h4>
            <p class="disco-famoso-dato">${escapeHtml(f.dato)}</p>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }

  // Datos de una colección para el visor (icono + título + texto reales)
  function getCategoryDatos(catId) {
    if (catId === 'spb') return (SPB_DATA?.curiosidades || []).map((d, i) => ({ icon: d.icon, title: d.titulo, text: d.texto, num: i + 1 }));
    if (catId === 'sp') return (CURIOSIDADES_DATA.sanPetersburgo?.datos || []).map((d, i) => ({ icon: d.icon, title: d.titulo, text: d.texto, num: i + 1 }));
    if (catId === 'gatos') return (CURIOSIDADES_DATA.gatos?.datos || []).map((d, i) => ({ icon: d.icon, title: d.titulo, text: d.texto, num: i + 1 }));
    return [];
  }

  // Datos destacados: primer dato protagonista (01) + lista numerada compacta
  function renderDatosDestacados(items, catColor, label) {
    if (!items.length) return '';
    // Normalizar campos (datos crudos usan titulo/texto)
    const normalized = items.map((d, i) => ({ icon: d.icon, title: d.titulo || d.title, text: d.texto || d.text, num: i + 1 }));
    const pad = (n) => String(n).padStart(2, '0');
    const [first, ...rest] = normalized;
    return `<section class="disco-section">
      <h3 class="disco-section-title">${label}</h3>
      <article class="disco-dato-featured card animate-in" style="--disco-color:${catColor}" role="button" tabindex="0" data-index="0" aria-label="Abrir dato: ${escapeHtml(first.title)}">
        <span class="disco-dato-featured-num">${pad(1)}</span>
        <div class="disco-dato-featured-icon" style="color:${catColor}">${ICON_SVGS[first.icon] || '✦'}</div>
        <h4 class="disco-dato-featured-title">${escapeHtml(first.title)}</h4>
        <p class="disco-dato-featured-text">${escapeHtml(first.text)}</p>
        <span class="disco-dato-open-hint">${ICON_SVGS['arrow-right'] || '→'} Leer</span>
      </article>
      <div class="disco-dato-list">
        ${rest.map((d, i) => `<article class="disco-dato-open card animate-in" style="--enter-delay:${(i + 1) * 60}ms;--disco-color:${catColor}" role="button" tabindex="0" data-index="${i + 1}" aria-label="Abrir dato: ${escapeHtml(d.title)}">
          <span class="disco-dato-num">${pad(i + 2)}</span>
          <span class="disco-dato-icon" style="color:${catColor}">${ICON_SVGS[d.icon] || '✦'}</span>
          <div class="disco-dato-body">
            <h4 class="disco-dato-title">${escapeHtml(d.title)}</h4>
            <p class="disco-dato-text">${escapeHtml((d.text || '').slice(0, 110))}${(d.text || '').length > 110 ? '…' : ''}</p>
          </div>
          ${ICON_SVGS['chevron-right'] || '›'}
        </article>`).join('')}
      </div>
    </section>`;
  }

  // ==========================================
  // ESCENAS SVG ANIMADAS (Curiosidades) — postales vivas
  // ==========================================
  function renderSceneSVG(kind) {
    if (kind === 'spb') return renderSceneRio();
    if (kind === 'sp') return renderScenePuente();
    if (kind === 'gatos') return renderSceneGato();
    return '';
  }

  // Río San Juan: palmeras, montañas y agua que fluye + pulso sísmico
  function renderSceneRio() {
    return `<div class="disco-scene" aria-hidden="true">
      <svg class="disco-scene-svg" viewBox="0 0 600 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="El río San Juan">
        <defs>
          <linearGradient id="rioSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a3"/><stop offset="1" stop-color="#ffb98a"/></linearGradient>
          <linearGradient id="rioWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa0c9"/><stop offset="1" stop-color="#1c5d7c"/></linearGradient>
        </defs>
        <rect width="600" height="250" fill="url(#rioSky)"/>
        <circle class="rio-sun" cx="512" cy="58" r="34" fill="#fff3c4"/>
        <path d="M0 168 L95 78 L190 168 Z" fill="#9cbfa2" opacity="0.75"/>
        <path d="M140 168 L270 62 L400 168 Z" fill="#79a68a" opacity="0.85"/>
        <path d="M330 168 L470 84 L610 168 Z" fill="#9cbfa2" opacity="0.7"/>
        <rect y="168" width="600" height="82" fill="url(#rioWater)"/>
        <g class="rio-wave" stroke="#bfe6f2" stroke-width="5" stroke-linecap="round" fill="none">
          <path d="M-40 196 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
          <path d="M-40 226 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
        </g>
        <g class="rio-wave rio-wave--slow" stroke="#7fc3de" stroke-width="4" stroke-linecap="round" fill="none">
          <path d="M-40 212 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
        </g>
        <g class="palm" transform="translate(96 168)">
          <path d="M0 0 C -4 -34 -4 -66 4 -92" stroke="#7a4b2b" stroke-width="12" fill="none" stroke-linecap="round"/>
          <g class="palm-fronds">
            <path d="M6 -88 C -28 -104 -58 -96 -74 -72" stroke="#3e8f5e" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M6 -88 C 36 -108 70 -100 86 -74" stroke="#4aa56c" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C -10 -122 -34 -132 -58 -128" stroke="#388657" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C 24 -122 50 -130 74 -122" stroke="#449b64" stroke-width="10" fill="none" stroke-linecap="round"/>
          </g>
          <circle cx="42" cy="-34" r="11" fill="#2f7a4d"/>
        </g>
        <g class="palm" transform="translate(508 168) scale(0.78)">
          <path d="M0 0 C -4 -34 -4 -66 4 -92" stroke="#7a4b2b" stroke-width="12" fill="none" stroke-linecap="round"/>
          <g class="palm-fronds">
            <path d="M6 -88 C -28 -104 -58 -96 -74 -72" stroke="#3e8f5e" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M6 -88 C 36 -108 70 -100 86 -74" stroke="#4aa56c" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C -10 -122 -34 -132 -58 -128" stroke="#388657" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C 24 -122 50 -130 74 -122" stroke="#449b64" stroke-width="10" fill="none" stroke-linecap="round"/>
          </g>
          <circle cx="42" cy="-34" r="11" fill="#2f7a4d"/>
        </g>
        <g class="sismo-ring" stroke="#ff8a8a" stroke-width="4" fill="none"><circle cx="562" cy="208" r="9"/></g>
        <g class="sismo-ring sismo-ring--2" stroke="#ffb199" stroke-width="3" fill="none"><circle cx="562" cy="208" r="9"/></g>
      </svg>
      <span class="disco-scene-label">🌊 El río San Juan · un pulso de vida</span>
    </div>`;
  }

  // Puente levadizo del Neva: se abre de madrugada y pasa un barco
  function renderScenePuente() {
    return `<div class="disco-scene" aria-hidden="true">
      <svg class="disco-scene-svg" viewBox="0 0 600 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Puente levadizo de San Petersburgo">
        <defs>
          <linearGradient id="spSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141c3a"/><stop offset="1" stop-color="#3a4a7a"/></linearGradient>
          <linearGradient id="spWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2c55"/><stop offset="1" stop-color="#0d1630"/></linearGradient>
        </defs>
        <rect width="600" height="250" fill="url(#spSky)"/>
        <circle class="sp-moon" cx="508" cy="54" r="26" fill="#e8ecff"/>
        <g class="sp-stars" fill="#cfd8ff">
          <circle cx="60" cy="42" r="2"/><circle cx="140" cy="80" r="1.6"/><circle cx="220" cy="30" r="2.2"/><circle cx="330" cy="66" r="1.8"/><circle cx="420" cy="28" r="2"/>
        </g>
        <g fill="#223056" opacity="0.92">
          <rect x="0" y="150" width="70" height="60"/><rect x="70" y="128" width="50" height="82"/><rect x="120" y="150" width="60" height="60"/>
          <rect x="420" y="140" width="60" height="70"/><rect x="480" y="150" width="50" height="60"/><rect x="530" y="118" width="70" height="92"/>
        </g>
        <rect y="196" width="600" height="54" fill="url(#spWater)"/>
        <g class="rio-wave sp-wave" stroke="#4a6cb5" stroke-width="4" stroke-linecap="round" fill="none">
          <path d="M-40 212 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
          <path d="M-40 234 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
        </g>
        <rect x="138" y="150" width="22" height="46" fill="#8f9bc0"/>
        <rect x="440" y="150" width="22" height="46" fill="#8f9bc0"/>
        <g class="sp-deck sp-deck--left"><rect x="160" y="182" width="140" height="9" rx="4" fill="#aeb8d8"/></g>
        <g class="sp-deck sp-deck--right"><rect x="300" y="182" width="140" height="9" rx="4" fill="#aeb8d8"/></g>
        <g class="sp-ship">
          <path d="M0 0 h56 l-8 18 h-40 z" fill="#cfd8ff"/>
          <path d="M36 -26 l16 26 h-32 z" fill="#ffffff"/>
          <path d="M0 12 h56" stroke="#8f9bc0" stroke-width="5"/>
        </g>
        <g class="sp-snow" fill="#dfe6ff">
          <circle cx="70" cy="20" r="3"/><circle cx="180" cy="120" r="2.5"/><circle cx="260" cy="40" r="3"/>
          <circle cx="370" cy="150" r="2.5"/><circle cx="470" cy="90" r="3"/><circle cx="540" cy="140" r="2.2"/>
        </g>
      </svg>
      <span class="disco-scene-label">🌉 Puentes que se abren de madrugada</span>
    </div>`;
  }

  // Gato animado: parpadea, mueve la cola, ronronea y suelta corazones
  function renderSceneGato() {
    return `<div class="disco-scene" aria-hidden="true">
      <svg class="disco-scene-svg disco-scene-svg--gato" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Gato ronroneando">
        <defs>
          <radialGradient id="gatoBg" cx="0.5" cy="0.3" r="0.9"><stop offset="0" stop-color="#3d2b52"/><stop offset="1" stop-color="#191228"/></radialGradient>
        </defs>
        <rect width="600" height="300" fill="url(#gatoBg)"/>
        <circle class="gato-moon" cx="488" cy="64" r="34" fill="#ffe9a8"/>
        <g class="sp-stars" fill="#e8d9ff">
          <circle cx="80" cy="50" r="2"/><circle cx="200" cy="90" r="1.6"/><circle cx="330" cy="40" r="2.2"/><circle cx="430" cy="100" r="1.8"/>
        </g>
        <ellipse cx="300" cy="276" rx="152" ry="22" fill="#4b3666"/>
        <ellipse cx="300" cy="270" rx="142" ry="17" fill="#5d4680"/>
        <g class="gato-tail"><path d="M300 240 C 380 238 410 150 382 118" stroke="#6a5490" stroke-width="22" fill="none" stroke-linecap="round"/></g>
        <ellipse cx="300" cy="238" rx="96" ry="74" fill="#6a5490"/>
        <ellipse cx="300" cy="258" rx="70" ry="38" fill="#7c64a4"/>
        <ellipse cx="266" cy="296" rx="20" ry="12" fill="#5d4680"/>
        <ellipse cx="334" cy="296" rx="20" ry="12" fill="#5d4680"/>
        <circle cx="300" cy="148" r="60" fill="#6a5490"/>
        <path d="M252 108 L262 52 L302 94 Z" fill="#6a5490"/>
        <path d="M262 98 L269 66 L294 92 Z" fill="#f2b8c6"/>
        <path d="M348 108 L338 52 L298 94 Z" fill="#6a5490"/>
        <path d="M338 98 L331 66 L306 92 Z" fill="#f2b8c6"/>
        <g class="gato-eyes">
          <ellipse cx="274" cy="146" rx="10" ry="12" fill="#ffd166"/>
          <ellipse cx="274" cy="146" rx="4" ry="10" fill="#191228"/>
          <ellipse cx="326" cy="146" rx="10" ry="12" fill="#ffd166"/>
          <ellipse cx="326" cy="146" rx="4" ry="10" fill="#191228"/>
        </g>
        <path d="M296 162 l4 8 l4 -8 z" fill="#f2b8c6"/>
        <path d="M289 172 q6 6 11 0 M300 172 q6 6 11 0" stroke="#c9a7d8" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g class="gato-whiskers" stroke="#cbb4e2" stroke-width="3" stroke-linecap="round">
          <line x1="272" y1="162" x2="238" y2="156"/><line x1="272" y1="168" x2="238" y2="170"/>
          <line x1="328" y1="162" x2="362" y2="156"/><line x1="328" y1="168" x2="362" y2="170"/>
        </g>
        <g class="gato-purr" stroke="#ffd166" fill="none" stroke-width="4" stroke-linecap="round">
          <path d="M338 228 q14 -8 14 -22"/><path d="M338 228 q22 -6 24 -24"/>
        </g>
        <g class="gato-heart" fill="#ff8aa1"><path d="M300 40 c-6 -8 -18 -4 -18 4 c0 6 18 12 18 12 s18 -6 18 -12 c0 -8 -12 -12 -18 -4z"/></g>
        <g class="gato-heart gato-heart--2" fill="#ffb3c1"><path d="M352 24 c-5 -6 -14 -3 -14 3 c0 5 14 9 14 9 s14 -4 14 -9 c0 -6 -9 -9 -14 -3z"/></g>
      </svg>
      <span class="disco-scene-label">😻 RRRrrr… ronroneo terapéutico</span>
    </div>`;
  }

  // ==========================================
  // ENCICLOPEDIA — Anatomía felina interactiva
  // ==========================================
  function renderCatAnatomy(anatomia, catColor) {
    if (!Array.isArray(anatomia) || !anatomia.length) return '';
    const hotspots = anatomia.map((a, i) => `
      <g class="disco-anatomy-hot" data-anatomy-index="${i}" role="button" tabindex="0" transform="translate(${a.x} ${a.y})" aria-label="Abrir: ${escapeHtml(a.titulo)}">
        <circle class="disco-anatomy-hot-ring" r="17" fill="none" stroke="${catColor}" stroke-width="2.5"/>
        <circle class="disco-anatomy-hot-dot" r="13" fill="${catColor}"/>
        <text text-anchor="middle" dy="4.5" font-size="13" font-weight="700" fill="#0a0a0c">${i + 1}</text>
      </g>`).join('');
    return `<section class="disco-section">
      <h3 class="disco-section-title">Anatomía felina · toca cada parte</h3>
      <div class="disco-anatomy-wrap card">
        <svg class="disco-anatomy-svg" viewBox="0 0 480 360" role="img" aria-label="Diagrama de anatomía de un gato">
          <ellipse cx="240" cy="330" rx="200" ry="20" fill="rgba(0,0,0,0.28)"/>
          <path d="M348 250 C 396 246 410 120 394 92 C 408 130 398 244 356 252 Z" fill="#43435a"/>
          <ellipse cx="248" cy="230" rx="114" ry="68" fill="#4b4b63"/>
          <ellipse cx="232" cy="252" rx="72" ry="40" fill="#5c5c78"/>
          <rect x="200" y="278" width="26" height="54" rx="12" fill="#3c3c52"/>
          <rect x="240" y="282" width="26" height="50" rx="12" fill="#3c3c52"/>
          <path d="M60 90 L72 42 L104 78 Z" fill="#4b4b63"/>
          <path d="M72 84 L78 56 L96 78 Z" fill="#f2b8c6"/>
          <circle cx="98" cy="120" r="46" fill="#4b4b63"/>
          <circle cx="78" cy="112" r="6" fill="#ffd166"/>
          <circle cx="78" cy="112" r="3" fill="#191228"/>
          <path d="M118 120 l9 7 l-9 7 z" fill="#f2b8c6"/>
          <g stroke="#cbb4e2" stroke-width="2.5" stroke-linecap="round">
            <line x1="124" y1="130" x2="168" y2="124"/><line x1="124" y1="136" x2="170" y2="136"/><line x1="124" y1="142" x2="168" y2="148"/>
          </g>
          <g stroke="#7c64a4" stroke-width="3" stroke-linecap="round">
            <path d="M180 200 q8 -4 8 -14"/><path d="M180 200 q14 -4 16 -18"/>
          </g>
          <g stroke="#5c5c78" stroke-width="4" stroke-linecap="round">
            <path d="M300 190 q6 -2 6 -8"/><path d="M300 190 q12 -1 13 -10"/>
          </g>
          ${hotspots}
        </svg>
      </div>
    </section>`;
  }

  // Visor de dato individual: 01/N, anterior/siguiente, swipe, Escape
  function openDatoViewer(items, index) {
    const existing = document.querySelector('.disco-viewer-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'disco-viewer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Visor de curiosidad');
    overlay.innerHTML = `
      <div class="disco-viewer-card card">
        <button class="disco-viewer-close" aria-label="Cerrar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <span class="disco-viewer-count"></span>
        <span class="disco-viewer-icon"></span>
        <h3 class="disco-viewer-title"></h3>
        <p class="disco-viewer-text"></p>
        <div class="disco-viewer-nav">
          <button class="disco-viewer-prev" aria-label="Anterior">${ICON_SVGS['chevron-left'] || '←'} Anterior</button>
          <button class="disco-viewer-next" aria-label="Siguiente">Siguiente ${ICON_SVGS['chevron-right'] || '→'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const countEl = overlay.querySelector('.disco-viewer-count');
    const iconEl = overlay.querySelector('.disco-viewer-icon');
    const titleEl = overlay.querySelector('.disco-viewer-title');
    const textEl = overlay.querySelector('.disco-viewer-text');
    const prevBtn = overlay.querySelector('.disco-viewer-prev');
    const nextBtn = overlay.querySelector('.disco-viewer-next');
    const pad = (n) => String(n).padStart(2, '0');
    let current = Math.min(Math.max(index, 0), items.length - 1);

    const show = () => {
      const d = items[current];
      countEl.textContent = `${pad(current + 1)} / ${pad(items.length)}`;
      iconEl.innerHTML = ICON_SVGS[d.icon] || '✦';
      titleEl.textContent = d.title;
      textEl.textContent = d.text;
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === items.length - 1;
    };
    // El visor usa textContent (seguro por defecto); nada que escapar.
    const nav = (dir) => {
      const next = current + dir;
      if (next < 0 || next >= items.length) return;
      current = next;
      show();
    };
    const close = () => { overlay.remove(); if (datoViewerKeyHandler) document.removeEventListener('keydown', datoViewerKeyHandler); datoViewerKeyHandler = null; };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    };
    if (datoViewerKeyHandler) document.removeEventListener('keydown', datoViewerKeyHandler);
    datoViewerKeyHandler = onKey;
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    prevBtn.addEventListener('click', () => nav(-1));
    nextBtn.addEventListener('click', () => nav(1));
    overlay.querySelector('.disco-viewer-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    // Swipe táctil
    let touchX = null;
    overlay.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) nav(dx < 0 ? 1 : -1);
      touchX = null;
    }, { passive: true });

    show();
  }

  function renderSPBDetail(catColor) {
    const spb = SPB_DATA;
    return `
      ${renderIntroHero(catColor, 'mountain', 'San Juan Pueblo', 'Atlántida, Honduras', spb.intro, spb.galeriaSPB?.[0]?.src || '')}
      ${renderSceneSVG('spb')}
      ${renderPhotoGallery((spb.galeriaSPB || []).map(p => p.src).filter(Boolean), catColor, 'Galería', (spb.galeriaSPB || []).map(p => p.caption))}
      ${renderStatsGrid(spb.quickStats, catColor)}
      ${renderTimeline(spb.timeline, catColor)}
      ${renderDatosDestacados(spb.curiosidades, catColor, 'Curiosidades')}
      ${renderChips(spb.comidas, catColor, 'Comidas típicas')}
    `;
  }

  function renderSanPetersburgoDetail(catColor) {
    const sp = CURIOSIDADES_DATA.sanPetersburgo;
    const gallery = (sp.galeria || []).map(p => p.src).filter(Boolean);
    const captions = (sp.galeria || []).map(p => p.caption);
    return `
      ${renderIntroHero(catColor, 'ship', sp.title, sp.subtitle, sp.intro, gallery[0] || '')}
      ${renderSceneSVG('sp')}
      ${renderPhotoGallery(gallery.length ? gallery : SPB_IMG, catColor, 'Galería', captions.length ? captions : SPB_CAPTIONS)}
      ${renderStatsGrid(sp.quickStats, catColor)}
      ${renderDatosDestacados(sp.datos, catColor, 'Datos destacados')}
    `;
  }

  function renderGatosDetail(catColor) {
    const g = CURIOSIDADES_DATA.gatos;
    return `
      ${renderIntroHero(catColor, 'cat', g.title, g.subtitle, g.intro, GATO_IMG[0] || '')}
      ${renderSceneSVG('gatos')}
      ${renderCatAnatomy(g.anatomia, catColor)}
      ${renderRazas(g.razas, catColor)}
      ${renderFamosos(g.famosos, catColor)}
      ${renderPhotoGallery(GATO_IMG, catColor, 'Galería', GATO_CAPTIONS)}
      ${renderStatsGrid(g.quickStats, catColor)}
      ${renderDatosDestacados(g.datos, catColor, 'Datos destacados')}
    `;
  }

  function renderRecommendations(currentCatId) {
    const others = CATEGORIES.filter(c => c.id !== currentCatId);
    if (!others.length) return '';
    return `<section class="disco-recommendations">
      <h3 class="disco-section-title">También podría interesarte</h3>
      <div class="disco-reco-grid">
        ${others.map(c => `<button class="disco-reco-card card" data-cat="${c.id}">
          <span class="disco-reco-emoji">${c.emoji}</span>
          <div>
            <span class="disco-reco-title">${c.title}</span>
            <span class="disco-reco-count">${c.statsCount} datos</span>
          </div>
          ${ICON_SVGS['arrow-right']}
        </button>`).join('')}
      </div>
    </section>`;
  }

  function buildAllCurioItems() {
    const items = [];
    const spb = SPB_DATA;
    items.push({ id: 'spb-intro', catId: 'spb', category: 'San Juan Pueblo', icon: 'map-pin', title: 'San Juan Pueblo, Atlántida', text: spb.intro, tags: ['honduras', 'atlántida', 'pueblo', 'río'] });
    spb.quickStats.forEach(s => items.push({ id: 'spb-stat-' + s.label, catId: 'spb', category: 'San Juan Pueblo', icon: s.icon, title: s.label, text: s.sub, tags: ['estadística', 'dato'] }));
    spb.timeline.forEach(t => items.push({ id: 'spb-tl-' + t.year, catId: 'spb', category: 'San Juan Pueblo', icon: 'history', title: t.year, text: t.desc, tags: ['historia', 'cronología'] }));
    spb.curiosidades.forEach(c => items.push({ id: 'spb-cur-' + c.titulo, catId: 'spb', category: 'San Juan Pueblo', icon: c.icon, title: c.titulo, text: c.texto, tags: ['curiosidad', 'dato'] }));
    spb.comidas.forEach(c => items.push({ id: 'spb-food-' + c, catId: 'spb', category: 'San Juan Pueblo', icon: 'utensils-crossed', title: c, text: 'Comida típica hondureña', tags: ['comida', 'gastronomía'] }));
    const sp = CURIOSIDADES_DATA.sanPetersburgo;
    items.push({ id: 'sp-intro', catId: 'sp', category: 'San Petersburgo', icon: 'ship', title: sp.title, text: sp.intro, tags: ['rusia', 'imperial', 'ciudad'] });
    sp.quickStats.forEach(s => items.push({ id: 'sp-stat-' + s.label, catId: 'sp', category: 'San Petersburgo', icon: s.icon, title: s.label, text: s.sub, tags: ['estadística', 'dato'] }));
    sp.datos.forEach(d => items.push({ id: 'sp-dato-' + d.titulo, catId: 'sp', category: 'San Petersburgo', icon: d.icon, title: d.titulo, text: d.texto, tags: ['curiosidad', 'dato'] }));
    const g = CURIOSIDADES_DATA.gatos;
    items.push({ id: 'gatos-intro', catId: 'gatos', category: 'Datos Gatunos', icon: 'cat', title: g.title, text: g.intro, tags: ['felino', 'mascota', 'animal'] });
    g.quickStats.forEach(s => items.push({ id: 'gatos-stat-' + s.label, catId: 'gatos', category: 'Datos Gatunos', icon: s.icon, title: s.label, text: s.sub, tags: ['estadística', 'dato'] }));
    g.datos.forEach(d => items.push({ id: 'gatos-dato-' + d.titulo, catId: 'gatos', category: 'Datos Gatunos', icon: d.icon, title: d.titulo, text: d.texto, tags: ['curiosidad', 'dato'] }));
    (g.anatomia || []).forEach(d => items.push({ id: 'gatos-anatomia-' + d.label, catId: 'gatos', category: 'Datos Gatunos', icon: d.icon, title: d.titulo, text: d.texto, tags: ['felino', 'anatomía', 'cuerpo', 'dato'] }));
    (g.razas || []).forEach(r => items.push({ id: 'gatos-raza-' + r.nombre, catId: 'gatos', category: 'Datos Gatunos', icon: 'cat', title: r.nombre, text: r.dato, tags: ['raza', 'felino', 'gato', r.origen] }));
    (g.famosos || []).forEach(f => items.push({ id: 'gatos-famoso-' + f.nombre, catId: 'gatos', category: 'Datos Gatunos', icon: 'crown', title: f.nombre, text: f.dato, tags: ['famoso', 'felino', 'gato', 'internet'] }));
    return items;
  }

  function updateResultsCount(shown, total, el) {
    if (!el) return;
    el.textContent = shown === total ? `${total} datos para explorar` : `${shown} de ${total} resultados`;
  }

  // ==========================================
  // AUDIOS — archivo cronológico del día 3
  // ==========================================

  const AUDIO_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const AUDIO_MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  /** Carga los audios una sola vez y los cachea en state. */
  async function loadAudios(force = false) {
    if (state.audiosLoaded && !force) return state.audios;
    state.audiosLoaded = true;
    try {
      const list = await db.getAudios();
      state.audios = Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn('[rincon] No se pudieron cargar los audios:', err?.message);
      state.audios = [];
    }
    return state.audios;
  }

  /** Audios agrupados por mes: { '2026-8': [audios...] } */
  function audiosByMonth() {
    const map = {};
    (state.audios || []).forEach(a => {
      const y = a.year || (a.date ? parseInt(String(a.date).slice(0, 4), 10) : 0);
      const m = a.month || (a.date ? parseInt(String(a.date).slice(5, 7), 10) : 0);
      if (!y || !m) return;
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }

  /**
   * Rango de meses a mostrar: desde el primer mes con audio (o el año actual)
   * hasta diciembre del año actual. Los meses futuros salen como bloqueados.
   */
  function audioMonthRange() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const map = audiosByMonth();
    let minYear = curYear;
    Object.keys(map).forEach(k => {
      const y = parseInt(k.split('-')[0], 10);
      if (y < minYear) minYear = y;
    });
    if (!minYear || minYear < 2000) minYear = curYear;

    const years = [];
    for (let y = minYear; y <= curYear; y++) years.push(y);
    return { years: years.reverse(), curYear, curMonth };
  }

  /** Estado de un mes: 'available' | 'future' | 'empty' */
  function audioMonthState(year, month, curYear, curMonth, has) {
    if (has) return 'available';
    if (year > curYear || (year === curYear && month > curMonth)) return 'future';
    return 'empty';
  }

  /** HTML de la pestaña Audios (vista de meses). Vive dentro de #galeriaMemesContent. */
  function renderAudiosTabContent() {
    if (state.audiosView === 'detail' && state.audiosMonth) {
      return renderAudioDetailContent(state.audiosMonth.year, state.audiosMonth.month);
    }

    const { years, curYear, curMonth } = audioMonthRange();
    const map = audiosByMonth();
    const total = state.audios.length;

    // Indicadores del año actual: cada mes un punto (● disponible, ○ otro)
    const dots = AUDIO_MONTHS_SHORT.map((label, i) => {
      const m = i + 1;
      const has = map[`${curYear}-${m}`]?.length > 0;
      return `<span class="audios-dot${has ? ' is-on' : ''}" title="${label} ${curYear}${has ? ' · audio disponible' : ''}">${label.slice(0, 1)}</span>`;
    }).join('');

    const yearBlocks = years.map(y => {
      const months = AUDIO_MONTHS.map((name, i) => {
        const m = i + 1;
        const list = map[`${y}-${m}`] || [];
        const st = audioMonthState(y, m, curYear, curMonth, list.length > 0);
        return renderAudioMonthCard(y, m, name, st, list);
      }).join('');
      return `
        <section class="audios-year" aria-label="${y}">
          <h3 class="audios-year-title">${y}</h3>
          <div class="audios-month-grid">${months}</div>
        </section>
      `;
    }).join('');

    // Selector de mes para subir (solo admin): los audios del día 3.
    // El mes actual aparece primero y preseleccionado (lo más común).
    const now = new Date();
    const uploadOptions = [];
    for (let back = 0; back <= 5; back++) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const selected = back === 0 ? ' selected' : '';
      uploadOptions.push(`<option value="${d.getFullYear()}-${d.getMonth() + 1}"${selected}>${AUDIO_MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`);
    }

    return `
      <div class="audios-page">
        <header class="audios-hero">
          <div class="audios-hero-icon">${ICON_SVGS['mic']}</div>
          <h1 class="audios-hero-title">Audios</h1>
          <p class="audios-hero-sub">Nuestros audios del día 3 🤍</p>
        </header>

        ${years.length > 1 ? `<div class="audios-dots" role="img" aria-label="Meses de ${curYear} con audio">${dots}</div>` : ''}

        ${total > 0 ? `<p class="audios-count">${total} audio${total === 1 ? '' : 's'} guardado${total === 1 ? '' : 's'} en nuestra cápsula del tiempo</p>` : ''}

        ${yearBlocks || '<div class="audios-empty"><p>Aquí guardaremos los audios que grabemos juntos cada día 3.</p></div>'}

        ${isAdmin ? `
          <div class="audios-upload">
            <div class="audios-upload-head">
              <button type="button" class="audios-upload-btn" id="audiosUploadBtn">＋ Subir audio</button>
              <label class="audios-upload-month">
                Mes
                <select id="audiosUploadMonth">${uploadOptions.join('')}</select>
              </label>
            </div>
            <p class="audios-upload-hint">Sube el audio grabado el día 3. Puedes añadir varios audios al mismo mes (voz de Darwin, voz de ella…). Se guarda en la web para todos.</p>
            <input type="file" id="audiosFileInput" accept="audio/*" multiple hidden>
            <div id="audiosUploadStatus" class="audios-upload-status" aria-live="polite"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderAudioMonthCard(y, m, name, st, list) {
    if (st === 'available') {
      const count = list.length;
      const first = list[0];
      return `
        <button class="audios-month audios-month--available" data-audio-month="${y}-${m}" aria-label="Escuchar audio de ${name} ${y}">
          <span class="audios-month-icon">${ICON_SVGS['mic']}</span>
          <span class="audios-month-name">${name} ${y}</span>
          <span class="audios-month-meta">${count === 1 ? '🎙️ Audio del día 3' : `${count} audios del día 3`}</span>
          <span class="audios-month-action">${ICON_SVGS['play']} Escuchar</span>
        </button>
      `;
    }
    if (st === 'future') {
      return `
        <div class="audios-month audios-month--future" aria-label="${name} ${y} · futuro">
          <span class="audios-month-icon">${ICON_SVGS['lock']}</span>
          <span class="audios-month-name">${name} ${y}</span>
          <span class="audios-month-meta">Disponible el día 3</span>
        </div>
      `;
    }
    return `
      <div class="audios-month audios-month--empty" aria-label="${name} ${y} · sin audio">
        <span class="audios-month-icon">—</span>
        <span class="audios-month-name">${name} ${y}</span>
        <span class="audios-month-meta">Sin audio</span>
      </div>
    `;
  }

  /** HTML del detalle de un mes (reproductores). Vive dentro de #galeriaMemesContent. */
  function renderAudioDetailContent(year, month) {
    const map = audiosByMonth();
    const list = map[`${year}-${month}`] || [];
    const name = AUDIO_MONTHS[month - 1] || 'Mes';

    const audioCards = list.map((a, i) => {
      const dateLabel = a.date ? formatAudioDate(a.date) : `${name} ${year}`;
      const title = a.title || (list.length > 1 ? `Audio ${i + 1}` : `Audio del ${dateLabel}`);
      const creator = a.creator ? `<span class="audios-player-creator">${ICON_SVGS['mic']} ${escapeHtml(a.creator)}</span>` : '';
      return `
        <article class="audios-player-card" data-audio-url="${escapeHtml(a.url || '')}" data-audio-title="${escapeHtml(title)}">
          <div class="audios-player-head">
            <div class="audios-player-icon">${ICON_SVGS['mic']}</div>
            <div class="audios-player-info">
              <h4 class="audios-player-title">${escapeHtml(title)}</h4>
              <p class="audios-player-date">${dateLabel}${creator ? ' · ' + creator : ''}</p>
            </div>
          </div>
          <audio preload="metadata" src="${escapeHtml(a.url || '')}"></audio>
          <div class="audios-player-controls">
            <button class="audios-play-btn" aria-label="Reproducir ${escapeHtml(title)}">${ICON_SVGS['play']}</button>
            <div class="audios-progress">
              <input type="range" class="audios-progress-bar" min="0" max="100" value="0" step="0.1" aria-label="Progreso">
              <div class="audios-time"><span class="audios-time-cur">0:00</span><span class="audios-time-dur">0:00</span></div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    return `
      <div class="audios-page">
        <button class="rincon-back-btn" data-back="months">${ICON_SVGS['chevron-left']} Todos los meses</button>
        <header class="audios-detail-hero">
          <div class="audios-detail-icon">${ICON_SVGS['mic']}</div>
          <h1 class="audios-hero-title">${name} ${year}</h1>
          <p class="audios-hero-sub">${list.length === 1 ? 'Audio del 3 de ' + name : `${list.length} audios del día 3`}</p>
        </header>
        <div class="audios-list">
          ${list.length ? audioCards : `<div class="audios-error"><p>Este mes no tiene audio guardado.</p></div>`}
        </div>
      </div>
    `;
  }

  /** Conecta los eventos de la pestaña Audios: meses, detalle, reproductores y subida. */
  function bindAudiosEvents(container) {
    if (!container) return;
    bindAudioPlayers(container);

    // Volver de detalle → meses
    container.querySelector('[data-back="months"]')?.addEventListener('click', () => {
      state.audiosView = 'months';
      state.audiosMonth = null;
      container.innerHTML = renderAudiosTabContent();
      bindAudiosEvents(container);
    });

    // Abrir el detalle de un mes con audio disponible
    container.querySelectorAll('[data-audio-month]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [y, m] = btn.dataset.audioMonth.split('-').map(Number);
        if (!y || !m) return;
        state.audiosView = 'detail';
        state.audiosMonth = { year: y, month: m };
        container.innerHTML = renderAudiosTabContent();
        bindAudiosEvents(container);
      });
    });

    // Subida de audio (solo admin): Cloudinary + guardado global para todos
    const uploadBtn = container.querySelector('#audiosUploadBtn');
    const fileInput = container.querySelector('#audiosFileInput');
    const monthSel = container.querySelector('#audiosUploadMonth');
    const statusEl = container.querySelector('#audiosUploadStatus');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const files = [...fileInput.files];
        fileInput.value = '';
        if (!files.length) return;
        const [selYear, selMonth] = (monthSel?.value || '').split('-').map(Number);
        const y = selYear || new Date().getFullYear();
        const m = selMonth || new Date().getMonth() + 1;
        const date = `${y}-${String(m).padStart(2, '0')}-03`;

        if (statusEl) {
          statusEl.textContent = 'Subiendo… 0/' + files.length;
          statusEl.classList.add('is-active');
        }
        const uploaded = [];
        const errors = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            const result = await uploadFile(file, {
              folder: 'personal-hub/audios',
              onProgress: () => {
                if (statusEl) statusEl.textContent = `Subiendo… ${i}/${files.length}`;
              }
            });
            const url = result.secure_url || result.url || '';
            if (!url) throw new Error('No se obtuvo la URL del audio');
            uploaded.push({
              id: db.generateId(),
              date,
              year: y,
              month: m,
              title: file.name.replace(/\.[^.]+$/, '') || 'Audio del día 3',
              url,
              creator: '',
              createdAt: new Date().toISOString()
            });
          } catch (err) {
            errors.push(file.name + ': ' + (err?.message || 'Error'));
          }
        }

        if (uploaded.length) {
          try {
            const next = [...state.audios, ...uploaded];
            await db.saveAudios(next);
            state.audios = next;
            if (statusEl) statusEl.textContent = `✓ ${uploaded.length} audio${uploaded.length === 1 ? '' : 's'} guardado${uploaded.length === 1 ? '' : 's'} en la web`;
            showToast(`${uploaded.length} ${uploaded.length === 1 ? 'audio subido' : 'audios subidos'} ✓`, 'success');
            container.innerHTML = renderAudiosTabContent();
            bindAudiosEvents(container);
          } catch (err) {
            if (statusEl) statusEl.textContent = '⚠ ' + (err?.message || 'No se pudo guardar');
          }
        }
        if (errors.length && statusEl) {
          statusEl.textContent = (statusEl.textContent ? statusEl.textContent + ' · ' : '') + '⚠ ' + errors[0];
        }
      });
    }
  }

  /** Da formato legible a una fecha ISO (2026-08-03 → 3 de agosto de 2026). */
  function formatAudioDate(iso) {
    if (!iso) return '';
    const parts = String(iso).split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return iso;
    return `${parts[2]} de ${(AUDIO_MONTHS[parts[1] - 1] || '').toLowerCase()} de ${parts[0]}`;
  }

  /** Conecta play/pause, progreso, duración y errores de cada tarjeta de audio. */
  function bindAudioPlayers(container) {
    const cards = (container || page).querySelectorAll('.audios-player-card');
    cards.forEach(card => {
      const audio = card.querySelector('audio');
      const playBtn = card.querySelector('.audios-play-btn');
      const bar = card.querySelector('.audios-progress-bar');
      const curEl = card.querySelector('.audios-time-cur');
      const durEl = card.querySelector('.audios-time-dur');
      if (!audio) return;

      const fmt = (s) => {
        if (!isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
      };

      // Solo un audio sonando a la vez
      const pauseOthers = (except) => {
        (container || page).querySelectorAll('.audios-player-card audio').forEach(a => {
          if (a !== except) a.pause();
        });
        (container || page).querySelectorAll('.audios-play-btn').forEach(b => {
          if (b !== playBtn) {
            b.innerHTML = ICON_SVGS['play'];
            b.classList.remove('is-playing');
          }
        });
      };

      const setPlayingUI = (playing) => {
        playBtn.innerHTML = playing ? ICON_SVGS['pause'] : ICON_SVGS['play'];
        playBtn.classList.toggle('is-playing', playing);
        card.classList.toggle('is-playing', playing);
      };

      const onError = () => {
        // El audio falló: muestra el estado de error en la tarjeta
        const err = card.querySelector('.audios-player-error');
        const controls = card.querySelector('.audios-player-controls');
        if (err) return;
        setPlayingUI(false);
        if (controls) {
          const div = document.createElement('div');
          div.className = 'audios-player-error';
          div.innerHTML = '<p>Este audio no está disponible ahora mismo.</p>';
          const retry = document.createElement('button');
          retry.className = 'audios-retry-btn';
          retry.textContent = 'Reintentar';
          retry.addEventListener('click', () => {
            div.remove();
            audio.load();
            audio.play().catch(() => {});
          });
          div.appendChild(retry);
          card.appendChild(div);
        }
      };

      playBtn.addEventListener('click', () => {
        if (audio.paused) {
          pauseOthers(audio);
          audio.play().then(() => setPlayingUI(true)).catch(onError);
        } else {
          audio.pause();
          setPlayingUI(false);
        }
      });

      audio.addEventListener('play', () => { setPlayingUI(true); });
      audio.addEventListener('pause', () => { setPlayingUI(false); });
      audio.addEventListener('ended', () => {
        setPlayingUI(false);
        audio.currentTime = 0;
        bar.value = 0;
        curEl.textContent = '0:00';
      });
      audio.addEventListener('error', onError);

      if (audio.readyState >= 1) {
        durEl.textContent = fmt(audio.duration);
      } else {
        audio.addEventListener('loadedmetadata', () => {
          durEl.textContent = fmt(audio.duration);
          audio.dataset.duration = String(audio.duration);
        });
      }

      audio.addEventListener('timeupdate', () => {
        const d = audio.duration;
        curEl.textContent = fmt(audio.currentTime);
        if (isFinite(d) && d > 0) bar.value = (audio.currentTime / d) * 100;
      });

      bar.addEventListener('input', () => {
        const d = audio.duration;
        if (isFinite(d) && d > 0) {
          audio.currentTime = (parseFloat(bar.value) / 100) * d;
        }
      });

      // Inicia la carga de metadatos desde ya para conocer la duración
      audio.load();
    });
  }

  // ==========================================
  // INIT
  // ==========================================
  render();

  // Carga las portadas personalizadas de las tarjetas (async, se sincronizan)
  db.getRinconCovers().then(c => {
    state.covers = c || {};
    if (state.view === 'landing') render();
  }).catch(() => {});

  // Carga los audios del día 3 (una sola vez, se cachean en state)
  loadAudios().catch(() => {});

  // Tiempo real: cuando el Admin cambia una portada (o el catálogo de regalos
  // que alimenta la galería), se refleja al instante para todos los usuarios.
  const offContent = onContentChange(['rincon_covers', 'gifts', 'audios'], (id) => {
    if (id === 'rincon_covers') {
      // El Admin está editando portadas: no interrumpir su flujo (su guardado
      // local ya actualiza la tarjeta en pantalla).
      if (state.editMode) return;
      db.getRinconCovers().then(c => {
        state.covers = c || {};
        if (state.view === 'landing') render();
      }).catch(() => {});
    } else if (id === 'gifts') {
      // La galería muestra los vídeos desbloqueados del calendario
      if (state.view === 'galeria-memes' && !document.getElementById('mediaLightbox')?.classList.contains('open')) {
        renderGaleriaMemes();
      }
    } else if (id === 'audios') {
      // Los audios cambiaron (Admin): recarga y re-renderiza si estamos en Audios
      state.audiosLoaded = false;
      loadAudios(true).then(() => {
        if (state.view === 'audios') render();
      }).catch(() => {});
    }
  });

  // Escape cierra modales de memes (photo-menu-overlay) y menús abiertos
  const memeKeyHandler = (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.querySelector('.photo-menu-overlay');
    if (overlay) overlay.remove();
  };
  document.addEventListener('keydown', memeKeyHandler);

  // Cleanup al salir de la página: timers del hero, slideshow y teclado
  page.cleanup = () => {
    stopAllRotations();
    offPlayerCard();
    offContent();
    // Pausa cualquier audio del Rincón que esté sonando
    page.querySelectorAll('.audios-player-card audio').forEach(a => a.pause());
    if (galleryHeroTimer) { clearInterval(galleryHeroTimer); galleryHeroTimer = null; }
    pauseSlideshow();
    document.removeEventListener('keydown', memeKeyHandler);
    if (datoViewerKeyHandler) {
      document.removeEventListener('keydown', datoViewerKeyHandler);
      datoViewerKeyHandler = null;
    }
    const viewerOverlay = document.querySelector('.disco-viewer-overlay');
    if (viewerOverlay) viewerOverlay.remove();
    if (activeCoverOverlay) { activeCoverOverlay.remove(); activeCoverOverlay = null; }
    document.body.classList.remove('sheet-locked');
  };

  return page;
}
