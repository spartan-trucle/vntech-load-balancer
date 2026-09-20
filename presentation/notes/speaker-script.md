# Speaker script — Load Balancing

One entry per slide, in deck order. **Say** is what to talk through; **→** lines are the
`data-step` reveals (press right arrow, then say that line); **Land on** is the sentence to
leave in the room before moving on.

Nothing here is on screen. Slide copy is the source of truth for numbers — if you change a
number on a slide, change it here too.

## Before you start

- Open the deck over HTTP (`cd presentation && python3 -m http.server 8000`), press `F` for fullscreen.
- Keys: `→` / `←` step, `O` overview, `T` light theme, `S` sends live demo requests on slide 48.
- For section 4: `cd demo && npm install && npm start` in a second terminal, before the talk.
- Check slide 48 shows a green `live · <algorithm>` chip, not `recorded`.

## Timing

| Part | Slides | Who | Budget |
|---|---|---|---|
| Cover + outline | 1–2 | Trúc | 2 min |
| 00 Introduction | 3–9 | Trúc | 10 min |
| 01 Local load balancing | 10–23 | Trúc | 18 min |
| 02 Global load balancing | 24–28 | Trúc | 8 min |
| 03 Algorithms | 29–38 | Khánh | 15 min |
| 03 Appendix (only if time / Q&A) | 39–43 | Khánh | 0–8 min |
| 04 Demo | 44–49 | Khánh | 10 min |
| Thank you + Kahoot | 50 | both | 3 min |

Running long? Skip the appendix (39–43) and slide 28. Section 1 is the other place to cut:
slides 15, 18 and 19 each stand alone, so drop them in that order. Never skip 48 — the live
demo is the part people remember.

---

# Part 0 — Introduction (Trúc)

### 1 / 50 · Cover — Load Balancing
**Say:** Hi, I'm Trúc, this is Khánh. Today: load balancing. Not the definition — the
decisions. Ten servers are only faster than one if something sends each request to a server
that is up and not already busy. That "something" is what we're talking about for the next
hour.
**Point at the picture:** pod-c is failing. The balancer noticed and split its share between
the other two. Everything today is a variation on that picture.

### 2 / 50 · Outline
**Say:** Four parts. I take the first two: where balancing happens inside one data center,
then between regions. Khánh takes how a server actually gets picked, and a live demo where we
kill a server on stage.
**Land on:** Ask questions whenever — don't save them all for the end.

### 3 / 50 · Divider 00 — Introduction
**Say:** Start with the problem, not the definition. Why does one server stop being enough,
and what exactly do you get when you put a balancer in front?

### 4 / 50 · One server fails on three separate axes
**Say:** People lump this under "scaling". It's three different problems.
- **Capacity** — you run out of machine. CPU, RAM, file descriptors, usually connections
  first. Latency is flat, flat, flat, then it's a cliff. A 64 vCPU box still has one NIC.
- **Availability** — change you did not ask for. One crash, one kernel panic, one AZ losing
  power. And note: running three instances fixes nothing on its own. If nothing notices pod-b
  is dead, a third of your traffic still goes there.
- **Operability** — change you *did* ask for. Deploys, patches, rollbacks. On one server every
  deploy is a restart, and a restart is ninety seconds of 502s with no way back.

**→ 1:** Capacity is how much you can serve. Availability is surviving change you didn't ask
for. Operability is making change you did ask for, safely.
**Land on:** Most of your changes are planned. That's why operability bites even a service
that fits comfortably on one box.

### 5 / 50 · Three servers, but every user still hits the first one
**Say:** Concrete version. Ten thousand users, three servers. DNS points `api.shop.vn` at
10.0.1.11, so server-1 is at 100% CPU with a p99 of 4.2 seconds, and servers 2 and 3 are at
3%. You paid for three machines and you're using one.
**→ 1:** Put a balancer behind the name. Same three machines, ~35% CPU each, p99 180
milliseconds.
**Land on:** More servers only help if something splits the traffic. Clients know one
hostname; something behind that name has to pick a server for every request.

### 6 / 50 · What a load balancer is
**Say:** Four words you'll hear all day, so let's fix them now.
- **listener** — the port the balancer holds open, `:443` with the certificate. Clients
  connect here, never to a pod.
- **algorithm** — how it picks one backend, per request.
- **pool** — the backends it's allowed to send to.
- **health** — which of those may be picked *right now*.

Read the log: three requests round robin across a, b, c. Then health check fails pod-b three
times, marks it down — and the very next request goes to pod-c. Nobody got an error.
**→ 1:** Clients never learn the backend IPs, so you can add, remove or restart pods without
anyone changing config.
**Land on:** Health decides who's allowed. The algorithm picks which one of those.

### 7 / 50 · Forward proxy, reverse proxy, load balancer
**Say:** These three get used interchangeably and they're not the same.
- **Forward proxy** sits in front of the *clients* and hides who they are — corporate egress,
  VPN, a crawler. Many origins on the far side.
- **Reverse proxy** sits in front of the *server* and hides how many there are — TLS, cache,
  WAF. One origin.
- **Load balancer** is a reverse proxy that also *picks*. N origins, a decision per request.

Every load balancer is a reverse proxy. A reverse proxy with one upstream is not a load
balancer. NGINX, HAProxy, Envoy are all three depending on config — which is exactly why the
words get mixed up.
**→ 1:** And the consequence you'll hit in week one: to the client the LB *is* the server, to
the backend the LB *is* the client. Your backend sees the balancer's IP, not the user's. Pass
the real one in `X-Forwarded-For`, or PROXY protocol at L4, *before* you rate-limit or log by
IP.

### 8 / 50 · Scale up vs scale out
**Say:** Two ways to get more capacity. Up: 4 vCPU to 64. No code change, and that's the
appeal — but there's a biggest instance type, the price per core gets worse near the top, and
it's still one power cord. Out: sixteen small pods. Add as traffic grows, lose one without an
outage. Needs a balancer, and needs an app that keeps no user state in memory.
**→ 1:** That last part is the real work. If a user's cart lives in pod memory, the next
request lands on another pod and the cart is empty. Session in Redis or the DB *first*, then
scale out.

### 9 / 50 · Three jobs
**Say:** So what do you actually get? Three things. Spread the load — 600 req/s across three
pods is about 200 each, not 600 on one. Route around failure — health checks pull a bad
backend in seconds and put it back when it recovers. Hide change — drain a pod, replace it,
add it back; canary 5% to v2; clients see one stable address the whole time.
**→ 1:** Real balancers do more — TLS termination, HTTP/2, compression, WAF. Useful, but those
are features of the box, not of load balancing.
**Land on:** Keep those three jobs in mind; everything in the next three sections is one of
them done better.

---

# Part 1 — Local load balancing (Trúc)

### 10 / 50 · Divider 01
**Say:** Zoom into one data center. East-west traffic between your own services, and the
choice that shapes everything else: which layer does the balancer work at?

### 11 / 50 · Back to the OSI model
**Say:** Quick reset on the OSI model, because the next ten slides all hang off it. Seven
layers. A load balancer only ever sits on two of them: layer 4, transport — TCP, UDP, ports —
and layer 7, application — HTTP, gRPC, headers, cookies.
**→ 1:** And those two have names you already use. A balancer at layer 4 is what AWS sells as
an **NLB**, a Network Load Balancer. At layer 7 it's an **ALB**, an Application Load Balancer.
Same split outside AWS: HAProxy `mode tcp` and kube-proxy at L4, NGINX and Envoy at L7.
**→ 2:** Layers 1 to 3 are the network's job — IP routing, Ethernet — nothing you configure on
a balancer. Layers 5 and 6 barely exist in practice; TCP/IP folds them into TLS.
**Land on:** Whenever someone asks "NLB or ALB?", they are asking "layer 4 or layer 7?".

### 12 / 50 · A packet is not a request
**Say:** Before we can compare L4 and L7 we have to agree on what is actually on the wire.
Seven packets arriving in order. Nothing on the wire marks where a request starts or ends.
**→ 1:** Open one packet up. IP header, TCP header, payload. An L4 balancer reads the two
headers — addresses and ports — and stops. It never touches the payload. Postal analogy: L3 is
the street address, L4 is the apartment number plus "envelope 3 of 7, open in order", L7 is the
letter inside. The postal service never reads the letter.
**→ 2:** Here is the same traffic once somebody *has* read it: one TCP connection, opened once,
carrying three requests. L4 chose a backend when this pipe opened. L7 chooses three times.
**Land on:** Reassembling the stream and parsing it is real work. **That work is the whole
difference**, and everything else follows from it.

### 13 / 50 · How an L4 balancer works
**Say:** Watch the SYN. The balancer hashes the four-tuple, picks pod-b, and writes a row in its
connection table. Then packets 2, 3, 4, 5 arrive — and they carry no hint about where they
should go, so all they can do is look up the row. One decision, made once, at connection setup.
**→ 1:** TLS. Encrypted bytes forward exactly like plain ones, because it was never going to
read them anyway. The one L7-ish thing it gets is the SNI hostname, sent in the clear during
the handshake — that's how an L4 balancer does per-domain routing while holding no private key.
**→ 2:** pod-b dies mid-stream. The balancer kept no copy of the bytes and shares one
end-to-end connection with the client, so there is nothing to re-send and nowhere to send it.
The client gets a reset.
**Land on:** And notice the table is *state*. Restart the balancer and every live connection
resets with it.

### 14 / 50 · How an L7 balancer works
**Say:** Completely different machine. It finishes the handshake with the client on conn A,
reads the whole request into memory, decides, then writes it onto its *own* connection to
pod-a. Two TCP connections glued together by a program. Second request on the same client
connection goes to pod-c — an L4 balancer could never do that, it already committed the pipe.
**→ 1:** TLS is not optional here. No decryption means no HTTP to parse, so the private key and
cert rotation move to the balancer, and the hop to the pod is plaintext unless you re-encrypt.
**→ 2:** Now pod-b dies. The proxy still has the bytes in memory, so it writes the same request
to pod-c on a fresh connection. The user sees one slightly slower 200.
**Land on:** "It holds the request" is the sentence that explains retries, canaries, per-request
metrics — everything on the L7 side of the table.

### 15 / 50 · The balancer is just a program
**Say:** Say that sentence out loud: it holds the request in memory. That means a heap, exactly
like the services you write. NGINX, HAProxy, Envoy are Linux processes with an RSS you can read
in `top`. An ALB is Amazon's fleet of the same thing. A mesh sidecar is Envoy in a pod next to
yours. Each request in flight costs a buffer: 10,000 concurrent × 64 KB is 640 MB.
**→ 1:** Which is why the limit exists — 10,000 × 10 MB is an OOM. A 10 MB upload arrives, goes
past the limit, and the proxy switches to *streaming*: bytes pass straight through, nothing is
kept.
**→ 2:** And now retries are dead. Still configured, still enabled, but the copy they would
re-send no longer exists. This is the bug people spend an afternoon on.
**Land on:** A pure L4 balancer can live in the kernel — IPVS, eBPF at the NIC — and allocates
nothing but a table row. **That** is the order-of-magnitude difference in cost.

### 16 / 50 · Health checks
**Say:** Both kinds of balancer have to answer "is this backend alive". Active probes on a
timer: `GET /healthz` every 5 seconds. pod-c starts failing — one failure is not enough to act
on, it could be a blip. Three in a row, and it's out.
**Do the arithmetic on screen:** 5 seconds × 3 failures is up to 15 seconds of real errors
before ejection, plus whatever was already in flight. Tighten the interval and you buy speed
with false positives. Sane default: 5 s, 3 out, 2 back in.
**→ 1:** Passive, or outlier detection: watch real traffic and eject on errors. Free, and it
catches what active misses — `/healthz` cheerfully returning 200 while every real request 500s.
Run both.
**→ 2:** The gotcha. Put a database check inside `/healthz` and a two-second DB blip fails every
pod at the same instant. Degraded just became 100% down. Then panic mode: below 50% healthy,
good balancers ignore health entirely and balance across everyone, because at that point the
signal is likelier broken than the fleet.
**Land on:** Keep the balancer's check shallow — *is this process able to serve* — and put
dependency checks on a separate endpoint that only pages you.

### 17 / 50 · L4 vs. L7, side by side
**Say:** Now the comparison, and every row falls out of one thing: one connection, or two. Per
connection vs. per request. Ports vs. paths and headers. Passthrough vs. termination. Retries
impossible vs. possible. No status codes vs. p99 per route. And roughly a 10× cost gap.
**→ 1:** The answer in practice is usually "both". A cheap stateless L4 layer at the edge
absorbs the connections and spreads them over a fleet of L7 proxies doing the smart routing.
That is roughly what every hyperscaler runs, and it is the shape of slide 21.
**Land on:** Pick L4 when it isn't HTTP or you need raw throughput and a static IP. Pick L7 when
you want routing, retries and per-request numbers — which is most web and API traffic.

### 18 / 50 · NLB and ALB in practice
**Say:** NLB is L4, ALB is L7 — that part is easy. These four are the ones that cost people a
day.
**→ 1:** One: an NLB *does* terminate TLS if you give it a TLS listener. It decrypts and still
balances by flow hash, because it never parses HTTP. Decrypting and understanding are separate
abilities. Two: an ALB does not retry — a 5xx from your pod reaches the user.
**→ 2:** Three: ALB defaults to round robin; least outstanding requests is the setting that
copes with uneven request cost and it is off by default. Four: cross-zone is on and free for
ALB, off and billed for NLB — which is how an AZ with one pod ends up taking the same traffic
as an AZ with five.
**Land on:** Also note NLB's algorithm is not configurable at all. Everything in section 3 about
choosing an algorithm applies to your ALB, not your NLB.

### 19 / 50 · Check yourself
**Say:** Four questions. Take them one at a time and let the room answer before you reveal.
**→ 1:** Retries: L7 still holds the parsed request on a connection it owns. L4 kept no copy.
**→ 2:** Passthrough: SNI, and nothing below it.
**→ 3:** Deep health checks: they correlate every pod to one dependency.
**→ 4:** The 10 MB upload: past the buffer limit the proxy streams, so there is no copy to
re-send.
**Land on:** If those four land, you know what a balancer *can* know. The rest of the talk is
about how it picks.

### 20 / 50 · One address, many pools
**Say:** This is what you buy with L7. One listener on 443. `/api` goes to the API pool,
`/ws` to the socket pool, `/static` to the CDN origin — they scale separately, on different
pod types. Canary: 5% of `/api` to v2 by weight; watch the error rate, then 25, then 100.
Internal testers send `X-Canary: true` and always get v2.
**→ 1:** An L4 balancer can do none of this. It never sees the path. It picks a server for the
whole connection and that's the end of its involvement.

### 21 / 50 · The path on AWS EKS
**Say:** In practice it's not one balancer, it's four hops. Route 53 picks a region. The ALB
picks a node or pod IP. The ingress controller picks a pod. The Service, through kube-proxy,
handles pod-to-pod calls. Four things that each have their own algorithm and their own idea of
"healthy" — look at the table: round robin at the ALB, round robin at the ingress, and at the
Service layer iptables picks *randomly* per connection.
**→ 1:** External traffic can skip hop four entirely — with the ingress sending straight to
pod IPs, the Service is only used for internal calls. And there it balances connections, not
requests. Remember that when we get to gRPC.
**Land on:** When load looks uneven, first ask *which* of these four made the decision.

### 22 / 50 · Client-side balancing
**Say:** For service-to-service calls you can drop the middle box. A gRPC client with
`round_robin` plus a headless Service opens one connection per pod and spreads calls itself. A
service mesh does the same with a sidecar next to every pod — your code calls localhost.
Saves a hop and the thing you'd otherwise have to scale and monitor.
**→ 1:** Same call, no middle box: the picker lives inside order-svc, which gets the pod list
from a headless Service or a registry.
**→ 2:** The cost: every client needs the pod list and has to refresh it. A stale list sends
calls to pods that no longer exist, and now that bug lives in every service instead of one.

### 23 / 50 · Who balances the balancer?
**Say:** Everything in front of your app is now a single point of failure with a nicer name.
Four answers. Active-passive with VRRP: a floating IP, one to three seconds to fail over, half
your hardware idle, and split brain if both think they're primary. Active-active with ECMP or
anycast: fast, but a node change can move existing flows — that's why Maglev-style consistent
hashing exists. Managed: the cloud runs the fleet, but ALB scales gradually, so a flash sale
from zero can 5xx for minutes. Client-side: no central balancer at all.
**Land on:** Whichever you pick, test it. An untested failover is a hypothesis.

---

# Part 2 — Global load balancing (Trúc)

### 24 / 50 · Divider 02
**Say:** Now between regions. Different problem: the thing making the decision is usually
DNS, and DNS can't see health or load.

### 25 / 50 · DNS: return several IPs and let the client pick
**Say:** Cheapest possible balancing — put three A records on the name, the resolver rotates
them. Fine until something dies. Look at the timeline: 10.0.1.12 dies at 12:00, you pull the
record immediately, and clients keep sending to it until 12:05, because the TTL was 300
seconds. Resolvers cache, the OS caches, and some JVMs cache forever.
**→ 1:** DNS has no health and no load information — a client can't tell a busy IP from an
idle one.
**Land on:** Use DNS to pick a *region*, then a real balancer inside that region to pick a
*server*.

### 26 / 50 · Architecture
**Say:** Put the whole stack together. Route 53 with latency routing and health checks, TTL
60 seconds, picks Singapore or Tokyo. Inside a region: NLB at L4 across three AZs for cheap,
stateless entry; an Envoy fleet doing TLS and L7 routing; then thirty services, each with a
sidecar doing per-call gRPC balancing. Four layers, and each one exists because the layer
above it can't see what it sees.

### 27 / 50 · Losing a region
**Say:** Singapore goes dark at ten o'clock. Health check needs three failures — thirty
seconds. New lookups get Tokyo only. TTL expires for most resolvers at 10:01:30. A few clients
that ignore TTLs are still hitting Singapore at 10:05. Meanwhile Tokyo's p99 goes from 90 to
310 milliseconds, the HPA takes a minute and a half to add pods, and it recovers by 10:02:30.
**→ 1:** Here's the trap. Failover moves the *traffic*, not the *capacity*. If Tokyo can't
take 100% right now, you've just turned a one-region outage into a two-region outage.

### 28 / 50 · Capacity
**Say:** So size for it. Peak 200,000 req/s globally. If one region is down the survivor takes
all of it. Measure your own node — say an Envoy node does 25,000 req/s at 60% CPU. That's
eight nodes, times 1.5 to survive losing one AZ of three, so twelve per region, normally
running at a third of rated load. That idle headroom *is* the failover plan. Count connections
too: 400,000 WebSockets at ~50 KB each is 20 GB of memory across the fleet.
**→ 1:** Then prove it. Game day: drain one region on purpose, during business hours, and
watch p99 and 5xx.

> Hand over to Khánh here.

---

# Part 3 — Algorithms (Khánh)

### 29 / 50 · Divider 03
**Say:** I'm Khánh. One question for every algorithm on the next ten slides: what does the
balancer actually look at? Order, configured capacity, live load, or who the client is.

### 30 / 50 · What is a load balancing algorithm?
**Say:** First, separate two things people merge. Health checks decide which servers are
*allowed*. The algorithm picks one *of those*, for this request, using whatever information it
has. Static means fixed rules, blind to what servers are doing right now. Dynamic means it
reads live server state — and only one of our four is dynamic.
**→ 1, 2, 3:** (reveal rows) order → round robin. Configured capacity → weighted. Live
connection counts → least connections, the only dynamic one. Client IP → IP hash.
**Land on:** For each one ask two questions: what does it know, and what does it *ignore*? The
ignored part is always where it breaks.

### 31 / 50 · Round robin
**Say:** Next server in the list, wrap around. One counter, `i++ % N`. Default in NGINX,
HAProxy and ALB. Watch: six requests, two each. Perfectly even — by count.
**→ 1 (replay):** Same six requests, but now they're real: `/export` takes three seconds,
`/health` five milliseconds. Still 2-2-2 by count, but server A is holding six thousand
milliseconds of work and B has ten.
**Land on:** Round robin counts requests, not work. Use it when servers are the same size and
requests cost about the same.

### 32 / 50 · Weighted round robin
**Say:** Server A is three times bigger, so give it weight 3. Naive implementation walks a
fixed list, `A A A B C` — right ratio, but A gets three in a row while B and C idle.
**→ 1:** NGINX does it smoothly: add the weight to each server's counter, pick the max,
subtract the total. You get `A B A C A`. Same 6-2-2, no bursts.
**→ 2:** And the catch: a weight is what you *believe* a server can handle, not a measurement.
Set it wrong and you've configured an overload.
**Use it for:** mixed instance sizes during a migration, or a canary split.

### 33 / 50 · Least connections
**Say:** Now something that reads live state. Server B is in a GC pause — five seconds per
request instead of one. Round robin still sends it every third request and they pile up: four
of twelve, four stuck at once.
**→ 1 (replay):** Least connections sees B is busy and goes elsewhere. B gets one of twelve.
No config change, no alert, it just routes around the problem.
**→ 2:** Costs: the balancer has to track counts per server. And a brand-new server has zero
connections, so it gets flooded the moment it joins — that's what slow start is for.
**Use it for:** request times that vary a lot, or long-lived connections — WebSockets,
uploads, DB proxies.

### 34 / 50 · IP hash
**Say:** Different goal: send the same client to the same server, with no table anywhere.
`hash(ip) % N`. The hash values are on screen — check my arithmetic. Round one, everyone gets
a session. Round two, same IP, same hash, same server: six of six find their session.
**→ 1 (replay):** Then the office. Fifty people behind one NAT IP is *one client* to the
hash. They all land on server A. And NGINX `ip_hash` only uses the first three octets of IPv4,
so a whole /24 shares a server. Mobile users change IP and lose affinity anyway.

### 35 / 50 · IP hash when servers change
**Say:** The bigger problem. Three servers, sessions in place.
**→ 1:** Add server D. `% 3` becomes `% 4`, and most users — three quarters of them — land on
a server that has never seen their session. Alex Xu calls this the rehashing problem, chapter
five. Every one of those is a logout.
**→ 2:** B dies: B's users go elsewhere and their sessions don't follow.
**→ 3:** Consistent hashing fixes the *scale* part — only about 1/N of users move. In NGINX
that's `hash $remote_addr consistent`. There's a full walkthrough in the appendix.

### 36 / 50 · Sticky sessions: stateful vs stateless
**Say:** Step back. IP hash only matters because the server is holding the session in RAM.
That's the actual bug. Alex Xu, chapter one: with stateful servers every request from a client
must go back to the same server — sticky sessions do that, but now adding or removing servers
is hard and a server dying is a user-visible failure. Most balancers pin with a cookie rather
than IP — `AWSALB`, HAProxy `cookie`, NGINX `sticky cookie` — which survives IP changes and
has every other problem.
**→ 1:** The fix is one line of architecture: move session data to Redis, a NoSQL store, the
DB. The web tier becomes stateless and any server can serve anyone.
**→ 2:** Still want affinity? Use it as a *cache hint* — losing it should cost a cache miss,
not a logout.

### 37 / 50 · Algorithms, compared
**Say:** Whole section in one table. Read down the two rows that matter: only least
connections knows current load. Only IP hash gives affinity. Nothing here does both — that's
not an accident of this table, it's the actual state of the four classics.
**Land on:** So pick by what your traffic needs, and be honest about what you're giving up.

### 38 / 50 · How to choose
**Say:** Four questions. Whose turn is it — round robin, identical servers. Who is bigger —
weighted, mixed sizes and canaries. Who is least busy right now — least connections, uneven
request times. Who is this client — IP hash, when a user must stay on one server.
**→ 4:** And if you're reaching for sticky sessions: first ask whether you can make the app
stateless instead. That's usually the cheaper fix.

## Appendix — only if there's time or someone asks

### 39 / 50 · Divider — Beyond the four
**Say:** Two things worth knowing if you want to go further.

### 40 / 50 · Power of two choices
**Say:** Scanning 200 pods for the true minimum is O(n) per request. Pick two at random,
send to the less busy one — O(1), and you still avoid the worst pod, because a stuck pod only
wins when it's compared with something even worse.
**→ 1:** It also fixes the herd. With several balancers, each only knows its own counts, so
strict "least busy" makes all of them pile onto the same new pod at the same moment. Random
pairs break that up.
**→ 2:** Near least-connections quality at round-robin cost. Envoy's `LEAST_REQUEST` does this
by default. Good default for L7.

### 41 / 50 · One slow pod, four algorithms
**Say:** Simulation: 480 req/s for ten seconds into four pods, pod-d three times slower.
Identical arrivals and identical work for all four modes — only the pick changes. Click
through: round robin keeps feeding pod-d until its queue explodes; random is no better; least
connections and power-of-two keep it flat. Watch the p99 readout change.

### 42 / 50 · Hash-based
**Say:** Sixty cache keys, three nodes. Add a fourth with plain `hash % 4` and most keys move
— every red dot is a cache miss that goes to the DB. Switch to consistent hashing and only the
keys that belong to D move, and they all move *to* D.
**Land on:** Hash when locality matters: a per-user cache, a shard, a WebSocket room.

### 43 / 50 · Consistent hashing, the ring
**Say:** Nodes and keys on one ring. A key belongs to the first node clockwise.
**→ 1:** Add D — only the keys between C and D change owner. Everything else stays put, about
1/N moved.
**→ 2:** With three points the arcs are uneven, so real implementations give each node 100 to
200 virtual nodes and the shares even out.

---

# Part 4 — Demo: the crashed server (Khánh)

### 44 / 50 · Divider 04
**Say:** Let's make it real. Three servers, NGINX in front, and at some point I'm going to
kill one while requests are flowing.

### 45 / 50 · Setup
**Say:** Three Node servers on 8001, 8002, 8003 that do nothing but say their own name — so
every response tells you who answered. NGINX on 8000 in front. `npm start` brings all four
up, `npm run status` shows who's alive and which algorithm is loaded.

### 46 / 50 · NGINX as the balancer
**Say:** The whole config: one `upstream` block, three servers, no algorithm line — and no
algorithm line *means* round robin. Six curls.
**→ 1:** 8001, 8002, 8003, then wrap around. That's the entire idea of round robin, in
production software.

### 47 / 50 · Guess first
**Say:** Before I run anything — you guess. Each of these is one line in the upstream block.
(Take answers from the room for each row before revealing it.)
**→ 1:** `weight=4` → `8001 8001 8002 8001 8003 8001`. Smooth weighted round robin, 4:1:1 —
the interleaving we saw on slide 32.
**→ 2:** `least_conn` → still round robin order, because every request finishes instantly, all
counts tie at zero, and NGINX breaks ties with round robin. Least connections needs *slow*
requests to differ from round robin.
**→ 3:** `ip_hash` → one server, six times. Every request comes from 127.0.0.1. That's the
office NAT problem, live.
**→ 4:** Crash 8002 → traffic splits between 8001 and 8003, and the client sees no error at
all. Why is the next two slides.

### 48 / 50 · Live
**Say:** These are real requests from this slide to NGINX on 8000. Press `S` for six,
`Shift+S` for twelve. The balancer box shows the live algorithm from `X-LB`, and every server
NGINX tried from `X-Upstream`.
**Do, in the terminal, talking while it runs:**
1. `npm run algo -- least` then `npm run slow -- 8002 3000` — now least connections and round
   robin visibly differ, because 8002 actually holds requests.
2. `npm run crash -- 8002` — send requests, watch the coin bounce off 8002 and land on
   another server.
3. `npm run revive -- 8002` — it comes back into rotation on the next try.
**If it won't connect:** the slide says `recorded` and replays a round robin — narrate that
and keep going, don't debug on stage.

### 49 / 50 · Why nobody saw the crash
**Say:** Here's the mechanism. Connection refused counts as a failure, so NGINX passes the
request to the next server — `proxy_next_upstream error timeout`, and that's the default.
The client gets one slightly slower 200 instead of a 502.
**→ 1:** Defaults are `max_fails=1`, `fail_timeout=10s`. One failure takes 8002 out for ten
seconds, then NGINX tries it again.
**→ 2:** Revive it and it's back after the next try. And notice what this is: *passive*
checking. NGINX only finds out when a real request fails — a real user paid for that
discovery. Active health checks probe on a timer instead.
**→ 3:** Try the same thing with `ip_hash` and the users who were on 8002 move to another
server. If sessions lived in memory, they just got logged out. Which is exactly slide 36.

### 50 / 50 · Thank you + Kahoot
**Say:** That's us. Questions first, then a short Kahoot on what the balancer knows: order,
capacity, load, client identity. Scan the QR or go to kahoot.it — PIN is on screen.

---

## Questions you should expect

- **"Isn't the load balancer itself a single point of failure?"** → Slide 23. Short answer:
  yes, which is why it runs as a pair or a fleet, and why managed ones exist.
- **"Why not just use DNS round robin?"** → Slide 25. No health, no load, and TTL means a dead
  IP keeps getting traffic for minutes.
- **"We use gRPC and one pod gets all the load."** → Slide 21 plus 3.5: gRPC multiplexes
  everything onto one connection, so an L4 balancer picks a pod once and never revisits.
  Balance per request at L7, or per call in the client / mesh.
- **"Which algorithm should we use?"** → Slide 38. Start with round robin, move to least
  connections when request times vary, and treat sticky sessions as a smell.
- **"How fast is failover really?"** → Slide 27: detection plus TTL plus stragglers, so
  minutes for DNS, seconds for anycast.
