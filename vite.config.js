import { defineConfig, loadEnv } from 'vite';
import { handleTmdbRequest } from './api/_tmdb-core.js';

function localTmdbApi() {
  return {
    name: 'tamp-local-tmdb-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        if (pathname !== '/api/tmdb') return next();
        const result = await handleTmdbRequest(req);
        res.statusCode = result.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'private, max-age=120');
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [localTmdbApi()] };
});
