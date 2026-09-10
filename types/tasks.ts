import { Timestamp } from 'firebase/firestore'
import type { Attachment } from './index'

// ===== Task Status & Priority =====

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskType = 'single' | 'occurrence'
export type ProgressMode = 'manual' | 'subtask'
export type BlockedReason = 'dependency' | 'manual'
export type TaskSource =
  | 'manual'
  | 'recurring'
  | 'template'
  | 'dossier_checklist'
  | 'document'
  | 'system'

// ===== Activity Events =====

export type ActivityEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'REASSIGNED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'DEADLINE_CHANGED'
  | 'PROGRESS_UPDATED'
  | 'COMMENT_ADDED'
  | 'ATTACHMENT_ADDED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'BLOCKED'
  | 'UNBLOCKED'
  | 'SUBTASK_COMPLETED'
  | 'DEPENDENCY_ADDED'

// ===== Core Entities =====

/**
 * Task — Instance/Occurrence of work.
 * Can exist independently or linked to Dossiers/Documents.
 * Task does NOT depend on Dossier — Dossier uses Task.
 */
export interface Task {
  id: string
  taskCode: string | null
  title: string
  description: string | null

  // Classification
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  progress: number           // 0-100
  progressMode: ProgressMode
  isClosed: boolean          // true when COMPLETED or CANCELLED (for query: OVERDUE = dueDate < now && isClosed == false)

  // Time
  startDate: Timestamp | null
  dueDate: Timestamp | null
  completedAt: Timestamp | null
  estimatedMinutes: number | null
  occurrenceDate: Timestamp | null   // Only when type = "occurrence"
  visibleFrom: Timestamp | null      // Only when type = "occurrence"

  // People
  createdBy: string
  assigneeId: string | null
  assigneeName: string | null        // Denormalized for fast render
  collaboratorIds: string[]
  followerIds: string[]

  // Organization
  departmentId: string | null              // Đơn vị CHỦ TRÌ
  cooperatingDepartmentIds: string[]       // Đơn vị PHỐI HỢP
  assigneeDepartmentId: string | null      // SNAPSHOT phòng ban of assignee at assignment time

  // Blocked State
  blockedReason: BlockedReason | null
  blockedByTaskIds: string[]               // Task IDs causing block (when reason=dependency)
  blockedNote: string | null               // Manual block note
  previousStatus: TaskStatus | null        // Status before BLOCKED (for restore)

  // Relations
  dossierIds: string[]                     // N-N with Dossiers (can be empty → standalone task)
  documentIds: string[]                    // N-N with Documents (can be empty)
  parentTaskId: string | null              // If this is a subtask
  dependsOnTaskIds: string[]               // Dependencies — NO CYCLES ALLOWED
  relatedTaskIds: string[]                 // Related but not dependency

  // Recurrence (only when type = "occurrence")
  seriesId: string | null
  occurrenceKey: string | null             // Unique: "seriesId:YYYY-MM-DD" — used as document ID

  // Template
  templateId: string | null                // Created from which template (direct or via Series)

  // Metadata
  tagIds: string[]
  attachments: Attachment[]
  source: TaskSource

  // Audit
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
  migratedFromChecklistId: string | null   // Migration traceability
}

/**
 * TaskSeries — Definition/Rule for recurring tasks.
 * Not a task itself — it's the blueprint that generates Task occurrences.
 */
export interface TaskSeries {
  id: string
  title: string
  description: string | null

  // Recurrence Rule
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number                     // Every N units
  byWeekday: number[] | null           // ISO: 1=Mon...7=Sun
  byMonthDay: number[] | null          // 1-31, -1 = LAST DAY (semantic: last day of month)
  byMonth: number[] | null             // 1-12
  bySetPos: number | null              // 1=first, -1=last (e.g. byWeekday:[5], bySetPos:-1 = last Friday)
  anchorDate: Timestamp                // Anchor for interval calculation
  timezone: string                     // "Asia/Ho_Chi_Minh"

  // Schedule (relationship between occurrence date and deadline)
  occurrenceTime: string | null        // "08:00" — time of day for occurrence
  dueOffsetMinutes: number             // Deadline = occurrenceDate + offset (0 = same day)
  leadDays: number                     // Task visible leadDays before occurrence (UI visibility, NOT generation)

  // Lifecycle
  status: 'active' | 'paused' | 'ended'
  startDate: Timestamp
  endDate: Timestamp | null            // null = infinite
  misfirePolicy: 'CREATE_MISSED' | 'SKIP_MISSED'

  // Generation
  rollingWindowDays: number            // Scheduler generates this far ahead (default: 14)
  lastGeneratedDate: Timestamp | null  // Optimization hint only — deterministic ID is idempotency source

  // Defaults (applied to each new occurrence)
  defaultAssigneeId: string | null
  defaultCollaboratorIds: string[]
  defaultFollowerIds: string[]
  defaultPriority: TaskPriority
  defaultEstimatedMinutes: number | null
  defaultDossierIds: string[]
  defaultDocumentIds: string[]
  defaultDepartmentId: string | null
  defaultTagIds: string[]
  defaultSubtasks: SubtaskTemplate[]

  // Template
  templateId: string | null

  // Audit
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SubtaskTemplate {
  order: number
  title: string
  description: string | null
  defaultAssigneeRole: string | null
  estimatedMinutes: number | null
}

/**
 * TaskTemplate — Reusable work process template.
 * Can create single Task or TaskSeries.
 */
export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  category: string | null

  steps: TemplateStep[]

  defaults: {
    priority: TaskPriority
    departmentId: string | null
    tagIds: string[]
  }

  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface TemplateStep {
  order: number
  title: string
  description: string | null
  defaultAssigneeRole: string | null
  estimatedMinutes: number | null
  dependsOnStepOrder: number | null
}

// ===== Task Comment =====

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  authorName: string                   // Denormalized
  content: string
  mentions: string[]                   // Staff IDs for @mention
  attachments: Attachment[]
  deletedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ===== Task Activity (Business Events — different from AuditLog) =====

export interface TaskActivity {
  id: string
  taskId: string
  actorId: string
  actorName: string                    // Denormalized
  eventType: ActivityEventType
  metadata: Record<string, any>        // e.g. { from: "pending", to: "in_progress" }
  createdAt: Timestamp
}

// ===== Notification Outbox (Infrastructure — server-write only) =====

export interface NotificationEvent {
  id: string
  eventType: string
  entityType: 'task' | 'document' | 'dossier'
  entityId: string
  actorId: string
  recipientIds: string[]
  payload: Record<string, any>
  processingStatus: 'pending' | 'processing' | 'processed' | 'failed'
  processedAt: Timestamp | null
  retryCount: number
  createdAt: Timestamp
}

// ===== Notification (User-facing) =====

export interface Notification {
  id: string
  recipientId: string
  type: 'immediate' | 'scheduled' | 'digest'
  category: string
  entityType: 'task' | 'document' | 'dossier'
  entityId: string
  title: string
  body: string
  actorId: string
  actorName: string
  isRead: boolean
  readAt: Timestamp | null
  scheduledFor: Timestamp | null
  createdAt: Timestamp
}

// ===== Reminder =====

export interface Reminder {
  id: string
  taskId: string
  recipientId: string
  triggerAt: Timestamp
  type: 'before_deadline' | 'custom'
  offsetMinutes: number | null         // -1440 = 1 day before deadline
  message: string | null
  isFired: boolean
  firedAt: Timestamp | null
  createdAt: Timestamp
}

// ===== Task Stats (Denormalized Counters) =====

export interface TaskStats {
  id: string
  scope: 'user' | 'department' | 'global'
  scopeId: string
  pending: number
  inProgress: number
  blocked: number
  completed: number
  cancelled: number
  overdue: number
  completedThisWeek: number
  completedThisMonth: number
  updatedAt: Timestamp
}

// ===== Input Types (for mutations) =====

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  startDate?: Timestamp
  dueDate?: Timestamp
  assigneeId?: string
  collaboratorIds?: string[]
  followerIds?: string[]
  departmentId?: string
  cooperatingDepartmentIds?: string[]
  dossierIds?: string[]
  documentIds?: string[]
  parentTaskId?: string
  tagIds?: string[]
  source?: TaskSource
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  priority?: TaskPriority
  startDate?: Timestamp | null
  dueDate?: Timestamp | null
  assigneeId?: string | null
  collaboratorIds?: string[]
  followerIds?: string[]
  departmentId?: string | null
  cooperatingDepartmentIds?: string[]
  dossierIds?: string[]
  documentIds?: string[]
  tagIds?: string[]
  progress?: number
}
