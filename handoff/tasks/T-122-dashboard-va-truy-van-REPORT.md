# Báo cáo thực hiện T-122 — Dashboard đúng số liệu + giảm lượt đọc Firestore cho công việc

- **Trạng thái:** chờ verify

## 1. Kiểm tra từng Tiêu chí Nghiệm thu (AC)

| AC | Tiêu chí | Kết quả | Bằng chứng (`file:dòng`) |
|---|---|---|---|
| **AC 1** | Cả app chỉ có tối đa 2 listener tới collection `tasks` cho danh sách chung (kiểm bằng log/đếm subscriber trong code), không còn query toàn collection không `where`. | **PASS** | `hooks/useTasks.ts:43-171` (singleton module-level quản lý `subscribers`, `startSharedListeners` tính lại `sinceMs = getClosedTasksSinceMs(Date.now())` mỗi khi tạo lại listener, `stopSharedListeners` khi `subscribers.size === 0`, `getTaskSubscriberCount()`, `getActiveTaskListenerCount()` tối đa 2 listener cho danh sách chung: `queryAllActiveTasks()` + `queryRecentClosedTasks(sinceMs)`); `lib/tasks/firestore.ts:442-561` (mọi query trên `tasks` đều có `where`, loại bỏ `deletedAt != null` tại `lib/tasks/firestore.ts:579`). Các view theo văn bản/hồ sơ/chuỗi định kỳ tách sang `hooks/useScopedTasks.ts`. |
| **AC 2** | Việc có `visibleFrom` tương lai và việc con không xuất hiện ở `/tasks`, `/tasks/all`, `/tasks/calendar`, `/tasks/kanban`, dashboard. | **PASS** | Helper thuần `isVisibleTask(task, now)` tại `lib/tasks/firestore.ts:63-79` (loại `deletedAt != null`, `parentTaskId != null`, `visibleFrom > now`), áp dụng tại: `app/(app)/tasks/page.tsx:191-193`, `app/(app)/tasks/all/page.tsx:24-26`, `app/(app)/tasks/calendar/page.tsx:17-19`, `app/(app)/tasks/kanban/page.tsx:19-21`, `app/(app)/dashboard/page.tsx:86-88`. |
| **AC 3** | "Hoàn thành tuần/tháng" chỉ đếm việc có `completedAt` trong khoảng; có test. | **PASS** | `lib/tasks/firestore.ts:85-110` (`getVietnamTimeBounds` tính mốc đầu tuần Thứ Hai 00:00 và đầu tháng ngày 1 00:00 theo múi giờ `Asia/Ho_Chi_Minh` UTC+7), `lib/tasks/firestore.ts:236-309` (`computeTaskStats` chỉ đếm `completedAt` nằm trong `[weekStartMs, weekEndMs)` và `[monthStartMs, monthEndMs)`). Test tại `__tests__/tasks/statsAndVisibility.test.ts:84-158`, `364-569`. |
| **AC 4** | Dashboard có 4 khối nêu trên, số bấm được và `/tasks` mở đúng bộ lọc (tổng số trên Dashboard = số dòng `/tasks` mở ra). | **PASS** | 1) Khối thẻ (Quá hạn / Đến hạn 7 ngày / Đang thực hiện / Hoàn thành tuần / Hoàn thành tháng): `components/tasks/TaskDashboard.tsx:26-42`, `89-162` & `app/(app)/dashboard/page.tsx:333-339`.<br>2) Quá hạn & sắp đến hạn theo khoa (`departmentId` fallback `assigneeDepartmentId`): `app/(app)/dashboard/page.tsx:191-214`, `344-439`.<br>3) Quá hạn & sắp đến hạn theo người: `app/(app)/dashboard/page.tsx:125-188`, `444-578`.<br>4) Văn bản quá hạn (`useDocuments`, `deadline < now && status !== 'completed'`): `app/(app)/dashboard/page.tsx:217-260`, `583-655`.<br>Hàm lọc dùng chung `filterTasksByParams` (`lib/tasks/firestore.ts:327-414`) đảm bảo mọi con số (`overdue`, `due7`, `open`, `in_progress`, `done_week`, `done_month`, `departmentId=a,b`, `assigneeId` + `includeCollaborator=1`) khớp 100% với số dòng mở ra ở `app/(app)/tasks/page.tsx:236-249`. Test đối chiếu với số tuyệt đối tại `__tests__/tasks/statsAndVisibility.test.ts:364-496`. |
| **AC 5** | Phạm vi dữ liệu đúng theo vai trò; trang chủ chỉ redirect sau khi role xác định. | **PASS** | `app/(app)/dashboard/page.tsx:46-52` (nút "Quản lý nhân sự" chỉ hiển thị khi có quyền `org:manage_staff`, render tại dòng `306-327`); `app/(app)/dashboard/page.tsx:91-118` (`admin` xem toàn bộ; `truong_phong`/`pho_phong` xem toàn bộ các khoa phụ trách `myDepartmentIds.join(',')`; cá nhân xem việc của mình kèm `includeCollaborator=1`); `app/(app)/page.tsx:23-65` chờ `roleLoading`, `orgLoading`, `staffLoading` và `loadPermissionMatrix()` hoàn tất mới redirect. |
| **AC 6** | `useTaskStats` đã xoá; `firestore.indexes.json` hợp lệ JSON, không index trùng, có index cho query mới. | **PASS** | Đã xoá `hooks/useTaskStats.ts`, `components/dashboard/StatsGrid.tsx`, `components/dashboard/DeadlineTimeline.tsx`; `firestore.indexes.json:66-72` hợp lệ JSON, không trùng, có đúng index `isClosed ASC + updatedAt DESC` cho `queryRecentClosedTasks`. |
| **AC 7** | `npx tsc --noEmit` 0 lỗi; `npx vitest run` và `TZ=UTC npx vitest run` pass. | **PASS** | `npx tsc --noEmit` 0 lỗi; `npx vitest run` và `TZ=UTC npx vitest run` đều pass 10/10 test files (164/164 tests). |

---

## 2. Vòng sửa 1 (Khắc phục phản hồi của Claude Verifier)

1. **[CAO] Việc đã huỷ (`cancelled`) hoặc việc cũ `completedAt=null` không bị mất ở listener việc đã đóng (`lib/tasks/firestore.ts:455-464`, `hooks/useTasks.ts:80-136`):**
   - Sửa `queryRecentClosedTasks(sinceMs)` sang `where('isClosed', '==', true), where('updatedAt', '>=', Timestamp.fromMillis(sinceMs)), orderBy('updatedAt', 'desc')`.
   - Cập nhật `firestore.indexes.json:66-72` với composite index khớp chính xác: `tasks` (`isClosed ASC`, `updatedAt DESC`), xoá index `isClosed ASC, completedAt ASC` không còn dùng.

2. **[CAO] View theo văn bản / hồ sơ / chuỗi định kỳ không bị mất việc đã đóng >30 ngày (`hooks/useScopedTasks.ts`):**
   - Tạo `hooks/useScopedTasks.ts` cung cấp 3 hook riêng biệt: `useDocumentTasks(docId)`, `useDossierTasks(dossierId)`, `useSeriesTasks(seriesId?)`.
   - Thay thế `useTasks()` bằng hook tương ứng tại `components/documents/DocumentTaskSection.tsx`, `components/documents/DocumentModal.tsx`, `components/dossiers/DossierPanel.tsx`, `app/(app)/tasks/recurring/page.tsx`.

3. **[TRUNG BÌNH] Đồng bộ tuyệt đối con số trên Dashboard và danh sách mở ra ở `/tasks` (`lib/tasks/firestore.ts:327-414`, `components/tasks/TaskDashboard.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/tasks/page.tsx`):**
   - Bổ sung helper thuần `filterTasksByParams(tasks, params, now)` hỗ trợ `status=overdue|due7|open|done_week|done_month`, `departmentId=a,b`, `assigneeId` + `includeCollaborator=1`.

4. **[THẤP] `/tasks/kanban` ẩn `visibleFrom` tương lai và việc con (`app/(app)/tasks/kanban/page.tsx:19-21`).**

5. **[THẤP] `app/(app)/page.tsx` chỉ redirect sau khi `role` / `effectiveRole` đã xác định (`app/(app)/page.tsx:23-65`).**

---

## 3. Vòng sửa 2 (Khắc phục hồi quy Kanban + các lỗi nhỏ)

1. **[TRUNG BÌNH] Khắc phục hồi quy Kanban cho hoàn thành việc cha khi việc con đang mở (`components/tasks/KanbanBoard.tsx:36-41, 131-160, 246-249`, `app/(app)/tasks/kanban/page.tsx:39-44`, `app/(app)/tasks/page.tsx:413-418`):**
   - `KanbanBoard` nhận thêm prop tuỳ chọn `allTasks?: Task[]` (danh sách đầy đủ gồm cả việc con).
   - Tính `subtasksByParentId` và `subtaskStats` từ `allTasks ?? tasks`, trong khi danh sách thẻ hiển thị trên cột (`topLevelTasks`) vẫn chỉ lấy từ `tasks` đã lọc `isVisibleTask`.
   - Khi gọi `changeTaskStatus(task.id, targetStatus, actorCtx.actor, { subtasks: subtasksByParentId[task.id] ?? [] })`, truyền đầy đủ `subtasks` của việc cha xuống `mutations.ts`.
   - Truyền `allTasks={tasks}` ở `app/(app)/tasks/kanban/page.tsx:41` và `allTasks={allTasks}` ở `app/(app)/tasks/page.tsx:415`.
   - **Ghi chú kiểm tra `lib/tasks/mutations.ts` (không sửa file này):** tại `lib/tasks/mutations.ts:1039-1048`, hàm `changeTaskStatus` đã có cơ chế fallback tự đọc việc con từ Firestore (`getDocs(query(collection(db(), TASKS), where('parentTaskId', '==', taskId)))`) khi `!opts?.subtasks && !task.parentTaskId`. Việc truyền sẵn `subtasks` từ `KanbanBoard` vừa giúp chặn ngay ở client (`KanbanBoard.tsx:237`) vừa tránh tốn thêm 1 lượt đọc Firestore trong `changeTaskStatus`.

2. **[THẤP] Việc vừa đóng không bị biến mất tạm thời khi `updatedAt` là `serverTimestamp()` đang chờ (`lib/tasks/firestore.ts:122-185, 565-586`, `hooks/useTasks.ts:56-64, 85-124`):**
   - Trong `subscribeToQuery` (`lib/tasks/firestore.ts:573`), đọc snapshot với `d.data({ serverTimestamps: 'estimate' })` để các ghi cục bộ đang chờ (`serverTimestamp()`) luôn có timestamp ước lượng tức thì và đồng thời trả về `meta.deletedIds` cho những doc vừa xoá mềm.
   - Bổ sung hàm thuần `mergeTaskSnapshots(openTasks, closedTasks, previousTasks, deletedIds)` (`lib/tasks/firestore.ts:134-185`) dùng trong `rebuildMergedTasks` (`hooks/useTasks.ts:56-64`):
     - Nếu một task vừa rời `openTasks` (do chuyển sang `isClosed=true`) mà chưa kịp xuất hiện trong `closedTasks` (và không nằm trong `deletedIds`), giữ lại bản cuối cùng của task đó từ `previousTasks` với `isClosed: true` và `status` tương ứng cho tới khi listener đã đóng trả về.
     - Nếu cả 2 listener cùng chứa 1 task trong tích tắc chuyển tiếp, ưu tiên bản đóng có `updatedAt` mới hơn hoặc đang pending (`null`).
   - Có unit test thuần cho `mergeTaskSnapshots` tại `__tests__/tasks/statsAndVisibility.test.ts:518-569`.

3. **[THẤP] Thống kê tháng không bị thiếu ở tháng 31 ngày (`lib/tasks/firestore.ts:112-120, 455-464`, `hooks/useTasks.ts:82`):**
   - Thêm helper thuần `getClosedTasksSinceMs(now)` tính `Math.min(nowMs - THIRTY_DAYS_MS, monthStartMs)` (với `monthStartMs` là 00:00 ngày 1 đầu tháng hiện tại theo giờ `Asia/Ho_Chi_Minh`).
   - Dùng `getClosedTasksSinceMs` trong `startSharedListeners` (`hooks/useTasks.ts:82`) và mặc định của `queryRecentClosedTasks` (`lib/tasks/firestore.ts:456`).
   - Có unit test tại `__tests__/tasks/statsAndVisibility.test.ts:500-516`.

4. **[THẤP] `useScopedTasks` reset state ngay khi đổi ID (`hooks/useScopedTasks.ts:36-37, 84-85, 133-134`):**
   - Gọi `setTasks([])` + `setLoading(true)` ở đầu `useEffect` trong cả 3 hook `useDocumentTasks`, `useDossierTasks`, `useSeriesTasks` khi `documentId` / `dossierId` / `seriesId` thay đổi.

5. **[THẤP] Hiển thị chip mô tả bộ lọc ẩn ở `/tasks` kèm nút `"×"` xoá từng bộ lọc và cập nhật URL (`app/(app)/tasks/page.tsx:86-184, 355-398`):**
   - Khi URL có `status` đặc biệt (`overdue | due7 | open | done_week | done_month`), `departmentId` nhiều giá trị (`a,b`), hoặc `includeCollaborator=1`, hiển thị hàng chip `"Đang lọc theo:"` phía trên danh sách công việc (trong `app/(app)/tasks/page.tsx`, không sửa `TaskFilters.tsx`).
   - Mỗi chip có nút `"×"` xoá riêng bộ lọc đó và gọi `updateUrlParams` (`router.replace`) để cập nhật URL.

6. **[Test] Kiểm tra với số tuyệt đối cho cả `computeTaskStats` và `filterTasksByParams` (`__tests__/tasks/statsAndVisibility.test.ts:364-496`):**
   - Kiểm tra trực tiếp bằng số tuyệt đối trên bộ dữ liệu mẫu cố định (`total = 8`, `overdue = 2`, `due7 = 1`, `open = 4`, `pending = 1`, `in_progress = 2`, `blocked = 1`, `done_week = 1`, `done_month = 2`, `completed = 3`, `cancelled = 1`), bao gồm cả phạm vi đa khoa (`departmentId = 'dept-a,dept-b'`) và cá nhân (`includeCollaborator = 1`).

---

## 4. Danh sách Index Firestore cần deploy (`firestore.indexes.json`)

Khi deploy lên môi trường Firestore, cần đảm bảo index sau trên collection `tasks` được deploy (`firebase deploy --only firestore:indexes`):
- Collection `tasks`: `isClosed ASC` + `updatedAt DESC` (dùng cho `queryRecentClosedTasks`).

---

## 5. Danh sách file đã sửa / thêm / xoá

- **Đã sửa:**
  - `lib/tasks/firestore.ts`
  - `hooks/useTasks.ts`
  - `hooks/useScopedTasks.ts`
  - `components/tasks/KanbanBoard.tsx`
  - `components/tasks/TaskDashboard.tsx`
  - `app/(app)/dashboard/page.tsx`
  - `app/(app)/tasks/page.tsx`
  - `app/(app)/tasks/all/page.tsx`
  - `app/(app)/tasks/calendar/page.tsx`
  - `app/(app)/tasks/kanban/page.tsx`
  - `app/(app)/tasks/recurring/page.tsx`
  - `components/documents/DocumentTaskSection.tsx`
  - `components/documents/DocumentModal.tsx`
  - `components/dossiers/DossierPanel.tsx`
  - `app/(app)/page.tsx`
  - `firestore.indexes.json`
- **Đã thêm mới:**
  - `hooks/useScopedTasks.ts`
  - `__tests__/tasks/statsAndVisibility.test.ts`
  - `handoff/tasks/T-122-REPORT.md`
  - `handoff/tasks/T-122-dashboard-va-truy-van-REPORT.md`
- **Đã xoá:**
  - `hooks/useTaskStats.ts`
  - `components/dashboard/StatsGrid.tsx`
  - `components/dashboard/DeadlineTimeline.tsx`

---

## 6. Output kiểm tra cuối cùng

### `npx tsc --noEmit`
```text
(0 errors)
```

### `npx vitest run` & `TZ=UTC npx vitest run`
```text
 RUN  v4.1.9 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office

 ✓ __tests__/tasks/progress.test.ts (15 tests)
 ✓ __tests__/tasks/permissions.test.ts (34 tests)
 ✓ __tests__/recurrence/generate.test.ts (20 tests)
 ✓ __tests__/tasks/validation.test.ts (30 tests)
 ✓ __tests__/tasks/statsAndVisibility.test.ts (19 tests)
 ✓ __tests__/tasks/notifications.test.ts (3 tests)
 ✓ __tests__/tasks/workflowCore.test.ts (15 tests)
 ✓ lib/link-detector.test.ts (6 tests)
 ✓ __tests__/tasks/documentSync.test.ts (6 tests)
 ✓ __tests__/recurrence/buildOccurrence.test.ts (16 tests)

 Test Files  10 passed (10)
      Tests  164 passed (164)
```

## 7. Điểm chưa chắc / cần Claude quyết
- Không có. Mọi điểm trong Vòng sửa 2 đã được xử lý đầy đủ và chờ Claude verify.
