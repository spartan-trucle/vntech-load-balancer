#!/usr/bin/env python3
"""Build the Kahoot import spreadsheet and a printable host sheet for the picked questions."""
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# (n, tier, seconds, question, [4 options], correct index 0-3, slide, why)
Q = [
    (1, "easy", 20,
     "For each request, what is a load balancer's core job?",
     ["Pick one healthy backend from a pool", "Cache the response",
      "Compress the response", "Encrypt the database"], 0, "slide 6",
     "Health checks decide who is allowed; the algorithm picks which one. TLS, compression and WAF "
     "are features of the box, not of load balancing."),
    (2, "easy", 20,
     "Which is NOT one of the three ways one server fails you?",
     ["Capacity", "Availability", "Operability", "Compatibility"], 3, "slide 4",
     "Capacity is how much you can serve. Availability is surviving change you did not ask for. "
     "Operability is making change you did ask for, safely."),
    (3, "easy", 20,
     "“Scale up” (vertical) means...",
     ["Move from 4 vCPU to 64 vCPU", "Run 16 pods of 4 vCPU each",
      "Add a second region", "Put a CDN in front"], 0, "slide 10",
     "Scaling up needs no code change but has a ceiling and one power cord. Scaling out survives a "
     "dead pod, but needs a balancer in front and an app that keeps no state in memory."),
    (5, "easy", 20,
     "An L4 balancer makes its decision using...",
     ["IP address and TCP/UDP port", "The HTTP path", "Cookies", "The request body"], 0,
     "slides 13-14",
     "It chooses once, at the SYN, and writes (src ip, src port, dst ip, dst port) -> pod into a "
     "flow table. Packets 2..N carry no routing hint, so that table is the only memory of the choice."),
    (7, "easy", 20,
     "Which algorithm gives you session affinity?",
     ["IP hash", "Round robin", "Least connections", "Weighted round robin"], 0, "slides 38, 41",
     "hash(ip) % N sends the same client to the same server every time, with no table to store. It "
     "is the only one of the four that gives affinity, and the only one that ignores load entirely."),
    (9, "medium", 30,
     "Which header carries the real client IP through an L7 balancer?",
     ["X-Forwarded-For", "Host", "User-Agent", "X-Request-ID"], 0, "slide 7",
     "The balancer terminates the client connection, so the backend's socket only ever shows the "
     "balancer's IP. X-Forwarded-For is the L7 convention for carrying the original."),
    (10, "medium", 30,
     "Why should /healthz never query the database?",
     ["One 2 s DB blip fails every pod at once", "It is slow to write",
      "It leaks credentials", "The balancer ignores the body anyway"], 0, "slide 17",
     "A shared dependency inside the check turns “degraded” into “100% down”: every pod fails at "
     "the same moment and the pool empties. Keep the check shallow."),
    (11, "medium", 30,
     "With least connections, what happens to a brand-new server?",
     ["It has 0 connections and gets flooded", "It is never chosen",
      "It gets exactly 1/N", "It must be given a weight first"], 0, "slide 37",
     "Zero active connections looks like “completely idle”, so it wins every comparison until it "
     "catches up. The fix is slow start: ramp it in instead."),
    (12, "medium", 30,
     "Your app keeps the shopping cart in pod memory. Every deploy logs users out. Best fix?",
     ["Switch to IP hash so each user sticks to one pod",
      "Turn on sticky session cookies on the load balancer",
      "Move sessions to Redis so any pod can serve any user",
      "Use least connections instead of round robin"], 2, "slides 39-40",
     "Affinity only hides the problem: the pod still holds the cart, so replacing it during a deploy "
     "still loses it. IP hash also re-maps ~75% of users when the pod count changes (the rehashing "
     "problem, ch. 5). Alex Xu's fix in ch. 1 is shared session storage and a stateless web tier. "
     "Keep affinity afterwards only as a cache hint: losing it should cost a cache miss, not a logout."),
    (13, "medium", 30,
     "Anycast fails a site over by...",
     ["Withdrawing the BGP announcement", "Lowering the DNS TTL",
      "Returning HTTP 302", "Changing the IP address"], 0, "slide 27",
     "Many sites announce the same prefix. Withdraw one and the internet re-learns the next-best path "
     "in seconds. No client needs a new answer, because the address never changed."),
    (15, "medium", 30,
     "Which can an L7 balancer do that an L4 balancer cannot?",
     ["Re-send a failed request to another pod", "Preserve the client IP",
      "Terminate TLS", "Hold a static IP"], 0, "slides 14-16",
     "The L7 proxy still holds the request bytes in memory, so it can write them to a second pod. L4 "
     "forwards each packet and forgets it, so there is nothing to replay. An NLB with a TLS listener "
     "does terminate TLS, which is what makes that option tempting."),
    (16, "medium", 30,
     "Why does a CDN help an API even at a 0% cache hit rate?",
     ["TCP and TLS handshakes finish ~30 ms away, not ~230 ms", "It compresses the JSON",
      "It caches the errors", "It lowers origin CPU"], 0, "slide 28",
     "The edge PoP completes the connection itself, then forwards over a warm pooled connection on a "
     "private backbone. That handshake win lands even on requests that can never be cached."),
    (19, "hard", 60,
     "Which clear-text signal lets an L4 balancer route per domain while holding no TLS keys?",
     ["SNI in the TLS handshake", "The Host header",
      "X-Forwarded-For", "The ALPN response"], 0, "slide 14",
     "SNI travels in the clear during the handshake, so an L4 balancer can read the hostname without "
     "decrypting anything. The Host header sits inside the encrypted stream, and reading that means "
     "terminating TLS, which makes you an L7 balancer."),
    (20, "hard", 60,
     "A large upload stops being retryable on an L7 balancer past the buffer cap. Why?",
     ["Past the cap it keeps no copy, so there is nothing to re-send", "The client cancels it",
      "The health check fails", "Re-encryption to the pod drops it"], 0, "slide 16",
     "Retries exist only because the request sits in the proxy's memory. 10,000 concurrent requests x "
     "64 KB is already 640 MB, so every balancer caps what it will buffer. Over the cap it streams the "
     "bytes straight through and retries quietly stop working."),
    (21, "hard", 60,
     "Peak 200k req/s global. A node does 25k. Survive one region down plus 1 of 3 AZs. Nodes/region?",
     ["12", "8", "16", "6"], 0, "slide 32",
     "Failover moves traffic, not capacity, so size each region for the whole world: 200,000 / 25,000 "
     "= 8. Then lose 1 AZ of 3, x 1.5 = 12. They normally sit at ~33% of rated load, and that idle "
     "headroom is what makes failover a non-event."),
]

# ---- sanity: Kahoot's own limits -------------------------------------------------
problems = []
for n, tier, secs, q, opts, right, slide, why in Q:
    if len(q) > 120:
        problems.append("Q%d question %d chars" % (n, len(q)))
    for o in opts:
        if len(o) > 75:
            problems.append("Q%d option %d chars: %s" % (n, len(o), o))
print("limit check:", problems or "all within 120/75")

# ---- 1. Kahoot import spreadsheet ----------------------------------------------
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill

wb = Workbook()
ws = wb.active
ws.title = "Kahoot import"

HEAD = ["Question - max 120 characters",
        "Answer 1 - max 75 characters",
        "Answer 2 - max 75 characters",
        "Answer 3 - max 75 characters (optional)",
        "Answer 4 - max 75 characters (optional)",
        "Time limit (sec) - 5, 10, 20, 30, 60, 90, 120, 240",
        "Correct answer(s) - choose at least one"]

ws.append(HEAD)
for c in ws[1]:
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="46178F")  # Kahoot purple
    c.alignment = Alignment(wrap_text=True, vertical="center")
ws.row_dimensions[1].height = 42

for n, tier, secs, q, opts, right, slide, why in Q:
    ws.append([q, opts[0], opts[1], opts[2], opts[3], secs, right + 1])

for col, width in zip("ABCDEFG", [62, 34, 34, 34, 34, 14, 14]):
    ws.column_dimensions[col].width = width
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical="top")
ws.freeze_panes = "A2"

# a second sheet with the host-facing detail, so nothing is lost on import
ws2 = wb.create_sheet("Host notes")
ws2.append(["#", "Difficulty", "Points", "Slide", "Correct answer", "Why"])
for c in ws2[1]:
    c.font = Font(bold=True)
for n, tier, secs, q, opts, right, slide, why in Q:
    ws2.append([n, tier, "double" if tier == "hard" else "standard",
                slide, opts[right], why])
for col, width in zip("ABCDEF", [5, 11, 10, 14, 44, 96]):
    ws2.column_dimensions[col].width = width
for row in ws2.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical="top")
ws2.freeze_panes = "A2"

xlsx_path = os.path.join(OUT, "load-balancing-kahoot-15.xlsx")
wb.save(xlsx_path)
print("wrote", xlsx_path)

# ---- 2. printable host sheet (PDF) ---------------------------------------------
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether)

INK = colors.HexColor("#1b2038")
BODY = colors.HexColor("#3e4566")
MUTED = colors.HexColor("#5b6489")
RULE = colors.HexColor("#c3cade")
OK = colors.HexColor("#1f6b33")
OKBG = colors.HexColor("#e4f1e5")
TIERC = {"easy": colors.HexColor("#0f7a66"),
         "medium": colors.HexColor("#8a5c00"),
         "hard": colors.HexColor("#b03428")}

st_title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=21, leading=24, textColor=INK)
st_lede = ParagraphStyle("l", fontName="Helvetica", fontSize=9.5, leading=14, textColor=BODY,
                         spaceBefore=6)
st_eyebrow = ParagraphStyle("e", fontName="Helvetica-Bold", fontSize=7.5, leading=10,
                            textColor=MUTED, spaceAfter=3)
st_q = ParagraphStyle("q", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK)
st_opt = ParagraphStyle("o", fontName="Helvetica", fontSize=9.5, leading=12.5, textColor=BODY)
st_optok = ParagraphStyle("ok", parent=st_opt, fontName="Helvetica-Bold", textColor=OK)
st_why = ParagraphStyle("w", fontName="Helvetica-Oblique", fontSize=8.5, leading=11.5,
                        textColor=BODY)

doc = SimpleDocTemplate(os.path.join(OUT, "load-balancing-kahoot-15.pdf"),
                        pagesize=A4,
                        leftMargin=20 * mm, rightMargin=20 * mm,
                        topMargin=18 * mm, bottomMargin=16 * mm,
                        title="Load Balancing Kahoot - host sheet",
                        author="Truc Le")
flow = [Paragraph("VNTECH TALK &middot; LOAD BALANCING &middot; HOST SHEET", st_eyebrow),
        Paragraph("Kahoot: 15 questions", st_title),
        Paragraph("Five easy, seven medium, three hard. The three hard ones are set to "
                  "<b>double points</b>. Correct answer is marked; the note under each question is "
                  "what to say after the reveal. Slide numbers refer to the talk deck.", st_lede),
        Spacer(1, 7 * mm)]

for i, (n, tier, secs, q, opts, right, slide, why) in enumerate(Q):
    tag = "%s &middot; %s s &middot; %s &middot; %s" % (
        tier.upper(), secs, "DOUBLE POINTS" if tier == "hard" else "STANDARD POINTS", slide)
    block = [Paragraph(tag, ParagraphStyle("tag", parent=st_eyebrow, textColor=TIERC[tier])),
             Paragraph("%d. %s" % (i + 1, q.replace("&", "&amp;")), st_q),
             Spacer(1, 2.5 * mm)]

    rows, style = [], [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for j, o in enumerate(opts):
        letter = "ABCD"[j]
        is_right = j == right
        rows.append([Paragraph("<b>%s</b>" % letter, st_optok if is_right else st_opt),
                     Paragraph(o.replace("&", "&amp;"), st_optok if is_right else st_opt),
                     Paragraph("correct" if is_right else "", st_optok)])
        if is_right:
            style += [("BACKGROUND", (0, j), (-1, j), OKBG),
                      ("BOX", (0, j), (-1, j), 0.6, OK)]
        else:
            style.append(("LINEBELOW", (0, j), (-1, j), 0.3, RULE))
    t = Table(rows, colWidths=[9 * mm, 122 * mm, 19 * mm], hAlign="LEFT")
    t.setStyle(TableStyle(style))
    block += [t, Spacer(1, 2.5 * mm),
              Paragraph("Why: " + why.replace("&", "&amp;"), st_why),
              Spacer(1, 6.5 * mm)]
    flow.append(KeepTogether(block))

doc.build(flow)
print("wrote", os.path.join(OUT, "load-balancing-kahoot-15.pdf"))
