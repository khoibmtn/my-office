# Kế hoạch: module "Giao ban tuần", nút "Xử lý / Tham mưu", xuất tháng, kết nối Cowork và số liệu tuần

> Soạn 18/11/2026 (Claude Code, vai trò kiến trúc). **Trạng thái: ĐỀ XUẤT, chờ anh Khôi duyệt.** Chưa viết dòng code ứng dụng nào, chưa cài gói, chưa commit.
> Repo GitHub của my-office là repo **công khai** → tài liệu này không chứa token/khoá/địa chỉ email, và không chép nội dung báo cáo thật (ví dụ chỉ lấy từ mô tả của anh). Fixture test về sau cũng phải dùng dữ liệu giả.
> Nguồn đã đọc: `CLAUDE.md`, `STATE.md`, `DOCS_CHUC_NANG.md`, `DOCS_DATABASE_SCHEMA.md`, `firestore.rules`, `firestore.indexes.json`, `lib/firestore.ts`, `lib/tasks/**`, `lib/recurrence/**`, `app/(app)/tasks/**`, `components/tasks/**`, `components/documents/DocumentViewer.tsx`, `DocumentTaskSection.tsx`, `app/api/**`, `lib/api-auth.ts`, `lib/ingest-auth.ts`, `docs/HERMES_QLVB_INGEST_SPEC.md`, `docs/SECURITY_PATCH_PLAN.md`, `docs/REVIEW_CONG_VIEC_MOBILE_2026-11-02.md`; 4 file `tom-tat/07–10.2026.docx`, `06.2026.docx`, `TH 10.2026.docx`; skill Cowork `tong-hop-cong-viec-khth`; dự án `bvtn-bcsolieu` (chỉ đọc); `~/.claude/skills/ui-ux-chuan/reference/chuan-san.md`; `~/.claude/skills/antigravity-delegate/SKILL.md`.

---

## 1. Tóm tắt luồng mới (trước → sau)

| Việc | Hiện nay | Sau khi làm |
|---|---|---|
| Ghi việc trong tuần | Gõ tay vào Google Doc, mỗi tuần chép lại các dòng thường xuyên | Trang **Giao ban tuần** trong my-office. Kỳ tuần (Thứ 6 → hết Thứ 5) tự tạo, các dòng đã **ghim** tự mang sang tuần mới |
| Văn bản đã tham mưu | Gõ lại tên văn bản + tự đếm "N văn bản: x CV, x KH…" (file thật thường để "x") | Bấm **Xử lý / Tham mưu** ngay trên văn bản gốc (hoặc thêm rời / dán nhiều dòng). Dòng "Tham mưu VB: N văn bản: a CV, b KH…" **tự đếm** |
| Ý kiến, ảnh chụp công văn | Dán vào Google Doc | Ô soạn thảo rich text, **dán ảnh trực tiếp** (Ctrl/⌘+V), đánh dấu đỏ |
| Thứ 6 giao ban | Mở Google Doc, cuộn tới tuần | Nút **Bản đọc giao ban**: toàn màn hình, chữ to, in/xuất PDF được, đúng thứ tự mục như doc hiện tại |
| Số liệu so sánh tuần | Mở thêm trang `bao-cao-tuan` của bvtn-bcsolieu | Giai đoạn 1: nút mở đúng 2 kỳ (liên kết sâu). Giai đoạn 2: bảng số liệu hiện ngay trong trang giao ban, chốt kèm bản đọc |
| Cuối tháng | Copy các tuần sang `tom-tat/MM.YYYY.docx`, tự loại tuần trùng | Trang **Tổng hợp tháng**: tuần được gán tháng theo một quy tắc cố định (không trùng), xuất `.docx` / `.md` / JSON đúng định dạng `tom-tat` |
| Cowork làm "TH MM.YYYY", kế hoạch, báo cáo Đảng | Đọc file docx anh copy tay; phải tự đếm lại, tự phân loại, hỏi anh về tuần giáp ranh | Cowork gọi MCP `my-office` (chỉ đọc) lấy thẳng dữ liệu có cấu trúc: loại văn bản, số đếm, tuần thuộc tháng |
| Module Công việc | Có nhưng không dùng thật (nhập 2 nơi) | Công việc là **đầu vào tuỳ chọn** của Giao ban: việc xong → 1 chạm thành dòng báo cáo hoặc văn bản tham mưu. Không còn hai hệ thống song song |

Một ngày làm việc mẫu sau khi có module:
1. Văn bản của Sở về mục Văn bản (qua qlvb-watcher/extension như cũ).
2. Soạn xong thông báo triển khai → trên dòng văn bản bấm **Xử lý / Tham mưu** → chọn `TB`, tên tự gợi ý từ trích yếu văn bản gốc → Lưu. Văn bản gốc được đánh dấu đã xử lý, dòng `TB …` xuất hiện trong tuần hiện tại.
3. Việc khác trong tuần: gõ thẳng một dòng vào Mục 1 (Enter là xong).
4. Thứ 6: mở **Bản đọc giao ban**, đọc. Bấm **Chốt** để lưu bản chụp.
5. Đầu tháng sau: Cowork tự lấy tổng hợp tháng qua MCP, ra "TH MM.YYYY".

---

## 2. Kết quả khảo sát

### 2.1. Định dạng tài liệu hiện có

**File tuần / `tom-tat/MM.YYYY.docx`** (nối các tuần, mỗi tuần một khối):
```
dd/mm/yyyy                                  ← ngày giao ban (Thứ 6)
Báo cáo giao ban Lãnh đạo tuần
1. KHTH
Tình hình thực hiện nhiệm vụ tuần qua:
  • <dòng việc>                             ← nhiều dòng lặp lại hằng tuần
  • Tham mưu VB: N văn bản: x CV, x KH, x BC
  • <TIỀN TỐ> <tên văn bản>                 ← KH, CV, BC, TB, QĐ, GM, Tờ trình, hoặc "V/v…" không tiền tố
2. Ý kiến                                   ← tuỳ tuần, có thể có ảnh, đoạn trích văn bản
Kế hoạch tuần sau / 3. Tuần tới             ← tuỳ tuần
```
Điểm đáng chú ý khi đọc file thật: số đếm thường để `x` hoặc sai; có dòng tiền tố thiếu ("V/v…", "Thuyết minh…"); có tuần ghi nhầm ngày (file 09.2026 có 2 khối cùng ghi "25/9/2026", khối sau thực chất là tuần giao ban 02/10); file 07.2026 ghi "22/7" cho tuần 24/7.

**File đầy đủ `TH MM.YYYY.docx`** (Cowork sinh): tiêu đề "ĐÁNH GIÁ MỨC ĐỘ HOÀN THÀNH NHIỆM VỤ THÁNG MM/YYYY", gồm I. Tham mưu văn bản (tổng số, đếm theo loại, liệt kê theo từng loại với tên loại viết đầy đủ) · II. Kết quả nhiệm vụ trọng tâm (gom theo chủ đề) · III. Phối hợp · IV. Kiểm tra · V. Chấp hành quy chế.

→ Hệ quả thiết kế: **Mục I của "TH" sinh được hoàn toàn bằng dữ liệu có cấu trúc** (loại + tên + tuần), không cần mô hình ngôn ngữ đoán. Mục II–V vẫn do Cowork viết từ các dòng việc.

Skill Cowork `tong-hop-cong-viec-khth` hiện phải: không tin số đếm trong file, tự phân loại theo tiền tố, tự khử trùng, **hỏi anh mỗi lần gặp tuần giáp ranh** (tiền lệ: tuần 3/7/2026 tính vào TH 06.2026 nên loại khỏi TH 07.2026). Cả 4 việc đó biến mất khi dữ liệu đi từ my-office.

### 2.2. Module Công việc hiện tại
Xem đánh giá ở mục 3.

### 2.3. Dự án `bvtn-bcsolieu` (chỉ đọc, không sửa)

| Câu hỏi | Kết quả |
|---|---|
| Dữ liệu ở đâu | BigQuery dataset `bvtn_app` (sự kiện append-only) + view hợp nhất; Firestore chỉ làm bản soi tháng. Firebase Auth là project riêng, khác my-office |
| Trang `/bao-cao-tuan` tính thế nào | Server component: `loadBaoCaoTuanPageData()` (`web/src/lib/repo/bao-cao-tuan.ts`) → 1 câu BigQuery gộp 2 khoảng ngày → `buildBaoCaoTuan()` thuần (`web/src/lib/bao-cao-tuan/tinh-toan.ts`) theo cấu hình dòng động, ra 3 khối Bệnh viện / Minh Đức / Quảng Thanh + bệnh truyền nhiễm, cột Tuần 1, Tuần 2, Tăng, Giảm |
| Kỳ mặc định | Tuần 2 = 7 ngày kết thúc **hôm qua**; Tuần 1 = 7 ngày liền trước. Mở vào Thứ 6 thì đúng bằng kỳ Thứ 6 → Thứ 5 của anh. Nhận tham số URL `t1_tu, t1_den, t2_tu, t2_den, so_ngay, tv=1` |
| Có API không | Có **Cowork Data API** `/api/cowork/v1/*` (catalog, coverage, ke-hoach, query, series, presets) nhưng **chưa có endpoint cho bảng Báo cáo tuần**. Đã có sẵn hàm `getBaoCaoTuanReport()` để bọc thành route |
| Xác thực | Phiên cookie (SameSite=Lax) cho người dùng; `Authorization: Bearer COWORK_API_TOKEN` (hoặc `_NEXT` để xoay vòng) chỉ mở `/api/cowork/v1/*` và `/api/export/so-ket-thang`; so sánh hằng thời gian; 30 yêu cầu/60 s; có WAF chặn user-agent công cụ quét |
| Nhúng iframe được không | **Không**: `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`, và cookie SameSite=Lax không gửi trong iframe khác site |
| Tiền lệ Cowork | MCP `kcb-data` (`~/Documents/Claude/KHTH/mcp-servers/kcb_data_server.py`, FastMCP Python) chỉ gọi lại API; token ở `~/Documents/Claude/KHTH/config/credentials.local.json`. Đặc tả `handoff/research/R-003-cowork-data-contract.md`, quyết định ADR-019 |

### 2.4. Bảo mật hiện trạng liên quan
- Firestore rules hiện cho mọi user đã xác thực (kể cả **ẩn danh**) đọc/ghi mọi collection; S2 chờ anh quyết. Collection mới của module này **không được** rơi vào tình trạng đó → viết rule riêng chỉ cho tài khoản admin (mục 5.5), không phụ thuộc S2.
- `settings/{id}` cũng đang mở → cấu hình của module đặt ở collection riêng, không đặt trong `settings`.
- Không dùng `firebase-admin/auth` trên Vercel (lỗi ERR_REQUIRE_ESM); route server chỉ dùng `firebase-admin/firestore` và `verifyIdTokenREST` như `lib/api-auth.ts` đang làm.
- File Drive của app để "ai có link đều xem" là **cố ý** (D-04) → không đổi.

---

## 3. Đánh giá thẳng module Công việc và hướng cải tiến

### 3.1. Vì sao chưa tiện (bằng chứng trong code)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 1 | **Không có đầu ra.** Hoàn thành việc chỉ đổi trạng thái, không ghi "kết quả là văn bản gì", không chảy vào báo cáo nào. Báo cáo tuần vẫn phải gõ lại ở Google Doc → nhập hai nơi → bỏ nơi không bắt buộc | `changeTaskStatus` trong `lib/tasks/mutations.ts`; `lib/tasks/documentSync.ts` chỉ đồng bộ trạng thái văn bản |
| 2 | **Không có khái niệm kỳ giao ban.** "Hoàn thành tuần" tính tuần Thứ 2 → CN; không có nhóm "trong kỳ Thứ 6 → Thứ 5"; việc đã đóng chỉ nạp 30 ngày gần nhất nên không tổng hợp tháng/quý được | `lib/tasks/firestore.ts` (`getVietnamTimeBounds`, `queryRecentClosedTasks`) |
| 3 | **Tạo việc quá nặng.** Không có ô thêm nhanh trên `/tasks`; nút "Tạo mới" mở trang riêng với 4 khối (thông tin cơ bản, phân công, liên kết, việc con), mỗi việc con lại có người xử lý/đơn vị/hạn. Ghi một dòng "đã làm X" mất cả phút | `components/tasks/TaskCreateForm.tsx` (927 dòng), `app/(app)/tasks/page.tsx` |
| 4 | **Mô hình cho điều hành nhiều người, thực tế một người dùng.** Người xử lý, phối hợp, theo dõi, đơn vị chủ trì/phối hợp, phụ thuộc, bị chặn, thông báo, nhật ký, chat: khoảng 45 trường mỗi việc | `types/tasks.ts` |
| 5 | **Việc định kỳ sinh "việc phải tick".** Dòng kiểu "Đảm bảo công việc thường xuyên" trở thành occurrence có hạn; không tick thì thành quá hạn giả. Form chuỗi định kỳ 893 dòng (weekendPolicy, misfire, leadDays, rollingWindow) cho nhu cầu "tuần nào cũng có dòng này" | `components/tasks/SeriesForm.tsx`, `app/api/cron/recurrence/route.ts` |
| 6 | **Điều hướng phân mảnh.** Sidebar có 4 mục cho một phân hệ (Công việc, Kanban, Lịch, Định kỳ) trong khi `/tasks` đã có nút chuyển 3 chế độ xem. Trước khi tới danh sách phải qua tiêu đề + 4 tab + 5 thẻ thống kê + bộ lọc + hàng badge | `app/(app)/layout.tsx:133-144`, `app/(app)/tasks/page.tsx` |
| 7 | **Từ văn bản sang việc vẫn là form đầy đủ.** "Tạo công việc từ văn bản" mở drawer chứa đúng form trên | `components/tasks/TaskCreateDrawer.tsx`, `components/documents/DocumentTaskSection.tsx` |
| 8 | **Dày đặc chữ 10–12px, nhiều nút chỉ hiện khi rê chuột** — dưới chuẩn sàn (body ≥ 16px, không giấu hành động duy nhất sau hover) | `text-[10px]`, `text-xs` khắp `components/tasks/**` |
| 9 | (Cần kiểm trên dữ liệu thật) Admin có `staffId = 'admin'`, không phải bản ghi nhân sự → tab "Công việc của tôi" có thể luôn trống với anh | `hooks/useRole.ts` |

Kết luận: module được xây như phần mềm giao việc cho cả đơn vị, còn nhu cầu thật của anh là **sổ việc cá nhân có đầu ra là báo cáo giao ban**. Thiếu đầu ra là nguyên nhân gốc; các điểm còn lại làm nặng thêm.

### 3.2. Nguyên tắc hợp nhất (tránh hai hệ thống song song)

Mỗi loại thông tin có đúng một chỗ ở:

| Loại | Chỗ ở | Lý do |
|---|---|---|
| Dòng việc thường xuyên, không hạn, không cần "đóng" ("Đảm bảo công việc thường xuyên"…) | **Dòng ghim** ở Mục 1 của Giao ban tuần, tự mang sang tuần sau | Không phải việc cần theo dõi; biến nó thành Task chỉ tạo rác |
| Việc có hạn, cần theo dõi hoặc giao người khác | **Task** (giữ nguyên engine hiện có) | Đúng thế mạnh của module |
| Văn bản đã tham mưu | **AdvisoryDoc** (mới) | Là kết quả, có loại/số/ngày; không phải việc |
| Việc định kỳ có hạn thật (báo cáo tuần KH 260, hạn Thứ 5) | **TaskSeries** (giữ) | Occurrence xong → gợi ý thành dòng báo cáo |

Các cầu nối, mỗi cầu chỉ một chạm:
1. Task xong trong kỳ → hiện ở khung **"Gợi ý từ Công việc"** của trang giao ban → bấm "Đưa vào báo cáo" (dòng lưu `taskId`, không trùng).
2. Hoàn thành Task có gắn văn bản → thông báo nổi không chặn: "Đã xong · **Ghi văn bản tham mưu**" → mở form tham mưu điền sẵn.
3. Trên văn bản, một điểm vào duy nhất **Xử lý / Tham mưu**: "Đã tham mưu xong" (tạo AdvisoryDoc, tự đóng Task liên quan nếu có) hoặc "Chưa xong, tạo việc theo dõi" (tạo Task nhanh, hạn = hạn văn bản).
4. Task đến hạn trong kỳ sau → gợi ý chèn vào Mục 3 "Tuần tới".

### 3.3. Cải tiến cụ thể cho module Công việc (gói T-240, T-241)
- **Thêm nhanh**: một ô ở đầu `/tasks` và trong trang giao ban (tiêu đề, Enter để lưu; hạn tuỳ chọn; mặc định người xử lý = tôi). Form đầy đủ chuyển thành "Chi tiết…".
- **Tab "Tuần này"** làm mặc định: Quá hạn · Đến hạn trong kỳ (Thứ 6 → Thứ 5) · Đã xong trong kỳ · Chưa có hạn. Dùng chung hàm kỳ tuần với Giao ban.
- **Hoàn thành kèm kết quả** (cầu nối 1, 2) ở mọi đường hoàn thành: bảng, Kanban, chi tiết, khối việc trong văn bản.
- **Gộp điều hướng**: bỏ 3 mục Kanban / Lịch / Định kỳ khỏi sidebar (vẫn truy cập trong `/tasks`), thêm "Giao ban tuần". Sidebar còn 6 mục: Văn bản · Giao ban tuần · Công việc · Hồ sơ · Dashboard · Cài đặt (chuẩn sàn: ≤ 5–7).
- **Thu gọn phần đầu `/tasks`**: 5 thẻ thống kê thành một dòng tóm tắt, bộ lọc thu vào một nút.
- Không làm: không thêm trạng thái mới, không đổi schema `tasks` ngoài 1 trường tuỳ chọn `resultAdvisoryDocIds: string[]`.

---

## 4. Quy tắc kỳ tuần và gán tuần vào tháng

### 4.1. Kỳ tuần
- Ngày giao ban = Thứ 6. Kỳ tuần = Thứ 6 tuần trước → hết Thứ 5 tuần này (7 ngày).
- `weekId` = ngày giao ban dạng ISO, ví dụ `2026-11-13`. `periodStart = meetingDate − 7 ngày`, `periodEnd = meetingDate − 1 ngày`.
- Mọi phép tính dùng **ngày lịch Việt Nam dạng chuỗi `YYYY-MM-DD`** và số học ngày thuần (không dùng `Date` giờ địa phương), vì server Vercel chạy UTC.
- `weekIdForDate(d)` = Thứ 6 gần nhất **sau** `d` (nếu `d` là Thứ 6 thì là Thứ 6 tuần kế). Một văn bản tham mưu ngày Thứ 6 13/11 thuộc tuần giao ban 20/11.
- Tuần mở mặc định: nếu hôm nay là Thứ 6 → tuần có `meetingDate = hôm nay` (để đọc giao ban), kèm nút sang "tuần mới"; ngày khác → `weekIdForDate(hôm nay)`.
- Thứ 6 rơi vào ngày nghỉ (01/05/2026, 01/01/2027): kỳ vẫn cố định; chỉ trường hiển thị `actualMeetingDate` chỉnh tay được.
- Văn bản tham mưu/dòng việc có thể chuyển tay sang tuần khác (`weekIdOverridden`), ví dụ văn bản xong sáng Thứ 6 muốn báo cáo ngay hôm đó.

Ví dụ: giao ban **13/11/2026** → kỳ **06/11–12/11/2026**. Hôm nay 18/11/2026 (Thứ 4) → tuần đang ghi là kỳ 13/11–19/11, giao ban 20/11, `weekId = 2026-11-20`.

### 4.2. Gán tuần vào tháng (không trùng)
Mỗi tuần thuộc **đúng một** tháng báo cáo (`reportMonth`). Khảo sát file thật cho thấy thực tế chưa nhất quán, nên cần chốt một quy tắc. Ba phương án:

- **(a) Đa số ngày — khuyến nghị**: tuần thuộc tháng chứa ≥ 4/7 ngày của kỳ. Tương đương: tháng của ngày **Thứ 2** trong kỳ (`periodStart + 3`).
- (b) Theo ngày giao ban: tháng của Thứ 6 giao ban.
- (c) Theo ngày đầu kỳ: tháng của `periodStart`.

Các tuần giáp ranh năm 2026:

| Giao ban | Kỳ | Chia ngày | (a) Đa số | (b) Ngày giao ban | Thực tế trong file |
|---|---|---|---|---|---|
| 02/01/2026 | 26/12/2025–01/01/2026 | 6 + 1 | **12/2025** | 01/2026 | — |
| 03/04/2026 | 27/03–02/04 | 5 + 2 | **03** | 04 | — |
| 01/05/2026 | 24/04–30/04 | 7 + 0 | **04** | 05 (tuần nằm trọn tháng 4 lại tính tháng 5) | — |
| 05/06/2026 | 29/05–04/06 | 3 + 4 | **06** | 06 | Tháng 6 ✔ |
| 03/07/2026 | 26/06–02/07 | 5 + 2 | **06** | 07 | TH 06 có, TH 07 đã loại ✔ (a) |
| 07/08/2026 | 31/07–06/08 | 1 + 6 | **08** | 08 | Tháng 8 ✔ |
| 04/09/2026 | 28/08–03/09 | 4 + 3 | **08** | 09 | Tháng 9 ✘ (a), ✔ (b) |
| 02/10/2026 | 25/09–01/10 | 6 + 1 | **09** | 10 | Tháng 9 ✔ (a) |
| 06/11/2026 | 30/10–05/11 | 2 + 5 | **11** | 11 | TH 10 không có ✔ |
| 04/12/2026 | 27/11–03/12 | 4 + 3 | **11** | 12 | — |
| 01/01/2027 | 25/12–31/12/2026 | 7 + 0 | **12/2026** | 01/2027 | — |

(a) khớp 5/6 trường hợp đã có trong file (quy tắc (b) khớp 4/6), và không sinh ra nghịch lý "tuần nằm trọn tháng này lại tính sang tháng sau". Theo (a), tháng 10/2026 gồm 4 tuần 09/10, 16/10, 23/10, 30/10 — đúng bằng `TH 10.2026`; tháng 11/2026 gồm 5 tuần 06/11, 13/11, 20/11, 27/11, 04/12.

Cài đặt: quy tắc là cấu hình (`monthRule`), mặc định (a). Mỗi tuần có `reportMonth` tính tự động và **ghi đè tay được** (`reportMonthOverridden`) cho tình huống đặc biệt. Trang tháng luôn hiện rõ tuần giáp ranh và tuần đó đang thuộc tháng nào, nên không bao giờ có tuần nằm ở hai tháng.

Thuật toán `weeksOfMonth(M)`: lấy các Thứ 6 có `reportMonth` tự tính = M; cộng các tuần có bản ghi ghi đè vào M; trừ các tuần có bản ghi ghi đè ra khỏi M.

---

## 5. Data model Firestore

### 5.1. `weeklyReports/{weekId}` — một tuần
```ts
interface WeeklyReport {
  id: string                    // = weekId = meetingDate, 'YYYY-MM-DD'
  meetingDate: string           // Thứ 6 theo quy tắc
  actualMeetingDate: string | null   // khi họp dời ngày
  periodStart: string           // meetingDate - 7
  periodEnd: string             // meetingDate - 1
  reportMonth: string           // 'YYYY-MM'
  reportMonthOverridden: boolean
  status: 'draft' | 'finalized'
  finalizedAt: Timestamp | null

  unitHeading: string           // '1. KHTH'
  workItems: WorkItem[]         // Mục 1 (có cấu trúc, tối đa 2 cấp)
  sections: {                   // Mục rich text
    opinions: RichSection               // 2. Ý kiến
    nextWeek: RichSection               // 3. Tuần tới
    proposedSchedule: RichSection | null    // tuỳ chọn: Đề xuất lịch tuần tới
    deputyOpinions: RichSection | null      // tuỳ chọn: Ý kiến PGĐ
  }
  statsSnapshotJson: string | null      // số liệu bcsolieu lúc chốt (chuỗi JSON)
  statsFetchedAt: Timestamp | null
  carriedFromWeekId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface WorkItem {
  id: string
  text: string
  highlight: boolean            // tô đỏ
  pinned: boolean               // việc thường xuyên, mang sang tuần sau
  order: number
  source: 'manual' | 'carried' | 'task'
  taskId: string | null
  children: Array<{ id: string; text: string; highlight: boolean; order: number }>
}

interface RichSection {
  docJson: string               // JSON của Tiptap, LƯU DẠNG CHUỖI
  plainText: string             // để tìm kiếm / xem nhanh
  updatedAt: Timestamp
}
```
- Lưu `docJson` dạng chuỗi chứ không phải map lồng: Firestore tự đánh chỉ mục mọi trường con của map (tốn ghi, dễ chạm trần 40.000 mục chỉ mục/bản ghi) và từ chối giá trị `undefined`.
- Ảnh trong rich text là URL, **không bao giờ** base64 (giới hạn 1 MiB/bản ghi). Cảnh báo khi một mục vượt 200 KB.
- Tạo tuần: phía client, lần đầu mở tuần (`ensureWeek`, transaction, chỉ tạo khi chưa có), sao chép `workItems` có `pinned = true` từ tuần gần nhất trước đó (không sao chép dòng con, không sao chép dòng chưa ghim). Không cần cron.

### 5.2. `weeklyReports/{weekId}/snapshots/{id}` — bản chụp
`{ createdAt, reason: 'finalize' | 'reopen' | 'manual', payloadJson: string }` (toàn bộ tuần + danh sách tham mưu của tuần). Thay cho lịch sử phiên bản của Google Doc. Chỉ tạo, không sửa/xoá.

### 5.3. `advisoryDocs/{id}` — văn bản đã tham mưu
```ts
interface AdvisoryDoc {
  id: string
  type: string                  // mã loại: 'KH' | 'CV' | 'BC' | 'TB' | 'QD' | 'TTr' | 'GM' | 'CB' | ... | 'KHAC'
  title: string                 // tên/trích yếu, KHÔNG gồm tiền tố loại
  docNumber: string | null      // số ký hiệu nếu có
  advisedDate: string           // 'YYYY-MM-DD' (ngày tham mưu)
  weekId: string                // = weekIdForDate(advisedDate) trừ khi ghi đè
  weekIdOverridden: boolean
  sourceDocumentIds: string[]   // văn bản gốc trong /documents (0..n)
  sourceSnapshot: Array<{ id: string; docNumber: string; title: string; sender: string; issueDate: string | null }>
  draftLink: string | null      // link bản thảo (Drive/Docs)
  draftDriveFileId: string | null
  note: string
  highlight: boolean            // tô đỏ
  order: number                 // thứ tự trong tuần
  taskId: string | null         // nếu sinh từ việc hoàn thành công việc
  createdAt: Timestamp
  updatedAt: Timestamp
}
```
- Collection riêng (không nhúng vào tuần) để: thêm được trước khi bản ghi tuần tồn tại; tra cứu cả năm theo loại; liên kết ngược từ văn bản gốc.
- Liên kết ngược: ghi `advisoryDocIds: arrayUnion(id)` lên `documents/{docId}` (cùng kiểu với `taskIds` hiện có; chỉ là ID, không lộ nội dung). Tuỳ chọn trong form (mặc định bật): đánh dấu văn bản gốc `status = 'completed'`, `completedDate = advisedDate`.
- Dòng tự đếm (hàm thuần `formatAdvisorySummary`): `Tham mưu VB: 9 văn bản: 3 CV, 2 KH, 1 BC, 3 TB` — thứ tự theo danh mục loại, bỏ loại có 0.

### 5.4. Collection phụ
- `weeklyReportConfig/main`: `docTypes: [{ code, label, order }]` (mặc định: KH Kế hoạch, CV Công văn, BC Báo cáo, TB Thông báo, QD Quyết định, TTr Tờ trình, GM Giấy mời, CB Bản công bố, HD Hướng dẫn, BB Biên bản, PA Phương án, KHAC Khác — anh thêm/sửa được), `monthRule`, `unitHeading`, `reportTitle`, `deputySectionLabel`, `coworkSections` (mục nào Cowork được đọc).
- `weeklyReportImages/{driveFileId}`: `{ weekId, section, mimeType, size, width, height, createdAt }` — sổ đăng ký ảnh (chỉ server ghi); dùng để route ảnh chỉ phục vụ file đã đăng ký và để dọn ảnh mồ côi.
- `coworkAccessLogs/{id}`: `{ at, path, query, status, ipHash }` — nhật ký truy cập API Cowork (chỉ server ghi, không ghi token).

### 5.5. Cập nhật `firestore.rules` (Claude chính làm, triển khai cần anh duyệt)
`<ADMIN_EMAIL>` dưới đây là đúng giá trị hằng `ADMIN_EMAIL` đang khai báo trong `hooks/useRole.ts` và `lib/api-auth.ts` (không ghi giá trị vào tài liệu này).
```
function isOwnerAdmin() {
  return request.auth != null
    && request.auth.token.email == '<ADMIN_EMAIL>'
    && request.auth.token.email_verified == true;
}
match /weeklyReports/{weekId} {
  allow read, write: if isOwnerAdmin();
  match /snapshots/{snapId} {
    allow read, create: if isOwnerAdmin();
    allow update, delete: if false;
  }
}
match /advisoryDocs/{id}        { allow read, write: if isOwnerAdmin(); }
match /weeklyReportConfig/{id}  { allow read, write: if isOwnerAdmin(); }
match /weeklyReportImages/{id}  { allow read: if isOwnerAdmin(); allow write: if false; }
match /coworkAccessLogs/{id}    { allow read: if isOwnerAdmin(); allow write: if false; }
```
- Khách ẩn danh và phiên nhân viên (cũng là user ẩn danh của Firebase) **không đọc được** dữ liệu giao ban, độc lập với tiến độ S2.
- Repo chưa có `firebase.json` → triển khai rules qua Firebase Console hoặc bổ sung `firebase.json` (quyết định lúc deploy).
- Khi sau này cần cho nhân viên phòng KHNV cùng nhập: mở rộng theo custom claims của S2, không nới rule này.

### 5.6. Index
- Giai đoạn 1 **không cần composite index mới**: truy vấn `advisoryDocs` theo `weekId ==`, theo khoảng `advisedDate`, theo `sourceDocumentIds array-contains`; `weeklyReports` theo `reportMonth ==` hoặc `orderBy meetingDate`. Sắp xếp phụ làm ở client (mỗi tuần vài chục dòng, mỗi năm khoảng 600 văn bản).
- Gợi ý từ Công việc dùng lại bộ nhớ đệm việc đã đóng 30 ngày của `useTasks` (index `isClosed + updatedAt` đã có).
- Tuỳ chọn tối ưu: khai báo miễn chỉ mục (`fieldOverrides`) cho 4 trường `sections.*.docJson`, `statsSnapshotJson`, `snapshots.payloadJson`.

---

## 6. Màn hình, route, component

Áp dụng `~/.claude/skills/ui-ux-chuan/reference/chuan-san.md` (đọc trước khi làm), rà `anti-pattern.md`, `web.md`, `y-te-tieng-viet.md` và xem bản render thật trước khi báo xong. Các điểm bắt buộc cho module này: chữ nội dung ≥ 16px (bản đọc 18–20px), độ rộng dòng 45–75 ký tự, vùng bấm ≥ 44px trên điện thoại, không giấu hành động sau hover, kéo-thả phải có nút/phím thay thế, nút gọi tên hành động, trạng thái rỗng nói lý do + việc nên làm, **đánh dấu đỏ không chỉ bằng màu** (đỏ + in đậm, để bản in đen trắng vẫn phân biệt), một hành động chính mỗi vùng, ngày dạng `dd/MM/yyyy`, số trong bảng canh phải chữ số đều rộng.

### 6.1. Route mới (chỉ admin thấy và vào được)

| Route | Nội dung |
|---|---|
| `/weekly-reports` | Chuyển tới tuần mặc định |
| `/weekly-reports/[weekId]` | **Trang soạn tuần** |
| `/weekly-reports/[weekId]/read` | **Bản đọc giao ban** (toàn màn hình, in được) |
| `/weekly-reports/monthly/[month]` | **Tổng hợp tháng** + xuất file |
| `/weekly-reports/advisory` | **Sổ văn bản tham mưu** (lọc theo tháng, loại; tìm kiếm; liên kết văn bản gốc) |
| `/settings/weekly-report` | Danh mục loại văn bản, quy tắc tháng, nhãn mục, trạng thái kết nối Cowork/bcsolieu (không hiện giá trị token) |
| `/weekly-reports/dev-preview` | Chỉ khi `NODE_ENV !== 'production'`: dựng các component với dữ liệu giả để kiểm giao diện mà không cần đăng nhập Google (bản production trả 404) |

### 6.2. Trang soạn tuần — bố cục
```
[‹ Tuần trước]  Giao ban 13/11/2026 · kỳ 06/11–12/11 · thuộc tháng 11  [Tuần sau ›]   Đã lưu 10:32
                                                   [Bản đọc giao ban]  [Chốt]  [⋯ Xuất, Lịch sử]
1. KHTH — Tình hình thực hiện nhiệm vụ tuần qua
   • dòng việc (ghim 📌 / đỏ / dòng con)                     ┌ Gợi ý từ Công việc (3) ┐
   • …                                                       │ ✓ Việc A   [Đưa vào]  │
   [+ Thêm dòng]                                             └────────────────────────┘
   Tham mưu VB: 9 văn bản: 3 CV, 2 KH, 1 BC, 3 TB   (tự đếm)
     KH …  ↩ 329/KH-SYT        [sửa] [đỏ] [⋯]
     TB …
   [+ Thêm văn bản tham mưu]  [Dán nhiều dòng]
2. Ý kiến                (rich text, dán ảnh)
3. Tuần tới              (rich text)           [Chèn việc đến hạn tuần tới]
[+ Thêm mục: Đề xuất lịch tuần tới · Ý kiến PGĐ]
Số liệu tuần             [Mở Báo cáo tuần bên bcsolieu ↗]  (giai đoạn 2: bảng số liệu)
```
- Mục 1 là **danh sách có cấu trúc** (outliner 2 cấp): Enter thêm dòng, Backspace ở dòng trống để xoá, Tab / Shift+Tab lùi cấp, Alt+↑/↓ đổi thứ tự (kèm nút), Ctrl/⌘+Shift+H đánh dấu đỏ, nút ghim.
- Tuần mới tạo hiện thông báo một lần: "Đã mang 4 việc thường xuyên từ tuần 06/11–12/11 · Hoàn tác".
- Tự lưu sau 1,5 s ngừng gõ, theo từng trường; hiện "Đang lưu… / Đã lưu hh:mm / Lỗi lưu, thử lại"; cảnh báo khi rời trang còn thay đổi chưa lưu; nếu thiết bị khác vừa sửa thì báo và nạp lại mục đó.
- **Chốt**: lưu snapshot, chụp số liệu bcsolieu (giai đoạn 2), đổi trạng thái `finalized` (vẫn "Mở lại" được, có snapshot trước khi mở).

### 6.3. Nút "Xử lý / Tham mưu" trên văn bản
- Vị trí: hàng hành động của `DocumentTable` (cạnh "Tạo công việc từ văn bản"), `DocumentModal`, và khối mới "Văn bản đã tham mưu" trong `DocumentViewer`.
- Mở form gọn (popover trên desktop, sheet trên điện thoại), không rời trang:
  - Loại (bắt buộc; nút chọn nhanh KH · CV · BC · TB · QĐ · Tờ trình · Khác…), Tên/trích yếu (bắt buộc; gợi ý sẵn: TB → "Về việc triển khai <số ký hiệu + trích yếu văn bản gốc>", KH → "Triển khai thực hiện …"), Số ký hiệu, Ngày tham mưu (mặc định hôm nay; hiện ngay "→ tuần giao ban 20/11/2026"), Link/file bản thảo, Ghi chú, ☑ Đánh dấu văn bản gốc đã xử lý xong, ☐ Tô đỏ.
  - Nút chính "Lưu văn bản tham mưu"; nút phụ "Chưa xong, tạo việc theo dõi".
  - Cảnh báo (không chặn) nếu văn bản gốc đã có văn bản tham mưu cùng loại.
- Thêm rời (không có văn bản gốc): nút "+ Thêm văn bản tham mưu" trong trang tuần; có thể gắn văn bản gốc sau bằng `DocumentPickerPanel` sẵn có.
- **Dán nhiều dòng**: dán một khối chữ, mỗi dòng một văn bản; tự nhận tiền tố (`KH`, `CV`, `BC`, `TB`, `QĐ`, `GM`, `Tờ trình`, `V/v` → CV) và cho xem trước để sửa loại trước khi lưu. Dùng cho thói quen cũ và để nhập các tuần đã qua.

### 6.4. Bản đọc giao ban
Thứ tự và nhãn giống doc hiện tại: ngày → "Báo cáo giao ban Lãnh đạo tuần" → "1. KHTH" → "Tình hình thực hiện nhiệm vụ tuần qua" → dòng việc → dòng "Tham mưu VB…" + danh sách → "2. Ý kiến" → "3. Tuần tới" → mục tuỳ chọn → (bật/tắt) phụ lục số liệu tuần. Toàn màn hình, Esc để thoát, nút "In / Lưu PDF" (`window.print()` + CSS in A4, Times New Roman 14pt, ảnh không tràn trang). Mục rỗng không hiện. Không cần thư viện in.

### 6.5. Tổng hợp tháng
Danh sách tuần thuộc tháng (đánh dấu tuần giáp ranh, tuần chưa chốt, tuần thiếu), bảng đếm theo loại, toàn bộ văn bản tham mưu theo loại, nút "Tải .docx", "Tải .md", "Sao chép", và trạng thái "tháng chưa đủ" khi kỳ cuối chưa kết thúc.

### 6.6. Component và file (dự kiến)

| File | Vai trò |
|---|---|
| `types/weekly-report.ts` | Kiểu dữ liệu (hợp đồng chung) |
| `lib/weekly-report/period.ts` | Kỳ tuần, `weekIdForDate`, `reportMonthFor`, `weeksOfMonth` (thuần, có test) |
| `lib/weekly-report/advisory-format.ts` | Đếm theo loại, dòng "Tham mưu VB…", nhận tiền tố khi dán (thuần, có test) |
| `lib/weekly-report/outline.ts` | Reducer cho danh sách Mục 1 (thuần, có test) |
| `lib/weekly-report/firestore.ts` | CRUD client: `ensureWeek`, cập nhật mục, CRUD tham mưu, ghi liên kết ngược, snapshot |
| `lib/weekly-report/server.ts` | Đọc bằng Admin SDK cho route xuất và API Cowork (`server-only`) |
| `lib/weekly-report/export/{tiptap-markdown,markdown,docx,json}.ts` | Bộ xuất (thuần, có test) |
| `lib/cowork/auth.ts` | Xác thực token Cowork (`server-only`) |
| `hooks/useWeeklyReport.ts`, `useAdvisoryDocs.ts`, `useWeeklyReportConfig.ts` | Listener Firestore |
| `components/weekly-report/WorkItemOutliner.tsx` | Mục 1 |
| `components/weekly-report/RichEditor.tsx`, `RichViewer.tsx`, `extensions/{red-mark,paste-image}.ts` | Soạn thảo + xem |
| `components/weekly-report/AdvisoryForm.tsx`, `AdvisoryList.tsx`, `BulkPasteDialog.tsx` | Tham mưu |
| `components/weekly-report/{WeekHeader,TaskSuggestions,FinalizeBar,WeeklyStatsPanel,ReadingView,MonthlySummary}.tsx` | Trang |
| `components/documents/DocumentAdvisorySection.tsx` | Khối "Văn bản đã tham mưu" trong văn bản |
| Sửa nhỏ: `DocumentTable.tsx` (prop `onAdvise`), `DocumentModal.tsx`, `DocumentViewer.tsx`, `app/(app)/layout.tsx`, `components/layout/MobileTabBar.tsx`, `types/index.ts` (`advisoryDocIds?`), `types/tasks.ts` (`resultAdvisoryDocIds?`) | |

---

## 7. API routes

| Route | Phương thức | Xác thực | Việc |
|---|---|---|---|
| `/api/weekly-reports/images` | POST (multipart) | `authenticateRequest({ adminOnly: true })` | Nhận ảnh đã nén (chỉ `image/png, jpeg, webp, gif`; ≤ 4 MB), tải lên Drive thư mục con "Giao ban tuần" bằng client refresh-token sẵn có, ghi `weeklyReportImages`, trả `{ imageId, url }` |
| `/api/weekly-reports/images/[fileId]` | GET | Không token (xem D-24) | Chỉ phục vụ `fileId` có trong `weeklyReportImages`; đọc byte từ Drive; `Cache-Control: public, s-maxage=31536000, immutable`, `X-Robots-Tag: noindex` |
| `/api/weekly-reports/export` | GET `?month=YYYY-MM` hoặc `?week=YYYY-MM-DD`, `&format=md\|docx\|json` | adminOnly | Dựng file bằng bộ xuất dùng chung |
| `/api/bcsolieu/weekly-stats` | GET `?weekId=` | adminOnly | Giai đoạn 2: gọi bcsolieu bằng token server, trả bảng số liệu 2 kỳ |
| `/api/cowork/v1/catalog` | GET | Bearer token Cowork | Danh mục loại, quy tắc tháng, phạm vi dữ liệu (tuần đầu/cuối, tuần đã chốt), `schemaVersion` |
| `/api/cowork/v1/weeks` | GET `?from=&to=` | Bearer | Danh sách tuần + trạng thái |
| `/api/cowork/v1/weeks/[weekId]` | GET `?format=json\|md&sections=` | Bearer | Một tuần |
| `/api/cowork/v1/months/[month]` | GET `?format=json\|md\|docx&sections=` | Bearer | Tổng hợp tháng theo quy tắc gán tháng |
| `/api/cowork/v1/advisory-docs` | GET `?from=&to=&type=` | Bearer | Văn bản tham mưu theo khoảng ngày (quý, 6 tháng, năm) + đếm theo loại, theo tháng |

Quy ước chung của `/api/cowork/v1/*`: chỉ GET; `Cache-Control: no-store`; phản hồi `{ ok, schemaVersion: 'myoffice-cowork-1.0', generatedAt, etag, warnings[], data }`; lỗi `{ ok: false, code, message }`; cảnh báo có mã (`WEEK_NOT_FINALIZED`, `WEEK_MISSING`, `MONTH_INCOMPLETE`, `BOUNDARY_WEEK`, `MONTH_OVERRIDDEN`).

---

## 8. Quyết định kỹ thuật (tiếp nối D-01…D-09)

| ID | Quyết định | Lý do / đánh đổi |
|---|---|---|
| D-20 | `weekId` = ngày giao ban ISO; ngày lưu dạng chuỗi `YYYY-MM-DD` theo giờ VN | Sắp xếp theo chuỗi = theo thời gian; tránh lệch múi giờ trên Vercel |
| D-21 | Gán tháng mặc định theo **đa số ngày**, có ghi đè từng tuần | Khớp tiền lệ, không nghịch lý; chờ anh chốt (Q1) |
| D-22 | Mục 1 là danh sách có cấu trúc; Mục 2, 3 và mục tuỳ chọn là rich text | Có cấu trúc thì mới ghim/mang sang, liên kết Task, xuất sạch cho Cowork. Đánh đổi: Mục 1 không dán ảnh, không định dạng tự do (thực tế Mục 1 chỉ là gạch đầu dòng) |
| D-23 | Rich text dùng **Tiptap**, lưu JSON dạng chuỗi; xem bằng editor chỉ-đọc (không `dangerouslySetInnerHTML`) | Không cần thư viện lọc HTML; JSON dễ chuyển sang Markdown/docx |
| D-24 | **Ảnh lưu Google Drive** (thư mục con của thư mục app), hiển thị qua route của app | Dùng lại hạ tầng và hạn mức sẵn có, không thêm sản phẩm mới. Firebase Storage: bucket dạng `*.firebasestorage.app` có thể đòi gói Blaze (cần kiểm trên Console), phải thêm rules và SDK. URL nhúng trực tiếp của Drive không chính thức, dễ hỏng giữa buổi họp → đi qua route app để ổn định và cache được. Ảnh theo đúng D-04: ai có ID ngẫu nhiên của file thì xem được (Q2) |
| D-25 | Ảnh nén ở client bằng Canvas trước khi tải (cạnh dài ≤ 2000px; PNG giữ nguyên nếu < 1,5 MB, còn lại JPEG chất lượng 0,85) | Không thêm thư viện; nằm dưới trần 4,5 MB của Vercel |
| D-26 | Văn bản tham mưu là collection riêng `advisoryDocs`, gắn tuần qua `weekId` suy từ `advisedDate` | Thêm được khi chưa có bản ghi tuần; tra cứu cả năm; liên kết ngược |
| D-27 | Tạo tuần và mang việc thường xuyên làm ở client khi mở trang (transaction), không cron | Đơn giản, không phụ thuộc lịch chạy; nghỉ một tuần vẫn mang đúng từ tuần gần nhất |
| D-28 | Collection mới chỉ admin đọc/ghi bằng rule theo email; cấu hình không đặt trong `settings` | Không kế thừa lỗ hổng "user ẩn danh đọc được"; không đụng S2 |
| D-29 | Cowork đọc qua **API chỉ-đọc `/api/cowork/v1` + MCP mỏng `my-office`** chạy trên Mac, theo đúng mẫu `kcb-data` | Đã có tiền lệ chạy thật; một chỗ tính; token không nằm trong lệnh |
| D-30 | Token Cowork là khoá riêng, chỉ mở `/api/cowork/v1/*`; `authenticateRequest()` không nhận nó; ngược lại ID token/`ingestSecret`/phiên nhân viên không mở được API Cowork | Phạm vi tối thiểu, giống cổng riêng của Hermes |
| D-31 | Xuất docx dựng ở server bằng thư viện `docx`; bản in dùng CSS in của trình duyệt | `docx` không vào bundle client; không cần thư viện in |
| D-32 | Số liệu bcsolieu: giai đoạn 1 liên kết sâu; giai đoạn 2 gọi server-to-server và **chụp lại lúc chốt** | iframe bị chặn; chép module sẽ lệch số; snapshot giữ đúng số đã đọc tại buổi họp |
| D-33 | Không đưa dữ liệu giao ban vào Algolia | Tránh thêm nơi lưu nội dung nội bộ; sổ tham mưu lọc ở client là đủ |
| D-34 | Có trang `dev-preview` (chỉ môi trường dev) dựng component bằng dữ liệu giả | Để xác minh giao diện thật mà không cần đăng nhập Google (lần rà soát 02/11 từng không kiểm được màn Công việc vì lý do này) |

---

## 9. Thư viện đề xuất và dự án mã nguồn mở đã tham khảo

### 9.1. Gói npm mới — **cần anh duyệt** (số liệu tra từ npm registry ngày 18/11/2026)

| Gói | Dùng để | Phiên bản | Tải/tuần | Giấy phép | Ghi chú |
|---|---|---|---|---|---|
| `@tiptap/react` | Editor cho React | 3.34.0 | ~31 triệu | MIT | Hỗ trợ React 17/18/19 |
| `@tiptap/pm` | Lõi ProseMirror | 3.34.0 | ~38 triệu | MIT | Phụ thuộc bắt buộc của Tiptap |
| `@tiptap/starter-kit` | Đoạn, danh sách, đậm/nghiêng/gạch chân, link, hoàn tác | 3.34.0 | ~33 triệu | MIT | Bản 3 đã gồm link, underline, list |
| `@tiptap/extension-image` | Node ảnh | 3.34.0 | ~16 triệu | MIT | |
| `docx` | Sinh `.docx` ở server | 9.15.4 | ~12 triệu | MIT | Tác giả `dolanmiu`; phụ thuộc `fflate`, `nanoid` |

Không cần thêm: thư viện in (dùng CSS in), nén ảnh (Canvas), lọc HTML (không render HTML thô), Markdown (tự viết bộ chuyển cho schema giới hạn, khoảng 100 dòng, có test), SDK MCP cho Node (MCP viết bằng Python FastMCP đã có trên máy). Đánh dấu đỏ viết thành một Mark nhỏ trong dự án, xử lý dán ảnh viết bằng `editorProps.handlePaste/handleDrop`. Sau khi cài chạy `npm audit`. Nếu anh không duyệt `docx`: phương án thay là MCP dựng docx bằng `python-docx` trên Mac (khi đó trong app chỉ còn tải `.md` và in PDF).

### 9.2. Dự án tham khảo (chỉ đọc ý tưởng; không clone, không chạy, không chép code)
Đã tra sao, giấy phép, ngày cập nhật qua GitHub API ngày 18/11/2026. "Điểm học được" rút từ tài liệu và kiến trúc công khai của dự án.

**Rich text + dán ảnh**

| Dự án | Uy tín | Điểm học được |
|---|---|---|
| `ueberdosis/tiptap` | MIT, ~39 nghìn sao, cập nhật hằng ngày | Nội dung là cây JSON theo schema; chặn sự kiện dán/thả ở `editorProps`; mở rộng bằng Mark/Node nhỏ |
| `steven-tey/novel` | Apache-2.0, ~16 nghìn sao, lần cập nhật cuối 01/2025 (ít bảo trì → chỉ học mẫu, không dùng) | Mẫu tải ảnh: kiểm loại/kích thước → chèn chỗ giữ tạm → tải lên → thay bằng node ảnh có URL; không lưu base64 |
| `outline/outline` | ~41 nghìn sao, giấy phép BSL (không chép code) | Mỗi tệp đính kèm là một bản ghi riêng gắn với tài liệu → kiểm quyền và dọn rác được; ảnh phục vụ qua URL của chính ứng dụng |

**Xuất docx**

| Dự án | Uy tín | Điểm học được |
|---|---|---|
| `dolanmiu/docx` | MIT, ~6 nghìn sao, đang bảo trì | Khai báo `Document → Paragraph → TextRun/ImageRun`, cấu hình numbering cho gạch đầu dòng, `Packer.toBuffer` chạy trên Node |
| `privateOmega/html-to-docx` | MIT, 482 sao, cập nhật cuối 04/2025 | Đi đường HTML → docx khó kiểm soát kiểu chữ, ít bảo trì → **không chọn** |
| Quy trình sẵn có của Cowork (`tong-hop-cong-viec-khth/build_th_template.py`) | Nội bộ | Giữ thể thức bằng cách nhân bản file mẫu rồi thay nội dung → file "TH" vẫn để Cowork dựng, app chỉ xuất định dạng `tom-tat` đơn giản |

**MCP server**

| Dự án | Uy tín | Điểm học được |
|---|---|---|
| `modelcontextprotocol/python-sdk` | MIT, ~25 nghìn sao | FastMCP: mỗi tool là một hàm có kiểu tham số + mô tả; chạy stdio |
| `modelcontextprotocol/servers` | ~92 nghìn sao | Mỗi tool một việc, mô tả rõ khi nào dùng; ghi file phải kiểm allowlist đường dẫn |
| `makenotion/notion-mcp-server` + tiền lệ nội bộ `kcb_data_server.py` | MIT, ~4,7 nghìn sao | MCP mỏng bọc REST có token; đọc token từ file cục bộ lúc chạy, không in ra; thử lại với 429/503 |

---

## 10. Phương án cho Cowork

### 10.1. So sánh

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| A. Tải file tay (docx/md) rồi đặt vào `tom-tat/` | Không cần hạ tầng | Vẫn thao tác tay; Cowork vẫn phải phân tích văn bản tự do | Giữ làm dự phòng (nút tải trong app) |
| B. Endpoint xuất có API key, Cowork gọi `curl` | Một chỗ tính | Cowork tự viết lệnh, token lộ trong lệnh | Là lớp nền của C |
| **C. API chỉ-đọc + MCP mỏng `my-office`** | Tool có mô tả và tham số kiểu → ít gọi sai; token không nằm trong lệnh; đã có tiền lệ `kcb-data` | Chỉ chạy khi Mac bật | **Khuyến nghị** |
| D. Script đồng bộ định kỳ ra thư mục local | Cowork đọc file như cũ | Thêm tiến trình nền, dữ liệu có thể cũ | Không làm riêng; tuỳ chọn `luu_file` của C làm đúng việc này khi cần |
| E. MCP đọc thẳng Firestore | Không phụ thuộc Vercel | Lặp quy tắc tuần/tháng, cần service account trên máy | Không làm |
| F. Remote MCP trên Vercel (connector claude.ai) | Chạy cả khi Mac tắt | Cần OAuth, thêm bề mặt tấn công | Để sau |

### 10.2. MCP `my-office`
- File: `~/Documents/Claude/KHTH/mcp-servers/my_office_server.py` (FastMCP, Python 3.11 Homebrew, cùng chỗ và cùng kiểu với `kcb_data_server.py`). Cấu hình đọc lúc chạy từ `~/Documents/Claude/KHTH/config/credentials.local.json`, khoá `my_office: { base_url, cowork_token }`.
- Tool (5):
  - `mo_danh_muc` → `/catalog`
  - `mo_danh_sach_tuan(tu, den)` → `/weeks`
  - `mo_giao_ban_tuan(tuan, dinh_dang, muc)` → `/weeks/{weekId}`
  - `mo_tong_hop_thang(thang, dinh_dang, muc)` → `/months/{YYYY-MM}`
  - `mo_van_ban_tham_muu(tu, den, loai)` → `/advisory-docs`
  - tuỳ chọn `luu_file` trên 2 tool cuối: chỉ ghi vào `~/Documents/Claude/KHTH/` (mặc định `KHTH - P1 Soạn thảo/ke-hoach/cong-viec-khth/tom-tat/MM.YYYY.docx|md`), chặn `..` và symlink.
- Timeout 60 s, thử lại 1 lần với 429/503, không in token, có `smoke_test` với HTTP giả.

### 10.3. Bảo mật
- Token ngẫu nhiên ≥ 32 byte, do anh tạo bằng script (ghi thẳng vào `credentials.local.json` và hướng dẫn đặt biến trên Vercel; **không in token, không gửi qua chat**). Biến server: `COWORK_API_TOKEN`, `COWORK_API_TOKEN_NEXT` (xoay vòng không gián đoạn). Thiếu biến → route trả 503 (đóng mặc định).
- So sánh hằng thời gian; token chỉ có hiệu lực trên `/api/cowork/v1/*`; không có endpoint ghi.
- Mặc định chỉ trả Mục 1 và văn bản tham mưu. "Ý kiến", "Tuần tới", "Đề xuất lịch" chỉ trả khi gọi kèm `sections` **và** mục đó được bật trong `coworkSections`. "Ý kiến PGĐ" mặc định tắt (Q4).
- Không trả dữ liệu nhân sự, không trả nội dung văn bản gốc (chỉ số ký hiệu, trích yếu, cơ quan ban hành). Ảnh trả dạng chú thích `[ảnh]` + URL.
- Giới hạn 30 yêu cầu/phút (mức cố gắng, theo instance), phản hồi ≤ 2 MB, ghi `coworkAccessLogs`.
- Vì repo công khai, đường dẫn API là công khai: an toàn dựa hoàn toàn vào độ mạnh và việc giữ kín token.

### 10.4. Cowork dùng thế nào
- **"TH MM.YYYY"**: `mo_tong_hop_thang(thang)` → JSON có sẵn `weeks[]` (đã gán tháng, có cờ giáp ranh), `advisoryDocs[]` (loại, nhãn loại đầy đủ, tên, số, tuần, văn bản gốc), `countsByType`, `total`, `workItems[]` theo tuần. Mục I dựng thẳng từ số liệu này (không đếm lại, không hỏi về tuần giáp ranh); Mục II–V viết từ `workItems`. Skill `tong-hop-cong-viec-khth` sửa Bước 1–2 để ưu tiên MCP, giữ đường đọc docx làm dự phòng. Trong giai đoạn chuyển tiếp, `luu_file` vẫn thả `tom-tat/MM.YYYY.docx` để cơ chế tự kích hoạt đầu phiên của skill chạy như cũ.
- **Kế hoạch tháng/quý, báo cáo Đảng, sơ kết**: `mo_van_ban_tham_muu(tu, den)` cho cả quý/6 tháng/năm kèm đếm theo loại và theo tháng; `mo_giao_ban_tuan` khi cần chi tiết một tuần. Kết hợp `kcb-data` cho số liệu chuyên môn.

---

## 11. Tích hợp số liệu `bao-cao-tuan`

| Phương án | Đánh giá |
|---|---|
| Nhúng iframe | **Không khả thi** nếu không hạ bảo mật bcsolieu (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, cookie SameSite=Lax) |
| Import module tính toán sang my-office | **Không nên**: logic bám BigQuery, cấu hình dòng động, vòng đời khoa; chép sang sẽ lệch số (đúng nguyên tắc R-003: một chỗ tính) |
| Dùng `/api/cowork/v1/query` sẵn có (kỳ `khoang_ngay` + so sánh) | Dùng được ngay nhưng trả bảng Phụ lục của Sơ kết, **không phải** bảng Báo cáo tuần 3 khối anh đang đọc |
| **Server-to-server: thêm endpoint đọc `GET /api/cowork/v1/bao-cao-tuan` ở bcsolieu, my-office gọi qua route server** | **Khuyến nghị cho giai đoạn 2.** Số = số trang hiển thị (cùng hàm `getBaoCaoTuanReport`), token nằm ở server my-office |
| Liên kết sâu | **Làm ngay ở giai đoạn 1**, không sửa gì bên bcsolieu |

- **Giai đoạn 1 (trong T-220)**: nút "Mở Báo cáo tuần ↗" tới trang `/bao-cao-tuan` của bcsolieu kèm tham số `t2_tu=<periodStart>&t2_den=<periodEnd>` (Tuần 1 tự là 7 ngày liền trước).
- **Giai đoạn 2**:
  - T-231a (repo bcsolieu, theo quy trình của repo đó, cần ADR/task riêng và anh duyệt): route `GET /api/cowork/v1/bao-cao-tuan?t2_tu=&t2_den=[&t1_tu=&t1_den=]` trả `BaoCaoTuanReport`. Nên cấp khoá riêng cho my-office chỉ mở đúng route này; phương án tối thiểu là dùng chung `COWORK_API_TOKEN`.
  - T-231b (my-office): `/api/bcsolieu/weekly-stats` (adminOnly; biến `BCSOLIEU_BASE_URL`, `BCSOLIEU_API_TOKEN`; timeout 20 s; lỗi thì trang vẫn dùng được và hiện liên kết sâu) + `WeeklyStatsPanel` (3 khối, cột Tuần trước · Tuần này · Tăng · Giảm, thu gọn được; ghim được vài dòng vào Mục 1 dạng chữ). Khi **Chốt**, lưu `statsSnapshotJson` để bản đọc và Cowork thấy đúng số của buổi họp ("số liệu chốt lúc …").
  - Cần kiểm: WAF của bcsolieu chặn theo user-agent → route gọi phải đặt user-agent rõ ràng.

---

## 12. Tiêu chí nghiệm thu (đánh số)

**K — Kỳ tuần và tháng (hàm thuần)**
- AC-K1. `weekIdForDate('2026-11-12') = '2026-11-13'`; `('2026-11-13') = '2026-11-20'`; `('2026-11-18') = '2026-11-20'`.
- AC-K2. Tuần `2026-11-13` có kỳ `2026-11-06` → `2026-11-12`.
- AC-K3. Theo quy tắc đa số: 11 tuần giáp ranh ở bảng 4.2 ra đúng cột (a); theo quy tắc ngày giao ban ra đúng cột (b).
- AC-K4. `weeksOfMonth('2026-10')` = 09/10, 16/10, 23/10, 30/10; `('2026-11')` = 06/11, 13/11, 20/11, 27/11, 04/12. Hợp các tuần của 12 tháng 2026 không trùng, không sót.
- AC-K5. Ghi đè `reportMonth` của một tuần thì tuần đó rời tháng cũ và vào tháng mới, không xuất hiện ở cả hai.
- AC-K6. Kết quả không đổi khi chạy với `TZ=UTC` và `TZ=Asia/Ho_Chi_Minh`.

**G — Giao ban tuần**
- AC-G1. Mở `/weekly-reports` lần đầu trong tuần: bản ghi tuần được tạo đúng một lần (mở 2 tab cùng lúc không tạo trùng, không nhân đôi dòng).
- AC-G2. Dòng ghim của tuần gần nhất được mang sang; dòng không ghim và dòng con không mang; có "Hoàn tác".
- AC-G3. Mục 1: thêm/sửa/xoá/đổi thứ tự/lùi cấp/ghim/đánh dấu đỏ bằng cả bàn phím và nút.
- AC-G4. Mục 2, 3: soạn rich text; dán ảnh từ clipboard và kéo-thả ảnh đều hiển thị được sau khi tải lại trang; `docJson` không chứa `data:`.
- AC-G5. Bật/tắt được 2 mục tuỳ chọn; mục tắt không hiện trong bản đọc và bản xuất.
- AC-G6. Tự lưu ≤ 2 s sau khi ngừng gõ, có chỉ báo trạng thái; mất mạng thì báo lỗi và không mất nội dung đang gõ.
- AC-G7. "Chốt" tạo snapshot; "Mở lại" tạo snapshot trước khi mở; xem lại và khôi phục được snapshot.
- AC-G8. Ảnh sai loại hoặc > 4 MB sau nén bị từ chối kèm thông báo nói rõ lý do.
- AC-G9. Dùng được ở 375px và 1280px; không cuộn ngang; vùng bấm ≥ 44px trên điện thoại.

**T — Tham mưu văn bản**
- AC-T1. Từ `DocumentTable`, `DocumentModal`, `DocumentViewer` đều mở được form; lưu xong văn bản tham mưu xuất hiện ở tuần đúng theo ngày tham mưu.
- AC-T2. Văn bản gốc hiện khối "Văn bản đã tham mưu" có link tới tuần; dòng tham mưu có link ngược về văn bản gốc.
- AC-T3. Thêm được văn bản tham mưu không có văn bản gốc; gắn văn bản gốc sau được.
- AC-T4. Dòng "Tham mưu VB: N văn bản: …" đúng với danh sách sau mọi thao tác thêm/sửa loại/xoá/chuyển tuần; loại có 0 không hiện.
- AC-T5. Đổi ngày tham mưu sang kỳ khác thì văn bản chuyển tuần (trừ khi đã ghi đè tuần).
- AC-T6. Tuỳ chọn "đánh dấu văn bản gốc đã xử lý" cập nhật `status` và `completedDate`; bỏ chọn thì không đổi văn bản gốc.
- AC-T7. Xoá văn bản tham mưu gỡ luôn liên kết ngược; hộp xác nhận nêu rõ tên văn bản.
- AC-T8. "Dán nhiều dòng": 10 dòng mẫu có tiền tố `KH/CV/BC/TB/QĐ/GM/Tờ trình/V/v` nhận đúng loại, cho sửa trước khi lưu.
- AC-T9. Danh mục loại sửa được trong Cài đặt; loại mới dùng được ngay.

**R — Bản đọc**
- AC-R1. Thứ tự và nhãn mục đúng mục 6.4; mục rỗng không hiện.
- AC-R2. Dòng đỏ hiển thị đỏ **và** đậm; bản in đen trắng vẫn phân biệt được.
- AC-R3. In/lưu PDF khổ A4: không dính sidebar/nút, ảnh không tràn lề, không cắt đôi dòng tiêu đề mục.
- AC-R4. Đọc được trên điện thoại; chữ nội dung ≥ 18px; độ rộng dòng ≤ 75 ký tự trên màn rộng.

**M — Tổng hợp tháng và xuất**
- AC-M1. Trang tháng liệt kê đúng tuần theo AC-K4, đánh dấu tuần giáp ranh, tuần chưa chốt, tuần thiếu.
- AC-M2. Bản `.md` và `.docx` của tháng có cấu trúc từng tuần như mục 2.1; skill `tong-hop-cong-viec-khth` hiện tại đọc được file `.docx` mà không sửa skill.
- AC-M3. Số đếm theo loại trong bản xuất = số dòng thực tế (kiểm tự động trong test).
- AC-M4. JSON tháng có `weeks`, `advisoryDocs`, `countsByType`, `total`, `warnings`.
- AC-M5. Tháng chưa đủ (kỳ cuối chưa kết thúc) có cảnh báo `MONTH_INCOMPLETE`, vẫn cho xuất.

**C — Cowork**
- AC-C1. Không token / token sai → 401; thiếu biến môi trường → 503; token đúng → 200.
- AC-C2. Token Cowork gọi `/api/drive/*`, `/api/extension/*`, `/api/weekly-reports/*` → bị từ chối; ID token admin gọi `/api/cowork/v1/*` → bị từ chối.
- AC-C3. Không route nào dưới `/api/cowork/v1` nhận POST/PUT/DELETE (405).
- AC-C4. Mặc định không trả mục Ý kiến/Tuần tới/Ý kiến PGĐ; chỉ trả khi vừa yêu cầu vừa được bật trong cấu hình.
- AC-C5. Kết quả `/months/{m}` bằng đúng bản xuất JSON trong app của cùng tháng.
- AC-C6. MCP: 5 tool chạy được với HTTP giả (smoke test); `luu_file` từ chối đường dẫn ngoài `~/Documents/Claude/KHTH/`; không dòng log nào chứa token.
- AC-C7. Chạy thật một lần: Cowork sinh "TH" của một tháng thử từ MCP, số văn bản theo loại khớp trang tháng.

**S — Số liệu tuần**
- AC-S1. Liên kết sâu mở đúng 2 kỳ của tuần đang xem.
- AC-S2. (GĐ 2) Bảng trong my-office khớp từng ô với trang `/bao-cao-tuan` cùng tham số.
- AC-S3. (GĐ 2) bcsolieu lỗi/hết hạn token → trang giao ban vẫn dùng bình thường, hiện thông báo + liên kết sâu.
- AC-S4. (GĐ 2) Sau khi chốt, bản đọc hiển thị số liệu đã chụp kèm thời điểm chụp.

**V — Công việc**
- AC-V1. Thêm việc bằng ô nhập nhanh: gõ tiêu đề + Enter, không rời trang.
- AC-V2. Tab "Tuần này" chia nhóm theo kỳ Thứ 6 → Thứ 5, dùng chung hàm ở K.
- AC-V3. Hoàn thành việc ở bảng/Kanban/chi tiết/khối việc trong văn bản đều hiện thông báo nổi có hành động "Ghi vào giao ban" / "Ghi văn bản tham mưu"; không mở hộp thoại chặn.
- AC-V4. Một việc chỉ đưa vào báo cáo được một lần; gợi ý biến mất sau khi đưa.
- AC-V5. Lưu văn bản tham mưu từ văn bản gốc có việc đang mở → việc được hoàn thành (hỏi một lần, nhớ lựa chọn).
- AC-V6. Sidebar còn 6 mục; Kanban/Lịch/Định kỳ vẫn vào được từ `/tasks`; đường dẫn cũ `/tasks/kanban`, `/tasks/calendar`, `/tasks/recurring` không gãy.
- AC-V7. Toàn bộ test hiện có vẫn pass (167 test tại lần rà soát 03/11/2026).

**B — Bảo mật và chất lượng chung**
- AC-B1. User ẩn danh và phiên nhân viên đọc/ghi `weeklyReports`, `advisoryDocs`, `weeklyReportConfig` → bị từ chối (kiểm bằng Rules Playground hoặc script).
- AC-B2. Route ảnh GET chỉ trả file có trong `weeklyReportImages`; `fileId` khác → 404.
- AC-B3. Không import `firebase-admin/auth` ở bất kỳ file mới nào; không secret trong repo; `.env.local.example` chỉ có tên biến.
- AC-B4. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass; `npm run build` thành công.
- AC-B5. `npm audit` không có lỗ hổng mức cao do gói mới.

---

## 13. Gói thực thi

Quy ước: mỗi gói có brief riêng ở `handoff/tasks/T-2xx-*.md`, tuân `handoff/tasks/_RULES.md` (Antigravity không commit, không `npm install`, không chạy dev/build, chỉ `tsc` + `vitest`, chỉ sửa file trong phạm vi). Mọi kết quả của Antigravity phải qua **subagent verifier** kiểm từng AC trước khi báo xong. Giao Antigravity cần anh đồng ý trước (theo skill `antigravity-delegate`).

### 13.1. Bảng gói

| Gói | Nội dung | Phạm vi file | Phụ thuộc | Nghiệm thu | Cách kiểm | Người làm |
|---|---|---|---|---|---|---|
| **T-200** | Hợp đồng dữ liệu: kiểu, chữ ký hàm của lõi thuần và của data layer | `types/weekly-report.ts`, khung `lib/weekly-report/*.ts`, `types/index.ts`, `types/tasks.ts` (thêm trường tuỳ chọn) | Anh duyệt mục 4, 5 | Kiểu khớp mục 5 | tsc | **Claude chính** |
| **T-200b** | Cài đặt lõi thuần + test: `period.ts`, `advisory-format.ts`, `outline.ts` | 3 file đó + `__tests__/weekly-report/*` | T-200 | AC-K1…K6, phần thuần của AC-T4, T8 | vitest (bảng ví dụ 2026) | **Claude Sonnet subagent** |
| **T-201** | Nền bảo mật và hạ tầng: rules, index, cài gói đã duyệt + `npm audit`, tên biến môi trường, mục điều hướng "Giao ban tuần" (chỉ admin), trang giữ chỗ, `dev-preview` | `firestore.rules`, `firestore.indexes.json`, `package.json`, `.env.local.example`, `app/(app)/layout.tsx`, `components/layout/MobileTabBar.tsx` | Anh duyệt thư viện (Q3) | AC-B1, B3, B5 | Rules Playground, tsc | **Claude chính** |
| **T-202** | Server nền: route ảnh (POST/GET), `lib/weekly-report/server.ts`, `lib/cowork/auth.ts` | `app/api/weekly-reports/images/**`, 2 file lib | T-200, T-201 | AC-B2, AC-G8 (phía server) | vitest cho auth, curl | **Claude chính** |
| **T-210** | Data layer client + hooks | `lib/weekly-report/firestore.ts`, `hooks/useWeeklyReport.ts`, `useAdvisoryDocs.ts`, `useWeeklyReportConfig.ts` | T-200 | AC-G1, G2 (logic), T5, T7 (logic) | tsc, vitest phần thuần | **Antigravity Orchestrator (Carbon)** |
| **T-211** | Mục 1: `WorkItemOutliner` | `components/weekly-report/WorkItemOutliner.tsx` | T-200b | AC-G3 | tsc, `dev-preview` | **Antigravity Orchestrator (Carbon)** |
| **T-212** | `RichEditor`, `RichViewer`, mark đỏ, dán/thả ảnh, nén ảnh client | `components/weekly-report/Rich*.tsx`, `extensions/*`, `lib/weekly-report/image-client.ts` | T-201 (gói đã cài); hợp đồng `uploadImage(file) → { url }` | AC-G4, G8 (phía client) | tsc, `dev-preview` | **Antigravity Orchestrator (Carbon)** |
| **T-214** | Bộ xuất thuần: Tiptap → Markdown, tuần/tháng → Markdown, docx, JSON | `lib/weekly-report/export/*`, test + fixture giả | T-200, T-201 | AC-M2, M3, M4 | vitest (so khớp cấu trúc; mở docx bằng `textutil` để đối chiếu) | **Antigravity Orchestrator (Carbon)** |
| **T-240** | Công việc: ô thêm nhanh, tab "Tuần này", thu gọn phần đầu, gộp điều hướng nội bộ | `app/(app)/tasks/page.tsx`, `components/tasks/TaskQuickAdd.tsx` (mới), `TaskTable.tsx`, `lib/tasks/firestore.ts` (hàm nhóm theo kỳ) | T-200b | AC-V1, V2, V6, V7 | tsc, vitest | **Antigravity Orchestrator (Carbon)** |
| **T-213** | Tham mưu: form, danh sách, dán nhiều dòng, khối trong văn bản, sổ tham mưu, trang cài đặt | `components/weekly-report/Advisory*.tsx`, `BulkPasteDialog.tsx`, `components/documents/DocumentAdvisorySection.tsx`, sửa nhỏ `DocumentTable.tsx`/`DocumentModal.tsx`/`DocumentViewer.tsx`, `app/(app)/weekly-reports/advisory/page.tsx`, `app/(app)/settings/weekly-report/page.tsx` | T-210 | AC-T1…T9 | tsc, `dev-preview`, chạy thật với tài khoản anh | **Antigravity Orchestrator (Carbon)** |
| **T-220** | Trang soạn tuần: lắp ghép, tự lưu, chốt/snapshot, gợi ý từ Công việc, liên kết sâu bcsolieu | `app/(app)/weekly-reports/page.tsx`, `[weekId]/page.tsx`, `components/weekly-report/{WeekHeader,TaskSuggestions,FinalizeBar}.tsx` | T-210, T-211, T-212 | AC-G1…G9, AC-S1, AC-V4 | tsc, `dev-preview`, chạy thật | **Antigravity Orchestrator (Carbon)** |
| **T-221** | Bản đọc + CSS in | `app/(app)/weekly-reports/[weekId]/read/page.tsx`, `components/weekly-report/ReadingView.tsx` | T-210, T-212 | AC-R1…R4 | xem render 375/1280px, in thử PDF | **Antigravity Orchestrator (Argon)** |
| **T-222** | Trang tháng + route xuất | `app/(app)/weekly-reports/monthly/[month]/page.tsx`, `components/weekly-report/MonthlySummary.tsx`, `app/api/weekly-reports/export/route.ts` | T-202, T-214 | AC-M1…M5 | tsc, curl có/không token | **Antigravity Orchestrator (Carbon)**; Claude chính rà phần xác thực của route |
| **T-223** | API Cowork `/api/cowork/v1/*` | `app/api/cowork/v1/**` | T-202, T-214 | AC-C1…C5 | vitest + curl ma trận token | **Claude chính** |
| **T-241** | Hoàn thành kèm kết quả, tự đóng việc khi tham mưu | `lib/tasks/mutations.ts` (điểm móc), `components/tasks/TaskCompleteToast.tsx` (mới), `KanbanBoard.tsx`, `TaskDetail.tsx`, `DocumentTaskSection.tsx` | T-213, T-220 | AC-V3, V5, V7 | tsc, vitest | **Antigravity Orchestrator (Carbon)** |
| **T-230** | MCP `my-office` + script tạo token + cập nhật skill Cowork | Ngoài repo: `~/Documents/Claude/KHTH/mcp-servers/my_office_server.py`, smoke test, `skills/tong-hop-cong-viec-khth/SKILL.md`; trong repo: `scripts/set-cowork-token.sh` | T-223 đã deploy | AC-C6, C7 | smoke test, chạy thật 1 tháng | **Claude Sonnet subagent** viết server theo mẫu `kcb_data_server.py`; **Claude chính** lo token và sửa skill cùng anh |
| **T-231a** | Endpoint `bao-cao-tuan` bên bcsolieu | Repo `bvtn-bcsolieu` (theo quy trình riêng của repo đó) | Anh duyệt (Q5) | AC-S2 (phía nguồn) | test golden của repo đó | **Claude chính** trong phiên của repo bcsolieu |
| **T-231b** | Route proxy + `WeeklyStatsPanel` + snapshot lúc chốt | `app/api/bcsolieu/weekly-stats/route.ts`, `components/weekly-report/WeeklyStatsPanel.tsx`, móc vào `FinalizeBar` | T-231a, T-220 | AC-S2…S4 | so từng ô với trang gốc | Route: **Claude chính**; panel: **Antigravity Orchestrator (Argon)** |
| **T-250** | Xác minh toàn tuyến, tài liệu, triển khai | `DOCS_CHUC_NANG.md`, `DOCS_DATABASE_SCHEMA.md`, `STATE.md`, `CLAUDE.md` | Tất cả | Toàn bộ AC, AC-B4 | Verifier từng gói + `npm run build` + chạy thật | Verifier: **Claude Sonnet subagent** (AC cần suy luận), **Claude Haiku subagent** (AC cơ học: grep import cấm, secret, đường dẫn); triển khai: **Claude chính** + anh |

### 13.2. Đợt chạy

| Đợt | Gói | Ghi chú song song |
|---|---|---|
| **W0** (tuần tự, ngắn) | T-200 → T-200b ∥ T-201 | Sau W0 có đủ hợp đồng, gói đã cài, rules |
| **W1** (song song) | T-202 (Claude) ∥ T-210 ∥ T-211 ∥ T-212 ∥ T-214 ∥ T-240 | 5 gói Antigravity không đụng file nhau. Hai cách giao: **Swarm** nếu hạn mức Gemini tuần ≥ 40% (đủ điều kiện: ≥ 3 gói khác nhau, độc lập, đã có hợp đồng T-200); nếu không thì 5 hội thoại **Orchestrator (Carbon)** song song kèm "luật song song" như đã làm ở bvtn T-128 |
| **W2** (song song) | T-213 ∥ T-220 ∥ T-221 ∥ T-222 ∥ T-223 (Claude) | T-213 và T-220 cùng dùng `AdvisoryList`: T-213 sở hữu file, T-220 chỉ import |
| **W3** | T-241 ∥ T-230 ∥ T-231a → T-231b | T-230 cần T-223 đã lên production |
| **W4** | T-250 | Không chạy dev/build khi Antigravity còn đang sửa |

### 13.3. Mốc bàn giao
- **M1 — Bỏ Google Doc**: W0 + W1 + T-213, T-220, T-221. Dùng thật được cho buổi giao ban.
- **M2 — Tháng + Cowork**: T-222, T-223, T-230.
- **M3 — Số liệu + Công việc**: T-231a/b, T-241 (T-240 đã xong ở W1).

### 13.4. Việc triển khai (anh duyệt từng bước)
1. Triển khai `firestore.rules` mới.
2. Đặt biến trên Vercel: `COWORK_API_TOKEN` (và `_NEXT` khi xoay vòng); giai đoạn 2 thêm `BCSOLIEU_BASE_URL`, `BCSOLIEU_API_TOKEN`; tuỳ chọn `WEEKLY_REPORT_DRIVE_FOLDER_ID`.
3. Deploy my-office.
4. Khai báo MCP `my-office` trong `claude_desktop_config.json`, chạy smoke test.
5. Chạy song song 2 tuần với Google Doc rồi mới bỏ hẳn.

### 13.5. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Mất nội dung khi tự lưu lỗi hoặc ghi đè giữa 2 thiết bị | Lưu theo từng trường; snapshot khi chốt và khi mở lại; cảnh báo khi rời trang; 2 tuần chạy song song |
| Ảnh không hiện giữa buổi họp | Ảnh qua route của app có cache CDN; bản đọc tải trước ảnh khi mở; in PDF dự phòng |
| Token Drive của server hết hạn/thu hồi | Route ảnh trả lỗi rõ; banner Drive hiện có đã báo trạng thái token |
| Sửa `DocumentTable.tsx` (2.576 dòng) gây lỗi phụ | Chỉ thêm 1 prop và 1 nút, theo đúng mẫu `onCreateTask`; verifier rà diff |
| Antigravity tự ghi dữ liệu thật khi test | `_RULES.md` cấm; test chỉ hàm thuần; verifier độc lập |
| Lệch quy tắc tháng so với thói quen | Quy tắc là cấu hình + ghi đè từng tuần + trang tháng hiển thị rõ |

---

## 14. Câu hỏi mở cần anh quyết

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| Q1 | Tuần giáp ranh thuộc tháng nào: (a) tháng chứa đa số ngày, (b) tháng của ngày giao ban, (c) tháng của ngày đầu kỳ? | **(a)**. Khớp 5/6 tiền lệ; riêng tuần 04/9 trước đây anh tính tháng 9, theo (a) sẽ là tháng 8. Vẫn ghi đè từng tuần được |
| Q2 | Ảnh dán vào giao ban lưu Google Drive và theo D-04 (ai có ID ngẫu nhiên của file thì xem được), hay cần riêng tư hơn? | **Drive + D-04**. Nếu cần riêng tư: ảnh tải qua route có xác thực, phức tạp hơn và thêm khoảng 1 ngày công |
| Q3 | Duyệt thêm 5 gói npm: 4 gói Tiptap và `docx`? | **Duyệt**. Nếu không duyệt `docx`: docx do MCP dựng bằng `python-docx`, trong app chỉ còn `.md` và in PDF |
| Q4 | Cowork được đọc những mục nào? | Mặc định chỉ Mục 1 + văn bản tham mưu. "Ý kiến", "Tuần tới" bật khi anh cần. **"Ý kiến PGĐ" để tắt** |
| Q5 | Cho phép thêm endpoint chỉ-đọc `bao-cao-tuan` vào bcsolieu (repo khác, có quy trình ADR riêng)? | **Có, ở mốc M3.** Trước đó dùng liên kết sâu, không sửa gì bên bcsolieu |
| Q6 | Gộp Kanban / Lịch / Định kỳ vào trong trang Công việc để sidebar còn 6 mục? | **Có** |
| Q7 | Bắt đầu dùng từ tuần nào, có nhập lại các tuần đã qua không? | Bắt đầu từ tuần giao ban kế tiếp sau khi M1 xong; các tuần của tháng đang dở nhập bằng "Dán nhiều dòng" (khoảng 5 phút/tuần) để "TH" tháng đó ra từ app. Các tháng cũ không nhập |
| Q8 | Chỉ mình anh dùng, hay nhân viên phòng KHNV cùng nhập? | **Chỉ anh** ở giai đoạn này (rule theo email admin). Mở cho nhân viên phải đợi S2 |

---

## 15. Quyết định đã chốt (anh Khôi, 18/11/2026) — THẮNG các mục trên nếu mâu thuẫn

| # | Quyết định |
|---|---|
| Q1 | Gán tháng theo **(a) đa số ngày**, ghi đè tay từng tuần. **Bổ sung — tuần đặc biệt (nghỉ lễ/Tết):** giao ban có thể họp sớm (ngày trước kỳ nghỉ). Khi đó kỳ của tuần = **ngày sau kỳ trước kết thúc → ngày báo cáo** (chỉnh tay `periodStart`/`periodEnd`/`actualMeetingDate`, cờ `periodOverridden`). Tuần kế tiếp tự nối: `periodStart = periodEnd tuần trước + 1` (có thể dài hơn 7 ngày). `weekIdForDate` ưu tiên tuần có kỳ chỉnh tay chứa ngày đó. Gán tháng dùng kỳ thực tế (đa số ngày; hoà → tháng của `periodEnd`). Cowork phải đọc được quy ước này: `/catalog` trả `periodRules` (mô tả chữ) và mỗi tuần trả `periodStart`, `periodEnd`, `periodOverridden`, `actualMeetingDate`, `periodNote`. |
| Q2 | Ảnh lưu Google Drive theo D-04. |
| Q3 | Duyệt `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `docx`. |
| Q4 | Cowork **chỉ** đọc việc đã làm (Mục 1) và văn bản tham mưu — thể hiện công việc đã hoàn thành. Không mở Ý kiến / Tuần tới / Đề xuất lịch / Ý kiến PGĐ qua API Cowork (bỏ tham số `sections`). |
| Q5 | Đồng ý endpoint bcsolieu, **nhưng không được làm tăng lượt gọi Vercel** (gói free sắp cạn): không tự gọi khi mở trang; chỉ gọi khi anh bấm "Lấy số liệu" hoặc khi Chốt; kết quả lưu `statsSnapshotJson` và luôn đọc từ snapshot; không poll, không prefetch. |
| Q6 | Đồng ý gộp, thiết kế lại module Công việc cho đỡ rối. |
| Q7 | Bắt đầu từ tuần giao ban **06/11/2026** (kỳ 30/10–05/11), nhập dữ liệu từ Google Doc các tuần 06/11, 13/11 (và 20/11 nếu đã có) để đủ tháng 11. |
| Q8 | Chỉ anh Khôi dùng (rule theo email admin). |
