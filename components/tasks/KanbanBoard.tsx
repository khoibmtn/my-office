'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  GripVertical,
  User,
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ListTodo,
  ArrowRight,
  MoreVertical,
  Layers,
} from 'lucide-react'
import type { Task, TaskStatus } from '@/types/tasks'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
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

const KANBAN_COLUMNS: { status: TaskStatus; title: string; color: string; bgHeader: string; borderAccent: string }[] = [
  {
    status: 'pending',
    title: 'Chờ xử lý',
    color: 'border-t-slate-400',
    bgHeader: 'bg-slate-100 text-slate-700',
    borderAccent: 'hover:border-slate-400',
  },
  {
    status: 'in_progress',
    title: 'Đang thực hiện',
    color: 'border-t-blue-500',
    bgHeader: 'bg-blue-50 text-blue-700',
    borderAccent: 'hover:border-blue-400',
  },
  {
    status: 'blocked',
    title: 'Bị chặn',
    color: 'border-t-red-500',
    bgHeader: 'bg-red-50 text-red-700',
    borderAccent: 'hover:border-red-400',
  },
  {
    status: 'completed',
    title: 'Hoàn thành',
    color: 'border-t-emerald-500',
    bgHeader: 'bg-emerald-50 text-emerald-700',
    borderAccent: 'hover:border-emerald-400',
  },
]

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getDueDateStatus(dueDate: any, isClosed: boolean): { text: string; isOverdue: boolean; isToday: boolean } | null {
  if (!dueDate || isClosed) return null
  const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate.seconds ? dueDate.seconds * 1000 : dueDate)
  if (isNaN(date.getTime())) return null

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dueDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  const diffDays = Math.round((dueDayStart - todayStart) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { text: `Quá hạn ${Math.abs(diffDays)} ngày`, isOverdue: true, isToday: false }
  } else if (diffDays === 0) {
    return { text: 'Hôm nay', isOverdue: false, isToday: true }
  } else if (diffDays === 1) {
    return { text: 'Ngày mai', isOverdue: false, isToday: false }
  } else {
    return { text: `Còn ${diffDays} ngày`, isOverdue: false, isToday: false }
  }
}

export function KanbanBoard({ tasks, actorId, actorName }: KanbanBoardProps) {
  const router = useRouter()
  const { staff, getStaffName } = useStaff()
  const { departments } = useDepartments()

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  // Optimistic status overrides for instant UI updates
  const [optimisticStatusMap, setOptimisticStatusMap] = useState<Record<string, TaskStatus>>({})

  // Compute subtask counts for parent tasks
  const subtaskStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {}
    for (const t of tasks) {
      if (t.parentTaskId) {
        if (!stats[t.parentTaskId]) {
          stats[t.parentTaskId] = { total: 0, completed: 0 }
        }
        stats[t.parentTaskId].total += 1
        if (t.status === 'completed') {
          stats[t.parentTaskId].completed += 1
        }
      }
    }
    return stats
  }, [tasks])

  // Get department name helper
  const getDeptName = useCallback(
    (deptId?: string | null) => {
      if (!deptId) return null
      return departments.find(d => d.id === deptId)?.name || deptId
    },
    [departments]
  )

  // Get staff name helper
  const resolveStaffName = useCallback(
    (id?: string | null, fallback?: string | null) => {
      if (fallback) return fallback
      if (!id) return null
      const found = staff.find(s => s.id === id)
      return found?.fullName || found?.shortName || getStaffName(id) || id
    },
    [staff, getStaffName]
  )

  // Top level tasks with optimistic status applied
  const topLevelTasks = useMemo(() => {
    return tasks
      .filter(t => !t.parentTaskId && !t.deletedAt)
      .map(t => {
        const optimistic = optimisticStatusMap[t.id]
        return optimistic ? { ...t, status: optimistic } : t
      })
  }, [tasks, optimisticStatusMap])

  const getColumnTasks = (status: TaskStatus) =>
    topLevelTasks.filter(t => t.status === status)

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== status) {
      setDragOverColumn(status)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the column container entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null)
    }
  }

  // Smart status transition: executes intermediate steps if required by state machine
  const executeStatusTransition = async (task: Task, targetStatus: TaskStatus) => {
    const current = task.status
    if (current === targetStatus) return

    // Optimistic UI update
    setOptimisticStatusMap(prev => ({ ...prev, [task.id]: targetStatus }))

    try {
      if (isValidTransition(current, targetStatus)) {
        await updateTaskStatus(task.id, targetStatus, actorId, actorName)
      } else {
        // Multi-step transition resolution
        if (current === 'pending' && targetStatus === 'completed') {
          await updateTaskStatus(task.id, 'in_progress', actorId, actorName)
          await updateTaskStatus(task.id, 'completed', actorId, actorName)
        } else if (current === 'completed' && targetStatus === 'in_progress') {
          await updateTaskStatus(task.id, 'pending', actorId, actorName)
          await updateTaskStatus(task.id, 'in_progress', actorId, actorName)
        } else if (current === 'in_progress' && targetStatus === 'pending') {
          await updateTaskStatus(task.id, 'blocked', actorId, actorName, 'Chuyển về chờ xử lý')
          await updateTaskStatus(task.id, 'pending', actorId, actorName)
        } else if (current === 'blocked' && targetStatus === 'completed') {
          await updateTaskStatus(task.id, 'in_progress', actorId, actorName)
          await updateTaskStatus(task.id, 'completed', actorId, actorName)
        } else {
          // Direct fallback attempt
          await updateTaskStatus(task.id, targetStatus, actorId, actorName)
        }
      }
    } catch (err) {
      console.error('Failed to update task status:', err)
      // Revert optimistic on failure
      setOptimisticStatusMap(prev => {
        const next = { ...prev }
        delete next[task.id]
        return next
      })
    }
  }

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault()
    setDragOverColumn(null)

    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
    setDraggedTaskId(null)
    if (!taskId) return

    const task = topLevelTasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    await executeStatusTransition(task, newStatus)
  }

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4 select-none">
      {KANBAN_COLUMNS.map(({ status, title, color, bgHeader }) => {
        const columnTasks = getColumnTasks(status)
        const isDragOver = dragOverColumn === status

        return (
          <div
            key={status}
            className={`flex flex-col w-80 shrink-0 rounded-xl bg-slate-100/70 border-t-4 ${color} transition-all duration-150 ${
              isDragOver ? 'ring-2 ring-blue-500 bg-blue-50/50 scale-[1.01]' : 'border border-slate-200/80'
            }`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="px-3.5 py-3 flex items-center justify-between border-b border-slate-200/60 bg-white/70 rounded-t-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 tracking-tight">
                  {title}
                </span>
                <span className="text-xs bg-slate-200/80 rounded-full px-2 py-0.5 text-slate-700 font-bold">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Cards container */}
            <div className="flex-1 px-2.5 py-2.5 space-y-2.5 overflow-y-auto min-h-[300px]">
              {columnTasks.map((task) => {
                const derivedStates = computeDerivedStates({
                  dueDate: task.dueDate?.toDate ? task.dueDate.toDate() : null,
                  isClosed: task.isClosed,
                  progress: task.progress,
                  visibleFrom: task.visibleFrom?.toDate ? task.visibleFrom.toDate() : null,
                })
                const isDragging = draggedTaskId === task.id
                const subtasks = subtaskStats[task.id]
                const dueStatus = getDueDateStatus(task.dueDate, task.isClosed)
                const assigneeName = resolveStaffName(task.assigneeId, task.assigneeName)
                const deptName = getDeptName(task.departmentId)

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => router.push(`/tasks/${task.id}`)}
                    onMouseEnter={() => router.prefetch(`/tasks/${task.id}`)}
                    className={`bg-white rounded-xl border border-slate-200 p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all group relative ${
                      isDragging ? 'opacity-40 scale-95 ring-2 ring-blue-400' : 'shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Department / Tags & Priority */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {deptName && (
                          <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded px-1.5 py-0.5 truncate max-w-[130px]">
                            {deptName}
                          </span>
                        )}
                        {task.tagIds && task.tagIds.length > 0 && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                            #{task.tagIds[0]}
                          </span>
                        )}
                      </div>
                      <TaskPriorityBadge priority={task.priority} size="sm" showLabel={true} />
                    </div>

                    {/* Task Title */}
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-snug mb-2">
                      {task.title}
                    </h3>

                    {/* Progress Bar & Subtasks Info */}
                    <div className="space-y-1.5 mb-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="text-[11px] font-medium text-slate-600">Tiến độ:</span>
                        <span className="text-[11px] font-bold text-blue-600">{task.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            task.progress >= 100
                              ? 'bg-emerald-500'
                              : task.status === 'blocked'
                              ? 'bg-red-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(task.progress || 0, 100)}%` }}
                        />
                      </div>
                      {subtasks && subtasks.total > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <ListTodo className="w-3 h-3 text-slate-400" />
                          <span>
                            {subtasks.completed}/{subtasks.total} việc con ({Math.round((subtasks.completed / subtasks.total) * 100)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer: Assignee & Timeline */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      {/* Assignee */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {assigneeName ? (
                            <>
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {assigneeName.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-slate-700 text-[11px] font-medium" title={assigneeName}>
                                {assigneeName}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                              <User className="w-3 h-3" /> Chưa giao
                            </span>
                          )}
                        </div>

                        {/* Drag grip icon hint */}
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 cursor-grab" />
                      </div>

                      {/* Dates: Created and Due */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 text-slate-400" title="Ngày giao">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimestamp(task.createdAt)}
                        </span>

                        {task.dueDate ? (
                          <span
                            className={`flex items-center gap-1 font-medium px-1.5 py-0.5 rounded ${
                              dueStatus?.isOverdue
                                ? 'bg-red-50 text-red-600 font-bold border border-red-200'
                                : dueStatus?.isToday
                                ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                                : 'text-slate-600 bg-slate-50'
                            }`}
                            title={`Hạn: ${formatTimestamp(task.dueDate)}`}
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            {dueStatus?.text || formatTimestamp(task.dueDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Không có hạn</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {columnTasks.length === 0 && (
                <div className="text-center py-10 px-4 rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-400">
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
