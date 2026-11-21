import { defineConfig, mergeConfig } from 'vite';
import base from '../personal-hub/vite.config.js';
import { fileURLToPath } from 'node:url';

// Vite compila este config a un bundle temporal antes de cargarlo. Ahí el
// default importado de personal-hub puede llegar como config ya resuelta en
// vez de como factory (en Vercel pasaba eso: "is not a function"). Aceptamos
// las dos formas.
const resolveBase = env => (typeof base === 'function' ? base(env) : base);

export default defineConfig(env => mergeConfig(resolveBase(env), {
  envDir: fileURLToPath(new URL('../personal-hub/', import.meta.url)),
  publicDir: fileURLToPath(new URL('../personal-hub/public/', import.meta.url)),
  server: { port: 5175, host: '127.0.0.1', open: false }
}));
