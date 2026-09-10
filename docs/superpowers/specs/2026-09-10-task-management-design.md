# Task Management Engine — Specification v1.0

> **Ngày tạo:** 10/09/2026
> **Trạng thái:** Approved (có điều kiện — chờ spec review loop)
> **Dự án:** My Office — Hệ thống Quản lý Văn bản & Hồ sơ Công việc
> **Phạm vi:** Phân hệ Quản lý Công việc (Task Management Subsystem)

---

## MỤC LỤC

1. [Tổng quan & Triết lý kiến trúc](#1-tổng-quan--triết-lý-kiến-trúc)
2. [Domain Model](#2-domain-model)
3. [Firestore Schema (Query-First)](#3-firestore-schema-query-first)
4. [Task State Machine](#4-task-state-machine)
5. [Recurrence Specification](#5-recurrence-specification)
6. [RBAC & Permissions](#6-rbac--permissions)
7. [Notification & Reminder](#7-notification--reminder)
8. [Checklist Migration Strategy](#8-checklist-migration-strategy)
9. [Dashboard & Analytics](#9-dashboard--analytics)
10. [UI/UX Layout](#10-uiux-layout)
11. [Implementation Phases](#11-implementation-phases)
12. [Architectural Decisions Record (ADR)](#12-architectural-decisions-record-adr)

---

## 1. Tổng quan & Triết lý kiến trúc

### 1.1. Kiến trúc: Integrated Modular Monolith

```
                         MY OFFICE
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
      DOCUMENTS          DOSSIERS           TASKS
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                     SHARED DOMAIN CORE
                            │
        ┌──────────┬────────┼────────┬──────────┐
        │          │        │        │          │
      Staff    Department   Auth    Tags     Audit
                                      │
                                Firestore
                                      │
                         ┌────────────┴───────────┐
                         │                        │
                   Next.js App              Cloud Functions
```

- **Next.js App** (Vercel): UI + client logic
- **Firestore**: Single database cho tất cả modules
- **Cloud Functions**: Server-side mutations, recurrence, notifications, maintenance

### 1.2. Ba trụ cột thiết kế (Triad Architecture)

```
  CÔNG VIỆC (Task) ↔ VĂN BẢN (Document) ↔ HỒ SƠ (Dossier)
```

- Task là entity **độc lập** — có thể tồn tại không thuộc Dossier hay Document nào.
- Task ↔ Document: quan hệ N-N (`task.documentIds[]`)
- Task ↔ Dossier: quan hệ N-N (`task.dossierIds[]`)
- **Task KHÔNG phụ thuộc Dossier**. Dossier _sử dụng_ Task (query `tasks WHERE dossierIds contains X`).

### 1.3. Nguyên tắc kiến trúc xuyên suốt

1. **Query-first**: Thiết kế schema phục vụ query patterns, không chỉ domain purity.
2. **Transaction-safe**: Mọi mutation quan trọng đi qua server-side (Cloud Functions callable) để đảm bảo atomic.
3. **Idempotent**: Mọi Cloud Function phải idempotent — chạy nhiều lần cho kết quả như nhau.
4. **Permission-first**: RBAC kiểm tra trước khi thực hiện, không sau.

### 1.4. Server-Side Mutation Architecture

> ⚠️ **Quyết định kiến trúc quan trọng**: Client KHÔNG trực tiếp ghi Task mutations phức tạp.

```
  Client (Next.js)
       │
       │  Gọi Cloud Function callable
       │  VD: callTaskMutation({ action: 'assign', taskId, assigneeId })
       │
       ▼
  Cloud Function (server-side)
       │
       │  Transaction / WriteBatch:
       │  1. Validate permissions (RBAC)
       │  2. Validate business rules (state machine, cycle check)
       │  3. Mutate /tasks
       │  4. Ghi /taskActivities
       │  5. Ghi /notificationEvents (Outbox)
       │  6. Update /taskStats (counters)
       │
       ▼
  Firestore (atomic write)
```

**Lý do:**
- Notification Outbox (`/notificationEvents`) có Security Rules `allow write: if false` — chỉ server ghi được.
- Chống client tự ý sửa `createdBy`, `assigneeDepartmentId`, `taskStats`, `isClosed`.
- Đảm bảo status transition hợp lệ (state machine validation).
- Atomic: Task + Activity + Outbox + Stats trong cùng 1 batch.

**Ngoại lệ cho phép client ghi trực tiếp:**
- Đọc (read) task/comments — qua Security Rules.
- Tạo comment đơn giản (không cần Outbox phức tạp) — qua Security Rules + CF trigger.

### 1.5. Module Structure

```
src/modules/tasks/
├── types/                     # TypeScript interfaces & enums
├── hooks/                     # React hooks (UI state, queries)
├── lib/                       # Pure business logic
│   ├── recurrence/            # Pure: sinh occurrence dates
│   ├── validation/            # Pure: cycle check, rule validation
│   ├── progress/              # Pure: tính progress
│   ├── dependencies/          # Pure: blocked state resolution
│   └── permissions/           # Pure: RBAC check functions
├── components/                # React components
└── constants/                 # Enums, defaults, config
```

**Đặc biệt `lib/recurrence/`**: Pure functions, không phụ thuộc React/Firestore → unit-testable 100%.

---

## 2. Domain Model

### 2.1. Entity: Task (Instance / Occurrence)

```
TASK
│
├── Identity
│   ├── id: string                     # Firestore auto-ID (hoặc deterministic cho occurrence)
│   ├── taskCode: string?              # Mã hiển thị (TASK-2026-000123)
│   ├── title: string
│   └── description: string?
│
├── Classification
│   ├── type: "single" | "occurrence"
│   ├── status: TaskStatus             # PENDING | IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED
│   ├── priority: "low" | "normal" | "high" | "urgent"
│   ├── progress: number               # 0-100
│   ├── progressMode: "manual" | "subtask"
│   └── isClosed: boolean              # true khi COMPLETED hoặc CANCELLED
│       # ⚠️ KHÔNG dùng "isCompleted" vì CANCELLED cũng đóng
│       # Dùng cho query: OVERDUE = dueDate < now && isClosed == false
│
├── Time
│   ├── startDate: Timestamp?
│   ├── dueDate: Timestamp?            # Hạn hoàn thành (đã tính offset từ Series)
│   ├── completedAt: Timestamp?
│   ├── estimatedMinutes: number?
│   │
│   │  (Chỉ khi type = "occurrence")
│   ├── occurrenceDate: Timestamp?     # Ngày occurrence theo lịch Series
│   └── visibleFrom: Timestamp?        # Hiển thị cho user từ khi nào
│
├── People
│   ├── createdBy: string              # Người tạo task
│   ├── assigneeId: string?            # Người thực hiện chính
│   ├── assigneeName: string?          # Denormalized (render nhanh)
│   ├── collaboratorIds: string[]      # Người phối hợp
│   └── followerIds: string[]          # Chỉ nhận thông báo
│
├── Organization
│   ├── departmentId: string?          # Đơn vị CHỦ TRÌ công việc
│   ├── cooperatingDepartmentIds: string[]  # Đơn vị PHỐI HỢP
│   └── assigneeDepartmentId: string?  # SNAPSHOT phòng ban của assignee
│       # Bất biến sau khi giao — phản ánh phòng ban lúc giao việc
│       # VD: Khôi thuộc CNTT, chuyển sang KHTH → task cũ vẫn ghi CNTT
│
├── Blocked State
│   ├── blockedReason: "dependency" | "manual" | null
│   ├── blockedByTaskIds: string[]     # Task IDs đang block (khi reason=dependency)
│   ├── blockedNote: string?           # Lý do block thủ công
│   └── previousStatus: string?        # Status trước khi bị BLOCKED (để restore)
│       # ⚠️ Chỉ auto-unblock khi blockedReason = "dependency"
│       #    Manual block phải do user chủ động mở lại
│
├── Relations
│   ├── dossierIds: string[]           # N-N Hồ sơ (có thể rỗng)
│   ├── documentIds: string[]          # N-N Văn bản (có thể rỗng)
│   ├── parentTaskId: string?          # Nếu là subtask
│   ├── dependsOnTaskIds: string[]     # Phụ thuộc — KHÔNG ĐƯỢC TẠO CYCLE
│   └── relatedTaskIds: string[]       # Liên quan (không phải dependency)
│
├── Recurrence (chỉ khi type = "occurrence")
│   ├── seriesId: string?
│   └── occurrenceKey: string?         # "seriesId:YYYY-MM-DD" — dùng làm document ID
│
├── Template
│   └── templateId: string?            # Task tạo từ Template nào (trực tiếp hoặc qua Series)
│
├── Metadata
│   ├── tagIds: string[]
│   ├── attachments: Attachment[]
│   └── source: TaskSource
│       # "manual"             — tạo thủ công
│       # "recurring"          — sinh từ TaskSeries
│       # "template"           — tạo từ TaskTemplate (đơn lẻ)
│       # "dossier_checklist"  — migrate từ checklist cũ
│       # "document"           — tạo từ ngữ cảnh văn bản
│       # "system"             — hệ thống tự tạo
│
└── Audit
    ├── createdAt: Timestamp
    ├── updatedAt: Timestamp
    ├── deletedAt: Timestamp?          # Xóa mềm
    └── migratedFromChecklistId: string?  # Trace migration

INVARIANT:
  - dossierIds = [] → hợp lệ (task cá nhân)
  - documentIds = [] → hợp lệ (task không liên quan văn bản)
  - parentTaskId != null → đây là subtask
  - seriesId != null → đây là occurrence
  - Dependency cycle: REJECTED (DFS check trong transaction)
```

### 2.2. Entity: TaskSeries (Definition / Rule)

```
TASK SERIES
│
├── Identity
│   ├── id: string
│   ├── title: string
│   └── description: string?
│
├── Recurrence Rule
│   ├── frequency: "daily" | "weekly" | "monthly" | "yearly"
│   │   # KHÔNG có "quarterly" — dùng monthly + interval:3
│   ├── interval: number              # Mỗi N đơn vị (VD: mỗi 2 tuần)
│   ├── byWeekday: number[]?          # ISO: 1=Mon, 2=Tue, ..., 5=Fri, 6=Sat, 7=Sun
│   ├── byMonthDay: number[]?         # 1-31 hoặc -1
│   │   # ⚠️ -1 là semantic đặc biệt: "NGÀY CUỐI THÁNG"
│   │   #    Engine resolve: tháng 2 = 28/29, tháng 4 = 30, tháng 1 = 31
│   ├── byMonth: number[]?            # 1-12
│   ├── bySetPos: number?             # 1=first, -1=last
│   │   # VD: byWeekday:[5], bySetPos:-1 = "Thứ 6 cuối cùng của tháng"
│   ├── anchorDate: Timestamp         # Mốc neo tính interval
│   │   # VD: anchorDate=2026-01-05, monthly, interval:3 → Jan 5, Apr 5, Jul 5, Oct 5
│   └── timezone: string              # "Asia/Ho_Chi_Minh"
│
├── Schedule
│   ├── occurrenceTime: string?       # "08:00" — giờ occurrence trong ngày
│   ├── dueOffsetMinutes: number      # Deadline = occurrenceDate + offset
│   │   # 0 = deadline cùng ngày occurrence
│   │   # 1440 = +1 ngày; 2880 = +2 ngày
│   └── leadDays: number              # Task hiển thị trước bao nhiêu ngày
│       # visibleFrom = occurrenceDate - leadDays
│       # ⚠️ KHÁC rollingWindowDays:
│       #    rollingWindowDays = scheduler sinh trước bao xa (infrastructure)
│       #    leadDays = task hiển thị cho user trước bao xa (business)
│
├── Lifecycle
│   ├── status: "active" | "paused" | "ended"
│   ├── startDate: Timestamp
│   ├── endDate: Timestamp?           # null = vô hạn
│   └── misfirePolicy: "CREATE_MISSED" | "SKIP_MISSED"
│       # Khi scheduler down N ngày rồi chạy lại:
│       # CREATE_MISSED → tạo occurrence cho ngày đã qua (mặc định, phù hợp hành chính)
│       # SKIP_MISSED → chỉ tạo từ hôm nay trở đi
│
├── Generation
│   ├── rollingWindowDays: number     # Scheduler sinh trước bao xa (default: 14)
│   └── lastGeneratedDate: Timestamp? # Optimization hint ONLY
│       # ⚠️ Deterministic document ID là source of truth cho idempotency
│       #    lastGeneratedDate chỉ giúp scheduler skip scan không cần thiết
│
├── Defaults (áp cho mỗi occurrence mới sinh)
│   ├── defaultAssigneeId: string?
│   ├── defaultCollaboratorIds: string[]
│   ├── defaultFollowerIds: string[]
│   ├── defaultPriority: TaskPriority
│   ├── defaultEstimatedMinutes: number?
│   ├── defaultDossierIds: string[]
│   ├── defaultDocumentIds: string[]
│   ├── defaultDepartmentId: string?
│   ├── defaultTagIds: string[]
│   └── defaultSubtasks: SubtaskTemplate[]
│
├── Template
│   └── templateId: string?           # Tạo Series từ Template nào
│
└── Audit
    ├── createdBy: string
    ├── createdAt: Timestamp
    └── updatedAt: Timestamp

VÍ DỤ CỤ THỂ:

  "Báo cáo tuần" — byWeekday:[5] (Thứ 6), dueOffsetMinutes:0, leadDays:3
  → Occurrence 18/09/2026 (Thứ 6):
    occurrenceDate = 18/09 17:00
    dueDate        = 18/09 17:00 (offset=0)
    visibleFrom    = 15/09       (leadDays=3)
    occurrenceKey  = "series_001:2026-09-18"
    Document ID    = "series_001__2026-09-18" (deterministic)

  "Ngày 5 mỗi quý" — monthly, interval:3, byMonthDay:[5], anchorDate:2026-01-05
  → Jan 5, Apr 5, Jul 5, Oct 5

  "Ngày cuối tháng" — monthly, interval:1, byMonthDay:[-1]
  → Jan 31, Feb 28, Mar 31, Apr 30...

  "Thứ 6 cuối tháng" — monthly, byWeekday:[5], bySetPos:-1
  → Last Friday of each month
```

### 2.3. Entity: TaskTemplate (Mẫu công việc)

```
TASK TEMPLATE
│
├── id: string
├── name: string                      # "Quy trình xử lý công văn"
├── description: string?
├── category: string?
│
├── steps: TemplateStep[]
│   ├── order: number
│   ├── title: string
│   ├── description: string?
│   ├── defaultAssigneeRole: string?  # "trưởng phòng", "chuyên viên"
│   ├── estimatedMinutes: number?
│   └── dependsOnStepOrder: number?
│
├── defaults
│   ├── priority: TaskPriority
│   ├── departmentId: string?
│   └── tagIds: string[]
│
└── Audit
    ├── createdBy: string
    ├── createdAt: Timestamp
    └── updatedAt: Timestamp

QUAN HỆ:
              TaskTemplate
             /            \
            /              \
     TaskSeries             Task (single)
          │                 templateId = "tpl_001"
          ▼
   Task occurrences
   templateId = "tpl_001"
```

### 2.4. Entity: Department (Phòng/Khoa)

```
DEPARTMENT
│
├── id: string
├── name: string                      # "Phòng Kế hoạch Tổng hợp"
├── code: string                      # "KHTH"
├── type: "chức_năng" | "lâm_sàng" | "cận_lâm_sàng" | "ban_giám_đốc"
├── parentId: string?                 # Cấu trúc phân cấp (Phòng > Tổ)
├── headStaffId: string?              # Trưởng khoa/phòng
├── deputyStaffIds: string[]          # Phó khoa/phòng
├── order: number
├── isActive: boolean
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### 2.5. Staff — Bổ sung cho multi-department

```
STAFF (bổ sung vào schema hiện tại)
│
├── ...existing fields (fullName, shortName, nickname, title, position...)...
├── primaryDepartmentId: string?      # Phòng/khoa chính
├── departmentIds: string[]           # Tất cả phòng/khoa (bao gồm kiêm nhiệm)
└── managerId: string?                # Cấp trên trực tiếp
```

### 2.6. Entity: TaskComment

```
TASK COMMENT
│
├── id: string
├── taskId: string
├── authorId: string
├── authorName: string                # Denormalized
├── content: string
├── mentions: string[]                # ["staff_01", "staff_03"]
├── attachments: Attachment[]?
├── deletedAt: Timestamp?
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### 2.7. Entity: TaskActivity (Nhật ký nghiệp vụ)

> **Khác AuditLog**: Activity = sự kiện nghiệp vụ hiển thị cho user. AuditLog = kiểm toán kỹ thuật.

```
TASK ACTIVITY
│
├── id: string
├── taskId: string
├── actorId: string
├── actorName: string
├── eventType: ActivityEventType
│   # CREATED | ASSIGNED | REASSIGNED | STATUS_CHANGED |
│   # PRIORITY_CHANGED | DEADLINE_CHANGED | PROGRESS_UPDATED |
│   # COMMENT_ADDED | ATTACHMENT_ADDED | COMPLETED | REOPENED |
│   # BLOCKED | UNBLOCKED | SUBTASK_COMPLETED | DEPENDENCY_ADDED
├── metadata: object
│   # VD: { from: "pending", to: "in_progress" }
│   # VD: { assigneeId: "s02", assigneeName: "Đức" }
└── createdAt: Timestamp
```

### 2.8. Entity: NotificationEvent (Outbox Pattern)

```
NOTIFICATION EVENT (Infrastructure — chỉ server ghi)
│
├── id: string
├── eventType: string                 # TASK_ASSIGNED, MENTIONED, COMMENT_ADDED...
├── entityType: "task" | "document" | "dossier"
├── entityId: string
├── actorId: string
├── recipientIds: string[]
├── payload: object                   # Context data
├── processingStatus: "pending" | "processing" | "processed" | "failed"
├── processedAt: Timestamp?
├── retryCount: number                # Default 0, max 3
└── createdAt: Timestamp
```

### 2.9. Entity: Notification

```
NOTIFICATION
│
├── id: string
├── recipientId: string
├── type: "immediate" | "scheduled" | "digest"
├── category: string
├── entityType: "task" | "document" | "dossier"
├── entityId: string
├── title: string
├── body: string
├── actorId: string
├── actorName: string
├── isRead: boolean
├── readAt: Timestamp?
├── scheduledFor: Timestamp?
└── createdAt: Timestamp
```

### 2.10. Entity: Reminder

```
REMINDER
│
├── id: string
├── taskId: string
├── recipientId: string
├── triggerAt: Timestamp
├── type: "before_deadline" | "custom"
├── offsetMinutes: number?            # -1440 = 1 ngày trước deadline
├── message: string?
├── isFired: boolean
├── firedAt: Timestamp?
└── createdAt: Timestamp
```

### 2.11. Entity: TaskStats (Denormalized Counters)

```
TASK STATS
│
├── id: string                        # "user_{staffId}" | "dept_{deptId}" | "global"
├── scope: "user" | "department" | "global"
├── scopeId: string
├── pending: number
├── inProgress: number
├── blocked: number
├── completed: number
├── cancelled: number
├── overdue: number
├── completedThisWeek: number
├── completedThisMonth: number
└── updatedAt: Timestamp
```

---

## 3. Firestore Schema (Query-First)

### 3.1. Collection Structure

```
Firestore Root
│
├── /departments/{departmentId}
├── /staff/{staffId}                    # [SỬA] +departmentIds
│
├── /documents/{documentId}             # [GIỮ NGUYÊN]
├── /dossiers/{dossierId}               # [SỬA] bỏ checklist sau migration
│
├── /tasks/{taskId}                     # [MỚI] — auto-ID hoặc deterministic cho occurrence
├── /taskSeries/{seriesId}              # [MỚI]
├── /taskTemplates/{templateId}         # [MỚI]
│
├── /taskComments/{commentId}           # [MỚI] top-level
├── /taskActivities/{activityId}        # [MỚI] top-level
│
├── /notifications/{notificationId}     # [MỚI]
├── /notificationEvents/{eventId}       # [MỚI] Outbox — chỉ server ghi
├── /reminders/{reminderId}             # [MỚI]
│
├── /taskStats/{statsId}                # [MỚI] Denormalized counters
│
├── /tags/{tagId}                       # [GIỮ NGUYÊN]
├── /settings/{settingId}               # [SỬA] +task permissions
└── /auditLogs/{auditLogId}             # [GIỮ NGUYÊN]
```

**Top-level collections** (không dùng subcollections) vì cần query cross-entity: "tất cả comment tôi được mention", "tất cả notification chưa đọc", dashboard activity feed.

### 3.2. Document ID Strategy

| Collection | ID Strategy | Lý do |
|---|---|---|
| `/tasks` (single) | Auto-generated | Không cần deterministic |
| `/tasks` (occurrence) | `{seriesId}__{YYYY-MM-DD}` | **Idempotency tuyệt đối** |
| `/taskStats` | `user_{staffId}` / `dept_{deptId}` / `global` | Deterministic, 1 doc per scope |
| Tất cả collection khác | Auto-generated | Không cần deterministic |

**Occurrence idempotency:**
```typescript
// Cloud Function: tạo occurrence
const occurrenceDocId = `${seriesId}__${formatDate(date, 'YYYY-MM-DD')}`;
const ref = doc(db, 'tasks', occurrenceDocId);

await runTransaction(db, async (transaction) => {
  const snap = await transaction.get(ref);
  if (snap.exists()) return; // IDEMPOTENT: đã tồn tại → skip
  transaction.create(ref, taskData); // create() KHÔNG overwrite
});
```

> ⚠️ Dùng `transaction.create()` — KHÔNG dùng `set()` vì `set()` sẽ overwrite nếu đã tồn tại.

### 3.3. Composite Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "assigneeId", "order": "ASCENDING" },
        { "fieldPath": "isClosed", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ],
      "note": "MY TASKS: Việc của tôi, chưa đóng, sắp theo deadline"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "departmentId", "order": "ASCENDING" },
        { "fieldPath": "isClosed", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ],
      "note": "DEPARTMENT TASKS: Việc phòng tôi, chưa đóng"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "isClosed", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ],
      "note": "OVERDUE: isClosed=false AND dueDate < now"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "seriesId", "order": "ASCENDING" },
        { "fieldPath": "occurrenceDate", "order": "ASCENDING" }
      ],
      "note": "SERIES OCCURRENCES"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "parentTaskId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ],
      "note": "SUBTASKS + progress calc"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ],
      "note": "ALL TASKS: chưa xóa, mới nhất"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "assigneeId", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ],
      "note": "CALENDAR VIEW"
    },
    {
      "collectionGroup": "tasks",
      "fields": [
        { "fieldPath": "assigneeId", "order": "ASCENDING" },
        { "fieldPath": "completedAt", "order": "DESCENDING" }
      ],
      "note": "COMPLETED BY USER: thống kê"
    },
    {
      "collectionGroup": "taskSeries",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ],
      "note": "ACTIVE SERIES: Scheduler query"
    },
    {
      "collectionGroup": "taskComments",
      "fields": [
        { "fieldPath": "taskId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ],
      "note": "TASK THREAD"
    },
    {
      "collectionGroup": "taskActivities",
      "fields": [
        { "fieldPath": "taskId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ],
      "note": "ACTIVITY FEED"
    },
    {
      "collectionGroup": "notifications",
      "fields": [
        { "fieldPath": "recipientId", "order": "ASCENDING" },
        { "fieldPath": "isRead", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ],
      "note": "MY NOTIFICATIONS"
    },
    {
      "collectionGroup": "notificationEvents",
      "fields": [
        { "fieldPath": "processingStatus", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ],
      "note": "OUTBOX PROCESSING"
    },
    {
      "collectionGroup": "reminders",
      "fields": [
        { "fieldPath": "isFired", "order": "ASCENDING" },
        { "fieldPath": "triggerAt", "order": "ASCENDING" }
      ],
      "note": "PENDING REMINDERS"
    }
  ]
}
```

**array-contains indexes (tự động):**

| Field | Use case |
|---|---|
| `tasks.dossierIds` | Task trong Hồ sơ X |
| `tasks.documentIds` | Task liên quan Văn bản Y |
| `tasks.collaboratorIds` | Việc tôi phối hợp |
| `tasks.followerIds` | Việc tôi theo dõi |
| `tasks.tagIds` | Lọc theo tag |
| `taskComments.mentions` | @mention feed |

### 3.4. Query Patterns

| # | Use case | Query | Index |
|---|---|---|---|
| 1 | **Việc của tôi** | `assigneeId==myId, isClosed==false, orderBy dueDate` | assigneeId + isClosed + dueDate |
| 2 | **Việc tôi phối hợp** | `collaboratorIds array-contains myId, isClosed==false` | collaboratorIds (auto) |
| 3 | **Việc tôi theo dõi** | `followerIds array-contains myId` | followerIds (auto) |
| 4 | **Việc phòng tôi** | `departmentId==myDeptId, isClosed==false, orderBy dueDate` | departmentId + isClosed + dueDate |
| 5 | **Task quá hạn** | `isClosed==false, dueDate < now, orderBy dueDate` | isClosed + dueDate |
| 6 | **Task trong Hồ sơ** | `dossierIds array-contains dossierId` | dossierIds (auto) |
| 7 | **Task liên quan VB** | `documentIds array-contains docId` | documentIds (auto) |
| 8 | **Subtasks** | `parentTaskId==taskId, orderBy status` | parentTaskId + status |
| 9 | **Series occurrences** | `seriesId==sId, orderBy occurrenceDate` | seriesId + occurrenceDate |
| 10 | **Dashboard** | `getDoc('taskStats/user_' + myId)` | — (1 doc read) |
| 11 | **Kanban** | Query #1, group by `status` client-side | — |
| 12 | **Calendar** | `assigneeId==myId, dueDate >= start, dueDate <= end` | assigneeId + dueDate |
| 13 | **Idempotency** | `getDoc('tasks/' + occurrenceDocId)` | — (1 doc read) |
| 14 | **Notification** | `recipientId==myId, isRead==false, orderBy createdAt desc` | recipientId + isRead + createdAt |
| 15 | **Outbox pending** | `processingStatus=="pending", orderBy createdAt` | processingStatus + createdAt |
| 16 | **@mention feed** | `mentions array-contains myId, orderBy createdAt desc` | mentions (auto) |

> ⚠️ **Giới hạn Firestore**: `array-contains` chỉ dùng 1 lần per query. Lọc phức hợp (VD: dossierIds + tagIds) → query theo dossierIds, filter tagIds client-side.

### 3.5. Transaction & Concurrency

| Thao tác | Cơ chế | Chi tiết |
|---|---|---|
| Tạo Task + Activity + Outbox + Stats | Cloud Function + WriteBatch | Atomic, server-side |
| Hoàn thành Task + Update parent progress | Cloud Function + WriteBatch | Consistency |
| Xóa Task | Soft delete (`deletedAt`) + CF cleanup | Client: 1 write. CF: async batch cleanup comments/activities (chunked) |
| Giao Task + Snapshot department | Cloud Function + WriteBatch | Denormalize assigneeName, assigneeDepartmentId |
| Migration Checklist → Task | Cloud Function + WriteBatch | Atomic: tạo Task + audit per item |
| Dependency change + Status update | Cloud Function + Transaction | Cycle check DFS + auto BLOCKED/UNBLOCKED |
| Tạo Occurrence (recurring) | Cloud Function + Transaction | `transaction.create()` với deterministic ID |

### 3.6. Security Rules

> ⚠️ **SKELETON ONLY** — Hoàn thiện tại Phase triển khai sau khi RBAC hoàn chỉnh. KHÔNG triển khai production nguyên trạng.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /tasks/{taskId} {
      allow read: if isAuthenticated() && canViewTask();
      allow create: if false;   // Server-side only
      allow update: if false;   // Server-side only
      allow delete: if false;   // Soft delete qua server
    }

    match /taskComments/{commentId} {
      allow read: if isAuthenticated() && canViewTaskComment();
      allow create: if isAuthenticated() && isTaskParticipant();
      allow update, delete: if isAuthenticated() && isCommentAuthor();
    }

    match /taskActivities/{activityId} {
      allow read: if isAuthenticated();
      allow write: if false;    // Server-side only
    }

    match /notifications/{notifId} {
      allow read: if isAuthenticated() && isRecipient();
      allow update: if isAuthenticated() && isRecipient(); // Mark read
      allow create, delete: if false; // Server-side only
    }

    match /notificationEvents/{eventId} {
      allow read, write: if false; // Server-side (admin SDK) ONLY
    }

    match /taskStats/{statsId} {
      allow read: if isAuthenticated();
      allow write: if false;    // Server-side only
    }

    match /reminders/{reminderId} {
      allow read: if isAuthenticated() && isRecipient();
      allow write: if false;    // Server-side only
    }
  }
}
```

---

## 4. Task State Machine

### 4.1. Status (Persistent — lưu DB)

```
  5 status thực:  PENDING | IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED

                    ┌──────────┐
                    │  PENDING │  ← Mới tạo
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
       ┌─────────────┐      ┌───────────┐
       │ IN_PROGRESS  │◄────►│  BLOCKED  │
       └──────┬──────┘      └───────────┘
              │
              ▼
       ┌─────────────┐
       │  COMPLETED   │
       └──────┬──────┘
              │ (reopen)        Từ mọi status:
              ▼                     │
       ┌─────────────┐             ▼
       │  CANCELLED   │◄──────  CANCELLED
       └─────────────┘
              │ (reopen)
              ▼
           PENDING
```

### 4.2. Derived States (Tính toán — KHÔNG lưu DB)

```
  OVERDUE   = dueDate < now()      && isClosed == false
  AT_RISK   = dueDate trong 2 ngày && isClosed == false && progress < 80%
  UPCOMING  = visibleFrom > now()  (occurrence chưa đến lúc hiển thị)
```

### 4.3. Transition Rules

```typescript
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING:      ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS:  ['COMPLETED', 'BLOCKED', 'CANCELLED'],
  BLOCKED:      ['PENDING', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED:    ['PENDING'],   // reopen
  CANCELLED:    ['PENDING'],   // reopen
};
```

### 4.4. BLOCKED — Auto vs Manual

| Loại | blockedReason | Auto-unblock? | Cách mở |
|---|---|---|---|
| Dependency block | `"dependency"` | ✅ Có — khi tất cả dependency COMPLETED | Tự động chuyển về `previousStatus` |
| Manual block | `"manual"` | ❌ Không | User chủ động mở lại |

**Quy tắc Dependency Block:**
- Có **ít nhất một** task trong `dependsOnTaskIds` chưa COMPLETED → BLOCKED (nếu dependency blocking bật)
- Khi dependency hoàn thành → check: còn dependency nào chưa COMPLETED?
  - KHÔNG còn → restore `previousStatus`
  - CÒN → giữ BLOCKED

### 4.5. Side Effects khi chuyển status

| Transition | Side Effect (trong WriteBatch server-side) |
|---|---|
| `* → COMPLETED` | `completedAt = now()`, `progress = 100`, `isClosed = true` |
| `* → COMPLETED` (có subtasks) | Reject nếu còn subtask chưa COMPLETED |
| `COMPLETED → PENDING` (reopen) | `completedAt = null`, `isClosed = false` |
| `* → CANCELLED` | `isClosed = true` |
| `CANCELLED → PENDING` (reopen) | `isClosed = false` |
| `* → BLOCKED` | Lưu `previousStatus`, set `blockedReason` |
| `BLOCKED → *` | Clear `blockedReason`, `blockedByTaskIds`, `blockedNote` |
| **Mọi thay đổi status** | Ghi `TaskActivity` + tạo `NotificationEvent` + update `TaskStats` |

---

## 5. Recurrence Specification

### 5.1. Engine Flow

```
  Cloud Function: generateRecurringTasks
  Trigger: onSchedule("every 1 hours")

  1. Query: taskSeries WHERE status == "active"

  2. For each series:
     a. Resolve timezone (series.timezone → "Asia/Ho_Chi_Minh")
     b. Calculate windowEnd = now + series.rollingWindowDays
     c. Determine windowStart:
        - Nếu có lastGeneratedDate → lastGeneratedDate
        - Nếu không → series.startDate
        - Apply misfirePolicy:
          - CREATE_MISSED → windowStart = max(startDate, lastGenerated)
          - SKIP_MISSED   → windowStart = max(now, lastGenerated)

     d. Call pure function generateOccurrences(rule, windowStart, windowEnd)

     e. For each occurrenceDate:
        - Tính deterministic ID: "{seriesId}__{YYYY-MM-DD}"
        - Transaction:
            - transaction.get(ref)
            - if exists → SKIP (idempotent)
            - if not → transaction.create(ref, {
                ...series.defaults,
                type: "occurrence",
                status: "PENDING",
                isClosed: false,
                seriesId: series.id,
                occurrenceDate: date,
                occurrenceKey: "seriesId:YYYY-MM-DD",
                dueDate: date + dueOffsetMinutes,
                visibleFrom: date - leadDays,
                source: "recurring",
                templateId: series.templateId,
              })
            - Ghi NotificationEvent (RECURRING_GENERATED)

     f. Update series.lastGeneratedDate (optimization)
```

### 5.2. Pure Recurrence Library

```typescript
// src/modules/tasks/lib/recurrence/generateOccurrences.ts
// PURE FUNCTION — zero dependencies

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  byWeekday?: number[];       // ISO 1-7
  byMonthDay?: number[];      // 1-31, -1 = last day
  byMonth?: number[];         // 1-12
  bySetPos?: number;          // 1 = first, -1 = last
  anchorDate: Date;
  timezone: string;
}

function generateOccurrences(
  rule: RecurrenceRule,
  windowStart: Date,
  windowEnd: Date
): Date[];

// -1 semantic: "ngày cuối tháng"
function resolveLastDay(year: number, month: number): number;

// bySetPos semantic: "Thứ X đầu/cuối tháng"
function resolveSetPos(year: number, month: number, weekday: number, setPos: number): Date | null;
```

### 5.3. Occurrence Lifecycle

- Occurrence đã tạo → **tách biệt** khỏi Series
- User có thể sửa 1 occurrence (title, deadline, assignee) mà KHÔNG ảnh hưởng Series
- User có thể cancel 1 occurrence mà KHÔNG dừng Series
- Khi Series bị sửa defaults → chỉ áp cho occurrence **CHƯA TẠO**, occurrence đã tạo giữ nguyên
- Series PAUSED → không sinh occurrence mới, occurrence đã tồn tại giữ nguyên
- Series ENDED → không sinh thêm, occurrence cũ là lịch sử

---

## 6. RBAC & Permissions

### 6.1. Permission Layers

```
  Layer 1: System Role       — admin / staff / guest
  Layer 2: Department Role   — head / deputy / member
  Layer 3: Task Context      — creator / assignee / collaborator / follower
```

### 6.2. Permission Matrix

| Action | Admin | Dept Head | Creator | Assignee | Collaborator | Follower | Guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Xem task | ✅ | ✅ (cùng dept) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tạo task | ✅ | ✅ | — | — | — | — | ❌ |
| Sửa title/desc | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Đổi assignee | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Đổi deadline | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Đổi status | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Hoàn thành | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Thêm comment | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Thêm subtask | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Xóa task | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Quản lý Series | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Xem task phòng khác | ✅ | ❌* | ❌* | ❌* | ❌* | ❌* | ❌ |

*Trừ khi là participant (assignee/collaborator/follower)*

### 6.3. Visibility Rules

```typescript
function canViewTask(user: Staff, task: Task): boolean {
  return (
    user.role === 'admin' ||
    task.createdBy === user.id ||
    task.assigneeId === user.id ||
    task.collaboratorIds.includes(user.id) ||
    task.followerIds.includes(user.id) ||
    (task.departmentId != null && user.departmentIds.includes(task.departmentId)) ||
    task.cooperatingDepartmentIds.some(d => user.departmentIds.includes(d))
  );
}
```

### 6.4. Settings Integration

Bổ sung vào `settings/permissions`:

```typescript
{
  admin: {
    ...existingPermissions,
    canCreateTask: true,
    canEditAnyTask: true,
    canDeleteAnyTask: true,
    canManageSeries: true,
    canManageTemplates: true,
    canViewAllDepartmentTasks: true,
    canManageDepartments: true,
    canViewTaskStats: true,
  },
  staff: {
    ...existingPermissions,
    canCreateTask: true,
    canEditAnyTask: false,
    canDeleteAnyTask: false,
    canManageSeries: true,
    canManageTemplates: false,
    canViewAllDepartmentTasks: false,
    canManageDepartments: false,
    canViewTaskStats: true,
  },
  guest: { /* tất cả false */ }
}
```

---

## 7. Notification & Reminder

### 7.1. Event Types & Recipients

| Event | Trigger | Recipients | Type |
|---|---|---|---|
| `TASK_ASSIGNED` | Giao task | assignee | Immediate |
| `TASK_REASSIGNED` | Đổi assignee | assignee mới + cũ | Immediate |
| `DEADLINE_CHANGED` | Sửa dueDate | assignee + collaborators | Immediate |
| `COMMENT_ADDED` | Post comment | assignee + collaborators + followers (trừ author) | Immediate |
| `MENTIONED` | @mention | Mentioned users | Immediate |
| `TASK_COMPLETED` | Hoàn thành | creator + followers | Immediate |
| `TASK_BLOCKED` | Status → BLOCKED | assignee + creator | Immediate |
| `DEADLINE_APPROACHING` | dueDate - 1 ngày | assignee | Scheduled |
| `TASK_OVERDUE` | dueDate < now | assignee + creator | Scheduled |
| `RECURRING_GENERATED` | Series sinh occurrence | default assignee | Immediate (optional) |
| `DAILY_DIGEST` | 08:00 mỗi sáng | Mỗi user có task | Digest |

### 7.2. Architecture

```
  Cloud Function callable (server-side mutation)
       │
       │  WriteBatch:
       │  1. Mutate /tasks
       │  2. Ghi /taskActivities
       │  3. Ghi /notificationEvents (Outbox)
       │  4. Update /taskStats
       │
       ▼
  onDocumentCreated("/notificationEvents/{id}")  ← PRIMARY
       │
       ├─ Immediate → ghi /notifications
       ├─ Scheduled → ghi /reminders
       └─ Digest → tag để gom
       │
       ▼
  Đánh dấu: processingStatus = "processed"

  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  onSchedule("every 15 minutes")  ← RECOVERY ONLY
       │
       ▼
  Query: pending AND createdAt < (now - 5min)
  → Retry (retryCount < 3)
  → Failed (retryCount >= 3 → alert admin)
```

### 7.3. Reminder Processing

```
  Cloud Function: processReminders
  Trigger: onSchedule("every 5 minutes")

  1. Query /reminders WHERE isFired==false AND triggerAt <= now()
  2. Tạo /notifications cho recipientId
  3. isFired = true, firedAt = now()
  4. Daily Digest 08:00: query tasks per user → 1 digest notification
```

---

## 8. Checklist Migration Strategy

### 8.1. Migration Flow (3 Steps)

```
  Step 1: Migration Script (Cloud Function)
  ─────────────────────────────────────────
  For each dossier with checklist[]:
    For each checklistItem:
      WriteBatch:
        1. CREATE /tasks/{newTaskId}
           ├── title = item.title
           ├── status = item.completed ? "completed" : "pending"
           ├── isClosed = item.completed
           ├── completedAt = item.completedAt
           ├── assigneeId = item.completedBy
           ├── dossierIds = [dossierId]
           ├── source = "dossier_checklist"
           ├── migratedFromChecklistId = item.id
           └── createdBy = dossier.ownerId
        2. Ghi /auditLogs (action: "MIGRATE")

  ⚠️ CHƯA xóa dossier.checklist

  Step 2: Dual-read Verification (1-2 tuần)
  ─────────────────────────────────────────
  - UI hiển thị Tasks thay vì checklist
  - Checklist[] giữ trong DB để rollback
  - So sánh: task count == checklist count? Progress khớp?

  Step 3: Cleanup
  ─────────────────────────────────────────
  - UI bỏ hoàn toàn logic đọc checklist
  - CF xóa dossier.checklist fields
  - Cập nhật DOCS_DATABASE_SCHEMA.md
```

### 8.2. Dossier sau migration

```
  HỒ SƠ
  │
  ├── Văn bản (22)    ← documents WHERE dossierIds contains dossierId
  ├── Công việc (17)  ← tasks WHERE dossierIds contains dossierId
  │   ├── 10 Completed
  │   ├── 4 In Progress
  │   ├── 2 Pending
  │   └── 1 Overdue (derived)
  │   Progress: ██████████████░░░ 82%
  │
  ├── Mô tả           ← dossier.description (giữ nguyên)
  ├── Ghi chú          ← dossier.notes (giữ nguyên)
  └── Trao đổi         ← dossier.comments (giữ nguyên Phase 1)

  Roadmap dài hạn: thống nhất /comments collection cho cả Task + Dossier + Document
```

### 8.3. Nguyên tắc

- **Một nguồn dữ liệu duy nhất** sau migration: Task Engine. Không giữ cả checklist + tasks.
- Migration phải có **traceability**: `migratedFromChecklistId` + audit log.
- **Rollback window**: 1-2 tuần dual-read trước khi cleanup.

---

## 9. Dashboard & Analytics

### 9.1. Denormalized Counters

```
  /taskStats/user_{staffId}     → Dashboard cá nhân (1 doc read)
  /taskStats/dept_{deptId}      → Dashboard phòng/khoa (1 doc read)
  /taskStats/global             → Dashboard toàn hệ thống (1 doc read)
```

Cloud Function `maintainTaskDerivedState`:
- onWrite `/tasks` → `FieldValue.increment()` cho delta giữa previousStatus và newStatus
- Idempotent: check previousStatus vs newStatus, chỉ adjust delta
- Transaction-based, không dựa vào debounce

### 9.2. Dashboard Views

| View | Data source | Complexity |
|---|---|---|
| Tổng quan (cards) | `/taskStats/user_{myId}` | 1 doc read |
| Biểu đồ phòng | `/taskStats/dept_{myDeptId}` | 1 doc read |
| My Tasks list | Query `/tasks` by assigneeId | Index query |
| Kanban | Query #1, group by status client-side | Index query |
| Calendar | Query by assigneeId + dueDate range | Index query |

---

## 10. UI/UX Layout

```
  Sidebar (kế thừa My Office design system):
  ┌──────────────────┐
  │ 📄 Văn bản        │
  │ 📁 Hồ sơ          │
  │ ✅ Công việc       │  ← MỚI
  │    ├ Việc của tôi  │
  │    ├ Tất cả        │
  │    ├ Kanban        │
  │    ├ Lịch          │
  │    └ Định kỳ       │
  │ 📊 Dashboard       │  ← MỚI
  │ 🔍 Tìm kiếm       │
  │ ⚙️ Cài đặt         │
  └──────────────────┘
```

- Task Detail Panel: Split view tương tự Document modal (trái: info, phải: comments + preview)
- UI chi tiết thiết kế trong implementation phase, kế thừa design system hiện tại (Slate + Blue + semantic colors)

---

## 11. Implementation Phases

| Phase | Scope | Chi tiết |
|---|---|---|
| **Phase 0** ✅ | Architecture & Schema | **ĐANG LÀM** — spec v1.0 này |
| **Phase 1** | **Task Core** | CRUD, assignment, status, priority, deadline, progress, subtask, Document/Dossier relation, comment, attachment, audit, Department, Staff migration |
| **Phase 2** | **Task Workspace** | My Tasks, All Tasks, Kanban, List, Calendar, Task Detail, Dashboard, Filter, Search, **Bulk Operations** |
| **Phase 3** | **Recurrence + Notification** | TaskSeries, recurrence engine, rolling window, idempotency, timezone, exception, pause/resume, reminder, notification center |
| **Phase 4** | **Migration & Integration** | Checklist → Task, dual-read verification, cleanup, Document ↔ Task ↔ Dossier integration |
| **Phase 5** | **Professional** | Dependency (blocked/unblocked), TaskTemplate, workflow (future), workload/timeline, followers, advanced reporting, KPI, escalation |

### Bulk Operations (Phase 2 — Core Productivity)

Chọn nhiều Task → hành động hàng loạt:
- Giao cho người khác
- Đổi deadline / priority / status
- Thêm tag / collaborator
- Chuyển phòng
- Hoàn thành / Hủy hàng loạt
- Thêm vào Hồ sơ

---

## 12. Architectural Decisions Record (ADR)

| # | Quyết định | Lý do |
|---|---|---|
| ADR-01 | Integrated Modular Monolith (không microservice) | Phù hợp quy mô bệnh viện, tái sử dụng 100% hạ tầng, chi phí thấp |
| ADR-02 | Server-side mutations qua Cloud Functions callable | Atomic Task + Activity + Outbox + Stats. Chống client bypass |
| ADR-03 | `isClosed` thay `isCompleted` | Cả COMPLETED và CANCELLED đều "đóng". Tên phản ánh đúng domain |
| ADR-04 | Deterministic document ID cho occurrence | `{seriesId}__{YYYY-MM-DD}` + `transaction.create()` = idempotency tuyệt đối |
| ADR-05 | Top-level collections (không subcollections) | Cần query cross-entity: mention feed, notification, dashboard |
| ADR-06 | Notification Outbox + event-trigger (primary) + scheduler recovery | Tách mutation khỏi notification. Tránh spam. Retry an toàn |
| ADR-07 | BLOCKED phân biệt auto/manual | Auto-unblock chỉ cho dependency. Manual block do user kiểm soát |
| ADR-08 | Denormalized taskStats counters | Dashboard = 1 doc read. CF cập nhật bằng FieldValue.increment() |
| ADR-09 | Task độc lập, Dossier sử dụng Task | Task có thể tồn tại không thuộc Dossier. Không bị bó kiến trúc |
| ADR-10 | 2-tier multi-department từ Day 1 | `departments` collection + staff.departmentIds[] sẵn sàng scale |
| ADR-11 | Rolling window recurrence + misfirePolicy | Sinh occurrence N ngày trước. Xử lý missed occurrence rõ ràng |
| ADR-12 | Checklist → Task migration 3 bước | Tạo Task → dual-read verify → cleanup. Có traceability + rollback |
| ADR-13 | Pure recurrence library (`lib/recurrence/`) | Không phụ thuộc React/Firestore → unit-testable, portable |
| ADR-14 | Soft delete + CF async cleanup | Không batch xóa comments/activities (giới hạn batch size). CF chunked cleanup |

---

*Task Management Engine Specification v1.0 — My Office*
*Ngày 10/09/2026*
