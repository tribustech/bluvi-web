// Minimal static file server (no deps) for the design folder: `node scripts/serve-static.mjs design 4300`.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'design');
const port = Number(process.argv[3] ?? 4300);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.md': 'text/markdown' };

export function serveStatic(dir = root, p = port) {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = path.join(dir, rel === '/' ? 'Harta ecranelor.dc.html' : rel);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => server.listen(p, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await serveStatic();
  console.log(`design on http://localhost:${port}/`);
}
