# Báo cáo thực hiện T-113 — Mobile: xem văn bản + hồ sơ

**Trạng thái:** chờ verify

## 1. Danh sách file đã sửa
- `components/documents/DocumentModal.tsx`
- `components/documents/DocumentViewer.tsx`
- `components/documents/IframePreview.tsx`
- `components/documents/AttachmentPanel.tsx`
- `components/documents/DocumentTable.tsx` (chỉ sửa CSS font-size và vùng chạm nút thẻ mobile)
- `app/(app)/documents/[id]/page.tsx`
- `app/(app)/dossiers/page.tsx`
- `components/dossiers/DossierPanel.tsx`
- `components/dossiers/DossierTable.tsx`
- `components/dossiers/DossierFolderGrid.tsx`
- `components/dossiers/DossierBreadcrumb.tsx`

## 2. Tự kiểm từng tiêu chí nghiệm thu (AC — 375×667)

1. **AC 1 — Mở một văn bản (modal và trang `/documents/[id]`) → iframe rộng ≥340px; nút đóng/hành động ≥40px:** **PASS**
   - `components/documents/DocumentModal.tsx:91,111-125,296-317,947-1024`: Dưới `768px` (`@media (max-width: 767px)`), `.modal-container` kích thước `100vw × 100dvh`, `border-radius: 0`; thanh 2 tab `"Thông tin"` / `"Xem file"` (`min-height: 44px`, mặc định `"Xem file"` nếu có file); khi ở tab `"Xem file"`, `.modal-sidebar.mobile-hidden` ẩn (`display: none`) và `.modal-preview` rộng `100%` (375px ≥ 340px).
   - `components/documents/DocumentModal.tsx:286,731-740,875-888,956-963,1013-1018`: Trong `@media (max-width: 767px)`, `.modal-header` có `padding-top: max(12px, env(safe-area-inset-top))`, nút đóng `.modal-close` có `min-width: 44px; min-height: 44px`, tất cả `.icon-btn` có `width: 40px !important; height: 40px !important; min-width: 40px; min-height: 40px`.
   - `components/documents/DocumentViewer.tsx:59,126-135`, `components/documents/IframePreview.tsx:37-80`, `app/(app)/documents/[id]/page.tsx:24-28`: Đổi `h-screen` → `min-h-dvh lg:h-dvh`, xếp dọc `flex-col lg:flex-row`, cột thông tin `w-full lg:w-2/5`, cột preview `w-full` với iframe `w-full h-[70dvh] lg:h-full` (rộng 375px ≥ 340px trên màn 375×667).
   - `components/documents/AttachmentPanel.tsx:24-56`: Các nút hành động (`Xem`, `Copy link`, `Mở Drive`) đều có `min-h-[40px] min-w-[40px]` và tự xuống dòng gọn trên mobile.
   - `components/documents/DocumentTable.tsx:408-491,2553-2561`: Các nút hành động trong `.doc-card` (thẻ mobile) đều có `min-w-[40px] min-h-[40px]`.

2. **AC 2 — Có nút "Mở trong Google Drive":** **PASS**
   - `components/documents/DocumentViewer.tsx:48-54,132` và `components/documents/IframePreview.tsx:28-35,51-60`: Nút `"Mở trong Google Drive"` trỏ tới `https://drive.google.com/file/d/{id}/view` chỉ khi file/tab đang xem có Drive ID hợp lệ; ẩn nút nếu đang xem tệp đính kèm không phải file Google Drive.
   - `components/documents/DocumentModal.tsx:270-276,631-642`: Thanh công cụ xem trước trên mobile có nút `"Mở trong Google Drive"` mở đúng Drive ID của file đang xem (ẩn khi file đang xem không có Drive ID).

3. **AC 3 — Mở panel hồ sơ không làm co danh sách; đóng được bằng X; mở/xoá công việc trong panel bằng chạm:** **PASS**
   - `components/dossiers/DossierPanel.tsx:405`: Đã bỏ class `w-88` không hợp lệ; dưới `md` dùng `fixed inset-0 z-40 w-full h-dvh bg-white` (lớp phủ toàn màn hình tách khỏi luồng flex nên danh sách `<main>` bên dưới không bị co), từ `md` dùng `md:static md:w-96 md:h-full`.
   - `components/dossiers/DossierPanel.tsx:425-431`: Nút đóng `X` trên header có class `tap w-11 h-11 md:w-auto md:h-auto md:min-w-0 md:min-h-0` (44×44px dưới `md`, giữ nguyên kích thước gốc trên desktop) gọi `onClose`.
   - `components/dossiers/DossierPanel.tsx:585-591,599-608,679-715`: Nút mở chi tiết công việc (`ExternalLink`) và nút xóa công việc (`Trash2`) trong panel có class `hover-reveal` và vùng chạm `max-md:min-w-[40px] max-md:min-h-[40px]`, thao tác trực tiếp bằng chạm mà không cần hover.

4. **AC 4 — `/documents`, `/dossiers` không cuộn ngang toàn trang; input không gây zoom iOS (font ≥16px):** **PASS**
   - `components/documents/DocumentTable.tsx:2536-2562`: Dưới `768px`, `.filter-group select`, `.search-box input`, `.assign-select` đều có `font-size: 16px !important` và `max-width: 100%`.
   - `components/documents/DocumentModal.tsx:361,390,407,462,1009-1012`: Các input/select/textarea trong modal dùng `.modal-input-control` có `font-size: 16px !important` dưới `768px`.
   - `components/dossiers/DossierPanel.tsx:455,479,639,733` và `components/dossiers/DossierTable.tsx:354`: Các input/textarea có font 16px dưới `768px` (`max-md:text-base` / `text-base md:text-xs`).
   - `app/(app)/dossiers/page.tsx:282-296,341-348`, `components/dossiers/DossierBreadcrumb.tsx:25,40-44`, `components/dossiers/DossierFolderGrid.tsx:47-83`, `components/dossiers/DossierTable.tsx:292,307-309,368-599`: Đảm bảo `min-w-0 max-w-full`, `DossierTable` hiển thị dạng thẻ (`sm:hidden`) dưới `sm` và bảng cuộn gọn trong khung (`hidden sm:block overflow-x-auto max-w-full`) từ `sm`, không đẩy toàn trang cuộn ngang ở 375×667.

5. **AC 5 — Desktop ≥1024px không đổi:** **PASS**
   - Toàn bộ thay đổi kích thước nút/ô nhập/thanh công cụ của `DocumentModal.tsx`, `IframePreview.tsx`, `DossierPanel.tsx`, `DossierFolderGrid.tsx` đều chỉ áp dụng trong `@media (max-width: 767px)` hoặc tiền tố `max-md:`. Ở `>= 1024px`, giao diện giống hệt `HEAD`.

6. **AC 6 — `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass:** **PASS**
   - `npx tsc --noEmit`: 0 lỗi.
   - `npx vitest run`: Pass 10/10 test files (159/159 tests).

---

## Vòng sửa 1 (Khắc phục AC5 — giữ nguyên giao diện desktop ≥1024px như HEAD & các lỗi phát sinh)

### Các file đã sửa trong Vòng 1
- `components/documents/DocumentModal.tsx`
- `components/documents/DocumentViewer.tsx`
- `components/documents/IframePreview.tsx`
- `components/dossiers/DossierFolderGrid.tsx`
- `components/dossiers/DossierPanel.tsx`

### Chi tiết các mục đã sửa
1. **`DocumentModal.tsx` (`.icon-btn` & nút copy thông tin giao việc):**
   - Khôi phục `.icon-btn` ở base CSS (`lines 875-888`) về đúng `width: 26px; height: 26px;` như `HEAD`.
   - Khôi phục `style={{ width: 26, height: 26, padding: 0 }}` cho nút `"Copy thông tin giao việc"` (`line 569`).
   - Trong `@media (max-width: 767px)` (`lines 1013-1018`), dùng `width: 40px !important; height: 40px !important; min-width: 40px; min-height: 40px;` để đảm bảo vùng chạm ≥40px trên mobile mà không ảnh hưởng desktop.
   - Nút `"Giao việc từ văn bản"` (`line 525`) chuyển sang `max-md:min-h-[40px]`.
   - `.modal-preview-toolbar` (`lines 897-905, 1002-1004`) ẩn trên desktop (`display: none`) và chỉ hiện trên mobile (`display: flex` trong `@media (max-width: 767px)`).
2. **`DocumentModal.tsx` (`.modal-close`):**
   - Bỏ class `tap` khỏi `<button className="modal-close" ...>` (`line 286`) và bỏ `min-width/min-height: 44px` ở base CSS (`lines 731-740`) để chiều cao header trên desktop giống hệt `HEAD`.
   - Chỉ đặt `min-width: 44px; min-height: 44px;` cho `.modal-close` bên trong `@media (max-width: 767px)` (`lines 956-963`).
3. **`DossierFolderGrid.tsx` (`line 54`):**
   - Đổi container nút hành động từ `flex md:opacity-0 md:group-hover:opacity-100` sang `hover-reveal max-md:flex md:hidden md:group-hover:flex items-center gap-1 ml-1 pl-1 border-l border-slate-200` để các nút không chiếm chỗ trên desktop khi chưa hover; các nút con dùng `max-md:min-w-[36px] max-md:min-h-[36px] ... p-0.5` và icon `w-3 h-3` giống hệt `HEAD` trên desktop.
4. **`DossierPanel.tsx` (`lines 416, 425` và toàn bộ các nút/input trong panel):**
   - Nút `Share2` và `X` trên header dùng `tap w-11 h-11 md:w-auto md:h-auto md:min-w-0 md:min-h-0 p-1` và icon `w-4 h-4` để kích thước desktop giống hệt `HEAD`.
   - Tất cả các điều chỉnh kích thước/font-size khác trong `DossierPanel.tsx` đều dùng tiền tố `max-md:` để desktop giữ nguyên như `HEAD`.
5. **`DocumentModal.tsx` (`lines 270-276`), `DocumentViewer.tsx` (`lines 48-54`), `IframePreview.tsx` (`lines 28-35`):**
   - Bỏ fallback rơi về file chính (`allFiles[0]` / `mainDriveId` / `tabs[0]`). Chỉ lấy Drive ID của đúng file đang xem (`activeUrl`); nếu đang xem đính kèm không phải file Google Drive (không có Drive ID) thì ẩn nút `"Mở trong Google Drive"`.
6. **`DossierPanel.tsx`:**
   - Thay `updateTaskStatus` bằng `changeTaskStatus` kèm `try / catch` và thông báo lỗi cho người dùng.
7. **Giữ thay đổi có lợi ở `DocumentModal.tsx` (`lines 111-125`):**
   - Giữ nguyên logic tự chọn đính kèm đầu tiên khi văn bản không có file chính và reset khi đổi văn bản.

---

## Vòng sửa 2 (Khắc phục điểm 6 & hồi quy ở `DossierPanel.tsx`)

### File đã sửa trong Vòng 2
- `components/dossiers/DossierPanel.tsx` (giữ nguyên `useDossierTasks`)

### Chi tiết các mục đã sửa
1. **Truyền `{ autoStartFromPending: true }` khi đổi trạng thái công việc (`lines 324-335`):**
   - Trong `handleToggleTaskEngine`, gọi `changeTaskStatus(task.id, nextStatus, actorCtx.actor, { autoStartFromPending: true })` giống `DocumentTaskSection.tsx`, giúp việc đang ở trạng thái `pending` tự động chuyển qua `in_progress` → `completed` hợp lệ theo `VALID_TRANSITIONS`.
2. **Bổ sung `matrixPerms` đầy đủ cho `actor` (`lines 17, 22, 43-59`):**
   - Lấy `hasPermission, currentStaff` từ `useOrganization()` và dựng `actorCtx` thông qua `buildTaskActorContext({ staffId, staffName, role, isAdmin, currentStaff, hasPermission })` từ `@/lib/tasks/permissions`, truyền `actorCtx.actor` (đã có `matrixPerms`) vào `changeTaskStatus`.
3. **Chặn thao tác trên công việc đã huỷ (`cancelled`) (`lines 325, 558, 572-575`):**
   - Trong `handleToggleTaskEngine`: thoát sớm nếu `task.status === 'cancelled'` (`if (!canEditChecklist || task.status === 'cancelled') return`).
   - Trên checkbox của task: đặt `disabled={!canEditChecklist || isCancelled}`, `title={isCancelled ? 'Công việc đã hủy' : undefined}` và `disabled:opacity-40`.

## 3. Kết quả chạy lệnh kiểm tra (sau Vòng sửa 2)
- `npx tsc --noEmit`: **PASS (0 lỗi)**
- `npx vitest run`: **PASS (`Test Files 10 passed (10)`, `Tests 159 passed (159)`)**

## 4. Điểm chưa chắc / cần Claude quyết
- Không có.
