// ==========================================
// DATOS - Todas las canciones, galería y memes
// ==========================================

const SONGS_BASE_URL = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

// ========== CANCIONES (sin cambios) ==========
const songs = [
    {
        title: "Si No Estás",
        artist: "Iñigo Quintero",
        album: "Balada · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/1200x1200bf-60.jpg`,
        audio: `${SONGS_BASE_URL}/Canciones/Si%20No%20Est%C3%A1s%20%E2%80%93%20I%C3%B1igo%20Quintero.m4a`,
        lyrics: `Quiero ver tu otra mitad,<br>alejarme de esta ciudad,<br>y contagiarme de tu forma de pensar.<br><br>Miro al cielo al recordar,<br>me doy cuenta otra vez más<br>que no hay momento que pase sin dejarte de pensar.`
    },
    {
        title: "¿A caso no te has dado cuenta?",
        artist: "Unknown Artist",
        album: "Reguetón · 2024",
        cover: `${SONGS_BASE_URL}/Fotos/maxresdefault.jpg`,
        audio: `${SONGS_BASE_URL}/Canciones/_%C2%BFAcaso_no_te_has_dado_cuenta_de_lo_bien_que_me_complementas_Letra%20(mp3cut.net).m4a`,
        lyrics: `¿A caso no te has dado cuenta?<br>De lo bien que me complementas<br>Si quieres te invito un helado y te explico lo chido que haces que me sienta<br><br>Contigo estoy high sin avión<br>Me haces perder la razón<br>Estoy todo el día pensándote con mariposas en el corazón<br><br>Y tú (y tú-uh)<br>Me pones todo de cabeza<br>Tú (y tú-uh)<br>Eras esa última pieza<br><br>Tú (tú-uh)<br>Eres tan diferente<br>Y no hay nadie que me vuele así la mente como lo haces tú`
    },
    {
        title: "Mi niña",
        artist: "Wisin, Myke Towers",
        album: "Urban · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(3).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Wisin,_Myke_Towers,_Los_Legendarios_Mi_Ni%C3%B1a_Letra_Lyrics%20(mp3cut.net).m4a`,
        lyrics: `Yo quiero viajar el mundo contigo de compañía (tú sabe' ya)<br>Ninguna mujer me comprendía<br>Cierra los ojos y dime en qué lugar es que estaría (ajá)<br>Que voy a pedir una estadía<br><br>A ella le cogen cosa' porque está conmigo<br>El que te falte el respeto se convierte en mi enemigo<br>Hay muchas envidiosa', dicen que es prohibido<br>Siempre está en mi mente, yo nunca la olvido<br>Porque es mi niña (oh-oh-oh-oh)`
    },
    {
        title: "Rara vez",
        artist: "Milo J, Taiu",
        album: "Trap · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(4).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Taiu,%20Milo%20j%20-%20Rara%20Vez%20(mp3cut.net).m4a`,
        lyrics: `Sos lo que me da paz<br>Lo que andaba buscando<br>Y esa felicidad<br>Que hace que ande sonriendo<br><br>Quiero verte feli'<br>Mejor si es al la'o de mí<br>Love incondicional<br>Como perro a su amo, te sigo amando`
    },
    {
        title: "Pareja del año",
        artist: "Sebastián Yatra, Myke Towers",
        album: "Pop · 2021",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(5).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Sebasti%C3%A1n_Yatra,_Myke_Towers_Pareja_del_A%C3%B1o_Official_Performance%20(mp3cut.net).m4a`,
        lyrics: `Qué tan loco sería si yo fuera<br>El dueño de tu corazón por solo un día<br>Si nos gana la alegría, yo por fin te besaría<br>¿Qué pasaría?`
    },
    {
        title: "¿A dónde vamos?",
        artist: "Morat",
        album: "Pop · 2022",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(6).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Morat%20-%20A%20D%C3%B3nde%20Vamos%20(Letra)%20_%20Albert%20%26%20Maricheli%20(mp3cut.net).m4a`,
        lyrics: `Que siendo un extraño, te dije te amo<br>Te he estado buscando por más de mil años<br>Y tú respondiste: ¿A dónde vamos?<br>Contra las apuestas, aquí nos quedamos`
    },
    {
        title: "Cuando te vi",
        artist: "Trueno, Maria Becerra",
        album: "Urban · 2022",
        cover: `${SONGS_BASE_URL}/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png`,
        audio: `${SONGS_BASE_URL}/Canciones/Maria%20Becerra,%20Trueno,%20Big%20One%20-%20Cuando%20Te%20Vi%20_%20CROSSOVER%20%235%20(mp3cut.net).m4a`,
        lyrics: `Aunque todavía no soy rico (no)<br>Te puedo dar amor como de chico<br>Cosquillas en la panza, como antes del primer pico (mai)`
    },
    {
        title: "Todo de Ti",
        artist: "Rauw Alejandro",
        album: "Reguetón · 2021",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(7).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Rauw%20Alejandro%20-%20Todo%20de%20Ti%20(Video%20Oficial).m4a`,
        lyrics: `El viento soba tu cabello<br>Me matan esos ojos bellos<br><br>Me gusta tu olor, de tu piel el color<br>Y cómo me haces sentir<br>Me gusta tu boquita, ese labial rosita (tú)<br>Y cómo me besas a mí`
    },
    {
        title: "Loco Enamorado",
        artist: "Abraham Mateo, Farruko",
        album: "Pop · 2020",
        cover: `${SONGS_BASE_URL}/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png`,
        audio: `${SONGS_BASE_URL}/Canciones/Loco_Enamorado,_de_Abraham_Mateo_Ft_Farruko_%26_Christian_Daniel_Letra.m4a`,
        lyrics: `Te confieso, llevo un rato idealizándote<br>Toda una vida yo buscándote<br><br>Ya me tienes como un loco enamorado<br>Baby, la verdad es que tú me gustas demasiado`
    },
    {
        title: "Bailando",
        artist: "Enrique Iglesias",
        album: "Latino · 2014",
        cover: `${SONGS_BASE_URL}/Fotos/R%20(1).png`,
        audio: `${SONGS_BASE_URL}/Canciones/Enrique_Iglesias_%E2%80%93_Bailando_Lyrics_feat_Descemer_Bueno,_Gente_De.m4a`,
        lyrics: `Yo te miro y se me corta la respiración<br>Cuando tú me miras, se me sube el corazón<br><br>Bailando, bailando<br>Tu cuerpo y el mío, llenando el vacío<br>Subiendo y bajando`
    },
    {
        title: "La Plena",
        artist: "Beéle, Westcol",
        album: "Urban · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/ab67616d0000b2734740100d84f3667f1eae6870.jpeg`,
        audio: `${SONGS_BASE_URL}/Canciones/Be%C3%A9le,%20Westcol,%20Ovy%20On%20The%20Drums%20-%20LA%20PLENA%20(W%20Sound%2005).m4a`,
        lyrics: `Eres la niña de mis ojo', tú<br>Eres todo lo que quiero yo<br><br>Ay, tienes la magia<br>Tú, sí, tienes una vainita que a mí me encanta, me enloquece`
    },
    {
        title: "Tacones Rojos",
        artist: "Sebastián Yatra",
        album: "Pop · 2021",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(8).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Sebasti%C3%A1n%20Yatra%20-%20Tacones%20Rojos%20(Official%20Video)%20(1).m4a`,
        lyrics: `Hay un rayo de luz que entró por mi ventana<br>Y me ha devuelto las ganas, me quita el dolor<br><br>Mi pedazo de Sol, la niña de mis ojos<br>La que baila reguetón con tacones rojos`
    },
    {
        title: "Cosas Que No Te Dije",
        artist: "Saiko",
        album: "Urban · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/ab67616d0000b273fb045f7dda9773e266437bc6.jpeg`,
        audio: `${SONGS_BASE_URL}/Canciones/Saiko%20-%20COSAS%20QUE%20NO%20TE%20DIJE%20(Official%20Video).m4a`,
        lyrics: `Que yo te quiero dormida<br>En la cama, con mi hoodie<br>Dime si te gustaría<br>Quiero ser todos tus hobbies, mami<br><br>Solo una cosa te pediría<br>Que si te doy mi corazón<br>Me lo cuides todos los días`
    },
    {
        title: "Indeciso",
        artist: "Reik, J Balvin, Lalo Ebratt",
        album: "Reguetón · 2020",
        cover: `${SONGS_BASE_URL}/Fotos/R%20(3).jpeg`,
        audio: `${SONGS_BASE_URL}/Canciones/Reik,%20J%20Balvin,%20Lalo%20Ebratt%20-%20Indeciso%20(Letra).m4a`,
        lyrics: `Siempre que ella baila así<br>A mí me daña la cabeza<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso`
    }
];

// ========== GALERÍA (sin cambios) ==========
const galleryFolders = {
    "Flores 🌸": [
        "https://tse4.mm.bing.net/th/id/OIP.siib8QHQtFNbO9UW61p_mgHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
        "https://images.immediate.co.uk/production/volatile/sites/10/2021/06/2048x1365-Gypsophila-SEO-GettyImages-1305732961-38ee11b.jpg",
        "https://tse3.mm.bing.net/th/id/OIP.g1ZfCF5vVhcOkJAN78ZtDAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
        "https://i.etsystatic.com/13697085/r/il/a2f0e8/3104042304/il_1588xN.3104042304_eqct.jpg",
        "https://i.pinimg.com/originals/85/7f/00/857f00fec518d3e2490c3026e7f77b10.jpg",
        "https://bulbs.co.uk/wp-content/uploads/2022/12/Gypsophila.jpg",
        "https://i.etsystatic.com/25318042/r/il/9a8d07/2772980805/il_1588xN.2772980805_cqio.jpg",
        "https://inlandflowermarket.com/wp-content/uploads/2021/10/gypsophila-small-1.jpg"
    ],
    "Gatos 🐱": [
        "https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/1056251/pexels-photo-1056251.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/127028/pexels-photo-127028.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/2071873/pexels-photo-2071873.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/104827/cat-pet-animal-domestic-104827.jpeg?auto=compress&cs=tinysrgb&w=600",
        "https://images.pexels.com/photos/33152/cat-kitten-animal-cat-play.jpg?auto=compress&cs=tinysrgb&w=600",
        "https://i.pinimg.com/1200x/ab/de/70/abde70ec7dd62bf68c9e53ac714a22f3.jpg",
        "https://i.pinimg.com/1200x/70/97/0c/70970c1c4bb9ae6157a63be625721659.jpg"
    ]
};

// ========== MEMES (con imágenes y videos desde Cloudinary) ==========
const memeImages = {
    "Gatos": [
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777135720/CurriculumGatos_tixrwq.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/Gatosencama_m3esg5.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777136105/524724027_18073028165474541_832400577264050365_n_ja2eg2.jpg",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134958/gatitos_tm31wg.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134958/Estos_son_los_gatos_carpinteros_z4i9jw.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134958/Da%C3%B1oFisicoVsEmocionalGato_jvksb6.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/MichisCancioncitaJAJAJJA_jdwrp2.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/MiewMauwLalalalala_hxoqki.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/gatito_isgr4b.mp4",
    ],
    "Minecraft": [
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/MinecraftUs_f4yeux.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/MemeAvion_rv5b8a.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777136536/474557684_17994811340751873_655058973688064320_n_a4xwdu.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777137778/comidaMinecraft_s0ba1p.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777137778/CuentaBancaria_iysvsu.jpg",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777136544/Waterdrop_iqvfx4.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777137777/Nosotros_en_otra_vida_ge9znv.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777137779/Pov_vas_a_minar_con_tu_novia_twqri8.mp4",
    ],

    "Spiderman": [
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777132934/Spidermaaaan.mp4",
    ],

    "Random": [
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/GorditoJoker_q6ntdf.png",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/Peeerry_kvgggd.png",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/Refri_ztpbvv.jpg",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_-4_g2dugy.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-5_y6tem1.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_-6_o3hsbs.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-7_ywahm1.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-8_swf6ib.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-9_cfnetd.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-10_u2uk0l.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-12_gy0tet.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_o5honc.mp4",
    ],

    "Te amo👑": [
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-1_guzqtm.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_-3_cotmqd.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777132934/bailesnowman.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-11_a2qajj.mp4",
    ],
};

// ========== DATOS DE SAN JUAN PUEBLO (actualizado) ==========
const spbData = {
intro: "San Juan Pueblo es una vibrante aldea del municipio de La Masica, en el departamento de Atlántida, Honduras. Situada entre Tela y La Ceiba, esta comunidad de aproximadamente 10,000–15,000 habitantes se fundó alrededor de 1881 y originalmente se llamaba 'San Juan Caite'. Hoy es un próspero centro comercial y agroindustrial, famoso por las aguas cristalinas del río San Juan, su espíritu resiliente y sus tradiciones hondureñas.",
curiosidades: [
{
icon: "🏞️",
titulo: "Río San Juan: el corazón del pueblo",
texto: "Las aguas frescas y cristalinas del río San Juan atraviesan la comunidad y sirven como centro de recreación y diversión para pobladores y visitantes. Es el atractivo natural más querido del pueblo."
},
{
icon: "📅",
titulo: "Fundación y nombre original",
texto: "San Juan Pueblo fue fundado alrededor de 1881. Originalmente se llamaba 'San Juan Caite' (de 'caite', sandalia) porque estaba alejado de San Juan Benque, una aldea próspera en la época bananera."
},
{
icon: "🌪️",
titulo: "Resiliencia tras el Huracán Fifí",
texto: "En 1974, el Huracán Fifí devastó la región, pero provocó un repoblamiento masivo, especialmente de personas del occidente de Honduras. El pueblo se reconstruyó y salió adelante."
},
{
icon: "🌋",
titulo: "Enjambre sísmico de 2013",
texto: "En 2013, San Juan Pueblo sufrió un 'enjambre sísmico' con 36 sismos de magnitud entre 3.1 y 5.6. Se destruyeron 140 casas y 66 resultaron dañadas, pero afortunadamente no hubo víctimas mortales."
},
{
icon: "🏛️",
titulo: "Tres intentos fallidos de ser municipio",
texto: "Desde 1996, los habitantes han buscado convertir San Juan Pueblo en el noveno municipio de Atlántida. Los intentos han fracasado porque la ley exige al menos 30,000 habitantes y 40 km² de extensión; actualmente tienen unos 15,000 hab. y 5 km²."
},
{
icon: "⚽",
titulo: "Estadio 'Carlos Calderón'",
texto: "El fútbol es la pasión local. El estadio municipal lleva el nombre de 'Carlos Calderón' y es el escenario de los encuentros más importantes de la comunidad."
},
{
icon: "🗣️",
titulo: "Significado de 'San Juan' en lengua tolupán",
texto: "El nombre 'San Juan' proviene de la lengua xicaque (tolupán): 'xantun' o 'xan' significa 'río entre montañas', una descripción perfecta del paisaje que rodea al pueblo."
}
],
foods: [
["Baleada", "https://res.cloudinary.com/dcsent4fs/image/upload/v1777138742/Baleada_oucqlv.jpg"],
["Sopa de Caracol", "https://example.com/sopa_caracol.jpg"],
["Yuca con Chicharrón", "https://example.com/yuca_chicharron.jpg"]
],
places: [
"https://example.com/rio_san_juan.jpg",
"https://example.com/iglesia_san_juan.jpg",
"https://example.com/estadio_carlos_calderon.jpg"
],
traditions: [
"Fiestas Patronales de San Juan Bautista: Se celebran en honor al patrón del pueblo, con procesiones, juegos mecánicos, música y bailes típicos.",
"Alfombras de Semana Santa: Elaboradas con aserrín coloreado, especialmente en Comayagua, pero también imitadas en San Juan Pueblo.",
"Desfiles patrios del 15 de septiembre: Día de la Independencia con bandas escolares y palillonas.",
"Ir al estadio a ver fútbol: Afición compartida por casi todos; los partidos de la Liga Nacional y la Selección son eventos multitudinarios."
],
phrases: [
"¡Pucha! — Expresión de asombro o enfado muy hondureña.",
"Baleada — La comida típica por excelencia (tortilla de harina con frijoles, queso y mantequilla).",
"¡Déjeme ver! — Frase coloquial para pedir atención.",
"Está mero — Significa que algo está cerca o listo.",
"¿Qué pex? — Versión local de '¿Qué pasa?'"
]
};

// ========== EXPORTAR TODO ==========
window.songsData         = songs;
window.galleryFoldersData = galleryFolders;
window.memeImagesData    = memeImages;
window.gustosData        = gustos;
window.catFactsData      = catFacts;
window.spbData           = spbData;