# Cải Tiến Giao Diện Công Việc (Sửa Inline, Thứ Tự Việc Con) & Tạo Công Việc Từ Văn Bản Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi giao diện Chỉnh sửa công việc sang Click-to-edit Inline (loại bỏ popup modal), chuẩn hóa bảng chọn văn bản và hiển thị file tài liệu tự động; hỗ trợ lưu thứ tự việc con (sortOrder) với kéo thả và tạo trước việc con khi tạo mới; bổ sung chức năng tạo công việc từ văn bản với Drawer trượt từ bên phải.

**Architecture:** 
- Mô hình dữ liệu bổ sung `sortOrder` cho Task (Firestore batch write khi sắp xếp).
- Tách `TaskCreateForm` và `DocumentPickerPanel` thành các component tái sử dụng cho cả trang `/tasks/new`, Drawer `TaskCreateDrawer`, và trang chi tiết `/tasks/[id]`.
- Trang `TaskDetail` dùng `RevertableInput` và inline popover/picker tự động lưu vào Firestore.

**Tech Stack:** Next.js 14/15 (App Router), React, TypeScript, Tailwind CSS, Firebase Firestore, Lucide Icons.

---

### Task 1: Model & Firestore Updates for Subtask Ordering

**Files:**
- Modify: `types/tasks.ts:45-115`
- Modify: `lib/tasks/firestore.ts:69-76`
- Modify: `lib/tasks/mutations.ts:60-120`

- [ ] **Step 1: Add `sortOrder` to `Task` interface in `types/tasks.ts`**
```typescript
// Trong interface Task (types/tasks.ts)
sortOrder?: number
```

- [ ] **Step 2: Update `querySubtasks` in `lib/tasks/firestore.ts` to order by `sortOrder`**
```typescript
export function querySubtasks(parentTaskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('parentTaskId', '==', parentTaskId),
    orderBy('sortOrder', 'asc')
  )
}
```

- [ ] **Step 3: Update `createTask` and add `reorderSubtasks` in `lib/tasks/mutations.ts`**
  - In `createTask`: chấp nhận `sortOrder?: number` (mặc định nếu có).
  - Thêm hàm `reorderSubtasks`:
```typescript
export async function reorderSubtasks(
  parentTaskId: string,
  orderedSubtaskIds: string[],
  actorId?: string,
  actorName?: string
): Promise<void> {
  const batch = writeBatch(db())
  orderedSubtaskIds.forEach((id, index) => {
    const ref = doc(db(), TASKS, id)
    batch.update(ref, {
      sortOrder: index,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}
```

- [ ] **Step 4: Verify syntax & build**
Run: `node -c lib/tasks/firestore.ts && node -c lib/tasks/mutations.ts`

- [ ] **Step 5: Commit**
```bash
git add types/tasks.ts lib/tasks/firestore.ts lib/tasks/mutations.ts
git commit -m "feat(tasks): add sortOrder and reorderSubtasks batch mutation"
```

---

### Task 2: SubtaskList Drag & Drop, Up/Down Reordering & SortOrder Persistence

**Files:**
- Modify: `components/tasks/SubtaskList.tsx`

- [ ] **Step 1: Update `SubtaskList.tsx` with sorting logic & fallback**
  - Sắp xếp items theo `(a.sortOrder ?? 0) - (b.sortOrder ?? 0)` nếu bằng nhau thì theo `createdAt`.
  - Bổ sung icon `GripVertical` cho phép kéo thả HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`).
  - Nút Mũi tên Lên/Xuống (`ChevronUp`, `ChevronDown`).
  - Khi thứ tự thay đổi (qua drop hoặc nút bấm): gọi `reorderSubtasks(parentTaskId, reordered.map(s => s.id), actorId, actorName)` để lưu ngay vào Firestore.

- [ ] **Step 2: Gán `sortOrder` khi thêm việc con mới**
  - Trong `handleAdd`: gán `sortOrder: localItems.length` khi gọi `createTask`.

- [ ] **Step 3: Verify syntax**
Run: `node -e "require('fs').readFileSync('components/tasks/SubtaskList.tsx')"`

- [ ] **Step 4: Commit**
```bash
git add components/tasks/SubtaskList.tsx
git commit -m "feat(tasks): support drag-and-drop and persistent subtask reordering"
```

---

### Task 3: Extract and Standardize `DocumentPickerPanel`

**Files:**
- Create: `components/tasks/DocumentPickerPanel.tsx`
- Modify: `app/(app)/tasks/new/page.tsx`

- [ ] **Step 1: Create `components/tasks/DocumentPickerPanel.tsx`**
  - Di chuyển component `DocumentPickerPanel` từ `app/(app)/tasks/new/page.tsx` ra file dùng chung độc lập.
  - Đảm bảo có props:
    * `documents: Document[]`
    * `dossiers: Dossier[]`
    * `selectedIds: string[]`
    * `onChange: (ids: string[]) => void`
  - Giữ lại đầy đủ các tính năng: Ô tìm kiếm, cột Hồ sơ, cột Tên văn bản, checkbox chọn, tag văn bản đã chọn.

- [ ] **Step 2: Update `app/(app)/tasks/new/page.tsx` to import `DocumentPickerPanel`**
  - Thay thế phần định nghĩa nội bộ bằng import từ component dùng chung.

- [ ] **Step 3: Commit**
```bash
git add components/tasks/DocumentPickerPanel.tsx app/(app)/tasks/new/page.tsx
git commit -m "refactor(tasks): extract DocumentPickerPanel into shared component"
```

---

### Task 4: Unified `TaskCreateForm` with Pre-creation Subtasks Checklist

**Files:**
- Create: `components/tasks/TaskCreateForm.tsx`
- Modify: `app/(app)/tasks/new/page.tsx`

- [ ] **Step 1: Create `components/tasks/TaskCreateForm.tsx`**
  - Tách logic từ `app/(app)/tasks/new/page.tsx` thành `TaskCreateForm`.
  - Hỗ trợ các props:
    * `initialData?: Partial<TaskCreateInput>` (tiêu đề, hạn, người chính, phối hợp, hồ sơ, văn bản liên kết pre-filled từ document)
    * `onSuccess?: (taskId: string) => void`
    * `onCancel?: () => void`
    * `titleText?: string`
  - Thêm mục **Việc con (Subtasks)** vào form:
    * State `tempSubtasks: { id: string; title: string }[]`.
    * Ô input nhập việc con + Enter để thêm.
    * Checklist cho phép xóa và đổi thứ tự (Up/Down).
    * Khi submit `createTask`: tạo task cha ➜ dùng `Promise.all` hoặc `reorderSubtasks` tạo các việc con với `parentTaskId: taskId` và `sortOrder: index`.

- [ ] **Step 2: Update `app/(app)/tasks/new/page.tsx` to use `TaskCreateForm`**
  - `page.tsx` chỉ đóng vai trò bọc container trang và gọi `<TaskCreateForm />`.

- [ ] **Step 3: Commit**
```bash
git add components/tasks/TaskCreateForm.tsx app/(app)/tasks/new/page.tsx
git commit -m "feat(tasks): create unified TaskCreateForm with pre-creation subtasks"
```

---

### Task 5: Slide-Over `TaskCreateDrawer` & Action Icon in Document Views

**Files:**
- Create: `components/tasks/TaskCreateDrawer.tsx`
- Modify: `components/documents/DocumentTable.tsx`
- Modify: `components/documents/DocumentModal.tsx`

- [ ] **Step 1: Create `components/tasks/TaskCreateDrawer.tsx`**
  - Slide-over panel trượt từ bên phải (width: 600px - max-w-full).
  - Nhận props: `isOpen: boolean`, `onClose: () => void`, `fromDocument?: Document | null`.
  - Chuyển đổi dữ liệu `fromDocument` thành `initialData` cho `TaskCreateForm`:
    * `title`: `fromDocument.title`
    * `dueDate`: ngày từ `fromDocument.deadline`
    * `assigneeId`: `fromDocument.assigneeId`
    * `collaboratorIds`: `fromDocument.coAssigneeIds`
    * `dossierIds`: `fromDocument.dossierIds`
    * `selectedDocIds`: `[fromDocument.id]`
    * `priority`: ánh xạ từ `fromDocument.priority`
    * `description`: Ghi chú xuất xứ văn bản.
  - Animation slide-in từ phải sang, backdrop mờ, hỗ trợ `Esc` để đóng.

- [ ] **Step 2: Add Action Icon in `DocumentTable.tsx`**
  - Thêm icon `ClipboardList` vào cột Thao tác trên từng dòng văn bản.
  - Khi click: gọi state `setCreateTaskDoc(doc)` để mở `TaskCreateDrawer`.

- [ ] **Step 3: Add Button in `DocumentModal.tsx`**
  - Thay thế modal popup cũ bằng việc mở `TaskCreateDrawer` với `fromDocument={doc}`.

- [ ] **Step 4: Commit**
```bash
git add components/tasks/TaskCreateDrawer.tsx components/documents/DocumentTable.tsx components/documents/DocumentModal.tsx
git commit -m "feat(documents): add task creation drawer from document with pre-fill"
```

---

### Task 6: Transform `TaskDetail.tsx` to Notion-like Inline Editing & Files Widget

**Files:**
- Modify: `components/tasks/TaskDetail.tsx`
- Delete/Deprecate: `components/tasks/TaskEditModal.tsx`

- [ ] **Step 1: Remove `TaskEditModal` import & popup state from `TaskDetail.tsx`**
  - Xóa `showEditModal`, `TaskEditModal`.

- [ ] **Step 2: Implement Inline Editing for all fields in `TaskDetail.tsx`**
  - **Tiêu đề**: Sửa inline với `RevertableInput` font lớn, tự động lưu khi blur/Enter.
  - **Mô tả**: Sửa inline với `RevertableInput multiline`.
  - **Mức ưu tiên**: Dropdown chọn nhanh đổi màu ngay.
  - **Hạn hoàn thành**: Date input popover inline.
  - **Người chính**: Dropdown chọn nhân sự kèm tìm kiếm.
  - **Người phối hợp**: Tag chip có nút xóa + popover `CoAssigneePicker` thêm người.
  - **Đơn vị chủ trì / Phối hợp**: Dropdown chọn nhanh.
  - **Hồ sơ liên quan**: Tag chip có nút xóa + dropdown thêm hồ sơ.

- [ ] **Step 3: Integrate `DocumentPickerPanel` in TaskDetail**
  - Hiển thị danh sách văn bản liên kết kèm nút `+ Liên kết văn bản`.
  - Bấm nút `+` mở `DocumentPickerPanel` inline ngay dưới danh sách.
  - Tick chọn/bỏ chọn cập nhật trực tiếp `task.documentIds` vào Firestore.

- [ ] **Step 4: Add Linked Document Files Widget**
  - Tải thông tin văn bản từ `task.documentIds`.
  - Tổng hợp file chính + toàn bộ file đính kèm.
  - Hiển thị danh sách file với icon định dạng, badge Chính/Đính kèm, nút Xem trước, Tải về, Copy link.

- [ ] **Step 5: Commit**
```bash
git add components/tasks/TaskDetail.tsx
git commit -m "feat(tasks): inline editing and linked document files in TaskDetail"
```

---

### Task 7: Comprehensive Verification & Build Test

- [ ] **Step 1: Test Next.js build**
Run: `npm run build`
- [ ] **Step 2: Verify in Browser via DevTools MCP**
  - Test tạo công việc từ văn bản qua Drawer.
  - Test sửa inline tiêu đề, người xử lý, văn bản liên kết trên `/tasks/[id]`.
  - Test thứ tự việc con (kéo thả và nút mũi tên).
- [ ] **Step 3: Push to GitHub & Deploy**
```bash
git push origin main
```
