/* ==========================================
   Personal Hub v8 — Home (Portada emocional viva)
   Solo tarjetas: meme del día → mensaje → series
   (continúa viendo) → canciones (sigue escuchando).
   ========================================== */

import { MEME_FOLDERS, getVideoPoster } from '../services/rincon-data.js';
import { LETTERS } from './OpenWhen.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey, migrateUserPref } from '../utils/userStorage.js';
import { hourInSpain } from '../utils/format.js';
import { getContinueWatching, getCatalogSync } from '../services/seriesData.js';
import { startPosterRotation } from '../utils/posterRotator.js';

const START_DATE = '2025-07-03';

// ==========================================
// SVG
// ==========================================
const UI = {
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
};

// ==========================================
// SEED — contenido que cambia cada día
// ==========================================
function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function seededRandom(seed) {
  let s = seed;
  return function() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function pickSeeded(arr, rng) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

// ==========================================
// CONTENIDO ESTÁTICO
// ==========================================
const GREETINGS = {
  morning:  ['Buenos días ☀️<br>Me alegra volver a verte.', 'Buenos días ☀️<br>Hoy también va a ser un día bonito.', 'Buenos días ☀️<br>El sol sale solo para verte sonreír.'],
  afternoon:['Buenas tardes 🌤️<br>Espero que estés teniendo un lindo día.', 'Buenas tardes 🌤️<br>¿Ya comiste? Cuídate mucho.', 'Buenas tardes 🌤️<br>Cada tarde es mejor si estás tú.'],
  evening:  ['Buenas noches 🌙<br>Espero que hayas tenido un bonito día.', 'Buenas noches 🌙<br>Descansa, mañana hay más sorpresas.', 'Buenas noches 🌙<br>Gracias por estar otro día más conmigo.'],
  night:    ['Buenas noches<br>Es tarde... pero nunca es tarde para decirte que te quiero.', 'Buenas noches<br>Que sueñes con cosas bonitas.', 'Buenas noches<br>Cierro los ojos y solo pienso en ti.'],
};

const PHRASES = [
  '"El amor no se mira, se siente." — Pablo Neruda',
  '"Eres mi lugar favorito al que ir cuando mi mente busca paz."',
  '"Cada día a tu lado es un nuevo capítulo de mi historia favorita."',
  '"Te elegiría a ti en todas las vidas."',
  '"Contigo, hasta los días nublados son bonitos."',
  '"Eres la casualidad más bonita que me ha pasado."',
];

// ==========================================
// DATOS CURIOSOS
// ==========================================
const FUN_FACTS = [
  {
    icon: '🎨',
    title: 'Paleta de colores',
    text: 'Los colores de esta web están inspirados en el personaje animado \'Darwin\' y tu color favorito (negro), por eso la web es un poco oscura.'
  },
  {
    icon: '🌠',
    title: 'La estrella fugaz',
    text: 'Cada estrella que ves en la web representa lo deslumbrante que eres.'
  },
  {
    icon: '🤍',
    title: 'El corazón',
    text: 'Porque simplemente es especial.'
  },
  {
    icon: '📅',
    title: 'El calendario',
    text: 'El calendario es una metáfora de nuestro tiempo juntos. Cada día es una oportunidad para crear un recuerdo nuevo.'
  }
];

// ==========================================
// DATA HELPERS
// ==========================================
function getMeme(rng) {
  const folders = Object.entries(MEME_FOLDERS || {});
  if (!folders.length) return null;
  const [name, urls] = pickSeeded(folders, rng);
  const url = pickSeeded(urls, rng);
  const isVid = /\.(mp4|webm|mov)$/i.test(url);
  // Los memes de video usan su póster (una imagen jpg), nunca el mp4 en un <img>
  const thumb = isVid ? getVideoPoster(url) : url.replace('/q_auto,f_auto,w_800/', '/q_auto:good,f_auto,w_600,c_fill,g_auto/');
  return { thumb, name, isVid };
}

function getSong() {
  try {
    migrateUserPref('continueTrack');
    const d = JSON.parse(localStorage.getItem(userPrefKey('continueTrack')));
    if (!d?.title) return null;
    // Duración cacheada por Canciones (misma clave): permite dibujar la
    // barra de progreso real de la última escucha.
    let duration = 0;
    try {
      const durs = JSON.parse(localStorage.getItem(userPrefKey('trackDurations')) || '{}');
      if (d.audio && durs[d.audio]) duration = durs[d.audio];
    } catch { /* sin duración: barra neutra */ }
    return { title: d.title, artist: d.artist || '', cover: d.cover || '', time: d.time || 0, duration, audio: d.audio || '' };
  } catch { return null; }
}

function getMessage(rng) {
  return LETTERS?.length ? pickSeeded(LETTERS, rng) : null;
}

// ==========================================
// BIND
// ==========================================
function bindClicks(root, router) {
  root.querySelectorAll('[data-route]').forEach(el => {
    if (el._routeBound) return;
    el._routeBound = true;
    const go = () => { const r = el.dataset.route; if (r) router.navigate(r); };
    el.addEventListener('click', go);
    // Accesibilidad: las tarjetas son <div> clicables → navegables por teclado
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
}

// ==========================================
// MAIN
// ==========================================
export function HomePage(router) {
  const page = document.createElement('div');
  page.className = 'home-page';

  const daysSince = Math.floor((Date.now() - new Date(START_DATE).getTime()) / 86400000);
  const hour = hourInSpain(); // saludo según hora de España (península)
  const seed = dailySeed();
  const rng = seededRandom(seed);

  let timeKey = hour < 12 ? 'morning' : hour < 19 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
  const greeting = GREETINGS[timeKey][seed % GREETINGS[timeKey].length];
  const [gSaludo = 'Buenos días ☀️', gSub = 'Espero que tengas un bonito día.'] = greeting.split('<br>');
  const phrase = PHRASES[seed % PHRASES.length];
  // Separa la cita del autor para tipografía independiente
  const phraseParts = phrase.split(/—/).map(s => s.trim());
  const phraseQuote = (phraseParts[0] || phrase).replace(/^\"|\"$/g, '');
  const phraseAuthor = phraseParts[1] || '';

  // Gather data (sync)
  const meme = getMeme(rng);
  const song = getSong();
  const continueList = getContinueWatching();
  const message = getMessage(rng);

  // ── Hero particles (subtle, seeded) ──
  let particlesHtml = '';
  for (let i = 0; i < 4; i++) {
    particlesHtml += `<span class="home-hero__particle" style="left:${12 + rng() * 76}%;top:${18 + rng() * 60}%;animation-delay:${(rng() * 4).toFixed(2)}s;animation-duration:${(5 + rng() * 5).toFixed(2)}s"></span>`;
  }

  // ── GRID DE TARJETAS — todas cuadradas y del mismo tamaño ──
  const cards = [];

  // 1. Meme del día — patrón visual. Lleva directo a la pestaña de memes
  // del Rincón (no al landing).
  if (meme) {
    cards.push(`<div class="home-card home-card--meme" data-route="/rincon?tab=memes">
      <div class="home-card__media">
        ${meme.thumb ? `<img src="${escapeHtml(meme.thumb)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="home-card__media-fb" style="display:${meme.thumb ? 'none' : 'flex'}">😂</span>
        ${meme.isVid ? `<span class="home-card__play">${UI.play}</span>` : ''}
      </div>
      <div class="home-card__overlay"></div>
      <span class="home-card__chip">😂 Meme del día</span>
      <div class="home-card__body">
        <div class="home-card__title">${escapeHtml(meme.name)}</div>
        <div class="home-card__sub">Sonríe, es para ti</div>
      </div>
    </div>`);
  }

  // 2. Mensaje sorpresa — patrón emocional
  if (message) {
    cards.push(`<div class="home-card home-card--message" data-route="/openwhen">
      <div class="home-card__media home-card__media--emoji" style="background:radial-gradient(ellipse 95% 110% at 50% 15%, var(--warm-rose-dim) 0%, transparent 62%), var(--theme-surface);">
        <span class="home-card__emoji">💌</span>
      </div>
      <div class="home-card__overlay home-card__overlay--soft"></div>
      <span class="home-card__chip">💌 Mensaje</span>
      <div class="home-card__body">
        <div class="home-card__title">${escapeHtml(message.title)}</div>
        <div class="home-card__sub">${escapeHtml((message.note || message.message || '').substring(0, 80))}…</div>
      </div>
    </div>`);
  }

  // 3. Series — una sola tarjeta; dentro, las portadas (seguir viendo o aleatorias)
  const posterPool = continueList.length
    ? continueList.slice(0, 4)
    : [...getCatalogSync()].sort(() => Math.random() - 0.5).map(item => ({ item })).slice(0, 4);
  const posters = posterPool.map(c => c.item.portada).filter(Boolean);
  const continueFirst = continueList[0];
  cards.push(`<div class="home-card home-card--series" data-route="/series" data-poster-rotate>
    <div class="home-card__media">
      ${posters.length ? `<img class="sr-rotating-poster home-card__poster" src="${escapeHtml(posters[0])}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
      <span class="home-card__media-fb" style="display:${posters.length ? 'none' : 'flex'}">🎬</span>
    </div>
    <div class="home-card__overlay"></div>
    <span class="home-card__chip">${continueList.length ? '📺 Seguir viendo' : '🎬 Series'}</span>
    <div class="home-card__body">
      <div class="home-card__title">${continueList.length ? escapeHtml(continueFirst.item.titulo) : 'Series'}</div>
      <div class="home-card__sub">${continueList.length ? `Ep. ${continueFirst.watched} de ${continueFirst.total} · ${continueFirst.percent}%` : 'Tu tracker de series y películas'}</div>
      ${continueList.length ? `<div class="home-card__bar"><span class="home-card__bar-fill" style="width:${Math.max(continueFirst.percent, 4)}%"></span></div>` : ''}
    </div>
  </div>`);

  // 4. Sigue escuchando — patrón reproductor. Lleva a Canciones y reanuda
  // la última canción automáticamente (?continue=1).
  if (song) {
    const pct = song.duration && song.time ? Math.min(100, Math.round((song.time / song.duration) * 100)) : (song.time > 0 ? 100 : 0);
    cards.push(`<div class="home-card home-card--music" data-route="/canciones?continue=1">
      <div class="home-card__media">
        ${song.cover ? `<img src="${escapeHtml(song.cover)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="home-card__media-fb" style="display:${song.cover ? 'none' : 'flex'}">🎵</span>
      </div>
      <div class="home-card__overlay"></div>
      <span class="home-card__chip">🎵 Sigue escuchando</span>
      <span class="home-card__play">${UI.play}</span>
      <div class="home-card__body">
        <div class="home-card__title">${escapeHtml(song.title)}</div>
        <div class="home-card__sub">${escapeHtml(song.artist || 'Continuar escuchando')}</div>
        ${song.time > 0 ? `<div class="home-card__bar"><span class="home-card__bar-fill" style="width:${Math.max(pct, 4)}%"></span></div>` : ''}
      </div>
    </div>`);
  }

  // ── RENDER ──
  page.innerHTML = `
    <header class="home-hero">
      <div class="home-hero__bg"></div>
      ${particlesHtml}
      <div class="home-hero__content">
        <div class="home-hero__welcome">
          <h1 class="home-hero__title">
            <span class="home-hero__title-white">Bienvenida mi</span>
            <span class="home-hero__title-accent">Princesa</span>
          </h1>
          <p class="home-hero__greeting">${gSaludo}</p>
          <p class="home-hero__sub">${gSub}</p>
        </div>

        <div class="home-hero__center">
          <div class="home-hero__counter-box">
            <span class="home-hero__heart">🤍</span>
            <div class="home-hero__counter">
              <div class="home-hero__days" id="homeCounter">${daysSince}</div>
              <div class="home-hero__label">días juntos</div>
            </div>
          </div>
          <p class="home-hero__phrase">${escapeHtml(phraseQuote)}</p>
          ${phraseAuthor ? `<p class="home-hero__phrase-author">— ${escapeHtml(phraseAuthor)}</p>` : ''}
        </div>

        <div class="home-hero__divider" aria-hidden="true"></div>
      </div>
    </header>

    <div class="home-grid${cards.length >= 4 ? ' home-grid--four' : ''}">
      ${cards.join('')}
    </div>

    <section class="home-facts" aria-label="Datos curiosos">
      <h2 class="home-facts__title">Datos curiosos</h2>
      <div class="home-facts__list">
        ${FUN_FACTS.map(f => `
          <div class="home-fact">
            <span class="home-fact__icon" aria-hidden="true">${f.icon}</span>
            <div class="home-fact__body">
              <h3 class="home-fact__title">${f.title}</h3>
              <p class="home-fact__text">${f.text}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <footer class="home-footer">
      <p>Hecho con amor</p>
    </footer>
  `;

  // ── Counter animation ──
  requestAnimationFrame(() => {
    const el = page.querySelector('#homeCounter');
    if (!el) return;
    const target = daysSince;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / 1800, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  // ── Bind clicks ──
  bindClicks(page, router);

  // ── Rotación de portadas dentro de la tarjeta de Series (10s, fade suave) ──
  const rotateEl = page.querySelector('[data-poster-rotate]');
  let stopRotation = () => {};
  if (rotateEl && posters.length > 1) {
    stopRotation = startPosterRotation(rotateEl, posters, {
      onChange: (i) => {
        if (!continueList.length) return; // aleatorio: solo rota la portada
        const c = continueList[i % continueList.length];
        if (!c) return;
        const t = rotateEl.querySelector('.home-card__title');
        const s = rotateEl.querySelector('.home-card__sub');
        const bar = rotateEl.querySelector('.home-card__bar-fill');
        if (t) t.textContent = c.item.titulo;
        if (s) s.textContent = `Ep. ${c.watched} de ${c.total} · ${c.percent}%`;
        if (bar) bar.style.width = `${Math.max(c.percent, 4)}%`;
      }
    });
  }
  const origCleanup = page.cleanup;
  page.cleanup = () => { stopRotation(); if (origCleanup) origCleanup(); };

  return page;
}
