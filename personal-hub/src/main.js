/* ==========================================
   Personal Hub v2 — Main Entry Point
   Configura el router, componentes y pages
   ========================================== */

import './styles/main.css';
import { initTelemetry } from './services/telemetry.js';
import { Router } from './router.js';
import { AppShell } from './components/App.js';
import { initMotion, refreshMotion } from './utils/motion.js';
import { ROUTES } from './routes.js';
import { LoginPage } from './pages/Login.js';
import { HomePage } from './pages/Home.js';
import { ProfilePage } from './pages/Profile.js';
import { RazonesPage } from './pages/Razones.js';
import { MalDiaPage } from './pages/MalDia.js';

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
  '/login': (router) => LoginPage(router),
  '/': (router) => HomePage(router),
  '/perfil': (router) => ProfilePage(router),
  '/razones': (router) => RazonesPage(router),
  '/maldia': (router) => MalDiaPage(router),
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
  '/calendario': lazy(() => import('./pages/Calendario.js').then(m => m.CalendarioPage)),
  '/openwhen': lazy(() => import('./pages/OpenWhen.js').then(m => m.OpenWhenPage)),
  '/series': lazy(() => import('./pages/Series.js').then(m => m.SeriesPage)),
  '/thoseeyes': lazy(() => import('./pages/ThoseEyes.js').then(m => m.ThoseEyesPage)),
  '/justthewayyouare': lazy(() => import('./pages/JustTheWayYouAre.js').then(m => m.JustTheWayYouArePage)),
  '/ositos': lazy(() => import('./pages/OsitosWorld.js').then(m => m.OsitosWorldPage))
};

function init() {
  // Lo primero: capturar fallos de arranque, antes de montar nada.
  initTelemetry();

  // Create router
  const router = new Router({
    container: document.getElementById('app')
  });

  // Ninguna ruta se queda sin página ni ninguna página sin ruta: el registro
  // y este mapa tienen que hablar exactamente de las mismas.
  const sinPagina = Object.keys(PAGES).filter(p => !ROUTES.some(r => r.path === p));
  if (sinPagina.length) console.error('[routes] páginas sin ruta en el registro:', sinPagina.join(', '));

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
      skipMood: route.skipMood === true
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
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
