# Kahoot export

Quiz material for the talk, drawn from slides 3–43 of [`presentation/`](../presentation/). The
appendix slides (44–48) and the live demo are excluded.

- `load-balancing-kahoot-15.xlsx` — Kahoot bulk-import sheet. Sheet 1 is the importer's column
  layout (question, four answers, time limit, correct answer number); sheet 2 carries the play
  order, bank number, difficulty, slide reference and explanation, which the importer drops.
- `load-balancing-kahoot-15.pdf` — host sheet for running the game: correct answer highlighted,
  plus the line to say after each reveal.
- `build.py` — regenerates both files (`pip install openpyxl reportlab`, then `python3 build.py`).

## Changing the selection

`build.py` holds the full 22-question bank in `BANK`, keyed by the numbers used in the quiz-bank
artifact. Edit `PICKED` to choose which ones export, in play order, and re-run. The script sets
time limits by difficulty (20 s easy, 30 s medium, 60 s hard) and refuses to write anything that
breaks Kahoot's 120-character question or 75-character answer limits.

Currently exported: 1, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 20, 21 — six easy, seven medium,
two hard.

## What the importer cannot carry

- **Double points** on the hard questions (the L7 buffer cap and 12 nodes per region) — set that in
  the Kahoot editor after importing.
- The bank numbering. The PDF and the spreadsheet's second sheet number questions in play order and
  map back to the bank number.
