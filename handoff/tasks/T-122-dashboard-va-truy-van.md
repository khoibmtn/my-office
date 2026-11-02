# T-122 — Dashboard đúng số liệu + giảm lượt đọc Firestore cho công việc

Đọc và tuân thủ `handoff/tasks/_RULES.md`.

## Bối cảnh (đã kiểm trong code)
- `hooks/useTasks.ts` (~31-33) + `lib/tasks/firestore.ts` (`queryAllActiveTasks` ~46-51) subscribe **toàn bộ** collection `tasks` (cả việc đã đóng, đã xoá mềm, việc con) rồi lọc client; hook được gắn ~11 nơi → mỗi nơi một listener. Index trong `firestore.indexes.json` không được query nào dùng.
- Việc định kỳ có `visibleFrom` tương lai (sinh trước 14 ngày) vẫn hiện trong danh sách và số liệu. `app/(app)/tasks/calendar/page.tsx`, `app/(app)/tasks/all/page.tsx` không lọc việc con.
- "Hoàn thành tuần/tháng" thực chất đếm mọi việc đã hoàn thành (`app/(app)/tasks/page.tsx` ~65, `app/(app)/dashboard/page.tsx` ~52-53, ~80-81). `taskStats`/`hooks/useTaskStats.ts` không ai ghi, chỉ import thừa.
- Dashboard: `now = Date.now()` tính mỗi render (~34) làm mọi `useMemo` chạy lại; nút "Quản lý nhân sự" không kiểm quyền; link `/tasks?assigneeId=` bị `/tasks` bỏ qua.
- `components/dashboard/StatsGrid.tsx`, `DeadlineTimeline.tsx` không được dùng. `app/(app)/page.tsx` là trang chủ.

## Được sửa
`hooks/useTasks.ts`, `lib/tasks/firestore.ts`, mới `contexts/TaskDataProvider.tsx` (nếu cần), `app/(app)/dashboard/page.tsx`, `app/(app)/tasks/page.tsx` (CHỈ phần số liệu + đọc `searchParams`; không đổi bố cục — task mobile sau sẽ làm), `app/(app)/tasks/calendar/page.tsx`, `app/(app)/tasks/all/page.tsx`, `components/tasks/TaskDashboard.tsx`, `hooks/useTaskStats.ts` (xoá), `components/dashboard/*` (xoá nếu không tích hợp), `app/(app)/page.tsx`, `firestore.indexes.json`, `__tests__/tasks/*` (file test mới).
KHÔNG sửa: `lib/tasks/mutations.ts`, `components/tasks/TaskDetail.tsx`, `KanbanBoard.tsx`, `TaskTable.tsx`, `TaskCalendar.tsx`, `app/(app)/layout.tsx`, `contexts/GlobalDataProvider.tsx`.

## Yêu cầu
1. **Một nguồn dữ liệu task dùng chung:** provider/hook singleton giữ **một** listener: `where('isClosed','==',false)` + một listener việc đã đóng có `completedAt >= now-30 ngày` (cần index — thêm vào `firestore.indexes.json`, xoá index trùng). Loại `deletedAt != null`. `useTasks()` giữ nguyên API trả về để các nơi đang dùng không phải sửa; nếu provider phải mount ở layout mà task này không được sửa layout → bọc provider bên trong hook theo mô hình singleton module-level (đếm số subscriber, huỷ listener khi về 0).
2. **Lọc hiển thị:** helper thuần `isVisibleTask(task, now)` = không xoá, `visibleFrom` null hoặc ≤ now, và (cho danh sách/lịch/all) `parentTaskId == null`. Áp ở `/tasks`, `/tasks/all`, `/tasks/calendar`, dashboard.
3. **Số liệu đúng:** helper thuần `computeTaskStats(tasks, now)` trả: đang mở, quá hạn (`dueDate < now && !isClosed`), đến hạn 7 ngày tới, hoàn thành tuần này / tháng này (theo `completedAt`, tuần bắt đầu thứ Hai, múi giờ Asia/Ho_Chi_Minh), tỷ lệ hoàn thành = completed / (tổng − cancelled). Dùng ở `/tasks` và dashboard. `now` giữ trong state, cập nhật mỗi 60s. Xoá `useTaskStats.ts` và mọi import.
4. **Dashboard cho lãnh đạo** (`dashboard/page.tsx` + `TaskDashboard.tsx`):
   - Khối thẻ: Quá hạn / Đến hạn 7 ngày / Đang thực hiện / Hoàn thành tuần.
   - "Quá hạn & sắp đến hạn theo người" (bảng: người, số quá hạn, số đến hạn 7 ngày, đang mở) và "theo khoa" (dùng `departmentId`, fallback `assigneeDepartmentId`).
   - "Văn bản quá hạn": từ `useDocuments()` (văn bản có `deadline < now` và `status` ∉ completed).
   - Mỗi số bấm được → `/tasks?status=overdue|due7|in_progress&assigneeId=…&departmentId=…`. `/tasks` đọc các `searchParams` này để đặt bộ lọc ban đầu.
   - Phạm vi: admin xem toàn bộ; `truong_phong`/`pho_phong` chỉ khoa mình (`departmentIds` của staff hiện tại); vai trò khác chỉ thấy việc của mình. Nút "Quản lý nhân sự" chỉ hiện với quyền `org:manage_staff`.
5. Trang chủ `app/(app)/page.tsx` → `redirect('/dashboard')` cho người có quyền xem báo cáo (`report:view_*`), còn lại `/tasks`. Xoá `components/dashboard/StatsGrid.tsx`, `DeadlineTimeline.tsx` nếu không dùng.
6. **Test:** `computeTaskStats` (ranh giới tuần/tháng giờ VN, loại cancelled khỏi mẫu số), `isVisibleTask` (visibleFrom tương lai, việc con, đã xoá).

## Tiêu chí nghiệm thu
1. Cả app chỉ có tối đa 2 listener tới collection `tasks` cho danh sách chung (kiểm bằng log/đếm subscriber trong code), không còn query toàn collection không `where`.
2. Việc có `visibleFrom` tương lai và việc con không xuất hiện ở `/tasks`, `/tasks/all`, `/tasks/calendar`, dashboard.
3. "Hoàn thành tuần/tháng" chỉ đếm việc có `completedAt` trong khoảng; có test.
4. Dashboard có 4 khối nêu trên, số bấm được và `/tasks` mở đúng bộ lọc.
5. Phạm vi dữ liệu đúng theo vai trò.
6. `useTaskStats` đã xoá; `firestore.indexes.json` hợp lệ JSON, không index trùng, có index cho query mới.
7. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass.
