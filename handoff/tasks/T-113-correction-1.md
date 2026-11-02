# T-113 — Sửa vòng 1 (Claude verifier: AC5 FAIL — desktop bị thay đổi)

Tuân thủ `handoff/tasks/_RULES.md`. Được sửa: `components/documents/DocumentModal.tsx`, `components/documents/DocumentViewer.tsx`, `components/documents/IframePreview.tsx`, `components/dossiers/DossierPanel.tsx`, `components/dossiers/DossierFolderGrid.tsx`. KHÔNG sửa `lib/tasks/*`, `components/tasks/*`, `DocumentTaskSection.tsx` (task khác đang sửa song song).

Nguyên tắc: **ở ≥1024px giao diện phải giống HEAD** (`git show HEAD:<file>` để so). Mọi thay đổi kích thước chỉ nằm trong `@media (max-width: 767px)` / tiền tố `max-md:`.

1. **`DocumentModal.tsx:~878-885`:** `.icon-btn` gốc bị đổi 26px → 40px ở mọi độ rộng, và inline `width:26` của nút "Copy thông tin giao việc" bị xoá. Trả về 26px như HEAD (giữ quy tắc 40px trong `@media` ~1007); khôi phục inline width của nút copy.
2. **`DocumentModal.tsx:~55, ~728-737`:** `.modal-close` có `min-width/height:44px` + class `tap` áp mọi độ rộng → header desktop cao hơn. Chỉ đặt 44px trong `@media (max-width:767px)`, bỏ `tap`.
3. **`DossierFolderGrid.tsx:~54`:** `hidden group-hover:flex` → `flex md:opacity-0 md:group-hover:opacity-100` làm các nút chiếm chỗ trên desktop. Dùng `max-md:flex md:hidden md:group-hover:flex` (+ `hover-reveal` nếu cần).
4. **`DossierPanel.tsx:~380, ~389`:** `tap w-11 h-11` áp cả desktop. Thêm `md:w-auto md:h-auto md:min-w-0 md:min-h-0` (hoặc chỉ áp ở `max-md:`), kích thước desktop như HEAD.
5. **`DocumentModal.tsx:~271`, `DocumentViewer.tsx:~46-52`:** khi đang xem đính kèm không phải file Drive, nút "Mở trong Google Drive" rơi về id file chính → mở nhầm file. Chỉ dùng id của file đang xem; không có id → ẩn nút.
6. **`DossierPanel.tsx:~309`:** gọi đổi trạng thái công việc không có try/catch → unhandled rejection khi bị chặn (vd việc cha còn việc con mở). Bọc try/catch, hiển thị lỗi cho người dùng (alert hoặc cách hiển thị lỗi hiện có của panel). Nếu đang gọi `updateTaskStatus`, đổi sang `changeTaskStatus(taskId, toStatus, actor)` với actor đầy đủ `{ id, name, role, departmentIds }` lấy từ `useRole()`/staff hiện tại (chữ ký hiện tại xem `lib/tasks/mutations.ts`, KHÔNG sửa file đó).
7. Giữ thay đổi có lợi ở `DocumentModal.tsx:~111-124` (tự chọn đính kèm đầu khi không có file chính, reset khi đổi văn bản) — không cần đổi.

Sau khi sửa: `npx tsc --noEmit` (có thể có lỗi tạm do task song song sửa `mutations.ts` — ghi rõ trong báo cáo nếu lỗi không thuộc file của bạn), `npx vitest run`, cập nhật báo cáo T-113 mục "Vòng sửa 1".
