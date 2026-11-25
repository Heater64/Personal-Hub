/* ==========================================
   location/deviceCard.js — la tarjeta de cada móvil.

   Cerrada enseña solo lo esencial: foto, nombre, estado de la ubicación,
   UNA referencia temporal, batería y si está cargando. Al tocarla se abre
   la cuadrícula con lo demás (conexión, velocidad, precisión, carga), que es
   lo que cada móvil ha decidido compartir.

   Nada de repetir «Última lectura hace 4 h» en cada dato: si los números son
   históricos, se dice una vez, arriba del detalle.
   ========================================== */

import { icon } from '../ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { networkLabel, timeAgo, isStale } from '../../services/device.service.js';
import { batteryInfo, deviceState } from './state.js';

function cell(iconName, label, value) {
  if (!value) return '';
  return `
    <div class="devcell">
      <span class="devcell__ico">${icon(iconName, 15)}</span>
      <span class="devcell__txt">
        <span class="devcell__label">${escapeHtml(label)}</span>
        <b class="devcell__value">${escapeHtml(value)}</b>
      </span>
    </div>`;
}

function networkName(person) {
  if (!person.net) return '';
  return networkLabel({ ...person, mbps: undefined }) || '';
}

/**
 * @param {object|null} person
 * @param {{ name: string, role: 'me'|'them', open: boolean }} options
 */
export function deviceCardHTML(person, { name, role, open = false }) {
  const stale = !!person && isStale(person.at);
  const state = deviceState(person, { stale });
  const battery = person ? batteryInfo(person) : null;
  const initial = (person?.name || name || '').trim().charAt(0).toUpperCase();
  const updated = person ? timeAgo(person.at || person.sentAt) : '';
  const dataUpdated = person ? timeAgo(person.sentAt || person.at) : '';
  const newData = dataUpdated && dataUpdated !== updated;

  const details = [];
  if (person) {
    details.push(cell('wifi', 'Conexión', networkName(person)));
    details.push(cell('speed', 'Velocidad',
      Number.isFinite(person.speed) ? `${person.speed} km/h`
        : Number.isFinite(person.mbps) && person.mbps > 0 ? `${Math.round(person.mbps)} Mbps`
          : ''));
    details.push(cell('map', 'Precisión',
      Number.isFinite(person.accuracy) ? `±${Math.round(person.accuracy)} m` : ''));
    details.push(cell(person.charging ? 'bolt' : 'battery', 'Carga',
      Number.isFinite(person.battery) ? (person.charging ? 'Cargando ahora' : 'Sin cargar') : ''));
  }

  // Una sola frase con la referencia temporal: no se repite la antigüedad
  // en cada dato, solo se dice si el bloque es histórico o actual.
  const detailNote = !person
    ? 'Sin información de este móvil todavía.'
    : stale
      ? `Datos de la última conexión${dataUpdated ? `, ${dataUpdated}` : ''}.`
      : newData
        ? `Ubicación al día; batería y conexión ${dataUpdated}.`
        : 'Compartido por su móvil ahora mismo.';

  return `
    <article class="devcard${stale ? ' is-stale' : ''}${open ? ' is-open' : ''}" data-device="${role}">
      <button class="devcard__head" type="button" aria-expanded="${open ? 'true' : 'false'}">
        <span class="devcard__ava devcard__ava--${role}">
          ${person?.avatar
            ? `<img src="${escapeHtml(person.avatar)}" alt="">`
            : `<span aria-hidden="true">${escapeHtml(initial || '♥')}</span>`}
        </span>
        <span class="devcard__id">
          <span class="devcard__name">${escapeHtml(person?.name || name)}</span>
          <span class="devcard__meta">
            <i class="devcard__dot devcard__dot--${state.tone}" aria-hidden="true"></i>${escapeHtml(state.label)}${updated && person?.sharing !== false ? ` · ${escapeHtml(updated)}` : ''}
          </span>
        </span>
        ${battery ? `
          <span class="devcard__battery devcard__battery--${battery.tone}">
            ${icon(battery.charging ? 'bolt' : 'battery', 14)}${battery.level}%
          </span>` : ''}
        <span class="devcard__chev" aria-hidden="true">${icon('chev', 16)}</span>
      </button>
      <div class="devcard__details">
        <p class="devcard__note">${escapeHtml(detailNote)}</p>
        ${details.some(Boolean)
          ? `<div class="devcard__grid">${details.join('')}</div>`
          : '<div class="devcard__grid"><p class="devcard__empty">Este móvil no comparte batería ni conexión.</p></div>'}
      </div>
    </article>`;
}

/** Abre y cierra el detalle de una tarjeta, sin repintar el resto. */
export function wireDeviceCards(container) {
  const onToggle = event => {
    const head = event.target.closest('.devcard__head');
    if (!head) return;
    const card = head.closest('.devcard');
    const open = head.getAttribute('aria-expanded') !== 'true';
    head.setAttribute('aria-expanded', String(open));
    card?.classList.toggle('is-open', open);
  };
  container.addEventListener('click', onToggle);
  return () => container.removeEventListener('click', onToggle);
}
