# Quy tắc chung cho mọi task giao Antigravity (my-office)

Dự án: Next.js 14 App Router + Firestore + Tailwind. Đọc `CONTEXT.md` trước. Giao diện tiếng Việt; code, tên biến tiếng Anh. Viết theo quy ước sẵn có của file xung quanh.

## CẤM
1. KHÔNG `git commit`, `git push`, `git checkout`, `git stash`, `git reset`, đổi nhánh. Claude Code sẽ xác minh rồi commit.
2. KHÔNG `npm install` / thêm phụ thuộc mới.
3. KHÔNG chạy `npm run dev`, `npm run build`, `next build` (thư mục `.next` dùng chung với agent khác). Chỉ chạy `npx tsc --noEmit` và `npx vitest run`.
4. KHÔNG đọc/sửa `.env*`, KHÔNG chạy script ghi vào Firestore/Drive/Algolia thật (production). Test chỉ dùng hàm thuần, không gọi mạng.
5. KHÔNG sửa file ngoài danh sách "Được sửa" của task. Có thể có agent khác đang sửa các file khác cùng lúc — KHÔNG hoàn tác/format lại thay đổi chưa commit của người khác (vd `app/(app)/layout.tsx` đã được Claude sửa dòng class `<aside>`).
6. KHÔNG tự ghi "XONG" nếu `npx tsc --noEmit` còn lỗi hoặc `npx vitest run` có test fail.

## Khi xong
Ghi `handoff/tasks/<ID>-REPORT.md`: với TỪNG tiêu chí nghiệm thu (AC) → PASS/FAIL + bằng chứng `file:dòng`; danh sách file đã sửa; output cuối của `npx tsc --noEmit` và `npx vitest run`; điểm chưa chắc / cần Claude quyết.
