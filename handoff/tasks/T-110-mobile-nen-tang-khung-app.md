# T-110 — Mobile: nền tảng dùng chung + khung app/điều hướng

Đọc và tuân thủ `handoff/tasks/_RULES.md`.

## Bối cảnh
App đang live, người dùng thao tác nhiều trên điện thoại (375–414px, iPhone Safari). Rà soát phát hiện:
- Sidebar `<aside>` từng có cả `fixed` và `relative` → chiếm chỗ, nội dung chỉ còn ~130px. **Claude đã sửa** tại `app/(app)/layout.tsx` (bỏ `relative`, `lg:static` → `lg:relative`). Giữ nguyên sửa này.
- `style={{ width: sidebarWidth }}` áp cả trên mobile; `h-screen` (100vh) khiến đáy bị thanh Safari che; hamburger ~36px; nút "+ Thêm" header `h-8` chỉ tới `/documents/new`.
- Không có thanh tab đáy; muốn đổi màn phải mở drawer.
- `app/layout.tsx` không export `viewport` (thiếu `viewportFit: 'cover'`); `.safe-bottom/.safe-top` trong `app/globals.css` chưa dùng.
- `components/ui/input.tsx`, `textarea.tsx` dùng `text-sm` → iOS tự zoom khi focus (cần ≥16px trên mobile).
- `components/ui/dialog.tsx` không `max-h`/cuộn, không full-screen trên mobile.
- Nhiều nút chỉ hiện khi hover (`opacity-0 group-hover:opacity-100`) → không dùng được trên cảm ứng.
- `DossierTreeNav.tsx` nút mở nhánh `p-0.5` + icon `w-3` (~16–20px). `TagSidebarPanel.tsx` nút sửa tag chỉ hiện khi hover.
- `tailwind.config.ts` không mở rộng theme → các class `w-88`, `h-4.5`, `shadow-xs`, `z-60`, `animate-in` không tồn tại.

## Được sửa
`app/layout.tsx`, `app/globals.css`, `app/(app)/layout.tsx`, `components/ui/dialog.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, mới `components/ui/responsive-modal.tsx`, mới `components/layout/MobileTabBar.tsx` (hoặc đặt trong layout), `components/dossiers/DossierTreeNav.tsx`, `components/tags/TagSidebarPanel.tsx`.
KHÔNG sửa component công việc/văn bản/hồ sơ khác (các task sau sẽ làm).

## Yêu cầu
1. `app/layout.tsx`: `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }`.
2. `app/globals.css`:
   - `@media (max-width: 767px) { input, select, textarea { font-size: 16px; } }` (đủ mạnh để thắng `text-xs/text-sm` của Tailwind — kiểm thứ tự/độ ưu tiên).
   - Utility `.tap` = `min-width: 44px; min-height: 44px` (inline-flex, căn giữa).
   - `@media (hover: none) { .hover-reveal { opacity: 1 !important; } }` — để các task sau gắn class `hover-reveal` cạnh `opacity-0 group-hover:opacity-100`.
3. `components/ui/dialog.tsx` (`DialogContent`): dưới `sm` → toàn màn hình (`inset-0`, `h-dvh`, không bo góc, `overflow-y-auto`, nút đóng ≥44px luôn thấy); từ `sm` giữ căn giữa với `max-h-[90dvh] overflow-y-auto`.
4. Mới `components/ui/responsive-modal.tsx`: component `ResponsiveModal({ open, onClose, title, children, footer })` — mobile: bottom sheet toàn chiều rộng, `max-h-[92dvh]`, header dính có nút đóng ≥44px, footer dính có `padding-bottom: env(safe-area-inset-bottom)`; desktop: modal căn giữa `max-w-lg`. Đóng bằng Esc và chạm nền. Không thêm thư viện (có thể dùng `@radix-ui/react-dialog` đã có).
5. `app/(app)/layout.tsx`:
   - Chiều rộng inline `sidebarWidth` chỉ áp khi ≥`lg` (dùng media query/hook `matchMedia('(min-width:1024px)')`); dưới `lg` drawer `w-[85vw] max-w-[320px]`.
   - `h-screen` → `h-dvh` (cả khung và aside).
   - Drawer mobile có lớp phủ, chạm ra ngoài đóng, tự đóng khi đổi route.
   - Tiêu đề header đúng theo route (hiện trang `/tasks` vẫn ghi "Văn bản"): Văn bản / Công việc / Kanban / Lịch / Định kỳ / Hồ sơ / Dashboard / Cài đặt / Tìm kiếm.
   - Hamburger, chuông thông báo, nút "+ Thêm" ở header ≥44px vùng chạm.
   - Thanh tab đáy `lg:hidden`, cố định, có `safe-bottom`: **Văn bản** (`/documents`), **Công việc** (`/tasks`), **Hồ sơ** (`/dossiers`), **Dashboard** (`/dashboard`), **Thêm** (mở menu: "Thêm công việc" → `/tasks/new`, "Thêm văn bản" → `/documents/new`). Ẩn mục theo đúng quyền như sidebar hiện tại (dùng cùng logic danh sách `items`). Tab đang active được tô màu. Nội dung chính có `padding-bottom` đủ để không bị thanh che.
6. `DossierTreeNav.tsx`: nút mở/đóng nhánh vùng chạm ≥36px (`p-2`), dòng cây cao ≥40px trên mobile; thay class không tồn tại bằng giá trị hợp lệ (`w-88`→`w-[22rem]`, `h-4.5`→`h-[18px]`… nếu có trong các file được sửa).
7. `TagSidebarPanel.tsx`: nút sửa tag thêm `hover-reveal`.

## Tiêu chí nghiệm thu
1. Ở viewport 375×667, drawer đóng → `<main>` rộng đúng 375px; không có cuộn ngang ở `/documents`, `/tasks`, `/dossiers`, `/dashboard`.
2. Drawer mở đè lên nội dung, có lớp phủ; chạm lớp phủ hoặc chuyển trang thì đóng.
3. Desktop (≥1024px): sidebar giữ nguyên như cũ, kéo đổi độ rộng vẫn hoạt động, thanh tab đáy không hiện.
4. Thanh tab đáy đi tới được 4 màn chính và menu "Thêm" mở được 2 trang tạo mới; mục bị ẩn đúng theo quyền.
5. Header hiển thị đúng tiêu đề theo route.
6. Mọi input/select/textarea có font-size computed ≥16px ở viewport <768px.
7. `DialogContent` và `ResponsiveModal` cuộn được nội dung dài, nút đóng luôn thấy ở 375×667.
8. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass.
