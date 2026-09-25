/* ==========================================
   INICIO — resumen del día
   Sin tarjeta de "buenos días": el saludo es el título
   de la pantalla, y lo primero que se ve es el contador
   de días juntos. Debajo: dos datos rápidos, cuatro
   destacados visuales y los detalles de la web.
   Todo sobre los componentes compartidos (ui.css).
   ========================================== */

import { MEME_FOLDERS, getVideoPoster } from '../services/rincon-data.js';
import { LETTERS } from './OpenWhen.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey, migrateUserPref } from '../utils/userStorage.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { hourInSpain } from '../utils/format.js';
import { getContinueWatching, getCatalogSync } from '../services/seriesData.js';
import { startPosterRotation } from '../utils/posterRotator.js';
import { daysSinceAnniversary, loadSpecialDates, nextSpecialDate } from '../utils/specialDates.js';
import { moodStore } from '../stores/mood.store.js';
import { icon } from '../components/ui.js';

// ==========================================
// SEED — contenido que cambia cada día
// ==========================================
function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed) {
  let s = seed;
  return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function pickSeeded(arr, rng) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

// ==========================================
// CONTENIDO ESTÁTICO
// La primera línea es el saludo; la segunda, la frase del día.
// ==========================================
const GREETINGS = {
  morning:   ['Buenos días ☀️<br>Me alegra volver a verte.', 'Buenos días ☀️<br>Hoy también va a ser un día bonito.', 'Buenos días ☀️<br>El sol sale solo para verte sonreír.'],
  afternoon: ['Buenas tardes 🌤️<br>Espero que estés teniendo un lindo día.', 'Buenas tardes 🌤️<br>¿Ya comiste? Cuídate mucho.', 'Buenas tardes 🌤️<br>Cada tarde es mejor si estás tú.'],
  evening:   ['Buenas noches 🌙<br>Espero que hayas tenido un bonito día.', 'Buenas noches 🌙<br>Descansa, mañana hay más sorpresas.', 'Buenas noches 🌙<br>Gracias por estar otro día más conmigo.'],
  night:     ['Buenas noches 🌙<br>Es tarde... pero nunca es tarde para decirte que te quiero.', 'Buenas noches 🌙<br>Que sueñes con cosas bonitas.', 'Buenas noches 🌙<br>Cierro los ojos y solo pienso en ti.']
};

// Portadas de canciones — fallback cuando aún no hay "seguir escuchando"
const RANDOM_COVERS = [
  { title: 'Si No Estás', artist: 'Iñigo Quintero', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/1200x1200bf-60.jpg' },
  { title: 'Mi niña', artist: 'Wisin, Myke Towers', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(3).webp' },
  { title: 'Rara vez', artist: 'Milo J, Taiu', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(4).webp' },
  { title: 'Pareja del año', artist: 'Sebastián Yatra, Myke Towers', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(5).webp' },
  { title: 'Cuando te vi', artist: 'Trueno, Maria Becerra', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png' },
  { title: 'Todo de Ti', artist: 'Rauw Alejandro', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(7).webp' },
  { title: 'Tacones Rojos', artist: 'Sebastián Yatra', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(8).webp' },
  { title: 'Bailando', artist: 'Enrique Iglesias', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/R%20(1).png' },
  { title: 'La Plena', artist: 'Beéle, Westcol', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/ab67616d0000b2734740100d84f3667f1eae6870.jpeg' },
  { title: 'Cosas Que No Te Dije', artist: 'Saiko', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/ab67616d0000b273fb045f7dda9773e266437bc6.jpeg' },
  { title: 'Indeciso', artist: 'Reik, J Balvin', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/R%20(3).jpeg' },
  { title: 'Loco Enamorado', artist: 'Abraham Mateo, Farruko', cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png' }
];

const FUN_FACTS = [
  { icon: '🎨', title: 'Paleta de colores', text: 'Los colores de esta web están inspirados en el personaje animado \'Darwin\' y tu color favorito (negro), por eso la web es un poco oscura.' },
  { icon: '🌠', title: 'La estrella fugaz', text: 'Cada estrella que ves en la web representa lo deslumbrante que eres.' },
  { icon: '🤍', title: 'El corazón', text: 'Porque simplemente es especial.' },
  { icon: '📅', title: 'El calendario', text: 'El calendario es una metáfora de nuestro tiempo juntos. Cada día es una oportunidad para crear un recuerdo nuevo.' }
];

// ==========================================
// HELPERS
// ==========================================
const nf = new Intl.NumberFormat('es-ES');

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function longDate(date = new Date()) {
  return capitalize(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date));
}

function shortDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
}

function countdownLabel(days) {
  if (days <= 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  return `${days} días`;
}

/** Contador que sube hasta el número real (respeta reduced-motion). */
function animateNumber(el, to) {
  const from = Number(el.textContent.replace(/\D/g, '')) || 0;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || from === to) { el.textContent = nf.format(to); return; }
  const start = performance.now();
  const dur = 1500;
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const value = from + (to - from) * (1 - Math.pow(1 - p, 3));
    el.textContent = nf.format(Math.round(value));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function getMeme(rng) {
  const folders = Object.entries(MEME_FOLDERS || {});
  if (!folders.length) return null;
  const [name, urls] = pickSeeded(folders, rng);
  const url = pickSeeded(urls, rng);
  const isVid = /\.(mp4|webm|mov)$/i.test(url);
  // Los memes de vídeo usan su póster (jpg), nunca el mp4 dentro de un <img>
  const thumb = isVid ? getVideoPoster(url) : url.replace('/q_auto,f_auto,w_800/', '/q_auto:good,f_auto,w_600,c_fill,g_auto/');
  return { thumb, name, isVid };
}

function getSong(rng) {
  try {
    migrateUserPref('continueTrack');
    const d = JSON.parse(localStorage.getItem(userPrefKey('continueTrack')));
    if (d?.title) {
      // Duración cacheada por Canciones (misma clave): dibuja la barra real
      let duration = 0;
      try {
        const durs = JSON.parse(localStorage.getItem(userPrefKey('trackDurations')) || '{}');
        if (d.audio && durs[d.audio]) duration = durs[d.audio];
      } catch { /* sin duración: barra neutra */ }
      return { title: d.title, artist: d.artist || '', cover: d.cover || '', time: d.time || 0, duration, audio: d.audio || '' };
    }
  } catch { /* ignore */ }
  if (rng && RANDOM_COVERS.length) {
    const pick = pickSeeded(RANDOM_COVERS, rng);
    return { title: pick.title, artist: pick.artist, cover: pick.cover, time: 0, duration: 0, audio: '' };
  }
  return null;
}

function getMessage(rng) {
  return LETTERS?.length ? pickSeeded(LETTERS, rng) : null;
}

/** Ánimo registrado hoy (local; la app lo sincroniza al arrancar). */
function readMood() {
  try {
    const mood = moodStore.getTodayMood();
    return mood && (mood.label || mood.emoji) ? mood : null;
  } catch { return null; }
}

// ==========================================
// BLOQUES DE MARCADO
// ==========================================
function statCards() {
  const next = nextSpecialDate();
  const mood = readMood();
  return `
    <button class="home-stat" type="button" data-route="/calendario">
      <span class="home-stat__ic">${icon('calendar', 17)}</span>
      <span class="home-stat__num">${next ? escapeHtml(countdownLabel(next.days)) : '—'}</span>
      <span class="home-stat__label">${escapeHtml(next ? next.title : 'Sin fechas aún')}</span>
      <span class="home-stat__sub">${next ? escapeHtml(shortDate(next.date)) : 'Añádelas desde el perfil'}</span>
    </button>
    <button class="home-stat" type="button" data-route="/sentimientos">
      <span class="home-stat__ic">${icon('smile', 17)}</span>
      <span class="home-stat__num${mood ? ' home-stat__num--emoji' : ''}">${mood ? escapeHtml(mood.emoji || '🤍') : '—'}</span>
      <span class="home-stat__label">${escapeHtml(mood ? (mood.label || 'Registrado') : 'Sin registrar')}</span>
      <span class="home-stat__sub">${mood ? 'Cómo estás hoy' : 'Toca para registrar'}</span>
    </button>
  `;
}

function tileMeme(meme) {
  if (!meme) return '';
  return `
    <button class="tile" type="button" data-route="/rincon?tab=memes">
      <span class="tile__media">
        ${meme.thumb ? `<img src="${escapeHtml(meme.thumb)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="tile__fallback" style="display:${meme.thumb ? 'none' : 'flex'}">😂</span>
        ${meme.isVid ? `<span class="tile__play">${icon('video', 16)}</span>` : ''}
        <span class="tile__chip">😂 Meme del día</span>
      </span>
      <span class="tile__body">
        <span class="tile__title">${escapeHtml(meme.name)}</span>
        <span class="tile__sub">Sonríe, es para ti</span>
      </span>
    </button>
  `;
}

function tileMessage(message) {
  if (!message) return '';
  const snippet = String(message.note || message.message || '').trim();
  return `
    <button class="tile" type="button" data-route="/openwhen">
      <span class="tile__media">
        <span class="tile__fallback">💌</span>
        <span class="tile__chip">💌 Carta</span>
      </span>
      <span class="tile__body">
        <span class="tile__title">${escapeHtml(message.title || 'Para cuando lo necesites')}</span>
        <span class="tile__sub">${escapeHtml(snippet ? snippet.slice(0, 60) : 'Un mensaje guardado para ti')}</span>
      </span>
    </button>
  `;
}

function tileSeries(continueList, posters, continueFirst) {
  const watching = continueList.length > 0;
  return `
    <button class="tile" type="button" data-route="/series" data-poster-rotate>
      <span class="tile__media">
        ${posters.length ? `<img class="sr-rotating-poster" src="${escapeHtml(posters[0])}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="tile__fallback" style="display:${posters.length ? 'none' : 'flex'}">🎬</span>
        <span class="tile__chip">${watching ? '📺 Seguir viendo' : '🎬 Series'}</span>
      </span>
      <span class="tile__body">
        <span class="tile__title" data-role="title">${escapeHtml(watching ? continueFirst.item.titulo : 'Series y películas')}</span>
        <span class="tile__sub" data-role="sub">${watching ? `Ep. ${continueFirst.watched} de ${continueFirst.total} · ${continueFirst.percent}%` : 'Tu tracker personal'}</span>
        ${watching ? `<span class="bar"><span data-role="bar" style="width:${Math.max(continueFirst.percent, 4)}%"></span></span>` : ''}
      </span>
    </button>
  `;
}

function tileSong(song) {
  if (!song) return '';
  const isContinue = song.time > 0 || song.duration > 0;
  const pct = song.duration && song.time ? Math.min(100, Math.round((song.time / song.duration) * 100)) : (song.time > 0 ? 100 : 0);
  return `
    <button class="tile" type="button" data-route="${isContinue ? '/canciones?continue=1' : '/canciones'}">
      <span class="tile__media">
        ${song.cover ? `<img src="${escapeHtml(song.cover)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="tile__fallback" style="display:${song.cover ? 'none' : 'flex'}">🎵</span>
        <span class="tile__play">${icon('music', 16)}</span>
        <span class="tile__chip">${isContinue ? '🎵 Sigue sonando' : '🎵 Escuchar'}</span>
      </span>
      <span class="tile__body">
        <span class="tile__title">${escapeHtml(song.title)}</span>
        <span class="tile__sub">${escapeHtml(song.artist || 'Nuestra música')}</span>
        ${song.time > 0 ? `<span class="bar"><span style="width:${Math.max(pct, 4)}%"></span></span>` : ''}
      </span>
    </button>
  `;
}

// ==========================================
// MAIN
// ==========================================
export function HomePage(router) {
  const page = document.createElement('div');
  page.className = 'home-page';

  const daysSince = daysSinceAnniversary();
  const hour = hourInSpain(); // saludo según la hora de España (península)
  const seed = dailySeed();
  const rng = seededRandom(seed);

  const timeKey = hour < 12 ? 'morning' : hour < 19 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
  const greeting = GREETINGS[timeKey][seed % GREETINGS[timeKey].length];
  const [saludo, frase = ''] = greeting.split('<br>');

  // Datos (síncronos)
  const meme = getMeme(rng);
  const song = getSong(rng);
  const continueList = getContinueWatching();
  const message = getMessage(rng);

  const posterPool = continueList.length
    ? continueList.slice(0, 4)
    : [...getCatalogSync()].sort(() => Math.random() - 0.5).map(item => ({ item })).slice(0, 4);
  const posters = posterPool.map(c => c.item.portada).filter(Boolean);
  const continueFirst = continueList[0];

  page.innerHTML = `
    ${renderPageHeader({ title: saludo, subtitle: longDate() })}

    <section class="home-hero" aria-label="Tiempo juntos">
      <div class="home-hero__main">
        <span class="home-hero__badge" aria-hidden="true">🤍</span>
        <div>
          <span class="home-hero__num" id="homeCounter">0</span>
          <span class="home-hero__label">días juntos</span>
        </div>
      </div>
      ${frase ? `<p class="home-hero__quote">${escapeHtml(frase)}</p>` : ''}
    </section>

    <div class="home-stats">${statCards()}</div>

    <h2 class="section-title">Destacados de hoy
      <button class="link" type="button" data-route="/rincon">Ver el Rincón</button>
    </h2>

    <div class="home-grid">
      ${tileMeme(meme)}
      ${tileMessage(message)}
      ${tileSeries(continueList, posters, continueFirst)}
      ${tileSong(song)}
    </div>

    <h2 class="section-title">Datos curiosos</h2>

    <div class="card card--none">
      ${FUN_FACTS.map(f => `
        <div class="home-fact">
          <span class="home-fact__emoji" aria-hidden="true">${f.icon}</span>
          <div class="home-fact__body">
            <h3 class="home-fact__title">${escapeHtml(f.title)}</h3>
            <p class="home-fact__text">${escapeHtml(f.text)}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Contador — arranca ya y se corrige cuando llegan las fechas reales
  animateNumber(page.querySelector('#homeCounter'), daysSince);
  loadSpecialDates().then(() => {
    const el = page.querySelector('#homeCounter');
    if (el) animateNumber(el, daysSinceAnniversary());
    const stats = page.querySelector('.home-stats');
    if (stats) stats.innerHTML = statCards();
  });

  // Navegación delegada: cualquier [data-route] navega (también lo insertado después)
  page.addEventListener('click', (event) => {
    const target = event.target.closest('[data-route]');
    if (target && page.contains(target)) router.navigate(target.dataset.route);
  });

  // Rotación de portadas (10s) cuando no hay nada que seguir viendo
  const rotateEl = page.querySelector('[data-poster-rotate]');
  let stopRotation = () => {};
  if (rotateEl && posters.length > 1) {
    stopRotation = startPosterRotation(rotateEl, posters, {
      onChange: (i) => {
        if (!continueList.length) return; // aleatorio: solo cambia la portada
        const c = continueList[i % continueList.length];
        if (!c) return;
        const t = rotateEl.querySelector('[data-role="title"]');
        const s = rotateEl.querySelector('[data-role="sub"]');
        const bar = rotateEl.querySelector('[data-role="bar"]');
        if (t) t.textContent = c.item.titulo;
        if (s) s.textContent = `Ep. ${c.watched} de ${c.total} · ${c.percent}%`;
        if (bar) bar.style.width = `${Math.max(c.percent, 4)}%`;
      }
    });
  }

  // El ánimo de hoy puede llegar después del render (sync con Supabase al arrancar)
  const repaintMood = () => {
    const stats = page.querySelector('.home-stats');
    if (stats) stats.innerHTML = statCards();
  };
  window.addEventListener('focus', repaintMood);
  const moodTimer = setTimeout(repaintMood, 1500);

  // Sorpresas de hoy — carga diferida: no pesa en el arranque
  let cancelled = false;
  import('../services/gifts.service.js')
    .then(({ loadGiftsCatalog }) => loadGiftsCatalog())
    .then((catalog) => {
      if (cancelled || !catalog) return;
      const count = todaySurprises(catalog);
      if (!count.total) return;
      const banner = document.createElement('button');
      banner.type = 'button';
      banner.className = 'row home-banner';
      banner.dataset.route = '/calendario';
      banner.innerHTML = `
        <span class="r-ic">${icon('gift', 20)}</span>
        <span class="r-body">
          <b>${count.pending ? `Hoy tienes ${count.pending} ${count.pending === 1 ? 'sorpresa' : 'sorpresas'}` : 'Ya abriste las sorpresas de hoy'}</b>
          <span class="r-sub">${count.pending ? 'Ábrelas en el calendario' : `${count.total} ${count.total === 1 ? 'sorpresa' : 'sorpresas'} esperándote cada día`}</span>
        </span>
        <span class="chev">${icon('chev', 18)}</span>
      `;
      page.querySelector('.home-stats')?.after(banner);
    })
    .catch(() => { /* sin catálogo: sin aviso */ });

  page.cleanup = () => {
    cancelled = true;
    clearTimeout(moodTimer);
    window.removeEventListener('focus', repaintMood);
    stopRotation();
  };

  return page;
}

/**
 * Sorpresas asignadas a hoy en el catálogo del calendario.
 * Devuelve { total, pending } (pending = aún sin abrir en este navegador).
 */
function todaySurprises(catalog) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mapping = catalog?.months?.[monthKey]?.calendarMapping || {};
  const value = mapping[String(now.getDate())];
  const ids = Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
  if (!ids.length) return { total: 0, pending: 0 };

  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(userPrefKey('giftProgress')) || '{}'); } catch { /* sin progreso */ }
  return { total: ids.length, pending: ids.filter(id => !progress[id]?.opened).length };
}
