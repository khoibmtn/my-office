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

Mục 2–4 dưới đây đã tóm tắt đủ để làm việc mà không cần đọc mã qlvb-watcher.

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

- Tài khoản HPnet dùng cho Hermes. Có được chạy song song với qlvb-watcher không, hay Hermes **thay thế** qlvb-watcher?
- Giá trị `ingestSecret` (kênh trao đổi an toàn).
- Danh sách mục theo dõi (mặc định chỉ `status=18`) và điều kiện lọc (cơ quan ban hành, từ khoá, độ khẩn), nếu không đẩy mọi văn bản.
- Hermes chạy ở đâu (nên đặt ở Việt Nam để tránh lỗi 522) và nhịp kiểm.
