/**
 * Catálogo de tarjetas del hub — añade entradas aquí para escalar sin tocar HTML.
 * @typedef {object} HubCard
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} href
 * @property {string} icon - nombre Lucide
 * @property {string} [variant] - ej. 'lab' para estilos especiales
 * @property {{ icon: string, text: string }} [footer]
 */

/** @type {HubCard[]} */
export const HUB_CARDS = [
    {
        id: 'canciones',
        title: 'Canciones',
        description: 'Trozos de canciones que me recuerdan a ti, mi princesa.',
        href: 'pages/canciones.html',
        icon: 'music',
        footer: { icon: 'play-circle', text: '14 canciones · Escúchalas ahora' }
    },
    {
        id: 'rincon',
        title: 'TuRincónFav',
        description: 'Galería, gatos, memes y tu rincón especial.',
        href: 'pages/rincon.html',
        icon: 'heart'
    },
    {
        id: 'thoseeyes',
        title: 'Those Eyes',
        description: 'Simplemente una cancion que me encanta, pero jamás como tú.',
        href: 'pages/thoseeyes.html',
        icon: 'eye'
    },
    {
        id: 'series',
        title: 'Series',
        description: 'Seguimiento de series y progreso de episodios.',
        href: 'pages/series.html',
        icon: 'tv'
    },
    {
        id: 'razones',
        title: 'Razones',
        description: 'Razones por las que te quiero. (Y eso que no son todas jsjs).',
        href: 'pages/razones.html',
        icon: 'heart'
    },
    {
        id: 'openwhen',
        title: 'Open When',
        description: 'Cartas digitales para cuando sientas diferentes emociones.',
        href: 'pages/openwhen.html',
        icon: 'mail'
    },
    {
        id: 'calendario',
        title: 'Calendario',
        description: 'Casillas con sorpresas pequeñas, recuerdos y retos bonitos.',
        href: 'pages/calendario.html',
        icon: 'calendar-days'
    },
    {
        id: 'maldia',
        title: 'Mal día',
        description: 'Frases, alegría y música, lo único que necesitas para calmarte.',
        href: 'pages/maldia.html',
        icon: 'sun-medium'
    },
    {
        id: 'sentimientos',
        title: 'Sentimientos',
        description: 'Razones, cartas, calendario y apoyo, todo en un solo lugar.',
        href: 'pages/sentimientos.html',
        icon: 'heart-handshake',
        footer: { icon: 'heart', text: 'Razones · Cartas · Calendario · Apoyo' }
    }
];
