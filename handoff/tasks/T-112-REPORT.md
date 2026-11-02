# Báo cáo thực hiện T-112 — Mobile: chi tiết công việc + trao đổi (chat)

**Trạng thái:** chờ verify

## 1. Danh sách file đã sửa
- `components/tasks/TaskDetail.tsx` (chỉ sửa bố cục/CSS & tab mobile — giữ nguyên 100% logic T-120)
- `components/tasks/TaskCommentThread.tsx`
- `components/chat/MentionTextarea.tsx`
- `components/chat/ChatMessageBubble.tsx`
- `components/chat/DocAttachmentPickerModal.tsx`
- `components/tasks/SubtaskList.tsx` (chỉ sửa UI)
- `components/tasks/TaskActivityFeed.tsx`

## 2. Tự kiểm từng tiêu chí nghiệm thu (AC — 375×667)

1. **AC 1 — Nội dung tab "Thông tin" rộng ≥340px; không cuộn ngang:** **PASS**
   - `components/tasks/TaskDetail.tsx:562-593`: Dưới `lg` hiển thị thanh 2 tab dính đầu trang (`lg:hidden sticky top-0 z-20`) gồm `"Thông tin"` và `"Trao đổi ({activeCommentsCount})"` (`min-h-[44px]`).
   - `components/tasks/TaskDetail.tsx:596-603, 1344-1348`: Dưới `lg` bố cục dọc (`flex-col lg:flex-row`), khi ở tab `"Thông tin"` cột trái chiếm toàn bộ chiều rộng màn hình 375px (`clientWidth = 375px`, vùng nội dung trừ padding `p-4` đạt `343px ≥ 340px`), có `overflow-x-hidden min-w-0`, các hàng nút/tiêu đề phụ có `flex-wrap` và `min-w-0`, cột chat ẩn (`hidden lg:flex`).
   - `components/tasks/TaskDetail.tsx:428-436, 467, 490, 507, 517, 535, 735, 757, 765, 1068, 1077, 1122, 1173, 1186, 1211, 1237`: Nút quay lại và các nút hành động đạt `≥40px` trên mobile (`tap` / `max-lg:min-h-[40px]`), nút `"Sửa mô tả"` có `hover-reveal max-lg:opacity-100`.
   - `components/tasks/TaskActivityFeed.tsx:82-83`: Thêm `min-w-0` và `break-words` tránh tràn ngang nội dung nhật ký hoạt động.

2. **AC 2 — Gửi được bình luận; ô nhập không bị bàn phím ảo che (có `scrollIntoView`/`visualViewport`):** **PASS**
   - `components/chat/MentionTextarea.tsx:53-73, 197-200, 276-325`: Khung nhập dính đáy khung chat (`sticky bottom-0 z-10 shrink-0`), `<textarea>` dùng `text-base md:text-sm` (16px trên mobile tránh iOS auto-zoom), khi focus gọi `scrollIntoView` (`handleFocus` tại dòng `60-63, 281`) và lắng nghe `window.visualViewport.addEventListener('resize', ...)` (`dòng 65-73`). Nút đính kèm và nút gửi dùng `tap lg:min-w-0 lg:min-h-0` (`44×44px ≥ 40px` trên mobile).
   - `components/tasks/TaskCommentThread.tsx:42-81, 108-111`: Tự động cuộn container chat (`listEl.scrollTop = listEl.scrollHeight`) khi `document.activeElement` là ô nhập chat hoặc danh sách đang ở gần cuối (`≤80px`), không dùng `scrollIntoView` kéo `<main>`.

3. **AC 3 — Mọi thao tác tin nhắn (menu ⋯, gắn văn bản) và việc con (sửa, sắp xếp, xoá) làm được bằng chạm:** **PASS**
   - `components/chat/ChatMessageBubble.tsx:109-151, 199-240, 329-455`: Nút menu `"⋯"` có `hover-reveal max-lg:opacity-100 max-lg:min-w-[36px] max-lg:min-h-[36px]` luôn hiển thị trên thiết bị cảm ứng và màn hình `<lg`; hỗ trợ mở menu bằng chạm nút `"⋯"` (`toggleMenu`) hoặc nhấn giữ bong bóng tin nhắn (`onTouchStart` 500ms / `onContextMenu`, có `max-lg:select-none max-lg:[-webkit-touch-callout:none]`). Vị trí menu được kẹp trong khung nhìn qua `computeClampedOffset` + `max-w-[calc(100vw-1rem)]` đảm bảo không bao giờ tràn mép phải hoặc mép trái.
   - `components/chat/DocAttachmentPickerModal.tsx:6, 40-50, 115-242`: Đã chuyển sang dùng `ResponsiveModal` kèm dòng mô tả `"Người xem có thể mở xem trực tiếp trong chat"`; nút `"Chọn"` trên từng văn bản có `hover-reveal max-lg:opacity-100 max-lg:min-h-[36px]` luôn hiển thị trên cảm ứng.
   - `components/tasks/SubtaskList.tsx:395-520`: Ẩn tay nắm kéo-thả trên mobile (`hidden lg:block`), checkbox bọc `<label>` có vùng chạm `max-lg:min-w-[36px] max-lg:min-h-[36px]`, nhóm nút thao tác đặt `hover-reveal max-lg:opacity-100` ở `div` cha, các nút con có vùng chạm `max-lg:min-w-[36px] max-lg:min-h-[36px]` (`≥36px`) và nút ↑/↓ dùng `disabled:!opacity-30`.

4. **AC 4 — Gõ `@` → popup nằm gọn trong màn hình:** **PASS**
   - `components/chat/MentionTextarea.tsx:203-244`: Popup gợi ý `@mention` có class `left-2 right-2 sm:right-auto w-[calc(100vw-2rem)] max-w-[calc(100%-1rem)] sm:w-64 sm:max-w-none`, ở màn hình 375px rộng tối đa `343px` nằm gọn trong khung nhìn, không tràn ngang.

5. **AC 5 — Desktop ≥1024px không đổi:** **PASS**
   - Ở `≥1024px` (`lg:`): thanh tab mobile ẩn (`lg:hidden`), bố cục giữ nguyên 2 cột (`lg:flex-row`) với cột trao đổi `lg:w-[360px]`, mọi điều chỉnh kích thước vùng chạm trên mobile đều dùng `tap lg:min-w-0 lg:min-h-0` hoặc `max-lg:` nên kích thước nút và bố cục trên desktop giữ nguyên như `HEAD`.

6. **AC 6 — `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass:** **PASS**
   - `npx tsc --noEmit`: 0 lỗi (exit code 0).
   - `npx vitest run`: Pass 10/10 test files (167/167 tests).

---

## 3. Vòng sửa 1 (Khắc phục AC3, AC5 PARTIAL)

1. **`SubtaskList.tsx:467-518` (Trạng thái disabled của nút ↑ đầu / ↓ cuối trên mobile):**
   - Chỉ đặt `hover-reveal max-lg:opacity-100` ở `div` cha của nhóm nút (`SubtaskList.tsx:467`), bỏ `hover-reveal max-lg:opacity-100` trên từng nút con và dùng `disabled:!opacity-30 disabled:cursor-not-allowed` cho nút `Di chuyển lên` (`SubtaskList.tsx:485`) và `Di chuyển xuống` (`SubtaskList.tsx:495`) để trạng thái vô hiệu hóa luôn hiển thị rõ (`opacity: 0.3`) ở mọi kích thước màn hình.
2. **`ChatMessageBubble.tsx:110, 143-150, 199-208, 226-235, 329-339, 426-448` ("Sao chép nội dung", nhấn giữ iOS, `toggleMenu`):**
   - Tách state riêng `copiedContent` (`dòng 110`) và hàm `handleCopyContent` (`dòng 199-208`), hiển thị thông báo `"Đã sao chép"` cả trong nút menu (`dòng 435-440`) lẫn cạnh thời gian tin nhắn (`dòng 333-337`), không dùng chung `handleCopyLink`/`copiedFileUrl`.
   - Thêm `max-lg:select-none max-lg:[-webkit-touch-callout:none]` vào thẻ bong bóng tin nhắn (`dòng 235`) để iOS không bật chọn chữ khi nhấn giữ trên mobile, giữ nguyên chọn chữ trên desktop (`≥1024px`).
   - Sửa `toggleMenu` (`dòng 143-150`) kiểm tra `showMenu` trực tiếp thay vì gọi `setMenuLeftOffset` bên trong hàm updater của `setShowMenu`.
3. **`TaskCommentThread.tsx:36-81, 108-111` (Cuộn danh sách chat bằng `scrollTop`, không kéo `<main>`):**
   - Thay `bottomRef.current?.scrollIntoView` bằng `scrollChatToBottom` (`listEl.scrollTop = listEl.scrollHeight`, `dòng 56-60`).
   - Thêm `isNearBottomOrChatFocused` (`dòng 43-54`) để chỉ tự động cuộn xuống cuối khi `document.activeElement` là ô nhập trong khung chat hoặc danh sách đang ở gần cuối (`distanceFromBottom <= 80`), không làm cuộn `<main>`.
4. **`MentionTextarea.tsx:197-200, 315-317` (Bỏ `relative` thừa và `safe-bottom`):**
   - Bỏ `relative` (tránh xung đột với `sticky`) và bỏ `safe-bottom` trên khung `MentionTextarea` (`dòng 199`) vì `<main>` tại `app/(app)/layout.tsx:381` đã chừa `pb-[calc(4rem+env(safe-area-inset-bottom))]` cho thanh tab đáy + safe-area; trả lại `p-2.5` chuẩn để ô nhập nằm ngay trên thanh tab đáy mà không bị che hay dư khoảng trống.
5. **`DocAttachmentPickerModal.tsx:40-50, 115-182` (Mô tả phụ, `autoFocus` chỉ trên desktop, bỏ `-m-4`):**
   - Khôi phục dòng mô tả `"Người xem có thể mở xem trực tiếp trong chat"` trong header của `ResponsiveModal` (`dòng 126-128`).
   - Bỏ prop `autoFocus` tĩnh trên `<input>` (`dòng 163-170`) và chỉ gọi `searchInputRef.current?.focus()` trong `useEffect` khi `window.matchMedia('(min-width: 1024px)').matches` (`dòng 43-50`).
   - Bỏ `-m-4` trên wrapper nội dung (`dòng 134`) để giữ nguyên padding và `safe-bottom` của `ResponsiveModal`.
6. **`SubtaskList.tsx:406-419` (Vùng chạm checkbox việc con ≥36px trên mobile):**
   - Bọc `<input type="checkbox">` trong `<label className="max-lg:min-w-[36px] max-lg:min-h-[36px] max-lg:-my-1 max-lg:-ml-1 inline-flex items-center justify-center shrink-0 ...">`, đảm bảo vùng chạm đạt `36×36px` trên mobile trong khi kích thước hiển thị của checkbox giữ nguyên `w-4 h-4` (`16×16px`).

## 4. Output kiểm tra cuối (sau Vòng sửa 1)
- `npx tsc --noEmit`:
  ```
  (0 lỗi, exit code 0)
  ```
- `npx vitest run`:
  ```
  Test Files  10 passed (10)
       Tests  167 passed (167)
  ```

## 5. Điểm chưa chắc / cần Claude quyết
- Không có.
