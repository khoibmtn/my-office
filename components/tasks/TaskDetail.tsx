'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Timestamp } from 'firebase/firestore'
import {
  ArrowLeft, CheckCircle2, Ban, XCircle, Trash2,
  Play, RefreshCw, Calendar, User, Loader2,
  FileText, Folder, History, Building, Building2,
  Users, AlertTriangle, Link2, Paperclip, ExternalLink,
  Download, Copy, Check, Plus, X, ChevronDown, ChevronUp,
  Clock, Edit2, CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { useOrganization } from '@/hooks/useOrganization'
import { useDocuments } from '@/hooks/useDocuments'
import { useDossiers } from '@/hooks/useDossiers'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskCommentThread } from './TaskCommentThread'
import { TaskActivityFeed } from './TaskActivityFeed'
import { SubtaskList } from './SubtaskList'
import { DocumentPickerPanel } from './DocumentPickerPanel'
import { DossierTreePicker } from './TaskCreateForm'
import { CoAssigneePicker } from '@/components/documents/CoAssigneePicker'
import { CoDepartmentPicker } from '@/components/tasks/CoDepartmentPicker'
import { RecurringScopeModal } from './RecurringScopeModal'
import { computeDerivedStates } from '@/lib/tasks/progress'
import { isValidTransition } from '@/lib/tasks/validation'
import { canEditTask, canChangeStatus, canDeleteTask, canAddComment, canAddSubtask } from '@/lib/tasks/permissions'
import { updateTaskStatus, deleteTask, updateTask } from '@/lib/tasks/mutations'
import { deleteRecurringTaskScoped, updateRecurringTaskScoped, generateNextCompletionOccurrence, type RecurrenceMutationScope } from '@/lib/tasks/series'
import { getTasksByIds } from '@/lib/tasks/dependencies'
import type { Task, TaskComment, TaskActivity, TaskStatus, TaskPriority, UpdateTaskInput } from '@/types/tasks'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS } from '@/lib/tasks/constants'

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

function toInputDate(val: any): string {
  if (!val) return ''
  try {
    const d = val.toDate ? val.toDate() : new Date((val.seconds ?? 0) * 1000)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

interface LinkedFileItem {
  id: string
  docId: string
  docTitle: string
  docNumber?: string
  title: string
  url: string
  isAttachment: boolean
  mimeType?: string
}

export function TaskDetail({
  task, comments, activities, subtasks,
  actorId, actorName, actorRole, actorDepartmentIds,
}: TaskDetailProps) {
  const router = useRouter()
  const { staff: staffList, getStaffName } = useStaff()
  const { departments } = useDepartments()
  const { documents } = useDocuments()
  const { dossiers } = useDossiers()

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id

  // Action / Scope state
  const [actionLoading, setActionLoading] = useState(false)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false)
  const [showEditScopeModal, setShowEditScopeModal] = useState(false)
  const [pendingScopeFields, setPendingScopeFields] = useState<Partial<UpdateTaskInput> | null>(null)
  const [depTasks, setDepTasks] = useState<Task[]>([])

  // Local inline form states
  const [title, setTitle] = useState(task.title || '')
  const [description, setDescription] = useState(task.description || '')
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null)

  // Toggle pickers directly on the page
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [showDossierPicker, setShowDossierPicker] = useState(false)
  const [showCoAssigneePicker, setShowCoAssigneePicker] = useState(false)
  const [showCoDeptPicker, setShowCoDeptPicker] = useState(false)

  // Sync title & description when task updates from Firestore
  useEffect(() => {
    setTitle(task.title || '')
  }, [task.title])

  useEffect(() => {
    if (!isEditingDesc) {
      setDescription(task.description || '')
    }
  }, [task.description, isEditingDesc])

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

  const { hasPermission } = useOrganization()
  const matrixPerms: Partial<Record<string, boolean>> = {
    'task:edit_own': hasPermission('task:edit_own'),
    'task:edit_all': hasPermission('task:edit_all'),
    'task:delete_own': hasPermission('task:delete_own'),
    'task:delete_all': hasPermission('task:delete_all'),
  }

  const _canEdit = canEditTask(userCtx, taskCtx, matrixPerms)
  const _canStatus = canChangeStatus(userCtx, taskCtx)
  const _canDelete = canDeleteTask(userCtx, taskCtx, matrixPerms)
  const _canComment = canAddComment(userCtx, taskCtx)
  const _canSubtask = canAddSubtask(userCtx, taskCtx)

  const derivedStates = computeDerivedStates({
    dueDate: task.dueDate?.toDate ? task.dueDate.toDate() : null,
    isClosed: task.isClosed,
    progress: task.progress,
    visibleFrom: task.visibleFrom?.toDate ? task.visibleFrom.toDate() : null,
  })

  // Core Mutation Handler with Recurring Series Scope Support
  const handleUpdateFields = async (fields: Partial<UpdateTaskInput>) => {
    if (!_canEdit) return

    // If recurring series task, ask for scope
    if (task.seriesId) {
      setPendingScopeFields(fields)
      setShowEditScopeModal(true)
      return
    }

    setInlineSaving(true)
    try {
      await updateTask(task.id, fields, actorId, actorName)
    } catch (err) {
      console.error('Update failed:', err)
    } finally {
      setInlineSaving(false)
    }
  }

  const handleEditScopeConfirm = async (scope: RecurrenceMutationScope) => {
    if (!pendingScopeFields) return
    setInlineSaving(true)
    try {
      await updateRecurringTaskScoped(task, scope, pendingScopeFields, actorId, actorName)
      setShowEditScopeModal(false)
      setPendingScopeFields(null)
    } catch (err) {
      console.error('Scoped edit failed:', err)
    } finally {
      setInlineSaving(false)
    }
  }

  const handleTitleBlur = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(task.title || '')
      return
    }
    if (trimmed !== task.title) {
      handleUpdateFields({ title: trimmed })
    }
  }

  const handleSaveDescription = () => {
    const trimmed = description.trim()
    setIsEditingDesc(false)
    if (trimmed !== (task.description || '')) {
      handleUpdateFields({ description: trimmed || null })
    }
  }

  const handleCancelDescription = () => {
    setDescription(task.description || '')
    setIsEditingDesc(false)
  }

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

  // Linked files extracted from linked documents
  const linkedFiles: LinkedFileItem[] = useMemo(() => {
    if (!task.documentIds?.length || !documents?.length) return []
    const files: LinkedFileItem[] = []

    for (const docId of task.documentIds) {
      const doc = documents.find(d => d.id === docId)
      if (!doc) continue

      // Main document file
      const mainUrl = doc.driveViewUrl || doc.originalLink
      if (mainUrl) {
        files.push({
          id: `main-${doc.id}`,
          docId: doc.id,
          docTitle: doc.title || doc.docNumber || 'Văn bản',
          docNumber: doc.docNumber,
          title: doc.title || doc.docNumber || 'Văn bản chính',
          url: mainUrl,
          isAttachment: false,
          mimeType: doc.mimeType,
        })
      }

      // Attachments
      if (doc.attachments?.length) {
        for (const att of doc.attachments) {
          const attUrl = att.driveViewUrl || att.originalLink
          if (attUrl) {
            files.push({
              id: att.id || `att-${doc.id}-${files.length}`,
              docId: doc.id,
              docTitle: doc.title || doc.docNumber || 'Văn bản',
              docNumber: doc.docNumber,
              title: att.title || 'Tập tin đính kèm',
              url: attUrl,
              isAttachment: true,
              mimeType: att.mimeType,
            })
          }
        }
      }
    }

    return files
  }, [task.documentIds, documents])

  const handleCopyFileLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedFileId(id)
      setTimeout(() => setCopiedFileId(null), 2000)
    } catch (err) {
      console.error('Failed to copy file link:', err)
    }
  }

  // Transitions
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
      {/* ── Top Header ── */}
      <div className="border-b border-slate-200 px-4 py-3 shrink-0 bg-white">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/tasks')}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Inline Editable Title */}
          <div className="flex-1 min-w-0">
            {_canEdit ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className="text-base sm:text-lg font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded-md px-2 py-0.5 w-full outline-none transition-all placeholder:text-slate-300"
                placeholder="Nhập tiêu đề công việc..."
                title="Bấm để sửa tiêu đề trực tiếp"
              />
            ) : (
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate px-2 py-0.5">{task.title}</h1>
            )}
          </div>

          {/* Saving Indicator & Delete */}
          <div className="flex items-center gap-2">
            {inlineSaving && (
              <span className="text-xs text-blue-600 flex items-center gap-1 font-medium animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang lưu…
              </span>
            )}
            {_canDelete && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                title="Xóa công việc"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status + Priority + Actions Row */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <TaskStatusBadge status={task.status} derivedStates={derivedStates} size="md" />

          {/* Inline Priority Selector */}
          {_canEdit ? (
            <div className="relative inline-flex items-center">
              <select
                value={task.priority || 'normal'}
                onChange={(e) => handleUpdateFields({ priority: e.target.value as TaskPriority })}
                className="text-xs font-semibold rounded-lg pl-2 pr-6 py-1 border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors shadow-2xs appearance-none"
                title="Đổi mức độ ưu tiên"
              >
                <option value="low">Ưu tiên Thấp</option>
                <option value="normal">Ưu tiên Bình thường</option>
                <option value="high">Ưu tiên Cao</option>
                <option value="urgent">Ưu tiên Khẩn cấp</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
            </div>
          ) : (
            <TaskPriorityBadge priority={task.priority} size="md" />
          )}

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

          {/* Status Transitions */}
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

      {/* ── Main Split View ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Info panel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 border-r border-slate-100">
          {/* Dependency Alert Banner */}
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

          {/* ── Section: Description (Click to Edit) ── */}
          <div className="group">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mô tả</h3>
              {_canEdit && !isEditingDesc && (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="w-3 h-3" /> Sửa mô tả
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả chi tiết công việc..."
                  rows={4}
                  className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 leading-relaxed transition-all"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelDescription}
                    className="h-7 px-3 text-xs"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveDescription}
                    className="h-7 px-3 text-xs font-semibold"
                  >
                    Lưu mô tả
                  </Button>
                </div>
              </div>
            ) : task.description ? (
              <div
                onClick={() => _canEdit && setIsEditingDesc(true)}
                className={`text-xs text-slate-700 whitespace-pre-wrap leading-relaxed rounded-lg p-2.5 -mx-2.5 transition-colors ${
                  _canEdit ? 'hover:bg-slate-50 cursor-pointer' : ''
                }`}
                title={_canEdit ? 'Bấm để sửa mô tả' : undefined}
              >
                {task.description}
              </div>
            ) : _canEdit ? (
              <button
                type="button"
                onClick={() => setIsEditingDesc(true)}
                className="w-full text-left py-2 px-3 rounded-lg border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-xs text-slate-400 hover:text-blue-600 transition-colors"
              >
                + Bấm vào đây để thêm mô tả công việc…
              </button>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa có mô tả</p>
            )}
          </div>

          {/* ── Section: Attributes & Meta Grid ── */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Thông tin phân công & Thời hạn
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Người xử lý chính */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3 text-blue-600" /> Người xử lý chính
                </span>
                {_canEdit ? (
                  <select
                    value={task.assigneeId || ''}
                    onChange={(e) => {
                      const newId = e.target.value
                      const chosen = activeStaff.find(s => s.id === newId || (s as any).staffId === newId)
                      handleUpdateFields({
                        assigneeId: newId || null,
                        assigneeName: chosen ? (chosen.shortName || chosen.fullName) : null,
                      })
                    }}
                    className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">— Chưa giao —</option>
                    {activeStaff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.shortName || s.fullName} ({s.position || s.title || 'Nhân viên'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold px-1 py-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {task.assigneeName || (task.assigneeId ? getStaffName(task.assigneeId) : null) || 'Chưa giao'}
                  </div>
                )}
              </div>

              {/* Hạn hoàn thành */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-500" /> Hạn hoàn thành
                </span>
                {_canEdit ? (
                  <input
                    type="date"
                    value={toInputDate(task.dueDate)}
                    onChange={(e) => {
                      const val = e.target.value
                      const newTs = val ? Timestamp.fromDate(new Date(val + 'T23:59:59')) : null
                      handleUpdateFields({ dueDate: newTs as any })
                    }}
                    className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 px-1 py-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    {formatDate(task.dueDate)}
                  </div>
                )}
              </div>

              {/* Người phối hợp */}
              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" /> Người phối hợp
                  </span>
                  {_canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowCoAssigneePicker(!showCoAssigneePicker)}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
                    >
                      {showCoAssigneePicker ? 'Ẩn bộ chọn' : '+ Chỉnh sửa người phối hợp'}
                    </button>
                  )}
                </div>

                {showCoAssigneePicker && _canEdit ? (
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs">
                    <CoAssigneePicker
                      allStaff={activeStaff}
                      mainAssigneeId={task.assigneeId || undefined}
                      value={task.collaboratorIds || []}
                      onChange={(newIds) => handleUpdateFields({ collaboratorIds: newIds })}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {task.collaboratorIds && task.collaboratorIds.length > 0 ? (
                      task.collaboratorIds.map(id => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                        >
                          <User className="w-3 h-3 text-blue-500" />
                          <span>{getStaffName(id)}</span>
                          {_canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                const newIds = (task.collaboratorIds || []).filter(cId => cId !== id)
                                handleUpdateFields({ collaboratorIds: newIds })
                              }}
                              className="ml-1 hover:text-red-500"
                              title="Bỏ người phối hợp này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 italic">Chưa có người phối hợp</div>
                    )}
                  </div>
                )}
              </div>

              {/* Đơn vị chủ trì & Phối hợp */}
              <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-200/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Đơn vị chủ trì */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Building className="w-3 h-3 text-indigo-500" /> Đơn vị chủ trì
                    </span>
                    {_canEdit ? (
                      <select
                        value={task.departmentId || ''}
                        onChange={(e) => handleUpdateFields({ departmentId: e.target.value || null })}
                        className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">— Chưa phân đơn vị —</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-slate-800 font-medium px-1 py-1">
                        {task.departmentId ? getDepartmentName(task.departmentId) : 'Chưa phân đơn vị'}
                      </div>
                    )}
                  </div>

                  {/* Đơn vị phối hợp */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-indigo-500" /> Đơn vị phối hợp
                      </span>
                      {_canEdit && (
                        <button
                          type="button"
                          onClick={() => setShowCoDeptPicker(!showCoDeptPicker)}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                        >
                          {showCoDeptPicker ? 'Ẩn' : '+ Chỉnh sửa'}
                        </button>
                      )}
                    </div>

                    {showCoDeptPicker && _canEdit ? (
                      <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-xs">
                        <CoDepartmentPicker
                          departments={departments}
                          mainDepartmentId={task.departmentId || null}
                          value={task.cooperatingDepartmentIds || []}
                          onChange={(newIds) => handleUpdateFields({ cooperatingDepartmentIds: newIds })}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {task.cooperatingDepartmentIds && task.cooperatingDepartmentIds.length > 0 ? (
                          task.cooperatingDepartmentIds.map(id => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              <span>{getDepartmentName(id)}</span>
                              {_canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (task.cooperatingDepartmentIds || []).filter(cId => cId !== id)
                                    handleUpdateFields({ cooperatingDepartmentIds: next })
                                  }}
                                  className="ml-1 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">Không có</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tiến độ & Ngày tạo */}
              <div className="space-y-1 pt-2 border-t border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tiến độ</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        task.progress >= 100 ? 'bg-emerald-500' :
                        task.progress >= 50 ? 'bg-blue-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{task.progress}%</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ngày tạo</span>
                <div className="text-xs text-slate-700 font-medium">{formatDate(task.createdAt)}</div>
              </div>
            </div>
          </div>

          {/* ── Section: Linked Documents Files Widget ── */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-indigo-600" />
                Tập tin từ văn bản liên quan ({linkedFiles.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Tự động tổng hợp từ văn bản gắn kèm
              </span>
            </div>

            {linkedFiles.length > 0 ? (
              <div className="space-y-2">
                {linkedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className={`w-4 h-4 shrink-0 ${file.isAttachment ? 'text-amber-500' : 'text-blue-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-800 truncate max-w-sm sm:max-w-md" title={file.title}>
                            {file.title}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            file.isAttachment
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {file.isAttachment ? 'Đính kèm' : 'VB chính'}
                          </span>
                        </div>
                        {file.docNumber && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            Thuộc văn bản: <span className="text-slate-600 font-medium">{file.docNumber}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Xem tập tin trong tab mới"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Mở xem</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleCopyFileLink(file.id, file.url)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                        title="Sao chép liên kết tập tin"
                      >
                        {copiedFileId === file.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold text-[11px]">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Copy link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                <Paperclip className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-slate-400" />
                <p className="text-xs">Chưa có tập tin nào.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Các tập tin chính và đính kèm sẽ tự động hiển thị ở đây khi bạn liên kết văn bản bên dưới.
                </p>
              </div>
            )}
          </div>

          {/* ── Section: Linked Documents (with inline DocumentPickerPanel) ── */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Văn bản liên quan ({task.documentIds?.length || 0})
              </h3>
              {_canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDocPicker(!showDocPicker)}
                  className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  {showDocPicker ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                      Thu gọn bộ chọn
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Chọn văn bản liên kết
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* List of currently linked documents */}
            {task.documentIds && task.documentIds.length > 0 ? (
              <div className="space-y-1.5 mb-3">
                {task.documentIds.map(docId => {
                  const doc = documents.find(d => d.id === docId)
                  return (
                    <div
                      key={docId}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-50/40 border border-blue-100 hover:bg-blue-50 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/documents?docId=${docId}`)}
                        className="flex items-center gap-2 min-w-0 text-left flex-1 group"
                        title="Bấm để xem chi tiết văn bản"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-blue-700 font-semibold group-hover:underline truncate block">
                            {doc?.docNumber ? `[${doc.docNumber}] ` : ''}
                            {doc?.title || `Văn bản #${docId.slice(-6)}`}
                          </span>
                          {(doc?.sender || doc?.issueDate) && (
                            <span className="text-[10px] text-slate-500">
                              {doc.sender && <span className="font-semibold text-red-600">{doc.sender} </span>}
                              {doc.issueDate && <span>ngày {formatDate(doc.issueDate)}</span>}
                            </span>
                          )}
                        </div>
                      </button>

                      {_canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextIds = (task.documentIds || []).filter(id => id !== docId)
                            handleUpdateFields({ documentIds: nextIds })
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                          title="Hủy liên kết văn bản này"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : !showDocPicker && (
              <p className="text-xs text-slate-400 italic py-2">Chưa có văn bản liên quan nào được gắn.</p>
            )}

            {/* Inline DocumentPickerPanel */}
            {showDocPicker && _canEdit && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-700">Chọn văn bản từ kho lưu trữ:</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDocPicker(false)}
                    className="h-6 px-2 text-[11px] text-slate-500"
                  >
                    Xong
                  </Button>
                </div>
                <DocumentPickerPanel
                  documents={documents}
                  dossiers={dossiers}
                  selectedIds={task.documentIds || []}
                  onChange={(newIds) => handleUpdateFields({ documentIds: newIds })}
                />
              </div>
            )}
          </div>

          {/* ── Section: Linked Dossiers (with inline DossierTreePicker) ── */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-500" />
                Hồ sơ liên quan ({task.dossierIds?.length || 0})
              </h3>
              {_canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDossierPicker(!showDossierPicker)}
                  className="h-7 px-2.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  {showDossierPicker ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                      Thu gọn
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Chọn hồ sơ
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* List of currently linked dossiers */}
            {task.dossierIds && task.dossierIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {task.dossierIds.map(dossierId => {
                  const dossier = dossiers.find(d => d.id === dossierId)
                  return (
                    <span
                      key={dossierId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs"
                    >
                      <Folder className="w-3 h-3 text-amber-600" />
                      <button
                        type="button"
                        onClick={() => router.push(`/dossiers?id=${dossierId}`)}
                        className="hover:underline font-medium"
                      >
                        {dossier?.name || `Hồ sơ #${dossierId.slice(-6)}`}
                      </button>
                      {_canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextIds = (task.dossierIds || []).filter(id => id !== dossierId)
                            handleUpdateFields({ dossierIds: nextIds })
                          }}
                          className="ml-1 hover:text-red-500"
                          title="Bỏ liên kết hồ sơ này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            ) : !showDossierPicker && (
              <p className="text-xs text-slate-400 italic py-2">Chưa có hồ sơ liên quan nào.</p>
            )}

            {/* Inline DossierTreePicker */}
            {showDossierPicker && _canEdit && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <DossierTreePicker
                  dossiers={dossiers}
                  selectedIds={task.dossierIds || []}
                  onChange={(newIds) => handleUpdateFields({ dossierIds: newIds })}
                  maxHeight="240px"
                />
              </div>
            )}
          </div>

          {/* ── Section: Subtasks ── */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              Việc con ({subtasks.length})
            </h3>
            <SubtaskList
              parentTaskId={task.id}
              subtasks={subtasks}
              actorId={actorId}
              actorName={actorName}
              canEdit={_canSubtask}
            />
          </div>

          {/* ── Section: Activity Feed ── */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Nhật ký hoạt động
            </h3>
            <TaskActivityFeed activities={activities} />
          </div>
        </div>

        {/* Right Column: Comment thread */}
        <div className="w-[320px] shrink-0 flex flex-col bg-slate-50 lg:w-[360px]">
          <div className="px-3 py-2 border-b border-slate-200 shrink-0 bg-white">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Trao đổi nội bộ</h3>
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

      {/* Edit Scope Modal for recurring tasks */}
      {showEditScopeModal && pendingScopeFields && (
        <RecurringScopeModal
          isOpen={showEditScopeModal}
          action="edit"
          taskTitle={task.title}
          onClose={() => {
            setShowEditScopeModal(false)
            setPendingScopeFields(null)
          }}
          onConfirm={handleEditScopeConfirm}
          loading={inlineSaving}
        />
      )}
    </div>
  )
}
