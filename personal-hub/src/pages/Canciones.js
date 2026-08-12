/* ==========================================
   Personal Hub v2 — Canciones Page
   Premium Music App: playlists, search, queue, continue listening
   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { formatTime, todayISO, hourInSpain } from '../utils/format.js';
import { userPrefKey, migrateUserPref } from '../utils/userStorage.js';
import { db } from '../services/db.service.js';
import { onContentChange } from '../services/realtime.service.js';
import { player } from '../services/player.service.js';
import { userStore } from '../stores/user.store.js';
import {
  songKey, songKeyOf,
  loadPlaylists, getCachedPlaylists,
  createPlaylist, updatePlaylist, deletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist, moveSong,
  initPlaylistsRealtime, onPlaylistsChange
} from '../services/playlists.service.js';
import {
  startListenTogether, stopListenTogether, onListenTogether,
  requestListenTogether, cancelListenRequest, getListenTogetherState,
  submitListenState, fetchListenState
} from '../services/listenTogether.service.js';

const SONGS_BASE = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

const HERO_DEFAULT_IMG = `${SONGS_BASE}/Fotos/OIP%20(8).webp`;

const PLAYLIST_ICON_CHOICES = ['❤️', '🎵', '🎉', '🌙', '🚀', '⭐', '🌧️', '💜', '🔥', '🫶'];

// ==========================================
// ICONOS SVG (estilo lucide, mismo lenguaje visual que el sidebar)
// ==========================================
const svgIcon = (inner, size = 16, fill = false) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const MUSIC_ICONS = {
  music:  (s = 16) => svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', s),
  mic:    (s = 16) => svgIcon('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>', s),
  disc:   (s = 16) => svgIcon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>', s),
  heart:  (s = 16) => svgIcon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', s),
  'heart-off': (s = 16) => svgIcon('<path d="m2 2 20 20"/><path d="M16.5 16.5 12 21l-7-7c-1.5-1.45-3-3.2-3-5.5A5.5 5.5 0 0 1 7.5 3c1.76 0 3 .5 4.5 2 1.5-1.5 2.74-2 4.5-2a5.5 5.5 0 0 1 5.5 5.5c0 1.43-.5 2.74-1.5 4"/>', s),
  star:   (s = 16) => svgIcon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', s),
  sparkles: (s = 16) => svgIcon('<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>', s),
  'cloud-rain': (s = 16) => svgIcon('<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="14" x2="8" y2="18"/><line x1="12" y1="14" x2="12" y2="22"/>', s),
  shuffle: (s = 16) => svgIcon('<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>', s),
  play:   (s = 16) => svgIcon('<polygon points="5 3 19 12 5 21 5 3"/>', s, true),
  plus:   (s = 16) => svgIcon('<path d="M5 12h14"/><path d="M12 5v14"/>', s),
  list:   (s = 16) => svgIcon('<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>', s),
  'list-x': (s = 16) => svgIcon('<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="m19 10 4 4"/><path d="m23 10-4 4"/>', s),
  'list-plus': (s = 16) => svgIcon('<path d="M3 6h13"/><path d="M3 12h13"/><path d="M3 18h7"/><path d="M19 9v6"/><path d="M22 12h-6"/>', s),
  'play-next': (s = 16) => svgIcon('<path d="M4 5v14l9-7-9-7Z"/><path d="M19 5v14"/>', s),
  prev:   (s = 16) => svgIcon('<polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="2.6" height="16" rx="1.3"/>', s),
  next:   (s = 16) => svgIcon('<polygon points="5 4 15 12 5 20 5 4"/><rect x="16.4" y="4" width="2.6" height="16" rx="1.3"/>', s),
  repeat: (s = 16) => svgIcon('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', s),
  'move-right': (s = 16) => svgIcon('<path d="M18 8 22 12 18 16"/><path d="M2 12H22"/>', s),
  edit:   (s = 16) => svgIcon('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', s),
  trash:  (s = 16) => svgIcon('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>', s),
  'more-v': (s = 16) => svgIcon('<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>', s, true)
};

// Icono de playlist: acepta claves ('heart', 'moon'…) o emojis de las
// playlists personalizadas del Admin; si no se reconoce, icono musical.
const EMOJI_ICON_MAP = { '❤️': 'heart', '🌙': 'moon', '✨': 'star', '🚀': 'rocket', '🌧️': 'cloud-rain', '🎵': 'music', '🎶': 'music', '💜': 'heart', '⭐': 'star', '🎤': 'mic', '💿': 'disc', '🏷️': 'tag' };
function playlistIcon(icon, size = 16) {
  const key = EMOJI_ICON_MAP[String(icon || '')] || String(icon || '');
  return (MUSIC_ICONS[key] || MUSIC_ICONS.music)(size);
}

// Quita los emojis del inicio del nombre (el icono SVG los sustituye).
function cleanPlaylistName(name) {
  return String(name || '').replace(/^[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+/u, '').trim();
}

// ==========================================
// CANCIONES QUE ME RECUERDAN A TI (with lyrics)
// ==========================================
const SONGS_RECUERDAN = [
  { title: "Si No Estás", artist: "Iñigo Quintero", cover: `${SONGS_BASE}/Fotos/1200x1200bf-60.jpg`, audio: `${SONGS_BASE}/Canciones/Si%20No%20Est%C3%A1s%20%E2%80%93%20I%C3%B1igo%20Quintero.m4a`, lyrics: `Quiero ver tu otra mitad,<br>alejarme de esta ciudad,<br>y contagiarme de tu forma de pensar.<br><br>Miro al cielo al recordar,<br>me doy cuenta otra vez más<br>que no hay momento que pase sin dejarte de pensar.`, moods: ['romanticas','relajantes'] },
  { title: "Mi niña", artist: "Wisin, Myke Towers", cover: `${SONGS_BASE}/Fotos/OIP%20(3).webp`, audio: `${SONGS_BASE}/Canciones/Wisin,_Myke_Towers,_Los_Legendarios_Mi_Ni%C3%B1a_Letra_Lyrics%20(mp3cut.net).m4a`, lyrics: `Yo quiero viajar el mundo contigo de compañía (tú sabe' ya)<br>Ninguna mujer me comprendía<br>Cierra los ojos y dime en qué lugar es que estaría (ajá)<br>Que voy a pedir una estadía`, moods: ['romanticas','animadas'] },
  { title: "Rara vez", artist: "Milo J, Taiu", cover: `${SONGS_BASE}/Fotos/OIP%20(4).webp`, audio: `${SONGS_BASE}/Canciones/Taiu,%20Milo%20j%20-%20Rara%20Vez%20(mp3cut.net).m4a`, lyrics: `Sos lo que me da paz<br>Lo que andaba buscando<br>Y esa felicidad<br>Que hace que ande sonriendo`, moods: ['romanticas','relajantes'] },
  { title: "Pareja del año", artist: "Sebastián Yatra, Myke Towers", cover: `${SONGS_BASE}/Fotos/OIP%20(5).webp`, audio: `${SONGS_BASE}/Canciones/Sebasti%C3%A1n_Yatra,_Myke_Towers_Pareja_del_A%C3%B1o_Official_Performance%20(mp3cut.net).m4a`, lyrics: `Qué tan loco sería si yo fuera<br>El dueño de tu corazón por solo un día<br>Si nos gana la alegría, yo por fin te besaría<br>¿Qué pasaría?`, moods: ['romanticas'] },
  { title: "¿A dónde vamos?", artist: "Morat", cover: `${SONGS_BASE}/Fotos/OIP%20(6).webp`, audio: `${SONGS_BASE}/Canciones/Morat%20-%20A%20D%C3%B3nde%20Vamos%20(Letra)%20_%20Albert%20%26%20Maricheli%20(mp3cut.net).m4a`, lyrics: `Que siendo un extraño, te dije te amo<br>Te he estado buscando por más de mil años<br>Y tú respondiste: ¿A dónde vamos?<br>Contra las apuestas, aquí nos quedamos`, moods: ['romanticas'] },
  { title: "Cuando te vi", artist: "Trueno, Maria Becerra", cover: `${SONGS_BASE}/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png`, audio: `${SONGS_BASE}/Canciones/Maria%20Becerra,%20Trueno,%20Big%20One%20-%20Cuando%20Te%20Vi%20_%20CROSSOVER%20%235%20(mp3cut.net).m4a`, lyrics: `Aunque todavía no soy rico (no)<br>Te puedo dar amor como de chico<br>Cosquillas en la panza, como antes del primer pico (mai)`, moods: ['romanticas','animadas'] },
  { title: "Todo de Ti", artist: "Rauw Alejandro", cover: `${SONGS_BASE}/Fotos/OIP%20(7).webp`, audio: `${SONGS_BASE}/Canciones/Rauw%20Alejandro%20-%20Todo%20de%20Ti%20(Video%20Oficial).m4a`, lyrics: `El viento soba tu cabello<br>Me matan esos ojos bellos<br><br>Me gusta tu olor, de tu piel el color<br>Y cómo me haces sentir`, moods: ['romanticas','animadas'] },
  { title: "Loco Enamorado", artist: "Abraham Mateo, Farruko", cover: `${SONGS_BASE}/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png`, audio: `${SONGS_BASE}/Canciones/Loco_Enamorado,_de_Abraham_Mateo_Ft_Farruko_%26_Christian_Daniel_Letra.m4a`, lyrics: `Te confieso, llevo un rato idealizándote<br>Toda una vida yo buscándote<br><br>Ya me tienes como un loco enamorado<br>Baby, la verdad es que tú me gustas demasiado`, moods: ['romanticas','animadas'] },
  { title: "Bailando", artist: "Enrique Iglesias", cover: `${SONGS_BASE}/Fotos/R%20(1).png`, audio: `${SONGS_BASE}/Canciones/Enrique_Iglesias_%E2%80%93_Bailando_Lyrics_feat_Descemer_Bueno,_Gente_De.m4a`, lyrics: `Yo te miro y se me corta la respiración<br>Cuando tú me miras, se me sube el corazón<br><br>Bailando, bailando<br>Tu cuerpo y el mío, llenando el vacío`, moods: ['romanticas','animadas'] },
  { title: "La Plena", artist: "Beéle, Westcol", cover: `${SONGS_BASE}/Fotos/ab67616d0000b2734740100d84f3667f1eae6870.jpeg`, audio: `${SONGS_BASE}/Canciones/Be%C3%A9le,%20Westcol,%20Ovy%20On%20The%20Drums%20-%20LA%20PLENA%20(W%20Sound%2005).m4a`, lyrics: `Eres la niña de mis ojo', tú<br>Eres todo lo que quiero yo<br><br>Ay, tienes la magia<br>Tú, sí, tienes una vainita que a mí me encanta`, moods: ['romanticas','animadas'] },
  { title: "Tacones Rojos", artist: "Sebastián Yatra", cover: `${SONGS_BASE}/Fotos/OIP%20(8).webp`, audio: `${SONGS_BASE}/Canciones/Sebasti%C3%A1n%20Yatra%20-%20Tacones%20Rojos%20(Official%20Video)%20(1).m4a`, lyrics: `Hay un rayo de luz que entró por mi ventana<br>Y me ha devuelto las ganas, me quita el dolor<br><br>Mi pedazo de Sol, la niña de mis ojos`, moods: ['romanticas','animadas'] },
  { title: "Cosas Que No Te Dije", artist: "Saiko", cover: `${SONGS_BASE}/Fotos/ab67616d0000b273fb045f7dda9773e266437bc6.jpeg`, audio: `${SONGS_BASE}/Canciones/Saiko%20-%20COSAS%20QUE%20NO%20TE%20DIJE%20(Official%20Video).m4a`, lyrics: `Que yo te quiero dormida<br>En la cama, con mi hoodie<br>Dime si te gustaría<br>Quiero ser todos tus hobbies, mami`, moods: ['romanticas'] },
  { title: "Indeciso", artist: "Reik, J Balvin, Lalo Ebratt", cover: `${SONGS_BASE}/Fotos/R%20(3).jpeg`, audio: `${SONGS_BASE}/Canciones/Reik,%20J%20Balvin,%20Lalo%20Ebratt%20-%20Indeciso%20(Letra).m4a`, lyrics: `Siempre que ella baila así<br>A mí me daña la cabeza<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso`, moods: ['romanticas','animadas'] },
  { title: "Tiroteo (Remix)", artist: "Marc Seguí, Rauw Alejandro, Pol Granch", cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", lyrics: `Aunque no pueda tenerte,<br>sé que estás en mi mente<br>Y aunque pasen los días,<br>tu recuerdo está presente.`, moods: ['romanticas','relajantes'] },
];

const ALL_SONGS = [
  { title: "Mon amour Remix", artist: "Aitana y Zzoilo", cover: "https://i1.sndcdn.com/artworks-leykoA0rJXWDmQya-cyfPxg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "(Mon amour, je t'aime)<br><br>Son las seis de la mañana y me da igual<br>Voy a salir a la calle, voy a ponerme a gritar<br>Voy a gritar que te quiero, que te quiero de verdad<br>Con esa sonrisa puesta<br><br>De verdad que no me cuesta<br>Pensar en ti cuando me acuesto<br>Pero, Aitana, no imagines el resto<br>Que si no, no queda bonito esto<br><br>Voy a ir directo a ti<br>Voy a mirarte a los ojos, no te voy a mentir (no)<br>Y como dos niños chicos, te pediré salir<br>Esperando un sí, esperando un kiss, mauh<br><br>Y es que me encantas tanto<br>Si me miras mientras canto<br>Se me pone cara tonto (tonta)<br>Niña (niño), tú me tienes loco (loca)<br><br>Y es que me gustas, no sé cuánto<br>Gogoko zaitut, como dirían los vascos<br>Si quieres, te lo digo en portugués<br>Eu gosto de você<br><br>Se me paraliza el cuerpo cuando vas a besarme<br>Me acuerdo de ti cuando voy a maquillarme<br>Cantando en los conciertos, te imagino delante<br>Siendo el más elegante, siendo el más importante<br><br>Grabando con Aitana, ya pensando en buscarte<br>Y yo en cruzar el charco, pa' poder ir a verte (ey, vamos)<br>No importa el idioma, solo quiero cantarte<br>Mon amour, amore mio, solo quiero comerte<br><br>Cuando te veo, mamá, como un Formula One<br>Paso de 0 a 100, contigo implosioné<br>De ti me envenené, yo ya no sé qué hacer<br>Me abrazaste y volé, te juro que volé<br><br>Y es que me encantas tanto<br>Si me miras mientras canto<br>Se me pone cara tonto (tonta)<br>Niña (niño), tú me tienes loco (loca)<br><br>Y es que me gustas, no sé cuánto<br>Más que el olor a café cuando me levanto<br>Contigo no hace falta dinero en el banco<br>Contigo veo París desde todo lo alto<br><br>De la Torre Eiffel, que eso está muy bien<br>Mon amour, je t'aime, parece un cliché, pero no lo es<br>Contigo, aprendí lo que es vivir, pero ya lo ves<br>Somos increíbles<br>Somos increíbles<br><br>(Aitana y zzoilo, ja)<br>Somos increíbles<br>Yeh-eh<br><br>Son las seis de la mañana y me da igual<br>Voy a salir a la calle, voy a ponerme a gritar<br>Voy a gritar que te quiero, que te quiero de verdad<br>Con esa sonrisa puesta<br><br>(Voy a ir directo a ti)<br>(Voy a mirarte a los ojos, no te voy a mentir)<br>(Y como dos niños chicos, te pediré salir)<br>(Esperando un sí, esperando un kiss)<br><br>Y es que me encantas tanto<br>Si me miras mientras canto<br>Se me pone cara tonto (tonta)<br>Niña (niño), tú me tienes loco (loca)"},
  { title: "Tiroteo (Remix)", artist: "Marc Seguí, Rauw Alejandro, Pol Granch", cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Cuando tú empiezas<br>Ojalá nunca termine'<br>Porque siempre que me besas<br>Florecen to' los jardines<br><br>Pero se fue el Sol y nunca volvió<br>Me sentí como un niño sin luz, con miedo<br>Este cuento de hadas, al final, cambió<br>Me llenó de promesas que nunca cumplió<br><br>Me dijiste que te va'<br>Que estás en busca de algo más<br>Yo como un tonto en tu portal<br>Si como un perro soy leal<br><br>Y ahora quiero que vuelvas, como un niño los finde'<br>Desde que te has ido, no hacen gracia los chiste'<br>Me he cortado el pelo, me he comprado otro tinte<br>Buscando a ver si encuentro alguna como tú en Tinder<br><br>Mi niña, eres la musa de mis canciones tristes<br>No puedo cerrar los ojos, mientras te me desvistes<br>Haces que de mí se vayan to' mis despiste'<br>Y es que olvidarte no será una tarea simple<br><br>No, oh-oh, oh-oh-oh<br>Se me congela el mundo siempre que nos vemos<br>Discutir contigo es como un tiroteo<br>Y pienso en morirme el primero, ah-ah-ah-ah-ah<br><br>Tú y yo, los dos juntito', frente al mar<br>Sé por dónde quieres ir a parar<br>Aunque mires así, no servirá<br>Si es que nos entendemos sin hablar<br><br>Muero cuando te vas<br>Toco el cielo si estás<br>Sentada en mi portal<br>Siempre haciéndote esperar<br><br>Y ahora quiero que vuelvas, como un niño los findes<br>Desde que te has ido, no hacen gracia los chistes<br>Me he cortado el pelo, me he comprado otro tinte<br>Buscando a ver si encuentro alguna como tú en Tinder<br><br>Mi niña, eres la prota' de mis canciones tristes<br>No puedo cerrar los ojos, mientras te me desvistes<br>Tú dile a las demás que no me quedan más chicles<br>Solo te doy a ti, el amor es así de simple<br><br>Uoh, oh-oh, oh-oh-oh-oh<br>Se me congela el mundo siempre que nos vemos<br>Discutir contigo es como un tiroteo<br>Y pienso en morirme el primero, ah-ah-ah-ah-ah<br><br>Tú y yo, los dos juntitos, sin pensar<br>Contigo, como un niño en Toys R Us<br>Que se apague la luz en Navidad<br>Si desprendemos electricidad<br><br>Mira, que yo lo intento, pero te desvaneces<br>Siempre me hago el contento, pero hoy no me apetece<br>Y no entienden que siempre has sido diferente<br>Como Venecia sin agua, como Madrid sin gente<br><br>Y ahora quiero que vuelvas, como un niño los findes<br>Desde que te has ido, no hacen gracia los chistes<br>Me he cortado el pelo, me he comprado otro tinte<br>Buscando a ver si encuentro alguna como tú en Tinder<br><br>Mi niña, eres la prota' de mis canciones tristes<br>No puedo cerrar los ojos, mientras te me desvistes<br>Tú dile a las demás que no me quedan más chicles<br>Solo te doy a ti, el amor es así de simple<br><br>Uoh, oh-oh, oh-oh-oh-oh<br>Se me congela el mundo siempre que nos vemos<br>Discutir contigo es como un tiroteo<br>Y pienso en morirme el primero, uoh-uoh-oh-oh-ah<br><br>Siempre te vas de mí (siempre te vas de mí)<br>Siempre te vas de mí (siempre te vas de mí)<br>Siempre te vas de mí (de mí, de mí)<br>De mí, oh-oh-oh-oh<br><br>This is the remix<br>Rauw Alejandro<br>Marc Seguí<br>Pol Granch<br>(Oh, yeah-yeah)"},
  { title: "Contando Lunares", artist: "Don Patricio", cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777748473/contando_lunares_bjxcmo.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748328/DON_PATRICIO_CRUZ_CAFUN%C3%89_-_CONTANDO_LUNARES_tsyd6p.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Buongiorno, buonasera a los signori e la principessa<br>Non capito l'italiani, ma italiani de la zona<br>Il bambino Don Patricio e Cruzzi Cafunotti<br>De la piazza de la Caleta para el mundo entero<br>Pizza prosciutto, pizza tropicale, pan con ajo<br>Dos cincuenta, Coca-Cola grande<br>Espero que disfruten del disco de Patri<br><br>Vente, vacila un poquito<br>Que aunque yo me haga el loquito<br>Me encanta y lo sabe<br>Y si está loca, loquita mía<br>Yo sé quién eres realmente<br>Y no lo que ellos saben<br><br>Esa mami me tiene loco<br>Ya casi no cojo playa, contando lunares<br>Ahora vente donde tú ya sabe<br>La verdad que conocerte no entraba en mis planes<br><br>Mira, aquel día se armó un fuerte pitote<br>Todos en la caleta, ¿Botaos', no? Suponte<br>Todos resacosos, que esa noche fue de lote<br>Y pa' recuperar pa'l' charco con el Sol en el cogote<br>Estábamos con Kuko y con el Viti, tranquilotes<br>Y de pronto de la nada aparece un fuerte perote<br>Que entra por ahí tirándonos beso<br>Me giro pa'l nota y digo: ¿Patri, y eso?!<br>Te lo juro, no sé cómo explicarlo<br>Era de fuera, de La Restinga o algo<br>Era preciosa y quedona, vio que la mirábamos<br>Que se tiró de piloto adrede pa' salpicarnos<br>Y cuando salió del agua (ay papá)<br>Todos super cantosos en plan (ay papá)<br>Nos acercamos a hablar en plan a ver que surge<br>Y nos suelta: Sobran, si yo vine con Uge<br><br>Vente, vacila un poquito<br>Que aunque yo me haga el loquito<br>Me encanta y lo sabe<br>Y si está loca, loquita mía<br>Yo sé quién eres realmente<br>Y no lo que ellos saben<br><br>Don Patricio mami, báilame el venao'<br>Juega con los tazos y el bollicao'<br>Yo la pienso mucho, ella me tiene loquito<br>Pero dile a esa jevita que no estoy casao'<br>Tu ropa en mi cuarto desordenao'<br>Deja ya a ese guacho guatón culieao'<br>Hace ya un verano que no te damos verano<br>Pero el día del concierto está sold out<br>Papas arrugadas, mojito, pescao'<br>Hazte una fontana, chiquito tumbao'<br>Yo vine a buscarte pero mami, ¿Qué tienes?<br><br>Si te lo pongo dedicao'<br>Pura crema, arroz con habichuela<br>Déjate de especias, mami vamo al grano<br>Y dile que bailando te conocí<br>Y que nos lo gozamos<br>Pa' dentro carajo<br>Tengo buena espina<br>Comiéndome un gajo<br>Pura vitamina<br>No encuentro trabajo<br>No quiero otra vida<br>Poquito pa' abajo<br>Poquito pa' arriba<br>Pa' dentro carajo<br>Tengo buena espina<br>Comiéndome un gajo<br>Pura vitamina<br>No encuentro trabajo<br>No quiero otra vida<br>Poquito pa' abajo<br>Poquito pa' arriba<br><br>Vente, vacila un poquito<br>Que aunque yo me haga el loquito<br>Me encanta y lo sabe<br>Y si está loca, loquita mía<br>Yo sé quien eres realmente<br>Y no lo que ellos saben<br><br>Esa mami me tiene loco<br>Ya casi no cojo playa, contando lunares<br>Ahora vente donde tú ya sabe<br>La verdad que conocerte no entraba en mis planes"},
  { title: "Rara Vez", artist: "Milo J, Taiu", cover: "https://m.media-amazon.com/images/I/51O0iMUUz7L._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748873/Taiu_Milo_j_-_Rara_Vez_bwkba4.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Nena, rara vez te vi bien estando con aquel<br>No lo sé, no me voy a a meter, pero te noté algo mentirosa<br>Cuando te besé sentí que vos sentiste cosa'<br>Entonces supe que<br><br>Sos lo que me da paz, lo que andaba buscando<br>Y esa felicidad que hace que ande sonriendo<br>Quiero verte feli' (feliz), mejor si es al la'o de mí (si es al la'o de mí)<br>Love incondicional (love), como perro a su amo, te sigo amando (te sigo amando)<br>Sos lo que me da paz, lo que andaba buscando<br>Y esa felicidad que hace que ande sonriendo<br>Quiero verte feli' (feliz), mejor si es al la'o de mí (si es al la'o de mí)<br>Love incondicional (love), como perro a su amo, te sigo amando (te sigo amando)<br><br>Dama con fama de cama alta gama y corazón partido<br>Fono lleno de fane' que llaman y solo atiende el mío<br>Vamo' a verno' con frío o calor, picnic, Netflix, voy en tren<br>En ten o fifteen estoy, y siendo honesto<br><br>Negra, rara ve' te vi bien estando con aquel<br>No lo sé, no me voy a a meter, pero te noté algo mentirosa<br>Cuando te besé sentí que vos sentiste cosa'<br>Entonces supe que<br><br>Sos lo que me da paz, lo que andaba buscando<br>Y esa felicidad que hace que ande sonriendo<br>Quiero verte feli' (feliz), mejor si es al la'o de mí (si es al la'o de mí)<br>Love incondicional (love), como perro a su amo, te sigo amando (te sigo amando)<br>Sos lo que me da paz, lo que andaba buscando<br>Y esa felicidad que hace que ande sonriendo<br>Quiero verte feli' (feliz), mejor si es al la'o de mí (si es al la'o de mí)<br>Love incondicional (love), como perro a su amo, te sigo amando (te sigo amando)"},
  { title: "Si Estoy a Tu Lado", artist: "Rabelay", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-ywl-ZgPTD9d7uezXWmcCixIhCxdKb0cmRA&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748874/Rabelay_-_Si_Estoy_a_Tu_Lado_Oficial_nvbx34.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Ey, yaoh<br>Ya sé que no quieren que me entere<br>Ya sé que no quieren que me esmere<br>Ya sé que no quieren que me altere<br>(Sé que no quieren que me libere)<br><br>Ya sé que no quieren que lidere<br>Que se mueren porque quieren convencerme de que todos son igual<br><br>Ya sé que no quieren que lidere<br>Que se mueren porque temen que ahora este men vaya a romper su lugar<br><br>Sé que no quieren que me libere<br>No conviene que acelere<br>Ya sé que no lo digieren<br>Que le duele, que le puede, que me entere<br><br>Todo lo que se puede<br>Considere que mi level crece con cada compás<br><br>Mira compa, buscando la paz<br>Dime qué buscas, yo no quiero na' que no de a ganar<br>Todo viene y va, aprende a valorar<br>No quiero ser la carga de nadie jamás<br><br>Y dime qué te pasó, jugo del fracaso<br>Yo no quiero un vaso, de eso más<br><br>Vas, vas, vas, ya deja de pensar, ya deja de soñar<br>Yo voy a ejecutarlo, puede que tú puedas evitarlo<br>Como quiera puedes intentarlo<br>Hazlo, yo no soy nadie para culparlos<br>Siempre veré como superarlos, ey<br><br>Nadie quiere ver lo que hay que perder, se aferran a ser lo que otros quieren<br>Yo lo intentaré, veremos qué hacer, pero no seré el mismo de siempre<br><br>Escribo con la calma de la brisa en el viento<br>Escribo con el alma pa' aliviar el momento<br>Todo lo que es bueno siempre lleva su tiempo<br>Rapero desde chico hasta que falte el aliento<br><br>Y aunque me cansa el<br>Peso en la espalda, el camino termina en la parte más alta<br>Saca la casta, no busco falda, tengo una lista de lo que me falta<br><br>Me perdí en tus caderas, pero más en tu mirada<br>Cómo cuando me desvele escribiendo to' esta mamada, pero nada camarada<br>Me dijeron que lo terco ayudará a subir de grada, me degradan para nada<br><br>Cómo quieran mi manada, hará que fijen la mirada<br>Aunque algunos no quieran ver, Ey<br>Tenemos los ojos hacia el fren-te<br>Vamos que la sangre está calien-te<br>Sabe que este estilo es diferente, vente<br>Esto no se vende, diga lo que quiera, estoy consiente<br>Saben que me hago mucho más fuerte<br>Para el que lo quiera, el que no quiera como quiera lo comprende, entiende<br><br>Cómo se enciende, como se prende<br>Yo no sé, como se queman al verme<br>Le cocino lenta pero level, please rotisimo en breve, Ey, Uah<br><br>(Lo llevo en la sangre este flow animal)<br>(Todo tiene secuencia elemental)<br>(Vamos forjando letras de metal)<br>(Para que al que se ponga irracional)<br><br>Ya sé que no quieren que me entere<br>Ya sé que no quieren que me esmere<br>Ya sé que no quieren que me altere<br>Sé que no quieren que me libere<br><br>(Ya sé que no quieren que lidere)<br>(Que se mueren porque quieren convencerme de que todos son igual)<br><br>(Ya sé que no quieren que lidere)<br>(Que se mueren porque temen que ahora este men vaya a romper su lugar)<br><br>(Sé que no quieren que me libere)<br>(No conviene que acelere, ya sé que no lo digieren)<br>(Que le duele, que le puede, que me entere)<br><br>(Todo lo que se puede, considere que me eleve casi con cada compás, uah)"},
  { title: "Pareja del Año", artist: "Sebastián Yatra, Myke Towers", cover: "https://i.scdn.co/image/ab67616d0000b273311aebbc00f1cd4cd16bacbc", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Sebasti%C3%A1n_Yatra_-_Tacones_Rojos_Official_Video_o09dxd.m4a", moods: ['romanticas'] ,
    lyrics: "Uoh-oh (yeah)<br>Uoh-oh (Myke Towers)<br>Mmm-mmm (Yatra, Yatra)<br><br>Qué tan loco sería si yo fuera<br>El dueño de tu corazón por solo un día<br>Si nos gana la alegría, yo por fin te besaría<br>¿Qué pasaría?<br>Podrías ver entre él y yo, ¿quién ganaría?<br><br>Mi condición<br>Enamorado locamente de una chica que hoy extraño<br>Y el no tenerte me hace daño<br>Seríamos la pareja del año, cuánto te extraño<br><br>Sin condición<br>Me enamoré precisamente de una chica que no es mía<br>Y mis amigos lo sabían<br>Y a mí todo el mundo me decía que pasaría, me dejarías<br><br>Si me dieran solo veinticuatro horas, yo las aprovecho<br>Juro que yo voy a hacerte cosas que nunca te han hecho<br>Ya yo me cansé de ser amigos con derecho'<br>Yo tal vez no te merezco<br><br>Pero no hay ni que decirlo<br>Si nos juntamos, seríamos la pareja del siglo<br>Ponme yo acapella, me da con introducirlo<br>Navaja doble filo<br>Cortamos y los videos me dio con reproducirlo'<br><br>Me lo decían, yo los ignoraba<br>Simplemente todo, ahora quedó en la nada<br>Se lo hacía allá, los ojos la miraba'<br>Yo nunca creía que el amor cegaba<br><br>Mi condición<br>Enamorado locamente de una chica que hoy extraño<br>Y no tenerte me hace daño<br>Seríamos la pareja del año, cuánto te extraño<br><br>Sin condición<br>Me enamoré precisamente de una chica que no es mía<br>Y mis amigos lo sabían<br>Y a mí todo el mundo me decía que pasaría, me dejarías<br><br>Es a mí, mi depresión<br>De ver una foto tuya y verte en la televisión<br>Puede ser que me destruya la mente<br>Detente, como dice la canción<br>Que no meten preso a nadie por robarse un corazón<br><br>Sufriendo y llorando de pena<br>Que no, ya mi llanto no vale la pena<br>Yo no tengo alas, pero tú sí vuelas<br>Te vuelves la mala de nuestra novela<br><br>Me tienes sufriendo, llorando de pena<br>Que no, ya mi llanto no vale la pena<br>Yo no tengo alas, pero tú sí vuelas<br>Me quitas la pista y me quedo acapella<br><br>Mi condición<br>Enamorado locamente de una chica que hoy extraño<br>Y el no tenerte me hace daño<br>Seríamos la pareja del año, cuánto te extraño<br><br>Sin condición<br>Me enamoré precisamente de una chica que no es mía<br>Y mis amigos lo sabían<br>Y a mí todo el mundo me decía que pasaría, me dejarías<br><br>Yo tenía otra melodía<br>De lo que resultaría<br>Maldita monotonía<br>¿Fue culpa tuya o fue culpa mía?<br><br>Yo aprendí a vivir con celos<br>Tú aprendiste a no ser mía<br>Solo queda ser sincero<br>Yo te quiero todavía"},
  { title: "COSAS QUE NO TE DIJE", artist: "Saiko", cover: "https://images.genius.com/acb90eccfc4f36d9675d8d2f58c86670.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Saiko_-_COSAS_QUE_NO_TE_DIJE_Official_Video_dbpazx.m4a", moods: ['romanticas'] ,
    lyrics: "Ya no importa donde estés, con quién estés<br>Si en mi cama puedo ser los dos también<br>Te elevarás con la imagen que ves<br>Y gozarás con amor que no es<br><br>Quisiera volver a decir esta vez<br>Que dejé fingir lo que quieres de mi<br>Quisiera creer que hay un tiempo real<br>En que hombre y mujer<br>Pueden volverse a encontrar<br><br>El amor ya no espera ser amor<br>Junto a ti derrumbé toda ilusión<br>Te elevarás con la imagen que ves<br>Y gozarás con amor que no es<br><br>Quisiera volver a decir esta vez<br>Que dejé fingir lo que quieres de mi<br>Quisiera creer que hay un tiempo real<br>En que hombre y mujer<br>Pueden volverse a encontrar<br><br>Amados y amantes<br>Que se olvidan del amor<br>Amados y amantes<br>Que se olvidan del amor"},
  { title: "Quiero Decirte", artist: "Abraham Mateo, Ana Mena", cover: "https://images.genius.com/7e834ed5f2fd7a331d2e8d4f948cda4b.1000x1000x1.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748876/Abraham_Mateo_Ana_Mena_-_Quiero_Decirte_myiibs.m4a", moods: ['romanticas'] ,
    lyrics: "(Oh-oh-oh)<br>(No-oh-oh, no)<br>Ey-yeah (oh)<br><br>Simplemente otro día más planeando recuperarte<br>La casa es como un infierno<br>Queman los recuerdos<br>Y yo, en plan masoquista, dejé todo tal cual<br><br>Pero ahora que no estás aquí<br>Que me di cuenta de lo que perdí<br>Puede que no sea tan tarde pa' verte y decirte<br>Que sigo toda loca por tu amor<br><br>Quiero decirte que lo siento, que te echo de menos<br>Que de to' lo que ha pasa'o, nena, yo me arrepiento<br>Te quiero todavía<br>No pienses que ya te di por perdí'a<br><br>Quiero decirte que lo siento, que te echo de menos<br>Que de to' lo que ha pasa'o, nene, yo me arrepiento<br>Te quiero todavía<br>No pienses que ya te di por perdí'o (perdí'a)<br><br>O-o-ojalá poder resetear mi mente y que no le dé por ti<br>Pero ¿qué quieres que le haga, baby? No te voy a mentir<br>Es que me inundo cada segundo<br>Y llego a tal punto de no poder respirar<br>Cuando empiezo a recordar<br><br>Aquel instante de humedá-á-á'<br>Na' como lo que tú me da-a-a'<br>Pa' delante no puedo tira-a-a'<br>Venga, porfa, dame otra oportunida'<br><br>Quiero decirte que lo siento, que te echo de menos<br>Que de to' lo que ha pasa'o, nena, yo me arrepiento<br>Te quiero todavía<br>No pienses que ya te di por perdí'a<br><br>Quiero decirte que lo siento, que te echo de menos<br>Que de to' lo que ha pasa'o, nene, yo me arrepiento<br>Te quiero todavía<br>No pienses que ya te di por perdí'o (perdí'a)<br><br>Aquel instante de humedá-á-á'<br>Na' como lo que tú me da-a-a'<br>Pa' delante no puedo tira-a-a'<br>(Sé que lo hice mal, no te valoré)<br><br>Pero ahora que no estás aquí<br>Que me di cuenta de lo que perdí<br>Puede que no sea tan tarde pa' verte y decirte<br>Que aún sigo todo loco por tu amor<br><br>Quiero decirte que lo siento, que te echo de menos<br>Que de to' lo que ha pasa'o, nene, yo me arrepiento<br>Te quiero todavía<br>No pienses que ya te di por perdí'o (perdí'a)<br><br>Quiero decirte que lo siento, que te echo de menos<br>Que de to' lo que ha pasa'o, nena, yo me arrepiento<br>Te quiero todavía<br>No pienses que ya te di por perdí'a"},
  { title: "Just the Way You Are", artist: "Bruno Mars", cover: "https://cdn-images.dzcdn.net/images/cover/5b59dc18e109515420f8237719bd2186/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748879/Bruno_Mars_-_Just_The_Way_You_Are_i8mkhd.m4a", experience: 'justthewayyouare', moods: ['romanticas'] ,
    lyrics: "First rule, never let them change you<br>Rule two, do you to the fullest and never be ashamed to<br>You're just good at what they can't do<br>And they hate that, they wanna paint you<br>If they color, put you on another<br>But what they don't accept, and what they don't see<br>The best thing is what you already be<br><br>Oh, her eyes, her eyes make the stars look like they’re not shining<br>Her hair, her hair, falls perfectly with-out her trying<br>She’s so beautiful, and I tell her everyday<br>Yeah, I know, I know, when I compliment her she won’t believe me<br>And it’s so, it’s so sad to think that she don’t see what I see<br>But every time she asks me: Do I look okay?<br><br>I say: When I see your face, there is not a thing that I would change<br>Cause you’re amazing, just the way you are<br>And when you smile, the whole world stops and stares for awhile<br>Cause, girl you’re amazing, just the way you are<br>Hey!<br><br>Her lips, her lips I could kiss them all day if she’d let me<br>Her laugh, her laugh she hates but I think it’s so sexy<br>She’s so beautiful, and I tell her everyday<br>Oh, you know, you know, you know I’d never ask you to change<br>If perfects what you’re searching for then just stay the same<br>So don’t even bother asking if you look okay, you know I’ll say<br><br>When I see your face, there is not a thing that I would change<br>Cause you’re amazing, just the way you are<br>And when you smile, the whole world stops and stares for awhile<br>Cause girl you’re amazing, just the way you are<br><br>Uh yeah, the definition of real is if you don't feel then you don't you feel it<br>Don't conceal it, don't be afraid<br>You look great only silicon will bill it<br>A botox to kill it, you just killin off spirit<br>And you the one that you gotta live with<br>So don't get caught up in appearance<br>And see the inner beauty when you look off in the mirrors<br><br>The way you are, the way you are<br>Girl you’re amazing, just the way you are<br>When I see your face there’s not a thing I would change<br>Cause youre amazing just the way you are<br>And when you smile, the whole world stops and stares for awhile<br>Cause girl you’re amazing, just the way you are, yea"},
  { title: "Ven a la Carrera", artist: "Pocoyó", cover: "https://i.scdn.co/image/ab67616d0000b2730952f5f2ec131e56b3ba7b27", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748881/%EF%B8%8FPOCOY%C3%93_-_Ven_a_la_Carrera_ysppwm.m4a", moods: ['animadas'] ,
    lyrics: "Corre Pocoyó<br>Es una carrera<br>Corre por que Elly quiere<br>Llegar la primera<br><br>Corre Pocoyó<br>Pero con cuidado<br>No rompas el coche<br>Y te quedes rezagado<br><br>Con su Pato-móvil<br>Pato casi vuela<br>Y Loula corriendo<br>Le persigue muy de cerca<br><br>Ha empezado tarde<br>Por que se ha dormido<br>Pero Pajaroto<br>Nunca se da por vencido<br><br>Ven ven ven, ven a la carrera<br>Ven ven ven, corre acelera<br>Ven ven ven, ven a la carrera<br>1, 2, 3, ¡YA!<br><br>Con su coche rojo<br>Pocoyó acelera<br>Quiere ser primero<br>Y ganar la gran carrera<br><br>Juegan todos juntos<br>Y es muy divertido<br>No importa quién gane<br>Solo importa ser amigos<br><br>Ven ven ven, ven a la carrera<br>Ven ven ven, corre acelera<br>Ven ven ven, ven a la carrera<br>1, 2, 3, ¡YA!<br><br>Corre Pocoyó<br>Es una carrera<br>Corre por que Elly quiere<br>Llegar la primera<br><br>Corre Pocoyó<br>Pero con cuidado<br>No rompas el coche<br>Y te quedes rezagado<br><br>Ven ven ven, ven a la carrera<br>Ven ven ven, corre acelera<br>Ven ven ven, ven a la carrera<br>1, 2, 3, ¡YA!<br><br>Ven ven ven, ven a la carrera<br>Ven ven ven, corre acelera<br>Ven ven ven, ven a la carrera<br>1, 2, 3, ¡YA!"},
  { title: "Besos en Guerra", artist: "Morat, Juanes", cover: "https://i.scdn.co/image/ab67616d0000b2738fa1c3557fd95f9dd67ec235", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748882/Morat_Juanes_-_Besos_en_Guerra_Letra._vnnvdn.m4a", moods: ['romanticas'] ,
    lyrics: "Quién te dijo esa mentira<br>Que eras fácil de olvidar<br>No hagas caso a tus amigos<br>Solo son testigos de la otra mitad<br><br>Dos besos son demasiado<br>Y un beso no bastará<br>Y aunque adviertan al soldado<br>Si está enamorado, en guerra morirá<br><br>Ya no tienes que cuidarme<br>Porque yo<br>Siempre he sabido que tus besos matan<br>Que tus promesas riman con dolor<br>Que eres experta en robarle latidos a mi corazón<br><br>Y tú<br>Nunca juraste que saldría ileso<br>Ya no te atrevas a pedir perdón<br>Yo te confieso que no me arrepiento<br>Y aunque estoy sufriendo, podría estar peor<br><br>Oh-oh-oh<br>Sabiendo que tus besos matan, moriré de amor<br>Oh-oh-oh<br>Sabiendo que tus besos matan, moriré de amor<br>Oh-oh-oh<br>Sabiendo que tus besos matan<br><br>Para mí nunca fue un juego<br>Para ti fue un beso más<br>Y si hoy vuelves a mi vida<br>No es que estés perdida<br>No es casualidad<br><br>Ya no tienes que cuidarme<br>Porque yo<br>Siempre he sabido que tus besos matan<br>Que tus promesas riman con dolor<br>Que eres experta en robarle latidos a mi corazón<br><br>Y tú<br>Nunca juraste que saldría ileso<br>Ya no te atrevas a pedir perdón<br>Yo te confieso que no me arrepiento<br>Y aunque estoy sufriendo, podría estar peor<br><br>Oh-oh-oh<br>Sabiendo que tus besos matan, moriré de amor<br>Oh-oh-oh<br>Sabiendo que tus besos matan, moriré de amor<br>Oh-oh-oh<br>Sabiendo que tus besos matan<br><br>Ganaré la guerra para conquistarte<br>No quiero admitir que te vas, que te vas<br>Ganaré la guerra para conquistarte<br>No quiero admitir que te vas, que te vas<br>Yo perdí batallas por nunca aceptar que<br>No eras fácil de olvidar<br><br>Porque yo<br>Siempre he sabido que tus besos matan (oh)<br>Que tus promesas riman con dolor (wo-ho)<br>Que eres experta en robarle latidos a mi corazón<br><br>Y tú<br>Nunca juraste que saldría ileso (ho)<br>Ya no te atrevas a pedir perdón (wo-oh)<br>Yo te confieso que no me arrepiento<br>Y aunque estoy sufriendo, podría estar peor<br><br>Oh-oh-oh<br>Sabiendo que tus besos matan, moriré de amor<br>Oh-oh-oh (uoh-ooh)<br>Sabiendo que tus besos matan, moriré de amor<br>Oh-oh-oh (ooh)<br>Sabiendo que tus besos matan"},
  { title: "Carita de Buena", artist: "Efecto Pasillo", cover: "https://m.media-amazon.com/images/I/61F144gibPL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748883/Efecto_Pasillo_-_Carita_de_Buena_Letra_ja14lf.m4a", moods: ['animadas'] ,
    lyrics: "Niña, tú sabes que me estoy enamorando<br>Quererte me esta matando<br>Liberarme del embrujo de tus encantos<br><br>Vale, tú sabes que me estas enloqueciendo<br><br>Por gusto vivo sufriendo<br>Te pienso cada segundo de cuando en cuando<br><br>Mira no me vas a impresionar<br>Con esa carita de buena<br>Sabes que te quiero de verdad<br>Déjate de lista de espera<br>Tic tac el pasado el vació<br>Este corazón mío te espera en la nevera<br>Tic tac me quito este frió<br>Si tu me condenas, merece la pena<br><br>Niña, tú sabes que me estoy enamorando<br>Quererte me esta matando<br>Liberarme del embrujo de tus encantos<br>Vale, tú sabes que me estas enloqueciendo<br>Por gusto vivo sufriendo<br>Te pienso cada segundo de cuando en cuando<br><br>Mira no me vas a impresionar<br>Con esa carita de buena<br>Veo que me quieres enredar (acción)<br>Vaya telenovela<br>Pim pam golpea la primera<br>No me seas traicionera, no deseo pelear<br>Tic tac el que espera desespera<br>Algo pasa en tus caderas<br>Y aquí no me mueven ya<br><br>Niña, tú sabes que me estoy enamorando<br>Quererte me esta matando<br>Liberarme del embrujo de tus encantos<br>Vale, tú sabes que me estas enloqueciendo<br>Por gusto vivo sufriendo<br>Te pienso cada segundo de cuando en cuando<br><br>Para ti todo es un juego<br>Te quiero y te detesto<br>Alguien sabe lo que pasa<br>Yo no entiendo nada de esto<br>Del amor cuando no, ahora sé ahora no<br>Yo que he intentado ser de todos para ti el mejor<br>Y me pagas el momento dejándome ¡wtf!<br><br>Niña, tú sabes que me estoy enamorando<br>Quererte me esta matando<br>Liberarme del embrujo de tus encantos<br>Vale, tú sabes que me estas enloqueciendo<br>Por gusto vivo sufriendo<br>Te pienso cada segundo de cuando en cuando<br><br>Niña, tú sabes que me estoy enamorando<br>Quererte me esta matando<br>Liberarme del embrujo de tus encantos<br>Vale, tú sabes que me estas enloqueciendo<br>Por gusto vivo sufriendo<br>Te pienso cada segundo de cuando en cuando"},
  { title: "Cupid twin version", artist: "FIFTY FIFTY", cover: "https://i.scdn.co/image/ab67616d0000b27337c0b3670236c067c8e8bbcb", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748884/FIFTY_FIFTY_-_Cupid_Twin_Version_Lyrics_hfw31y.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "A hopeless romantic all my life<br>Surrounded by couples all the time<br>I guess I should take it as a sign<br>(Ah, why? Ah, why? Ah, why? Ah, why?)<br><br>I'm feeling lonely (lonely)<br>Oh, I wish I'd find a lover that could hold me (hold me)<br>Now I'm crying in my room<br>So skeptical of love (say what you say, but I want it more)<br>But still I want it more, more, more<br><br>I gave a second chance to cupid<br>But now I'm left here feeling stupid<br>Oh, the way he makes me feel that love isn't real<br>Cupid is so dumb<br><br>I look for his arrows everyday<br>I guess he got lost or flew away<br>Waiting around is a waste (waste)<br>Been counting the days since November<br>Is loving as good as they say?<br><br>Now I'm so lonely (lonely)<br>Oh, I wish I'd find a lover that could hold me (hold me)<br>Now I'm crying in my room<br>So skeptical of love (say what you say, but I want it more)<br>But still I want it more, more, more<br><br>I gave a second chance to cupid<br>But now I'm left here feeling stupid<br>Oh, the way he makes me feel that love isn't real<br>Cupid is so dumb<br><br>(Cupid is so dumb)<br><br>Hopeless girl is seeking someone who will share this feeling<br>I'm a fool, a fool for love, a fool for love<br><br>I gave a second chance to cupid<br>But now I'm left here feeling stupid<br>Oh, the way he makes me feel that love isn't real<br>Cupid is so dumb<br><br>I gave a second chance to cupid<br>But now I'm left here feeling stupid<br>Oh, the way he makes me feel that love isn't real<br>Cupid is so dumb"},
  { title: "Pan y Mantequilla", artist: "Efecto Pasillo", cover: "https://i.scdn.co/image/ab67616d0000b2735953c71f6d0e995f71f63ae4", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748885/Pan_y_Mantequilla_ejmvcl.m4a", moods: ['animadas'] ,
    lyrics: "(Oh, yeah)<br>(Mmh, mmh)<br>(Dime pa, pa, pa, pa, baby)<br><br>Mira niña como te lo digo<br>Camina, cada paso tuyo a mí me contamina<br>Mueve las caderas como gelatina<br>Lindura divina, te comería con pan y mantequilla<br>Candela, un par de chupitos de ron, miel y velas<br>Una caja llena con mil primaveras<br>Que vienen, que vuelan<br>Solo quiero un poquito de tu vida entera<br>De tu vida entera<br><br>Y yo, subo escalón a escalón<br>Quiero tocar el cielo azul, el cielo azul<br>Y tú, buscas tras cada canción<br>La sensación que te haga sentir, que te haga vivir<br><br>Contempla, girasoles, margaritas y azucenas<br>Quieren parecerse a ti un poquito apenas, que más quisieran<br>Tan solo a ti te riego yo, mi sirena<br>Eres aire fresco que vuela la cometa<br>Una bala sorpresa sin Rusia ni ruleta<br>Una carpeta con letras de poetas<br>Entre verso y verso, pétalos de rosas secas<br><br>(Oh)<br>Y yo, subo escalón a escalón<br>Quiero tocar el cielo azul, el cielo azul<br>Y tú, buscas tras cada canción<br>La sensación que te haga sentir, que te haga vivir<br>(Tiruriruriru taratete)<br>(Tiruriruriru taratete)<br>(Tiruriruriru taratete, teterete)<br><br>(Tiruriruriru taratete)<br>(Tiruriruriru taratete)<br>(Tiruriruriru taratete, teterete)<br><br>Cuatro esquinitas tiene mi cama<br>Cuatro angelitos que me acompañan<br>Cuatro secretos, miles de historias<br>Sueños que giran en una noria<br>De norte a sur y de este a oeste<br>Que de media vuelta quien le moleste<br>Y les deseo mucha suerte<br>Están muy locos, puede ser mi muerte (eh, eh)<br><br>Camina, cada paso tuyo a mí me contamina<br>Mueve las caderas como gelatina<br>Lindura divina, te comería con pan y mantequilla<br><br>Y yo, subo escalón a escalón<br>Quiero tocar el cielo azul, el cielo azul<br>Y tú, buscas tras cada canción<br>La sensación que te haga sentir, que te haga vivir<br>Y yo, subo escalón a escalón<br>Quiero tocar el cielo azul, el cielo azul<br>Y tú, buscas tras cada canción<br>La sensación que te haga sentir que estoy junto a ti<br>(Tiruriruriru daratete)<br>(Tiruriruriru daratete)<br>(Tiruriruriru daratete, yeah, yeah, yeah)"},
  { title: "La Plena", artist: "Beéle Westcol, Ovy On The Drums", cover: "https://i.scdn.co/image/ab67616d0000b273c0353d023daf5ebda0eb003b", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748886/Be%C3%A9le_Westcol_Ovy_On_The_Drums_-_LA_PLENA_W_Sound_05_jz2fsz.m4a", moods: ['animadas'] ,
    lyrics: "(O-O-Ovy On The Drums)<br><br>Eres la niña de mis ojo', tú<br>Eres todo lo que quiero yo<br>Una cerveza pa' calmar la sed<br>No, mejor ser besado por su boquita, amor<br><br>Las tentacione' así como tú<br>Merecen pecado' como yo<br>Ay, si tú quieres, solo da la lu' (¡aye!)<br>Tú sabes que no voy a decir que no<br><br>Ay, tienes la magia<br>Tú, sí, tienes una vainita que a mí me encanta, me enloquece (alright)<br>Dormir contigo fue amor a primera vista, cuando bailabas así<br>Por el cuellito, besito y lengüita<br>Sé que te encanta, te enloquece<br>Sé que te encanta, te enloquece<br>Y, a vece'<br><br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>Sé que te encanta, te enloquece<br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>La plena<br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>Óyelo, uh-uh<br><br>Oye, lo que pasa es que desde que vi tu cara<br>Me enamoró de ti toda, es que tú tiene' un no sé qué<br>Siento que te pasa lo mismo cuando te miro<br>¿Qué dice' si nos parchamo' a ver el amanecer? (¡Prra!)<br><br>Quiero hacer de todo, quiero que tú sea' mi to'a<br>Te digo: Sóbelo, ve, y luego viene y me lo soba (uah)<br>Vamos a vernos luego<br>Si no te gusta el infierno, ¿pa' qué viene' al diablo y lo emboba'?<br><br>Y ella, parcerita, paisa<br>Y yo costeño, coleto<br>En una baldosa, la aprieto<br>Pa' hablarte claro, cero visaje<br>Se sabe que tú eres puro veneno<br><br>Ay, tienes la magia<br>Tú, sí, tienes una vainita que a mí me encanta, me enloquece (uh)<br>Dormir contigo fue amor a primera vista, cuando bailabas así<br>Por el cuellito, besito y lengüita<br>Sé que te encanta, te enloquece (uh-uh)<br>Sé que te encanta, te enloquece<br>Y, a vece'<br><br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>Sé que te encanta, te enloquece<br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>Óyelo, la plena<br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br>Sé que te encanta, te enloquece<br>Uh-uh-uh-uh-uh, uh-uh, uh-uh<br><br>Beéle<br>Ovy On The Rasta Drums<br>W Sound<br>Aye<br>Alright"},
  { title: "Snowman", artist: "Sia", cover: "https://i.scdn.co/image/ab67616d0000b273a75e532b61dac3ddafd022ef", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748887/Sia_-_Snowman_Lyrics_ym54x5.m4a", moods: ['relajantes'] ,
    lyrics: "Don't cry, snowman, not in front of me<br>Who will catch your tears if you can't catch me, darling?<br>If you can't catch me, darling<br>Don't cry, snowman, don't leave me this way<br>A puddle of water can't hold me close, baby<br>Can't hold me close, baby<br><br>I want you to know that I'm never leaving<br>'Cause I'm Mrs. Snow till death we'll be freezing<br>Yeah, you are my home, my home for all seasons<br>So come on, let's go<br><br>Let's go below zero and hide from the Sun<br>I love you forever where we'll have some fun<br>Yes, let's hit the North Pole and live happily<br>Please, don't cry, no tears now<br>It's Christmas, baby<br><br>My snowman and me<br>My snowman and me<br>Baby<br><br>Don't cry, snowman, don't you fear the Sun<br>Who'll carry me without legs to run, honey?<br>Without legs to run, honey<br>Don't cry, snowman, don't you shed a tear<br>Who'll hear my secrets if you don't have ears, baby<br>If you don't have ears, baby<br><br>I want you to know that I'm never leaving<br>'Cause I'm Mrs. Snow till death will be freezing<br>You are my home, my home for all seasons<br>So come on, let's go<br><br>Let's go below zero and hide from the Sun<br>I love you forever where we'll have some fun<br>Yes, let's hit the North Pole and live happily<br>Please, don't cry, no tears now<br>It's Christmas, baby<br><br>My snowman and me<br>My snowman and me<br>Baby"},
  { title: "miau", artist: "Young Cister", cover: "https://images.genius.com/aa41a24ecbac2a1324c4cb84cc158f76.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748889/Young_Cister_-_miau_Video_Oficial_2_rr561t.m4a", moods: ['animadas'] ,
    lyrics: "Be-bellaqueo, be-bellaqueo, be-be-bellaqueo<br>Be-bellaqueo, be-be-bellaqueo<br>Be-bellaqueo, be-bellaqueo, be-be-bellaqueo<br>Be-bellaqueo, be-be-bellaqueo<br><br>Tú ere' una de esas gata' que se cuida sola<br>Con esa mirá' que mata como pistola<br>Si un huеón le grita, ella se pica a chora<br>Siguе siendo fina, maquillaje sephora<br>A veces fría como un freezer<br>Y cuando está caliente, por mensaje' me lo dice<br>Que le caiga a su depa por la noche<br>Que quiere sentirme cerquita de su broche<br><br>Qué bien te ve' bajo la Luna iluminando el cuarto<br>Bebé, deja poner la playlist y luego te parto<br>Me estás pidiendo, mami, que te dé en cuatro<br>Chica, tú quiere' provocarme un infarto<br>Qué bien te ve' bajo la Luna iluminando el cuarto<br>Bebé, deja poner la playlist y luego te parto<br>Me estás pidiendo, mami, que te dé en cuatro<br>Chica, tú quiere' provocarme un infarto<br><br>Tú ere' una de esa' gata' que se cuida sola (be-bellaqueo, be-bellaqueo, be-be-bellaqueo)<br>Con esa mirá' que mata como pistola (be-bellaqueo, be-be-bellaqueo)<br>Tú ere' una de esa' gata' que se cuida sola (be-bellaqueo, be-bellaqueo, be-be-bellaqueo)<br>Con esa mirá' que mata como pistola (be-bellaqueo, be-be-bellaqueo)<br><br>La noche que te llevaste mi camisa de Brasil<br>Lleva' toda la magia de Ronaldo de assis<br>Recuerdo ese besito al subirte al taxi<br>Casi te digo que te amo, mami, casi (casi)<br>Pero tú no ama' tan fácil<br>No le da a cualquiera su corazón<br>El último cabrón la dejó frágil<br>Una gata como tú tiene clase<br>Hace que a otras mujere', baby, rechace<br>Ese corte que tú tiene' aparte<br>Darte quiero, bae, chingarte<br><br>Qué bien te ve' bajo la Luna iluminando el cuarto<br>Bebé, deja poner la playlist y luego te parto<br>Me estás pidiendo, mami, que te dé en cuatro<br>Chica, tú quiere' provocarme un infarto<br>Qué bien te ve' bajo la Luna iluminando el cuarto<br>Bebé, deja poner la playlist y luego te parto<br>Me estás pidiendo, mami, que te dé en cuatro<br>Chica, tú quiere' provocarme un infarto<br><br>Tú ere' una de esa' gata' que se cuida sola (be-bellaqueo, be-bellaqueo, be-be-bellaqueo)<br>Con esa mirá' que mata como pistola (be-bellaqueo, be-be-bellaqueo)<br>Tú ere' una de esa' gata' que se cuida sola (be-bellaqueo, be-bellaqueo, be-be-bellaqueo)<br>Con esa mirá' que mata como pistola (be-bellaqueo, be-be-bellaqueo)<br><br>Na-na-na-na-na<br>Na-na-na-na-na<br>Ey<br>No mames, Wey, ¿cómo que otra rola para ella, cabrón?<br>Ya"},
  { title: "I Love It", artist: "Icona Pop, Charli XCX", cover: "https://m.media-amazon.com/images/I/51e5k9eRKvL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748890/Vietsub_I_Love_It_Icona_Pop___Charli_XCX_Lyrics_Video_1_tn4f7c.m4a", moods: ['animadas'] ,
    lyrics: "I got this feeling on the summer day when you were gone<br>I crashed my car into the bridge, I watched, I let it burn<br>I threw your shit into a bag and pushed it down the stairs<br>I crashed my car into the bridge<br><br>I don't care<br>I love it<br>I don't care<br><br>I got this feeling on the summer day when you were gone<br>I crashed my car into the bridge, I watched, I let it burn<br>I threw your shit into a bag and pushed it down the stairs<br>I crashed my car into the bridge<br><br>I don't care<br>I love it<br>I don't care<br><br>You're on a different road, I'm in the Milky Way<br>You want me down on Earth, but I am up in space<br>You're so damn hard to please, we gotta kill this switch<br>You're from the 70s, but I'm a 90s bitch<br><br>I love it<br>I love it<br><br>I got this feeling on the summer day when you were gone<br>I crashed my car into the bridge, I watched, I let it burn<br>I threw your shit into a bag and pushed it down the stairs<br>I crashed my car into the bridge<br><br>I don't care<br>I love it<br>I don't care<br>I love it, I love it<br>I don't care<br>I love it<br>I don't care<br><br>You're on a different road, I'm in the Milky Way<br>You want me down on Earth, but I am up in space<br>You're so damn hard to please, we gotta kill this switch<br>You're from the 70s, but I'm a 90s bitch<br><br>I don't care<br>I love it<br>I don't care<br>I love it, I love it<br>I don't care<br>I love it<br>I don't care<br>I love it, I love it<br>I don't care<br><br>I love it"},
  { title: "Capaz", artist: "Alleh Yorghaki", cover: "https://cdn-images.dzcdn.net/images/cover/88e65c70ef15315045b6bf85d38b11f2/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748891/Alleh_Yorghaki_-__capaz__OFFICIAL_VERSION_iutvie.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Eu te entreguei o meu amor<br>Todo meu coração<br>Você não quis, me desprezou<br>Desfez da minha paixão<br><br>Eu insisti eu implorei<br>Você não me escutou<br>Eu fiz promessas<br>Até chorei, nada disso adiantou<br><br>Agora sou vagabundo<br>Canalha, ordinário dos bons<br>Safado, rei da gandaia<br>Viciado em mulher e bailão<br><br>Quando saiu da minha vida<br>Eu joguei tudo pro ar<br>Depois daquela despedida<br>Meu mundo começou mudar<br><br>Hoje eu não saio da balada<br>Parei de me comportar<br>Não me apego à namoradas<br>É uma em cada lugar<br><br>Agora sou vagabundo<br>Canalha, ordinário dos bons<br>Safado, rei da gandaia<br>Viciado em mulher e bailão"},
  { title: "Downtown", artist: "Anitta, J Balvin", cover: "https://i.scdn.co/image/ab67616d0000b2738c6b830c36c7b4ac43c3cee8", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748892/Anitta_J_Balvin_-_DOWNTOWN_Letra_vw8h3l.m4a", moods: ['animadas'] ,
    lyrics: "(A ella le gusta cuando bajo downtown, -town, -town)<br><br>En su cuerpo, puedo ver la definición<br>Se ve que lo trabaja, eres motivación<br>Le pedí que me ayude con una misión<br>Que me llene entera de satisfacción<br><br>A mí me gusta cuando baja downtown<br>Le pido que se quede ahí envicia'o<br>Me dice: Baby, sueno interesa'o<br>Si quieres, ven y quédate otro round<br><br>A ella le gusta cuando bajo downtown<br>Me pide que me quede ahí envicia'o<br>Le digo: Uh, mami, estoy interesa'o<br>Si quieres, yo me quedo pa' otro round<br><br>Que me quede otro round<br>Tanto que me ha roga'o<br>Ya lo tengo asfixia'o<br>Yo te he observa'o<br><br>No aguanta<br>Se adapta<br>Me dice<br><br>No quiero que termines (no)<br>Es un misterio, pero no de cine (no de cine)<br>En las noches, soy yo la que define<br>Todo lo que va a pasar<br>A mí no me tienes que mandar<br><br>A mí me gusta cuando baja downtown<br>Le pido que se quede ahí envicia'o<br>Me dice: Baby, sueno interesa'o<br>Si quieres, ven y quédate otro round (tú lo sabes)<br><br>A ella le gusta cuando bajo downtown<br>Me pide que me quede ahí envicia'o<br>Le digo: Uh, mami, estoy interesa'o<br>Si quieres, yo me quedo pa' otro round<br><br>Uh, sé que me quieres ver<br>Bajando por toda tu piel<br>Uh, sé que quieres que me quede<br>Enredarte en mis piernas es lo que quieres<br><br>No se vale el empate<br>Esto es hasta darle jaque mate<br>Hasta que uno de los dos se mate<br><br>Si quieres, yo bajo<br>Y, de una, me pongo pa'l trabajo<br>Suelta el estrés, baby, yo te relajo<br><br>Se pone bella, me dice que ya<br>Sigue ahí, que la tengo viendo las estrellas<br>Se me acelera, hasta abajo se va<br>Y como ella lo hace, no lo hace cualquiera<br><br>En su cuerpo, puedo ver la definición<br>Se ve que lo trabaja, eres motivación<br>Le pedí que me ayude con una misión<br>Que me llene entera de satisfacción<br><br>A mí me gusta cuando baja downtown<br>Le pido que se quede ahí envicia'o<br>Me dice: Baby, sueno interesa'o<br>Si quieres, ven y quédate otro round<br><br>A mí me gusta cuando baja downtown<br>Le pido que se quede ahí envicia'o<br>Me dice: Baby, sueno interesa'o<br>Si quieres, ven y quédate otro round<br><br>Anitta<br>J Balvin, man, J Balvin, man<br>Yeh, yeh, yeh, yeh<br>Leggo'<br>Sky Rompiendo<br>Rompiendo El Bajo<br><br>Fenomenal<br>(Hey, J Balvin, man)"},
  { title: "Porfa no te vayas", artist: "Beret, Morat", cover: "https://cdn-images.dzcdn.net/images/cover/82a6297e55cbb85c75cedbbb3a8e1443/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748898/Beret_Morat_-_Porfa_no_te_vayas_Videoclip_Oficial_1_gxrelc.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Recuerdo aquel verano que pasé contigo<br>Y cada beso que nunca pasó<br>Se viste de fantasma cuando estoy dormido<br><br>Pasamos de repente del calor al frío<br>Y tu recuerdo no se congeló<br>Hoy no puedo creer que estés al lado mío<br><br>Porque solo tú sabes<br>Que se quedaron tantos besos al aire<br>Solo tú sabes<br>No sé vivir, que yo sin ti, no soy nadie<br><br>Porfa, no te vayas cuando salga el Sol<br>Cuando algún error me haga pasar por imprudente<br>Los nervios de bailar contigo juegan conmigo<br><br>Porfa, no te vayas cuando intente hablar<br>Y al tartamudear, na-na-na-nada te cuente<br>Los nervios de bailar contigo juegan conmigo<br><br>Porfa, no te vayas<br>(Oh, oh, oh; oh, oh, oh)<br>Porfa, no te vayas<br>(Oh, oh, oh; oh, oh, oh)<br><br>Te puse mil etiquetas y tú no tienes precio<br>Te enamoré con palabras y tú, con los hechos<br>Construimos el amor empezando por el techo<br>Sabiendo que faltaban mil pilares de peso<br><br>Si dudé de ti, ya no me quedan dudas<br>Yo vengo de la Tierra y tú eres de la Luna<br>Aunque seamos dos, yo nunca olvidaré<br>Que como tú, no hay una<br><br>Porque solo tú sabes<br>Que cuando estás, es tan bonita la tarde<br>Solo tú sabes<br>No sé vivir, que yo sin ti, no soy nadie<br><br>Porfa, no te vayas cuando salga el Sol<br>Cuando algún error me haga pasar por imprudente<br>Los nervios de bailar contigo juegan conmigo<br><br>Porfa, no te vayas cuando intente hablar<br>Y al tartamudear, na-na-na-nada te cuente (no)<br>Los nervios de bailar contigo juegan conmigo<br><br>Porfa, no te vayas<br>(Oh, oh, oh; oh, oh, oh)<br>Porfa, no te vayas<br>(Oh, oh, oh; oh, oh, oh)<br><br>Porque cuando estoy contigo<br>Llega el verano y se termina el frío<br>Eres la calma en la que más confío<br>Me voy a enloquecer si no te vuelvo a ver<br><br>Porque cuando estoy contigo<br>Llega el verano y se termina el frío<br>Eres la calma en la que más confío<br>Me voy a enloquecer si no te vuelvo a ver<br><br>Porfa, no te vayas cuando salga el Sol<br>Cuando algún error me haga pasar por imprudente<br>Los nervios de bailar contigo juegan conmigo<br><br>Porfa, no te vayas cuando intente hablar<br>Y al tartamudear, na-na-na-nada te cuente (no)<br>Los nervios de bailar contigo juegan conmigo<br><br>Porfa, no te vayas<br>(Oh, oh, oh; oh, oh, oh)<br>Porfa, no te vayas<br>(Oh, oh, oh; oh, oh, oh)<br><br>¡Porfa, no te vayas!"},
  { title: "Count on Me", artist: "Bruno Mars", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSaonOWEQEDMwIQmhHmBRiWrqKgcKYWQjQTiQ&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748900/Bruno_Mars_-_Count_on_Me_Official_Lyric_Video_1_xli1q5.m4a", moods: ['animadas'] ,
    lyrics: "Oh, oh, oh<br><br>If you ever find yourself stuck in the middle of the sea<br>I'll sail the world to find you<br>If you ever find yourself lost in the dark and you can't see<br>I'll be the light to guide you<br><br>We find out what we're made of<br>When we are called to help our friends in need<br><br>You can count on me like one, two, three, I'll be there<br>And I know when I need it<br>I can count on you like four, three, two, and you'll be there<br>'Cause that's what friends are supposed to do, oh, yeah<br><br>Ooh, ooh<br>Ooh, ooh, yeah, yeah<br><br>If you're tossing and you're turning and you just can't fall asleep<br>I'll sing a song beside you<br>And if you ever forget how much you really mean to me<br>Everyday I will remind you, oh<br><br>We find out what we're made of<br>When we are called to help our friends in need<br><br>You can count on me like one, two, three, I'll be there<br>And I know when I need it<br>I can count on you like four, three, two, and you'll be there<br>'Cause that's what friends are supposed to do, oh, yeah<br><br>Ooh, ooh<br>Ooh, ooh, yeah, yeah<br><br>You'll always have my shoulder when you cry<br>I'll never let go, never say goodbye<br>You know you can<br><br>Count on me like one, two, three, I'll be there<br>And I know when I need it<br>I can count on you like four, three, two, and you'll be there<br>'Cause that's what friends are supposed to do, oh, yeah<br><br>Ooh, ooh<br>Ooh, ooh<br><br>You can count on me 'cause I can count on you"},
  { title: "Caliente", artist: "Ricky edit", cover: "https://s.mxmcdn.net/images-storage/albums2/9/5/3/5/2/3/64325359_350_350.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748901/caliente_-_rickyedit_1_pe7zjc.m4a", moods: ['animadas'] ,
    lyrics: "Una de pasta, de la que se come y no se gasta<br>Me pido los Spaghettis gordos como rastas<br>Basta, le he subido el brillo y no contrasta<br>Tú eres mercadillo y yo dirijo la subasta<br><br>Aplasta la mirada con la que me piensa<br>No son amiguitas pero la fotito renta<br>Mientan, le robé el zapato a Cenicienta<br>No me quedan chicles, ¿y por qué me huele a menta?<br><br>Sale con o sin pintura pa' la calle<br>No le aguanto los ojitos sin que me desmaye<br>Y dale, no soy de fijarme en los detalles<br>No me eches la bronca niña pija no me ralles<br>Vale, puede que mi pantalón estalle<br>Si no me acompañas un ratito por el valle<br>Y ale, ve con cuidadito pero dale<br>Qué manos tan frías, prefiero que te la jales<br><br>Si me sacas a bailar<br>No te dejo respirar<br>Si te acercas por detrás<br>No hace falta decir más<br><br>Ese culo me rellena tres menús<br>Desayuno con tostadas y tus babitas untadas ¿Repelús?<br>Achús, ¿te has puesto malita? Te digo: Salud<br>Pero si eres religiosa, directamente: Jesús<br>George Bush iba hace un ratito conmigo en el bus<br>Me ha pedido una tirita pa' una herida llena pus<br>No sé qué coño decía pero el muy cabrón sabía<br>Que mi postre favorito era desplumarme en el mouse<br><br>Siempre te pillo caliente<br>No sé por qué tantas ganas niña últimamente<br>No me molesta la gente<br>He hecho cosas raras, que miren se me hace frecuente<br>Pido que no seas paciente<br>Que si me ves muy salvaje, tú seas mi serpiente<br>Siento tu cora' latente<br>Tú solo sigue mi ritmo y aprieta los dientes<br><br>Mami, tú no te preocupes, que esto no echa humo<br>Vale, que mis amiguitos fumen, pero yo no fumo<br>Si en las fiestas las botellas que me bebo son de zumo<br>Vete ya a dormir tranquila y no preguntes si consumo<br><br>Si me sacas a bailar<br>No te dejo respirar<br>Si te acercas por detrás<br>No hace falta decir más<br><br>Yo me lo plancho, si me necesitas soy tu gancho<br>Ma toca'o la lotería ladro como pancho<br>Un rancho, te he comprado maldita así que ponme la boquita<br>O si no quita que te juro que te mancho<br>¿Cómo? ¿Que alguien se lo ha dicho a tu maromo?<br>Chico ¿No sabías que coleccionaba cromos?<br>Va si te pregunta dile que soy Juan Arroyo<br>No lo guiso y me lo como, me la pido y me la follo<br><br>No contesta ¿La llamo o me cargo la fiesta?<br>¿Cuánto cuesta? La tarifa que incluye respuesta<br>Qué modesta, no somos na' y ya me detesta<br>Sumo y resta, va, pide la cuenta que voy a echar la siesta"},
  { title: "X Remix", artist: "Nicky Jam, J Balvin, Ozuna, Maluma", cover: "https://i.scdn.co/image/ab67616d0000b27326129b4b928f0f97ba344545", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748902/X_Remix_-_Nicky_Jam_x_J_Balvin_x_Ozuna_x_Maluma_cqklqd.m4a", moods: ['animadas'] ,
    lyrics: "(Oh no!)<br>This is the remix!<br>Nicky Jam!<br>(Ah!)<br><br>Sé que estás cansada<br>De que te hagan lo mismo<br>Que te traten como nada<br>A mí me pasa lo mismo<br>Sé que no quieres más (no)<br>Pasar un rato mami y luego te traten<br>Como si no te conocieran<br>Por eso te digo<br><br>(This is the remix)<br><br>Y no, no, no, no, no, no, no, no, no<br>No llores más<br>(No llores más)<br>Yo también busco amor<br>(Yo también)<br>Odio la soledad, baby<br><br>Oh, no, no, no, no, no, no, no, no, no<br>No llores más<br>Yo también busco amor<br>Odio la soledad<br><br>Yo sé que estás buscando alguien<br>Que te quiera de cora<br>Y entrega el corazón a ver si en verdad se enamora<br>Pero siempre el amor te falla<br>Y siempre terminas solita en tu cuarto llorando<br>Y el dolor te lo calla<br>Pero yo estoy pa' ti, y aunque no me crea<br>También estoy buscando alguien pa' que me haga feliz<br>Que no me quiera por plata ni pa' que le ponga techo<br>Que me quiera por el corazón que llevo en el pecho<br>Que en verdad se enamore<br>Que se ría conmigo cuando esté feliz<br>Pero cuando esté triste que también llore<br>Yo sé que piensas igual que yo, que nadie confió<br>Pero si me da un break yo voy a llenar ese vacío<br><br>Y no, no, no, no, no, no, no, no, no<br>No llores más<br>(No llores más)<br>Yo también busco amor<br>(Yo también)<br>Odio la soledad, baby<br><br>Oh, no, no, no, no, no, no, no, no, no<br>No llores más<br>Yo también busco amor<br>Odio la soledad<br><br>Dime, bebé, ¿cómo te va?<br>Siento que estás pasando por algo<br>Y te quiero ayudar<br>Te veo tan bonita, sola y me da curiosidad<br>Si es que alguien te ha hecho daño, tú solo dímelo<br>Dame la llave de tu corazón<br>Para que veas que existe la magia del amor<br>Quizás me está pasando lo mismo (lo mismo)<br>Al verte tan sola (al verte tan sola!)<br>Los dos nos unimos por un mismo destino<br><br>Y no, no, no, no, no, no, no, no, no<br>No llores más<br>(No llores más)<br>Yo también busco amor<br>(Yo también)<br>Odio la soledad, baby<br><br>Oh, no, no, no, no, no, no, no, no, no<br>No llores más<br>Yo también busco amor<br>Odio la soledad<br><br>Oye, mujer, esto yo te diré<br>Yo no soy como el otro<br>Yo sí que te cuidaré<br>Yo estoy cansado de lo mismo, es un abismo<br>Estoy seguro que contigo en la salida<br>Ya no llores más<br>Si tú pensaste que a ti nadie te amaba<br>Estoy contigo mami no es de la nada<br>Yo quiero darte lo que a ti te faltaba<br>Te doy tu lugar, y no llores más<br>Si tú pensaste que a ti nadie te amaba<br>Estoy contigo mami no es de la nada<br>Yo quiero darte lo que a ti te faltaba<br>Te doy tu lugar (yeah)<br><br>Y no, no, no, no, no, no, no, no, no<br>No llores más<br>(No llores más)<br>Yo también busco amor<br>(Yo también)<br>Odio la soledad, baby<br><br>Y no, no, no, no, no, no, no, no, no<br>No llores más<br>(No llores más!)<br>Yo también busco amor<br>Odio la soledad, baby<br><br>Valentino<br><br>N-I-C-K<br>Nicky, Nicky, Nicky Jam<br>El Ñejo<br>Valentino!<br>Myself<br>J Alvarez, el dueño del sistema<br>(Valentino)<br>Myself<br>Ya tú sabes<br>Yo soy la fama<br>Dímelo Blass<br>The Producer<br>Pipe Flores<br>(Pipe Flores)<br>Saga White Black<br>(Klasico)<br>Desde enviado Puerto Rico<br>(Qué combinación)<br>La Industria INC<br>On top of the world<br>(Muy fuerte)"},
  { title: "Viva La Vida", artist: "Coldplay", cover: "https://m.media-amazon.com/images/I/9145yafeO2L._UF894,1000_QL80_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748903/Coldplay_-_Viva_La_Vida_Official_Video_rjwiqg.m4a", moods: ['animadas'] ,
    lyrics: "I used to rule the world<br>Seas would rise when I gave the word<br>Now in the morning I sleep alone<br>Sweep the streets I used to own<br><br>I used to roll the dice<br>Feel the fear in my enemy's eyes<br>Listened as the crowd would sing<br>Now the old king is dead! <br>Long live the king!<br><br>One minute I held the key<br>Next the walls were closed on me<br>And I discovered that my castles stand<br>Upon pillars of salt and pillars of sand<br><br>I hear Jerusalem bells are ringing<br>Roman Cavalry choirs are singing<br>Be my mirror, my sword and shield<br>My missionaries in a foreign field<br><br>For some reason I can't explain<br>Once you'd gone, there was never<br>Never an honest word<br>That was when I ruled the world<br><br>It was the wicked and wild wind<br>Blew down the doors to let me in<br>Shattered windows and the sound of drums<br>People couldn't believe what I'd become<br><br>Revolutionaries wait<br>For my head on a silver plate<br>Just a puppet on a lonely string<br>Oh, who would ever want to be king?<br><br>I hear Jerusalem bells are ringing<br>Roman Cavalry choirs are singing<br>Be my mirror, my sword and shield<br>My missionaries in a foreign field<br><br>For some reason I can't explain<br>I know Saint Peter won't call my name<br>Never an honest word<br>But that was when I ruled the world<br><br>Ooh, ooh, ooh, ooh<br><br>Hear Jerusalem bells are ringing<br>Roman Cavalry choirs are singing<br>Be my mirror, my sword and shield<br>My missionaries in a foreign field<br><br>For some reason I can't explain<br>I know Saint Peter won't call my name<br>Never an honest word<br>But that was when I ruled the world"},
  { title: "3 AM", artist: "Eladio Carrión, Brytiago", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCWfQQxORCJbF-JVcNQ2qouJQqMA0C4Arkdg&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748904/Eladio_Carri%C3%B3n_Brytiago_-_3_AM_Visualizer___Sauce_Boyz_paeyvx.m4a", moods: ['animadas'] ,
    lyrics: "Ele uve en mis pantalones, pero no son Levi’s<br>Antes no comía bien ahora como rib eye<br>Big boss, big ross, como DY<br>Las mujeres me dan cake cake como Steve Aoki<br><br>En alta pero siempre estamos low key<br>Fumando verde como el traje del loki<br>Tengo el cuello frío puedo jugar hockey<br>Tu cuello brilla, pero eso es Swarovski<br>‘Toy fumando un OG<br>No me pase’ una pangola porque eso es foshi<br>Siempre están hablando y soplando como un ñoqui<br>A todos mis envidiosos que me den un toqui<br>En la punta del bicho mío lo llamo Rocky<br>No me digas que tú le pagaste al disc-jockey<br>Pa’ poner tu música en la disco y hacen coquí<br><br>Y a lo mío repeat y a lo tuyo delete, yeah<br>Yo estoy balling NBA tú estás balling también, pero en el d-league yeah<br>¿Y si no es melaza, papi qué te pasa? No me pase’ el fili, yeah<br>De la ola soy el capitán del barco como Phillip, yeah<br>Y tu en yola capitán de un charco, nigga believe<br>Nigga believe<br>Una roleta debajo de mi sleeve<br>No me llames, yo te llamo, nigga please<br>Porque cuando hablas necesito un Aleve<br>Ele uve en mis pantalones, pero no son Levi’s<br>Antes no comía bien ahora como rib eye<br>Big boss, big ross como DY<br>Las mujeres me dan cake cake como Steve A<br><br>Oki, en alta pero siempre estamos low key<br>Fumando verde como el traje del OG<br>Tengo el cuello frío puedo jugar hockey<br>Tu cuello brilla, pero eso es Swarovski<br>‘Toy fumando un OG<br>No me pase’ una pangola porque eso es foshi<br>Siempre están hablando y soplando como un ñoqui<br>A todos mis envidiosos que me den un toqui<br>En la punta del bicho mío lo llamo Rocky<br>No me digas que tú le pagaste al disc-jockey<br>Pa’ poner tu música en la disco y hacen coquí (coquí, coquí)<br><br>Trabajando nunca cogimos atajo<br>Tamo arriba todavía no encajo<br>Tamo arriba, pero eso es gracias a Dios<br>Como la yuca venimos desde abajo<br>Como la papa, zanahoria y el ajo<br>Ahora el cuello la tengo como Lake Tahoe<br>Mama huevo tú te crees que esto es relajo<br>Probé la cima, ya yo no me bajo<br><br>Ele uve en mis pantalones, pero no son Levi’s<br>Antes no comía bien ahora como rib eye<br>Big boss, big ross como DY<br>Las mujeres me dan cake cake como Steve A<br><br>Oki, en alta pero siempre estamos low key<br>Fumando verde como el traje del OG<br>Tengo el cuello frío puedo jugar hockey<br>Tu cuello brilla, pero eso es Swarovski<br>‘Toy fumando un OG<br>No me pase’ una pangola porque eso es foshi<br><br>‘Toy fumando un OG<br>‘Toy fumando un OG<br>No me pase’ una pangola porque eso es foshis"},
  { title: "Qué Bonita", artist: "Cano", cover: "https://cdn-images.dzcdn.net/images/cover/e65d06182e60952beb733eefe35a1d75/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748905/El_Mismo_Sol_svyp5p.m4a", moods: ['romanticas'] ,
    lyrics: "Qué bonita cuando veo<br>Que bajas sin recogerte el pelo<br>Con los aros y un vestido negro<br>Y ese cuerpo pa comerlo entero<br><br>Qué bonita cuando veo<br>Que bajas sin recogerte el pelo<br>Con los aros y un vestido negro<br>Y ese cuerpo pa comerlo entero<br><br>Qué bonita cuando veo<br>La cara que pones de cabreo<br>Cuando envías mensaje y no los leo<br>Y me río pero sin quererlo<br><br>No me canso de escribirte canciones<br>Pa que cantes to el día no me canso<br>Ni de verte te considero como familia<br>Las mujeres te tienen celos cuando<br>Te ven porque tienes lo que ellas no<br>Tienen son cosas que nunca lo van a entender<br><br>Y ahora escúchame mi amor<br>Tú cora me da calor sigo contigo<br>A pesar de to doo y tú sigues conmigo<br>No es por fama ni chito simplemente yo te derrito<br><br>Y tú tienes unos celos que te dañan hasta la salud<br>Y la única para mí eres tú<br><br>Y en los tiempos de envidia puro tu corazón porque para ti<br>El dinero no es una ambición<br><br>Qué bonita cuando veo<br>Que bajas sin recogerte el pelo<br>Con los aros y un vestido negro<br>Y ese cuerpo pa comerlo entero<br><br>Qué bonita cuando veo<br>La cara que pones de cabreo<br>Cuando envías mensaje<br>Y no los leo y me río pero sin quererlo<br><br>Y cuando no estás a mi vera poquito a poco<br>Me mata el dolor si supieras que te quiero<br>Como nadie nunca la he querido<br>Yo a base de palos aprendí que un cielo gris<br>Vuelve a su color porque<br>Aunque haya muchos problemas<br>Todos de ellos tienen alguna solución<br><br>No sé dónde saco la letra ni palabra pa tanto cantar<br>Quizás es por lo guapa que estás<br>Estoy enamorado quizás<br><br>Y tú tienes unos celos que te dañan hasta la salud<br>Y la única para mí eres tú<br><br>Y en los tiempos de envidia puro tu corazón porque para ti<br>El dinero no es una ambición<br><br>Qué bonita cuando veo<br>Que bajas sin recogerte el pelo<br>Con los aros y un vestido negro<br>Y ese cuerpo pa comerlo entero<br><br>Qué bonita cuando veo<br>La cara que pones de cabreo<br>Cuando envías mensaje y no los leo<br>Y me río pero sin quererlo"},
  { title: "Bailando", artist: "Enrique Iglesias", cover: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c0/Enriquebailandocover.jpg/250px-Enriquebailandocover.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748907/Enrique_Iglesias___Bailando_Lyrics_feat_Descemer_Bueno__Gente_De_pvlefu.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "Enrique Iglesias<br>Gente de Zona<br>Descemer<br><br>Yo te miro y se me corta la respiración<br>Cuando tú me miras, se me sube el corazón<br>(Me palpita lento el corazón)<br>Y en un silencio, tu mirada dice mil palabras<br>La noche en la que te suplico que no salga el Sol<br><br>Bailando (bailando)<br>Bailando (bailando)<br>Tu cuerpo y el mío, llenando el vacío<br>Subiendo y bajando (subiendo y bajando)<br><br>Bailando (bailando)<br>Bailando (bailando)<br>Ese fuego por dentro me va enloqueciendo<br>Me va saturando<br><br>Con tu física y tu química, también tu anatomía<br>La cerveza y el tequila, y tu boca con la mía<br>Y ya no puedo más (ya no puedo más)<br>Ya no puedo más (ya no puedo más)<br><br>Con esta melodía, tu color, tu fantasía<br>Con tu filosofía, mi cabeza está vacía<br>Y ya no puedo más (ya no puedo más)<br>Ya no puedo más (ya no puedo más)<br><br>Yo quiero estar contigo, vivir contigo<br>Bailar contigo, tener contigo<br>Una noche loca (una noche loca)<br>Ay, besar tu boca (y besar tu boca)<br><br>Yo quiero estar contigo, vivir contigo<br>Bailar contigo, tener contigo<br>Una noche loca<br>Con tremenda nota<br><br>(Oh, oh, oh, ooh)<br>(Oh, oh, oh, ooh)<br>(Oh, oh, ooh, oh)<br>(Oh, oh, oh, ooh)<br><br>Tú me miras y me llevas a otra dimensión<br>(Estoy en otra dimensión)<br>Tus latidos aceleran a mi corazón<br>(Tus latidos aceleran a mi corazón)<br>Qué ironía del destino no poder tocarte<br>Abrazarte y sentir la magia de tu olor<br><br>Bailando (bailando)<br>Bailando (bailando)<br>Tu cuerpo y el mío, llenando el vacío<br>Subiendo y bajando (subiendo y bajando)<br><br>Bailando (bailando)<br>Bailando (bailando)<br>Ese fuego por dentro me va enloqueciendo<br>Me va saturando<br><br>Con tu física y tu química, también tu anatomía<br>La cerveza y el tequila, y tu boca con la mía<br>Y ya no puedo más (ya no puedo más)<br>Ya no puedo más (ya no puedo más)<br><br>Con esta melodía, tu color, tu fantasía<br>Con tu filosofía, mi cabeza está vacía<br>Y ya no puedo más (ya no puedo más)<br>Ya no puedo más (ya no puedo más)<br><br>Yo quiero estar contigo, vivir contigo<br>Bailar contigo, tener contigo<br>Una noche loca (una noche loca)<br>Ay, besar tu boca (y besar tu boca)<br><br>Yo quiero estar contigo, vivir contigo<br>Bailar contigo, tener contigo<br>Una noche loca<br>Con tremenda nota<br><br>(Oh, oh, oh, ooh)<br>(Oh, oh, oh, ooh)<br>(Oh, oh, ooh, oh)<br>(Oh, oh, oh, ooh)<br><br>(Oh, oh, oh, ooh)<br>(Oh, oh, oh, ooh)<br>(Oh, oh, ooh, oh)<br>(Oh, oh, oh, ooh)<br><br>(Oh, oh, oh, ooh) bailando, amor<br>(Oh, oh, oh, ooh) bailando, amor<br>(Oh, oh, ooh, oh) es que se me va el dolor<br>(Oh, oh, oh, ooh)"},
  { title: "DUELE EL CORAZÓN", artist: "Enrique Iglesias", cover: "https://i1.sndcdn.com/artworks-000164317296-txl7y7-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748909/Enrique_Iglesias_-_DUELE_EL_CORAZON_Lyric_Video_ft._Wisin_v27ra0.m4a", moods: ['animadas'] ,
    lyrics: "(One love, one love)<br><br>Solo en tu boca<br>Yo quiero acabar<br>Todos esos besos<br>Que te quiero dar<br><br>A mí no me importa<br>Que duermas con él<br>Porque sé que sueñas<br>Con poderme ver<br><br>Mujer, ¿qué vas a hacer?<br>Decídete pa' ver<br>Si te quedas o te vas<br>Si no, no me busques más<br><br>Si te vas, yo también me voy<br>Si me das, yo también te doy mi amor<br>Bailamos hasta las diez<br>Hasta que duelan los pies<br><br>Si te vas, yo también me voy<br>Si me das, yo también te doy mi amor<br>Bailamos hasta las diez<br>Hasta que duelan los pies<br><br>Con él, te duele el corazón<br>Y conmigo te duelen los pies<br>Con él, te duele el corazón<br>Y conmigo te duelen los pies<br><br>Solo con un beso<br>Yo te haría acabar<br>Ese sufrimiento<br>Que te hace llorar<br><br>A mí no me importa<br>Que vivas con él<br>Porque sé que mueres<br>Con poderme ver<br><br>Mujer, ¿qué vas a hacer?<br>Decídete pa' ver<br>Si te quedas o te vas<br>Si no, no me busques más<br><br>Si te vas, yo también me voy<br>Si me das, yo también te doy mi amor<br>Bailamos hasta las diez<br>Hasta que duelan los pies<br><br>Si te vas yo también me voy<br>Si me das, yo también te doy mi amor<br>Bailamos hasta las diez<br>Hasta que duelan los pies<br><br>Con él, te duele el corazón<br>Y conmigo te duelen los pies<br>Con él, te duele el corazón<br>Y conmigo te duelen los pies (¡doble!)<br><br>¿Quién es el que te quita el frío?<br>Te vas conmigo, rumbeamos, con él, lloras casi un río<br>Tal vez te da dinero y tiene poderío<br>Pero no te llena, tu corazón sigue vacío<br><br>Pero, conmigo, rompe' la carretera<br>Bandolera, si en tu vida hay algo que no sirve, sácalo pa' fuera<br>A ti nadie te frena, la superguerrera<br>Yo sé que tú eres una fiera, dale, sácalo pa' fuera<br><br>Si te vas, yo también me voy<br>Si me das, yo también te doy mi amor<br>Bailamos hasta las diez<br>Hasta que duelan los pies<br><br>Si te vas, yo también me voy<br>Si me das, yo también te doy mi amor<br>Bailamos hasta las diez<br>Hasta que duelan los pies<br><br>Con él, te duele el corazón<br>Y conmigo te duelen los pies<br>Con él, te duele el corazón<br>Y conmigo te duelen los pies<br><br>Solo con un beso<br>Yo quiero acabar<br>Ese sufrimiento<br>Que te hace llorar"},
  { title: "La Bachata", artist: "MTZ Manuel Turizo", cover: "https://i1.sndcdn.com/artworks-HG9Rj4F1lgzFynKw-jpIVmQ-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748910/La_Bachata_-_MTZ_Manuel_Turizo___Video_Oficial_thrsqd.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "Te bloqueé de Insta<br>Pero, por otra cuenta, veo tus historias<br>Tu número lo borré<br>No sé pa' qué, si me lo sé de memoria<br><br>Me hiciste daño y así te extraño<br>Y aunque sé que un día te voy a olvidar<br>Aún no lo hago, es complicado<br>To' lo que hicimo', me gusta recordar<br><br>Ando manejando por las calles que me besaste<br>Oyendo las canciones que un día me dedicaste<br>Te diría que volvieras, pero eso no se pide<br>Mejor le pido a Dios que me cuide<br><br>Porque ando manejando por las calles que me besaste<br>Oyendo las canciones que un día me dedicaste<br>Te diría que volvieras, pero eso no se pide<br>Mejor le pido a Dios que me cuide, eh<br><br>Que me cuide de otra que se parezca a ti<br>No quiero caer como hice por ti<br>Ojalá te enamore', te hagan lo mismo que me hiciste a mí<br>Tú me enseñaste a no amar a cualquiera<br>Y también como no quiero que me quieran<br><br>No-oh-oh, éramos tres en una relación de dos<br>No te perdono, pídele perdón a Dios<br>Dije que te olvidé y la verdad es que yo-oh-oh<br>Yo-oh-oh<br><br>Ando manejando por las calles que me besaste<br>Oyendo las canciones que un día me dedicaste<br>Te diría que volvieras, pero eso no se pide<br>Mejor le pido a Dios que me cuide<br><br>Porque ando manejando por las calles que me besaste<br>Oyendo las canciones que un día me dedicaste<br>Te diría que volvieras, pero eso no se pide<br>Mejor le pido a Dios que me cuide, eh<br><br>Manuel Turizo"},
  { title: "El Merengue", artist: "MTZ Manuel Turizo", cover: "https://cdn-p.smehost.net/sites/5b3bac59eb36401694af3a241173447f/wp-content/uploads/2023/03/93201a3b-066d-4ae6-8fba-92694479a310.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748911/Marshmello_Manuel_Turizo_-_El_Merengue_j0d5t6.m4a", moods: ['animadas'] ,
    lyrics: "Vamo', listo<br>Salud, muchacho, por esa mujer<br><br>'Toy cansa'o de pensarte con el pecho roto<br>Hay sol, pero hace frío desde que no estás<br>Me paso tomando, mirando tus fotos<br>Queriendo borrarla, pero no me da<br><br>Hubiera dicho lo que siento pa' no dejar na' guarda'o<br>Los beso' que no te di te los hubiera roba'o<br>Extrañarte me tiene con los ojos colorao'<br>No es lo mismo estar solo, que estar solo enamora'o<br><br>Dije que te olvidé, pero no te había olvida'o (no te había olvida'o)<br>Ay, ay, ay<br>También dijе que te superé y no tе había supera'o (y no te había supera'o)<br>Borracho dije que ya te olvidé, pero no te había olvida'o (no te había olvida'o)<br>Ay, ay, ay<br>También dije que te superé y no te había supera'o (y no te había supera'o)<br><br>Entrando a la disco la miré, la miré, la miré<br>Y estaba bailando sola, bailando sola<br>Me le pegué, me pegué, me pegué<br>Y así se fueron las horas, un par de horas<br><br>Dime, sin pena solo dime<br>Dime lo que quiera', menos que yo te olvide<br>Cuando uno está tomando, las palabras no mide<br>Hoy te pido perdón si algún día borracho<br><br>Dije que te olvidé, pero no te había olvida'o (no te había olvida'o)<br>Ay, ay, ay<br>También dije que te superé y no te había supera'o (y no te había supera'o)<br>Borracho dije que ya te olvidé, pero no te había olvida'o (no te había olvida'o)<br>Ay, ay, ay<br>También dije que te superé y no te había supera'o (y no te había supera'o)<br><br>Entrando a la disco, la miré, la miré, la miré<br>Y estaba bailando sola, bailando sola<br>Me le pegué, me pegué, me pegué<br>Y así se fueron las horas, un par de horas<br><br>La miré, la miré, la miré<br>Y estaba bailando sola, bailando sola<br>Me le pegué, me pegué, me pegué<br>Y así se fueron las horas, un par de horas<br><br>Opa, ¿cómo te voy a olvidar yo a ti?<br>Esta noche me sacan de aquí borracho y contigo<br>Sí, señor, por ti mujer<br>Salud"},
  { title: "1000 Cosas", artist: "MTZ Manuel Turizo", cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777751326/1000_cosas_nzka1y.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748912/Lola_Indigo_Manuel_Turizo_-_1000_Cosas_Letra___Lyrics_hs1gu0.m4a", moods: ['romanticas'] ,
    lyrics: "(Ya-ya)<br>(Brr)<br>(If you want me, baby, don't lie)<br>(Bomboclat [?])<br><br>Que tú me gustas, se sabe<br>Obviamente se sabe<br>Tú eres mi plan A, mi plan B, plan C<br>Tenemos todo, my love and sex, yeah<br><br>Domingo por la noche<br>Nadie quiere dormir<br>Lunes por la mañana, ninguno se quiere ir<br>Loco por ti, y tú loca por mí, ya<br><br>Feeling lonely si no estás a mi la'o<br>Siento cosas, cosas de enamora'o<br>Con besitos que quedan marca'o<br>Tú me tienes, me tienes malcria'o<br><br>Feeling lonely si no estás a mi la'o<br>Siento cosas, cosas de enamora'o<br>Besitos que quedan marca'o<br>Tú me tienes, me tienes malcria'o<br><br>No tiene Only, pero lo que facturaría<br>Tendría la mansión más grande de Montería<br>Tierra, trágame y llévame pa' ese día<br>Que estábamos pega'ítos bailando La Factoría<br><br>Esta supuesta amistad<br>Lo mejor que yo he tenido nunca<br>Baby, si te preguntan, diles que Dios los crea<br>Y que ellos solos se juntan<br><br>Claro, y resulta si no nos vamos juntos<br>No es oficial, pero estamos a punto<br>Tú eres my love for life, life, life<br>Lo nuestro es de verdad (if you want me, baby, don't lie)<br><br>Feeling lonely si no estás a mi la'o<br>Siento cosas, cosas de enamora'o<br>Con besitos que quedan marca'o<br>Tú me tienes, me tienes malcria'o<br><br>Feeling lonely si no estás a mi la'o<br>Siento cosas, cosas de enamora'o<br>Besitos que quedan marca'o<br>Tú me tienes, me tienes malcria'o"},
  { title: "Die With a Smile", artist: "Lady Gaga, Bruno Mars", cover: "https://cdn-images.dzcdn.net/images/cover/4bd5903f4ce8f2601916bfadb44efe8a/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748913/Lady_Gaga_Bruno_Mars_-_Die_With_A_Smile_defupf.m4a", moods: ['romanticas'] ,
    lyrics: "Ooh<br>I<br><br>I just woke up from a dream<br>Where you and I had to say goodbye<br>And I don't know what it all means<br>But since I survived, I realized<br><br>Wherever you go, that's where I'll follow<br>Nobody's promised tomorrow<br>So I'ma love you every night like it's the last night<br>Like it's the last night<br><br>If the world was ending, I'd wanna be next to you<br>If the party was over and our time on Earth was through<br>I'd wanna hold you just for a while<br>And die with a smile<br>If the world was ending, I'd wanna be next to you<br><br>Woo-ooh<br><br>Ooh, lost<br>Lost in the words that we scream<br>I don't even wanna do this anymore<br>'Cause you already know what you mean to me<br>And our love's the only war worth fighting for<br><br>Wherever you go, that's where I'll follow<br>Nobody's promised tomorrow<br>So I'ma love you every night like it's the last night<br>Like it's the last night<br><br>If the world was ending, I'd wanna be next to you<br>If the party was over and our time on Earth was through<br>I'd wanna hold you just for a while<br>And die with a smile<br>If the world was ending, I'd wanna be next to you<br><br>Right next to you<br>Next to you<br>Right next to you<br>Oh-oh-oh<br><br>If the world was ending, I'd wanna be next to you<br>If the party was over and our time on Earth was through<br>I'd wanna hold you just for a while<br>And die with a smile<br>If the world was ending, I'd wanna be next to you<br>If the world was ending, I'd wanna be next to you<br><br>Ooh, ooh<br>I'd wanna be next to you"},
  { title: "BELIEVER", artist: "Imagine Dragons", cover: "https://i.scdn.co/image/ab67616d0000b2735675e83f707f1d7271e5cf8a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748915/Imagine_Dragons_-_Believer_Lyrics_kfi5ha.m4a", moods: ['animadas'] ,
    lyrics: "First things first<br>I'ma say all the words inside my head<br>I'm fired up and tired of the way<br>That things have been, oh-ooh<br>The way that things have been, oh-ooh<br>Second things second<br>Don't you tell me what you think that I could be<br>I'm the one at the sail, I'm the master of my sea, oh-ooh<br>The master of my sea, oh-ooh<br><br>I was broken from a young age<br>Taking my sulking to the masses<br>Writing my poems for the few<br>That look at me, took to me, shook to me, feeling me<br>Singing from heartache from the pain<br>Taking my message from the veins<br>Speaking my lesson from the brain<br>Seeing the beauty through the<br><br>Pain!<br>You made me a, you made me a believer, believer<br>Pain!<br>You break me down and build me up, believer, believer<br>Pain!<br>Oh, let the bullets fly, oh, let them rain<br>My life, my love, my drive, it came from<br>Pain!<br>You made me a, you made me a believer, believer<br><br>Third things third<br>Send a prayer to the ones up above<br>All the hate that you've heard<br>Has turned your spirit to a dove, oh-ooh<br>Your spirit up above, oh-ooh<br><br>I was choking in the crowd<br>Building my rain up in the cloud<br>Falling like ashes to the ground<br>Hoping my feelings, they would drown<br>But they never did, ever lived, ebbing and flowing<br>Inhibited, limited<br>Till it broke open and rained down<br>And rained down, like<br><br>Pain!<br>You made me a, you made me a believer, believer<br>Pain!<br>You break me down and build me up, believer, believer<br>Pain!<br>Oh, let the bullets fly, oh, let them rain<br>My life, my love, my drive, it came from<br>Pain!<br>You made me a, you made me a believer, believer<br><br>Last things last<br>By the grace of the fire and the flames<br>You're the face of the future<br>The blood in my veins, oh-ooh<br>The blood in my veins, oh-ooh<br>But they never did, ever lived, ebbing and flowing<br>Inhibited, limited<br>Till it broke open and rained down<br>And rained down, like<br><br>Pain!<br>You made me a, you made me a believer, believer<br>Pain!<br>You break me down and build me up, believer, believer<br>Pain!<br>Oh, let the bullets fly, oh, let them rain<br>My life, my love, my drive, it came from<br>Pain!<br>You made me a, you made me a believer, believer"},
  { title: "Si No Estás", artist: "Iñigo Quintero", cover: "https://i.scdn.co/image/ab67616d0000b273c0a5c14b34a02f242af03359", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748916/i%C3%B1igo_quintero_-_Si_No_Est%C3%A1s_Letra_Oficial_1_lraiuu.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Sueñas alto, es el poder<br>Que te han dado desde el cielo, no, no, no, no, no<br><br>Que no sé a dónde voy<br>No es real<br>Hace ya tiempo te volviste uno más<br><br>Y odio cuando estoy<br>Lleno de este veneno<br>Y oigo truenos si no estás<br><br>¿Qué me has hecho? ¿Dónde estoy?<br>Se me aparecen mil planetas de repente<br>Esto es una alucinación<br><br>Quiero ver tu otra mitad<br>Alejarme de esta ciudad<br>Y contagiarme de tu forma de pensar<br><br>Miro al cielo, al recordar<br>Me doy cuenta otra vez más<br>Que no hay momento que pase sin dejarte de pensar<br><br>Esta distancia no es normal<br>Ya me he cansado de esperar<br>Dos billetes para amarte, no quiero ver nada más<br><br>Imposible, es demasiado tarde<br>Todo es un desastre<br>Esto es una obsesión<br><br>No me sirven tus pocas señales<br>Ya nada es como antes<br>Me olvido de quién soy<br><br>¿Qué me has hecho? ¿Dónde estoy?<br>No vas de frente, es lo de siempre<br>Y, de repente, estoy perdiendo la razón<br><br>Cien complejos sin sentido<br>Me arrebatan tus latidos y tu voz<br>Y ya no puedo más<br><br>Que no sé a dónde voy<br>No es real<br>Hace ya tiempo te volviste uno más<br><br>Y odio cuando estoy<br>Lleno de este veneno<br>Y oigo truenos si no estás<br><br>Imposible, es demasiado tarde<br>Todo es un desastre<br>Esto es una obsesión<br><br>No me sirven tus pocas señales<br>Ya nada es como antes<br>Me olvido de quien soy<br><br>¿Y dónde estás?<br>La verdad es que ya van mil noches malditas sin tu abrazo<br>Es algo raro, estoy viciado a tu amor<br>A tu amor, a tu amor, amor, amor, no, no, no<br><br>Quiero verte, verte, verte<br>Que se acabe ya"},
  { title: "Si Antes Te Hubiera Conocido", artist: "Karol G", cover: "https://i1.sndcdn.com/artworks-TTDsE8Jj2gF855AL-hFnpUQ-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748917/KAROL_G_-_Si_Antes_Te_Hubiera_Conocido___Coke_Studio_sxezkk.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "(¿Qué lo que?)<br>(Estamos a rulay)<br>(Empezó el verano)<br>(¡Fuego!)<br><br>¿Qué hubiera sido<br>Si antes te hubiera conocido?<br>Seguramente, estarías bailando esta conmigo<br>No como amigos<br><br>Sino como otra cosa<br>Usted cerca me pone peligrosa<br>Por un besito, hago cualquier cosa<br>La novia suya me pone celosa<br>Y aunque es hermosa, ¡ey!<br><br>No te va a tratar como yo<br>No te va a besar como yo<br>No está tan rica así como yo<br>Ella es tímida y yo no<br><br>Con estas ganas que tengo yo<br>Me atrevo a comerme a los do'<br>Hoy estás jangueando con ella<br>Pero, mmm, después tal vez no<br><br>¿Qué hubiera sido<br>Si antes te hubiera conocido?<br>Seguramente, estarías bailando esta conmigo<br>No como amigos, ey<br><br>¿Qué hubiera sido<br>Ay, si antes te hubiera conocido?<br>Seguramente, estarías bailando esta conmigo<br>No como amigos, ey<br><br>Y yo te veo y no sé cómo actuar<br>Bebé, pa' conquistarte, que me pasen el manual<br>Espero lo que sea, yo no me voy a quitar<br>Tengo fe que esos ojito' un día me van a mirar<br><br>Yo me caso contigo<br>Mi nombre suena bien con tu apellido<br>Estoy esperando el primer descuido<br>Pa' presentarte como mi marido<br><br>Yo me caso contigo<br>Mi nombre suena bien con tu apellido<br>Estoy esperando el primer descuido<br>Pa' presentarte como mi marido<br>No has entendido que<br><br>No te va a tratar como yo<br>No te va a besar como yo<br>No está tan rica así como yo<br>Ella es tímida y yo no<br><br>Con estas ganas que tengo yo<br>Me atrevo a comerme a los do'<br>Hoy estás jangueando con ella<br>Pero, mmm, después tal vez no<br><br>¿Qué hubiera sido<br>(Si antes te hubiera conocido?) Ey, ¿cómo?<br>Seguramente, estarías bailando esta conmigo<br>No como amigos, no, no, no<br><br>(¿Qué hubiera sido)<br>(Si antes te hubiera conocido?)<br>(Seguramente, estarías bailando esta conmigo)<br>(No como amigos)<br><br>(¿Qué hubiera sido)<br>(Si antes te hubiera conocido?)"},
  { title: "Firework", artist: "Katy Perry", cover: "https://m.media-amazon.com/images/M/MV5BMWRmMWVlOWYtOWQ2Yi00MjdmLTliNGUtOTk1N2M4MmQwZmJkXkEyXkFqcGc@._V1_QL75_UY190_CR2,0,190,190_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748918/Katy_Perry_-_Firework_Lyrics_qgmiip.m4a", moods: ['animadas'] ,
    lyrics: "Do you ever feel<br>Like a plastic bag<br>Drifting through the wind<br>Wanting to start again?<br>Do you ever feel<br>Feel so paper thin<br>Like a house of cards<br>One blow from caving in?<br><br>Do you ever feel<br>Already buried deep<br>Six feet under screams<br>But no one seems to hear a thing?<br>Do you know that there's<br>Still a chance for you?<br>'Cause there's a spark in you<br><br>You just gotta ignite the light<br>And let it shine<br>Just own the night<br>Like the Fourth of July<br><br>'Cause, baby, you're a firework<br>Come on, show 'em what you're worth<br>Make 'em go: Ah, ah, ah!<br>As you shoot across the sky<br><br>Baby, you're a firework<br>Come on, let your colors burst<br>Make 'em go: Ah, ah, ah!<br>You're gonna leave them all in awe, awe, awe<br><br>You don't have to feel<br>Like a wasted space<br>You're original<br>Cannot be replaced<br>If you only knew<br>What the future holds<br>After a hurricane<br>Comes a rainbow<br><br>Maybe a reason why<br>All the doors are closed<br>So you could open one<br>That leads you to the perfect road<br>Like a lightning bolt<br>Your heart will glow<br>And when it's time, you'll know<br><br>You just gotta ignite the light<br>And let it shine<br>Just own the night<br>Like the Fourth of July<br><br>'Cause, baby, you're a firework<br>Come on, show 'em what you're worth<br>Make 'em go: Ah, ah, ah!<br>As you shoot across the sky<br><br>Baby, you're a firework<br>Come on, let your colors burst<br>Make 'em go: Ah, ah, ah!<br>You're gonna leave them all in awe, awe, awe<br><br>Boom, boom, boom<br>Even brighter than the Moon, Moon, Moon<br>It's always been inside of you, you, you<br>And now it's time to let it through<br><br>'Cause, baby, you're a firework<br>Come on, show 'em what you're worth<br>Make 'em go: Ah, ah, ah!<br>As you shoot across the sky<br><br>Baby, you're a firework<br>Come on, let your colors burst<br>Make 'em go: Ah, ah, ah!<br>You're gonna leave them all in awe, awe, awe<br><br>Boom, boom, boom<br>Even brighter than the Moon, Moon, Moon<br>Boom, boom, boom<br>Even brighter than the Moon, Moon, Moon"},
  { title: "I Kissed A Girl", artist: "Katy Perry", cover: "https://upload.wikimedia.org/wikipedia/en/5/5c/I_Kissed_a_Girl.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748919/Katy_Perry_-_I_Kissed_A_Girl_Official_Music_Video_qdtvxf.m4a", moods: ['animadas'] ,
    lyrics: "This was never the way I planned<br>Not my intention<br>I got so brave, drink in hand<br>Lost my discretion<br><br>It's not what I'm used to<br>Just wanna try you on<br>I'm curious for you<br>Caught my attention<br><br>I kissed a girl and I liked it<br>The taste of her cherry chapstick<br>I kissed a girl just to try it<br>I hope my boyfriend don't mind it<br><br>It felt so wrong, it felt so right<br>Don't mean I'm in love tonight<br>I kissed a girl and I liked it<br>I liked it<br><br>No, I don't even know your name<br>It doesn't matter<br>You're my experimental game<br>Just human nature<br><br>It's not what good girls do<br>Not how they should behave<br>My head gets so confused<br>Hard to obey<br><br>I kissed a girl and I liked it<br>The taste of her cherry chapstick<br>I kissed a girl just to try it<br>I hope my boyfriend don't mind it<br><br>It felt so wrong, it felt so right<br>Don't mean I'm in love tonight<br>I kissed a girl and I liked it<br>I liked it<br><br>Us, girls, we are so magical<br>Soft skin, red lips, so kissable<br>Hard to resist, so touchable<br>Too good to deny it<br>Ain't no big deal, it's innocent<br><br>I kissed a girl and I liked it<br>The taste of her cherry chapstick<br>I kissed a girl just to try it<br>I hope my boyfriend don't mind it<br><br>It felt so wrong, it felt so right<br>Don't mean I'm in love tonight<br>I kissed a girl and I liked it<br>I liked it"},
  { title: "La Cintura", artist: "Alvaro Soler", cover: "https://i1.sndcdn.com/artworks-000326908518-qfg6dg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748920/La_Cintura_-_Alvaro_Soler_Letra_lyrics_knrjhe.m4a", moods: ['animadas'] ,
    lyrics: "Destaca cuando anda<br>Va causando impresión<br>Cada día cuando levanta<br>Brilla como el sol<br>Su vestido de seda<br>Calienta mi corazón<br>Como en una novela<br>En la televisión<br><br>Me acerco a ti<br>Bailemos, juguemos, eh<br>Acércate, ooh<br><br>Porque mi cintura<br>Necesita tu ayuda<br>No lo tengo en las venas<br>Y no la puedo controlar<br><br>Creo que mi cintura<br>Choca con mi cultura<br>Tropiezo con la arena<br>Ya no me puedo controlar<br><br>Y bajando, bajando, eh<br>Olvidando, olvidando que<br>Estoy bailando, bailando, eh<br>Y así hasta el amanecer<br><br>Porque mi cintura<br>Necesita tu ayuda<br>No lo tengo en las venas<br>Voy a aprender a controlar<br>Mi cintura, cintura<br>(Mi cintura, cintura)<br><br>Porque no bajamos a la playa<br>Para así practicar<br>Pronto por la mañana<br>Y así no hay nadie más<br>Cuando bailo contigo<br>Tu cuerpo me da calor<br>Besito a besito<br>Mi fruta de la pasión<br><br>Me acerco a ti<br>Bailemos, juguemos, eh<br>Acércate, ooh<br><br>Porque mi cintura<br>Necesita tu ayuda<br>No lo tengo en las venas<br>Y no la puedo controlar<br><br>Y bajando, bajando, eh<br>Olvidando, olvidando que<br>Estoy bailando bailando, eh<br>Y así hasta el amanecer<br><br>Porque mi cintura<br>Necesita tu ayuda<br>No lo tengo en las venas<br>Voy a aprender a controlar<br>Mi cintura, cintura<br><br>Ven hacia mí, ven hacia mí<br>Como las olas del mar<br>Ven hacia mí, ven hacia mí<br>Que ya no puedo parar<br>Ven hacia mí, ven hacia mí<br>Como las olas del mar<br>Ven hacia mí, ya no puedo parar<br><br>Y bajando, bajando, eh<br>Olvidando, olvidando que<br>Estoy bailando bailando, eh<br>Y así hasta el amanecer<br><br>Porque mi cintura<br>Necesita tu ayuda<br>No lo tengo en las venas<br>Voy a aprender a controlar<br><br>Y bajando, bajando, eh<br>Olvidando, olvidando que<br>Estoy bailando bailando, eh<br>Y así hasta el amanecer<br><br>Mi cintura, cintura<br>(Mi cintura, cintura)"},
  { title: "como estrellas", artist: "YOUNG", cover: "https://i.scdn.co/image/ab67616d0000b273866265358ce5d4770b67ab8d", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748921/LA_YounG_-_Como_Estrellas_pvizll.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Não mexe comigo<br>Se não sai furado<br>Cabelo na régua<br>Bigode finin<br><br>Hoje tem baile<br>Brotei do nada<br>De Glock rajada<br>Na cinta o radin<br><br>Ela me olha<br>Quando tô de peça<br>Gosta de aventura<br>Tá pedindo leitin<br><br>Só ando com a gang<br>Não mexe com a gang<br>São minha família<br>Matam e morram por mim<br><br>E é pia no bloco mano<br>Você sabe que rola tiroteiro<br>Young Nigga causando terror<br>Que eu tô ligado que em tu eu boto medo<br><br>Vocês falando falando e não faz<br>Cadê sua marra na pista?<br>Sua mina me chupando na rua de trás<br>Ela me olha e a xota já pisca<br><br>Mano você é zoado<br>Mano você é pussy nigga<br>Sua mina tá curtindo a minhas foto<br>Acho que ela quer ser minha mina<br><br>Tô com a minha tropa fumando a da forte<br>Tô com a minha tropa portando lacoste<br>Malote no bolso porque agora eu posso<br>Sucesso e fama pra toda minha tropa<br><br>Não mexe comigo<br>Se não sai furado<br>Cabelo na régua<br>Bigode finin<br><br>Hoje tem baile<br>Brotei do nada<br>De Glock rajada<br>Na cinta o radin<br><br>Ela me olha<br>Quando tô de peça<br>Gosta de aventura<br>Tá pedindo leitin<br><br>Não mexe comigo<br>Se não sai furado<br>Cabelo na régua<br>Bigode finin<br><br>Hoje tem baile<br>Brotei do nada<br>De Glock rajada<br>Na cinta o radin<br><br>Ela me olha<br>Quando tô de peça<br>Gosta de aventura<br>Tá pedindo leitin<br><br>Só ando com a gang<br>Não mexe com a gang<br>São minha família<br>Matam e morram por mim<br><br>Tô puto e bolado com os cara fardado, então não encosta na Glock<br>Se brotar na reta tem troco pra trinta, tô de aq atrás do poste<br>Mirando na testa desses verme safado e não é de Air soft<br>Sua bitch pelada na base safada tirando meu short<br><br>Os cria trajado, malote, perfume importado<br>Muito importante todo dia aqui pra nós é feriado<br>Não vem aqui, se tu brotar aqui mano tu vai sair furado<br>Sua bitch pedindo vara, na cara, na tara e você aí trancado<br>Nós porto whisky, balão e ainda é debochado<br>Não é qualquer um aqui que anda do nosso lado<br>Se tu sentar direitin vai dar rolê de Camaro<br>Com 2 bico com os cria na parte de trás do carro (hahaha)<br>Então se sinta importante, mas só por esse instante<br>Tô empilhando grana na minha casa em cima da estante<br><br>Malote no bolso<br>Relógio no pulso<br>PT na cintura cromada<br>Andando trajado de tênis da Nike deixando as mina molhada<br>Tem várias pistola colete e fuzil e muita droga entocada<br>Tua mina me viu já piscou a xota e eu não entendi nada<br>Essa vida de chefe que eu tô levando juro mano eu não aguento<br>Quando eu passo faz cara de nojo, então vomita porque eu tô nojento<br><br>Então não mexe comigo se não sai furado, minha vida sempre foi assim<br>Sou jovem bandido e ando trajado e na cinta o radin<br>Sua irmã me ligando a noite toda ela vai sentar pra mim<br>Favela venceu, comi tua prima e ela saiu feliz"},
  { title: "Until I Found You", artist: "Stephen Sanchez", cover: "https://cdn-images.dzcdn.net/images/cover/8a6477b222dac17081d9b9b1729a1ca4/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748931/Stephen_Sanchez_-_Until_I_Found_You_Lyrics_1_rakcvt.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "Georgia<br>Wrap me up in all your, I want ya<br>In my arms, oh, let me hold ya<br>I'll never let you go again like I did<br>Oh, I used to say<br><br>I would never fall in love again until I found her<br>I said I would never fall unless it's you I fall into<br>I was lost within the darkness, but then I found her<br>I found you<br><br>Georgia<br>Pulled me in, I asked to love her<br>Once again you fell, I caught ya<br>I'll never let you go again like I did<br>Oh, I used to say<br><br>I would never fall in love again until I found her<br>I said I would never fall unless it's you I fall into<br>I was lost within the darkness, but then I found her<br>I found you<br><br>I would never fall in love again until I found her<br>I said I would never fall unless it's you I fall into<br>I was lost within the darkness, but then I found her<br>I found you"},
  { title: "Malito", artist: "Maluma", cover: "https://i.scdn.co/image/ab67616d0000b273b89593a15f6a40fd6d7de40c", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748932/Malito_w8w0t2.m4a", moods: ['animadas'] ,
    lyrics: "[Yandel]<br>Llevo varios días buscándote<br>Extrañándote, pensando que<br>¿Cuándo volverás a ser mía?<br>¿En tu cama con quién dormías?<br><br>[Maluma & Yandel]<br>Sabes que siempre serás mía, sólo mía<br>No hay secretos en tu habitación<br>Baby, quién diría que me enamoraría de ti?<br><br>Sabes que siempre serás mía, sólo mía<br>No hay secretos en tu habitación<br>Baby, quién diría que me enamoraría de ti?<br><br>[Maluma]<br>Sigo pensándote, imaginándome<br>Que estás tocándome y provocándote<br>No hay secretos en mi habitación<br>Loco por volver a verte<br>Y recordarte cómo te hago subir al cielo<br>Tu cuerpo es una sombra y yo agarrado de tu pelo<br>Tus gemidos, tus siluetas que aparecen en mis sueños<br>Quién diría que entre tantos soy tu dueño!<br><br>[Maluma]<br>Dime a ver<br>No te esfuerces con soñarlo<br>El fuego hay que apagarlo<br>No entiendo porqué extrañarnos<br><br>[Yandel & Maluma]<br>Sabes que siempre serás mía, sólo mía<br>No hay secretos en tu habitación<br>Baby, quién diría que me enamoraría de ti?<br><br>Sabes que siempre serás mía, sólo mía<br>No hay secretos en tu habitación<br>Baby, quién diría que me enamoraría de ti?<br><br>[Yandel]<br>Los recuerdos en tu cuarto te dejan dormir tranquila<br>Son tantos los momentos, yo sé que no los olvidas<br>Sé que duermes con mi camisa en tu piel<br>Si se le va el olor, búscame otra vez<br>Si me preguntan por ti no sé que decirles<br>Pues lo que conocí de ti es confundible<br>Sabes la verdad, no te quiero ofender<br>Cómo lo haces, vuelvo a perder<br><br>[Yandel & Maluma]<br>Dime a ver<br>No te esfuerces con soñarlo<br>El fuego hay que apagarlo<br>No entiendo porqué extrañarnos<br><br>Dime a ver<br>No te esfuerces con soñarlo<br>El fuego hay que apagarlo<br>No entiendo porqué extrañarnos<br><br>[Yandel & Maluma]<br>Sabes que siempre serás mía, sólo mía<br>Hay secretos en tu habitación<br>Baby, quién diría que me enamoraría de ti?<br><br>Sabes que siempre serás mía, sólo mía<br>Hay secretos en tu habitación<br>Baby, quién diría que me enamoraría de ti?<br><br>[Yandel & Maluma]<br>Sólo Mía<br>Maluma!<br>El Capitán Yandel!<br>La leyenda y El Pretty Boy, baby!<br>Maluma!<br>Pronosticado: millones de views<br>Kevin ADG, Chan El Genio, baby!<br>EARCANDY!<br>La Sensa!<br>Haciendo música por el mundo<br>Update!<br>Sabes que siempre serás mía, sólo mía"},
  { title: "quelamamen", artist: "Ricky edit", cover: "https://cdn-images.dzcdn.net/images/cover/6c56dd16a8da24c8e59781231e29442b/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748937/quelamamen_-_rickyedit_t0yfas.m4a", moods: ['animadas'] ,
    lyrics: "¡Hey! Buenos días a la cinco de la tarde<br>Soy hombre de costumbres y mi agenda está que arde<br>Me miro los bolsillos con carita de cobarde<br>Porque un compi me dio cositas pa' que se las guarde (no)<br><br>Si preguntan, ese no era yo<br>Si me buscan: Desapareció<br>Me chamuscan con la vibración<br>Deja de mandar gitanos te lo pido<br>Por favor, que alguien me explique cómo funciona internet<br>Que aún me sabe todo a Ron Cacique<br><br>Y es que he intentado decir algo en un lugar llamado Twitter<br>Sin que a nadie le salpique<br>Buscando a alguien que en años de uso me triplique<br>Que no parezca haberse queda'o sin tabique<br>Tampoco somos tontos<br>Incluso a los que nos mola lo suavito<br>De vez en cuando nos gusta el pique<br><br>¿Por qué no ceder y dar la razón<br>A una feminista rompedora?<br>¿Y si acepto mi fallo y doy borrón<br>Porque me lo ha dicho una escritora?<br>Ya se me han puesto en contra periodistas y doctoras<br>Me están haciendo bullying hasta antiguas profesoras<br>Me suena el móvil, miro y por lo visto<br>Me regalan dos billetes para Bali con ruta en lancha motora<br><br>¡Hey! Buenas tardes, tengo poca cobertura<br>Al final, cruzando promos, he terminado en Honduras<br>Según me han dicho, en mis menciones la cosa está dura<br>Así que no enseño los pezones por si me censuran (oh)<br><br>Que si machista, misógino opresor<br>Que si clasista de impuestos evasor<br>Me lloran comunistas sin la comunión<br>¿Cómo voy a respetar a to' estos polvos sin condón?<br>Don comedia, me hago llamar, no me suena mal<br>¿Dónde te tengo que firmar pa' no molestar?<br>Don Ética y Mister moral me han hecho viral<br>Con un hilo donde cada FAV lo convierto en ca$h<br><br>La dignidad podéis usar como contra argumento<br>Para mi figura tumbar<br>Pero es que en realidad, y ahora escuchad<br>De verdad que lo siento, pero no paro de explotar<br>Qué flipa'o que solo habla de pas-pas-pasta<br>Qué pringa'o, que sepas que eres cas-cas-casta<br>Qué pesa'o, no me importa en qué gas-gas-gastas<br><br>¡Vale, me pongo el candado, BAS-BAS-BASTA!<br>No te recomiendo pisarme lo fregado<br>Y si lo haces, no lo borres, lo tengo capturado<br>A mí no me tengas miedo, que ahora somos hermanos<br>Yo el listo, tú el bastardo al que humillo por retrasado<br><br>¡Hey! Buenas noches, me pillas terminando<br>El personaje, la trama, el papel, que estoy elaborando<br>¿Pensabas que ser tonto me salía improvisando?<br>Me considero un genio, pero jo, te estás pasando<br>(No)<br><br>Como ya no tengo solución<br>Tendré que monetizarlo yo<br>Y si pica, prueba rascándote chica<br>Que aquí termina el capítulo"},
  { title: "Ahora Y Siempre", artist: "Quevedo", cover: "https://i.scdn.co/image/ab67616d0000b2738517e3f690cdabf1a616b2e8", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748939/Quevedo_-_Ahora_Y_Siempre_Letra_Lyrics_x6edyd.m4a", moods: ['romanticas'] ,
    lyrics: "Eh, eh<br>Quevedo con el Linton, mai<br>La mente rozando el sky, yeah-eah<br>LPGC, you know, wow<br><br>Estoy bien con la piba, pero la música ahora es mi amante<br>Sigo con la misma cadena que tengo desde antes de ser cantante<br>No tengo que ponerle más brillo si yo ya nací brillando como diamante<br>No se cuelgan las bota', menos se enganchan los guante'<br><br>Se duerme más tranquilo cuando estás generando tantos malos ratos, momentos con poca fe<br>No adecuado a mi época, si por el la'o a todos les pasé<br>A los mío' nunca me les torcí, aunque muchos me vieron caer<br>Cada vez hay más cosas que asumir y cada vez menos cosas que entender<br>Pero estoy haciendo lo que me hace feliz y lo que me duele a mí me da poder<br><br>Tengo a mami tranquila, la mente tranquila y la mala vibra not found<br>Tengo a la competencia intranquila, aunque los tenga intentando igualar mi sound<br>Siempre andamos en alta, nunca andamos down, pies en tierra, ready pa'l siguiente round<br>Si, cada vez que yo le meto a la base, suena: Paw-paw, paw-paw<br><br>Por la gente que se fue en el pasado brindo<br>Espero que les vaya de lo lindo<br>Díganles que ando en el estudio con Linton<br>Que aquí, no se libra ni los domingos<br><br>Centra'o en lo mío, ya yo no distingo<br>Un tema normal si todo es un himno<br>Le meto bien duro a ella y a la base<br>A ninguno me le voy de ritmo<br><br>Llama directamente a Félix si quieren algo de mí<br>Que yo estaré maquinando cuál es el siguiente hit<br>Voy a cobrar las colabos como la cosa siga así<br>Eh-ey, como Bad Bunny, en mi peak<br><br>Si saco un palo en Insta, desliza<br>La nena moviéndose como limpiaparabrisas<br>Borracho con Kevin, inclina'o como la Torre de Pisa<br>Gastando la regalía, nunca da cero la Visa<br><br>Si viene la guardia, avisa, que andamos de parkineo<br>Con la mirada en un culo y la mente en el joseo<br>Cuatro botellas de ron y con dos horas de sueño<br>Tan borracho que hasta doble veo<br><br>Estoy cumpliendo uno, ahora me faltan dos deseos<br>Si te soy sincero, ya los comentarios ni los leo<br>Porque sé que todo lo que quiero, si puedo, lo creo<br>Gente de verdad, la puedo contar solo con dos dedos<br><br>Gracias a Dios, 'tamos bien<br>No los tenemos, pero ya olemos a todos los billetes de cien<br>Ahora hay muchos conocidos que quieren acercarse, pero muy pocos friends<br>Que los que necesito no se vayan, que la vida los trate bien<br>Que ella se quede a mi lado para siempre, amén<br><br>Quevedo con el Lin, Quevedo con el Linto-to-on<br>Yeah-yeah-yeah-yeah, yeah-yeah-yeah-yeah<br>2021, mai"},
  { title: "Cuando Te Vi", artist: "Maria Becerra, Trueno", cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/6/f/9/d/2282831720092918.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748940/Maria_Becerra_Trueno_Big_One_-_Cuando_Te_Vi___CROSSOVER_5_eaa8fv.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "(This is the Big One)<br><br>Busco una excusa pa' volverte a ver<br>Me obsesiona comerte otra vez<br>Es que no puedo parar de pensar lo que hicimo' esa noche<br><br>Cuando te vi<br>Supe que iba a pasar<br>Me prometí que no me iba a enamorar, oh<br>Pero fuck that (fuck that)<br>Ese cuerpo me encanta<br>Me lo hiciste tan rico que me cuesta no volverte a llamar<br><br>Es que te vi<br>Supe que iba a pasar (que iba a pasar)<br>Me prometí que no me iba a enamorar, oh<br>Pero fuck that (fuck that)<br>Ese cuerpo me encanta (oh-oh)<br>Me lo hiciste tan rico (TR1, mai, ja)<br><br>Aunque todavía no soy rico (no)<br>Te puedo dar amor como de chico<br>Cosquillas en la panza, como antes del primer pico (mai)<br>O poder agarrarte de la mano una tarde de verano<br>Momento' que se vuelven infinito' (yeah-yeah)<br><br>Y por favor, no le ponga' precio ni valor a mi honor<br>Que sin idealizacione', no hay dolor (no)<br>Y eso es bueno para mí, que no ando buscando el amor<br>Ando en busca de una turra y si es de zona sur, mejor<br><br>¿Vos querías calle? Traje poesía callejera<br>Poca plata, muchos sueño', voy a darte lo que quiera'<br>Estoy bajando pa' tu barrio, yendo por la carretera<br>Esta cara llena un estadio y yo pienso que es Bombonera<br>Y si me espera, yo voy y la busco de cualquier manera<br>Le dije que estoy llegando, en realidad ya estoy afuera<br>Y espero que baje rápido, el tiempo me desespera<br>Un wacho verdadero pa' la mamichula verdadera<br>TR1<br><br>Ya no hay excusa', mai, me tiene a sus pie'<br>Me obsesiona comerte otra ve', eh-eh<br>Mami, ni tenés que llamar<br>Si hoy yo te paso a buscar<br>Yo no me quería enamorar, pero<br><br>Cuando te vi<br>Supe que iba a pasar (que iba a pasar)<br>Me prometí que no me iba a enamorar, oh (¿ah, no?, ¿ah, no?)<br>Pero fuck that (fuck that)<br>Ese cuerpo me encanta<br>Me lo hiciste tan rico<br><br>Ay, yo pensé<br>Que nos comíamos<br>Y yo juré<br>Que no había amor, yeah, yeah<br><br>I got twenty-one questions and they are for you<br>A ti te gustan seductora' como Betty Boop<br>¿Acaso querés que te baile?, ¿que te desarme?<br>Que el cuerpo hable, que pida, mmm<br><br>Tantas noches juntos, ya no sé si me confundo<br>Si eres tú o es que soy yo, es el deseo<br>Me consumo en la idea<br>De que te vaya' con la marea<br>Y que yo más nunca te vea<br>Y ya no sé qué voy a hacer<br><br>Cuando te vi<br>Supe que iba a pasar (que iba a pasar)<br>Me prometí que no me iba a enamorar, oh (¿ah, no?, ¿ah, no?)<br>Pero fuck that (fuck that)<br>Ese cuerpo me encanta<br>Me lo hiciste tan rico que me cuesta no volverte a llamar<br><br>Es que te vi<br>Supe que iba a pasar<br>Me prometí que no me iba a enamorar, oh<br>Pero fuck that (fuck that)<br>Ese cuerpo me encanta<br>Me lo hiciste tan rico"},
  { title: "Todo de Ti", artist: "Rauw Alejandro", cover: "https://i.scdn.co/image/ab67616d0000b273c160ede886e4e54350c0cec9", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748941/Rauw_Alejandro_-_Todo_de_Ti_Video_Oficial_fucazk.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "One, two<br>One, two, three<br>Dice, Ra-Rauw<br><br>El viento soba tu cabello<br>Uh, uh, uh, uh, uh<br>Me matan esos ojos bellos<br>Uh, uh, uh, uh, uh<br><br>Me gusta tu olor, de tu piel el color<br>Y cómo me haces sentir<br>Me gusta tu boquita, ese labial rosita (tú)<br>Y cómo me besas a mí (Rauw)<br><br>Contigo quiero despertar<br>Hacerlo después de fumar (ey)<br>Ya no tengo na' que buscar<br>Algo fuera de aquí<br><br>Tú combinas con el mar<br>Ese bikini se ve fenomenal<br>No hay gravedad que me pueda elevar<br>Me pones mal a mí (¡yah!)<br><br>Aceleras to' mis latidos<br>Y e' que me gusta todo de ti<br>De to'a tus parte', ¿cuál decido?<br>Y e' que me gusta todo de ti<br><br>Oh, oh, oh, oh, oh, oh, oh<br>E' que me gusta todo de ti<br>Oh, oh, oh, oh, oh, oh, oh<br>E' que me gusta todo de ti<br><br>Quinta Avenida, no va pa'l mall<br>Ella sabe que le llegó a sólo un call<br>En la Raptor me gusta ponerla en Ford<br>El jogger large, la camisa small<br><br>Como la dieta keto<br>Por ti me controlo y me quedo quieto<br>Que quiero comerte to' eso completo<br>De ese culo me volví un Teco, eh<br><br>Mi-mi-micro dosi', rola, oxi (oh)<br>Besando eso' labio' glossy<br>Ya yo le di en to'a la' posi<br><br>Champú de coco, Chanel su wallet<br>Me vuelve loco desde el casco hasta lo' pedale'<br><br>Contigo quiero despertar (oh, oh)<br>Hacerlo después de fumar<br>Ya no tengo na' que buscar<br>Algo fuera de aquí<br><br>Tú combinas con el mar (eh)<br>Ese bikini se ve fenomenal (eh)<br>No hay gravedad que me pueda elevar<br>Me pones mal a mí (¡yah!)<br><br>Aceleras to' mis latidos<br>Y e' que me gusta todo de ti<br>De to'a tus parte', ¿cuál decido?<br>Y e' que me gusta todo de ti<br><br>Ah, ah, ah (todo de ti)<br>Ah, ah (todo de ti), ah, ah<br>E' que me gusta todo de ti<br>Ah, ah, ah (todo de ti)<br>Ah, ah (todo de ti), ah, ah<br>E' que me gusta todo de ti<br><br>Contigo quiero despertar (oh, oh)<br>Hacerlo después de fumar<br>Ya no tengo na' que buscar<br>Algo fuera de aquí (Ra-Rauw)<br><br>Tú combinas con el mar (ey)<br>Ese bikini se ve fenomenal (Naisgai)<br>No hay gravedad que me pueda elevar (Colla)<br>Me pones mal a mí (dice)<br><br>Rauw Alejandro<br>Algo fuera de aquí (Uh, uh)<br>Uh, uh<br>Me pones mal a mí"},
  { title: "real gangsta love", artist: "Trueno", cover: "https://images.genius.com/d7ae872dffe2dda742204c6fd4256e4e.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748942/Trueno_-_REAL_GANGSTA_LOVE_Official_Video_bzn4xz.m4a", moods: ['animadas'] ,
    lyrics: "Esto es real gangsta love, love<br>This is real gangsta love, love<br>Esto es real gangsta love, love<br>This is real gangsta love, love (love)<br>Esto es real—<br><br>Mai, this is real love gangsta<br>Solo con saber que no te vas, me basta (ah-ah)<br>Salimo' del barrio y nos buscamos por el plato, por el money y por la pasta<br>Tie-tie-tiempo, el tiempo lo obtiene, pero eso no lo gasta<br>Meno' en ustede' que no le dan la nafta (no)<br>Prefiere mi estilo, vieja escuela, blockbuster (uh)<br>Le doy one love, como un rasta<br><br>Baby, ¿qué buscás de mí?<br>'Toy saliendo del camarín (ajá, yo te llego)<br>Yendo hacia tu fantasy, oh<br>Baby, what you want from me?<br>Tell me what you want to be<br>Only real gangsta shit, baby girl<br><br>Esto es real gangsta love<br>All you want, te lo doy, put it on, put it on<br>This is real gangsta love<br>Pam, pa-pa-pa-pa-pam-pam, un disparo al corazón<br>Esto es real gangsta love<br>Yeah, yeah, jum, ella viene del hood, con azúcar, pom-pom<br>This is real gangsta love<br>She don't need a gun, mai, let's get it on<br>Esto es real—<br><br>Gangsta love<br>Mami, yo te doy mi corazón vándalo<br>Toma to', gástalo<br>¿Qué tú tiene' para mí?<br>Tengo to' para vo'<br>La mamichula del Bronx provocó el apagón (oh, oh)<br>Le dijo a su novio que su relación se acabó (no)<br>Y se quedó callado, ja, como Papa Doc<br>Quiere que la lleve pa' las Islas Galápagos, ja, yeah<br><br>Esto es real gangsta love<br>Ga-ga-ga-gangsta girl, gangsta gyal<br>Lo mueve así, todo aquí va a estallar<br>No está bien, no está mal<br>Mami, tu cuento vamo' a hacerlo real<br>Gangsta girl (gangsta girl), gangsta gyal<br>Lo mueve así, todo aquí va a estallar (uh)<br>No está bien, no está mal<br><br>Esto es real gangsta love<br>All you want, te lo doy, put it on, put it on<br>This is real gangsta love<br>Pam, pa-pa-pa-pa-pam-pam, un disparo al corazón<br>Esto es real gangsta love<br>Yeah, yeah, jum, ella viene del hood, con azúcar, bombón<br>This is real gangsta love<br>She don't need a gun, mai, let's get it on<br>Esto es real gangsta love"},
  { title: "Belong Together", artist: "Mark Ambor", cover: "https://i.ytimg.com/vi/xPWnNFF-TAw/sddefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748944/Mark_Ambor_-_Belong_Together_Lyrics_o7nepu.m4a", moods: ['romanticas'] ,
    lyrics: "I know sleep is friends with death<br>But maybe I should get some rest<br>'Cause I've been out here workin' all damn day<br>Blueberries and butterflies<br>The pretty things that greet my eyes<br>When you call and I say: I'm on my way<br><br>(One, two)<br><br>You and me belong together<br>Like cold iced tea and warmer weather<br>Where we lay out late underneath the pines<br>And we still have fun when the Sun won't shine<br>You and me belong together all the time<br><br>(Mmm, mmm, mmm)<br>(Oh, woah)<br><br>Spillin' wine and homemade drinks<br>We throw a cheers, the worries sink<br>Damnit, it's so good to be alive (wow)<br>We know that we don't got much<br>But, then again, it's just enough<br>To always find a way for a good time<br><br>You and me belong together<br>Like cold iced tea and warmer weather<br>Where we lay out late underneath the pines<br>And we still have fun when the Sun won't shine<br>You and me belong together<br><br>This love is all we need<br>Oh, we've got so much<br>You and me, oh<br><br>You and me belong together<br>Like cold iced tea and warmer weather<br>Where we lay out late underneath the pines<br>And we still have fun when the Sun won't shine<br>You and me belong together all the time<br><br>It goes on and on and on (hey)<br>It goes on and on and on (hahaha)<br>It goes on and on and on (woo)"},
  { title: "sway", artist: "Michael Bublé", cover: "https://i1.sndcdn.com/artworks-mfRYr4OtlumkBA1q-pL2Mfg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748945/Michael_Bubl%C3%A9_-_Sway_Lyrics_twaz4d.m4a", moods: ['romanticas','relajantes'] ,
    lyrics: "When marimba rhythms start to play<br>Dance with me, make me sway<br>Like a lazy ocean hugs the shore<br>Hold me close, sway me more<br><br>Like a flower bending in the breeze<br>Bend with me, sway with ease<br>When we dance, you have a way with me<br>Stay with me, sway with me<br><br>Other dancers may be on the floor<br>Dear, but my eyes will see only you<br>Only you have that magic technique<br>When we sway, I go weak<br><br>I can hear the sounds of violins<br>Long before it begins<br>Make me thrill as only you know how<br>Sway me smooth, sway me now<br><br>Other dancers may be on the floor<br>Dear, but my eyes will see only you<br>Only you have that magic technique<br>When we sway, I go weak<br><br>I can hear the sounds of violins<br>Long before it begins<br>Make me thrill as only you know how<br>Sway me smooth, sway me now<br><br>When marimba rhythms start to play<br>Dance with me, make me sway<br>Like a lazy ocean hugs the shore<br>Hold me close, sway me more<br><br>Like a flower bending in the breeze<br>Bend with me, sway with ease<br>When we dance, you have a way with me<br>Stay with me, sway with me<br><br>When marimba start to play<br>Hold me close, make me sway<br>Like a ocean hugs the shore<br>Hold me close, sway me more<br><br>Like a flower bending in the breeze<br>Bend with me, sway with ease<br>When we dance, you have a way with me<br>Stay with me, sway with me"},
  { title: "CLASSIC", artist: "mkto", cover: "https://i.scdn.co/image/ab67616d0000b2739474419f15773875a495eed3", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748946/MKTO_-_Classic_Lyrics_yrsqeh.m4a", moods: ['animadas'] ,
    lyrics: "Hey, where's the drums?<br>Woo oh<br>Let's go!<br><br>Woo, girl, you're shining<br>Like a 5th Avenue diamond<br>And they don't make you like they used to<br>You're never going out of style<br><br>Woo, pretty baby<br>This world might have gone crazy<br>The way you saved me, who could blame me<br>When I just wanna make you smile<br><br>I wanna thrill you like Michael<br>I want to kiss you like Prince<br>Let's get it on like Marvin Gaye, like Hathaway<br>Write a song for you like this<br><br>You' re over my head, I'm out of my mind<br>Thinking I was born in the wrong time<br>One of a kind, living in a world gone plastic<br>Baby, you're so classic (yeah, yeah; gone plastic)<br>Baby, you're so classic (yeah, yeah)<br>Baby, you<br>Baby, you're so classic<br><br>Four dozen roses<br>Anything for you to notice<br>All the way to serenade you<br>Doing in Sinatra style<br><br>I'ma pick you up in a Cadillac<br>Like a gentleman, bringin' glamour back<br>Keep it real to real in the way I feel<br>I could walk you down the aisle<br><br>I wanna thrill you like Michael<br>I want to kiss you like Prince<br>Let's get it on like Marvin Gaye, like Hathaway<br>Write a song for you like this<br><br>You' re over my head, I'm out of my mind<br>Thinking I was born in the wrong time<br>It's like a rewind, everything is so throwback-ish<br>I kinda like it, like it<br><br>Out of my league, old school chic<br>Like a moviestar from a silver screen<br>You're one of a kind, living in a world gone plastic<br>Baby, you're so classic (yeah, yeah)<br>Baby, you're so classic (so classic; yeah, yeah)<br>Baby, you're so classic<br><br>Baby you're classy, and, baby, you're sick<br>I never met a girl like you ever 'til we met<br>A star in the 40s, centerfold in the 50s'<br>Got met trippin' out like the 60s, hippies<br><br>Queen of the discotheque<br>A 70s dream and a 80s best<br>Hepburn, Beyoncé, Marilyn, Massey<br>Girl, you're timeless<br>Just so classic!<br><br>You' re over my head, I'm out of my mind<br>Thinking I was born in the wrong time<br>It's like a rewind, everything is so throwback-ish<br>I kinda like it, like it<br><br>Out of my league, old school chic<br>Like a moviestar from a silver screen<br>You're one of a kind, living in a world gone plastic<br>Baby, you're so classic (whoa, oh)<br>Baby, you're so classic (yeah, yeah)<br>Baby, you're so classic<br>Ooh"},
  { title: "A Dónde Vamos", artist: "Morat", cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/3/0/1/4/1111981626430157.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748947/Morat_-_A_D%C3%B3nde_Vamos_Letra___Albert_Maricheli_y9psss.m4a", moods: ['romanticas'] ,
    lyrics: "Recuerdo verte de perfil<br>Perdona si no fui sutil<br>Era verano, y yo moría de sed<br>Cuando te vi, solo quise beber<br>Beber de ti, de ti, de ti<br>Emborracharme, así, de ti<br><br>No hay trago que sepa tan bien<br>Como tus labios en Madrid<br>Y no sé, no sé, no sé<br>Cómo pude convencerte<br>Y no sé, no sé, no sé<br>¿Fue el destino o fue la suerte?<br><br>Que siendo un extraño, te dije te amo<br>Te he estado buscando por más de mil años<br>Y tú respondiste: ¿A dónde vamos?<br>Contra las apuestas, aquí nos quedamos<br><br>Viviendo de fiesta, después del verano<br>En el que respondiste: ¿A dónde vamos?<br>Y aunque la historia no estaba prevista<br>Somos la prueba de que existe amor a primera vista<br><br>No dejo de mirarte ni un segundo<br>Cuando tú estás, desaparece el mundo<br>Mejores noches, yo no creo que existan<br>Y, aunque me pida otra cerveza<br>Solo me interesa beber de ti, de ti, de ti<br>Emborracharme, así, de ti<br><br>Porque no hay trago que sepa tan bien (no, no)<br>Como tus labios en Madrid<br>Y no sé, no sé, no sé<br>Cómo pude convencerte (cómo pude convencerte)<br>Y no sé, no sé, no sé<br>¿Fue el destino o fue la suerte?<br><br>Que siendo un extraño, te dije te amo<br>Te he estado buscando por más de mil años<br>Y tú respondiste: ¿A dónde vamos?<br>Contra las apuestas, aquí nos quedamos<br><br>Viviendo de fiesta, después del verano<br>En el que respondiste: ¿A dónde vamos?<br>Y aunque la historia no estaba prevista<br>Somos la prueba de que existe amor a primera vista<br><br>¡Hey! ¡Hey! ¡Hey!<br>¡Hey! ¡Hey!<br><br>Hoy somos la prueba de que dos extraños<br>Con algo de suerte, por más de mil años<br>Se siguen diciendo: ¿A dónde vamos?<br><br>Contra las apuestas, aquí nos quedamos<br>Viviendo de fiesta, después del verano<br>En el que respondiste: ¿A dónde vamos? (¿A dónde vamos?)<br><br>Y aunque la historia no estaba prevista (la historia no ve)<br>Y aunque la gente, a veces, se resista (la gente no ve)<br>Somos la prueba de que existe amor a primera vista"},
  { title: "La Falda", artist: "Myke Towers", cover: "https://i1.sndcdn.com/artworks-r0TxDn1vZJbLEO3p-ROydVw-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748949/Myke_Towers_-_LA_FALDA_Letra_Lyrics_mwn6s0.m4a", moods: ['animadas'] ,
    lyrics: "(Full Harmony)<br><br>Esa falda chiquitita, qué bonita te queda<br>La veía to' los día', ahora es cuando se pueda<br>Y de la uni, yo la saco hasta donde se hospeda<br>Y las demá' que sigan envidiando, por eso no prosperan<br><br>Esa falda chiquitita, ay, qué bonita te queda<br>Yo la veía to' los día', ahora es cuando se pueda<br>Y de la uni, yo la saco hasta donde se hospeda<br>Y las demá' que sigan envidiando, por eso no prosperan<br><br>Ese culo pone a las demá' insegura'<br>Ella a mí me desconfigura<br>Mezcla lo sensual, la calle y la finura<br>Cuando quiere, no disimula<br><br>Hoy va pa' la calle, se bebe y se fuma<br>Quiere un tipo que la presuma<br>Su booty heavy weight, el jacuzzi con espuma<br>Chingando escuchando a Peso Pluma<br><br>E-e-esa falda chiquitita, ay, qué bonita te queda<br>Yo la veía to' los día', ahora es cuando se pueda<br>Y de la uni, yo la saco hasta donde se hospeda<br>Y las demá' que sigan envidiando, por eso no prosperan<br><br>Da-dale espacio a las demá' pa' que brillen, bebé<br>Tú no lo hace' a mal, solo hace' tu deber<br>Dime dónde estás, que yo te quiero ver<br>Es intocable, si pasa se tienen que mover<br><br>Está enfocá', anda en la de ella, pero a vece' se distrae<br>Se pone traje o falda pa' que se lo encaje<br>No le hablen de embarazo ni de prueba' de dopaje<br>Se puso creativa con la yerba que le traje<br><br>Y ella está haciendo un bachillerato<br>Yo llevo rato comiéndomela, pero no dejo rastro<br>Llegué con Yannc y con Chalko en una Raptor<br>Trae más sustancia' que den abasto<br>El alcohol hizo que a la amiga quiera besar<br>Sin querer, la toqué y se la subió sin pensar<br><br>Esa falda chiquitita, ay, qué bonita te queda<br>Yo la veía to' los día', ahora es cuando se pueda<br>Y de la uni, yo la saco hasta donde se hospeda<br>Y las demá' que sigan envidiando, por eso no prosperan<br><br>(Esa falda chiquitita, ay, qué bonita te queda)<br>(Yo la veía to' los día', ahora es cuando se pueda)<br>(Y de la uni, yo la saco hasta donde se hospeda)<br>(Y las demá' que sigan envidiando, por eso no prosperan)"},
  { title: "Como Te Atreves", artist: "Morat", cover: "https://images.genius.com/71945fe483298a6e9a160ba4aa8050c9.1000x1000x1.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748950/Morat_-_C%C3%B3mo_Te_Atreves_Video_Oficial_blq8d9.m4a", moods: ['romanticas'] ,
    lyrics: "Hoy me pregunto qué será de ti<br>Te tuve cerca y ahora estás tan lejos<br>Pero prohibirme recordar lo nuestro es imposible<br>Es imposible<br><br>No me perdono, sé que te perdí<br>Pero expiraron los remordimientos<br>Fui dictador y el no dejarte ir<br>Debió haber sido mi primer decreto<br><br>Cuatro años sin mirarte<br>Tres postales y un bolero<br>Dos meses y me olvidaste<br>Y ni siquiera me pensaste un 29 de febrero<br><br>Andan diciendo por la calle<br>Que solo le eres fiel al viento<br>El mismo que nunca hizo falta<br>Para levantar tu falda cada día de por medio<br><br>Cómo te atreves a volver (oh-oh)<br>A darle vida a lo que estaba muerto<br>La soledad me había tratado bien<br>Y no eres quien para exigir derechos<br><br>Cómo te atreves a volver (oh-oh)<br>Y a tus cenizas convertir en fuego<br>Hoy mis mentiras veo caer<br>Que no es verdad que te olvidé<br>¿Cómo te atreves a volver?<br><br>Oh-oh-oh-ooh, oh-oh-oh-oh-oh-ooh<br>Oh-oh-oh-oh-oh-ooh (oh-ooh)<br>Oh-oh-oh-ooh, oh-oh-oh-oh-oh-ooh<br>Oh-oh-oh-oh-oh-ooh (no, no, no)<br><br>¿Por qué volviste si te vas a ir?<br>Tantas mentiras que, al final, no veo<br>Nunca fui bueno para distinguir<br>Al fin y al cabo, siempre me las creo<br><br>Cuatro vidas me juraste<br>Tres te odio y un te quiero<br>Dos consejos para darte<br>Prefiero ser un cobarde que olvidarte de primero<br><br>Andan diciendo por la calle (andan diciendo por la calle)<br>Que solo le eres fiel al viento (que solo le eres fiel al viento)<br>El mismo que nunca hizo falta<br>Para levantar tu falda cada día de por medio<br><br>Cómo te atreves a volver (oh-oh)<br>A darle vida a lo que estaba muerto<br>La soledad me había tratado bien<br>Y no eres quien para exigir derechos<br><br>Cómo te atreves a volver (oh-oh)<br>Y a tus cenizas convertir en fuego<br>Hoy mis mentiras veo caer<br>Que no es verdad que te olvidé<br>¿Cómo te atreves a volver?<br><br>Oh-oh-oh-ooh, oh-oh-oh-oh-oh-ooh<br>Oh-oh-oh-oh-oh-ooh (oh-ooh)<br>Oh-oh-oh-ooh, oh-oh-oh-oh-oh-ooh<br>Oh-oh-oh-oh-oh-ooh (no, no, no)<br><br>¿Cómo te atreves a volver?<br>Me hiciste daño, pero sigo vivo<br>Contigo, yo me acostumbré a perder<br>Mi corazón funciona sin latidos (no)<br><br>Cómo te atreves a volver (¿cómo te atreves a volver?)<br>Y a tus cenizas convertir en fuego (en fuego)<br>Hoy mis mentiras veo caer<br>Que no es verdad que te olvidé<br>¿Cómo te atreves a volver? (¡Oh!)<br><br>Oh-oh-oh-ooh, oh-oh-oh-oh-oh-ooh<br>¿Cómo te atreves a volver? (Oh-oh-ooh)<br>¿Cómo te atreves a volver? (Oh-oh-oh-ooh)<br>Oh-oh-oh-oh-oh-ooh (no, no, no)"},
  { title: "SOLO AMIGOS", artist: "Adexe y Nau", cover: "https://images.genius.com/ea89db66f1b4f18e011613e093611da1.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748951/Solo_amigos_-_Adexe_y_Nau_Letra_lyrics_wmuawk.m4a", moods: ['romanticas'] ,
    lyrics: "Ella no comprende que yo solamente<br>Quiero ser su amigo y luego se enfada conmigo<br>Ella no comprende que yo solamente<br>Quiero ser su amigo y parecemos enemigos<br><br>Ella no comprende que yo solamente<br>Quiero ser su amigo y luego se enfada conmigo<br>Ella no comprende que yo solamente<br>Quiero ser su amigo y parecemos enemigos<br><br>Solo le pido<br>Que comprenda, que aunque se que lo intenta<br>Lo único que vamos a tener serán tormentas<br>Si sigue en reprimenda, para que lo entienda<br>Nuestro cariño de niños chiquitos esta sobre una cuerda<br><br>Ya lo vez, todo esta al revés<br>Lo único que yo he querido es que estemos bien<br>Simplemente todo esta en tu mente<br>Me gusta estar contigo pero diferente<br><br>Ella no comprende que yo solamente<br>Quiero ser su amigo y luego se enfada conmigo<br>Ella no comprende que yo solamente<br>Quiero ser su amigo y parecemos enemigos<br><br>Ella me pide algo más<br>Pero yo no se lo puedo dar<br>Yo no me hago de rogar<br>Solo puedo darle mi amistad<br><br>Me hace alucinar, esa forma de hablar<br>La autoridad con la que cuenta otra realidad<br>Y no es verdad, jamás yo dije que te iba besar<br>La fantasía en que vives hoy te hace soñar<br><br>No quiero engañarte, no quiero ofenderte<br>Pero tan solo es obsesión lo que tu sientes<br>No quiero olvidarte, no quiero perderte<br>Por eso acepta mi amistad que es para siempre<br><br>Ella no comprende que yo solamente<br>Quiero ser su amigo y luego se enfada conmigo<br>Ella no comprende que yo solamente<br>Quiero ser su amigo y parecemos enemigos<br><br>Ella me pide algo más<br>Pero yo no se lo puedo dar<br>Yo no me hago de rogar<br>Solo puedo darle mi amistad<br><br>Ella no me comprende que yo<br>Solo quiero ser su amigo<br>Es lo único que pido siempre me pide<br>Algo más o si no seré su enemigo<br><br>Solo quiero darle mi amistad, no lo quiere ver<br>Cuando termino de explicarle, me vuelvo loco<br>Otra vez con lo mismo, vamos ahora mismo<br>Y sin pensarlo estas rozando el egoísmo<br><br>Va comentado<br>A mis amigos como si fuera inocente<br>Diciéndole que yo, soy un delincuente<br>Ten lo presente, yo soy muy diferente<br>Si tu tienes duda alguna, ve y pregúntale a mi gente<br><br>Ella no comprende que yo solamente<br>Quiero ser su amigo y luego se enfada conmigo<br>Ella no comprende que yo solamente<br>Quiero ser su amigo y parecemos enemigos<br><br>Ella no comprende que yo solamente<br>Quiero ser su amigo y luego se enfada conmigo<br>Ella no comprende que yo solamente<br>Quiero ser su amigo y parecemos enemigos<br><br>Ella me pide algo más<br>Pero yo no se lo puedo dar<br>Yo no me hago de rogar<br>Solo puedo darle mi amistad<br><br>(Solo amigos) (si)"},
  { title: "THERE'S NOTHING HOLDING ME BACK", artist: "Shawn Mendes", cover: "https://cdn-images.dzcdn.net/images/cover/3e2d3bad308509ecc59dc6de76ac7896/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748952/Shawn_Mendes_There_s_Nothing_Holding_Me_Back_Lyrics_e3lpar.m4a", moods: ['animadas'] ,
    lyrics: "I wanna follow where she goes<br>I think about her and she knows it<br>I wanna let her take control<br>'Cause every time that she gets close, yeah<br><br>She pulls me in enough to keep me guessing, hmmm<br>Maybe I should stop and start confessing<br>Confessing, yeah<br><br>Oh, I've been shaking<br>I love it when you go crazy<br>You take all my inhibitions<br>Baby, there's nothing holdin' me back<br>You take me places that tear up my reputation<br>Manipulate my decisions<br><br>Baby, there's nothing holdin' me back<br>There's nothing holdin' me back<br>There's nothing holdin' me back<br><br>She says that she's never afraid<br>Just picture everybody naked<br>She really doesn't like to wait<br>Not really into hesitation<br><br>Pulls me in enough to keep me guessing, whoa<br>And maybe I should stop and start confessing<br>Confessing, yeah<br><br>Oh, I've been shaking<br>I love it when you go crazy<br>You take all my inhibitions<br>Baby, there's nothing holdin' me back<br>You take me places that tear up my reputation<br>Manipulate my decisions<br><br>Baby, there's nothing holdin' me back<br>There's nothing holdin' me back<br><br>'Cause if we lost our minds, and we took it way too far<br>I know we'd be alright, know we would be alright<br>If you were by my side, and we stumbled in the dark<br>I know we'd be alright, I know we would be alright<br><br>'Cause if we lost our minds, and we took it way too far<br>I know we'd be alright, I know we would be alright<br>If you were by my side, and we stumbled in the dark<br>I know we'd be alright, we would be alright<br><br>Oh, I've been shaking<br>I love it when you go crazy<br>You take all my inhibitions<br>Baby, there's nothing holdin' me back<br>You take me places that tear up my reputation<br>Manipulate my decisions<br>Baby, there's nothing holdin' me back<br>There's nothing holdin' me back<br>I feel so free when you're with me, baby<br>Baby, there's nothing holdin' me back"},
  { title: "save your tears", artist: "The Weeknd", cover: "https://cdn-images.dzcdn.net/images/cover/4acc3760e12996fe21a77115fc67760b/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748955/The_Weeknd_-_Save_Your_Tears_Official_Music_Video_ed2oy0.m4a", moods: ['relajantes'] ,
    lyrics: "Ooh<br>Na na, yeah<br><br>I saw you dancing in a crowded room<br>You look so happy when I'm not with you<br>But then you saw me, caught you by surprise<br>A single teardrop falling from your eye<br><br>I don't know why I run away<br>I'll make you cry when I run away<br><br>You could've asked me why I broke your heart<br>You could've told me that you fell apart<br>But you walked past me like I wasn't there<br>And just pretended like you didn't care<br><br>I don't know why I run away<br>I'll make you cry when I run away<br><br>Take me back 'cause I wanna stay<br>Save your tears for another<br>Save your tears for another day<br>Save your tears for another day<br><br>So, I made you think that I would always stay<br>I said some things that I should never say<br>Yeah, I broke your heart like someone did to mine<br>And now you won't love me for a second time<br><br>I don't know why I run away, oh, girl<br>Said I'll make you cry when I run away<br><br>Girl, take me back 'cause I wanna stay<br>Save your tears for another<br>I realize that I'm much too late<br>And you deserve someone better<br>Save your tears for another day (ooh, yeah)<br>Save your tears for another day (yeah)<br><br>I don't know why I run away<br>I'll make you cry when I run away<br><br>Save your tears for another day, ooh, girl (ah)<br>I said save your tears for another day (ah)<br>Save your tears for another day (ah)<br>Save your tears for another day (ah)"},
  { title: "Indeciso", artist: "Reik, J Balvin, Lalo Ebratt", cover: "https://m.media-amazon.com/images/I/51pJA4vGKvL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748956/Reik_J_Balvin_Lalo_Ebratt_-_Indeciso_Letra_lqpkqv.m4a", moods: ['romanticas','animadas'] ,
    lyrics: "J Balvin, man<br>Lalo Ebratt (su movimiento me tiene indeciso)<br>Reik, leggo'<br>(Leggo')<br><br>Siempre que ella baila así<br>A mí me daña la cabeza<br>El día que la conocí<br>Tomaba tequila y cerveza<br><br>Y ahora yo me la paso buscando<br>Una razón pa' verte bailando<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso<br><br>Siempre que ella baila así<br>A mí me daña la cabeza<br>El día que la conocí<br>Tomaba tequila y cerveza<br><br>Y ahora yo me la paso buscando<br>Una razón pa' verte bailando<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso<br><br>Por esas caderas yo estoy indeciso<br>Su movimiento me tiene indeciso<br><br>De todita las relaciones<br>Contigo nunca voy a excepciones<br>Pero hay alguien que está en esta fiesta<br>Cuánto me cuesta verla otra vez<br><br>Tú eres mi Dua Lipa<br>Suelta, mami, tú sabes que estas bien rica<br>Dándole hasta abajo, ella no se quita<br>Perfume de Chanel, ella rompe con su Flex<br>Y le da<br><br>A ella le gusta que la miren (la miren)<br>Parece modelo de cine (de cine)<br>Ella lo sabe y yo me le acerqué<br>Porque sabe que estamos PPP<br><br>A ella le gusta que la miren (la miren)<br>Parece modelo de cine (de cine)<br>Ella lo sabe y yo me le acerqué<br>Porque sabe que estamos PPP<br>Yeh‚ yeh‚ yeh<br><br>Siempre que ella baila así<br>A mí me daña la cabeza<br>El día que la conocí<br>Tomaba tequila y cerveza<br><br>Y ahora yo me la paso buscando<br>Una razón pa' verte bailando<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso<br><br>Por esas caderas yo estoy indeciso<br>Su movimiento me tiene indeciso<br>Leggo'<br>Por esas caderas yo estoy indeciso<br>Su movimiento me tiene indeciso<br><br>Esa mirada me cautiva<br>Motiva, activa, así da'‚ que hace mal<br>Manda razones con tu amiga<br>Ya vi tu llamada perdida<br><br>Victoria, ella no es un secreto<br>Que tú a mí me gustas, que yo te comprendo<br>Dolce tus gafas, Gabbana, so sexy<br>Chanel tu perfume (tú siempre estas trending)<br><br>Sofía, tú no le digas a Lucia<br>Que la otra noche yo estuve viendo a María<br>No confía ni en su mejor amiga<br>Nadie me baila como ella me bailaría<br><br>Siempre que ella baila así (así)<br>A mí me daña la cabeza (¿cómo?)<br>El día que la conocí (latino gang)<br>Tomaba tequila y cerveza<br><br>Y ahora yo me la paso buscando<br>Una razón pa' verte bailando<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso<br><br>Nunca bajamos los niveles (por esas caderas)<br>Mango (yo estoy indeciso)<br>Tropical Minds (su movimiento me tiene indeciso)<br>2030 y pico (J Balvin, man)<br>L-A-L-O (Lalo Ebratt)<br>Vomitando flow (Reik)<br>Su movimiento me tiene indeciso (el negocio, socio)"},
  { title: "La Mordidita", artist: "Ricky Martin", cover: "https://i.scdn.co/image/ab67616d0000b27388d450740b559cabdde15d35", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748957/Ricky_Martin_-_La_Mordidita_ft._Yotuel_Letra_vgdin6.m4a", moods: ['animadas'] ,
    lyrics: "Sonó la campana y el fin de semana se deja ver<br>Vestido, de traje, lujuria salvaje bajo mi piel<br>Si Dios puso la manzana fue para morder<br>Ay, Dios, pequemo' abrazaditos hasta el amanecer<br><br>Llegó la fiesta pa' tu boquita<br>Toda la noche, todito el día<br>Vamo' a bañarnos en la orillita<br>Que la marea está pica'ita-ita-ita<br><br>Una mordidita, una mordidita<br>Una mordidita, de tu boquita<br>Una mordidita, una mordidita<br>Una mordidita, de tu boquita<br><br>Tus labios, mis dientes, bocado crujiente, rico pastel<br>Fuego en tus pupilas, tu cuerpo destila tequila y miel<br>Si Dios puso la manzana fue para morder<br>Ay, Dios, quedemo' abrazaditos hasta el amanecer<br><br>Llegó la fiesta pa' tu boquita<br>Toda la noche, todito el día<br>Vamo' a bañarnos en la orillita<br>Que la marea está pica'ita-ita-ita<br><br>Una mordidita, una mordidita<br>Una mordidita, de tu boquita<br>Una mordidita, una mordidita<br>Una mordidita, de tu boquita<br><br>Quiero pensar, que no eres real<br>Me parece natural, letal, así te pones a bailar<br>No te pones freno cuando te pones a sudar<br>Vamo' a lo low, para sentir tu flow<br>Pa' enseñarte niña, pa' llamar la atención<br>Te mantiene en tensión, sin bajar la presión<br>El sudor tiene cura pa' frenar la tensión<br><br>Dé-ja-me moderte, estoy vampiro bien demente<br>Dé-ja-me moderte, en el oscuro y sin la gente<br>Dé-ja-me moderte, bien despacito y bruscamente<br>Dé-ja-me moderte, amarradito bien demente<br><br>Llegó la fiesta pa' tu boquita<br>Toda la noche, todito el día<br>Vamo' a bañarnos en la orillita<br>Que la marea está pica'ita-ita-ita<br><br>Una mordidita, una mordidita<br>Una mordidita, de tu boquita<br>Una mordidita, una mordidita<br>Una mordidita<br>Está pica'ita-ita-ita<br>Está pica'ita-ita-ita<br><br>Llegó la fiesta pa' tu boquita<br>Toda la noche, todito el día<br>Vamo' a bañarnos en la orillita<br>Que la marea está pica'ita-ita-ita"},
  { title: "Vente Pa' Ca", artist: "Ricky Martin", cover: "https://i.scdn.co/image/ab67616d0000b273a7009065e3adf3430e04f63a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748958/Ricky_Martin_-_Vente_Pa__Ca_ft._Maluma_Letra_Lyrics_bplzdf.m4a", moods: ['animadas'] ,
    lyrics: "Ven, te cuento de una vez<br>Tu descanso está en la cama de mis pies<br>Ven, te cuento un, dos, tres<br>Mis pasitos son descalzos, sin estrés<br><br>Dime si hay otro lugar<br>Para dejar mi corazón (mi corazón)<br>Ay, tienes razón<br>Mejor, ¿por qué no nos vamos los dos?<br><br>Si tú quieres, nos bañamos<br>Si tú quieres, nos soplamos pa' secarnos lo mojado<br>Si tu boca quiere beso<br>Y tu cuerpo quiere de eso, arreglamos<br><br>Si tú quieres un atajo y lo quieres por abajo<br>Yo te llevo bien callado<br>Vente pa' ca, vente pa' ca<br>Vente pa' ca<br><br>Enamorados, ¡qué calor!<br>Nos comimos boca a boca en el sillón<br>Fue por hambre, fue por sed<br>Me bebiste a fondo blanco con tu piel<br><br>Dime si hay otro lugar<br>Para dejar mi corazón (mi corazón)<br>Ay, tienes razón<br>Mejor, ¿por qué no nos vamos los dos?<br><br>Si tú quieres, nos bañamos<br>Si tú quieres, nos soplamos pa' secarnos lo mojado<br>Si tu boca quiere beso<br>Y tu cuerpo quiere de eso, arreglamos<br><br>Si tú quieres un atajo y lo quieres por abajo<br>Yo te llevo bien callado<br>Vente pa' ca, vente pa' ca<br>Vente pa' ca<br><br>(Alright, alright, baby)<br>(Pretty Boy, Dirty Boy, baby)<br><br>Cómo me baila y me seduce<br>Cuando le apagan las luces<br>Ella se luce<br>Y yo se lo hago otra vez (otra vez)<br><br>Llevo tanto tiempo mirando reaccionar<br>Dime qué estás esperando, baby, no hay demora<br>Pégate a mí, bien rico a mí<br>No dejes que pasen las horas<br><br>Tu booty me arrebata, tu sonrisa me atrapa<br>Quiero tenerte siempre y no dejarte sola<br>Esta historia no se acaba, ven, vamos pa' mi cama<br>Esta noche, tú te enamoras<br><br>Dime de una vez<br>Si es que al lado tuyo yo estaré<br>Todo lo que pidas, te daré<br>Esta noche, tú te enamoras<br><br>Si tú quieres, nos bañamos<br>Si tú quieres, nos soplamos pa' secarnos lo mojado<br>Si tu boca quiere beso<br>Y tu cuerpo quiere de eso, arreglamos<br><br>Si tú quieres un atajo y lo quieres por abajo<br>Yo te llevo bien callado<br>Vente pa' ca, vente pa' ca<br>Vente pa' ca<br><br>Vente pa' ca, vente pa' ca<br>Vente pa' ca"},
  { title: "Umbrella", artist: "Rihanna", cover: "https://cdn-images.dzcdn.net/images/cover/91276466fbc876d96be9e6926060af60/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748960/Rihanna_Umbrella_Orange_Version_Official_Music_Video_ft_JAY_Z_fpihd1.m4a", moods: ['animadas'] ,
    lyrics: "Uh, huh, uh, huh (yeah, Rihanna)<br>Uh, huh, uh, huh (good girl gone bad)<br>Uh, huh, uh, huh (take three, action)<br>Uh, huh, uh, huh (Hov)<br><br>No clouds in my stones<br>Let it rain, I hydroplane in the bank (eh, eh, eh)<br>Coming down with the Dow Jones<br>When the clouds come, we gone, we Roc-A-Fella (eh, eh, eh, eh)<br>We fly higher than weather, in G5's or better<br>You know me<br>In anticipation for precipitation stack chips for the rainy day (eh, eh, eh)<br>Jay, Rain Man is back (eh, eh, eh)<br>With little Ms. Sunshine, Rihanna, where you at?<br><br>You have my heart<br>And we'll never be worlds apart<br>May be in magazines<br>But you'll still be my star<br>Baby, 'cause in the dark<br>You can't see shiny cars<br>And that's when you need me there<br>With you I'll always share<br><br>Because<br>When the Sun shine, we shine together<br>Told you I'll be here forever<br>Said I'll always be your friend<br>Took an oath, I'ma stick it out to the end<br>Now that it's raining more than ever<br>Know that we'll still have each other<br>You can stand under my umbrella<br>You can stand under my umbrella<br><br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh, eh, eh, eh<br><br>These fancy things<br>Will never come in between<br>You're part of my entity<br>Here for infinity<br>When the war has took its part<br>When the world has dealt its cards<br>If the hand is hard<br>Together we'll mend your heart<br><br>Because<br>When the Sun shine, we shine together<br>Told you I'll be here forever<br>Said I'll always be your friend<br>Took an oath, I'ma stick it out to the end<br>Now that it's raining more than ever<br>Know that we'll still have each other<br>You can stand under my umbrella<br>You can stand under my umbrella<br><br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh, eh, eh, eh<br><br>You can run into my arms<br>It's okay, don't be alarmed<br>Come into me<br>There's no distance in between our love<br>So go on and let the rain pour<br>I'll be all you need and more, oh<br><br>Because<br>When the Sun shine, we shine together<br>Told you I'll be here forever<br>Said I'll always be your friend<br>Took an oath, I'ma stick it out to the end<br>Now that it's raining more than ever<br>Know that we'll still have each other<br>You can stand under my umbrella<br>You can stand under my umbrella<br><br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh<br>Under my umbrella<br>Ella, ella, eh, eh, eh, eh, eh, eh<br><br>It's rainin', rainin'<br>Ooh, baby, it's rainin', rainin'<br>Baby, come here to me<br>Come into me<br>It's rainin', rainin'<br>Ooh, baby, it's rainin', rainin'<br>You can always come into me<br>Come into me<br>It's pourin' rain<br>It's pourin' rain<br>Come here to me<br>Come into me"},
  { title: "APT.", artist: "ROSÉ, Bruno Mars", cover: "https://m.media-amazon.com/images/I/51vAIGPAURL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748961/ROSE%CC%81_Bruno_Mars_-_APT._Official_Music_Video_ydbvc7.m4a", moods: ['animadas'] ,
    lyrics: "채영이가 좋아하는chaeyeong-iga joahaneun<br>랜덤 게임raendeom geim<br>랜덤 게임raendeom geim<br>Game startGame start<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br><br>Kissy face, kissy faceKissy face, kissy face<br>Sent to your phone, butSent to your phone, but<br>I'm tryna kiss your lips for real (uh-huh, uh-huh)I'm tryna kiss your lips for real (uh-huh, uh-huh)<br>Red hearts, red heartsRed hearts, red hearts<br>That's what I'm on, yeahThat's what I'm on, yeah<br>Come give me somethin' I can feel, oh-oh-ohCome give me somethin' I can feel, oh-oh-oh<br><br>Don't you want me like I want you, baby?Don't you want me like I want you, baby?<br>Don't you need me like I need you now?Don't you need me like I need you now?<br>Sleep tomorrow, but tonight, go crazySleep tomorrow, but tonight, go crazy<br>All you gotta do is just meet me at theAll you gotta do is just meet me at the<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br><br>It's whatever (whatever), it's whatever (whatever)It's whatever (whatever), it's whatever (whatever)<br>It's whatever (whatever) you like (woo)It's whatever (whatever) you like (woo)<br>Turn this 아파트 into a club (uh-huh, uh-huh)Turn this apateu into a club (uh-huh, uh-huh)<br>I'm talkin' drink, dance, smoke, freak, party all night (come on)I'm talkin' drink, dance, smoke, freak, party all night (come on)<br>건배, 건배, girl, what's up? Oh-oh-ohgeonbae, geonbae, girl, what's up? Oh-oh-oh<br><br>Don't you want me like I want you, baby?Don't you want me like I want you, baby?<br>Don't you need me like I need you now?Don't you need me like I need you now?<br>Sleep tomorrow, but tonight, go crazySleep tomorrow, but tonight, go crazy<br>All you gotta do is just meet me at theAll you gotta do is just meet me at the<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br><br>Hey, so now you know the gameHey, so now you know the game<br>Are you ready?Are you ready?<br>'Cause I'm comin' to get ya, get ya, get ya'Cause I'm comin' to get ya, get ya, get ya<br><br>Hold on, hold onHold on, hold on<br>I'm on my wayI'm on my way<br>Yeah, yeah, yeah-yeah, yeahYeah, yeah, yeah-yeah, yeah<br>I'm on my wayI'm on my way<br><br>Hold on, hold onHold on, hold on<br>I'm on my wayI'm on my way<br>Yeah, yeah, yeah-yeah, yeahYeah, yeah, yeah-yeah, yeah<br>I'm on my wayI'm on my way<br><br>Don't you want me like I want you, baby?Don't you want me like I want you, baby?<br>Don't you need me like I need you now?Don't you need me like I need you now?<br>Sleep tomorrow, but tonight, go crazySleep tomorrow, but tonight, go crazy<br>All you gotta do is just meet me at theAll you gotta do is just meet me at the<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Just meet me at the (uh-huh, uh-huh)Just meet me at the (uh-huh, uh-huh)<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Just meet me at the (uh-huh, uh-huh)Just meet me at the (uh-huh, uh-huh)<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Just meet me at the (uh-huh, uh-huh)Just meet me at the (uh-huh, uh-huh)<br><br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>아파트, 아파트apateu, apateu<br>Uh, uh-huh, uh-huhUh, uh-huh, uh-huh<br>"},
  { title: "Flashes", artist: "RØZ Yng Lvcas", cover: "https://i1.sndcdn.com/artworks-aRMFevdQLRYYTTXi-IRfYkw-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748962/R%C3%98Z_Yng_Lvcas_-_flashes_zvoqsg.m4a", moods: ['animadas'] ,
    lyrics: "Hey, ay<br>Me calma<br>Me calma<br>Me calma<br><br>Me calma cuando su efecto me abraza<br>Baby, un tiro de gracia<br>Flashes de película<br>Humo en forma de su carita<br>Niñas en la mesa anónimas<br>Qué loquera<br>Una bolsa exótica<br>Tacones y un flow de gótica<br>Pelo largo y curva sólida<br><br>Me tiene mal no verte más<br>Es mágica, classy Cadillac<br>Quiere sativa, polvito de jar<br>Rosa y lavada mi saliva<br>Bolsita cara y nada más<br>Flashes de películas<br><br>Flashes de película<br>Muñeca' que no son tímidas<br>En mi cabeza billetiza<br>Hielo y stars, cuerno y scars<br>Flashes de película<br>Muñecas que no son tímidas<br>En mi cabeza billetiza<br>Hielo y stars, cuerno y scars<br><br>She like my style, she like my swag<br>Flow mamba, mucho design<br>Wuh, skrrt<br>She like my style, she like my swag<br>Flow mamba, mucho design<br>Chico de ice, never lie<br>¿Tú y quién más?<br>Ja-ja-ja-ja, shake that ass<br>Need a Myers, so can fly<br>Dudo que me puedan dar<br>Soy gente, está comprobao<br>Estoy aquí, no me canso de ser mí<br><br>Pásame el gallo<br>La champán me está explotando<br>Hago lo que otros pensando<br>Pienso lo que otros ni en cuadros<br>Respeto el cuidado malo<br>Me mata el que ande robando<br>Soy gente, está comprobado<br>Estoy aquí, no me canso de ser mí<br>Pásame el gallo<br>La champán me está explotando<br>Flashes de película-a-as (skrrt)<br><br>Flashes de película<br>Muñecas que no son tímidas<br>En mi cabeza billetiza<br>Hielo y stars, cuerno y scars<br>Flashes de película<br>Muñecas que no son tímidas<br>En mi cabeza billetiza<br>Hielo y stars, cuerno y scars"},
  { title: "Despechá", artist: "ROSALÍA", cover: "https://i.scdn.co/image/ab67616d0000b273938660520f09a1bae2ed4699", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748973/ROSAL%C3%8DA_-_DESPECH%C3%81_Official_Video_ehc9gl.m4a", moods: ['animadas'] ,
    lyrics: "Yeah, yeah<br>Yeah, yeah<br>Mmm<br><br>Baby, no me llame'<br>Que yo estoy ocupá' olvidando tus male'<br>Ya decidí que esta noche se sale<br>Con toa' mis motomami', con toda' mis gyales<br><br>Y ando despechá', oah, alocá'<br>Bajé con un flow nuevo de caja, baby, hackeá'<br>Lo muevo de la'o a la'o, y a otro la'o<br>Hoy salgo con mi baby de la disco coroná'<br><br>Y ando despechá', oah, alocá'<br>Que Dios me libre de volver a tu la'o<br>Lo muevo de la'o a la'o, y a otro la'o<br>Hoy salgo con mi baby de la disco coroná', coroná', yeah<br><br>Voy con la falda, aro' y cadena' (eh)<br>Piña colada (sí), no tengo pena (ah, no)<br>Estoy con la Fefa, ella es la jеfa (sí)<br>Ella lo baila (eh), ella me ensеña (eh)<br>Hoy no trabajo (uh), estoy morena<br>Fuck la fama (eh), fuck la faena (jaja)<br>La noche es larga (eh), la noche está buena (eh)<br>Un mambo violento y fin del problema<br><br>Mira qué fácil, te lo voy a decir<br>A, B, C, one, two, three<br>Mira qué fácil te lo voy a decir<br>Que esta motomami ya no está pa' ti<br>Mira qué fácil te lo voy a decir<br>A, B, C, one, two, three<br><br>Mira qué fácil te lo voy a decir<br>Que esta motomami—<br><br>Y an—, y ando despechá', oah, alocá'<br>Bajé con un flow nuevo de caja, baby, hackeá'<br>Lo muevo de la'o a la'o, y a otro la'o<br>Hoy salgo con mi baby de la disco coroná'<br><br>Y ando despechá', oah, alocá'<br>Que Dios me libre de volver a tu la'o<br>Lo muevo de la'o a la'o, y a otro la'o<br>Hoy salgo con mi baby de la disco coroná', coroná', yeah<br><br>Mmm, voy a 180 porque soy una racineta<br>¿Qué, qué?<br>Te distrae' y ya te adelanté por la derecha<br>Uh<br><br>Voy a 180 porque soy una racineta<br>Ey, ey<br>Te distrae' y ya te adelanté por la derecha<br>Mmm, mmm, mmm<br><br>Yeah-yeah-yeah, yeah-yeah-yeah<br>Ey<br>Yeah-yeah-yeah-yeah<br>Chris Jedi<br>Gaby, Gaby, Gaby<br>De Barcelona pa' Santo Domingo<br>La ROSALÍA, mmm, jaja, je<br>Jeje<br>Ey<br>Uh, uh, uh, uh<br>Omega<br>Ey, ey, ey<br>Uh, uh, uh, uh"},
  { title: "Supernova", artist: "SAIKO", cover: "https://i.scdn.co/image/ab67616d0000b273c3f5b9580dfc96c80705424a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748974/SAIKO_-_SUPERNOVA_Official_Video___SAKURA_kiwn0u.m4a", moods: ['animadas'] ,
    lyrics: "(Begin)<br><br>... Cuando miro en tus ojos,<br>cuando le miento a Dios,<br>sigo quemando infinitos,<br>es nuestro fuego esta pasión,<br>ligero iva de prisa,<br>pensaba solo en llegar,<br>vida querida tan mal vivida,<br><br>(Chorus)<br>Este es nuestro gran delirio,<br>este es nuetro bien también el mal,<br>caeré caeré, caeré sin perder,<br>el juicio,<br>el lenguaje puede herirnos,<br>un amor distante y natural,<br>caeré caeré, caeré sin perder,<br>este es nuetro bien también el mal,<br><br>Cuando miro en tus ojos,<br>cuando le miento a Dios,<br>es necesario prácticas nuevas,<br>personas con otra visión,<br>ligero iva de prisa,<br>pensaba solo en llegar,<br>(aah) abrí la puerta y hoy te veo,<br><br>Partire con dolores delirantes,<br>yo seré el bien también el mal,<br>caeré caeré, caeré sin perder,<br>el jucio,<br>el lenguaje puede herirnos,<br>un amor distante y natural,<br>caeré caeré, caeré sin perder,<br>este es nuestro bien también el mal,<br><br>(Chorus)<br>Este es nuestro gran delirio,<br>este es nuetro bien también el mal,<br>caeré caeré, caeré sin perder,<br>el juicio,<br>el lenguaje puede herirnos,<br>un amor distante y natural,<br>caeré caeré, caeré sin perder,<br>este es nuetro bien también el mal,<br><br>Chari lari lari, ay ay ay (ay)<br>Chari lari lari, ay ay ay (ay)<br>Chari lari lari, ay ay ay (ay)<br>Chari lah, chari aah<br><br>Cuando miro en tus ojos (cuando miro en tus ojos),<br>cuando le miento a... Dioooos (cuando le miento a Dios),<br><br>Cuando miro en tus ojos (cuando miro en tus ojos),<br>cuando le miento a... Dioooooooooos (cuando le miento a Dios),<br><br>(ending...)"},
  { title: "Without Me", artist: "Eminem", cover: "https://m.media-amazon.com/images/I/819VvnW1QZL._UF894,1000_QL80_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748976/Eminem_-_Without_Me_Lyrics_rbyen5.m4a", moods: ['animadas'] ,
    lyrics: "(In five, four, three, two, one)<br><br>Obie Trice, real name, no gimmicks<br><br>Two trailer park girls go 'round the outside<br>'Round the outside, 'round the outside<br>(Marshall, we've got a bogey)<br>(I'm on the way)<br>Two trailer park girls go round the outside<br>'Round the outside, 'round the outside<br><br>Guess who's back<br>Back again<br>Shady's back<br>Tell a friend<br><br>Guess who's back, guess who's back<br>Guess who's back, guess who's back<br>Guess who's back, guess who's back<br>Guess who's back<br><br>I've created a monster<br>'Cause nobody wants to see Marshall no more<br>They want Shady, I'm chopped liver<br>Well, if you want Shady, this what I'll give ya<br>A little bit of weed mixed with some hard liquor<br>Some vodka that'll jump-start my heart quicker<br>Than a shock when I get shocked at the hospital<br>By the doctor when I'm not co-operating<br>When I'm rocking the table while he's operating (hey!)<br><br>You waited this long, now stop debating<br>'Cause I'm back, I'm on the rag and ovulating<br>I know that you got a job, Ms. Cheney<br>But your husband's heart problem's complicating<br>So the FCC won't let me be<br>Or let me be me, so let me see<br>They try to shut me down on MTV<br>But it feels so empty without me<br>So come on and dip, bum on your lips<br>Jump back, jiggle a hip and wiggle a bit<br>And get ready, 'cause this shit's about to get heavy<br>I just settled all my lawsuits<br>Fuck you, Debbie!<br><br>Now this looks like a job for me<br>So everybody just follow me<br>'Cause we need a little controversy<br>'Cause it feels so empty without me<br><br>I said this looks like a job for me<br>So everybody, just follow me<br>'Cause we need a little controversy<br>'Cause it feels so empty without me<br><br>Little hellions, kids feeling rebellious<br>Embarrassed, their parents still listen to Elvis<br>They start feeling like prisoners, helpless<br>'Til someone comes along on a mission and yells: Bitch!<br><br>A visionary, vision is scary<br>Could start a revolution, polluting the airwaves<br>A rebel, so just let me revel and bask<br>In the fact that I got everyone kissing my ass<br>And it's a disaster, such a catastrophe<br>For you to see so damn much of my ass, you asked for me?<br>Well, I'm back (na-na-na-na-na-na-na-na-na-na)<br>Fix your bent antenna, tune it in, and then I'm gonna<br>Enter in and up under your skin like a splinter<br>The center of attention, back for the winter<br>I'm interesting, the best thing since wrestling<br>Infesting in your kid's ears and nesting<br><br>Testing: Attention, please<br>Feel the tension soon as someone mentions me<br>Here's my ten cents, my two cents is free<br>A nuisance, who sent? You sent for me?<br><br>Now this looks like a job for me<br>So everybody just follow me<br>'Cause we need a little controversy<br>'Cause it feels so empty without me<br><br>I said this looks like a job for me<br>So everybody, just follow me<br>'Cause we need a little controversy<br>'Cause it feels so empty without me<br><br>A tisk-it a task-it, I'll go tit-for-tat with<br>Anybody who's talking this shit and that shit<br>Chris Kirkpatrick, you can get your ass kicked<br>Worse than them little Limp Bizkit bastards<br>And Moby? You can get stomped by Obie<br>You thirty-six-year-old bald headed fag, blow me<br>You don't know me, you're too old, let go<br>It's over, nobody listens to techno<br>Now let's go, just give me the signal<br>I'll be there with a whole list full of new insults<br>I've been dope, suspenseful with a pencil<br>Ever since Prince turned himself into a symbol<br><br>But, sometimes, the shit just seems<br>Everybody only wants to discuss me<br>So this must mean I'm disgusting<br>But it's just me, I'm just obscene<br>Though I'm not the first king of controversy<br>I am the worst thing since Elvis Presley<br>To do black music so selfishly<br>And use it to get myself wealthy (hey)<br>There's a concept that works<br>Twenty million other white rappers emerge<br>But no matter how many fish in the sea<br>It'd be so empty without me<br><br>Now this looks like a job for me<br>So everybody just follow me<br>'Cause we need a little controversy<br>'Cause it feels so empty without me<br><br>I said this looks like a job for me<br>So everybody just follow me<br>'Cause we need a little controversy<br>'Cause it feels so empty without me<br><br>Kids!"},
  { title: "Beauty and a Beat", artist: "Justin Bieber", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsKPNxCtWtPm7_d468VnoWxPSBsOyZk67HcA&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748977/Justin_Bieber_Beauty_And_A_Beat_Official_Music_Video_ft_Nicki_Minaj_ivdtfp.m4a", moods: ['animadas'] ,
    lyrics: "Yeah<br>Young Money<br>Nicki Minaj<br>Justin<br><br>Show you off<br>Tonight I wanna show you off<br>(Ayy, ayy, ayy)<br>What you got<br>A billion could've never bought<br>(Ayy, ayy, ayy)<br><br>We gonna party like it's 3012 tonight<br>I wanna show you all the finer things in life<br>So just forget about the world, we young tonight<br>I'm coming for ya, I'm coming for ya<br><br>'Cause all I need<br>Is a beauty and a beat<br>Who can make my life complete<br>It's all 'bout you<br>When the music makes you move<br>Baby, do it like you do<br>'Cause you<br><br>Body rock<br>Girl, I can feel your body rock<br>(Ayy, ayy, ayy)<br>Take a bow<br>You're on the hottest ticket now<br>Ooh (ayy, ayy, ayy)<br><br>We gonna party like it's 3012 tonight<br>I want to show you all the finer things in life<br>So just forget about the world, we young tonight<br>I'm coming for ya, I'm coming for ya<br><br>'Cause all I need<br>Is a beauty and a beat<br>Who can make my life complete<br>It's all 'bout you<br>When the music makes you move<br>Baby, do it like you do (ahn)<br>'Cause you (ahn)<br><br>In time, ink lines<br>Bitches couldn't get on my incline<br>World tours, it's mine<br>Ten little letters on a big sign<br>Justin Bieber<br>You know I'ma hit 'em with the ether<br>Buns out, wiener<br>But I gotta keep an eye out for Selener<br><br>Beauty, Beauty and the Beast<br>Beauty from the East<br>Beautiful confessions of the priest<br>Beast, beauty from the streets<br>Beat will get deceased<br>Every time Beauty on the beat eats<br><br>Body rock (yeah, yeah)<br>Oh (yeah, yeah)<br>I wanna feel your body rock (let's go, let's go)<br><br>'Cause all I need (all I need is love)<br>Is a beauty and a beat (a beat)<br>Who can make my life complete (complete, oh, woah)<br>It's all 'bout you (all I need is you)<br>When the music makes you move<br>Baby, do it like you do (do)<br>'Cause you"},
  { title: "Fuego", artist: "Don Omar", cover: "https://i.musicaimg.com/letras/250x250/don-omar.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748984/Fuego_-_Una_Vaina_Loca_Ft._El_Potro_Alvarez_Official_Video_rp0xvr.m4a", moods: ['animadas'] ,
    lyrics: "Solo quería hacerte saber que<br>Quizás no es la mejor forma pero<br>Que de la misma forma que yo respete tu primer dia<br>Espero que tu también respetes que<br>Esta vez soy yo el que quiero irme y que solo espero que<br>Puedas reconocer y encontrarte un día contigo misma<br>Y que reconozcas una sola cosa<br>Que yo soy el único que te ha amado<br>Adiós<br><br>Adiós, me fui, lejos de ti<br>Nade en lo que llore, pero llegue<br>Solo quise antes de marcharme<br>Decirte que algún día, volveré a amar<br>Y si hasta ese día he de llorar<br>No sabrás de mi te lo puedo asegurar<br>Y si algún día las cosas andan mal<br>Y necesitas un hombro donde llorar<br>Podrás llamar<br><br>Quizás querrás que regrese<br>Y sera tarde ya<br>Sera tarde ya<br>Quizás querrás que regrese<br>Y sera tarde ya<br>Sera tarde ya<br><br>Adiós, me fui, lejos de ti<br>Nadie en lo que llore, pero llegue<br>Solo quise antes de marcharme<br>Decirte que algún día, volveré a amar<br>Y si hasta ese día he de llorar<br>No sabrás de mi te lo puedo asegurar<br>Y si algún día las cosas andan mal<br>Y necesitas un hombro donde llorar<br>Podrás llamar<br><br>Quizás querrás que regrese<br>Y sera tarde ya<br>Sera tarde ya<br>Quizás querrás que regrese<br>Y sera tarde ya<br>Sera tarde ya<br><br>Y yo reconozco una cosa que<br>Quizás pasara el tiempo<br>Y que no encuentre con quien compartir<br>Pero seguiré luchando<br>Pero a esta guerra tuya y mía<br>Ya no le puedo decir mas que si<br>Seguiré mi camino sige el tuyo<br>Adiós<br>(Sera tarde ya)<br>(Sera tarde ya)<br>(Sera tarde ya)<br>(Sera tarde ya)<br>(Sera tarde ya)<br>(Sera tarde ya)<br>(Sera tarde ya)<br><br>Eliel<br><br>Adiós"},
];

// ==========================================
// DEDUP — un mismo título + artista solo una vez
// (blinda el catálogo frente a duplicados históricos y futuros del admin)
// ==========================================
function dedupeSongs(list) {
  const seen = new Set();
  return list.filter(s => {
    const title = String(s.title || '').toLowerCase().trim();
    const artist = String(s.artist || '').toLowerCase().trim();
    const key = `${title}|${artist}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
SONGS_RECUERDAN.splice(0, SONGS_RECUERDAN.length, ...dedupeSongs(SONGS_RECUERDAN));
ALL_SONGS.splice(0, ALL_SONGS.length, ...dedupeSongs(ALL_SONGS));

/** Catálogo completo de canciones (semilla + las del Admin) — para otras secciones. */
export function getAllSongs() {
  return ALL_SONGS;
}

// ==========================================
// PLAYLIST DEFINITIONS
// ==========================================
function buildPlaylists(favorites) {
  const favSongs = ALL_SONGS.filter(s => favorites.has(s.title.toLowerCase()));
  const favRecuerdan = SONGS_RECUERDAN.filter(s => favorites.has(s.title.toLowerCase()));
  const allFavs = [...favRecuerdan, ...favSongs];

  return [
    { id: 'completas', name: 'Todas las canciones', icon: 'music', desc: 'Toda la biblioteca del hub', cover: null, songs: ALL_SONGS, count: ALL_SONGS.length },
    { id: 'recuerdan', name: 'Nuestras canciones', icon: 'heart', desc: 'Canciones que me recuerdan a ti', cover: null, songs: SONGS_RECUERDAN, count: SONGS_RECUERDAN.length },
    { id: 'favoritas', name: 'Favoritas', icon: 'star', desc: 'Las que más nos gustan', cover: null, songs: allFavs, count: allFavs.length },
    // Favoritas siempre existe (es una playlist individual, aunque esté vacía)
  ].filter(p => p.count > 0 || p.id === 'favoritas');
}

// ==========================================
// COVER FALLBACK — Gradient with initials
// ==========================================
function coverFallback(title) {
  const colors = [
    ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
    ['#fccb90', '#d57eeb'], ['#e0c3fc', '#8ec5fc'], ['#f5576c', '#ff6b35']
  ];
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const [c1, c2] = colors[hash % colors.length];
  const initials = title.replace(/[^a-zA-Z0-9 áéíóúñü]/g, '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  return `<span class="music-cover-fb" style="background:linear-gradient(135deg,${c1},${c2})">${initials}</span>`;
}

// ==========================================
// MAIN PAGE
// ==========================================
export function CancionesPage(router) {
  const page = document.createElement('div');
  page.className = 'canciones-page';

  // State
  let activePlaylistId = 'completas';
  let activeList = ALL_SONGS;
  let currentIdx = -1;
  let isPlaying = false;
  // Estado del layout tipo Spotify
  let activeFilter = null;       // { type: 'artist'|'cover'|'mood', value }
  let isCustomView = false;      // la lista activa es una playlist compartida
  let favMenuTitle = null;       // título de la canción con el menú ⋮ abierto
  let trackMenuKey = null;       // clave (título|artista) con el menú ⋮ abierto
  let deleteConfirmKey = null;   // clave de la canción pendiente de confirmar el borrado
  let playlistEditId = null;     // playlist personalizada en edición (modal)
  let picker = null;             // { key, mode: 'add'|'move', fromId }
  let plCardMenu = null;         // id de la playlist con su menú ⋮ abierto (tarjeta)
  let plIconSel = '❤️';          // icono seleccionado en el editor de playlist
  let plNameDraft = '';          // nombre en borrador del editor (no se pierde al elegir icono)
  let plPendingAdd = null;       // clave de canción a añadir tras crear una playlist
  let lyricsOpen = false;        // letra colapsada por defecto
  // Playlists compartidas (las crea cualquiera de los dos)
  let userPlaylists = [];        // [{ id, name, icon, songs: [claves] }]
  // Audio GLOBAL (player.service): sobrevive a re-renders y a la navegación.
  let audioEl = player.audio;
  let consecutiveErrors = 0; // guarda anti-bucle al saltar pistas rotas
  let shuffleHistory = [];
  // shuffle/repeat viven en player.service: la barra global (reproductor
  // expandido) y esta página comparten el mismo estado.
  // Favoritos normalizados en minúsculas + aislados por usuario (migración legacy incluida)
  migrateUserPref('favSongs');
  let favorites = new Set((JSON.parse(localStorage.getItem(userPrefKey('favSongs')) || '[]') || []).map(t => String(t).toLowerCase()));
  let queue = []; // indices in activeList
  let queueMenuPos = null; // posición en la cola con el menú ⋮ abierto
  let queuePanelOpen = false; // el panel de cola sobrevive a los re-renders
  // Escuchar juntos: sincronización de reproducción entre dispositivos
  let listenTogether = false;   // la sesión compartida está activa
  let listenPeer = '';          // nombre del otro dispositivo en la sesión
  let listenPeerAvatar = '';    // foto del otro dispositivo en la sesión
  let listenSuppress = 0;       // evita el eco al aplicar eventos recibidos
  let lastSync = { key: null, playing: null, t: -1 }; // último estado enviado al servidor
  let syncInFlight = false;     // evita solapar RPCs del tick (heartbeat en curso)
  let syncTimer = null;         // tick de sincronización (~3 veces por segundo)
  let offListen = () => {};     // desuscripción de la sesión compartida
  let searchQuery = '';
  let sortBy = 'default'; // 'default' | 'name' | 'favorites'
  // Duraciones cacheadas (metadatos): cargadas de localStorage (aisladas por usuario) y precargadas en 2º plano
  let trackDurations = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(userPrefKey('trackDurations')) || '{}');
      return (v && typeof v === 'object') ? v : {}; // blindado contra valores null o '{}' en string
    } catch { return {}; }
  })();
  let preloadToken = 0;
  const failedDurations = new Set(); // URLs rotas: no re-probar en esta sesión
  let saveDurTimer = null;

  // Debounce: evita ~67 writes de localStorage al rellenar la biblioteca
  function saveDurations() {
    clearTimeout(saveDurTimer);
    saveDurTimer = setTimeout(() => {
      try { localStorage.setItem(userPrefKey('trackDurations'), JSON.stringify(trackDurations)); } catch { /* cuota llena: ignorar */ }
    }, 400);
  }

  // Precarga de metadatos en 2º plano (3 en paralelo, pausa si la pestaña se oculta):
  // muestra la duración real de cada pista sin esperar a reproducirla.
  function probeDuration(url, token, done) {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => {
      if (token === preloadToken && probe.duration && isFinite(probe.duration)) {
        trackDurations[url] = probe.duration;
        saveDurations();
        updateDurSpans(url);
      }
      done();
    }, { once: true });
    probe.addEventListener('error', () => {
      if (token === preloadToken) failedDurations.add(url);
      done();
    }, { once: true });
    probe.src = url;
  }

  function preloadDurations(urls) {
    const token = ++preloadToken;
    const pending = [...new Set((urls || []).filter(u => u && trackDurations[u] === undefined && !failedDurations.has(u)))];
    if (!pending.length) return;
    let i = 0;
    const next = () => {
      if (token !== preloadToken) return; // abortado (nueva lista o cleanup)
      if (document.hidden) { setTimeout(next, 1200); return; }
      if (i >= pending.length) return;
      probeDuration(pending[i++], token, next);
    };
    for (let k = 0; k < 3; k++) next(); // 3 en paralelo: llena la biblioteca mucho antes
  }

  function updateDurSpans(url) {
    const label = trackDurations[url] ? formatTime(trackDurations[url]) : '';
    page.querySelectorAll('.music-track').forEach(btn => {
      if (btn.dataset.audio === url) {
        const dur = btn.querySelector('.music-track-dur');
        if (dur && label) dur.textContent = label;
      }
    });
  }

  function saveFavorites() {
    localStorage.setItem(userPrefKey('favSongs'), JSON.stringify([...favorites]));
  }

  function saveContinue(tabId, idx, time) {
    const s = activeList[idx];
    if (!s) return;
    // Guarda la URL de audio para reanudar con precisión (no solo título):
    // si la canción cambió de playlist, el Home/Canciones la localizan igual.
    localStorage.setItem(userPrefKey('continueTrack'), JSON.stringify({
      title: s.title, artist: s.artist || '', cover: s.cover || '',
      audio: s.audio || '', tab: tabId, time
    }));
  }

  // Guarda la posición en vivo con throttle: la tarjeta "Sigue escuchando"
  // del Home y la reanudación en Canciones usan el punto real de la última
  // escucha, no 0:00. ~cada 5s mientras suena + siempre al pausar.
  let lastContinueSave = 0;
  function saveContinueThrottled() {
    if (currentIdx < 0 || !audioEl || !isFinite(audioEl.currentTime)) return;
    const now = audioEl.currentTime;
    if (Math.abs(now - lastContinueSave) < 5 && !audioEl.paused) return;
    lastContinueSave = now;
    saveContinue(activePlaylistId, currentIdx, now);
  }

  function getContinue() {
    migrateUserPref('continueTrack');
    try { return JSON.parse(localStorage.getItem(userPrefKey('continueTrack'))); } catch { return null; }
  }

  function clearContinue() { localStorage.removeItem(userPrefKey('continueTrack')); }

  // Reanuda la última canción escuchada. Localiza por URL de audio (más
  // fiable que el título: resiste cambios de playlist/orden) con fallback
  // por título, y arranca desde el tiempo guardado.
  function resumeContinue() {
    const cont = getContinue();
    if (!cont) return;
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === cont.tab) || playlists[0];
    switchPlaylist(pl.id);
    let idx = cont.audio ? activeList.findIndex(s => s.audio === cont.audio) : -1;
    if (idx < 0) idx = activeList.findIndex(s => s.title === cont.title);
    if (idx >= 0) {
      loadSong(idx);
      if (audioEl) {
        audioEl.currentTime = Math.max(0, cont.time || 0);
        audioEl.play().then(() => { isPlaying = true; updatePlayBtn(); }).catch(() => {});
      }
    }
  }

  /** Localiza una canción del catálogo por su clave "título | artista". */
  function resolveSongByKey(key) {
    const [t, a] = String(key || '').split('|').map(s => s.trim());
    if (!t) return null;
    return [...SONGS_RECUERDAN, ...ALL_SONGS].find(s =>
      String(s.title || '').toLowerCase() === t &&
      String(s.artist || '').toLowerCase() === a
    );
  }

  function getPlaylists() {
    const built = buildPlaylists(favorites);
    const custom = userPlaylists.map(pl => {
      const songs = pl.songs.map(k => resolveSongByKey(k)).filter(Boolean);
      return {
        id: pl.id,
        name: pl.name,
        icon: pl.icon || '❤️',
        desc: 'Playlist compartida',
        cover: songs[0]?.cover || null,
        songs,
        count: songs.length,
        isCustom: true,
        raw: pl
      };
    });
    return [...built, ...custom];
  }

  /** Si la playlist activa es compartida, refresca `activeList` con sus
   *  canciones actuales (tras añadir/quitar/mover desde el servicio). */
  function refreshActiveFromPlaylists() {
    const pl = getPlaylists().find(p => p.id === activePlaylistId);
    if (pl?.isCustom) activeList = pl.songs;
  }

  function switchPlaylist(playlistId) {
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    activePlaylistId = playlistId;
    activeList = pl.songs;
    shuffleHistory = [];
    queue = [];
    // La música NO se detiene al cambiar de lista: sigue sonando en la
    // barra global (feeling de app de música real).
    isPlaying = audioEl ? !audioEl.paused : false;
    currentIdx = -1;
    searchQuery = '';
    sortBy = 'default';
    activeFilter = null;
    favMenuTitle = null;
    const searchInput = page.querySelector('#musicSearch');
    if (searchInput) searchInput.value = '';
    updatePlayBtn();
    updateUI();
    preloadDurations(activeList.map(s => s.audio));
  }

  function getFilteredSortedList() {
    let list = [...activeList];

    // Category filter (artista / álbum / género)
    if (activeFilter) {
      if (activeFilter.type === 'artist') {
        list = list.filter(s => s.artist.toLowerCase() === String(activeFilter.value).toLowerCase());
      } else if (activeFilter.type === 'cover') {
        list = list.filter(s => (s.cover || '') === activeFilter.value);
      }
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    }

    // Sort
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'favorites') {
      const favSet = favorites;
      list = [...list].sort((a, b) => {
        const aFav = favSet.has(a.title) ? 0 : 1;
        const bFav = favSet.has(b.title) ? 0 : 1;
        return aFav - bFav || a.title.localeCompare(b.title);
      });
    }
    return list;
  }

  // Modo aleatorio SIN repetir: shuffleHistory guarda los índices ya sonados
  // del ciclo actual. Al completar el ciclo (toda la lista sonó) se reinicia
  // sin repetir la canción que acaba de sonar. loadSong() añade cada tema al
  // historial cuando el shuffle está activo.
  function pickShuffleIdx(len) {
    if (len <= 1) return 0;
    let pool = [];
    for (let i = 0; i < len; i++) {
      if (i !== currentIdx && !shuffleHistory.includes(i)) pool.push(i);
    }
    if (!pool.length) {
      // Ciclo completado: nuevo ciclo excluyendo solo la canción actual.
      shuffleHistory = [currentIdx];
      for (let i = 0; i < len; i++) if (i !== currentIdx) pool.push(i);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ¿Queda alguna canción siguiente? Se usa en el modo 'off' (sin repetición)
  // para detenerse cuando la lista se acaba: en orden, tras la última; en
  // aleatorio, cuando ya han sonado todas las del ciclo.
  function hasNextTrack() {
    if (queue.length > 0) return true;
    const len = activeList.length;
    if (len <= 1) return false;
    if (currentIdx < 0 || currentIdx >= len) return true;
    if (player.shuffle) return shuffleHistory.length < len;
    return currentIdx < len - 1;
  }

  // ==========================================
  // RENDER
  // ==========================================
  function render() {
    const playlists = getPlaylists();
    const s = currentIdx >= 0 ? activeList[currentIdx] : null;
    const displayList = getFilteredSortedList();
    const user = userStore.getUser();
    // Eliminar canción del catálogo: solo el admin y solo en "Todas las canciones"
    const isAdminUser = !!userStore.isAdmin;
    const name = user?.name || '';
    const heroImg = s?.cover || HERO_DEFAULT_IMG;
    const curPl = playlists.find(p => p.id === activePlaylistId);
    isCustomView = !!curPl?.isCustom;
    const editingPl = playlistEditId && playlistEditId !== 'new' ? userPlaylists.find(p => p.id === playlistEditId) : null;
    const pickerTargets = picker ? playlists.filter(p => p.isCustom && p.id !== picker.fromId) : [];

    let listTitle = 'Todas las canciones';
    let filterLabel = '';
    let filterIcon = '';
    if (activeFilter) {
      if (activeFilter.type === 'artist') { listTitle = `Canciones de ${activeFilter.value}`; filterLabel = activeFilter.value; filterIcon = MUSIC_ICONS.mic(13); }
      else if (activeFilter.type === 'cover') { listTitle = 'Del álbum'; filterLabel = 'Álbum'; filterIcon = MUSIC_ICONS.disc(13); }
    }

    page.innerHTML = `
      <h1 class="sr-only">Canciones</h1>
      <div class="music-app">

        <!-- Búsqueda -->
        <div class="music-searchbar">
          <div class="music-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="music-search-input" id="musicSearch" placeholder="Buscar canciones, artistas, álbumes..." autocomplete="off" value="${escapeHtml(searchQuery)}" aria-label="Buscar canciones">
            ${searchQuery ? '<button class="music-search-clear" id="musicSearchClear" aria-label="Limpiar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : ''}
          </div>
        </div>

        <!-- Hero banner -->
        <section class="music-hero">
          <div class="music-hero-bg" style="background-image:url('${heroImg}')"></div>
          <div class="music-hero-scrim"></div>
          <div class="music-hero-content">
            <h2 class="music-hero-title">${escapeHtml(getGreeting(name))} <span class="music-hero-heart">🤍</span></h2>
            <p class="music-hero-sub">La música siempre entiende<br>lo que las palabras no pueden.</p>
            <div class="music-hero-actions">
              <button class="music-hero-btn music-hero-btn--primary" id="heroMix" type="button">
                <span class="music-hero-btn-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
                Reproducir mix
              </button>
              <button class="music-hero-btn" id="heroShuffle" type="button"><span class="music-hero-btn-icon">${MUSIC_ICONS.shuffle(13)}</span> Aleatorio</button>
              <button class="music-hero-btn" id="listenTogetherBtn" type="button" aria-pressed="${listenTogether}" title="Sincroniza la música con el otro dispositivo">🎧 Escuchar juntos</button>
            </div>
            <div class="music-listen-status" id="listenStatus"></div>
          </div>
        </section>

        <!-- Escuchado recientemente -->
        <section class="music-section" id="musicRecent">
          <div class="music-section-head">
            <h3>Escuchado recientemente</h3>
            <button class="music-more" data-more="recent" type="button">Ver todo <span class="music-more-arrow">›</span></button>
          </div>
          <div class="music-scroller" data-scroller="recent">
            ${getRecent().map(sg => renderCoverCard(sg)).join('')}
          </div>
        </section>

        <!-- Tus canciones favoritas -->
        <section class="music-section" id="musicFavs">
          <div class="music-section-head">
            <h3>Tus canciones favoritas</h3>
            <button class="music-more" data-more="favs" type="button">Ver todo <span class="music-more-arrow">›</span></button>
          </div>
          ${renderFavs()}
        </section>

        <!-- Letra (colapsable) -->
        ${s?.lyrics ? `<div class="music-lyrics glass-card ${lyricsOpen ? '' : 'is-collapsed'}" id="lyricsSection">
          <button class="music-lyrics-toggle" id="toggleLyrics" type="button">
            <span>Letra</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="music-lyrics-chevron"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="music-lyrics-body" id="lyricsPanel">${s.lyrics}</div>
        </div>` : ''}

        <!-- Lista principal (pestañas de playlists) -->
        <section class="music-section music-list-section" id="musicList">
          <!-- Pestañas: cada playlist es una pestaña, + crear nueva -->
          <div class="music-pl-tabs" id="musicPlaylists" role="tablist" aria-label="Playlists">
            ${playlists.map(pl => renderPlaylistTab(pl)).join('')}
            <button class="music-pl-tab music-pl-tab-new" id="plNewBtn" type="button" title="Crear playlist">${MUSIC_ICONS.plus(14)} Nueva playlist</button>
          </div>
          ${activeFilter ? `<div class="music-list-filterbar">
            <span class="music-filter-chip is-active" id="filterClear" role="button" tabindex="0" title="Quitar filtro">${filterIcon} ${escapeHtml(filterLabel)} <span class="music-filter-clear-x">✕</span></span>
          </div>` : ''}
          <div class="music-toolbar">
            <span class="music-tracks-count">${displayList.length} ${displayList.length === 1 ? 'canción' : 'canciones'}</span>
            <div class="music-list-tools">
              ${isCustomView ? `<button class="music-pl-manage-btn ${plCardMenu === curPl.id ? 'is-open' : ''}" id="plManageBtn" type="button" title="Gestionar playlist" aria-label="Gestionar playlist">${MUSIC_ICONS['more-v'](16)}</button>` : ''}
              <button class="music-queue-btn" id="queueBtn" type="button" title="Cola de reproducción" aria-label="Cola de reproducción">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
              </button>
            </div>
          </div>
          ${isCustomView && plCardMenu === curPl.id ? `<div class="music-playlist-manage-pop" data-pl-manage-pop>
            <button class="music-track-menu-item" data-pl-edit="${escapeHtml(curPl.id)}" type="button">${MUSIC_ICONS.edit(14)} Editar playlist</button>
            <button class="music-track-menu-item is-danger" data-pl-del="${escapeHtml(curPl.id)}" type="button">${MUSIC_ICONS.trash(14)} Eliminar playlist</button>
          </div>` : ''}
          <div class="music-tracks" id="playlist">
            <div class="music-tracks-list">
              ${displayList.map((t, i) => {
                const isCurrent = s && t.title === s.title && t.artist === s.artist;
                const isSpecial = !!t.experience;
                const dur = trackDurations[t.audio] ? formatTime(trackDurations[t.audio]) : '--:--';
                const key = songKey(t.title, t.artist);
                const inCurPl = isCustomView && (curPl.raw.songs || []).includes(key);
                const menuOpen = trackMenuKey === key;
                const isFav = favorites.has(String(t.title).toLowerCase());
                return `<div class="music-track ${isCurrent ? 'is-active' : ''}${isSpecial ? ' is-special' : ''}" data-title="${escapeHtml(t.title)}" data-artist="${escapeHtml(t.artist)}" data-audio="${escapeHtml(t.audio || '')}" role="button" tabindex="0" aria-label="Reproducir ${escapeHtml(t.title)}">
                  <div class="music-track-num">${isCurrent && isPlaying
                    ? '<span class="music-track-eq"><span></span><span></span><span></span></span>'
                    : `<span class="music-track-idx">${i + 1}</span>`
                  }</div>
                  <div class="music-track-cover-wrap">
                    <img src="${t.cover}" alt="${escapeHtml(t.title)}" loading="lazy" class="music-track-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                    ${coverFallback(t.title)}
                  </div>
                  <div class="music-track-info">
                    <strong>${escapeHtml(t.title)}${isSpecial ? ` <span class="music-track-badge">${MUSIC_ICONS.sparkles(12)}</span>` : ''}</strong>
                    <span>${escapeHtml(t.artist)}</span>
                  </div>
                  <span class="music-track-dur">${dur}</span>
                  <button class="music-track-fav ${isFav ? 'is-faved' : ''}" data-fav="${escapeHtml(t.title)}" type="button" title="${isFav ? 'Quitar de favoritas' : 'Añadir a favoritas'}" aria-label="${isFav ? 'Quitar de favoritas' : 'Añadir a favoritas'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                  <button class="music-track-menu ${menuOpen ? 'is-open' : ''}" data-key="${escapeHtml(key)}" type="button" title="Más opciones" aria-label="Más opciones de ${escapeHtml(t.title)}">${MUSIC_ICONS['more-v'](16)}</button>
                  ${isSpecial ? `<a href="#/${t.experience}" class="music-track-exp" onclick="event.stopPropagation()" title="Experiencia">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </a>` : ''}
                  ${menuOpen ? `<div class="music-track-menu-pop" data-key="${escapeHtml(key)}">
                    <button class="music-track-menu-item" data-qplay-next data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS['play-next'](15)} Reproducir a continuación</button>
                    ${queueHas(key)
                      ? `<button class="music-track-menu-item" data-qremove data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS['list-x'](15)} Quitar de la cola</button>`
                      : `<button class="music-track-menu-item" data-qadd data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS['list-plus'](15)} Añadir a la cola</button>`}
                    <div class="music-track-menu-sep" role="separator"></div>
                    <button class="music-track-menu-item" data-pl-pick="add" data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS.plus(15)} Añadir a playlist</button>
                    ${inCurPl ? `<button class="music-track-menu-item" data-pl-remove data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS['list-x'](15)} Quitar de la playlist</button>` : ''}
                    ${inCurPl ? `<button class="music-track-menu-item" data-pl-pick="move" data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS['move-right'](15)} Mover a otra playlist</button>` : ''}
                    ${t.lyrics ? `<button class="music-track-menu-item" data-pl-lyrics data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS.music(15)} Ver letra</button>` : ''}
                    ${isAdminUser && activePlaylistId === 'completas' ? `<div class="music-track-menu-sep" role="separator"></div>
                    <button class="music-track-menu-item is-danger" data-song-del data-key="${escapeHtml(key)}" type="button">${MUSIC_ICONS.trash(15)} Eliminar canción</button>` : ''}
                  </div>` : ''}
                </div>`;
              }).join('')}
              ${!displayList.length ? `<div class="music-tracks-empty">${searchQuery || activeFilter ? 'No se encontraron canciones' : 'No hay canciones en esta colección'}</div>` : ''}
            </div>
          </div>
        </section>

        <!-- Queue panel -->
        <div class="music-queue" id="queuePanel" style="display:${queuePanelOpen ? '' : 'none'}">
          <div class="music-queue-header">
            <h3>Cola de reproducción</h3>
            <button class="music-queue-clear" id="queueClear" type="button">Limpiar cola</button>
          </div>
          <div class="music-queue-list" id="queueList"></div>
        </div>

        <!-- Lyrics lightbox -->
        <div class="music-lyrics-lightbox" id="lyricsLightbox" style="display:none">
          <div class="music-lyrics-lightbox-content">
            <button class="music-lyrics-lightbox-close" id="closeLightbox" type="button" aria-label="Cerrar letra ampliada">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="music-lyrics-expanded" id="expandedLyrics">${s?.lyrics || ''}</div>
          </div>
        </div>

        <!-- Picker de playlists (añadir / mover canción) -->
        ${picker ? `<div class="music-modal" id="plPickerModal">
          <div class="music-modal-card">
            <div class="music-modal-head">
              <h3>${picker.mode === 'move' ? 'Mover a otra playlist' : 'Añadir a playlist'}</h3>
              <button class="music-modal-close" id="plPickerClose" type="button" aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="music-picker-list">
              ${pickerTargets.map(pl => `
                <button class="music-picker-item" data-pl-id="${escapeHtml(pl.id)}" type="button">
                  <span class="music-picker-icon">${playlistIcon(pl.icon, 18)}</span>
                  <span class="music-picker-name">${escapeHtml(cleanPlaylistName(pl.name))}</span>
                  <span class="music-picker-count">${pl.count} ${pl.count === 1 ? 'canción' : 'canciones'}</span>
                </button>`).join('')}
              <button class="music-picker-item music-picker-new" data-pl-new type="button">
                <span class="music-picker-icon">${MUSIC_ICONS.plus(18)}</span>
                <span class="music-picker-name">Nueva playlist</span>
              </button>
            </div>
          </div>
        </div>` : ''}

        <!-- Editor de playlist (crear / editar) -->
        ${playlistEditId !== null ? `<div class="music-modal" id="plEditorModal">
          <div class="music-modal-card">
            <div class="music-modal-head">
              <h3>${playlistEditId === 'new' ? 'Nueva playlist' : 'Editar playlist'}</h3>
              <button class="music-modal-close" id="plEditorClose" type="button" aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <label class="music-pl-label" for="plNameInput">Nombre</label>
            <input class="music-pl-input" id="plNameInput" type="text" value="${escapeHtml(plNameDraft)}" maxlength="40" placeholder="Ej: Canciones para el viaje" autocomplete="off" aria-label="Nombre de la playlist">
            <span class="music-pl-label">Icono</span>
            <div class="music-pl-icons">
              ${PLAYLIST_ICON_CHOICES.map(em => `<button class="music-pl-icon ${plIconSel === em ? 'is-selected' : ''}" data-pl-icon="${em}" type="button" aria-label="Icono ${em}">${em}</button>`).join('')}
            </div>
            <div class="music-modal-actions">
              <button class="music-pl-cancel" id="plEditorCancel" type="button">Cancelar</button>
              <button class="music-pl-save" id="plEditorSave" type="button">${playlistEditId === 'new' ? 'Crear playlist' : 'Guardar'}</button>
            </div>
          </div>
        </div>` : ''}

        <!-- Confirmación de borrado de canción (solo admin) -->
        ${deleteConfirmKey ? (() => {
          const dg = resolveSongByKey(deleteConfirmKey);
          if (!dg) return '';
          return `<div class="music-modal" id="songDelModal">
            <div class="music-modal-card music-modal-card--confirm">
              <div class="music-modal-head">
                <h3>Eliminar canción</h3>
                <button class="music-modal-close" id="songDelCancel" type="button" aria-label="Cerrar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="song-del-song">
                <span class="song-del-cover">
                  ${dg.cover
                    ? `<img src="${escapeHtml(dg.cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${coverFallback(dg.title)}`
                    : coverFallback(dg.title)}
                </span>
                <span class="song-del-meta">
                  <strong>${escapeHtml(dg.title)}</strong>
                  ${dg.artist ? `<span>${escapeHtml(dg.artist)}</span>` : ''}
                </span>
              </div>
              <p class="song-del-warning">Se borrará de todas las canciones y de la base de datos: desaparecerá para los dos. Esta acción no se puede deshacer.</p>
              <div class="music-modal-actions">
                <button class="music-pl-cancel" id="songDelCancelBtn" type="button">Cancelar</button>
                <button class="song-del-confirm" id="songDelConfirm" type="button">${MUSIC_ICONS.trash(15)} Eliminar</button>
              </div>
            </div>
          </div>`;
        })() : ''}
      </div>
    `;
  }

  // ==========================================
  // HELPERS DE RENDER (layout tipo Spotify)
  // ==========================================
  function getGreeting(uname) {
    // Misma lógica que el inicio: hora de España (península) y los mismos
    // tramos del día, para que la bienvenida coincida siempre con la Home.
    const h = hourInSpain();
    const g = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return uname ? `${g}, ${uname}` : g;
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function getRecent() {
    const picks = [];
    const cont = getContinue();
    if (cont) {
      const song = ALL_SONGS.find(x => x.title === cont.title) || SONGS_RECUERDAN.find(x => x.title === cont.title);
      if (song) picks.push(song);
    }
    const pool = ALL_SONGS.length ? ALL_SONGS : SONGS_RECUERDAN;
    const day = todayISO();
    let i = 0;
    while (picks.length < 5 && i < 40) {
      const sg = pool[hashStr(day + '#' + i++) % pool.length];
      if (sg && !picks.some(p => p.title === sg.title && p.artist === sg.artist)) picks.push(sg);
    }
    return picks;
  }

  function getFavSongs() {
    const seen = new Set();
    const out = [];
    [...SONGS_RECUERDAN, ...ALL_SONGS].forEach(sg => {
      const k = (sg.title + '|' + (sg.artist || '')).toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      if (favorites.has(String(sg.title).toLowerCase())) out.push(sg);
    });
    return out;
  }

  function renderCoverCard(sg) {
    return `<button class="music-cover-card" data-title="${escapeHtml(sg.title)}" data-artist="${escapeHtml(sg.artist || '')}" type="button">
      <span class="music-cover-art">
        ${sg.cover
          ? `<img src="${sg.cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${coverFallback(sg.title)}`
          : coverFallback(sg.title)}
        <span class="music-cover-play">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </span>
      </span>
      <span class="music-cover-title">${escapeHtml(sg.title)}</span>
      <span class="music-cover-artist">${escapeHtml(sg.artist || '')}</span>
    </button>`;
  }

  // Una pestaña por playlist: icono + nombre + conteo. Al pulsarla, la lista
  // principal muestra SOLO sus canciones (y el play reproduce solo esa lista).
  function renderPlaylistTab(pl) {
    const active = pl.id === activePlaylistId;
    return `<button class="music-pl-tab ${active ? 'is-active' : ''}" data-playlist="${escapeHtml(pl.id)}" role="tab" aria-selected="${active}" type="button" title="${escapeHtml(pl.name)}">
      <span class="music-pl-tab-icon">${playlistIcon(pl.icon, 14)}</span>
      <span class="music-pl-tab-name">${escapeHtml(cleanPlaylistName(pl.name))}</span>
      <span class="music-pl-tab-count">${pl.count}</span>
    </button>`;
  }

  function renderFavs() {
    const favs = getFavSongs();
    const s = currentIdx >= 0 ? activeList[currentIdx] : null;
    if (!favs.length) {
      return `<div class="music-favs-empty">
        <span class="music-favs-empty-icon">${MUSIC_ICONS.heart(26)}</span>
        Aún no tienes favoritas
        <span class="music-favs-empty-hint">Toca el corazón en cualquier canción para guardarla aquí</span>
      </div>`;
    }
    return `<div class="music-favs glass-card">
      <div class="music-favs-bar">
        <button class="music-favs-play" id="favsPlayAll" type="button">
          <span class="music-favs-play-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
          Reproducir favoritas
        </button>
        <span class="music-favs-count">${favs.length} ${favs.length === 1 ? 'canción' : 'canciones'}</span>
      </div>
      <div class="music-fav-head">
        <span class="music-fav-idx">#</span>
        <span class="music-fav-tit">Título</span>
        <span class="music-fav-artist">Artista</span>
        <span class="music-fav-dur">Duración</span>
        <span class="music-fav-act"></span>
        <span class="music-fav-act"></span>
      </div>
      ${favs.map((sg, i) => {
        const isCurrent = s && sg.title === s.title && sg.artist === s.artist;
        const dur = trackDurations[sg.audio] ? formatTime(trackDurations[sg.audio]) : '--:--';
        const menuOpen = favMenuTitle === sg.title;
        const fKey = songKey(sg.title, sg.artist);
        const canQueue = idxInActiveList(fKey) >= 0; // la cola vive sobre la lista activa
        return `
        <div class="music-fav-row ${isCurrent ? 'is-active' : ''}" data-title="${escapeHtml(sg.title)}" data-artist="${escapeHtml(sg.artist || '')}" role="button" tabindex="0" aria-label="Reproducir ${escapeHtml(sg.title)}">
          <span class="music-fav-idx">${isCurrent && isPlaying
            ? '<span class="music-track-eq"><span></span><span></span><span></span></span>'
            : i + 1}</span>
          <div class="music-fav-tit">
            <span class="music-fav-cover">
              ${sg.cover ? `<img src="${sg.cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${coverFallback(sg.title)}` : coverFallback(sg.title)}
            </span>
            <strong>${escapeHtml(sg.title)}${sg.experience ? ` <span class="music-track-badge">${MUSIC_ICONS.sparkles(12)}</span>` : ''}</strong>
          </div>
          <span class="music-fav-artist">${escapeHtml(sg.artist || '')}</span>
          <span class="music-fav-dur">${dur}</span>
          <span class="music-fav-act">
            <button class="music-fav-heart is-faved" data-fav="${escapeHtml(sg.title)}" type="button" title="Quitar de favoritas" aria-label="Quitar de favoritas">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
          </span>
          <span class="music-fav-act">
            <button class="music-fav-menu-btn ${menuOpen ? 'is-open' : ''}" data-menu="${escapeHtml(sg.title)}" type="button" title="Más opciones" aria-label="Más opciones">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
            </button>
          </span>
        </div>
        ${menuOpen ? `<div class="music-fav-menu">
          ${canQueue ? `<button class="music-fav-menu-item" data-qplay-next data-key="${escapeHtml(fKey)}" type="button">${MUSIC_ICONS['play-next'](14)} Reproducir a continuación</button>
          ${queueHas(fKey)
            ? `<button class="music-fav-menu-item" data-qremove data-key="${escapeHtml(fKey)}" type="button">${MUSIC_ICONS['list-x'](14)} Quitar de la cola</button>`
            : `<button class="music-fav-menu-item" data-qadd data-key="${escapeHtml(fKey)}" type="button">${MUSIC_ICONS['list-plus'](14)} Añadir a la cola</button>`}` : ''}
          ${sg.lyrics ? `<button class="music-fav-menu-item" data-lyrics="${escapeHtml(sg.title)}" type="button">${MUSIC_ICONS.music(15)} Ver letra</button>` : ''}
          <button class="music-fav-menu-item" data-pl-pick="add" data-key="${escapeHtml(fKey)}" type="button">${MUSIC_ICONS.plus(15)} Añadir a playlist</button>
          <button class="music-fav-menu-item" data-unfav="${escapeHtml(sg.title)}" type="button">${MUSIC_ICONS['heart-off'](15)} Quitar de favoritas</button>
        </div>` : ''}`;
      }).join('')}
    </div>`;
  }

  function playAt(idx) {
    if (idx < 0 || !activeList[idx]) return;
    loadSong(idx);
    if (audioEl) { audioEl.play().catch(() => {}); isPlaying = true; updatePlayBtn(); }
    player.setPlaying(true);
  }

  function scrollToId(id) {
    setTimeout(() => {
      page.querySelector('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  // Posiciona un popup de menú junto a su botón (position:fixed para no
  // recortarse dentro de scrollers/listas con overflow), ajustándolo a la
  // ventana si se sale por la derecha o por abajo.
  function positionMenu(trigger, pop) {
    const r = trigger.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = Math.min(r.right - pw, window.innerWidth - pw - 12);
    left = Math.max(12, left);
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 6);
    pop.style.position = 'fixed';
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  // ==========================================
  // COLA — acciones desde el menú ⋮ de cada canción
  // (la cola guarda índices sobre activeList; las acciones
  // localizan por clave "título | artista" por si la lista
  // cambió de orden/filtro entre renderizados)
  // ==========================================
  function idxInActiveList(key) {
    return activeList.findIndex(s => songKey(s.title, s.artist) === key);
  }

  function queueHas(key) {
    const idx = idxInActiveList(key);
    return idx >= 0 && queue.includes(idx);
  }

  // "Reproducir a continuación": la mete la primera de la cola
  // (quita duplicados previos para no sonar dos veces).
  function playNextInQueue(key) {
    const idx = idxInActiveList(key);
    if (idx < 0) return;
    queue = queue.filter(q => q !== idx);
    queue.unshift(idx);
    renderQueue();
    showToast('Se reproducirá a continuación', 'success');
  }

  function addToQueue(key) {
    const idx = idxInActiveList(key);
    if (idx < 0) return;
    if (queue.includes(idx)) { showToast('Ya está en la cola', 'info'); return; }
    queue.push(idx);
    renderQueue();
    showToast('Añadida a la cola', 'success');
  }

  function removeFromQueue(key) {
    const idx = idxInActiveList(key);
    if (idx < 0) return;
    queue = queue.filter(q => q !== idx);
    renderQueue();
    showToast('Quitada de la cola', 'info');
  }

  // ==========================================
  // UPDATE UI (partial updates without full re-render)
  // ==========================================
  function updateUI() {
    // El <audio> es global (player.service) y ya no se recrea en el render:
    // la reproducción se conserva sola entre re-renders.
    render();
    bindEvents();
    // El render recrea el panel de cola: si estaba abierto, repinta su lista
    if (queuePanelOpen) renderQueue();
  }

  function updatePlayBtn() {
    // El botón de play vive en la barra global (NowPlayingBar), que se
    // actualiza sola al cambiar el estado del player. Se mantiene como
    // punto de enganche por si la página recupera controles propios.
  }

  function loadSong(idx) {
    currentIdx = idx;
    // Modo aleatorio sin repetir: cada tema que suena entra en el historial
    // del ciclo actual (cubre reproducciones manuales, cola y saltos).
    if (player.shuffle && !shuffleHistory.includes(idx)) shuffleHistory.push(idx);
    const s = activeList[idx];
    if (!s) return;
    // updateUI() re-renderiza y recrea el <audio>: asignamos el src DESPUÉS,
    // sobre el elemento fresco, para que la reproducción funcione de verdad.
    updateUI();
    if (audioEl) {
      audioEl.src = s.audio;
      audioEl.currentTime = 0; // evita arrastrar la posición del tema anterior
      if (isPlaying) audioEl.play().catch(() => {});
    }
    // Ficha del tema para la barra global y Media Session (pantalla de bloqueo)
    player.setInfo({ title: s.title, artist: s.artist || '', cover: s.cover || '' });
    saveContinue(activePlaylistId, idx, 0);
    // Escuchar juntos: avisa del cambio de canción. Se actualiza lastSync para
    // que el tick no reenvíe el mismo cambio (el broadcast directo es la
    // autoridad: el tick solo detecta lo que este aviso no cubrió).
    lastSync = { key: songKey(s.title, s.artist), playing: isPlaying && !audioEl?.paused, t: audioEl?.currentTime || 0 };
    maybeBroadcast({ action: 'song', key: songKey(s.title, s.artist), t: audioEl?.currentTime || 0, playing: isPlaying });
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) {
      isPlaying = true;
      updatePlayBtn();
      audioEl.play().catch(() => { isPlaying = false; updatePlayBtn(); });
    } else {
      audioEl.pause();
      isPlaying = false;
      updatePlayBtn();
    }
    player.setPlaying(isPlaying);
    // Escuchar juntos: avisa del play/pause. lastSync se actualiza para que el
    // tick no reenvíe el mismo estado (mismo criterio que en loadSong).
    if (currentIdx >= 0 && activeList[currentIdx]) {
      lastSync = { key: songKey(activeList[currentIdx].title, activeList[currentIdx].artist), playing: isPlaying && !audioEl?.paused, t: audioEl?.currentTime || 0 };
      maybeBroadcast({ action: 'playpause', key: songKey(activeList[currentIdx].title, activeList[currentIdx].artist), t: audioEl?.currentTime || 0, playing: isPlaying });
    }
  }

  // ==========================================
  // ESCUCHAR JUNTOS — sincronización entre dispositivos
  // ==========================================
  function findSongByKey(key) {
    if (!key) return null;
    // Busca en TODA la biblioteca: "Nuestras canciones" (SONGS_RECUERDAN)
    // tiene temas que no están en ALL_SONGS (mi niña, ¿a dónde vamos?, …)
    for (const list of [ALL_SONGS, SONGS_RECUERDAN]) {
      for (const s of list) {
        if (songKey(s.title, s.artist) === key) return s;
      }
    }
    return null;
  }

  /** Reproduce una canción concreta (venga de donde venga: otra playlist). */
  function playSongObject(s, t) {
    const sourceList = ALL_SONGS.includes(s) ? ALL_SONGS : (SONGS_RECUERDAN.includes(s) ? SONGS_RECUERDAN : null);
    if (!sourceList) return;
    // Ya está sonando esta misma canción: solo se ajusta la posición (seek),
    // sin recargar el audio ni reiniciar la reproducción.
    const current = activeList[currentIdx];
    if (current && songKey(current.title, current.artist) === songKey(s.title, s.artist)) {
      if (audioEl && Number.isFinite(t) && t > 0 && Math.abs(audioEl.currentTime - t) > 2) {
        audioEl.currentTime = t;
      }
      return;
    }
    const idx = sourceList.indexOf(s);
    if (idx >= 0 && activeList[idx] === s) {
      loadSong(idx);
    } else {
      // La canción no está en la lista activa: se reproduce sobre la biblioteca
      activeList = sourceList;
      currentIdx = idx;
      updateUI();
      if (audioEl) {
        audioEl.src = s.audio;
        audioEl.currentTime = 0;
      }
      player.setInfo({ title: s.title, artist: s.artist || '', cover: s.cover || '' });
    }
    if (audioEl && Number.isFinite(t) && t > 0 && Math.abs(audioEl.currentTime - t) > 2) {
      audioEl.currentTime = t;
    }
  }

  /** Envía el estado local de reproducción al SERVIDOR autoritativo.
   *  El servidor valida (acciones explícitas vs heartbeats del líder) y
   *  decide qué se aplica → elimina el ping-pong entre dispositivos.
   *  Solo se envía si no acabamos de aplicar el estado del servidor
   *  (anti-eco) y si algo cambió realmente. */
  function maybeBroadcast(payload) {
    if (!listenTogether) return;
    if (Date.now() - listenSuppress < 1500) return;
    const s = activeList[currentIdx];
    if (!s) return;
    const key = payload.key || songKey(s.title, s.artist);
    submitListenState({
      song_key: key,
      title: s.title || payload.title || '',
      artist: s.artist || payload.artist || '',
      playing: payload.playing === true,
      position: Number.isFinite(payload.t) ? payload.t : 0,
      is_action: true // cambio de canción / play / pausa: acción explícita
    });
  }

  /** Tick de sincronización (~3 veces por segundo, como pide el diseño):
   *  1) Heartbeat: envía el estado local al servidor (el servidor valida;
   *     solo el líder avanza la posición en la misma canción/estado).
   *  2) Sondeo: lee el estado autoritativo y lo aplica localmente, así
   *     ambos dispositivos convergen a la misma canción, estado y segundo.
   *  El servidor es la ÚNICA fuente de verdad: un dispositivo no puede
   *  arrastrar el reloj compartido hacia atrás ni deshacer el estado del otro. */
  async function syncTick() {
    if (!listenTogether || syncInFlight) return;
    syncInFlight = true;
    try {
      // 1) Heartbeat: envía el estado local SOLO si hay canción y algo cambió.
      if (currentIdx >= 0 && activeList[currentIdx]) {
        const s = activeList[currentIdx];
        const key = songKey(s.title, s.artist);
        const playing = isPlaying && !audioEl?.paused;
        const t = audioEl?.currentTime || 0;
        const prev = lastSync;
        const suppress = Date.now() - listenSuppress < 1500;
        const songChanged = key !== prev.key;
        const stateChanged = playing !== prev.playing;
        const jump = Math.abs(t - prev.t) > 2;      // seek manual (adelantar/retroceder)
        const advanced = Math.abs(t - prev.t) >= 1; // avance normal de reproducción
        if (!suppress && (songChanged || stateChanged || jump || advanced)) {
          lastSync = { key, playing, t };
          await submitListenState({
            song_key: key,
            title: s.title || '',
            artist: s.artist || '',
            playing,
            position: t,
            is_action: songChanged || stateChanged || jump
          });
        }
      }
      // 2) Sondeo del estado autoritativo SIEMPRE (aunque no haya canción
      //    local ni hayamos enviado nada): adoptamos lo que diga el servidor.
      const st = await fetchListenState();
      if (st && st.song_key) applyServerState(st);
    } finally {
      syncInFlight = false;
    }
  }

  /** Arranca el tick de sincronización (idempotente). */
  function startSyncTick() {
    if (syncTimer || !listenTogether) return;
    if (currentIdx >= 0 && activeList[currentIdx]) {
      const s = activeList[currentIdx];
      lastSync = { key: songKey(s.title, s.artist), playing: isPlaying && !audioEl?.paused, t: audioEl?.currentTime || 0 };
    }
    syncTimer = setInterval(syncTick, 333); // ~3 veces por segundo
  }

  /** Detiene el tick de sincronización. */
  function stopSyncTick() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  function updateListenChip() {
    const st = getListenTogetherState();
    // Fuente de verdad: el estado global del servicio. Se sincroniza aquí
    // (montaje + cada 'state') para que los eventos entrantes no se descarten
    // aunque la sesión se activara desde otra página (invitación global).
    listenTogether = st.active;
    listenPeer = st.peerName;
    listenPeerAvatar = st.peerAvatar;
    const btn = page.querySelector('#listenTogetherBtn');
    if (btn) {
      btn.classList.toggle('is-active', st.active || st.pending);
      btn.setAttribute('aria-pressed', String(st.active || st.pending));
    }
    const chip = page.querySelector('#listenStatus');
    if (!chip) return;
    if (!st.active && !st.pending) { chip.textContent = ''; chip.classList.remove('is-on'); return; }
    chip.classList.add('is-on');
    if (st.active && st.peerName) {
      const avatarHtml = st.peerAvatar
        ? `<img src="${escapeHtml(st.peerAvatar)}" alt="" class="listen-peer-avatar" onerror="this.style.display='none';">`
        : `<span class="listen-peer-avatar listen-peer-avatar--fallback">${escapeHtml(st.peerName.charAt(0).toUpperCase())}</span>`;
      chip.innerHTML = `🎧 Escuchando con <span class="listen-peer">${avatarHtml}<span>${escapeHtml(st.peerName)}</span></span>`;
    } else if (st.pending) {
      chip.textContent = '🎧 Solicitud enviada… esperando respuesta';
    } else {
      chip.textContent = '🎧 Escuchar juntos activado: reproduce algo y lo oiremos los dos';
    }
  }

  function toggleListenTogether() {
    const user = userStore.getUser();
    if (listenTogether) {
      stopListenTogether();
      listenPeer = '';
      showToast('Escuchar juntos desactivado', 'info');
    } else if (getListenTogetherState().pending) {
      cancelListenRequest();
      showToast('Solicitud cancelada.', 'info');
    } else {
      requestListenTogether(user?.name || 'Tu pareja', user?.avatar || '');
      showToast('Solicitud enviada. Esperando respuesta…', 'info', 5000);
    }
    updateListenChip();
  }

  /** Aplica el estado AUTORITATIVO que devuelve el servidor (única fuente
   *  de verdad). No hay arbitraje local: si el servidor dice otra canción,
   *  otro estado o otra posición (fuera de tolerancia), lo aplicamos.
   *  Se marca listenSuppress y se asimila lastSync para NO reenviar el eco
   *  de lo que acabamos de aplicar (el ping-pong del broadcast desaparece). */
  function applyServerState(st) {
    if (!st || !st.song_key) return;
    const current = activeList[currentIdx];
    const localKey = current ? songKey(current.title, current.artist) : '';
    const localPlaying = isPlaying && !audioEl?.paused;
    const localT = audioEl?.currentTime || 0;
    const serverPlaying = st.playing === true;
    const serverT = Number.isFinite(st.position) ? st.position : 0;

    // El servidor dice OTRA canción → cambiar de canción.
    if (st.song_key !== localKey) {
      const s = findSongByKey(st.song_key);
      if (!s) return;
      listenSuppress = Date.now();
      playSongObject(s, serverT);
      applyPlayState(serverPlaying);
      lastSync = { key: st.song_key, playing: serverPlaying, t: serverT };
      return;
    }

    // Misma canción pero el estado cambió → play/pausa.
    if (serverPlaying !== localPlaying) {
      listenSuppress = Date.now();
      applyPlayState(serverPlaying);
      lastSync = { ...lastSync, playing: serverPlaying, t: serverT };
      return;
    }

    // Misma canción y estado: corregir la posición si se desvía >2s.
    if (serverPlaying && Math.abs(localT - serverT) > 2) {
      listenSuppress = Date.now();
      if (audioEl && serverT > 0) audioEl.currentTime = serverT;
      lastSync = { ...lastSync, t: serverT };
    }
  }

  /** Aplica play/pausa localmente (compartido por applyServerState). */
  function applyPlayState(playing) {
    if (playing === true && audioEl?.paused) {
      isPlaying = true;
      updatePlayBtn();
      audioEl.play().catch(() => { isPlaying = false; updatePlayBtn(); });
      player.setPlaying(true);
    } else if (playing === false && audioEl && !audioEl.paused) {
      audioEl.pause();
      isPlaying = false;
      updatePlayBtn();
      player.setPlaying(false);
    }
  }

  function nextSong() {
    if (!activeList.length) return;
    saveContinue(activePlaylistId, currentIdx, audioEl?.currentTime || 0);
    // Consume queue first
    if (queue.length > 0) {
      const nextIdx = queue.shift();
      loadSong(nextIdx);
      return;
    }
    const len = activeList.length;
    // En orden avanza por la lista y, al llegar al final, da la vuelta (la
    // playlist se repite). En aleatorio, salta a un tema no sonado del ciclo.
    const next = player.shuffle && len > 1 ? pickShuffleIdx(len) : (currentIdx + 1) % len;
    loadSong(next);
    if (isPlaying && audioEl) audioEl.play().catch(() => { isPlaying = false; updatePlayBtn(); });
  }

  function prevSong() {
    if (!activeList.length) return;
    saveContinue(activePlaylistId, currentIdx, audioEl?.currentTime || 0);
    const len = activeList.length;
    const prev = player.shuffle && len > 1 ? pickShuffleIdx(len) : (currentIdx - 1 + len) % len;
    loadSong(prev);
    if (isPlaying && audioEl) audioEl.play().catch(() => { isPlaying = false; updatePlayBtn(); });
  }

  // ==========================================
  // AUDIO GLOBAL — eventos enganchados UNA sola vez por visita
  // (el elemento ya no se recrea en cada render). wireAudioEvents
  // devuelve la función que los desengancha en cleanup, para no
  // acumular listeners entre visitas a la página.
  // ==========================================
  function wireAudioEvents() {
    if (!audioEl) return () => {};
    audioEl.addEventListener('timeupdate', onTimeUpdate);
    audioEl.addEventListener('pause', saveContinueThrottled);
    audioEl.addEventListener('seeked', saveContinueThrottled);
    audioEl.addEventListener('ended', onEnded);
    audioEl.addEventListener('error', onError);
    audioEl.addEventListener('playing', onPlaying);
    audioEl.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audioEl.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.removeEventListener('pause', saveContinueThrottled);
      audioEl.removeEventListener('seeked', saveContinueThrottled);
      audioEl.removeEventListener('ended', onEnded);
      audioEl.removeEventListener('error', onError);
      audioEl.removeEventListener('playing', onPlaying);
      audioEl.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }

  function onTimeUpdate() {
    // El progreso/times se pintan en la barra global (NowPlayingBar); aquí
    // solo se persiste la posición para "Sigue escuchando".
    saveContinueThrottled();
  }

  function onEnded() {
    saveContinue(activePlaylistId, currentIdx, 0);
    // 'one' → repite la misma canción desde el principio.
    if (player.repeat === 'one' && currentIdx >= 0 && activeList[currentIdx]) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
      return;
    }
    // 'off' → sin bucle: cuando la lista se acaba (en orden o al agotarse el
    // ciclo aleatorio sin repetir) se detiene. En el resto de modos (y por
    // defecto, 'all') sigue automáticamente y la playlist se repite.
    if (player.repeat === 'off' && !hasNextTrack()) {
      isPlaying = false;
      updatePlayBtn();
      player.setPlaying(false);
      return;
    }
    // Avance automático: al terminar la canción suena la siguiente; si la
    // lista se acaba, nextSong da la vuelta y la playlist se repite.
    isPlaying = true;
    nextSong();
  }

  function onError() {
    isPlaying = false;
    updatePlayBtn();
    // Comportamiento de app de música real: salta a la siguiente pista
    // cuando una falla, con guarda para no entrar en bucle si fallan varias seguidas.
    consecutiveErrors++;
    if (consecutiveErrors <= 3) {
      showToast('Canción no disponible, saltando...', 'info');
      nextSong();
      // nextSong()/loadSong() solo reproducen si isPlaying era true; lo
      // reanudamos aquí para que el salto sea continuo (no solo seleccionar).
      if (audioEl) {
        isPlaying = true;
        updatePlayBtn();
        audioEl.play().catch(() => { isPlaying = false; updatePlayBtn(); });
      }
    } else {
      consecutiveErrors = 0;
      showToast('Error al reproducir', 'error');
    }
  }

  function onPlaying() { consecutiveErrors = 0; }

  function onLoadedMetadata() {
    if (audioEl.duration && audioEl.src) trackDurations[audioEl.src] = audioEl.duration;
  }

  // ==========================================
  // BIND EVENTS (solo DOM de la página)
  // ==========================================
  function bindEvents() {
    if (!audioEl) return;

    // Hero — Reproducir mix: suena SOLO la playlist activa (la pestaña actual)
    page.querySelector('#heroMix')?.addEventListener('click', () => {
      switchPlaylist(activePlaylistId);
      if (activeList.length) playAt(0);
    });

    // Hero — Aleatorio
    page.querySelector('#heroShuffle')?.addEventListener('click', () => {
      player.setShuffle(true);
      showToast('Aleatorio activado', 'info');
      const pl = getPlaylists().find(p => p.id === 'completas') || getPlaylists()[0];
      if (!pl) return;
      switchPlaylist(pl.id);
      if (activeList.length) playAt(Math.floor(Math.random() * activeList.length));
    });

    // Hero — Escuchar juntos (sincronización en tiempo real)
    page.querySelector('#listenTogetherBtn')?.addEventListener('click', toggleListenTogether);
    // bindEvents() se re-ejecuta en cada render (cada cambio de canción):
    // desuscribir el handler anterior evita acumular suscripciones y aplicar
    // el estado del servidor dos veces (toasts duplicados, seeks dobles).
    offListen();
    offListen = onListenTogether(({ type, payload }) => {
      // 'state' = la sesión cambió (activada, desactivada, peer): sincroniza la UI.
      if (type === 'state') {
        const st = getListenTogetherState();
        listenTogether = st.active;
        listenPeer = st.peerName;
        listenPeerAvatar = st.peerAvatar;
        updateListenChip();
        if (st.active) startSyncTick(); else stopSyncTick();
        // Al activar la sesión, anuncia la canción que está sonando para que
        // el otro dispositivo la adopte (con timestamp de último escritor).
        if (st.active && currentIdx >= 0 && activeList[currentIdx]) {
          const s = activeList[currentIdx];
          maybeBroadcast({
            action: 'song',
            key: songKey(s.title, s.artist),
            t: audioEl?.currentTime || 0,
            playing: isPlaying && !audioEl?.paused
          });
        }
        return;
      }
      if (!listenTogether) return;
      if (type === 'hello') {
        if (payload?.name) {
          listenPeer = payload.name;
          listenPeerAvatar = typeof payload.avatar === 'string' ? payload.avatar : '';
          updateListenChip();
          showToast(`🎧 ${payload.name} está escuchando contigo`, 'success');
        }
        return;
      }
      if (type === 'bye') {
        if (listenPeer) {
          listenPeer = '';
          listenPeerAvatar = '';
          updateListenChip();
          showToast('El otro dispositivo dejó de escuchar', 'info');
        }
        return;
      }
    });
    // Sincroniza el chip con el estado global al entrar (sesión ya activa, etc.)
    updateListenChip();
    // Montaje tardío: si la sesión ya estaba activa al entrar (aceptaste la
    // invitación desde otra página), arranca el tick de sincronización y lee
    // el estado autoritativo del servidor (el tick lo mantiene al día ~3x/s).
    const ltSt = getListenTogetherState();
    if (ltSt.active) {
      startSyncTick();
      fetchListenState().then(st => { if (st && st.song_key) applyServerState(st); });
    } else {
      stopSyncTick();
    }

    // Quitar filtro de la lista
    page.querySelector('#filterClear')?.addEventListener('click', () => {
      activeFilter = null;
      updateUI();
    });

    // "Ver todo" → expande/contrae la sección
    page.querySelectorAll('.music-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = 'music' + btn.dataset.more.charAt(0).toUpperCase() + btn.dataset.more.slice(1);
        page.querySelector('#' + id)?.classList.toggle('is-expanded');
      });
    });

    // Tarjetas de "Escuchado recientemente" → reproducir (o reanudar)
    page.querySelectorAll('.music-cover-card').forEach(card => {
      card.addEventListener('click', () => {
        const title = card.dataset.title;
        const artist = card.dataset.artist;
        const cont = getContinue();
        if (cont && title === cont.title && (cont.time || 0) > 5) { resumeContinue(); return; }
        const idx = activeList.findIndex(s => s.title === title && s.artist === artist);
        if (idx >= 0) { playAt(idx); return; }
        const pl = getPlaylists().find(p => p.songs.some(s => s.title === title && s.artist === artist));
        if (pl) {
          switchPlaylist(pl.id);
          const i2 = activeList.findIndex(s => s.title === title && s.artist === artist);
          if (i2 >= 0) playAt(i2);
        }
      });
    });

    // Pestañas de playlist → cambian la lista activa
    page.querySelectorAll('.music-pl-tab[data-playlist]').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.playlist === activePlaylistId) return;
        switchPlaylist(tab.dataset.playlist);
        scrollToId('musicList');
      });
    });

    // Gestionar la playlist activa (editar / eliminar)
    page.querySelector('#plManageBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      plCardMenu = plCardMenu === activePlaylistId ? null : activePlaylistId;
      updateUI();
    });

    // Favoritas como playlist — reproducirlas todas
    page.querySelector('#favsPlayAll')?.addEventListener('click', () => {
      const pl = getPlaylists().find(p => p.id === 'favoritas');
      if (!pl || !pl.songs.length) return;
      switchPlaylist('favoritas');
      playAt(0);
    });

    // Queue
    page.querySelector('#queueBtn')?.addEventListener('click', () => {
      queuePanelOpen = !queuePanelOpen;
      const panel = page.querySelector('#queuePanel');
      if (panel) {
        panel.style.display = queuePanelOpen ? '' : 'none';
        if (queuePanelOpen) renderQueue();
      }
    });
    page.querySelector('#queueClear')?.addEventListener('click', () => {
      queue = [];
      renderQueue();
      showToast('Cola vaciada', 'info');
    });

    // El reproductor expandido (controles de la canción actual) vive en la
    // barra global (NowPlayingBar); aquí ya no hay tarjeta propia.

    // Search
    const searchInput = page.querySelector('#musicSearch');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          searchQuery = searchInput.value.trim();
          queue = []; // la cola guarda índices de la vista anterior; se invalida al buscar
          updateUI();
        }, 200);
      });
    }
    page.querySelector('#musicSearchClear')?.addEventListener('click', () => {
      searchQuery = '';
      queue = [];
      updateUI();
    });

    // Filter chips (orden) — excluye el chip de filtro activo (#filterClear)
    page.querySelectorAll('.music-filter-chip').forEach(chip => {
      if (!chip.dataset.sort) return;
      chip.addEventListener('click', () => {
        sortBy = chip.dataset.sort;
        queue = []; // el orden cambia los índices de la vista; se invalida la cola pendiente
        updateUI();
      });
    });

    // Track list — fila reproduce, corazón añade/quita favorita
    page.querySelectorAll('.music-track').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('.music-track-fav') || e.target.closest('.music-track-exp')
          || e.target.closest('.music-track-menu') || e.target.closest('.music-track-menu-pop')) return;
        const title = btn.dataset.title;
        const artist = btn.dataset.artist;
        const idx = activeList.findIndex(s => s.title === title && s.artist === artist);
        if (idx >= 0) {
          playAt(idx);
          // Cola de reproducción: al reproducir una canción se rellena con
          // las siguientes de la vista actual (filtrada/ordenada), así el
          // panel de cola es funcional y "Siguiente" avanza por ellas.
          const display = getFilteredSortedList();
          const pos = display.findIndex(s => s.title === title && s.artist === artist);
          queue = pos >= 0
            ? display.slice(pos + 1).map(s => activeList.indexOf(s)).filter(i => i >= 0)
            : [];
          renderQueue();
        }
      });
    });
    page.querySelectorAll('.music-track-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = String(btn.dataset.fav).toLowerCase();
        if (favorites.has(t)) favorites.delete(t); else favorites.add(t);
        saveFavorites();
        updateUI();
      });
    });

    // Track — acceso por teclado (las filas ahora son div con role=button)
    page.querySelectorAll('.music-track').forEach(btn => {
      btn.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === btn) {
          e.preventDefault();
          btn.click();
        }
      });
    });

    // Track — menú ⋮ (añadir/mover a playlist, quitar, ver letra)
    page.querySelectorAll('.music-track-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        trackMenuKey = trackMenuKey === btn.dataset.key ? null : btn.dataset.key;
        updateUI();
      });
    });
    page.querySelectorAll('[data-pl-pick]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        picker = { key: btn.dataset.key, mode: btn.dataset.plPick, fromId: isCustomView ? activePlaylistId : null };
        trackMenuKey = null;
        updateUI();
      });
    });
    page.querySelectorAll('[data-pl-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pl = getPlaylists().find(p => p.id === activePlaylistId);
        if (pl?.isCustom) {
          removeSongFromPlaylist(activePlaylistId, btn.dataset.key).then(ok => {
            if (ok) {
              refreshActiveFromPlaylists();
              showToast('Canción quitada de la playlist', 'info');
            }
            updateUI();
          });
        }
        trackMenuKey = null;
        updateUI();
      });
    });
    page.querySelectorAll('[data-pl-lyrics]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sg = resolveSongByKey(btn.dataset.key);
        if (!sg?.lyrics) return;
        const exp = page.querySelector('#expandedLyrics');
        const lb = page.querySelector('#lyricsLightbox');
        if (exp) exp.innerHTML = sg.lyrics;
        if (lb) lb.style.display = 'flex';
        trackMenuKey = null;
        updateUI();
      });
    });

    // Cola — reproducir a continuación / añadir / quitar (lista y favoritas)
    page.querySelectorAll('[data-qplay-next]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playNextInQueue(btn.dataset.key);
        trackMenuKey = null;
        favMenuTitle = null;
        updateUI();
      });
    });
    page.querySelectorAll('[data-qadd]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addToQueue(btn.dataset.key);
        trackMenuKey = null;
        favMenuTitle = null;
        updateUI();
      });
    });
    page.querySelectorAll('[data-qremove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromQueue(btn.dataset.key);
        trackMenuKey = null;
        favMenuTitle = null;
        updateUI();
      });
    });

    // Eliminar canción del catálogo (solo admin, lista "Todas las canciones").
    // Abre el modal de confirmación; el borrado real ocurre en el modal.
    page.querySelectorAll('[data-song-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        if (!resolveSongByKey(key) || !userStore.isAdmin) return;
        trackMenuKey = null;
        deleteConfirmKey = key;
        updateUI();
      });
    });

    // Modal de confirmación de borrado
    page.querySelector('#songDelCancel')?.addEventListener('click', () => {
      deleteConfirmKey = null;
      updateUI();
    });
    page.querySelector('#songDelCancelBtn')?.addEventListener('click', () => {
      deleteConfirmKey = null;
      updateUI();
    });
    page.querySelector('#songDelModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        deleteConfirmKey = null;
        updateUI();
      }
    });
    page.querySelector('#songDelConfirm')?.addEventListener('click', async () => {
      const key = deleteConfirmKey;
      deleteConfirmKey = null;
      const sg = resolveSongByKey(key);
      if (!sg || !userStore.isAdmin) return;
      try {
        // 1) Base de datos: persiste el catálogo completo SIN la canción.
        //    Así la semilla estática no la recupera al recargar la página.
        const dbSongs = await db.getSongs();
        const merged = dedupeSongs([...ALL_SONGS, ...(Array.isArray(dbSongs) ? dbSongs : [])])
          .filter(s => songKeyOf(s) !== key);
        await db.saveSongs(merged);

        // 2) Catálogo local
        const idx = ALL_SONGS.findIndex(s => songKeyOf(s) === key);
        if (idx < 0) return;

        // 3) Cola pendiente: los índices cambian al borrar; reconstruir por claves
        const queueKeys = queue.map(qi => ALL_SONGS[qi] ? songKeyOf(ALL_SONGS[qi]) : null).filter(Boolean);
        ALL_SONGS.splice(idx, 1);
        queue = queueKeys.filter(k => k !== key)
          .map(k => ALL_SONGS.findIndex(s => songKeyOf(s) === k))
          .filter(i => i >= 0);

        // 4) Si sonaba la canción borrada: la música sigue, pero sin índice válido
        if (currentIdx >= 0) {
          const src = audioEl?.getAttribute('src');
          currentIdx = src ? ALL_SONGS.findIndex(s => s.audio === src) : -1;
        }

        // 5) Quitar de favoritas
        favorites.delete(String(sg.title).toLowerCase());
        saveFavorites();

        // 6) Purga la clave de las playlists compartidas (ya no resuelve)
        await Promise.all(userPlaylists.map(pl => {
          if (!pl.songs.includes(key)) return null;
          return updatePlaylist({ id: pl.id, songs: pl.songs.filter(k => k !== key) });
        }));
        refreshActiveFromPlaylists();
        showToast('Canción eliminada', 'success');
      } catch (err) {
        console.warn('[canciones] no se pudo eliminar la canción:', err);
        showToast('No se pudo eliminar la canción', 'error');
      }
      trackMenuKey = null;
      updateUI();
    });

    // Picker de playlists (añadir / mover canción)
    page.querySelectorAll('.music-picker-item[data-pl-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!picker) return;
        const toId = btn.dataset.plId;
        if (picker.mode === 'move') {
          await moveSong(picker.fromId, toId, picker.key);
          showToast('Canción movida de playlist', 'info');
        } else {
          const ok = await addSongToPlaylist(toId, picker.key);
          showToast(ok ? 'Añadida a la playlist' : 'Ya estaba en esa playlist', ok ? 'success' : 'info');
        }
        refreshActiveFromPlaylists();
        picker = null;
        updateUI();
      });
    });
    page.querySelectorAll('.music-picker-item[data-pl-new]').forEach(btn => {
      btn.addEventListener('click', () => {
        plPendingAdd = picker?.key || null;
        picker = null;
        playlistEditId = 'new';
        plIconSel = '❤️';
        plNameDraft = '';
        updateUI();
      });
    });
    page.querySelector('#plPickerClose')?.addEventListener('click', () => { picker = null; updateUI(); });
    page.querySelector('#plPickerModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) { picker = null; updateUI(); }
    });

    // Editor de playlist (crear / editar)
    page.querySelectorAll('.music-pl-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        plIconSel = btn.dataset.plIcon;
        updateUI();
      });
    });
    page.querySelector('#plNameInput')?.addEventListener('input', (e) => {
      plNameDraft = e.target.value;
    });
    page.querySelector('#plNameInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') page.querySelector('#plEditorSave')?.click();
    });
    page.querySelector('#plEditorSave')?.addEventListener('click', async () => {
      const name = plNameDraft.trim();
      if (!name) { showToast('Ponle un nombre a la playlist', 'warning'); page.querySelector('#plNameInput')?.focus(); return; }
      if (playlistEditId === 'new') {
        const pl = await createPlaylist(name, plIconSel);
        if (plPendingAdd) await addSongToPlaylist(pl.id, plPendingAdd);
        showToast('Playlist creada', 'success');
      } else {
        const existing = userPlaylists.find(p => p.id === playlistEditId);
        if (existing) {
          await updatePlaylist({ ...existing, name, icon: plIconSel });
          showToast('Playlist actualizada', 'success');
        }
      }
      plPendingAdd = null;
      plNameDraft = '';
      playlistEditId = null;
      updateUI();
    });
    page.querySelector('#plEditorCancel')?.addEventListener('click', () => { playlistEditId = null; plPendingAdd = null; plNameDraft = ''; updateUI(); });
    page.querySelector('#plEditorClose')?.addEventListener('click', () => { playlistEditId = null; plPendingAdd = null; plNameDraft = ''; updateUI(); });
    page.querySelector('#plEditorModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) { playlistEditId = null; plPendingAdd = null; plNameDraft = ''; updateUI(); }
    });

    // Nueva playlist desde la sección
    page.querySelector('#plNewBtn')?.addEventListener('click', () => {
      playlistEditId = 'new';
      plIconSel = '❤️';
      plPendingAdd = null;
      plNameDraft = '';
      updateUI();
    });

    // Tarjetas de playlist — menú gestionar (editar / eliminar)
    page.querySelectorAll('.music-playlist-manage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        plCardMenu = plCardMenu === btn.dataset.plManage ? null : btn.dataset.plManage;
        updateUI();
      });
    });
    page.querySelectorAll('.music-playlist-manage-pop [data-pl-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pl = userPlaylists.find(p => p.id === btn.dataset.plEdit);
        if (pl) { playlistEditId = pl.id; plIconSel = pl.icon || '❤️'; plNameDraft = pl.name || ''; }
        plCardMenu = null;
        updateUI();
      });
    });
    page.querySelectorAll('.music-playlist-manage-pop [data-pl-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pl = getPlaylists().find(p => p.id === btn.dataset.plDel);
        plCardMenu = null;
        if (pl && window.confirm(`¿Eliminar la playlist "${pl.name}"?`)) {
          await deletePlaylist(pl.id);
          if (activePlaylistId === pl.id) switchPlaylist('recuerdan');
          showToast('Playlist eliminada', 'info');
          updateUI();
        }
      });
    });

    // Posiciona los popups abiertos en fixed (evita que los scrollers los recorten)
    page.querySelectorAll('.music-track-menu.is-open').forEach(btn => {
      const pop = page.querySelector('.music-track-menu-pop[data-key="' + CSS.escape(btn.dataset.key) + '"]');
      if (pop) positionMenu(btn, pop);
    });
    page.querySelectorAll('.music-pl-manage-btn.is-open').forEach(btn => {
      const pop = page.querySelector('.music-playlist-manage-pop');
      if (pop) positionMenu(btn, pop);
    });

    // Favoritas — la fila reproduce la canción
    const playFav = (row) => {
      const title = row.dataset.title;
      const artist = row.dataset.artist;
      const idx = activeList.findIndex(s => s.title === title && s.artist === artist);
      if (idx >= 0) { playAt(idx); return; }
      const pl = getPlaylists().find(p => p.songs.some(s => s.title === title && s.artist === artist));
      if (pl) {
        switchPlaylist(pl.id);
        const i2 = activeList.findIndex(s => s.title === title && s.artist === artist);
        if (i2 >= 0) playAt(i2);
      }
    };
    page.querySelectorAll('.music-fav-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.music-fav-heart') || e.target.closest('.music-fav-menu-btn')) return;
        playFav(row);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playFav(row); }
      });
    });

    // Favoritas — quitar corazón
    page.querySelectorAll('.music-fav-heart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        favorites.delete(String(btn.dataset.fav).toLowerCase());
        saveFavorites();
        updateUI();
      });
    });

    // Favoritas — menú ⋮ (ver letra / quitar)
    page.querySelectorAll('.music-fav-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        favMenuTitle = favMenuTitle === btn.dataset.menu ? null : btn.dataset.menu;
        updateUI();
      });
    });
    page.querySelectorAll('.music-fav-menu-item[data-lyrics]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sg = [...SONGS_RECUERDAN, ...ALL_SONGS].find(x => x.title === btn.dataset.lyrics);
        if (!sg?.lyrics) return;
        const exp = page.querySelector('#expandedLyrics');
        const lb = page.querySelector('#lyricsLightbox');
        if (exp) exp.innerHTML = sg.lyrics;
        if (lb) lb.style.display = 'flex';
        favMenuTitle = null;
        page.querySelector('.music-fav-menu')?.remove();
      });
    });
    page.querySelectorAll('.music-fav-menu-item[data-unfav]').forEach(btn => {
      btn.addEventListener('click', () => {
        favorites.delete(String(btn.dataset.unfav).toLowerCase());
        saveFavorites();
        favMenuTitle = null;
        updateUI();
      });
    });

    // Lyrics toggle
    page.querySelector('#toggleLyrics')?.addEventListener('click', () => {
      lyricsOpen = !lyricsOpen;
      page.querySelector('#lyricsSection')?.classList.toggle('is-collapsed', !lyricsOpen);
    });

    // Lyrics lightbox
    page.querySelector('#lyricsPanel')?.addEventListener('dblclick', () => {
      const el = page.querySelector('#expandedLyrics');
      const panel = page.querySelector('#lyricsPanel');
      if (el && panel) el.innerHTML = panel.innerHTML;
      const lb = page.querySelector('#lyricsLightbox');
      if (lb) lb.style.display = 'flex';
    });
    page.querySelector('#closeLightbox')?.addEventListener('click', () => {
      const lb = page.querySelector('#lyricsLightbox');
      if (lb) lb.style.display = 'none';
    });
    page.querySelector('#lyricsLightbox')?.addEventListener('click', (e) => {
      if (e.target === page.querySelector('#lyricsLightbox')) {
        page.querySelector('#lyricsLightbox').style.display = 'none';
      }
    });
  }

  function renderQueue() {
    const list = page.querySelector('#queueList');
    if (!list) return;
    if (queueMenuPos !== null && queueMenuPos >= queue.length) queueMenuPos = null;
    if (!queue.length) {
      queueMenuPos = null;
      list.innerHTML = '<div class="music-queue-empty">La cola está vacía. Reproduce canciones para añadirlas.</div>';
      return;
    }
    const MORE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';
    list.innerHTML = queue.map((idx, i) => {
      const s = activeList[idx];
      if (!s) return '';
      const open = queueMenuPos === i;
      return `<div class="music-queue-item ${open ? 'is-open' : ''}" data-qpos="${i}" role="button" tabindex="0" aria-label="Reproducir ${escapeHtml(s.title)}">
        <span class="music-queue-num">${i + 1}</span>
        <img src="${s.cover}" alt="" class="music-queue-cover" loading="lazy">
        <div class="music-queue-info">
          <strong>${escapeHtml(s.title)}</strong>
          <span>${escapeHtml(s.artist)}</span>
        </div>
        <button class="music-queue-more ${open ? 'is-open' : ''}" data-qmenu="${i}" type="button" title="Más opciones" aria-label="Más opciones de ${escapeHtml(s.title)}">${MORE_ICON}</button>
        ${open ? `<div class="music-queue-menu-pop" data-qpop="${i}">
          <button class="music-track-menu-item" data-qplay-now="${i}" type="button">${MUSIC_ICONS.play(15)} Reproducir ahora</button>
          <button class="music-track-menu-item is-danger" data-qremove-pos="${i}" type="button">${MUSIC_ICONS['list-x'](15)} Quitar de la cola</button>
        </div>` : ''}
      </div>`;
    }).join('');

    // La fila reproduce la canción y la saca de la cola pendiente
    list.querySelectorAll('.music-queue-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.music-queue-more') || e.target.closest('.music-queue-menu-pop')) return;
        const pos = parseInt(row.dataset.qpos, 10);
        const idx = queue[pos];
        if (idx === undefined) return;
        queue.splice(pos, 1);
        queueMenuPos = null;
        renderQueue();
        playAt(idx);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });
    });
    list.querySelectorAll('.music-queue-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        queueMenuPos = queueMenuPos === Number(btn.dataset.qmenu) ? null : Number(btn.dataset.qmenu);
        renderQueue();
      });
    });
    list.querySelectorAll('[data-qplay-now]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pos = parseInt(btn.dataset.qplayNow, 10);
        const idx = queue[pos];
        if (idx === undefined) return;
        queue.splice(pos, 1);
        queueMenuPos = null;
        renderQueue();
        playAt(idx);
      });
    });
    list.querySelectorAll('[data-qremove-pos]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        queue.splice(parseInt(btn.dataset.qremovePos, 10), 1);
        queueMenuPos = null;
        renderQueue();
      });
    });

    // Posiciona el popup ⋮ abierto (fixed, sin recortarse dentro del panel)
    const openBtn = list.querySelector('.music-queue-more.is-open');
    if (openBtn) {
      const pop = list.querySelector('.music-queue-menu-pop[data-qpop="' + openBtn.dataset.qmenu + '"]');
      if (pop) positionMenu(openBtn, pop);
    }
  }

  // Keyboard shortcuts
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight' && e.ctrlKey) nextSong();
    if (e.key === 'ArrowLeft' && e.ctrlKey) prevSong();
    if (e.key === 'Escape' && deleteConfirmKey) {
      deleteConfirmKey = null;
      updateUI();
    }
  }

  // Init
  // Si ya hay música sonando (barra global), muestra el tema en el hero
  // en vez de arrancar la página en "Elige una canción".
  if (player.info) {
    const playingSrc = player.audio.getAttribute('src');
    const matchIdx = activeList.findIndex(s =>
      (playingSrc && s.audio === playingSrc) || s.title === player.info.title
    );
    if (matchIdx >= 0) {
      currentIdx = matchIdx;
      isPlaying = player.isPlaying;
    }
  }

  // Órdenes desde la barra global y Media Session → esta página las ejecuta
  // (cola, shuffle, auto-avance). Se desuscribe en cleanup.
  const offPlayer = player.subscribe((e) => {
    if (e.type === 'next') nextSong();
    else if (e.type === 'prev') prevSong();
    else if (e.type === 'toggle') togglePlay();
    else if (e.type === 'change' && typeof e.playing === 'boolean' && e.playing !== isPlaying) {
      isPlaying = e.playing;
      updatePlayBtn();
    }
  });

  // Vistas desde la sidebar (Explorar / Biblioteca / Favoritas / Playlists / Historial)
  let viewScrollId = null;
  try {
    const q = (router?.getCurrentPath?.().split('?')[1] || '');
    const v = new URLSearchParams(q).get('v');
    if (v === 'biblioteca') { /* por defecto: lista completa */ viewScrollId = 'musicList'; }
    else if (v === 'favoritas') {
      const pl = getPlaylists().find(p => p.id === 'favoritas');
      if (pl) { activePlaylistId = pl.id; activeList = pl.songs; }
      viewScrollId = 'musicList';
    }
    else if (v === 'playlists') viewScrollId = 'musicList';
    else if (v === 'historial') viewScrollId = 'musicRecent';
  } catch { /* ignorar */ }

  const unwireAudio = wireAudioEvents();
  // Botón "Cola" del reproductor expandido (barra global): venimos con la
  // orden de abrir el panel de cola directamente. La bandera cubre la llegada
  // desde otra página (la lee este init antes del primer render); el evento
  // cubre el caso de estar YA en Canciones (el router no re-monta la página).
  if (sessionStorage.getItem('ph.openQueue')) {
    sessionStorage.removeItem('ph.openQueue');
    queuePanelOpen = true;
  }
  const onOpenQueue = () => {
    if (!page.isConnected) return;
    queuePanelOpen = true;
    updateUI();
    scrollToId('queuePanel');
  };
  window.addEventListener('ph:open-queue', onOpenQueue);
  render();
  bindEvents();
  if (queuePanelOpen && page.querySelector('#queuePanel')) scrollToId('queuePanel');
  document.addEventListener('keydown', onKeyDown);

  // Cierra los menús ⋮ al hacer clic fuera. El elemento page persiste entre
  // renders, así que este listener se registra UNA sola vez (y se suelta en
  // cleanup), sin acumularse en cada updateUI.
  const offOutsideClick = (e) => {
    if (trackMenuKey && !e.target.closest('.music-track-menu') && !e.target.closest('.music-track-menu-pop')) {
      trackMenuKey = null;
      page.querySelectorAll('.music-track-menu-pop').forEach(p => p.remove());
      page.querySelectorAll('.music-track-menu.is-open').forEach(b => b.classList.remove('is-open'));
    }
    if (plCardMenu && !e.target.closest('.music-pl-manage-btn') && !e.target.closest('.music-playlist-manage-pop')) {
      plCardMenu = null;
      page.querySelectorAll('.music-playlist-manage-pop').forEach(p => p.remove());
      page.querySelectorAll('.music-pl-manage-btn.is-open').forEach(b => b.classList.remove('is-open'));
    }
  };
  page.addEventListener('click', offOutsideClick);

  // Scroll a la sección pedida desde la sidebar (tras el primer render)
  if (viewScrollId) scrollToId(viewScrollId);

  // Load first track (solo si no hay música sonando: la barra global manda)
  const cont = getContinue();
  if (cont && audioEl && !player.info) {
    // Will be handled by continue card click (o reanudación automática si
    // llegamos desde la tarjeta "Sigue escuchando" del Home con ?continue=1)
    setTimeout(() => {
      if (player.info) return; // el usuario ya ha puesto otra cosa a sonar
      if (audioEl) {
        const s = activeList[0];
        if (s) audioEl.src = s.audio;
      }
      const wantResume = router?.getCurrentPath?.().includes('continue=1');
      if (wantResume && cont) resumeContinue();
    }, 100);
  } else if (!player.info) {
    setTimeout(() => {
      if (player.info) return;
      if (activeList.length && audioEl) {
        audioEl.src = activeList[0].audio;
        currentIdx = 0;
      }
    }, 100);
  }

  // Precargar duraciones de la lista visible (solo la primera vez por URL)
  preloadDurations(activeList.map(s => s.audio));

  // Sincroniza el catálogo del Admin (Supabase) con la biblioteca:
  // la sección parte de una semilla estática y el panel Admin alimenta
  // canciones nuevas SIN duplicar las existentes, y actualiza audio/cover
  // de canciones ya conocidas (mismo título+artista) cuando el Admin las edita.
  // Se usa tanto al cargar como en tiempo real (realtime.service).
  async function mergeDbSongs() {
    try {
      const dbSongs = await db.getSongs();
      if (!Array.isArray(dbSongs) || !dbSongs.length) return;
      const keyOf = (s) => (String(s.title || '') + '|' + String(s.artist || '')).toLowerCase().trim();
      let changed = false;
      // 1. Actualiza canciones existentes (ediciones del Admin)
      const known = new Map(ALL_SONGS.map(s => [keyOf(s), s]));
      dedupeSongs(dbSongs).forEach(adminSong => {
        const k = keyOf(adminSong);
        const local = known.get(k);
        if (local) {
          // Conserva lyrics/moods/experience; refresca lo editable
          if (adminSong.audio && adminSong.audio !== local.audio) { local.audio = adminSong.audio; changed = true; }
          if (adminSong.cover && adminSong.cover !== local.cover) { local.cover = adminSong.cover; changed = true; }
        }
      });
      // 2. Añade canciones nuevas del Admin
      const existingKeys = new Set(ALL_SONGS.map(keyOf));
      const extra = dedupeSongs(dbSongs).filter(s => !existingKeys.has(keyOf(s)));
      if (extra.length) {
        ALL_SONGS.splice(0, ALL_SONGS.length, ...dedupeSongs([...ALL_SONGS, ...extra]));
        changed = true;
      }
      if (changed) updateUI(); // re-renderiza preservando el estado de reproducción
    } catch { /* semilla estática: sin cambios */ }
  }

  mergeDbSongs();

  // Tiempo real: cuando el Admin añade/edita canciones, la biblioteca se
  // actualiza al instante sin recargar (audio/portada nuevos incluidos).
  const offContent = onContentChange(['canciones'], mergeDbSongs);

  // Playlists compartidas: carga inicial + cambios (locales y tiempo real).
  // Ambas se pueden crear/editar; los cambios del otro aparecen al instante.
  loadPlaylists().then(list => {
    userPlaylists = list;
    updateUI();
  }).catch(() => {});
  const offPlChange = onPlaylistsChange((list) => {
    userPlaylists = list;
    refreshActiveFromPlaylists();
    updateUI();
  });
  initPlaylistsRealtime();

  // Cleanup — el audio NO se pausa aquí: la música sigue sonando al
  // navegar (barra global + Media Session). Solo se sueltan los listeners
  // y se guarda la posición para reanudar después.
  page.cleanup = () => {
    offContent();
    offPlChange();
    offPlayer();
    offListen();
    stopSyncTick(); // detiene el tick de sincronización (~3x/s)
    // La sesión compartida vive en el servicio global: no se detiene al
    // salir de Canciones (la música sigue sonando al navegar).
    unwireAudio();
    page.removeEventListener('click', offOutsideClick);
    preloadToken++; // aborta la precarga de duraciones en curso
    clearTimeout(saveDurTimer); // vacía el debounce pendiente
    try { localStorage.setItem(userPrefKey('trackDurations'), JSON.stringify(trackDurations)); } catch { /* ignorar */ }
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('ph:open-queue', onOpenQueue);
    if (isPlaying && currentIdx >= 0) {
      saveContinue(activePlaylistId, currentIdx, audioEl?.currentTime || 0);
    }
  };

  return page;
}
