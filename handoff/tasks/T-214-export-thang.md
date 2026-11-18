# T-214 — Bộ xuất (Markdown/DOCX/JSON Cowork) + trang Tổng hợp tháng

Đọc trước: `handoff/tasks/T-200-CONTRACT.md` (hợp đồng — tuân thủ đúng chữ ký), `types/weekly-report.ts`, `docs/WEEKLY_REPORT_PLAN.md` §4.2, §6.5, §10.4, §12 (AC-M*), §15, `handoff/tasks/_RULES.md` (CẤM), `CONTEXT.md`.
Mẫu định dạng thật: chạy `textutil -convert txt -stdout "/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P1 Soạn thảo/ke-hoach/cong-viec-khth/tom-tat/10.2026.docx" | head -80` để thấy định dạng tóm tắt tháng (CHỈ ĐỌC, không sửa/chép file đó vào repo, không đưa nội dung thật vào fixture — fixture dùng dữ liệu giả).

Lưu ý: một agent khác (T-201) đang viết song song `lib/weekly-report/{period,advisory-format,outline,firestore}.ts`. Bạn được IMPORT `formatAdvisorySummary`, `formatAdvisoryLine`, `sortAdvisory`, `countByType` (advisory-format.ts) và `formatDMY`, `weeksOfMonth`, `isBoundaryWeek`, `todayVN` (period.ts) theo đúng chữ ký hợp đồng; nếu file chưa có khi bạn chạy tsc thì chờ/ghi chú trong REPORT, KHÔNG tự tạo các file đó.

## Được sửa (chỉ những file này)
- `lib/weekly-report/export/**` (tiptap-markdown.ts, markdown.ts, docx.ts, cowork.ts, index.ts)
- `__tests__/weekly-report/export*.test.ts` (+ fixture giả trong `__tests__/weekly-report/fixtures/`)
- `app/(app)/weekly-reports/monthly/[month]/page.tsx`, `app/(app)/weekly-reports/monthly/page.tsx` (chuyển tới tháng hiện tại)
- `components/weekly-report/MonthlySummary.tsx`

## Việc
1. Cài đặt các hàm xuất trong hợp đồng (§ "Bộ xuất"). `docx` chỉ dùng phía server (file docx.ts không được import từ component client).
2. `toCoworkWeek`/`toCoworkMonth`: CHỈ trả Mục 1 (workItems, gồm con, cờ highlight) và văn bản tham mưu (type, typeLabel, prefix, title, docNumber, advisedDate, weekId, sourceSnapshot, highlight) — tuyệt đối không trả `sections` (Ý kiến/Tuần tới/Đề xuất/Ý kiến PGĐ). Kèm periodStart/periodEnd/periodOverridden/actualMeetingDate/periodNote/reportMonth/reportMonthOverridden/status, countsByType, total, warnings có mã.
3. Trang tháng `/weekly-reports/monthly/[month]` (client component, chỉ admin): dùng hooks `useWeeks()`, `useWeeklyReportConfig()` và `listAdvisoryByWeekIds` (từ `lib/weekly-report/firestore.ts`) để dựng: danh sách tuần thuộc tháng theo `weeksOfMonth` (đánh dấu tuần giáp ranh, tuần chưa chốt, tuần chưa có dữ liệu, tuần kỳ đặc biệt), bảng đếm theo loại, toàn bộ văn bản tham mưu nhóm theo tuần, nút chuyển tháng trước/sau, nút "Tải .docx" và "Tải .md" gọi `GET /api/weekly-reports/export?month=YYYY-MM&format=docx|md` (route do Claude chính viết — dùng `authedFetch` trong `lib/authedFetch.ts` rồi tải blob), nút "Sao chép" (sao chép markdown dựng ở client bằng `monthToMarkdown`, includeRichSections=false).
4. Test vitest: tiptapToMarkdown (các node), weekToMarkdown/monthToMarkdown khớp định dạng tom-tat (dòng ngày, tiêu đề, "1. KHTH", "Tình hình thực hiện nhiệm vụ tuần qua:", "Tham mưu VB: …"), toCoworkWeek KHÔNG chứa sections, buildMonthDocx trả Buffer bắt đầu bằng 'PK'.

## Nghiệm thu
- AC1 `npx tsc --noEmit` không lỗi ở file của gói; AC2 `npx vitest run __tests__/weekly-report/export` pass; AC3 toCowork* không lộ sections; AC4 trang tháng hiển thị đúng các trạng thái, chữ ≥16px, nút ≥44px trên mobile; AC5 không import `docx` vào bundle client.
Ghi `handoff/tasks/T-214-REPORT.md` theo `_RULES.md`.
