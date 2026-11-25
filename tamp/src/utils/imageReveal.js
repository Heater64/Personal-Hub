/* ==========================================
   imageReveal.js — revelado de imágenes sin
   handlers inline.

   El despliegue sirve una Content-Security-Policy sin 'unsafe-inline', así
   que los atributos onload="…" / onerror="…" NO se ejecutan (el navegador
   los bloquea y los registra como violación de CSP). Las galerías arrancan
   sus <img> en opacity 0 y esperaban ese onload para pintarlas, de modo que
   en la app (y en cualquier visita con la CSP activa) las fotos se quedaban
   invisibles.

   Aquí se hace exactamente lo mismo pero desde JS: `load` y `error` no
   burbujean, pero sí atraviesan la fase de captura, así que un único par de
   listeners en document los recoge para toda la app. Además se revisan las
   imágenes que ya estaban resueltas antes de instalar los listeners (caché,
   data URIs) y las que se insertan ya completas, porque en esos casos el
   evento puede haberse perdido.

   Marcadores que aplica (los que esperan los CSS):
   · el padre del <img> recibe .is-loaded o .is-error
   · un <img data-img-ratio> ajusta el aspect-ratio de su .mc-item-media
   ========================================== */

let installed = false;

function markLoaded(img) {
  img.parentElement?.classList.add('is-loaded');

  // Los recuerdos de Minecraft respetan la proporción real de la foto.
  if (img.dataset.imgRatio !== undefined) {
    const box = img.closest('.mc-item-media');
    if (box && img.naturalWidth) {
      box.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    }
  }
}

function markFailed(img) {
  // Marca el hueco como fallido (así aparece el icono de fallback) y quita
  // la imagen rota, igual que hacía el onerror inline.
  img.parentElement?.classList.add('is-error');
  img.remove();
}

/** Imagen que ya terminó (bien o mal) antes de que la escucháramos. */
function revealIfSettled(img) {
  // Un <img> aún sin fuente se considera "completo": no es un fallo, puede
  // recibir el src después (carga diferida).
  if (!img.getAttribute('src') && !img.getAttribute('srcset')) return;
  if (!img.complete) return;
  if (img.naturalWidth > 0) markLoaded(img);
  else markFailed(img);
}

function sweep(root) {
  if (root instanceof HTMLImageElement) {
    revealIfSettled(root);
    return;
  }
  root?.querySelectorAll?.('img').forEach(revealIfSettled);
}

function onImageLoad(event) {
  if (event.target instanceof HTMLImageElement) markLoaded(event.target);
}

function onImageError(event) {
  if (event.target instanceof HTMLImageElement) markFailed(event.target);
}

export function installImageReveal() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('load', onImageLoad, true);
  document.addEventListener('error', onImageError, true);

  sweep(document);

  // Un <img> insertado con la imagen ya en caché puede no disparar `load`:
  // al aparecer en el DOM se revisa si ya está completa.
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) sweep(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

// Al importar el módulo queda instalado; las páginas solo necesitan
// `import '../utils/imageReveal.js'`.
installImageReveal();
