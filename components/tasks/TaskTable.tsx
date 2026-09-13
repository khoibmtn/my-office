'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, User, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import type { Task, TaskStatus, TaskPriority } from '@/types/tasks'
import { useStaff } from '@/hooks/useStaff'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskBulkActions } from './TaskBulkActions'
import { computeDerivedStates } from '@/lib/tasks/progress'
import type { DerivedState } from '@/lib/tasks/progress'
import {
  TASK_STATUS_LABELS, TASK_STATUS_COLORS,
  TASK_PRIORITY_ORDER,
} from '@/lib/tasks/constants'

interface TaskTableProps {
  tasks: Task[]
  emptyMessage?: string
}

// ===== Sort types =====
type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'progress'
type SortDir = 'asc' | 'desc'

// Status sort order (active first, then closed)
const STATUS_ORDER: Record<TaskStatus, number> = {
  pending: 0,
  in_progress: 1,
  blocked: 2,
  completed: 3,
  cancelled: 4,
}

// ===== Quick filter type =====
type QuickFilter = TaskStatus | 'overdue' | null

function formatDate(timestamp: any): string {
  if (!timestamp) return '—'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysUntil(timestamp: any): string {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `Quá ${Math.abs(diff)} ngày`
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Ngày mai'
  return `Còn ${diff} ngày`
}

function getTimestamp(ts: any): number {
  if (!ts) return Infinity
  if (ts.toMillis) return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  if (ts instanceof Date) return ts.getTime()
  return Infinity
}

const SortIcon = React.memo(function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}) {
  if (sortKey !== column) {
    return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 shrink-0" />
  }
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-blue-500 ml-1 shrink-0" />
    : <ArrowDown className="w-3 h-3 text-blue-500 ml-1 shrink-0" />
})

export function TaskTable({ tasks, emptyMessage = 'Không có công việc nào' }: TaskTableProps) {
  const router = useRouter()
  const { getStaffName } = useStaff()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)

  // Compute derived states for all tasks once
  const tasksWithDerived = useMemo(() => {
    return tasks.map(task => {
      const derivedStates = computeDerivedStates({
        dueDate: task.dueDate?.toDate ? task.dueDate.toDate() : null,
        isClosed: task.isClosed,
        progress: task.progress,
        visibleFrom: task.visibleFrom?.toDate ? task.visibleFrom.toDate() : null,
      })
      return { task, derivedStates }
    })
  }, [tasks])

  // Quick filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
    }
    tasksWithDerived.forEach(({ task, derivedStates }) => {
      counts[task.status] = (counts[task.status] || 0) + 1
      if (derivedStates.includes('OVERDUE' as DerivedState)) {
        counts.overdue++
      }
    })
    return counts
  }, [tasksWithDerived])

  // Apply quick filter
  const filteredTasks = useMemo(() => {
    if (!quickFilter) return tasksWithDerived
    if (quickFilter === 'overdue') {
      return tasksWithDerived.filter(({ derivedStates }) =>
        derivedStates.includes('OVERDUE' as DerivedState)
      )
    }
    return tasksWithDerived.filter(({ task }) => task.status === quickFilter)
  }, [tasksWithDerived, quickFilter])

  // Sort
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title':
          cmp = a.task.title.localeCompare(b.task.title, 'vi')
          break
        case 'status':
          cmp = (STATUS_ORDER[a.task.status] ?? 99) - (STATUS_ORDER[b.task.status] ?? 99)
          break
        case 'priority':
          cmp = (TASK_PRIORITY_ORDER[a.task.priority] ?? 99) - (TASK_PRIORITY_ORDER[b.task.priority] ?? 99)
          break
        case 'assignee': {
          const aName = a.task.assigneeName || (a.task.assigneeId ? getStaffName(a.task.assigneeId) : '') || ''
          const bName = b.task.assigneeName || (b.task.assigneeId ? getStaffName(b.task.assigneeId) : '') || ''
          cmp = aName.localeCompare(bName, 'vi')
          break
        }
        case 'dueDate':
          cmp = getTimestamp(a.task.dueDate) - getTimestamp(b.task.dueDate)
          break
        case 'progress':
          cmp = a.task.progress - b.task.progress
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredTasks, sortKey, sortDir, getStaffName])

  // Toggle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }



  // Toggle quick filter
  const handleQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(prev => prev === filter ? null : filter)
  }

  // Select logic
  const displayedTaskIds = sortedTasks.map(t => t.task.id)
  const allSelected = displayedTaskIds.length > 0 && selectedIds.length === displayedTaskIds.length
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < displayedTaskIds.length

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(displayedTaskIds)
    }
  }

  const handleToggleSelectRow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  // Quick filter badge configs
  const quickFilterBadges: { key: QuickFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'pending', label: 'Chờ xử lý', color: 'bg-slate-100 text-slate-600 border-slate-200', activeColor: 'bg-slate-600 text-white border-slate-600' },
    { key: 'in_progress', label: 'Đang thực hiện', color: 'bg-blue-50 text-blue-600 border-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600' },
    { key: 'blocked', label: 'Bị chặn', color: 'bg-red-50 text-red-600 border-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
    { key: 'completed', label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'cancelled', label: 'Đã hủy', color: 'bg-gray-50 text-gray-500 border-gray-200', activeColor: 'bg-gray-600 text-white border-gray-600' },
    { key: 'overdue', label: 'Quá hạn', color: 'bg-red-50 text-red-700 border-red-200', activeColor: 'bg-red-700 text-white border-red-700' },
  ]

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto relative">
      {/* Quick filter badges */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-100 overflow-x-auto">
        {quickFilterBadges.map(badge => {
          const count = filterCounts[badge.key as string] || 0
          const isActive = quickFilter === badge.key
          return (
            <button
              key={badge.key}
              onClick={() => handleQuickFilter(badge.key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap shrink-0 ${
                isActive ? badge.activeColor : badge.color
              } hover:shadow-sm`}
            >
              {badge.label}
              <span className={`px-1 min-w-[16px] text-center rounded-full text-[10px] font-bold ${
                isActive ? 'bg-white/25' : 'bg-black/5'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
        {quickFilter && (
          <button
            onClick={() => setQuickFilter(null)}
            className="text-[11px] text-slate-400 hover:text-red-500 px-1.5 py-1 transition-colors"
          >
            ✕ Bỏ lọc
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left bg-slate-50/50">
            <th className="py-2.5 px-3 w-10 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => {
                  if (el) el.indeterminate = isIndeterminate
                }}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </th>
            {/* Sortable headers */}
            <th
              className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center">
                Công việc
                <SortIcon column="title" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th
              className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none min-w-[140px]"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center whitespace-nowrap">
                Trạng thái
                <SortIcon column="status" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th
              className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none min-w-[80px]"
              onClick={() => handleSort('priority')}
            >
              <div className="flex items-center whitespace-nowrap">
                Ưu tiên
                <SortIcon column="priority" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th
              className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none min-w-[100px]"
              onClick={() => handleSort('assignee')}
            >
              <div className="flex items-center whitespace-nowrap">
                Người xử lý
                <SortIcon column="assignee" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th
              className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none min-w-[110px]"
              onClick={() => handleSort('dueDate')}
            >
              <div className="flex items-center whitespace-nowrap">
                Hạn
                <SortIcon column="dueDate" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th
              className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none w-24"
              onClick={() => handleSort('progress')}
            >
              <div className="flex items-center whitespace-nowrap">
                Tiến độ
                <SortIcon column="progress" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">
                Không có công việc nào khớp bộ lọc
              </td>
            </tr>
          ) : (
            sortedTasks.map(({ task, derivedStates }) => {
              const assigneeDisplayName = task.assigneeName || (task.assigneeId ? getStaffName(task.assigneeId) : null)
              const isSelected = selectedIds.includes(task.id)

              return (
                <tr
                  key={task.id}
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  onMouseEnter={() => router.prefetch(`/tasks/${task.id}`)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors group ${
                    isSelected ? 'bg-blue-50/60 hover:bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleSelectRow(e as any, task.id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>

                  {/* Title + recurring badge */}
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                      {task.seriesId && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600 bg-violet-50 rounded px-1 py-0.5 mr-1.5 align-middle" title="Định kỳ">
                          <RefreshCw className="w-2.5 h-2.5" />
                        </span>
                      )}
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</div>
                    )}
                  </td>

                  {/* Status — no wrap */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <TaskStatusBadge status={task.status} derivedStates={derivedStates} />
                  </td>

                  {/* Priority — compact dot */}
                  <td className="py-2.5 px-3 whitespace-nowrap text-center">
                    <TaskPriorityBadge priority={task.priority} compact />
                  </td>

                  {/* Assignee */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {assigneeDisplayName ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-xs text-slate-700 truncate max-w-[80px]">{assigneeDisplayName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa giao</span>
                    )}
                  </td>

                  {/* Due Date */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {task.dueDate ? (
                      <div>
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          {formatDate(task.dueDate)}
                        </div>
                        {!task.isClosed && (
                          <div className={`text-[10px] mt-0.5 ${derivedStates.includes('OVERDUE' as DerivedState) ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                            {daysUntil(task.dueDate)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Progress */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            task.progress >= 100 ? 'bg-emerald-500' :
                            task.progress >= 50 ? 'bg-blue-500' :
                            'bg-slate-300'
                          }`}
                          style={{ width: `${Math.min(task.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 w-7 text-right">{task.progress}%</span>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {/* Result count when filtered */}
      {quickFilter && (
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
          Hiển thị {sortedTasks.length}/{tasks.length} công việc
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      <TaskBulkActions
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  )
}
