# Demo: the crashed server

Three Node + TypeScript backends on ports 8001–8003, NGINX in front on port 8000. Slide 4.6 of the deck sends real requests to NGINX and animates which server answered.

## Setup

Requires Node 22.18+ (it runs the `.ts` files directly, no build step) and NGINX:

```bash
brew install nginx
cd demo
npm install
```

## Run

```bash
npm start         # start 8001–8003 and NGINX on 8000, algorithm reset to round robin
npm run status    # which backends are up, which algorithm NGINX is using
npm stop          # stop everything
```

```bash
for i in $(seq 6); do curl -s localhost:8000; done
# Server 8001
# Server 8002
# Server 8003
# ...
```

With pnpm: `pnpm start`, `pnpm stop`, `pnpm slow 8002 3000`, … (not `pnpm up`: that is pnpm's own *update* command).

## During the talk

| Command | What it does |
|---|---|
| `npm run algo -- rr` | round robin (default) |
| `npm run algo -- weight` | 8001 gets `weight=4` |
| `npm run algo -- least` | `least_conn` |
| `npm run algo -- iphash` | `ip_hash`: every request from your laptop lands on one server |
| `npm run slow -- 8002 3000` | 8002 takes 3 s per request (a GC pause); `0` to undo |
| `npm run crash -- 8002` | SIGKILL the 8002 backend |
| `npm run revive -- 8002` | start it again |

`algo` rewrites `nginx/generated/*.conf` and reloads NGINX without dropping connections.

## How the slide knows what happened

- `X-Upstream: $upstream_addr` lists every server NGINX tried. After a crash it reads `127.0.0.1:8002, 127.0.0.1:8003`: the refused attempt, then the retry.
- `X-LB` carries the algorithm name, so the slide shows which one is live.
- Backends send their headers before the body. With `proxy_buffering off`, the slide learns which server took a request while that request is still running (useful with `slow`).
- `GET /__lb` on NGINX and `GET /__health` on each backend are cheap probes the slide polls every second; neither moves the round robin counter.

Present the deck from a local server (`python3 -m http.server` in `presentation/`). A page on GitHub Pages can't call `localhost`, so there the slide replays a recording instead.

## Layout

```
src/server.ts      one backend: "Server <port>", /__health, POST /__control?ms= to slow it down
src/cli.ts         start (up) / stop (down) / status / algo / crash / revive / slow
nginx/nginx.conf   upstream + CORS + X-Upstream / X-LB; includes nginx/generated/*.conf
.run/              pid files, logs, NGINX temp dirs (git-ignored)
```

`npm run check` type-checks with `tsc`.
