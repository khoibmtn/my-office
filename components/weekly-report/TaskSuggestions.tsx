'use client'

import React, { useMemo } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { useTasks, toMillis } from '@/hooks/useTasks'
import { formatDMY, todayVN } from '@/lib/weekly-report/period'
import type { ISODate, WorkItem } from '@/types/weekly-report'
import type { Task } from '@/types/tasks'

export interface TaskSuggestionsProps {
  periodStart: ISODate
  periodEnd: ISODate
  workItems: WorkItem[]
  onAddTask: (task: Pick<Task, 'id' | 'title'>) => void
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

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900">
            Gợi ý từ Công việc
          </h2>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {suggestions.length}
        </span>
      </div>

      <p className="text-xs text-slate-600">
        Việc đã hoàn thành trong kỳ {formatDMY(periodStart)}–{formatDMY(periodEnd)}.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải danh sách công việc…</p>
      ) : suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Không còn công việc hoàn thành nào trong kỳ này chưa đưa vào báo cáo.
        </div>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 flex flex-col gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 break-words">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Xong ngày {formatDMY(item.completedDate)}
                </p>
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => onAddTask({ id: item.id, title: item.title })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors self-start"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Đưa vào</span>
                </button>
              )}
            </li>
          ))}
        </ul>
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
