# Báo cáo thực hiện T-213 — Văn bản tham mưu

**Trạng thái:** chờ verify

## 1. Danh sách file đã tạo / sửa (đúng phạm vi brief)

### Tạo mới
- `components/weekly-report/AdvisoryForm.tsx`
- `components/weekly-report/AdvisoryButton.tsx`
- `components/weekly-report/AdvisoryList.tsx`
- `components/weekly-report/BulkPasteDialog.tsx`
- `components/documents/DocumentAdvisorySection.tsx`
- `app/(app)/weekly-reports/advisory/page.tsx`
- `app/(app)/settings/weekly-report/page.tsx`

### Chỉnh sửa
- `components/documents/DocumentTable.tsx` (chỉ thêm prop `onAdvise?`, check `isAdmin`, 1 nút ở card mobile và 1 nút ở bảng desktop — `+24/-4` dòng)
- `components/documents/DocumentModal.tsx` (chèn `<DocumentAdvisorySection>` cho admin + bảo vệ phím `Esc` và click backdrop khi mở modal tham mưu lồng bên trong)
- `components/documents/DocumentViewer.tsx` (chèn `<DocumentAdvisorySection>`)
- `app/(app)/documents/page.tsx` (nối `onAdvise` mở `<AdvisoryForm>` cho admin)
- `app/(app)/settings/page.tsx` (chuyển thành trang danh mục cài đặt, thêm link `/settings/weekly-report` chỉ hiện với admin)

---

## 2. Tự kiểm từng tiêu chí nghiệm thu

1. **AC1 — `tsc` sạch ở file gói (và toàn repo):** **PASS**
   - Đã chạy `NODE_OPTIONS="--use-bundled-ca" ./node_modules/.bin/tsc --noEmit` sau lần sửa cuối cùng → exit code `0`, 0 lỗi.
   - Đã chạy `NODE_OPTIONS="--use-bundled-ca" ./node_modules/.bin/vitest run` → `16 passed (16)`, `250 passed (250)`.

2. **AC2 — Nút Tham mưu có trên bảng văn bản, modal và trang chi tiết (chỉ admin):** **PASS**
   - Bảng văn bản: `components/documents/DocumentTable.tsx:474-482` (mobile card), `components/documents/DocumentTable.tsx:2146-2154` (desktop row, kiểm `isAdmin && onAdvise`), `components/documents/DocumentTable.tsx:2238`, nối ở `app/(app)/documents/page.tsx:13,39-47`.
   - Modal văn bản: `components/documents/DocumentModal.tsx:83,519-531` chèn `<DocumentAdvisorySection>` khi `isAdmin`.
   - Trang chi tiết văn bản: `components/documents/DocumentViewer.tsx:119-126` chèn `<DocumentAdvisorySection>`.
   - Quyền admin: `components/documents/DocumentAdvisorySection.tsx:20-24` và `components/weekly-report/AdvisoryButton.tsx:27-30` kiểm `useRole()` (`loading || !isAdmin` → `return null`).

3. **AC3 — Lưu → vào đúng tuần theo ngày, liên kết ngược hiện trong văn bản gốc (AC-T1, AC-T2, AC-T3, AC-T5, AC-T6, AC-T7):** **PASS (theo code & kiểm tra kiểu; chưa chạy ghi thật lên Firestore theo quy định `_RULES.md`)**
   - Gợi ý tên theo loại (`TB`, `KH`, `CV`...) & cảnh báo trùng loại không chặn: `components/weekly-report/AdvisoryForm.tsx:57-67,225-230,470-488`.
   - Ngày tham mưu mặc định `todayVN()`, tính `weekIdForDate(advisedDate, weeks)`, hiển thị `→ tuần giao ban dd/MM/yyyy`, cho phép chọn tuần khác để ghi đè: `components/weekly-report/AdvisoryForm.tsx:155-163,232-259,595-628`.
   - Tuỳ chọn `☑ Đánh dấu văn bản gốc đã xử lý xong` (mặc định bật khi tạo mới có gốc): `components/weekly-report/AdvisoryForm.tsx:167-169,354,725-734`.
   - Gắn / thay đổi văn bản gốc bằng `DocumentPickerPanel`: `components/weekly-report/AdvisoryForm.tsx:76-94,630-690`.
   - Sửa + xoá có hộp xác nhận nêu rõ tên văn bản: `components/weekly-report/AdvisoryForm.tsx:365-378,437-466`.
   - Khối liên kết ngược trong văn bản gốc có link tới tuần `/weekly-reports/[weekId]` + nút Sửa: `components/documents/DocumentAdvisorySection.tsx:55-145`.
   - Dòng trong tuần có link `↩ số ký hiệu` tới `/documents/[id]`: `components/weekly-report/AdvisoryList.tsx:214-224`.

4. **AC4 — Dòng tự đếm đúng (AC-T4):** **PASS**
   - `components/weekly-report/AdvisoryList.tsx:76-81,150-154`: gọi `sortAdvisory(docs)` và `formatAdvisorySummary(sortedDocs, config.docTypes)` (tô vàng nhạt phần `N văn bản` qua `<mark className="bg-yellow-200/80 ...">`), không giữ bộ đếm tay.
   - Đổi thứ tự trong cùng ngày tham mưu (lên/xuống), bật/tắt tô đỏ, sửa/xoá: `components/weekly-report/AdvisoryList.tsx:96-140,236-288`.

5. **AC5 — Dán nhiều dòng nhận đúng tiền tố, xem trước sửa được (AC-T8):** **PASS**
   - `components/weekly-report/BulkPasteDialog.tsx:68-159,238-373`: gọi `parseBulkAdvisoryLines(text, sortedDocTypes)`, hiển thị bảng xem trước cho phép sửa loại (`<select>`), sửa tên (`<input>`), bật tô đỏ, xoá dòng, chọn ngày tham mưu chung (mặc định `period.periodEnd`), tạo hàng loạt vào đúng `weekId` đang mở.

6. **AC6 — Sổ tham mưu lọc/đếm:** **PASS**
   - `app/(app)/weekly-reports/advisory/page.tsx:79-108` kiểm `useRole()` (`isAdmin`).
   - Lọc theo tháng / khoảng ngày qua `listAdvisoryByDateRange(from, to)`, lọc theo loại và tìm kiếm chữ phía client (`title`, `docNumber`, `note`, `sourceSnapshot`), hiển thị bảng đếm theo loại (`countByType` + `formatAdvisorySummary`), link tuần + văn bản gốc, sửa/xoá trực tiếp qua `AdvisoryForm`: `app/(app)/weekly-reports/advisory/page.tsx:148-226,287-420,530-690`.

7. **AC7 — Trang cài đặt lưu được (AC-T9):** **PASS**
   - `app/(app)/settings/weekly-report/page.tsx:29-58` kiểm `useRole()` (`isAdmin`).
   - Chỉnh `reportTitle`, `unitHeading`, `deputySectionLabel`, thêm/sửa/xoá/đổi thứ tự `docTypes` và gọi `saveConfig(...)`, khôi phục mặc định `DEFAULT_DOC_TYPES`, cảnh báo rời trang khi chưa lưu, không đọc/hiển thị bất kỳ token/bí mật nào: `app/(app)/settings/weekly-report/page.tsx:66-240,295-455`.
   - Link danh mục cài đặt: `app/(app)/settings/page.tsx:55-62,103`.

8. **AC8 — Sửa `DocumentTable.tsx` tối thiểu (diff nhỏ):** **PASS**
   - `git diff --stat components/documents/DocumentTable.tsx`: `1 file changed, 24 insertions(+), 4 deletions(-)` (chỉ thêm `FilePlus2` import, prop `onAdvise?`, lấy `isAdmin`, 1 nút ở `DocumentCard` và 1 nút ở dòng bảng desktop).

9. **AC9 — Chuẩn UI:** **PASS**
   - `ResponsiveModal` cho form tham mưu & dán nhiều dòng (dialog trên desktop, sheet trên mobile).
   - Chữ nội dung `text-base` (≥ 16px), vùng bấm `min-h-[44px]` trên điện thoại, ngày định dạng `dd/MM/yyyy` (`formatDMY`), tô đỏ luôn kèm in đậm (`text-red-700 font-bold`), không có hành động giấu sau `group-hover:opacity`, số đếm dùng `tabular-nums`, trạng thái rỗng nêu rõ lý do và hành động gợi ý.

---

## 3. Kết quả lệnh kiểm tra (chạy sau lần sửa cuối)

### `NODE_OPTIONS="--use-bundled-ca" ./node_modules/.bin/tsc --noEmit`
- Kết quả: Exit code `0` (0 lỗi TypeScript trên toàn bộ repo).

### `NODE_OPTIONS="--use-bundled-ca" ./node_modules/.bin/vitest run`
```text
 RUN  v4.1.9 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office

 Test Files  16 passed (16)
      Tests  250 passed (250)
   Start at  00:17:17
   Duration  1.12s (transform 947ms, setup 0ms, import 2.36s, tests 208ms, environment 4ms)
```

### Quét bảo mật / anti-pattern trên các file của T-213
- Lệnh `grep -n "firebase-admin\|dangerouslySetInnerHTML\|group-hover:opacity\|TOKEN\|SECRET\|API_KEY" ...` → `CLEAN` (không có kết quả vi phạm).

---

## 4. Điểm lưu ý / cần Claude Code xác minh thêm
1. **Sidebar tab của Cài đặt (`app/(app)/settings/layout.tsx`):** File này nằm ngoài phạm vi "Được sửa" của T-213 nên không chỉnh sửa. Hiện link `/settings/weekly-report` đã có trên trang danh mục `/settings` (`app/(app)/settings/page.tsx`), trang Sổ tham mưu, và truy cập trực tiếp qua URL; nếu muốn hiện thêm tab "Giao ban tuần" trên thanh trái cố định của `SettingsLayout`, Claude chính có thể bổ sung 1 dòng vào `SETTINGS_TABS` trong `app/(app)/settings/layout.tsx`.
2. **Kiểm tra chạy thật trên trình duyệt (E2E với tài khoản admin & non-admin):** Theo `_RULES.md`, gói này không chạy `npm run dev` / `npm run build` và không ghi dữ liệu lên Firestore production. Cần verify trực tiếp luồng tạo/sửa/xoá `advisoryDocs`, `markSourceCompleted`, `saveConfig`, và hiển thị trên mobile 375px / desktop 1280px khi ghép đủ các gói.
