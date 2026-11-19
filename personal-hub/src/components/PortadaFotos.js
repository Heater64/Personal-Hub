/* ==========================================
   PortadaFotos — hoja para elegir las fotos de un sitio
   ==========================================
   La usan la tarjeta «días juntos» del Inicio (botón de la cámara) y la
   pantalla Juntos (el engranaje). Cada una tiene SU lista (hasta 5 fotos),
   porque no tienen la misma forma: la tarjeta es una franja apaisada y Juntos
   es vertical. Por eso la hoja se abre con un `slot` que decide el título, el
   consejo de formato y la forma de las miniaturas.

   La lista de cada sitio sí se comparte entre las dos personas
   (`couples.data.portada` / `couples.data.juntos`, ver sql/031).

   El campo de archivo vive DENTRO de la hoja y la teja «Añadir» es un
   <label for>: el selector se abre por el gesto nativo del navegador, sin
   depender de un `click()` hecho por JS (que en móvil se bloquea a veces) ni
   de un control que se quede fuera del foco de la hoja.

   `onCambio({ fotos, compartidas })` se dispara tras cada cambio para que la
   pantalla que abrió la hoja repinte al momento, sin recargar nada.
   ========================================== */

import { icon, openSheet, toast } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import { isStorageUrl, mediaUrl, onMediaReady, prepareMedia } from '../services/media.service.js';
import { MAX_FOTOS, agregarFotos, cargarFotos, quitarFoto } from '../services/fondos.service.js';

/** Cómo se ve cada sitio: título, dónde sale y qué formato le va. */
const TEXTOS = {
  portada: {
    titulo: 'Fotos de la tarjeta',
    donde: 'Salen en la tarjeta del Inicio, en una franja ancha.',
    formato: 'Mejor apaisadas: una vertical se recorta por arriba y por abajo.',
    altas: false,
  },
  juntos: {
    titulo: 'Fotos de fondo',
    donde: 'Salen a pantalla completa en «días juntos».',
    formato: 'Mejor verticales: una apaisada deja fuera los lados.',
    altas: true,
  },
};

const INPUT_ID = 'portadaFotoInput';

/** Hoja viva: evita abrir dos si se pulsa dos veces el botón. */
let abierta = null;

export function abrirPortadaFotos({ slot = 'portada', fotos = [], compartida = true, onCambio } = {}) {
  if (abierta?.isConnected) return;

  const texto = TEXTOS[slot] || TEXTOS.portada;
  let lista = [...fotos];
  let esCompartida = compartida;
  let subiendo = false;
  let propia = false; // ya se añadió o quitó algo: no pisar con la recarga
  let cuerpo = null;
  // Las firmas llegan cuando llegan: en cuanto haya alguna nueva, se repinta
  // para cambiar los huecos por las miniaturas.
  let dejarDeEscuchar = () => {};

  /**
   * Miniatura. Si la foto está en el bucket privado y aún no hay URL firmada,
   * se pinta un hueco que late en vez de un <img> que daría error.
   */
  function miniatura(url, i) {
    const src = mediaUrl(url);
    const pendiente = isStorageUrl(url) && src === url;
    const dentro = pendiente
      ? '<span class="portada__espera"></span>'
      : `<img src="${escapeHtml(src)}" alt="Foto ${i + 1}">`;
    return `
      <div class="portada__foto">
        ${dentro}
        <button type="button" class="portada__quitar" data-quitar="${escapeHtml(url)}" aria-label="Quitar la foto ${i + 1}">${icon('x', 14)}</button>
      </div>`;
  }

  function pintar() {
    if (!cuerpo) return;
    const lleno = lista.length >= MAX_FOTOS;
    cuerpo.innerHTML = `
      <p class="portada__hint">${texto.donde} ${texto.formato} ${
        esCompartida
          ? 'Las veis las dos personas: lo que cambies aquí aparece en el otro móvil.'
          : 'Ahora mismo esta lista solo está en este móvil.'
      }</p>
      <div class="portada__grid">
        ${lista.map(miniatura).join('')}
        ${
          lleno
            ? ''
            : `<label class="portada__mas" for="${INPUT_ID}">${icon('plus', 20)}<span>${subiendo ? 'Subiendo…' : 'Añadir'}</span></label>`
        }
      </div>
      <p class="portada__cuenta">${lista.length} de ${MAX_FOTOS}</p>
      <input id="${INPUT_ID}" class="portada__input" type="file" accept="image/*" multiple hidden>
    `;
  }

  /** Firma las URLs y repinta una sola vez (no se llama desde `pintar`). */
  function firmarMiniaturas() {
    void prepareMedia(lista).then(() => {
      if (cuerpo?.isConnected) pintar();
    });
  }

  function aplicar(res) {
    lista = res.fotos;
    esCompartida = res.compartidas;
    propia = true;
    pintar();
    onCambio?.({ fotos: lista, compartidas: esCompartida });
    firmarMiniaturas();
  }

  async function subir(files) {
    if (!files.length || subiendo) return;
    const antes = lista.length;
    subiendo = true;
    pintar();
    toast(files.length > 1 ? `Subiendo ${files.length} fotos…` : 'Subiendo la foto…');
    try {
      const res = await agregarFotos(slot, files);
      aplicar(res);
      const nuevas = Math.max(1, res.fotos.length - antes);
      toast(
        res.compartidas
          ? nuevas > 1
            ? `${nuevas} fotos añadidas`
            : 'Foto añadida'
          : 'Añadida solo en este móvil'
      );
    } catch (error) {
      toast(error?.message || 'No se pudo añadir la foto');
    } finally {
      subiendo = false;
      pintar();
    }
  }

  async function alPulsar(event) {
    const quitar = event.target.closest('[data-quitar]');
    if (!quitar) return;
    quitar.disabled = true;
    try {
      aplicar(await quitarFoto(slot, quitar.dataset.quitar));
      toast('Foto quitada');
    } catch (error) {
      quitar.disabled = false;
      toast(error?.message || 'No se pudo quitar la foto');
    }
  }

  openSheet(
    texto.titulo,
    () => {
      cuerpo = document.createElement('div');
      cuerpo.className = texto.altas ? 'portada portada--altas' : 'portada';
      cuerpo.addEventListener('click', alPulsar);
      // Delegado: el <input> se recrea en cada repintado y el evento `change`
      // burbujea, así no hay que volver a engancharlo.
      cuerpo.addEventListener('change', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
        const files = [...(input.files || [])];
        input.value = '';
        void subir(files);
      });
      return cuerpo;
    },
    () => {
      abierta = null;
      cuerpo = null;
      dejarDeEscuchar();
    }
  );

  abierta = cuerpo;
  dejarDeEscuchar = onMediaReady(() => {
    if (cuerpo?.isConnected) pintar();
  });
  pintar();
  firmarMiniaturas();

  // La lista que llega puede ser la pintada con lo que había en memoria: se
  // vuelve a pedir para enseñar la de verdad (el otro móvil pudo cambiarla).
  void cargarFotos(slot)
    .then(res => {
      if (!cuerpo?.isConnected || propia) return;
      lista = res.fotos;
      esCompartida = res.compartidas;
      pintar();
      onCambio?.({ fotos: lista, compartidas: esCompartida });
      firmarMiniaturas();
    })
    .catch(() => {});
}
