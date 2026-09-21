// Serveur statique minimal (aucune dépendance) pour le développement et les tests.
// Sert la racine du dépôt telle quelle, comme le fera GitHub Pages.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argPort = process.argv.find((a) => a.startsWith('--port='));
const PORT = Number(argPort ? argPort.slice(7) : process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    res.writeHead(400).end('Requête invalide');
    return;
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.join(root, path.normalize(pathname).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('Interdit');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Prise de masse : http://${HOST}:${PORT}/`);
});
