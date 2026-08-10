/* ==========================================
   gameCovers.js — Portadas digitales SVG de
   los juegos (arte tipo "game cover", sin
   emojis ni fotos reales). Cada juego tiene su
   arte propio con sus colores (color/accent).
   Se usan en la sección Juegos (portada de
   cada juego) y en la tarjeta del Rincón.
   ========================================== */

const BG = '#15151c';

function svg(body) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'>` +
    `<rect width='600' height='600' fill='${BG}'/>` + body + `</svg>`
  );
}

const line = (x1, y1, x2, y2, c, w = 10) =>
  `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${c}' stroke-width='${w}' stroke-linecap='round'/>`;

const ART = {
  // Memoria: tablero de cartas con parejas descubiertas
  memoria(c, a) {
    let g = '';
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
      const x = 105 + col * 145, y = 105 + r * 145;
      g += `<rect x='${x}' y='${y}' width='110' height='110' rx='18' fill='#232330' stroke='${a}' stroke-opacity='0.55' stroke-width='5'/>`;
      const faceUp = (r * 3 + col) % 3 === 0;
      if (faceUp) {
        if (col === 0) g += `<circle cx='${x + 55}' cy='${y + 55}' r='24' fill='${c}'/>`;
        else if (col === 1) g += `<rect x='${x + 35}' y='${y + 35}' width='40' height='40' rx='8' fill='${a}'/>`;
        else g += `<polygon points='${x + 55},${y + 30} ${x + 80},${y + 80} ${x + 30},${y + 80}' fill='${c}'/>`;
      } else {
        g += `<circle cx='${x + 55}' cy='${y + 55}' r='7' fill='${a}' opacity='0.7'/>`;
        g += `<circle cx='${x + 40}' cy='${y + 42}' r='4' fill='#4a4a5c'/>`;
        g += `<circle cx='${x + 70}' cy='${y + 68}' r='4' fill='#4a4a5c'/>`;
      }
    }
    return g;
  },

  // Ahorcado: horca + figura + huecos de letras
  ahorcado(c, a) {
    return line(240, 130, 240, 460, a, 14) +
      line(240, 130, 430, 130, a, 14) +
      line(430, 130, 430, 200, a, 10) +
      `<circle cx='430' cy='245' r='42' fill='none' stroke='${c}' stroke-width='12'/>` +
      line(430, 287, 430, 390, c, 12) +
      line(430, 300, 380, 350, c, 10) +
      line(430, 300, 480, 350, c, 10) +
      line(430, 390, 385, 450, c, 10) +
      line(430, 390, 475, 450, c, 10) +
      `<g stroke='${a}' stroke-width='8' stroke-linecap='round'><line x1='170' y1='520' x2='255' y2='520'/><line x1='300' y1='520' x2='385' y2='520'/><line x1='430' y1='520' x2='515' y2='520'/></g>`;
  },

  // Snake: serpiente en cuadrícula + manzana
  snake(c, a) {
    let g = '';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      g += `<circle cx='${90 + i * 52}' cy='${90 + j * 52}' r='5' fill='#2c2c38'/>`;
    }
    g += `<polyline points='142,246 194,246 246,246 298,246 350,246 402,246 402,298 402,350 402,402 350,402 298,402' fill='none' stroke='${c}' stroke-width='26' stroke-linecap='round' stroke-linejoin='round'/>`;
    g += `<circle cx='142' cy='246' r='14' fill='${a}'/>` +
      `<rect x='430' y='400' width='42' height='42' rx='10' fill='#e5484d'/>` +
      `<line x1='451' y1='408' x2='451' y2='434' stroke='#7f2d30' stroke-width='5' stroke-linecap='round'/>`;
    return g;
  },

  // Buscaminas: cuadrícula + minas + bandera
  buscaminas(c, a) {
    let g = '';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g += `<rect x='${110 + i * 52}' y='${110 + j * 52}' width='46' height='46' rx='8' fill='${(i + j) % 2 ? '#1d1d27' : '#232330'}' stroke='#33333f' stroke-width='3'/>`;
    }
    const mine = (x, y) =>
      `<circle cx='${x}' cy='${y}' r='13' fill='#3a3a48' stroke='${a}' stroke-width='4'/>` +
      `<g stroke='${a}' stroke-width='4' stroke-linecap='round'><line x1='${x}' y1='${y - 22}' x2='${x}' y2='${y - 8}'/><line x1='${x}' y1='${y + 8}' x2='${x}' y2='${y + 22}'/><line x1='${x - 22}' y1='${y}' x2='${x - 8}' y2='${y}'/><line x1='${x + 8}' y1='${y}' x2='${x + 22}' y2='${y}'/></g>`;
    g += mine(162, 162) + mine(318, 266) + mine(214, 422);
    g += line(422, 318, 422, 214, c, 7) +
      `<polygon points='422,214 452,232 422,250' fill='${c}'/>`;
    return g;
  },

  // Breakout: ladrillos + pala + bola
  breakout(c, a) {
    let g = '';
    const colors = [c, a, c, a];
    for (let r = 0; r < 4; r++) for (let col = 0; col < 6; col++) {
      g += `<rect x='${70 + col * 82}' y='${110 + r * 48}' width='68' height='30' rx='9' fill='${colors[r]}' opacity='0.92'/>`;
    }
    return g + `<rect x='230' y='480' width='140' height='26' rx='13' fill='${a}'/>` +
      `<circle cx='150' cy='380' r='18' fill='#fff'/>`;
  },

  // Laberinto: pasillos dibujados
  laberinto(c, a) {
    return `<rect x='90' y='90' width='420' height='420' rx='16' fill='none' stroke='${a}' stroke-width='14'/>` +
      line(90, 180, 300, 180, a, 12) +
      line(300, 180, 300, 300, a, 12) +
      line(300, 300, 160, 300, a, 12) +
      line(160, 300, 160, 430, a, 12) +
      line(90, 430, 300, 430, a, 12) +
      line(300, 430, 300, 520, a, 12) +
      line(420, 90, 420, 220, a, 12) +
      line(420, 220, 510, 220, a, 12) +
      line(510, 340, 300, 340, a, 12) +
      `<circle cx='160' cy='470' r='16' fill='${c}'/>` +
      `<rect x='480' y='90' width='30' height='30' rx='8' fill='${c}'/>`;
  },

  // Meteoritos: espacio + rocas + nave
  meteoritos(c, a) {
    let g = `<g fill='#e8e8f0'><circle cx='80' cy='120' r='4'/><circle cx='520' cy='90' r='3'/><circle cx='430' cy='200' r='4'/><circle cx='150' cy='330' r='3'/><circle cx='540' cy='380' r='4'/><circle cx='260' cy='120' r='3'/><circle cx='90' cy='480' r='4'/><circle cx='520' cy='540' r='3'/></g>`;
    const rock = (cx, cy, s, col) =>
      `<polygon points='${cx},${cy - s} ${cx + s * 0.9},${cy - s * 0.3} ${cx + s * 0.5},${cy + s * 0.9} ${cx - s * 0.6},${cy + s * 0.7} ${cx - s * 0.9},${cy - s * 0.2}' fill='${col}' stroke='${a}' stroke-opacity='0.6' stroke-width='6'/>`;
    g += rock(190, 200, 70, '#4a4a58') + rock(430, 380, 95, '#5c5c6c') + rock(330, 130, 45, '#3d3d4a');
    g += `<polygon points='130,470 190,470 160,430' fill='${c}'/>`;
    return g;
  },

  // Cuchillos: diana + cuchillos clavados
  cuchillos(c, a) {
    return `<circle cx='300' cy='300' r='180' fill='none' stroke='#3a3a48' stroke-width='12'/>` +
      `<circle cx='300' cy='300' r='120' fill='none' stroke='${a}' stroke-width='12'/>` +
      `<circle cx='300' cy='300' r='58' fill='${c}'/>` +
      `<circle cx='300' cy='300' r='20' fill='#3a3a48'/>` +
      `<g transform='rotate(35 300 300)'><rect x='295' y='120' width='10' height='110' rx='5' fill='#cfcfd8'/>` +
      `<polygon points='300,110 280,180 320,180' fill='#e8e8f0'/><rect x='295' y='228' width='10' height='46' rx='4' fill='${c}'/></g>` +
      `<g transform='rotate(-30 300 300)'><rect x='295' y='120' width='10' height='110' rx='5' fill='#cfcfd8'/>` +
      `<polygon points='300,110 280,180 320,180' fill='#e8e8f0'/><rect x='295' y='228' width='10' height='46' rx='4' fill='${a}'/></g>`;
  },

  // Agujero negro: disco + anillo de fotones
  'agujero-negro'(c, a) {
    return `<ellipse cx='300' cy='300' rx='190' ry='90' fill='none' stroke='${a}' stroke-opacity='0.25' stroke-width='26'/>` +
      `<ellipse cx='300' cy='300' rx='170' ry='78' fill='none' stroke='${c}' stroke-opacity='0.55' stroke-width='20'/>` +
      `<ellipse cx='300' cy='300' rx='150' ry='66' fill='none' stroke='${a}' stroke-width='12'/>` +
      `<circle cx='300' cy='300' r='60' fill='#000'/>`;
  },

  // Tiro al Arco: diana + flecha
  tiroarco(c, a) {
    return `<circle cx='300' cy='300' r='175' fill='#232330' stroke='#e8e8f0' stroke-width='14'/>` +
      `<circle cx='300' cy='300' r='122' fill='${c}'/>` +
      `<circle cx='300' cy='300' r='68' fill='#232330'/>` +
      `<circle cx='300' cy='300' r='30' fill='${a}'/>` +
      `<line x1='120' y1='520' x2='430' y2='240' stroke='#e8e8f0' stroke-width='14' stroke-linecap='round'/>` +
      `<polygon points='455,215 400,225 435,260' fill='#e8e8f0'/>`;
  },

  // Torre: bloques apilados
  torre(c, a) {
    return `<rect x='150' y='430' width='300' height='46' rx='14' fill='${a}'/>` +
      `<rect x='175' y='356' width='250' height='46' rx='14' fill='${c}'/>` +
      `<rect x='150' y='282' width='300' height='46' rx='14' fill='${a}'/>` +
      `<rect x='190' y='208' width='220' height='46' rx='14' fill='${c}'/>` +
      `<rect x='230' y='140' width='140' height='44' rx='14' fill='${a}'/>` +
      `<rect x='264' y='96' width='72' height='32' rx='12' fill='${c}'/>`;
  },

  // Tetris: piezas cayendo
  tetris(c, a) {
    let g = '';
    for (let i = 0; i < 4; i++) g += `<rect x='130' y='${110 + i * 60}' width='52' height='52' rx='10' fill='${a}'/>`;
    for (let i = 0; i < 3; i++) g += `<rect x='340' y='${140 + i * 60}' width='52' height='52' rx='10' fill='${c}'/>`;
    g += `<rect x='280' y='320' width='52' height='52' rx='10' fill='${c}'/>`;
    g += `<rect x='230' y='410' width='52' height='52' rx='10' fill='${a}'/>` +
      `<rect x='290' y='410' width='52' height='52' rx='10' fill='${a}'/>` +
      `<rect x='230' y='470' width='52' height='52' rx='10' fill='${a}'/>` +
      `<rect x='290' y='470' width='52' height='52' rx='10' fill='${a}'/>`;
    return g;
  },

  // 2048: baldosas con valores
  '2048'(c, a) {
    let g = '';
    const size = 120, gap = 18, ox = 105, oy = 105;
    const fill = [[0, 0, c], [1, 0, a], [2, 0, '#2c2c38'], [0, 1, '#2c2c38'], [1, 1, c], [2, 1, a], [0, 2, a], [1, 2, '#2c2c38'], [2, 2, c]];
    for (const [x, y, col] of fill) {
      g += `<rect x='${ox + x * (size + gap)}' y='${oy + y * (size + gap)}' width='${size}' height='${size}' rx='18' fill='${col}'/>`;
      g += `<circle cx='${ox + x * (size + gap) + 60}' cy='${oy + y * (size + gap) + 60}' r='18' fill='rgba(255,255,255,0.18)'/>`;
    }
    return g;
  },

  // Conecta 4: tablero con fichas
  conecta4(c, a) {
    let g = `<rect x='76' y='76' width='448' height='440' rx='24' fill='#1d1d27' stroke='${a}' stroke-width='8'/>`;
    for (let r = 0; r < 6; r++) for (let col = 0; col < 7; col++) {
      g += `<circle cx='${120 + col * 56}' cy='${122 + r * 58}' r='22' fill='#0f0f13'/>`;
    }
    for (let r = 2; r <= 5; r++) g += `<circle cx='${120 + 3 * 56}' cy='${122 + r * 58}' r='22' fill='${c}'/>`;
    g += `<circle cx='${120 + 1 * 56}' cy='${122 + 5 * 58}' r='22' fill='${a}'/>` +
      `<circle cx='${120 + 2 * 56}' cy='${122 + 5 * 58}' r='22' fill='${a}'/>`;
    return g;
  },

  // Tres en Raya: cuadrícula con X y O
  tresenraya(c, a) {
    const x0 = 110, y0 = 110, s = 127;
    let g = `<g stroke='#3a3a48' stroke-width='10'><line x1='${x0 + s}' y1='${y0}' x2='${x0 + s}' y2='${y0 + 3 * s}'/><line x1='${x0 + 2 * s}' y1='${y0}' x2='${x0 + 2 * s}' y2='${y0 + 3 * s}'/><line x1='${x0}' y1='${y0 + s}' x2='${x0 + 3 * s}' y2='${y0 + s}'/><line x1='${x0}' y1='${y0 + 2 * s}' x2='${x0 + 3 * s}' y2='${y0 + 2 * s}'/></g>`;
    const cx = (col) => x0 + col * s + s / 2;
    const cy = (row) => y0 + row * s + s / 2;
    const X = (col, row) => `<g stroke='${c}' stroke-width='16' stroke-linecap='round'><line x1='${cx(col) - 34}' y1='${cy(row) - 34}' x2='${cx(col) + 34}' y2='${cy(row) + 34}'/><line x1='${cx(col) + 34}' y1='${cy(row) - 34}' x2='${cx(col) - 34}' y2='${cy(row) + 34}'/></g>`;
    const O = (col, row) => `<circle cx='${cx(col)}' cy='${cy(row)}' r='40' fill='none' stroke='${a}' stroke-width='16'/>`;
    return g + X(0, 0) + O(1, 0) + X(2, 1) + O(0, 2) + X(1, 2) + O(2, 2);
  },

  // Flappy Bird: pájaro entre tuberías
  flappy(c, a) {
    let g = `<rect x='110' y='80' width='70' height='230' rx='14' fill='${c}'/>` +
      `<rect x='110' y='310' width='70' height='220' rx='14' fill='${c}'/>` +
      `<rect x='96' y='270' width='86' height='40' rx='8' fill='${a}'/>` +
      `<rect x='96' y='310' width='86' height='40' rx='8' fill='${a}'/>` +
      `<rect x='420' y='160' width='70' height='180' rx='14' fill='${c}'/>` +
      `<rect x='420' y='340' width='70' height='180' rx='14' fill='${c}'/>` +
      `<rect x='406' y='120' width='86' height='40' rx='8' fill='${a}'/>` +
      `<rect x='406' y='300' width='86' height='40' rx='8' fill='${a}'/>`;
    g += `<circle cx='280' cy='240' r='44' fill='${a}'/>` +
      `<polygon points='318,228 352,240 318,252' fill='${c}'/>` +
      `<circle cx='298' cy='226' r='6' fill='#15151c'/>`;
    return g;
  },

  // Space Invaders: alienígenas + nave
  invaders(c, a) {
    const alien = (x, y, col) =>
      `<g fill='${col}'><rect x='${x}' y='${y}' width='10' height='34' rx='5'/><rect x='${x + 34}' y='${y}' width='10' height='34' rx='5'/><rect x='${x + 6}' y='${y + 6}' width='32' height='24' rx='8'/><rect x='${x + 14}' y='${y + 16}' width='4' height='10'/><rect x='${x + 26}' y='${y + 16}' width='4' height='10'/></g>`;
    let g = '';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      g += alien(130 + i * 90, 100 + j * 90, j === 0 ? c : j === 1 ? a : '#8b8b9a');
    }
    g += `<rect x='296' y='386' width='8' height='34' rx='4' fill='${a}'/>` +
      `<polygon points='300,480 230,520 370,520' fill='#e8e8f0'/>` +
      `<polygon points='300,480 272,508 328,508' fill='${c}'/>`;
    return g;
  },

  // Pong: palas y pelota
  pong(c, a) {
    return line(110, 180, 110, 420, c, 26) +
      line(490, 180, 490, 420, a, 26) +
      `<g stroke='rgba(255,255,255,0.3)' stroke-width='8' stroke-dasharray='4 26'><line x1='300' y1='120' x2='300' y2='480'/></g>` +
      `<circle cx='300' cy='300' r='20' fill='#e8e8f0'/>`;
  },

  // Asteroides: nave entre rocas
  asteroides(c, a) {
    let g = `<g fill='#e8e8f0'><circle cx='90' cy='130' r='4'/><circle cx='520' cy='100' r='3'/><circle cx='480' cy='260' r='4'/><circle cx='130' cy='400' r='3'/><circle cx='540' cy='470' r='4'/><circle cx='250' cy='90' r='3'/></g>`;
    const rock = (cx, cy, s, col) =>
      `<polygon points='${cx},${cy - s} ${cx + s * 0.9},${cy - s * 0.3} ${cx + s * 0.5},${cy + s * 0.9} ${cx - s * 0.6},${cy + s * 0.7} ${cx - s * 0.9},${cy - s * 0.2}' fill='${col}' stroke='${a}' stroke-opacity='0.6' stroke-width='6'/>`;
    g += rock(170, 220, 55, '#4a4a58') + rock(430, 160, 40, '#5c5c6c') + rock(140, 420, 45, '#3d3d4a') + rock(460, 380, 70, '#54546a');
    g += `<polygon points='300,500 250,560 350,560' fill='#e8e8f0'/>` +
      `<polygon points='300,500 284,540 316,540' fill='${c}'/>`;
    return g;
  },

  // Simon Dice: pads de colores
  simon(c, a) {
    return `<rect x='120' y='120' width='360' height='360' rx='60' fill='#1d1d27'/>` +
      `<circle cx='300' cy='300' r='140' fill='#0f0f13'/>` +
      `<path d='M300 300 L300 160 A140 140 0 0 1 440 300 Z' fill='${c}'/>` +
      `<path d='M300 300 L440 300 A140 140 0 0 1 300 440 Z' fill='${a}'/>` +
      `<path d='M300 300 L300 440 A140 140 0 0 1 160 300 Z' fill='#7ee0a3'/>` +
      `<path d='M300 300 L160 300 A140 140 0 0 1 300 160 Z' fill='#5ea8ff'/>`;
  },

  // Nonogramas: puzle de cuadrícula
  nonogramas(c, a) {
    let g = '';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g += `<rect x='${160 + i * 42}' y='${160 + j * 42}' width='40' height='40' fill='${(i + j) % 2 ? '#1d1d27' : '#232330'}' stroke='#33333f' stroke-width='3'/>`;
    }
    const filled = [[1, 2], [2, 1], [3, 1], [4, 1], [5, 2], [1, 5], [2, 6], [3, 6], [4, 6], [5, 5], [3, 4]];
    for (const [x, y] of filled) g += `<rect x='${160 + x * 42 + 4}' y='${160 + y * 42 + 4}' width='32' height='32' rx='6' fill='${c}'/>`;
    return g;
  },

  // Dino Run: dinosaurio esquivando cactus
  dino(c, a) {
    return line(80, 520, 520, 520, '#3a3a48', 10) +
      `<rect x='420' y='420' width='22' height='100' rx='10' fill='${c}'/>` +
      `<rect x='398' y='452' width='22' height='40' rx='10' fill='${c}'/>` +
      `<rect x='442' y='470' width='22' height='32' rx='10' fill='${c}'/>` +
      `<rect x='270' y='436' width='18' height='84' rx='9' fill='${a}'/>` +
      `<rect x='150' y='400' width='150' height='90' rx='40' fill='#2f2f3a'/>` +
      `<rect x='270' y='330' width='70' height='80' rx='24' fill='#2f2f3a'/>` +
      `<rect x='292' y='318' width='46' height='30' rx='12' fill='#2f2f3a'/>` +
      `<circle cx='300' cy='350' r='7' fill='#e8e8f0'/>` +
      `<rect x='170' y='470' width='26' height='52' rx='12' fill='#2f2f3a'/>` +
      `<rect x='240' y='470' width='26' height='52' rx='12' fill='#2f2f3a'/>`;
  },

  // Doodle Jump: plataformas y muelle
  doodle(c, a) {
    return line(90, 480, 250, 480, a, 16) +
      line(380, 400, 520, 400, c, 16) +
      line(140, 300, 300, 300, a, 16) +
      line(380, 200, 520, 200, c, 16) +
      line(220, 100, 360, 100, a, 16) +
      `<path d='M470 330 q-10 -24 -20 0 q-10 24 -20 0' fill='none' stroke='${a}' stroke-width='10' stroke-linecap='round'/>` +
      `<circle cx='180' cy='220' r='26' fill='#e8e8f0'/>` +
      `<rect x='156' y='246' width='48' height='34' rx='16' fill='${c}'/>`;
  },

  // Match-3: tablero de gemas
  match3(c, a) {
    let g = '';
    const cols = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa'];
    for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
      const x = 90 + col * 55, y = 90 + r * 55;
      g += `<circle cx='${x}' cy='${y}' r='19' fill='${cols[(r * 3 + col) % 5]}'/>`;
      g += `<circle cx='${x - 6}' cy='${y - 6}' r='6' fill='rgba(255,255,255,0.35)'/>`;
    }
    return g;
  },

  // Hundir la flota: mar con barco
  battleship(c, a) {
    let g = `<rect x='60' y='60' width='480' height='480' rx='20' fill='#0e1626'/>`;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g += `<rect x='${68 + i * 58}' y='${68 + j * 58}' width='54' height='54' rx='6' fill='${(i + j) % 2 ? '#12203a' : '#16263f'}' stroke='#1d3150' stroke-width='3'/>`;
    }
    g += `<rect x='170' y='210' width='260' height='44' rx='10' fill='${a}'/>` +
      `<rect x='210' y='170' width='44' height='44' rx='8' fill='${c}'/>` +
      `<rect x='270' y='170' width='44' height='44' rx='8' fill='${c}'/>` +
      `<rect x='330' y='170' width='44' height='44' rx='8' fill='${c}'/>` +
      `<line x1='180' y1='254' x2='250' y2='254' stroke='#e8e8f0' stroke-width='8' stroke-linecap='round'/>` +
      `<circle cx='430' cy='380' r='18' fill='none' stroke='#ef4444' stroke-width='8'/>` +
      `<line x1='418' y1='368' x2='442' y2='392' stroke='#ef4444' stroke-width='8' stroke-linecap='round'/>` +
      `<line x1='442' y1='368' x2='418' y2='392' stroke='#ef4444' stroke-width='8' stroke-linecap='round'/>`;
    return g;
  }
};

/** Portada digital del juego (data URI SVG). Si no hay arte, degradado simple. */
export function gameCover(id, color, accent) {
  const body = ART[id] ? ART[id](color, accent) : '';
  return svg(body);
}
