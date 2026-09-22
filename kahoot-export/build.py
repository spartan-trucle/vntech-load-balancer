#!/usr/bin/env python3
"""Build the Kahoot import spreadsheet and a printable host sheet.

The full 22-question bank lives in BANK, keyed by the question numbers used in the
quiz-bank artifact. PICKED selects which ones get exported, in play order.

    pip install openpyxl reportlab && python3 build.py
"""
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# Questions to export, in the order they should be played.
PICKED = [1, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 20, 21]

SECONDS = {"easy": 20, "medium": 30, "hard": 60}

# n: (tier, question, [options], correct index, slide, why)
BANK = {
    1: ("easy",
        "For each request, what is a load balancer's core job?",
        ["Pick one healthy backend from a pool", "Cache the response",
         "Compress the response", "Encrypt the database"], 0, "slide 6",
        "Health checks decide who is allowed; the algorithm picks which one. TLS, compression and "
        "WAF are features of the box, not of load balancing."),
    2: ("easy",
        "Which is NOT one of the three ways one server fails you?",
        ["Capacity", "Availability", "Operability", "Compatibility"], 3, "slide 4",
        "Capacity is how much you can serve. Availability is surviving change you did not ask for. "
        "Operability is making change you did ask for, safely."),
    3: ("easy",
        "“Scale up” (vertical) means...",
        ["Move from 4 vCPU to 64 vCPU", "Run 16 pods of 4 vCPU each",
         "Add a second region", "Put a CDN in front"], 0, "slide 10",
        "Scaling up needs no code change but has a ceiling and one power cord. Scaling out survives "
        "a dead pod, but needs a balancer in front and an app that keeps no state in memory."),
    4: ("easy",
        "Health checks decide who is allowed. What does the algorithm decide?",
        ["Which of the allowed backends gets this request", "Whether the pod is alive",
         "How long the DNS TTL is", "Which region the user hits"], 0, "slide 6",
        "Two separate mechanisms. A pod failing its health check is out of the pool entirely, so "
        "the algorithm only ever chooses among the survivors."),
    5: ("easy",
        "An L4 balancer makes its decision using...",
        ["IP address and TCP/UDP port", "The HTTP path", "Cookies", "The request body"], 0,
        "slides 13-14",
        "It chooses once, at the SYN, and writes (src ip, src port, dst ip, dst port) -> pod into a "
        "flow table. Packets 2..N carry no routing hint, so that table is the only memory of the "
        "choice."),
    6: ("easy",
        "Round robin picks a backend by...",
        ["Whose turn it is in a fixed rotation",
         "Which server has the fewest active connections",
         "A weight you set per server",
         "A hash of the client's IP"], 0, "slide 35",
        "All four are real load balancing criteria, which is the trap: B is least connections, C is "
        "weighted round robin, D is IP hash. Round robin is one counter, servers[i++ % N], and "
        "knows only the order requests arrive - so a 3 s export and a 5 ms health check are both "
        "“one turn”."),
    7: ("easy",
        "Which algorithm gives you session affinity?",
        ["IP hash", "Round robin", "Least connections", "Weighted round robin"], 0, "slides 38, 41",
        "hash(ip) % N sends the same client to the same server every time, with no table to store. "
        "It is the only one of the four that gives affinity, and the only one that ignores load."),
    8: ("easy",
        "To the backend, a load balancer looks like...",
        ["The client", "The server", "A DNS resolver", "A router"], 0, "slide 7",
        "To the client the balancer is the server; to the backend it is the client. The backend sees "
        "the balancer's IP, so the real one has to be passed in X-Forwarded-For (L7) or PROXY "
        "protocol (L4)."),
    9: ("medium",
        "Which header carries the real client IP through an L7 balancer?",
        ["X-Forwarded-For", "Host", "User-Agent", "X-Request-ID"], 0, "slide 7",
        "The balancer terminates the client connection, so the backend's socket only ever shows the "
        "balancer's IP. X-Forwarded-For is the L7 convention for carrying the original."),
    10: ("medium",
         "Why should /healthz never query the database?",
         ["One 2 s DB blip fails every pod at once", "It is slow to write",
          "It leaks credentials", "The balancer ignores the body anyway"], 0, "slide 17",
         "A shared dependency inside the check turns “degraded” into “100% down”: every pod fails "
         "at the same moment and the pool empties. Keep the check shallow."),
    11: ("medium",
         "With least connections, what happens to a brand-new server?",
         ["It has 0 connections and gets flooded", "It is never chosen",
          "It gets exactly 1/N", "It must be given a weight first"], 0, "slide 37",
         "Zero active connections looks like “completely idle”, so it wins every comparison until "
         "it catches up. The fix is slow start: ramp it in instead."),
    12: ("medium",
         "Your app keeps the shopping cart in pod memory. Every deploy logs users out. Best fix?",
         ["Switch to IP hash so each user sticks to one pod",
          "Turn on sticky session cookies on the load balancer",
          "Move sessions to Redis so any pod can serve any user",
          "Use least connections instead of round robin"], 2, "slides 39-40",
         "Affinity only hides the problem: the pod still holds the cart, so replacing it during a "
         "deploy still loses it. IP hash also re-maps ~75% of users when the pod count changes (the "
         "rehashing problem, ch. 5). Alex Xu's fix in ch. 1 is shared session storage and a "
         "stateless web tier. Keep affinity afterwards only as a cache hint: losing it should cost "
         "a cache miss, not a logout."),
    13: ("medium",
         "Anycast fails a site over by...",
         ["Withdrawing the BGP announcement", "Lowering the DNS TTL",
          "Returning HTTP 302", "Changing the IP address"], 0, "slide 27",
         "Many sites announce the same prefix. Withdraw one and the internet re-learns the "
         "next-best path in seconds. No client needs a new answer, because the address never "
         "changed."),
    14: ("medium",
         "What does a DNS-based GSLB never see?",
         ["How loaded a region is", "Whether a region is up",
          "Roughly where the resolver is", "Your routing policy"], 0, "slide 25",
         "Its only inputs are the resolver IP and EDNS Client Subnet, its own health probes, a "
         "precomputed latency table, and your policy. A health check answers “is it up”, not “can "
         "it take more”, so a saturated healthy region keeps its full share."),
    15: ("medium",
         "Which can an L7 balancer do that an L4 balancer cannot?",
         ["Re-send a failed request to another pod", "Route traffic by domain name",
          "Terminate TLS", "Eject a failing backend from the pool"], 0, "slides 14-16",
         "Every option is a real balancer feature and L4 does three of them: it routes per domain by "
         "reading SNI in the clear, an NLB with a TLS listener terminates TLS, and health checks "
         "eject backends at both layers. Only the retry needs the request held in memory - L7 keeps "
         "a copy and can write it to a second pod, while L4 forwards each packet and forgets it."),
    16: ("medium",
         "Why does a CDN help an API even at a 0% cache hit rate?",
         ["TCP and TLS handshakes finish ~30 ms away, not ~230 ms", "It compresses the JSON",
          "It caches the errors", "It lowers origin CPU"], 0, "slide 28",
         "The edge PoP completes the connection itself, then forwards over a warm pooled connection "
         "on a private backbone. That handshake win lands even on requests that can never be "
         "cached."),
    17: ("medium",
         "What is AWS ALB's default algorithm?",
         ["Round robin", "Least outstanding requests", "Flow hash", "Random"], 0, "slide 18",
         "Least outstanding requests exists but is off until you turn it on. Two more defaults that "
         "bite: an ALB never retries, and NLB cross-zone is off and billed."),
    18: ("medium",
         "An active-passive balancer pair on a floating IP (VRRP) gives you...",
         ["No single point of failure, but no extra capacity", "Double the throughput",
          "Per-request routing", "Failover between regions"], 0, "slide 42",
         "The standby carries no traffic - it just takes the IP in seconds when the primary dies. "
         "For capacity you need active-active: ECMP spreading flows across N balancers on one IP."),
    19: ("hard",
         "Which clear-text signal lets an L4 balancer route per domain with no TLS keys?",
         ["SNI in the TLS handshake", "The Host header",
          "X-Forwarded-For", "The ALPN response"], 0, "slide 14",
         "SNI travels in the clear during the handshake, so an L4 balancer can read the hostname "
         "without decrypting anything. The Host header sits inside the encrypted stream, and "
         "reading that means terminating TLS, which makes you an L7 balancer."),
    20: ("hard",
         "A large upload stops being retryable on an L7 balancer past the buffer cap. Why?",
         ["Past the cap it keeps no copy, so there is nothing to re-send",
          "10,000 concurrent requests at 64 KB would need 640 MB",
          "It hits the 60 s idle timeout before the upload finishes",
          "The hop to the pod is plaintext, so the bytes are gone"], 0, "slide 16",
         "B, C and D are all true statements from the deck, and none of them is the reason. 640 MB "
         "is why the cap exists, not why retries stop. 60 s is the ALB's default idle timeout. The "
         "hop to the pod really is plaintext unless you re-encrypt. Retries work only because the "
         "proxy still holds the request: over the cap it stops keeping a copy and streams the bytes "
         "straight through, so there is nothing left to re-send."),
    21: ("hard",
         "Peak 200k req/s global. A node does 25k. Survive one region down plus 1 of 3 AZs. "
         "Nodes/region?",
         ["12", "8", "16", "6"], 0, "slide 32",
         "Failover moves traffic, not capacity, so size each region for the whole world: 200,000 / "
         "25,000 = 8. Then lose 1 AZ of 3, x 1.5 = 12. They normally sit at ~33% of rated load, and "
         "that idle headroom is what makes failover a non-event."),
    22: ("hard",
         "Active-active balancers behind ECMP on one IP: what breaks when you add one?",
         ["Flows re-hash onto a different balancer, like hash % N", "The floating IP is lost",
          "Health checks stop", "Certificates must be reissued"], 0, "slide 42",
         "The same failure mode as the rehashing problem, one layer up: changing N re-hashes live "
         "flows onto balancers that hold no state for them. Google's Maglev keeps them in place "
         "with consistent hashing."),
}

missing = [n for n in PICKED if n not in BANK]
if missing:
    raise SystemExit("PICKED names questions that are not in BANK: %s" % missing)

Q = []
for n in PICKED:
    tier, q, opts, right, slide, why = BANK[n]
    Q.append((n, tier, SECONDS[tier], q, opts, right, slide, why))

# ---- sanity: Kahoot's own limits -------------------------------------------------
problems = []
for n, tier, secs, q, opts, right, slide, why in Q:
    if len(q) > 120:
        problems.append("Q%d question %d chars" % (n, len(q)))
    for o in opts:
        if len(o) > 75:
            problems.append("Q%d option %d chars: %s" % (n, len(o), o))
if problems:
    raise SystemExit("over Kahoot's limits:\n  " + "\n  ".join(problems))
tiers = {}
for n, tier, *_ in Q:
    tiers[tier] = tiers.get(tier, 0) + 1
print("%d questions, all within 120/75 - %s" % (
    len(Q), ", ".join("%d %s" % (v, k) for k, v in tiers.items())))

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
ws2.append(["Play order", "Bank #", "Difficulty", "Points", "Slide", "Correct answer", "Why"])
for c in ws2[1]:
    c.font = Font(bold=True)
for i, (n, tier, secs, q, opts, right, slide, why) in enumerate(Q):
    ws2.append([i + 1, n, tier, "double" if tier == "hard" else "standard",
                slide, opts[right], why])
for col, width in zip("ABCDEFG", [10, 8, 11, 10, 14, 44, 92]):
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

doubles = sum(1 for _, tier, *_ in Q if tier == "hard")
doc = SimpleDocTemplate(os.path.join(OUT, "load-balancing-kahoot-15.pdf"),
                        pagesize=A4,
                        leftMargin=20 * mm, rightMargin=20 * mm,
                        topMargin=18 * mm, bottomMargin=16 * mm,
                        title="Load Balancing Kahoot - host sheet",
                        author="Truc Le")
flow = [Paragraph("VNTECH TALK &middot; LOAD BALANCING &middot; HOST SHEET", st_eyebrow),
        Paragraph("Kahoot: %d questions" % len(Q), st_title),
        Paragraph("%s. The %d hard %s set to <b>double points</b>. Correct answer is marked; the "
                  "note under each question is what to say after the reveal. Slide numbers refer "
                  "to the talk deck." % (
                      ", ".join("%d %s" % (tiers[k], k) for k in ("easy", "medium", "hard")
                                if k in tiers),
                      doubles, "one is" if doubles == 1 else "ones are"), st_lede),
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
