# Load Balancing
### Chia traffic cho nhiều server — mà không chia luôn cả lỗi

> **Đối tượng:** Middle Backend + Frontend Engineer
> **Presenter:** Truc Le — Giới thiệu, Section 1–2 · Khanh Do — Section 3–4

File này là nguồn nội dung cho slide. Slide là bản tiếng Anh của outline này, không viết lại tự do.

---

## MỤC LỤC

0. Giới thiệu — tại sao thêm server chưa đủ
1. Local Load Balancing — traffic trong data center (east-west), software vs hardware LB, sidecar
2. Global Load Balancing (GSLB) — routing giữa các region, GeoDNS, active-active vs active-passive
3. Algorithms — order, capacity, load, client identity (+ sticky session)
4. Demo — "The Crashed Server": NGINX + 3 server

---

## 0. Giới thiệu (Truc)

**Vấn đề:** 3 server nhưng DNS chỉ trỏ vào 1 IP → server-1 CPU 100%, p99 4.2 s, server-2/3 ngồi chơi. Thêm server không giúp gì nếu không có thứ gì đó chia traffic.

**Load balancer là gì:** với mỗi request, chọn 1 backend *còn sống* trong pool.
- **listener** — địa chỉ client kết nối (`api.shop.vn:443`)
- **pool** — danh sách backend (pod, VM, IP)
- **algorithm** — cách chọn: lần lượt, ít bận nhất, hay theo hash
- **health** — backend nào đang được phép chọn

**Scale up vs scale out:** máy to hơn có giới hạn và là single point of failure; nhiều máy nhỏ cần LB + app stateless (session không nằm trong RAM của pod).

**3 việc LB làm:** chia tải · né backend lỗi · che deploy (drain, canary).


## 1. Local Load Balancing (Truc)

Yêu cầu: quản lý traffic trong data center (east-west) · software LB (NGINX, HAProxy) vs hardware LB · sidecar proxy pattern.

Slide hiện có (lấy từ bản cũ, Truc chỉnh tiếp):
- **1.1 Mô hình OSI 7 tầng:** Load balancer chỉ ngồi ở 2 tầng: L4 (transport — TCP/UDP, port) và L7 (application — HTTP, header, cookie). Trên AWS: L4 = **NLB**, L7 = **ALB**.
- **1.2 Packet ≠ request:** một request trải trên nhiều packet; muốn thấy "request" phải ráp lại byte stream rồi parse. Ví von bưu điện: L3 địa chỉ nhà, L4 số căn hộ + "phong bì 3/7", L7 lá thư bên trong.
- **1.3 L4 hoạt động thế nào:** chọn backend đúng 1 lần ở gói SYN, ghi vào connection table, các packet sau chỉ tra bảng. TLS đi xuyên qua (chỉ đọc được SNI). Không giữ bản sao byte → **không retry được**; restart LB là mất bảng, reset hết connection.
- **1.4 L7 hoạt động thế nào:** thực chất là **2 TCP connection** dán lại bằng code. Terminate TLS, đọc nguyên request vào memory, quyết định, ghi sang connection thứ hai. 2 request trên cùng 1 connection có thể về 2 pod khác nhau. Pod chết → gửi lại request cho pod khác, client không biết gì.
- **1.5 Request nằm ở đâu trong lúc chờ:** LB là một chương trình bình thường — đọc request vào **bộ nhớ**, quyết định, ghi ra. 10.000 request cùng lúc × 64 KB = 640 MB; nếu mỗi cái 10 MB thì thành 100 GB, nên LB nào cũng có mức trần. Vượt trần → không giữ bản sao nữa, chỉ chuyển byte đi → **retry im lặng ngừng hoạt động**. L4 không giữ gì cả nên rẻ hơn hẳn, và cũng vì thế không bao giờ retry được.
- **1.6 Health check:** active (probe theo timer, `5s × 3 lần fail ≈ 15s lỗi`) vs passive (outlier detection). Chạy cả hai. Gotcha: **đừng check DB trong `/healthz`** — DB nấc 2 giây là rớt hết pod cùng lúc; panic mode dưới 50% healthy thì bỏ qua health.
- **1.7 So sánh L4 vs L7:** mọi khác biệt đều bắt nguồn từ một câu hỏi — **LB có giữ request lại không, hay chỉ chuyển packet?**
- **1.8 Chọn cái nào:** **L4/NLB** khi không phải HTTP (Postgres, Redis, Kafka, MQTT, UDP), cần static IP, hàng triệu connection idle, hoặc TLS phải tới thẳng backend. **L7/ALB** khi route theo path/host/header/cookie, cần retry, canary weight, p99 theo route — phần lớn traffic web/API, mặc định chọn cái này. **Cả hai** khi lớn: L4 ở biên, fleet L7 phía sau. 4 default cắn người: NLB *có* terminate TLS nhưng vẫn hash 5-tuple; ALB mặc định round robin; ALB **không** retry; cross-zone tắt + tính tiền ở NLB (bật + free ở ALB).
- **1.9 L7 routing:** `/api` và `/ws` về pool khác nhau, canary 5% theo weight, header `X-Canary` cho QA.
- **1.10 Đường đi trên EKS:** Route 53 → ALB → Ingress controller → (Service/kube-proxy cho call nội bộ) → Pod.
- **1.11 Client-side LB / sidecar:** gRPC `round_robin` + headless Service, hoặc service mesh sidecar. Bớt 1 hop, nhưng mọi client phải tự cập nhật danh sách pod.
- **1.12 Ai cân bằng cho LB:** active-passive (VRRP), active-active (ECMP/anycast + Maglev), managed (ALB), client-side.
- **Còn thiếu:** software vs hardware LB.

## 2. Global Load Balancing — GSLB (Truc)

Yêu cầu: routing giữa region/lục địa · DNS-based routing (GeoDNS) · failover active-active vs active-passive.

Slide hiện có (lấy từ bản cũ, Truc chỉnh tiếp):
- **2.1 Một region không giải quyết được gì:** (a) LB nằm *bên trong* failure domain nó bảo vệ — LB không tự failover cho chính nó; (b) vật lý: HCM → `us-east-1` ~230 ms RTT, 3 vòng (TCP + TLS + request) ≈ **690 ms trước khi code chạy**. 4 lý do đi global: latency, DR, capacity, data residency (GDPR, Nghị định 53).
- **2.2 Ba đòn bẩy:** LB local là proxy *trên data path*; LB global phải tác động **trước khi có connection**. Name resolution (DNS — trước khi connect) · Routing (anycast/BGP — trong lúc connect) · Redirection (302 — sau khi connect, tốn thêm 1 RTT, hiếm dùng).
- **2.3 DNS-based routing (GSLB):** authoritative nameserver trả địa chỉ khác nhau tuỳ vị trí + health. Trả lời xong là **ra khỏi đường đi** hoàn toàn. 4 input: ai hỏi (resolver IP + ECS), health, bảng latency **precomputed**, policy. Health lọc trước, policy chạy sau. **Không thấy load** — region healthy nhưng quá tải vẫn nhận đủ phần.
- **2.4 Vì sao DNS không thể nhanh:** 5 tầng giữ câu trả lời cũ (recursive resolver, OS stub, browser, runtime/JVM, **connection pool — socket đang mở không bao giờ resolve lại**). t_failover = detect + TTL + client cache + pool recycle ≈ 2–5 phút. Đừng đặt TTL = 1 s. Cách đúng: **làm cho sự chậm trở nên vô hại** — giữ địa chỉ cũ còn trả lời (proxy tiếp, hoặc 503 + `Retry-After`).
- **2.5 Anycast:** nhiều PoP cùng announce một IP qua BGP. Failover = **rút announcement**, hội tụ trong vài giây, client không cần câu trả lời mới. Gotcha: BGP đếm **số network**, không phải ms; không chia được % traffic; cần ASN + IP block + peering nên đa số đi thuê.
- **2.6 Anycast + edge proxy (câu trả lời thật):** PoP là L7 proxy thật, bắt tay ngay tại chỗ (3 × 30 ms = 90 ms thay vì 690 ms) rồi đi 1 hop ấm qua backbone. Lấy lại **per-request control ở quy mô toàn cầu**: retry sang region khác, canary theo weight, drain cả một region. CDN = máy này + cache; lợi ngay cả khi **cache hit 0%**.
- **2.7 So sánh 3 đòn bẩy:** failover phút / giây / dưới giây · per-request control không / không / full L7 · thấy load không / không / có. Thực tế **ghép cả ba**: DNS → anycast IP → PoP → region → pod. Gotcha chung: **health check toàn cầu rất khó**, và khi nó flap thì nó chuyển cả một châu lục.
- **2.8 Tự kiểm tra:** 3 câu hỏi chốt phần này.
- **2.9 Kiến trúc 2 region:** Route 53 (latency + health, TTL 60 s) → NLB (L4, 3 AZ) → Envoy fleet (TLS, L7) → service.
- **2.10 Capacity:** failover chuyển traffic chứ **không chuyển capacity**. Mỗi region phải gánh được toàn bộ traffic, cộng dư để mất 1 AZ. Chạy tier LB ở 30–40%, rồi game-day drill để chứng minh.

## 3. Algorithms (Khanh)

Khung chung: **LB dùng thông tin gì để quyết định?** Theo Alex Xu / ByteByteGo: static (không nhìn tải hiện tại) vs dynamic (đọc trạng thái server).

- **3.1 Framing:** thứ tự → round robin · capacity cấu hình → weighted · connection đang mở → least connections · IP client → IP hash. Hỏi thêm: thuật toán *bỏ qua* thông tin gì — đó là chỗ nó hỏng.
- **3.2 Round robin (animation):** 6 request → 2/2/2. Bước 2: cùng 2/2/2 nhưng A nhận 2 lần `/export` 3 s → 6,000 ms việc, B chỉ 10 ms. Đếm request, không đếm công việc. Mặc định của NGINX, HAProxy, ALB.
- **3.3 Weighted RR (animation):** A weight 3 (12 vCPU), B/C weight 1. Naive: `A A A B C` (A nhận dồn). Smooth của NGINX: `current += weight`, chọn max, trừ tổng → `A B A C A`. Weight là niềm tin, không phải đo đạc.
- **3.4 Least connections (animation):** B GC pause 5 s/request. Round robin: B nhận 4/12, dồn 4 request. Least conn: B chỉ nhận 1/12. Chi phí: LB phải giữ state; server mới 0 connection bị dồn (slow start). Hợp cho WebSocket, upload, DB proxy.
- **3.5 IP hash (animation):** `hash(ip) % 3`, hash value hiện trên màn hình để khán giả tự tính. Round 2 mọi user về đúng server có session. Văn phòng NAT 50 người 1 IP → dồn hết vào A. NGINX `ip_hash` chỉ dùng 3 octet đầu.
- **3.6 IP hash khi đổi số server (animation):** thêm D → `% 4` → 5/6 user sang server mới, mất session (Alex Xu ch. 5: rehashing problem). B chết → user của B mất session. Consistent hashing chỉ dời ~1/N (appendix).
- **3.7 Sticky session — stateful vs stateless (Alex Xu ch. 1):** stateful thì mọi request của client phải về cùng server → sticky session, khó thêm/bớt server, khó xử lý server chết. Cookie (`AWSALB`, HAProxy `cookie`, NGINX `sticky cookie`) thay IP nhưng cùng vấn đề. Fix: session ra shared storage (Redis/NoSQL), web tier stateless. Affinity chỉ nên là cache hint.
- **3.8 Bảng so sánh:** decides by, complexity, state trong LB, biết capacity, biết load, affinity, thêm/bớt server, use case.
- **3.9 Cách chọn:** Order · Capacity · Load · Identity. Muốn sticky session → trước hết hỏi có làm app stateless được không.
- **Appendix (nếu còn giờ / Q&A):** power of two choices, mô phỏng 1 pod chậm × 4 thuật toán, hash % N vs consistent hashing, vòng consistent hashing.

## 4. Demo — "The Crashed Server" (Khanh)

Code ở `demo/` (ngoài `presentation/`): 3 backend Node + TypeScript (`src/server.ts`) trên 8001–8003, NGINX trên 8000, điều khiển bằng `npm run …` (`src/cli.ts`).

- **4.1 Setup:** `cd demo && npm install && npm start`. Mỗi server trả về "Server 800x".
- **4.2 NGINX:** `upstream` 3 server, không ghi thuật toán = round robin. 6 lần `curl` → 8001, 8002, 8003, 8001, 8002, 8003.
- **4.3 Đoán trước:** bảng 4 thay đổi (`weight=4`, `least_conn`, `ip_hash`, crash 8002). Khán giả đoán output trước, bấm → để lật từng đáp án: `8001 8001 8002 8001 8003 8001` (smooth WRR) · vẫn xoay vòng vì mọi request xong ngay · 1 server duy nhất vì mọi request từ 127.0.0.1 · `8001 8003 8001 8003…` không lỗi.
- **4.4 Live (chạy để kiểm chứng):** slide gửi request thật tới NGINX (phím `S`), đồng xu bay tới server đã trả lời. Trong lúc đó chạy ở terminal: `npm run algo -- least|weight|iphash`, `npm run slow -- 8002 3000` (để least_conn khác round robin), `npm run crash -- 8002`, `npm run revive -- 8002`. Header `X-Upstream` cho thấy cả lần thử thất bại lẫn lần retry. Không có NGINX thì slide phát lại bản ghi.
- **4.5 Vì sao crash mà không ai thấy lỗi:** NGINX retry server kế (`proxy_next_upstream error timeout`), loại 8002 trong 10 s (`max_fails=1 fail_timeout=10s`). Đây là passive check: chỉ phát hiện khi traffic thật bị lỗi.
