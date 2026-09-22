# Kahoot export

Quiz material for the talk — 15 questions drawn from slides 3–43 of
[`presentation/`](../presentation/). The appendix slides (44–48) and the live demo are excluded.

- `load-balancing-kahoot-15.xlsx` — Kahoot bulk-import sheet. Sheet 1 is the importer's column
  layout (question, four answers, time limit, correct answer number); sheet 2 carries the
  difficulty, slide reference and explanation, which the importer drops.
- `load-balancing-kahoot-15.pdf` — host sheet for running the game: correct answer highlighted,
  plus the line to say after each reveal.
- `build.py` — regenerates both files (`pip install openpyxl reportlab`, then `python3 build.py`).

Two things the importer cannot carry: **double points** on the three hard questions (SNI, the L7
buffer cap, 12 nodes per region), and the question numbering from the full 22-question bank — the
PDF renumbers them 1–15 in play order, and the original IDs are on the spreadsheet's second sheet.

Time limits: 20 s easy, 30 s medium, 60 s hard. Every question is within Kahoot's 120-character
limit and every answer within 75; `build.py` checks this on each run.
