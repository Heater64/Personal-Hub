/* ==========================================
   Personal Hub v2 — Juegos Page
   Sala recreativa — cada juego es un mundo
   ========================================== */

import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { gameCover } from '../utils/gameCovers.js';

const MULTIPLAYER_IDS = new Set(['conecta4', 'tresenraya', 'battleship']);

export const GAMES = [
  { id: 'memoria',    icon: 'brain',   title: 'Memoria',      desc: 'Encuentra las parejas. Pon a prueba tu mente con cartas que esconden sorpresas.', href: '/games/memoria.html',    color: '#ff8aa1', accent: '#ffb3c1', difficulty: 'Fácil',   category: 'Puzzle',     duration: '2-5 min' },
  { id: 'ahorcado',   icon: 'skull',   title: 'Ahorcado',     desc: 'Adivina la palabra antes de que el dibujo se complete. Cada letra cuenta.',     href: '/games/ahorcado.html',   color: '#ffb347', accent: '#ffc96b', difficulty: 'Medio',   category: 'Palabras',   duration: '3-8 min' },
  { id: 'snake',      icon: 'snake',   title: 'Snake',        desc: 'Guía a la serpiente, come frutas y crece. ¡No choques contigo misma!',         href: '/games/snake.html',      color: '#e8735a', accent: '#f08a70', difficulty: 'Fácil',   category: 'Arcade',     duration: '1-5 min' },
  { id: 'buscaminas', icon: 'landmine',title: 'Buscaminas',   desc: 'Descubre todas las casillas sin explotar ninguna mina. Lógica y un poco de suerte.', href: '/games/buscaminas.html', color: '#f5a05e', accent: '#ffbd85', difficulty: 'Medio',   category: 'Puzzle',     duration: '5-15 min' },
  { id: 'breakout',   icon: 'blocks',  title: 'Breakout',     desc: 'Rompe todos los ladrillos con la pelota. Clásico adictivo que nunca pasa de moda.', href: '/games/breakout.html',   color: '#d4624a', accent: '#e8735a', difficulty: 'Medio',   category: 'Arcade',     duration: '3-10 min' },
  { id: 'laberinto',  icon: 'maze',    title: 'Laberinto',    desc: 'Encuentra la salida en laberintos cada vez más complejos. ¿Llegarás al final?',  href: '/games/laberinto.html',  color: '#e8735a', accent: '#f7a180', difficulty: 'Difícil', category: 'Puzzle',     duration: '5-20 min' },
  { id: 'meteoritos', icon: 'asteroid',title: 'Meteoritos',   desc: 'Esquiva meteoritos en el espacio infinito. Reflejos rápidos para sobrevivir.',  href: '/games/meteoritos.html', color: '#ff9f6e', accent: '#ffb98f', difficulty: 'Difícil', category: 'Acción',     duration: '1-3 min' },
  { id: 'cuchillos',  icon: 'knife',   title: 'Cuchillos',    desc: 'Lanza cuchillos con precisión. Un movimiento en falso y todo se acaba.',       href: '/games/cuchillos.html',  color: '#ff8aa1', accent: '#ffa9ba', difficulty: 'Medio',   category: 'Acción',     duration: '2-5 min' },
  { id: 'agujero-negro', icon: 'blackhole', title: 'Agujero Negro', desc: 'Escapa de la atracción gravitatoria. Cada segundo cuenta.',              href: '/games/agujero-negro.html', color:'#b45309',accent:'#ffb347',difficulty:'Difícil',category:'Acción', duration: '1-4 min' },
  { id: 'tiroarco',   icon: 'target',  title: 'Tiro al Arco', desc: 'Apunta con cuidado y dispara al centro. La precisión lo es todo.',            href: '/games/tiroarco.html',   color: '#ffc96b', accent: '#ffdd9e', difficulty: 'Fácil',   category: 'Precisión',  duration: '1-3 min' },
  { id: 'torre',      icon: 'building',title: 'Torre',        desc: 'Construye la torre más alta. Cada bloque debe caer en el momento justo.',      href: '/games/torre.html',      color: '#f5a05e', accent: '#ffb347', difficulty: 'Medio',   category: 'Estrategia', duration: '2-8 min' },

  // ── Nuevos clásicos ──
  { id: 'tetris',     icon: 'blocks2', title: 'Tetris',       desc: 'Encaja las piezas que caen y completa líneas. El clásico adictivo de siempre.',  href: '/games/tetris.html',     color: '#7c9cff', accent: '#a5baff', difficulty: 'Difícil', category: 'Puzzle',     duration: '5-15 min' },
  { id: '2048',       icon: 'grid',    title: '2048',         desc: 'Desliza las baldosas y fusiona números hasta llegar a 2048.',                    href: '/games/2048.html',       color: '#ffcf4d', accent: '#ffe59a', difficulty: 'Medio',   category: 'Puzzle',     duration: '3-10 min' },
  { id: 'conecta4',   icon: 'connect', title: 'Conecta 4',    desc: 'Dos jugadores · Lanza fichas y consigue 4 en línea antes que tu rival.',        href: '/games/conecta4.html',   color: '#ff8a5e', accent: '#ffb08f', difficulty: 'Fácil',   category: 'Estrategia', duration: '2-5 min' },
  { id: 'tresenraya', icon: 'xo',      title: 'Tres en Raya',  desc: 'Clásico de X y O contra la máquina. Tres en línea y ganas.',                    href: '/games/tresenraya.html', color: '#9ad1ff', accent: '#bce3ff', difficulty: 'Fácil',   category: 'Puzzle',     duration: '1-3 min' },
  { id: 'flappy',     icon: 'bird',    title: 'Flappy Bird',  desc: 'Toca para volar y esquiva las tuberías. Sencillo y vicioso.',                   href: '/games/flappy.html',     color: '#7ee0a3', accent: '#a5f0bf', difficulty: 'Difícil', category: 'Arcade',     duration: '1-2 min' },
  { id: 'invaders',   icon: 'ufo',     title: 'Space Invaders', desc: 'Mueve tu nave y dispara a las oleadas de alienígenas.',                      href: '/games/invaders.html',   color: '#5ed6d0', accent: '#8ae8e3', difficulty: 'Medio',   category: 'Arcade',     duration: '3-8 min' },
  { id: 'pong',       icon: 'pong',    title: 'Pong',         desc: 'Ping-pong clásico contra la CPU o en 2 jugadores. El origen de todo.',          href: '/games/pong.html',       color: '#ff9f6e', accent: '#ffc08f', difficulty: 'Fácil',   category: 'Arcade',     duration: '2-6 min' },
  { id: 'asteroides', icon: 'ship',    title: 'Asteroides',   desc: 'Pilotas la nave, esquiva y destruye los asteroides del espacio.',              href: '/games/asteroides.html', color: '#b39bff', accent: '#cdbfff', difficulty: 'Medio',   category: 'Acción',     duration: '3-8 min' },
  { id: 'simon',      icon: 'simon',   title: 'Simon Dice',   desc: 'Repite la secuencia de colores que se hace cada vez más larga.',               href: '/games/simon.html',      color: '#ffcf6e', accent: '#ffdf9e', difficulty: 'Fácil',   category: 'Memoria',    duration: '1-4 min' },
  { id: 'nonogramas', icon: 'nonogram',title: 'Nonogramas',   desc: 'Puzle de lógica: rellena las casillas siguiendo las pistas numéricas.',        href: '/games/nonogramas.html', color: '#ffb347', accent: '#ffcf8a', difficulty: 'Difícil', category: 'Puzzle',     duration: '10-30 min' },
  { id: 'dino',       icon: 'dino',    title: 'Dino Run',     desc: 'Corredor infinito: salta los cactus y llega lo más lejos posible.',            href: '/games/dino.html',       color: '#8be06e', accent: '#a8f08a', difficulty: 'Fácil',   category: 'Arcade',     duration: '1-3 min' },
  { id: 'doodle',     icon: 'doodle',  title: 'Doodle Jump',  desc: 'Salta entre plataformas sin parar de subir. ¿Hasta dónde llegarás?',          href: '/games/doodle.html',     color: '#f5a05e', accent: '#ffc58a', difficulty: 'Fácil',   category: 'Acción',     duration: '2-6 min' },
  { id: 'match3',     icon: 'gems',    title: 'Match-3',      desc: 'Intercambia gemas para hacer líneas de 3 o más. Fácil y adictivo.',           href: '/games/match3.html',     color: '#f87171', accent: '#ff9d9d', difficulty: 'Fácil',   category: 'Puzzle',     duration: '3-10 min' },
  { id: 'battleship', icon: 'fleet',   title: 'Hundir la Flota', desc: 'Dos jugadores · Hunde todos los barcos del rival antes que él.',           href: '/games/battleship.html', color: '#5aa0ff', accent: '#8ac0ff', difficulty: 'Medio',   category: 'Estrategia', duration: '5-15 min' }
];

const ICONS = {
  'brain':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2.1-1 2.8l.2 3.2a3 3 0 0 1-3 3h-.4a3 3 0 0 1-3-3l.2-3.2A4 4 0 0 1 8 6a4 4 0 0 1 4-4z"/><path d="M12 12v10"/><path d="M8 16a4 4 0 0 1-4-4c0-1.1.4-2.1 1-2.8"/><path d="M16 16a4 4 0 0 0 4-4c0-1.1-.4-2.1-1-2.8"/></svg>',
  'skull':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v-1a4 4 0 0 1 4-4 4 4 0 0 1 4 4v1"/><path d="M12 2C8 2 4 5 4 10c0 3.5 2 5.5 3 7l1 3h8l1-3c1-1.5 3-3.5 3-7 0-5-4-8-8-8z"/></svg>',
  'snake':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
  'landmine': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="16" r="4"/><path d="M12 2v6"/><path d="M12 8a4 4 0 0 1 4 4"/><path d="M5 12a2 2 0 0 1 2-2"/><path d="M17 12a2 2 0 0 0-2-2"/></svg>',
  'blocks':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="6" y="3" width="4" height="4" rx="1"/><rect x="14" y="3" width="4" height="4" rx="1"/></svg>',
  'maze':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9h4V3h5v6h4v5h-4v7H7v-7H3V9z"/><path d="M7 9h5"/><path d="M12 14v3"/></svg>',
  'asteroid': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/><path d="M8 16c1.5 1 3 1.5 5 1 2-.5 3-2 3.5-3"/></svg>',
  'knife':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="2" x2="8" y2="22"/><line x1="8" y1="2" x2="14" y2="8"/><path d="M8 22c0 0 2-5 7-5s7 5 7 5"/></svg>',
  'blackhole':'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 2v3"/><path d="M19 12h-3"/><path d="M12 19v3"/><path d="M5 12H2"/></svg>',
  'target':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  'building': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="8"/><line x1="15" y1="6" x2="15" y2="8"/><line x1="9" y1="10" x2="9" y2="12"/><line x1="15" y1="10" x2="15" y2="12"/></svg>',
  'blocks2':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="3" width="6" height="6" rx="1.5"/><rect x="6" y="11" width="6" height="6" rx="1.5"/><rect x="14" y="11" width="6" height="6" rx="1.5"/><rect x="14" y="19" width="6" height="6" rx="1.5"/></svg>',
  'grid':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  'connect':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="3"/><circle cx="6.5" cy="11" r="1.6" fill="currentColor"/><circle cx="10" cy="14" r="1.6" fill="currentColor"/><circle cx="13.5" cy="9" r="1.6" fill="currentColor"/><circle cx="17" cy="16" r="1.6" fill="currentColor"/></svg>',
  'xo':       '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="m7 7 4 4"/><path d="m11 7-4 4"/><circle cx="17" cy="17" r="2.2"/></svg>',
  'bird':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="6"/><path d="M17 9l4-2"/><path d="m17.5 12.5 3 .5"/><path d="M12 6c-1.5-2-3-2-4-1"/></svg>',
  'ufo':      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12c0-3 3.1-5 7-5s7 2 7 5-3.1 5-7 5-7-2-7-5z"/><path d="M12 17v4"/><path d="m8 21 4-3 4 3"/></svg>',
  'pong':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="3" height="10" rx="1.5"/><rect x="18" y="7" width="3" height="10" rx="1.5"/><path d="M12 5v14" stroke-dasharray="2 4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  'ship':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3 7 14h10L12 3z"/><path d="M12 3v3"/><path d="M9.5 17H7"/><path d="M17 17h-2.5"/><path d="M4 20h16"/></svg>',
  'simon':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 12 12 5A7 7 0 0 1 19 12Z"/><path d="M12 12 19 12A7 7 0 0 1 12 19Z"/><path d="M12 12 12 19A7 7 0 0 1 5 12Z"/></svg>',
  'nonogram': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h6"/><path d="M9 3v6"/><rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor"/><rect x="15" y="6" width="3" height="3" rx="1" fill="currentColor"/><rect x="6" y="15" width="3" height="3" rx="1" fill="currentColor"/></svg>',
  'dino':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16h5v-5h4V9h4V6h-2V4h-2v2h-2v2H9v3H4z"/><circle cx="13" cy="9" r="1" fill="currentColor"/><path d="M4 16v4"/><path d="M13 20v-4"/></svg>',
  'doodle':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 17h6"/><path d="M14 13h6"/><path d="M4 9h6"/><path d="M14 5h6"/><path d="M12 20 12 12 15 15"/></svg>',
  'gems':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 3 5 5-5 5-5-5z"/><path d="m12 3 5 5-5 5-5-5z"/><path d="m18 13 4 4-4 4-4-4z"/><path d="m5 13 3 3-3 3-3-3z"/></svg>',
  'fleet':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18h18"/><path d="M5 18l2-6h10l2 6"/><rect x="9" y="5" width="2.5" height="7" rx="1"/><rect x="12.5" y="5" width="2.5" height="7" rx="1"/><path d="M9 9h7"/></svg>',
  'chevron-right': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  'gamepad': '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>',
  'trophy': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V8c0-1.1.9-2 2-2s2 .9 2 2v14"/></svg>',
  'sparkles': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"/><path d="M8 8a5 5 0 0 0 5 5 5 5 0 0 0-5 5 5 5 0 0 0-5-5 5 5 0 0 0 5-5Z"/></svg>',
  'play': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  'heart': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  'clock': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  'star-filled': '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
};

// ==========================================
// HELPERS
// ==========================================
function lastPlayedId() {
  return getUserPref('lastPlayedGame', '');
}
function setLastPlayed(id) {
  setUserPref('lastPlayedGame', id);
}
function favGameId() {
  return getUserPref('favGame', '');
}
function setFavGame(id) {
  const current = favGameId();
  setUserPref('favGame', current === id ? '' : id);
}

// Enlace al juego con su color de portada (?accent=HEX) para que la
// página del juego use el mismo acento que su tarjeta en la web.
function gameHref(game) {
  return `${game.href}?accent=${game.color.replace('#', '')}`;
}

// ==========================================
// MAIN PAGE
// ==========================================
export function JuegosPage(router) {
  const page = document.createElement('div');
  page.className = 'juegos-page';

  const totalGames = GAMES.length;
  const lastId = lastPlayedId();
  const lastGame = lastId ? GAMES.find(g => g.id === lastId) : null;
  const favId = favGameId();
  const favGame = favId ? GAMES.find(g => g.id === favId) : null;

  page.innerHTML = `
    <!-- ===== HERO ===== -->
    <header class="juegos-header glass-card">
      <div class="juegos-header-bg">
        <span class="juegos-header-particle" style="top:8%;left:3%">${ICONS['gamepad']}</span>
        <span class="juegos-header-particle" style="top:15%;left:88%">${ICONS['sparkles']}</span>
        <span class="juegos-header-particle" style="top:55%;left:92%">${ICONS['trophy']}</span>
        <span class="juegos-header-particle" style="top:72%;left:4%">${ICONS['star-filled']}</span>
        <span class="juegos-header-particle" style="top:40%;left:48%">${ICONS['sparkles']}</span>
      </div>
      <div class="juegos-header-content">
        <span class="juegos-header-badge">${ICONS['gamepad']} Sala recreativa</span>
        <h1 class="juegos-header-title">Zona de Juegos</h1>
        <p class="juegos-header-sub">Un lugar para jugar, reír y pasar un buen rato juntos.</p>
      </div>
    </header>

    <!-- ===== STATS BAR ===== -->
    <div class="juegos-stats">
      <div class="juegos-stat">
        <span class="juegos-stat-num">${totalGames}</span>
        <span class="juegos-stat-label">disponibles</span>
      </div>
      ${lastGame ? `
      <div class="juegos-stat">
        <span class="juegos-stat-num juegos-stat-num--sm">${ICONS['gamepad']} ${lastGame.title}</span>
        <span class="juegos-stat-label">último jugado</span>
      </div>` : ''}
      ${favGame ? `
      <div class="juegos-stat">
        <span class="juegos-stat-num juegos-stat-num--sm">${ICONS['heart']} ${favGame.title}</span>
        <span class="juegos-stat-label">favorito</span>
      </div>` : ''}
    </div>

    <!-- ===== SECTION HEADER ===== -->
    <div class="juegos-section-header">
      <span class="juegos-section-chip">${ICONS['gamepad']}</span>
      <h3 class="juegos-section-title">Todos los juegos</h3>
      <span class="juegos-section-line"></span>
    </div>

    <!-- ===== GAME GRID ===== -->
    <div class="juegos-grid">
      ${GAMES.map((game, i) => {
        const isFav = favGameId() === game.id;
        return `
        <div class="juego-card glass-card card" role="link" tabindex="0" data-href="${gameHref(game)}" data-id="${game.id}" style="--game-color:${game.color};--game-accent:${game.accent};--enter-delay:${i * 50}ms">
          ${isFav ? `<span class="juego-card-fav-badge" title="Tu favorito">${ICONS['heart']}</span>` : ''}
          <div class="juego-card-glow"></div>
          <div class="juego-card-cover" style="--game-color:${game.color};--game-accent:${game.accent}">
            <img src="${gameCover(game.id, game.color, game.accent)}" alt="Portada de ${game.title}" loading="lazy">
            <span class="juego-card-shade"></span>
            <h3 class="juego-card-title">${game.title}</h3>
          </div>
          ${MULTIPLAYER_IDS.has(game.id) ? `<a class="juego-card-online" href="#/juegos/online/${game.id}" aria-label="Invitar a jugar ${game.title}">🎮 Jugar online</a>` : ''}
        </div>
      `}).join('')}
    </div>

    <!-- ===== FOOTER ===== -->
    <footer class="juegos-footer">
      <p>🎮 Más juegos próximamente · Hecho con amor</p>
    </footer>
  `;

  // ===== BIND EVENTS =====
  const playGame = (gameId, href) => {
    setLastPlayed(gameId);
    window.location.assign(href);
  };

  // Game cards
  page.querySelectorAll('.juego-card').forEach(card => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('.juego-card-online')) return;
      playGame(card.dataset.id, card.dataset.href);
    });
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.juego-card-online')) {
        event.preventDefault();
        playGame(card.dataset.id, card.dataset.href);
      }
    });
    // Right-click / long-press to toggle favorite
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = card.dataset.id;
      setFavGame(id);
      // Re-render to update fav badge
      const currentFav = favGameId();
      const badge = card.querySelector('.juego-card-fav-badge');
      if (currentFav === id) {
        if (!badge) card.insertAdjacentHTML('afterbegin', `<span class="juego-card-fav-badge" title="Tu favorito">${ICONS['heart']}</span>`);
      } else {
        if (badge) badge.remove();
      }
      // Update stats bar
      const statsEl = page.querySelector('.juegos-stats');
      if (statsEl) {
        const statsFav = statsEl.querySelector('.juegos-stat:last-child');
        if (currentFav === id && !statsFav) {
          const g = GAMES.find(g => g.id === id);
          if (g) {
            const favDiv = document.createElement('div');
            favDiv.className = 'juegos-stat';
            favDiv.innerHTML = `<span class="juegos-stat-num juegos-stat-num--sm">${ICONS['heart']} ${g.title}</span><span class="juegos-stat-label">favorito</span>`;
            statsEl.appendChild(favDiv);
          }
        } else if (currentFav !== id && statsFav && favGameId() === '') {
          statsFav.remove();
        }
      }
    });
  });

  // Staggered entrance
  requestAnimationFrame(() => {
    page.querySelectorAll('.juego-card').forEach(el => el.classList.add('visible'));
  });

  return page;
}
