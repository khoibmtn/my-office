# T-113 — Sửa vòng 2 (điểm 6 FAIL + hồi quy ở DossierPanel)

Tuân thủ `handoff/tasks/_RULES.md`. Chỉ sửa `components/dossiers/DossierPanel.tsx`. Không đổi phần lấy dữ liệu `useDossierTasks` (task khác vừa đổi, giữ nguyên).

1. **Hồi quy cao — `DossierPanel.tsx:~324-333`:** tick việc `pending` gọi `changeTaskStatus` không có `{ autoStartFromPending: true }` → `VALID_TRANSITIONS` từ chối, báo "Chuyển trạng thái không hợp lệ" (HEAD tick được). Sửa: truyền `{ autoStartFromPending: true }` như `DocumentTaskSection.tsx` đang làm (xem chữ ký `changeTaskStatus` trong `lib/tasks/mutations.ts`, KHÔNG sửa file đó).
2. **Actor thiếu `matrixPerms`:** lấy actor qua `buildTaskActorContext({ staffId, staffName, role, isAdmin, currentStaff, hasPermission }).actor` (export từ `lib/tasks/permissions.ts`), giống `DocumentTaskSection.tsx:~50`.
3. **Việc đã huỷ:** checkbox `disabled` và handler thoát sớm cho việc `cancelled` (giống `DocumentTaskSection.tsx:~70, ~212`).

Sau khi sửa: `npx tsc --noEmit`, `npx vitest run`, cập nhật báo cáo T-113 mục "Vòng sửa 2".
