# Load Balancing — slide deck

HTML slides for a talk about load balancing: where it happens (DNS, L4, L7, client-side), how a balancer picks a backend, what it does when one fails, and how to design a balancer tier that survives losing a region.

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

- **3.4 · One slow pod, four algorithms** — switch between round robin, random, least connections and power of two choices on the same simulated traffic.
- **3.5 · Hash-based** — add a fourth cache node and compare how many keys move with `hash % N` vs. consistent hashing.
