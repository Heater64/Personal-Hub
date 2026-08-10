/* ==========================================
   series-seed.js — Catálogo inicial de la
   sección Series & Películas.

   Catálogo semilla que se usa cuando el
   usuario aún no tiene datos guardados
   (la fuente de verdad en producción es la
   fila 'series' de Supabase).

   Cada título puede llevar una `categoria`
   (Dragon Ball, Gravity Falls, Disney, Marvel,
   Pixar…) que agrupa las filas del inicio de
   la sección. Los enlaces `recurso` de las
   películas nuevas apuntan a su página oficial
   de referencia (TMDB), donde se listan las
   opciones legales de streaming; el usuario
   puede sustituirlos por su enlace favorito
   desde el editor.
   ========================================== */

const EPISODE = (serie, season, total) =>
  Array.from({ length: total }, (_, i) => ({
    num: i + 1,
    titulo: `Episodio ${i + 1}`,
    recurso: `https://dragonballlatino.net/episode/${serie}-${season}x${i + 1}/`
  }));

const GEN = ['Animación', 'Acción', 'Aventura'];

/** Portada TMDB (2:3) y banner TMDB (16:9) a partir del hash del póster. */
const TMDB = (posterHash, bannerHash = posterHash) => ({
  portada: `https://image.tmdb.org/t/p/w500/${posterHash}.jpg`,
  banner: `https://image.tmdb.org/t/p/w1280/${bannerHash}.jpg`
});

/** Página oficial de referencia (TMDB) para ver opciones legales de streaming. */
const TMDB_PAGE = (id) => `https://www.themoviedb.org/movie/${id}`;

export const DEFAULT_CATALOG = [
  // ==========================================
  // PELÍCULAS
  // ==========================================
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

  // ==========================================
  // SERIES
  // ==========================================
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

  // ==========================================
  // HOTEL TRANSYLVANIA (4 películas)
  // ==========================================
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

  // ==========================================
  // DISNEY (Frozen)
  // ==========================================
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

  // ==========================================
  // MARVEL (Universo Cinematográfico)
  // ==========================================
  {
    id: 'sr_mv_iron_man',
    titulo: 'Iron Man',
    tipo: 'pelicula',
    descripcion: 'El genio millonario Tony Stark, secuestrado por terroristas, construye una armadura que le salva la vida y decide usarla para proteger al mundo. El comienzo del Universo Marvel.',
    ...TMDB('tFCTNx7foAsUQpgu2x1KjAJD1wT', 'cKvDv2LpwVEqbdXWoQl4XgGN6le'),
    anio: 2008,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 126,
    recurso: TMDB_PAGE(1726),
    categoria: 'Marvel',
    createdAt: 15
  },
  {
    id: 'sr_mv_avengers_1',
    titulo: 'Vengadores',
    tipo: 'pelicula',
    descripcion: 'Nick Fury reúne a Iron Man, Capitán América, Thor, Hulk, Viuda Negra y Ojo de Halcón para detener a Loki y su ejército alienígena antes de que conquisten la Tierra.',
    ...TMDB('ugX4WZJO3jEvTOerctAWJLinujo', '9BBTo63ANSmhC4e6r62OJFuK2GL'),
    anio: 2012,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 143,
    recurso: TMDB_PAGE(24428),
    categoria: 'Marvel',
    createdAt: 16
  },
  {
    id: 'sr_mv_guardians_1',
    titulo: 'Guardianes de la galaxia',
    tipo: 'pelicula',
    descripcion: 'Un ladrón, una asesina, un guerrero vengativo, un mapache armado y un árbol unen fuerzas para evitar que un loco destruya la galaxia con una Gema del Infinito.',
    ...TMDB('zqZNnuMtrmK99Xux91KiCdnZxgb', 'uLtVbjvS1O7gXL8lUOwsFOH4man'),
    anio: 2014,
    generos: ['Acción', 'Aventura', 'Ciencia ficción', 'Comedia'],
    duracion: 121,
    recurso: TMDB_PAGE(118340),
    categoria: 'Marvel',
    createdAt: 17
  },
  {
    id: 'sr_mv_winter_soldier',
    titulo: 'Capitán América: El Soldado de Invierno',
    tipo: 'pelicula',
    descripcion: 'Steve Rogers descubre una conspiración dentro de S.H.I.E.L.D. y se enfrenta al Soldado de Invierno, un asesino letal que esconde un secreto muy personal.',
    ...TMDB('wP7JcCzpWlX5XeROpf4ox9ZVFT6', '1RWLMyC9KcFfcaoViMiJGSSZzzr'),
    anio: 2014,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 136,
    recurso: TMDB_PAGE(100402),
    categoria: 'Marvel',
    createdAt: 18
  },
  {
    id: 'sr_mv_age_of_ultron',
    titulo: 'Vengadores: La era de Ultrón',
    tipo: 'pelicula',
    descripcion: 'Tony Stark crea a Ultrón, una inteligencia artificial para proteger la Tierra, pero el plan sale mal: Ultrón decide que la humanidad es el problema y solo él la salvará.',
    ...TMDB('3Lz6h5rlCFNNyCZRaRJ2ZjtBnAE', 'kIBK5SKwgqIIuRKhhWrJn3XkbPq'),
    anio: 2015,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 141,
    recurso: TMDB_PAGE(99861),
    categoria: 'Marvel',
    createdAt: 19
  },
  {
    id: 'sr_mv_civil_war',
    titulo: 'Capitán América: Civil War',
    tipo: 'pelicula',
    descripcion: 'Los Vengadores se dividen cuando el gobierno exige regularlos. Capitán América y Iron Man lideran bandos opuestos en una guerra que lo cambia todo.',
    ...TMDB('jPPy7tCfglppQo6J9nGwU6UmJ8X', 'wdwcOBMkt3zmPQuEMxB3FUtMio2'),
    anio: 2016,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 147,
    recurso: TMDB_PAGE(271110),
    categoria: 'Marvel',
    createdAt: 20
  },
  {
    id: 'sr_mv_doctor_strange',
    titulo: 'Doctor Strange',
    tipo: 'pelicula',
    descripcion: 'El arrogante neurocirujano Stephen Strange, tras un grave accidente, descubre el mundo de las artes místicas y se convierte en el protector de la realidad.',
    ...TMDB('wJEZI3PWyMW7qcW6n9jyCh7Cclf', 'kkoiH8ZWxJ9WSAjOadGtuHUQxbm'),
    anio: 2016,
    generos: ['Acción', 'Aventura', 'Fantasía'],
    duracion: 115,
    recurso: TMDB_PAGE(284052),
    categoria: 'Marvel',
    createdAt: 21
  },
  {
    id: 'sr_mv_guardians_2',
    titulo: 'Guardianes de la Galaxia II',
    tipo: 'pelicula',
    descripcion: 'Peter Quill descubre el secreto de su origen cuando aparece su padre, Ego. Los Guardianes deberán decidir qué significa realmente la familia.',
    ...TMDB('kdg6Y06jfq9FV7qknWNcKLYtBJn', 'bW93ycPSSi3Hxx1NvlMX5qm2mQu'),
    anio: 2017,
    generos: ['Acción', 'Aventura', 'Ciencia ficción', 'Comedia'],
    duracion: 136,
    recurso: TMDB_PAGE(283995),
    categoria: 'Marvel',
    createdAt: 22
  },
  {
    id: 'sr_mv_homecoming',
    titulo: 'Spider-Man: Homecoming',
    tipo: 'pelicula',
    descripcion: 'Peter Parker intenta equilibrar su vida de instituto con sus deberes de superhéroe bajo la atenta mirada de Tony Stark, mientras un nuevo villano amenaza Queens.',
    ...TMDB('bRl6C6FwzTndk0MBGZZ68nRFlw3', 'fn4n6uOYcB6Uh89nbNPoU2w80RV'),
    anio: 2017,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 133,
    recurso: TMDB_PAGE(315635),
    categoria: 'Marvel',
    createdAt: 23
  },
  {
    id: 'sr_mv_ragnarok',
    titulo: 'Thor: Ragnarok',
    tipo: 'pelicula',
    descripcion: 'Thor pierde su martillo y es capturado por Hela, la diosa de la muerte. Para salvar Asgard tendrá que aliarse con Hulk en un planeta convertido en arena de gladiadores.',
    ...TMDB('pGtkLdk4rnF2A3Yz2BHiTgRwMU4', 'vLmHH8jAy8Jq8uBsLucd3592WGh'),
    anio: 2017,
    generos: ['Acción', 'Aventura', 'Ciencia ficción', 'Comedia'],
    duracion: 130,
    recurso: TMDB_PAGE(284053),
    categoria: 'Marvel',
    createdAt: 24
  },
  {
    id: 'sr_mv_black_panther',
    titulo: 'Black Panther',
    tipo: 'pelicula',
    descripcion: 'T\u2019Challa regresa a Wakanda para ser rey tras la muerte de su padre, pero un viejo rival con un plan peligroso amenaza su trono y su nación.',
    ...TMDB('lAPzezdc5E6DFnttJwCWXZ9A9C6', 'b6ZJZHUdMEFECvGiDpJjlfUWela'),
    anio: 2018,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 134,
    recurso: TMDB_PAGE(284054),
    categoria: 'Marvel',
    createdAt: 25
  },
  {
    id: 'sr_mv_infinity_war',
    titulo: 'Vengadores: Infinity War',
    tipo: 'pelicula',
    descripcion: 'Thanos busca las seis Gemas del Infinito para borrar la mitad del universo. Todos los héroes de la Tierra y de la galaxia intentarán detenerlo en la batalla más grande jamás contada.',
    ...TMDB('ksBQ4oHQDdJwND8H90ay8CbMihU', 'mDfJG3LC3Dqb67AZ52x3Z0jU0uB'),
    anio: 2018,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 149,
    recurso: TMDB_PAGE(299536),
    categoria: 'Marvel',
    createdAt: 26
  },
  {
    id: 'sr_mv_endgame',
    titulo: 'Vengadores: Endgame',
    tipo: 'pelicula',
    descripcion: 'Tras la devastación de Infinity War, los Vengadores supervivientes intentan deshacer el chasquido de Thanos con un plan imposible que cruza el tiempo y reúne a todos los héroes.',
    ...TMDB('br6krBFpaYmCSglLBWRuhui7tPc', '7RyHsO4yDXtBv1zUU3mTpHeQ0d5'),
    anio: 2019,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 181,
    recurso: TMDB_PAGE(299534),
    categoria: 'Marvel',
    createdAt: 27
  },
  {
    id: 'sr_mv_far_from_home',
    titulo: 'Spider-Man: Lejos de casa',
    tipo: 'pelicula',
    descripcion: 'Peter Parker se va de viaje por Europa con sus amigos, pero Nick Fury le encarga una misión: detener a unas criaturas elementales que amenazan el continente.',
    ...TMDB('o59zDVJDIehGcWZsMUGU5SN0V0D', 'vamhMTvh9m9zFHDoR0v1nRtf6T4'),
    anio: 2019,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 129,
    recurso: TMDB_PAGE(429617),
    categoria: 'Marvel',
    createdAt: 28
  },
  {
    id: 'sr_mv_no_way_home',
    titulo: 'Spider-Man: No Way Home',
    tipo: 'pelicula',
    descripcion: 'Peter pide ayuda al Doctor Strange para que el mundo olvide que es Spider-Man, pero el hechizo sale mal y trae a villanos de otros universos a su realidad.',
    ...TMDB('accAPImdjUwgNgocDNWXCGFEcvL', '14QbnygCuTO0vl7CAFmPf1fgZfV'),
    anio: 2021,
    generos: ['Acción', 'Aventura', 'Ciencia ficción'],
    duracion: 148,
    recurso: TMDB_PAGE(634649),
    categoria: 'Marvel',
    createdAt: 29
  },

  // ==========================================
  // PIXAR
  // ==========================================
  {
    id: 'sr_px_toy_story',
    titulo: 'Toy Story',
    tipo: 'pelicula',
    descripcion: 'Los juguetes de Andy cobran vida cuando él no está. Woody, el vaquero, ve peligrar su lugar cuando llega Buzz Lightyear, el nuevo juguete espacial. La primera película de Pixar.',
    ...TMDB('jvn7wy3RSNEXnFSXLpH2of2LcV6', '3Rfvhy1Nl6sSGJwyjb0QiZzZYlB'),
    anio: 1995,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 81,
    recurso: TMDB_PAGE(862),
    categoria: 'Pixar',
    createdAt: 30
  },
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
    id: 'sr_px_nemo',
    titulo: 'Buscando a Nemo',
    tipo: 'pelicula',
    descripcion: 'Marlin, un pez payaso, cruza todo el océano para encontrar a su hijo Nemo, capturado por un buceador. Dory, un pez con memoria a corto plazo, le acompaña en la aventura.',
    ...TMDB('jPhak722pNGxQIXSEfeWIUqBrO5', 'eCynaAOgYYiw5yN5lBwz3IxqvaW'),
    anio: 2003,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 100,
    recurso: TMDB_PAGE(12),
    categoria: 'Pixar',
    createdAt: 32
  },
  {
    id: 'sr_px_incredibles',
    titulo: 'Los Increíbles',
    tipo: 'pelicula',
    descripcion: 'La familia Parr, superhéroes retirados, vuelve a la acción cuando una misteriosa amenaza pone en peligro al mundo. Una aventura de la primera familia de supers.',
    ...TMDB('al1jusd4T7JPatZlj4BuYkDDOzr', 'lxwzY9vNwjDgxWKt3zZ6zcU6rEJ'),
    anio: 2004,
    generos: ['Animación', 'Familia', 'Aventura', 'Acción'],
    duracion: 115,
    recurso: TMDB_PAGE(9806),
    categoria: 'Pixar',
    createdAt: 33
  },
  {
    id: 'sr_px_up',
    titulo: 'Up',
    tipo: 'pelicula',
    descripcion: 'Carl Fredricksen ata miles de globos a su casa y vuela hacia Sudamérica para cumplir el sueño de su esposa. A bordo se cuela Russell, un explorador muy insistente.',
    ...TMDB('1N0LtzUueXrlnpL466jQBJ6iAuj', 'hGGC9gKo7CFE3fW07RA587e5kol'),
    anio: 2009,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 96,
    recurso: TMDB_PAGE(14160),
    categoria: 'Pixar',
    createdAt: 34
  },
  {
    id: 'sr_px_toy_story_3',
    titulo: 'Toy Story 3',
    tipo: 'pelicula',
    descripcion: 'Andy crece y los juguetes temen acabar en el basurero. Tras un malentendido acaban en una guardería donde las cosas no son tan divertidas como parecen.',
    ...TMDB('yBSISwqix2z0JiwIrM3r6fiI6Cm', 'uAfhsySkr1UzQg1zdg3dZQRz9Fd'),
    anio: 2010,
    generos: ['Animación', 'Familia', 'Aventura', 'Comedia'],
    duracion: 103,
    recurso: TMDB_PAGE(10193),
    categoria: 'Pixar',
    createdAt: 35
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
    id: 'sr_px_coco',
    titulo: 'Coco',
    tipo: 'pelicula',
    descripcion: 'Miguel, un niño que sueña con ser músico, acaba en la Tierra de los Muertos durante el Día de Muertos y descubre la verdad sobre su familia y su pasado.',
    ...TMDB('vwsFGblLYxWBNjg9pdWN1Mm5YfW', 'g7CHF8gTLGooTbP4GznIGwaqAGL'),
    anio: 2017,
    generos: ['Animación', 'Familia', 'Fantasía', 'Música'],
    duracion: 105,
    recurso: TMDB_PAGE(354912),
    categoria: 'Pixar',
    createdAt: 37
  },
  {
    id: 'sr_px_luca',
    titulo: 'Luca',
    tipo: 'pelicula',
    descripcion: 'Un monstruo marino llamado Luca se hace amigo de Alberto y descubre el mundo humano en un pueblo costero de Italia durante un verano inolvidable.',
    ...TMDB('pr06RihHOGE3waZQx5fs2WYUdwr', '620hnMVLu6RSZW6a5rwO8gqpt0t'),
    anio: 2021,
    generos: ['Animación', 'Familia', 'Fantasía', 'Comedia'],
    duracion: 95,
    recurso: TMDB_PAGE(508943),
    categoria: 'Pixar',
    createdAt: 38
  },
  {
    id: 'sr_px_walle',
    titulo: 'WALL·E',
    tipo: 'pelicula',
    descripcion: 'En un futuro en el que la Tierra está cubierta de basura, el pequeño robot WALL·E conoce a EVE y la sigue hasta una nave espacial donde la humanidad vive sin pisar el planeta.',
    ...TMDB('5CXpoYB2YAZRPBcv9pjkgR6tZ0X', 'nYs4ZwnJBK4AgljhvzwNz7fpr3E'),
    anio: 2008,
    generos: ['Animación', 'Familia', 'Ciencia ficción'],
    duracion: 98,
    recurso: TMDB_PAGE(10681),
    categoria: 'Pixar',
    createdAt: 39
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
