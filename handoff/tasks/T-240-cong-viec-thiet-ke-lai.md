# T-240 — Thiết kế lại module Công việc cho gọn, nối vào Giao ban tuần

Đọc trước: `docs/WEEKLY_REPORT_PLAN.md` §3 (đánh giá + cải tiến; đặc biệt 3.1–3.3), §12 (AC-V*), §15 (Q6: anh Khôi đồng ý gộp, "thiết kế lại công việc cho đỡ rối"), `handoff/tasks/T-200-CONTRACT.md` (bảng chủ sở hữu file + quy ước UI), `handoff/tasks/_RULES.md` (CẤM), `CONTEXT.md`, `~/.claude/skills/ui-ux-chuan/reference/chuan-san.md`.

Người dùng thật duy nhất: anh Khôi (admin). Mục tiêu: mở trang Công việc là thấy ngay việc của tuần này, thêm việc trong 1 dòng, xong việc thì một chạm đưa sang báo cáo tuần.

## Được sửa
`app/(app)/tasks/**`, `components/tasks/**`, `lib/tasks/**` (không đổi schema Firestore hiện có; chỉ được thêm trường tuỳ chọn `resultAdvisoryDocIds?: string[]`, `weeklyReportWeekId?: string | null` vào `types/tasks.ts` — được sửa riêng 2 dòng đó).
KHÔNG sửa `app/(app)/layout.tsx`, `components/layout/MobileTabBar.tsx` (Claude chính sẽ gộp mục Kanban/Lịch/Định kỳ ra khỏi sidebar).

## Việc
1. Trang `/tasks` thành một trang duy nhất có thanh chuyển chế độ xem (tab/segmented): **Tuần này** (mặc định) · Danh sách · Kanban · Lịch · Định kỳ — các route cũ `/tasks/kanban`, `/tasks/calendar`, `/tasks/recurring`, `/tasks/all` vẫn chạy (giữ link cũ) nhưng hiển thị cùng thanh chuyển đó.
2. "Tuần này": nhóm việc theo kỳ giao ban Thứ 6 → Thứ 5 (dùng `currentWeekId`, `resolvePeriod`, `formatDMY` từ `lib/weekly-report/period.ts` — file do agent khác viết song song theo hợp đồng; nếu chưa có khi tsc thì ghi chú trong REPORT, không tự tạo): Quá hạn · Đến hạn trong kỳ · Đã xong trong kỳ. Hiển thị kỳ "Giao ban dd/MM · kỳ dd/MM–dd/MM".
3. Ô **thêm nhanh** 1 dòng (`components/tasks/TaskQuickAdd.tsx`): gõ tiêu đề, Enter là tạo (mặc định giao cho anh, ưu tiên thường, hạn = cuối kỳ hiện tại); nút "Chi tiết" mở form đầy đủ cũ.
4. Thu gọn phần đầu trang (bỏ khối thống kê to nếu chiếm chỗ; chuyển vào dạng chip nhỏ), bộ lọc gom vào một nút "Lọc".
5. Việc đã hoàn thành trong kỳ có nút **"Đưa vào giao ban"**: ghi một WorkItem `{ source:'task', taskId, text: title }` vào `weeklyReports/{weekId}.workItems` qua hàm `appendTaskToWeeklyReport(task)` — đặt hàm này trong `lib/tasks/weekly-bridge.ts` (mới), dùng firestore SDK trực tiếp (đọc doc tuần, nếu chưa có thì bỏ qua và báo "Mở trang Giao ban tuần trước"), không trùng nếu taskId đã có; đánh dấu task `weeklyReportWeekId`.
6. Rà UX: không giấu hành động sau hover, vùng bấm ≥44px trên mobile, trạng thái rỗng có hướng dẫn.

## Nghiệm thu
AC1 tsc sạch ở file gói; AC2 vitest hiện có không vỡ (`npx vitest run`); AC3 một trang /tasks có thanh chuyển 5 chế độ, mặc định Tuần này; AC4 thêm nhanh bằng Enter; AC5 nút "Đưa vào giao ban" không tạo trùng; AC6 các route cũ vẫn mở được. Ghi `handoff/tasks/T-240-REPORT.md`.
