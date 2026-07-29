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
import { RinconPage } from './pages/Rincon.js';
import { CancionesPage } from './pages/Canciones.js';
import { RazonesPage } from './pages/Razones.js';
import { SentimientosPage } from './pages/Sentimientos.js';
import { JuegosPage } from './pages/Juegos.js';
import { CalendarioPage } from './pages/Calendario.js';
import { MalDiaPage } from './pages/MalDia.js';
import { OpenWhenPage } from './pages/OpenWhen.js';
import { SeriesPage } from './pages/Series.js';
import { ThoseEyesPage } from './pages/ThoseEyes.js';
import { OsitosWorldPage } from './pages/OsitosWorld.js';

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

  router.addRoute('/rincon', () => RinconPage(router), {
    title: 'Rincón · Personal Hub',
    protected: true
  });

  // Register Canciones page
  router.addRoute('/canciones', () => CancionesPage(router), {
    title: 'Canciones · Personal Hub',
    protected: true
  });

  // Register Razones page
  router.addRoute('/razones', () => RazonesPage(router), {
    title: 'Razones · Personal Hub',
    protected: true
  });

  // Register Sentimientos page
  router.addRoute('/sentimientos', () => SentimientosPage(router), {
    title: 'Sentimientos · Personal Hub',
    protected: true
  });

  // Register Juegos page
  router.addRoute('/juegos', () => JuegosPage(router), {
    title: 'Juegos · Personal Hub',
    protected: true
  });

  // Register Calendario page
  router.addRoute('/calendario', () => CalendarioPage(router), {
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
  router.addRoute('/series', () => SeriesPage(router), {
    title: 'Series · Personal Hub',
    protected: true
  });

  // Register Those Eyes page
  router.addRoute('/thoseeyes', () => ThoseEyesPage(router), {
    title: 'Those Eyes · Personal Hub',
    protected: true
  });

  // Register OsitosWorld page (sin navegación principal, página independiente)
  router.addRoute('/ositos', () => OsitosWorldPage(router), {
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
