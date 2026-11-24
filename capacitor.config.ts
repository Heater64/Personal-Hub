import type { CapacitorConfig } from '@capacitor/cli';

/* ==========================================
   Tamp - contenedor nativo (Android)

   Dos modos, elegidos por entorno — no hay que editar este archivo:

   · Cáscara remota (recomendado, y el que da las actualizaciones OTA):
       CAP_SERVER_URL=https://tu-proyecto.vercel.app   → en .env
     El WebView carga tu despliegue de Vercel. Cada `git push` que publica
     Vercel se ve en la app al abrirla: no se vuelve a tocar el APK.
     El service worker de la app sigue cacheando, así que también abre sin
     conexión después de la primera visita.

   · Paquete local (sin CAP_SERVER_URL):
     El APK lleva dentro el `dist` compilado. Funciona sin red desde el
     primer arranque, pero entonces cada cambio exige APK nuevo.
   ========================================== */

// `.env` es local (gitignored) y no debe romper el arranque si no existe.
try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env: modo local */
}

const remoteUrl = process.env.CAP_SERVER_URL?.trim() || '';
if (remoteUrl) {
  const parsedRemoteUrl = new URL(remoteUrl);
  if (parsedRemoteUrl.protocol !== 'https:' || parsedRemoteUrl.username || parsedRemoteUrl.password) {
    throw new Error('CAP_SERVER_URL debe ser una URL HTTPS sin credenciales.');
  }
}

const config: CapacitorConfig = {
  appId: 'com.heater64.personalhub',
  appName: 'Tamp',
  webDir: 'tamp/dist',
  // El tema de la app es oscuro por defecto; evita el destello blanco entre
  // la splash nativa y el primer frame del WebView.
  android: {
    backgroundColor: '#0a0a0c',
    // Evita que el bridge de Capacitor copie resultados completos de plugins
    // (tokens de sesión, ubicación y estado del dispositivo) a Logcat.
    loggingBehavior: 'none',
  },
  server: {
    androidScheme: 'https',
    ...(remoteUrl ? { url: remoteUrl } : {}),
  },
  plugins: {
    // La splash nativa tapa solo el arranque del WebView; a partir de ahí manda
    // el splash de marca de index.html (#boot-splash).
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#0a0a0c',
      showSpinner: false,
    },
    // Valores iniciales; native.service.js los recalcula con el tema real
    // (paleta + claro/oscuro) en cuanto arranca la app.
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0c',
    },
  },
};

export default config;
