// A tiny static server for local play-testing: serves ./game over HTTP so the
// ES modules load, and nothing else. Usage: node serve.ts [port]
// (default 4173). Do not use it to serve anything outside this folder.

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

const port = Number.parseInt(process.argv[2] ?? '4173', 10) || 4173;
const root = path.resolve(process.cwd(), 'game');

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let target = url.pathname === '/' ? '/index.html' : url.pathname;
  target = decodeURIComponent(target);
  const file = path.join(root, target);
  if (!file.startsWith(root)) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES.get(path.extname(file)) ?? 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Lumenfall at http://localhost:${port}/`);
});
