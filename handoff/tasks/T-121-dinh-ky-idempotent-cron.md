# T-121 — Việc định kỳ: một nguồn sinh, idempotent, misfire, after_completion

Đọc và tuân thủ `handoff/tasks/_RULES.md`.

## Bối cảnh (đã kiểm trong code)
- Việc định kỳ được sinh ở **2 nơi**: client `hooks/useRecurringScheduler.ts` (mount trong `app/(app)/layout.tsx`, chạy mỗi 60s trên MỌI trình duyệt đang mở) và cron `app/api/cron/recurrence/route.ts`. Cả hai "kiểm tra có chưa → ghi" không transaction (`lib/tasks/series.ts` ~347-349, `route.ts` ~249-250). Doc kỳ chính có ID xác định (`occurrenceDocId`) nhưng **việc con dùng ID ngẫu nhiên** (`series.ts` ~170, `route.ts` ~121, ~314) → 2 nguồn chạy cùng lúc sinh trùng checklist việc con.
- Repo không có `vercel.json` → cron không được lên lịch; route mở công khai nếu thiếu `CRON_SECRET`, và nhận secret qua query `?secret=`.
- Logic dựng 1 kỳ bị chép 3 lần (2 lần trong `route.ts`, 1 lần `series.ts` ~97).
- `misfirePolicy` không được bộ sinh nào đọc. Kiểu không thống nhất: `lib/recurrence/types.ts:46` dùng `'create_missed' | 'skip_missed'`, `types/tasks.ts:150` và `lib/tasks/constants.ts:112` dùng `'CREATE_MISSED' | 'SKIP_MISSED'`.
- `recurrenceType: 'after_completion'`: kỳ tiếp chỉ được sinh khi hoàn thành trong `components/tasks/TaskDetail.tsx:278` (`generateNextCompletionOccurrence`). Hoàn thành qua Kanban/bulk/ô tick văn bản → chuỗi dừng; mở lại rồi hoàn thành lần nữa → sinh thêm 1 kỳ (trùng).

## Được sửa
`lib/recurrence/*` (thêm file mới được), `lib/tasks/series.ts`, `app/api/cron/recurrence/route.ts`, `hooks/useRecurringScheduler.ts`, mới `vercel.json`, `types/tasks.ts` (CHỈ kiểu `misfirePolicy`), `lib/tasks/constants.ts` (CHỈ `DEFAULT_MISFIRE_POLICY`), `__tests__/recurrence/*`.
KHÔNG sửa: `app/(app)/layout.tsx`, `components/**`, `lib/tasks/mutations.ts` (task khác đang/ sẽ sửa).

## Yêu cầu
1. **Builder dùng chung** `lib/recurrence/buildOccurrence.ts`: hàm thuần nhận `(series, occDate, opts)` trả `{ taskId, taskData, subtasks: Array<{ id, data }> }` với dữ liệu thường (ngày là `Date`; nơi gọi tự đổi sang `Timestamp` client/admin). ID việc con **xác định**: `${taskId}_st${index}` (index theo thứ tự template). Cả `series.ts` và `route.ts` dùng builder này, xoá code chép.
2. **Ghi idempotent:**
   - Server (admin SDK, `route.ts`): dùng `docRef.create()` cho kỳ chính; lỗi `ALREADY_EXISTS` (code 6) → bỏ qua kỳ đó (không tạo việc con). Việc con cũng `create()`.
   - Client (`series.ts`): `runTransaction` — `get` kỳ chính, tồn tại → bỏ qua; chưa có → `set` kỳ chính + việc con trong cùng transaction.
3. **Một nguồn sinh chính = cron:**
   - `vercel.json`: `{ "crons": [{ "path": "/api/cron/recurrence", "schedule": "0 22 * * *" }] }` (05:00 giờ VN).
   - `route.ts`: bắt buộc `CRON_SECRET` (thiếu env → 503 `{error:'CRON_SECRET not configured'}`), chỉ chấp nhận header `Authorization: Bearer <CRON_SECRET>` (Vercel Cron tự gửi), bỏ hẳn `?secret=`.
   - `useRecurringScheduler.ts`: chỉ chạy khi người dùng là admin (`useRole().isAdmin`), tối đa 1 lần/giờ (lưu mốc `localStorage['myoffice_recurrence_last_run']`), vẫn idempotent nhờ mục 2. Giữ export/chữ ký hook để `layout.tsx` không phải sửa.
4. **misfirePolicy:** thống nhất kiểu `'CREATE_MISSED' | 'SKIP_MISSED'` (sửa `lib/recurrence/types.ts`; đọc dữ liệu cũ chữ thường → chuẩn hoá về chữ hoa). Khi `SKIP_MISSED`: cửa sổ sinh bắt đầu từ `max(lastGenerated + 1 ngày, hôm nay 00:00 Asia/Ho_Chi_Minh)` → không sinh kỳ đã quá khứ. `CREATE_MISSED` giữ hành vi hiện tại.
5. **after_completion idempotent và không phụ thuộc đường hoàn thành:**
   - Kỳ kế tiếp có ID xác định từ kỳ trước: `${seriesId}_after_${previousTaskId}` → hoàn thành lại lần 2 không sinh thêm.
   - `generateNextCompletionOccurrence` dùng ID này + transaction (giữ export để `TaskDetail.tsx` vẫn gọi được).
   - Cron: với mỗi series `after_completion` đang `active`, tìm kỳ mới nhất; nếu nó `completed` và chưa có kỳ con (`previousTaskId == nó`) → sinh kỳ kế tiếp. Như vậy hoàn thành bằng Kanban/bulk cũng được bù trong lần cron kế tiếp.
6. **Test** (`__tests__/recurrence/`): builder sinh ID việc con xác định và ổn định giữa 2 lần gọi; `SKIP_MISSED` không trả kỳ trước hôm nay; `CREATE_MISSED` có trả; chuẩn hoá chữ thường→hoa; ID after_completion xác định.

## Tiêu chí nghiệm thu
1. Không còn đoạn code dựng kỳ bị chép: `route.ts` và `series.ts` đều import builder.
2. Gọi sinh cùng một kỳ 2 lần (client hoặc server) → đúng 1 kỳ chính và đúng N việc con (ID xác định, có test chứng minh tính ổn định ID).
3. `vercel.json` có cron hằng ngày; route trả 503 khi thiếu `CRON_SECRET`, 401 khi sai/thiếu header, không còn đọc `searchParams.get('secret')`.
4. Client scheduler không chạy với người không phải admin và không chạy quá 1 lần/giờ.
5. `SKIP_MISSED` được áp dụng ở cả client và cron; có test.
6. after_completion: ID kỳ kế tiếp xác định; cron bù kỳ kế tiếp khi kỳ trước đã hoàn thành.
7. `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass (kể cả test cũ `__tests__/recurrence/generate.test.ts`).
