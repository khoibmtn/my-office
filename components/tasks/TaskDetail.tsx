'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, Ban, XCircle, Trash2,
  MoreHorizontal, Play, RefreshCw, Calendar, User,
  Loader2, FileText, Folder, Edit3, History,
  Building, Building2, Users, AlertTriangle, Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskCommentThread } from './TaskCommentThread'
import { TaskActivityFeed } from './TaskActivityFeed'
import { SubtaskList } from './SubtaskList'
import { TaskEditModal } from './TaskEditModal'
import { RecurringScopeModal } from './RecurringScopeModal'
import { computeDerivedStates } from '@/lib/tasks/progress'
import { isValidTransition } from '@/lib/tasks/validation'
import { canEditTask, canChangeStatus, canDeleteTask, canAddComment, canAddSubtask } from '@/lib/tasks/permissions'
import { updateTaskStatus, deleteTask } from '@/lib/tasks/mutations'
import { deleteRecurringTaskScoped, generateNextCompletionOccurrence, type RecurrenceMutationScope } from '@/lib/tasks/series'
import { getTasksByIds } from '@/lib/tasks/dependencies'
import type { Task, TaskComment, TaskActivity, TaskStatus } from '@/types/tasks'
import { TASK_STATUS_LABELS } from '@/lib/tasks/constants'

interface TaskDetailProps {
  task: Task
  comments: TaskComment[]
  activities: TaskActivity[]
  subtasks: Task[]
  actorId: string
  actorName: string
  actorRole: 'admin' | 'staff' | 'guest'
  actorDepartmentIds: string[]
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '—'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function TaskDetail({
  task, comments, activities, subtasks,
  actorId, actorName, actorRole, actorDepartmentIds,
}: TaskDetailProps) {
  const router = useRouter()
  const { getStaffName } = useStaff()
  const { departments } = useDepartments()
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id
  const [actionLoading, setActionLoading] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false)
  const [depTasks, setDepTasks] = useState<Task[]>([])

  useEffect(() => {
    if (task.dependsOnTaskIds?.length) {
      getTasksByIds(task.dependsOnTaskIds).then(setDepTasks).catch(console.error)
    } else {
      setDepTasks([])
    }
  }, [task.dependsOnTaskIds])

  const userCtx = { id: actorId, role: actorRole, departmentIds: actorDepartmentIds }
  const taskCtx = {
    createdBy: task.createdBy,
    assigneeId: task.assigneeId,
    collaboratorIds: task.collaboratorIds,
    followerIds: task.followerIds,
    departmentId: task.departmentId,
    cooperatingDepartmentIds: task.cooperatingDepartmentIds,
  }

  const _canEdit = canEditTask(userCtx, taskCtx)
  const _canStatus = canChangeStatus(userCtx, taskCtx)
  const _canDelete = canDeleteTask(userCtx, taskCtx)
  const _canComment = canAddComment(userCtx, taskCtx)
  const _canSubtask = canAddSubtask(userCtx, taskCtx)

  const derivedStates = computeDerivedStates({
    dueDate: task.dueDate?.toDate ? task.dueDate.toDate() : null,
    isClosed: task.isClosed,
    progress: task.progress,
    visibleFrom: task.visibleFrom?.toDate ? task.visibleFrom.toDate() : null,
  })

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!_canStatus || !isValidTransition(task.status, newStatus)) return
    setActionLoading(true)
    try {
      await updateTaskStatus(task.id, newStatus, actorId, actorName)
      if (newStatus === 'completed' && task.seriesId) {
        try {
          await generateNextCompletionOccurrence(task)
        } catch (genErr) {
          console.warn('Next occurrence trigger warning:', genErr)
        }
      }
    } catch (err) {
      console.error('Status change failed:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!_canDelete) return
    if (task.seriesId) {
      setShowDeleteScopeModal(true)
      return
    }
    if (!confirm('Xóa công việc này?')) return
    setActionLoading(true)
    try {
      await deleteTask(task.id, actorId)
      router.push('/tasks')
    } catch (err) {
      console.error('Delete failed:', err)
      setActionLoading(false)
    }
  }

  const handleDeleteScopeConfirm = async (scope: RecurrenceMutationScope) => {
    setActionLoading(true)
    try {
      await deleteRecurringTaskScoped(task, scope, actorId)
      setShowDeleteScopeModal(false)
      router.push('/tasks')
    } catch (err) {
      console.error('Scoped delete failed:', err)
      setActionLoading(false)
    }
  }

  // Available transitions
  const transitions: { status: TaskStatus; icon: React.ElementType; label: string; color: string }[] = []
  if (isValidTransition(task.status, 'in_progress')) {
    transitions.push({ status: 'in_progress', icon: Play, label: 'Bắt đầu', color: 'bg-blue-500 hover:bg-blue-600 text-white' })
  }
  if (isValidTransition(task.status, 'completed')) {
    transitions.push({ status: 'completed', icon: CheckCircle2, label: 'Hoàn thành', color: 'bg-emerald-500 hover:bg-emerald-600 text-white' })
  }
  if (isValidTransition(task.status, 'blocked')) {
    transitions.push({ status: 'blocked', icon: Ban, label: 'Chặn', color: 'bg-red-500 hover:bg-red-600 text-white' })
  }
  if (isValidTransition(task.status, 'pending')) {
    transitions.push({ status: 'pending', icon: RefreshCw, label: 'Mở lại', color: 'bg-amber-500 hover:bg-amber-600 text-white' })
  }
  if (isValidTransition(task.status, 'cancelled')) {
    transitions.push({ status: 'cancelled', icon: XCircle, label: 'Hủy', color: 'bg-gray-500 hover:bg-gray-600 text-white' })
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/tasks')} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{task.title}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {_canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEditModal(true)}
                className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                Chỉnh sửa
              </Button>
            )}
            {_canDelete && (
              <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Xóa">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <TaskStatusBadge status={task.status} derivedStates={derivedStates} size="md" />
          <TaskPriorityBadge priority={task.priority} size="md" />

          {task.seriesId && (
            <Link
              href="/tasks/recurring"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-purple-600" />
              Chuỗi định kỳ
            </Link>
          )}

          {task.previousTaskId && (
            <button
              type="button"
              onClick={() => router.push(`/tasks/${task.previousTaskId}`)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              title="Xem công việc của kỳ trước"
            >
              <History className="w-3 h-3 text-blue-600" />
              Xem kỳ trước đó
            </button>
          )}

          {_canStatus && transitions.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              {transitions.map(t => (
                <button
                  key={t.status}
                  onClick={() => handleStatusChange(t.status)}
                  disabled={actionLoading}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shadow-2xs ${t.color}`}
                >
                  {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <t.icon className="w-3 h-3" />}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body: split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Info panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 border-r border-slate-100">
          {/* Dependency Alert Banner (when blocked) */}
          {task.status === 'blocked' && task.blockedReason === 'dependency' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-red-800">
                  Công việc đang bị chặn bởi các công việc tiên quyết chưa hoàn thành:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {depTasks.map(dt => (
                    <Link
                      key={dt.id}
                      href={`/tasks/${dt.id}`}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                        dt.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{dt.title}</span>
                      <TaskStatusBadge status={dt.status} size="sm" />
                    </Link>
                  ))}
                </div>
                <p className="text-[10px] text-red-600 mt-1 italic">
                  * Hệ thống sẽ tự động mở khóa công việc này ngay khi tất cả công việc phụ thuộc trên được hoàn thành.
                </p>
              </div>
            </div>
          )}

          {/* Dependency List (when not blocked) */}
          {task.status !== 'blocked' && depTasks.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                Công việc tiên quyết ({depTasks.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {depTasks.map(dt => (
                  <Link
                    key={dt.id}
                    href={`/tasks/${dt.id}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <span className="truncate max-w-[200px]">{dt.title}</span>
                    <TaskStatusBadge status={dt.status} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mô tả</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Meta fields: Giao chính & Phối hợp */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Người xử lý chính</span>
              <div className="flex items-center gap-1.5 text-sm text-slate-800 font-semibold">
                <User className="w-3.5 h-3.5 text-blue-600" />
                {task.assigneeName || (task.assigneeId ? getStaffName(task.assigneeId) : null) || 'Chưa giao'}
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Hạn hoàn thành</span>
              <div className="flex items-center gap-1.5 text-sm text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                {formatDate(task.dueDate)}
              </div>
            </div>

            {/* Người phối hợp */}
            <div className="space-y-1 col-span-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-500" />
                Người phối hợp
              </span>
              {task.collaboratorIds && task.collaboratorIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {task.collaboratorIds.map(id => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                    >
                      <User className="w-3 h-3 text-blue-500" />
                      <span>{getStaffName(id)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Chưa có người phối hợp</div>
              )}
            </div>

            {/* Đơn vị chủ trì & Đơn vị phối hợp */}
            {(task.departmentId || (task.cooperatingDepartmentIds && task.cooperatingDepartmentIds.length > 0)) && (
              <div className="grid grid-cols-2 gap-3 col-span-2 pt-2 border-t border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                    <Building className="w-3 h-3 text-indigo-500" />
                    Đơn vị chủ trì
                  </span>
                  <div className="text-xs text-slate-800 font-medium">
                    {task.departmentId ? getDepartmentName(task.departmentId) : 'Chưa phân đơn vị'}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-500" />
                    Đơn vị phối hợp
                  </span>
                  {task.cooperatingDepartmentIds && task.cooperatingDepartmentIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {task.cooperatingDepartmentIds.map(id => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                        >
                          <span>{getDepartmentName(id)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Không có</div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-0.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Tiến độ</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      task.progress >= 100 ? 'bg-emerald-500' :
                      task.progress >= 50 ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{task.progress}%</span>
              </div>
            </div>
            <div className="space-y-0.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Ngày tạo</span>
              <div className="text-sm text-slate-700">{formatDate(task.createdAt)}</div>
            </div>
          </div>

          {/* Relations: Documents & Dossiers */}
          {(task.dossierIds.length > 0 || task.documentIds.length > 0) && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Văn bản & Hồ sơ liên quan</h3>
              <div className="space-y-1.5">
                {task.documentIds.map(id => (
                  <button
                    key={id}
                    onClick={() => router.push(`/documents?docId=${id}`)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-100 hover:bg-blue-100/70 transition-colors group"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-blue-700 font-medium truncate group-hover:underline">
                      Văn bản #{id.slice(-6)}
                    </span>
                  </button>
                ))}
                {task.dossierIds.map(id => (
                  <button
                    key={id}
                    onClick={() => router.push(`/dossiers?id=${id}`)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-100 hover:bg-amber-100/70 transition-colors group"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700 font-medium truncate group-hover:underline">
                      Hồ sơ #{id.slice(-6)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Việc con</h3>
            <SubtaskList
              parentTaskId={task.id}
              subtasks={subtasks}
              actorId={actorId}
              actorName={actorName}
              canEdit={_canSubtask}
            />
          </div>

          {/* Activity Feed */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hoạt động</h3>
            <TaskActivityFeed activities={activities} />
          </div>
        </div>

        {/* Right: Comment thread */}
        <div className="w-[320px] shrink-0 flex flex-col bg-slate-50 lg:w-[360px]">
          <div className="px-3 py-2 border-b border-slate-200 shrink-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trao đổi</h3>
          </div>
          <TaskCommentThread
            taskId={task.id}
            comments={comments}
            actorId={actorId}
            actorName={actorName}
            canComment={_canComment}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <TaskEditModal
          task={task}
          actorId={actorId}
          actorName={actorName}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Delete Scope Modal */}
      {showDeleteScopeModal && (
        <RecurringScopeModal
          isOpen={showDeleteScopeModal}
          action="delete"
          taskTitle={task.title}
          onClose={() => setShowDeleteScopeModal(false)}
          onConfirm={handleDeleteScopeConfirm}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
