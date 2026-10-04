/* ==========================================
   CELEBRACIÓN — confeti, nieve, hojas,
   corazones y estrellas cayendo desde arriba.
   Se usa cuando se abre la bienvenida de un
   día especial. Un único canvas limitado a
   la tarjeta, sin capturar clics, que se
   retira solo al terminar o cerrar.

   Los ambientes y sus formas viven en
   utils/celebration.js, que también los usa
   el selector del Admin.
   ========================================== */

import { decorInfo } from '../utils/celebration.js';

const PALETTE = ['#ff6b8b', '#ffb03a', '#ffe66d', '#7bd88f', '#6fb7ff', '#c58fff'];
const HOJA = ['#e8843c', '#d95f36', '#f0b429', '#8fb339', '#c1452f'];

let canvas = null;
let frame = 0;
let particles = [];
let running = false;
let burstTimers = [];

// Respetar la preferencia del sistema: si pide menos movimiento, se pinta un
// solo cuadro y se retira. El gesto de celebrar se mantiene, la animación no.
const prefersStill = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function createCanvas(root) {
  if (canvas?.isConnected) return canvas;
  canvas = document.createElement('canvas');
  canvas.className = 'celebration-canvas special-event__celebration';
  canvas.setAttribute('aria-hidden', 'true');
  const host = root || document.body;
  host.appendChild(canvas);
  return canvas;
}

function makeParticle(kind, w, color) {
  const base = {
    x: Math.random() * w,
    y: -20 - Math.random() * 120,
    size: 6 + Math.random() * 7,
    vy: 1.1 + Math.random() * 1.9,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.16,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.012 + Math.random() * 0.02,
    swayAmp: 8 + Math.random() * 22,
    alpha: 1,
    color
  };
  if (kind === 'strip') return { ...base, kind, w: base.size * 0.5, h: base.size * 1.5, vy: base.vy * 1.15 };
  if (kind === 'flake') return { ...base, kind, size: 2.5 + Math.random() * 4.5, vy: 0.5 + Math.random() * 0.7, swayAmp: 20 + Math.random() * 30 };
  if (kind === 'leaf') return { ...base, kind, size: 8 + Math.random() * 8, vy: 0.9 + Math.random() * 1.1, swayAmp: 26 + Math.random() * 34 };
  if (kind === 'heart') return { ...base, kind, size: 10 + Math.random() * 10, vy: 0.9 + Math.random() * 1.3, swayAmp: 24 + Math.random() * 30 };
  // Emoji: el glifo ya trae su color, así que no se pinta de nada y solo se
  // mueve y gira como los demás.
  if (kind === 'glyph') return { ...base, kind, size: 14 + Math.random() * 12, vy: 0.9 + Math.random() * 1.3, swayAmp: 26 + Math.random() * 34 };
  return { ...base, kind: 'star', size: 6 + Math.random() * 9, vy: 0.8 + Math.random() * 1.4, swayAmp: 20 + Math.random() * 30 };
}

function draw(ctx, p) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);

  if (p.kind === 'strip') {
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  } else if (p.kind === 'flake') {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'leaf') {
    // Dos arcos: sale como una hoja con punta.
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Corazón, estrella o emoji: un glifo del sistema, que se lee mejor que
    // un trazado hecho a mano a este tamaño.
    const glyph = p.kind === 'glyph' ? p.glyph : (p.kind === 'heart' ? '♥' : '✦');
    ctx.font = `${p.kind === 'glyph' ? p.size : p.size * 2}px ${p.kind === 'glyph' ? 'system-ui, Apple Color Emoji, Segoe UI Emoji, sans-serif' : 'serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (p.kind === 'glyph') ctx.fillStyle = p.color;
    ctx.fillText(glyph, 0, 0);
  }
  ctx.restore();
}

/**
 * Lanza la celebración dentro del contenedor indicado.
 * @param {object} opts
 * @param {string} opts.decor  ambiente (confeti, nieve, hojas, corazones, estrellas, ninguno)
 * @param {string} opts.accent color principal del día, para que case con la hoja
 * @param {string[]} opts.emojis glífos a soltar (ambiente «emoji»)
 * @param {number} opts.duration ms que dura antes de retirarse sola
 * @param {number} opts.amount partículas (se reduce en móvil)
 * @param {Element} [opts.root] dónde pintar (la hoja del día; si falta, el body)
 */
export function playCelebration({ decor = 'confeti', accent = '', emojis = [], duration = 4200, amount, root } = {}) {
  const info = decorInfo(decor);
  if (!info.shape) return stopCelebration();
  const glyphs = info.shape === 'glyph' ? (emojis.length ? emojis : ['✨']) : [];
  // Cancelar la anterior: dos capas de papel por encima solo hacen ruido.
  stopCelebration();

  const cv = createCanvas(root);
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const host = cv.parentElement || document.body;
  const size = () => ({
    w: host.clientWidth || window.innerWidth,
    h: host.clientHeight || window.innerHeight
  });
  const resize = () => {
    const { w, h } = size();
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const { w } = size();
  const colors = accent ? [accent, ...PALETTE] : PALETTE;
  const total = Math.round(amount || (w < 520 ? 36 : 56));
  // Tres tandas: la mayoría entra al abrir y el resto reparte la lluvia.
  const bursts = [0, 420, 900];

  const spawn = (count, w2) => {
    for (let i = 0; i < count; i++) {
      const color = info.id === 'hojas'
        ? HOJA[(Math.random() * HOJA.length) | 0]
        : info.id === 'nieve'
          ? '#ffffff'
          : colors[(Math.random() * colors.length) | 0];
      const p = makeParticle(info.shape, w2, color);
      // Cada emoji reparte: sale el que toque, no todos el mismo.
      if (glyphs.length) p.glyph = glyphs[(Math.random() * glyphs.length) | 0];
      particles.push(p);
    }
  };
  spawn(Math.round(total * 0.5), w);
  burstTimers = bursts.map(delay => setTimeout(() => {
    if (running) spawn(Math.round(total * 0.25), size().w);
  }, delay));

  running = true;
  let last = performance.now();
  let elapsed = 0;
  const fade = Math.min(900, duration / 3);

  const loop = (now) => {
    if (!running) return;
    const dt = Math.min(48, now - last) / 16.67;
    last = now;
    elapsed += dt;
    const { w: vw, h: vh } = size();
    ctx.clearRect(0, 0, vw, vh);

    for (const p of particles) {
      p.sway += p.swaySpeed * dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.sway) * p.swayAmp * 0.06 * dt;
      p.rot += p.vr * dt;
      // Se desvanecen en el último tramo, para no cortarse en seco.
      if (elapsed > duration - fade) p.alpha = Math.max(0, 1 - (elapsed - (duration - fade)) / fade);
      if (p.y < vh + 40) draw(ctx, p);
    }
    particles = particles.filter(p => p.y < vh + 40 && p.alpha > 0);

    if (elapsed >= duration || !particles.length) {
      stopCelebration();
      return;
    }
    frame = requestAnimationFrame(loop);
  };

  if (prefersStill()) {
    const { h } = size();
    for (let i = 0; i < 18; i++) {
      const p = makeParticle(info.shape, w, colors[(Math.random() * colors.length) | 0]);
      if (glyphs.length) p.glyph = glyphs[(Math.random() * glyphs.length) | 0];
      p.y = Math.random() * h;
      draw(ctx, p);
    }
    setTimeout(stopCelebration, 1600);
    return;
  }

  frame = requestAnimationFrame(loop);
  return stopCelebration;
}

/** Quita la celebración de golpe (al cerrar la hoja o al abrir otra). */
export function stopCelebration() {
  running = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  burstTimers.forEach(clearTimeout);
  burstTimers = [];
  particles = [];
  if (canvas?.isConnected) canvas.remove();
  canvas = null;
}