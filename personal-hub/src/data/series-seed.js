/* ==========================================
   series-seed.js — Catálogo inicial de la
   sección Series & Películas.

   Catálogo semilla que se usa cuando el
   usuario aún no tiene datos guardados
   (la fuente de verdad en producción es la
   fila 'series' de Supabase).

   Catálogo personal (definido por el usuario):
   · Dragon Ball (TODAS: películas y series)
   · Gravity Falls
   · Hotel Transilvania 1-4
   · Del revés 1-2, Monstruos S.A., Frozen 1-2,
     Bella durmiente (Disney/Pixar)
   · Crepúsculo (las 5 películas)
   · Spider-Man (solo Miles Morales)
   · Minions (todas) y Mi Villano Favorito (Gru)
   · Mascotas 1-2, Moana/Vaiana 1-2, Cars 1-3
   · El Señor de los Anillos (trilogía)
   · Obsesión, Cocina (Кухня), KiberSport, Sherlock
   ========================================== */

const EPISODE = (serie, season, total) =>
  Array.from({ length: total }, (_, i) => ({
    num: i + 1,
    titulo: `Episodio ${i + 1}`,
    recurso: `https://dragonballlatino.net/episode/${serie}-${season}x${i + 1}/`
  }));

/** Episodios genéricos (sin enlace, igual que Gravity Falls). */
const EPS = (total) =>
  Array.from({ length: total }, (_, i) => ({ num: i + 1, titulo: `Episodio ${i + 1}` }));

const GEN = ['Animación', 'Acción', 'Aventura'];

/** Portada TMDB (2:3) y banner TMDB (16:9) a partir del hash del póster. */
const TMDB = (posterHash, bannerHash = posterHash) => ({
  portada: `https://image.tmdb.org/t/p/w500/${posterHash}.jpg`,
  banner: `https://image.tmdb.org/t/p/w1280/${bannerHash}.jpg`
});

/** Página oficial de referencia (TMDB) para ver opciones legales de streaming. */
const TMDB_PAGE = (id) => `https://www.themoviedb.org/movie/${id}`;
const TMDB_TV = (id) => `https://www.themoviedb.org/tv/${id}`;
const TMDB_SEARCH = (q) => `https://www.themoviedb.org/search?query=${encodeURIComponent(q)}`;

/** Imagen de Wikimedia (URL permanente). */
const WIKI = (path) => `https://${path}`;

export const DEFAULT_CATALOG = [
  // ==========================================
  // PELÍCULAS
  // ==========================================
  // ---------- DRAGON BALL (todas) ----------
  {
    id: 'sr_db_super_hero',
    titulo: 'Dragon Ball Super: Super Hero',
    tipo: 'pelicula',
    descripcion: 'El Ejército de la Cinta Roja resurge con nuevos androides creados a partir de las células de Goku. Gohan y Piccolo, convertidos en superhéroes, deberán detenerlos. La vigésimo primera película de la franquicia y la segunda de Dragon Ball Super.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2022/06/jUiaVnAo0aRzQYMfxOfzdHcltZ2.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2022/06/jUiaVnAo0aRzQYMfxOfzdHcltZ2.jpg',
    anio: 2022,
    generos: [...GEN, 'Ciencia ficción'],
    duracion: 99,
    recurso: 'https://dragonballlatino.net/movies/dragon-ball-super-super-hero/',
    categoria: 'Dragon Ball',
    destacado: true,
    createdAt: 1
  },
  {
    id: 'sr_db_broly',
    titulo: 'Dragon Ball Super: Broly',
    tipo: 'pelicula',
    descripcion: 'Goku y Vegeta se enfrentan al saiyajin más poderoso jamás conocido: Broly, un guerrero legendario con un poder devastador e incontrolable. La primera película de Dragon Ball Super.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-super-broly-194-poster-683x1024.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-super-broly-194-poster-683x1024.jpg',
    anio: 2018,
    generos: [...GEN, 'Ciencia ficción'],
    duracion: 100,
    recurso: 'https://dragonballlatino.net/movies/dragon-ball-super-broly/',
    categoria: 'Dragon Ball',
    createdAt: 2
  },
  {
    id: 'sr_db_resurreccion_freezer',
    titulo: 'Dragon Ball Z: La resurrección de Freezer',
    tipo: 'pelicula',
    descripcion: 'Freezer regresa a la vida gracias a las Esferas del Dragón y, junto a su ejército, busca venganza contra los Saiyajin. Goku y Vegeta deberán enfrentarlo en la Tierra.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-z-la-resurreccion-de-freezer-688-poster.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-z-la-resurreccion-de-freezer-688-poster.jpg',
    anio: 2015,
    generos: [...GEN, 'Ciencia ficción'],
    duracion: 93,
    recurso: 'https://dragonballlatino.net/movies/dragon-ball-z-la-resurreccion-de-freezer/',
    categoria: 'Dragon Ball',
    createdAt: 3
  },
  {
    id: 'sr_db_batalla_dioses',
    titulo: 'Dragon Ball Z: La batalla de los dioses',
    tipo: 'pelicula',
    descripcion: 'Bills, el Dios de la Destrucción, despierta de su letargo y llega a la Tierra buscando al legendario Super Saiyajin Dios. Goku deberá alcanzar un nuevo poder para enfrentarlo.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-z-la-batalla-de-los-dioses-684-poster.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-z-la-batalla-de-los-dioses-684-poster.jpg',
    anio: 2013,
    generos: [...GEN, 'Ciencia ficción'],
    duracion: 85,
    recurso: 'https://dragonballlatino.net/movies/dragon-ball-z-la-batalla-de-los-dioses/',
    categoria: 'Dragon Ball',
    createdAt: 4
  },

  // ---------- HOTEL TRANSILVANIA (1-4) ----------
  {
    id: 'sr_ht_1',
    titulo: 'Hotel Transilvania',
    tipo: 'pelicula',
    descripcion: 'El conde Drácula dirige un hotel de lujo donde los monstruos del mundo descansan lejos de los humanos. Todo se complica cuando Jonathan, un humano normal y corriente, llega sin querer y se enamora de su hija Mavis.',
    ...TMDB('zvWlwBGQWuJ0wog65q1uS37BApC', '5rARlA8beRAVXPYzSaF2NoS8Ry5'),
    anio: 2012,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 91,
    recurso: TMDB_PAGE(76492),
    categoria: 'Hotel Transylvania',
    createdAt: 9
  },
  {
    id: 'sr_ht_2',
    titulo: 'Hotel Transilvania 2',
    tipo: 'pelicula',
    descripcion: 'Drácula abre las puertas del hotel a los humanos para que su nieto Dennis crezca en un mundo sin miedos. Pero la visita de su padre Vlad, todavía más anticuado y temible, pondrá todo patas arriba.',
    ...TMDB('ndYVcm1k3h81MRDhzZCI4SxDzGp', 'mfnkxXWuh2Br097Qteq8ieqKfev'),
    anio: 2015,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 89,
    recurso: TMDB_PAGE(159824),
    categoria: 'Hotel Transylvania',
    createdAt: 10
  },
  {
    id: 'sr_ht_3',
    titulo: 'Hotel Transilvania 3: Unas vacaciones monstruosas',
    tipo: 'pelicula',
    descripcion: 'La familia de monstruos se va de crucero para que Drácula por fin descanse. El problema: Ericka, la capitana del barco, es descendiente del famoso cazavampiros Van Helsing.',
    ...TMDB('p5eBnMRoFWjSua4DYdiKjmHP3H5', 'gvUYIHWzq7r3KuzAaKvly2h0SjM'),
    anio: 2018,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 97,
    recurso: TMDB_PAGE(400155),
    categoria: 'Hotel Transylvania',
    createdAt: 11
  },
  {
    id: 'sr_ht_4',
    titulo: 'Hotel Transilvania: Transformanía',
    tipo: 'pelicula',
    descripcion: 'Johnny, el humano de la familia, quiere sentirse parte de los monstruos. Un experimento fallido de Van Helsing lo convierte en monstruo justo antes del aniversario de Mavis y Jonathan.',
    ...TMDB('xNF8AxJc966FWk4SYqXxGHaZLHZ', '7QabKu8tizoqy8qCZJXljdSpP4A'),
    anio: 2022,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 87,
    recurso: TMDB_PAGE(585083),
    categoria: 'Hotel Transylvania',
    createdAt: 12
  },

  // ---------- DISNEY: Frozen + Bella durmiente ----------
  {
    id: 'sr_frozen_1',
    titulo: 'Frozen: El reino del hielo',
    tipo: 'pelicula',
    descripcion: 'Anna parte en busca de su hermana Elsa, la reina que sin querer ha congelado el reino con sus poderes. Junto a Kristoff, Sven y Olaf, descubrirá que el amor verdadero puede derretir cualquier hielo.',
    ...TMDB('sGNuWC4BwqOB4l0tkbKwLy70tXC', 'rj58WQ9ImI0mYDptXdM7euX1Wjt'),
    anio: 2013,
    generos: ['Animación', 'Fantasía', 'Musical', 'Familia'],
    duracion: 102,
    recurso: TMDB_PAGE(109445),
    categoria: 'Disney',
    createdAt: 13
  },
  {
    id: 'sr_frozen_2',
    titulo: 'Frozen 2',
    tipo: 'pelicula',
    descripcion: 'Elsa, Anna, Olaf y compañía viajan más allá de Arendelle para descubrir el origen de los poderes de Elsa y salvar su reino de una amenaza ancestral que los acecha desde el bosque encantado.',
    ...TMDB('jnFCk7qGGWop2DgfnJXeKLZFuBq', 'AoSZyb37ljMAxw0RdeQEBHKtgcc'),
    anio: 2019,
    generos: ['Animación', 'Fantasía', 'Musical', 'Familia'],
    duracion: 103,
    recurso: TMDB_PAGE(330457),
    categoria: 'Disney',
    createdAt: 14
  },
  {
    id: 'sr_dis_bella_durmiente',
    titulo: 'La Bella Durmiente',
    tipo: 'pelicula',
    descripcion: 'La princesa Aurora es víctima de la maldición de Maléfica: morirá al pincharse con una rueca la noche de su cumpleaños. Solo el beso del príncipe Felipe podrá romper el hechizo. El clásico de animación de Disney de 1959.',
    portada: '',
    banner: '',
    anio: 1959,
    generos: ['Animación', 'Fantasía', 'Familia', 'Romance'],
    duracion: 75,
    recurso: TMDB_PAGE(11014),
    categoria: 'Disney',
    createdAt: 40
  },

  // ---------- PIXAR: Monstruos + Del revés ----------
  {
    id: 'sr_px_monsters_inc',
    titulo: 'Monstruos, S.A.',
    tipo: 'pelicula',
    descripcion: 'En Monstruos, S.A., los monstruos asustan a los niños para conseguir energía. Sulley y Mike descubrirán que las risas pueden ser una fuente de poder mucho más eficaz.',
    ...TMDB('g3SgHEb5ej2MioGfYLrZVshF909', 'sDTnMOJ3H5wI38OxObmCtK7wfd5'),
    anio: 2001,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 92,
    recurso: TMDB_PAGE(585),
    categoria: 'Pixar',
    createdAt: 31
  },
  {
    id: 'sr_px_inside_out',
    titulo: 'Del revés (Inside Out)',
    tipo: 'pelicula',
    descripcion: 'Las emociones de Riley —Alegría, Tristeza, Miedo, Ira y Asco— viven dentro de su cabeza y compiten por controlar sus recuerdos cuando la familia se muda de ciudad.',
    ...TMDB('sG3bHZWCMOZwhUq71WbPG9Vrrwc', 'o3i6AfTcWAuNvzAUV3q5lOmi6Gx'),
    anio: 2015,
    generos: ['Animación', 'Familia', 'Comedia'],
    duracion: 95,
    recurso: TMDB_PAGE(150540),
    categoria: 'Pixar',
    createdAt: 36
  },
  {
    id: 'sr_io_2',
    titulo: 'Del revés 2 (Inside Out 2)',
    tipo: 'pelicula',
    descripcion: 'Riley ya es adolescente y nuevas emociones irrumpen en su mente: Ansiedad, Envidia, Vergüenza y Ennui. Alegría y sus amigas deberán encontrar su lugar en el cuartel general mientras Riley lidia con los cambios de la adolescencia.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/f/f7/Inside_Out_2_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/f/f7/Inside_Out_2_poster.jpg'),
    anio: 2024,
    generos: ['Animación', 'Familia', 'Comedia'],
    duracion: 96,
    recurso: TMDB_PAGE(1022789),
    categoria: 'Pixar',
    createdAt: 41
  },

  // ---------- CREPÚSCULO (todas) ----------
  {
    id: 'sr_crep_1',
    titulo: 'Crepúsculo',
    tipo: 'pelicula',
    descripcion: 'Bella Swan se muda a Forks y se enamora de Edward Cullen, un misterioso compañero de instituto que esconde un secreto: es un vampiro. El comienzo de la saga romántica de Stephenie Meyer.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/b/b6/Twilight_%282008_film%29_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/b/b6/Twilight_%282008_film%29_poster.jpg'),
    anio: 2008,
    generos: ['Romance', 'Fantasía', 'Drama'],
    duracion: 122,
    recurso: TMDB_PAGE(8963),
    categoria: 'Crepúsculo',
    createdAt: 42
  },
  {
    id: 'sr_crep_2',
    titulo: 'Crepúsculo: Luna Nueva',
    tipo: 'pelicula',
    descripcion: 'Edward abandona Forks para proteger a Bella, y ella encuentra consuelo en su amistad con Jacob Black, que guarda un secreto propio. La segunda entrega de la saga Crepúsculo.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/9/93/The_Twilight_Saga-_New_Moon_poster.JPG'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/9/93/The_Twilight_Saga-_New_Moon_poster.JPG'),
    anio: 2009,
    generos: ['Romance', 'Fantasía', 'Drama'],
    duracion: 130,
    recurso: TMDB_PAGE(18239),
    categoria: 'Crepúsculo',
    createdAt: 43
  },
  {
    id: 'sr_crep_3',
    titulo: 'Crepúsculo: Eclipse',
    tipo: 'pelicula',
    descripcion: 'Bella debe elegir entre el amor de Edward y su amistad con Jacob mientras una serie de asesinatos en Seattle amenaza con desatar una guerra entre vampiros y hombres lobo.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/d/d7/Eclipse_Theatrical_One-Sheet.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/d/d7/Eclipse_Theatrical_One-Sheet.jpg'),
    anio: 2010,
    generos: ['Romance', 'Fantasía', 'Drama'],
    duracion: 124,
    recurso: TMDB_PAGE(24021),
    categoria: 'Crepúsculo',
    createdAt: 44
  },
  {
    id: 'sr_crep_4',
    titulo: 'Crepúsculo: Amanecer Parte 1',
    tipo: 'pelicula',
    descripcion: 'Bella y Edward se casan y viven su luna de miel, pero un embarazo inesperado pone en peligro la vida de Bella y tensa la alianza con los hombres lobo.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/c/c2/Breaking_Dawn_Part_1_Poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/c/c2/Breaking_Dawn_Part_1_Poster.jpg'),
    anio: 2011,
    generos: ['Romance', 'Fantasía', 'Drama'],
    duracion: 117,
    recurso: TMDB_PAGE(50619),
    categoria: 'Crepúsculo',
    createdAt: 45
  },
  {
    id: 'sr_crep_5',
    titulo: 'Crepúsculo: Amanecer Parte 2',
    tipo: 'pelicula',
    descripcion: 'El clan Cullen reúne aliados de todo el mundo para enfrentarse a los Vólturi, que exigen la muerte de Renesmee. La conclusión épica de la saga Crepúsculo.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/4/49/The_Twilight_Saga_Breaking_Dawn_Part_2_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/4/49/The_Twilight_Saga_Breaking_Dawn_Part_2_poster.jpg'),
    anio: 2012,
    generos: ['Romance', 'Fantasía', 'Drama'],
    duracion: 115,
    recurso: TMDB_PAGE(50620),
    categoria: 'Crepúsculo',
    createdAt: 46
  },

  // ---------- SPIDER-MAN (solo Miles Morales) ----------
  {
    id: 'sr_spv_1',
    titulo: 'Spider-Man: Un nuevo universo',
    tipo: 'pelicula',
    descripcion: 'Miles Morales, un adolescente de Brooklyn, descubre sus poderes arácnidos y conoce a otros Spider-Héroes de universos paralelos. Juntos deberán salvar todas las realidades.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/f/fa/Spider-Man_Into_the_Spider-Verse_poster.png'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/f/fa/Spider-Man_Into_the_Spider-Verse_poster.png'),
    anio: 2018,
    generos: ['Animación', 'Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 117,
    recurso: TMDB_PAGE(324857),
    categoria: 'Spider-Man',
    createdAt: 47
  },
  {
    id: 'sr_spv_2',
    titulo: 'Spider-Man: Cruzando el multiverso',
    tipo: 'pelicula',
    descripcion: 'Miles viaja por el multiverso arácnido y se encuentra con la Sociedad Arácnida liderada por Miguel O\u2019Hara, pero pronto descubre que su destino está en juego.',
    ...TMDB('8Vt6mWEReuy4Of61Lnj5Xj704m8'),
    anio: 2023,
    generos: ['Animación', 'Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 140,
    recurso: TMDB_PAGE(569094),
    categoria: 'Spider-Man',
    createdAt: 48
  },

  // ---------- MINIONS (todas) ----------
  {
    id: 'sr_minions_1',
    titulo: 'Minions',
    tipo: 'pelicula',
    descripcion: 'Stuart, Kevin y Bob, tres minions en busca de un amo al que servir, conocen a Scarlet Overkill, la primera supervillana del mundo. La película que cuenta los orígenes de los minions.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/1/19/Minions_%282015_film%29.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/1/19/Minions_%282015_film%29.jpg'),
    anio: 2015,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 91,
    recurso: TMDB_PAGE(211672),
    categoria: 'Minions',
    createdAt: 49
  },
  {
    id: 'sr_minions_2',
    titulo: 'Minions: El origen de Gru',
    tipo: 'pelicula',
    descripcion: 'En los años 70, los minions conocen a un joven Gru y le ayudan a convertirse en villano, enfrentándose a la banda de los Seis Siniestros.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/4/45/Minions_The_Rise_of_Gru_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/4/45/Minions_The_Rise_of_Gru_poster.jpg'),
    anio: 2022,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 87,
    recurso: TMDB_PAGE(438148),
    categoria: 'Minions',
    createdAt: 50
  },

  // ---------- MI VILLANO FAVORITO (Gru) ----------
  {
    id: 'sr_mvf_1',
    titulo: 'Mi Villano Favorito',
    tipo: 'pelicula',
    descripcion: 'Gru, un supervillano en paro, adopta a tres niñas huérfanas para usarlas en su plan de robar la Luna. Pero las pequeñas le roban el corazón.',
    portada: WIKI('upload.wikimedia.org/wikipedia/ru/6/6d/Despicable_Me.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/ru/6/6d/Despicable_Me.jpg'),
    anio: 2010,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 95,
    recurso: TMDB_PAGE(20352),
    categoria: 'Mi Villano Favorito',
    createdAt: 51
  },
  {
    id: 'sr_mvf_2',
    titulo: 'Mi Villano Favorito 2',
    tipo: 'pelicula',
    descripcion: 'Gru abandona la vida de villano para criar a sus hijas, pero la Liga Anti-Villanos le recluta para detener a un nuevo enemigo: el supermalvado El Macho.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/2/29/Despicable_Me_2_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/2/29/Despicable_Me_2_poster.jpg'),
    anio: 2013,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 98,
    recurso: TMDB_PAGE(93456),
    categoria: 'Mi Villano Favorito',
    createdAt: 52
  },
  {
    id: 'sr_mvf_3',
    titulo: 'Mi Villano Favorito 3',
    tipo: 'pelicula',
    descripcion: 'Gru se encuentra con su gemelo perdido Dru, mientras la familia debe enfrentarse a Balthazar Bratt, un villano obsesionado con los años 80.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/8/80/Despicable_Me_3_theatrical_release_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/8/80/Despicable_Me_3_theatrical_release_poster.jpg'),
    anio: 2017,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 89,
    recurso: TMDB_PAGE(324852),
    categoria: 'Mi Villano Favorito',
    createdAt: 53
  },
  {
    id: 'sr_mvf_4',
    titulo: 'Mi Villano Favorito 4',
    tipo: 'pelicula',
    descripcion: 'Gru y su familia se enfrentan a Maxime Le Mal, un villano con una venganza personal, y deben esconderse en una nueva ciudad con la ayuda de la Liga Anti-Villanos.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/e/ed/Despicable_Me_4_Theatrical_Release_Poster.jpeg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/e/ed/Despicable_Me_4_Theatrical_Release_Poster.jpeg'),
    anio: 2024,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 94,
    recurso: TMDB_PAGE(519182),
    categoria: 'Mi Villano Favorito',
    createdAt: 54
  },

  // ---------- MASCOTAS ----------
  {
    id: 'sr_mascotas_1',
    titulo: 'Mascotas',
    tipo: 'pelicula',
    descripcion: 'Max, un perro feliz en Manhattan, ve su vida patas arriba cuando su dueña adopta a Duke. Juntos vivirán una aventura por la ciudad para volver a casa.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/6/64/The_Secret_Life_of_Pets_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/6/64/The_Secret_Life_of_Pets_poster.jpg'),
    anio: 2016,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 87,
    recurso: TMDB_PAGE(328111),
    categoria: 'Mascotas',
    createdAt: 55
  },
  {
    id: 'sr_mascotas_2',
    titulo: 'Mascotas 2',
    tipo: 'pelicula',
    descripcion: 'Max debe vencer sus miedos para proteger a Liam, el hijo de su dueña, mientras sus amigos emprenden aventuras por la ciudad.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/e/eb/The_Secret_Life_of_Pets_2_%282019%29_Final_Poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/e/eb/The_Secret_Life_of_Pets_2_%282019%29_Final_Poster.jpg'),
    anio: 2019,
    generos: ['Animación', 'Comedia', 'Familia'],
    duracion: 86,
    recurso: TMDB_PAGE(412117),
    categoria: 'Mascotas',
    createdAt: 56
  },

  // ---------- MOANA / VAIANA ----------
  {
    id: 'sr_moana_1',
    titulo: 'Moana (Vaiana)',
    tipo: 'pelicula',
    descripcion: 'Vaiana, una joven navegante de Motunui, se embarca en una aventura por el océano para devolver el corazón de Te Fiti y salvar a su isla, acompañada del semidiós Maui.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/2/26/Moana_Teaser_Poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/2/26/Moana_Teaser_Poster.jpg'),
    anio: 2016,
    generos: ['Animación', 'Aventura', 'Fantasía', 'Musical'],
    duracion: 107,
    recurso: TMDB_PAGE(277834),
    categoria: 'Moana',
    createdAt: 57
  },
  {
    id: 'sr_moana_2',
    titulo: 'Moana 2',
    tipo: 'pelicula',
    descripcion: 'Años después, Vaiana recibe una llamada de sus ancestros y reúne una nueva tripulación para una aventura que pondrá a prueba su espíritu navegante.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/7/73/Moana_2_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/7/73/Moana_2_poster.jpg'),
    anio: 2024,
    generos: ['Animación', 'Aventura', 'Fantasía', 'Musical'],
    duracion: 100,
    recurso: TMDB_PAGE(744857),
    categoria: 'Moana',
    createdAt: 58
  },

  // ---------- CARS ----------
  {
    id: 'sr_cars_1',
    titulo: 'Cars',
    tipo: 'pelicula',
    descripcion: 'Rayo McQueen, un coche de carreras arrogante, acaba perdido en Radiador Springs y aprende que en la vida hay mucho más que ganar.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/3/34/Cars_2006.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/3/34/Cars_2006.jpg'),
    anio: 2006,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 116,
    recurso: TMDB_PAGE(920),
    categoria: 'Cars',
    createdAt: 59
  },
  {
    id: 'sr_cars_2',
    titulo: 'Cars 2',
    tipo: 'pelicula',
    descripcion: 'Rayo McQueen viaja al Mundial de Grand Prix junto a su amigo Mate, que sin querer se ve envuelto en una misión de espionaje internacional.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/7/7f/Cars_2_Poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/7/7f/Cars_2_Poster.jpg'),
    anio: 2011,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 106,
    recurso: TMDB_PAGE(49013),
    categoria: 'Cars',
    createdAt: 60
  },
  {
    id: 'sr_cars_3',
    titulo: 'Cars 3',
    tipo: 'pelicula',
    descripcion: 'Una nueva generación de coches de carreras amenaza la carrera de Rayo McQueen, que debe entrenarse para demostrar que aún puede ganar.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/9/94/Cars_3_poster.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/9/94/Cars_3_poster.jpg'),
    anio: 2017,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 102,
    recurso: TMDB_PAGE(260514),
    categoria: 'Cars',
    createdAt: 61
  },

  // ---------- EL SEÑOR DE LOS ANILLOS ----------
  {
    id: 'sr_lotr_1',
    titulo: 'El Señor de los Anillos: La Comunidad del Anillo',
    tipo: 'pelicula',
    descripcion: 'Frodo Bolsón hereda el Anillo Único y emprende un viaje para destruirlo en el Monte del Destino, acompañado de la Comunidad del Anillo.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/f/fb/Lord_Rings_Fellowship_Ring.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/f/fb/Lord_Rings_Fellowship_Ring.jpg'),
    anio: 2001,
    generos: ['Fantasía', 'Aventura', 'Acción'],
    duracion: 178,
    recurso: TMDB_PAGE(120),
    categoria: 'El Señor de los Anillos',
    createdAt: 62
  },
  {
    id: 'sr_lotr_2',
    titulo: 'El Señor de los Anillos: Las Dos Torres',
    tipo: 'pelicula',
    descripcion: 'La Comunidad se divide mientras la guerra se extiende por la Tierra Media. Frodo y Sam continúan hacia Mordor con la guía de Gollum.',
    ...TMDB('5VTN0pR8gcqV3EPUHHfMGnJYN9L'),
    anio: 2002,
    generos: ['Fantasía', 'Aventura', 'Acción'],
    duracion: 179,
    recurso: TMDB_PAGE(121),
    categoria: 'El Señor de los Anillos',
    createdAt: 63
  },
  {
    id: 'sr_lotr_3',
    titulo: 'El Señor de los Anillos: El Retorno del Rey',
    tipo: 'pelicula',
    descripcion: 'La batalla final por la Tierra Media llega a las puertas de Mordor mientras Frodo y Sam completan su misión. La épica conclusión de la trilogía.',
    ...TMDB('rCzpDGLbOoPwLjy3OAm5NUPOTrC'),
    anio: 2003,
    generos: ['Fantasía', 'Aventura', 'Acción'],
    duracion: 201,
    recurso: TMDB_PAGE(122),
    categoria: 'El Señor de los Anillos',
    createdAt: 64
  },

  // ==========================================
  // SERIES
  // ==========================================
  // ---------- DRAGON BALL (todas) ----------
  {
    id: 'sr_db_original',
    titulo: 'Dragon Ball',
    tipo: 'serie',
    descripcion: 'La serie original: Goku, un niño con cola de mono y fuerza sobrehumana, acompaña a Bulma en la búsqueda de las siete Esferas del Dragón, viviendo aventuras y conociendo a grandes amigos y rivales.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-876-poster-683x1024.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-876-poster-683x1024.jpg',
    anio: 1986,
    generos: GEN,
    recurso: 'https://dragonballlatino.net/series/dragon-ball/',
    categoria: 'Dragon Ball',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPISODE('dragon-ball', 1, 153) }
    ],
    createdAt: 5
  },
  {
    id: 'sr_db_z',
    titulo: 'Dragon Ball Z',
    tipo: 'serie',
    descripcion: 'Goku descubre su origen saiyajin y se convierte en el protector de la Tierra. Desde la llegada de Raditz hasta la saga de Majin Buu, enfrenta a Freezer, Cell y los guerreros más poderosos del universo.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-z-246-poster.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-z-246-poster.jpg',
    anio: 1989,
    generos: GEN,
    recurso: 'https://dragonballlatino.net/series/dragon-ball-z/',
    categoria: 'Dragon Ball',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPISODE('dragon-ball-z', 1, 39) },
      { titulo: 'Temporada 2', episodios: EPISODE('dragon-ball-z', 2, 35) },
      { titulo: 'Temporada 3', episodios: EPISODE('dragon-ball-z', 3, 33) },
      { titulo: 'Temporada 4', episodios: EPISODE('dragon-ball-z', 4, 32) },
      { titulo: 'Temporada 5', episodios: EPISODE('dragon-ball-z', 5, 26) },
      { titulo: 'Temporada 6', episodios: EPISODE('dragon-ball-z', 6, 29) },
      { titulo: 'Temporada 7', episodios: EPISODE('dragon-ball-z', 7, 25) },
      { titulo: 'Temporada 8', episodios: EPISODE('dragon-ball-z', 8, 34) },
      { titulo: 'Temporada 9', episodios: EPISODE('dragon-ball-z', 9, 38) }
    ],
    createdAt: 6
  },
  {
    id: 'sr_db_super',
    titulo: 'Dragon Ball Super',
    tipo: 'serie',
    descripcion: 'La nueva etapa de la franquicia: tras la derrota de Majin Buu, Goku conoce a Bills, el Dios de la Destrucción, y a su maestro Whis, iniciando batallas multiversales como el Torneo del Poder.',
    portada: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-super-28-poster.jpg',
    banner: 'https://dragonballlatino.net/wp-content/uploads/2020/11/dragon-ball-super-28-poster.jpg',
    anio: 2015,
    generos: GEN,
    recurso: 'https://dragonballlatino.net/series/dragon-ball-super/',
    categoria: 'Dragon Ball',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPISODE('dragon-ball-super', 1, 131) }
    ],
    createdAt: 7
  },

  // ---------- GRAVITY FALLS ----------
  {
    id: 'sr_gravity_falls',
    titulo: 'Gravity Falls',
    tipo: 'serie',
    descripcion: 'Dipper y Mabel Pines, gemelos de 12 años, van a pasar el verano con su tío abuelo Stan en el misterioso pueblo de Gravity Falls, Oregón. Lo que parecía un verano tranquilo se convierte en una aventura llena de criaturas sobrenaturales, conspiraciones y los secretos más extraños del mundo. La aclamada serie animada de Alex Hirsch (2012-2016).',
    portada: 'https://image.tmdb.org/t/p/w500/gX9NP6pWG47oAkq723TfxtkG4Pr.jpg',
    banner: 'https://image.tmdb.org/t/p/w1280/lhg7eA6CTOCL10QNVdKiyxkgPsL.jpg',
    anio: 2012,
    generos: ['Animación', 'Misterio', 'Comedia', 'Aventura'],
    recurso: 'https://kinogo-films.pro/24152-graviti-folz.html',
    categoria: 'Gravity Falls',
    temporadas: [
      { titulo: 'Temporada 1', episodios: Array.from({ length: 20 }, (_, i) => ({ num: i + 1, titulo: `Episodio ${i + 1}` })) },
      { titulo: 'Temporada 2', episodios: Array.from({ length: 20 }, (_, i) => ({ num: i + 1, titulo: `Episodio ${i + 1}` })) }
    ],
    createdAt: 8
  },

  // ---------- OBSESIÓN (Netflix) ----------
  {
    id: 'sr_obsesion',
    titulo: 'Obsesión',
    tipo: 'serie',
    descripcion: 'William, un respetado cirujano, inicia un apasionado y peligroso romance con Anna, la hija de su prometida, que amenaza con destruir a ambas familias. Serie de suspense erótico basada en la novela \u201CDaño\u201D de Josephine Hart.',
    portada: '',
    banner: '',
    anio: 2023,
    generos: ['Suspense', 'Drama', 'Romance'],
    recurso: TMDB_SEARCH('Obsesión'),
    categoria: 'Obsesión',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPS(6) }
    ],
    createdAt: 65
  },

  // ---------- COCINA (Кухня) ----------
  {
    id: 'sr_cocina',
    titulo: 'Cocina (Кухня)',
    tipo: 'serie',
    descripcion: 'Viktor, un joven de provincias que sueña con ser chef, consigue trabajo en el restaurante más prestigioso de Moscú, el Claude Monet, donde deberá sobrevivir a su excéntrico equipo y al implacable chef Nagánov. La exitosa comedia rusa.',
    portada: WIKI('upload.wikimedia.org/wikipedia/ru/f/f4/%D0%A1%D0%B5%D1%80%D0%B8%D0%B0%D0%BB_%D0%9A%D1%83%D1%85%D0%BD%D1%8F.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/ru/f/f4/%D0%A1%D0%B5%D1%80%D0%B8%D0%B0%D0%BB_%D0%9A%D1%83%D1%85%D0%BD%D1%8F.jpg'),
    anio: 2012,
    generos: ['Comedia', 'Drama'],
    recurso: TMDB_SEARCH('Кухня'),
    categoria: 'Cocina',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPS(20) },
      { titulo: 'Temporada 2', episodios: EPS(20) },
      { titulo: 'Temporada 3', episodios: EPS(20) },
      { titulo: 'Temporada 4', episodios: EPS(20) },
      { titulo: 'Temporada 5', episodios: EPS(20) },
      { titulo: 'Temporada 6', episodios: EPS(20) }
    ],
    createdAt: 66
  },

  // ---------- KIBERSPORT (Esports) ----------
  {
    id: 'sr_kibersport',
    titulo: 'KiberSport (Esports)',
    tipo: 'serie',
    descripcion: 'Serie sobre el mundo de los deportes electrónicos: jóvenes jugadores, equipos, torneos y la vida dentro y fuera de los videojuegos.',
    portada: '',
    banner: '',
    anio: 2021,
    generos: ['Drama', 'Deporte'],
    recurso: TMDB_SEARCH('esports'),
    categoria: 'Esports',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPS(10) }
    ],
    createdAt: 67
  },

  // ---------- SHERLOCK HOLMES (BBC) ----------
  {
    id: 'sr_sherlock',
    titulo: 'Sherlock',
    tipo: 'serie',
    descripcion: 'Sherlock Holmes, el detective genio, y su compañero John Watson resuelven los casos más desconcertantes del Londres moderno en la aclamada serie de la BBC.',
    portada: WIKI('upload.wikimedia.org/wikipedia/en/4/4d/Sherlock_titlecard.jpg'),
    banner: WIKI('upload.wikimedia.org/wikipedia/en/4/4d/Sherlock_titlecard.jpg'),
    anio: 2010,
    generos: ['Misterio', 'Drama', 'Crimen'],
    recurso: TMDB_TV(1622),
    categoria: 'Sherlock Holmes',
    temporadas: [
      { titulo: 'Temporada 1', episodios: EPS(3) },
      { titulo: 'Temporada 2', episodios: EPS(3) },
      { titulo: 'Temporada 3', episodios: EPS(3) },
      { titulo: 'Temporada 4', episodios: EPS(3) }
    ],
    createdAt: 68
  }
];

/** Copia limpia de la semilla (evita mutar el objeto compartido). */
export function defaultCatalog() {
  return DEFAULT_CATALOG.map(item => ({
    ...item,
    temporadas: item.temporadas
      ? item.temporadas.map(s => ({ ...s, episodios: [...s.episodios] }))
      : undefined
  }));
}
