/* ==========================================
   MAPA — se abre al tocar el widget de distancia.

   Es el mismo mapa de la hoja «Dónde estáis» de la portada
   (DistanceMapSheet), pero a pantalla completa, con tu chincheta, la de la
   otra persona, la línea entre las dos y las tarjetas de batería/red.

   Como no pasamos por la portada, aquí hay que arrancar el compartir de
   ubicación a mano: sin eso no habría posición propia.
   ========================================== */

import '../styles/mapa.css';
import { icon } from '../components/ui.js';
import { distanceMapBody } from '../components/DistanceMapSheet.js';
import { userStore } from '../stores/user.store.js';
import {
  startLocationSharing,
  stopLocationSharing,
  fetchMyLocation,
  watchDistance,
  fetchProfile,
} from '../services/location.service.js';

export function MapaPage(router) {
  const page = document.createElement('div');
  page.className = 'mapa-page';

  page.innerHTML = `
    <header class="mapa-page__top">
      <button class="mapa-page__back" type="button" data-back aria-label="Volver">${icon('chev', 20)}</button>
      <h1 class="mapa-page__title">Dónde estáis</h1>
      <span class="mapa-page__spacer" aria-hidden="true"></span>
    </header>
    <div class="mapa-page__body" data-body></div>
  `;

  const body = page.querySelector('[data-body]');
  const user = userStore.getUser() || {};
  let vista = null;
  let perfilSolicitado = null;
  let identidad = null;
  let ultimoModelo = null;

  const limpiarMapa = () => {
    const nodo = body.querySelector('.distmap');
    nodo?._dispose?.();
  };

  const pintar = model => {
    if (vista) {
      vista._refresh(model);
      return;
    }
    vista = distanceMapBody({ ...model, meName: user.name });
    body.replaceChildren(vista);
  };

  startLocationSharing({
    userId: user.id,
    isAdmin: userStore.isAdmin,
    name: user.name,
    avatar: user.avatar,
  });

  // El mapa base se pinta antes de consultar Supabase/recibir el primer GPS.
  // Así una red lenta no deja la pantalla negra mientras llegan las posiciones.
  pintar({ me: fetchMyLocation(), partner: null, km: null });

  // Los cambios de la tabla compartida repintan las tarjetas y las chinchetas
  // en el mismo mapa: mantiene el zoom y el arrastre que eligió la persona.
  const parar = watchDistance(({ km, me: own, partner, partnerId }) => {
    let pedirPerfil = null;
    if (!partnerId) {
      perfilSolicitado = null;
      identidad = null;
    } else if (perfilSolicitado !== partnerId) {
      perfilSolicitado = partnerId;
      identidad = null;
      pedirPerfil = partnerId;
    }

    const mine = own || fetchMyLocation();
    const me = mine ? { ...user, ...mine } : null;
    const otro = partner
      ? {
          ...partner,
          name: partner.name || identidad?.name || '',
          avatar: partner.avatar || identidad?.avatar || '',
        }
      : null;

    const currentModel = { me, partner: otro, km };
    ultimoModelo = currentModel;
    pintar(currentModel);

    // El perfil solo añade nombre/avatar; no debe retrasar un marcador cuya
    // ubicación ya está disponible. Al resolver, enriquece siempre el modelo
    // más reciente para no restaurar coordenadas de una lectura anterior.
    if (pedirPerfil) {
      void fetchProfile(pedirPerfil).then(currentIdentity => {
        if (perfilSolicitado !== pedirPerfil) return;
        if (!currentIdentity) {
          perfilSolicitado = null;
          return;
        }
        identidad = currentIdentity;
        const latest = ultimoModelo;
        if (latest?.partner?.userId !== pedirPerfil) return;
        const enriched = {
          ...latest,
          partner: {
            ...latest.partner,
            name: latest.partner.name || currentIdentity.name || '',
            avatar: latest.partner.avatar || currentIdentity.avatar || '',
          },
        };
        ultimoModelo = enriched;
        pintar(enriched);
      }).catch(() => {
        if (perfilSolicitado === pedirPerfil) perfilSolicitado = null;
      });
    }
  });

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
  });

  page.cleanup = () => {
    parar?.();
    stopLocationSharing();
    limpiarMapa();
  };

  return page;
}
