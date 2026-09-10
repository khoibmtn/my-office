import type { TaskStatus, TaskPriority, ActivityEventType } from '@/types/tasks'

// ===== Status Configuration =====

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang thực hiện',
  blocked: 'Bị chặn',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300', dot: 'bg-gray-400' },
}

export const TASK_STATUS_ICONS: Record<TaskStatus, string> = {
  pending: 'Circle',
  in_progress: 'Clock',
  blocked: 'Ban',
  completed: 'CheckCircle2',
  cancelled: 'XCircle',
}

// ===== Priority Configuration =====

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
  urgent: 'Khẩn cấp',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; dot: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  normal: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
}

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

// ===== State Machine =====

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked', 'cancelled'],
  blocked: ['pending', 'in_progress', 'cancelled'],
  completed: ['pending'],    // reopen
  cancelled: ['pending'],    // reopen
}

export const CLOSED_STATUSES: TaskStatus[] = ['completed', 'cancelled']

export const ACTIVE_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked']

// ===== Activity Event Labels =====

export const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  CREATED: 'đã tạo công việc',
  ASSIGNED: 'đã giao cho',
  REASSIGNED: 'đã chuyển giao cho',
  STATUS_CHANGED: 'đã thay đổi trạng thái',
  PRIORITY_CHANGED: 'đã thay đổi mức ưu tiên',
  DEADLINE_CHANGED: 'đã thay đổi hạn hoàn thành',
  PROGRESS_UPDATED: 'đã cập nhật tiến độ',
  COMMENT_ADDED: 'đã bình luận',
  ATTACHMENT_ADDED: 'đã thêm tệp đính kèm',
  COMPLETED: 'đã hoàn thành',
  REOPENED: 'đã mở lại',
  BLOCKED: 'đã đánh dấu bị chặn',
  UNBLOCKED: 'đã gỡ trạng thái bị chặn',
  SUBTASK_COMPLETED: 'đã hoàn thành việc con',
  DEPENDENCY_ADDED: 'đã thêm phụ thuộc',
}

// ===== Source Labels =====

export const TASK_SOURCE_LABELS: Record<string, string> = {
  manual: 'Tạo thủ công',
  recurring: 'Tự động (định kỳ)',
  template: 'Từ mẫu',
  dossier_checklist: 'Từ checklist hồ sơ',
  document: 'Từ văn bản',
  system: 'Hệ thống',
}

// ===== Defaults =====

export const DEFAULT_TASK_PRIORITY: TaskPriority = 'normal'
export const DEFAULT_PROGRESS_MODE = 'manual' as const
export const DEFAULT_ROLLING_WINDOW_DAYS = 14
export const DEFAULT_LEAD_DAYS = 0
export const DEFAULT_DUE_OFFSET_MINUTES = 0
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'
export const DEFAULT_MISFIRE_POLICY = 'CREATE_MISSED' as const

// ===== Derived State =====

export type DerivedState = 'OVERDUE' | 'AT_RISK' | 'UPCOMING'

export const DERIVED_STATE_LABELS: Record<DerivedState, string> = {
  OVERDUE: 'Quá hạn',
  AT_RISK: 'Sắp quá hạn',
  UPCOMING: 'Sắp tới',
}

export const DERIVED_STATE_COLORS: Record<DerivedState, { bg: string; text: string }> = {
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700' },
  AT_RISK: { bg: 'bg-amber-100', text: 'text-amber-700' },
  UPCOMING: { bg: 'bg-sky-100', text: 'text-sky-700' },
}
