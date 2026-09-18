# presentation/ — Load Balancing slide deck

Plain HTML/CSS/JS deck. No framework, no build step: every file in this folder is published as-is to GitHub Pages by `.github/workflows/deploy-pages.yml` on push to `main`.

## Layout

```
index.html          shell: <head>, SVG icon sprite (#ic-*), empty #deck, section loader
css/deck.css        all styles; color tokens on :root, redefined for dark mode
js/charts-lib.js    shared SVG helpers, exposed as window.Charts
js/deck.js          presenter engine: keys, data-step reveals, overview, theme
sections/NN-*.html  slide content — one file per section, most edits happen here
tools/renumber.py   rewrites every footer page number ("12 / 39") in SECTIONS order
load-balancer-outline.md  talk outline + speaker split (source material, not rendered)
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
- `window.Charts`: `el(tag, attrs, parent, text)`, `scale(d0, d1, r0, r1)`, `fmt(n, digits)`, `$(id)`, `rng(seed)` (deterministic — use it instead of `Math.random` so charts look identical on every load), `histogram({...})` (mode-switch histogram, currently unused). For a mode switch, follow the `.seg` + readout pattern in `03-algorithms.html` (the simulator and the hashing chart).
- Draw marks, ticks and labels from one `scale`. Set `viewBox` on the SVG rather than fixed pixel sizes.
- Colors come from `sv-*` classes in `css/deck.css` (`sv-axis`, `sv-grid`, `sv-mark`, `sv-bar`, `sv-hot`, `sv-lbl`, `sv-lbl-sm`, `sv-tick`, …). Never hard-code colors — both themes must work.
- Only move a helper into `charts-lib.js` when a second section needs it.

## Styling

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

- **3.4 simulator** (`03-algorithms.html`, `simulate()`): 480 req/s for 10 s into 4 pods × 4 workers, pod-d 3× slower. Arrivals and per-request work come from `rng(7)`, so every algorithm sees the same traffic; only the pick differs.
- **3.5 hashing** (`hashChart()`): 60 keys, `hash % N` vs. a ring with 150 virtual nodes per server.
- **3.6 ring** (`ringChart()`): hand-placed angles, not real hashes, so the picture stays readable.

## Known issues

- Deep links don't work: opening `#20` lands on slide 1. At the end of `js/deck.js`, `render(true)` calls `history.replaceState` (rewriting the hash to `#1.0`) before `fromHash()` reads it. Pre-existing; fix only when asked.
