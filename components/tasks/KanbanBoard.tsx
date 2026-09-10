'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, GripVertical, User, Calendar } from 'lucide-react'
import type { Task, TaskStatus } from '@/types/tasks'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { computeDerivedStates } from '@/lib/tasks/progress'
import { isValidTransition } from '@/lib/tasks/validation'
import { updateTaskStatus } from '@/lib/tasks/mutations'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/tasks/constants'

interface KanbanBoardProps {
  tasks: Task[]
  actorId: string
  actorName: string
}

const KANBAN_COLUMNS: { status: TaskStatus; color: string }[] = [
  { status: 'pending', color: 'border-t-slate-400' },
  { status: 'in_progress', color: 'border-t-blue-500' },
  { status: 'blocked', color: 'border-t-red-500' },
  { status: 'completed', color: 'border-t-emerald-500' },
]

function formatDate(timestamp: any): string {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export function KanbanBoard({ tasks, actorId, actorName }: KanbanBoardProps) {
  const router = useRouter()
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  const getColumnTasks = (status: TaskStatus) =>
    tasks.filter(t => t.status === status && !t.deletedAt)

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const handleDragLeave = () => setDragOverColumn(null)

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault()
    setDragOverColumn(null)

    const taskId = e.dataTransfer.getData('text/plain')
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) {
      setDraggedTaskId(null)
      return
    }

    if (!isValidTransition(task.status, newStatus)) {
      setDraggedTaskId(null)
      return
    }

    try {
      await updateTaskStatus(taskId, newStatus, actorId, actorName)
    } catch (err) {
      console.error('Kanban drop failed:', err)
    }
    setDraggedTaskId(null)
  }

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map(({ status, color }) => {
        const columnTasks = getColumnTasks(status)
        const isDragOver = dragOverColumn === status

        return (
          <div
            key={status}
            className={`flex flex-col w-72 shrink-0 rounded-xl bg-slate-50 border-t-4 ${color} transition-colors ${
              isDragOver ? 'ring-2 ring-blue-300 bg-blue-50/30' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  {TASK_STATUS_LABELS[status]}
                </span>
                <span className="text-xs bg-white rounded-full px-2 py-0.5 text-slate-500 font-medium border border-slate-200">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto min-h-[200px]">
              {columnTasks.map((task) => {
                const derivedStates = computeDerivedStates({
                  dueDate: task.dueDate?.toDate ? task.dueDate.toDate() : null,
                  isClosed: task.isClosed,
                  progress: task.progress,
                  visibleFrom: task.visibleFrom?.toDate ? task.visibleFrom.toDate() : null,
                })
                const isDragging = draggedTaskId === task.id

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => router.push(`/tasks/${task.id}`)}
                    className={`bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${
                      isDragging ? 'opacity-40 scale-95' : ''
                    }`}
                  >
                    {/* Title */}
                    <div className="text-sm font-medium text-slate-800 group-hover:text-blue-600 line-clamp-2 mb-2">
                      {task.title}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between">
                      <TaskPriorityBadge priority={task.priority} showLabel={false} />
                      <div className="flex items-center gap-2">
                        {task.dueDate && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${
                            derivedStates.includes('OVERDUE') ? 'text-red-600 font-medium' : 'text-slate-400'
                          }`}>
                            <Calendar className="w-2.5 h-2.5" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.assigneeName && (
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center" title={task.assigneeName}>
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Derived states */}
                    {derivedStates.length > 0 && (
                      <div className="mt-1.5">
                        <TaskStatusBadge status={task.status} derivedStates={derivedStates} size="sm" />
                      </div>
                    )}

                    {/* Progress bar */}
                    {task.progress > 0 && task.progress < 100 && (
                      <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  Kéo thả công việc vào đây
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
