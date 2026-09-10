'use client'

import React from 'react'
import {
  Plus, UserPlus, ArrowRightLeft, RefreshCw,
  CheckCircle2, XCircle, Ban, ArrowUp,
  Calendar, MessageSquare, Paperclip, Link2,
} from 'lucide-react'
import type { TaskActivity, ActivityEventType } from '@/types/tasks'
import { ACTIVITY_EVENT_LABELS } from '@/lib/tasks/constants'

const EVENT_ICONS: Partial<Record<ActivityEventType, React.ElementType>> = {
  CREATED: Plus,
  ASSIGNED: UserPlus,
  REASSIGNED: ArrowRightLeft,
  STATUS_CHANGED: RefreshCw,
  COMPLETED: CheckCircle2,
  REOPENED: RefreshCw,
  BLOCKED: Ban,
  UNBLOCKED: RefreshCw,
  PRIORITY_CHANGED: ArrowUp,
  DEADLINE_CHANGED: Calendar,
  COMMENT_ADDED: MessageSquare,
  ATTACHMENT_ADDED: Paperclip,
  DEPENDENCY_ADDED: Link2,
}

const EVENT_COLORS: Partial<Record<ActivityEventType, string>> = {
  CREATED: 'bg-blue-100 text-blue-600',
  ASSIGNED: 'bg-indigo-100 text-indigo-600',
  REASSIGNED: 'bg-purple-100 text-purple-600',
  COMPLETED: 'bg-emerald-100 text-emerald-600',
  BLOCKED: 'bg-red-100 text-red-600',
  UNBLOCKED: 'bg-green-100 text-green-600',
  REOPENED: 'bg-amber-100 text-amber-600',
  COMMENT_ADDED: 'bg-sky-100 text-sky-600',
}

function formatTime(timestamp: any): string {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

interface TaskActivityFeedProps {
  activities: TaskActivity[]
}

export function TaskActivityFeed({ activities }: TaskActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-400">
        Chưa có hoạt động nào
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, index) => {
        const Icon = EVENT_ICONS[activity.eventType] ?? RefreshCw
        const colorClass = EVENT_COLORS[activity.eventType] ?? 'bg-slate-100 text-slate-500'
        const label = ACTIVITY_EVENT_LABELS[activity.eventType] ?? activity.eventType
        const isLast = index === activities.length - 1

        return (
          <div key={activity.id} className="flex gap-3 relative">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[13px] top-8 w-px h-[calc(100%-8px)] bg-slate-200" />
            )}

            {/* Icon */}
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${colorClass} z-10`}>
              <Icon className="w-3.5 h-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="text-xs text-slate-700">
                <span className="font-medium">{activity.actorName}</span>
                {' '}{label}
                {activity.metadata?.newStatus && (
                  <span className="font-medium"> → {activity.metadata.newStatus}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {formatTime(activity.createdAt)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
