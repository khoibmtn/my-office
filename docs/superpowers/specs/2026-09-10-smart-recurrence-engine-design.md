# Thiết Kế Kỹ Thuật: Hệ Thống Quản Lý Công Việc Định Kỳ Thông Minh (Smart Recurrence Engine)

- **Tài liệu**: `docs/superpowers/specs/2026-09-10-smart-recurrence-engine-design.md`
- **Ngày lập**: 10/09/2026
- **Trạng thái**: Đã phê duyệt (Approved)
- **Tác giả**: Pair programming giữa User & Antigravity

---

## 1. Mục Tiêu & Bối Cảnh (Context & Objectives)

Hệ thống quản lý công việc hiện tại của My Office đã có nền tảng `TaskSeries` và `Task`, tuy nhiên cơ chế vận hành công việc định kỳ vẫn còn mang tính thủ công và chưa đạt độ thông minh cần thiết:
1. **Thiếu tự động hóa**: Phải bấm nút thủ công thì công việc mới sinh ra; chưa có cơ chế tự động sinh ngầm khi đến kỳ.
2. **Quy tắc lặp còn đơn giản**: Chưa hỗ trợ các nghiệp vụ y tế và hành chính thực tế như: lặp theo vị trí trong tháng (*Thứ Hai đầu tiên của tháng, Thứ Sáu cuối cùng của tháng*), chưa có cơ chế xử lý ngày nghỉ cuối tuần (lùi về Thứ Sáu hoặc dời sang Thứ Hai).
3. **Chỉ hỗ trợ một chiều lịch**: Chưa có cơ chế "Lặp lại sau khi hoàn thành kỳ trước" (Completion-based recurrence kiểu Asana/Todoist).
4. **Thiếu cơ chế xử lý ngoại lệ chuẩn Google Calendar**: Khi muốn dời hạn hoặc đổi người cho riêng 1 kỳ, chưa có hộp thoại hỏi phạm vi (*Chỉ kỳ này / Kỳ này và các kỳ sau / Tất cả các kỳ*), dẫn đến việc chỉnh sửa làm đứt gãy tính liên kết của chuỗi.
5. **Đứt gãy chuỗi đối soát**: Khi làm việc kỳ này, nhân sự chưa xem nhanh được số liệu, tài liệu và trao đổi của kỳ trước để đối chiếu.

Tài liệu này đặc tả kiến trúc **Smart Recurrence Engine** chuẩn mực, kết hợp giữa tiêu chuẩn **RFC 5545 (iCalendar / Google Calendar)** và cơ chế quản lý nhiệm vụ nối tiếp của **Asana / Todoist**, vận hành tối ưu trên nền tảng Next.js và Firestore.

---

## 2. Kiến Trúc Dữ Liệu & Schema (Domain Schema)

### 2.1. Cấu trúc `TaskSeries` (Bộ quy tắc chuỗi định kỳ)

Lưu tại Firestore collection `/taskSeries/{seriesId}`:

```typescript
export type RecurrenceType = 'calendar' | 'after_completion'
export type WeekendPolicy = 'exact' | 'shift_friday' | 'shift_monday'

export interface TaskSeries {
  id: string
  title: string
  description: string | null

  // 1. Phân loại cơ chế kích hoạt
  recurrenceType: RecurrenceType            // 'calendar' (lịch cố định) | 'after_completion' (lặp sau khi xong kỳ trước)
  completionOffsetDays?: number             // Nếu after_completion: sinh kỳ tiếp theo sau N ngày kể từ khi kỳ trước xong

  // 2. Quy tắc lặp chuẩn RFC 5545
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number                          // Mỗi N ngày/tuần/tháng/năm (>= 1)
  byWeekday: number[] | null                // [1..7] (1 = Thứ 2 ... 7 = Chủ nhật)
  byMonthDay: number[] | null               // [1..31] hoặc -1 (ngày cuối tháng), hỗ trợ khoảng [1..5]
  byMonth: number[] | null                  // [1..12], hỗ trợ khoảng tháng [1..3]
  bySetPos: number | null                   // 1 = Đầu tiên, 2 = Thứ hai, -1 = Cuối cùng của tháng (kết hợp với byWeekday)
  occurrenceTime: string                    // "08:00" - Giờ:Phút thực hiện cố định
  timezone: string                          // Mặc định: "Asia/Ho_Chi_Minh"

  // 3. Chính sách ngày nghỉ cuối tuần
  weekendPolicy: WeekendPolicy              // 'exact' | 'shift_friday' | 'shift_monday'

  // 4. Quản lý cửa sổ & Chu kỳ
  leadDays: number                          // Xuất hiện trước ngày thực hiện N ngày (mặc định: 3)
  rollingWindowDays: number                 // Cửa sổ quét sinh việc (mặc định: 14 ngày)
  misfirePolicy: 'CREATE_MISSED' | 'SKIP_MISSED'
  status: 'active' | 'paused' | 'ended'
  startDate: Timestamp
  endDate: Timestamp | null

  // 5. Mẫu công việc con & Mặc định cho kỳ sinh ra
  defaultAssigneeId: string | null
  defaultCollaboratorIds: string[]
  defaultPriority: TaskPriority
  defaultDepartmentId: string | null
  defaultTagIds: string[]
  defaultSubtasks: Array<{
    order: number
    title: string
    estimatedMinutes?: number | null
  }>

  // 6. Lịch sử quản lý chuỗi
  previousSeriesId?: string | null          // Nếu chuỗi này sinh ra từ việc "Cắt chuỗi từ kỳ này trở đi"
  lastGeneratedDate: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
```

### 2.2. Mở rộng `Task` (Thực thể công việc sinh ra)

Lưu tại Firestore collection `/tasks/{taskId}`:

```typescript
export interface Task {
  // ... các trường cơ bản của Task ...
  id: string
  title: string
  type: 'single' | 'occurrence'
  status: TaskStatus
  progress: number

  // Liên kết chuỗi định kỳ
  seriesId: string | null                   // ID chuỗi gốc
  occurrenceKey: string | null              // Định danh duy nhất: "seriesId:YYYY-MM-DD"
  occurrenceDate: Timestamp | null          // Ngày của kỳ này
  isDetached: boolean                       // true nếu đã được tách riêng bằng lệnh "Chỉ sửa kỳ này"
  previousTaskId: string | null             // ID task của kỳ liền trước để liên kết đối soát
}
```

---

## 3. Thuật Toán Sinh Lịch & Quy Tắc Nâng Cao

### 3.1. Thuật toán `bySetPos` (Vị trí trong tháng)
Cho phép sinh ngày chính xác theo quy tắc như: *Thứ Hai đầu tiên* hoặc *Thứ Sáu cuối cùng* của tháng.
```typescript
function resolveBySetPos(year: number, month: number, targetWeekday: number, setPos: number): number {
  // month is 1-indexed (1..12)
  const daysInMonth = new Date(year, month, 0).getDate()
  const matchingDays: number[] = []
  
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    const jsDay = d.getDay()
    const isoDay = jsDay === 0 ? 7 : jsDay
    if (isoDay === targetWeekday) {
      matchingDays.push(day)
    }
  }

  if (matchingDays.length === 0) return 1
  if (setPos > 0) {
    return matchingDays[Math.min(setPos - 1, matchingDays.length - 1)]
  } else {
    // setPos < 0: -1 là ngày cuối cùng
    return matchingDays[Math.max(0, matchingDays.length + setPos)]
  }
}
```

### 3.2. Điều chỉnh ngày nghỉ cuối tuần (`applyWeekendPolicy`)
```typescript
function applyWeekendPolicy(date: Date, policy: WeekendPolicy): Date {
  const day = date.getDay() // 0 = Sun, 6 = Sat
  if (policy === 'exact' || (day !== 0 && day !== 6)) {
    return date
  }

  const adjusted = new Date(date)
  if (policy === 'shift_friday') {
    // Sat (6) -> lùi 1 ngày; Sun (0) -> lùi 2 ngày
    const offset = day === 6 ? -1 : -2
    adjusted.setDate(adjusted.getDate() + offset)
  } else if (policy === 'shift_monday') {
    // Sat (6) -> tiến 2 ngày; Sun (0) -> tiến 1 ngày
    const offset = day === 6 ? 2 : 1
    adjusted.setDate(adjusted.getDate() + offset)
  }
  return adjusted
}
```

### 3.3. Kế thừa Subtasks & Liên kết kỳ trước
Khi sinh một Task Occurrence:
1. `docId = occurrenceDocId(series.id, occDate)` -> bảo đảm tính Idempotent 100%.
2. Tự động truy vấn task kỳ liền trước:
   ```typescript
   const prevTaskSnap = await getDocs(query(
     collection(db(), 'tasks'),
     where('seriesId', '==', series.id),
     where('occurrenceDate', '<', Timestamp.fromDate(occDate)),
     orderBy('occurrenceDate', 'desc'),
     limit(1)
   ))
   const previousTaskId = !prevTaskSnap.empty ? prevTaskSnap.docs[0].id : null
   ```
3. Khởi tạo Subtasks: Duyệt qua `series.defaultSubtasks`, tạo các document subtask con với trạng thái `pending`.

---

## 4. Cơ Chế Kích Hoạt Tự Động 3 Kênh (Triple-Trigger Engine)

1. **Server Cron Route (`/api/cron/recurrence`)**:
   - Chạy định kỳ qua Vercel Cron (ví dụ `0 0 * * *` lúc nửa đêm, hoặc mỗi giờ).
   - Bảo vệ bằng header `Authorization: Bearer ${CRON_SECRET}`.
   - Quét tất cả series có `status === 'active'` và `recurrenceType === 'calendar'`.
   - Sinh các occurrence trong khoảng `[today, today + rollingWindowDays]`.
2. **Client Opportunistic Sync (`useRecurringScheduler`)**:
   - Chạy ngầm trong ứng dụng Next.js khi người dùng đăng nhập hoặc mở các trang `/tasks`, `/dashboard`, `/tasks/calendar`.
   - Throttle 60 giây / lần kiểm tra để tiết kiệm tài nguyên.
   - Tự động phát hiện và sinh ngay các kỳ cần thực hiện trong hôm nay mà không bắt buộc phải có server cron.
3. **Completion Trigger (Khi hoàn thành kỳ trước)**:
   - Trong mutation `updateTaskStatus`, nếu task có `seriesId` và chuỗi có `recurrenceType === 'after_completion'`, khi task chuyển sang `completed`:
   - Tính ngày tiếp theo: `nextDate = new Date(Date.now() + (series.completionOffsetDays || 1) * 86400000)`.
   - Sinh ngay công việc kỳ tiếp theo và gán vào hệ thống.

---

## 5. Cơ Chế Xử Lý Phạm Vi Sửa Đổi Chuẩn Google Calendar

Khi người dùng nhấn **Chỉnh sửa** hoặc **Xóa / Hủy** một công việc định kỳ:

### 5.1. Phạm vi 1: "Chỉ công việc kỳ này" (This occurrence only)
- Giữ nguyên `seriesId` để tra cứu lịch sử, nhưng đánh dấu `isDetached: true`.
- Áp dụng thay đổi (tiêu đề, hạn, người giao, mức ưu tiên) riêng cho task này.
- Các kỳ sau của chuỗi hoàn toàn không bị ảnh hưởng.

### 5.2. Phạm vi 2: "Công việc này và tất cả các kỳ tiếp theo" (This and following)
1. **Chốt chuỗi cũ**: Cập nhật chuỗi cũ `endDate = Timestamp.fromDate(ngày trước kỳ này)`.
2. **Tạo chuỗi mới**: Khởi tạo `TaskSeries` mới bắt đầu từ ngày của kỳ này, thừa hưởng các quy tắc và áp dụng các thay đổi mới của người dùng, đặt `previousSeriesId = oldSeries.id`.
3. **Cập nhật các kỳ chưa đóng**: Đổi `seriesId` của các kỳ tương lai đã sinh sang ID chuỗi mới.

### 5.3. Phạm vi 3: "Tất cả các công việc trong chuỗi" (All occurrences)
1. Cập nhật trực tiếp `TaskSeries` mẫu gốc.
2. Tìm và đồng bộ hàng loạt (Batch Update) các task trong chuỗi chưa đóng (`isClosed == false` và `isDetached == false`).

---

## 6. Giao Diện Người Dùng & Trải Nghiệm (UI / UX)

1. **Form cấu hình chuỗi (`SeriesForm.tsx`)**:
   - Chuyển đổi giữa 2 tab: *Theo lịch cố định* vs *Sau khi hoàn thành*.
   - Cho phép chọn: *Ngày cụ thể*, *Khoảng ngày*, hoặc *Vị trí trong tháng (By-Set-Pos)*.
   - Tùy chọn dời ngày nghỉ cuối tuần (*Giữ nguyên / Lùi Thứ Sáu / Tiến Thứ Hai*).
   - Trình tạo danh sách việc con mẫu (Subtask template list).
2. **Trang Quản lý chuỗi (`/tasks/recurring`)**:
   - Thẻ hiển thị quy tắc thông minh với đầy đủ thông tin tóm tắt.
   - Accordion xem danh sách các kỳ đã sinh.
   - Nút thao tác: Chỉnh sửa chuỗi, Tạm dừng, Kết thúc, và Sinh việc ngay.
3. **Chi tiết công việc (`TaskDetail.tsx`)**:
   - Huy hiệu `🔁 Công việc định kỳ`.
   - Nút **"📋 Xem kỳ trước đó"** (nếu có `previousTaskId`) để so sánh số liệu đối soát.
   - Hộp thoại chọn phạm vi Google Calendar khi Sửa / Xóa.

---

## 7. Kế Hoạch Kiểm Thử (Testing & Verification)

1. **Unit Tests (Vitest)**:
   - Test thuật toán `resolveBySetPos` (Thứ Hai đầu tiên, Thứ Sáu cuối cùng của các tháng bình thường và tháng nhuận).
   - Test chính sách `weekendPolicy` (Thứ Bảy/Chủ Nhật lùi về Thứ Sáu hoặc tiến sang Thứ Hai).
   - Test tính năng tính ngày cho `after_completion`.
   - Test phân tách chuỗi (Split series).
2. **Integration & Client Verification**:
   - Kiểm tra API Route `/api/cron/recurrence` với bearer token.
   - Kiểm tra hook `useRecurringScheduler` tự động sinh việc khi mở Dashboard.
   - Kiểm tra hộp thoại chọn phạm vi 3 mức khi sửa công việc định kỳ.
