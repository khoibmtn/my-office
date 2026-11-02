# Rà soát luồng công việc, dashboard & giao diện mobile — 02/11/2026

Người rà soát: Claude Code (đọc code + kiểm site live https://my-office-inky.vercel.app ở 390×844).
Phương án bảo mật: xem `docs/SECURITY_PATCH_PLAN.md`.

## 1. Lỗi làm sai dữ liệu / gãy luồng (ưu tiên cao)

| # | Vấn đề | Hệ quả | Task |
|---|---|---|---|
| 1 | Sidebar có cả `fixed` + `relative` (regression từ commit `6e85289`) | Trên điện thoại nội dung chỉ còn ~130px — gần như không dùng được | **Đã sửa** (Claude), `app/(app)/layout.tsx` |
| 2 | `createTask` bỏ `status`, `dependsOnTaskIds`, `templateId`, `assigneeDepartmentId`… | Chọn "phụ thuộc" khi tạo việc vô tác dụng; tự mở khoá không bao giờ chạy | T-120 |
| 3 | Việc định kỳ sinh ở 2 nơi (client mỗi 60s + cron), việc con ID ngẫu nhiên | Trùng checklist việc con khi nhiều người mở app | T-121 |
| 4 | Cron `/api/cron/recurrence` không được lên lịch (không có `vercel.json`) | Việc định kỳ chỉ sinh khi có người mở app | T-121 |
| 5 | Nhiều đường đổi trạng thái bỏ qua kiểm tra (Kanban, bulk, việc con, văn bản) | Việc cha hoàn thành khi việc con còn mở; nhật ký có bước "bị chặn" giả | T-120 |
| 6 | `after_completion` chỉ sinh kỳ sau khi hoàn thành trong trang chi tiết | Hoàn thành ở Kanban/bulk → chuỗi định kỳ dừng hẳn | T-120, T-121 |
| 7 | `misfirePolicy` không được dùng | Bật lại chuỗi đã tạm dừng → sinh hàng loạt kỳ quá hạn | T-121 |
| 8 | "Hoàn thành tuần/tháng" đếm toàn bộ việc đã xong | Dashboard sai số | T-122 |
| 9 | Việc định kỳ "sinh trước 14 ngày" hiện ngay trong danh sách; lịch hiện cả việc con | Danh sách và thống kê bị phình | T-122 |
| 10 | `useTasks` tải toàn bộ collection `tasks`, ~11 listener | Lượt đọc Firestore tăng theo lịch sử, chậm dần | T-122 |
| 11 | Giao lại việc không thông báo người nhận, kiểm sai quyền | Người nhận không biết; nhân viên tự chuyển việc cho người khác | T-120 |
| 12 | Mở lại việc không xoá `completedAt` | Báo cáo hoàn thành sai | T-120 |

## 2. Giao diện điện thoại (ngoài lỗi #1)
- Không có thanh tab đáy; header luôn ghi "Văn bản"; `h-screen` bị thanh Safari che đáy; input 12–14px → iOS tự zoom. → **T-110**
- Danh sách công việc là bảng 7 cột cuộn ngang; 5 thẻ thống kê chiếm màn đầu; Kanban kéo-thả không chạy bằng chạm; Lịch 7 cột chữ 10px. → **T-111**
- Chi tiết công việc: cột chat cố định 320px → cột thông tin ~55px; nhiều nút chỉ hiện khi rê chuột. → **T-112**
- Xem văn bản: sidebar modal cố định 340px → iframe ~0px; panel hồ sơ đè danh sách. → **T-113**

## 3. Kế hoạch giao Antigravity (Gemini 4 Argon High), Claude xác minh
| Đợt | Task | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | T-110 | Mobile: nền tảng + khung app, tab đáy | ✅ Đạt (1 vòng sửa, chạy thử 375px + desktop) |
| 1 | T-121 | Định kỳ: 1 nguồn sinh (cron), idempotent, misfire, after_completion | ✅ Đạt (1 vòng sửa) |
| 2 | T-120 | Lõi luồng việc + tự đồng bộ văn bản ↔ công việc | ✅ Đạt (1 vòng sửa) |
| 2 | T-122 | Dashboard đúng số + giảm lượt đọc Firestore | ✅ Đạt (2 vòng sửa + Claude sửa 2 lỗi nhỏ) |
| 2 | T-113 | Mobile: văn bản + hồ sơ | ✅ Đạt (2 vòng sửa) |
| 3 | T-111 | Mobile: danh sách / Kanban / Lịch | ✅ Đạt (Claude sửa 3 lỗi nhỏ) |
| 3 | T-112 | Mobile: chi tiết việc + chat | ✅ Đạt (1 vòng sửa + Claude sửa tự cuộn chat) |

Các task trong cùng đợt không sửa chung file → chạy song song an toàn.

## 4. Cần anh Khôi quyết định
1. ~~Đồng bộ văn bản ↔ công việc~~ — **Đã chốt 02/11: tự đồng bộ** (đưa vào T-120, mục 8).
2. **Chế độ Khách:** có cần người chưa đăng nhập xem được văn bản không? (quyết định cách sửa Firestore rules ở đợt bảo mật S2).
3. **Bảo mật đợt S1** (đóng API, không đổi trải nghiệm): Claude tự làm sau khi các đợt trên xong, hay làm ngay?

## 5. Kết quả (03/11/2026)
- Tất cả 7 task đạt sau xác minh độc lập (verifier riêng từng task). `npx tsc --noEmit` 0 lỗi, `npx vitest run` 167/167, `next build` thành công (34 route).
- Chạy thử giao diện thật ở 375×667 và 1280×800 với tài khoản khách: khung app, tab đáy, drawer, modal văn bản. Màn công việc chỉ kiểm bằng code (khách không có quyền xem công việc).
- **Việc phải làm khi deploy:**
  1. `firebase deploy --only firestore:indexes` (index mới `tasks: isClosed ASC + updatedAt DESC` — thiếu thì danh sách việc đã đóng báo lỗi).
  2. Đặt biến `CRON_SECRET` trên Vercel (thiếu → `/api/cron/recurrence` trả 503; trình duyệt admin vẫn sinh việc định kỳ tối đa 1 lần/giờ).
- Chưa làm: sửa việc định kỳ qua `updateRecurringTaskScoped` chưa gửi thông báo/REASSIGNED/đồng bộ văn bản; hỏi xác nhận khi tự hoàn thành văn bản còn việc mở.
