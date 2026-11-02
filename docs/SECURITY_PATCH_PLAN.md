# Phương án vá bảo mật API & Firestore — my-office

> Soạn 02/11/2026 (Claude Code). Trạng thái: **S1 đã triển khai trong code 03/11/2026 (chờ deploy)**; S2, S3 chưa làm.
> Phạm vi bảo mật/auth do Claude Code thực hiện, không giao Antigravity (quy ước dự án).

## 1. Hiện trạng (đã kiểm trên code + site live https://my-office-inky.vercel.app)

| # | Mức | Vấn đề | Bằng chứng |
|---|---|---|---|
| 1 | 🔴 Nghiêm trọng | `GET /api/drive/token` không cần đăng nhập, CORS `*`, trả access token Drive của tài khoản admin (từ `GOOGLE_REFRESH_TOKEN`) | `app/api/drive/token/route.ts` |
| 2 | 🔴 Nghiêm trọng | Mọi khách vào trang đều được `signInAnonymously` → Firestore rules chỉ cần `request.auth != null` → ai cũng **đọc/ghi/xoá** toàn bộ dữ liệu (đã thấy: chưa đăng nhập vẫn xem đủ văn bản, công việc) | `lib/firebase.ts:280`, `firestore.rules` |
| 3 | 🔴 Nghiêm trọng | `staff.passwordHash` (SHA-256 không salt) đọc được bởi bất kỳ ai; đăng nhập nhân viên so hash phía client và `/api/auth/login` nhận **hash** chứ không nhận mật khẩu → lộ hash = đăng nhập được (pass-the-hash) | `lib/staff.ts:23,191`, `app/api/auth/login/route.ts` |
| 4 | 🔴 | Phân quyền RBAC chỉ ẩn/hiện nút ở giao diện, không có kiểm tra phía server/rules | `lib/permissions.ts`, `lib/tasks/permissions.ts` |
| 5 | 🟠 Cao | `POST /api/drive/copy` không xác thực + server `fetch(url)` tuỳ ý → SSRF, dùng quota Drive của admin | `lib/drive.ts:uploadUrlToDrive` |
| 6 | 🟠 | `POST /api/drive/upload` không xác thực → ai cũng upload file lên Drive admin và nhận link công khai | `app/api/drive/upload/route.ts` |
| 7 | 🟠 | `POST /api/admin/migrate-staff` không xác thực (hiện tự chặn nếu staff đã có dữ liệu, nhưng vẫn là cửa hậu) | `app/api/admin/migrate-staff/route.ts` |
| 8 | 🟠 | `GET /api/extension/test-upload` route debug đọc `~/.config/gcloud/application_default_credentials.json` | `app/api/extension/test-upload/route.ts` |
| 9 | 🟡 | `check-duplicate`, `extension/config`, `extension/token` không xác thực; CORS `*` cho toàn bộ `/api/extension/*` | `next.config.mjs`, các route |
| 10 | 🟡 | `/api/cron/recurrence` chỉ kiểm `CRON_SECRET` *nếu có cấu hình*; nhận secret qua query string (lọt log) | `app/api/cron/recurrence/route.ts` |
| 11 | 🟡 | Lỗi 500 trả cả `stack` ra ngoài | `app/api/extension/upload/init/route.ts` |

Đã kiểm: lịch sử git **không** chứa khoá Algolia admin, private key SA, hay OAuth client secret. `CLAUDE.md`/`.env.local` không được track.

## 2. Phương án — 3 đợt, mỗi đợt deploy độc lập

### Đợt S1 — Đóng cửa API (nhanh, ~nửa ngày, không đổi trải nghiệm người dùng)

1. **Xoá** `app/api/extension/test-upload/` và `app/api/admin/migrate-staff/` (migration đã chạy xong — staff đã có dữ liệu).
2. Tạo `lib/api-auth.ts` (server-only) dùng chung:
   - `requireUser(req, { allowAnonymous?: false, adminOnly?: boolean })` — đọc `Authorization: Bearer <Firebase ID token>`, xác minh bằng `firebase-admin` `getAuth().verifyIdToken()` (thay `verifyIdTokenREST`), từ chối user ẩn danh (`firebase.sign_in_provider === 'anonymous'`), `adminOnly` → email phải là `ADMIN_EMAIL`.
   - `requireUserOrIngest(req, body)` — chấp nhận `ingestSecret` (qlvb-watcher) **hoặc** ID token.
   - `corsHeaders(origin)` — chỉ cho phép `chrome-extension://<EXTENSION_ID>` (env `EXTENSION_ORIGIN`) và origin của app; bỏ `*`.
3. Áp dụng:
   | Route | Yêu cầu |
   |---|---|
   | `drive/token` | `adminOnly` (chỉ `useDriveToken` của admin dùng). Bỏ set cookie. |
   | `drive/copy`, `drive/upload` | `requireUser` (không ẩn danh) |
   | `extension/check-duplicate`, `extension/config`, `extension/token` | `requireUserOrIngest` (extension đã có `firebaseIdToken`) |
   | `extension/upload/init`, `extension/submit` | giữ logic hiện tại, chuyển sang helper; bỏ `stack` trong lỗi |
   | `cron/recurrence` | **bắt buộc** `CRON_SECRET` (thiếu env → 503), chỉ nhận header `Authorization`, bỏ `?secret=` |
4. Chống SSRF ở `uploadUrlToDrive`: chỉ `https:`, chặn IP nội bộ/loopback/link-local sau khi resolve DNS, giới hạn 25 MB, timeout 20 s, không follow redirect sang host khác. (Link Drive/Docs đi nhánh `files.copy`, không fetch.)
5. Client: các chỗ gọi `fetch('/api/drive/...')` (`lib/firestore.ts`, `app/(app)/documents/new/page.tsx`, `[id]/edit/page.tsx`, `DocumentForm.tsx`, `AttachmentInput.tsx`, `lib/firebase.ts`) thêm header `Authorization: Bearer ${await auth().currentUser.getIdToken()}` qua 1 helper `authedFetch()`.

**Nghiệm thu S1:** gọi `curl` không token tới từng route → 401/403; có token admin → hoạt động như cũ; extension + qlvb-watcher vẫn gửi văn bản được; `npx tsc --noEmit` sạch.

### Đợt S2 — Danh tính thật cho nhân viên + Firestore rules (gốc rễ, ~1–2 ngày)

1. **Đăng nhập nhân viên phía server, cấp Firebase custom token:**
   - Client gửi `{ nickname, password }` (mật khẩu thô, qua HTTPS) tới `/api/auth/login`.
   - Server kiểm bằng **scrypt + salt** (Node `crypto.scrypt`, không cần thư viện mới). Tương thích ngược: nếu bản ghi còn hash SHA-256 cũ và khớp → băm lại scrypt và lưu (chuyển đổi dần, không bắt reset mật khẩu).
   - Server trả `createCustomToken(staffDocId, { role, staffId, deptIds })` → client `signInWithCustomToken`. `useRole` lấy vai trò từ custom claims thay vì `localStorage.staffSession` (localStorage sửa tay được).
   - Rate-limit đăng nhập (5 lần/phút/nickname, lưu Firestore `loginAttempts`).
2. **Tách bí mật khỏi collection công khai:** chuyển `passwordHash` sang `staffSecrets/{staffDocId}` (rules: `allow read, write: if false` — chỉ Admin SDK). Đổi mật khẩu đi qua API `/api/staff/password` (admin hoặc chính chủ).
3. **Bỏ đăng nhập ẩn danh** (hoặc giữ ẩn danh nhưng rules chặn hoàn toàn) — *cần anh Khôi quyết định: có cần chế độ "Khách" xem văn bản không?*
4. **Firestore rules theo vai trò** (claims `role` từ custom token; admin nhận diện bằng `request.auth.token.email`):
   - Đọc: chỉ user đã đăng nhập không ẩn danh.
   - `staff`, `departments`, `settings`, `tags`: ghi chỉ admin (và `truong_phong` cho `tags`).
   - `documents`: tạo/sửa với vai trò ∈ {admin, truong_phong, pho_phong, giao_viec}; nhân viên chỉ được cập nhật `status/completedDate` khi `assigneeId == staffId` (dùng `affectedKeys().hasOnly([...])`).
   - `tasks`: tạo theo `task:create`; sửa khi là người tạo / người được giao / lãnh đạo khoa cùng `departmentId`; xoá chỉ người tạo hoặc admin.
   - `taskComments`: tạo khi `senderId == staffId`; sửa/xoá chỉ chính chủ.
   - `notifications`: đọc/sửa khi `recipientId == staffId`.
5. Viết test rules bằng `@firebase/rules-unit-testing` + emulator (phụ thuộc dev mới — xin phép trước khi thêm).

**Nghiệm thu S2:** khách chưa đăng nhập không đọc được gì; nhân viên A không sửa được việc của khoa khác; không client nào đọc được `passwordHash`; toàn bộ test rules pass; người dùng hiện tại đăng nhập lại bình thường bằng mật khẩu cũ.

### Đợt S3 — Vận hành

1. Giới hạn scope `GOOGLE_REFRESH_TOKEN` về `drive.file` (tạo lại token nếu đang là `drive` toàn quyền).
2. Đặt `CRON_SECRET`, `EXTENSION_ORIGIN` trên Vercel; thêm `vercel.json` khai báo cron (hoặc chuyển sang Cloudflare Worker — xem skill `firebase-cron-sang-cloudflare`).
3. Bật App Check (reCAPTCHA Enterprise) cho Firestore để chặn script ngoài dùng API key công khai.
4. Rà `npm audit`; đặt header bảo mật (`X-Frame-Options`, `Referrer-Policy`) trong `next.config.mjs`.

## 3. Thứ tự đề xuất
S1 ngay (đóng lỗ hổng #1, #5–#11, rủi ro thấp) → S2 sau khi anh chốt câu hỏi "Khách" → S3.

## 4. Kết quả S1 (03/11/2026)

**Đã làm**
- `lib/api-auth.ts`: `authenticateRequest()` — chấp nhận (1) `ingestSecret` của qlvb-watcher, (2) Firebase ID token của tài khoản admin, (3) phiên nhân viên có ký HMAC (`X-Staff-Session` / `staffSessionToken`). User ẩn danh và tài khoản Google khác bị từ chối. Xác minh admin bằng Admin SDK, dự phòng bằng Identity Toolkit REST.
- `lib/server/staff-session.ts`: `/api/auth/login` cấp token phiên 30 ngày (khoá `STAFF_SESSION_SECRET`, mặc định dẫn xuất từ private key của `FIREBASE_ADMIN_SDK_KEY`); server kiểm nhân viên còn `isActive`.
- Đóng: `drive/copy`, `drive/upload` (admin/nhân viên), `drive/token` (chỉ admin, bỏ cookie), `extension/check-duplicate|upload/init|submit` (admin/nhân viên/ingest). Lỗi 500 không còn trả `stack`/message nội bộ.
- Xoá: `extension/test-upload`, `admin/migrate-staff`, `extension/token`, `extension/config` (không còn nơi gọi).
- Bỏ CORS `*`; chỉ phản hồi origin `chrome-extension://` (ghim được bằng `EXTENSION_ORIGIN`). Thêm `X-Content-Type-Options`, `Referrer-Policy`.
- Chống SSRF (`lib/server/safe-fetch.ts`): chỉ http/https, chặn IP nội bộ/metadata ở mọi bước chuyển hướng, ≤3 redirect, timeout 20s, ≤25 MB.
- Banner/auto-refresh token Drive chỉ chạy cho admin và không bao giờ tự mở popup.
- Extension 1.1.0 gửi kèm token phiên nhân viên; qlvb-watcher gửi `ingestSecret` khi kiểm trùng.

**Đã kiểm**: curl mọi route không xác thực/ token giả → 401/403; route đã xoá → 404; origin lạ không nhận header CORS; phiên nhân viên hợp lệ → `check-duplicate` 200, `drive/token` 401; URL metadata nội bộ bị chặn. tsc sạch, vitest pass, `next build` thành công.

**Thứ tự deploy (để không gián đoạn)**
1. qlvb-watcher: `wrangler deploy` (gửi thêm `ingestSecret` không ảnh hưởng API cũ).
2. Extension: tải lại extension 1.1.0 trong `chrome://extensions`.
3. `firebase deploy --only firestore:indexes` (index của T-122).
4. Vercel: đặt `CRON_SECRET`; (khuyến nghị) `STAFF_SESSION_SECRET` (chuỗi ngẫu nhiên ≥32 ký tự), `EXTENSION_ORIGIN=chrome-extension://<id>`. Rồi deploy my-office.
5. Nhân viên đăng xuất/đăng nhập lại một lần để nhận token phiên (phiên cũ không có token → upload văn bản báo 401).

**Vòng soát bảo mật độc lập — đã sửa thêm**
- Nhân viên dùng `drive/copy` với link Drive: chỉ sao chép được file nguồn **đã** chia sẻ "Bất kỳ ai có đường liên kết" (trước đó có thể dùng quyền admin để sao chép file riêng của admin rồi công khai bản sao). Nhân viên luôn ghi vào `DRIVE_FOLDER_ID`, không tự chọn thư mục/token. Admin không bị giới hạn.
- 4xx không còn retry 3 lần; nhân viên gặp 401 (phiên cũ chưa có token) được đưa về trang đăng nhập kèm thông báo.
- `/api/auth/login` trả lỗi rõ khi server chưa cấu hình khoá ký phiên.
- Lỗi `drive/copy|upload` không còn trả nguyên lỗi Google API (chỉ trả thông điệp thân thiện của app).
- Chặn thêm IPv6 `::a.b.c.d`, NAT64 `64:ff9b::/96`, `fec0::/10`.

**Giữ nguyên có chủ đích:** file của app trên Drive vẫn để "Bất kỳ ai có đường liên kết đều xem được" (quyết định D-04, anh Khôi xác nhận 03/11/2026) — không thuộc phạm vi vá.

**Còn lại cho S2**: token phiên nhân viên chưa bị thu hồi khi đổi mật khẩu (vẫn dùng được tới 30 ngày; vô hiệu hoá tài khoản thì có hiệu lực ngay); popup extension không làm mới token nên kiểm trùng có thể bị bỏ qua sau ~1 giờ; Firestore rules vẫn mở cho user ẩn danh; `passwordHash` vẫn đọc được từ client; `/api/auth/login` vẫn nhận hash (pass-the-hash); nhân viên xoá văn bản không còn xoá được file Drive kèm theo (trước đây dùng token Drive của admin trên trình duyệt).
