// Ambient network behind the active slide: faint links between nodes, a few packets travelling
// along them, and a node pulse when a packet arrives. It is the deck's one piece of ambient motion.
// One canvas is moved into whichever slide deck.js announces ('deck:slide') and takes that
// slide's --accent. Reduced motion: the network is drawn once, without packets.
(() => {
  const W = 1280, H = 720, PACKETS = 8, SPEED = 95; // px / s
  const canvas = document.createElement('canvas');
  canvas.className = 'backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Deterministic layout: a jittered 8 × 5 grid, each node linked to its two nearest neighbours.
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const nodes = [];
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      nodes.push({ x: ((gx + 0.5) * W) / 8 + (rand() - 0.5) * 90, y: ((gy + 0.5) * H) / 5 + (rand() - 0.5) * 70, pulse: 0 });
    }
  }
  const links = [];
  nodes.forEach((a, i) => {
    nodes.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => { if (!links.some(([p, q]) => (p === j && q === i) || (p === i && q === j))) links.push([i, j]); });
  });

  const packets = [];
  const spawn = () => {
    const [i, j] = links[Math.floor(rand() * links.length)];
    const [a, b] = rand() < 0.5 ? [nodes[i], nodes[j]] : [nodes[j], nodes[i]];
    packets.push({ a, b, len: Math.hypot(b.x - a.x, b.y - a.y), d: -rand() * 400 });
  };

  let host = null, accent = '#7aa2f7', ink = '#c0caf5', last = 0, raf = 0, sampled = 0;
  const readColors = () => {
    if (!host) return;
    const cs = getComputedStyle(host);
    accent = cs.getPropertyValue('--accent').trim() || accent;
    ink = cs.getPropertyValue('--ink').trim() || ink;
  };

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (now - sampled > 500) { readColors(); sampled = now; } // picks up the T theme toggle
    ctx.clearRect(0, 0, W, H);

    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    links.forEach(([i, j]) => { ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); });
    ctx.stroke();

    nodes.forEach((n) => {
      n.pulse = Math.max(0, n.pulse - dt * 1.4);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2); ctx.fill();
      if (n.pulse > 0) {
        ctx.globalAlpha = n.pulse * 0.45;
        ctx.strokeStyle = accent;
        ctx.beginPath(); ctx.arc(n.x, n.y, 3 + (1 - n.pulse) * 14, 0, Math.PI * 2); ctx.stroke();
      }
    });

    if (!reduce.matches) {
      while (packets.length < PACKETS) spawn();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k];
        p.d += SPEED * dt;
        if (p.d < 0) continue; // staggered start
        if (p.d >= p.len) { p.b.pulse = 1; packets.splice(k, 1); continue; }
        const t = p.d / p.len, t0 = Math.max(0, (p.d - 46) / p.len);
        const x = p.a.x + (p.b.x - p.a.x) * t, y = p.a.y + (p.b.y - p.a.y) * t;
        const grad = ctx.createLinearGradient(p.a.x + (p.b.x - p.a.x) * t0, p.a.y + (p.b.y - p.a.y) * t0, x, y);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, accent);
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.a.x + (p.b.x - p.a.x) * t0, p.a.y + (p.b.y - p.a.y) * t0);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;
    raf = reduce.matches ? 0 : requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  document.addEventListener('deck:slide', (e) => {
    host = e.detail;
    host.prepend(canvas);
    readColors();
    stop();
    start();
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduce.addEventListener?.('change', () => { stop(); start(); });
})();
