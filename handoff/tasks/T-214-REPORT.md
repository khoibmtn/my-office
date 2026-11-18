# Báo cáo thực hiện T-214 — Bộ xuất (Markdown/DOCX/JSON Cowork) + trang Tổng hợp tháng

**Trạng thái:** chờ verify

## 1. Danh sách file đã tạo / sửa (trong phạm vi T-214)
- `lib/weekly-report/export/tiptap-markdown.ts` (tạo mới: `tiptapToMarkdown`, `tiptapToPlainText`, `parseTiptapDoc`, `isRedMark` — hỗ trợ paragraph, heading, bulletList/orderedList lồng nhau, bold, italic, strike, link, code, blockquote, codeBlock, horizontalRule, mark đỏ → `**text**`, image → `![ảnh](url)`)
- `lib/weekly-report/export/markdown.ts` (tạo mới: `weekToMarkdown`, `monthToMarkdown` theo đúng định dạng `tom-tat`, tôn trọng `actualMeetingDate` và `includeRichSections`)
- `lib/weekly-report/export/docx.ts` (tạo mới: `buildWeekDocx`, `buildMonthDocx` dùng thư viện `docx` v9 phía server với font Times New Roman 14pt (`size: 28`), dòng/từ highlight màu đỏ `C00000` + in đậm, numbering cho bullet/ordered list)
- `lib/weekly-report/export/cowork.ts` (tạo mới: `toCoworkWeek`, `toCoworkMonth`, các kiểu `CoworkWeek`, `CoworkMonth`, `CoworkWarning` — chỉ trả Mục 1 + văn bản tham mưu, tuyệt đối không trả `sections` hay `statsSnapshotJson`)
- `lib/weekly-report/export/index.ts` (tạo mới: re-export cho phía server, kèm ghi chú client không được import barrel)
- `app/(app)/weekly-reports/monthly/page.tsx` (tạo mới: chuyển hướng admin tới `/weekly-reports/monthly/YYYY-MM` hiện tại theo `todayVN()`, chặn user không phải admin)
- `app/(app)/weekly-reports/monthly/[month]/page.tsx` (tạo mới: kiểm tra quyền admin via `useRole()`, kiểm tra định dạng `YYYY-MM`, render `<MonthlySummary />`)
- `components/weekly-report/MonthlySummary.tsx` (tạo mới: trang Tổng hợp tháng dùng `useWeeks`, `useWeeklyReportConfig`, `listAdvisoryByWeekIds`, `weeksOfMonth`, `isBoundaryWeek`, `countByType`, `formatAdvisorySummary`, `formatAdvisoryLine`, `sortAdvisory`, `monthToMarkdown`, `authedFetch`)
- `__tests__/weekly-report/fixtures/sample-data.ts` (tạo mới: bộ fixture dữ liệu giả hoàn toàn, không chứa dữ liệu thật)
- `__tests__/weekly-report/export.test.ts` (tạo mới: test `tiptapToMarkdown`, `tiptapToPlainText`, `weekToMarkdown`, `monthToMarkdown`, `toCoworkWeek`, `toCoworkMonth`, `buildWeekDocx`, `buildMonthDocx`, và kiểm tĩnh import client không chứa `docx`)

## 2. Tự kiểm từng tiêu chí nghiệm thu (AC)

1. **AC1 — `npx tsc --noEmit` không lỗi ở file của gói:** **PASS**
   - Bằng chứng: chạy `NODE_OPTIONS="--use-bundled-ca" npx tsc --noEmit` thoát với exit code `0`, không có bất kỳ lỗi TypeScript nào trong toàn bộ dự án (bao gồm toàn bộ file gói T-214).

2. **AC2 — `npx vitest run __tests__/weekly-report/export` pass:** **PASS**
   - Bằng chứng: `NODE_OPTIONS="--use-bundled-ca" npx vitest run __tests__/weekly-report/export.test.ts` chạy 1 file test, `10 passed (10)`. Chạy gộp toàn bộ `__tests__/weekly-report` dưới `TZ=UTC` cũng đạt `4 passed (4)`, `51 passed (51)`.
   - Chi tiết phủ test tại `__tests__/weekly-report/export.test.ts:61-386`:
     - `tiptapToMarkdown` & `tiptapToPlainText` (`:61-125`)
     - `weekToMarkdown` & `monthToMarkdown` khớp bố cục `tom-tat` và tự kiểm tổng đếm văn bản tham mưu bằng đúng số dòng (`:127-208`)
     - `buildWeekDocx` & `buildMonthDocx` trả `Buffer` bắt đầu bằng `'PK'`, giải nén `word/document.xml` kiểm tra Times New Roman, `w:val="28"` (14pt), màu đỏ `C00000` (`:333-367`).

3. **AC3 — `toCowork*` không lộ `sections`:** **PASS**
   - Bằng chứng:
     - Triển khai dựng object tường minh từng trường tại `lib/weekly-report/export/cowork.ts:216-236` (`toCoworkWeek`) và `lib/weekly-report/export/cowork.ts:283-290` (`toCoworkMonth`); không sử dụng spread từ `WeeklyReport`, không bao gồm `sections` (`opinions`, `nextWeek`, `proposedSchedule`, `deputyOpinions`) hay `statsSnapshotJson`.
     - Đầy đủ thông tin Mục 1 (`workItems` gồm `children`, `highlight` ở `:194-210`), văn bản tham mưu (`type`, `typeLabel`, `prefix`, `title`, `docNumber`, `advisedDate`, `weekId`, `sourceSnapshot`, `highlight` ở `:111-134`), thông tin kỳ (`periodStart`, `periodEnd`, `periodOverridden`, `actualMeetingDate`, `periodNote`, `reportMonth`, `reportMonthOverridden`, `status` ở `:217-229`), `countsByType`, `total`, và toàn bộ 6 mã cảnh báo (`WEEK_MISSING`, `WEEK_NOT_FINALIZED`, `BOUNDARY_WEEK`, `MONTH_OVERRIDDEN`, `PERIOD_OVERRIDDEN`, `MONTH_INCOMPLETE` ở `:158-192` và `:270-276`).
     - Test xác minh `'sections' in cwWeek === false`, `'statsSnapshotJson' in cwWeek === false` và kiểm chuỗi JSON không chứa bất kỳ khóa hay nội dung `sections` nào tại `__tests__/weekly-report/export.test.ts:210-255`, kiểm đủ 6 mã cảnh báo tại `:257-330`.

4. **AC4 — Trang tháng hiển thị đúng các trạng thái, chữ ≥16px, nút ≥44px trên mobile:** **PASS**
   - Bằng chứng:
     - Phân quyền chỉ admin & kiểm định dạng `YYYY-MM`: `app/(app)/weekly-reports/monthly/page.tsx:12-51`, `app/(app)/weekly-reports/monthly/[month]/page.tsx:13-73`.
     - Hiển thị đầy đủ danh sách tuần theo `weeksOfMonth` (`components/weekly-report/MonthlySummary.tsx:157-160`, `:467-559`) kèm các badge trạng thái `"Chưa có dữ liệu"`, `"Đã chốt"`, `"Chưa chốt"`, `"Tuần giáp ranh"`, `"Kỳ đặc biệt"` (kèm `periodNote` và lịch gốc nếu có `actualMeetingDate`), `"Gán tháng thủ công"` (`:504-542`).
     - Cảnh báo `MONTH_INCOMPLETE` khi kỳ cuối chưa kết thúc (`:207-212`, `:419-435`) nhưng vẫn giữ nguyên các nút xuất/sao chép.
     - Bảng đếm văn bản tham mưu theo loại (`:566-630`, số liệu `tabular-nums` canh phải) và danh sách văn bản tham mưu nhóm theo tuần có tô đỏ+đậm và link ngược về văn bản gốc (`:633-707`).
     - Điều hướng tháng trước/sau (`:295-316`), tải `.docx`/`.md` qua `authedFetch('/api/weekly-reports/export?month=...&format=docx|md')` (`:218-266`), nút `"Sao chép"` dùng `monthToMarkdown(..., includeRichSections: false)` (`:268-285`).
     - Chữ ≥16px: toàn bộ `MonthlySummary.tsx`, `monthly/page.tsx`, `monthly/[month]/page.tsx` dùng `text-base` trở lên (`grep -rn "text-xs\|text-sm"` trên 3 file ra 0 kết quả; các component UI `Badge`/`Button`/`Table` được ghi đè `text-base`).
     - Vùng bấm ≥44px: toàn bộ `Button` và link hành động có `h-auto min-h-[44px]` (`min-w-[44px]` ở nút điều hướng/hành động) và link văn bản gốc có `inline-flex min-h-[44px] items-center`.

5. **AC5 — Không import `docx` vào bundle client:** **PASS**
   - Bằng chứng:
     - `components/weekly-report/MonthlySummary.tsx:31` import trực tiếp `monthToMarkdown` từ `@/lib/weekly-report/export/markdown`, không import `docx`, `./docx`, hay barrel `@/lib/weekly-report/export`.
     - `grep -rn "text-xs\|text-sm\|docx" app/(app)/weekly-reports/monthly components/weekly-report/MonthlySummary.tsx` xác nhận không có bất kỳ câu lệnh import/require `docx` nào.
     - Test tự động kiểm mã nguồn tĩnh cả 3 file client tại `__tests__/weekly-report/export.test.ts:369-386` pass.

## 3. Output lệnh kiểm tra

1. `NODE_OPTIONS="--use-bundled-ca" npx tsc --noEmit`:
   - Exit code `0`, không có lỗi.

2. `NODE_OPTIONS="--use-bundled-ca" npx vitest run __tests__/weekly-report/export.test.ts`:
```text
 RUN  v4.1.9 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  00:18:52
   Duration  381ms (transform 60ms, setup 0ms, import 95ms, tests 41ms, environment 0ms)
```

3. `TZ=UTC NODE_OPTIONS="--use-bundled-ca" npx vitest run __tests__/weekly-report`:
```text
 RUN  v4.1.9 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office

 Test Files  4 passed (4)
      Tests  51 passed (51)
   Start at  17:18:55
   Duration  333ms (transform 190ms, setup 0ms, import 261ms, tests 82ms, environment 0ms)
```

## 4. Ghi chú / Điểm cần Claude biết
- **Môi trường Node v25.2.1 trong sandbox macOS:** khi chạy `npx vitest run` không có biến môi trường, Node v25 dùng system CA gây `ERROR: SecItemCopyMatching failed -50` (exit 139); truyền `NODE_OPTIONS="--use-bundled-ca"` chạy bình thường và ổn định.
- **Route xuất file phía server:** tại thời điểm hoàn thành T-214, thư mục `app/api/weekly-reports/export/` chưa có file `route.ts` (thuộc phạm vi Claude chính viết theo T-200). Các nút `"Tải .docx"` và `"Tải .md"` trong `MonthlySummary.tsx` đã đấu đúng URL `GET /api/weekly-reports/export?month=YYYY-MM&format=docx|md` qua `authedFetch` và hiển thị lỗi rõ ràng nếu API chưa sẵn sàng.
- **Khác biệt nhỏ về kiểm thử giao diện:** chưa chạy dev server hay trình duyệt thật (theo `_RULES.md` cấm `npm run dev` / `npm run build`), nên việc kiểm tra hiển thị thực tế 375px/1280px và tải file từ `/api/weekly-reports/export` sẽ được xác minh ở bước tích hợp tiếp theo.
