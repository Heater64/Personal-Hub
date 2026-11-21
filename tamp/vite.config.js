import { defineConfig, mergeConfig } from 'vite';
import base from '../personal-hub/vite.config.js';
import { fileURLToPath } from 'node:url';

export default defineConfig(env => mergeConfig(base(env), {
  envDir: fileURLToPath(new URL('../personal-hub/', import.meta.url)),
  publicDir: fileURLToPath(new URL('../personal-hub/public/', import.meta.url)),
  server: { port: 5175, host: '127.0.0.1', open: false }
}));
