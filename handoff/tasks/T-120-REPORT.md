# Báo cáo thực hiện T-120 — Lõi luồng công việc: tạo việc đầy đủ, một hàm đổi trạng thái, quyền giao việc

- **Trạng thái:** chờ verify
- **Task ID:** `T-120-luong-cong-viec-loi`

## 1. Danh sách file đã sửa / tạo / xoá
- **Tạo mới:**
  - `lib/tasks/documentSync.ts`
  - `__tests__/tasks/documentSync.test.ts`
  - `__tests__/tasks/workflowCore.test.ts`
  - `handoff/tasks/T-120-REPORT.md`
- **Đã sửa:**
  - `types/index.ts` (CHỈ thêm `taskIds?: string[]` vào `Document` tại dòng 114)
  - `lib/tasks/mutations.ts`
  - `lib/tasks/validation.ts`
  - `lib/tasks/dependencies.ts`
  - `lib/tasks/permissions.ts`
  - `components/tasks/TaskCreateForm.tsx`
  - `components/tasks/TaskDetail.tsx`
  - `components/tasks/KanbanBoard.tsx`
  - `components/tasks/TaskBulkActions.tsx`
  - `components/tasks/SubtaskList.tsx`
  - `components/documents/DocumentTaskSection.tsx`
- **Đã xoá:**
  - `components/tasks/TaskForm.tsx`
  - `components/tasks/BulkActionsBar.tsx`

## 2. Lệnh kiểm tra đã chạy & Kết quả
- `npx tsc --noEmit` → **PASS** (Exit code 0, không có lỗi TypeScript).
- `npx vitest run` → **PASS** (`10 passed (10)`, `155 passed (155)`).

## 3. Tự kiểm từng tiêu chí nghiệm thu (PASS/FAIL + bằng chứng)

1. **Tạo việc có phụ thuộc chưa xong → lưu `blocked/dependency` và `dependsOnTaskIds`; hoàn thành việc tiên quyết → việc kia tự về trạng thái trước.**
   - **Kết quả:** PASS
   - **Bằng chứng:**
     - `lib/tasks/mutations.ts:153-305` (`buildCreateTaskPayload`) và `lib/tasks/mutations.ts:624-640` (`createTask` gọi `checkDependenciesCompleted(input.dependsOnTaskIds)` → gán `status: 'blocked'`, `blockedReason: 'dependency'`, `blockedByTaskIds`, `previousStatus`).
     - `lib/tasks/dependencies.ts:49-125` (`resolveBlockedDependencies` khôi phục `task.previousStatus || 'pending'`, xoá `blockedReason/blockedByTaskIds/blockedNote/previousStatus`, ghi `UNBLOCKED`).
     - `lib/tasks/mutations.ts:880` (`changeTaskStatus`) và `lib/tasks/mutations.ts:1272` (`bulkUpdateTasks`) gọi `resolveBlockedDependencies`.

2. **Grep: không còn `updateTaskStatus(`/`updateDoc` trực tiếp trường `status` của task ngoài `changeTaskStatus` (trừ mutation nội bộ); Kanban không còn bước `blocked` giả.**
   - **Kết quả:** PASS
   - **Bằng chứng:**
     - Grep trong `lib/tasks/`, `components/tasks/`, `components/documents/`: không còn lời gọi `updateTaskStatus(`.
     - `components/tasks/KanbanBoard.tsx:201-215`: gọi trực tiếp `changeTaskStatus(draggedTask.id, targetStatus, ...)` và hiển thị thông báo lỗi tiếng Việt nếu chuyển trạng thái không hợp lệ; đã bỏ hoàn toàn bước trung gian `blocked` giả.

3. **Không hoàn thành được việc cha khi còn việc con chưa xong (mọi đường: chi tiết, Kanban, bulk, văn bản).**
   - **Kết quả:** PASS
   - **Bằng chứng:**
     - `lib/tasks/validation.ts:39-57` (`validateStatusChange` kiểm tra `hasIncompleteSubtasks` trước tiên và trả lỗi tiếng Việt).
     - `lib/tasks/mutations.ts:346-365` (`planStatusChange`) và `lib/tasks/mutations.ts:822-842` (`changeTaskStatus` truy vấn subtasks của task cha).
     - Mọi đường (`TaskDetail.tsx:411`, `KanbanBoard.tsx:201`, `TaskBulkActions.tsx:66` → `bulkUpdateTasks`, `DocumentTaskSection.tsx:76`, `SubtaskList.tsx:68`) đều đi qua `changeTaskStatus` / `planStatusChange`.

4. **Mở lại việc xoá `completedAt`, `isClosed=false`.**
   - **Kết quả:** PASS
   - **Bằng chứng:** `lib/tasks/mutations.ts:395-407` & `859-861` (`clearCompletedAt = true` → `updateData.completedAt = null`, `updates.isClosed = false`, tính lại `progress` theo subtask mode hoặc đưa về `0` nếu đang `100`, ghi activity `REOPENED`).

5. **Hoàn thành việc định kỳ bằng Kanban/bulk cũng gọi sinh kỳ tiếp.**
   - **Kết quả:** PASS
   - **Bằng chứng:** `lib/tasks/mutations.ts:882-893` (`changeTaskStatus` gọi `generateNextCompletionOccurrence`) và `lib/tasks/mutations.ts:1275-1288` (`bulkUpdateTasks` gọi `generateNextCompletionOccurrence` cho mọi việc có `seriesId` chuyển sang `completed`).

6. **Người không có `task:assign` không thấy/không đổi được người được giao; giao lại có thông báo và cập nhật `assigneeDepartmentId`.**
   - **Kết quả:** PASS
   - **Bằng chứng:**
     - `lib/tasks/permissions.ts:83-101` (`canAssignTask` kiểm tra `matrixPerms['task:assign']`).
     - `components/tasks/TaskDetail.tsx:212,752`: dùng `_canAssign = canAssignTask(userCtx, taskCtx, matrixPerms)` cho dropdown chọn người xử lý chính và truyền `assigneeDepartmentId`.
     - `components/tasks/TaskBulkActions.tsx:44,129`: kiểm tra `_canAssign` để ẩn nút "Giao cho" nếu không có quyền `task:assign`.
     - `lib/tasks/mutations.ts:996-1035` (`updateTask` cập nhật `assigneeName`, `assigneeDepartmentId`, ghi activity `REASSIGNED` và gửi thông báo `TASK_ASSIGNED`).

7. **`DocumentTaskSection`: thêm việc mở drawer; xoá việc có xác nhận + kiểm quyền; các nút chỉ hiện khi hover có class `hover-reveal`.**
   - **Kết quả:** PASS
   - **Bằng chứng:** `components/documents/DocumentTaskSection.tsx:93-125,229-302` (mở `TaskCreateDrawer` điền sẵn văn bản; `handleDelete` kiểm `canDeleteTask` + `confirm(...)`; các nút `ExternalLink` và `Trash2` có class `hover-reveal`).

8. **Đổi trạng thái việc có `documentIds` (hoặc tạo/xoá/gắn/gỡ việc với văn bản) → `Document.status` và `completedDate` tự cập nhật đúng quy tắc; `Document.taskIds` khớp 2 chiều; văn bản không việc giữ nguyên trạng thái.**
   - **Kết quả:** PASS
   - **Bằng chứng:**
     - `lib/tasks/documentSync.ts:32-62` (`deriveDocumentStatus`), `92-121` (`syncDocumentTaskLinks` dùng `arrayUnion`/`arrayRemove`), `127-171` (`syncDocumentsFromTasks` cập nhật `status` và `completedDate`).
     - Được gọi tại `lib/tasks/mutations.ts:696-700` (`createTask`), `897-899` (`changeTaskStatus`), `1081-1089` (`updateTask` khi `documentIds` đổi), `1145-1149` (`deleteTask`), `1291-1293` (`bulkUpdateTasks`), `1350-1356` (`bulkDeleteTasks`).

9. **Không còn `TaskForm.tsx`, `BulkActionsBar.tsx`.**
   - **Kết quả:** PASS
   - **Bằng chứng:** Đã xoá `components/tasks/TaskForm.tsx` và `components/tasks/BulkActionsBar.tsx`.

10. **`npx tsc --noEmit` và `npx vitest run` xanh.**
    - **Kết quả:** PASS
    - **Bằng chứng:** `npx tsc --noEmit` trả về 0 lỗi; `npx vitest run` pass 10/10 test files (155/155 tests).

---

## 4. Vòng sửa 1 (Claude verifier: AC2, AC3 PARTIAL + lỗi trung bình)

1. **Bỏ qua quyền vì mặc định admin — mặc định vai trò ít quyền nhất (`'nhan_vien'`) & truyền đủ actor context:**
   - `lib/tasks/permissions.ts:26-152`: thêm `normalizeTaskActorRole` (mặc định `'staff'`, không bao giờ mặc định `'admin'`), `extractActorDepartmentIds`, `buildTaskMatrixPerms`, `buildTaskActorContext` (mặc định `rawRole = 'nhan_vien'`).
   - `lib/tasks/mutations.ts:122-147` (`normalizeActorContext`), `lib/tasks/mutations.ts:1126-1129` (`updateTaskStatus`), `lib/tasks/mutations.ts:1452-1458` (`bulkUpdateTasks`): mặc định `role: 'nhan_vien'` (`'staff'`), xoá hoàn toàn fallback `'admin'`.
   - `components/tasks/KanbanBoard.tsx:67-84,217-222`: dùng `useRole`, `useOrganization`, `buildTaskActorContext` truyền đủ `actorCtx.actor` (`role`, `departmentIds`, `matrixPerms`).
   - `components/tasks/SubtaskList.tsx:69-83,124-129`: dùng `useRole`, `useOrganization`, `buildTaskActorContext` truyền đủ `actorCtx.actor`.
   - `components/documents/DocumentTaskSection.tsx:31-65,77-82`: dùng `buildTaskActorContext` lấy `departmentIds` thực từ `currentStaff` (thay vì `[]`) và truyền `actorCtx.actor`.
   - `components/tasks/TaskBulkActions.tsx:49-67`: dùng `buildTaskActorContext`.
   - `components/tasks/TaskDetail.tsx:186-214,302-314`: dùng `buildTaskActorContext` kết hợp `currentStaff` và `fallbackDepartmentIds`.
   - Unit test: `__tests__/tasks/workflowCore.test.ts:281-309`.

2. **`updateTaskStatus` (AC2):**
   - `lib/tasks/mutations.ts:1119-1136`: biến `updateTaskStatus` thành wrapper mỏng gọi `changeTaskStatus` với `actor` bắt buộc (mặc định vai trò ít quyền nhất `'nhan_vien'`, không mặc định `'admin'`); `changeTaskStatus` (`lib/tasks/mutations.ts:1025-1057`) ném `Error` có message tiếng Việt để caller hiển thị.

3. **Việc con đã huỷ không chặn hoàn thành việc cha:**
   - `lib/tasks/validation.ts:26-43`: thêm helper dùng chung `isSubtaskClosed` (`Boolean(subtask.isClosed || CLOSED_STATUSES.includes(subtask.status))`) và `hasIncompleteSubtasksFromList`.
   - `lib/tasks/mutations.ts:369-371` (`planStatusChange`): dùng `hasIncompleteSubtasksFromList(opts.subtasks)`.
   - `components/tasks/KanbanBoard.tsx:120-137`: dùng `isSubtaskClosed`, `hasIncompleteSubtasksFromList`, `computeParentSubtaskProgress`.
   - Unit test: `__tests__/tasks/workflowCore.test.ts:311-333`.

4. **Bulk vượt 500 thao tác/batch — đếm số thao tác thực tế và cắt batch tại 450:**
   - `lib/tasks/mutations.ts:650-683`: thêm `MAX_BATCH_OPS = 450`, `countPlannedBulkItemOps` (`1 + item.activities.length + (item.notifyAssigneeId ? 1 : 0)`), `chunkPlannedBulkItemsByOps`.
   - `lib/tasks/mutations.ts:1476-1527`: dùng `chunkPlannedBulkItemsByOps(planned, MAX_BATCH_OPS)` trong `bulkUpdateTasks`.
   - Unit test: `__tests__/tasks/workflowCore.test.ts:422-449`.

5. **Lỗi bị nuốt trong `SubtaskList.tsx` — hiển thị lỗi cho người dùng:**
   - `components/tasks/SubtaskList.tsx:94,113,131,141,194,220,242,257,275,299,306-318`: thêm state `errorMsg`, gán message lỗi tiếng Việt trong `catch` của `handleToggle`, `handleAdd`, `handleSaveEdit`, `handleSubtaskMetaUpdate`, `handleDelete`, `handleMove`, `handleDrop` và hiển thị banner lỗi màu đỏ có nút đóng giống `TaskDetail`.

6. **Không tin trạng thái `blocked` từ client trong `buildCreateTaskPayload`:**
   - `lib/tasks/mutations.ts:216-247`: khi có `dependsOnTaskIds`, trạng thái `blocked` và `blockedByTaskIds` chỉ được quyết định bởi kết quả `checkDependenciesCompleted` từ server (`uncompletedDepIds`), bỏ qua `blockedReason`/`blockedByTaskIds` do client gửi.
   - `components/tasks/TaskCreateForm.tsx:396-399`: bỏ gán `input.status = 'blocked'` / `blockedReason` / `blockedByTaskIds` phía client.
   - Unit test: `__tests__/tasks/workflowCore.test.ts:360-375`.

7. **`updateTask` không đặt `blocked` cho việc đã đóng + gộp logic khôi phục khỏi `blocked`:**
   - `lib/tasks/mutations.ts:688-754`: thêm `buildUnblockRestoreFields` và `planDependencyStatusUpdate` — chỉ tự chặn khi công việc đang mở (`pending`/`in_progress`/`blocked` và `!isClosed`); việc `completed`/`cancelled` khi thêm phụ thuộc chỉ lưu `dependsOnTaskIds`, không đổi trạng thái.
   - `lib/tasks/mutations.ts:1174`: gọi `Object.assign(updateData, planDependencyStatusUpdate(existingTask, pendingDepIds))`.
   - Unit test: `__tests__/tasks/workflowCore.test.ts:377-420`.

8. **Tiến độ việc cha tính lại ở server (`changeTaskStatus`, `bulkUpdateTasks`, `createTask`, `deleteTask`, `bulkDeleteTasks`):**
   - `lib/tasks/validation.ts:51-58`: thêm `computeParentSubtaskProgress` (loại việc con `cancelled` khỏi mẫu số).
   - `lib/tasks/mutations.ts:413-415` (`planStatusChange`), `lib/tasks/mutations.ts:808-848` (`recalculateParentSubtaskProgress`), được gọi tại `lib/tasks/mutations.ts:1009-1011` (`createTask`), `1106-1108` (`changeTaskStatus`), `1374-1376` (`deleteTask`), `1548-1558` (`bulkUpdateTasks`), `1646-1648` (`bulkDeleteTasks`).
   - `components/tasks/SubtaskList.tsx:102-105`: dùng `computeParentSubtaskProgress`.
   - Unit test: `__tests__/tasks/workflowCore.test.ts:335-358`.

9. **Thay `buildDependencyGraphFromFirestore` đọc toàn bộ collection bằng BFS (`getTasksByIds`, giới hạn độ sâu 50):**
   - `lib/tasks/mutations.ts:89,760-802,1162`: thêm `MAX_DEPENDENCY_BFS_DEPTH = 50` và `buildDependencyGraphBFS(seedTaskIds, maxDepth)` duyệt theo `dependsOnTaskIds` qua `getTasksByIds`.

10. **`DocumentTaskSection` không thử `cancelled -> completed` khi tick việc đã huỷ:**
    - `components/documents/DocumentTaskSection.tsx:64,177-215`: chặn sớm `if (task.status === 'cancelled') return` trong `handleToggle`, thêm `disabled={isCancelled}` cho checkbox và hiển thị nhãn `Đã hủy`.

11. **Xoá khối "guard progress" chết trong `updateTask`:**
    - Đã xoá khối `if (fields.progress !== undefined) { ... }` không làm gì trong `updateTask` (`lib/tasks/mutations.ts:~1197`).
