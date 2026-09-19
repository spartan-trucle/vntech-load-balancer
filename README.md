# Load Balancing — vntech talk

Slides for a systems talk on load balancing by **Truc Le** and **Khanh Do**.

- [`presentation/`](presentation/) — the deck: plain HTML/CSS/JS, no build step. See its [README](presentation/README.md) to run it locally.
- [`demo/`](demo/) — "The crashed server": three Node + TypeScript backends behind NGINX, driven live from slide 4.4. See its [README](demo/README.md).
- [`presentation/load-balancer-outline.md`](presentation/load-balancer-outline.md) — talk outline and speaker split.
- `.github/workflows/deploy-pages.yml` — publishes `presentation/` to GitHub Pages on every push to `main`.

Styling and slide engine follow [spartan-nhanta/vntech-rate-limit](https://github.com/spartan-nhanta/vntech-rate-limit).
