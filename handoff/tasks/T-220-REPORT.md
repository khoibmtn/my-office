# Báo cáo thực hiện T-220 — Trang soạn Giao ban tuần + Mục 1 outliner + Rich editor + Bản đọc giao ban

**Trạng thái:** chờ verify

## 1. Danh sách file đã tạo / sửa (chỉ trong phạm vi T-220)
- `components/weekly-report/extensions/red-mark.ts` — Mark Tiptap `red` (`data-red-mark="true"`, class `text-red-700 font-bold`, phím tắt `Mod-Shift-h`).
- `components/weekly-report/extensions/paste-image.ts` — Plugin ProseMirror `handlePaste` / `handleDrop` + `uploadFilesIntoEditor`, kiểm tra MIME (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) và dung lượng trước khi tải, hiển thị placeholder `Decoration.widget` `"Đang tải ảnh lên…"` không ghi `data:` base64 vào document, gọi `uploadWeeklyReportImage(file, { weekId, section })`.
- `components/weekly-report/RichEditor.tsx` — Trình soạn thảo Tiptap v3 (`immediatelyRender: false`, `StarterKit`, `Image.configure({ allowBase64: false })`, `RedMark`, `PasteImage`), thanh công cụ Đậm / Nghiêng / Đỏ / Danh sách gạch đầu dòng / Danh sách số / Chèn ảnh.
- `components/weekly-report/RichViewer.tsx` — Trình xem chỉ-đọc Tiptap (`editable: false`, `immediatelyRender: false`, không dùng `dangerouslySetInnerHTML`) và helper `isRichSectionEmpty`.
- `components/weekly-report/WorkItemOutliner.tsx` — Outliner 2 cấp dùng `outlineReducer` với đủ phím tắt (`Enter`, `Backspace` dòng trống, `Tab`/`Shift+Tab`, `Alt+↑/↓`, `Ctrl/⌘+Shift+H`) và nút bấm hiện rõ trên cả mobile & desktop (Ghim, Đỏ, Lùi cấp/Ra cấp, Lên, Xuống, Xoá).
- `components/weekly-report/WeekHeader.tsx` — Điều hướng tuần trước/sau, thông tin `Giao ban dd/MM/yyyy · kỳ dd/MM–dd/MM · thuộc tháng MM/yyyy`, chỉ báo trạng thái lưu (`Đang lưu…` / `Đã lưu hh:mm` / `Lỗi lưu, thử lại`), nút `Bản đọc giao ban`, `Tổng hợp tháng`, menu `⋯` (`Chỉnh kỳ / tuần đặc biệt`, `Về tuần hiện tại`, `Sổ văn bản tham mưu`, `Cài đặt giao ban`).
- `components/weekly-report/PeriodEditDialog.tsx` — Chỉnh `actualMeetingDate`, `periodStart`, `periodEnd`, `periodNote`, `reportMonth` (tự động đa số ngày hoặc ghi đè), nút gợi ý `"Họp sớm trước kỳ nghỉ"`, cảnh báo chồng/hở kỳ so với tuần lân cận.
- `components/weekly-report/TaskSuggestions.tsx` — Lọc công việc đã hoàn thành trong `[periodStart, periodEnd]` chưa xuất hiện trong `workItems`, nút `"Đưa vào"` tạo `WorkItem` với `source: 'task', taskId`, hỗ trợ `tasksOverride` cho `dev-preview`.
- `components/weekly-report/WeeklyStatsPanel.tsx` — Đọc và hiển thị `statsSnapshotJson` (không tự gọi mạng khi mở trang), nút `"Lấy số liệu"` gọi `authedFetch('/api/bcsolieu/weekly-stats?weekId=…')` rồi `saveStatsSnapshot`, xử lý `{ ok: false, message }` gọn, luôn có link `"Mở Báo cáo tuần bcsolieu"` kèm `t2_tu` & `t2_den`.
- `components/weekly-report/FinalizeBar.tsx` — Nút `"Chốt tuần"` (`finalizeWeek`) / `"Mở lại"` (`reopenWeek`) kèm hộp thoại xác nhận `ResponsiveModal`.
- `components/weekly-report/ReadingView.tsx` — Bản đọc toàn màn hình đúng thứ tự (`actualMeetingDate || meetingDate` đỏ đậm → tiêu đề căn giữa đậm → `1. KHTH` → `Tình hình thực hiện nhiệm vụ tuần qua:` → dòng việc → `Tham mưu VB: …` + danh sách → `2. Ý kiến` → `3. Tuần tới` → mục tuỳ chọn → bật/tắt bảng số liệu), chữ `19–20px` Times New Roman, phím `Esc` thoát, `@media print` khổ A4 `14pt` ẩn sidebar/nút.
- `app/(app)/weekly-reports/page.tsx` — Chỉ admin; chuyển hướng tới `currentWeekId(todayVN(), weeks)`.
- `app/(app)/weekly-reports/[weekId]/page.tsx` — Chỉ admin; kiểm tra định dạng `weekId`; lắp ghép toàn bộ workspace, đặt `<AdvisoryList weekId={weekId} editable={editable} />` của T-213 ngay dưới dòng Mục 1, toast mang việc thường xuyên + `"Hoàn tác"`, tự lưu debounce 1,5s cho `workItems` và `RichSectionKey`, cảnh báo `beforeunload`, bật/xoá 2 mục tuỳ chọn có xác nhận.
- `app/(app)/weekly-reports/[weekId]/read/page.tsx` — Chỉ admin; kiểm tra định dạng `weekId`; nạp dữ liệu và hiển thị `<ReadingView />`.
- `app/(app)/weekly-reports/dev-preview/page.tsx` — Trả `notFound()` khi `process.env.NODE_ENV === 'production'`; chạy hoàn toàn bằng dữ liệu giả không cần đăng nhập và không gọi Firestore (mock `uploadImageFn` và `onFetchStats`).

## 2. Tự kiểm từng tiêu chí nghiệm thu (AC)

1. **AC1 (`npx tsc --noEmit` sạch ở file gói):** **PASS**
   - Bằng chứng: `./node_modules/.bin/tsc --noEmit` trả exit code `0`, không còn lỗi TypeScript nào trong toàn dự án (kể cả `app/(app)/weekly-reports/[weekId]/page.tsx` nhập `AdvisoryList` từ `components/weekly-report/AdvisoryList.tsx` của T-213 với props `{ weekId: string; editable: boolean }` khớp tại `components/weekly-report/AdvisoryList.tsx:31-34`).

2. **AC2 (outliner đủ phím + nút):** **PASS**
   - Bằng chứng: `components/weekly-report/WorkItemOutliner.tsx:79-131` xử lý đủ `Enter` (thêm dòng), `Backspace` khi dòng trống (xoá dòng và chuyển focus), `Tab`/`Shift+Tab` (lùi/ra cấp), `Alt+ArrowUp`/`Alt+ArrowDown` (đổi thứ tự), `Ctrl/⌘+Shift+H` (tô đỏ); `components/weekly-report/WorkItemOutliner.tsx:212-360` render dãy nút Ghim / Đỏ / Lùi cấp (Ra cấp) / Lên / Xuống / Xoá luôn hiển thị (không giấu sau hover).

3. **AC3 (tự lưu + trạng thái lưu + cảnh báo beforeunload):** **PASS**
   - Bằng chứng: `app/(app)/weekly-reports/[weekId]/page.tsx:50,185-289` debounce `DEBOUNCE_MS = 1500` cho `updateWorkItems` và `updateSection`, cập nhật `saveStatus` (`'saving' | 'saved' | 'error'`) hiển thị tại `components/weekly-report/WeekHeader.tsx:100-130` (`Đang lưu…`, `Đã lưu hh:mm`, `Lỗi lưu, thử lại`); `app/(app)/weekly-reports/[weekId]/page.tsx:174-183` gắn listener `beforeunload` khi còn thay đổi chưa lưu hoặc đang lỗi lưu.

4. **AC4 (dán/thả ảnh → gọi upload, placeholder, ảnh hiện, không base64):** **PASS**
   - Bằng chứng: `components/weekly-report/extensions/paste-image.ts:62-125,163-197` kiểm loại/dung lượng (`validateImageFile`), chèn placeholder `Decoration.widget`, gọi `uploadWeeklyReportImage(file, { weekId, section })` từ `@/lib/weekly-report/image-client`, chèn node `image` `{ src: result.url }` khi xong hoặc báo lỗi khi thất bại; `components/weekly-report/RichEditor.tsx:91-97` và `components/weekly-report/RichViewer.tsx:52-58` cấu hình `Image.configure({ allowBase64: false })`.

5. **AC5 (bản đọc đúng thứ tự, Esc thoát, in A4 sạch, mục rỗng không hiện):** **PASS**
   - Bằng chứng: `components/weekly-report/ReadingView.tsx:41-51` bắt phím `Escape` thoát; `components/weekly-report/ReadingView.tsx:106-162` cấu hình `@media print` A4 `14pt`, Times New Roman, ẩn sidebar/header/mobile nav/nút điều khiển, giữ `.weekly-read-red`; `components/weekly-report/ReadingView.tsx:203-355` xuất đúng thứ tự mục và bỏ qua mục rỗng (`isRichSectionEmpty` kiểm tra cả text và node ảnh tại `components/weekly-report/RichViewer.tsx:17-29`).

6. **AC6 (`PeriodEditDialog` cho tuần đặc biệt + cảnh báo chồng/hở kỳ):** **PASS**
   - Bằng chứng: `components/weekly-report/PeriodEditDialog.tsx:86-138` tính cảnh báo chồng/hở kỳ so với tuần trước & tuần sau và có nút gợi ý `"Họp sớm trước kỳ nghỉ"` đặt `actualMeetingDate`, `periodEnd = chosen`, `periodOverridden = true`; `components/weekly-report/PeriodEditDialog.tsx:298-337` cho chọn `reportMonth` tự động theo đa số ngày hoặc ghi đè thủ công, lưu qua `updateWeekMeta`.

7. **AC7 (stats không tự gọi mạng khi mở trang):** **PASS**
   - Bằng chứng: `components/weekly-report/WeeklyStatsPanel.tsx:108-151` chỉ gọi `authedFetch('/api/bcsolieu/weekly-stats?weekId=…')` bên trong `handleFetch` khi bấm nút `"Lấy số liệu"` (không có `useEffect` gọi mạng); link `"Mở Báo cáo tuần bcsolieu"` kèm `t2_tu` & `t2_den` tại `components/weekly-report/WeeklyStatsPanel.tsx:96,177-185`.

8. **AC8 (`dev-preview` chạy không cần đăng nhập và trả 404 ở production):** **PASS**
   - Bằng chứng: `app/(app)/weekly-reports/dev-preview/page.tsx:218-221` gọi `notFound()` khi `process.env.NODE_ENV === 'production'`; toàn bộ dữ liệu dùng state giả (`INITIAL_MOCK_REPORT`, `MOCK_ADVISORY`, `MOCK_COMPLETED_TASKS`), mock `uploadImageFn` (`dev-preview/page.tsx:236-240`) và `onFetchStats` (`dev-preview/page.tsx:287-290`), không gọi hook Firestore hay `useRole`.

9. **AC9 (chuẩn UI: ≥16px, ≥44px mobile, đỏ + đậm):** **PASS**
   - Bằng chứng: Nội dung dùng `text-base` (`16px`) ở trang soạn và `text-[19px] sm:text-[20px]` ở `ReadingView.tsx:203`; nút bấm trên mobile dùng `min-h-[44px] min-w-[44px]` hoặc `min-h-[44px]` (`WorkItemOutliner.tsx:218-360`, `RichEditor.tsx:157-244`, `WeekHeader.tsx:66-199`, `TaskSuggestions.tsx:101`, `WeeklyStatsPanel.tsx:164-180`, `FinalizeBar.tsx:107-120`, `ReadingView.tsx:171-200`); dòng/chữ tô đỏ luôn dùng đồng thời màu đỏ và in đậm (`text-red-700 font-bold` tại `red-mark.ts:39`, `WorkItemOutliner.tsx:177,315`, `ReadingView.tsx:205,237,251,277`).

## 3. Kết quả lệnh kiểm tra
- `./node_modules/.bin/tsc --noEmit`: exit code `0` (0 lỗi TypeScript).
- `node --use-bundled-ca ./node_modules/.bin/vitest run --pool=threads`:
  ```
  Test Files  16 passed (16)
       Tests  250 passed (250)
  ```
  *(Ghi chú: chạy `npx vitest run` trực tiếp trong sandbox gặp `ERROR: SecItemCopyMatching failed -50` ở Node fork pool macOS; dùng `node --use-bundled-ca` + `--pool=threads` chạy sạch 16/16 file test, 250/250 tests).*

## 4. Điểm cần Claude lưu ý khi verify
- Chưa chạy trình duyệt kiểm thử visual thực tế cho `/weekly-reports/dev-preview` và in PDF ở `/weekly-reports/[weekId]/read` (theo `_RULES.md` không chạy `npm run dev` / `npm run build`).
- Trong `dev-preview`, `mockUploadImage` tạo blob URL bằng `URL.createObjectURL(file)` để hiển thị ảnh ngay khi test dán/thả ảnh mà không sinh chuỗi `data:`.
- `app/(app)/weekly-reports/[weekId]/page.tsx` nhập trực tiếp `<AdvisoryList weekId={weekId} editable={editable} />` từ `components/weekly-report/AdvisoryList.tsx` (gói T-213); khớp props và compile sạch với `tsc --noEmit`.
