'use client'

import React, { useState } from 'react'
import {
  CheckSquare, Square, Trash2, UserPlus, Tag,
  ArrowUp, X, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import type { Task, TaskStatus, TaskPriority } from '@/types/tasks'
import { updateTask, updateTaskStatus, deleteTask } from '@/lib/tasks/mutations'
import { isValidTransition } from '@/lib/tasks/validation'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS, TASK_STATUS_LABELS } from '@/lib/tasks/constants'
import type { StaffMember } from '@/types'

interface BulkActionsBarProps {
  selectedTaskIds: string[]
  tasks: Task[]
  actorId: string
  actorName: string
  staffList: StaffMember[]
  onClearSelection: () => void
  onComplete: () => void
}

export function BulkActionsBar({
  selectedTaskIds, tasks, actorId, actorName,
  staffList, onClearSelection, onComplete,
}: BulkActionsBarProps) {
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<string | null>(null)

  const count = selectedTaskIds.length
  if (count === 0) return null

  const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id))

  const bulkStatusChange = async (newStatus: TaskStatus) => {
    setLoading(true)
    try {
      const valid = selectedTasks.filter(t => isValidTransition(t.status, newStatus))
      await Promise.allSettled(
        valid.map(t => updateTaskStatus(t.id, newStatus, actorId, actorName))
      )
      onComplete()
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const bulkPriorityChange = async (priority: TaskPriority) => {
    setLoading(true)
    try {
      await Promise.allSettled(
        selectedTasks.map(t =>
          updateTask(t.id, { priority }, actorId, actorName)
        )
      )
      onComplete()
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const bulkAssign = async (assigneeId: string) => {
    setLoading(true)
    try {
      await Promise.allSettled(
        selectedTasks.map(t =>
          updateTask(t.id, { assigneeId }, actorId, actorName)
        )
      )
      onComplete()
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const bulkDelete = async () => {
    if (!confirm(`Xóa ${count} công việc?`)) return
    setLoading(true)
    try {
      await Promise.allSettled(
        selectedTaskIds.map(id => deleteTask(id, actorId))
      )
      onComplete()
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 min-w-[500px]">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
          <CheckSquare className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">{count} đã chọn</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang xử lý...
          </div>
        ) : action === 'status' ? (
          <div className="flex items-center gap-1.5">
            {(['pending', 'in_progress', 'completed', 'cancelled'] as TaskStatus[]).map(s => (
              <button
                key={s}
                onClick={() => bulkStatusChange(s)}
                className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {TASK_STATUS_LABELS[s]}
              </button>
            ))}
            <button onClick={() => setAction(null)} className="p-1 hover:bg-slate-700 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : action === 'priority' ? (
          <div className="flex items-center gap-1.5">
            {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(p => (
              <button
                key={p}
                onClick={() => bulkPriorityChange(p)}
                className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors inline-flex items-center gap-1"
              >
                <span>{TASK_PRIORITY_DOTS[p]}</span>
                <span>{TASK_PRIORITY_LABELS[p]}</span>
              </button>
            ))}
            <button onClick={() => setAction(null)} className="p-1 hover:bg-slate-700 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : action === 'assign' ? (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[300px]">
            {staffList.filter(s => s.isActive).slice(0, 6).map(s => (
              <button
                key={s.id}
                onClick={() => bulkAssign(s.id)}
                className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                {s.shortName}
              </button>
            ))}
            <button onClick={() => setAction(null)} className="p-1 hover:bg-slate-700 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <button onClick={() => setAction('status')} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-slate-800 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Trạng thái
            </button>
            <button onClick={() => setAction('priority')} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-slate-800 transition-colors">
              <ArrowUp className="w-3.5 h-3.5" /> Ưu tiên
            </button>
            <button onClick={() => setAction('assign')} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-slate-800 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Giao việc
            </button>
            <button onClick={bulkDelete} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-red-800 text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Xóa
            </button>
          </>
        )}

        {/* Close */}
        <button
          onClick={onClearSelection}
          className="ml-auto p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  )
}

// ===== Selection Hook =====

interface UseTaskSelectionReturn {
  selectedIds: string[]
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
}

export function useTaskSelection(): UseTaskSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  return {
    selectedIds,
    toggleSelect: (id: string) => {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      )
    },
    selectAll: (ids: string[]) => setSelectedIds(ids),
    clearSelection: () => setSelectedIds([]),
    isSelected: (id: string) => selectedIds.includes(id),
  }
}
