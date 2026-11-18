/* Prepara los layouts de los widgets para que el editor de diseño de Android
 * Studio enseñe contenido realista: añade `tools:text` a cada TextView (y
 * `tools:src` donde va una foto). Es solo para la previsualización: `tools:`
 * se ignora al ejecutar, así que el widget de verdad no cambia. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2];
if (!DIR) {
  console.error('uso: node add-tools.mjs <carpeta layout>');
  process.exit(1);
}

const TEXT = {
  widget_days_count: '512',
  widget_days_unit: 'días',
  widget_days_label: 'DÍAS JUNTOS',
  widget_days_breakdown: '1 año y 4 meses',
  widget_days_fresh: 'ahora mismo',
  widget_days_hint: 'abre la app',
  widget_distance_value: '24,8 km',
  widget_distance_label: 'ESTÁIS A',
  widget_distance_caption: 'ahora mismo',
  widget_distance_hint: 'abre la app',
  widget_distance_device: 'su móvil · 84 % · Wi-Fi',
  widget_countdown_count: '23',
  widget_countdown_unit: 'días',
  widget_countdown_title: 'Nuestro aniversario',
  widget_countdown_date: '3 jul 2026',
  widget_countdown_kicker: 'FALTAN',
  widget_countdown_row1_title: 'Aniversario',
  widget_countdown_row1_date: '3 jul 2026',
  widget_countdown_row1_count: '23',
  widget_countdown_row1_unit: 'días',
  widget_countdown_row2_title: 'Cumpleaños de dada',
  widget_countdown_row2_date: '12 sep 2026',
  widget_countdown_row2_count: '94',
  widget_countdown_row2_unit: 'días',
  widget_countdown_row3_title: 'Nuestro primer mensaje',
  widget_countdown_row3_date: '14 feb 2027',
  widget_countdown_row3_count: '249',
  widget_countdown_row3_unit: 'días',
  widget_cycle_phase: 'Fase lútea',
  widget_cycle_day: 'día 21 de 28',
  widget_cycle_next: 'próxima regla en 6 d · 24 nov',
  widget_cycle_kicker: 'CICLO',
  widget_mood_emoji: '🥰',
  widget_mood_label: 'Muy feliz',
  widget_mood_meta: 'hoy',
  widget_mood_kicker: 'HOY',
  widget_watching_title: 'Severance',
  widget_watching_episode: 'Ep. 4 de 10',
  widget_watching_percent: '40 % visto',
  widget_watching_kicker: 'SEGUIR VIENDO',
  widget_gifts_count: '2',
  widget_gifts_label: 'sorpresas',
  widget_gifts_hint: 'en el calendario',
  widget_gifts_kicker: 'HOY',
  widget_gifts_emoji: '🎁',
  widget_gifts_unit: 'sorpresas',
};

const SRC = {
  widget_days_me: '@drawable/widget_days_face_empty',
  widget_days_partner: '@drawable/widget_days_face_empty',
  widget_distance_me: '@drawable/widget_face_empty',
  widget_distance_partner: '@drawable/widget_face_empty',
  widget_watching_poster: '@drawable/widget_poster_empty',
  widget_days_faces: null,
};

let touched = 0;

for (const file of readdirSync(DIR)) {
  if (!file.startsWith('widget_') || !file.endsWith('.xml')) continue;
  const path = join(DIR, file);
  let xml = readFileSync(path, 'utf8');
  const before = xml;

  if (!xml.includes('xmlns:tools=')) {
    xml = xml.replace(
      /xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/,
      'xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools"'
    );
  }

/** Añade un atributo al final de la etiqueta, antes de «/>» o «>». */
function addAttr(tag, attribute) {
  if (tag.includes(attribute.split('=')[0] + '=')) return tag;
  const end = tag.endsWith('/>') ? '/>' : '>';
  const body = tag.slice(0, tag.length - end.length).replace(/\s+$/, '');
  return `${body}\n        ${attribute}${end}`;
}

  xml = xml.replace(/<TextView\b[\s\S]*?\/?>/g, tag => {
    const id = /android:id="@\+id\/(\w+)"/.exec(tag)?.[1];
    const text = id ? TEXT[id] : null;
    return text ? addAttr(tag, `tools:text="${text}"`) : tag;
  });

  xml = xml.replace(/<ImageView\b[\s\S]*?\/?>/g, tag => {
    const id = /android:id="@\+id\/(\w+)"/.exec(tag)?.[1];
    const src = id ? SRC[id] : null;
    return src ? addAttr(tag, `tools:src="${src}"`) : tag;
  });

  if (xml !== before) {
    writeFileSync(path, xml);
    touched += 1;
  }
}

console.log(`layouts con previsualización: ${touched}`);
