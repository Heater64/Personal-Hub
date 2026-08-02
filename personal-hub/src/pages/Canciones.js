/* ==========================================
   Personal Hub v2 — Canciones Page
   Reproductor musical con letras y lista de canciones
   Dos subsecciones: Canciones que me recuerdan a ti + Canciones completas
   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { formatTime } from '../utils/format.js';

const SONGS_BASE = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

// ==========================================
// CANCIONES QUE ME RECUERDAN A TI (con letra)
// ==========================================
const SONGS_RECUERDAN = [
  { title: "Si No Estás", artist: "Iñigo Quintero", album: "Balada · 2023", cover: `${SONGS_BASE}/Fotos/1200x1200bf-60.jpg`, audio: `${SONGS_BASE}/Canciones/Si%20No%20Est%C3%A1s%20%E2%80%93%20I%C3%B1igo%20Quintero.m4a`, lyrics: `Quiero ver tu otra mitad,<br>alejarme de esta ciudad,<br>y contagiarme de tu forma de pensar.<br><br>Miro al cielo al recordar,<br>me doy cuenta otra vez más<br>que no hay momento que pase sin dejarte de pensar.` },
  { title: "¿A caso no te has dado cuenta?", artist: "Unknown Artist", album: "Reguetón · 2024", cover: `${SONGS_BASE}/Fotos/maxresdefault.jpg`, audio: `${SONGS_BASE}/Canciones/_%C2%BFAcaso_no_te_has_dado_cuenta_de_lo_bien_que_me_complementas_Letra%20(mp3cut.net).m4a`, lyrics: `¿A caso no te has dado cuenta?<br>De lo bien que me complementas<br>Si quieres te invito un helado y te explico lo chido que haces que me sienta<br><br>Contigo estoy high sin avión<br>Me haces perder la razón<br>Estoy todo el día pensándote con mariposas en el corazón<br><br>Y tú (y tú-uh)<br>Me pones todo de cabeza<br>Tú (y tú-uh)<br>Eras esa última pieza<br><br>Tú (tú-uh)<br>Eres tan diferente<br>Y no hay nadie que me vuele así la mente como lo haces tú` },
  { title: "Mi niña", artist: "Wisin, Myke Towers", album: "Urban · 2023", cover: `${SONGS_BASE}/Fotos/OIP%20(3).webp`, audio: `${SONGS_BASE}/Canciones/Wisin,_Myke_Towers,_Los_Legendarios_Mi_Ni%C3%B1a_Letra_Lyrics%20(mp3cut.net).m4a`, lyrics: `Yo quiero viajar el mundo contigo de compañía (tú sabe' ya)<br>Ninguna mujer me comprendía<br>Cierra los ojos y dime en qué lugar es que estaría (ajá)<br>Que voy a pedir una estadía<br><br>A ella le cogen cosa' porque está conmigo<br>El que te falte el respeto se convierte en mi enemigo<br>Hay muchas envidiosa', dicen que es prohibido<br>Siempre está en mi mente, yo nunca la olvido<br>Porque es mi niña (oh-oh-oh-oh)` },
  { title: "Rara vez", artist: "Milo J, Taiu", album: "Trap · 2023", cover: `${SONGS_BASE}/Fotos/OIP%20(4).webp`, audio: `${SONGS_BASE}/Canciones/Taiu,%20Milo%20j%20-%20Rara%20Vez%20(mp3cut.net).m4a`, lyrics: `Sos lo que me da paz<br>Lo que andaba buscando<br>Y esa felicidad<br>Que hace que ande sonriendo<br><br>Quiero verte feli'<br>Mejor si es al la'o de mí<br>Love incondicional<br>Como perro a su amo, te sigo amando` },
  { title: "Pareja del año", artist: "Sebastián Yatra, Myke Towers", album: "Pop · 2021", cover: `${SONGS_BASE}/Fotos/OIP%20(5).webp`, audio: `${SONGS_BASE}/Canciones/Sebasti%C3%A1n_Yatra,_Myke_Towers_Pareja_del_A%C3%B1o_Official_Performance%20(mp3cut.net).m4a`, lyrics: `Qué tan loco sería si yo fuera<br>El dueño de tu corazón por solo un día<br>Si nos gana la alegría, yo por fin te besaría<br>¿Qué pasaría?` },
  { title: "¿A dónde vamos?", artist: "Morat", album: "Pop · 2022", cover: `${SONGS_BASE}/Fotos/OIP%20(6).webp`, audio: `${SONGS_BASE}/Canciones/Morat%20-%20A%20D%C3%B3nde%20Vamos%20(Letra)%20_%20Albert%20%26%20Maricheli%20(mp3cut.net).m4a`, lyrics: `Que siendo un extraño, te dije te amo<br>Te he estado buscando por más de mil años<br>Y tú respondiste: ¿A dónde vamos?<br>Contra las apuestas, aquí nos quedamos` },
  { title: "Cuando te vi", artist: "Trueno, Maria Becerra", album: "Urban · 2022", cover: `${SONGS_BASE}/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png`, audio: `${SONGS_BASE}/Canciones/Maria%20Becerra,%20Trueno,%20Big%20One%20-%20Cuando%20Te%20Vi%20_%20CROSSOVER%20%235%20(mp3cut.net).m4a`, lyrics: `Aunque todavía no soy rico (no)<br>Te puedo dar amor como de chico<br>Cosquillas en la panza, como antes del primer pico (mai)` },
  { title: "Todo de Ti", artist: "Rauw Alejandro", album: "Reguetón · 2021", cover: `${SONGS_BASE}/Fotos/OIP%20(7).webp`, audio: `${SONGS_BASE}/Canciones/Rauw%20Alejandro%20-%20Todo%20de%20Ti%20(Video%20Oficial).m4a`, lyrics: `El viento soba tu cabello<br>Me matan esos ojos bellos<br><br>Me gusta tu olor, de tu piel el color<br>Y cómo me haces sentir<br>Me gusta tu boquita, ese labial rosita (tú)<br>Y cómo me besas a mí` },
  { title: "Loco Enamorado", artist: "Abraham Mateo, Farruko", album: "Pop · 2020", cover: `${SONGS_BASE}/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png`, audio: `${SONGS_BASE}/Canciones/Loco_Enamorado,_de_Abraham_Mateo_Ft_Farruko_%26_Christian_Daniel_Letra.m4a`, lyrics: `Te confieso, llevo un rato idealizándote<br>Toda una vida yo buscándote<br><br>Ya me tienes como un loco enamorado<br>Baby, la verdad es que tú me gustas demasiado` },
  { title: "Bailando", artist: "Enrique Iglesias", album: "Latino · 2014", cover: `${SONGS_BASE}/Fotos/R%20(1).png`, audio: `${SONGS_BASE}/Canciones/Enrique_Iglesias_%E2%80%93_Bailando_Lyrics_feat_Descemer_Bueno,_Gente_De.m4a`, lyrics: `Yo te miro y se me corta la respiración<br>Cuando tú me miras, se me sube el corazón<br><br>Bailando, bailando<br>Tu cuerpo y el mío, llenando el vacío<br>Subiendo y bajando` },
  { title: "La Plena", artist: "Beéle, Westcol", album: "Urban · 2023", cover: `${SONGS_BASE}/Fotos/ab67616d0000b2734740100d84f3667f1eae6870.jpeg`, audio: `${SONGS_BASE}/Canciones/Be%C3%A9le,%20Westcol,%20Ovy%20On%20The%20Drums%20-%20LA%20PLENA%20(W%20Sound%2005).m4a`, lyrics: `Eres la niña de mis ojo', tú<br>Eres todo lo que quiero yo<br><br>Ay, tienes la magia<br>Tú, sí, tienes una vainita que a mí me encanta, me enloquece` },
  { title: "Tacones Rojos", artist: "Sebastián Yatra", album: "Pop · 2021", cover: `${SONGS_BASE}/Fotos/OIP%20(8).webp`, audio: `${SONGS_BASE}/Canciones/Sebasti%C3%A1n%20Yatra%20-%20Tacones%20Rojos%20(Official%20Video)%20(1).m4a`, lyrics: `Hay un rayo de luz que entró por mi ventana<br>Y me ha devuelto las ganas, me quita el dolor<br><br>Mi pedazo de Sol, la niña de mis ojos<br>La que baila reguetón con tacones rojos` },
  { title: "Cosas Que No Te Dije", artist: "Saiko", album: "Urban · 2023", cover: `${SONGS_BASE}/Fotos/ab67616d0000b273fb045f7dda9773e266437bc6.jpeg`, audio: `${SONGS_BASE}/Canciones/Saiko%20-%20COSAS%20QUE%20NO%20TE%20DIJE%20(Official%20Video).m4a`, lyrics: `Que yo te quiero dormida<br>En la cama, con mi hoodie<br>Dime si te gustaría<br>Quiero ser todos tus hobbies, mami<br><br>Solo una cosa te pediría<br>Que si te doy mi corazón<br>Me lo cuides todos los días` },
  { title: "Indeciso", artist: "Reik, J Balvin, Lalo Ebratt", album: "Reguetón · 2020", cover: `${SONGS_BASE}/Fotos/R%20(3).jpeg`, audio: `${SONGS_BASE}/Canciones/Reik,%20J%20Balvin,%20Lalo%20Ebratt%20-%20Indeciso%20(Letra).m4a`, lyrics: `Siempre que ella baila así<br>A mí me daña la cabeza<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso` },
  { title: "Tiroteo (Remix)", artist: "Marc Seguí, Rauw Alejandro, Pol Granch", album: "Remix · 2024", cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", lyrics: `Aunque no pueda tenerte,<br>sé que estás en mi mente<br>Y aunque pasen los días,<br>tu recuerdo está presente.<br><br>Y si el destino quiere,<br>volveremos a vernos,<br>mientras tanto, prometo<br>no dejar de quererte.` },
];

// ==========================================
// CANCIONES COMPLETAS (sin letra)
// ==========================================
const ALL_SONGS = [
  { title: "Mon amour Remix", artist: "Aitana y Zzoilo", cover: "https://i1.sndcdn.com/artworks-leykoA0rJXWDmQya-cyfPxg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" },
  { title: "Tiroteo (Remix)", artist: "Marc Seguí, Rauw Alejandro, Pol Granch", cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a" },
  { title: "Contando Lunares", artist: "Don Patricio", cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777748473/contando_lunares_bjxcmo.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748328/DON_PATRICIO_CRUZ_CAFUN%C3%89_-_CONTANDO_LUNARES_tsyd6p.m4a" },
  { title: "Rara Vez", artist: "Milo J, Taiu", cover: "https://m.media-amazon.com/images/I/51O0iMUUz7L._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748873/Taiu_Milo_j_-_Rara_Vez_bwkba4.m4a" },
  { title: "Si Estoy a Tu Lado", artist: "Rabelay", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-ywl-ZgPTD9d7uezXWmcCixIhCxdKb0cmRA&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748874/Rabelay_-_Si_Estoy_a_Tu_Lado_Oficial_nvbx34.m4a" },
  { title: "Pareja del Año", artist: "Sebastián Yatra, Myke Towers", cover: "https://i.scdn.co/image/ab67616d0000b273311aebbc00f1cd4cd16bacbc", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Sebasti%C3%A1n_Yatra_-_Tacones_Rojos_Official_Video_o09dxd.m4a" },
  { title: "COSAS QUE NO TE DIJE", artist: "Saiko", cover: "https://images.genius.com/acb90eccfc4f36d9675d8d2f58c86670.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Saiko_-_COSAS_QUE_NO_TE_DIJE_Official_Video_dbpazx.m4a" },
  { title: "Quiero Decirte", artist: "Abraham Mateo, Ana Mena", cover: "https://images.genius.com/7e834ed5f2fd7a331d2e8d4f948cda4b.1000x1000x1.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748876/Abraham_Mateo_Ana_Mena_-_Quiero_Decirte_myiibs.m4a" },
  { title: "Just the Way You Are", artist: "Bruno Mars", cover: "https://cdn-images.dzcdn.net/images/cover/5b59dc18e109515420f8237719bd2186/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748879/Bruno_Mars_-_Just_The_Way_You_Are_i8mkhd.m4a", experience: 'justthewayyouare' },
  { title: "Ven a la Carrera", artist: "Pocoyó", cover: "https://i.scdn.co/image/ab67616d0000b2730952f5f2ec131e56b3ba7b27", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748881/%EF%B8%8FPOCOY%C3%93_-_Ven_a_la_Carrera_ysppwm.m4a" },
  { title: "Besos en Guerra", artist: "Morat, Juanes", cover: "https://i.scdn.co/image/ab67616d0000b2738fa1c3557fd95f9dd67ec235", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748882/Morat_Juanes_-_Besos_en_Guerra_Letra._vnnvdn.m4a" },
  { title: "Carita de Buena", artist: "Efecto Pasillo", cover: "https://m.media-amazon.com/images/I/61F144gibPL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748883/Efecto_Pasillo_-_Carita_de_Buena_Letra_ja14lf.m4a" },
  { title: "Cupid twin version", artist: "FIFTY FIFTY", cover: "https://i.scdn.co/image/ab67616d0000b27337c0b3670236c067c8e8bbcb", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748884/FIFTY_FIFTY_-_Cupid_Twin_Version_Lyrics_hfw31y.m4a" },
  { title: "Pan y Mantequilla", artist: "Efecto Pasillo", cover: "https://i.scdn.co/image/ab67616d0000b2735953c71f6d0e995f71f63ae4", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748885/Pan_y_Mantequilla_ejmvcl.m4a" },
  { title: "La Plena", artist: "Beéle Westcol, Ovy On The Drums", cover: "https://i.scdn.co/image/ab67616d0000b273c0353d023daf5ebda0eb003b", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748886/Be%C3%A9le_Westcol_Ovy_On_The_Drums_-_LA_PLENA_W_Sound_05_jz2fsz.m4a" },
  { title: "Snowman", artist: "Sia", cover: "https://i.scdn.co/image/ab67616d0000b273a75e532b61dac3ddafd022ef", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748887/Sia_-_Snowman_Lyrics_ym54x5.m4a" },
  { title: "miau", artist: "Young Cister", cover: "https://images.genius.com/aa41a24ecbac2a1324c4cb84cc158f76.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748889/Young_Cister_-_miau_Video_Oficial_2_rr561t.m4a" },
  { title: "I Love It", artist: "Icona Pop, Charli XCX", cover: "https://m.media-amazon.com/images/I/51e5k9eRKvL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748890/Vietsub_I_Love_It_Icona_Pop___Charli_XCX_Lyrics_Video_1_tn4f7c.m4a" },
  { title: "Capaz", artist: "Alleh Yorghaki", cover: "https://cdn-images.dzcdn.net/images/cover/88e65c70ef15315045b6bf85d38b11f2/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748891/Alleh_Yorghaki_-__capaz__OFFICIAL_VERSION_iutvie.m4a" },
  { title: "Downtown", artist: "Anitta, J Balvin", cover: "https://i.scdn.co/image/ab67616d0000b2738c6b830c36c7b4ac43c3cee8", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748892/Anitta_J_Balvin_-_DOWNTOWN_Letra_vw8h3l.m4a" },
  { title: "Porfa no te vayas", artist: "Beret, Morat", cover: "https://cdn-images.dzcdn.net/images/cover/82a6297e55cbb85c75cedbbb3a8e1443/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748898/Beret_Morat_-_Porfa_no_te_vayas_Videoclip_Oficial_1_gxrelc.m4a" },
  { title: "Count on Me", artist: "Bruno Mars", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSaonOWEQEDMwIQmhHmBRiWrqKgcKYWQjQTiQ&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748900/Bruno_Mars_-_Count_on_Me_Official_Lyric_Video_1_xli1q5.m4a" },
  { title: "Caliente", artist: "Ricky edit", cover: "https://s.mxmcdn.net/images-storage/albums2/9/5/3/5/2/3/64325359_350_350.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748901/caliente_-_rickyedit_1_pe7zjc.m4a" },
  { title: "X Remix", artist: "Nicky Jam, J Balvin, Ozuna, Maluma", cover: "https://i.scdn.co/image/ab67616d0000b27326129b4b928f0f97ba344545", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748902/X_Remix_-_Nicky_Jam_x_J_Balvin_x_Ozuna_x_Maluma_cqklqd.m4a" },
  { title: "Viva La Vida", artist: "Coldplay", cover: "https://m.media-amazon.com/images/I/9145yafeO2L._UF894,1000_QL80_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748903/Coldplay_-_Viva_La_Vida_Official_Video_rjwiqg.m4a" },
  { title: "3 AM", artist: "Eladio Carrión, Brytiago", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCWfQQxORCJbF-JVcNQ2qouJQqMA0C4Arkdg&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748904/Eladio_Carri%C3%B3n_Brytiago_-_3_AM_Visualizer___Sauce_Boyz_paeyvx.m4a" },
  { title: "Qué Bonita", artist: "Cano", cover: "https://cdn-images.dzcdn.net/images/cover/e65d06182e60952beb733eefe35a1d75/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748905/El_Mismo_Sol_svyp5p.m4a" },
  { title: "Bailando", artist: "Enrique Iglesias", cover: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c0/Enriquebailandocover.jpg/250px-Enriquebailandocover.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748907/Enrique_Iglesias___Bailando_Lyrics_feat_Descemer_Bueno__Gente_De_pvlefu.m4a" },
  { title: "DUELE EL CORAZÓN", artist: "Enrique Iglesias", cover: "https://i1.sndcdn.com/artworks-000164317296-txl7y7-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748909/Enrique_Iglesias_-_DUELE_EL_CORAZON_Lyric_Video_ft._Wisin_v27ra0.m4a" },
  { title: "La Bachata", artist: "MTZ Manuel Turizo", cover: "https://i1.sndcdn.com/artworks-HG9Rj4F1lgzFynKw-jpIVmQ-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748910/La_Bachata_-_MTZ_Manuel_Turizo___Video_Oficial_thrsqd.m4a" },
  { title: "El Merengue", artist: "MTZ Manuel Turizo", cover: "https://cdn-p.smehost.net/sites/5b3bac59eb36401694af3a241173447f/wp-content/uploads/2023/03/93201a3b-066d-4ae6-8fba-92694479a310.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748911/Marshmello_Manuel_Turizo_-_El_Merengue_j0d5t6.m4a" },
  { title: "1000 Cosas", artist: "MTZ Manuel Turizo", cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777751326/1000_cosas_nzka1y.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748912/Lola_Indigo_Manuel_Turizo_-_1000_Cosas_Letra___Lyrics_hs1gu0.m4a" },
  { title: "Die With a Smile", artist: "Lady Gaga, Bruno Mars", cover: "https://cdn-images.dzcdn.net/images/cover/4bd5903f4ce8f2601916bfadb44efe8a/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748913/Lady_Gaga_Bruno_Mars_-_Die_With_A_Smile_defupf.m4a" },
  { title: "BELIEVER", artist: "Imagine Dragons", cover: "https://i.scdn.co/image/ab67616d0000b2735675e83f707f1d7271e5cf8a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748915/Imagine_Dragons_-_Believer_Lyrics_kfi5ha.m4a" },
  { title: "Si No Estás", artist: "Iñigo Quintero", cover: "https://i.scdn.co/image/ab67616d0000b273c0a5c14b34a02f242af03359", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748916/i%C3%B1igo_quintero_-_Si_No_Est%C3%A1s_Letra_Oficial_1_lraiuu.m4a" },
  { title: "Si Antes Te Hubiera Conocido", artist: "Karol G", cover: "https://i1.sndcdn.com/artworks-TTDsE8Jj2gF855AL-hFnpUQ-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748917/KAROL_G_-_Si_Antes_Te_Hubiera_Conocido___Coke_Studio_sxezkk.m4a" },
  { title: "Firework", artist: "Katy Perry", cover: "https://m.media-amazon.com/images/M/MV5BMWRmMWVlOWYtOWQ2Yi00MjdmLTliNGUtOTk1N2M4MmQwZmJkXkEyXkFqcGc@._V1_QL75_UY190_CR2,0,190,190_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748918/Katy_Perry_-_Firework_Lyrics_qgmiip.m4a" },
  { title: "I Kissed A Girl", artist: "Katy Perry", cover: "https://upload.wikimedia.org/wikipedia/en/5/5c/I_Kissed_a_Girl.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748919/Katy_Perry_-_I_Kissed_A_Girl_Official_Music_Video_qdtvxf.m4a" },
  { title: "La Cintura", artist: "Alvaro Soler", cover: "https://i1.sndcdn.com/artworks-000326908518-qfg6dg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748920/La_Cintura_-_Alvaro_Soler_Letra_lyrics_knrjhe.m4a" },
  { title: "como estrellas", artist: "YOUNG", cover: "https://i.scdn.co/image/ab67616d0000b273866265358ce5d4770b67ab8d", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748921/LA_YounG_-_Como_Estrellas_pvizll.m4a" },
  { title: "Until I Found You", artist: "Stephen Sanchez", cover: "https://cdn-images.dzcdn.net/images/cover/8a6477b222dac17081d9b9b1729a1ca4/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748931/Stephen_Sanchez_-_Until_I_Found_You_Lyrics_1_rakcvt.m4a" },
  { title: "Malito", artist: "Maluma", cover: "https://i.scdn.co/image/ab67616d0000b273b89593a15f6a40fd6d7de40c", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748932/Malito_w8w0t2.m4a" },
  { title: "quelamamen", artist: "Ricky edit", cover: "https://cdn-images.dzcdn.net/images/cover/6c56dd16a8da24c8e59781231e29442b/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748937/quelamamen_-_rickyedit_t0yfas.m4a" },
  { title: "Ahora Y Siempre", artist: "Quevedo", cover: "https://i.scdn.co/image/ab67616d0000b2738517e3f690cdabf1a616b2e8", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748939/Quevedo_-_Ahora_Y_Siempre_Letra_Lyrics_x6edyd.m4a" },
  { title: "Cuando Te Vi", artist: "Maria Becerra, Trueno", cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/6/f/9/d/2282831720092918.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748940/Maria_Becerra_Trueno_Big_One_-_Cuando_Te_Vi___CROSSOVER_5_eaa8fv.m4a" },
  { title: "Todo de Ti", artist: "Rauw Alejandro", cover: "https://i.scdn.co/image/ab67616d0000b273c160ede886e4e54350c0cec9", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748941/Rauw_Alejandro_-_Todo_de_Ti_Video_Oficial_fucazk.m4a" },
  { title: "real gangsta love", artist: "Trueno", cover: "https://images.genius.com/d7ae872dffe2dda742204c6fd4256e4e.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748942/Trueno_-_REAL_GANGSTA_LOVE_Official_Video_bzn4xz.m4a" },
  { title: "Belong Together", artist: "Mark Ambor", cover: "https://i.ytimg.com/vi/xPWnNFF-TAw/sddefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748944/Mark_Ambor_-_Belong_Together_Lyrics_o7nepu.m4a" },
  { title: "sway", artist: "Michael Bublé", cover: "https://i1.sndcdn.com/artworks-mfRYr4OtlumkBA1q-pL2Mfg-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748945/Michael_Bubl%C3%A9_-_Sway_Lyrics_twaz4d.m4a" },
  { title: "CLASSIC", artist: "mkto", cover: "https://i.scdn.co/image/ab67616d0000b2739474419f15773875a495eed3", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748946/MKTO_-_Classic_Lyrics_yrsqeh.m4a" },
  { title: "A Dónde Vamos", artist: "Morat", cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/3/0/1/4/1111981626430157.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748947/Morat_-_A_D%C3%B3nde_Vamos_Letra___Albert_Maricheli_y9psss.m4a" },
  { title: "La Falda", artist: "Myke Towers", cover: "https://i1.sndcdn.com/artworks-r0TxDn1vZJbLEO3p-ROydVw-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748949/Myke_Towers_-_LA_FALDA_Letra_Lyrics_mwn6s0.m4a" },
  { title: "Como Te Atreves", artist: "Morat", cover: "https://images.genius.com/71945fe483298a6e9a160ba4aa8050c9.1000x1000x1.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748950/Morat_-_C%C3%B3mo_Te_Atreves_Video_Oficial_blq8d9.m4a" },
  { title: "SOLO AMIGOS", artist: "Adexe y Nau", cover: "https://images.genius.com/ea89db66f1b4f18e011613e093611da1.1000x1000x1.png", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748951/Solo_amigos_-_Adexe_y_Nau_Letra_lyrics_wmuawk.m4a" },
  { title: "THERE'S NOTHING HOLDING ME BACK", artist: "Shawn Mendes", cover: "https://cdn-images.dzcdn.net/images/cover/3e2d3bad308509ecc59dc6de76ac7896/0x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748952/Shawn_Mendes_There_s_Nothing_Holding_Me_Back_Lyrics_e3lpar.m4a" },
  { title: "save your tears", artist: "The Weeknd", cover: "https://cdn-images.dzcdn.net/images/cover/4acc3760e12996fe21a77115fc67760b/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748955/The_Weeknd_-_Save_Your_Tears_Official_Music_Video_ed2oy0.m4a" },
  { title: "Indeciso", artist: "Reik, J Balvin, Lalo Ebratt", cover: "https://m.media-amazon.com/images/I/51pJA4vGKvL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748956/Reik_J_Balvin_Lalo_Ebratt_-_Indeciso_Letra_lqpkqv.m4a" },
  { title: "La Mordidita", artist: "Ricky Martin", cover: "https://i.scdn.co/image/ab67616d0000b27388d450740b559cabdde15d35", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748957/Ricky_Martin_-_La_Mordidita_ft._Yotuel_Letra_vgdin6.m4a" },
  { title: "Vente Pa' Ca", artist: "Ricky Martin", cover: "https://i.scdn.co/image/ab67616d0000b273a7009065e3adf3430e04f63a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748958/Ricky_Martin_-_Vente_Pa__Ca_ft._Maluma_Letra_Lyrics_bplzdf.m4a" },
  { title: "Umbrella", artist: "Rihanna", cover: "https://cdn-images.dzcdn.net/images/cover/91276466fbc876d96be9e6926060af60/1900x1900-000000-80-0-0.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748960/Rihanna_Umbrella_Orange_Version_Official_Music_Video_ft_JAY_Z_fpihd1.m4a" },
  { title: "APT.", artist: "ROSÉ, Bruno Mars", cover: "https://m.media-amazon.com/images/I/51vAIGPAURL._UXNaN_FMjpg_QL85_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748961/ROSE%CC%81_Bruno_Mars_-_APT._Official_Music_Video_ydbvc7.m4a" },
  { title: "Flashes", artist: "RØZ Yng Lvcas", cover: "https://i1.sndcdn.com/artworks-aRMFevdQLRYYTTXi-IRfYkw-t500x500.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748962/R%C3%98Z_Yng_Lvcas_-_flashes_zvoqsg.m4a" },
  { title: "Despechá", artist: "ROSALÍA", cover: "https://i.scdn.co/image/ab67616d0000b273938660520f09a1bae2ed4699", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748973/ROSAL%C3%8DA_-_DESPECH%C3%81_Official_Video_ehc9gl.m4a" },
  { title: "Supernova", artist: "SAIKO", cover: "https://i.scdn.co/image/ab67616d0000b273c3f5b9580dfc96c80705424a", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748974/SAIKO_-_SUPERNOVA_Official_Video___SAKURA_kiwn0u.m4a" },
  { title: "Without Me", artist: "Eminem", cover: "https://m.media-amazon.com/images/I/819VvnW1QZL._UF894,1000_QL80_.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748976/Eminem_-_Without_Me_Lyrics_rbyen5.m4a" },
  { title: "Beauty and a Beat", artist: "Justin Bieber", cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsKPNxCtWtPm7_d468VnoWxPSBsOyZk67HcA&s", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748977/Justin_Bieber_Beauty_And_A_Beat_Official_Music_Video_ft_Nicki_Minaj_ivdtfp.m4a" },
  { title: "Fuego", artist: "Don Omar", cover: "https://i.musicaimg.com/letras/250x250/don-omar.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748984/Fuego_-_Una_Vaina_Loca_Ft._El_Potro_Alvarez_Official_Video_rp0xvr.m4a" },
];

export function CancionesPage(router) {
  const page = document.createElement('div');
  page.className = 'canciones-page';

  let activeTab = 'recuerdan';
  let activeList = SONGS_RECUERDAN;
  let currentIdx = 0;
  let isPlaying = false;
  let audioEl = null;
  let shuffleMode = false;
  let shuffleHistory = [];
  let lyricsVisible = true;

  function getRandomIdx(len) {
    const avoid = Math.min(3, Math.floor(len / 2));
    const recent = shuffleHistory.slice(-avoid);
    const available = [];
    for (let i = 0; i < len; i++) if (!recent.includes(i)) available.push(i);
    const pick = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * len);
    shuffleHistory.push(pick);
    if (shuffleHistory.length > 10) shuffleHistory.shift();
    return pick;
  }

  function render() {
    const s = activeList[currentIdx] || activeList[0];
    page.innerHTML = `
      <div class="canciones-layout">
        <!-- Player -->
        <div class="player-panel glass-card">
          <div class="player-label">Reproduciendo ahora</div>
          <div class="player-album">
            <img id="currentCover" src="${s.cover}" alt="${escapeHtml(s.title)}">
          </div>
          <h2 class="player-title" id="currentTitle">${escapeHtml(s.title)}</h2>
          <p class="player-subtitle" id="currentSubtitle">${escapeHtml(s.artist)}</p>

          <div class="player-controls">
            <button class="player-btn" id="shuffleBtn" title="Modo aleatorio" style="color:${shuffleMode ? 'var(--theme-accent-primary)' : ''}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            </button>
            <button class="player-btn" id="prevBtn" title="Anterior">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
            </button>
            <button class="player-btn play-btn" id="playBtn" title="Reproducir">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="player-btn" id="nextBtn" title="Siguiente">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            </button>
            <button class="player-btn" id="randomBtn" title="Canción aleatoria">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
            </button>
          </div>

          <div class="progress-bar">
            <div class="progress-track" id="progressTrack">
              <div class="progress-fill" id="progressFill"></div>
              <div class="progress-thumb" id="progressThumb"></div>
            </div>
            <div class="progress-time">
              <span id="currentTime">0:00</span>
              <span id="totalTime">0:00</span>
            </div>
          </div>
          <audio id="playerAudio" preload="metadata"></audio>
        </div>

        <!-- Right sidebar -->
        <div class="player-sidebar">
          <div class="lyrics-card glass-card">
            <div class="lyrics-header">
              <span class="lyrics-header-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <h3>Letra</h3>
              <div class="lyrics-actions">
                <button class="icon-btn" id="toggleLyricsBtn" title="Mostrar/Ocultar letra">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="icon-btn" id="expandLyricsBtn" title="Ver letra completa">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
              </div>
            </div>
            <div class="lyrics-panel" id="lyricsPanel">${s.lyrics || '<em>Letra no disponible</em>'}</div>
          </div>

          <!-- Playlist with sub-tabs -->
          <div class="playlist-card glass-card">
            <div class="playlist-header">
              <div class="playlist-tabs">
                <button class="playlist-tab ${activeTab === 'recuerdan' ? 'is-active' : ''}" data-tab="recuerdan">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="${activeTab === 'recuerdan' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  <span>Recuerdan a ti</span>
                </button>
                <button class="playlist-tab ${activeTab === 'completas' ? 'is-active' : ''}" data-tab="completas">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                  <span>Completas</span>
                </button>
              </div>
              <span class="playlist-count">${activeList.length} canciones</span>
            </div>
            <div class="playlist" id="playlist"></div>
          </div>
        </div>
      </div>

      <!-- Lyrics lightbox -->
      <div class="lyrics-lightbox" id="lyricsLightbox" style="display:none">
        <div class="lyrics-lightbox-content">
          <button class="lyrics-lightbox-close" id="closeLightbox">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="lyrics-expanded" id="expandedLyrics"></div>
        </div>
      </div>
    `;
  }

  function loadSong(idx) {
    currentIdx = idx;
    const s = activeList[idx];
    if (!s) return;
    document.getElementById('currentCover').src = s.cover;
    document.getElementById('currentTitle').textContent = s.title;
    document.getElementById('currentSubtitle').textContent = s.artist;
    if (audioEl) audioEl.src = s.audio;
    const lp = document.getElementById('lyricsPanel');
    if (lp) lp.innerHTML = s.lyrics || '<em>Letra no disponible</em>';
    renderPlaylist();
    if (isPlaying && audioEl) audioEl.play().catch(() => {});
  }

  function switchTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    activeList = tab === 'recuerdan' ? SONGS_RECUERDAN : ALL_SONGS;
    shuffleHistory = [];

    // Update tab buttons
    document.querySelectorAll('.playlist-tab').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', isActive);
    });
    const count = document.querySelector('.playlist-count');
    if (count) count.textContent = `${activeList.length} canciones`;

    // Stop and reset
    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
    }
    isPlaying = false;
    updatePlayBtn();

    // Load first song of new list
    currentIdx = 0;
    const s = activeList[0];
    if (!s) return;
    document.getElementById('currentCover').src = s.cover;
    document.getElementById('currentTitle').textContent = s.title;
    document.getElementById('currentSubtitle').textContent = s.artist;
    if (audioEl) audioEl.src = s.audio;
    const lp = document.getElementById('lyricsPanel');
    if (lp) lp.innerHTML = s.lyrics || '<em>Letra no disponible</em>';
    renderPlaylist();
  }

  function renderPlaylist() {
    const list = document.getElementById('playlist');
    if (!list) return;
    list.innerHTML = activeList.map((s, i) => {
      const isSpecial = !!s.experience;
      const experienceRoute = isSpecial ? `#/${s.experience}` : '';
      return `
      <button type="button" class="playlist-item ${i === currentIdx ? 'is-active' : ''}${isSpecial ? ' is-special' : ''}" data-index="${i}">
        <img src="${s.cover}" alt="${escapeHtml(s.title)}" loading="lazy">
        <div class="playlist-item-info">
          <strong>
            ${escapeHtml(s.title)}
            ${isSpecial ? '<span class="special-badge">✨ Experiencia</span>' : ''}
          </strong>
          <span>${escapeHtml(s.artist)}</span>
        </div>
        <span class="playlist-item-icon">
          ${i === currentIdx && isPlaying
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
          }
        </span>
        ${isSpecial ? `<a href="${experienceRoute}" class="playlist-exp-btn" title="Experiencia inmersiva" onclick="event.stopPropagation()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </a>` : ''}
      </button>
    `}).join('');

    list.querySelectorAll('.playlist-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        loadSong(idx);
        if (audioEl) {
          audioEl.play().catch(() => {});
          isPlaying = true;
          updatePlayBtn();
          renderPlaylist();
        }
      });
    });
  }

  function updatePlayBtn() {
    const btn = document.getElementById('playBtn');
    if (!btn) return;
    btn.innerHTML = isPlaying
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) {
      isPlaying = true;
      updatePlayBtn();
      renderPlaylist();
      audioEl.play().catch(() => {
        isPlaying = false;
        updatePlayBtn();
        renderPlaylist();
      });
    } else {
      audioEl.pause();
      isPlaying = false;
      updatePlayBtn();
      renderPlaylist();
    }
  }

  function nextSong() {
    const len = activeList.length;
    if (shuffleMode && len > 1) {
      loadSong(getRandomIdx(len));
    } else {
      loadSong((currentIdx + 1) % len);
    }
    if (isPlaying && audioEl) {
      audioEl.play().catch(() => {
        isPlaying = false;
        updatePlayBtn();
        renderPlaylist();
      });
    }
  }

  function prevSong() {
    const len = activeList.length;
    if (shuffleMode && len > 1) {
      loadSong(getRandomIdx(len));
    } else {
      loadSong((currentIdx - 1 + len) % len);
    }
    if (isPlaying && audioEl) {
      audioEl.play().catch(() => {
        isPlaying = false;
        updatePlayBtn();
        renderPlaylist();
      });
    }
  }

  // Initial render
  render();
  renderPlaylist();

  // Bind events after element is in DOM
  requestAnimationFrame(() => {
    audioEl = document.getElementById('playerAudio');
    if (!audioEl) return;

    // Audio events
    audioEl.addEventListener('timeupdate', () => {
      if (audioEl.duration) {
        const pct = (audioEl.currentTime / audioEl.duration) * 100;
        const fill = document.getElementById('progressFill');
        const thumb = document.getElementById('progressThumb');
        if (fill) fill.style.width = pct + '%';
        if (thumb) thumb.style.left = pct + '%';
        document.getElementById('currentTime').textContent = formatTime(audioEl.currentTime);
        document.getElementById('totalTime').textContent = formatTime(audioEl.duration);
      }
    });

    audioEl.addEventListener('ended', nextSong);
    audioEl.addEventListener('error', () => {
      isPlaying = false;
      updatePlayBtn();
      renderPlaylist();
      showToast('Error al reproducir el audio', 'error');
    });

    // Progress bar click
    const track = document.getElementById('progressTrack');
    if (track) {
      track.addEventListener('click', (e) => {
        if (!audioEl.duration) return;
        const rect = track.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audioEl.currentTime = pct * audioEl.duration;
      });
    }

    // Controls
    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('prevBtn').addEventListener('click', prevSong);
    document.getElementById('nextBtn').addEventListener('click', nextSong);

    document.getElementById('shuffleBtn').addEventListener('click', () => {
      shuffleMode = !shuffleMode;
      const btn = document.getElementById('shuffleBtn');
      btn.style.color = shuffleMode ? 'var(--theme-accent-primary)' : '';
      showToast(shuffleMode ? 'Modo aleatorio activado' : 'Modo aleatorio desactivado', 'info');
    });

    document.getElementById('randomBtn').addEventListener('click', () => {
      if (!activeList.length) return;
      loadSong(getRandomIdx(activeList.length));
      if (audioEl) {
        audioEl.play().catch(() => {});
        isPlaying = true;
        updatePlayBtn();
        renderPlaylist();
      }
    });

    // Sub-tab switching
    document.querySelectorAll('.playlist-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Lyrics controls
    document.getElementById('toggleLyricsBtn').addEventListener('click', () => {
      const panel = document.getElementById('lyricsPanel');
      lyricsVisible = !lyricsVisible;
      panel.style.display = lyricsVisible ? 'block' : 'none';
    });

    document.getElementById('expandLyricsBtn').addEventListener('click', () => {
      const text = document.getElementById('lyricsPanel').innerHTML;
      document.getElementById('expandedLyrics').innerHTML = text;
      document.getElementById('lyricsLightbox').style.display = 'flex';
    });

    document.getElementById('closeLightbox').addEventListener('click', () => {
      document.getElementById('lyricsLightbox').style.display = 'none';
    });

    document.getElementById('lyricsLightbox').addEventListener('click', (e) => {
      if (e.target === document.getElementById('lyricsLightbox')) {
        document.getElementById('lyricsLightbox').style.display = 'none';
      }
    });

    // Load first song
    loadSong(0);
  });

  return page;
}
