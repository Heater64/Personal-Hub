/* ==========================================
   Catálogo de juegos offline (sala recreativa).
   Separado de Juegos.js para que Rincón y otras
   secciones no arrastren la página + juegos.css.
   ========================================== */

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
  { id: 'invaders',   icon: 'ufo',     title: 'Space Invaders', desc: 'Mueve tu nave y dispara a las oleadas de alienígenas.',                      href: '/games/invaders.html',   color: '#5ed6d0', accent: '#8ae8e3', difficulty: 'Medio',   category: 'Arcade',     duration: '3-8 min' },
  { id: 'pong',       icon: 'pong',    title: 'Pong',         desc: 'Ping-pong clásico contra la CPU o en 2 jugadores. El origen de todo.',          href: '/games/pong.html',       color: '#ff9f6e', accent: '#ffc08f', difficulty: 'Fácil',   category: 'Arcade',     duration: '2-6 min' },
  { id: 'simon',      icon: 'simon',   title: 'Simon Dice',   desc: 'Repite la secuencia de colores que se hace cada vez más larga.',               href: '/games/simon.html',      color: '#ffcf6e', accent: '#ffdf9e', difficulty: 'Fácil',   category: 'Memoria',    duration: '1-4 min' },
  { id: 'battleship', icon: 'fleet',   title: 'Hundir la Flota', desc: 'Dos jugadores · Hunde todos los barcos del rival antes que él.',           href: '/games/battleship.html', color: '#5aa0ff', accent: '#8ac0ff', difficulty: 'Medio',   category: 'Estrategia', duration: '5-15 min' }
];
