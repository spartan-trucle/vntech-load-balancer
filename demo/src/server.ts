// Demo backend: answers "Server <port>", can be made slow to fake a GC pause, and reports health.
// Run one per port: node src/server.ts 8001
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? process.env.PORT ?? 8001);
let delayMs = 0; // set with POST /__control?ms=3000 (npm run slow -- 8002 3000)

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  // The slide polls /__health directly from the browser, so the backend allows any origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (url.pathname === '/__health') {
    res.writeHead(204).end();
    return;
  }
  if (url.pathname === '/__control' && req.method === 'POST') {
    delayMs = Math.max(0, Number(url.searchParams.get('ms')) || 0);
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`Server ${port}: ${delayMs} ms per request\n`);
    return;
  }

  // Headers go out first and the body after the delay. NGINX forwards the headers right away,
  // so the slide learns which server took a request while that request is still running.
  res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Server': String(port) });
  res.flushHeaders();
  setTimeout(() => res.end(`Server ${port}\n`), delayMs);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Server ${port} listening on http://127.0.0.1:${port}`);
});
