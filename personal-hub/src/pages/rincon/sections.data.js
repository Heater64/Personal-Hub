/* ==========================================
   Rincón — datos de las tarjetas de la landing
   Contenido estatico de "Living section cards":titulo, color, vistas
   previas y enlaces. Es dato puro: aqui no hay DOM ni estado.
   ========================================== */

import {
  GALLERY_FOLDERS, MEME_FOLDERS, SPB_DATA,
  isVideo, getVideoPoster
} from '../../services/rincon-data.js';
import { GAMES } from '../../data/games.catalog.js';
import { gameCover } from '../../utils/gameCovers.js';
import { SPB_IMG, GATO_IMG } from './media.data.js';
import { getSongCovers } from './songCovers.js';
import { player } from '../../services/player.service.js';
import { getContinueWatching, getCatalogSync } from '../../services/seriesData.js';

export const SECTIONS = [
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
    id: 'audios',
    icon: 'mic',
    emoji: '🎙️',
    title: 'Audios',
    desc: 'Nuestra cápsula del día 3: un audio guardado cada mes.',
    href: '/audios'
  },
  {
    id: 'minecraft',
    icon: 'pickaxe',
    emoji: '⛏️',
    title: 'Minecraft',
    desc: 'Los mundos que construimos, foto a foto.',
    href: '/minecraft'
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
      const covers = getSongCovers();
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
