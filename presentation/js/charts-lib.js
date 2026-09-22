// Charts and interactive widgets. Every chart draws marks, ticks and labels from one linear scale.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent, text) => {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };
  const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const $ = (id) => document.getElementById(id);

  // Deterministic so the chart looks the same on every load and in print.
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Histogram with a mode switch (kept from the rate-limiting deck; reusable for latency plots).
  function histogram({ svg, seg, readout, domain: [a, b], bin, ymax, yStep, xStep, xUnit, modes, describe }) {
    const W = 1100, H = 300, L = 60, R = 16, T = 12, B = 40;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = scale(a, b, L, W - R);
    const y = scale(0, ymax, H - B, T);
    for (let v = 0; v <= ymax; v += yStep) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'sv-grid' }, svg);
      el('text', { x: L - 10, y: y(v) + 4.5, class: 'sv-tick', 'text-anchor': 'end' }, svg, fmt(v));
    }
    for (let v = a; v <= b; v += xStep) {
      el('text', { x: x(v), y: H - B + 24, class: 'sv-tick', 'text-anchor': 'middle' }, svg, `${v}${xUnit}`);
    }
    el('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'sv-axis' }, svg);
    const n = Math.round((b - a) / bin);
    const bw = x(a + bin) - x(a);
    const bars = Array.from({ length: n }, (_, i) =>
      el('rect', { x: x(a + i * bin) + 1, width: Math.max(1, bw - 2), y: y(0), height: 0, rx: 2, class: 'sv-bar' }, svg));

    function show(key) {
      const counts = new Array(n).fill(0);
      modes[key]().forEach((t) => {
        const i = Math.floor((t - a) / bin);
        if (i >= 0 && i < n) counts[i]++;
      });
      counts.forEach((c, i) => {
        const top = y(Math.min(c, ymax));
        bars[i].setAttribute('y', top);
        bars[i].setAttribute('height', y(0) - top);
        bars[i].style.y = `${top}px`;
        bars[i].style.height = `${y(0) - top}px`;
      });
      const peak = Math.max(...counts);
      readout.innerHTML = describe(peak, a + counts.indexOf(peak) * bin, key);
      seg.querySelectorAll('button').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.mode === key)));
    }
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) show(btn.dataset.mode);
    });
    show(seg.querySelector('button').dataset.mode);
  }

  // Request-flow picture shared by section 3 (algorithm animations) and section 4 (live NGINX demo).
  // One picture for every algorithm: requests (coins) leave the balancer (or clients → hash box)
  // Timers for a replayable animation. later()/sleep() run on wall time; snapshot() swaps in a
  // virtual clock that jumps time forward and fires due timers at once, so a whole phase finishes
  // synchronously (in microtasks) and print/PDF captures its end state.
  function clock() {
    let timers = new Set();
    let vt = null;
    const runUntil = (t) => {
      for (;;) {
        vt.queue.sort((a, b) => a.at - b.at);
        const nx = vt.queue[0];
        if (!nx || nx.at > t) break;
        vt.queue.shift(); vt.now = nx.at; nx.fn();
      }
      vt.now = Math.max(vt.now, t);
    };
    const later = (fn, ms) => {
      if (vt) { vt.queue.push({ at: vt.now + ms, fn }); return; }
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id);
    };
    const sleep = (ms) => {
      if (vt) { runUntil(vt.now + ms); return Promise.resolve(); }
      return new Promise((res) => later(res, ms));
    };
    return {
      later, sleep,
      virtual: () => vt != null,
      snapshot(phase, api) { vt = { now: 0, queue: [] }; phase(api); },
      cancel() { vt = null; timers.forEach(clearTimeout); timers = new Set(); },
    };
  }

  // Bind a widget to a slide's -> steps. Phase k plays when the presenter reaches data-step k;
  // every phase replays from a clean state, so <- works too, and the # -replay button reruns it.
  // Needs #<id>-flow, #<id>-readout and #<id>-replay, and a widget with reset/later/snapshot.
  function steps(id, widget, phases) {
    const svg = $(`${id}-flow`), slide = svg.closest('.slide');
    const readout = $(`${id}-readout`);
    widget.say = (html) => { readout.innerHTML = html; };
    let key = null;
    const phaseNow = () => Math.min(phases.length - 1,
      Math.max(0, ...[...slide.querySelectorAll('[data-step].shown')].map((n) => Number(n.dataset.step))));
    const run = (p) => {
      widget.reset();
      widget.say('');
      widget.later(() => phases[p](widget), 600);
    };
    const check = () => {
      const k = slide.classList.contains('active') ? phaseNow() : -1;
      if (k === key) return;
      key = k;
      if (k < 0) widget.reset(); else run(k);
    };
    const last = () => widget.snapshot(phases[phases.length - 1]);
    // Print / PDF shows every slide at its last step; ?print renders that state on load (headless export).
    if (new URLSearchParams(location.search).has('print')) { last(); return; }
    addEventListener('beforeprint', last);
    addEventListener('afterprint', () => { key = null; check(); });
    new MutationObserver(check).observe(slide, { attributes: true, subtree: true, attributeFilter: ['class'] });
    $(`${id}-replay`).addEventListener('click', () => { if (key >= 0) run(key); });
    widget.reset();
  }

  // A hand-drawn scene for slides whose picture isn't a balancer-and-servers flow.
  // draw() lays out the fixed parts once and returns handles for the phases to use; everything a
  // phase draws goes in api.layer, which reset() wipes. A handle named clear() undoes any change a
  // phase made to a fixed node.

  // ---------- actor glyphs ----------
  // The pictures in the sprite (#gl-client, #gl-internet, #gl-balancer, #gl-server, #gl-pod).
  // A diagram draws the actor itself; its name goes beside or under the picture, never inside a
  // box. State is ink: 'hot' = the one being chosen, 'risk' = failing, 'quiet' = out of play.
  const GL = { 'ic-client': 'gl-client', 'ic-balancer': 'gl-balancer', 'ic-pod': 'gl-pod',
               'ic-server': 'gl-server', 'ic-globe': 'gl-internet', 'ic-users': 'gl-client' };
  // scenes already speak in box classes, so one word covers both vocabularies
  const STATE = { 'sv-box': '', 'sv-box-hot': 'gl-hot', 'sv-box-risk': 'gl-risk', '': '',
                  hot: 'gl-hot', risk: 'gl-risk', quiet: 'gl-quiet' };
  const SHELL = { 'sv-box': 'gl-shell', 'sv-box-hot': 'gl-shell-hot', 'sv-box-risk': 'gl-shell-risk' };

  function glyph(p, { icon, x, y, size, state = '' }) {
    const g = el('use', { href: `#${GL[icon] || icon}`, x, y, width: size, height: size,
                          class: `gl ${STATE[state] ?? state ?? ''}`.trim() }, p);
    // the scenes drive state with setAttribute('class', 'sv-box-hot'); keep that working, whether
    // a caller reaches for set() or for the plain DOM call
    const raw = g.setAttribute.bind(g);
    g.set = (cls) => raw('class', `gl ${STATE[cls] ?? cls ?? ''}`.trim());
    g.setAttribute = (k, v) => (k === 'class' ? g.set(v) : raw(k, v));
    return g;
  }

  // An actor in a scene. Layouts:
  //   'row'   picture on the left, name and sub-line beside it
  //   'stack' picture centred on the node, name and sub-line under it
  //   'head'  an enclosure the caller draws into (a balancer's connection table): hairline shell,
  //           picture in its top-left corner, name beside it
  // `b` is a handle, not a rect: b.setAttribute('class', 'sv-box-hot' | 'sv-box-risk' | 'sv-box')
  // still recolours the actor, so every existing scene keeps working.
  function node(p, { x, y, w, h, icon, cls = 'sv-box', layout = 'row', size, title, titleCls = 'sv-lbl', sub, subCls = 'sv-lbl-sm' }) {
    const g = el('g', { class: 'node' }, p);
    const head = layout === 'head', mid = layout === 'stack';
    const gs = size || (head ? 34 : mid ? Math.min(48, Math.max(36, h - 44)) : Math.min(46, Math.max(38, h - 18)));
    let shell = null, gx, gy, tx, ty0;
    if (head) {
      shell = el('rect', { x, y, width: w, height: h, rx: 12, class: SHELL[cls] || 'gl-shell' }, g);
      gx = x + 6; gy = y + 8; tx = gx + gs + 12; ty0 = gy + gs * 0.62;
    } else if (mid) {
      gx = x + (w - gs) / 2; gy = y + (h - gs) / 2; tx = x + w / 2; ty0 = gy + gs + 24;
    } else {
      gx = x + 2; gy = y + (h - gs) / 2; tx = gx + gs + 14; ty0 = y + h / 2 - 4;
    }
    const pic = glyph(g, { icon, x: gx, y: gy, size: gs, state: cls });
    const anchor = mid ? { 'text-anchor': 'middle' } : {};
    let ttl = null, sb = null;
    if (title != null) ttl = el('text', { x: tx, y: ty0, class: titleCls, ...anchor }, g, title);
    if (sub != null) sb = el('text', { x: tx, y: mid ? ty0 + 21 : y + h / 2 + 16, class: subCls, ...anchor }, g, sub);
    // shell and picture move together, so a scene that reddens the node reddens both
    const b = { setAttribute: (k, v) => { if (k !== 'class') return; pic.set(v); shell && shell.setAttribute('class', SHELL[v] || 'gl-shell'); } };
    return { g, b, pic, shell, tile: pic, tx, title: ttl, sub: sb };
  }

  function scene(svg, viewBox, draw) {
    svg.setAttribute('viewBox', viewBox);
    const clk = clock();
    const api = { sleep: clk.sleep, later: clk.later, virtual: clk.virtual };
    Object.assign(api, draw(svg, api) || {});
    // appended after draw(), so what a phase draws paints on top of the fixed scenery
    api.layer = el('g', {}, svg);
    api.reset = () => { clk.cancel(); api.layer.replaceChildren(); api.clear && api.clear(); };
    api.snapshot = (phase) => { api.reset(); clk.snapshot(phase, api); };
    return api;
  }

  // and land in a server. The hub box shows what the balancer "knows" when it picks.
  // Each slide's → steps pick a phase; every phase replays from a clean state, so going back works.
  const FLY = 900; // ms for one coin hop; matches .coin-fly in deck.css
  function flow(svg, { servers, slots = servers.length, clients = null, title = 'load balancer', backend = 'gl-server', stat }) {
    // the picture takes the left of each row, so the row starts further left than it used to and
    // the name/counter column keeps its old width; with a client column there is no room to move,
    // but those slides carry short counters
    const W = 720, H = 330, GAP = 12, SX = clients ? 450 : 410, SW = W - SX;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const bh = (H - GAP * (slots - 1)) / slots;
    const hub = clients ? { x: 205, y: H / 2 - 48, w: 212, h: 96 } : { x: 0, y: H / 2 - 82, w: 220, h: 164 };
    const out = { x: hub.x + hub.w, y: H / 2 };
    const paths = el('g', {}, svg);

    // the balancer is drawn as itself; the shell holds what it knows when it picks
    const HG = clients ? 36 : 40;
    el('rect', { x: hub.x, y: hub.y, width: hub.w, height: hub.h, rx: 12, class: 'gl-shell-hot' }, svg);
    glyph(svg, { icon: 'gl-balancer', x: hub.x + 6, y: hub.y + 8, size: HG, state: 'hot' });
    el('text', { x: hub.x + HG + 18, y: hub.y + 26 + (clients ? 6 : 4), class: 'sv-hot' }, svg, title);
    const lines = (clients ? [0, 1] : [0, 1, 2, 3]).map((i) =>
      el('text', { x: hub.x + 14, y: hub.y + HG + 26 + i * 25, class: 'sv-code' }, svg));

    // picture on the left of each row, name and counters beside it, coins stacking underneath
    const SG = Math.min(42, Math.max(30, bh - 14)), TX = SX + SG + 12;
    const S = servers.map((d, i) => {
      const y = i * (bh + GAP);
      const g = el('g', { class: 'flow-srv' }, svg);
      const pic = glyph(g, { icon: backend, x: SX, y: y + (bh - SG) / 2, size: SG });
      const box = { setAttribute: (k, v) => { if (k === 'class') pic.set(v); } };
      el('text', { x: TX, y: y + 22, class: 'sv-lbl' }, g, d.name);
      const sub = el('text', { x: TX, y: y + 39, class: 'sv-lbl-sm' }, g);
      const st = el('text', { x: SX + SW - 12, y: y + 22, class: 'sv-tick', 'text-anchor': 'end' }, g);
      const path = el('path', {
        d: `M${out.x} ${out.y} C${out.x + 90} ${out.y} ${SX - 90} ${y + bh / 2} ${SX - 3} ${y + bh / 2}`,
        class: 'sv-line-soft',
      }, paths);
      return { d, i, y, g, box, sub, st, path };
    });

    const C = clients && clients.map((c, i) => {
      const rowH = H / clients.length, y = i * rowH + rowH / 2;
      const g = el('g', { class: 'flow-srv' }, svg);
      glyph(g, { icon: 'gl-client', x: 0, y: y - 21, size: 42 });
      el('text', { x: 54, y: y - 3, class: 'sv-lbl' }, g, c.name);
      el('text', { x: 54, y: y + 14, class: 'sv-tick' }, g, c.ip);
      el('path', { d: `M168 ${y} C210 ${y} 210 ${H / 2} ${hub.x - 3} ${H / 2}`, class: 'sv-line-soft' }, g);
      return { ...c, y, g };
    });

    const coins = el('g', {}, svg);
    const slot = (s, k) => [TX + 12 + k * 28, s.y + bh - 18];
    const put = (g, x, y) => { g.style.transform = `translate(${x}px, ${y}px)`; };
    const fly = (g, x, y) => { if (clk.virtual()) { put(g, x, y); return; } void g.getBoundingClientRect(); put(g, x, y); };
    const coin = (label, cls, x, y) => {
      const g = el('g', { class: `coin coin-fly ${cls}` }, coins);
      el('circle', { r: 12 }, g);
      el('text', {}, g, label);
      put(g, x, y);
      return g;
    };

    const clk = clock();
    const { later, sleep } = clk;
    const home = new Map();

    const api = {
      S, C, sleep, later, FLY,
      lb(...txt) { lines.forEach((t, i) => { t.textContent = txt[i] || ''; }); },
      sub(i, txt) { S[i].sub.textContent = txt; },
      mark(i, cls) { S[i].box.setAttribute('class', cls); },
      show(i, on) { S[i].g.classList.toggle('flow-hidden', !on); S[i].path.classList.toggle('flow-hidden', !on); },
      showClient(i, on) { C[i].g.classList.toggle('flow-hidden', !on); },
      update() { S.forEach((s) => { s.st.textContent = stat(s); }); },
      flash(s) {
        s.path.setAttribute('class', 'sv-hot-line');
        later(() => s.path.setAttribute('class', 'sv-line-soft'), 450);
      },
      relayout(s) { s.coins.forEach((c, k) => fly(c.g, ...slot(s, k))); },
      // balancer → server; dur > 0 means the request finishes and leaves after dur ms
      send(i, { label = '', cls = '', dur = 0, work = 0 } = {}) {
        const s = S[i];
        const item = { g: coin(label, cls, out.x - 12, out.y) };
        api.flash(s);
        s.coins.push(item); s.total++; s.active++; s.work += work;
        s.peak = Math.max(s.peak, s.active);
        fly(item.g, ...slot(s, s.coins.length - 1));
        api.update();
        if (dur) later(() => api.finish(i, item), dur);
        return item;
      },
      // the request finished: its coin leaves the server
      finish(i, item) {
        const s = S[i];
        const k = s.coins.indexOf(item);
        if (k < 0) return;
        s.coins.splice(k, 1); s.active--;
        item.g.classList.add('gone');
        later(() => item.g.remove(), 400);
        api.relayout(s); api.update();
      },
      // a refused attempt: the coin reaches the server, turns red and falls away
      bounce(i, label = '') {
        const s = S[i];
        const g = coin(label, '', out.x - 12, out.y);
        api.flash(s);
        const [x, y] = slot(s, s.coins.length);
        fly(g, x, y);
        later(() => { g.classList.add('risk'); fly(g, x - 30, y + 26); }, FLY - 100);
        later(() => g.classList.add('gone'), FLY + 300);
        later(() => g.remove(), FLY + 700);
      },
      // client → hash box → server; the server keeps one session coin per user.
      // returns 'hit' (session found), 'new', or 'lost' (user had a session on another server)
      async visit(ci, i, { instant = false } = {}) {
        const c = C[ci], s = S[i];
        const g = coin(c.tag, '', 170, c.y);
        if (!instant) {
          fly(g, hub.x + hub.w / 2, hub.y + hub.h - 14);
          await sleep(FLY + 50);
          api.flash(s);
        }
        // decide (and reserve the session slot) before the coin lands, so overlapping visits agree
        const have = s.sessions.get(c.tag);
        const prev = have ? null : home.get(c.tag);
        let item = null;
        if (!have) {
          item = { g };
          s.coins.push(item); s.sessions.set(c.tag, item); home.set(c.tag, { s, item });
        }
        const [x, y] = slot(s, s.coins.indexOf(have || item));
        instant ? put(g, x, y) : fly(g, x, y);
        s.total++;
        api.update();
        if (!instant) await sleep(FLY);
        if (have) {
          g.remove();
          have.g.classList.add('hit');
          later(() => have.g.classList.remove('hit'), 700);
        } else if (prev) {
          prev.item.g.classList.add('old');
          g.classList.add('risk');
        }
        api.update();
        return have ? 'hit' : prev ? 'lost' : 'new';
      },
      // run a phase on the virtual clock: the end state is on screen before the next paint
      snapshot(phase) { api.reset(); clk.snapshot(phase, api); },
      reset() {
        clk.cancel();
        coins.replaceChildren(); home.clear();
        S.forEach((s) => {
          Object.assign(s, { coins: [], sessions: new Map(), total: 0, active: 0, work: 0, peak: 0 });
          s.box.setAttribute('class', 'sv-box');
          s.sub.textContent = s.d.sub || '';
          api.show(s.i, !s.d.hidden);
        });
        C && C.forEach((c, i) => api.showClient(i, !c.hidden));
        api.update();
      },
    };
    return api;
  }

  window.Charts = { el, scale, fmt, $, rng, histogram, flow, clock, steps, scene, node, glyph };
})();
