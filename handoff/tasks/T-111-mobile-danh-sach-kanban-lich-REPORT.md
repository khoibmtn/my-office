# Báo cáo thực hiện T-111 — Mobile: danh sách công việc, Kanban, Lịch

**Trạng thái:** chờ verify

## 1. Danh sách file đã sửa
- `components/tasks/TaskTable.tsx` (sửa: dưới `sm` hiển thị danh sách thẻ công việc gồm tiêu đề đầy đủ, badge trạng thái + derivedStates, chấm ưu tiên, hạn có màu quá hạn/sắp đến hạn, người xử lý, thanh tiến độ, icon định kỳ `RefreshCw`, checkbox chọn bọc `<label>` vùng chạm ≥40×40px, chạm thẻ mở `/tasks/[id]`; các nút quick filter có `max-md:min-h-[40px]`; từ `sm` giữ nguyên bảng 7 cột như cũ)
- `app/(app)/tasks/page.tsx` (sửa bố cục: trên mobile thẻ thống kê cuộn ngang 1 hàng `flex overflow-x-auto snap-x snap-mandatory` với mỗi thẻ `w-[120px] shrink-0 snap-start`, từ `md` giữ `md:grid md:grid-cols-5`; nút chuyển chế độ xem Danh sách/Kanban/Lịch và nút "Tạo mới" có vùng chạm ≥40px trên mobile; dải tab cuộn ngang không xuống dòng `overflow-x-auto whitespace-nowrap shrink-0` với `max-md:min-h-[40px]`; giữ nguyên toàn bộ logic lọc URL `searchParams`, chip bộ lọc và `filterTasksByParams`)
- `components/tasks/TaskFilters.tsx` (sửa: dưới `md` chỉ hiện ô tìm kiếm `flex-1` + nút `"Bộ lọc (n)"` hiển thị số bộ lọc select đang bật, chạm mở `ResponsiveModal` chứa các `<select>` `w-full` có chiều cao ≥44px + 2 nút `"Bỏ lọc"` / `"Áp dụng"`; từ `md` giữ nguyên các bộ lọc inline như cũ)
- `components/tasks/KanbanBoard.tsx` (sửa UI: dưới `md` container `max-md:snap-x max-md:snap-mandatory overflow-x-auto` và mỗi cột `w-[85vw] snap-start md:w-80`; mỗi thẻ có nút `"⋯"` / `aria-label="Chuyển trạng thái"` kích thước 40×40px trên mobile mở menu các trạng thái hợp lệ theo `VALID_TRANSITIONS`, gọi chung `executeStatusTransition` → kiểm tra việc con chưa xong, optimistic update/rollback, gọi `changeTaskStatus(task.id, targetStatus, actorCtx.actor, { subtasks: subtasksByParentId[task.id] })` và hiển thị lỗi nếu bị chặn; giữ nguyên kéo thả trên desktop)
- `app/(app)/tasks/kanban/page.tsx` (sửa: câu hướng dẫn hiển thị `"Kéo thả để chuyển trạng thái công việc"` trên desktop `hidden md:block` và `"Chạm ⋯ để chuyển trạng thái"` trên mobile `md:hidden`)
- `components/tasks/TaskCalendar.tsx` (sửa: nút chuyển tháng trước/sau và `"Hôm nay"` có vùng chạm ≥40×40px trên mobile; dưới `sm` mỗi ô ngày chỉ hiển thị chấm màu trạng thái tối đa 3 + `"+n"`; chạm vào ngày chọn ngày đó và hiển thị danh sách công việc của ngày bên dưới lịch với tên đầy đủ, trạng thái, ưu tiên, người xử lý, chạm mở `/tasks/[id]`; từ `sm` giữ nguyên chip công việc trong ô lịch)
- `components/tasks/TaskStatusBadge.tsx` (sửa: thêm `flex-wrap sm:flex-nowrap` và `whitespace-nowrap` cho các pill trạng thái để hiển thị gọn trên thẻ mobile mà không đổi bố cục từ `sm`)
- `components/tasks/TaskPriorityBadge.tsx` (sửa: thêm `whitespace-nowrap` cho badge ưu tiên)

## 2. Tự kiểm từng tiêu chí nghiệm thu (AC) ở viewport 375×667
1. **AC 1 — `/tasks` không cuộn ngang; thẻ việc đầu tiên nằm trong 600px đầu trang:** **PASS**
   - Bằng chứng:
     - `app/(app)/tasks/page.tsx:261,313,340`: khung trang dùng `p-3 sm:p-4 lg:p-6 space-y-2.5 sm:space-y-4`, dải tab `overflow-x-auto` (1 hàng ~44px), dải 5 thẻ thống kê `flex overflow-x-auto snap-x snap-mandatory` (1 hàng ~58px thay vì 3 hàng grid), bộ lọc `TaskFilters` thu gọn 1 hàng 40px (`components/tasks/TaskFilters.tsx:77-112`), bảng chuyển sang danh sách thẻ dọc `sm:hidden` (`components/tasks/TaskTable.tsx:257-387`).
     - Tổng chiều cao từ đỉnh viewport (header mobile 56px + tiêu đề/nút ~90px + tabs ~45px + stats 1 hàng ~58px + thanh tìm kiếm/bộ lọc ~40px + quick filters ~52px + khoảng cách) ≈ 395px < 600px, thẻ công việc đầu tiên nằm trọn trong 600px đầu trang và không phát sinh cuộn ngang.
2. **AC 2 — Mọi nút/ô chọn trong các màn này có vùng chạm ≥40px:** **PASS**
   - Bằng chứng:
     - Nút Danh sách / Kanban / Lịch & Tạo mới: `max-md:min-h-[40px] max-md:min-w-[40px]` & `max-md:min-h-[40px] max-md:h-10` (`app/(app)/tasks/page.tsx:279-307`).
     - Các nút Tab & nút xóa chip lọc URL: `max-md:min-h-[40px]` (`app/(app)/tasks/page.tsx:323,377,390,403`).
     - Ô tìm kiếm, nút xóa tìm kiếm, nút `"Bộ lọc (n)"` và các `<select>` / nút trong modal: `max-md:min-h-[40px] max-md:h-10` và `min-h-[44px] h-11` (`components/tasks/TaskFilters.tsx:86,93,104,127,134,149,165,181,198`).
     - Các nút quick filter và checkbox chọn thẻ việc trong `TaskTable`: `max-md:min-h-[40px]` và `<label className="min-w-[40px] min-h-[40px] w-10 h-10 ...">` (`components/tasks/TaskTable.tsx:233,249,291-302`).
     - Nút `"⋯"` (`Chuyển trạng thái`), các mục trong menu trạng thái, và nút đóng thông báo lỗi trên `KanbanBoard`: `min-w-[40px] min-h-[40px] w-10 h-10` và `min-h-[40px]` (`components/tasks/KanbanBoard.tsx:297,385,409`).
     - Nút chuyển tháng trước/sau, nút `"Hôm nay"` và ô ngày trên `TaskCalendar`: `max-md:min-w-[40px] max-md:min-h-[40px]` và `min-h-[54px]` (`components/tasks/TaskCalendar.tsx:117,126,134,161`).
3. **AC 3 — Bộ lọc mở/đóng bằng modal, số bộ lọc hiển thị đúng:** **PASS**
   - Bằng chứng: `components/tasks/TaskFilters.tsx:42-47,101-208` — `activeSelectFilterCount` đếm chính xác số bộ lọc đang bật (`status`, `priority`, `assigneeId`, `departmentId` khác `'all'`), hiển thị trên nút `"Bộ lọc ({activeSelectFilterCount})"`, chạm mở `ResponsiveModal` chứa đầy đủ các `<select className="w-full ...">` cùng 2 nút `"Bỏ lọc"` (reset về `DEFAULT_FILTERS` và đóng modal) và `"Áp dụng"` (đóng modal).
4. **AC 4 — Đổi trạng thái trên Kanban bằng chạm được, chuyển không hợp lệ bị chặn có thông báo:** **PASS**
   - Bằng chứng: `components/tasks/KanbanBoard.tsx:232-269,344-345,375-418` — chạm nút `"⋯"` (`aria-label="Chuyển trạng thái"`) mở menu liệt kê các trạng thái đích theo `VALID_TRANSITIONS[task.status]`; khi chọn trạng thái đích sẽ gọi `executeStatusTransition(task, nextStatus)` kiểm tra `isValidTransition`, chặn hoàn thành khi còn việc con chưa xong (`targetStatus === 'completed' && stStats?.hasIncomplete` → báo lỗi `'Không thể hoàn thành khi còn việc con (subtask) chưa xong'`), cập nhật optimistic UI, gọi `changeTaskStatus(task.id, targetStatus, actorCtx.actor, { subtasks: subtasksByParentId[task.id] })`, và hoàn tác + hiển thị banner lỗi `errorMsg` nếu bị chặn.
5. **AC 5 — Vuốt Kanban: mỗi cột khít màn hình:** **PASS**
   - Bằng chứng: `components/tasks/KanbanBoard.tsx:303,311` — container có `overflow-x-auto max-md:snap-x max-md:snap-mandatory` và mỗi cột có `w-[85vw] snap-start md:w-80 shrink-0`.
6. **AC 6 — Lịch: chạm ngày xem được tên đầy đủ công việc:** **PASS**
   - Bằng chứng: `components/tasks/TaskCalendar.tsx:158-196,229-287` — dưới `sm`, mỗi ô ngày chỉ hiện tối đa 3 chấm màu trạng thái + `"+n"`; chạm vào ô ngày cập nhật `selectedDate` và hiển thị danh sách công việc của ngày đó ngay dưới lịch với tên đầy đủ (`font-medium text-sm text-slate-900 break-words`), badge trạng thái, mức ưu tiên, người xử lý, chạm vào việc mở `/tasks/[id]`.
7. **AC 7 — Desktop ≥1024px không thay đổi hành vi:** **PASS**
   - Bằng chứng: mọi thay đổi bố cục/kích thước mobile đều giới hạn bằng `sm:hidden` / `md:hidden` / `max-sm:` / `max-md:`; ở `>=1024px` (`lg:`), bảng `TaskTable` (`hidden sm:block`), 5 cột thống kê (`md:grid md:grid-cols-5`), bộ lọc ngang (`hidden md:block`), cột Kanban `md:w-80` kéo thả HTML5 và ô lịch kèm chip công việc (`hidden sm:block`) giữ nguyên như HEAD.
8. **AC 8 — `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass:** **PASS**
   - Bằng chứng: xem kết quả lệnh kiểm tra bên dưới.

## 3. Kết quả chạy lệnh kiểm tra
- `npx tsc --noEmit`: 0 lỗi (exit code 0).
- `npx vitest run`:
  ```
  Test Files  10 passed (10)
       Tests  167 passed (167)
  ```

## 4. Điểm chưa chắc / cần Claude quyết
- Không có. Tất cả yêu cầu và tiêu chí nghiệm thu đã hoàn thành trong đúng phạm vi file cho phép.
