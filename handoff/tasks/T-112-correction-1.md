# T-112 — Sửa vòng 1 (AC3, AC5 PARTIAL)

Tuân thủ `handoff/tasks/_RULES.md`. Được sửa: `components/tasks/SubtaskList.tsx` (UI), `components/chat/ChatMessageBubble.tsx`, `components/tasks/TaskCommentThread.tsx`, `components/chat/MentionTextarea.tsx`, `components/chat/DocAttachmentPickerModal.tsx`. KHÔNG sửa `KanbanBoard.tsx`, `app/(app)/tasks/page.tsx`, `TaskFilters.tsx` (task khác sắp sửa).

1. **SubtaskList.tsx:~479, ~489:** trên mobile `max-lg:opacity-100` và `hover-reveal` (`opacity:1 !important` trên cảm ứng) thắng `disabled:opacity-30` → nút ↑ đầu / ↓ cuối trông như bật. Sửa: đặt `hover-reveal` ở div cha của nhóm nút, nút dùng `disabled:!opacity-30` (hoặc tương đương) để trạng thái disabled luôn thấy rõ ở mọi kích thước.
2. **ChatMessageBubble.tsx:~410-423 "Sao chép nội dung":** giữ tính năng (hữu ích trên mobile) nhưng KHÔNG dùng lại `handleCopyLink`/`copiedFileUrl`; dùng state riêng `copiedContent` + thông báo "Đã sao chép". Nhấn giữ: thêm `select-none` và `[-webkit-touch-callout:none]` chỉ trên mobile (`max-lg:`) để iOS không bật chọn chữ cùng lúc. Sửa `toggleMenu` không gọi `setState` bên trong updater của `setState` khác.
3. **TaskCommentThread.tsx:~47-55:** chỉ tự cuộn xuống cuối khi `document.activeElement` là ô nhập chat hoặc đang ở gần cuối danh sách (≤80px); không dùng `scrollIntoView` kéo cả `<main>` — cuộn container chat bằng `scrollTop`.
4. **MentionTextarea.tsx:~199:** bỏ `relative` thừa; bỏ `safe-bottom` (vì `<main>` đã chừa safe-area + thanh tab đáy) — kiểm trên trang chi tiết việc ô nhập không bị thanh tab đáy che.
5. **DocAttachmentPickerModal.tsx:** khôi phục dòng mô tả "Người xem có thể mở xem trực tiếp trong chat" (truyền qua ResponsiveModal hoặc trong nội dung); bỏ `autoFocus` trên mobile (chỉ autofocus khi `matchMedia('(min-width:1024px)')`); bỏ `-m-4` làm mất padding safe-area.
6. Checkbox việc con (`SubtaskList.tsx:~404`) vùng chạm ≥36px trên mobile (bọc label/padding), giữ kích thước hiển thị.

Sau khi sửa: `npx tsc --noEmit`, `npx vitest run`, cập nhật báo cáo T-112 mục "Vòng sửa 1".
