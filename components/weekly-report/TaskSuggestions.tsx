'use client'

import React, { useMemo, useState } from 'react'
import { CheckCircle2, Plus, X } from 'lucide-react'
import { useTasks, toMillis } from '@/hooks/useTasks'
import { formatDMY, todayVN } from '@/lib/weekly-report/period'
import type { ISODate, WorkItem } from '@/types/weekly-report'
import type { Task } from '@/types/tasks'

export interface TaskSuggestionsProps {
  periodStart: ISODate
  periodEnd: ISODate
  workItems: WorkItem[]
  onAddTask: (task: Pick<Task, 'id' | 'title'>) => void
  /** Batch add ("Đưa tất cả") — optional */
  onAddTasks?: (tasks: Array<Pick<Task, 'id' | 'title'>>) => void
  editable?: boolean
  /** Optional mocked task list for dev-preview (skips Firestore listeners). */
  tasksOverride?: Task[]
}

interface TaskSuggestionsInnerProps extends Omit<TaskSuggestionsProps, 'tasksOverride'> {
  tasks: Task[]
  loading: boolean
}

function TaskSuggestionsInner({
  periodStart,
  periodEnd,
  workItems,
  onAddTask,
  onAddTasks,
  editable = true,
  tasks,
  loading,
}: TaskSuggestionsInnerProps) {
  const existingTaskIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of workItems) {
      if (item.taskId) ids.add(item.taskId)
    }
    return ids
  }, [workItems])

  const suggestions = useMemo(() => {
    const matched: Array<{ id: string; title: string; completedDate: ISODate }> = []
    for (const task of tasks) {
      if (task.deletedAt != null) continue
      if (task.status !== 'completed') continue
      if (task.parentTaskId) continue
      if (existingTaskIds.has(task.id)) continue

      const ms = toMillis(task.completedAt) ?? toMillis(task.updatedAt)
      if (ms === null) continue
      const dateVN = todayVN(new Date(ms))
      if (dateVN < periodStart || dateVN > periodEnd) continue

      matched.push({
        id: task.id,
        title: task.title,
        completedDate: dateVN,
      })
    }
    matched.sort((a, b) => b.completedDate.localeCompare(a.completedDate))
    return matched
  }, [tasks, existingTaskIds, periodStart, periodEnd])

  // Popup: hidden when nothing to suggest; closable; closes itself once everything was added.
  const signature = suggestions.map((x) => x.id).join(',')
  const [dismissedSig, setDismissedSig] = useState<string | null>(null)
  if (loading || suggestions.length === 0) return null

  if (dismissedSig === signature) {
    return (
      <button
        type="button"
        onClick={() => setDismissedSig(null)}
        className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 min-h-[40px] text-xs font-semibold text-emerald-700 shadow-md hover:bg-emerald-50 lg:bottom-4"
      >
        <CheckCircle2 className="h-4 w-4" />
        Gợi ý từ Công việc ({suggestions.length})
      </button>
    )
  }

  return (
    <aside
      role="dialog"
      aria-label="Gợi ý từ Công việc"
      className="fixed bottom-20 right-4 z-40 w-[min(92vw,360px)] max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl space-y-2 lg:bottom-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900">Gợi ý từ Công việc ({suggestions.length})</h2>
        </div>
        <button
          type="button"
          onClick={() => setDismissedSig(signature)}
          aria-label="Đóng gợi ý"
          className="inline-flex items-center justify-center rounded-md min-h-[36px] min-w-[36px] sm:min-h-[28px] sm:min-w-[28px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Việc đã hoàn thành trong kỳ {formatDMY(periodStart)}–{formatDMY(periodEnd)}, chưa có trong Mục 1.
      </p>
      <ul className="divide-y divide-slate-100">
        {suggestions.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <p className="text-sm text-slate-900 break-words">{item.title}</p>
              <p className="text-xs text-slate-500">Xong ngày {formatDMY(item.completedDate)}</p>
            </div>
            {editable && (
              <button
                type="button"
                onClick={() => onAddTask({ id: item.id, title: item.title })}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 min-h-[36px] sm:min-h-[28px] text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Đưa vào
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && onAddTasks && suggestions.length > 1 && (
        <button
          type="button"
          onClick={() => onAddTasks?.(suggestions.map((x) => ({ id: x.id, title: x.title })))}
          className="w-full rounded-md bg-blue-600 min-h-[36px] sm:min-h-[30px] text-xs font-semibold text-white hover:bg-blue-700"
        >
          Đưa tất cả vào Mục 1
        </button>
      )}
    </aside>
  )
}

function LiveTaskSuggestions(props: Omit<TaskSuggestionsProps, 'tasksOverride'>) {
  const { tasks, loading } = useTasks({ view: 'all' })
  return <TaskSuggestionsInner {...props} tasks={tasks} loading={loading} />
}

export function TaskSuggestions({ tasksOverride, ...rest }: TaskSuggestionsProps) {
  if (tasksOverride) {
    return <TaskSuggestionsInner {...rest} tasks={tasksOverride} loading={false} />
  }
  return <LiveTaskSuggestions {...rest} />
}
