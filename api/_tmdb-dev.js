import { handleTmdbRequest } from './_tmdb-core.js';

/**
 * Middleware de desarrollo para que `/api/tmdb` funcione también con el
 * servidor local de Vite (en producción lo sirve `api/tmdb.js`).
 */
export function localTmdbApi() {
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
