import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('game');
const HOST = '127.0.0.1';
const ROOT_ROUTE = '/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.min.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${HOST}:8080`);
    if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const decoded = decodeURIComponent(url.pathname);
    const path = resolve(root, `.${decoded === ROOT_ROUTE ? '/index.html' : decoded}`);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Invalid path');
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    const extension = extname(path);
    const type = path.endsWith('.min.js') ? types['.min.js'] : types[extension] || 'application/octet-stream';
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  }
}).listen(8080, HOST, () => console.log(`Sunset County at http://${HOST}:8080`));
