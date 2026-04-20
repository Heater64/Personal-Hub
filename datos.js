// ==========================================
// DATOS - Todas las canciones, galería y memes
// ==========================================

// URLs base para canciones y portadas
const SONGS_BASE_URL = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

// ========== LISTA COMPLETA DE CANCIONES (14 canciones) ==========
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
        lyrics: `¿A caso no te has dado cuenta?<br>De lo bien que me complementas<br>Si quieres te invito un helado y te explico lo chido que haces que me sienta<br><br>Contigo estoy high sin avión<br>Me haces perder la razón<br>Estoy todo el día pensándote con mariposas en el corazón<br><br>Y tú (y tú-uh)<br>Me pones todo de cabeza<br>Tú (y tú-uh)<br>Eras esa última pieza`
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
        lyrics: `Sos lo que me da paz<br>Lo que andaba buscando<br>Y esa felicidad<br>Que hace que ande sonriendo<br><br>Quiero verte feliz<br>Mejor si es al lado de mí<br>Love incondicional<br>Como perro a su amo, te sigo amando<br><br>Dama con fama 'e cama alta gama y corazón partido<br>Fono lleno 'e fanes que llaman y solo atiende el mío`
    },
    {
        title: "Pareja del año",
        artist: "Sebastián Yatra, Myke Towers",
        album: "Pop · 2021",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(5).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Sebasti%C3%A1n_Yatra,_Myke_Towers_Pareja_del_A%C3%B1o_Official_Performance%20(mp3cut.net).m4a`,
        lyrics: `Qué tan loco sería si yo fuera<br>El dueño de tu corazón por solo un día<br>Si nos gana la alegría, yo por fin te besaría<br>¿Qué pasaría?<br><br>Si me dieran solo veinticuatro horas, yo las aprovecho<br>Juro que yo voy a hacerte cosas que nunca te han hecho<br>Ya yo me cansé de ser amigos con derecho'<br>Yo tal vez no te merezco<br>Pero no hay ni que decirlo<br>Si nos juntamos, seríamos la pareja del siglo`
    },
    {
        title: "¿A dónde vamos?",
        artist: "Morat",
        album: "Pop · 2022",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(6).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Morat%20-%20A%20D%C3%B3nde%20Vamos%20(Letra)%20_%20Albert%20%26%20Maricheli%20(mp3cut.net).m4a`,
        lyrics: `Que siendo un extraño, te dije: "te amo"<br>Te he estado buscando por más de mil años"<br>Y tú respondiste: "¿a dónde vamos?"<br>Contra las apuestas, aquí nos quedamos<br><br>Viviendo de fiesta después del verano en el que respondiste<br>"¿A dónde vamos?"<br>Y aunque la historia no estaba prevista<br>Somos la prueba de que existe amor a primera vista`
    },
    {
        title: "Cuando te vi",
        artist: "Trueno, Maria Becerra",
        album: "Urban · 2022",
        cover: `${SONGS_BASE_URL}/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png`,
        audio: `${SONGS_BASE_URL}/Canciones/Maria%20Becerra,%20Trueno,%20Big%20One%20-%20Cuando%20Te%20Vi%20_%20CROSSOVER%20%235%20(mp3cut.net).m4a`,
        lyrics: `Aunque todavía no soy rico, te puedo dar amor como de chico<br>Cosquillas en la panza, como antes del primer pico<br>O poder agarrarte de la mano una tarde de verano<br>Momentos que se vuelven infinitos<br><br>Y por favor, no le pongas precio ni valor a mi honor<br>Que sin idealizaciones, no hay dolor<br>Y eso es bueno para mí, que no ando en busca del amor`
    },
    {
        title: "Todo de Ti",
        artist: "Rauw Alejandro",
        album: "Reguetón · 2021",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(7).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Rauw%20Alejandro%20-%20Todo%20de%20Ti%20(Video%20Oficial).m4a`,
        lyrics: `El viento soba tu cabello<br>Me matan esos ojos bellos<br>Me gusta tu olor, de tu piel, el color<br>Y como me haces sentir<br><br>Me gusta tu boquita, ese labial rosita<br>Y cómo me besas a mí<br>Contigo quiero despertar<br>Hacerlo después de fumar<br>Ya no tengo na' que buscar<br>Algo fuera de aquí`
    },
    {
        title: "Loco Enamorado",
        artist: "Abraham Mateo, Farruko",
        album: "Pop · 2020",
        cover: `${SONGS_BASE_URL}/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png`,
        audio: `${SONGS_BASE_URL}/Canciones/Loco_Enamorado,_de_Abraham_Mateo_Ft_Farruko_%26_Christian_Daniel_Letra.m4a`,
        lyrics: `Te confieso llevo un rato idealizándote<br>Toda una vida yo buscándote<br>No sé que hacer, te ves muy bien<br>Me acercaré<br><br>Te confieso que lo mío no es realmente hablar<br>Soy algo tímido, como verás<br>Pero, esta vez<br>Me atreveré, te lo diré<br><br>Ya me tienes como un loco enamorado<br>Baby, la verdad es que tú me gustas demasiado`
    },
    {
        title: "Bailando",
        artist: "Enrique Iglesias",
        album: "Latino · 2014",
        cover: `${SONGS_BASE_URL}/Fotos/R%20(1).png`,
        audio: `${SONGS_BASE_URL}/Canciones/Enrique_Iglesias_%E2%80%93_Bailando_Lyrics_feat_Descemer_Bueno,_Gente_De.m4a`,
        lyrics: `Yo te miro y se me corta la respiración<br>Cuando tú me miras, se me sube el corazón<br>Y en un silencio tu mirada dice mil palabras<br>La noche en la que te suplico que no salga el sol<br><br>Bailando<br>Tu cuerpo y el mío llenando el vacío<br>Subiendo y bajando<br>Bailando<br>Ese fuego por dentro me va enloqueciendo`
    },
    {
        title: "La Plena",
        artist: "Beéle, Westcol",
        album: "Urban · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/ab67616d0000b2734740100d84f3667f1eae6870.jpeg`,
        audio: `${SONGS_BASE_URL}/Canciones/Be%C3%A9le,%20Westcol,%20Ovy%20On%20The%20Drums%20-%20LA%20PLENA%20(W%20Sound%2005).m4a`,
        lyrics: `Eres la niña de mis ojos tú<br>Eres todo lo que quiero yo<br>¿Una cerveza pa calmar la sed?, no<br>Mejor ser besado por su boquita, amor<br><br>Las tentaciones así como tú<br>Merecen pecados como yo<br>Ay, si tú quieres, solo da la lu'<br>Tú sabes que no vo'a a decir que no`
    },
    {
        title: "Tacones Rojos",
        artist: "Sebastián Yatra",
        album: "Pop · 2021",
        cover: `${SONGS_BASE_URL}/Fotos/OIP%20(8).webp`,
        audio: `${SONGS_BASE_URL}/Canciones/Sebasti%C3%A1n%20Yatra%20-%20Tacones%20Rojos%20(Official%20Video)%20(1).m4a`,
        lyrics: `Hay un rayo de luz<br>Que entró por mi ventana<br>Y me ha devuelto las ganas<br>Me quita el dolor<br><br>Tu amor es uno de esos<br>Que te cambian con un beso<br>Y te pone a volar<br>Mi pedazo de sol<br>La niña de mis ojos<br>Tenía una colección<br>De corazones rotos`
    },
    {
        title: "Cosas Que No Te Dije",
        artist: "Saiko",
        album: "Urban · 2023",
        cover: `${SONGS_BASE_URL}/Fotos/ab67616d0000b273fb045f7dda9773e266437bc6.jpeg`,
        audio: `${SONGS_BASE_URL}/Canciones/Saiko%20-%20COSAS%20QUE%20NO%20TE%20DIJE%20(Official%20Video).m4a`,
        lyrics: `Dime si te gustaría<br>Vamos a escribir nuestras iniciales juntas<br>La verdad que tú me gusta'<br>En invierno y en verano<br><br>Si te hago la pregunta<br>El horóscopo dice que somos compatible'<br>Y eso que yo no creía<br>Pero habrá que hacerle caso`
    },
    {
        title: "Indeciso",
        artist: "Reik, J Balvin, Lalo Ebratt",
        album: "Reguetón · 2020",
        cover: `${SONGS_BASE_URL}/Fotos/R%20(3).jpeg`,
        audio: `${SONGS_BASE_URL}/Canciones/Reik,%20J%20Balvin,%20Lalo%20Ebratt%20-%20Indeciso%20(Letra).m4a`,
        lyrics: `Siempre que ella baila así<br>A mí me daña la cabeza<br>El día que la conocí<br>Tomaba tequila y cerveza<br><br>Y ahora yo me la pasó buscando<br>Una razón pa' verte bailando<br>Me robó el corazón sin permiso<br>Su movimiento me tiene indeciso`
    }
];

// ========== GALERÍA POR CARPETAS ==========
const galleryFolders = {
    "Flores": [
        "https://tse1.mm.bing.net/th/id/OIP.yzoA33gqIWp4VvyFBIgZ9AHaHa?r=0",
        "https://tse2.mm.bing.net/th/id/OIP.ncCyiDtANWeOuqyeQNPP9gHaE8?r=0",
        "https://images.immediate.co.uk/production/volatile/sites/10/2021/06/2048x1365-Gypsophila-SEO-GettyImages-1305732961-38ee11b.jpg"
    ],
    "Gatos": [
        "https://i.pinimg.com/originals/56/8d/30/568d30ba412ef11370d4abfa5fedc50a.jpg",
        "https://i.pinimg.com/originals/e2/dd/1e/e2dd1e160a9aea6e58d80d3893449d49.jpg",
        "https://wonder-day.com/wp-content/uploads/2022/03/wonder-day-avatar-memes-cats-23.jpg"
    ],
    "Harry Potter": [
        "https://th.bing.com/th/id/R.c2c113d0707954ddb1cd5edd31c5e12b?rik=XgiQVDkbBF4Unw",
        "https://th.bing.com/th/id/OIP.W8yJ7g6y2m1t4p0r0s2e5d6c7b8a9.jpg"
    ],
    "Gravity Falls": [
        "https://images6.alphacoders.com/131/1316755.jpg",
        "https://image.tmdb.org/t/p/original/l0XvAI856XdyDYEfr1njztjH7u0.jpg"
    ],
    "Peluches": [
        "http2.mlstatic.com/peluches-gigantes-140-metros-peluche-regalo-oso-de-peluche-D_NQ_NP_720797-MCO25739024511_072017-F.jpg",
        "https://i5.walmartimages.com/asr/f4867e63-2436-40a5-96f6-47bfbf67326a.fc3d124a21ef9ce002233faa3f6bae12.jpeg"
    ]
};

// ========== MEMES POR CARPETAS (Instagram Guardados Style) ==========
const memeImages = {
    "Favoritos ⭐": [
        "https://tu-rincon-favorito.vercel.app/imagenes/GorditoJoker.png",
        "https://tu-rincon-favorito.vercel.app/imagenes/Peeerry.png",
        "https://tu-rincon-favorito.vercel.app/imagenes/Refri.jpg"
    ],
    "Gatos 🐱": [
        "https://tu-rincon-favorito.vercel.app/imagenes/Gatosencama.jpg",
        "https://i.pinimg.com/originals/56/8d/30/568d30ba412ef11370d4abfa5fedc50a.jpg"
    ],
    "Random 😂": [
        "https://tu-rincon-favorito.vercel.app/imagenes/MinecraftUs.jpg",
        "https://tu-rincon-favorito.vercel.app/imagenes/MemeAvion.jpg"
    ]
};

// ========== GUSTOS PERSONALES ==========
const gustos = {
    personal: [
        "Colores: Rosa y negro",
        "Números: 4, 7, 27, 46, 48",
        "Flores: Gypsophila, manzanilla, rosas",
        "Animal: Gatos",
        "Perfume: Moschino Toy 2",
        "Joyería: anillos, collares, pulseras"
    ],
    hobbies: [
        "Dormir, dibujar, hacer deporte",
        "Películas: Harry Potter, Frozen",
        "Series: Los Simpson, Gravity Falls",
        "Le gusta todo en música",
        "Quiere ser programadora"
    ],
    food: [
        "Bayas, frutas, verduras, ramen",
        "Chocolate blanco con Oreos",
        "Fresas con chocolate",
        "Bubble tea, zumo de naranja"
    ]
};

// ========== DATOS DE GATOS ==========
const catFacts = [
    "Duermen 12-16 horas al día",
    "Pueden girar orejas 180°",
    "Nariz única como huella",
    "Tienen tercer párpado",
    "Tapetum lucidum para ver en oscuro",
    "Les encanta calor y alturas"
];

// ========== DATOS DE SAN PETERSBURGO ==========
const spbData = {
    foods: [
        ["Borsch", "https://assets.elgourmet.com/wp-content/uploads/2023/03/cover_xqm3gckj18_shutterstock-489714061.jpg"],
        ["Pelmeni", "https://static.vecteezy.com/system/resources/previews/015/590/084/large_2x/traditional-russian-pelmeni-or-ravioli-dumplings-with-meat-on-wood-black-background-russian-food-and-russian-kitchen-concept-photo.JPG"],
        ["Blini", "https://letthebakingbegin.com/wp-content/uploads/2020/02/Russian-Blini-Recipe-2.jpg"]
    ],
    places: [
        "https://images.musement.com/cover/0001/70/thumb_69104_cover_header.jpeg",
        "https://th.bing.com/th/id/R.dd2aeac01da560c0d64a7f36227001a4?rik=OEmRcLGMx33XAQ",
        "https://th.bing.com/th/id/R.4310f3839d4dedab0eb8d530509ecc56?rik=c27AsXTIZh%2b1iA"
    ],
    traditions: [
        "Noches Blancas: crepusculo continuo y conciertos nocturnos.",
        "Pan y sal: simbolo de hospitalidad y respeto.",
        "Velas Escarlatas: graduacion con barcos, fuegos artificiales y musica.",
        "Opera y ballet bajo las estrellas durante el verano."
    ],
    phrases: [
        "Privet - Hola",
        "Spasibo - Gracias",
        "Pozhaluysta - De nada / Por favor",
        "Do svidaniya - Adios",
        "Ya tebya lyublyu - Te amo"
    ]
};

// ========== EXPORTAR TODO ==========
// En Vanilla JS, everything is global
window.songsData = songs;
window.galleryFoldersData = galleryFolders;
window.memeImagesData = memeImages;
window.gustosData = gustos;
window.catFactsData = catFacts;
window.spbData = spbData;