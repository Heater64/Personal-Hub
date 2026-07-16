const SONGS_BASE_URL = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

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
    },
    {
        title: "Tiroteo (Remix)",
        artist: "",
        album: "",
        cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", 
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", 
        lyrics: `Letra no disponible`
    },
];

const allSongs = [
    {
        title: "Mon amour Remix",
        artist: "Aitana y Zzoilo",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-leykoA0rJXWDmQya-cyfPxg-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Tiroteo (Remix)",
        artist: "",
        album: "",
        cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", 
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", 
        lyrics: `Letra no disponible`
    },
    {
        title: "Contando Lunares",
        artist: "Don Patricio",
        album: "",
        cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777748473/contando_lunares_bjxcmo.png", // ejemplo
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748328/DON_PATRICIO_CRUZ_CAFUN%C3%89_-_CONTANDO_LUNARES_tsyd6p.m4a", // ⚠️ pon aquí una URL real
        lyrics: `Letra no disponible`
    },
    {
        title: "Rara Vez",
        artist: "Milo J, Taiu",
        album: "",
        cover: "https://m.media-amazon.com/images/I/51O0iMUUz7L._UXNaN_FMjpg_QL85_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748873/Taiu_Milo_j_-_Rara_Vez_bwkba4.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Si Estoy a Tu Lado",
        artist: "Rabelay",
        album: "",
        cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-ywl-ZgPTD9d7uezXWmcCixIhCxdKb0cmRA&s",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748874/Rabelay_-_Si_Estoy_a_Tu_Lado_Oficial_nvbx34.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Pareja del Año",
        artist: "Sebastián Yatra, Myke Towers",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273311aebbc00f1cd4cd16bacbc",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Sebasti%C3%A1n_Yatra_-_Tacones_Rojos_Official_Video_o09dxd.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "COSAS QUE NO TE DIJE",
        artist: "Saiko",
        album: "",
        cover: "https://images.genius.com/acb90eccfc4f36d9675d8d2f58c86670.1000x1000x1.png",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748875/Saiko_-_COSAS_QUE_NO_TE_DIJE_Official_Video_dbpazx.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Quiero Decirte",
        artist: "Abraham Mateo, Ana Mena",
        album: "",
        cover: "https://images.genius.com/7e834ed5f2fd7a331d2e8d4f948cda4b.1000x1000x1.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748876/Abraham_Mateo_Ana_Mena_-_Quiero_Decirte_myiibs.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Just the Way You Are",
        artist: "Bruno Mars",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/5b59dc18e109515420f8237719bd2186/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748879/Bruno_Mars_-_Just_The_Way_You_Are_i8mkhd.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Ven a la Carrera",
        artist: "Pocoyó",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2730952f5f2ec131e56b3ba7b27",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748881/%EF%B8%8FPOCOY%C3%93_-_Ven_a_la_Carrera_ysppwm.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Besos en Guerra",
        artist: "Morat, Juanes",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2738fa1c3557fd95f9dd67ec235",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748882/Morat_Juanes_-_Besos_en_Guerra_Letra._vnnvdn.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Carita de Buena",
        artist: "Efecto Pasillo",
        album: "",
        cover: "https://m.media-amazon.com/images/I/61F144gibPL._UXNaN_FMjpg_QL85_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748883/Efecto_Pasillo_-_Carita_de_Buena_Letra_ja14lf.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Cupid twin version",
        artist: "FIFTY FIFTY",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b27337c0b3670236c067c8e8bbcb",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748884/FIFTY_FIFTY_-_Cupid_Twin_Version_Lyrics_hfw31y.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Pan y Mantequilla",
        artist: "",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2735953c71f6d0e995f71f63ae4",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748885/Pan_y_Mantequilla_ejmvcl.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "La Plena",
        artist: "Beéle Westcol, Ovy On The Drums",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273c0353d023daf5ebda0eb003b",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748886/Be%C3%A9le_Westcol_Ovy_On_The_Drums_-_LA_PLENA_W_Sound_05_jz2fsz.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Sia - Snowman",
        artist: "Sia",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273a75e532b61dac3ddafd022ef",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748887/Sia_-_Snowman_Lyrics_ym54x5.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Young Cister - miau (Video Oficial 2)",
        artist: "Young Cister",
        album: "",
        cover: "https://images.genius.com/aa41a24ecbac2a1324c4cb84cc158f76.1000x1000x1.png",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748889/Young_Cister_-_miau_Video_Oficial_2_rr561t.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "I Love It",
        artist: "Icona Pop, Charli XCX",
        album: "",
        cover: "https://m.media-amazon.com/images/I/51e5k9eRKvL._UXNaN_FMjpg_QL85_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748890/Vietsub_I_Love_It_Icona_Pop___Charli_XCX_Lyrics_Video_1_tn4f7c.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Capaz",
        artist: "Alleh Yorghaki",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/88e65c70ef15315045b6bf85d38b11f2/0x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748891/Alleh_Yorghaki_-__capaz__OFFICIAL_VERSION_iutvie.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Downtown",
        artist: "Anitta, J Balvin",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2738c6b830c36c7b4ac43c3cee8",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748892/Anitta_J_Balvin_-_DOWNTOWN_Letra_vw8h3l.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Porfa no te vayas",
        artist: "Beret, Morat",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/82a6297e55cbb85c75cedbbb3a8e1443/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748898/Beret_Morat_-_Porfa_no_te_vayas_Videoclip_Oficial_1_gxrelc.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Count on Me",
        artist: "Bruno Mars",
        album: "",
        cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSaonOWEQEDMwIQmhHmBRiWrqKgcKYWQjQTiQ&s",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748900/Bruno_Mars_-_Count_on_Me_Official_Lyric_Video_1_xli1q5.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Caliente",
        artist: "Ricky edit",
        album: "",
        cover: "https://s.mxmcdn.net/images-storage/albums2/9/5/3/5/2/3/64325359_350_350.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748901/caliente_-_rickyedit_1_pe7zjc.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "X Remix",
        artist: "Nicky Jam, J Balvin, Ozuna, Maluma",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b27326129b4b928f0f97ba344545",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748902/X_Remix_-_Nicky_Jam_x_J_Balvin_x_Ozuna_x_Maluma_cqklqd.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Viva La Vida",
        artist: "Coldplay",
        album: "",
        cover: "https://m.media-amazon.com/images/I/9145yafeO2L._UF894,1000_QL80_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748903/Coldplay_-_Viva_La_Vida_Official_Video_rjwiqg.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "3 AM",
        artist: "Eladio Carrión, Brytiago",
        album: "",
        cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCWfQQxORCJbF-JVcNQ2qouJQqMA0C4Arkdg&s",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748904/Eladio_Carri%C3%B3n_Brytiago_-_3_AM_Visualizer___Sauce_Boyz_paeyvx.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Qué Bonita",
        artist: "Cano",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/e65d06182e60952beb733eefe35a1d75/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748905/El_Mismo_Sol_svyp5p.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Bailando",
        artist: "Enrique Iglesias",
        album: "",
        cover: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c0/Enriquebailandocover.jpg/250px-Enriquebailandocover.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748907/Enrique_Iglesias___Bailando_Lyrics_feat_Descemer_Bueno__Gente_De_pvlefu.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "DUELE EL CORAZÓN",
        artist: "Enrique Iglesias",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-000164317296-txl7y7-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748909/Enrique_Iglesias_-_DUELE_EL_CORAZON_Lyric_Video_ft._Wisin_v27ra0.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "La Bachata",
        artist: "MTZ Manuel Turizo",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-HG9Rj4F1lgzFynKw-jpIVmQ-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748910/La_Bachata_-_MTZ_Manuel_Turizo___Video_Oficial_thrsqd.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "El Merengue",
        artist: "MTZ Manuel Turizo",
        album: "",
        cover: "https://cdn-p.smehost.net/sites/5b3bac59eb36401694af3a241173447f/wp-content/uploads/2023/03/93201a3b-066d-4ae6-8fba-92694479a310.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748911/Marshmello_Manuel_Turizo_-_El_Merengue_j0d5t6.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "1000 Cosas",
        artist: "MTZ Manuel Turizo",
        album: "",
        cover: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777751326/1000_cosas_nzka1y.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748912/Lola_Indigo_Manuel_Turizo_-_1000_Cosas_Letra___Lyrics_hs1gu0.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Die With a Smile",
        artist: "Lady Gaga, Bruno Mars",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/4bd5903f4ce8f2601916bfadb44efe8a/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748913/Lady_Gaga_Bruno_Mars_-_Die_With_A_Smile_defupf.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "BELIEVER",
        artist: "Imagine Dragons",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2735675e83f707f1d7271e5cf8a",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748915/Imagine_Dragons_-_Believer_Lyrics_kfi5ha.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Si No Estás",
        artist: "Iñigo Quintero",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273c0a5c14b34a02f242af03359",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748916/i%C3%B1igo_quintero_-_Si_No_Est%C3%A1s_Letra_Oficial_1_lraiuu.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Si Antes Te Hubiera Conocido",
        artist: "Karol G",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-TTDsE8Jj2gF855AL-hFnpUQ-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748917/KAROL_G_-_Si_Antes_Te_Hubiera_Conocido___Coke_Studio_sxezkk.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Firework",
        artist: "Katy Perry",
        album: "",
        cover: "https://m.media-amazon.com/images/M/MV5BMWRmMWVlOWYtOWQ2Yi00MjdmLTliNGUtOTk1N2M4MmQwZmJkXkEyXkFqcGc@._V1_QL75_UY190_CR2,0,190,190_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748918/Katy_Perry_-_Firework_Lyrics_qgmiip.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "I Kissed A Girl",
        artist: "Katy Perry",
        album: "",
        cover: "https://upload.wikimedia.org/wikipedia/en/5/5c/I_Kissed_a_Girl.png",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748919/Katy_Perry_-_I_Kissed_A_Girl_Official_Music_Video_qdtvxf.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "La Cintura",
        artist: "Alvaro Soler",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-000326908518-qfg6dg-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748920/La_Cintura_-_Alvaro_Soler_Letra_lyrics_knrjhe.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "como estrellas",
        artist: "YOUNG",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273866265358ce5d4770b67ab8d",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748921/LA_YounG_-_Como_Estrellas_pvizll.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Until I Found You",
        artist: "Stephen Sanchez",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/8a6477b222dac17081d9b9b1729a1ca4/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748931/Stephen_Sanchez_-_Until_I_Found_You_Lyrics_1_rakcvt.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Malito",
        artist: "",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273b89593a15f6a40fd6d7de40c",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748932/Malito_w8w0t2.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "quelamamen",
        artist: "Ricky edit",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/6c56dd16a8da24c8e59781231e29442b/0x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748937/quelamamen_-_rickyedit_t0yfas.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Ahora Y Siempre",
        artist: "Quevedo",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2738517e3f690cdabf1a616b2e8",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748939/Quevedo_-_Ahora_Y_Siempre_Letra_Lyrics_x6edyd.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Cuando Te Vi",
        artist: "Maria Becerra, Trueno",
        album: "",
        cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/6/f/9/d/2282831720092918.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748940/Maria_Becerra_Trueno_Big_One_-_Cuando_Te_Vi___CROSSOVER_5_eaa8fv.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: ">Todo de Ti",
        artist: "Rauw Alejandro",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273c160ede886e4e54350c0cec9",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748941/Rauw_Alejandro_-_Todo_de_Ti_Video_Oficial_fucazk.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "real gangsta love",
        artist: "Trueno",
        album: "",
        cover: "https://images.genius.com/d7ae872dffe2dda742204c6fd4256e4e.1000x1000x1.png",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748942/Trueno_-_REAL_GANGSTA_LOVE_Official_Video_bzn4xz.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Belong Together",
        artist: "Mark Ambor",
        album: "",
        cover: "https://i.ytimg.com/vi/xPWnNFF-TAw/sddefault.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748944/Mark_Ambor_-_Belong_Together_Lyrics_o7nepu.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "sway",
        artist: "Michael Bublé",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-mfRYr4OtlumkBA1q-pL2Mfg-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748945/Michael_Bubl%C3%A9_-_Sway_Lyrics_twaz4d.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "CLASSIC",
        artist: "mkto",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b2739474419f15773875a495eed3",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748946/MKTO_-_Classic_Lyrics_yrsqeh.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "A Dónde Vamos",
        artist: "Morat",
        album: "",
        cover: "https://akamai.sscdn.co/uploadfile/letras/albuns/3/0/1/4/1111981626430157.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748947/Morat_-_A_D%C3%B3nde_Vamos_Letra___Albert_Maricheli_y9psss.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "La Falda",
        artist: "Myke Towers",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-r0TxDn1vZJbLEO3p-ROydVw-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748949/Myke_Towers_-_LA_FALDA_Letra_Lyrics_mwn6s0.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Como Te Atreves",
        artist: "Morat",
        album: "",
        cover: "https://images.genius.com/71945fe483298a6e9a160ba4aa8050c9.1000x1000x1.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748950/Morat_-_C%C3%B3mo_Te_Atreves_Video_Oficial_blq8d9.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "SOLO AMIGOS",
        artist: "Adexe y Nau",
        album: "",
        cover: "https://images.genius.com/ea89db66f1b4f18e011613e093611da1.1000x1000x1.png",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748951/Solo_amigos_-_Adexe_y_Nau_Letra_lyrics_wmuawk.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "THERE'S NOTHING HOLDING ME BACK",
        artist: "Shawn Mendes",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/3e2d3bad308509ecc59dc6de76ac7896/0x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748952/Shawn_Mendes_There_s_Nothing_Holding_Me_Back_Lyrics_e3lpar.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "save your tears",
        artist: "The Weeknd",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/4acc3760e12996fe21a77115fc67760b/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748955/The_Weeknd_-_Save_Your_Tears_Official_Music_Video_ed2oy0.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Indeciso",
        artist: "Reik",
        album: "",
        cover: "https://m.media-amazon.com/images/I/51pJA4vGKvL._UXNaN_FMjpg_QL85_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748956/Reik_J_Balvin_Lalo_Ebratt_-_Indeciso_Letra_lqpkqv.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "La Mordidita",
        artist: "Ricky Martin",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b27388d450740b559cabdde15d35",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748957/Ricky_Martin_-_La_Mordidita_ft._Yotuel_Letra_vgdin6.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Vente Pa' Ca",
        artist: "Ricky Martin",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273a7009065e3adf3430e04f63a",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748958/Ricky_Martin_-_Vente_Pa__Ca_ft._Maluma_Letra_Lyrics_bplzdf.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Umbrella",
        artist: "Rihanna",
        album: "",
        cover: "https://cdn-images.dzcdn.net/images/cover/91276466fbc876d96be9e6926060af60/1900x1900-000000-80-0-0.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748960/Rihanna_Umbrella_Orange_Version_Official_Music_Video_ft_JAY_Z_fpihd1.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "APT.",
        artist: "ROSÉ",
        album: "",
        cover: "https://m.media-amazon.com/images/I/51vAIGPAURL._UXNaN_FMjpg_QL85_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748961/ROSE%CC%81_Bruno_Mars_-_APT._Official_Music_Video_ydbvc7.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Flashes",
        artist: "RØZ Yng Lvcas",
        album: "",
        cover: "https://i1.sndcdn.com/artworks-aRMFevdQLRYYTTXi-IRfYkw-t500x500.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748962/R%C3%98Z_Yng_Lvcas_-_flashes_zvoqsg.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Despechá",
        artist: "ROSALÍA",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273938660520f09a1bae2ed4699",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748973/ROSAL%C3%8DA_-_DESPECH%C3%81_Official_Video_ehc9gl.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Supernova",
        artist: "SAIKO",
        album: "",
        cover: "https://i.scdn.co/image/ab67616d0000b273c3f5b9580dfc96c80705424a",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748974/SAIKO_-_SUPERNOVA_Official_Video___SAKURA_kiwn0u.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Without Me",
        artist: "Eminem",
        album: "",
        cover: "https://m.media-amazon.com/images/I/819VvnW1QZL._UF894,1000_QL80_.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748976/Eminem_-_Without_Me_Lyrics_rbyen5.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Beauty and a Beat",
        artist: "Justin Bieber",
        album: "",
        cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsKPNxCtWtPm7_d468VnoWxPSBsOyZk67HcA&s",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748977/Justin_Bieber_Beauty_And_A_Beat_Official_Music_Video_ft_Nicki_Minaj_ivdtfp.m4a",
        lyrics: `Letra no disponible`
    },
    {
        title: "Fuego",
        artist: "Don Omar",
        album: "",
        cover: "https://i.musicaimg.com/letras/250x250/don-omar.jpg",
        audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748984/Fuego_-_Una_Vaina_Loca_Ft._El_Potro_Alvarez_Official_Video_rp0xvr.m4a",
        lyrics: `Letra no disponible`
    },
    
];

window.songsData = songs;
window.allSongsData = allSongs;