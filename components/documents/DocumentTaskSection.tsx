'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  CheckSquare,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  User,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import { useRole } from '@/hooks/useRole'
import { createTask, updateTaskStatus, deleteTask } from '@/lib/tasks/mutations'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/tasks/constants'
import type { Task } from '@/types/tasks'

interface DocumentTaskSectionProps {
  documentId: string
  documentTitle: string
}

export function DocumentTaskSection({ documentId, documentTitle }: DocumentTaskSectionProps) {
  const { staffId, staffName, isAdmin } = useRole()
  const { tasks, loading } = useTasks({ view: 'document', documentId })
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const totalCount = tasks.length
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleToggle = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    await updateTaskStatus(
      task.id,
      nextStatus,
      staffId || 'unknown',
      staffName || (isAdmin ? 'Admin' : 'Thành viên')
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || submitting) return

    setSubmitting(true)
    try {
      await createTask(
        {
          title: newTaskTitle.trim(),
          documentIds: [documentId],
          source: 'document',
        },
        staffId || 'unknown',
        staffName || (isAdmin ? 'Admin' : 'Thành viên')
      )
      setNewTaskTitle('')
    } catch (err) {
      console.error('Failed to create document task:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId, staffId || 'unknown')
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="px-3 py-2 bg-blue-100/70 border-b border-blue-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-blue-700" />
          <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
            Công việc ({completedCount}/{totalCount})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <span className="text-[11px] font-bold text-blue-800 bg-blue-200/60 px-1.5 py-0.5 rounded">
              {percent}%
            </span>
          )}
          <Link
            href="/tasks"
            className="text-[11px] text-blue-700 hover:text-blue-900 font-medium flex items-center gap-0.5"
            title="Mở không gian công việc"
          >
            Tất cả việc <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>

      <div className="p-3">
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="w-full h-1.5 bg-blue-200/60 rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        {/* Tasks list */}
        <div className="space-y-1.5 mb-2.5">
          {loading ? (
            <div className="py-3 flex justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-2">
              Chưa có công việc nào gắn với văn bản này
            </p>
          ) : (
            tasks.map((task) => {
              const isDone = task.status === 'completed'
              return (
                <div
                  key={task.id}
                  className={`group flex items-start gap-2 p-2 rounded-lg border transition-all ${
                    isDone
                      ? 'bg-blue-100/40 border-blue-200'
                      : 'bg-white border-blue-200/80 hover:border-blue-300 shadow-2xs'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => handleToggle(task)}
                    className="mt-0.5 w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/tasks/${task.id}`}
                        className={`text-xs leading-tight hover:text-blue-600 truncate ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </Link>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-slate-400 hover:text-blue-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xem chi tiết"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      {task.priority && task.priority !== 'normal' && (
                        <span className={`px-1 rounded font-semibold ${TASK_PRIORITY_COLORS[task.priority]}`}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                      )}
                      {task.assigneeName && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" />
                          {task.assigneeName}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <Calendar className="w-2.5 h-2.5" />
                          {task.dueDate.toDate().toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(task.id)}
                    className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Xóa công việc"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Quick add form */}
        <form onSubmit={handleCreate} className="flex gap-1.5">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="+ Tạo công việc từ văn bản này..."
            disabled={submitting}
            className="flex-1 px-2.5 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder:text-slate-400 disabled:opacity-60"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!newTaskTitle.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
