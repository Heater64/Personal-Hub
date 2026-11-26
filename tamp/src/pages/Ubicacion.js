/* ==========================================
   UBICACIÓN — «Dónde estáis», la pantalla completa.

   Sustituye a la hoja interminable por tres pestañas: Mapa, Lugares y
   Ajustes. El mapa es el protagonista (teselas oscuras, chinchetas con foto,
   controles flotantes), las tarjetas de los móviles se pliegan y toda la
   configuración vive en su propia pestaña.

   La lógica de datos es la misma de siempre: location.service comparte la
   posición y device.service lee el estado real de Android. Aquí solo se pinta.
   ========================================== */

import '../styles/ubicacion.css';
import { icon } from '../components/ui.js';
import { getUserPref } from '../utils/userStorage.js';
import { userStore } from '../stores/user.store.js';
import { isStale, timeAgo } from '../services/device.service.js';
import {
  startLocationSharing,
  stopLocationSharing,
  fetchMyLocation,
  fetchProfile,
  watchDistance,
  refreshBothLocations,
  publishSharingState,
  formatDistance,
  togetherInfo,
  TOGETHER_M,
} from '../services/location.service.js';
import { createLocationMap } from '../components/location/map.js';
import { deviceCardHTML, wireDeviceCards } from '../components/location/deviceCard.js';
import { createPlacesPanel } from '../components/location/places.js';
import { createLocationSettings } from '../components/location/settings.js';

const TABS = [
  { key: 'mapa', label: 'Mapa', icon: 'map' },
  { key: 'lugares', label: 'Lugares', icon: 'pin' },
  { key: 'ajustes', label: 'Ajustes', icon: 'gear' },
];

export function UbicacionPage(router) {
  const page = document.createElement('div');
  page.className = 'loc';
  const user = userStore.getUser() || {};

  page.innerHTML = `
    <header class="loc__head">
      <button class="loc__back" type="button" data-back aria-label="Volver a Inicio">${icon('back', 20)}</button>
      <div class="loc__titles">
        <h1 class="loc__title">Dónde estáis</h1>
        <p class="loc__status" data-status role="status" aria-live="polite">Actualizando…</p>
      </div>
      <button class="loc__refresh" type="button" data-refresh aria-label="Actualizar mi ubicación" title="Actualizar ahora">${icon('compass', 19)}</button>
    </header>

    <nav class="loc__tabs" role="tablist" aria-label="Secciones de ubicación">
      ${TABS.map((tab, index) => `
        <button type="button" role="tab" class="loc__tab${index === 0 ? ' is-active' : ''}" data-tab="${tab.key}"
          aria-selected="${index === 0}" id="loctab-${tab.key}" aria-controls="locpanel-${tab.key}">
          ${icon(tab.icon, 18)}<span>${tab.label}</span>
        </button>`).join('')}
    </nav>

    <div class="loc__body">
      <section class="loc__panel" data-panel="mapa" role="tabpanel" id="locpanel-mapa" aria-labelledby="loctab-mapa">
        <div class="loc__map" data-map></div>
        <div class="loc__devices" data-devices aria-label="Los móviles"></div>
        <p class="loc__foot">${icon('info', 13)}Cada móvil decide qué comparte. Una ubicación desactualizada no significa que se haya perdido la conexión.</p>
      </section>

      <section class="loc__panel" data-panel="lugares" role="tabpanel" id="locpanel-lugares" aria-labelledby="loctab-lugares" hidden></section>
      <section class="loc__panel" data-panel="ajustes" role="tabpanel" id="locpanel-ajustes" aria-labelledby="loctab-ajustes" hidden></section>
    </div>
  `;

  const statusEl = page.querySelector('[data-status]');
  const refreshButton = page.querySelector('[data-refresh]');
  const devicesBox = page.querySelector('[data-devices]');
  const mapHost = page.querySelector('[data-map]');

  /* ---------- Mapa + resumen de distancia ---------- */

  const summary = document.createElement('div');
  summary.className = 'locsum';
  summary.innerHTML = `
    <p class="locsum__value" data-distance>—</p>
    <p class="locsum__label" data-distance-label>de distancia</p>
    <p class="locsum__note" data-distance-note hidden></p>`;

  const mapView = createLocationMap();
  mapView.el.append(summary);
  mapHost.append(mapView.el);

  const distanceValue = summary.querySelector('[data-distance]');
  const distanceLabel = summary.querySelector('[data-distance-label]');
  const distanceNote = summary.querySelector('[data-distance-note]');

  const showNames = getUserPref('mapPlaceNames', 'true') !== 'false';
  void mapView.render({ showNames });

  /* ---------- Datos ---------- */

  // Compartir arranca ANTES de pedir los lugares: sin la sesión de ubicación
  // activa, `fetchSharedPlaces` no sabe de qué pareja leer y el panel (y el
  // mapa) se quedarían vacíos hasta cambiar de pestaña.
  startLocationSharing(
    { userId: user.id, isAdmin: userStore.isAdmin, name: user.name, avatar: user.avatar },
  );

  /* ---------- Lugares y ajustes ---------- */

  const placesPanel = createPlacesPanel({
    onPlacesChange: places => { void mapView.render({ places }); },
  });
  page.querySelector('[data-panel="lugares"]').append(placesPanel.el);

  let sharing = getUserPref('shareLocation', 'true') !== 'false';
  const settingsPanel = createLocationSettings({
    onSharingChange: next => {
      sharing = next;
      if (!sharing) {
        void publishSharingState(false);
        updateStatusText();
      } else {
        void publishSharingState(true).then(() => refreshBothLocations(undefined, { forcePartner: true }));
      }
      render();
    },
  });
  page.querySelector('[data-panel="ajustes"]').append(settingsPanel.el);

  /* ---------- Estado ---------- */

  let currentTab = 'mapa';
  let model = { me: null, partner: null, km: null };
  let loaded = false;
  let perfilSolicitado = null;
  let identidad = null;
  let ultimoModelo = null;

  const updateStatusText = () => {
    const partner = model.partner;
    if (!loaded) { statusEl.textContent = 'Actualizando…'; return; }
    if (!partner) { statusEl.textContent = sharing ? 'Esperando su ubicación' : 'No compartes tu ubicación'; return; }
    if (partner.sharing === false) { statusEl.textContent = 'No comparte su ubicación'; return; }
    const stale = isStale(partner.at);
    statusEl.textContent = stale
      ? `Última posición ${timeAgo(partner.at) || 'desconocida'}`
      : 'Al día';
  };

  const renderSummary = () => {
    const partner = model.partner;
    const mine = sharing ? model.me : null;
    const near = togetherInfo(mine, partner);
    const stale = !!partner && isStale(partner.at);

    if (partner?.sharing === false) {
      distanceValue.textContent = '—';
      distanceLabel.textContent = 'No comparte su ubicación';
      distanceNote.hidden = true;
      return;
    }
    if (!partner) {
      distanceValue.textContent = '—';
      distanceLabel.textContent = loaded ? 'Esperando su ubicación' : 'Calculando…';
      distanceNote.hidden = true;
      return;
    }
    if (near?.together) {
      distanceValue.textContent = 'Juntos';
      distanceValue.classList.add('is-together');
      distanceLabel.textContent = `a menos de ${TOGETHER_M} m`;
    } else {
      distanceValue.classList.remove('is-together');
      distanceValue.textContent = Number.isFinite(model.km) ? formatDistance(model.km) : '—';
      distanceLabel.textContent = 'de distancia';
    }
    distanceNote.hidden = !stale;
    distanceNote.textContent = stale ? `Última distancia registrada · ${timeAgo(partner.at)}` : '';
  };

  const renderDevices = () => {
    const openCards = new Set(
      [...devicesBox.querySelectorAll('.devcard.is-open')].map(card => card.dataset.device)
    );
    if (!loaded) {
      devicesBox.innerHTML = `
        <div class="devcard devcard--skeleton" aria-hidden="true"><span></span></div>
        <div class="devcard devcard--skeleton" aria-hidden="true"><span></span></div>`;
      return;
    }
    const mine = sharing
      ? model.me
      : model.me
        ? { ...model.me, sharing: false }
        : { sharing: false, name: user.name || 'Tú', avatar: user.avatar || '' };
    devicesBox.innerHTML = [
      deviceCardHTML(mine, { name: user.name || 'Tú', role: 'me', open: openCards.has('me') }),
      deviceCardHTML(model.partner, { name: 'Tu pareja', role: 'them', open: openCards.has('them') }),
    ].join('');
  };

  const render = () => {
    renderSummary();
    renderDevices();
    updateStatusText();
    settingsPanel.setMe(model.me);
    void mapView.render({
      me: sharing ? model.me : model.me ? { ...model.me, sharing: false } : null,
      partner: model.partner,
    });
  };

  const pintar = next => {
    model = { ...model, ...next };
    loaded = true;
    render();
  };

  /* ---------- Pestañas ---------- */

  const setTab = key => {
    currentTab = key;
    for (const button of page.querySelectorAll('[data-tab]')) {
      const on = button.dataset.tab === key;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-selected', String(on));
    }
    for (const panel of page.querySelectorAll('[data-panel]')) {
      panel.hidden = panel.dataset.panel !== key;
    }
    if (key === 'mapa') {
      mapView.invalidate();
      void mapView.render({});
    } else if (key === 'lugares') {
      placesPanel.refresh();
    } else if (key === 'ajustes') {
      settingsPanel.refresh();
    }
  };

  page.querySelector('.loc__tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    if (tab.dataset.tab === currentTab) {
      page.querySelector('.loc__body')?.scrollTo?.({ top: 0, behavior: 'smooth' });
      return;
    }
    setTab(tab.dataset.tab);
  });

  /* ---------- Acciones ---------- */

  page.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) router.navigate('/');
  });

  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.classList.add('is-busy');
    statusEl.textContent = 'Leyendo tu ubicación…';
    try {
      const result = await refreshBothLocations(undefined, { forcePartner: true });
      if (result.requested) {
        statusEl.textContent = result.ownUpdated
          ? 'Pedido a su móvil. Tu posición ya está actualizada.'
          : 'Pedido a su móvil. Revisa tu permiso de ubicación.';
      } else if (result.ok) {
        statusEl.textContent = 'Tu ubicación está actualizada.';
      } else if (result.reason === 'denied') {
        statusEl.textContent = 'Activa el permiso de ubicación para compartir.';
      } else if (result.requestError) {
        statusEl.textContent = 'Tu posición se actualizó, pero no se pudo pedir la suya.';
      } else {
        statusEl.textContent = 'No se pudo actualizar. Comprueba la conexión.';
      }
      if (result.location) pintar({ me: { ...(model.me || {}), ...result.location } });
    } finally {
      refreshButton.disabled = false;
      refreshButton.classList.remove('is-busy');
      setTimeout(updateStatusText, 4000);
    }
  });

  /* ---------- Datos ---------- */

  const offCards = wireDeviceCards(devicesBox);

  if (!sharing) void publishSharingState(false);

  // El mapa base se pinta antes de que llegue nada: una red lenta no deja la
  // pantalla en negro mientras se resuelven las posiciones.
  pintar({ me: fetchMyLocation(), partner: null, km: null });

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

    // El perfil solo añade nombre y foto: nunca retrasa un marcador que ya
    // tiene posición, y al llegar enriquece el modelo más reciente.
    if (pedirPerfil) {
      void fetchProfile(pedirPerfil).then(currentIdentity => {
        if (perfilSolicitado !== pedirPerfil) return;
        if (!currentIdentity) { perfilSolicitado = null; return; }
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

  // Al entrar directamente en «Dónde estáis», pide una posición fresca a los
  // dos móviles. La tarjeta de Inicio ya hace esta petición al abrirse.
  void refreshBothLocations();

  page.cleanup = () => {
    parar?.();
    stopLocationSharing();
    offCards?.();
    placesPanel.dispose();
    settingsPanel.dispose();
    mapView.dispose();
  };

  return page;
}
