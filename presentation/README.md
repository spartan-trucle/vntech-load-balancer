# Load Balancing — slide deck

HTML slides for a talk about load balancing: local load balancing inside a data center, global load balancing across regions, how a balancer picks a server, and a live NGINX demo.

Presenters: **Truc Le** and **Khanh Do**.

## View online

The deck is deployed to this repo's GitHub Pages every time someone pushes to `main`.

## Run locally

You **must open the deck over HTTP**. Double-clicking `index.html` will not work.

```bash
cd presentation
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

You can also use the **Live Server** extension in VS Code, or `npx serve presentation`.

## Export to PDF

Every slide prints at its last step, including the request animations.

- **Browser:** open the deck, press `Cmd+P` / `Ctrl+P`, choose *Save as PDF*, margins *None*.
- **Headless**, with the server running on port 8000:

  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --virtual-time-budget=8000 --no-pdf-header-footer --print-to-pdf=load-balancing.pdf \
    "http://localhost:8000/?print"
  ```

The PDF uses whichever theme is active (Tokyo Night by default; press `T` first for Day).

## Keyboard shortcuts

| Key | Action |
|---|---|
| `→` `Space` `Enter` `PageDown` | Next step |
| `←` `Backspace` `PageUp` | Previous step |
| `Home` / `End` | First / last slide |
| `O` | See all slides (click one to jump to it) |
| `T` | Switch light / dark theme |
| `F` | Full screen |
| `Esc` | Close the all-slides view |

## Interactive slides

- **3.2 – 3.6 · Round robin, weighted round robin, least connections, IP hash** — animated requests; press `→` to move to the next scenario, or click ↻ Replay.
- **4.4 · Live** — sends real requests to NGINX from [`demo/`](../demo/) (`npm start` in `demo/` first) and animates which server answered; press `S` to send 6. Without NGINX it replays a recording.
- **Appendix · One slow pod, four algorithms** — switch between round robin, random, least connections and power of two choices on the same simulated traffic.
- **Appendix · Hash-based** — add a fourth cache node and compare how many keys move with `hash % N` vs. consistent hashing.
