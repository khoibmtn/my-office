# Báo cáo thực hiện T-110 — Mobile: nền tảng dùng chung + khung app/điều hướng

**Trạng thái:** chờ verify

## 1. Danh sách file đã sửa / tạo mới
- `app/layout.tsx` (sửa: thêm export `viewport` với `viewportFit: 'cover'`)
- `app/globals.css` (sửa: đặt `.tap`, `button[aria-label="Thông báo"]` và `.hover-reveal` trong `@layer utilities { ... }` để không đè `lg:hidden`; thêm rule `font-size: 16px !important` cho `input, select, textarea` dưới `768px`)
- `components/ui/input.tsx` (sửa: `text-sm` → `text-base md:text-sm`)
- `components/ui/textarea.tsx` (sửa: `text-sm` → `text-base md:text-sm`)
- `components/ui/dialog.tsx` (sửa: `DialogContent` full-screen `inset-0 h-dvh rounded-none overflow-y-auto` và `max-sm:transform-none` dưới `sm`, giữ căn giữa `sm:max-h-[90dvh] overflow-y-auto` từ `sm`, bổ sung nút đóng `DialogPrimitive.Close` ≥44px luôn hiển thị)
- `components/ui/responsive-modal.tsx` (tạo mới: `ResponsiveModal({ open, onClose, title, children, footer })` dạng bottom sheet `max-h-[92dvh]` trên mobile với header/footer dính + `safe-bottom`, căn giữa `max-w-lg` từ `sm`, đóng bằng Esc và chạm nền qua `onOpenChange(false)`)
- `components/layout/MobileTabBar.tsx` (tạo mới: thanh điều hướng đáy `lg:hidden fixed bottom-0 z-30 safe-bottom` gồm Văn bản, Công việc, Hồ sơ, Dashboard và nút Thêm mở menu Thêm công việc / Thêm văn bản, ẩn theo đúng quyền `items` và `canAddDocument`)
- `app/(app)/layout.tsx` (sửa: giữ nguyên sửa `<aside>` của Claude; thêm `lg:w-[260px]` làm mặc định desktop, chỉ áp `style={{ width: sidebarWidth }}` khi `matchMedia('(min-width:1024px)')` khớp, dưới `lg` dùng `w-[85vw] max-w-[320px]`; đổi `h-screen` → `h-dvh`; cập nhật tiêu đề header động theo route; tăng vùng chạm ≥44px cho Hamburger, Chuông thông báo, nút `+ Thêm`; thêm `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0` và `overflow-x-hidden` cho `<main>`; gắn `<MobileTabBar />`; thay `h-4.5 w-4.5` → `h-[18px] w-[18px]`)
- `components/dossiers/DossierTreeNav.tsx` (sửa: nút mở/đóng nhánh `p-2 min-w-[36px] min-h-[36px]`, dòng cây `min-h-[40px]` trên mobile, thay `h-4.5 w-4.5` → `h-[18px] w-[18px]`, `shadow-2xs` → `shadow-sm`)
- `components/tags/TagSidebarPanel.tsx` (sửa: thêm class `hover-reveal` vào nút sửa tag)

## 2. Vòng sửa 1 (theo phản hồi Claude verifier)
1. **Điểm 1 (AC3 FAIL — `.tap` ngoài `@layer` thắng `lg:hidden`):**
   - Đã bọc `.tap`, `button[aria-label="Thông báo"]` và `.hover-reveal` vào `@layer utilities { ... }` tại `app/globals.css:127-144` để các responsive variants như `lg:hidden` trên nút X "Đóng menu" (`app/(app)/layout.tsx:201`) luôn thắng ở desktop (`>=1024px`). Đã rà soát toàn bộ các nơi dùng `.tap` (`app/(app)/layout.tsx:201,353,370`, `components/layout/MobileTabBar.tsx:92,116`, `components/ui/dialog.tsx:41`, `components/ui/responsive-modal.tsx:49`).
2. **Điểm 2 (AC7 PARTIAL — `DialogContent` tạo containing block khiến nút đóng `fixed` bị cuộn):**
   - Đã thay `max-sm:translate-x-0 max-sm:translate-y-0` bằng `max-sm:transform-none` tại `components/ui/dialog.tsx:34`, đảm bảo ở `<sm` (375×667) `transform: none` để nút đóng `fixed top-2 right-2` (`components/ui/dialog.tsx:41`) bám cố định theo viewport ngay cả khi cuộn nội dung dài.
3. **Điểm 3 (AC2 PARTIAL — `MobileTabBar` `z-40` đè lên lớp phủ drawer `z-40`):**
   - Đã hạ `z-index` của `<nav>` trong `components/layout/MobileTabBar.tsx:42` từ `z-40` xuống `z-30` (nằm dưới lớp phủ drawer `z-40` tại `app/(app)/layout.tsx:168`, dưới drawer `z-50` và modal `z-50`).
4. **Điểm 4 (`<main>` `pb-20` chưa cộng `safe-area-inset-bottom`):**
   - Đã đổi padding đáy của `<main>` tại `app/(app)/layout.tsx:381` thành `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0`.
5. **Điểm 5 (`ResponsiveModal` gọi `onClose` trùng lặp, thiếu `aria-describedby`, fallback `title`, safe-area khi không có `footer`):**
   - Chỉ gọi `onClose` một lần duy nhất qua `onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}` tại `components/ui/responsive-modal.tsx:28-30` (đã bỏ `onClick` trên `Overlay`/`Close` và `onEscapeKeyDown`/`onPointerDownOutside` trên `Content`).
   - Thêm `aria-describedby={undefined}` cho `DialogPrimitive.Content` tại `components/ui/responsive-modal.tsx:35`.
   - Thêm fallback `{title || 'Hộp thoại'}` cho `DialogPrimitive.Title` tại `components/ui/responsive-modal.tsx:43-45`.
   - Khi không có `footer`, vùng nội dung áp class `safe-bottom` (`components/ui/responsive-modal.tsx:56`); khi có `footer`, chỉ dùng class `safe-bottom` trên footer sticky (`components/ui/responsive-modal.tsx:61`), đã bỏ inline style trùng lặp.
6. **Điểm 6 (`isDesktop` khởi tạo `false` khiến `<aside>` có thể nháy `85vw` trên `lg` trước khi effect chạy):**
   - Đã thêm `lg:w-[260px]` vào class của `<aside>` tại `app/(app)/layout.tsx:178` làm chiều rộng mặc định trên desktop trước khi inline style `sidebarWidth` áp dụng.

## 3. Tự kiểm từng tiêu chí nghiệm thu (AC)
1. **AC 1 — Ở viewport 375×667, drawer đóng → `<main>` rộng đúng 375px; không có cuộn ngang ở `/documents`, `/tasks`, `/dossiers`, `/dashboard`:** **PASS** (`app/(app)/layout.tsx:164,175-183,347,381`)
2. **AC 2 — Drawer mở đè lên nội dung, có lớp phủ; chạm lớp phủ hoặc chuyển trang thì đóng:** **PASS** (`app/(app)/layout.tsx:149-152,166-172,175-183`, `components/layout/MobileTabBar.tsx:42`)
3. **AC 3 — Desktop (≥1024px): sidebar giữ nguyên như cũ, kéo đổi độ rộng vẫn hoạt động, thanh tab đáy không hiện:** **PASS** (`app/globals.css:127-144`, `app/(app)/layout.tsx:40-52,65-90,175-183,201`, `components/layout/MobileTabBar.tsx:42`)
4. **AC 4 — Thanh tab đáy đi tới được 4 màn chính và menu "Thêm" mở được 2 trang tạo mới; mục bị ẩn đúng theo quyền:** **PASS** (`components/layout/MobileTabBar.tsx:19-24,35-37,44-78,111-129`)
5. **AC 5 — Header hiển thị đúng tiêu đề theo route:** **PASS** (`app/(app)/layout.tsx:102-128,357-360`)
6. **AC 6 — Mọi input/select/textarea có font-size computed ≥16px ở viewport <768px:** **PASS** (`app/globals.css:147-153`, `components/ui/input.tsx:9`, `components/ui/textarea.tsx:8`)
7. **AC 7 — `DialogContent` và `ResponsiveModal` cuộn được nội dung dài, nút đóng luôn thấy ở 375×667:** **PASS** (`components/ui/dialog.tsx:31-45`, `components/ui/responsive-modal.tsx:36-65`)
8. **AC 8 — `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass:** **PASS**

## 4. Kết quả chạy lệnh kiểm tra
- `npx tsc --noEmit`: 0 lỗi (exit code 0).
- `npx vitest run`:
  ```
  Test Files  7 passed (7)
       Tests  120 passed (120)
  ```
