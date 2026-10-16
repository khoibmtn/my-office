# Thiết Kế: Cải Tiến Giao Diện Công Việc (Sửa Inline, Thứ Tự Việc Con) & Tạo Công Việc Từ Văn Bản

- **Ngày tạo:** 16/10/2026
- **Trạng thái:** Đã được người dùng phê duyệt (Approved)
- **Tài liệu tham chiếu:** User request & thảo luận brainstorming

---

## 1. Tổng Quan & Mục Tiêu

Hệ thống quản lý công việc và văn bản hiện tại gặp một số hạn chế về trải nghiệm người dùng:
1. **Giao diện Chỉnh sửa công việc (`TaskEditModal`)**: Bị đóng khung trong modal popup che khuất màn hình; phần chọn văn bản chỉ là `<select>` dropdown đơn giản, khó tìm kiếm và bất tiện khi liên kết văn bản.
2. **Thiếu tính tương đồng**: Giao diện tạo mới (`/tasks/new`), xem chi tiết (`/tasks/[id]`), và sửa (`TaskEditModal`) đang tách rời, không dùng chung các panel trực quan như `DocumentPickerPanel`.
3. **Quản lý Việc con (Subtasks)**: Giao diện tạo mới chưa có phần lập trước danh sách việc con; giao diện xem việc con chưa lưu lại thứ tự (`sortOrder`) khi người dùng di chuyển hoặc tạo mới.
4. **Liên kết giữa Văn bản và Công việc**: Chưa có nút thao tác nhanh để tạo công việc trực tiếp từ văn bản; khi tạo công việc từ văn bản cần tự động kế thừa tiêu đề, người xử lý, người phối hợp, hạn hoàn thành, hồ sơ và tài liệu đính kèm.

**Mục tiêu chính**:
- Loại bỏ hoàn toàn modal popup chỉnh sửa công việc, chuyển sang **Click-to-edit Inline (kiểu Notion/Linear)** trực tiếp trên trang `TaskDetail`.
- Đưa bảng chọn văn bản `DocumentPickerPanel` (kèm tìm kiếm, lọc theo hồ sơ) vào cả form tạo mới và trang chi tiết công việc.
- Tự động hiển thị và cho phép thao tác (xem trước, tải về, copy link) toàn bộ file tài liệu (file chính + file đính kèm) từ các văn bản liên kết.
- Hỗ trợ lưu trữ thứ tự việc con (`sortOrder`) trong Firestore với cả 2 thao tác: Kéo thả (Drag & Drop) và phím bấm Mũi tên Lên/Xuống; cho phép nhập danh sách việc con ngay khi tạo công việc mới.
- Thêm icon thao tác và **Drawer trượt từ bên phải** để tạo nhanh công việc từ văn bản mà không làm mất ngữ cảnh đang duyệt văn bản.

---

## 2. Kiến Trúc & Cấu Trúc Thành Phần

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KIẾN TRÚC THÀNH PHẦN                            │
└────────────────────────────────────────────────────────────────────────┘

  [Giao diện Văn bản]
     ├── DocumentTable (Hàng văn bản + Icon "Tạo công việc" ClipboardList)
     └── DocumentModal (Header/Section + Nút "Tạo công việc từ văn bản")
             │
             ▼ Mở Drawer (không chuyển trang)
     ┌────────────────────────────────────────────────────────┐
     │ TaskCreateDrawer (Slide-over bên phải, rộng ~600px)    │
     │   └── TaskCreateForm (Form dùng chung, pre-fill sẵn)   │
     └────────────────────────────────────────────────────────┘
             ▲
             │ Dùng chung Form Component
  [Trang Tạo mới độc lập]
     └── app/(app)/tasks/new/page.tsx
             └── TaskCreateForm
                     ├── Thông tin cơ bản (Tiêu đề, Mô tả, Ưu tiên, Hạn)
                     ├── Phân công (Người xử lý, Phối hợp, Đơn vị)
                     ├── Việc con (Checklist nhập nhanh, sắp xếp)
                     └── Liên kết (DocumentPickerPanel, Dossiers, Tags)

  [Trang Chi tiết Công việc]
     └── app/(app)/tasks/[id]/page.tsx ── TaskDetail
             ├── XÓA TaskEditModal popup
             ├── Inline Click-to-Edit (Title, Description, DueDate, Assignee...)
             ├── SubtaskList (Hỗ trợ Drag & Drop + Mũi tên Up/Down + sortOrder)
             ├── DocumentPickerPanel (Mở inline chọn/gỡ văn bản)
             └── LinkedDocumentFilesWidget (Hiển thị file chính + đính kèm)
```

---

## 3. Đặc Tả Chi Tiết

### 3.1. Sửa Inline trên Trang Chi tiết Công việc (`TaskDetail`)

* **Loại bỏ `TaskEditModal`**: Không còn nút mở modal popup che toàn bộ màn hình.
* **Tiêu đề (`title`)**:
  * Hiển thị dạng chữ lớn, click vào chuyển sang `RevertableInput`.
  * Blur hoặc bấm Enter: Lưu ngay qua `updateTask(taskId, { title })`.
  * Phím `Esc`: Khôi phục lại tiêu đề trước đó.
* **Mô tả (`description`)**:
  * Click vào vùng mô tả: chuyển sang `RevertableInput` đa dòng (multiline, auto-resize).
  * Nếu chưa có mô tả, hiển thị placeholder màu mờ *"Thêm mô tả công việc..."*.
  * Blur hoặc phím tắt lưu: Cập nhật Firestore ngay lập tức.
* **Mức độ ưu tiên (`priority`)**:
  * Badge mức ưu tiên (Khẩn, Cao, Thường, Thấp) có thể click trực tiếp để hiển thị menu dropdown nhanh, chọn là cập nhật Firestore và đổi màu tức thì.
* **Hạn hoàn thành (`dueDate`)**:
  * Click vào ngày/icon lịch mở date picker popover, chọn ngày mới là lưu ngay lập tức.
* **Người xử lý chính (`assigneeId`) & Người phối hợp (`collaboratorIds`)**:
  * Người xử lý chính: Click mở dropdown nhân sự, có avatar, chức danh, tìm kiếm tên.
  * Người phối hợp: Hiển thị các chip nhân sự với nút `x` để gỡ nhanh, và nút `+ Thêm người phối hợp` mở popover `CoAssigneePicker`.
* **Đơn vị chủ trì (`departmentId`) & Đơn vị phối hợp (`cooperatingDepartmentIds`)**:
  * Tương tự, click để chọn hoặc bổ sung đơn vị trực tiếp.
* **Hồ sơ liên quan (`dossierIds`)**:
  * Hiển thị danh sách hồ sơ dạng chip liên kết (click để mở hồ sơ), có nút `+ Thêm hồ sơ` mở dropdown tìm kiếm hồ sơ và gỡ hồ sơ trực tiếp.

### 3.2. Quản lý Văn bản Liên quan & Widget File Tài liệu

* **Liên kết văn bản trong `TaskDetail`**:
  * Danh sách các văn bản đã liên kết: Thẻ văn bản hiển thị Số hiệu, Tên văn bản, Hồ sơ tương ứng, kèm nút `x` để gỡ liên kết khỏi công việc.
  * Nút `+ Liên kết văn bản`: Bấm để mở ngay `DocumentPickerPanel` dạng inline/collapsible ngay dưới danh sách.
  * `DocumentPickerPanel`:
    * Ô tìm kiếm tức thì theo số hiệu, tên văn bản.
    * Bảng chọn gồm 3 cột: Checkbox | Hồ sơ | Tên văn bản.
    * Click cả dòng để toggle chọn/bỏ chọn.
    * Khi tick/bỏ tick, `task.documentIds` được cập nhật tức thì vào Firestore.
* **Widget File tài liệu đính kèm**:
  * Tự động lấy danh sách file từ các văn bản trong `task.documentIds` (không duplicate file trong database task).
  * Hiển thị:
    * File chính của văn bản (Badge: `Chính`, icon loại file).
    * Các file đính kèm của văn bản (Badge: `Đính kèm`, icon loại file).
    * 3 nút tác vụ: 👁️ Xem trước (Viewer preview), 📥 Tải về, 🔗 Copy link.

### 3.3. Quản lý Việc Con (Subtasks) & Lưu Thứ Tự

* **Cấu trúc Dữ liệu**:
  * Mỗi Task (kể cả subtask) có thêm thuộc tính `sortOrder: number`.
  * Truy vấn `querySubtasks(parentTaskId)` được cập nhật: `orderBy('sortOrder', 'asc')`.
* **Thao tác trong `SubtaskList`**:
  * Mỗi dòng việc con có:
    * Checkbox hoàn thành (gạch ngang khi xong, cập nhật % tiến độ task cha).
    * Biểu tượng tay nắm kéo thả `GripVertical` (hỗ trợ kéo thả Reorder trực quan).
    * Mũi tên Lên / Xuống (Up / Down) để dịch chuyển 1 nấc.
    * Tên việc con (click đúp hoặc click bút sửa inline).
    * Nút xóa việc con.
  * Khi thay đổi vị trí việc con:
    * Cập nhật tức thì optimistic UI.
    * Gọi hàm `reorderSubtasks(subtasks: { id: string, sortOrder: number }[])` dùng Firestore `writeBatch` để cập nhật `sortOrder` của toàn bộ các việc con trong danh sách.
* **Tạo trước Việc con khi Tạo công việc mới**:
  * Tại `TaskCreateForm` (dùng ở cả trang `/tasks/new` và Drawer), bổ sung section **"Việc con (Subtasks)"**:
    * Ô nhập nhanh: *"Nhập tên việc con cần làm rồi nhấn Enter..."*.
    * Danh sách checklist tạm thời: Cho phép gõ nhiều việc con liên tiếp, sửa, xóa, đổi thứ tự trước khi tạo.
    * Khi bấm "Tạo công việc": Tạo task cha ➜ nhận `taskId` ➜ Batch create toàn bộ subtasks với `parentTaskId = taskId` và `sortOrder = index`.

### 3.4. Chức Năng Tạo Công Việc từ Văn Bản & Drawer Trượt

* **Icon nút chức năng trên giao diện Văn bản**:
  * Tại `DocumentTable.tsx` (cột Actions của từng dòng văn bản): Thêm icon `ClipboardList` với tooltip *"Tạo công việc từ văn bản này"*, màu sắc nổi bật.
  * Tại `DocumentModal.tsx` (header tác vụ và khu vực công việc liên quan): Bổ sung nút `+ Tạo công việc từ văn bản`.
* **Drawer trượt `TaskCreateDrawer`**:
  * Mở từ mép phải màn hình (slide-over animation, chiều rộng ~600px, có scroll riêng).
  * Giữ nguyên ngữ cảnh màn hình văn bản bên trái.
  * Hỗ trợ đóng bằng phím `Esc`, nút `X`, hoặc click ra vùng backdrop.
* **Dữ liệu Pre-fill tự động**:
  * `title`: `doc.title` (Tên / Trích yếu văn bản).
  * `dueDate`: `doc.deadline` (Hạn xử lý của văn bản, nếu có).
  * `assigneeId`: `doc.assigneeId` (Người được giao xử lý văn bản).
  * `collaboratorIds`: `doc.coAssigneeIds` (Người phối hợp xử lý văn bản).
  * `dossierIds`: `doc.dossierIds` (Hồ sơ chứa văn bản này).
  * `documentIds`: `[doc.id]` (Tự động liên kết văn bản nguồn).
  * `priority`: Ánh xạ từ `doc.priority` (hỏa tốc/khẩn ➜ high/urgent, thường ➜ normal).
  * `description`: Tự động điền thông tin trích xuất:
    ```text
    Văn bản nguồn: [Số hiệu: 39/TTr] - Cơ quan: [TTYT Thủy Nguyên - Sở Y tế]
    Trích yếu: ...
    ```
  * Cho phép người dùng bổ sung ngay các việc con (subtasks) trước khi bấm "Tạo công việc".
* **Sau khi Tạo thành công**:
  * Đóng Drawer mượt mà.
  * Hiển thị thông báo Toast thành công kèm nút bấm *"Xem công việc vừa tạo"*.
  * Tự động làm mới danh sách công việc liên quan trong `DocumentModal` nếu đang mở.

---

## 4. Kế Hoạch Thay Đổi Files & Refactoring

1. **`types/tasks.ts`**:
   - Thêm `sortOrder?: number` vào interface `Task`.
2. **`lib/tasks/firestore.ts` & `lib/tasks/mutations.ts`**:
   - Cập nhật `querySubtasks` sắp xếp theo `sortOrder asc`.
   - Bổ sung hàm `reorderSubtasks(parentTaskId: string, items: { id: string; sortOrder: number }[])` dùng Firestore `writeBatch`.
   - Cập nhật `createTask` hỗ trợ nhận `sortOrder`.
3. **`components/tasks/TaskCreateForm.tsx`** *(Tách mới từ `/tasks/new/page.tsx`)*:
   - Form tạo công việc dùng chung, hỗ trợ `initialData` (pre-fill từ văn bản), `DocumentPickerPanel`, và checklist tạo trước việc con.
4. **`components/tasks/TaskCreateDrawer.tsx`** *(Tạo mới)*:
   - Drawer slide-over bên phải bọc `TaskCreateForm` dành cho tạo việc từ văn bản.
5. **`app/(app)/tasks/new/page.tsx`**:
   - Refactor sử dụng component `TaskCreateForm`.
6. **`components/tasks/SubtaskList.tsx`**:
   - Thêm tính năng kéo thả Drag & Drop (HTML5 / drag handle) + Mũi tên Up/Down.
   - Gọi `reorderSubtasks` khi thay đổi thứ tự.
7. **`components/tasks/TaskDetail.tsx`**:
   - Xóa bỏ `TaskEditModal`.
   - Tích hợp Inline Editing với `RevertableInput` cho Title, Description.
   - Click-to-edit cho Priority, Due Date, Assignee, Collaborators, Departments, Dossiers.
   - Nhúng `DocumentPickerPanel` cho phần Văn bản liên quan và widget hiển thị toàn bộ file tài liệu.
8. **`components/documents/DocumentTable.tsx` & `components/documents/DocumentModal.tsx`**:
   - Bổ sung icon `ClipboardList` và tích hợp `TaskCreateDrawer`.

---

## 5. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

1. **Kiểm thử Inline Editing trên `TaskDetail`**:
   - Sửa tiêu đề, mô tả, hạn hoàn thành, người xử lý, người phối hợp trực tiếp trên trang.
   - Kiểm tra phím `Esc` khôi phục giá trị cũ, phím Enter hoặc blur lưu thành công.
   - F5 tải lại trang: Dữ liệu được lưu vĩnh viễn trong Firestore.
2. **Kiểm thử Việc con & Thứ tự**:
   - Thêm 3 việc con mới, đổi thứ tự việc con bằng nút Up/Down và kéo thả.
   - F5 tải lại trang: Thứ tự việc con được giữ nguyên 100%.
   - Tạo công việc mới kèm 3 việc con từ form tạo mới: Kiểm tra task cha và 3 việc con được tạo đầy đủ với đúng thứ tự.
3. **Kiểm thử Tạo công việc từ Văn bản**:
   - Bấm icon "Tạo công việc" từ một dòng trong `DocumentTable` và từ trong `DocumentModal`.
   - Kiểm tra Drawer trượt ra mượt mà, các thông tin (tiêu đề, người chính, người phối hợp, hạn, hồ sơ, văn bản liên kết) được điền sẵn chính xác.
   - Bấm "Tạo công việc": Kiểm tra công việc được tạo thành công, văn bản liên kết và các file đính kèm hiển thị đầy đủ trên trang chi tiết công việc mới.
