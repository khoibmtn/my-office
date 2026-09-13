'use client'

import React from 'react'
import type { TaskPriority } from '@/types/tasks'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/tasks/constants'

// Dot colors for each priority
const DOT_COLORS: Record<TaskPriority, string> = {
  low: 'bg-slate-400',
  normal: 'bg-blue-400',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
}

interface TaskPriorityBadgeProps {
  priority: TaskPriority
  size?: 'sm' | 'md'
  showLabel?: boolean
  /** Compact mode: only show colored dot */
  compact?: boolean
}

export const TaskPriorityBadge = React.memo(function TaskPriorityBadge({
  priority,
  size = 'sm',
  showLabel = true,
  compact = false,
}: TaskPriorityBadgeProps) {
  const label = TASK_PRIORITY_LABELS[priority]
  const dotColor = DOT_COLORS[priority]
  const isSmall = size === 'sm'

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5" title={label}>
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} inline-block shrink-0`} />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${isSmall ? 'text-[11px]' : 'text-xs'}`}
      title={label}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor} inline-block shrink-0`} />
      {showLabel && <span className="text-slate-600 font-medium">{label}</span>}
    </span>
  )
})
