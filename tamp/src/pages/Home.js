/* ==========================================
   INICIO — la pantalla diaria
   Arranca por la tarjeta de días, sin cabecera: el saludo con
   apodo ya dice dónde estás. Después, solo lo de hoy: cómo
   estás, qué hay para hoy y los atajos a lo importante.
   Cada dato viene de su dueño (el store del ánimo, los servicios
   de fechas y del calendario); la pantalla no los re-deriva.
   ========================================== */

import '../styles/home.css';
import { MEME_FOLDERS, getVideoPoster } from '../services/rincon-data.js';
import { visiblePhotos, photoDate } from '../services/galleryData.js';
import { sameDayInPast } from '../utils/pro-insights.js';
import { LETTERS } from '../data/openwhen.data.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey, migrateUserPref } from '../utils/userStorage.js';
import { hourInSpain, todayISO } from '../utils/format.js';
import {
  getContinueWatching,
  getCatalogSync,
  getStartedSeries,
  hydrateProgress,
  bumpWatched,
} from '../services/seriesData.js';
import { startPosterRotation } from '../utils/posterRotator.js';
import {
  daysSinceAnniversary,
  loadSpecialDates,
  nextSpecialDate,
  upcomingSpecialDates,
  specialEventsToday,
  eventTemplateFor,
  specialDates,
  SPECIAL_EVENT_TONES,
} from '../utils/specialDates.js';
import {
  maybeShowSpecialEvent,
  previewSpecialEventSheet,
  replaySpecialEventSheet,
} from '../components/SpecialEventSheet.js';
import { icon } from '../components/ui.js';
import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { db } from '../services/db.service.js';
import { onMoodChange } from '../services/realtime.service.js';
import { entries as agendaEntries, nextEvent } from '../services/agenda.js';
import {
  startLocationSharing,
  stopLocationSharing,
  watchDistance,
  fetchPartnerIdentity,
  fetchProfile,
  fetchMyLocation,
  requestLocationPermission,
  formatDistance,
  togetherInfo,
} from '../services/location.service.js';
import { fetchPartnerProfile } from '../services/presence.service.js';
import { openDistanceMap } from '../components/DistanceMapSheet.js';
import { openDeviceSettings } from '../services/device.service.js';
import { openWidgetsSheet } from '../components/WidgetsSheet.js';
import { initHomePortada } from '../components/HomePortada.js';
import {
  saveDaysWidget,
  saveDistanceWidget,
  saveCountdownWidget,
  saveHerMoodWidget,
  saveWatchingWidget,
  saveGiftsWidget,
  togetherBreakdown,
} from '../services/widgets.service.js';
import { isNative } from '../services/native.service.js';
import { mediaUrl } from '../services/media.service.js';

/** Guarda un widget en segundo plano: si falla, queda el aviso y el Inicio sigue. */
function trackWidgetSave(promise) {
  promise.catch(error => console.warn('[widgets] no se pudo guardar', error));
}

// ==========================================
// SEED — contenido que cambia cada día
// ==========================================
// El "día" es el de España (Europe/Madrid), no el del dispositivo: el
// calendario, las notificaciones y los ánimos ya cuentan el cambio de día
// a las 00:00 españolas. Con la fecha local, un móvil en otro huso (o
// justo alrededor de medianoche) vería un "hoy" distinto al del resto
// de la app y el contenido diario no cuadraría con el calendario.
function dailySeed() {
  const iso = todayISO();
  return Number(iso.slice(0, 4)) * 10000 + Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
  morning: [
    'Buenos días ☀️<br>Me alegra volver a verte.',
    'Buenos días ☀️<br>Hoy también va a ser un día bonito.',
    'Buenos días ☀️<br>El sol sale solo para verte sonreír.',
  ],
  afternoon: [
    'Buenas tardes 🌤️<br>Espero que estés teniendo un lindo día.',
    'Buenas tardes 🌤️<br>¿Ya comiste? Cuídate mucho.',
    'Buenas tardes 🌤️<br>Cada tarde es mejor si estás tú.',
  ],
  evening: [
    'Buenas noches 🌙<br>Espero que hayas tenido un bonito día.',
    'Buenas noches 🌙<br>Descansa, mañana hay más sorpresas.',
    'Buenas noches 🌙<br>Gracias por estar otro día más conmigo.',
  ],
  night: [
    'Buenas noches 🌙<br>Es tarde... pero nunca es tarde para decirte que te quiero.',
    'Buenas noches 🌙<br>Que sueñes con cosas bonitas.',
    'Buenas noches 🌙<br>Cierro los ojos y solo pienso en ti.',
  ],
};

// Saludo base por franja horaria (España). El apodo va aparte para poder
// escribirlo con otro color en el marcado.
const TIME_GREETING = {
  morning: 'Buenos días ☀️',
  afternoon: 'Buenas tardes 🌤️',
  evening: 'Buenas noches 🌙',
  night: 'Buenas noches 🌙',
};

// Portadas de canciones — fallback cuando aún no hay "seguir escuchando"
const RANDOM_COVERS = [
  {
    title: 'Si No Estás',
    artist: 'Iñigo Quintero',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/1200x1200bf-60.jpg',
  },
  {
    title: 'Mi niña',
    artist: 'Wisin, Myke Towers',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(3).webp',
  },
  {
    title: 'Rara vez',
    artist: 'Milo J, Taiu',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(4).webp',
  },
  {
    title: 'Pareja del año',
    artist: 'Sebastián Yatra, Myke Towers',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(5).webp',
  },
  {
    title: 'Cuando te vi',
    artist: 'Trueno, Maria Becerra',
    cover:
      'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png',
  },
  {
    title: 'Todo de Ti',
    artist: 'Rauw Alejandro',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(7).webp',
  },
  {
    title: 'Tacones Rojos',
    artist: 'Sebastián Yatra',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/OIP%20(8).webp',
  },
  {
    title: 'Bailando',
    artist: 'Enrique Iglesias',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/R%20(1).png',
  },
  {
    title: 'La Plena',
    artist: 'Beéle, Westcol',
    cover:
      'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/ab67616d0000b2734740100d84f3667f1eae6870.jpeg',
  },
  {
    title: 'Cosas Que No Te Dije',
    artist: 'Saiko',
    cover:
      'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/ab67616d0000b273fb045f7dda9773e266437bc6.jpeg',
  },
  {
    title: 'Indeciso',
    artist: 'Reik, J Balvin',
    cover: 'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/R%20(3).jpeg',
  },
  {
    title: 'Loco Enamorado',
    artist: 'Abraham Mateo, Farruko',
    cover:
      'https://canciones-que-me-recuerdan-a-ti.vercel.app/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png',
  },
];

// ==========================================
// HELPERS
// ==========================================
const nf = new Intl.NumberFormat('es-ES');

function shortDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(
    new Date(y, m - 1, d)
  );
}

function countdownLabel(days) {
  if (days <= 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  return `${days} días`;
}

// La bienvenida temática vive en components/SpecialEventSheet.js: el Inicio
// la dispara, pero también se puede abrir a mano con `?evento=halloween`
// (o `?evento=2026-10-31`) para ver un día temático sin esperar a esa fecha.
function previewRequestedEvent(router) {
  const requested = router?.currentRoute?.query?.evento;
  if (!requested) return false;
  if (!previewSpecialEventSheet(requested, router)) return false;
  // Se limpia el parámetro de la URL al abrirla, para no reaparecer en cada
  // recarga. Se reconstruye la query en vez de recortarla: si `evento` va en
  // medio, un replace deja un `?&` colgando.
  const [base, query = ''] = window.location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  params.delete('evento');
  const rest = params.toString();
  const next = `${window.location.pathname}${window.location.search}#${base}${rest ? `?${rest}` : ''}`;
  window.history.replaceState(history.state, '', next);
  return true;
}

/** Contador que sube hasta el número real (respeta reduced-motion). */
function animateNumber(el, to) {
  const from = Number(el.textContent.replace(/\D/g, '')) || 0;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || from === to) {
    el.textContent = nf.format(to);
    return;
  }
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
  const thumb = isVid
    ? getVideoPoster(url)
    : url.replace('/q_auto,f_auto,w_800/', '/q_auto:good,f_auto,w_600,c_fill,g_auto/');
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
      } catch {
        /* sin duración: barra neutra */
      }
      return {
        title: d.title,
        artist: d.artist || '',
        cover: d.cover || '',
        time: d.time || 0,
        duration,
        audio: d.audio || '',
      };
    }
  } catch {
    /* ignore */
  }
  if (rng && RANDOM_COVERS.length) {
    const pick = pickSeeded(RANDOM_COVERS, rng);
    return {
      title: pick.title,
      artist: pick.artist,
      cover: pick.cover,
      time: 0,
      duration: 0,
      audio: '',
    };
  }
  return null;
}

function getMessage(rng) {
  // Los borradores «pronto» no tienen texto: nunca salen en el saludo.
  const ready = (LETTERS || []).filter(l => l.status !== 'pronto');
  return ready.length ? pickSeeded(ready, rng) : null;
}

/** Ánimo registrado hoy (local; la app lo sincroniza al arrancar). */
function readMood() {
  try {
    const mood = moodStore.getTodayMood();
    return mood && (mood.label || mood.emoji) ? mood : null;
  } catch {
    return null;
  }
}

/**
 * Etiqueta corta del ánimo. Con varias emociones no caben todas en la tarjeta:
 * se enseña la primera y cuántas más hay.
 */
function moodLabel(mood) {
  if (!mood) return 'Registrado';
  if (mood.count > 1) return `${mood.items[0].label} +${mood.count - 1}`;
  return mood.label || 'Registrado';
}

// ==========================================
// BLOQUES DE MARCADO
// ==========================================
/**
 * Lo de hoy, en el orden en que se mira: primero cómo está, después qué
 * toca ese día. El ánimo sale del store y la próxima fecha del registro de
 * fechas: aquí solo se pinta lo que ya calcularon sus dueños.
 */
function todayCards(partnerMood = null) {
  const mood = readMood();
  const moodCard = (value, label, empty, aria) => `
    <button class="home-stat" type="button" data-route="/sentimientos" aria-label="${aria}">
      <span class="home-stat__ic">${icon('smile', 17)}</span>
      <span class="home-stat__num${value ? ' home-stat__num--emoji' : ''}">${value ? escapeHtml(value.emoji || '🙂') : '-'}</span>
      <span class="home-stat__label">${escapeHtml(value ? moodLabel(value) : 'Sin registrar')}</span>
      <span class="home-stat__sub">${value ? label : empty}</span>
    </button>`;
  return `
    ${moodCard(mood, 'Tu estado de hoy', 'Registra tu estado', 'Tu estado de ánimo de hoy')}
    ${moodCard(partnerMood, 'Estado de hoy de tu pareja', 'Aún no ha registrado', 'Estado de ánimo de tu pareja')}
  `;
}

/* ==========================================
   PRÓXIMO PLAN — calendario compartido
   Inicio no guarda una copia del calendario: pide los eventos al mismo
   servicio que /agenda y reutiliza `nextEvent()`. Si no hay planes (o la
   tabla 034 aún no está aplicada), la tarjeta sigue con las fechas
   especiales de siempre.
   ========================================== */
let sharedNextEvent = null;
let sharedNextEventRequest = null;

/** Carga el próximo plan del calendario compartido (una petición por visita). */
function loadSharedNextEvent() {
  if (!sharedNextEventRequest) {
    sharedNextEventRequest = agendaEntries('event')
      .then(rows => {
        sharedNextEvent = nextEvent(rows, todayISO());
        return sharedNextEvent;
      })
      .catch(() => sharedNextEvent)
      .finally(() => {
        sharedNextEventRequest = null;
      });
  }
  return sharedNextEventRequest;
}

/**
 * La próxima cosa que viene: el plan del calendario compartido o la fecha
 * especial configurada, la que caiga antes. La tarjeta solo enlaza; la
 * pantalla y sus datos siguen siendo de /agenda.
 */
function nextDateCard() {
  const special = nextSpecialDate();
  const plan = sharedNextEvent;
  const isPlan = Boolean(plan) && (!special || plan.days <= special.days);
  const next = isPlan ? plan : special;
  return `
    <button class="home-next-date" type="button" data-route="/calendario">
      <span class="home-next-date__icon">${icon('calendar', 20)}</span>
      <span class="home-next-date__content">
        <span class="home-next-date__eyebrow">${isPlan ? 'Próximo plan' : 'Próxima fecha'}</span>
        <strong>${escapeHtml(next ? next.title : 'Añade un plan o una fecha')}</strong>
        <small>${next ? `${escapeHtml(shortDate(next.date))} · ${escapeHtml(countdownLabel(next.days))}` : 'Ábrelo en el calendario compartido'}</small>
      </span>
      ${icon('chev', 18)}
    </button>
  `;
}
/**
 * El día especial de hoy, en el Inicio y siempre visible: la hoja se abre una
 * sola vez sola, así que este banner es la forma de volver a verla cuando
 * apetezca. Solo aparece si hoy cae algo; nunca anuncia fechas futuras.
 */
function todayEventBanner() {
  const events = specialEventsToday();
  const event = events[0];
  if (!event) return '';
  const template = eventTemplateFor(event.type);
  const [accent, soft] = SPECIAL_EVENT_TONES[template.id] || SPECIAL_EVENT_TONES.custom;
  const extra = events.length > 1 ? ` y ${events.length - 1} más` : '';
  return `
    <button class="home-event-banner home-event-banner--${escapeHtml(template.id)}" type="button" data-special-event style="--event-banner-accent:${accent};--event-banner-soft:${soft}" aria-label="Volver a abrir la celebración de ${escapeHtml(event.title)}">
      <span class="home-event-banner__icon" aria-hidden="true">${escapeHtml(event.icon || template.defaultEmoji || template.icon)}</span>
      <span class="home-event-banner__body">
        <span class="home-event-banner__eyebrow">Hoy es especial${escapeHtml(extra)}</span>
        <b>${escapeHtml(event.title)}</b>
        <span>${escapeHtml(template.label)} · ${escapeHtml(event.description || template.defaultDescription)}</span>
      </span>
      <span class="home-event-banner__cta">Ver celebración ${icon('chev', 16)}</span>
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
  const pct =
    song.duration && song.time
      ? Math.min(100, Math.round((song.time / song.duration) * 100))
      : song.time > 0
        ? 100
        : 0;
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

/** Los tres atajos van en una sola fila: icono arriba y su nombre debajo. */
function shortcutsHTML() {
  return `
    <div class="home-shortcuts">
      <button class="home-shortcut" type="button" data-route="/maldia" aria-label="Mal día: un abrazo cuando lo necesites">
        <span class="home-shortcut__ic">${icon('heart-handshake', 19)}</span>
        <span class="home-shortcut__body"><b>Mal día</b></span>
      </button>
      <button class="home-shortcut" type="button" data-route="/openwhen" aria-label="Open When: cartas para cuando toque">
        <span class="home-shortcut__ic">${icon('mail', 19)}</span>
        <span class="home-shortcut__body"><b>Open When</b></span>
      </button>
      <button class="home-shortcut" type="button" data-route="/menstruacion" aria-label="Menstruación: tu ciclo, día a día">
        <span class="home-shortcut__ic">${icon('droplet', 19)}</span>
        <span class="home-shortcut__body"><b>Menstruación</b></span>
      </button>
    </div>
  `;
}

/** Tarjeta de una serie empezada: portada, recuento y + / −. */
function watchCardHTML(c) {
  const id = escapeHtml(c.item.id);
  const title = escapeHtml(c.item.titulo || 'Serie');
  const completed = c.watched >= c.total;
  return `
    <article class="home-watch">
      <button class="home-watch__cover" type="button" data-route="/series?id=${encodeURIComponent(c.item.id)}" aria-label="Abrir ${title}">
        ${c.item.portada ? `<img src="${escapeHtml(c.item.portada)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="home-watch__fallback" style="display:${c.item.portada ? 'none' : 'flex'}">🎬</span>
      </button>
      <div class="home-watch__body">
        <span class="home-watch__title">${title}</span>
        <span class="home-watch__meta">${completed ? `Completa · ${c.total} eps` : `Ep. ${c.watched} <em>de ${c.total}</em>`}</span>
        <span class="home-watch__bar"><span style="width:${Math.max(c.percent, 3)}%"></span></span>
      </div>
      <div class="home-watch__ctrl">
        <button type="button" class="home-watch__btn" data-watch-step="-1" data-watch-item="${id}"
          aria-label="Quitar un episodio a ${title}"${c.watched > 0 ? '' : ' disabled'}>${icon('minus', 16)}</button>
        <button type="button" class="home-watch__btn home-watch__btn--add" data-watch-step="1" data-watch-item="${id}"
          aria-label="Añadir un episodio a ${title}"${completed ? ' disabled' : ''}>${icon('plus', 16)}</button>
      </div>
    </article>
  `;
}

/**
 * «Un año hoy»: fotos del mismo día y mes de años anteriores.
 *
 * Se calcula con la fecha que ya trae cada foto (`galleryData.photoDate`) y
 * no se pinta si no hay ninguna: mejor ausente que una tarjeta vacía.
 */
function yearAgoHTML() {
  let photos = [];
  try {
    photos = visiblePhotos('todas')
      .slice(0, 400)
      .map(url => ({ url, dateText: photoDate(url) }))
      .filter(photo => photo.dateText);
  } catch {
    return '';
  }
  const matches = sameDayInPast(photos, todayISO()).slice(0, 6);
  if (!matches.length) return '';

  return `
    <section class="pro-card home-year" aria-label="Tal día como hoy">
      <header class="pro-card__head">
        <span class="pro-card__kicker">Tal día como hoy</span>
        <button class="link" type="button" data-route="/galeria">Ver galería</button>
      </header>
      <div class="pro-year">
        ${matches
          .map(
            photo => `<figure class="pro-year__item">
              <img src="${escapeHtml(photo.url)}" alt="" loading="lazy" decoding="async">
              <figcaption class="pro-year__badge">hace ${photo.yearsAgo} ${photo.yearsAgo === 1 ? 'año' : 'años'}</figcaption>
            </figure>`
          )
          .join('')}
      </div>
    </section>
  `;
}

/** Sección "Estás viendo": solo aparece si hay alguna serie empezada. */
function watchSectionHTML() {
  const list = getStartedSeries();
  if (!list.length) return '';
  return `
    <section class="home-watch-section" aria-label="Series que estás viendo">
      <h2 class="section-title">Estás viendo
        <button class="link" type="button" data-route="/series">Ver series</button>
      </h2>
      <div class="home-watch__list">${list.map(watchCardHTML).join('')}</div>
    </section>
  `;
}

// ==========================================
// MAPA — distancia entre los dos
// ==========================================
// Dos círculos con las fotos y el número en medio, como el diseño. Este de
// aquí es un dibujo ligero que se ve siempre; al tocarlo se abre el mapa real
// (DistanceMapSheet), que es el único sitio donde se cargan las teselas.
function avatarCircle(who, { name = '', avatar = '' } = {}) {
  const initial = (name || '').trim().charAt(0).toUpperCase();
  const label = who === 'me' ? 'Tú' : 'Tu pareja';
  const inner = avatar
    ? `<img src="${escapeHtml(mediaUrl(avatar))}" alt="">`
    : `<span aria-hidden="true">${escapeHtml(initial || '♥')}</span>`;
  return `<span class="home-map__avatar home-map__avatar--${who}" aria-label="${escapeHtml(label)}">${inner}</span>`;
}

// ==========================================
// CABECERA — las dos caras y los ajustes
// ==========================================
/** Una cara: la foto si la hay y, si no, la inicial (o el corazón). */
function paintFace(el, profile, fallbackAvatar = '', blockedAvatar = '') {
  if (!el) return;
  const candidate = profile?.avatar || fallbackAvatar || '';
  const avatar = candidate && candidate !== blockedAvatar ? candidate : '';
  const initial = (profile?.name || '').trim().charAt(0).toUpperCase();
  el.innerHTML = avatar
    ? `<img src="${escapeHtml(mediaUrl(avatar))}" alt="">`
    : `<span aria-hidden="true">${escapeHtml(initial || '♥')}</span>`;
}

/**
 * Rellena las caras de la barra superior. La mía sale del store al instante;
 * la suya llega después, igual que en el mapa (perfil o latido de presencia).
 */
function initHeaderFaces(page) {
  const meEl = page.querySelector('#homeTopMe');
  const themEl = page.querySelector('#homeTopThem');
  if (!meEl || !themEl) return () => {};
  const me = userStore.getUser();
  let stopped = false;

  (async () => {
    const [mine, partnerId] = await Promise.all([fetchProfile(me?.id), fetchPartnerIdentity()]);
    if (stopped) return;
    paintFace(meEl, mine, me?.avatar);
    // Sin id (recién instalado, sin latido ni ubicación) se busca por descarte.
    const partner = partnerId
      ? (await fetchProfile(partnerId)) || (await fetchPartnerProfile(partnerId))
      : await fetchPartnerProfile();
    if (stopped) return;
    paintFace(themEl, partner, '', mine?.avatar || me?.avatar || '');
  })().catch(() => {
    /* sin red: se quedan las iniciales */
  });

  return () => {
    stopped = true;
  };
}

function distancePanelHTML() {
  const me = userStore.getUser() || {};
  return `
    <button type="button" class="home-map" id="homeMapOpen" aria-label="Ver el mapa con las dos ubicaciones">
      <svg class="home-map__art" viewBox="0 0 360 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <rect width="360" height="160" fill="#eef1ea"/>
        <path d="M0 122 L118 100 L236 112 L360 92 L360 160 L0 160Z" fill="#e3ebd9"/>
        <circle cx="306" cy="34" r="30" fill="#dcead7"/>
        <path d="M-10 44 L86 56 L182 38 L292 52 L370 34" stroke="#ffffff" stroke-width="11" fill="none"/>
        <path d="M34 -10 L46 74 L34 160" stroke="#ffffff" stroke-width="7" fill="none"/>
        <path d="M252 -10 L264 64 L252 150" stroke="#ffffff" stroke-width="7" fill="none"/>
        <path d="M118 -10 L126 160" stroke="#f8f9f5" stroke-width="4" fill="none"/>
        <path d="M0 92 L360 78" stroke="#f8f9f5" stroke-width="4" fill="none"/>
        <circle cx="300" cy="126" r="24" fill="#d7e6f0"/>
      </svg>
      <div class="home-map__canvas">
        ${avatarCircle('me', { name: me.name, avatar: me.avatar })}
        <div class="home-map__dist">
          <strong id="homeDistanceValue">—</strong>
          <span id="homeDistanceLabel">Distancia</span>
        </div>
        ${avatarCircle('them')}
      </div>
      <p class="home-map__hint" id="homeMapHint" hidden></p>
    </button>
  `;
}

/**
 * Arranca el panel: comparte tu posición, pinta la de la otra persona y
 * actualiza el número. Devuelve la función para parar (page.cleanup).
 */
function initDistancePanel(page, onChange) {
  const valueEl = page.querySelector('#homeDistanceValue');
  const labelEl = page.querySelector('#homeDistanceLabel');
  const meEl = page.querySelector('.home-map__avatar--me');
  const themEl = page.querySelector('.home-map__avatar--them');
  const hintEl = page.querySelector('#homeMapHint');
  const me = userStore.getUser();

  let stopped = false;

  // El aviso no es un texto pasivo: lleva su icono y el botón que dispara el
  // diálogo del sistema (o del navegador) solo cuando la persona lo toca.
  const setHint = (text, action) => {
    if (!hintEl) return;
    hintEl.hidden = !text;
    hintEl.replaceChildren();
    if (!text) return;
    hintEl.insertAdjacentHTML('beforeend', icon('map', 14));
    const label = document.createElement('span');
    label.textContent = text;
    hintEl.append(label);
    if (!action) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'home-map__allow';

    // Ya denegado: el diálogo no vuelve a salir; el botón lleva a ajustes.
    if (action === 'settings') {
      btn.textContent = 'Ajustes';
      btn.addEventListener('click', () => void openDeviceSettings());
      hintEl.append(btn);
      return;
    }

    btn.textContent = 'Permitir';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Pidiendo…';
      const granted = await requestLocationPermission(handleStatus);
      if (!granted && hintEl.isConnected) {
        btn.disabled = false;
        btn.textContent = 'Reintentar';
      }
    });
    hintEl.append(btn);
  };

  const handleStatus = status => {
    if (stopped) return;
    if (status === 'ok') {
      setHint('');
      return;
    }
    if (status === 'denied') {
      setHint('Ubicación bloqueada en los ajustes', 'settings');
      return;
    }
    if (status === 'error') {
      setHint('No se pudo leer tu ubicación', 'allow');
      return;
    }
    // 'prompt': todavía no se ha preguntado, así que se ofrece el botón.
    setHint('Comparte tu ubicación para ver la distancia', 'allow');
  };

  // Una cara: foto si la hay; si no, la inicial (o el corazón). `blockedAvatar`
  // evita pintar en la pareja una foto que en realidad es la mía.
  const fill = (el, profile, fallbackAvatar, blockedAvatar = '') =>
    paintFace(el, profile, fallbackAvatar, blockedAvatar);

  // El nombre y la foto viajan con la posición: la otra cuenta no siempre
  // puede leerlos de `profiles`, así que los manda quien los conoce.
  startLocationSharing(
    { userId: me?.id, isAdmin: userStore.isAdmin, name: me?.name, avatar: me?.avatar },
    handleStatus
  );

  // Lo que necesita el mapa al abrirse: última distancia y datos de cada uno.
  const state = {
    km: null,
    together: false,
    partner: null,
    me: { name: me?.name || 'Tú', avatar: me?.avatar || '' },
  };

  // Las dos caras se pintan de entrada, sin esperar a la ubicación: la foto se
  // ve siempre, aunque la otra cuenta no haya compartido dónde está.
  (async () => {
    const [mine, partnerId] = await Promise.all([fetchProfile(me?.id), fetchPartnerIdentity()]);
    if (stopped) return;
    fill(meEl, mine, me?.avatar);
    state.me = { name: mine?.name || me?.name || 'Tú', avatar: mine?.avatar || me?.avatar || '' };
    onChange?.(state);
    if (!partnerId) return;
    // Su perfil si la RLS lo deja; si no, nombre y foto del latido (el admin
    // no puede leerse desde la cuenta de ella).
    const partner = (await fetchProfile(partnerId)) || (await fetchPartnerProfile(partnerId));
    if (stopped) return;
    // Si la RLS no deja leer su perfil, el nombre y la foto llegan igual con
    // la posición (los escribe su propio móvil).
    const known = state.partner?.name || state.partner?.avatar ? state.partner : null;
    fill(themEl, partner || known, '', state.me?.avatar);
    if (partner?.name || partner?.avatar || known) {
      state.partner = {
        ...(state.partner || {}),
        name: partner?.name || known?.name || '',
        avatar: partner?.avatar || known?.avatar || '',
      };
      onChange?.(state);
    }
  })();

  const stopWatch = watchDistance(({ km, partner }) => {
    if (stopped) return;
    // A menos de 10 m (más el margen del GPS) el panel dice «Juntos» en vez
    // de una cifra que ya no distingue nada.
    const mine = fetchMyLocation();
    const near = Number.isFinite(km) ? togetherInfo(mine, partner) : null;
    state.together = !!near?.together;
    if (valueEl) valueEl.textContent = near?.together ? 'Juntos' : formatDistance(km);
    if (labelEl) labelEl.textContent = near?.together ? 'en el mismo sitio' : 'Distancia';
    state.km = km;
    if (!partner && state.partner) {
      state.partner = { name: state.partner.name, avatar: state.partner.avatar };
    }
    if (partner) {
      state.partner = {
        ...(state.partner || {}),
        ...partner,
        // Un campo vacío no debe borrar lo que ya sabíamos de la otra cara.
        name: partner.name || state.partner?.name || '',
        avatar: partner.avatar || state.partner?.avatar || '',
      };
      // Se repinta también cuando la foto CAMBIA: antes solo se pintaba si
      // todavía no había imagen, así que un avatar nuevo no se veía nunca.
      const want = `${state.partner?.avatar || ''}|${state.partner?.name || ''}`;
      if (themEl && want !== '|' && themEl.dataset.identity !== want) {
        fill(
          themEl,
          { name: state.partner.name, avatar: state.partner.avatar },
          '',
          state.me?.avatar
        );
        themEl.dataset.identity = want;
      }
    }
    onChange?.(state);
  });

  // Tocar el panel abre el mapa real con las dos posiciones y los datos de
  // cada móvil (batería, red, velocidad).
  page.querySelector('#homeMapOpen')?.addEventListener('click', () => {
    const mine = fetchMyLocation();
    openDistanceMap({
      me: mine ? { ...state.me, ...mine } : null,
      partner: state.partner,
      km: state.km,
      meName: state.me?.name,
    });
  });

  return () => {
    stopped = true;
    stopWatch();
    stopLocationSharing();
  };
}

// ==========================================
// WIDGETS — colocarlos desde la app
// ==========================================
// Android no deja añadir un widget desde código: lo que sí puede hacer la app
// es abrir el diálogo de confirmación del sistema (requestPinAppWidget). Solo
// tiene sentido dentro del APK, así que en el navegador no se pinta nada.
// Una sola tarjeta: las miniaturas ocupaban media pantalla y no aportaban
// nada que no esté ya dentro de la hoja.
function widgetsSectionHTML() {
  return `
    <section class="home-widgets" aria-label="Widgets">
      <button class="home-widgets__card" type="button" id="homeWidgetsOpen">
        <span class="home-widgets__ico">${icon('phone', 19)}</span>
        <span class="home-widgets__text">
          <b>Widgets</b>
          <span>Elige cuáles quieres en tu pantalla de inicio</span>
        </span>
        ${icon('chev', 18)}
      </button>
    </section>
  `;
}

function initWidgetsSection(page, getAvatars, getLive) {
  const btn = page.querySelector('#homeWidgetsOpen');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const { me, partner, stats, days, km, kmAt } = getAvatars?.() || {};
    const live = getLive?.() || {};
    openWidgetsSheet({
      me,
      partner,
      days,
      breakdown: stats,
      km,
      kmAt,
      next: nextSpecialDate(),
      mood: readMood(),
      // El ciclo solo lo conoce la pantalla de ciclo; en el Inicio va vacío.
      cycle: null,
      watch: getContinueWatching()[0],
      gifts: live.gifts || null,
    });
  });
}

// ==========================================
// MAIN
// ==========================================
export function HomePage(router) {
  const page = document.createElement('div');
  page.className = 'home-page';
  let partnerMood = null;

  const daysSince = daysSinceAnniversary();
  const hour = hourInSpain(); // saludo según la hora de España (península)
  const seed = dailySeed();
  const rng = seededRandom(seed);

  const timeKey = hour < 12 ? 'morning' : hour < 19 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
  const greeting = GREETINGS[timeKey][seed % GREETINGS[timeKey].length];
  // De GREETINGS solo interesa la frase del día: el saludo lo pone TIME_GREETING
  // con el apodo de quien esté mirando, para que no salga dos veces en pantalla.
  const frase = greeting.split('<br>')[1] || '';
  // El apodo sale del rol guardado en profiles (DB), no de metadata del cliente.
  const apodo = userStore.isAdmin ? 'Peluche' : 'mi princesa';
  const saludo = TIME_GREETING[timeKey];

  // Datos (síncronos)
  const meme = getMeme(rng);
  const song = getSong(rng);
  const continueList = getContinueWatching();
  const message = getMessage(rng);

  const posterPool = continueList.length
    ? continueList.slice(0, 4)
    : [...getCatalogSync()]
        .sort(() => Math.random() - 0.5)
        .map(item => ({ item }))
        .slice(0, 4);
  const posters = posterPool.map(c => c.item.portada).filter(Boolean);
  const continueFirst = continueList[0];

  // Caras de la barra superior: la mía, ya en el store, se pinta de entrada.
  const me = userStore.getUser() || {};
  const meInitial = (me.name || '').trim().charAt(0).toUpperCase();
  const meFace = me.avatar
    ? `<img src="${escapeHtml(me.avatar)}" alt="">`
    : `<span aria-hidden="true">${escapeHtml(meInitial || '♥')}</span>`;
  // Ambos usuarios comparten Inicio y acceden a sus ajustes desde Perfil.
  const gearRoute = '/perfil';

  page.innerHTML = `
    <h1 class="sr-only">Inicio</h1>

    <header class="home-topbar">
      <p class="home-topbar__greet">
        <span class="home-topbar__hi">${escapeHtml(saludo)},</span>
        <span class="home-topbar__name">${escapeHtml(apodo)}</span>
      </p>
      <div class="home-topbar__actions">
        <button class="home-topbar__faces" type="button" data-route="/perfil" aria-label="Ver los perfiles">
          <span class="home-topbar__face home-topbar__face--me" id="homeTopMe">${meFace}</span>
          <span class="home-topbar__face home-topbar__face--them" id="homeTopThem"><span aria-hidden="true">♥</span></span>
        </button>
        <button class="home-topbar__gear" type="button" data-route="${gearRoute}" aria-label="Ajustes">${icon('gear', 19)}</button>
      </div>
    </header>

    <section class="home-hero" aria-label="Tiempo juntos">
      <button class="home-hero__heart" type="button" data-route="/juntos" aria-label="Abrir la pantalla de los días juntos">${icon('eye', 18)}</button>
      <button class="home-hero__edit" type="button" id="homeHeroEdit" aria-label="Cambiar la imagen de la portada">${icon('camera', 16)}</button>
      <p class="home-hero__eyebrow">Llevamos juntos…</p>
      <p class="home-hero__main">
        <span class="home-hero__num" id="homeCounter">0</span>
        <span class="home-hero__label">días juntos</span>
      </p>
    </section>

    ${frase ? `<p class="home-quote">«${escapeHtml(frase)}»</p>` : ''}

    <div class="home-stats">${todayCards(partnerMood)}</div>

    ${shortcutsHTML()}

    <div id="homeNextDateSlot">${nextDateCard()}</div>
    <div id="homeSpecialEventSlot">${todayEventBanner()}</div>

    ${distancePanelHTML()}

    <div id="homeWatchSlot">${watchSectionHTML()}</div>

    ${yearAgoHTML()}

    <h2 class="section-title">Destacados de hoy
      <button class="link" type="button" data-route="/rincon">Ver el Rincón</button>
    </h2>

    <div class="home-grid">
      ${tileMeme(meme)}
      ${tileMessage(message)}
      ${tileSeries(continueList, posters, continueFirst)}
      ${tileSong(song)}
    </div>

    ${widgetsSectionHTML()}
  `;

  // Datos de los widgets: se guardan cada vez que cambian las caras o la
  // distancia, porque el widget no puede calcularlos por su cuenta.
  const widgetStats = togetherBreakdown(daysSince);
  // Sorpresas de hoy para la hoja de widgets (llegan después del primer
  // pintado; el Inicio las carga en diferido).
  let widgetGifts = null;

  let widgetAvatars = {
    me: null,
    partner: null,
    stats: widgetStats,
    days: daysSince,
    km: null,
    kmAt: null,
  };

  // Los días se guardan nada más entrar, sin esperar a la ubicación: si el
  // permiso está denegado o no hay GPS, el contador debe verse igual (las
  // caras no se pierden: las conserva saveDaysWidget). Se vuelve a guardar
  // cuando llegan las fechas reales de Supabase: el widget calcula los días
  // desde `since`, así que un aniversario cambiado en otro móvil debe llegar
  // aquí también.
  const persistDays = (total = daysSince) => {
    if (!isNative()) return;
    const stats = togetherBreakdown(total);
    trackWidgetSave(
      saveDaysWidget({
        days: total,
        years: stats.years,
        months: stats.months,
        weeks: Math.floor(total / 7),
        breakdown: stats,
        since: specialDates().anniversary,
      })
    );
  };

  persistDays();

  // La cuenta atrás se guarda con la próxima fecha ya calculada por su dueño
  // (specialDates), no se recalcula en el widget: aquí solo viaja el dato.
  // Se guarda la lista entera, no solo la próxima: el widget deja elegir por
  // instancia qué fechas enseñar. Los tamaños pequeño y apaisado usan la
  // primera (la más cercana).
  const persistCountdown = () => {
    if (!isNative()) return;
    const next = nextSpecialDate();
    trackWidgetSave(
      saveCountdownWidget({
        title: next?.title || '',
        date: next?.date || '',
        events: upcomingSpecialDates(6),
      })
    );
  };

  // El widget de ánimo es SUYO: guarda el de ella aunque la sesión con la que
  // se mire sea la del administrador (widgets.service lo resuelve).
  const persistMood = () => {
    if (!isNative()) return;
    trackWidgetSave(saveHerMoodWidget());
  };

  // «Seguir viendo»: lo mismo que enseña la tarjeta del Inicio. Se guarda al
  // entrar y cuando llega el progreso de otro dispositivo.
  const persistWatching = () => {
    if (!isNative()) return;
    const first = getContinueWatching()[0];
    trackWidgetSave(
      saveWatchingWidget({
        title: first?.item?.titulo || '',
        poster: first?.item?.portada || '',
        watched: first?.watched || 0,
        total: first?.total || 0,
        percent: first?.percent || 0,
      })
    );
  };

  persistCountdown();
  persistMood();
  persistWatching();

  const handleDistanceChange = state => {
    // La cara de la barra superior se pinta en cuanto se sabe quién es: así no
    // depende de que la primera consulta llegue antes que el latido.
    if (state.partner?.avatar || state.partner?.name) {
      paintFace(page.querySelector('#homeTopThem'), state.partner, '', state.me?.avatar || '');
    }

    // El aniversario puede haber cambiado desde que se abrió la pantalla: se
    // recalcula con la fecha vigente en vez de reutilizar la de arranque (si
    // no, cada aviso de distancia devolvía la hoja y el widget a los valores
    // de antes de sincronizar).
    const total = daysSinceAnniversary();
    const stats = togetherBreakdown(total);

    widgetAvatars = {
      me: state.me,
      partner: state.partner,
      stats,
      days: total,
      km: Number.isFinite(state.km)
        ? state.together ? 'Juntos' : formatDistance(state.km)
        : null,
      kmAt: Number.isFinite(state.km) ? Date.now() : null,
    };
    if (!isNative()) return;
    trackWidgetSave(
      saveDaysWidget({
        days: total,
        months: stats.months,
        weeks: Math.floor(total / 7),
        years: stats.years,
        breakdown: stats,
        since: specialDates().anniversary,
        me: state.me,
        partner: state.partner,
      })
    );
    // El estado del móvil de ella viaja con su posición; el widget solo lo
    // lee (no puede preguntarlo).
    trackWidgetSave(
      saveDistanceWidget({
        km: state.km,
        me: { ...state.me, ...fetchMyLocation() },
        partner: state.partner,
        device: state.partner,
      })
    );
  };

  // Distancia primero: es quien guarda la identidad de la sesión y de la otra
  // persona; las caras de la cabecera la aprovechan justo después.
  const stopDistance = initDistancePanel(page, handleDistanceChange);
  const stopHeaderFaces = initHeaderFaces(page);

  // Pestaña de widgets (solo existe dentro del APK)
  initWidgetsSection(
    page,
    () => widgetAvatars,
    () => ({ gifts: widgetGifts })
  );

  // ===== Portada: las fotos de «días juntos» =====
  // La lista es de la pareja (sql/031), así que lo que se añade o se quita en
  // un móvil aparece en el otro. El componente lleva la rotación (5 s) y la
  // hoja para añadir y quitar; aquí solo se monta y se recoge al salir.
  const ownMoodUserId = String(userStore.getUser()?.id || '');
  const refreshPartnerMood = async () => {
    const rows = await db.getMoodsForDate(todayISO());
    if (!page.isConnected) return;
    const row = rows.find(item => String(item.user_id || '') !== ownMoodUserId);
    partnerMood = row ? moodStore.resolveMood(row) : null;
    const stats = page.querySelector('.home-stats');
    if (stats) stats.innerHTML = todayCards(partnerMood);
  };
  const stopPartnerMoodUpdates = onMoodChange(mood => {
    if (String(mood?.user_id || '') === ownMoodUserId || mood?.date !== todayISO()) return;
    void refreshPartnerMood();
  });
  void refreshPartnerMood();

  const stopPortada = initHomePortada(page.querySelector('.home-hero'));

  // Contador — arranca ya y se corrige cuando llegan las fechas reales
  animateNumber(page.querySelector('#homeCounter'), daysSince);
  const paintNextDate = () => {
    const slot = page.querySelector('#homeNextDateSlot');
    if (slot) slot.innerHTML = nextDateCard();
  };
  // El plan del calendario compartido llega después del primer pintado. Al
  // llegar se repinta la misma tarjeta: no se abre /agenda ni se copian sus
  // datos (el servicio y `nextEvent()` son los mismos que usa esa pantalla).
  void loadSharedNextEvent().then(() => {
    if (page.isConnected) paintNextDate();
  });

  loadSpecialDates()
    .then(() => {
      const total = daysSinceAnniversary();
      const el = page.querySelector('#homeCounter');
      if (el) animateNumber(el, total);
      paintNextDate();
      // El widget y la hoja pasan a los datos sincronizados.
      widgetAvatars = { ...widgetAvatars, days: total, stats: togetherBreakdown(total) };
      persistDays(total);
      persistCountdown();
      const stats = page.querySelector('.home-stats');
      if (stats) stats.innerHTML = todayCards(partnerMood);
      const eventSlot = page.querySelector('#homeSpecialEventSlot');
      if (eventSlot) eventSlot.innerHTML = todayEventBanner();
      // Espera las fechas sincronizadas para detectar también aniversarios y
      // eventos personalizados configurados en otro dispositivo.
      if (!previewRequestedEvent(router)) maybeShowSpecialEvent(page, router);
    })
    .catch(() => {
      if (!previewRequestedEvent(router)) maybeShowSpecialEvent(page, router);
    });

  // Navegación delegada: cualquier [data-route] navega (también lo insertado después)
  page.addEventListener('click', event => {
    const special = event.target.closest('[data-special-event]');
    if (special && page.contains(special)) {
      replaySpecialEventSheet(router);
      return;
    }
    const target = event.target.closest('[data-route]');
    if (target && page.contains(target)) router.navigate(target.dataset.route);
  });

  // + / − de "Estás viendo": guarda el capítulo y repinta la sección en el acto.
  const watchSlot = page.querySelector('#homeWatchSlot');
  page.addEventListener('click', event => {
    const btn = event.target.closest('[data-watch-step]');
    if (!btn || !page.contains(btn)) return;
    const res = bumpWatched(btn.dataset.watchItem, Number(btn.dataset.watchStep));
    if (res && watchSlot) watchSlot.innerHTML = watchSectionHTML();
  });

  // La tarjeta "Seguir viendo" de Destacados también refleja el progreso
  // que acaba de llegar de otro dispositivo.
  function refreshContinueTile() {
    const tile = page.querySelector('[data-poster-rotate]');
    if (!tile) return;
    const first = getContinueWatching()[0];
    if (!first) return;
    const t = tile.querySelector('[data-role="title"]');
    const s = tile.querySelector('[data-role="sub"]');
    const bar = tile.querySelector('[data-role="bar"]');
    if (t) t.textContent = first.item.titulo;
    if (s) s.textContent = `Ep. ${first.watched} de ${first.total} · ${first.percent}%`;
    if (bar) bar.style.width = `${Math.max(first.percent, 4)}%`;
  }

  // Progreso de la cuenta: lo visto en otro dispositivo llega después del
  // primer pintado, así que las tarjetas se repintan cuando termina.
  hydrateProgress()
    .then(() => {
      if (watchSlot) watchSlot.innerHTML = watchSectionHTML();
      refreshContinueTile();
      persistWatching();
    })
    .catch(() => {
      /* sin red: se queda lo local */
    });

  // Rotación de portadas (10s) cuando no hay nada que seguir viendo
  const rotateEl = page.querySelector('[data-poster-rotate]');
  let stopRotation = () => {};
  if (rotateEl && posters.length > 1) {
    stopRotation = startPosterRotation(rotateEl, posters, {
      onChange: i => {
        if (!continueList.length) return; // aleatorio: solo cambia la portada
        const c = continueList[i % continueList.length];
        if (!c) return;
        const t = rotateEl.querySelector('[data-role="title"]');
        const s = rotateEl.querySelector('[data-role="sub"]');
        const bar = rotateEl.querySelector('[data-role="bar"]');
        if (t) t.textContent = c.item.titulo;
        if (s) s.textContent = `Ep. ${c.watched} de ${c.total} · ${c.percent}%`;
        if (bar) bar.style.width = `${Math.max(c.percent, 4)}%`;
      },
    });
  }

  // El ánimo de hoy lo avisa el store cuando cambia: al registrarlo desde
  // cualquier pantalla o cuando llega de Supabase al arrancar. Así el Inicio
  // no necesita temporizadores ni repintar cada vez que se recupera el foco.
  const unsubscribeMood = moodStore.subscribe(() => {
    const stats = page.querySelector('.home-stats');
    if (stats) stats.innerHTML = todayCards(partnerMood);
    persistMood();
  });

  // Sorpresas de hoy — carga diferida: no pesa en el arranque. El reparto del
  // día y lo que queda por abrir los calcula el servicio dueño del catálogo
  // (gifts.service), no esta pantalla.
  let cancelled = false;
  import('../services/gifts.service.js')
    .then(async ({ loadGiftsCatalog, todayCalendarGifts }) => {
      await loadGiftsCatalog();
      return todayCalendarGifts();
    })
    .then(count => {
      widgetGifts = { total: count.total, pending: count.pending };
      if (isNative()) {
        trackWidgetSave(saveGiftsWidget(count));
      }
      if (cancelled || !count.total) return;
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
    .catch(() => {
      /* sin catálogo: sin aviso */
    });

  page.cleanup = () => {
    cancelled = true;
    unsubscribeMood();
    stopPartnerMoodUpdates();
    stopRotation();
    stopPortada();
    stopHeaderFaces();
    stopDistance();
  };

  return page;
}
