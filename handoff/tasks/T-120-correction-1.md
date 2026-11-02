# T-120 — Sửa vòng 1 (Claude verifier: AC2, AC3 PARTIAL + lỗi trung bình)

Tuân thủ `handoff/tasks/_RULES.md`. Được sửa: `lib/tasks/mutations.ts`, `lib/tasks/validation.ts`, `lib/tasks/dependencies.ts`, `lib/tasks/permissions.ts`, `lib/tasks/documentSync.ts`, `components/tasks/TaskDetail.tsx`, `components/tasks/KanbanBoard.tsx`, `components/tasks/TaskBulkActions.tsx`, `components/tasks/SubtaskList.tsx`, `components/tasks/TaskCreateForm.tsx`, `components/documents/DocumentTaskSection.tsx`, `__tests__/tasks/*`. KHÔNG sửa `components/dossiers/*`, `components/documents/DocumentModal.tsx` (task khác đang sửa song song).

1. **Bỏ qua quyền vì mặc định admin — `mutations.ts:~124` `normalizeActorContext`:** `actor.role || 'admin'` + `KanbanBoard.tsx:~207`, `SubtaskList.tsx:~107` chỉ truyền `{id,name}`; `bulkUpdateTasks` (~1265), `updateTaskStatus` (~915) cũng mặc định admin → mọi nhân viên được coi là admin. Sửa: mặc định vai trò **ít quyền nhất** (`'nhan_vien'`); Kanban, SubtaskList, DocumentTaskSection, TaskBulkActions truyền đủ `role`, `departmentIds`, ma trận quyền giống TaskDetail (tạo helper `useTaskActor()` trong một file được sửa, vd export từ `lib/tasks/permissions.ts` + hook nhỏ trong component, hoặc mới `hooks/useTaskActor.ts`). `DocumentTaskSection` đang truyền `departmentIds: []` → sửa.
2. **`updateTaskStatus` còn tồn tại (AC2):** xoá hẳn hoặc biến thành wrapper gọi `changeTaskStatus` với actor bắt buộc (không mặc định). (Chỗ gọi còn lại ở `DossierPanel.tsx:~309` do task T-113 sửa — đảm bảo chữ ký `changeTaskStatus(taskId, toStatus, actor)` ném lỗi có message tiếng Việt để caller hiển thị.)
3. **Việc con đã huỷ chặn hoàn thành việc cha — `mutations.ts:~356`, `KanbanBoard.tsx:~113`:** "chưa xong" = `!(isClosed || status ∈ CLOSED_STATUSES)`. Dùng một helper chung trong `validation.ts`. Thêm test.
4. **Bulk vượt 500 thao tác/batch — `mutations.ts:~1286` (CHUNK 200 × 3 thao tác khi giao lại):** đếm số thao tác thực tế cho mỗi việc và cắt batch khi đạt 450. Thêm test cho hàm chia batch.
5. **Lỗi bị nuốt — `SubtaskList.tsx:~119-122`, `handleAdd`, `handleDelete`:** hiển thị lỗi cho người dùng (cùng cách TaskDetail đang hiện lỗi), không chỉ console.
6. **Tin trạng thái blocked từ client — `mutations.ts:~204-209` `buildCreateTaskPayload`:** khi có `dependsOnTaskIds`, trạng thái blocked/`blockedByTaskIds` chỉ lấy từ kết quả `checkDependenciesCompleted` phía server; bỏ qua `blockedReason/blockedByTaskIds` do form gửi.
7. **`updateTask` đặt blocked cho việc đã đóng — `mutations.ts:~951-957`:** chỉ tự chặn khi việc đang mở (`pending/in_progress`); việc `completed/cancelled` thêm phụ thuộc thì chỉ lưu `dependsOnTaskIds`, không đổi trạng thái. Gộp logic khôi phục khỏi blocked đang lặp ở ~958-979 vào một helper.
8. **Tiến độ việc cha chỉ tính lại trong SubtaskList:** `changeTaskStatus` và bulk, khi task có `parentTaskId`, tính lại `progress` của việc cha (nếu cha `progressMode==='subtask'`) dựa trên các việc con (đã đóng/huỷ theo quy tắc mục 3: huỷ không tính vào mẫu số). Thêm test cho hàm tính.
9. **`buildDependencyGraphFromFirestore` (~629-643) đọc toàn bộ collection `tasks` mỗi lần sửa phụ thuộc:** thay bằng duyệt BFS theo `dependsOnTaskIds` qua `getTasksByIds` (giới hạn độ sâu 50) để phát hiện vòng.
10. **`DocumentTaskSection`:** tick việc `cancelled` → không thử cancelled→completed (ẩn/disable checkbox cho việc huỷ).
11. Xoá khối "guard progress" chết ở ~1003-1010.

Ghi nhận, CHƯA làm vòng này (để Claude quyết): sửa việc định kỳ qua `updateRecurringTaskScoped` (series.ts) bỏ qua thông báo/REASSIGNED/đồng bộ văn bản.

Sau khi sửa: `npx tsc --noEmit`, `npx vitest run`, cập nhật `handoff/tasks/T-120-REPORT.md` mục "Vòng sửa 1" (từng điểm 1–11 + file:dòng).
