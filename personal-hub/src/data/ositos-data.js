/* ==========================================
   OSITOS DATA — Personajes del universo Ositos
   Compartido entre OsitosWorld y el Inicio
   ========================================== */

/**
 * El mundo, en tres frases. Es lo primero que se lee en la sección y lo que
 * da sentido a los lugares y a las sagas de abajo.
 */
export const LORE = {
  name: 'Ositos World',
  tagline: 'Un universo de ositos donde todo lo que se pierde acaba guardado en un bolsillo de peluche.',
  intro: 'Al otro lado del Bosque de Algodón hay un mundo que solo aparece cuando alguien necesita creer en algo. Allí el tiempo se da cuerda a mano, la miel sabe a domingo y hasta los villanos guardan juguetes por si alguien vuelve a buscarlos.'
};

export const CHARACTERS = [
  {
    id: 'baton-gordito', name: 'Batón Gordito', role: 'heroe',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783491042/ChatGPT_Image_6_jul_2026_19_05_44-Photoroom_tsg4yb.png',
    emoji: '🧸',
    description: 'El osito guardián del Bosque de Algodón. Lleva un batón remendado con hilos de todos los colores y una llave que abre puertas que todavía no existen.',
    personality: 'Valiente sin hacer ruido y torpe con las palabras: prefiere un abrazo de emergencia a un discurso. Se le nota cuando algo le importa, porque se le eriza el peluche de las orejas.',
    curiosities: 'Su batón tiene un bolsillo cosido por cada persona a la que ha ayudado. Ya van más de cien y sigue cosiendo.',
    color: '#e8a0b4',
    home: 'Bosque de Algodón',
    friends: ['Lili y Lolo', 'Vaca Lola', 'Bolita']
  },
  {
    id: 'lila-y-lolo', name: 'Lili y Lolo', role: 'aliado',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783491103/ChatGPT_Image_6_jul_2026_19_05_52-Photoroom_mvhimf.png',
    emoji: '🐰',
    description: 'Dos conejitos que se turnan para ser valientes: cuando uno se asusta, el otro da el primer paso. Nunca se les ve lejos el uno del otro.',
    personality: 'Lili habla con las plantas y Lolo le pone nombre a las piedras. Juntos encuentran caminos donde no los hay, aunque tarden tres meriendas en decidir cuál.',
    curiosities: 'Se escriben cartas incluso cuando están en la misma habitación. Dicen que así lo importante no se les olvida.',
    color: '#a8d8ea',
    home: 'Río de Miel',
    friends: ['Batón Gordito', 'Nube de Miel']
  },
  {
    id: 'vaca', name: 'Vaca Lola', role: 'aliado',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783491109/ChatGPT_Image_6_jul_2026_19_06_21-Photoroom_rhv6de.png',
    emoji: '🐿️',
    description: 'Reparte leche de luna en tazas diminutas y se sabe el nombre de cada estrella que se asoma al amanecer. Su granja está justo donde termina la Colina de las Estrellas.',
    personality: 'Tranquila, mandona con cariño y la única capaz de poner orden en una merienda de ositos sin que nadie se enfade.',
    curiosities: 'Su campana suena distinto según lo que vaya a pasar: tres notas si va a llover y una larga si alguien necesita compañía.',
    color: '#80ced6',
    home: 'Colina de las Estrellas',
    friends: ['Batón Gordito', 'Oso Relojero']
  },
  {
    id: 'rey-esqueleto', name: 'Rey Esqueleto', role: 'villano',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783358108/ChatGPT_Image_6_jul_2026_19_05_29-Photoroom_tnbedt.png',
    emoji: '💀',
    description: 'Gobierna el Castillo de Hueso desde hace trescientos inviernos. Guarda todos los juguetes que nadie reclamó y, aunque no lo admita, les habla por la noche.',
    personality: 'Sarcástico, teatral y alérgico a que le digan que en el fondo es bueno. Se derrite si alguien le llama «señor Rey» con cariño.',
    curiosities: 'Su corona tiene una pieza de cada color del mundo, menos rosa: dice que ese color se lo debe a alguien.',
    color: '#6b5b95',
    home: 'Castillo de Hueso',
    friends: ['Princesa Bruma']
  },
  {
    id: 'bolita', name: 'Bolita', role: 'heroe',
    emoji: '🫧',
    description: 'Un osito tan pequeño que cabe en una taza, con una capa hecha con un pañuelo. Es el único del mundo que puede entrar en los sueños sin despertar a nadie.',
    personality: 'Curioso hasta lo imprudente, habla con las cosas antes de tocarlas y siempre vuelve con una historia que nadie sabe si es verdad.',
    curiosities: 'Guarda en un frasco el polvo de estrellas que se le queda en las patas. El frasco nunca se llena.',
    color: '#f4c95d',
    home: 'Colina de las Estrellas',
    friends: ['Batón Gordito', 'Nube de Miel']
  },
  {
    id: 'nube-miel', name: 'Nube de Miel', role: 'aliado',
    emoji: '🍯',
    description: 'Una osita hecha de miel tibia que flota a un palmo del suelo. Endulza lo que duele, aunque a veces se le va la mano y deja el día entero pegajoso.',
    personality: 'Dulce, despistada y con un olfato infalible para encontrar a quien está triste escondido detrás de una sonrisa.',
    curiosities: 'Cuando llueve sobre ella, el bosque entero huele a tostadas durante un rato.',
    color: '#f6b26b',
    home: 'Río de Miel',
    friends: ['Lili y Lolo', 'Bolita']
  },
  {
    id: 'oso-relojero', name: 'Oso Relojero', role: 'aliado',
    emoji: '🕰️',
    description: 'El osito que le da cuerda al tiempo del mundo desde la Torre del Reloj. Lleva un reloj en el pecho que se atrasa cuando alguien necesita que el día dure un poco más.',
    personality: 'Metódico, buenazo y un poco dramático cuando se le pierde un minuto. Pide disculpas a las horas por adelantado.',
    curiosities: 'Tiene una caja llena de segundos sueltos que devuelve, sin cobrar, a quien llega tarde por amor.',
    color: '#9aa7b8',
    home: 'Torre del Reloj',
    friends: ['Vaca Lola', 'Batón Gordito']
  },
  {
    id: 'princesa-bruma', name: 'Princesa Bruma', role: 'villano',
    emoji: '🌫️',
    description: 'Una osita de niebla que borra los recuerdos tristes… y a veces también los buenos. Vive en el piso de la Torre del Reloj que no aparece en ningún mapa.',
    personality: 'Elegante, herida y convencida de que olvidar es un regalo. Nunca dice su nombre completo, porque dice que se lo quitaron.',
    curiosities: 'Cuando llora, amanece con niebla en el bosque y todos sueñan esa noche con la misma canción.',
    color: '#8e9bb5',
    home: 'Torre del Reloj',
    friends: ['Rey Esqueleto']
  }
];

/**
 * Los lugares del mundo. Cada uno tiene su emoji, su descripción y a quién se
 * suele encontrar por allí.
 */
export const WORLD_PLACES = [
  {
    id: 'bosque-algodon', name: 'Bosque de Algodón', emoji: '🌳',
    description: 'Árboles que sueltan pelusa en vez de hojas. Quien entra sale con el pelo blanco y las ideas más claras.'
  },
  {
    id: 'rio-miel', name: 'Río de Miel', emoji: '🍯',
    description: 'Corre despacio y sabe a domingo. En sus orillas los conejitos escriben cartas que el agua nunca se lleva del todo.'
  },
  {
    id: 'torre-reloj', name: 'Torre del Reloj', emoji: '🕰️',
    description: 'El corazón del tiempo del mundo. Tiene un piso de más que solo aparece cuando alguien necesita esconderse.'
  },
  {
    id: 'castillo-hueso', name: 'Castillo de Hueso', emoji: '🏰',
    description: 'Sin ventanas, lleno de juguetes sin dueño. Se dice que si llamas con educación, el Rey abre la puerta.'
  },
  {
    id: 'colina-estrellas', name: 'Colina de las Estrellas', emoji: '✨',
    description: 'El único sitio desde el que se ven las estrellas de día. Allí vive Vaca Lola y allí sueña Bolita.'
  }
];

/**
 * Las sagas de la biblioteca: cada libro, sus capítulos y una pizca de lo que
 * pasa en cada uno.
 */
export const SAGAS = [
  {
    id: 'baton-cien-bolsillos',
    title: 'El batón de los cien bolsillos',
    subtitle: 'Saga I · El Bosque',
    emoji: '📖',
    description: 'La historia de cómo Batón Gordito aprendió que guardar las cosas de los demás también es una forma de querer.',
    chapters: [
      { title: 'El día que el bosque bostezó', teaser: 'Una mañana el Bosque de Algodón se quedó dormido y nadie encontraba el camino a casa.' },
      { title: 'La llave que no abría nada', teaser: 'Batón encuentra una llave diminuta. Ninguna puerta del mundo encaja… todavía.' },
      { title: 'Cien bolsillos, una promesa', teaser: 'Para ayudar a volver a casa hay que llevarse algo de cada uno. Y devolverlo a tiempo.' }
    ]
  },
  {
    id: 'cartas-dos-conejos',
    title: 'Cartas entre dos conejos',
    subtitle: 'Saga II · El Río',
    emoji: '✉️',
    description: 'Lili y Lolo se escriben aunque vivan juntos, y una de esas cartas se va río abajo con todo lo que no se atrevían a decir.',
    chapters: [
      { title: 'La primera carta', teaser: 'Lolo quiere decir algo importante y decide escribirlo. Tarda tres días en elegir el sobre.' },
      { title: 'El río se llevó el sobre', teaser: 'El agua corre hacia la Torre, donde las palabras se guardan o se borran.' },
      { title: 'Cuando la sombra se hizo sitio', teaser: 'Para recuperar la carta hay que cruzar el bosque de noche, y ninguno quiere ir primero.' }
    ]
  },
  {
    id: 'rey-abrazos',
    title: 'El rey que coleccionaba abrazos',
    subtitle: 'Saga III · El Castillo',
    emoji: '👑',
    description: 'Bajo la corona hay un osito que se quedó sin nadie. Esta es la historia de la pieza rosa que le falta.',
    chapters: [
      { title: 'El castillo sin ventanas', teaser: 'Dentro no hay luz, pero sí juguetes ordenados por fecha de abandono.' },
      { title: 'Un juguete sin dueño', teaser: 'Bolita entra dormido en el castillo y reconoce un oso de peluche que no es de este mundo.' },
      { title: 'La corona que faltaba rosa', teaser: 'Para terminar la corona hay que aceptar el primer abrazo en trescientos años.' }
    ]
  }
];
