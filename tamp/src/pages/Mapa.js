import '../styles/mapa.css';
import { icon } from '../components/ui.js';
import { distanceMapBody } from '../components/DistanceMapSheet.js';
import { userStore } from '../stores/user.store.js';
import { startLocationSharing, stopLocationSharing } from '../services/location.service.js';

/** Pantalla completa para el widget de distancia. */
export function MapaPage(router) {
  const page = document.createElement('div');
  page.className = 'mapa-page';
  page.innerHTML = `
    <header class="mapa-page__top">
      <button class="mapa-page__back" type="button" aria-label="Volver">${icon('chev', 20)}</button>
      <h1 class="mapa-page__title">Dónde estáis</h1>
    </header>
    <div class="mapa-page__body"></div>
  `;

  const user = userStore.getUser();
  const map = distanceMapBody({ meName: user?.name, meAvatar: user?.avatar });
  page.querySelector('.mapa-page__body').append(map);
  startLocationSharing(
    { userId: user?.id, isAdmin: userStore.isAdmin, name: user?.name, avatar: user?.avatar },
    map.setLocationStatus
  );
  map.watch();

  page.querySelector('.mapa-page__back').addEventListener('click', () => router.navigate('/'));
  page.cleanup = () => {
    map.cleanup();
    stopLocationSharing();
  };

  return page;
}
