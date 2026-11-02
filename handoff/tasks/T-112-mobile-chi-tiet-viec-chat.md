# T-112 — Mobile: chi tiết công việc + trao đổi (chat)

Đọc và tuân thủ `handoff/tasks/_RULES.md`. Dùng primitive từ T-110: `.tap`, `.hover-reveal`, `ResponsiveModal`.

## Bối cảnh (đã kiểm trong code)
- `components/tasks/TaskDetail.tsx` ~513 là hàng flex; cột trao đổi ~1182 `w-[320px] shrink-0` → ở 375px cột thông tin còn ~55px.
- "Sửa mô tả" (~577) `opacity-0 group-hover`; nút quay lại (~399) `p-1` + icon `w-4` (~24px).
- `components/chat/MentionTextarea.tsx` ~256 chữ `text-xs` (iOS zoom); popup @mention cố định `w-64` (~179).
- `components/chat/ChatMessageBubble.tsx` ~237 menu "⋯" chỉ hiện khi hover. `DocAttachmentPickerModal.tsx` ~226 nút chọn chỉ hiện khi hover. `SubtaskList.tsx` ~300 nút sửa/di chuyển chỉ hiện khi hover.

## Được sửa
`components/tasks/TaskDetail.tsx` (chỉ bố cục/CSS — giữ nguyên logic T-120), `components/tasks/TaskCommentThread.tsx`, `components/chat/MentionTextarea.tsx`, `components/chat/ChatMessageBubble.tsx`, `components/chat/DocAttachmentPickerModal.tsx`, `components/tasks/SubtaskList.tsx` (chỉ UI), `components/tasks/TaskActivityFeed.tsx`, `app/(app)/tasks/[id]/page.tsx`.

## Yêu cầu
1. `TaskDetail`: dưới `lg` bố cục dọc với 2 tab dính đầu trang "Thông tin" / "Trao đổi (n)"; từ `lg` giữ 2 cột, cột chat `lg:w-[360px]`. Nút quay lại, các nút hành động ≥40px; các nút hover-only thêm `hover-reveal`.
2. Chat (`TaskCommentThread` + `MentionTextarea`): ô nhập dính đáy khung chat, `padding-bottom: env(safe-area-inset-bottom)`, khi focus `scrollIntoView` để bàn phím không che; nút gửi/đính kèm ≥40px; popup mention `w-[calc(100vw-2rem)] sm:w-64`, không tràn màn hình.
3. `ChatMessageBubble`: menu "⋯" luôn thấy trên cảm ứng (`hover-reveal`), nhấn giữ hoặc chạm "⋯" mở menu; menu không tràn mép phải.
4. `DocAttachmentPickerModal` chuyển sang `ResponsiveModal`; nút chọn luôn thấy trên cảm ứng.
5. `SubtaskList`: nút sửa/di chuyển/xoá dùng `hover-reveal`, vùng chạm ≥36px; trên mobile thay kéo-thả sắp xếp bằng nút ↑/↓.

## Tiêu chí nghiệm thu (375×667)
1. Nội dung tab "Thông tin" rộng ≥340px; không cuộn ngang.
2. Gửi được bình luận; ô nhập không bị bàn phím ảo che (có `scrollIntoView`/`visualViewport`).
3. Mọi thao tác tin nhắn (menu ⋯, gắn văn bản) và việc con (sửa, sắp xếp, xoá) làm được bằng chạm.
4. Gõ `@` → popup nằm gọn trong màn hình.
5. Desktop ≥1024px không đổi.
6. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass.
