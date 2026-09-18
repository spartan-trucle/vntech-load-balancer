#!/usr/bin/env python3
"""Rewrite the "N / TOTAL" page number in every slide footer, in SECTIONS order from index.html.

Run after adding, removing or reordering slides:  python3 tools/renumber.py
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
index = (root / 'index.html').read_text()
names = re.findall(r"'([0-9]{2}-[a-z0-9-]+)'", index.split('const SECTIONS = [', 1)[1].split('];', 1)[0])
files = [root / 'sections' / f'{n}.html' for n in names]

foot = re.compile(r'(<div class="foot"><span>)\d+ / \d+(</span>)')
total = sum(len(foot.findall(f.read_text())) for f in files)
n = 0
for f in files:
    def sub(m):
        global n
        n += 1
        return f'{m.group(1)}{n} / {total}{m.group(2)}'
    f.write_text(foot.sub(sub, f.read_text()))
print(f'{total} slides renumbered across {len(files)} sections')
