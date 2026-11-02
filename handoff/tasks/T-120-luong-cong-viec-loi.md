# T-120 — Lõi luồng công việc: tạo việc đầy đủ, một hàm đổi trạng thái, quyền giao việc

Đọc và tuân thủ `handoff/tasks/_RULES.md`.

## Bối cảnh (đã kiểm trong code)
- `createTask` (`lib/tasks/mutations.ts` ~33-117) gán cứng `status:'pending'`, `dependsOnTaskIds:[]`, `blockedReason:null`, `blockedByTaskIds:[]`, `estimatedMinutes:null`, `templateId:null`, `assigneeDepartmentId:null`, dù `TaskCreateForm.tsx` (~381-394) có gửi các trường này → chọn "phụ thuộc" lúc tạo bị mất, cơ chế tự mở khoá (`lib/tasks/dependencies.ts`) không bao giờ chạy; tạo từ mẫu vẫn `source='manual'`. Người phối hợp không được thông báo.
- Đổi trạng thái đi qua nhiều đường bỏ qua máy trạng thái: `SubtaskList.tsx` (~42,55) và `components/documents/DocumentTaskSection.tsx` (~37) chuyển thẳng `pending→completed`; `KanbanBoard.tsx` (~200-205) chèn bước `blocked` giả để về `pending`; `bulkUpdateTasks` (`mutations.ts` ~355-378) không kiểm hợp lệ, không xoá trường blocked, không gọi `resolveBlockedDependencies`, luôn ghi `STATUS_CHANGED`. `validateStatusChange` và `detectDependencyCycle` (`lib/tasks/validation.ts`) không được gọi ở đâu. `generateNextCompletionOccurrence` chỉ gọi trong `TaskDetail.tsx:278`.
- Mở lại việc (`completed→pending`) không xoá `completedAt`, giữ `progress=100` (`mutations.ts` ~178-181).
- Giao lại việc trong `TaskDetail.tsx` (~650-658) kiểm quyền bằng `_canEdit` thay vì `canAssignTask`; `updateTask` không thông báo người nhận mới, không cập nhật `assigneeDepartmentId`, ghi đổi tiêu đề thành `STATUS_CHANGED` (~142-146).
- Thêm việc nhanh trong `DocumentTaskSection.tsx` (~52-57) không có người giao/hạn; nút xoá (~69-71) không xác nhận, không kiểm quyền.
- Code chết: `components/tasks/TaskForm.tsx`, `components/tasks/BulkActionsBar.tsx` không được import.

## Được sửa
`lib/tasks/mutations.ts`, `lib/tasks/validation.ts`, `lib/tasks/dependencies.ts`, `lib/tasks/permissions.ts`, mới `lib/tasks/documentSync.ts`, `types/index.ts` (CHỈ thêm `taskIds` vào `Document`), `components/tasks/TaskDetail.tsx`, `components/tasks/KanbanBoard.tsx`, `components/tasks/TaskBulkActions.tsx`, `components/tasks/SubtaskList.tsx`, `components/tasks/TaskCreateForm.tsx`, `components/documents/DocumentTaskSection.tsx`, xoá `components/tasks/TaskForm.tsx` và `components/tasks/BulkActionsBar.tsx`, `__tests__/tasks/*`.
KHÔNG sửa: `lib/tasks/series.ts`, `lib/recurrence/*`, `hooks/useTasks.ts`, `lib/tasks/firestore.ts`, các trang `app/(app)/tasks/*`, dashboard.

## Yêu cầu
1. **createTask đầy đủ:** lưu đúng mọi trường của `CreateTaskInput` (status ban đầu, `estimatedMinutes`, `templateId`, `dependsOnTaskIds`, `startDate`…). Nếu có `dependsOnTaskIds` chưa hoàn thành (dùng `checkDependenciesCompleted`) → `status:'blocked'`, `blockedReason:'dependency'`, `blockedByTaskIds` = các việc chưa xong. `assigneeDepartmentId` = `primaryDepartmentId` của người được giao (truyền vào từ form, form lấy từ danh sách staff). Có `templateId` → `source:'template'`. Thông báo `TASK_ASSIGNED` cho người được giao và người phối hợp (`collaboratorIds`, trừ chính người tạo).
2. **Một hàm `changeTaskStatus(taskId, toStatus, actor, opts?)`** trong `mutations.ts` — nguồn duy nhất cho mọi đổi trạng thái:
   - đọc task, kiểm `canChangeStatus` (hoặc là người được giao với `complete_assigned`), `isValidTransition`, `validateStatusChange` (việc con chưa xong → chặn hoàn thành việc cha, trả lỗi tiếng Việt rõ ràng);
   - `completed`: set `completedAt`, `progress=100`, `isClosed=true`, gọi `resolveBlockedDependencies`, nếu task có `seriesId` thì gọi `generateNextCompletionOccurrence` (import từ `lib/tasks/series.ts`, KHÔNG sửa file đó);
   - mở lại từ `completed/cancelled`: xoá `completedAt`, `isClosed=false`, `progress` về giá trị tính lại (subtask mode) hoặc giữ nếu <100 thì 0;
   - rời `blocked`: xoá `blockedReason/blockedByTaskIds/blockedNote`, khôi phục `previousStatus` nếu đích là `previousStatus`;
   - ghi activity đúng loại (`COMPLETED`, `REOPENED`, `BLOCKED`, `UNBLOCKED`, `STATUS_CHANGED`).
   Thay toàn bộ chỗ đổi trạng thái trong `TaskDetail`, `KanbanBoard` (bỏ bước `blocked` giả — cho phép chuyển trực tiếp nếu `VALID_TRANSITIONS` cho phép, còn không thì báo lỗi), `SubtaskList`, `DocumentTaskSection`, `TaskBulkActions` bằng hàm này.
3. **Bulk:** `bulkUpdateTasks` khi có `status` thì xử lý từng việc qua cùng logic (có thể gom batch), bỏ qua việc không hợp lệ và trả `{ updated, skipped: [{id, reason}] }`; UI hiện "Đã cập nhật X, bỏ qua Y (lý do…)". Chỉ ghi `STATUS_CHANGED` khi status thật sự đổi.
4. **Quyền giao việc + thông báo:** ô chọn người giao trong `TaskDetail` và bulk dùng `canAssignTask`. `updateTask` khi đổi `assigneeId` → cập nhật `assigneeName`, `assigneeDepartmentId`, ghi activity `REASSIGNED`, thông báo `TASK_ASSIGNED` cho người mới. Đổi tiêu đề/mô tả không ghi `STATUS_CHANGED` (dùng loại phù hợp hoặc bỏ). Thêm/sửa phụ thuộc → kiểm `detectDependencyCycle`, có vòng thì chặn với thông báo tiếng Việt.
5. **Việc con kế thừa:** khi tạo việc con (`TaskCreateForm` ~400-410, `SubtaskList`): mặc định `assigneeId`, `departmentId`, `dueDate` của việc cha (sửa riêng được). Việc cha có ≥1 việc con → `progressMode:'subtask'`; tiến độ chỉ tự tính khi ở chế độ này.
6. **DocumentTaskSection:** ô thêm nhanh mở `TaskCreateDrawer` có sẵn với văn bản điền trước (thay vì tạo việc trống); nút xoá kiểm `canDeleteTask` và hỏi xác nhận; các nút chỉ hiện khi hover thêm class `hover-reveal`.
7. Xoá `TaskForm.tsx`, `BulkActionsBar.tsx`.
8. **Tự đồng bộ trạng thái văn bản theo công việc** (anh Khôi đã chốt 02/11/2026: "Có, tự đồng bộ"). Hiện `Document.status` và Task ghi sổ độc lập. Làm:
   - Mới `lib/tasks/documentSync.ts`:
     - Hàm thuần `deriveDocumentStatus(current: DocumentStatus, linkedTasks: Pick<Task,'status'|'deletedAt'|'parentTaskId'>[]): DocumentStatus | null` (null = không đổi). Chỉ xét việc gốc (`parentTaskId == null`), chưa xoá. Quy tắc:
       - `current` ∈ {`uploading`, `upload_failed`} → null (không động vào trạng thái upload).
       - Không còn việc liên kết → null (giữ nguyên, không tự lùi).
       - Có ≥1 việc mở (`pending/in_progress/blocked`) → `in_progress` (kể cả khi văn bản đang `completed` — mở lại văn bản).
       - Tất cả việc đã đóng và ≥1 `completed` → `completed`.
       - Tất cả đều `cancelled` → null.
     - `syncDocumentsFromTasks(docIds: string[])`: với mỗi docId, query `tasks` `where('documentIds','array-contains',docId)`, gọi `deriveDocumentStatus`, nếu khác thì `updateDoc` văn bản: `status`, và `completedDate = serverTimestamp()` khi sang `completed` / `completedDate = null` khi rời `completed`. Lỗi đồng bộ chỉ `console.warn`, không làm hỏng thao tác chính.
   - Gọi `syncDocumentsFromTasks` sau khi commit trong: `createTask` (documentIds của việc mới), `changeTaskStatus`, `bulkUpdateTasks` (gom docIds của các việc đổi trạng thái), `deleteTask`/`bulkDeleteTasks`, và `updateTask` khi `documentIds` đổi (đồng bộ cả văn bản được thêm lẫn văn bản bị gỡ — TaskDetail gắn/gỡ văn bản đều đi qua `updateTask` qua `handleUpdateFields`).
   - Thêm `taskIds?: string[]` vào `Document` trong `types/index.ts` (được sửa CHỈ dòng này): `createTask` / `updateTask` (documentIds đổi) / xoá việc cập nhật `arrayUnion`/`arrayRemove` taskId vào văn bản tương ứng, để liên kết có 2 chiều.
   - Test thuần cho `deriveDocumentStatus` (đủ các nhánh trên).
9. **Test** (`__tests__/tasks/`): logic thuần tách ra để test được — tính payload createTask (blocked khi có phụ thuộc chưa xong, source template), quyết định chuyển trạng thái (chặn hoàn thành cha khi con mở; mở lại xoá completedAt; rời blocked xoá trường), bulk trả skipped.

## Tiêu chí nghiệm thu
1. Tạo việc có phụ thuộc chưa xong → lưu `blocked/dependency` và `dependsOnTaskIds`; hoàn thành việc tiên quyết → việc kia tự về trạng thái trước.
2. Grep: không còn `updateTaskStatus(`/`updateDoc` trực tiếp trường `status` của task ngoài `changeTaskStatus` (trừ mutation nội bộ); Kanban không còn bước `blocked` giả.
3. Không hoàn thành được việc cha khi còn việc con chưa xong (mọi đường: chi tiết, Kanban, bulk, văn bản).
4. Mở lại việc xoá `completedAt`, `isClosed=false`.
5. Hoàn thành việc định kỳ bằng Kanban/bulk cũng gọi sinh kỳ kế tiếp.
6. Đổi người giao → thông báo người mới + activity `REASSIGNED`; người không có quyền `task:assign` không thấy ô đổi người giao.
7. Tạo phụ thuộc vòng bị chặn.
8. `TaskForm.tsx`, `BulkActionsBar.tsx` đã xoá, không còn import.
9. Giao việc từ văn bản "Chờ xử lý" → văn bản thành "Đang xử lý"; hoàn thành việc cuối cùng (bằng bất kỳ đường nào: chi tiết, Kanban, bulk, ô tick văn bản) → văn bản "Hoàn thành" có `completedDate`; mở lại 1 việc → văn bản về "Đang xử lý", `completedDate` null; văn bản đang `uploading/upload_failed` không bị đổi. Văn bản có `taskIds` khớp các việc liên kết.
10. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass (test cũ + test mới).
