import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Target modern browsers for smaller bundles
    target: ['es2020', 'chrome87', 'safari14', 'firefox78', 'edge88'],
    // Inline small assets as base64
    assetsInlineLimit: 4096,
    // Better chunk splitting: separate vendor libs from app code
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Group Supabase client into its own chunk (large library)
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase';
          }
          // Los plugins nativos (Capacitor) solo se piden dentro del APK:
          // dejarlos fuera de `vendor` mantiene el import() diferido de
          // verdad, así la web no descarga ni un byte de ellos.
          if (id.includes('@capacitor/')) {
            return undefined;
          }
          // Leaflet solo se usa al abrir el mapa de la distancia. Si cae en
          // `vendor` se descarga siempre; fuera de él viaja en el chunk de la
          // hoja y el resto de la app no lo paga.
          if (id.includes('node_modules/leaflet')) {
            return undefined;
          }
          // Group all node_modules dependencies into vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Keep page-level lazy chunks as-is (already split by dynamic imports)
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true
  },
  define: {
    __APP_VERSION__: JSON.stringify('2.0.0')
  }
});
