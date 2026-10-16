# Thiết Kế Chi Tiết: @Mention Nhân Viên & Cơ Chế Chuyển Văn Bản 2 Chiều Giữa Khung Chat ⇄ Công Việc ⇄ Hồ Sơ/Thư Mục

## 1. Tổng Quan & Mục Tiêu

### Bối cảnh
Hệ thống hiện tại có 2 khung chat trao đổi nội bộ thời gian thực:
1. **Khung Trao đổi Công việc** (`TaskCommentThread.tsx` trên trang chi tiết công việc `/tasks/[id]`).
2. **Khung Chat Hồ sơ / Thư mục** (Frame 4 trong `DossierPanel.tsx` trên trang quản lý hồ sơ `/dossiers`).

Người dùng có nhu cầu:
1. **Tag nhân viên (`@mention`)**: Gõ ký tự `@` hiển thị menu gợi ý danh sách nhân viên hoạt động, chọn để tag vào tin nhắn; tin nhắn hiển thị tên người được nhắc nổi bật và tự động gửi thông báo chuông tới người được nhắc.
2. **Chuyển văn bản 2 chiều giữa Khung chat ⇄ Công việc ⇄ Thư mục/Hồ sơ**:
   - **Chiều 1 (Vào khung chat)**: Cho phép đính kèm một văn bản từ công việc/hồ sơ hiện tại hoặc kho văn bản vào tin nhắn dưới dạng Rich Card (có số hiệu, trích yếu, tệp chính, tệp đính kèm, nút xem, tải, copy link); đồng thời ở danh sách văn bản có nút *"Gửi vào trao đổi"*.
   - **Chiều 2 (Từ khung chat ra ngoài)**: Trên từng tin nhắn có menu thao tác `...`:
     - *Gắn vào công việc này*: Đưa văn bản được đề cập vào `task.documentIds`.
     - *Lưu vào hồ sơ/thư mục*: Gắn văn bản vào hồ sơ.
     - *Gắn làm tệp đính kèm*: Chọn một văn bản có sẵn trong công việc/hồ sơ để bổ sung tệp/đường dẫn trong tin nhắn vào danh sách đính kèm (`attachments`).
     - *Tạo văn bản mới từ tin nhắn*: Chuyển nội dung/liên kết thành văn bản mới.

---

## 2. Kiến Trúc Dữ Liệu & Schema

### 2.1. Cập nhật `TaskComment` (`types/tasks.ts`)
```typescript
export interface AttachedDocMetadata {
  docId: string
  docNumber?: string
  title: string
  sender?: string
  issueDate?: any
  driveViewUrl?: string
  originalLink?: string
  attachments?: {
    id: string
    title: string
    driveViewUrl: string
    originalLink?: string
    mimeType?: string
  }[]
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  authorName: string
  content: string
  mentions: string[]                   // Danh sách staffId được @mention
  attachments: Attachment[]
  attachedDocId?: string | null        // ID văn bản được chia sẻ vào tin nhắn
  attachedDocMetadata?: AttachedDocMetadata | null // Metadata snapshot để hiển thị Rich Card
  deletedAt: Timestamp | null
  createdAt: Timestamp
}
```

### 2.2. Cập nhật `DossierComment` (`types/index.ts`)
```typescript
export interface DossierComment {
  id: string
  senderId: string
  senderName: string
  content: string
  mentions?: string[]                  // Danh sách staffId được @mention
  attachedDocId?: string | null
  attachedDocMetadata?: AttachedDocMetadata | null
  createdAt: Timestamp | { seconds: number; nanoseconds?: number }
}
```

---

## 3. Kiến Trúc Component & Giao Diện

```
components/chat/
├── MentionTextarea.tsx             # Textarea thông minh bắt phím @, menu autocomplete popover
├── ChatMessageBubble.tsx           # Render bong bóng tin nhắn, highlight @name, Rich Card văn bản, menu ...
└── DocAttachmentPickerModal.tsx    # Modal/Popover chọn nhanh văn bản gắn vào tin nhắn
```

### 3.1. `MentionTextarea.tsx`
- Bắt sự kiện gõ phím trong `<textarea>`.
- Khi người dùng gõ `@`:
  - Lấy tọa độ con trỏ (caret position) hoặc hiển thị popover menu ngay phía trên ô input.
  - Lọc danh sách `activeStaff` theo chuỗi ký tự sau dấu `@` (họ tên, nickname, chức vụ, chức danh).
  - Điều hướng bằng phím mũi tên `ArrowUp`, `ArrowDown`, phím `Enter` hoặc click để chọn.
  - Khi chọn: thay thế chuỗi `@...` bằng `@TênNhânViên ` và đưa `staff.id` vào mảng `mentions`.
- Thanh công cụ phía dưới/bên cạnh ô input:
  - Nút icon `FileText` / `Paperclip`: Mở `DocAttachmentPickerModal` để chọn văn bản đính kèm vào tin nhắn chuẩn bị gửi.
  - Hiển thị badge tệp/văn bản đang được chọn đính kèm (có nút X để gỡ).
  - Nút `Send` (icon gửi).
  - Hỗ trợ `Enter` để gửi, `Shift + Enter` để xuống dòng.

### 3.2. `ChatMessageBubble.tsx`
- **Highlight Mentions**: Regex phân tích nội dung chuỗi `content`, các từ khóa dạng `@Tên` sẽ được bọc trong thẻ `span` nổi bật: `bg-blue-50 text-blue-700 font-semibold px-1 py-0.5 rounded text-xs`.
- **Rich Card Văn bản (`attachedDocMetadata`)**:
  - Khung viền gọn gàng, nền trắng bên trong bong bóng chat.
  - Tiêu đề văn bản kèm số hiệu, nơi ban hành (nếu có).
  - Danh sách tệp đính kèm kèm icon định dạng.
  - Các nút hành động: *Xem trước* (mở Drive tab mới), *Copy liên kết* (phản hồi visual checkmark).
- **Menu Hành Động `...` (Action Dropdown)**:
  - Khi hover vào bong bóng tin nhắn, xuất hiện icon `MoreHorizontal` (3 chấm).
  - Menu gồm:
    1. **"Gắn vào công việc này"** (chỉ hiển thị khi đang trong TaskDetail và văn bản chưa thuộc task).
    2. **"Lưu vào hồ sơ này"** (chỉ hiển thị khi đang trong Dossier và văn bản chưa thuộc hồ sơ).
    3. **"Gắn tệp vào văn bản có sẵn"** (chọn 1 văn bản trong danh sách hiện tại để nạp tệp này vào attachments).
    4. **"Tạo văn bản mới từ tin nhắn"** (mở drawer tạo văn bản).
    5. **"Xóa tin nhắn"** (nếu là tác giả hoặc admin).

### 3.3. `DocAttachmentPickerModal.tsx`
- Popover / Modal gọn gàng, hiển thị:
  - Tab 1: **Văn bản trong công việc / hồ sơ hiện tại** (tiện lợi, chọn ngay).
  - Tab 2: **Kho văn bản toàn hệ thống** (có ô tìm kiếm nhanh).
- Khi chọn 1 văn bản, snapshot dữ liệu vào `attachedDocMetadata` của tin nhắn.

---

## 4. Tích Hợp Chiều Vào (Share from List to Chat)

1. **Trên trang Chi tiết Công việc ([TaskDetail.tsx](file:///Users/buiminhkhoi/Documents/Antigravity/Claude/my-office/components/tasks/TaskDetail.tsx))**:
   - Trong danh sách "Văn bản liên quan": mỗi dòng văn bản có thêm nút icon `MessageSquarePlus` (title: *"Gửi thảo luận vào chat"*).
   - Khi bấm, tự động gửi 1 tin nhắn vào thread: `Chia sẻ văn bản: [Số hiệu/Tên]` kèm snapshot `attachedDocMetadata`.
2. **Trên trang Quản lý Hồ sơ ([DossierPanel.tsx](file:///Users/buiminhkhoi/Documents/Antigravity/Claude/my-office/components/dossiers/DossierPanel.tsx))**:
   - Trong danh sách văn bản của hồ sơ: thêm nút icon `MessageSquarePlus` để gửi card văn bản vào khung chat hồ sơ.

---

## 5. Quy Trình Chuyển Đổi Chiều Ra (Chat-to-Task / Chat-to-Dossier / Chat-to-Doc)

1. **Gắn vào công việc hiện tại**:
   - Gọi `updateTask(taskId, { documentIds: [...currentDocIds, attachedDocId] }, actorId, actorName)`.
   - Hiển thị toast thông báo thành công.
2. **Lưu vào hồ sơ**:
   - Gọi `toggleDocumentDossier(attachedDocId, currentDossierId, actorId)`.
3. **Gắn tệp vào văn bản có sẵn**:
   - Nếu tin nhắn có chứa file / url: hiển thị modal chọn 1 văn bản đích trong công việc/hồ sơ hiện tại.
   - Thêm tệp vào mảng `attachments` của văn bản đó qua `updateDocument(targetDocId, { attachments: updatedAttachments })`.

---

## 6. Kế Hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu
1. **@mention**:
   - Gõ `@` xuất hiện popup gợi ý nhân viên.
   - Bấm phím mũi tên và Enter chèn đúng tên nhân viên.
   - Sau khi gửi, tin nhắn hiển thị tên được highlight rõ ràng.
   - Nhân viên được tag nhận được thông báo trong Notification Bell.
2. **Đưa văn bản vào chat**:
   - Bấm icon đính kèm trong chat mở bộ chọn văn bản, gửi thành công Rich Card văn bản.
   - Bấm nút "Gửi vào chat" tại danh sách văn bản gửi thành công tin nhắn chia sẻ.
3. **Chuyển ngược từ chat**:
   - Bấm "Gắn vào công việc này" trên tin nhắn lập tức cập nhật văn bản đó vào danh sách Văn bản liên quan của công việc.
   - Bấm "Lưu vào hồ sơ" cập nhật văn bản vào hồ sơ.
   - Bấm "Gắn tệp vào văn bản" cập nhật đúng tệp đính kèm.
