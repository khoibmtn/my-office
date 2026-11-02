# T-111 — Mobile: danh sách công việc, Kanban, Lịch

Đọc và tuân thủ `handoff/tasks/_RULES.md`. Dùng primitive đã có từ T-110: class `.tap`, `.hover-reveal`, `components/ui/responsive-modal.tsx`, font input ≥16px trên mobile.

## Bối cảnh (đã kiểm trong code)
- `components/tasks/TaskTable.tsx` (~256-316): bảng 7 cột với `min-w-*`, không có dạng thẻ mobile; checkbox 16px.
- `app/(app)/tasks/page.tsx` (~184-197): 5 thẻ thống kê chiếm ~3 hàng ở 375px + tabs + bộ lọc → việc đầu tiên bị đẩy khỏi màn đầu; nút chuyển chế độ xem ~26px.
- `components/tasks/TaskFilters.tsx`: input/select `text-xs`, không thu gọn được.
- `KanbanBoard.tsx` (~238-286): kéo thả HTML5 (`draggable/onDrop`) không chạy trên cảm ứng; cột `w-80`, không `snap`. `app/(app)/tasks/kanban/page.tsx:25` ghi "Kéo thả để chuyển trạng thái".
- `TaskCalendar.tsx` (~120-161): 7 cột ~50px, chip chữ 10px bị cắt.

## Được sửa
`components/tasks/TaskTable.tsx`, `app/(app)/tasks/page.tsx` (bố cục), `components/tasks/TaskFilters.tsx`, `components/tasks/KanbanBoard.tsx` (chỉ UI), `app/(app)/tasks/kanban/page.tsx`, `components/tasks/TaskCalendar.tsx`, `components/tasks/TaskStatusBadge.tsx`, `TaskPriorityBadge.tsx`.
KHÔNG sửa logic đổi trạng thái trong `lib/tasks/*` — Kanban gọi hàm `changeTaskStatus` đã có (từ T-120).

## Yêu cầu
1. `TaskTable`: dưới `sm` render danh sách thẻ (tiêu đề đầy đủ, badge trạng thái, chấm ưu tiên, hạn có màu quá hạn/sắp đến hạn, người xử lý, thanh tiến độ, icon định kỳ 🔄); checkbox chọn vùng chạm ≥40px; chạm thẻ mở `/tasks/[id]`. Từ `sm` giữ bảng như cũ.
2. `tasks/page.tsx`: trên mobile thẻ thống kê thành dải cuộn ngang 1 hàng (`flex overflow-x-auto snap-x`, mỗi thẻ ~120px); nút chuyển Danh sách/Kanban/Lịch và "Tạo mới" ≥40px; tab "Tất cả / Của tôi / Tôi đã giao…" cuộn ngang không xuống dòng.
3. `TaskFilters`: dưới `md` chỉ hiện ô tìm kiếm + nút "Bộ lọc (n)" (n = số bộ lọc đang bật) mở `ResponsiveModal` chứa các select `w-full` + nút "Bỏ lọc"/"Áp dụng"; từ `md` giữ nguyên.
4. Kanban: dưới `md` cột `w-[85vw] snap-start` trong container `snap-x snap-mandatory overflow-x-auto`; mỗi thẻ có nút "⋯"/"Chuyển trạng thái" (≥40px) mở menu các trạng thái hợp lệ theo `VALID_TRANSITIONS`, gọi `changeTaskStatus`, hiện lỗi nếu bị chặn. Giữ kéo thả trên desktop. Câu hướng dẫn: desktop "Kéo thả để chuyển trạng thái", mobile "Chạm ⋯ để chuyển trạng thái".
5. Lịch: dưới `sm` ô ngày chỉ hiện chấm màu (tối đa 3 + "+n"); chạm ngày → danh sách việc của ngày đó hiện dưới lịch (tên đầy đủ, trạng thái, người xử lý, chạm mở chi tiết). Nút chuyển tháng ≥40px.

## Tiêu chí nghiệm thu (viewport 375×667)
1. `/tasks` không cuộn ngang; thẻ việc đầu tiên nằm trong 600px đầu trang.
2. Mọi nút/ô chọn trong các màn này có vùng chạm ≥40px.
3. Bộ lọc mở/đóng bằng modal, số bộ lọc hiển thị đúng.
4. Đổi trạng thái trên Kanban bằng chạm được, chuyển không hợp lệ bị chặn có thông báo.
5. Vuốt Kanban: mỗi cột khít màn hình.
6. Lịch: chạm ngày xem được tên đầy đủ công việc.
7. Desktop ≥1024px không thay đổi hành vi.
8. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass.

## Cập nhật trước khi giao (02/11, Claude)
Các task trước đã đổi các file này — đọc code hiện tại, giữ nguyên logic:
- `KanbanBoard.tsx` nhận thêm prop `allTasks` (đủ việc con) để tính `subtaskStats`; gọi `changeTaskStatus(task.id, status, actor, { subtasks: subtasksByParentId[task.id] })` — menu "Chuyển trạng thái" trên mobile PHẢI đi qua cùng handler (cùng chốt chặn việc con, cùng optimistic update/hoàn tác, cùng hiển thị lỗi).
- `app/(app)/tasks/page.tsx` đã có đọc `searchParams`, chip bộ lọc (`status` đặc biệt, nhiều `departmentId`, `includeCollaborator`) và `filterTasksByParams` — chỉ đổi bố cục/kích thước, không đổi logic lọc.
- Có task khác đang sửa song song `SubtaskList.tsx`, `components/chat/*`, `TaskCommentThread.tsx` — KHÔNG đụng.
