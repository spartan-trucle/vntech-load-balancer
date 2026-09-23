# Kịch bản nói — Load Balancing

Mỗi slide một mục, theo đúng thứ tự deck. **Nói** là phần bạn dẫn; các dòng **→** là những
`data-step` (bấm mũi tên phải rồi nói dòng đó); **Chốt** là câu để lại trong đầu mọi người
trước khi qua slide tiếp theo.

Không có gì ở đây hiện trên màn hình. Số liệu thì lấy slide làm chuẩn — sửa số trên slide thì
nhớ sửa luôn ở đây.

## Trước khi bắt đầu

- Mở deck qua HTTP (`cd presentation && python3 -m http.server 8000`), bấm `F` để fullscreen.
- Phím: `→` / `←` để step, `O` xem overview, `T` đổi theme sáng, `S` bắn request demo ở slide 52.
- Phần 4: chạy `cd demo && npm install && npm start` ở terminal thứ hai, trước khi lên nói.
- Kiểm tra slide 52 hiện chip xanh `live · <algorithm>`, không phải `recorded`.

## Thời lượng

| Phần | Slide | Ai nói | Dự kiến |
|---|---|---|---|
| Cover + outline | 1–2 | Trúc | 2 phút |
| 00 Giới thiệu | 3–9 | Trúc | 10 phút |
| 01 Local load balancing | 10–21 | Trúc | 16 phút |
| 02 Global load balancing | 22–31 | Trúc | 15 phút |
| 03 Algorithms | 32–42 | Khánh | 15 phút |
| 03 Phụ lục (chỉ khi còn giờ / có người hỏi) | 43–47 | Khánh | 0–8 phút |
| 04 Demo | 48–53 | Khánh | 10 phút |
| Cảm ơn + Kahoot | 54 | cả hai | 3 phút |

**Deck này chạy khoảng 60 phút nếu không tính phụ lục.** Cần cắt thì cắt theo thứ tự này, mỗi
cái đều đứng độc lập được: phụ lục (43–47), rồi 31, 18, 16. Đừng bao giờ bỏ slide 52 —
demo live mới là thứ mọi người nhớ.

---

# Phần 0 — Giới thiệu (Trúc)

### 1 / 54 · Cover — Load Balancing
**Nói:** Chào mọi người, mình là Trúc, đây là Khánh. Hôm nay mình nói về load balancing. Không
phải định nghĩa, mà là các quyết định. Mười con server chỉ nhanh hơn một con khi có cái gì đó
đẩy từng request tới một server đang sống và đang rảnh. Cái "gì đó" ấy là nội dung của một
tiếng tới.
**Chỉ lên hình:** pod-c đang lỗi. Load balancer phát hiện và chia phần của nó cho hai pod còn
lại. Mọi thứ hôm nay đều là biến thể của bức hình này thôi.

### 2 / 54 · Outline
**Nói:** Bốn phần. Mình lấy hai phần đầu: cân bằng tải bên trong một data center, rồi giữa các
region. Khánh lo phần server được chọn ra sao, và một demo live mà tụi mình giết một con server
ngay trên sân khấu.
**Chốt:** Có gì thắc mắc thì hỏi luôn nha, đừng để dồn tới cuối.

### 3 / 54 · Divider 00 — Giới thiệu
**Nói:** Bắt đầu từ vấn đề trước, định nghĩa sau. Vì sao một con server là không đủ, và đặt một
load balancer ở trước thì mình được cái gì?

### 4 / 54 · Một server hỏng theo ba hướng khác nhau
**Nói:** Mọi người hay gom hết vào chữ "scaling". Thật ra là ba bài toán khác nhau.
- **Capacity** — hết máy. CPU, RAM, file descriptor, mà thường là hết số connection trước.
  Latency phẳng, phẳng, phẳng, rồi rớt vực. Con 64 vCPU thì vẫn chỉ có một cái NIC.
- **Availability** — thay đổi mình không hề muốn. Một lần crash, một lần kernel panic, một AZ
  mất điện. Và chú ý: chạy ba instance tự nó không giải quyết gì cả. Nếu không ai biết pod-b
  chết thì một phần ba traffic vẫn đi vào đó.
- **Operability** — thay đổi mình *chủ động* làm. Deploy, vá lỗi, rollback. Một server thì mỗi
  lần deploy là một lần restart, mà restart là chín mươi giây 502 và không có đường lùi.

**→ 1:** Capacity là phục vụ được bao nhiêu. Availability là sống sót qua thay đổi mình không
muốn. Operability là làm thay đổi mình muốn, một cách an toàn.
**Chốt:** Phần lớn thay đổi là có kế hoạch. Nên operability mới là thứ cắn mình hằng ngày, kể
cả khi service nhét vừa một con máy.

### 5 / 54 · Ba server, mà user nào cũng vào đúng con đầu tiên
**Nói:** Ví dụ cụ thể. Mười nghìn user, ba server. DNS trỏ `api.shop.vn` về 10.0.1.11, thế là
server-1 chạy 100% CPU với p99 4,2 giây, còn server 2 và 3 nằm ở 3%. Trả tiền ba máy mà xài có
một.
**→ 1:** Đặt một load balancer sau cái tên đó. Vẫn ba máy cũ, giờ mỗi con ~35% CPU, p99 180 ms.
**Chốt:** Thêm server chỉ có ích khi có cái gì đó chia traffic. Client chỉ biết một hostname;
phải có thứ nằm sau cái tên đó chọn server cho từng request.

### 6 / 54 · Load balancer là cái gì
**Nói:** Bốn từ sẽ nghe suốt buổi hôm nay, thống nhất luôn cho dễ.
- **listener** — cái port load balancer mở, `:443` kèm certificate. Client kết nối vào đây,
  không bao giờ vào thẳng pod.
- **algorithm** — cách nó chọn một backend, cho từng request.
- **pool** — tập backend nó được phép gửi tới.
- **health** — trong tập đó, con nào đang được phép nhận *ngay lúc này*.

Đọc cái log: ba request round robin qua a, b, c. Rồi health check fail pod-b ba lần, đánh dấu
down — và request ngay sau đó đi thẳng qua pod-c. Không ai dính lỗi cả.
**→ 1:** Client không bao giờ biết IP của backend, nên mình thêm, bớt, restart pod thoải mái
mà không ai phải sửa config.
**Chốt:** Health quyết định ai được phép. Algorithm chọn một trong những con được phép đó.

### 7 / 54 · Forward proxy, reverse proxy, load balancer
**Nói:** Ba từ này hay bị dùng lẫn lộn, mà không phải một thứ đâu.
- **Forward proxy** đứng trước *client*, che client là ai — corporate egress, VPN, con crawler.
  Phía bên kia là rất nhiều origin.
- **Reverse proxy** đứng trước *server*, che có bao nhiêu server — TLS, cache, WAF. Một origin.
- **Load balancer** là reverse proxy mà còn *chọn* nữa. N origin, mỗi request một quyết định.

Load balancer nào cũng là reverse proxy. Còn reverse proxy chỉ có một upstream thì không phải
load balancer. NGINX, HAProxy, Envoy đóng được cả ba vai tuỳ config — nên mới hay bị lẫn.
**→ 1:** Và hệ quả mà tuần đầu đi làm là đụng ngay: với client thì LB *chính là* server, với
backend thì LB *chính là* client. Backend thấy IP của load balancer chứ không thấy IP user. Nhớ
truyền IP thật qua `X-Forwarded-For`, hoặc PROXY protocol ở L4 — làm *trước* khi rate-limit hay
ghi log theo IP.

### 8 / 54 · Ba việc load balancer làm
**Nói:** Vậy rốt cuộc mình được gì? Ba thứ. Chia tải — 600 req/s qua ba pod là mỗi con khoảng
200, chứ không phải 600 dồn một con. Né chỗ hỏng — health check kéo backend lỗi ra trong vài
giây rồi đưa lại vào khi nó hồi. Giấu thay đổi — drain một pod, thay, đưa lại vào; canary 5%
qua v2; client thì từ đầu tới cuối chỉ thấy một địa chỉ duy nhất.
**→ 1:** Load balancer thật còn làm nhiều hơn — TLS termination, HTTP/2, nén, WAF. Hữu ích,
nhưng đó là tính năng của sản phẩm, không phải bản chất của load balancing.
**Chốt:** Nhớ ba việc này — mọi thứ còn lại hôm nay chỉ là làm một trong ba việc đó tốt hơn.

### 9 / 54 · Các loại load balancer
**Nói:** Trước khi đi sâu, điểm danh sáu cái tên hay gặp — ByteByteGo liệt kê đúng sáu cái này —
nhưng đừng học như một danh sách. Chúng trả lời ba câu hỏi khác nhau. Cái gì chạy nó: hardware
là một cái box trong rack như F5, nhanh nhưng đắt và mua một lần là chốt size; software là một
chương trình như NGINX, HAProxy, Envoy, muốn scale thì chạy thêm bản; cloud là AWS ALB/NLB,
Google Cloud Load Balancing, Azure — nhà cung cấp chạy hộ, mình nhận một endpoint và một hoá
đơn. Nó đọc gì: layer 4 chỉ đọc IP và port, chọn backend một lần cho cả connection; layer 7 đọc
path, header, cookie, chọn theo từng request. Nó với tới đâu: local là trong một cluster hay
một region; global — GSLB — chọn region cho user qua DNS hoặc anycast, trước khi chạm tới
balancer nào bên trong.
**→ 1:** Ba câu hỏi này độc lập với nhau, nên một box thường là nhiều loại cùng lúc: ALB là
cloud, bên dưới là software, và là layer 7.
**Chốt:** Phần 1 là cột giữa — L4 và L7 chạy thế nào. Phần 2 là cột phải — GSLB.

---

# Phần 1 — Local load balancing (Trúc)

### 10 / 54 · Scale up vs scale out
**Nói:** Hai cách lấy thêm capacity. Lên (up): 4 vCPU thành 64. Không đụng code, đó là cái hay
— nhưng có một instance type to nhất, càng lên cao giá mỗi core càng tệ, và vẫn chỉ là một sợi
dây điện. Ra (out): mười sáu pod nhỏ. Traffic tăng thì thêm, chết một con cũng không sập.
Nhưng cần load balancer, và cần app không giữ state của user trong memory.

### 11 / 54 · Divider 01
**Nói:** Zoom vào bên trong một data center. Traffic east-west giữa các service của mình, và
lựa chọn định hình mọi thứ còn lại: load balancer làm việc ở tầng nào?

### 12 / 54 · Quay lại mô hình OSI
**Nói:** Ôn nhanh mô hình OSI, vì mười slide tới đều dựa vào nó. Bảy tầng. Load balancer chỉ
bao giờ ngồi ở hai tầng thôi: tầng 4, transport — TCP, UDP, port — và tầng 7, application —
HTTP, gRPC, header, cookie.
**→ 1:** Mà hai tầng đó có cái tên các bạn xài hằng ngày rồi. Load balancer ở tầng 4 chính là
cái AWS bán dưới tên **NLB**, Network Load Balancer. Ở tầng 7 là **ALB**, Application Load
Balancer. Ra ngoài AWS cũng vậy: HAProxy `mode tcp` và kube-proxy ở L4, NGINX và Envoy ở L7.
**→ 2:** Tầng 1 tới 3 là việc của network — định tuyến IP, Ethernet — không có gì để config
trên load balancer. Tầng 5 và 6 thực tế gần như không tồn tại; TCP/IP gộp chúng vào TLS.
**Chốt:** Hễ ai hỏi "NLB hay ALB?", thực chất họ đang hỏi "tầng 4 hay tầng 7?".

### 13 / 54 · Packet không phải là request
**Nói:** Trước khi so L4 với L7, phải thống nhất cái gì thật sự đang chạy trên dây. Bảy packet
tới lần lượt. Trên dây không có gì đánh dấu request bắt đầu ở đâu và kết thúc ở đâu cả.
**→ 1:** Mở một packet ra. IP header, TCP header, payload. Load balancer L4 đọc hai cái header
— địa chỉ và port — rồi dừng. Nó không bao giờ đụng vào payload. Ví von bưu điện: L3 là địa chỉ
nhà, L4 là số căn hộ cộng với "phong bì 3 trên 7, mở theo thứ tự", L7 là lá thư bên trong. Bưu
điện thì không bao giờ đọc thư.
**→ 2:** Giờ nhìn cùng đống byte đó, sau khi đã có người ráp lại và đọc. Hình dung một cuộc
điện thoại: bạn quay số **một lần**, rồi nói nhiều câu trong cùng cuộc gọi đó. Cái "ống" TCP y
hệt vậy — mở một lần, và ba request đi chung bên trong. L4 chọn người nghe ngay lúc bắt máy,
chọn xong là chốt cho cả cuộc gọi. L7 nghe từng câu một, và câu sau hoàn toàn có thể chuyển
cho người khác.
**Chốt:** Ráp lại byte stream rồi parse là việc thật, tốn thật. **Chính cái việc đó là toàn bộ
khác biệt**, và mọi thứ khác đều suy ra từ đây.

### 14 / 54 · L4 load balancer chạy thế nào
**Nói:** Nhìn gói SYN. Load balancer hash bốn giá trị (src IP, src port, dst IP, dst port), chọn
pod-b, rồi ghi một dòng vào connection table. Sau đó packet 2, 3, 4, 5 tới — chúng không mang
gợi ý gì về nơi cần đến, nên chỉ còn cách tra cái dòng đó. Một quyết định, làm đúng một lần,
lúc mở connection.
**→ 1:** TLS. Byte đã mã hoá thì chuyển tiếp y hệt byte thường, vì đằng nào nó cũng có định đọc
đâu. Thứ duy nhất hơi "L7" mà nó lấy được là hostname trong SNI, gửi dạng rõ lúc handshake —
đó là cách L4 route theo domain mà không cần giữ private key nào.
**→ 2:** pod-b chết giữa chừng. Load balancer không giữ bản sao byte nào, lại dùng chung một
connection đầu-cuối với client, nên không có gì để gửi lại và cũng không có chỗ để gửi. Client
nhận reset.
**Chốt:** Và để ý cái bảng đó là *state*. Restart load balancer là mọi connection đang sống
reset theo.

### 15 / 54 · L7 load balancer chạy thế nào
**Nói:** Một cỗ máy hoàn toàn khác. Nó hoàn tất handshake với client trên conn A, đọc nguyên
request vào memory, quyết định, rồi ghi sang *connection của chính nó* tới pod-a. Hai TCP
connection dán lại bằng code. Request thứ hai trên cùng connection của client lại đi về pod-c —
L4 không bao giờ làm được vậy, nó đã chốt cả cái ống rồi.
**→ 1:** Ở đây TLS không phải tuỳ chọn. Không giải mã thì không có HTTP để parse, nên private
key và việc xoay certificate chuyển qua load balancer, còn chặng tới pod là plaintext trừ khi
mình mã hoá lại.
**→ 2:** Giờ pod-b chết. Proxy vẫn còn byte trong memory, nên nó ghi đúng request đó qua pod-c
trên một connection mới. User chỉ thấy một cái 200 hơi chậm.
**Chốt:** "Nó giữ request lại" là câu giải thích được retry, canary, metric theo từng request —
tức là toàn bộ cột L7 trong bảng so sánh.

### 16 / 54 · Request nằm ở đâu trong lúc chờ
**Nói:** Quay lại câu đó: proxy *giữ* request. Giữ ở đâu? Trong memory của nó. Load balancer là
một chương trình bình thường, như mấy cái mình viết — đọc request vào, quyết định đi đâu, ghi
ra. Trong lúc nó quyết định thì request của bạn nằm trong memory của nó, và mỗi request nó đang
xử lý chiếm một chỗ.
**→ 1:** Nên phải có giới hạn, và phép tính cho thấy vì sao. Mười nghìn request cùng lúc, mỗi
cái 64 KB, là 640 megabyte. Nếu mỗi cái 10 megabyte thì thành một trăm gigabyte. Nên load
balancer nào cũng đặt trần cho phần request nó chịu giữ.
**→ 2:** Giờ có một upload 10 MB. Vượt trần, nên load balancer thôi không giữ bản sao nữa mà
chỉ chuyển byte đi khi byte tới. Và đây là chỗ sinh bug: retry vẫn đang bật, chỉ là nó im lặng
không làm gì, vì chẳng còn bản sao nào để gửi lại. Upload to mà pod chết là fail.
**Chốt:** So với L4 — nó không giữ gì cả, chuyển từng packet rồi quên luôn. Nên nó rẻ hơn hẳn,
và cũng vì thế mà không bao giờ retry được.

### 17 / 54 · Health check
**Nói:** Load balancer loại nào cũng phải trả lời "backend này còn sống không". Active thì probe
theo timer: `GET /healthz` mỗi 5 giây. pod-c bắt đầu lỗi — một lần fail chưa đủ để hành động,
có thể chỉ là nấc nhẹ. Ba lần liên tiếp thì mới loại.
**Tính trên màn hình:** 5 giây × 3 lần fail là tới 15 giây lỗi thật trước khi bị loại, cộng
thêm mấy request đang bay. Siết interval lại thì nhanh hơn nhưng đổi lại nhiều báo động giả.
Mặc định hợp lý: 5 giây, fail 3 thì ra, pass 2 thì vào lại.
**→ 1:** Passive, hay outlier detection: nhìn traffic thật rồi loại backend khi nó lỗi. Miễn
phí, và bắt được đúng cái active bỏ sót — `/healthz` trả 200 tươi rói trong khi mọi request
thật đều 500. Chạy cả hai.
**→ 2:** Cái bẫy. Nhét một cú check database vào `/healthz`, rồi DB nấc hai giây là toàn bộ pod
fail cùng một lúc. Đang "degraded" thành "sập 100%". Rồi tới panic mode: dưới 50% healthy, load
balancer tốt sẽ bỏ qua health luôn và chia đều cho tất cả, vì tới mức đó thì khả năng cái tín
hiệu health hỏng cao hơn là cả cụm hỏng.
**Chốt:** Cho health check của load balancer ở mức nông thôi — *process này còn phục vụ được
không* — còn check dependency thì để một endpoint riêng, chỉ dùng để báo động cho mình.

### 18 / 54 · Vậy chọn cái nào?
**Nói:** Slide này thứ Hai đi làm là dùng được luôn. Rút gọn lại chỉ còn một câu hỏi:
**load balancer có cần đọc nội dung request không?**
**Nói:** *Không cần đọc* → **L4, tức NLB**. Traffic không phải HTTP — Postgres, Redis, Kafka,
MQTT, game chạy UDP. Hoặc cần static IP. Hoặc hàng triệu connection nằm im. Hoặc bên tuân thủ
bắt TLS phải tới thẳng backend.
**Nói:** *Cần đọc* → **L7, tức ALB**. Route theo path, host, header, cookie; muốn retry, canary
theo weight, p99 theo từng route. Đa số traffic web và API rơi vào đây, nên **mặc định cứ chọn
L7** trừ khi dính một lý do ở trên.
**Nói:** Còn hệ thống lớn thì gần như luôn là *cả hai*: một lớp L4 rẻ ở biên để hứng connection,
fleet L7 phía sau lo route. Đúng cái hình EKS ở slide 20.
**→ 1:** Hai cái mặc định hay làm người ta vấp. Một là NLB *có* terminate TLS nếu bạn cho nó
một TLS listener — và vẫn chia theo flow hash, vì nó không parse HTTP. Giải mã và hiểu là hai
năng lực khác nhau. Hai là ALB mặc định round robin; least outstanding requests tắt cho tới khi
mình tự bật.
**→ 2:** Thêm hai cái nữa. ALB không bao giờ retry — cái đó phải tới từ mesh sidecar hoặc
client của mình. Và NLB thì cross-zone tắt sẵn và tính tiền, còn ALB bật sẵn và miễn phí: để
tắt thì một AZ có một pod nhận traffic ngang với AZ có năm pod.
**Chốt:** Cái bản đồ tầng là phần dễ. Bốn cái này mới là thứ làm người ta mất nguyên một ngày.

### 19 / 54 · L7 mang lại gì
**Nói:** Đây là phần "rốt cuộc được gì" rất cụ thể. Nhìn hình: bên ngoài chỉ có **một**
hostname, `api.shop.vn`, một certificate — client chỉ biết bấy nhiêu. Bên trong thì `/api` về
pool API 12 pod ăn CPU, `/ws` về pool socket 4 pod giữ connection hàng giờ, `/static` đẩy thẳng
ra CDN. Ba thứ đó **scale độc lập nhau**: cái này autoscale theo CPU, cái kia theo số
connection.
**Nói:** Giá trị thật nằm đúng chỗ đó. Ngày xưa muốn tách `/ws` ra máy riêng là phải đổi domain,
đổi client, đổi app mobile đang chạy ngoài kia. Giờ là một dòng config, không ai bên ngoài biết.
**→ 1:** Tiếp, ship an toàn. Đẩy 5% traffic `/api` qua v2, ngồi nhìn error rate, ổn thì 25%,
rồi 100%. Có chuyện thì kéo con số về 0 — hai giây là xong. Rollback từ chỗ "deploy lại bản cũ,
chờ sáu phút" biến thành "sửa một con số".
**→ 2:** Và test ngay trên production. QA gắn header `X-Canary: true` là luôn rơi vào v2, chạy
trên dữ liệu thật, trong khi toàn bộ user còn lại vẫn ở v1. Khỏi phải dựng một môi trường
staging rồi giả lập dữ liệu cho giống.
**Chốt:** L4 không làm được cái nào trong ba cái đó. Nó không thấy path, không thấy header — nó
chọn một pod cho cả connection rồi hết phần nó.

### 20 / 54 · Đường đi trên AWS EKS
**Nói:** Thực tế không phải một load balancer, mà là bốn chặng. Route 53 chọn region. ALB chọn
IP của node hoặc pod. Ingress controller chọn pod. Service, qua kube-proxy, lo các cuộc gọi
pod-to-pod. Bốn thứ, mỗi thứ có algorithm riêng và định nghĩa "healthy" riêng — nhìn bảng: round
robin ở ALB, round robin ở ingress, còn ở tầng Service thì iptables chọn *ngẫu nhiên* cho mỗi
connection.
**→ 1:** Traffic từ ngoài có thể bỏ hẳn chặng bốn — nếu ingress gửi thẳng vào pod IP thì
Service chỉ còn dùng cho gọi nội bộ. Và ở đó nó cân bằng theo connection, không phải theo
request. Nhớ điều này lúc nói tới gRPC.
**Chốt:** Khi tải lệch, câu hỏi đầu tiên là *cái nào* trong bốn chặng đã ra quyết định.

### 21 / 54 · Client-side balancing
**Nói:** Với gọi service-to-service thì có thể bỏ luôn cái hộp ở giữa. gRPC client bật
`round_robin` cộng với headless Service sẽ mở một connection cho mỗi pod và tự rải request.
Service mesh cũng vậy, bằng sidecar nằm cạnh từng pod — code của mình chỉ gọi localhost. Bớt
một hop, và bớt một thứ phải scale với monitor.
**→ 1:** Cùng cuộc gọi đó, không còn hộp giữa: bộ chọn nằm ngay trong order-svc, lấy danh sách
pod từ headless Service hoặc từ registry.
**→ 2:** Cái giá: client nào cũng cần danh sách pod và phải tự cập nhật. Danh sách cũ thì gọi
vào pod không còn tồn tại, và giờ con bug đó nằm trong mọi service thay vì một chỗ.

### 22 / 54 · Divider 02
**Nói:** Giờ ra giữa các region. Bài toán khác hẳn: thứ ra quyết định thường là DNS, mà DNS thì
không thấy được health hay load.

### 23 / 54 · Một region không giải quyết được gì
**Nói:** Từ nãy tới giờ mình mặc định là load balancer luôn với tới được. Nhìn hình cho dễ.
Ngày thường: balancer chọn pod, user nhận 200. Rồi pod-b chết — balancer né qua pod-c, user
không hề biết có chuyện gì. Đó đúng là việc nó sinh ra để làm.
**Nói:** Giờ cả region đi. Và **cái balancer đi luôn theo**, vì nó nằm bên trong chính cái
region nó bảo vệ. Request của user gõ cửa rồi dội ngược lại — bên trong không còn ai để né
vòng qua nữa. Load balancer không tự failover cho chính nó được.
**→ 1:** Thứ hai: vật lý. Sài Gòn tới us-east-1 khoảng 230 mili-giây một vòng. TCP handshake,
TLS handshake, request đầu tiên — ba vòng, bảy trăm mili-giây, *trước khi code của bạn chạy*.
Least request hoàn hảo ở Virginia cũng không lấy lại được một mili-giây nào.
**→ 2:** Cả hai vấn đề có chung một lời giải, và nó không nằm trong region này: kết thúc
connection ở gần user hơn.
**Chốt:** Bốn lý do đi global — latency, disaster recovery, capacity vượt quá một region, và
data residency. Cái cuối là luật chứ không phải sở thích: GDPR, và Nghị định 53 của Việt Nam.

### 24 / 54 · Ba đòn bẩy
**Nói:** Đây là chỗ phải đổi cách nghĩ. Load balancer local là một proxy *nằm trên data path* —
traffic đã tới nó rồi, nó chỉ chọn backend. Load balancer global phải đổi được chỗ client gửi
traffic *trước khi có bất kỳ connection nào*. Nó không phải cái hộp mình đẩy traffic qua, mà là
cơ chế khiến client tự chọn.
**Bảng:** Ba đòn bẩy, và cột quan trọng nhất là *khi nào*. Name resolution quyết định trước khi
connect. Routing — anycast — quyết định trong lúc connect. Redirection, cái 302, quyết định sau
khi connect.
**→ 1:** Ba khoảnh khắc, nhìn ba hình nhỏ cho dễ hình dung. ① *Trước khi connect*: user chưa
mở connection nào cả, mới chỉ đi hỏi DNS — và câu trả lời đó quyết định region. ② *Trong lúc
connect*: chỉ có đúng một địa chỉ, nhưng mạng tự chọn giùm cửa nào gần nhất, mình không chen
vào được. ③ *Sau khi connect*: đã nói chuyện với server rồi mới trả 302 bảo đi chỗ khác — tốn
nguyên một vòng nữa, nên hiếm ai xài. Mọi thứ thật đều là ① hoặc ②, hoặc cả hai.
**Chốt:** Giữ cái bảng này trong đầu cho bốn slide tới.

### 25 / 54 · DNS-based routing (GSLB)
**Nói:** Đòn bẩy một. Authoritative nameserver của bạn *chính là* load balancer global. Một
query tới từ Việt Nam, nó áp policy, nó trả về địa chỉ Singapore kèm TTL 60 giây. Rồi để ý cái
này: client kết nối thẳng tới Singapore, và GSLB ra khỏi đường đi hoàn toàn. Nó không bao giờ
thấy cái HTTP request.
**→ 1:** Cùng hostname đó, query từ Nhật, trả lời khác. Một cái tên, và lựa chọn được làm cho
từng lần tra cứu. Mấy đường nét đứt kia là health probe, chạy liên tục và tách rời khỏi mọi
query — đó là liên hệ duy nhất nó còn với hạ tầng của bạn.
**→ 2:** Singapore fail ba lần probe. Giờ query từ Việt Nam nhận Tokyo. Để ý thứ tự: health lọc
tập ứng viên *trước*, rồi policy mới chạy trên phần còn lại.
**Chốt:** Chỉ có đúng bốn đầu vào — ai đang hỏi, health, một bảng latency dựng sẵn, và policy
của bạn. Để ý cái thiếu: **load**. Một region healthy nhưng đã quá tải vẫn nhận đủ phần của nó,
vì health check trả lời "nó còn sống không", chứ không phải "nó còn gánh thêm được không".

### 26 / 54 · Vì sao DNS không bao giờ nhanh được
**Nói:** Ở t=0 GSLB bắt đầu trả địa chỉ mới. Giờ đếm xem ai còn đang giữ địa chỉ cũ. Recursive
resolver. OS stub resolver. Cache của chính trình duyệt. Runtime ngôn ngữ — cache của JVM mặc
định là vĩnh viễn. Và cái thứ năm, cái người ta hay quên: một socket đang mở trong connection
pool thì **không bao giờ resolve lại**. TTL không hề được hỏi tới, vì đâu có lần tra cứu nào
xảy ra.
**→ 1:** Nên thời gian failover thật là một tổng, và TTL chỉ là một trong bốn số hạng: thời
gian phát hiện, cộng TTL, cộng cache phía client, cộng vòng đời connection pool. Hai tới năm
phút cho phần lớn traffic, và còn một cái đuôi dài sau đó.
**→ 2:** Đây mới là nước đi thật sự hiệu quả. Bạn không làm DNS nhanh lên được — nhưng bạn làm
cho cái chậm đó vô hại được. Đừng bao giờ cắt phăng địa chỉ cũ. Cho nó proxy tiếp qua region
đang khoẻ, hoặc trả 503 kèm Retry-After. User có thể thấy *không lỗi nào* trong một lần failover
vẫn mất năm phút.
**Chốt:** Và đừng với tay tới "TTL bằng 1 giây". Resolver có sàn tối thiểu của họ, mình trả
tiền theo số query, và chính mấy câu trả lời đã cache mới là thứ giữ user chạy được khi
nameserver của mình không với tới được.

### 27 / 54 · Anycast
**Nói:** Đòn bẩy hai, và là một ý tưởng hoàn toàn khác. Nhiều site cùng announce *cùng một* địa
chỉ IP qua BGP — "traffic cho địa chỉ này cứ gửi về tôi" — và mọi network trên đường đi chọn
cái announcement mà nó thấy gần nhất. Hai user ở đây quay cùng một địa chỉ mà đáp xuống hai toà
nhà khác nhau.
**→ 1:** Failover là rút announcement đi. Singapore thôi không nói là nó tới được địa chỉ đó
nữa, và trong vài giây cả internet học lại đường tốt nhì. Không client nào cần câu trả lời mới,
vì địa chỉ họ đang giữ có đổi đâu. Đó là lý do nó tính bằng giây, không phải bằng phút.
**→ 2:** Cái bẫy: BGP đo khoảng cách bằng *số network phải đi qua*, không phải bằng mili-giây.
Một ISP có thoả thuận peering hơi lạ là user Việt Nam đi Los Angeles thay vì Singapore. Và bạn
không nói được "cho PoP này hai mươi phần trăm" — đòn bẩy chỉ có: làm nó kém hấp dẫn đi, hoặc
rút hẳn.
**Chốt:** Nó cũng là network engineering thứ thiệt: ASN riêng, dải IP riêng, thoả thuận peering.
Đó đúng là lý do phần lớn team đi thuê anycast chứ không tự dựng.

### 28 / 54 · Anycast + edge proxy
**Nói:** Giờ ghép hai cái lại, và đây là câu trả lời hiện đại. Anycast đưa user tới PoP gần
nhất, và PoP đó là một **L7 proxy đầy đủ**, không phải cái bảng chỉ đường. Nó tự hoàn tất
handshake — ba vòng ở 30 mili-giây thay vì 230, tức 90 mili-giây thay vì 690 — rồi chuyển
request đi tiếp trên một connection ấm sẵn trong pool, qua backbone riêng. Đại dương chỉ bị
vượt qua một lần.
**→ 1:** Và vì nó là L7 proxy thật, mọi thứ ở phần 1 giờ chạy được ở *quy mô toàn cầu*: chọn
origin theo health, retry sang region khác, canary theo weight cho từng region, drain êm cả một
region. Toàn những thứ DNS về bản chất không làm nổi.
**→ 2:** Gắn thêm cache vào là thành CDN. Nhưng để ý chỗ quan trọng: cái lợi 90 mili-giây kia
không cần cache gì cả. Đó là lý do đặt một API sau CDN vẫn đáng, kể cả khi **tỉ lệ cache hit
bằng 0%**.
**Chốt:** Cloudflare, global load balancer của Google, Fastly — đều là cỗ máy này.

### 29 / 54 · Đòn bẩy nào, khi nào
**Nói:** Bảng so sánh. Failover: phút, giây, dưới một giây. Điều khiển theo từng request: không,
không, full L7. Thấy được load của backend: không, không, có. Quy luật y hệt phần 1 — load
balancer càng nằm *trên đường đi*, nó càng làm được nhiều.
**→ 1:** Cái bẫy chung cho cả ba: health check toàn cầu khó thật sự. "ap-southeast-1 có khoẻ
không" không có một câu trả lời duy nhất — nó có thể hoàn toàn khoẻ nhưng không với tới được từ
châu Âu vì một nhà mạng trung chuyển. Probe từ một chỗ thì được bức tranh sai; probe từ mọi nơi
thì được một mớ ý kiến trái nhau phải tự xử.
**Chốt:** Và khi health check toàn cầu chập chờn, nó không loại một pod. **Nó dịch chuyển cả
một châu lục.**

### 30 / 54 · Kiến trúc
**Nói:** Đây là toàn bộ mọi thứ ráp lại, và là hình dạng phần lớn team đang chạy thật. Route 53
với latency routing, TTL 60 giây, chọn region. Trong mỗi region, một NLB trải trên ba AZ chia
connection, một fleet proxy L7 terminate TLS và chia request, còn mesh sidecar chia các cuộc gọi
gRPC nội bộ.
**Chốt:** Bốn quyết định cân bằng tải cho một request — và mỗi cái là một tầng khác nhau
từ phần 1.

### 31 / 54 · Capacity
**Nói:** Cái bẫy không ai lên kế hoạch cho: **failover chuyển traffic, chứ không chuyển
capacity.** Singapore biến mất là Tokyo ôm 100% thế giới. Nếu Tokyo không gánh nổi *ngay lúc
đó* thì bạn vừa biến một sự cố region thành hai.
**Làm phép tính:** 200.000 request một giây trên toàn cầu. Mất một region nghĩa là con còn lại
ôm hết 200.000. Một node L7 balancer chạy 25.000 ở 60% CPU — nhớ tự đo hệ thống của bạn, đừng lấy
số của mình. Vậy là 8 node, nhân 1,5 để sống sót khi mất một AZ, thành 12 node mỗi region,
bình thường chạy khoảng một phần ba công suất.
**Nói:** Cái một phần ba nằm không đó không phải lãng phí. Nó chính là thứ khiến failover trở
thành chuyện nhỏ. Và nhớ đếm cả connection chứ đừng chỉ đếm request: 400.000 WebSocket đang mở,
mỗi cái ~50 KB, là 20 GB trên cả fleet.
**→ 1:** Rồi chứng minh nó. Game-day drill: cố tình drain một region, trong giờ hành chính, và
nhìn p99 với 5xx. Kế hoạch capacity chưa từng test thì vẫn chỉ là giả thuyết.

### 32 / 54 · Divider 03
**Nói:** Mình là Khánh. Mười slide tới, mỗi algorithm đều chỉ có một câu hỏi: load balancer
thật sự nhìn vào cái gì? Thứ tự, capacity đã cấu hình, tải đang chạy, hay client là ai.

### 33 / 54 · Load balancing algorithm là gì?
**Nói:** Trước hết tách hai thứ mọi người hay gộp. Health check quyết định server nào *được
phép*. Algorithm chọn một *trong số đó*, cho request này, dựa trên thông tin nó có. Static là
luật cố định, mù tịt về việc server đang làm gì lúc này. Dynamic là nó đọc trạng thái sống của
server — và trong bốn cái của mình chỉ có một cái là dynamic.
**→ 1, 2, 3:** (mở từng dòng) thứ tự → round robin. Capacity cấu hình sẵn → weighted. Số
connection đang chạy → least connections, cái dynamic duy nhất. IP của client → IP hash.
**Chốt:** Với mỗi cái, hỏi hai câu: nó biết gì, và nó *bỏ qua* gì? Phần bị bỏ qua luôn là chỗ
nó vỡ.

### 34 / 54 · Round robin
**Nói:** Server kế tiếp trong danh sách, hết thì quay lại đầu. Một biến đếm, `i++ % N`. Mặc
định của NGINX, HAProxy và ALB. Nhìn nè: sáu request, mỗi con hai. Đều tăm tắp — nếu đếm theo
số request.
**→ 1 (replay):** Cũng sáu request đó, nhưng giờ là thật: `/export` mất ba giây, `/health` mất
năm mili-giây. Vẫn 2-2-2 nếu đếm, nhưng server A đang ôm sáu nghìn mili-giây công việc còn B
có mười.
**Chốt:** Round robin đếm request, không đếm khối lượng việc. Dùng khi server cùng cỡ và
request tốn xấp xỉ nhau.

### 35 / 54 · Weighted round robin
**Nói:** Server A to gấp ba, nên cho weight 3. Cách làm ngây thơ là đi theo một danh sách cố
định, `A A A B C` — đúng tỉ lệ, nhưng A ăn ba cú liên tiếp trong khi B và C ngồi chơi.
**→ 1:** NGINX làm mượt: cộng weight vào biến đếm của từng server, chọn con lớn nhất, rồi trừ
đi tổng. Ra `A B A C A`. Vẫn 6-2-2, mà không bị dồn cục.
**→ 2:** Và cái bẫy: weight là thứ bạn *tin* server gánh được, không phải một phép đo. Đặt sai
là bạn vừa cấu hình sẵn một cú quá tải.
**Dùng khi:** instance nhiều cỡ khác nhau trong lúc migration, hoặc chia traffic cho canary.

### 36 / 54 · Least connections
**Nói:** Giờ tới cái biết đọc trạng thái sống. Server B đang GC pause — mỗi request năm giây
thay vì một. Round robin vẫn đều đặn đưa cho nó mỗi request thứ ba và chúng chất đống: bốn trên
mười hai, bốn cái kẹt cùng lúc.
**→ 1 (replay):** Least connections thấy B đang bận nên đi chỗ khác. B chỉ nhận một trên mười
hai. Không đổi config, không cần alert, nó tự né.
**→ 2:** Cái giá: load balancer phải theo dõi số đếm cho từng server. Và một server vừa mới lên
thì có zero connection, nên bị dội nước ngay khoảnh khắc nó vào — đó là lý do có slow start.
**Dùng khi:** thời gian request chênh nhau nhiều, hoặc connection sống lâu — WebSocket, upload,
DB proxy.

### 37 / 54 · IP hash
**Nói:** Mục tiêu khác: đưa cùng một client về cùng một server, mà không cần bảng lưu ở đâu cả.
`hash(ip) % N`. Mấy giá trị hash đang trên màn hình — mọi người kiểm tra phép tính giúp mình.
Vòng một, ai cũng có session. Vòng hai, cùng IP, cùng hash, cùng server: sáu trên sáu tìm lại
được session.
**→ 1 (replay):** Rồi tới cái văn phòng. Năm mươi người sau một IP NAT, với hàm hash thì đó là
*một client*. Tất cả đáp xuống server A. Và `ip_hash` của NGINX chỉ dùng ba octet đầu của IPv4,
nên nguyên một /24 dùng chung một server. User mobile thì đổi IP nên cũng mất affinity luôn.

### 38 / 54 · IP hash khi số server thay đổi
**Nói:** Vấn đề lớn hơn. Ba server, session đã nằm đúng chỗ.
**→ 1:** Thêm server D. `% 3` thành `% 4`, và phần lớn user — ba phần tư — rơi vào server chưa
từng thấy session của họ. Alex Xu gọi đây là bài toán rehashing, chương 5. Mỗi một cái như vậy
là một lần bị đăng xuất.
**→ 2:** B chết: user của B đi chỗ khác, và session của họ không đi theo.
**→ 3:** Consistent hashing sửa được phần *quy mô* — chỉ khoảng 1/N user phải dịch chuyển.
Trong NGINX là `hash $remote_addr consistent`. Phụ lục có phần đi chi tiết.

### 39 / 54 · Sticky session: stateful vs stateless
**Nói:** Lùi lại một bước. IP hash chỉ quan trọng vì server đang giữ session trong RAM. Đó mới
là con bug thật. Alex Xu, chương 1: với server stateful thì mọi request của một client phải quay
lại đúng server đó — sticky session làm được việc đó, nhưng giờ thêm bớt server thành khó, và
một server chết là lỗi user nhìn thấy được. Phần lớn load balancer ghim bằng cookie chứ không
bằng IP — `AWSALB`, `cookie` của HAProxy, `sticky cookie` của NGINX — cái này sống qua được việc
đổi IP, và dính đủ mọi vấn đề còn lại.
**→ 1:** Cách sửa chỉ là một dòng kiến trúc: đẩy session qua Redis, một NoSQL store, hay DB.
Tầng web thành stateless và server nào cũng phục vụ được bất kỳ ai.
**→ 2:** Vẫn muốn affinity? Dùng nó như một *gợi ý cache* — mất nó thì chỉ nên tốn một cache
miss, chứ không phải một lần đăng xuất.

### 40 / 54 · So sánh các algorithm
**Nói:** Cả phần này gói trong một bảng. Đọc kỹ hai dòng quan trọng: chỉ least connections biết
tải hiện tại. Chỉ IP hash cho affinity. Không cái nào làm được cả hai — đó không phải do bảng
này thiếu, mà đúng là tình trạng của bốn cái kinh điển.
**Chốt:** Nên chọn theo nhu cầu traffic của mình, và thành thật với bản thân về thứ mình đang
đánh đổi.

### 42 / 54 · Chọn thế nào
**Nói:** Bốn câu hỏi. Tới lượt ai — round robin, server giống hệt nhau. Ai to hơn — weighted,
nhiều cỡ máy và canary. Ai đang rảnh nhất lúc này — least connections, thời gian request chênh
lệch. Client này là ai — IP hash, khi user buộc phải ở yên một server.
**→ 4:** Còn nếu đang với tay tới sticky session: hỏi trước xem có làm app stateless được không
đã. Thường đó mới là cách rẻ hơn.

## Phụ lục — chỉ khi còn giờ hoặc có người hỏi

### 43 / 54 · Divider — Ngoài bốn cái kinh điển
**Nói:** Hai thứ đáng biết nếu muốn đi xa hơn.

### 44 / 54 · Power of two choices
**Nói:** Quét 200 pod để tìm con ít việc nhất là O(n) cho mỗi request. Bốc ngẫu nhiên hai con,
gửi cho con rảnh hơn — O(1), mà vẫn né được con tệ nhất, vì một pod đang kẹt chỉ thắng khi bị
đem so với con còn tệ hơn.
**→ 1:** Nó cũng trị được hiệu ứng bầy đàn. Nhiều load balancer thì mỗi con chỉ biết số đếm
của riêng nó, nên "chọn con rảnh nhất" một cách nghiêm ngặt sẽ khiến tất cả dồn vào đúng cái
pod mới cùng một lúc. Bốc cặp ngẫu nhiên phá được chuyện đó.
**→ 2:** Chất lượng gần bằng least connections với chi phí của round robin. `LEAST_REQUEST` của
Envoy mặc định làm vậy. Mặc định tốt cho L7.

### 45 / 54 · Một pod chậm, bốn algorithm
**Nói:** Mô phỏng: 480 req/s trong mười giây vào bốn pod, pod-d chậm gấp ba. Traffic đến và
khối lượng việc giống hệt nhau cho cả bốn chế độ — chỉ khác cách chọn. Bấm qua từng cái: round
robin cứ đút cho pod-d tới khi hàng đợi nổ tung; random cũng chẳng khá hơn; least connections và
power-of-two giữ nó phẳng. Nhìn con số p99 đổi theo.

### 46 / 54 · Hash-based
**Nói:** Sáu mươi cache key, ba node. Thêm node thứ tư bằng `hash % 4` thì phần lớn key dịch
chỗ — mỗi chấm đỏ là một cache miss phải đi xuống DB. Chuyển qua consistent hashing thì chỉ
những key thuộc về D mới dịch, và chúng dịch *về* D hết.
**Chốt:** Dùng hash khi locality quan trọng: cache theo user, một shard, một phòng WebSocket.

### 47 / 54 · Consistent hashing, cái vòng
**Nói:** Node và key nằm chung trên một vòng. Một key thuộc về node đầu tiên đi theo chiều kim
đồng hồ.
**→ 1:** Thêm D — chỉ những key nằm giữa C và D đổi chủ. Còn lại nằm yên, khoảng 1/N dịch
chuyển.
**→ 2:** Với ba điểm thì các cung không đều, nên các implementation thật cho mỗi node 100 tới
200 virtual node và phần chia sẽ đều ra.

---

# Phần 4 — Demo: con server bị crash (Khánh)

### 48 / 54 · Divider 04
**Nói:** Làm cho nó thật nào. Ba server, NGINX đứng trước, và tới lúc nào đó mình sẽ giết một
con trong khi request vẫn đang chạy.

### 49 / 54 · Setup
**Nói:** Ba server Node trên 8001, 8002, 8003, không làm gì ngoài việc nói tên của chính nó —
nên mỗi response cho biết ai đã trả lời. NGINX trên 8000 đứng trước. `npm start` dựng cả bốn,
`npm run status` cho thấy ai còn sống và đang nạp algorithm nào.

### 50 / 54 · NGINX làm load balancer
**Nói:** Toàn bộ config: một khối `upstream`, ba server, không có dòng algorithm nào — và không
có dòng algorithm *nghĩa là* round robin. Sáu cú curl.
**→ 1:** 8001, 8002, 8003, rồi quay lại. Đó là toàn bộ ý tưởng round robin, trong phần mềm chạy
production.

### 51 / 54 · Đoán trước đi
**Nói:** Trước khi mình chạy — mọi người đoán thử. Mỗi cái dưới đây là một dòng trong khối
upstream. (Lấy đáp án từ khán phòng cho từng dòng rồi mới mở.)
**→ 1:** `weight=4` → `8001 8001 8002 8001 8003 8001`. Smooth weighted round robin, tỉ lệ 4:1:1
— đúng kiểu đan xen mình thấy ở slide 35.
**→ 2:** `least_conn` → vẫn ra thứ tự round robin, vì mọi request xong ngay lập tức, số đếm hoà
nhau ở zero, và NGINX phá hoà bằng round robin. Least connections cần request *chậm* thì mới
khác round robin.
**→ 3:** `ip_hash` → một server, sáu lần. Mọi request đều từ 127.0.0.1. Đúng bài toán NAT văn
phòng, ngay trước mắt.
**→ 4:** Crash 8002 → traffic chia cho 8001 và 8003, và client không thấy lỗi gì hết. Vì sao thì
hai slide tới.

### 52 / 54 · Live
**Nói:** Đây là request thật, bắn từ chính slide này tới NGINX trên 8000. Bấm `S` để bắn sáu
cái, `Shift+S` để bắn mười hai. Cái hộp load balancer hiện algorithm đang chạy lấy từ `X-LB`, và
mọi server mà NGINX đã thử lấy từ `X-Upstream`.
**Làm dưới terminal, vừa làm vừa nói:**
1. `npm run algo -- least` rồi `npm run slow -- 8002 3000` — giờ least connections và round
   robin khác nhau thấy rõ, vì 8002 thật sự đang ôm request.
2. `npm run crash -- 8002` — bắn request, nhìn đồng xu nảy khỏi 8002 và rơi xuống server khác.
3. `npm run revive -- 8002` — nó quay lại vòng xoay ở lần thử kế tiếp.
**Nếu không kết nối được:** slide sẽ ghi `recorded` và phát lại một vòng round robin — cứ kể
theo đó mà đi tiếp, đừng debug trên sân khấu.

### 53 / 54 · Vì sao không ai thấy cú crash
**Nói:** Cơ chế là đây. Connection refused được tính là một lần fail, nên NGINX chuyển request
qua server kế tiếp — `proxy_next_upstream error timeout`, và đó là mặc định. Client nhận một cái
200 hơi chậm thay vì một cái 502.
**→ 1:** Mặc định là `max_fails=1`, `fail_timeout=10s`. Một lần fail là 8002 bị cho ra ngoài
mười giây, rồi NGINX thử lại.
**→ 2:** Hồi sinh nó thì lần thử kế tiếp là nó vào lại. Và để ý đây là kiểu gì: kiểm tra
*passive*. NGINX chỉ biết khi có một request thật fail — một user thật đã trả giá cho phát hiện
đó. Active health check thì probe theo timer thay vì vậy.
**→ 3:** Thử đúng như vậy với `ip_hash` xem, mấy user đang ở 8002 sẽ dời qua server khác. Nếu
session nằm trong memory thì họ vừa bị đăng xuất. Đúng y slide 39.

### 54 / 54 · Cảm ơn + Kahoot
**Nói:** Xong rồi đó. Hỏi đáp trước, rồi một ván Kahoot ngắn về chuyện load balancer biết những
gì: thứ tự, capacity, tải, danh tính client. Quét QR hoặc vào kahoot.it — PIN đang trên màn hình.

---

## Mấy câu hay được hỏi

- **"Bản thân load balancer có phải single point of failure không?"** → Ngắn gọn: có. Trong một
  region thì chạy thành cặp (VRRP, floating IP) hoặc thành fleet sau ECMP/anycast, hoặc xài loại
  managed. Nhưng cả region sập thì hết cách — đó đúng là slide 23.
- **"Sao không xài luôn DNS round robin?"** → Slide 25. Không có health, không biết load, và TTL
  nghĩa là một IP đã chết vẫn nhận traffic cả mấy phút.
- **"Tụi mình xài gRPC mà một pod ăn hết tải."** → Slide 20 cộng với 3.5: gRPC dồn mọi thứ lên
  một connection, nên load balancer L4 chọn pod đúng một lần rồi thôi. Cân bằng theo request ở
  L7, hoặc theo từng call trong client / mesh.
- **"Nên dùng algorithm nào?"** → Slide 42. Bắt đầu bằng round robin, chuyển qua least
  connections khi thời gian request chênh lệch, và coi sticky session như một mùi lạ cần xem lại.
- **"Failover thật sự nhanh cỡ nào?"** → Slide 26: thời gian phát hiện cộng TTL cộng mấy con
  rớt lại, nên DNS là vài phút, anycast là vài giây.
