/* ==========================================
   Personal Hub v2 — Main Entry Point
   Configura el router, componentes y pages
   ========================================== */

import './styles/main.css';
import { initTelemetry } from './services/telemetry.js';
import { Router } from './router.js';
import { AppShell } from './components/App.js';
import { initMotion, refreshMotion } from './utils/motion.js';
import { installMediaFallback } from './services/media.service.js';
import { watchDateFields } from './utils/datefield.js';
import { ROUTES } from './routes.js';
// Login sigue estático: es la primera pantalla con la sesión cerrada y no
// debe esperar un chunk. Todo lo demás entra por `lazy()`.
import { LoginPage } from './pages/Login.js';

// Tras un despliegue, una pestaña abierta con el bundle anterior pide chunks
// con hash que el servidor ya no tiene (404) y la ruta muere con «Failed to
// fetch dynamically imported module». Vite avisa por `vite:preloadError`:
// recargamos una sola vez para recoger el index y los chunks nuevos. Si el
// fallo se repite en menos de 30 s es real (red, chunk roto) y dejamos que el
// error suba para que la telemetría lo vea, en vez de recargar en bucle.
const PRELOAD_RETRY_KEY = 'ph.preload-retry';
window.addEventListener('vite:preloadError', event => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(PRELOAD_RETRY_KEY) || 0);
  } catch {
    /* sessionStorage bloqueado: recargamos igual, sin guard */
  }
  if (Date.now() - last < 30_000) return;
  event.preventDefault();
  try {
    sessionStorage.setItem(PRELOAD_RETRY_KEY, String(Date.now()));
  } catch {
    /* sin guard disponible */
  }
  window.location.reload();
});

// Lazy loader para páginas pesadas → code-splitting
// Uso: lazy(() => import('./pages/X.js').then(m => m.XPage))
// El router resuelve el Promise y muestra el skeleton mientras carga
const lazy = (loader) => async (router) => (await loader())(router);

// Página que pinta cada ruta. Todo lo demás que sabe una ruta (título,
// permiso de admin, navegación, a dónde vuelve el Atrás) vive en
// src/routes.js, la única lista de rutas de la aplicación: aquí solo se
// dice QUÉ componente se monta. Las pesadas se cargan al vuelo para no
// engordar el arranque.
const PAGES = {
  '/login': router => LoginPage(router),
  '/': lazy(() => import('./pages/Home.js').then(m => m.HomePage)),
  '/perfil': lazy(() => import('./pages/Profile.js').then(m => m.ProfilePage)),
  '/razones': lazy(() => import('./pages/Razones.js').then(m => m.RazonesPage)),
  '/maldia': lazy(() => import('./pages/Agenda.js').then(m => m.MalDiaPage)),
  '/agenda': lazy(() => import('./pages/Agenda.js').then(m => m.SharedPage)),
  '/sorpresas': lazy(() => import('./pages/Sorpresas.js').then(m => m.SorpresasPage)),
  '/menstruacion': lazy(() => import('./pages/Menstruacion.js').then(m => m.MenstruacionPage)),
  '/admin': lazy(() => import('./pages/Admin.js').then(m => m.AdminPage)),
  '/rincon': lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)),
  '/galeria': lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)),
  '/memes': lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)),
  '/audios': lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)),
  '/curiosidades': lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)),
  '/minecraft': lazy(() => import('./pages/Minecraft.js').then(m => m.MinecraftPage)),
  '/canciones': lazy(() => import('./pages/Canciones.js').then(m => m.CancionesPage)),
  '/sentimientos': lazy(() => import('./pages/Sentimientos.js').then(m => m.SentimientosPage)),
  '/juegos': lazy(() => import('./pages/Juegos.js').then(m => m.JuegosPage)),
  '/juegos/online/:gameId': lazy(() => import('./pages/OnlineGame.js').then(m => m.OnlineGamePage)),
  // Un solo m�dulo de calendario. Los enlaces antiguos con `gift` o
  // `view=recibidos` siguen abriendo la vista hist�rica dentro de este destino.
  // Un solo m?dulo de calendario. Los enlaces antiguos con `gift` o
  // `view=recibidos` siguen abriendo la vista hist?rica dentro de este destino.
  '/calendario': async router => {
    const query = router.currentRoute?.query || {};
    if (query.gift || query.view === 'recibidos') {
      return (await import('./pages/Calendario.js').then(m => m.CalendarioPage))(router);
    }
    return (await import('./pages/Agenda.js').then(m => m.SharedPage))(router);
  },
  '/openwhen': lazy(() => import('./pages/OpenWhen.js').then(m => m.OpenWhenPage)),
  '/series': lazy(() => import('./pages/Series.js').then(m => m.SeriesPage)),
  '/thoseeyes': lazy(() => import('./pages/ThoseEyes.js').then(m => m.ThoseEyesPage)),
  '/justthewayyouare': lazy(() =>
    import('./pages/JustTheWayYouAre.js').then(m => m.JustTheWayYouArePage)
  ),
  '/ositos': lazy(() => import('./pages/OsitosWorld.js').then(m => m.OsitosWorldPage)),
  '/juntos': lazy(() => import('./pages/Juntos.js').then(m => m.JuntosPage)),
  '/mapa': lazy(() => import('./pages/Mapa.js').then(m => m.MapaPage)),
};

function init() {
  // Lo primero: capturar fallos de arranque, antes de montar nada.
  initTelemetry();

  // Red de seguridad del multimedia: si una imagen/vídeo/audio no carga (URL
  // firmada caducada, objeto movido), se reintenta una vez con la firma nueva.
  // Con los buckets públicos no hace nada visible. Un solo listener global.
  installMediaFallback();

  // Create router
  const router = new Router({
    container: document.getElementById('app'),
  });

  // Ninguna ruta se queda sin página ni ninguna página sin ruta: el registro
  // y este mapa tienen que hablar exactamente de las mismas.
  const sinPagina = Object.keys(PAGES).filter(p => !ROUTES.some(r => r.path === p));
  if (sinPagina.length)
    console.error('[routes] páginas sin ruta en el registro:', sinPagina.join(', '));

  for (const route of ROUTES) {
    const load = PAGES[route.path];
    if (!load) {
      const aviso = `[routes] la ruta ${route.path} no tiene página registrada`;
      if (import.meta.env.DEV) throw new Error(aviso);
      console.error(aviso);
      continue;
    }
    router.addRoute(route.path, load, {
      title: route.title,
      protected: route.public !== true,
      adminOnly: route.adminOnly === true,
      skipMood: route.skipMood === true,
    });
  }

  // Movimiento: la primera pasada revela lo que ya está en pantalla y, tras
  // cada navegación, se repasa la página nueva (muchas pintan su contenido
  // de forma asíncrona, así que el DOM aún crece después del render).
  router.afterEach(() => refreshMotion());

  // Build the app shell (wraps navigation + auth guards)
  AppShell(router);

  // Se arranca DESPUÉS del shell para que exista `.content`, que es el árbol
  // que se observa. Si aún no hubiera contenido, el vigilante de
  // mutaciones lo recogería igualmente.
  initMotion();

  // Las fechas se leen día/mes/año en toda la web, pinte lo que pinte cada
  // pantalla (también las hojas y los diálogos que aparecen después).
  watchDateFields();
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
