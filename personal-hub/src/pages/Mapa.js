/* ==========================================
   MAPA — se abre al tocar el widget de distancia.

   Es el mismo mapa de la hoja «Dónde estáis» de la portada
   (DistanceMapSheet), pero a pantalla completa, con tu chincheta, la de la
   otra persona, la línea entre las dos y las tarjetas de batería/red.

   Como no pasamos por la portada, aquí hay que arrancar el compartir de
   ubicación a mano: sin eso no habría posición propia.
   ========================================== */

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
    <div class="mapa-page__body" data-body>
      <p class="mapa-page__loading">Buscando las dos posiciones…</p>
    </div>
  `;

  const body = page.querySelector('[data-body]');
  const user = userStore.getUser() || {};
  let pintados = 0;
  let identidad = null;

  const limpiarMapa = () => body.querySelector('.distmap')?._map?.remove();

  const pintar = ({ me, partner, km }) => {
    limpiarMapa();
    body.innerHTML = '';
    body.append(distanceMapBody({ me, partner, km, meName: user.name }));
  };

  startLocationSharing({
    userId: user.id,
    isAdmin: userStore.isAdmin,
    name: user.name,
    avatar: user.avatar,
  });

  // Se repinta solo cuando hay más chinchetas que antes: tu posición y la suya
  // pueden llegar en momentos distintos y no conviene recrear el mapa en cada
  // latido.
  const parar = watchDistance(async ({ km, partner, partnerId }) => {
    if (!identidad && partnerId) {
      identidad = await fetchProfile(partnerId).catch(() => null);
    }

    const mine = fetchMyLocation();
    const me = mine ? { ...user, ...mine } : null;
    const otro = partner
      ? {
          ...partner,
          name: partner.name || identidad?.name || '',
          avatar: partner.avatar || identidad?.avatar || '',
        }
      : null;

    const puntos = (me ? 1 : 0) + (otro ? 1 : 0);
    if (puntos <= pintados) return;
    pintados = puntos;
    pintar({ me, partner: otro, km });
  });

  // Si en unos segundos no hay nada, al menos se explica por qué el mapa está
  // vacío en vez de dejar el «Buscando…» para siempre.
  const espera = setTimeout(() => {
    if (!pintados) pintar({ me: null, partner: null, km: null });
  }, 6000);

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
  });

  page.cleanup = () => {
    clearTimeout(espera);
    parar?.();
    stopLocationSharing();
    limpiarMapa();
  };

  return page;
}
