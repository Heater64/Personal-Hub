/* ==========================================
   Personal Hub v2 — Canciones Page
   Premium Music App: playlists, search, queue, continue listening
   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { formatTime } from '../utils/format.js';
import { userPrefKey, migrateUserPref } from '../utils/userStorage.js';
import { db } from '../services/db.service.js';
import { onContentChange } from '../services/realtime.service.js';
import { player } from '../services/player.service.js';

const SONGS_BASE = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

const PLAYLIST_ICONS = { romanticas: '❤️', animadas: '🎉', relajantes: '😴', favoritas: '⭐', todas: '🎵', recientes: '🕐' };

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
  { title: "Mon amour Remix", artist: "Aitana y Zzoilo", cover: "https://i1.sndcdn.com/artworks-leykoA0rJXWDmQya-cyfPxg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a", moods: ['romanticas','animadas'] },
  { title: "Tiroteo (Remix)", artist: "Marc Seguí, Rauw Alejandro, Pol Granch", cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", moods: ['romanticas','relajantes'] },
  { title: "Contando Lunares", artist: "Don Patricio", cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777748473/contando_lunares_bjxcmo.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748328/DON_PATRICIO_CRUZ_CAFUN%C3%89_-_CONTANDO_LUNARES_tsyd6p.m4a", moods: ['romanticas','relajantes'] },
  { title: "Rara Vez", artist: "Milo J, Taiu", cover: "https://m.media-amazon.com/images/I/51O0iMUUz7L._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748873/Taiu_Milo_j_-_Rara_Vez_bwkba4.m4a", moods: ['romanticas','relajantes'] },
  { title: "Si Estoy a Tu Lado", artist: "Rabelay", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-ywl-ZgPTD9d7uezXWmcCixIhCxdKb0cmRA&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748874/Rabelay_-_Si_Estoy_a_Tu_Lado_Oficial_nvbx34.m4a", moods: ['romanticas','relajantes'] },
  { title: "Pareja del Año", artist: "Sebastián Yatra, Myke Towers", cover: "https://i.scdn.co/image/ab67616d0000b273311aebbc00f1cd4cd16bacbc", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Sebasti%C3%A1n_Yatra_-_Tacones_Rojos_Official_Video_o09dxd.m4a", moods: ['romanticas'] },
  { title: "COSAS QUE NO TE DIJE", artist: "Saiko", cover: "https://images.genius.com/acb90eccfc4f36d9675d8d2f58c86670.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Saiko_-_COSAS_QUE_NO_TE_DIJE_Official_Video_dbpazx.m4a", moods: ['romanticas'] },
  { title: "Quiero Decirte", artist: "Abraham Mateo, Ana Mena", cover: "https://images.genius.com/7e834ed5f2fd7a331d2e8d4f948cda4b.1000x1000x1.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748876/Abraham_Mateo_Ana_Mena_-_Quiero_Decirte_myiibs.m4a", moods: ['romanticas'] },
  { title: "Just the Way You Are", artist: "Bruno Mars", cover: "https://cdn-images.dzcdn.net/images/cover/5b59dc18e109515420f8237719bd2186/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748879/Bruno_Mars_-_Just_The_Way_You_Are_i8mkhd.m4a", experience: 'justthewayyouare', moods: ['romanticas'] },
  { title: "Ven a la Carrera", artist: "Pocoyó", cover: "https://i.scdn.co/image/ab67616d0000b2730952f5f2ec131e56b3ba7b27", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748881/%EF%B8%8FPOCOY%C3%93_-_Ven_a_la_Carrera_ysppwm.m4a", moods: ['animadas'] },
  { title: "Besos en Guerra", artist: "Morat, Juanes", cover: "https://i.scdn.co/image/ab67616d0000b2738fa1c3557fd95f9dd67ec235", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748882/Morat_Juanes_-_Besos_en_Guerra_Letra._vnnvdn.m4a", moods: ['romanticas'] },
  { title: "Carita de Buena", artist: "Efecto Pasillo", cover: "https://m.media-amazon.com/images/I/61F144gibPL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748883/Efecto_Pasillo_-_Carita_de_Buena_Letra_ja14lf.m4a", moods: ['animadas'] },
  { title: "Cupid twin version", artist: "FIFTY FIFTY", cover: "https://i.scdn.co/image/ab67616d0000b27337c0b3670236c067c8e8bbcb", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748884/FIFTY_FIFTY_-_Cupid_Twin_Version_Lyrics_hfw31y.m4a", moods: ['romanticas','animadas'] },
  { title: "Pan y Mantequilla", artist: "Efecto Pasillo", cover: "https://i.scdn.co/image/ab67616d0000b2735953c71f6d0e995f71f63ae4", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748885/Pan_y_Mantequilla_ejmvcl.m4a", moods: ['animadas'] },
  { title: "La Plena", artist: "Beéle Westcol, Ovy On The Drums", cover: "https://i.scdn.co/image/ab67616d0000b273c0353d023daf5ebda0eb003b", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748886/Be%C3%A9le_Westcol_Ovy_On_The_Drums_-_LA_PLENA_W_Sound_05_jz2fsz.m4a", moods: ['animadas'] },
  { title: "Snowman", artist: "Sia", cover: "https://i.scdn.co/image/ab67616d0000b273a75e532b61dac3ddafd022ef", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748887/Sia_-_Snowman_Lyrics_ym54x5.m4a", moods: ['relajantes'] },
  { title: "miau", artist: "Young Cister", cover: "https://images.genius.com/aa41a24ecbac2a1324c4cb84cc158f76.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748889/Young_Cister_-_miau_Video_Oficial_2_rr561t.m4a", moods: ['animadas'] },
  { title: "I Love It", artist: "Icona Pop, Charli XCX", cover: "https://m.media-amazon.com/images/I/51e5k9eRKvL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748890/Vietsub_I_Love_It_Icona_Pop___Charli_XCX_Lyrics_Video_1_tn4f7c.m4a", moods: ['animadas'] },
  { title: "Capaz", artist: "Alleh Yorghaki", cover: "https://cdn-images.dzcdn.net/images/cover/88e65c70ef15315045b6bf85d38b11f2/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748891/Alleh_Yorghaki_-__capaz__OFFICIAL_VERSION_iutvie.m4a", moods: ['romanticas','relajantes'] },
  { title: "Downtown", artist: "Anitta, J Balvin", cover: "https://i.scdn.co/image/ab67616d0000b2738c6b830c36c7b4ac43c3cee8", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748892/Anitta_J_Balvin_-_DOWNTOWN_Letra_vw8h3l.m4a", moods: ['animadas'] },
  { title: "Porfa no te vayas", artist: "Beret, Morat", cover: "https://cdn-images.dzcdn.net/images/cover/82a6297e55cbb85c75cedbbb3a8e1443/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748898/Beret_Morat_-_Porfa_no_te_vayas_Videoclip_Oficial_1_gxrelc.m4a", moods: ['romanticas','relajantes'] },
  { title: "Count on Me", artist: "Bruno Mars", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSaonOWEQEDMwIQmhHmBRiWrqKgcKYWQjQTiQ&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748900/Bruno_Mars_-_Count_on_Me_Official_Lyric_Video_1_xli1q5.m4a", moods: ['animadas'] },
  { title: "Caliente", artist: "Ricky edit", cover: "https://s.mxmcdn.net/images-storage/albums2/9/5/3/5/2/3/64325359_350_350.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748901/caliente_-_rickyedit_1_pe7zjc.m4a", moods: ['animadas'] },
  { title: "X Remix", artist: "Nicky Jam, J Balvin, Ozuna, Maluma", cover: "https://i.scdn.co/image/ab67616d0000b27326129b4b928f0f97ba344545", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748902/X_Remix_-_Nicky_Jam_x_J_Balvin_x_Ozuna_x_Maluma_cqklqd.m4a", moods: ['animadas'] },
  { title: "Viva La Vida", artist: "Coldplay", cover: "https://m.media-amazon.com/images/I/9145yafeO2L._UF894,1000_QL80_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748903/Coldplay_-_Viva_La_Vida_Official_Video_rjwiqg.m4a", moods: ['animadas'] },
  { title: "3 AM", artist: "Eladio Carrión, Brytiago", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCWfQQxORCJbF-JVcNQ2qouJQqMA0C4Arkdg&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748904/Eladio_Carri%C3%B3n_Brytiago_-_3_AM_Visualizer___Sauce_Boyz_paeyvx.m4a", moods: ['animadas'] },
  { title: "Qué Bonita", artist: "Cano", cover: "https://cdn-images.dzcdn.net/images/cover/e65d06182e60952beb733eefe35a1d75/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748905/El_Mismo_Sol_svyp5p.m4a", moods: ['romanticas'] },
  { title: "Bailando", artist: "Enrique Iglesias", cover: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c0/Enriquebailandocover.jpg/250px-Enriquebailandocover.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748907/Enrique_Iglesias___Bailando_Lyrics_feat_Descemer_Bueno__Gente_De_pvlefu.m4a", moods: ['romanticas','animadas'] },
  { title: "DUELE EL CORAZÓN", artist: "Enrique Iglesias", cover: "https://i1.sndcdn.com/artworks-000164317296-txl7y7-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748909/Enrique_Iglesias_-_DUELE_EL_CORAZON_Lyric_Video_ft._Wisin_v27ra0.m4a", moods: ['animadas'] },
  { title: "La Bachata", artist: "MTZ Manuel Turizo", cover: "https://i1.sndcdn.com/artworks-HG9Rj4F1lgzFynKw-jpIVmQ-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748910/La_Bachata_-_MTZ_Manuel_Turizo___Video_Oficial_thrsqd.m4a", moods: ['romanticas','animadas'] },
  { title: "El Merengue", artist: "MTZ Manuel Turizo", cover: "https://cdn-p.smehost.net/sites/5b3bac59eb36401694af3a241173447f/wp-content/uploads/2023/03/93201a3b-066d-4ae6-8fba-92694479a310.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748911/Marshmello_Manuel_Turizo_-_El_Merengue_j0d5t6.m4a", moods: ['animadas'] },
  { title: "1000 Cosas", artist: "MTZ Manuel Turizo", cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777751326/1000_cosas_nzka1y.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748912/Lola_Indigo_Manuel_Turizo_-_1000_Cosas_Letra___Lyrics_hs1gu0.m4a", moods: ['romanticas'] },
  { title: "Die With a Smile", artist: "Lady Gaga, Bruno Mars", cover: "https://cdn-images.dzcdn.net/images/cover/4bd5903f4ce8f2601916bfadb44efe8a/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748913/Lady_Gaga_Bruno_Mars_-_Die_With_A_Smile_defupf.m4a", moods: ['romanticas'] },
  { title: "BELIEVER", artist: "Imagine Dragons", cover: "https://i.scdn.co/image/ab67616d0000b2735675e83f707f1d7271e5cf8a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748915/Imagine_Dragons_-_Believer_Lyrics_kfi5ha.m4a", moods: ['animadas'] },
  { title: "Si No Estás", artist: "Iñigo Quintero", cover: "https://i.scdn.co/image/ab67616d0000b273c0a5c14b34a02f242af03359", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748916/i%C3%B1igo_quintero_-_Si_No_Est%C3%A1s_Letra_Oficial_1_lraiuu.m4a", moods: ['romanticas','relajantes'] },
  { title: "Si Antes Te Hubiera Conocido", artist: "Karol G", cover: "https://i1.sndcdn.com/artworks-TTDsE8Jj2gF855AL-hFnpUQ-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748917/KAROL_G_-_Si_Antes_Te_Hubiera_Conocido___Coke_Studio_sxezkk.m4a", moods: ['romanticas','animadas'] },
  { title: "Firework", artist: "Katy Perry", cover: "https://m.media-amazon.com/images/M/MV5BMWRmMWVlOWYtOWQ2Yi00MjdmLTliNGUtOTk1N2M4MmQwZmJkXkEyXkFqcGc@._V1_QL75_UY190_CR2,0,190,190_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748918/Katy_Perry_-_Firework_Lyrics_qgmiip.m4a", moods: ['animadas'] },
  { title: "I Kissed A Girl", artist: "Katy Perry", cover: "https://upload.wikimedia.org/wikipedia/en/5/5c/I_Kissed_a_Girl.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748919/Katy_Perry_-_I_Kissed_A_Girl_Official_Music_Video_qdtvxf.m4a", moods: ['animadas'] },
  { title: "La Cintura", artist: "Alvaro Soler", cover: "https://i1.sndcdn.com/artworks-000326908518-qfg6dg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748920/La_Cintura_-_Alvaro_Soler_Letra_lyrics_knrjhe.m4a", moods: ['animadas'] },
  { title: "como estrellas", artist: "YOUNG", cover: "https://i.scdn.co/image/ab67616d0000b273866265358ce5d4770b67ab8d", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748921/LA_YounG_-_Como_Estrellas_pvizll.m4a", moods: ['romanticas','relajantes'] },
  { title: "Until I Found You", artist: "Stephen Sanchez", cover: "https://cdn-images.dzcdn.net/images/cover/8a6477b222dac17081d9b9b1729a1ca4/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748931/Stephen_Sanchez_-_Until_I_Found_You_Lyrics_1_rakcvt.m4a", moods: ['romanticas','relajantes'] },
  { title: "Malito", artist: "Maluma", cover: "https://i.scdn.co/image/ab67616d0000b273b89593a15f6a40fd6d7de40c", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748932/Malito_w8w0t2.m4a", moods: ['animadas'] },
  { title: "quelamamen", artist: "Ricky edit", cover: "https://cdn-images.dzcdn.net/images/cover/6c56dd16a8da24c8e59781231e29442b/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748937/quelamamen_-_rickyedit_t0yfas.m4a", moods: ['animadas'] },
  { title: "Ahora Y Siempre", artist: "Quevedo", cover: "https://i.scdn.co/image/ab67616d0000b2738517e3f690cdabf1a616b2e8", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748939/Quevedo_-_Ahora_Y_Siempre_Letra_Lyrics_x6edyd.m4a", moods: ['romanticas'] },
  { title: "Cuando Te Vi", artist: "Maria Becerra, Trueno", cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/6/f/9/d/2282831720092918.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748940/Maria_Becerra_Trueno_Big_One_-_Cuando_Te_Vi___CROSSOVER_5_eaa8fv.m4a", moods: ['romanticas','animadas'] },
  { title: "Todo de Ti", artist: "Rauw Alejandro", cover: "https://i.scdn.co/image/ab67616d0000b273c160ede886e4e54350c0cec9", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748941/Rauw_Alejandro_-_Todo_de_Ti_Video_Oficial_fucazk.m4a", moods: ['romanticas','animadas'] },
  { title: "real gangsta love", artist: "Trueno", cover: "https://images.genius.com/d7ae872dffe2dda742204c6fd4256e4e.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748942/Trueno_-_REAL_GANGSTA_LOVE_Official_Video_bzn4xz.m4a", moods: ['animadas'] },
  { title: "Belong Together", artist: "Mark Ambor", cover: "https://i.ytimg.com/vi/xPWnNFF-TAw/sddefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748944/Mark_Ambor_-_Belong_Together_Lyrics_o7nepu.m4a", moods: ['romanticas'] },
  { title: "sway", artist: "Michael Bublé", cover: "https://i1.sndcdn.com/artworks-mfRYr4OtlumkBA1q-pL2Mfg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748945/Michael_Bubl%C3%A9_-_Sway_Lyrics_twaz4d.m4a", moods: ['romanticas','relajantes'] },
  { title: "CLASSIC", artist: "mkto", cover: "https://i.scdn.co/image/ab67616d0000b2739474419f15773875a495eed3", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748946/MKTO_-_Classic_Lyrics_yrsqeh.m4a", moods: ['animadas'] },
  { title: "A Dónde Vamos", artist: "Morat", cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/3/0/1/4/1111981626430157.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748947/Morat_-_A_D%C3%B3nde_Vamos_Letra___Albert_Maricheli_y9psss.m4a", moods: ['romanticas'] },
  { title: "La Falda", artist: "Myke Towers", cover: "https://i1.sndcdn.com/artworks-r0TxDn1vZJbLEO3p-ROydVw-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748949/Myke_Towers_-_LA_FALDA_Letra_Lyrics_mwn6s0.m4a", moods: ['animadas'] },
  { title: "Como Te Atreves", artist: "Morat", cover: "https://images.genius.com/71945fe483298a6e9a160ba4aa8050c9.1000x1000x1.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748950/Morat_-_C%C3%B3mo_Te_Atreves_Video_Oficial_blq8d9.m4a", moods: ['romanticas'] },
  { title: "SOLO AMIGOS", artist: "Adexe y Nau", cover: "https://images.genius.com/ea89db66f1b4f18e011613e093611da1.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748951/Solo_amigos_-_Adexe_y_Nau_Letra_lyrics_wmuawk.m4a", moods: ['romanticas'] },
  { title: "THERE'S NOTHING HOLDING ME BACK", artist: "Shawn Mendes", cover: "https://cdn-images.dzcdn.net/images/cover/3e2d3bad308509ecc59dc6de76ac7896/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748952/Shawn_Mendes_There_s_Nothing_Holding_Me_Back_Lyrics_e3lpar.m4a", moods: ['animadas'] },
  { title: "save your tears", artist: "The Weeknd", cover: "https://cdn-images.dzcdn.net/images/cover/4acc3760e12996fe21a77115fc67760b/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748955/The_Weeknd_-_Save_Your_Tears_Official_Music_Video_ed2oy0.m4a", moods: ['relajantes'] },
  { title: "Indeciso", artist: "Reik, J Balvin, Lalo Ebratt", cover: "https://m.media-amazon.com/images/I/51pJA4vGKvL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748956/Reik_J_Balvin_Lalo_Ebratt_-_Indeciso_Letra_lqpkqv.m4a", moods: ['romanticas','animadas'] },
  { title: "La Mordidita", artist: "Ricky Martin", cover: "https://i.scdn.co/image/ab67616d0000b27388d450740b559cabdde15d35", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748957/Ricky_Martin_-_La_Mordidita_ft._Yotuel_Letra_vgdin6.m4a", moods: ['animadas'] },
  { title: "Vente Pa' Ca", artist: "Ricky Martin", cover: "https://i.scdn.co/image/ab67616d0000b273a7009065e3adf3430e04f63a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748958/Ricky_Martin_-_Vente_Pa__Ca_ft._Maluma_Letra_Lyrics_bplzdf.m4a", moods: ['animadas'] },
  { title: "Umbrella", artist: "Rihanna", cover: "https://cdn-images.dzcdn.net/images/cover/91276466fbc876d96be9e6926060af60/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748960/Rihanna_Umbrella_Orange_Version_Official_Music_Video_ft_JAY_Z_fpihd1.m4a", moods: ['animadas'] },
  { title: "APT.", artist: "ROSÉ, Bruno Mars", cover: "https://m.media-amazon.com/images/I/51vAIGPAURL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748961/ROSE%CC%81_Bruno_Mars_-_APT._Official_Music_Video_ydbvc7.m4a", moods: ['animadas'] },
  { title: "Flashes", artist: "RØZ Yng Lvcas", cover: "https://i1.sndcdn.com/artworks-aRMFevdQLRYYTTXi-IRfYkw-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748962/R%C3%98Z_Yng_Lvcas_-_flashes_zvoqsg.m4a", moods: ['animadas'] },
  { title: "Despechá", artist: "ROSALÍA", cover: "https://i.scdn.co/image/ab67616d0000b273938660520f09a1bae2ed4699", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748973/ROSAL%C3%8DA_-_DESPECH%C3%81_Official_Video_ehc9gl.m4a", moods: ['animadas'] },
  { title: "Supernova", artist: "SAIKO", cover: "https://i.scdn.co/image/ab67616d0000b273c3f5b9580dfc96c80705424a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748974/SAIKO_-_SUPERNOVA_Official_Video___SAKURA_kiwn0u.m4a", moods: ['animadas'] },
  { title: "Without Me", artist: "Eminem", cover: "https://m.media-amazon.com/images/I/819VvnW1QZL._UF894,1000_QL80_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748976/Eminem_-_Without_Me_Lyrics_rbyen5.m4a", moods: ['animadas'] },
  { title: "Beauty and a Beat", artist: "Justin Bieber", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsKPNxCtWtPm7_d468VnoWxPSBsOyZk67HcA&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748977/Justin_Bieber_Beauty_And_A_Beat_Official_Music_Video_ft_Nicki_Minaj_ivdtfp.m4a", moods: ['animadas'] },
  { title: "Fuego", artist: "Don Omar", cover: "https://i.musicaimg.com/letras/250x250/don-omar.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748984/Fuego_-_Una_Vaina_Loca_Ft._El_Potro_Alvarez_Official_Video_rp0xvr.m4a", moods: ['animadas'] },
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
    { id: 'recuerdan', name: '❤️ Recuerdan a ti', desc: 'Canciones que me recuerdan a ti', cover: null, songs: SONGS_RECUERDAN, count: SONGS_RECUERDAN.length },
    { id: 'completas', name: '🎵 Biblioteca completa', desc: 'Todas las canciones del hub', cover: null, songs: ALL_SONGS, count: ALL_SONGS.length },
    { id: 'favoritas', name: '⭐ Favoritas', desc: 'Las canciones que más nos gustan', cover: null, songs: allFavs, count: allFavs.length },
    { id: 'romanticas', name: '❤️ Románticas', desc: 'Para dedicar con el corazón', cover: null, songs: ALL_SONGS.filter(s => s.moods?.includes('romanticas')), count: ALL_SONGS.filter(s => s.moods?.includes('romanticas')).length },
    { id: 'animadas', name: '🎉 Para animarse', desc: 'Sube el volumen y a bailar', cover: null, songs: ALL_SONGS.filter(s => s.moods?.includes('animadas')), count: ALL_SONGS.filter(s => s.moods?.includes('animadas')).length },
    { id: 'relajantes', name: '😴 Para relajarse', desc: 'Baja las revoluciones', cover: null, songs: ALL_SONGS.filter(s => s.moods?.includes('relajantes')), count: ALL_SONGS.filter(s => s.moods?.includes('relajantes')).length },
  ].filter(p => p.count > 0);
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
  let activePlaylistId = 'recuerdan';
  let activeList = SONGS_RECUERDAN;
  let currentIdx = -1;
  let isPlaying = false;
  // Audio GLOBAL (player.service): sobrevive a re-renders y a la navegación.
  let audioEl = player.audio;
  let consecutiveErrors = 0; // guarda anti-bucle al saltar pistas rotas
  let shuffleMode = false;
  let shuffleHistory = [];
  // Favoritos normalizados en minúsculas + aislados por usuario (migración legacy incluida)
  migrateUserPref('favSongs');
  let favorites = new Set((JSON.parse(localStorage.getItem(userPrefKey('favSongs')) || '[]') || []).map(t => String(t).toLowerCase()));
  let queue = []; // indices in activeList
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

  function getPlaylists() { return buildPlaylists(favorites); }

  function switchPlaylist(playlistId) {
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || !pl.songs.length) return;
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
    const searchInput = page.querySelector('#musicSearch');
    if (searchInput) searchInput.value = '';
    updatePlayBtn();
    updateUI();
    preloadDurations(activeList.map(s => s.audio));
  }

  function getFilteredSortedList() {
    let list = [...activeList];

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

  function getRandomIdx(len) {
    const avoid = Math.min(3, Math.floor(len / 2));
    const recent = shuffleHistory.slice(-avoid);
    const available = [];
    for (let i = 0; i < len; i++) if (!recent.includes(i)) available.push(i);
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * len);
  }

  // ==========================================
  // RENDER
  // ==========================================
  function render() {
    const playlists = getPlaylists();
    const cont = getContinue();
    const s = currentIdx >= 0 ? activeList[currentIdx] : null;
    const displayList = getFilteredSortedList();
    const activeInFiltered = s ? displayList.findIndex(t => t.title === s.title && t.artist === s.artist) : -1;

    page.innerHTML = `
      <h1 class="sr-only">Canciones</h1>
      ${cont && !s ? renderContinueCard(cont, playlists) : ''}
      <div class="music-app">

        <!-- Now Playing Hero -->
        <div class="music-now-playing" id="nowPlaying">
          <div class="music-artwork-wrap">
            <div class="music-artwork ${isPlaying ? 'is-spinning' : ''}" id="artworkWrapper">
              ${s ? `<img src="${s.cover}" alt="${escapeHtml(s.title)}" id="currentCover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${coverFallback(s.title)}` : `<div class="music-artwork-empty">🎵</div>`}
            </div>
            <div class="music-artwork-glow"></div>
          </div>
          <div class="music-info">
            <div class="music-info-top">
              <div class="music-titles">
                <h2 class="music-title" id="currentTitle">${s ? escapeHtml(s.title) : 'Elige una canción'}</h2>
                <p class="music-artist" id="currentSubtitle">${s ? escapeHtml(s.artist) : 'Explora tu biblioteca'}</p>
              </div>
              ${s ? `<button class="music-fav-btn ${favorites.has(s.title.toLowerCase()) ? 'is-faved' : ''}" id="favBtn" aria-label="${favorites.has(s.title.toLowerCase()) ? 'Quitar de favoritos' : 'Añadir a favoritos'}" title="${favorites.has(s.title.toLowerCase()) ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${favorites.has(s.title.toLowerCase()) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>` : ''}
            </div>
          </div>

          <!-- Controls -->
          <div class="music-controls">
            <button class="music-ctrl-btn" id="shuffleBtn" aria-label="Aleatorio" title="Aleatorio" ${shuffleMode ? 'style="color:var(--theme-accent-primary)"' : ''}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            </button>
            <button class="music-ctrl-btn" id="prevBtn" aria-label="Anterior" title="Anterior">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
            </button>
            <button class="music-play-btn" id="playBtn" aria-label="Reproducir" title="Reproducir">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none" id="playIcon">${isPlaying
                ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                : '<polygon points="5 3 19 12 5 21 5 3"/>'
              }</svg>
            </button>
            <button class="music-ctrl-btn" id="nextBtn" aria-label="Siguiente" title="Siguiente">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
            </button>
            <button class="music-ctrl-btn" id="queueBtn" aria-label="Cola de reproducción" title="Cola de reproducción">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
            </button>
          </div>

          <!-- Progress -->
          <div class="music-progress">
            <span class="music-time" id="currentTime">0:00</span>
            <div class="music-progress-track" id="progressTrack">
              <div class="music-progress-fill" id="progressFill"></div>
              <div class="music-progress-thumb" id="progressThumb"></div>
            </div>
            <span class="music-time" id="totalTime">0:00</span>
          </div>
        </div>

        <!-- Lyrics (collapsible) -->
        ${s?.lyrics ? `<div class="music-lyrics glass-card" id="lyricsSection">
          <button class="music-lyrics-toggle" id="toggleLyrics">
            <span>Letra</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="music-lyrics-chevron"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="music-lyrics-body" id="lyricsPanel">${s.lyrics}</div>
        </div>` : ''}

        <!-- Queue panel -->
        <div class="music-queue" id="queuePanel" style="display:none">
          <div class="music-queue-header">
            <h3>Cola de reproducción</h3>
            <button class="music-queue-clear" id="queueClear">Limpiar cola</button>
          </div>
          <div class="music-queue-list" id="queueList"></div>
        </div>

        <!-- Search + Filters -->
        <div class="music-toolbar">
          <div class="music-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="music-search-input" id="musicSearch" placeholder="Buscar por título o artista..." autocomplete="off" value="${escapeHtml(searchQuery)}" aria-label="Buscar canciones">
            ${searchQuery ? '<button class="music-search-clear" id="musicSearchClear" aria-label="Limpiar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : ''}
          </div>
          <div class="music-filters" id="musicFilters">
            <button class="music-filter-chip ${sortBy === 'default' ? 'is-active' : ''}" data-sort="default">Por defecto</button>
            <button class="music-filter-chip ${sortBy === 'name' ? 'is-active' : ''}" data-sort="name">A-Z</button>
            <button class="music-filter-chip ${sortBy === 'favorites' ? 'is-active' : ''}" data-sort="favorites">⭐ Favoritas</button>
          </div>
        </div>

        <!-- Playlists bar -->
        <div class="music-playlists-bar" id="playlistsBar">
          ${playlists.map(pl => {
            const coverSong = pl.songs[0];
            return `<button class="music-playlist-card ${pl.id === activePlaylistId ? 'is-active' : ''}" data-playlist="${pl.id}">
              <div class="music-playlist-card-cover">
                ${coverSong?.cover ? `<img src="${coverSong.cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${coverFallback(coverSong.title)}` : `<span class="music-playlist-card-emoji">${pl.name.slice(0, 2)}</span>`}
              </div>
              <div class="music-playlist-card-info">
                <span class="music-playlist-card-name">${pl.name}</span>
                <span class="music-playlist-card-count">${pl.count} canciones</span>
              </div>
            </button>`;
          }).join('')}
        </div>

        <!-- Track list -->
        <div class="music-tracks glass-card" id="playlist">
          <div class="music-tracks-header">
            <span class="music-tracks-title">${displayList.length} ${displayList.length === 1 ? 'canción' : 'canciones'}</span>
          </div>
          <div class="music-tracks-list">
            ${displayList.map((t, i) => {
              const isCurrent = s && t.title === s.title && t.artist === s.artist;
              const isSpecial = !!t.experience;
              const dur = trackDurations[t.audio] ? formatTime(trackDurations[t.audio]) : '--:--';
              return `<button type="button" class="music-track ${isCurrent ? 'is-active' : ''}${isSpecial ? ' is-special' : ''}" data-title="${escapeHtml(t.title)}" data-artist="${escapeHtml(t.artist)}" data-audio="${escapeHtml(t.audio || '')}">
                <div class="music-track-num">${isCurrent && isPlaying
                  ? '<span class="music-track-eq"><span></span><span></span><span></span></span>'
                  : `<span class="music-track-idx">${i + 1}</span>`
                }</div>
                <div class="music-track-cover-wrap">
                  <img src="${t.cover}" alt="${escapeHtml(t.title)}" loading="lazy" class="music-track-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  ${coverFallback(t.title)}
                </div>
                <div class="music-track-info">
                  <strong>${escapeHtml(t.title)}${isSpecial ? ' <span class="music-track-badge">✨</span>' : ''}</strong>
                  <span>${escapeHtml(t.artist)}</span>
                </div>
                <span class="music-track-dur">${dur}</span>
                ${isSpecial ? `<a href="#/${t.experience}" class="music-track-exp" onclick="event.stopPropagation()" title="Experiencia">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </a>` : ''}
              </button>`;
            }).join('')}
            ${!displayList.length ? `<div class="music-tracks-empty">${searchQuery ? '🔍 No se encontraron canciones' : 'No hay canciones en esta colección'}</div>` : ''}
          </div>
        </div>

        <!-- Lyrics lightbox -->
        <div class="music-lyrics-lightbox" id="lyricsLightbox" style="display:none">
          <div class="music-lyrics-lightbox-content">
            <button class="music-lyrics-lightbox-close" id="closeLightbox" aria-label="Cerrar letra ampliada">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="music-lyrics-expanded" id="expandedLyrics">${s?.lyrics || ''}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderContinueCard(cont, playlists) {
    const pl = playlists.find(p => p.id === cont.tab) || playlists[0];
    const song = pl?.songs?.find(s => s.title === cont.title);
    return `<div class="music-continue card" id="continueCard">
      <div class="music-continue-label">Continuar escuchando</div>
      <div class="music-continue-row">
        <div class="music-continue-cover">
          ${song?.cover ? `<img src="${song.cover}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${coverFallback(cont.title)}` : coverFallback(cont.title)}
        </div>
        <div class="music-continue-info">
          <strong>${escapeHtml(cont.title)}</strong>
          <span>${song ? escapeHtml(song.artist) : ''}</span>
        </div>
        <div class="music-continue-actions">
          <button class="music-continue-play" id="continuePlay" title="Reproducir">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button class="music-continue-dismiss" id="continueDismiss" title="Descartar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }

  // ==========================================
  // UPDATE UI (partial updates without full re-render)
  // ==========================================
  function updateUI() {
    // El <audio> es global (player.service) y ya no se recrea en el render:
    // la reproducción se conserva sola entre re-renders.
    render();
    bindEvents();
  }

  function updatePlayBtn() {
    const playIcon = page.querySelector('#playIcon');
    if (!playIcon) return;
    playIcon.innerHTML = isPlaying
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5 3 19 12 5 21 5 3"/>';
    const artwork = page.querySelector('#artworkWrapper');
    if (artwork) artwork.classList.toggle('is-spinning', isPlaying);
  }

  function loadSong(idx) {
    currentIdx = idx;
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
    const next = shuffleMode && len > 1 ? getRandomIdx(len) : (currentIdx + 1) % len;
    loadSong(next);
    if (isPlaying && audioEl) audioEl.play().catch(() => { isPlaying = false; updatePlayBtn(); });
  }

  function prevSong() {
    if (!activeList.length) return;
    saveContinue(activePlaylistId, currentIdx, audioEl?.currentTime || 0);
    const len = activeList.length;
    const prev = shuffleMode && len > 1 ? getRandomIdx(len) : (currentIdx - 1 + len) % len;
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
    if (!audioEl.duration) return;
    const pct = (audioEl.currentTime / audioEl.duration) * 100;
    const fill = page.querySelector('#progressFill');
    const thumb = page.querySelector('#progressThumb');
    if (fill) fill.style.width = pct + '%';
    if (thumb) thumb.style.left = pct + '%';
    const ct = page.querySelector('#currentTime');
    if (ct) ct.textContent = formatTime(audioEl.currentTime);
    saveContinueThrottled(); // persiste la última posición en vivo
  }

  function onEnded() {
    saveContinue(activePlaylistId, currentIdx, 0);
    // El servicio marca pausa al terminar; la página reactiva el auto-avance.
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
    const tt = page.querySelector('#totalTime');
    if (tt) tt.textContent = formatTime(audioEl.duration);
    if (audioEl.duration && audioEl.src) trackDurations[audioEl.src] = audioEl.duration;
  }

  // ==========================================
  // BIND EVENTS (solo DOM de la página)
  // ==========================================
  function bindEvents() {
    if (!audioEl) return;

    // Progress click
    const track = page.querySelector('#progressTrack');
    if (track) {
      track.addEventListener('click', (e) => {
        if (!audioEl.duration) return;
        audioEl.currentTime = (e.clientX - track.getBoundingClientRect().left) / track.offsetWidth * audioEl.duration;
      });
    }

    // Controls
    page.querySelector('#playBtn')?.addEventListener('click', togglePlay);
    page.querySelector('#prevBtn')?.addEventListener('click', prevSong);
    page.querySelector('#nextBtn')?.addEventListener('click', nextSong);
    page.querySelector('#shuffleBtn')?.addEventListener('click', () => {
      shuffleMode = !shuffleMode;
      showToast(shuffleMode ? 'Aleatorio activado 🔀' : 'Aleatorio desactivado', 'info');
      updateUI();
    });

    // Queue
    let queueVisible = false;
    page.querySelector('#queueBtn')?.addEventListener('click', () => {
      queueVisible = !queueVisible;
      const panel = page.querySelector('#queuePanel');
      if (panel) {
        panel.style.display = queueVisible ? '' : 'none';
        if (queueVisible) renderQueue();
      }
    });
    page.querySelector('#queueClear')?.addEventListener('click', () => {
      queue = [];
      renderQueue();
      showToast('Cola vaciada', 'info');
    });

    // Fav
    page.querySelector('#favBtn')?.addEventListener('click', () => {
      const s = activeList[currentIdx];
      if (!s) return;
      if (favorites.has(s.title.toLowerCase())) favorites.delete(s.title.toLowerCase());
      else favorites.add(s.title.toLowerCase());
      saveFavorites();
      updateUI();
    });

    // Continue card
    page.querySelector('#continuePlay')?.addEventListener('click', () => {
      resumeContinue();
    });
    // Toda la tarjeta "Continuar escuchando" es clicable (solo el botón
    // de descartar mantiene su comportamiento independiente).
    page.querySelector('#continueCard')?.addEventListener('click', (e) => {
      if (e.target.closest('#continueDismiss')) return;
      resumeContinue();
    });
    page.querySelector('#continueDismiss')?.addEventListener('click', () => {
      clearContinue();
      updateUI();
    });

    // Playlist cards
    page.querySelectorAll('.music-playlist-card').forEach(card => {
      card.addEventListener('click', () => switchPlaylist(card.dataset.playlist));
    });

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

    // Filter chips
    page.querySelectorAll('.music-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        sortBy = chip.dataset.sort;
        queue = []; // el orden cambia los índices de la vista; se invalida la cola pendiente
        updateUI();
      });
    });

    // Track list
    page.querySelectorAll('.music-track').forEach(btn => {
      btn.addEventListener('click', () => {
        const title = btn.dataset.title;
        const artist = btn.dataset.artist;
        const idx = activeList.findIndex(s => s.title === title && s.artist === artist);
        if (idx >= 0) {
          loadSong(idx);
          if (audioEl) { audioEl.play().catch(() => {}); isPlaying = true; updatePlayBtn(); }
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

    // Lyrics toggle
    let lyricsOpen = true;
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
    if (!queue.length) {
      list.innerHTML = '<div class="music-queue-empty">La cola está vacía. Reproduce canciones para añadirlas.</div>';
      return;
    }
    list.innerHTML = queue.map((idx, i) => {
      const s = activeList[idx];
      if (!s) return '';
      return `<div class="music-queue-item">
        <span class="music-queue-num">${i + 1}</span>
        <img src="${s.cover}" alt="" class="music-queue-cover" loading="lazy">
        <div class="music-queue-info">
          <strong>${escapeHtml(s.title)}</strong>
          <span>${escapeHtml(s.artist)}</span>
        </div>
        <button class="music-queue-remove" data-qidx="${i}" title="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');
    list.querySelectorAll('.music-queue-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        queue.splice(parseInt(btn.dataset.qidx), 1);
        renderQueue();
      });
    });
  }

  // Keyboard shortcuts
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight' && e.ctrlKey) nextSong();
    if (e.key === 'ArrowLeft' && e.ctrlKey) prevSong();
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

  const unwireAudio = wireAudioEvents();
  render();
  bindEvents();
  document.addEventListener('keydown', onKeyDown);

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

  // Cleanup — el audio NO se pausa aquí: la música sigue sonando al
  // navegar (barra global + Media Session). Solo se sueltan los listeners
  // y se guarda la posición para reanudar después.
  page.cleanup = () => {
    offContent();
    offPlayer();
    unwireAudio();
    preloadToken++; // aborta la precarga de duraciones en curso
    clearTimeout(saveDurTimer); // vacía el debounce pendiente
    try { localStorage.setItem(userPrefKey('trackDurations'), JSON.stringify(trackDurations)); } catch { /* ignorar */ }
    document.removeEventListener('keydown', onKeyDown);
    if (isPlaying && currentIdx >= 0) {
      saveContinue(activePlaylistId, currentIdx, audioEl?.currentTime || 0);
    }
  };

  return page;
}
