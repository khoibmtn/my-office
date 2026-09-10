'use client'

import React from 'react'
import {
  Circle, Clock, Ban, CheckCircle2, XCircle,
  AlertTriangle, AlertCircle, CalendarClock,
} from 'lucide-react'
import type { TaskStatus } from '@/types/tasks'
import type { DerivedState } from '@/lib/tasks/progress'
import {
  TASK_STATUS_LABELS, TASK_STATUS_COLORS,
  DERIVED_STATE_LABELS, DERIVED_STATE_COLORS,
} from '@/lib/tasks/constants'

const STATUS_ICONS: Record<TaskStatus, React.ElementType> = {
  pending: Circle,
  in_progress: Clock,
  blocked: Ban,
  completed: CheckCircle2,
  cancelled: XCircle,
}

const DERIVED_ICONS: Record<DerivedState, React.ElementType> = {
  OVERDUE: AlertCircle,
  AT_RISK: AlertTriangle,
  UPCOMING: CalendarClock,
}

interface TaskStatusBadgeProps {
  status: TaskStatus
  derivedStates?: DerivedState[]
  size?: 'sm' | 'md'
}

export function TaskStatusBadge({ status, derivedStates = [], size = 'sm' }: TaskStatusBadgeProps) {
  const colors = TASK_STATUS_COLORS[status]
  const Icon = STATUS_ICONS[status]
  const label = TASK_STATUS_LABELS[status]
  const isSmall = size === 'sm'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border} ${isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
        <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label}
      </span>

      {derivedStates.map(state => {
        const dColors = DERIVED_STATE_COLORS[state]
        const DIcon = DERIVED_ICONS[state]
        return (
          <span
            key={state}
            className={`inline-flex items-center gap-1 rounded-full font-medium ${dColors.bg} ${dColors.text} ${isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
          >
            <DIcon className={isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {DERIVED_STATE_LABELS[state]}
          </span>
        )
      })}
    </div>
  )
}
