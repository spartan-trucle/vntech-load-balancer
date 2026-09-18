# Load Balancing
### Chia traffic cho nhiều server — mà không chia luôn cả lỗi

> **Đối tượng:** Middle Backend + Frontend Engineer
> **Thời lượng:** ~75 phút — 2 presenter
> **P1:** Truc Le — Section 1–3 · **P2:** Khanh Do — Section 4–7 (đề xuất, đổi tùy ý)

File này là nguồn nội dung cho slide. Slide là bản tiếng Anh của outline này, không viết lại tự do.

---

## MỤC LỤC

1. Giới thiệu — tại sao thêm server chưa đủ
2. Layers — DNS, L4, L7, client-side, đường đi trên EKS
3. Algorithms — từ round robin đến consistent hashing
4. Health & failure — health check, ejection, draining, retry
5. Connections & state — sticky session, gRPC, keep-alive
6. System design — 2 region, 200k req/s
7. Takeaways

---

## 1. Giới thiệu (P1)

**Vấn đề:** 3 server nhưng DNS chỉ trỏ vào 1 IP → server-1 CPU 100%, p99 4.2 s, server-2/3 ngồi chơi. Thêm server không giúp gì nếu không có thứ gì đó chia traffic.

**Load balancer là gì:** với mỗi request, chọn 1 backend *còn sống* trong pool.
- **listener** — địa chỉ client kết nối (`api.shop.vn:443`)
- **pool** — danh sách backend (pod, VM, IP)
- **algorithm** — cách chọn: lần lượt, ít bận nhất, hay theo hash
- **health** — backend nào đang được phép chọn

**Scale up vs scale out:** máy to hơn có giới hạn và là single point of failure; nhiều máy nhỏ cần LB + app stateless (session không nằm trong RAM của pod).

**3 việc LB làm:** chia tải · né backend lỗi · che deploy (drain, canary).

## 2. Layers (P1)

- **DNS:** trả nhiều A record. Rẻ, nhưng client cache theo TTL → IP chết vẫn nhận traffic đến 5 phút. Dùng DNS để chọn *region*, dùng LB thật để chọn *server*.
- **L4 vs L7:** L4 chỉ thấy IP:port, cân bằng theo *connection*. L7 terminate TLS, đọc path/header/cookie, cân bằng theo *request*.
- **L7 routing:** `/api` và `/ws` về pool khác nhau, canary 5% theo weight, header `X-Canary` cho QA.
- **Đường đi trên EKS:** Route 53 → ALB → Ingress controller → (Service/kube-proxy cho call nội bộ) → Pod. Mỗi hop có thuật toán mặc định riêng.
- **Client-side LB:** gRPC `round_robin` + headless Service, hoặc service mesh sidecar. Bớt 1 hop, nhưng mọi client phải tự cập nhật danh sách pod.

## 3. Algorithms (P1)

- **Round robin / weighted:** đều khi mọi request tốn như nhau. Đếm request, không đếm công việc.
- **Least connections:** pod-b bị GC pause có 41 request đang chờ, round robin vẫn gửi tiếp; least conn gửi sang pod-c (0).
- **Power of two choices:** chọn ngẫu nhiên 2, lấy cái ít bận hơn. O(1), tránh được "herd" khi có nhiều LB cùng thấy một pod rảnh. Envoy `LEAST_REQUEST` mặc định làm vậy.
- **Demo mô phỏng (slide 3.4):** 480 req/s, 4 pod, pod-d chậm gấp 3. Round robin/random: queue pod-d lên ~500, p99 ~7 s. Least conn / P2C: p99 ~150 ms.
- **Hash % N:** thêm 1 node → ~75% key đổi chỗ → cache miss hàng loạt.
- **Consistent hashing:** node và key trên cùng 1 vòng; key thuộc node kế tiếp theo chiều kim đồng hồ. Thêm node chỉ di chuyển ~1/N key. Virtual node (100–200/node) để chia đều.
- **Bảng so sánh:** P2C là mặc định cho HTTP; hash chỉ khi cần affinity.

## 4. Health & failure (P2)

- **Active health check:** 5 s × 3 lần fail = ~13 s user nhận lỗi. Rút ngắn interval thì tốn request health.
- **Passive / outlier detection:** 5 lỗi 5xx liên tiếp → loại 30 s (Envoy default), `max_ejection_percent` 10% để không loại sạch pool.
- **/healthz nên check gì:** không gọi DB trong health check — DB chậm 10 s là cả pool bị đánh DOWN → outage. Tách `/livez` và `/readyz`. ALB / Envoy có "panic mode" khi tất cả đều unhealthy.
- **Draining khi deploy:** Kubernetes gửi SIGTERM và xóa endpoint cùng lúc; LB biết sau vài giây → 502. Fix: `preStop: sleep 10`, deregistration delay hợp lý, slow start cho pod mới.
- **Retry:** retry ở mọi tầng → 3 × 3 × 3 = 27 lần gọi DB. Retry 1 lần, ở 1 tầng, chỉ cho request idempotent; dùng retry budget (~20%).

## 5. Connections & state (P2)

- **Sticky session:** cookie `AWSALB` ghim user vào 1 pod → tải lệch, deploy là mất giỏ hàng. Đưa session ra Redis/JWT.
- **Long-lived connection:** gRPC/HTTP2 dồn mọi call lên 1 connection → Service L4 đưa hết vào 1 pod, pod mới từ HPA không có traffic. Fix: cân bằng theo call (mesh, L7, gRPC client-side) + `MAX_CONNECTION_AGE`. WebSocket cũng vậy.
- **Keep-alive:** ALB idle 60 s, Node.js `keepAliveTimeout` 5 s → pod đóng connection trong khi ALB đang gửi → 502 ngẫu nhiên. Quy tắc: timeout của backend phải dài hơn của LB.

## 6. System design (P2)

- **Yêu cầu:** 200k req/s peak, 2 region active-active (Singapore, Tokyo), 99.99%, mất 1 region trong 2 phút phải ổn.
- **Kiến trúc:** Route 53 (latency + health, TTL 60 s) → NLB (L4, 3 AZ) → Envoy fleet (TLS, L7, P2C) → 30 service có sidecar.
- **Ai cân bằng cho LB:** active-passive (VRRP), active-active (ECMP/anycast + Maglev), managed (ALB — lưu ý scale dần), client-side.
- **Mất region:** DNS failover ≈ detect ~30 s + TTL 60 s + client cache lâu. Anycast nhanh hơn. Bẫy thật: failover chuyển traffic chứ không chuyển capacity.
- **Capacity:** 200k ÷ 25k req/s/node = 8 node; chịu mất 1/3 AZ → 12 node mỗi region, bình thường chạy ~33%. Game day: drain 1 region có chủ đích.

## 7. Takeaways (P2)

1. P2C cho HTTP; round robin chỉ khi mọi thứ đều nhau; hash chỉ khi cần affinity.
2. Active + passive health check; không để dependency trong health check.
3. Drain trước khi stop: preStop, deregistration delay, readiness, slow start.
4. L4 cân bằng connection, không phải request. Keep-alive backend > LB.
5. LB là một phần của hệ thống: redundant, đủ capacity từng region, test failover.
