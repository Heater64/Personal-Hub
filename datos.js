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
    "Favoritos ⭐": [
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/GorditoJoker_q6ntdf.png",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/Peeerry_kvgggd.png",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/Refri_ztpbvv.jpg",
        // Videos en la misma carpeta (se mostrarán como videos en la cuadrícula)
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-1_guzqtm.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-2_etahyv.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_-3_cotmqd.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_-4_g2dugy.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-5_y6tem1.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_-6_o3hsbs.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-7_ywahm1.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-8_swf6ib.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-9_cfnetd.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-10_u2uk0l.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123650/Memes_favoritos_-11_a2qajj.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123651/Memes_favoritos_-12_gy0tet.mp4",
        "https://res.cloudinary.com/dcsent4fs/video/upload/v1777123652/Memes_favoritos_o5honc.mp4"
    ],
    "Gatos 🐱": [
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/Gatosencama_m3esg5.jpg"
    ],
    "Random 😂": [
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/MinecraftUs_f4yeux.jpg",
        "https://res.cloudinary.com/dcsent4fs/image/upload/v1777123664/MemeAvion_rv5b8a.jpg"
    ]
};

// ========== GUSTOS PERSONALES (actualizado: podio) ==========
const gustos = {
    podio: [
        {
            puesto: "1º",
            medalla: "🥇",
            titulo: "Harry Potter",
            tipo: "Saga de películas · 2001–2011",
            descripcion: "La saga mágica por excelencia. Siete libros, ocho películas y un mundo que nunca deja de crecer. Hogwarts, los personajes entrañables y la lucha entre el bien y el mal la convierten en una historia que acompaña toda la vida."
        },
        {
            puesto: "2º",
            medalla: "🥈",
            titulo: "Frozen",
            tipo: "Película · Disney · 2013",
            descripcion: "Más que una película de princesas: una historia sobre el amor entre hermanas, la aceptación de uno mismo y el poder de soltar el miedo. 'Let It Go' sigue siendo un himno."
        },
        {
            puesto: "3º",
            medalla: "🥉",
            titulo: "Los Simpson / Gravity Falls",
            tipo: "Series de animación",
            descripcion: "Los Simpson llevan décadas siendo los reyes de la comedia familiar con humor inteligente. Gravity Falls, en cambio, es una joya de misterio y aventura para quienes aman los secretos ocultos en cada fotograma."
        }
    ],
    personal: [
        "Colores: Rosa y negro",
        "Números favoritos: 4, 7, 27, 46, 48",
        "Flores: Gypsophila, manzanilla, rosas",
        "Animal: Gatos",
        "Perfume: Moschino Toy 2",
        "Joyería: anillos, collares, pulseras"
    ],
    food: [
        "Bayas, frutas, verduras, ramen",
        "Chocolate blanco con Oreos",
        "Fresas con chocolate",
        "Bubble tea, zumo de naranja"
    ]
};

// ========== DATOS DE GATOS (actualizado) ==========
const catFacts = [
    {
        icon: "😴",
        titulo: "Campeones del descanso",
        texto: "Los gatos pasan alrededor del 70% de su vida durmiendo, unas 13–16 horas al día. No es vagancia: es una adaptación de depredadores que necesitan conservar energía para cazar."
    },
    {
        icon: "⚡",
        titulo: "Velocidad y agilidad",
        texto: "Pueden alcanzar hasta 50 km/h en distancias cortas y saltar hasta 5 veces su propia altura. Su columna vertebral extraordinariamente flexible es la clave de esa agilidad."
    },
    {
        icon: "🔊",
        titulo: "Comunicación increíble",
        texto: "Los gatos emiten alrededor de 100 sonidos diferentes; los perros solo producen unos 10. Además, el ronroneo se genera cuando el aire pasa unas 25 veces por segundo por la laringe, y los científicos aún no entienden del todo cómo funciona."
    },
    {
        icon: "🐯",
        titulo: "Primos de los tigres",
        texto: "Los gatos domésticos comparten el 95,6% de su ADN con los tigres. Por eso exhiben comportamientos muy similares: marcar territorio, acechar a sus presas o frotar la cabeza para dejar su olor."
    },
    {
        icon: "📜",
        titulo: "Historia de 9.500 años",
        texto: "El primer gato doméstico del que se tiene registro vivió hace unos 9.500 años, mucho antes de las civilizaciones del antiguo Egipto. Los humanos y los gatos llevan conviviendo más tiempo del que solemos imaginar."
    },
    {
        icon: "🏛️",
        titulo: "Alcalde felino",
        texto: "Una pequeña ciudad de Alaska tuvo a un gato llamado Stubbs como alcalde honorario durante más de 20 años. Los vecinos lo adoraban y era la principal atracción turística del pueblo."
    }
];

// ========== DATOS DE SAN PETERSBURGO (actualizado) ==========
const spbData = {
    intro: "San Petersburgo, fundada por Pedro el Grande en 1703, es la segunda ciudad más grande de Rusia y fue capital imperial hasta la Revolución de 1917. Conocida como la 'Venecia del Norte', es una ciudad de agua, arte y luz que guarda secretos en cada rincón.",
    curiosidades: [
        {
            icon: "🌉",
            titulo: "Ciudad de los 800 puentes",
            texto: "San Petersburgo tiene alrededor de 800 puentes, de los cuales 19 son móviles y se elevan cada noche para dejar pasar los barcos por el río Nevá. Durante las noches blancas de verano, verlos abrirse bajo la luz crepuscular es un espectáculo único."
        },
        {
            icon: "🏛️",
            titulo: "El Hermitage y sus millones de obras",
            texto: "El Palacio de Invierno alberga el museo Hermitage, con más de 3 millones de piezas. Se calcula que si dedicases un minuto a cada obra, necesitarías más de una década para ver toda la colección."
        },
        {
            icon: "🐱",
            titulo: "Los gatos del Hermitage",
            texto: "Tradicionalmente, decenas de gatos viven en el Hermitage con el encargo de ahuyentar roedores. Desde 2014 existe un programa oficial de adopción para los 'gatos sobrantes' del museo, y tienen su propia fiesta anual el 18 de abril."
        },
        {
            icon: "🗿",
            titulo: "La columna que no necesita tornillos",
            texto: "En la Plaza del Palacio se levanta la Columna de Alejandro, un monolito de granito de 600 toneladas que lleva erguido desde 1834 sin ningún anclaje: se mantiene en pie únicamente por su propio peso."
        },
        {
            icon: "🚇",
            titulo: "El metro más profundo del mundo",
            texto: "El metro de San Petersburgo es uno de los más profundos del planeta. La estación Admiralteyskaya se encuentra a 86 metros bajo tierra, casi como un refugio antiaéreo. Las escaleras mecánicas para llegar al andén son larguísimas."
        },
        {
            icon: "🐦",
            titulo: "La estatua más pequeña y más robada",
            texto: "Junto al río Fontanka hay una estatuilla de Chízhik-Pízhik que mide solo 11 cm. Ha sido robada siete veces, aunque siempre regresa a su lugar. La tradición dice que si lanzas una moneda y cae sobre la repisa donde está, tu deseo se cumple."
        },
        {
            icon: "⛪",
            titulo: "La cúpula que salvó la ciudad",
            texto: "La enorme cúpula dorada de la Catedral de San Isaac, una de las mayores del mundo, fue pintada de gris durante la Segunda Guerra Mundial para que no sirviese de punto de referencia a los bombardeos alemanes."
        }
    ],
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
        "Noches Blancas: crepúsculo continuo y conciertos nocturnos.",
        "Pan y sal: símbolo de hospitalidad y respeto.",
        "Velas Escarlatas: graduación con barcos, fuegos artificiales y música.",
        "Ópera y ballet bajo las estrellas durante el verano."
    ],
    phrases: [
        "Privet — Hola",
        "Spasibo — Gracias",
        "Pozhaluysta — De nada / Por favor",
        "Do svidaniya — Adiós",
        "Ya tebya lyublyu — Te amo"
    ]
};

// ========== EXPORTAR TODO ==========
window.songsData         = songs;
window.galleryFoldersData = galleryFolders;
window.memeImagesData    = memeImages;
window.gustosData        = gustos;
window.catFactsData      = catFacts;
window.spbData           = spbData;