/* ==========================================
   Personal Hub v2 — PWA Service
   Gestiona: instalación, detección de updates,
   indicador de conexión y sincronización offline
   ========================================== */

const STORAGE_KEYS = {
  INSTALL_DISMISSED: 'ph.pwa.installDismissed',
  VERSION: 'ph.pwa.version',
  SEEN_VERSIONS: 'ph.pwa.seenVersions',
  LAST_ONLINE: 'ph.pwa.lastOnline'
};

let swRegistration = null;
let installPrompt = null;
let toastTimer = null;

// ==========================================
// TOAST PROPIO (no requiere Toast service)
// ==========================================
function showPwaToast(text, type = 'info', duration = 3500) {
  let container = document.getElementById('pwa-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pwa-toast-container';
    container.className = 'pwa-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `pwa-toast pwa-toast--${type}`;
  toast.innerHTML = text;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('pwa-toast--visible'));

  // Auto-remove
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('pwa-toast--visible');
      toast.classList.add('pwa-toast--hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

// ==========================================
// CONEXIÓN
// ==========================================
function initConnectionIndicator() {
  function show(text, type, duration) {
    showPwaToast(`<span class="pwa-toast-icon">${type === 'offline' ? '🔴' : type === 'sync' ? '🟡' : '🟢'}</span> ${text}`, type === 'offline' ? 'error' : type === 'sync' ? 'warning' : 'success', duration || 3000);
  }

  if (navigator.onLine) {
    show('Conectado', 'online', 2000);
  } else {
    show('Sin conexión — modo offline', 'offline', 0);
  }

  window.addEventListener('online', () => {
    // Check if there's pending sync
    const pending = getSyncQueueLength();
    if (pending > 0) {
      show(`Sincronizando ${pending} cambio${pending === 1 ? '' : 's'}...`, 'sync', 3000);
      // Re-check after a moment
      setTimeout(() => {
        if (getSyncQueueLength() === 0) {
          show('Conectado y sincronizado', 'success', 2000);
        }
      }, 1500);
    } else {
      show('Conectado', 'success', 2000);
    }
    document.documentElement.classList.remove('is-offline');
  });

  window.addEventListener('offline', () => {
    show('Sin conexión — los cambios se guardarán', 'error', 0);
    document.documentElement.classList.add('is-offline');
  });
}

function getSyncQueueLength() {
  // Lee ambas claves (nueva y legacy) para compatibilidad
  try {
    const q = JSON.parse(localStorage.getItem('personalHub.syncQueue') || localStorage.getItem('ph.syncQueue') || '[]');
    return Array.isArray(q) ? q.length : 0;
  } catch { return 0; }
}

// ==========================================
// INSTALACIÓN DE LA APP
// ==========================================
function initInstallPrompt() {
  const dismissed = localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED) === '1';
  if (dismissed) return;

  // Already installed as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone) return; // iOS

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, '1');
    hideInstallBanner();
    showPwaToast('✅ App instalada correctamente', 'success', 3000);
  });
}

function showInstallBanner() {
  if (document.querySelector('.pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'pwa-install-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Instalar app');
  banner.innerHTML = `
    <div class="pwa-install-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </div>
    <div class="pwa-install-body">
      <div class="pwa-install-title">Instala Personal Hub</div>
      <div class="pwa-install-text">Acceso rápido, sin internet y novedades al instante. Gratis.</div>
    </div>
    <div class="pwa-install-actions">
      <button class="pwa-install-btn pwa-install-btn--ghost" id="pwaInstallDismiss">Ahora no</button>
      <button class="pwa-install-btn pwa-install-btn--primary" id="pwaInstallAccept">Instalar</button>
    </div>
  `;
  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => banner.classList.add('pwa-install-banner--visible'));

  banner.querySelector('#pwaInstallDismiss').addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, '1');
    hideInstallBanner(banner);
  });

  banner.querySelector('#pwaInstallAccept').addEventListener('click', async () => {
    if (!installPrompt) {
      localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, '1');
      hideInstallBanner(banner);
      return;
    }
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    installPrompt = null;
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, '1');
    hideInstallBanner(banner);
    if (result.outcome === 'accepted') {
      showPwaToast('✅ ¡Gracias por instalar la app!', 'success', 3500);
    }
  });
}

function hideInstallBanner(banner) {
  banner = banner || document.querySelector('.pwa-install-banner');
  if (!banner) return;
  banner.classList.remove('pwa-install-banner--visible');
  setTimeout(() => banner.remove(), 350);
}

// ==========================================
// ACTUALIZACIONES
// ==========================================
async function initUpdateDetection() {
  if (!('serviceWorker' in navigator)) return;

  try {
    swRegistration = await navigator.serviceWorker.ready;
  } catch {
    return;
  }

  // Listen for messages from SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'UPDATE_APPLIED') {
      showPwaToast('🔄 Actualización aplicada. Recargando...', 'info', 2000);
      setTimeout(() => window.location.reload(), 1500);
    } else if (data.type === 'PUSH_SUBSCRIPTION_CHANGED' && data.subscription) {
      // El SW renovó la suscripción push: sincronizarla con el servidor
      import('./notifications.service.js').then(ns => ns.resyncPushSubscription()).catch(() => {});
    }
  });

  // Detect SW update
  swRegistration.addEventListener('updatefound', () => {
    const newWorker = swRegistration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New version available
        showUpdateBanner();
      }
    });
  });
}

function showUpdateBanner() {
  if (document.querySelector('.pwa-update-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'pwa-update-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Actualización disponible');
  banner.innerHTML = `
    <div class="pwa-update-icon">✨</div>
    <div class="pwa-update-body">
      <div class="pwa-update-title">Actualización disponible</div>
      <div class="pwa-update-text">Una nueva versión está lista para instalarse.</div>
    </div>
    <div class="pwa-update-actions">
      <button class="pwa-update-btn pwa-update-btn--ghost" id="pwaUpdateDismiss">Ahora no</button>
      <button class="pwa-update-btn pwa-update-btn--primary" id="pwaUpdateAccept">Actualizar</button>
    </div>
  `;
  document.body.appendChild(banner);

  requestAnimationFrame(() => banner.classList.add('pwa-update-banner--visible'));

  banner.querySelector('#pwaUpdateDismiss').addEventListener('click', () => {
    hideUpdateBanner(banner);
  });

  banner.querySelector('#pwaUpdateAccept').addEventListener('click', () => {
    hideUpdateBanner(banner);
    applyUpdate();
  });
}

function hideUpdateBanner(banner) {
  banner = banner || document.querySelector('.pwa-update-banner');
  if (!banner) return;
  banner.classList.remove('pwa-update-banner--visible');
  setTimeout(() => banner.remove(), 350);
}

async function applyUpdate() {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

// ==========================================
// REGISTRO DEL SERVICE WORKER
// ==========================================
async function registerSW() {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    swRegistration = reg;

    // If there's already a waiting worker, show update banner
    if (reg.waiting && navigator.serviceWorker.controller) {
      // A new version is waiting
      showUpdateBanner();
    }

    return true;
  } catch (err) {
    console.warn('SW registration failed:', err);
    return false;
  }
}

// ==========================================
// CHECK DE VERSIÓN
// ==========================================
function checkVersion() {
  try {
    const current = localStorage.getItem(STORAGE_KEYS.VERSION) || '0';
    const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0';
    if (current !== appVersion) {
      localStorage.setItem(STORAGE_KEYS.VERSION, appVersion);
      // Do a seamless cache update
      if (swRegistration && swRegistration.active) {
        swRegistration.active.postMessage({ type: 'PRECACHE_UPDATE' });
      }
    }
  } catch {}
}

// ==========================================
// INIT PRINCIPAL
// ==========================================
export async function initPWA() {
  // Register Service Worker
  await registerSW();

  // Connection indicator (always)
  initConnectionIndicator();

  // Install prompt (only if not dismissed)
  initInstallPrompt();

  // Update detection
  initUpdateDetection();

  // Check app version
  checkVersion();
}

// ==========================================
// EXPORTS (para uso programático)
// ==========================================
export function getInstallPrompt() {
  return installPrompt;
}

export function triggerInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  installPrompt.userChoice.finally(() => {
    installPrompt = null;
  });
  return true;
}

export function checkForUpdates() {
  if (swRegistration) {
    swRegistration.update();
  }
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}
