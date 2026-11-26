import { defineConfig, loadEnv } from 'vite';
import { localTmdbApi } from './api/_tmdb-dev.js';

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [localTmdbApi()] };
});
