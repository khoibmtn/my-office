# T-122 — Sửa vòng 1 (Claude verifier: AC4, AC5 PARTIAL + 2 lỗi chặn)

Tuân thủ `handoff/tasks/_RULES.md`. Các task song song đã XONG — vòng này được sửa thêm các file gọi `useTasks()` liệt kê dưới đây (chỉ phần lấy dữ liệu, không đổi giao diện/logic khác): `hooks/useTasks.ts`, `lib/tasks/firestore.ts`, mới `hooks/useScopedTasks.ts`, `app/(app)/dashboard/page.tsx`, `app/(app)/tasks/page.tsx`, `app/(app)/tasks/kanban/page.tsx`, `app/(app)/tasks/recurring/page.tsx`, `components/tasks/TaskDashboard.tsx`, `components/documents/DocumentModal.tsx`, `components/documents/DocumentTaskSection.tsx`, `components/dossiers/DossierPanel.tsx`, `firestore.indexes.json`, `__tests__/tasks/*`.

1. **[CAO] Việc đã huỷ biến mất — `lib/tasks/firestore.ts:~249-256` `queryRecentClosedTasks`:** lọc `completedAt >= since`, nhưng việc `cancelled` không có `completedAt` (và việc cũ có thể `completedAt=null`). Sửa: listener việc đã đóng dùng `where('isClosed','==',true)` + `where('updatedAt','>=', since)` (+ `orderBy('updatedAt','desc')` nếu cần). Kiểm `firestore.indexes.json` có index khớp ĐÚNG các trường của query (thêm nếu thiếu, không trùng). `sinceMs` tính lại khi listener được tạo lại; chấp nhận cố định trong 1 phiên.
2. **[CAO] View theo văn bản/hồ sơ/chuỗi mất việc đã đóng >30 ngày:** tạo `hooks/useScopedTasks.ts` với `useDocumentTasks(docId)`, `useDossierTasks(dossierId)`, `useSeriesTasks(seriesId)` — mỗi hook một listener riêng dùng query có sẵn trong `lib/tasks/firestore.ts` (`queryDocumentTasks`, `queryDossierTasks`, query theo `seriesId`), trả `{ tasks, loading }`, loại `deletedAt != null`. Thay `useTasks()` bằng hook tương ứng ở: `DocumentTaskSection.tsx` (~69-71), `DocumentModal.tsx` (~93), `DossierPanel.tsx` (~91), `tasks/recurring/page.tsx` (~56). Giữ nguyên phần hiển thị. Kiểm index cho các query này (array-contains + orderBy nếu có).
3. **[TRUNG BÌNH] Số trên dashboard ≠ danh sách mở ra:**
   - "Đang mở" (dashboard ~418, ~560) đếm pending+in_progress+blocked nhưng link `status=in_progress` → thêm `status=open` vào `specialStatus` của `/tasks` (lọc `ACTIVE_STATUSES`) và dùng nó.
   - "Hoàn thành tuần" (`TaskDashboard.tsx:~117`) → `status=done_week` (lọc `completedAt` trong tuần hiện tại giờ VN, dùng cùng helper với `computeTaskStats`).
   - Trưởng/phó phụ trách ≥2 khoa: hỗ trợ `departmentId` nhiều giá trị (`departmentId=a,b`) ở `/tasks`, dashboard truyền đủ.
   - Chế độ cá nhân đếm cả `collaboratorIds` → `/tasks` hỗ trợ `assigneeId=<id>&includeCollaborator=1` (khớp cách đếm) hoặc dashboard chỉ đếm `assigneeId` — chọn một, ghi rõ trong báo cáo.
   - Mọi con số trên dashboard: tổng hiển thị phải bằng số dòng của trang `/tasks` mở ra. Viết test thuần cho hàm lọc `/tasks` theo searchParams so với `computeTaskStats` trên cùng dữ liệu mẫu.
4. **[THẤP] `/tasks/kanban`:** áp `isVisibleTask` (ẩn `visibleFrom` tương lai và việc con).
5. **[THẤP] `app/(app)/page.tsx`:** chỉ redirect khi `role` đã xác định (không phải giá trị mặc định lúc đang tải); kiểm cách `useRole`/`useOrganization` báo `loading`.

Sau khi sửa: `npx tsc --noEmit`, `npx vitest run`, `TZ=UTC npx vitest run`, cập nhật báo cáo T-122 mục "Vòng sửa 1". Ghi danh sách index Firestore cần deploy.
