# presentation/ — Load Balancing slide deck

Plain HTML/CSS/JS deck. No framework, no build step: every file in this folder is published as-is to GitHub Pages by `.github/workflows/deploy-pages.yml` on push to `main`.

## Layout

```
index.html          shell: <head>, SVG icon sprite (#ic-*), empty #deck, section loader
css/deck.css        all styles; color tokens on :root, redefined for dark mode
js/charts-lib.js    shared SVG helpers, exposed as window.Charts
js/deck.js          presenter engine: keys, data-step reveals, overview, theme
js/backdrop.js      ambient packet network behind the active slide (moved in on 'deck:slide')
js/vendor/qrcode.js qrcode-generator 1.4.4 (MIT), used by the Kahoot QR on the last slide
sections/NN-*.html  slide content — one file per section, most edits happen here
sections/99-thanks.html  closing slide: Kahoot QR + PIN typed in on stage (not a numbered section)
tools/renumber.py   rewrites every footer page number ("12 / 39") in SECTIONS order
load-balancer-outline.md  talk outline + speaker split (source material, not rendered)
notes/speaker-script.md   per-slide speaking script (source material, not rendered)
```

## How the page is assembled

1. The loader at the bottom of `index.html` fetches every name in the `SECTIONS` array and appends them to `#deck` **in array order** (the `NN-` filename prefix is cosmetic).
2. Inline `<script>` blocks from the sections are pulled out and executed after all slides are in the DOM.
3. `js/deck.js` loads last. It snapshots `.slide` elements and counts `data-step` nodes, so charts that create `data-step` nodes must run before it — keep this order.

Consequences:
- The deck needs HTTP. `file://` fails on `fetch`; the loader shows a hint. Don't "fix" this by inlining sections or wrapping HTML in JS — the user chose `.html` sections served over HTTP.
- All sections share one document: element `id`s must be unique across the whole deck.
- Relative URLs inside sections resolve against `index.html` (e.g. `diagrams/…`, not `../diagrams/…`).

## Slide conventions

```html
<section class="slide" data-section="kebab-slug">
  <div class="eyebrow"><svg class="ic"><use href="#ic-gauge"/></svg>Small line above the title</div>
  <h2>Slide title</h2>
  <!-- body: reuse existing layouts — split, card, points, tbl, code, chart, meter, stack -->
  <div class="foot"><span>12 / 45</span><span>section label</span></div>
</section>
```

- Section files open with a divider slide: `class="slide divider"`, with `divider-num`, `section-tag`, `h2`, `lead`. Copy one from an existing section.
- Every slide has a `.foot`; `deck.js` excludes it from the entrance stagger. The deck has no speaker notes: don't add `.notes` blocks.
- **Footer page numbers (`12 / 39`) are static text.** After adding, removing or reordering slides run `python3 tools/renumber.py` from `presentation/`. The HUD pager (bottom-right) is computed and needs no change.
- Step reveals: `data-step="1"`, `"2"`, … hidden until the presenter advances; unmarked elements show on entry. Keep numbers consecutive from 1.
- Before/after pictures: `data-hide-at="1"` fades an element out when step 1 is reached. Pair it with a `data-step="1"` element that draws the "after" state in the same place.
- Animated numbers: `data-count="1000"` counts up when the slide becomes active (supported by `deck.js`, not used by any slide yet).
- Icons come from the sprite in `index.html` (`#ic-balancer`, `#ic-pulse`, `#ic-ring`, `#ic-plug`, `#ic-globe`, …). Add new symbols there, not inline in sections.
- Slide copy is English. Follow "Writing slide copy" below.

## Writing slide copy

The audience is mid-level backend and frontend engineers. `load-balancer-outline.md` (Vietnamese) is the source of truth for content, order and who presents what; slides are its English version, not a free rewrite.

- **Concrete over abstract.** Use numbers, names, and real systems: "3 pods, pod-b in a 2 s GC pause", "ALB idle timeout 60 s", "Envoy outlier detection". Avoid lines like "the art of distribution" or "a spectrum of trade-offs".
- **Problem before definition.** Show what breaks without the thing, then name it. A slide should answer "why do I care?" before "what is it?".
- **The `h2` is a claim, not a label.** Write "Send to the backend with the fewest requests in flight", not "Least connections overview".
- **Short, plain sentences.** One idea per bullet, 1–2 lines. Prefer "reject", "wait", "retry" over "mitigate", "leverage", "facilitate". No marketing tone, no em-dash chains.
- **Say what to do.** When a slide explains a behavior, include the action for the engineer (e.g. "backend keep-alive must be longer than the balancer's idle timeout").
- **Show it.** Prefer a small request log, code snippet, or SVG diagram over a paragraph. Use `data-step` to reveal the story in order (setup → failure → fix).

| Avoid | Write |
|---|---|
| Load balancing optimizes resource utilization | 600 req/s across 3 pods is ~200 each, not 600 on one |
| Health checks ensure high availability | pod-c fails 5 requests in a row and is ejected for 30 s |
| Connection management is a key consideration | gRPC sends every call on one connection, so one pod gets all of them |

## Adding a section

1. Create `sections/NN-slug.html`, starting with a divider slide.
2. Add `'NN-slug'` (no extension) to `SECTIONS` in `index.html` at the right position.
3. Add an `<li data-divider="divider-NN">` to `#outline-list` in `sections/00-outline.html`. That list is the single source for the outline: its script computes each section's start slide and injects the "Section NN / total" mini outline into every divider. Don't hand-write outlines in dividers.
4. Run `python3 tools/renumber.py`.

## Charts

Chart code lives in the same section file as its slide, in one trailing `<script>`:

```html
<script>
(() => {
  const { el, scale, fmt, $ } = window.Charts;
  function myChart(svg) { /* ... */ }
  myChart($('my-chart'));
})();
</script>
```

- Keep the IIFE wrapper so function names don't collide between sections.
- Only destructure the helpers actually used.
- `window.Charts`: `el(tag, attrs, parent, text)`, `scale(d0, d1, r0, r1)`, `fmt(n, digits)`, `$(id)`, `rng(seed)` (deterministic — use it instead of `Math.random` so charts look identical on every load), `histogram({...})` (mode-switch histogram, currently unused), plus the animation trio below. For a mode switch, follow the `.seg` + readout pattern in `03-algorithms.html` (the simulator and the hashing chart).
- Draw marks, ticks and labels from one `scale`. Set `viewBox` on the SVG rather than fixed pixel sizes.
- Colors come from `sv-*` classes in `css/deck.css` (`sv-axis`, `sv-grid`, `sv-mark`, `sv-bar`, `sv-hot`, `sv-lbl`, `sv-lbl-sm`, `sv-tick`, …). Never hard-code colors — both themes must work.
- Only move a helper into `charts-lib.js` when a second section needs it.

### Stepped animations

Sections 1, 2 and 3 all animate, so the machinery is shared:

- `clock()` — `later` / `sleep` on wall time, and `snapshot(phase, api)` swaps in a virtual clock that runs a whole phase synchronously, so print/PDF captures its end state.
- `steps(id, widget, phases)` — binds a widget to one slide: phase *k* plays when the highest shown `data-step` is *k*, every phase replays from a clean state (so `←` works), and the ↻ button reruns the current one. Needs `#<id>-flow`, `#<id>-readout` and `#<id>-replay` on the slide, and a widget exposing `reset` / `later` / `snapshot`.
- `scene(svg, viewBox, draw)` — for a hand-drawn picture that isn't a balancer-and-servers flow. `draw()` lays out the fixed parts once and returns the handles the phases use; anything a phase draws goes in `api.layer`, which is appended after `draw()` so it paints on top of the fixed scenery, and which `reset()` wipes. Return a `clear()` handle to undo changes a phase made to a fixed node.
- Cards that slide get `class="pkt-fly"` and are moved by setting `style.transform`; call `move()` (which forces layout first) rather than assigning the transform directly, or the transition won't run.
- `.readout b` is the deck's large numeral style. Use `<strong>` for emphasis in a readout, `<b>` only for numbers.

## Styling

- Theme is Tokyo Night (default, dark) with Tokyo Night Day behind `data-theme="light"`. Each part of the talk has its own hue: `sections/00-outline.html` tags slides with `data-part="00".."04"` and `deck.css` ("section colors") swaps `--accent` / `--accent2`; derived tokens are recomputed with `color-mix()`.
- The "shell" block at the end of `deck.css` is purely visual (surface glow, top-rule packet, icon tiles, glows, progress colors). `deck.js` fires `deck:slide` with the active slide and sets `body[data-part]`; `js/backdrop.js` listens. Keep ambient motion to that network and the one rule sweep per slide.

- All CSS is in `css/deck.css`, grouped by `/* ---------- name ---------- */` markers.
- Change colors via the tokens at the top (`:root`), and update the dark overrides under both the `prefers-color-scheme` query and `[data-theme='dark']`.
- Slides are laid out on a fixed 1280×720 canvas and scaled by `deck.js` (`--s`). Size things for that canvas.

## Verifying changes

1. `cd presentation && python3 -m http.server 8000`, open `http://localhost:8000`.
2. Step through every changed slide with `→`, including all `data-step` states.
3. Toggle theme with `T` and re-check charts.
4. Check the DevTools console for errors.

Headless check without a browser window:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=4000 --dump-dom http://localhost:8000/ > /tmp/dom.html
# then count <section class="slide"> and inspect chart <svg id="..."> contents
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Failed to load slides: Failed to fetch … opened as a file` | Opened via `file://`. Serve over HTTP. |
| `Failed to load slides: sections/xxx.html: HTTP 404` | Name in `SECTIONS` doesn't match the filename (typo, or `.html` included). |
| Blank slide / chart missing | Console error in a section `<script>`, or a duplicated `id`. |
| `→` doesn't reveal the next part | `data-step` numbers missing or not consecutive. |
| Chart wrong color in one theme | Hard-coded color instead of an `sv-*` class. |
| Edits don't show / new slide looks unstyled | Browser cache. `deck.css` and `deck.js` are cache-busted by the loader; for anything else, hard reload. |

## Interactive slides

- **1.2–1.6 mechanics animations** (`01-local-load-balancing.html`, `Charts.scene()` + `steps()`): 1.2 builds three stacked rows one per step (packets on a wire → the anatomy of one packet → three requests on one connection), and each phase redraws the earlier rows instantly so the picture accumulates. 1.3 walks a packet through an L4 connection table (SYN decision → TLS passthrough → the backend dying with no copy to re-send); 1.4 does the same for an L7 proxy's two connections (per-request routing → TLS termination → retry); 1.5 fills memory with 64 KB slots until one request crosses the size limit and the balancer stops keeping a copy; 1.6 runs probe rounds (active ejection → passive outlier detection → a deep check taking the whole fleet out, then panic mode).
- **2.1, 2.3–2.6 global animations** (`02-global-load-balancing.html`, same `scene()` + `steps()`): 2.1 builds two rows (the balancer dying inside its own region → the 3 × 230 ms handshake ladder); 2.3 runs DNS lookups through a GSLB that answers and then drops out of the path (VN → SG, JP → Tokyo, then SG unhealthy so health filters before the policy); 2.4 lights up the five layers holding a stale answer, adds them into the failover formula, then replays the same five minutes with the old address still answering; 2.5 routes users through a BGP junction to the nearest PoP, withdraws an announcement, then shows BGP picking a distant PoP; 2.6 terminates the handshakes at the PoP, retries into a second origin, then serves from cache.
- **3.2–3.6 request-flow animations** (`03-algorithms.html`, `Charts.flow()` + `Charts.steps()`): one balancer (or clients → hash box) and 3–4 servers; coins are requests. `steps()` watches the slide's `.active` class and its highest shown `data-step` and replays phase *k* from a clean state, so `→` / `←` drive the animation and the ↻ Replay button reruns the current phase. Phases: round robin (even counts → uneven work), weighted RR 3:1:1 (naive burst → NGINX smooth), least connections (round robin vs least conn with server B 5× slower), IP hash (two rounds → office NAT), IP hash when servers change (add D → B dies). IP hash uses fixed hash values shown on screen so `% N` can be checked by hand.
- **4.4 live demo** (`04-demo.html`): uses `Charts.flow()` against the real NGINX in `../demo/` (`X-Upstream`, `X-LB`, `/__lb`, `/__health`). Falls back to a recorded round robin when `localhost:8000` doesn't answer. `flow()` is shared with section 3, so it lives in `charts-lib.js`.
- **Appendix simulator** (`simulate()`): 480 req/s for 10 s into 4 pods × 4 workers, pod-d 3× slower. Arrivals and per-request work come from `rng(7)`, so every algorithm sees the same traffic; only the pick differs.
- **Appendix hashing** (`hashChart()`): 60 keys, `hash % N` vs. a ring with 150 virtual nodes per server.
- **Appendix ring** (`ringChart()`): hand-placed angles, not real hashes, so the picture stays readable.

## Known issues

- Deep links don't work: opening `#20` lands on slide 1. At the end of `js/deck.js`, `render(true)` calls `history.replaceState` (rewriting the hash to `#1.0`) before `fromHash()` reads it. Pre-existing; fix only when asked.
