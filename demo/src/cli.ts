// Demo control for "The crashed server": three Node backends on 8001–8003 behind NGINX on 8000.
//   npm start | npm stop | npm run status   (pnpm start / pnpm stop / pnpm status)
//   npm run algo -- rr | weight | least | iphash
//   npm run crash -- 8002      npm run revive -- 8002      npm run slow -- 8002 3000
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUN = join(ROOT, '.run'); // pid files, logs, NGINX temp dirs (git-ignored)
const CONF = join(ROOT, 'nginx', 'nginx.conf');
const GENERATED = join(ROOT, 'nginx', 'generated'); // written by `algo`, included by nginx.conf
const PORTS = [8001, 8002, 8003];

const servers = (extra: Record<number, string> = {}): string =>
  PORTS.map((p) => `server 127.0.0.1:${p}${extra[p] ? ` ${extra[p]}` : ''};`).join('\n') + '\n';

// The upstream block for each algorithm from section 3 of the talk.
const ALGORITHMS: Record<string, { label: string; upstream: string }> = {
  rr: { label: 'round robin', upstream: '# no directive = round robin\n' + servers() },
  weight: { label: 'weighted round robin', upstream: servers({ 8001: 'weight=4' }) },
  least: { label: 'least_conn', upstream: 'least_conn;\n' + servers() },
  iphash: { label: 'ip_hash', upstream: 'ip_hash;\n' + servers() },
};

const nginxArgs = (...extra: string[]): string[] =>
  ['-p', `${RUN}/`, '-c', CONF, '-e', join(RUN, 'logs', 'error.log'), ...extra];

const pidFile = (port: number): string => join(RUN, `server-${port}.pid`);

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(file: string): number | null {
  if (!existsSync(file)) return null;
  const pid = Number(readFileSync(file, 'utf8').trim());
  return pid && isRunning(pid) ? pid : null;
}

function nginx(...extra: string[]): void {
  try {
    execFileSync('nginx', nginxArgs(...extra), { stdio: 'inherit' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('nginx is not installed. On macOS: brew install nginx');
      process.exit(1);
    }
    throw err;
  }
}

function writeAlgorithm(name: string): void {
  const algo = ALGORITHMS[name];
  if (!algo) {
    console.error(`Unknown algorithm "${name}". Use one of: ${Object.keys(ALGORITHMS).join(', ')}`);
    process.exit(1);
  }
  mkdirSync(GENERATED, { recursive: true });
  writeFileSync(join(GENERATED, 'upstream.conf'), algo.upstream);
  // $lb_algorithm is sent back as X-LB so the slide can show which algorithm is live
  writeFileSync(join(GENERATED, 'algorithm.conf'), `map $host $lb_algorithm { default "${algo.label}"; }\n`);
  console.log(`algorithm: ${algo.label}`);
}

function startServer(port: number): void {
  if (readPid(pidFile(port))) { console.log(`Server ${port} already running`); return; }
  const log = openSync(join(RUN, 'logs', `server-${port}.log`), 'a');
  const child = spawn(process.execPath, [join(ROOT, 'src', 'server.ts'), String(port)], {
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  writeFileSync(pidFile(port), String(child.pid));
  console.log(`Server ${port} started (pid ${child.pid})`);
}

function stopServer(port: number, signal: NodeJS.Signals): void {
  const pid = readPid(pidFile(port));
  if (pid) { process.kill(pid, signal); console.log(`Server ${port} stopped (${signal})`); }
  else console.log(`Server ${port} was not running`);
  rmSync(pidFile(port), { force: true });
}

const nginxRunning = (): boolean => readPid(join(RUN, 'nginx.pid')) !== null;

function portOf(arg: string | undefined): number {
  const port = Number(arg);
  if (!PORTS.includes(port)) { console.error(`Pick a backend port: ${PORTS.join(', ')}`); process.exit(1); }
  return port;
}

async function status(): Promise<void> {
  for (const port of PORTS) {
    const up = await fetch(`http://127.0.0.1:${port}/__health`).then(() => true, () => false);
    console.log(`Server ${port}  ${up ? 'up' : 'down'}`);
  }
  const lb = await fetch('http://127.0.0.1:8000/__lb').then((r) => r.headers.get('X-LB'), () => null);
  console.log(lb ? `NGINX :8000  up · ${lb}` : 'NGINX :8000  down');
}

// pnpm passes the `--` separator through (npm strips it), so drop it here
// A reload takes about a second; until then old workers still answer with the old algorithm.
// Wait until NGINX reports the new one so the next request on stage uses it.
async function waitForAlgorithm(label: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const live = await fetch('http://127.0.0.1:8000/__lb').then((r) => r.headers.get('X-LB'), () => null);
    if (live === label) { console.log('NGINX reloaded'); return; }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log('NGINX reload is taking longer than 3 s; check .run/logs/error.log');
}

const [command, ...args] = process.argv.slice(2).filter((a) => a !== '--');
for (const dir of ['logs', 'temp']) mkdirSync(join(RUN, dir), { recursive: true });

switch (command) {
  case 'up':
    PORTS.forEach(startServer);
    writeAlgorithm('rr'); // every demo starts from round robin
    if (nginxRunning()) nginx('-s', 'reload');
    else nginx();
    console.log('NGINX listening on http://localhost:8000');
    break;
  case 'down':
    PORTS.forEach((p) => stopServer(p, 'SIGTERM'));
    if (nginxRunning()) { nginx('-s', 'quit'); console.log('NGINX stopped'); }
    break;
  case 'algo': {
    const name = args[0] ?? 'rr';
    writeAlgorithm(name);
    if (nginxRunning()) {
      nginx('-s', 'reload');
      await waitForAlgorithm(ALGORITHMS[name].label);
    }
    break;
  }
  case 'crash':
    stopServer(portOf(args[0]), 'SIGKILL');
    break;
  case 'revive':
    startServer(portOf(args[0]));
    break;
  case 'slow': {
    const port = portOf(args[0]);
    const res = await fetch(`http://127.0.0.1:${port}/__control?ms=${Number(args[1] ?? 3000) || 0}`, { method: 'POST' })
      .catch(() => null);
    if (!res) {
      console.error(`Server ${port} is not running. Start it with: npm run revive -- ${port}  (or npm start)`);
      process.exit(1);
    }
    process.stdout.write(await res.text());
    break;
  }
  case 'status':
    await status();
    break;
  default:
    console.log('Usage: npm start | npm stop | npm run status | algo -- <rr|weight|least|iphash> | crash -- <port> | revive -- <port> | slow -- <port> <ms>');
}
