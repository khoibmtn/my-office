'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, User } from 'lucide-react'
import type { Task } from '@/types/tasks'
import { useStaff } from '@/hooks/useStaff'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskBulkActions } from './TaskBulkActions'
import { computeDerivedStates } from '@/lib/tasks/progress'

interface TaskTableProps {
  tasks: Task[]
  emptyMessage?: string
}

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

export function TaskTable({ tasks, emptyMessage = 'Không có công việc nào' }: TaskTableProps) {
  const router = useRouter()
  const { getStaffName } = useStaff()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < tasks.length

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(tasks.map(t => t.id))
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

  return (
    <div className="overflow-x-auto relative">
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
            <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Công việc</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Trạng thái</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Ưu tiên</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Người xử lý</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Hạn</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Tiến độ</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const derivedStates = computeDerivedStates({
              dueDate: task.dueDate?.toDate ? task.dueDate.toDate() : null,
              isClosed: task.isClosed,
              progress: task.progress,
              visibleFrom: task.visibleFrom?.toDate ? task.visibleFrom.toDate() : null,
            })

            const assigneeDisplayName = task.assigneeName || (task.assigneeId ? getStaffName(task.assigneeId) : null)

            const isSelected = selectedIds.includes(task.id)

            return (
              <tr
                key={task.id}
                onClick={() => router.push(`/tasks/${task.id}`)}
                className={`border-b border-slate-100 cursor-pointer transition-colors group ${
                  isSelected ? 'bg-blue-50/60 hover:bg-blue-50/80' : 'hover:bg-slate-50'
                }`}
              >
                {/* Select Checkbox */}
                <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleToggleSelectRow(e as any, task.id)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </td>

                {/* Title */}
                <td className="py-3 px-3">
                  <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</div>
                  )}
                </td>

                {/* Status */}
                <td className="py-3 px-3">
                  <TaskStatusBadge status={task.status} derivedStates={derivedStates} />
                </td>

                {/* Priority */}
                <td className="py-3 px-3">
                  <TaskPriorityBadge priority={task.priority} />
                </td>

                {/* Assignee */}
                <td className="py-3 px-3">
                  {assigneeDisplayName ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="text-xs text-slate-700 truncate">{assigneeDisplayName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Chưa giao</span>
                  )}
                </td>

                {/* Due Date */}
                <td className="py-3 px-3">
                  {task.dueDate ? (
                    <div>
                      <div className="text-xs text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(task.dueDate)}
                      </div>
                      {!task.isClosed && (
                        <div className={`text-[10px] mt-0.5 ${derivedStates.includes('OVERDUE') ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                          {daysUntil(task.dueDate)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>

                {/* Progress */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
          })}
        </tbody>
      </table>

      {/* Floating Bulk Actions Bar */}
      <TaskBulkActions
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  )
}
