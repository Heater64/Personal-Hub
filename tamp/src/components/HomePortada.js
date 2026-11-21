/* ==========================================
   HomePortada — las fotos de «días juntos»
   ==========================================
   La tarjeta del contador del Inicio enseña hasta 5 fotos, cambiando cada
   5 s. Son las de la lista `portada` (couples.data, ver sql/031), distinta de
   la que usa Juntos a pantalla completa: aquí la franja es ancha y allí es
   vertical. La lista sí es de la pareja, así que lo que se añade o se quita en
   un móvil aparece en el otro; si la fila compartida todavía no existe
   (migración sin aplicar), la lista se queda en este móvil.

   El botón de la cámara abre la hoja de este sitio (PortadaFotos).
   ========================================== */

import { mediaUrl, prepareMedia } from '../services/media.service.js';
import { supabase } from '../services/supabase.js';
import { cargarFotos, migrarPortadaLocal } from '../services/fondos.service.js';
import { abrirPortadaFotos } from './PortadaFotos.js';

const CADA_MS = 5000;

export function initHomePortada(heroEl) {
  if (!heroEl) return () => {};

  // Dos capas: la nueva se enciende encima de la anterior, así el cambio de
  // foto se funde en vez de dar un salto seco.
  const capas = [0, 1].map(() => {
    const capa = document.createElement('div');
    capa.className = 'home-hero__bg';
    capa.setAttribute('aria-hidden', 'true');
    heroEl.prepend(capa);
    return capa;
  });

  let fotos = [];
  let indice = 0;
  let activa = 0;
  let montada = true;

  /**
   * Pinta la foto `i`. `animar: false` la cambia sin fundido. Sin fotos no se
   * pinta ninguna: la tarjeta se queda con el degradado de la app, no con una
   * imagen de serie.
   */
  function mostrar(i, { animar = true } = {}) {
    const foto = fotos[i];
    if (!foto) {
      capas.forEach(capa => {
        capa.classList.remove('is-on');
        capa.style.backgroundImage = '';
      });
      activa = 0;
      return;
    }
    const url = `url("${mediaUrl(foto)}")`;
    if (!animar) {
      capas[activa].style.backgroundImage = url;
      capas[activa].classList.add('is-on');
      return;
    }
    const siguiente = capas[1 - activa];
    siguiente.style.backgroundImage = url;
    siguiente.classList.add('is-on');
    capas[activa].classList.remove('is-on');
    activa = 1 - activa;
  }

  /**
   * Deja la lista nueva en pantalla sin perder la foto que se está viendo (si
   * sigue estando). Es lo que usan tanto la carga inicial como los cambios
   * hechos aquí o los que llegan del otro móvil.
   */
  function aplicar(lista) {
    const anterior = fotos[indice];
    fotos = lista;
    indice = anterior && fotos.includes(anterior) ? fotos.indexOf(anterior) : 0;
    mostrar(indice, { animar: false });
    // Las URLs de Storage se firman en diferido: al llegar la firma se repinta.
    void prepareMedia(fotos).then(() => {
      if (montada) mostrar(indice, { animar: false });
    });
  }

  async function recargar() {
    try {
      const res = await cargarFotos('portada');
      if (!montada) return;
      aplicar(res.fotos);
    } catch {
      /* sin red o sin pareja: se queda lo que ya estaba pintado */
    }
  }

  heroEl.querySelector('#homeHeroEdit')?.addEventListener('click', () => {
    abrirPortadaFotos({
      slot: 'portada',
      fotos,
      onCambio: ({ fotos: nuevas }) => aplicar(nuevas),
    });
  });

  // Cambios hechos en el otro móvil (tabla couples, ver sql/031). Si Realtime
  // no está disponible para esa tabla, el refresco al volver a la pestaña
  // sigue cubriendo el caso.
  let canal = null;
  try {
    canal = supabase
      .channel('ph-portada')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples' }, () => {
        void recargar();
      })
      .subscribe();
  } catch {
    canal = null;
  }

  const alVolver = () => {
    if (document.visibilityState === 'visible') void recargar();
  };
  document.addEventListener('visibilitychange', alVolver);

  const timer = setInterval(() => {
    if (!montada || document.visibilityState === 'hidden') return;
    if (fotos.length < 2) return;
    indice = (indice + 1) % fotos.length;
    mostrar(indice);
  }, CADA_MS);

  // La foto antigua (cuando la portada era local) pasa a la lista compartida
  // la primera vez; después se carga la lista de la pareja.
  void (async () => {
    await migrarPortadaLocal().catch(() => {});
    await recargar();
  })();

  return () => {
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
    capas.forEach(capa => capa.remove());
  };
}
