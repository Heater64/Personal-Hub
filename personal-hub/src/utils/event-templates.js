/* ==========================================
   PLANTILLAS DE UN DÍA ESPECIAL

   Una sola fuente para dos sitios que tienen que contar lo mismo:
   el editor del Admin (qué se elige y qué se explica) y la hoja de
   bienvenida (cómo se compone la pantalla).

   `composition` no es un color: decide el orden, el ritmo y el trato
   de la media. Los datos guardados no cambian: `type` sigue siendo el
   id de la plantilla y todo lo demás (título, fecha, texto, foto…) se
   lee igual que antes.
   ========================================== */

/** Las cuatro familias de composición que sabe montar la hoja. */
export const EVENT_COMPOSITIONS = {
  editorial: {
    id: 'editorial',
    label: 'Editorial íntima',
    hint: 'La foto manda y el texto se lee como una dedicatoria, en Playfair.'
  },
  celebratory: {
    id: 'celebratory',
    label: 'Celebración',
    hint: 'Emoji grande y jerarquía alegre; la decoración se queda en un marco.'
  },
  themed: {
    id: 'themed',
    label: 'Atmósfera temática',
    hint: 'Un panel con el tono de la fiesta envuelve el texto y el emoji.'
  },
  neutral: {
    id: 'neutral',
    label: 'Umbra neutra',
    hint: 'Composición limpia de la casa, sin decoración de fiesta.'
  }
};

/**
 * Catálogo de plantillas. `tone` es el par [acento, fondo suave] que usa la
 * hoja; `defaultEmoji` y `defaultDescription` son los valores de fábrica
 * cuando el evento no trae los suyos.
 */
export const EVENT_TEMPLATES = {
  anniversary: {
    id: 'anniversary',
    label: 'Aniversario',
    icon: '🤍',
    defaultEmoji: '🤍',
    composition: 'editorial',
    tone: ['var(--primary)', 'var(--primary-soft)'],
    defaultDescription: 'Un capítulo más de nuestra historia juntos. Hoy merece un recuerdo especial.',
    short: 'Foto protagonista y dedicatoria en serif.',
    editorHint: 'Composición editorial íntima: la foto abre la bienvenida y el texto va debajo, como una dedicatoria.'
  },
  memory: {
    id: 'memory',
    label: 'Recuerdo',
    icon: '💌',
    defaultEmoji: '💌',
    composition: 'editorial',
    tone: ['var(--primary)', 'var(--primary-soft)'],
    defaultDescription: 'Hoy recordamos un momento que sigue siendo nuestro.',
    short: 'Postal para volver a un momento compartido.',
    editorHint: 'Composición editorial: una postal con la foto enmarcada y el recuerdo escrito con calma.'
  },
  birthday: {
    id: 'birthday',
    label: 'Cumpleaños',
    icon: '🎂',
    defaultEmoji: '🎂',
    composition: 'celebratory',
    tone: ['var(--primary)', 'var(--primary-soft)'],
    defaultDescription: 'Hoy celebramos a alguien que hace nuestros días mucho más bonitos.',
    short: 'Jerarquía alegre y celebración breve.',
    editorHint: 'Tratamiento celebratorio: emoji circular grande, mensaje corto y la foto después.'
  },
  halloween: {
    id: 'halloween',
    label: 'Halloween',
    icon: '🎃',
    defaultEmoji: '🎃',
    composition: 'themed',
    tone: ['#f28b36', 'rgba(242,139,54,.16)'],
    defaultDescription: 'Una noche para compartir sustos dulces, risas y algún recuerdo encantado.',
    short: 'Noche teatral de naranja cálido.',
    editorHint: 'Atmósfera temática: un panel de noche cálida envuelve el emoji y el texto.'
  },
  christmas: {
    id: 'christmas',
    label: 'Navidad',
    icon: '🎄',
    defaultEmoji: '🎄',
    composition: 'themed',
    tone: ['#69b984', 'rgba(105,185,132,.16)'],
    defaultDescription: 'Hoy toca guardar un recuerdo bonito y celebrar todo lo que compartimos.',
    short: 'Bienvenida cálida de verde y nieve.',
    editorHint: 'Atmósfera temática: marco verde y copos alrededor; el texto se lee dentro del marco.'
  },
  valentine: {
    id: 'valentine',
    label: 'San Valentín',
    icon: '💘',
    defaultEmoji: '💘',
    composition: 'themed',
    tone: ['#e8614f', 'rgba(232,97,79,.16)'],
    defaultDescription: 'Hoy es de esos días en los que decir «te quiero» se queda corto.',
    short: 'Declaración romántica de rojo suave.',
    editorHint: 'Atmósfera temática romántica: panel de corazones con contraste ajustado.'
  },
  custom: {
    id: 'custom',
    label: 'Personalizada',
    icon: '✨',
    defaultEmoji: '✨',
    composition: 'neutral',
    tone: ['var(--primary)', 'var(--primary-soft)'],
    defaultDescription: 'Hoy tenemos una razón más para crear un recuerdo juntos.',
    short: 'La plantilla neutral Umbra, para cualquier ocasión.',
    editorHint: 'Bienvenida Umbra neutra: emoji, texto y media con el ritmo de siempre. Ideal para lo que no encaja en una fiesta.'
  }
};

/** Las plantillas en el orden en que se ofrecen en el editor. */
export const EVENT_TEMPLATE_LIST = Object.values(EVENT_TEMPLATES);

/** Ids válidos: lo que se guarda en `type`. */
export const EVENT_TEMPLATE_IDS = Object.keys(EVENT_TEMPLATES);

/** La plantilla de un tipo guardado; uno antiguo o desconocido cae en personalizada. */
export function eventTemplateFor(type) {
  return EVENT_TEMPLATES[type] || EVENT_TEMPLATES.custom;
}

/** El metadato de la composición que monta la hoja para esa plantilla. */
export function compositionFor(type) {
  return EVENT_COMPOSITIONS[eventTemplateFor(type).composition] || EVENT_COMPOSITIONS.neutral;
}
