# Spec cho agent Hermes: phát hiện văn bản mới trên QLVB HPnet và đưa vào My Office

> Phiên bản 04/11/2026 · Chủ hệ thống: anh Bùi Minh Khôi (TTYT Thủy Nguyên)
> Tài liệu này **không chứa bất kỳ mật khẩu, token hay secret nào**. Mọi giá trị bí mật được chủ hệ thống cấp riêng qua kênh an toàn.

---

## 0. Đọc gì trước

| Nguồn | Ở đâu | Đọc để biết |
|---|---|---|
| Repo ứng dụng **My Office** (public) | https://github.com/khoibmtn/my-office (nhánh `main`) | Toàn bộ ứng dụng nhận văn bản |
| Extension Chrome **My Office - QLVB Helper** | Cùng repo, thư mục [`extension/`](https://github.com/khoibmtn/my-office/tree/main/extension) | Cách lấy văn bản khi người dùng đang mở QLVB trong trình duyệt |
| Đặc tả HPnet + extension | [`docs/QLVB_HPNET_SPEC.md`](https://github.com/khoibmtn/my-office/blob/main/docs/QLVB_HPNET_SPEC.md) | Menu, DOM, AJAX endpoint, cấu trúc file chính/đính kèm |
| Khảo sát endpoint JSON | [`docs/QLVB_MONITOR_PROPOSAL.md`](https://github.com/khoibmtn/my-office/blob/main/docs/QLVB_MONITOR_PROPOSAL.md) | Endpoint danh sách, mã `status` từng mục, phương án theo dõi |
| API nhận văn bản | `app/api/extension/check-duplicate`, `upload/init`, `submit` (`route.ts`); xác thực ở `lib/api-auth.ts`, `lib/ingest-auth.ts` | Hợp đồng API ở mục 4 |
| **qlvb-watcher** (bản tham chiếu đang chạy production) | Chưa có trên GitHub, chỉ ở máy anh Khôi. Xin chủ hệ thống quyền đọc nếu cần | Cloudflare Worker đang làm đúng việc của tài liệu này: `src/qlvb.ts` (client HPnet), `src/poll.ts` (phát hiện), `src/myoffice.ts` (đẩy sang My Office), `src/format.ts` (chuẩn hoá trường) |

Mục 2–4 dưới đây đã tóm tắt đủ để làm việc mà không cần đọc mã qlvb-watcher. **Mục 8** mô tả bộ kiểm định kỳ đang chạy trên Cloudflare và phương án khuyến nghị: Hermes kích hoạt và đọc kết quả từ bộ kiểm này thay vì tự đăng nhập HPnet.

---

## 1. Bối cảnh và mục tiêu

- **QLVB HPnet** (`https://qlvb.hpnet.vn`): Văn phòng điện tử của Sở Y tế Hải Phòng. Nền ASP.NET WebForms, đăng nhập Forms Authentication bằng cookie `.ASPXFORMSAUTH`, không có API công khai.
- **My Office** (`https://my-office-inky.vercel.app`): ứng dụng Next.js 14 trên Vercel, dữ liệu ở Firestore, file ở Google Drive. Mỗi văn bản là một bản ghi `documents` gồm metadata, file chính và các file đính kèm trên Drive.
- **Mục tiêu:** khi xuất hiện văn bản mới trong mục theo dõi trên HPnet (mặc định "VB đến → Chờ xử lý"), tạo đúng **một** bản ghi tương ứng trong My Office. Bản ghi phải kèm file chính và mọi file đính kèm, và **không được** tạo văn bản thiếu tệp.

Hiện đã có 2 kênh đang chạy, Hermes **không được** phá vỡ chúng:
1. **Extension Chrome:** người dùng bấm gửi khi đang xem văn bản.
2. **qlvb-watcher** (Cloudflare Worker + runner Windows): tự quét theo lịch, báo Telegram và tự đẩy theo rule.

---

## 2. Phát hiện văn bản mới trên HPnet

### 2.1. Đăng nhập (WebForms)
1. `GET /style/qlvb2013/Login.aspx?ReturnURL=<base>/default.aspx`. Giữ cookie trả về, đọc toàn bộ `<input type="hidden">` (`__VIEWSTATE`, `__EVENTVALIDATION`, …) và `action` của `<form>`.
2. `POST` về `action` đó, `Content-Type: application/x-www-form-urlencoded`, gồm:
   - mọi trường hidden ở bước 1;
   - `Login1$UserName`, `Login1$Password`, `Login1$RememberMe=on`, `Login1$Login=Đăng nhập`;
   - header `Referer` = URL trang login, `Origin` = base.
   Dùng `redirect: manual`.
3. Thành công khi response có `Set-Cookie: .ASPXFORMSAUTH=…`. Thất bại thì đọc `#Login1_FailureText`.
4. **Lưu cookie và dùng lại** cho các lần sau. Chỉ đăng nhập lại khi phiên hết hạn (mục 2.5).

**Rủi ro tài khoản:**
- Sai mật khẩu nhiều lần có thể bị khoá. Sau một lần đăng nhập thất bại, ngừng ít nhất 15 phút.
- HPnet bắt đổi mật khẩu định kỳ.
- **Chưa xác nhận** HPnet có cho 2 phiên song song cùng một tài khoản hay không. Đăng nhập thêm một phiên có thể làm văng phiên của qlvb-watcher hoặc trình duyệt của anh Khôi. Hỏi chủ hệ thống trước khi chạy song song.

### 2.2. Lấy danh sách văn bản đến (JSON, không cần đọc DOM)
```http
POST /vpdt/soyte/VanbanDenTruongPhong.aspx?jtStartIndex=0&jtPageSize=50
Cookie: .ASPXFORMSAUTH=...
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Accept: application/json, text/javascript, */*; q=0.01
Referer: https://qlvb.hpnet.vn/?action=102

all=false&key=&status=18&sokyhieu=&trichyeu=&coquan=
```
Mã `status` tương ứng các mục trong menu:

| status | Mục |
|---|---|
| **18** | **Chờ xử lý** (mục theo dõi chính) |
| 7 | Đang xử lý |
| 6 | Đã xử lý |
| 12 | VB thông báo |
| 13 | VB phối hợp |
| 11 | Được đánh dấu |
| 1 | Tra cứu |

Văn bản đi dùng endpoint tương tự: `POST /vpdt/soyte/VanbanDiNoiboChuyenvien.aspx?...` với body `key=&status=...`.

Response `{ "Result": "OK", "TotalRecordCount": n, "Records": [...] }`. Các trường cần dùng của mỗi record:

| Trường | Ý nghĩa |
|---|---|
| `VanbanDenId` | **Khoá duy nhất** (GUID) |
| `Name` | Số ký hiệu (có thể kèm "(số đến: …)") |
| `TrichYeu` | Trích yếu |
| `NgayBanhanh` | Ngày ban hành (`dd/mm/yyyy`) |
| `NgayDen` | Ngày đến |
| `CoquanBanhanh` | Cơ quan ban hành |
| `Lanhdao` | Lãnh đạo chỉ đạo |
| `ChuyenVien` | Người xử lý |
| `Thoihan`, `HanHoanthanh` | Hạn xử lý |
| `Dokhan` | Độ khẩn (chuỗi) |

Lưu ý: văn bản chỉ vào mục "Chờ xử lý" của chuyên viên **sau khi lãnh đạo giao việc**, không phải lúc Sở phát hành.

### 2.3. Chi tiết và danh sách file
```http
GET /vpdt/soyte/Ajax/LoadVanBanDenInfo.aspx?VanbanDenId=<GUID>
X-Requested-With: XMLHttpRequest
Accept: application/json; charset=utf-8
Referer: https://qlvb.hpnet.vn/?action=102
```
Response gồm:
- `file`: đường dẫn file chính;
- `files`: mảng `[{ FileName, FilePath }]` gồm cả file đã ký và file kèm (có thể trùng `file`);
- `sokh`, `ngaybh`, `coquanbh`, `ngaynhap` (`dd/mm/yyyy hh:mm:ss`), `trichyeu`, `lanhdao`, `phongban`, `chuyenvien`, `thoihan`.

Ý kiến chỉ đạo (tuỳ chọn): `GET /vpdt/soyte/Ajax/LoadVanBanDenYKien.aspx?VanbanDenId=<GUID>` trả `ListYkien` và `ListYkienDaxem`, mỗi mục có `{ hovaten, ngaygio, noidung }`.

**Tải file:**
- `FilePath` có dạng `//qlvb.hpnet.vn/upload/...` hoặc `/upload/...`. Chuẩn hoá thành URL tuyệt đối `https://…`, rồi `encodeURI` nếu chưa được encode (đường dẫn có dấu cách).
- `GET` URL đó kèm cookie phiên. File < 100 byte và có chữ "login" nghĩa là phiên đã hết. HTTP 4xx nghĩa là file không còn: bỏ qua tệp **kèm** đó, nhưng file **chính** thì bắt buộc phải có.

### 2.4. Thuật toán phát hiện "mới"
```
seen[status] = tập VanbanDenId đã xử lý (lưu bền vững: KV/DB/file)
lần đầu chạy mỗi mục: chỉ ghi toàn bộ id hiện có vào seen, KHÔNG đẩy (seed)
mỗi lần kiểm:
  records = list(status, pageSize=50)
  fresh = records không có trong seen (xử lý cũ → mới, tức đảo thứ tự danh sách)
  với mỗi rec trong fresh:
     detail = getDetail(rec.VanbanDenId)
     nếu đủ điều kiện đẩy → push (mục 3) → THÀNH CÔNG hoặc trùng thì mới thêm vào seen
     nếu lỗi mạng hoặc lỗi tạm → KHÔNG thêm vào seen (lần sau thử lại)
```
- **Nhịp kiểm:** khuyến nghị 30–60 phút trong giờ hành chính (07:00–17:00, thứ Hai–thứ Sáu). Mỗi lần kiểm tốn 1 request danh sách, cộng 1 request chi tiết cho mỗi văn bản mới. Không quét dày hơn 5 phút.
- **Chống trùng hai lớp:** tập `seen` của Hermes và API `check-duplicate` của My Office (mục 4.1). qlvb-watcher cũng có thể đẩy cùng văn bản đó, nên **luôn gọi `check-duplicate` trước khi tạo**.

### 2.5. Phiên hết hạn và mạng
- Phiên hết hạn khi gặp một trong các dấu hiệu sau:
  - response 3xx;
  - body bắt đầu bằng `Please login`;
  - JSON có `Message` chứa "Phiên đăng nhập" hoặc "đăng nhập lại".
  Khi đó đăng nhập lại **một lần** rồi gọi lại request.
- Từ hạ tầng nước ngoài (Cloudflare), khoảng 50% lần gọi bị **522/timeout** theo từng cửa sổ vài phút. Thử lại trong cùng lần chạy thường vô ích; để lần chạy sau thử lại. Máy chạy ở Việt Nam ổn định hơn nhiều.

---

## 3. Chuẩn hoá dữ liệu trước khi đẩy

Mỗi trường lấy từ `detail` trước, nếu trống mới lấy từ `rec`. Làm sạch bằng cách bỏ thẻ HTML, `&nbsp;`, `&amp;` và gộp khoảng trắng.

| Trường My Office | Lấy từ | Quy tắc |
|---|---|---|
| `title` | `detail.trichyeu` / `rec.TrichYeu` | Bỏ tiền tố "Trích yếu:" |
| `docNumber` | `detail.sokh` / `rec.Name` | Bỏ phần "(số đến…)" và tiền tố "Số/KH:" |
| `issueDate` | `rec.NgayBanhanh` / `detail.ngaybh` | Chuỗi `dd/mm/yyyy` (có thể kèm ` hh:mm[:ss]`) |
| `deadline` | `rec.Thoihan` / `rec.HanHoanthanh` / `detail.thoihan` | Cùng định dạng; để trống nếu không có |
| `sender` | `rec.CoquanBanhanh` / `detail.coquanbh` | |
| `leader` | `rec.Lanhdao` / `detail.lanhdao` | |
| `assignee` | `rec.ChuyenVien` / `detail.chuyenvien` | Server tự bỏ tên "Bùi Minh Khôi" |
| `priority` | `rec.Dokhan` | "hỏa tốc hẹn giờ" → `express_scheduled`; "hỏa tốc" → `express`; "thượng khẩn" → `very_urgent`; "khẩn" → `urgent`; còn lại → `normal` (so không phân biệt hoa thường) |
| `originalLink` | | `https://qlvb.hpnet.vn/?action=102` |
| `notes` | | Ví dụ: `Tự động từ Hermes` + `Ngày nhập QLVB: …` + `Ngày đến: …` + `Đơn vị xử lý: …` (mỗi ý một dòng) |
| `tags` | | Chuỗi phân tách bằng dấu phẩy, ví dụ `qlvb,cho-xu-ly,hermes` |

**Tên file trên Drive** (giống extension và watcher):

`YYYYMMDD-<sốKH>[-kem]-<tên gốc>.<ext>`

- `YYYYMMDD`: lấy từ ngày ban hành.
- `sốKH`: thay `/`, `-` và khoảng trắng bằng `.`.
- `-kem`: chỉ thêm cho file đính kèm.
- Tên gốc: bỏ dấu, ký tự lạ đổi thành `-`, tối đa 80 ký tự.
- Phần mở rộng viết thường.

Ví dụ: `20261103-12575.SYT.NVY-Huong-dan-trien-khai.pdf`.

Bỏ qua đính kèm có cùng URL với file chính.

---

## 4. Đưa văn bản vào My Office (API server-to-server)

Base URL: `https://my-office-inky.vercel.app`.

**Xác thực:** mọi request gửi kèm `ingestSecret` trong **body JSON**.
- Giá trị phải khớp biến `QLVB_INGEST_SECRET` trên Vercel. Chủ hệ thống cấp riêng; **tuyệt đối không commit, không log, không gửi kèm báo cáo**.
- Sai hoặc thiếu secret thì trả `401 { error: "UNAUTHORIZED", message }`.

Thứ tự bắt buộc: **check-duplicate → tải hết file từ HPnet → upload/init + PUT cho từng file → submit**. Chỉ cần một file chính hoặc đính kèm lỗi mạng là dừng, **không** gọi `submit`. Trường hợp đó ghi nhận để lần sau thử lại.

### 4.1. Kiểm trùng
```http
POST /api/extension/check-duplicate
Content-Type: application/json

{ "docNumber": "12575/SYT-NVY", "ingestSecret": "<secret>" }
```
→ `200 { "exists": boolean, "matches": [{ id, title, docNumber, status, assignee, deadline, createdAt }] }`. So khớp **chính xác** theo `docNumber` (đã trim).

Nếu `exists: true` thì không tạo mới; đánh dấu đã xử lý (`seen`).

### 4.2. Upload từng file lên Drive (resumable, 2 bước)
**Bước 1: xin URL upload**
```http
POST /api/extension/upload/init
Content-Type: application/json

{ "fileName": "<tên chuẩn hoá>", "mimeType": "application/pdf", "ingestSecret": "<secret>" }
```
→ `200 { "uploadUrl": "https://www.googleapis.com/upload/drive/v3/files?...&upload_id=..." }`. File được tạo trong thư mục Drive của ứng dụng.

**Bước 2: gửi nội dung file thẳng tới Google**
```http
PUT <uploadUrl>
Content-Type: <mimeType>

<bytes>
```
→ `200 { "id": "<driveFileId>", "mimeType": "..." }`. Nếu đứt mạng giữa chừng, có thể PUT lại cùng `uploadUrl`.

Từ `id` suy ra `driveViewUrl = https://drive.google.com/file/d/<id>/preview`.

### 4.3. Tạo văn bản
```http
POST /api/extension/submit
Content-Type: application/json
```
```json
{
  "title": "V/v ...",
  "docNumber": "12575/SYT-NVY",
  "issueDate": "03/11/2026",
  "deadline": "",
  "assignee": "Yến",
  "sender": "Sở Y tế",
  "leader": "Lê Khắc Tùng",
  "originalLink": "https://qlvb.hpnet.vn/?action=102",
  "priority": "normal",
  "notes": "Tự động từ Hermes\nNgày nhập QLVB: 03/11/2026 16:25:10",
  "tags": "qlvb,cho-xu-ly,hermes",
  "ingestSecret": "<secret>",
  "mainFileId": "<driveFileId file chính>",
  "mainFileUrl": "https://drive.google.com/file/d/<id>/preview",
  "mainMimeType": "application/pdf",
  "attachmentsJson": "[{\"id\":\"<tên>\",\"title\":\"<tên>\",\"originalLink\":\"\",\"driveFileId\":\"<id>\",\"driveViewUrl\":\"https://drive.google.com/file/d/<id>/preview\",\"mimeType\":\"application/pdf\",\"uploadedAt\":\"2026-11-03T09:25:00.000Z\"}]"
}
```
→ `200 { docId, driveFileId, driveViewUrl, attachments: [...], appUrl: "/documents/<docId>" }`.

Server tự làm các việc sau:
- đặt `status = "pending"`;
- cấp quyền "Bất kỳ ai có liên kết đều xem được" cho các file Drive (đây là **thiết kế có chủ đích**, không thay đổi);
- đồng bộ chỉ mục tìm kiếm Algolia.

Trang Văn bản của người dùng tự hiện văn bản mới trong vòng tối đa khoảng 1 phút.

### 4.4. Không được làm
- Không ghi trực tiếp vào Firestore, Drive hay Algolia của My Office; chỉ đi qua 3 API trên.
- Không sửa hay xoá văn bản đã có, không đổi trạng thái hay người xử lý của văn bản trong My Office.
- Không thay đổi quyền chia sẻ file Drive.
- Không đổi mật khẩu HPnet, không đăng nhập lặp lại khi sai mật khẩu.
- Không thao tác ghi trên HPnet (giao việc, chuyển xử lý, đánh dấu đã xem…); chỉ được đọc.
- Không lưu secret, cookie phiên hay mật khẩu vào log, issue, commit hay tin nhắn.

---

## 5. Lỗi thường gặp và cách xử lý

| Tình huống | Dấu hiệu | Xử lý |
|---|---|---|
| Phiên HPnet hết hạn | 3xx, `Please login`, file < 100 byte có chữ login | Đăng nhập lại 1 lần, gọi lại |
| Sai mật khẩu HPnet | Không có `.ASPXFORMSAUTH`, có `Login1_FailureText` | Dừng ≥ 15 phút, báo chủ hệ thống |
| HPnet không tới được | 522, 52x, timeout | Không đánh dấu `seen`; thử ở lần chạy sau |
| Đính kèm không còn | HTTP 4xx khi tải | Bỏ qua tệp đó, ghi chú; vẫn tạo văn bản nếu file chính có |
| Không có file chính | `detail.file` trống | Không tạo, báo chủ hệ thống |
| Văn bản đã có | `check-duplicate.exists = true` | Không tạo; thêm vào `seen` |
| Secret sai | 401 từ My Office | Dừng đẩy, báo chủ hệ thống (không thử lại liên tục) |
| Lỗi server My Office | 5xx | Thử lại ở lần chạy sau; file Drive đã upload mà chưa `submit` sẽ thành file mồ côi (chấp nhận được) |

---

## 6. Tiêu chí nghiệm thu

1. Lần chạy đầu tiên chỉ seed `seen`, không tạo văn bản nào trong My Office.
2. Khi một văn bản mới xuất hiện ở "Chờ xử lý", My Office có đúng **1** bản ghi mới, đủ các trường ở mục 3, có file chính và mọi file kèm mở xem được.
3. Chạy lại ngay sau đó, hoặc khi qlvb-watcher hay extension đã đẩy văn bản đó trước, thì không sinh bản ghi trùng.
4. Lỗi mạng giữa chừng không để lại bản ghi thiếu tệp; lần chạy sau đẩy đủ.
5. Không có request ghi nào tới HPnet; không có secret nào xuất hiện trong log.
6. Tần suất gọi HPnet không vượt mức đã thống nhất (khuyến nghị ≤ 1 lần/30 phút trong giờ hành chính).

---

## 7. Cần hỏi chủ hệ thống trước khi chạy

- Hermes đi theo **mục 8** (gọi qlvb-watcher, khuyến nghị) hay mục 2–4 (tự quét HPnet)? Nếu tự quét: dùng tài khoản HPnet nào, có được chạy song song với qlvb-watcher không?
- Nếu theo mục 8: `HERMES_KEY` (cấp sau khi cổng `/api/hermes/*` được triển khai).
- Giá trị `ingestSecret` (kênh trao đổi an toàn).
- Danh sách mục theo dõi (mặc định chỉ `status=18`) và điều kiện lọc (cơ quan ban hành, từ khoá, độ khẩn), nếu không đẩy mọi văn bản.
- Hermes chạy ở đâu (nên đặt ở Việt Nam để tránh lỗi 522) và nhịp kiểm.

---

## 8. qlvb-watcher: bộ kiểm định kỳ đang chạy, và cách Hermes dùng nó thay vì tự quét HPnet

> Phương án khuyến nghị: Hermes **không tự đăng nhập HPnet**, mà gọi qlvb-watcher kiểm tra rồi lấy kết quả. Làm vậy tránh được 3 rủi ro: 2 phiên đăng nhập song song, khoá tài khoản do đăng nhập sai, và đẩy trùng văn bản.

### 8.1. Thành phần đang chạy

| Thành phần | Vị trí | Vai trò |
|---|---|---|
| **Cloudflare Worker `qlvb-watcher`** | `https://qlvb-watcher.khoibm.workers.dev` | Bộ não: so sánh văn bản mới, báo Telegram, áp rule, đẩy sang My Office |
| Cron Cloudflare | `*/5 * * * *` (nhịp) và `0 0 * * *` (00:00 UTC = 07:00 giờ VN) | Nhịp 5 phút **chỉ là đồng hồ**. Worker chỉ gọi HPnet khi **đến lượt** theo lịch người dùng đặt. Cron 07:00 gửi tin tổng hợp ngày |
| Lịch kiểm (KV `schedule`) | Sửa tại My Office → Cài đặt → QLVB Watcher | Mặc định: **mỗi 60 phút, 07:00–17:00, thứ Hai–thứ Sáu**. Chu kỳ 5–1440 phút |
| KV `STATE` | Cloudflare KV | Cookie phiên HPnet, tập `seen:<status>` các văn bản đã thấy, cache chi tiết văn bản `doc:<id>` (90 ngày), việc chờ, nhật ký 40 lần chạy gần nhất, rule tự đẩy |
| **Runner Windows** (tuỳ chọn) | Máy Windows của anh Khôi, `node runner.mjs`, 2 phút/lần | Lấy danh sách HPnet bằng **mạng Việt Nam**: từ Cloudflare có khoảng 20–50% lần gọi bị lỗi 522. Runner gửi danh sách lên Worker qua `/api/ingest-list` và tải file cho các việc đẩy My Office. Khi runner còn "nhịp" (≤ 5 phút), cron không tự liệt kê văn bản để tránh báo trùng. Tắt runner thì cron tự chạy lại như cũ |
| Bot Telegram | Chat của anh Khôi | Báo "VB mới" kèm nút 📥 Đẩy sang My Office · 📄 Gửi PDF. Lệnh `/check` kiểm ngay, `/status` xem trạng thái |

### 8.2. Một vòng kiểm làm gì
```
đến lượt theo lịch, hoặc có yêu cầu kiểm (/check)
 → dùng cookie phiên trong KV (hết hạn mới đăng nhập lại; sai mật khẩu thì hãm 15 phút)
 → với mỗi mục theo dõi (mặc định 18 = Chờ xử lý): lấy danh sách → so với seen:<status>
 → văn bản mới: lấy chi tiết và ý kiến chỉ đạo → lưu cache doc:<id> → báo Telegram
 → rule khớp (cơ quan ban hành / từ khoá / độ khẩn / chuyên viên) → đẩy My Office (check-duplicate → upload → submit)
 → ghi lastRun + nhật ký runs
```
Kết quả mỗi vòng (`RunSummary`):
```json
{ "at": "2026-11-04T02:00:05Z", "source": "cron", "statuses": [18], "seeded": [],
  "totals": { "18": 7 }, "found": { "18": 1 }, "notified": 1, "pushed": 0,
  "queued": 0, "dupes": 0, "relogged": false, "errors": [], "skipped": null, "ms": 4210 }
```
Lưu ý: `RunSummary` **chỉ có số đếm**, không có danh sách văn bản mới. Danh sách chi tiết hiện chỉ gửi qua Telegram.

### 8.3. Hiện tại Hermes gọi được gì?

Mọi endpoint quản trị của Worker (`/run`, `/status`, `/debug`, `/api/*`, `/admin`, `/reset-seen`) dùng **chung một khoá `ADMIN_KEY`**:

| Endpoint | Tác dụng | Dùng cho Hermes? |
|---|---|---|
| `GET /run?key=…` | Chạy 1 vòng kiểm **đồng bộ** từ Cloudflare, trả `RunSummary` | Có thể dùng. Nhưng từ Cloudflare 20–50% lần bị 522 (trả 500, không tự thử lại) và kết quả chỉ có số đếm |
| `GET /status?key=…` | `lastRun`, `lastOkAt`, việc chờ, 40 lần chạy gần nhất, trạng thái runner | Đọc được |
| `POST /api/action {"action":"run"}` (header `x-admin-key`) | Giống `/run`, trả câu tóm tắt | Như `/run` |
| `/api/runner-config`, `/api/config`, `/admin`, `/reset-seen`, `/api/rules`… | Trả **cookie phiên HPnet**, cấu hình bot; đổi mật khẩu, rule, xoá `seen` | **Không được** |

**Kết luận:**
- Về kỹ thuật, Hermes đã có thể kích hoạt kiểm tra (`/run`) và xem trạng thái (`/status`) ngay bây giờ.
- **Nhưng không nên đưa `ADMIN_KEY` cho Hermes.** Khoá đó mở được cả cookie phiên HPnet lẫn toàn bộ cấu hình.
- Hiện cũng **chưa có cách lấy danh sách văn bản mới**, chỉ có số đếm.

### 8.4. Cổng riêng cho Hermes (ĐÃ TRIỂN KHAI 04/11/2026, anh Khôi duyệt)

> **Trạng thái:** đã deploy lên `qlvb-watcher`. Bản đang chạy là version `e4ee1cb0`, deploy 04/11/2026 từ commit `13ba9c9` của repo private [khoibmtn/qlvb-watcher](https://github.com/khoibmtn/qlvb-watcher). Mã ở `src/hermes.ts`, test ở `test/hermes.test.ts` (24 ca, `npm test`).
> Kiểm production sau deploy: sai/thiếu khoá → 401; route lạ → 404; `result` → 200; `check` → 202, gọi lặp trả cùng mã; một lần kiểm thật chuyển `done` (Cloudflare bị 522 thì runner Windows làm thay, khoảng 2 phút).
> Khoá `HERMES_KEY` là secret Worker. Bản sao duy nhất nằm ở file `~/.secrets/qlvb-watcher-hermes-key.txt` trên máy Mac của anh Khôi (quyền 600) để chép vào `.env` của Hermes. **Không gửi khoá qua chat, Telegram hay bot.**
>
> Chi tiết hành vi thực tế (bổ sung cho hợp đồng bên dưới):
> - Chỉ nhận khoá qua header `x-hermes-key` (không nhận `?key=`), so sánh thời gian hằng. Sai/thiếu khoá → **401**. Route không có → **404**, sai method → **405**. Khoá chưa đặt trên Worker → **503**. `ADMIN_KEY` không mở được `/api/hermes/*`, `HERMES_KEY` không mở được route quản trị (vẫn 403 như cũ).
> - `check`: trả `{requestId, requestedAt, reused, message}`. `reused: true` khi đang có yêu cầu chờ (kể cả lệnh `/check` gõ trên Telegram, khi đó Worker gắn mã cho lệnh đó). Yêu cầu xong khi cron hoặc runner Windows liệt kê được QLVB. Quá 30 phút không kết nối được thì `failed`.
> - `result`: `since` không bắt buộc (bỏ trống = cả nhật ký), sai định dạng → 400. `check` gồm `{requestId, requestedAt, state, finishedAt}`, hoặc `null` nếu Hermes chưa gửi yêu cầu nào. `lastOkAt` là chuỗi ISO. Nhật ký `newDocs` bắt đầu ghi từ lúc deploy (VB phát hiện trước đó không có).
> - `push`: 202 `{queued: true, via: "runner" | "worker"}`. Gọi lặp khi đang chờ đẩy → 202 `{queued: true, reused: true}`. VB đã có trong My Office → **200** `{queued: false, pushed: {docId, appUrl}}`. Id không có trong bộ nhớ Worker → 404. Kết quả đẩy báo về Telegram như nút 📥.

Thêm vào qlvb-watcher một khoá riêng `HERMES_KEY` (Cloudflare secret), chỉ mở được các endpoint sau và không trả về cookie hay cấu hình:

**a) Yêu cầu kiểm ngay** (không đồng bộ, chịu được lỗi 522)
```http
POST https://qlvb-watcher.khoibm.workers.dev/api/hermes/check
x-hermes-key: <HERMES_KEY>
```
→ `202 { "requestId": "chk_…", "requestedAt": "…", "message": "Đã xếp lệnh kiểm" }`

- Ghi một yêu cầu kiểm (giống lệnh Telegram `/check`) rồi thử chạy ngay.
- Nếu Cloudflare chưa tới được HPnet, nhịp 5 phút hoặc runner Windows (mạng Việt Nam) sẽ làm trong vòng tối đa 30 phút.
- Gọi lặp khi đang có yêu cầu chờ thì không tạo yêu cầu mới.

**b) Lấy kết quả**
```http
GET https://qlvb-watcher.khoibm.workers.dev/api/hermes/result?since=2026-11-04T00:00:00Z
x-hermes-key: <HERMES_KEY>
```
```json
{
  "check": { "requestId": "chk_…", "state": "done | pending | failed", "finishedAt": "…" },
  "lastRun": { "...RunSummary..." },
  "lastOkAt": "2026-11-04T02:00:05Z",
  "newDocs": [
    { "id": "<VanbanDenId>", "status": 18, "detectedAt": "…",
      "docNumber": "12575/SYT-NVY", "title": "V/v …", "sender": "Sở Y tế",
      "issueDate": "03/11/2026", "deadline": "", "priority": "normal", "assignee": "Yến",
      "pushed": { "docId": "…", "appUrl": "https://my-office-inky.vercel.app/documents/…" } }
  ]
}
```
- `newDocs` lấy từ một nhật ký văn bản mới mà Worker ghi thêm khi phát hiện (giữ 200 mục / 30 ngày).
- `pushed = null` nghĩa là văn bản chưa được đẩy sang My Office (không khớp rule nào).

**c) (Tuỳ chọn) Đẩy một văn bản sang My Office**
```http
POST /api/hermes/push  { "id": "<VanbanDenId>" }
```
Tương đương bấm nút 📥 trên Telegram: xếp việc, runner hoặc Worker tải đủ file rồi đẩy, có kiểm trùng.

Luồng dùng khi anh Khôi yêu cầu, ví dụ "Hermes, kiểm văn bản mới":
```
Hermes → POST /api/hermes/check
       → mỗi 30–60 giây: GET /api/hermes/result?since=<thời điểm yêu cầu>  (tối đa ~30 phút)
       → check.state = done → trả anh Khôi danh sách newDocs (số ký hiệu, trích yếu, cơ quan, hạn, link My Office nếu đã đẩy)
       → anh Khôi chọn văn bản cần đẩy → POST /api/hermes/push (nếu bật mục c)
```

Ưu điểm so với để Hermes tự quét HPnet:
- Không thêm phiên đăng nhập, nên không có nguy cơ làm văng phiên hay khoá tài khoản.
- Dùng chung tập `seen` và kiểm trùng nên không báo hay đẩy trùng.
- Tận dụng runner Windows để tránh lỗi 522.
- Khoá của Hermes không mở được cookie, mật khẩu hay cấu hình.
