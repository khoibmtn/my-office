# Báo cáo thực hiện T-121 — Việc định kỳ: một nguồn sinh, idempotent, misfire, after_completion

**Trạng thái:** chờ verify

## 1. Danh sách file đã sửa / tạo mới
- `lib/recurrence/buildOccurrence.ts` (tạo mới: builder thuần `buildOccurrence(series, occDate, opts)` trả `{ taskId, taskData, subtasks }` với dữ liệu `Date` thường và ID việc con xác định `${taskId}_st${index}`, cùng `afterCompletionDocId`, `computeNextCompletionDate`, `planAfterCompletionOccurrence`, `createOccurrenceAdmin`)
- `lib/recurrence/generate.ts` (sửa: thêm `normalizeMisfirePolicy`, `getTimezoneOffsetMs`, `getStartOfTodayInTimezone` tính đúng thời điểm 00:00 tại `timeZone` độc lập múi giờ máy, `resolveWindowStart`, `afterCompletionDocId`, và hỗ trợ `misfirePolicy` trong `generateOccurrences`)
- `lib/recurrence/types.ts` (sửa: thống nhất kiểu `MisfirePolicy = 'CREATE_MISSED' | 'SKIP_MISSED'`)
- `types/tasks.ts` (sửa: dùng kiểu `MisfirePolicy` dùng chung cho `TaskSeries.misfirePolicy`)
- `lib/tasks/constants.ts` (sửa: gán kiểu `MisfirePolicy` cho `DEFAULT_MISFIRE_POLICY`)
- `lib/tasks/series.ts` (sửa: xoá hàm chép `addOccurrenceToBatch`, dùng `buildOccurrence`, export `persistOccurrenceTransaction` dùng `runTransaction`, áp dụng `resolveWindowStart` cho `SKIP_MISSED`, chặn việc con/đã xoá/khác `occurrence` ở đầu `generateNextCompletionOccurrence`, và dùng ID xác định `${seriesId}_after_${previousTaskId}`)
- `app/api/cron/recurrence/route.ts` (sửa: bắt buộc `CRON_SECRET` trả 503 khi thiếu env và 401 khi thiếu/sai `Authorization: Bearer <CRON_SECRET>`, bỏ hẳn `?secret=`, dùng `firestore.batch()` với `batch.create(main)` + `batch.create(subtask_i)` bắt lỗi `ALREADY_EXISTS` code 6 trong `createOccurrenceAdmin`, cô lập lỗi từng series bằng `try/catch` gom vào `errors: [{ seriesId, message }]`, áp dụng `SKIP_MISSED` và bù kỳ kế tiếp chỉ cho kỳ chính của `after_completion`)
- `hooks/useRecurringScheduler.ts` (sửa: chỉ chạy khi `useRole().isAdmin`, giới hạn tối đa 1 lần/giờ qua `localStorage['myoffice_recurrence_last_run']`, giữ nguyên chữ ký hook)
- `vercel.json` (tạo mới: cấu hình cron `/api/cron/recurrence` với lịch `"0 22 * * *"`)
- `__tests__/recurrence/buildOccurrence.test.ts` (tạo mới & cập nhật vòng 1: unit test cho builder ID việc con xác định, test thật cho `persistOccurrenceTransaction` với mock `runTransaction` và `createOccurrenceAdmin` với mock `batch`, test độc lập múi giờ máy cho `getStartOfTodayInTimezone` và `SKIP_MISSED`/`CREATE_MISSED` với anchor 00:00 UTC, test loại trừ việc con trong `generateNextCompletionOccurrence` & `planAfterCompletionOccurrence`, và test cô lập lỗi từng series trong cron)

## 2. Tự kiểm từng tiêu chí nghiệm thu (AC)
1. **AC 1 — Không còn đoạn code dựng kỳ bị chép: `route.ts` và `series.ts` đều import builder:** **PASS**
   - Bằng chứng: `lib/recurrence/buildOccurrence.ts:160-303` (`buildOccurrence`), `lib/tasks/series.ts:13-22` (import `buildOccurrence`, `planAfterCompletionOccurrence`), `lib/tasks/series.ts:258` & `302` (gọi `buildOccurrence`), `app/api/cron/recurrence/route.ts:5-12` (import `buildOccurrence`, `planAfterCompletionOccurrence`), `app/api/cron/recurrence/route.ts:137` & `215` (gọi `planAfterCompletionOccurrence` và `buildOccurrence`).
2. **AC 2 — Gọi sinh cùng một kỳ 2 lần (client hoặc server) → đúng 1 kỳ chính và đúng N việc con (ID xác định, có test chứng minh tính ổn định ID):** **PASS**
   - Bằng chứng:
     - ID việc con xác định `${taskId}_st${index}`: `lib/recurrence/buildOccurrence.ts:238-296`.
     - Server (`route.ts`): `app/api/cron/recurrence/route.ts:46-68` (`createOccurrenceAdmin` dùng một `firestore.batch()` gồm `batch.create(taskRef, ...)` + `batch.create(subRef, ...)`; `batch.commit()` lỗi `ALREADY_EXISTS` code 6 → trả `false`, lỗi khác → ném lên).
     - Client (`series.ts`): `lib/tasks/series.ts:123-142` (`persistOccurrenceTransaction` dùng `runTransaction`, `tx.get(taskRef)` kiểm tra `existing.exists()` trước khi `tx.set` kỳ chính + việc con trong cùng transaction).
     - Test thật: `__tests__/recurrence/buildOccurrence.test.ts:112-194` và `453-589`.
3. **AC 3 — `vercel.json` có cron hằng ngày; route trả 503 khi thiếu `CRON_SECRET`, 401 khi sai/thiếu header, không còn đọc `searchParams.get('secret')`:** **PASS**
   - Bằng chứng: `vercel.json:1-8` (`"path": "/api/cron/recurrence", "schedule": "0 22 * * *"`), `app/api/cron/recurrence/route.ts:73-83`, test tại `__tests__/recurrence/buildOccurrence.test.ts:429-451`.
4. **AC 4 — Client scheduler không chạy với người không phải admin và không chạy quá 1 lần/giờ:** **PASS**
   - Bằng chứng: `hooks/useRecurringScheduler.ts:9-10` & `18-38`.
5. **AC 5 — `SKIP_MISSED` được áp dụng ở cả client và cron; có test:** **PASS**
   - Bằng chứng: `lib/recurrence/types.ts:46`, `lib/recurrence/generate.ts:18-108` (`normalizeMisfirePolicy`, `getTimezoneOffsetMs`, `getStartOfTodayInTimezone`, `resolveWindowStart`), `lib/tasks/series.ts:205-226`, `app/api/cron/recurrence/route.ts:164-183`, test độc lập múi giờ tại `__tests__/recurrence/buildOccurrence.test.ts:196-288`.
6. **AC 6 — after_completion: ID kỳ kế tiếp xác định; cron bù kỳ kế tiếp khi kỳ trước đã hoàn thành (chỉ xét kỳ chính, loại việc con):** **PASS**
   - Bằng chứng: `lib/tasks/series.ts:286-316` (`if (task.parentTaskId || task.deletedAt || task.type !== 'occurrence') return null` ở đầu `generateNextCompletionOccurrence`), `lib/recurrence/buildOccurrence.ts:351-409` (`planAfterCompletionOccurrence` lọc `!t.parentTaskId && !t.deletedAt && (!t.type || t.type === 'occurrence')`), `app/api/cron/recurrence/route.ts:113-149`, test tại `__tests__/recurrence/buildOccurrence.test.ts:290-416` và `453-589`.
7. **AC 7 — `npx tsc --noEmit` 0 lỗi; `npx vitest run` pass (kể cả test cũ `__tests__/recurrence/generate.test.ts`):** **PASS**
   - Bằng chứng: xem output kiểm tra bên dưới.

## 3. Vòng sửa 1 (theo phản hồi Claude verifier)
1. **Điểm 1 (Nặng — loại việc con trong `generateNextCompletionOccurrence` và logic bù kỳ cron):**
   - Đã thêm điều kiện chặn ngay đầu hàm `if (task.parentTaskId || task.deletedAt || task.type !== 'occurrence') return null` tại `lib/tasks/series.ts:287`.
   - Áp cùng điều kiện chỉ xét kỳ chính (`parentTaskId == null`, chưa xoá, `type === 'occurrence'`) tại `lib/recurrence/buildOccurrence.ts:356-358` (`planAfterCompletionOccurrence`), `lib/tasks/series.ts:165-177`, và `app/api/cron/recurrence/route.ts:120-135`.
   - Thêm unit test kiểm chứng việc con hoàn thành không sinh kỳ kế tiếp tại `__tests__/recurrence/buildOccurrence.test.ts:312-366` và `460-582`.
2. **Điểm 2 (Trung bình — `createOccurrenceAdmin` dùng một `firestore.batch()`):**
   - Đã sửa `createOccurrenceAdmin` dùng một `firestore.batch()` duy nhất gồm `batch.create(taskRef, ...)` + `batch.create(subRef, ...)` cho toàn bộ việc con; khi `batch.commit()` ném `ALREADY_EXISTS` (code 6) thì coi là đã tồn tại và trả `false`, lỗi khác thì ném lên tại `app/api/cron/recurrence/route.ts:46-68` (và `lib/recurrence/buildOccurrence.ts:428-451`).
3. **Điểm 3 (Thấp — cô lập lỗi từng series trong `route.ts`):**
   - Đã bọc `try/catch` riêng cho từng series trong vòng lặp `for (const docSnap of seriesSnap.docs)`, gom lỗi vào `errors: [{ seriesId, message }]` trả kèm JSON HTTP 200 (chỉ trả 500 khi lỗi toàn cục ngoài vòng lặp) tại `app/api/cron/recurrence/route.ts:96`, `103-239`, `241-248`.
   - Thêm test kiểm chứng một series hỏng không làm gãy các series khác tại `__tests__/recurrence/buildOccurrence.test.ts:482-488` & `566-573`.
4. **Điểm 4 (Thấp — `getStartOfTodayInTimezone` trả đúng thời điểm 00:00 tại `timeZone` độc lập múi giờ máy):**
   - Đã sửa `getStartOfTodayInTimezone` dùng `Intl.DateTimeFormat(...).formatToParts` + `getTimezoneOffsetMs` để tính đúng mốc UTC tương ứng 00:00:00.000 tại `timezone` (vd `Asia/Ho_Chi_Minh` → `17:00:00.000Z` ngày UTC liền trước) tại `lib/recurrence/generate.ts:25-77`.
   - Thêm test độc lập múi giờ máy (so sánh `.toISOString()` và chạy kiểm chứng cả với `TZ=UTC`) cũng như kiểm chứng `anchorDate` lưu `00:00 UTC` của hôm nay vẫn được sinh với `SKIP_MISSED`, còn `00:00 UTC` của hôm qua thì bị bỏ qua tại `__tests__/recurrence/buildOccurrence.test.ts:206-259`.
5. **Điểm 5 (Test thật cho idempotency, bỏ test tautology):**
   - Đã bỏ test tautology cũ và thay bằng test thật gọi trực tiếp `persistOccurrenceTransaction` (`lib/tasks/series.ts:123-142`) với mock `runTransaction` (lần 1 chưa có → `tx.set` đúng `1 + N = 4` lần; lần 2 đã tồn tại → `tx.set` `0` lần) và `createOccurrenceAdmin` với mock `batch` (`batch.create` `1 + N = 4` lần, `ALREADY_EXISTS` code 6 → trả `false` không ném, lỗi khác → ném) tại `__tests__/recurrence/buildOccurrence.test.ts:112-194`.

## 4. Kết quả chạy lệnh kiểm tra
- `npx tsc --noEmit`: 0 lỗi (exit code 0).
- `TZ=UTC npx vitest run` & `npx vitest run`:
  ```
  Test Files  7 passed (7)
       Tests  124 passed (124)
  ```
  (Bao gồm `__tests__/recurrence/generate.test.ts` 20/20 pass và `__tests__/recurrence/buildOccurrence.test.ts` 16/16 pass ở cả `TZ=UTC` và `Asia/Ho_Chi_Minh`).

## 5. Điểm chưa chắc / cần Claude quyết
- Không còn điểm nghẽn.
