# Báo cáo thực hiện T-240 — Thiết kế lại module Công việc cho gọn, nối vào Giao ban tuần

- **Trạng thái:** chờ verify

## 1. Kiểm tra từng Tiêu chí Nghiệm thu (AC)

| AC | Tiêu chí | Kết quả | Bằng chứng (`file:dòng`) |
|---|---|---|---|
| **AC1** | `tsc` sạch ở file gói (`types/tasks.ts`, `lib/tasks/**`, `components/tasks/**`, `app/(app)/tasks/**`). | **PASS** | `./node_modules/.bin/tsc --noEmit` thoát mã `0`, không có lỗi ở toàn bộ dự án (bao gồm `types/tasks.ts:109-110`, `lib/tasks/weekly-bridge.ts`, `components/tasks/**`, `app/(app)/tasks/**`). |
| **AC2** | `vitest` hiện có không vỡ (`npx vitest run`). | **PASS** | Tất cả 17 test files / 260 tests (15 file có sẵn + `lib/tasks/weekly-bridge.test.ts` + test `weekly-report` song song) đều pass 100% ở cả múi giờ hệ thống và `TZ=UTC`. *Lưu ý môi trường:* chạy trần `npx vitest run` trong sandbox macOS gặp `ERROR: SecItemCopyMatching failed -50` (exit 139) ở worker process khi đọc Keychain; chạy với `NODE_OPTIONS=--use-bundled-ca ./node_modules/.bin/vitest run` vượt qua Keychain sandbox và chạy đầy đủ 17/17 files, 260/260 tests pass. |
| **AC3** | Một trang `/tasks` có thanh chuyển 5 chế độ (**Tuần này** · Danh sách · Kanban · Lịch · Định kỳ), mặc định **Tuần này**; thu gọn phần đầu + bộ lọc gom vào một nút `"Lọc"`. | **PASS** | `components/tasks/TasksWorkspace.tsx:74-80,100-111,359-411` (header thu gọn với dải chip nhỏ thay 5 thẻ to + `role="tablist"` 5 chế độ, mặc định `'week'`), `app/(app)/tasks/page.tsx:14-18`, `components/tasks/TaskWeekView.tsx:263-296,399-548` (nhóm `Quá hạn` · `Đến hạn trong kỳ` · `Đã xong trong kỳ` theo `currentWeekId`, `resolvePeriod`, `formatDMY`, hiển thị `Giao ban dd/MM · kỳ dd/MM–dd/MM`), `components/tasks/TaskFilters.tsx:136-150,256-383` (gom bộ lọc vào 1 nút `"Lọc"` mở `ResponsiveModal`). |
| **AC4** | Thêm nhanh 1 dòng bằng **Enter** (`TaskQuickAdd.tsx`); mặc định giao cho anh, ưu tiên thường, hạn = cuối kỳ hiện tại; nút `"Chi tiết"` mở form đầy đủ cũ. | **PASS** | `components/tasks/TaskQuickAdd.tsx:37-95,99-141,161-174` (ô `<input>` `text-base` `min-h-[44px]`, Enter gửi form gọi `createTask` với `priority: 'normal'`, `dueDate: periodEndTimestamp(defaultDueDate)`, `assigneeId: defaultAssigneeId`, sau khi tạo xoá trắng ô và giữ focus; nút `"Chi tiết"` mở `TaskCreateDrawer`), `components/tasks/TaskCreateDrawer.tsx:96-143`, `app/(app)/tasks/new/page.tsx:7-19`. |
| **AC5** | Nút `"Đưa vào giao ban"` ghi `WorkItem` vào `weeklyReports/{weekId}.workItems` qua `appendTaskToWeeklyReport(task)` ở `lib/tasks/weekly-bridge.ts`, không tạo doc tuần nếu chưa có (báo `"Mở trang Giao ban tuần trước"`), không tạo trùng theo `taskId`, đánh dấu `weeklyReportWeekId`. | **PASS** | `types/tasks.ts:109-110` (chỉ thêm đúng 2 trường tuỳ chọn `resultAdvisoryDocIds?` và `weeklyReportWeekId?`), `lib/tasks/weekly-bridge.ts:174-267` (`appendTaskWorkItemPure` kiểm `taskId` chống trùng; `appendTaskToWeeklyReport` chạy Firestore transaction: trả `{ ok: false, status: 'missing_week', message: 'Mở trang Giao ban tuần trước' }` nếu `!weekSnap.exists()`, ngược lại ghi `workItems` và cập nhật `weeklyReportWeekId`), `components/tasks/TaskWeekView.tsx:124-155,515-542` (nút `"Đưa vào giao ban"` và trạng thái `"Đã trong giao ban"`), unit test chứng minh chống trùng tại `lib/tasks/weekly-bridge.test.ts:144-184`. |
| **AC6** | Các route cũ (`/tasks/kanban`, `/tasks/calendar`, `/tasks/recurring`, `/tasks/all`) vẫn mở được và hiển thị cùng thanh chuyển 5 chế độ; rà UX chuẩn sàn (không giấu hành động sau hover, vùng bấm ≥44px mobile, trạng thái rỗng có hướng dẫn). | **PASS** | `app/(app)/tasks/all/page.tsx:14-18` (`initialMode="list"`), `app/(app)/tasks/kanban/page.tsx:14-18` (`initialMode="kanban"`), `app/(app)/tasks/calendar/page.tsx:14-18` (`initialMode="calendar"`), `app/(app)/tasks/recurring/page.tsx:14-18` (`initialMode="recurring"`). Rà UX không giấu hành động sau `opacity-0` + chạm ≥44px mobile + trạng thái rỗng có hướng dẫn ở `components/tasks/TaskTable.tsx:213-336,470-516`, `components/tasks/KanbanBoard.tsx:373-420,510-515`, `components/tasks/TaskCalendar.tsx:117-146,246-250`, `components/tasks/TaskDetail.tsx:732-740`, `components/tasks/SubtaskList.tsx:465-518`, `components/tasks/RecurringSeriesView.tsx:177-205,361-447`. |

---

## 2. Danh sách file đã sửa / tạo mới

### Sửa
- `types/tasks.ts` (chỉ thêm 2 dòng: `resultAdvisoryDocIds?: string[]`, `weeklyReportWeekId?: string | null`)
- `app/(app)/tasks/page.tsx`
- `app/(app)/tasks/all/page.tsx`
- `app/(app)/tasks/kanban/page.tsx`
- `app/(app)/tasks/calendar/page.tsx`
- `app/(app)/tasks/recurring/page.tsx`
- `app/(app)/tasks/new/page.tsx`
- `components/tasks/TaskFilters.tsx`
- `components/tasks/TaskCreateDrawer.tsx`
- `components/tasks/TaskTable.tsx`
- `components/tasks/KanbanBoard.tsx`
- `components/tasks/TaskCalendar.tsx`
- `components/tasks/TaskDetail.tsx`
- `components/tasks/SubtaskList.tsx`

### Tạo mới
- `lib/tasks/weekly-bridge.ts`
- `lib/tasks/weekly-bridge.test.ts`
- `components/tasks/TaskQuickAdd.tsx`
- `components/tasks/TaskWeekView.tsx`
- `components/tasks/RecurringSeriesView.tsx`
- `components/tasks/TasksWorkspace.tsx`
- `handoff/tasks/T-240-REPORT.md`

*(Đã kiểm `git status --short`: không đụng `app/(app)/layout.tsx`, `components/layout/MobileTabBar.tsx`, hay bất kỳ file nào ngoài phạm vi T-240.)*

---

## 3. Kết quả lệnh kiểm tra

1. `./node_modules/.bin/tsc --noEmit`:
   ```text
   (exit code 0, 0 errors — TSC_OK)
   ```
2. `NODE_OPTIONS=--use-bundled-ca ./node_modules/.bin/vitest run`:
   ```text
    Test Files  17 passed (17)
         Tests  260 passed (260)
      Start at  00:19:53
      Duration  1.24s (transform 1.07s, setup 0ms, import 2.61s, tests 334ms, environment 1ms)
   ```
3. `TZ=UTC NODE_OPTIONS=--use-bundled-ca ./node_modules/.bin/vitest run`:
   ```text
    Test Files  17 passed (17)
         Tests  260 passed (260)
      Start at  17:19:55
      Duration  1.33s (transform 1.19s, setup 0ms, import 2.56s, tests 300ms, environment 1ms)
   ```

---

## 4. Điểm lưu ý / Cần verifier & Claude chính kiểm tra tiếp

1. **Tương tác Firestore thật trên UI (chưa chạy browser trong phiên vì `_RULES.md` cấm chạy dev/build và ghi DB production):**
   - Thử gõ tiêu đề + Enter ở `TaskQuickAdd` để xác nhận tạo task với `dueDate = periodEnd`, ưu tiên `normal`, giao mặc định cho tài khoản admin (`matchedStaff`).
   - Thử bấm `"Đưa vào giao ban"` cả 2 trường hợp: khi `weeklyReports/{weekId}` chưa tồn tại (phải hiện `"Mở trang Giao ban tuần trước"`) và khi đã tồn tại (phải chèn 1 dòng `source: 'task'`, đánh dấu `weeklyReportWeekId`, và đổi sang trạng thái `"Đã trong giao ban"` không tạo trùng).
2. **Sidebar / MobileTabBar:** theo brief, không sửa `app/(app)/layout.tsx` và `components/layout/MobileTabBar.tsx` trong gói T-240 (Claude chính sẽ gộp mục Kanban/Lịch/Định kỳ ra khỏi sidebar).
3. **Liên kết Dashboard → `/tasks`:** khi mở `/tasks` kèm query lọc từ Dashboard (`?status=overdue`, `?assigneeId=...`, `?departmentId=...`), `TasksWorkspace` tự chuyển sang chế độ `'list'` để giữ nguyên hành vi khớp số đếm với `TaskDashboard`.
