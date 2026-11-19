/* ==========================================
   JUNTOS — la pantalla del aniversario.

   Se abre al tocar el widget de días en la pantalla de inicio (deep link
   `personalhub://juntos`). Es la versión a pantalla completa del contador:
   la fecha, el número de días como protagonista, el desglose y, abajo, lo
   que os espera.

   El fondo es su propia lista de fotos (verticales: aquí se ve a pantalla
   completa, no en la franja del Inicio): hasta cinco, compartidas por la pareja
   y turnándose cada 5 s. Sin fotos no hay imagen de serie: queda el degradado
   de la app. El engranaje abre la hoja para añadirlas o quitarlas.
   ========================================== */

import '../styles/juntos.css';
import {
  daysSinceAnniversary,
  loadSpecialDates,
  specialDates,
  upcomingSpecialDates,
} from '../utils/specialDates.js';
import { fetchPartnerLocation } from '../services/location.service.js';
import { togetherBreakdown } from '../services/widgets.service.js';
import { cargarFotos } from '../services/fondos.service.js';
import { mediaUrl, prepareMedia } from '../services/media.service.js';
import { supabase } from '../services/supabase.js';
import { icon } from '../components/ui.js';
import { abrirPortadaFotos } from '../components/PortadaFotos.js';
import { escapeHtml } from '../utils/escape.js';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// Las fotos se turnan cada 5 s, igual que en la tarjeta del Inicio.
const CADA_MS = 5000;

function fechaLarga(iso) {
  const [year, month, day] = String(iso || '')
    .split('-')
    .map(Number);
  if (!year || !month || !day) return '';
  return `${day} de ${MESES[month - 1]} de ${year}`;
}

/** Todo lo que se pinta, en un solo sitio. */
function medidas() {
  const total = Math.max(0, daysSinceAnniversary());
  const breakdown = togetherBreakdown(total);
  return {
    total,
    years: breakdown.years,
    months: breakdown.months,
    days: breakdown.days,
    totalMonths: Math.floor(total / 30.4375),
    weeks: Math.floor(total / 7),
  };
}

/** «hoy» / «mañana» / «13 días» para la cuenta atrás de Juntos. */
function textoDias(dias) {
  const n = Math.max(0, Number(dias) || 0);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `${n} días`;
}

/** Cifra del desglose: «1 año» / «4 meses» / «13 días», con singular si toca. */
function chip(valor, singular, plural) {
  return `<li><b>${valor}</b><span>${valor === 1 ? singular : plural}</span></li>`;
}

export function JuntosPage(router) {
  const page = document.createElement('div');
  page.className = 'juntos-page';

  // Fotos de fondo: la lista de este sitio (`juntos`), no la del Inicio.
  let fotos = [];
  let indice = 0;
  let activa = 0;
  let montada = true;

  const capasFoto = () => [...page.querySelectorAll('.juntos__photo')];

  /** Pinta la foto `i` en la capa libre y funde con la anterior. */
  function mostrarFoto(i, animar = true) {
    const capas = capasFoto();
    const url = fotos[i];
    if (capas.length < 2 || !url) return;

    const previa = capas[activa];
    if (!animar) {
      previa.style.backgroundImage = `url("${mediaUrl(url)}")`;
      previa.classList.add('is-on');
      return;
    }
    const siguiente = capas[1 - activa];
    siguiente.style.backgroundImage = `url("${mediaUrl(url)}")`;
    siguiente.classList.add('is-on');
    previa.classList.remove('is-on');
    activa = 1 - activa;
  }

  /** Reinicia las capas y pinta la foto actual (o ninguna: solo degradado). */
  function pintarFotos() {
    page.classList.toggle('is-photo', fotos.length > 0);
    capasFoto().forEach(capa => {
      capa.classList.remove('is-on');
      capa.style.backgroundImage = '';
    });
    activa = 0;
    if (!fotos.length) return;
    mostrarFoto(indice, false);
    // Con el bucket privado la URL pública falla: al llegar la firma, repinta.
    void prepareMedia(fotos).then(() => {
      if (montada) mostrarFoto(indice, false);
    });
  }

  /** Deja la lista nueva sin perder la foto que se está viendo. */
  function aplicarFotos(lista) {
    const anterior = fotos[indice];
    fotos = lista;
    indice = fotos.includes(anterior) ? fotos.indexOf(anterior) : 0;
    pintarFotos();
  }

  async function recargarFotos() {
    try {
      const res = await cargarFotos('juntos');
      if (!montada) return;
      aplicarFotos(res.fotos);
    } catch {
      /* sin red o sin pareja: se queda lo que ya estaba pintado */
    }
  }

  const render = () => {
    const m = medidas();
    const aniversario = fechaLarga(specialDates().anniversary);
    // Las tres próximas fechas (de hoy en adelante) para los dos.
    const proximas = upcomingSpecialDates(3);

    page.innerHTML = `
      <div class="juntos__bg" aria-hidden="true">
        <span class="juntos__photo"></span>
        <span class="juntos__photo"></span>
        <span class="juntos__shade"></span>
        <span class="juntos__glow juntos__glow--a"></span>
        <span class="juntos__glow juntos__glow--b"></span>
        <span class="juntos__glow juntos__glow--c"></span>
      </div>

      <header class="juntos__top">
        <button class="juntos__icon-btn" type="button" data-back aria-label="Volver">${icon('chev', 20)}</button>
        <p class="juntos__title">juntos</p>
        <button class="juntos__icon-btn" type="button" data-fotos aria-label="Cambiar las fotos">${icon('gear', 19)}</button>
      </header>

      <div class="juntos__body">
        <section class="juntos__hero" aria-label="Tiempo juntos">
          <p class="juntos__since">${aniversario ? `desde el ${escapeHtml(aniversario)}` : 'vuestro tiempo juntos'}</p>
          <p class="juntos__count">${m.total}</p>
          <p class="juntos__count-label">días juntos</p>
          <ul class="juntos__chips">
            ${m.years > 0 ? chip(m.years, 'año', 'años') : ''}
            ${chip(m.months, 'mes', 'meses')}
            ${chip(m.days, 'día', 'días')}
          </ul>
        </section>

        <p class="juntos__verse">
          en otras palabras, <b>${m.totalMonths}</b> ${m.totalMonths === 1 ? 'mes' : 'meses'} y
          <b>${m.weeks}</b> ${m.weeks === 1 ? 'semana' : 'semanas'}
        </p>

        <!-- Fase Pro: las fechas que os esperan y el estado de su móvil. Las
             dos leen datos que ya existen (fechas especiales y la última
             posición compartida), sin tablas nuevas. -->
        <section class="juntos__card" aria-label="Próximas fechas para los dos">
          <header class="juntos__card-head">
            <span>Para los dos</span>
            <span>lo que viene</span>
          </header>
          ${
            proximas.length
              ? `<ul class="juntos__rows">${proximas
                  .map(
                    item => `<li class="juntos__row">
                      <span class="juntos__row-label">${escapeHtml(item.title)}</span>
                      <span class="juntos__row-value">${textoDias(item.days)}</span>
                    </li>`
                  )
                  .join('')}</ul>`
              : '<p class="juntos__empty">Aún no hay fechas especiales configuradas.</p>'
          }
        </section>

        <section class="juntos__card" id="juntosDevice" aria-label="Estado de su móvil" hidden></section>
      </div>
    `;

    pintarFotos();
  };

  /** El engranaje abre las fotos de fondo de esta pantalla. */
  const abrirFotos = () => {
    abrirPortadaFotos({
      slot: 'juntos',
      fotos,
      onCambio: ({ fotos: nuevas }) => aplicarFotos(nuevas),
    });
  };

  // Estado del móvil de la otra persona: batería, carga y red tal como
  // llegaron con su última posición. Se cachea un minuto para no repetir la
  // consulta en cada repintado de la pantalla.
  let deviceCache = { at: 0, loc: null };

  async function fillPartnerDevice() {
    const host = page.querySelector('#juntosDevice');
    if (!host) return;
    if (Date.now() - deviceCache.at > 60000) {
      try {
        deviceCache = { at: Date.now(), loc: await fetchPartnerLocation() };
      } catch {
        deviceCache = { at: Date.now(), loc: null };
      }
    }
    const loc = deviceCache.loc;
    const battery = Number(loc?.battery);
    if (!loc || !Number.isFinite(battery) || !page.querySelector('#juntosDevice')) return;

    const at = loc.at ? new Date(loc.at) : null;
    const mins =
      at && !Number.isNaN(at.getTime())
        ? Math.max(0, Math.round((Date.now() - at.getTime()) / 60000))
        : null;
    const hace =
      mins == null ? '' : mins < 60 ? `hace ${mins} min` : `hace ${Math.round(mins / 60)} h`;

    host.hidden = false;
    host.innerHTML = `
      <header class="juntos__card-head">
        <span>Su móvil</span>
        <span>${escapeHtml(hace)}</span>
      </header>
      <ul class="juntos__rows">
        <li class="juntos__row">
          <span class="juntos__row-label">Batería</span>
          <span class="juntos__row-value">${Math.round(battery)}%${loc.charging ? ' · cargando' : ''}</span>
        </li>
        <li class="juntos__row">
          <span class="juntos__row-label">Conexión</span>
          <span class="juntos__row-value">${escapeHtml(loc.net || 'sin dato')}</span>
        </li>
      </ul>`;
  }

  render();
  void fillPartnerDevice();

  // Fotos de fondo de esta pantalla: la lista de la pareja (ver sql/031).
  void recargarFotos();

  // Cambios hechos en el otro móvil (tabla couples, ver sql/031), con el
  // refresco al volver a la pestaña como red de seguridad.
  let canal = null;
  try {
    canal = supabase
      .channel('ph-fotos-juntos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples' }, () => {
        void recargarFotos();
      })
      .subscribe();
  } catch {
    canal = null;
  }

  const alVolver = () => {
    if (document.visibilityState === 'visible') void recargarFotos();
  };
  document.addEventListener('visibilitychange', alVolver);

  const timer = setInterval(() => {
    if (!montada || document.visibilityState === 'hidden') return;
    if (fotos.length < 2) return;
    indice = (indice + 1) % fotos.length;
    mostrarFoto(indice);
  }, CADA_MS);

  // Las fechas reales llegan de Supabase: si el aniversario cambió en el panel,
  // esta pantalla tiene que decir lo mismo que la portada.
  loadSpecialDates()
    .then(() => render())
    .catch(() => {});

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
    if (event.target.closest('[data-fotos]')) abrirFotos();
  });

  page.cleanup = () => {
    montada = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', alVolver);
    if (canal) {
      try {
        supabase.removeChannel(canal);
      } catch {
        /* ya estaba cerrado */
      }
    }
  };

  return page;
}
