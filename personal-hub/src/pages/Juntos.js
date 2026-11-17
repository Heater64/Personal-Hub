/* ==========================================
   JUNTOS — la pantalla del aniversario.

   Se abre al tocar el widget de días en la pantalla de inicio (deep link
   `personalhub://juntos`). Es la versión a pantalla completa del contador:
   fecha, la píldora de cristal con años/meses/días y, abajo, el mismo tiempo
   dicho de otra forma.

   Arriba a la derecha hay un engranaje: elegir fondo (cinco ambientes con
   imagen propia), poner una foto del móvil como fondo, y la fecha del
   aniversario con acceso al panel.
   ========================================== */

import { daysSinceAnniversary, loadSpecialDates, specialDates } from '../utils/specialDates.js';
import { togetherBreakdown } from '../services/widgets.service.js';
import { subirFondoJuntos, borrarFondoJuntos } from '../services/fondos.service.js';
import { icon, openSheet, closeSheets } from '../components/ui.js';
import { escapeHtml } from '../utils/escape.js';
import { userStore } from '../stores/user.store.js';
import { getUserPref, setUserPref, removeUserPref } from '../utils/userStorage.js';

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

/**
 * Ambientes del fondo.
 *
 * Cada uno busca su imagen en `/fondos/<id>.webp|jpg|jpeg|png` (carpeta
 * `personal-hub/public/fondos`). Si no existe, queda el degradado de focos
 * de `base`/`a`/`b`/`c`: nunca se rompe, solo se ve más soso.
 */
const FONDOS = [
  { id: 'plaza', label: 'Plaza', base: '#0b0710', a: '#f0b23c', b: '#7b4bb3', c: '#a8462f' },
  { id: 'luna', label: 'Luna', base: '#06081a', a: '#8ea8ff', b: '#3a4fd0', c: '#1b2560' },
  { id: 'bosque', label: 'Bosque', base: '#050d0b', a: '#4fbf8b', b: '#1f6b5a', c: '#c8a24a' },
  { id: 'corazon', label: 'Corazón', base: '#12040c', a: '#ff8fb1', b: '#c0306a', c: '#5a1140' },
  { id: 'rosa', label: 'Rosa', base: '#0d0a12', a: '#d4789b', b: '#6a2f7d', c: '#e0a3b7' },
];

const PREF_FONDO = 'juntosTheme';
// Foto propia (URL de Supabase). Manda sobre el ambiente elegido.
const PREF_FOTO = 'juntosFoto';

const EXT_FOTO = ['webp', 'jpg', 'jpeg', 'png'];

// Versión de las imágenes. El service worker se queda con la primera copia
// que ve: al cambiar una foto de `public/fondos`, sube este número para que
// las instaladas dejen de enseñar la anterior.
const V_FONDOS = 1;

/** id → url de la imagen, o null si ese fondo no tiene foto. */
const fotos = new Map();

function existe(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Busca la foto de cada fondo una sola vez por sesión. */
async function resolverFotos() {
  await Promise.all(
    FONDOS.map(async fondo => {
      if (fotos.has(fondo.id)) return;
      for (const ext of EXT_FOTO) {
        const url = `/fondos/${fondo.id}.${ext}?v=${V_FONDOS}`;
        if (await existe(url)) {
          fotos.set(fondo.id, url);
          return;
        }
      }
      fotos.set(fondo.id, null);
    })
  );
}

function fotoDe(fondo) {
  return fotos.get(fondo.id) || null;
}

/** La foto que se ve: la propia si la hay, si no la del ambiente. */
function fotoVisible(fondo) {
  return getUserPref(PREF_FOTO) || fotoDe(fondo);
}

function fondoActual() {
  const id = getUserPref(PREF_FONDO, 'plaza');
  return FONDOS.find(f => f.id === id) || FONDOS[0];
}

function estiloFondo(fondo) {
  const foto = fotoVisible(fondo);
  return [
    `--j-base:${fondo.base}`,
    `--j-a:${fondo.a}`,
    `--j-b:${fondo.b}`,
    `--j-c:${fondo.c}`,
    `--j-photo:${foto ? `url("${foto}")` : 'none'}`,
  ].join(';');
}

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

/** «1 año» / «4 meses» / «13 días», con singular si toca. */
function unidad(valor, singular, plural) {
  return `<b>${valor}</b><span>${valor === 1 ? singular : plural}</span>`;
}

export function JuntosPage(router) {
  const page = document.createElement('div');
  page.className = 'juntos-page';

  /** Pinta el fondo que toque (foto propia > imagen del ambiente > degradado). */
  const pintarFondo = () => {
    const fondo = fondoActual();
    page.style.cssText = estiloFondo(fondo);
    page.classList.toggle('is-photo', Boolean(fotoVisible(fondo)));
    // Foto del móvil: se ve tal cual, sin luces ni velo encima.
    page.classList.toggle('is-foto-propia', Boolean(getUserPref(PREF_FOTO)));
  };

  const render = () => {
    const m = medidas();
    const aniversario = fechaLarga(specialDates().anniversary);

    pintarFondo();

    page.innerHTML = `
      <div class="juntos__bg" aria-hidden="true">
        <span class="juntos__photo"></span>
        <span class="juntos__shade"></span>
        <span class="juntos__glow juntos__glow--a"></span>
        <span class="juntos__glow juntos__glow--b"></span>
        <span class="juntos__glow juntos__glow--c"></span>
      </div>

      <header class="juntos__top">
        <button class="juntos__back" type="button" data-back aria-label="Volver">${icon('chev', 20)}</button>
        <p class="juntos__date">${escapeHtml(aniversario)}</p>
        <button class="juntos__gear" type="button" data-settings aria-label="Ajustes">${icon('gear', 19)}</button>
      </header>

      <section class="juntos__pill" aria-label="Tiempo juntos">
        <p class="juntos__pill-label">han estado juntos por</p>
        <p class="juntos__pill-value">
          ${m.years > 0 ? unidad(m.years, 'año', 'años') : ''}
          ${unidad(m.months, 'mes', 'meses')}
          ${unidad(m.days, 'día', 'días')}
        </p>
      </section>

      <section class="juntos__verse" aria-label="En otras palabras">
        <p class="juntos__verse-label">en otras palabras</p>
        <p class="juntos__verse-numbers">
          <span>${unidad(m.totalMonths, 'mes', 'meses')}</span>
          <span class="juntos__dot" aria-hidden="true">·</span>
          <span>${unidad(m.weeks, 'semana', 'semanas')}</span>
          <span class="juntos__dot" aria-hidden="true">·</span>
          <span>${unidad(m.total, 'día', 'días')}</span>
        </p>
      </section>
    `;
  };

  /** Engranaje: fondos, foto propia y fecha del aniversario. */
  const abrirAjustes = () => {
    openSheet('Ajustes', () => {
      const wrap = document.createElement('div');
      wrap.className = 'jsettings';

      const activo = fondoActual().id;
      wrap.innerHTML = `
        <p class="jsettings__group">cambiar fondo</p>
        <div class="jsettings__grid" role="list">
          ${FONDOS.map(
            f => `
            <button type="button" class="jthumb${f.id === activo ? ' is-on' : ''}" role="listitem"
              data-fondo="${f.id}" style="${estiloFondo(f)}" aria-pressed="${f.id === activo}">
              ${fotoDe(f) ? '' : '<span class="jthumb__dot jthumb__dot--a"></span>'}
              ${fotoDe(f) ? '' : '<span class="jthumb__dot jthumb__dot--b"></span>'}
              <span class="jthumb__name">${f.label}</span>
            </button>`
          ).join('')}
        </div>

        <p class="jsettings__group">elige entre fotos</p>
        <div class="jsettings__row">
          <span class="jsettings__row-body">
            <b data-foto-titulo>Una foto de tu móvil</b>
            <span data-foto-sub>Se usa como fondo de esta pantalla</span>
          </span>
          <button type="button" class="jsettings__go" data-foto-pick>Elegir</button>
        </div>
        <button type="button" class="jsettings__ghost" data-foto-clear hidden>Quitar mi foto</button>
        <input type="file" accept="image/*" data-foto-input hidden>
        <p class="jsettings__hint" data-foto-hint hidden></p>

        <p class="jsettings__group">aniversario</p>
        <div class="jsettings__row">
          <span class="jsettings__row-body">
            <b>${escapeHtml(fechaLarga(specialDates().anniversary) || 'Sin fecha')}</b>
            <span>${userStore.isAdmin ? 'Cámbiala en el panel' : 'Solo el admin puede cambiarla'}</span>
          </span>
          ${
            userStore.isAdmin
              ? '<button type="button" class="jsettings__go" data-go-admin>Ir al panel</button>'
              : ''
          }
        </div>
      `;

      const botones = [...wrap.querySelectorAll('[data-fondo]')];
      const tituloFoto = wrap.querySelector('[data-foto-titulo]');
      const subFoto = wrap.querySelector('[data-foto-sub]');
      const btnElegir = wrap.querySelector('[data-foto-pick]');
      const btnQuitar = wrap.querySelector('[data-foto-clear]');
      const input = wrap.querySelector('[data-foto-input]');
      const hint = wrap.querySelector('[data-foto-hint]');

      /** Deja la hoja y la pantalla de acuerdo con lo guardado. */
      const sincronizar = () => {
        const elegido = fondoActual();
        const propia = Boolean(getUserPref(PREF_FOTO));

        botones.forEach(b => {
          const on = b.dataset.fondo === elegido.id && !propia;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', String(on));
        });

        tituloFoto.textContent = propia ? 'Foto tuya' : 'Una foto de tu móvil';
        subFoto.textContent = propia
          ? 'Es tu fondo ahora mismo'
          : 'Se usa como fondo de esta pantalla';
        btnElegir.textContent = propia ? 'Cambiar' : 'Elegir';
        btnQuitar.hidden = !propia;

        pintarFondo();
      };

      const aviso = texto => {
        hint.hidden = !texto;
        hint.textContent = texto || '';
      };

      // Ambiente: quita la foto propia, para que se vea lo que acabas de elegir.
      botones.forEach(b => {
        b.addEventListener('click', () => {
          const fondo = FONDOS.find(f => f.id === b.dataset.fondo) || FONDOS[0];
          setUserPref(PREF_FONDO, fondo.id);
          if (getUserPref(PREF_FOTO)) {
            removeUserPref(PREF_FOTO);
            borrarFondoJuntos().catch(() => {});
          }
          aviso('');
          sincronizar();
        });
      });

      // Foto del móvil (o del ordenador): input file, que el WebView del APK
      // abre con la galería del sistema.
      btnElegir.addEventListener('click', () => input.click());

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        btnElegir.disabled = true;
        btnElegir.textContent = 'Subiendo…';
        aviso('Preparando y subiendo tu foto…');

        try {
          const url = await subirFondoJuntos(file);
          setUserPref(PREF_FOTO, url);
          aviso('Listo: tu foto ya es el fondo.');
          pintarFondo();
        } catch (err) {
          aviso(err?.message || 'No se pudo subir la foto.');
        } finally {
          btnElegir.disabled = false;
          sincronizar();
        }
      });

      btnQuitar.addEventListener('click', async () => {
        removeUserPref(PREF_FOTO);
        sincronizar();
        aviso('Fondo quitado.');
        await borrarFondoJuntos().catch(() => {});
      });

      wrap.querySelector('[data-go-admin]')?.addEventListener('click', () => {
        closeSheets();
        router.navigate('/admin');
      });

      sincronizar();
      return wrap;
    });
  };

  render();

  // Cuando aparecen las imágenes de `public/fondos`, se repinta con ellas.
  resolverFotos().then(() => render());

  // Las fechas reales llegan de Supabase: si el aniversario cambió en el panel,
  // esta pantalla tiene que decir lo mismo que la portada.
  loadSpecialDates()
    .then(() => render())
    .catch(() => {});

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
    if (event.target.closest('[data-settings]')) abrirAjustes();
  });

  page.cleanup = () => {};
  return page;
}
