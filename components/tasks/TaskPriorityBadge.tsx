'use client'

import React from 'react'
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react'
import type { TaskPriority } from '@/types/tasks'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/tasks/constants'

const PRIORITY_ICONS: Record<TaskPriority, React.ElementType> = {
  low: ArrowDown,
  normal: Minus,
  high: ArrowUp,
  urgent: AlertTriangle,
}

interface TaskPriorityBadgeProps {
  priority: TaskPriority
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function TaskPriorityBadge({ priority, size = 'sm', showLabel = true }: TaskPriorityBadgeProps) {
  const colors = TASK_PRIORITY_COLORS[priority]
  const Icon = PRIORITY_ICONS[priority]
  const label = TASK_PRIORITY_LABELS[priority]
  const isSmall = size === 'sm'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${colors.bg} ${colors.text} ${isSmall ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'}`}
      title={label}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {showLabel && label}
    </span>
  )
}
