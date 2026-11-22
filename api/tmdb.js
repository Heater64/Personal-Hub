import { handleTmdbRequest } from './_tmdb-core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=120');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const result = await handleTmdbRequest(req);
  return res.status(result.status).json(result.body);
}
