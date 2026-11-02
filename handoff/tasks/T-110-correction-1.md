# T-110 — Sửa vòng 1 (Claude verifier: AC3 FAIL, AC7 PARTIAL, AC2 PARTIAL)

Vẫn tuân thủ `handoff/tasks/_RULES.md`, cùng danh sách file được sửa của T-110. Sửa đúng các lỗi sau, không đổi gì khác:

1. **AC3 FAIL — `app/globals.css` (khối `.tap` cuối file) + `app/(app)/layout.tsx:~201`:** `.tap { display:inline-flex }` nằm ngoài `@layer`, sau `@tailwind utilities` → thắng `lg:hidden` → nút X "Đóng menu" hiện trên desktop. Sửa: đặt `.tap` (và `.hover-reveal`) trong `@layer utilities { ... }` để variant `lg:hidden` vẫn thắng. Kiểm lại mọi chỗ dùng `.tap` cùng class ẩn/hiện responsive.
2. **AC7 PARTIAL — `components/ui/dialog.tsx`:** `max-sm:translate-x-0 max-sm:translate-y-0` vẫn sinh `transform` ≠ none → `DialogContent` thành containing block, nút đóng `fixed` cuộn theo nội dung. Sửa: dùng `max-sm:transform-none` (hoặc nút đóng `sticky top-0` trong header) sao cho ở 375×667 với nội dung dài nút đóng luôn thấy.
3. **AC2 — `components/layout/MobileTabBar.tsx:42` (z-40) vs overlay drawer `layout.tsx:~168` (z-40):** tab bar nằm trên lớp phủ khi drawer mở. Sửa: tab bar `z-30` (vẫn dưới drawer z-50 và modal).
4. **`layout.tsx:~381` `pb-20`:** tab bar 56px + safe-area (~34px) > 80px → che đáy nội dung. Sửa: `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0`.
5. **`components/ui/responsive-modal.tsx` (~29,34,38,39,52):** `onClose` bị gọi 2–3 lần mỗi lần đóng (onOpenChange + Overlay onClick + onPointerDownOutside/onEscapeKeyDown + Close onClick). Sửa: chỉ gọi qua `onOpenChange(false)`. Thêm `aria-describedby={undefined}` cho Content (tránh cảnh báo Radix); `title` rỗng → dùng `VisuallyHidden` hoặc tiêu đề mặc định "Hộp thoại". Khi không có `footer`, vùng nội dung vẫn có padding đáy safe-area; bỏ trùng lặp giữa class `safe-bottom` và style inline.
6. **`layout.tsx:~35,176-178`:** `isDesktop` khởi tạo `false` → ở `lg` aside có thể render `85vw` trước khi effect chạy. Thêm `lg:w-[260px]` làm mặc định (inline style vẫn ghi đè khi đã đo).

Sau khi sửa: `npx tsc --noEmit`, `npx vitest run`, cập nhật `handoff/tasks/T-110-mobile-nen-tang-khung-app-REPORT.md` (mục "Vòng sửa 1": từng điểm 1–6 + file:dòng).
