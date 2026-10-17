# Đề xuất tiện ích theo dõi văn bản mới trên qlvb.hpnet.vn → Telegram

> Ngày khảo sát: 17/10/2026. Khảo sát trực tiếp trên phiên Chrome đã đăng nhập của anh Khôi.
> Tài liệu DOM/extension hiện có: `docs/QLVB_HPNET_SPEC.md`.

---

## 1. Phát hiện kỹ thuật quyết định phương án

### 1.1. Danh sách văn bản có endpoint JSON, không cần đọc DOM

jTable của trang `?action=102` tải dữ liệu qua:

```http
POST https://qlvb.hpnet.vn/vpdt/soyte/VanbanDenTruongPhong.aspx?jtStartIndex=0&jtPageSize=10
Content-Type: application/x-www-form-urlencoded
Cookie: .ASPXFORMSAUTH=...

all=false&key=&status=18&sokyhieu=&trichyeu=&coquan=
```

Giá trị `status` tương ứng menu trái:

| status | Menu | Ghi chú |
|---|---|---|
| `18` | **Chờ xử lý** | mục cần theo dõi chính (hôm nay: 1 VB) |
| `7` | Đang xử lý | |
| `6` | Đã xử lý | |
| `12` | VB thông báo | 1 766 VB, có cờ `IsNew` |
| `13` | VB phối hợp | 48 VB |
| `11` | Được đánh dấu | |
| `1` | Tra cứu | |

VB đi dùng endpoint tương tự: `POST /vpdt/soyte/VanbanDiNoiboChuyenvien.aspx?jtStartIndex=0&jtPageSize=15`, body `key=&status=...`.

Phản hồi:

```json
{ "Result": "OK", "TotalRecordCount": 1, "Records": [ {
  "VanbanDenId": "60f9df8e-bb2b-4ca0-850b-55a2c5f0e775",
  "Name": "11309/SYT-NVY",            // số ký hiệu
  "TrichYeu": "V/v tiếp tục triển khai ...",
  "NgayBanhanh": "08/10/2026", "NgayDen": "08/10/2026", "NgayGiaoviec": "08/10/2026",
  "CoquanBanhanh": "Sở Y tế", "Lanhdao": "Lê Khắc Tùng", "ChuyenVien": "Bùi Minh Khôi",
  "Thoihan": "05/11/2026", "HanHoanthanh": "05/11/2026",
  "TinhTrangXuly": "Đang xử lý (còn 18 ngày)", "Dokhan": "Hỏa tốc", "IsNew": false,
  "OrderIndex": 3583, "Xuly": "<html nút tác vụ>", "VanbanTrinhDuyet": "", "ChuyenvienTrinh": null
} ] }
```

Chi tiết + file đính kèm (đã có trong spec): `GET /vpdt/soyte/Ajax/LoadVanBanDenInfo.aspx?VanbanDenId={GUID}` → `file` (đường dẫn `//qlvb.hpnet.vn/upload/...signed.pdf`), `files[]`, `ngaynhap` (có giờ phút giây), `sokh`, `trichyeu`, `thoihan`, `lanhdao`, `chuyenvien`, `phongban`, `sotrang`...

Đếm thông báo: `POST /vpdt/soyte/Ajax/AjaxNotifications.aspx` → `{records:[{DomId:"countThongBaoNoiBo",Total},{DomId:"countHoSo"},{DomId:"countBaocaoDeXuat"}]}`.

### 1.2. Xác thực

- Chỉ cần cookie `.ASPXFORMSAUTH` (Forms Authentication). Gọi không cookie trả HTTP 200 với JSON
  `{"Message":"Phiên đăng nhập đã hết, vui lòng đăng nhập lại ..."}` → dễ phát hiện hết phiên.
- Form đăng nhập là ASP.NET WebForms thuần tại `/style/qlvb2013/Login.aspx?ReturnURL=...`:
  `Login1$UserName`, `Login1$Password`, `Login1$RememberMe` (checkbox "Nhớ mật khẩu"), `Login1$Login` + `__VIEWSTATE`/`__EVENTVALIDATION`.
  Không thấy CAPTCHA trên form → **có thể tự đăng nhập lại bằng script** khi hết phiên.
- Máy chủ IIS 10, truy cập được từ ngoài Việt Nam (đã thử fetch từ hạ tầng nước ngoài: trang login tải bình thường) → Cloudflare Worker gọi được.

### 1.3. Hệ quả

Không cần mở trình duyệt, không cần đọc DOM. Một tiến trình HTTP nhỏ (cookie + 1 POST mỗi vài phút) là đủ để phát hiện văn bản mới. Phần tải file từ QLVB sang Google Drive (hiện extension làm) cũng chạy được phía server khi có cookie.

---

## 2. So sánh phương án

| | A. Cloudflare Worker cron (đề xuất) | B. Chrome Extension trên máy Windows | C. Node app local Windows | D. Cron trong My Office (Vercel) |
|---|---|---|---|---|
| Chi phí | 0 đ thêm (trong gói $5: cron, KV) | 0 đ | 0 đ | Hobby chỉ cron 1 lần/ngày |
| Phụ thuộc máy Windows/Chrome mở | Không | **Có** (Chrome + máy phải sống) | Có | Không |
| Tự đăng nhập lại khi hết phiên | Có (script WebForms) | Không (phải báo anh vào đăng nhập) | Có | Có |
| Bot Telegram tương tác (nút bấm, lệnh) | Webhook, tức thì | Chỉ long-poll, service worker MV3 hay ngủ | Long-poll được | Webhook được |
| Đẩy sang My Office | Qua API, cần thêm 1 cách xác thực server-to-server | Tái dùng pipeline extension sẵn có (ưu điểm lớn nhất) | Qua API | Trực tiếp Firestore/Drive |
| Độ ổn định | Cao | Trung bình | Trung bình | Thấp (giới hạn cron) |

**Khuyến nghị: A**, dự án riêng `qlvb-watcher` tại `/Users/buiminhkhoi/Documents/Antigravity/Claude/qlvb-watcher`, theo cùng khuôn mẫu Worker + Telegram anh đã dùng ở `research-finding-yhvn` (skill `firebase-cron-sang-cloudflare`). Máy Windows 24/24 trở thành không bắt buộc; nếu muốn vẫn giữ làm phương án dự phòng (B) sau.

---

## 3. Kiến trúc đề xuất (phương án A)

```
Cloudflare Cron (*/5 phút, giờ hành chính dày hơn)
   └─ Worker qlvb-watcher
        ├─ KV: cookie phiên, tập VanbanDenId đã thấy, rules tự đẩy, log gần nhất
        ├─ Secrets: QLVB_USER, QLVB_PASS, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, MYOFFICE_INGEST_SECRET
        ├─ poll(): login nếu cần → POST status=18 (+12/13 tuỳ chọn) → diff → gửi Telegram
        ├─ rules: CQBH / từ khoá trích yếu / độ khẩn / chuyên viên → tự đẩy sang My Office
        └─ Telegram webhook (/tg): nút "📥 Đẩy sang My Office", "📄 Gửi file PDF", lệnh /rules, /status, /check
My Office (Vercel) — thêm nhỏ:
        └─ /api/extension/upload/init và /api/extension/submit chấp nhận header x-ingest-secret
           (hoặc route mới /api/integrations/qlvb/ingest) thay cho firebaseIdToken
```

### 3.1. Luồng phát hiện
1. Mỗi lần cron: lấy cookie trong KV; gọi list `status=18`, `jtPageSize=50`.
2. Nếu JSON là `{"Message":"Phiên đăng nhập đã hết..."}` → đăng nhập lại (GET Login.aspx lấy VIEWSTATE → POST) → lưu cookie mới → gọi lại.
3. So `VanbanDenId` với tập đã thấy trong KV. Lần chạy đầu chỉ ghi nhận, không báo.
4. Với mỗi VB mới: gọi `LoadVanBanDenInfo` lấy file, trích yếu đầy đủ, ngày nhập → gửi Telegram.
5. Tuỳ chọn: theo dõi thêm `status=12` (VB thông báo) và `13` (phối hợp), VB đi; mỗi loại bật/tắt riêng.

### 3.2. Tin nhắn Telegram
```
🔔 VB mới — Chờ xử lý   🔥 Hỏa tốc
11309/SYT-NVY · Sở Y tế · BH 08/10/2026
V/v tiếp tục triển khai các hoạt động hưởng ứng Tuần lễ Làm mẹ an toàn năm 2026
⏳ Hạn: 05/11/2026 · Lãnh đạo: Lê Khắc Tùng · CV: Bùi Minh Khôi
[📥 Đẩy sang My Office] [📄 Gửi PDF] [🔗 Mở QLVB]
```
- "Gửi PDF": Worker tải file bằng cookie rồi `sendDocument` (Telegram cho phép tới 50 MB).
- Mỗi sáng 07:00 một tin tổng hợp ("không có VB mới qua đêm" / "n VB mới"), và tin cảnh báo khi đăng nhập thất bại.

### 3.3. Tự động đẩy sang My Office
- Rules lưu KV dạng JSON, ví dụ:
  `{ "autoPush": [ { "sender": "Sở Y tế", "keywords": ["khám sức khỏe", "báo cáo"] }, { "priority": ["express","very_urgent"] } ] }`
- Quản lý qua lệnh Telegram: `/rules`, `/rule add sender="Sở Y tế" kw="khám sức khỏe"`, `/rule del 2`.
- Khi khớp: tải file chính + đính kèm từ QLVB → `upload/init` (resumable) → PUT lên Drive → `submit` với metadata đúng dạng extension đang gửi (docNumber, issueDate `dd/mm/yyyy hh:mm:ss`, deadline, sender, leader, priority, originalLink, notes "Tự động từ QLVB"). Kiểm trùng bằng `check-duplicate` trước khi đẩy.

### 3.4. Chi phí / giới hạn
- 288 lần chạy/ngày × 2–4 subrequest → vài nghìn request/ngày, KV vài chục nghìn đọc/ghi/tháng: nằm trong gói $5.
- Worker giới hạn 30 s CPU; tải file PDF 5–20 MB qua stream không tốn CPU đáng kể.

---

## 4. Rủi ro cần kiểm ngay ở bước đầu
1. **Hệ thống có cho 2 phiên đăng nhập song song không?** Nếu Worker đăng nhập làm rớt phiên Chrome của anh → chuyển sang dùng cookie "Nhớ mật khẩu" lâu hạn copy từ Chrome, hoặc dùng phương án B.
2. Khoá tài khoản sau nhiều lần đăng nhập sai → chỉ thử đăng nhập lại khi chắc chắn hết phiên, tối đa 1 lần/15 phút, báo Telegram ngay khi thất bại.
3. Đổi mật khẩu định kỳ → `wrangler secret put QLVB_PASS` lại.
4. Cloudflare bị chặn theo IP (hiện không thấy dấu hiệu) → kiểm bằng fetch thử từ Worker đã deploy trước khi viết tiếp.

---

## 5. Anh cần chuẩn bị
1. Bot Telegram: tạo qua @BotFather → token; chat id (nhắn bot rồi gọi `getUpdates`, tôi hướng dẫn).
2. Tài khoản/mật khẩu QLVB: anh tự nhập qua `wrangler secret put` (tôi không cần nhìn thấy).
3. Cloudflare: `npx wrangler login` trên máy Mac (thư mục `~/.wrangler` đã có cấu hình).
4. Quyết định: có đẩy tự động sang My Office ngay ở phiên bản đầu không, hay chỉ báo + nút bấm thủ công.

## 6. Kế hoạch thực hiện (nếu chọn A)
1. Khởi tạo `qlvb-watcher` (wrangler.jsonc, KV, cron, secrets) + module `qlvb.ts` (login, list, detail, download) — deploy, test fetch từ Worker.
2. `poll.ts` diff + Telegram thông báo; chạy thật 1 ngày.
3. Webhook Telegram: nút Gửi PDF / Đẩy sang My Office; lệnh /status, /check, /rules.
4. My Office: xác thực `x-ingest-secret` cho `upload/init` + `submit`; Worker đẩy theo rules.
5. Tổng hợp sáng, cảnh báo lỗi, tài liệu vận hành `docs/cloudflare-cron.md`.
