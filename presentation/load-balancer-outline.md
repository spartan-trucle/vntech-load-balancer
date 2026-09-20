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
- **1.2 L4 vs L7:** L4 chỉ thấy IP:port, cân bằng theo *connection*. L7 terminate TLS, đọc path/header/cookie, cân bằng theo *request*.
- **1.3 L7 routing:** `/api` và `/ws` về pool khác nhau, canary 5% theo weight, header `X-Canary` cho QA.
- **1.4 Đường đi trên EKS:** Route 53 → ALB → Ingress controller → (Service/kube-proxy cho call nội bộ) → Pod.
- **1.5 Client-side LB / sidecar:** gRPC `round_robin` + headless Service, hoặc service mesh sidecar. Bớt 1 hop, nhưng mọi client phải tự cập nhật danh sách pod.
- **1.6 Ai cân bằng cho LB:** active-passive (VRRP), active-active (ECMP/anycast + Maglev), managed (ALB), client-side.
- **Còn thiếu:** software vs hardware LB.

## 2. Global Load Balancing — GSLB (Truc)

Yêu cầu: routing giữa region/lục địa · DNS-based routing (GeoDNS) · failover active-active vs active-passive.

Slide hiện có (lấy từ bản cũ, Truc chỉnh tiếp):
- **2.1 DNS:** trả nhiều A record. Rẻ, nhưng client cache theo TTL → IP chết vẫn nhận traffic đến 5 phút. Dùng DNS để chọn *region*, dùng LB thật để chọn *server*.
- **2.2 Kiến trúc 2 region:** Route 53 (latency + health, TTL 60 s) → NLB (L4, 3 AZ) → Envoy fleet (TLS, L7) → service.
- **2.3 Mất region:** DNS failover ≈ detect ~30 s + TTL 60 s + client cache lâu. Anycast nhanh hơn. Failover chuyển traffic chứ không chuyển capacity.
- **2.4 Capacity:** mỗi region phải gánh được toàn bộ traffic, cộng dư để mất 1 node.
- **Còn thiếu:** GeoDNS (route theo vị trí client), so sánh active-active vs active-passive.

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
