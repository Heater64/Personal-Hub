/**
 * Simple HTTP server for Personal Hub SPA
 * Run: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Redirect for old paths that no longer exist */
const OLD_REDIRECTS = [
  { prefix: '/login.html', hash: 'login' },
  { prefix: '/pages/', strip: '/pages/', replace: '', ext: '.html' },
  { prefix: '/features/', strip: '/features/', replace: '' },
];

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Root / index → SPA
  if (url === '/' || url === '/index.html') {
    return serveFile('/src/index.html', res);
  }

  // Old redirects → SPA hash routes
  for (const rule of OLD_REDIRECTS) {
    if (!url.startsWith(rule.prefix)) continue;
    
    // Extract the page name for the hash
    let hash = rule.hash;
    if (!hash && rule.strip) {
      let rest = url.slice(rule.strip.length);
      if (rule.ext) rest = rest.replace(rule.ext, '');
      hash = rest.split('/')[0] || 'home';
    }
    
    res.writeHead(302, { 'Location': '/#' + hash });
    res.end();
    return;
  }

  // Serve the file
  serveFile(url, res);
});

function serveFile(url, res) {
  const filePath = path.join(ROOT, url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: any unknown route → index.html
        fs.readFile(path.join(ROOT, 'src', 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, must-revalidate',
          });
          res.end(data2);
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }
    
    // Cache: HTML no cache, assets 1h
    const cacheControl = ext === '.html'
      ? 'no-cache, must-revalidate'
      : 'public, max-age=3600';
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`\n  🚀 Personal Hub SPA corriendo en:`);
  console.log(`  📍  http://localhost:${PORT}/`);
  console.log(`  📍  http://localhost:${PORT}/src/\n`);
});
