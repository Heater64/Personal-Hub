/* ==========================================
   Personal Hub v2 — Main Entry Point
   Configura el router, componentes y pages
   ========================================== */

import './styles/main.css';
import { Router } from './router.js';
import { userStore } from './stores/user.store.js';
import { AppShell } from './components/App.js';
import { LoginPage } from './pages/Login.js';
import { HomePage } from './pages/Home.js';
import { ProfilePage } from './pages/Profile.js';
import { AdminPage } from './pages/Admin.js';
import { RazonesPage } from './pages/Razones.js';
import { MalDiaPage } from './pages/MalDia.js';
import { OpenWhenPage } from './pages/OpenWhen.js';

// Lazy loader para páginas pesadas → code-splitting
// Uso: lazy(() => import('./pages/X.js').then(m => m.XPage))
// El router resuelve el Promise y muestra el skeleton mientras carga
const lazy = (loader) => async (router) => (await loader())(router);

function init() {
  // Create router
  const router = new Router({
    container: document.getElementById('app')
  });

  // Define routes
  router.addRoute('/login', () => LoginPage(router), {
    title: 'Iniciar sesión · Personal Hub',
    protected: false,
    skipMood: true
  });

  router.addRoute('/', () => HomePage(router), {
    title: 'Inicio · Personal Hub',
    protected: true
  });

  router.addRoute('/perfil', () => ProfilePage(router), {
    title: 'Perfil · Personal Hub',
    protected: true,
    skipMood: true
  });

  router.addRoute('/admin', () => AdminPage(router), {
    title: 'Admin · Personal Hub',
    protected: true,
    adminOnly: true,
    skipMood: true
  });

  router.addRoute('/rincon', lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)), {
    title: 'Rincón · Personal Hub',
    protected: true
  });

  // Secciones independientes del Rincón (cada una con su propia ruta)
  router.addRoute('/galeria', lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)), {
    title: 'Galería · Personal Hub',
    protected: true
  });

  router.addRoute('/memes', lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)), {
    title: 'Memes · Personal Hub',
    protected: true
  });

  router.addRoute('/audios', lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)), {
    title: 'Audios · Personal Hub',
    protected: true
  });

  router.addRoute('/curiosidades', lazy(() => import('./pages/Rincon.js').then(m => m.RinconPage)), {
    title: 'Curiosidades · Personal Hub',
    protected: true
  });

  // Register Canciones page
  router.addRoute('/canciones', lazy(() => import('./pages/Canciones.js').then(m => m.CancionesPage)), {
    title: 'Canciones · Personal Hub',
    protected: true
  });

  // Register Razones page
  router.addRoute('/razones', () => RazonesPage(router), {
    title: 'Razones · Personal Hub',
    protected: true
  });

  // Register Sentimientos page
  router.addRoute('/sentimientos', lazy(() => import('./pages/Sentimientos.js').then(m => m.SentimientosPage)), {
    title: 'Sentimientos · Personal Hub',
    protected: true
  });

  // Register Juegos page
  router.addRoute('/juegos', lazy(() => import('./pages/Juegos.js').then(m => m.JuegosPage)), {
    title: 'Juegos · Personal Hub',
    protected: true
  });

  // Sala online: invitación → espera → partida → resultado.
  router.addRoute('/juegos/online/:gameId', lazy(() => import('./pages/OnlineGame.js').then(m => m.OnlineGamePage)), {
    title: 'Partida online · Personal Hub',
    protected: true
  });

  // Register Calendario page
  router.addRoute('/calendario', lazy(() => import('./pages/Calendario.js').then(m => m.CalendarioPage)), {
    title: 'Calendario · Personal Hub',
    protected: true
  });

  // Register Mal Día page
  router.addRoute('/maldia', () => MalDiaPage(router), {
    title: 'Mal Día · Personal Hub',
    protected: true
  });

  // Register Open When page
  router.addRoute('/openwhen', () => OpenWhenPage(router), {
    title: 'Open When · Personal Hub',
    protected: true
  });

  // Register Series page
  router.addRoute('/series', lazy(() => import('./pages/Series.js').then(m => m.SeriesPage)), {
    title: 'Series · Personal Hub',
    protected: true
  });

  // Register Those Eyes page
  router.addRoute('/thoseeyes', lazy(() => import('./pages/ThoseEyes.js').then(m => m.ThoseEyesPage)), {
    title: 'Those Eyes · Personal Hub',
    protected: true
  });

  // Register Just The Way You Are page (experiencia inmersiva)
  router.addRoute('/justthewayyouare', lazy(() => import('./pages/JustTheWayYouAre.js').then(m => m.JustTheWayYouArePage)), {
    title: 'Just The Way You Are · Personal Hub',
    protected: true
  });

  // Register OsitosWorld page (sin navegación principal, página independiente)
  router.addRoute('/ositos', lazy(() => import('./pages/OsitosWorld.js').then(m => m.OsitosWorldPage)), {
    title: 'OsitosWorld · Personal Hub',
    protected: true
  });

  // No quedan placeholders — todas las secciones implementadas


  // Build the app shell (wraps navigation + auth guards)
  AppShell(router);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
