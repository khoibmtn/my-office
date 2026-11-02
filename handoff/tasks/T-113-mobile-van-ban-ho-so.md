# T-113 — Mobile: xem văn bản + hồ sơ

Đọc và tuân thủ `handoff/tasks/_RULES.md`. Dùng primitive từ T-110: `.tap`, `.hover-reveal`, `ResponsiveModal`.

## Bối cảnh (đã kiểm trong code)
- `components/documents/DocumentModal.tsx`: CSS styled-jsx không có `@media`; `.modal-container` 92vw×88vh (~617-618), `.modal-sidebar` cố định 340px (~697) → ở 375px iframe xem trước gần như 0px; `.icon-btn` 26px (~801).
- `components/documents/DocumentViewer.tsx` (~31-33): chia cố định `w-2/5` + `h-screen`, không xếp dọc.
- `components/documents/DocumentTable.tsx`: đã có thẻ mobile (~2167) — ổn; select lọc 12px, ô tìm 13px (CSS ~2334, ~2375) gây zoom iOS.
- `app/(app)/dossiers/page.tsx` (~341, ~444) render `DossierPanel` cạnh nội dung trong hàng flex; `components/dossiers/DossierPanel.tsx` (~367) dùng `w-88` (class không tồn tại) → panel co giãn theo nội dung, đè danh sách. Nút mở/xoá công việc (~535, ~551) chỉ hiện khi hover.
- `DossierTable.tsx`, `DossierFolderGrid.tsx`, `DossierBreadcrumb.tsx` chưa kiểm kỹ ở 375px.

## Được sửa
`components/documents/DocumentModal.tsx`, `components/documents/DocumentViewer.tsx`, `components/documents/IframePreview.tsx`, `components/documents/AttachmentPanel.tsx`, `components/documents/DocumentTable.tsx` (CHỈ CSS font-size/vùng chạm), `app/(app)/documents/[id]/page.tsx`, `app/(app)/dossiers/page.tsx`, `components/dossiers/DossierPanel.tsx`, `DossierTable.tsx`, `DossierFolderGrid.tsx`, `DossierBreadcrumb.tsx`.
KHÔNG sửa: `components/documents/DocumentTaskSection.tsx` (thuộc T-120), `components/chat/*` (T-112), logic dữ liệu.

## Yêu cầu
1. `DocumentModal`: `@media (max-width: 767px)` → container `100vw × 100dvh`, không bo góc; 2 tab "Thông tin" / "Xem file" (mặc định "Xem file" nếu có file); `.icon-btn` ≥40px; nút đóng luôn thấy, có safe-area.
2. `DocumentViewer` + `documents/[id]`: `flex-col lg:flex-row`; cột thông tin `w-full lg:w-2/5`; iframe `h-[70dvh]` trên mobile; `h-screen` → `h-dvh`. Thêm nút "Mở trong Google Drive" (link `https://drive.google.com/file/d/{id}/view`) vì iframe preview trên iOS đôi khi khó cuộn/zoom.
3. `DocumentTable` CSS: select/ô tìm kiếm ≥16px dưới 768px; nút hành động trong thẻ mobile ≥40px.
4. Hồ sơ: dưới `md` `DossierPanel` là lớp phủ toàn màn hình (`fixed inset-0 z-40 bg-white`, header có nút X ≥44px), từ `md` là cột `md:w-96`; thay `w-88` bằng giá trị hợp lệ. Danh sách hồ sơ/văn bản trong hồ sơ không bị co khi panel mở. Nút hover-only thêm `hover-reveal`. `DossierTable` dưới `sm` dạng thẻ hoặc cuộn ngang gọn trong khung (không đẩy cả trang cuộn ngang).

## Tiêu chí nghiệm thu (375×667)
1. Mở một văn bản (modal và trang `/documents/[id]`) → iframe rộng ≥340px; nút đóng/hành động ≥40px.
2. Có nút "Mở trong Google Drive".
3. Mở panel hồ sơ không làm co danh sách; đóng được bằng X; mở/xoá công việc trong panel bằng chạm.
4. `/documents`, `/dossiers` không cuộn ngang toàn trang; input không gây zoom iOS (font ≥16px).
5. Desktop ≥1024px không đổi.
6. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass.
