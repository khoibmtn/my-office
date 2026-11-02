'use client'

import React, { useState, useMemo } from 'react'
import {
  Users, Building, Flag, CheckCircle2, Calendar,
  FolderPlus, Trash2, X, Loader2, AlertTriangle,
} from 'lucide-react'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { useDossiers } from '@/hooks/useDossiers'
import { useRole } from '@/hooks/useRole'
import { useOrganization } from '@/hooks/useOrganization'
import { buildTaskActorContext, canAssignTask } from '@/lib/tasks/permissions'
import { bulkUpdateTasks, bulkDeleteTasks, type BulkTaskUpdates } from '@/lib/tasks/mutations'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS } from '@/lib/tasks/constants'
import type { TaskPriority, TaskStatus } from '@/types/tasks'

interface TaskBulkActionsProps {
  selectedIds: string[]
  onClearSelection: () => void
  onSuccess?: () => void
}

export function TaskBulkActions({
  selectedIds,
  onClearSelection,
  onSuccess,
}: TaskBulkActionsProps) {
  const { staff } = useStaff()
  const { departments } = useDepartments()
  const { dossiers } = useDossiers()
  const { staffId, staffName, isAdmin, role } = useRole()
  const { hasPermission, currentStaff } = useOrganization()

  const [loading, setLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<
    'assignee' | 'department' | 'priority' | 'status' | 'deadline' | 'dossier' | 'delete' | null
  >(null)

  // Form values
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('normal')
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>('in_progress')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedDossier, setSelectedDossier] = useState('')

  const actorCtx = useMemo(
    () =>
      buildTaskActorContext({
        staffId,
        staffName,
        isAdmin,
        role,
        currentStaff,
        hasPermission,
      }),
    [staffId, staffName, isAdmin, role, currentStaff, hasPermission]
  )
  const { id: actorId, name: actor, role: actorRole, departmentIds: actorDepartmentIds, matrixPerms } = actorCtx

  const _canAssign = canAssignTask(
    actorCtx.userCtx,
    undefined,
    matrixPerms
  )

  if (selectedIds.length === 0 && !resultMessage) return null

  const handleApplyUpdate = async (updates: BulkTaskUpdates) => {
    setLoading(true)
    setResultMessage(null)
    try {
      const res = await bulkUpdateTasks(selectedIds, updates, actorId, actor, {
        role: actorRole,
        departmentIds: actorDepartmentIds,
        matrixPerms,
      })
      setActiveAction(null)
      if (res.skipped.length > 0) {
        const reasons = Array.from(new Set(res.skipped.map(s => s.reason))).join('; ')
        setResultMessage(`Đã cập nhật ${res.updated}, bỏ qua ${res.skipped.length} (${reasons})`)
      } else {
        setResultMessage(`Đã cập nhật ${res.updated}, bỏ qua 0`)
      }
      onClearSelection()
      onSuccess?.()
    } catch (err: any) {
      console.error('Bulk update error:', err)
      setResultMessage(err?.message || 'Có lỗi xảy ra khi thao tác hàng loạt')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.length} công việc đã chọn?`)) return
    setLoading(true)
    setResultMessage(null)
    try {
      await bulkDeleteTasks(selectedIds, actorId, actor)
      setActiveAction(null)
      onClearSelection()
      onSuccess?.()
    } catch (err) {
      console.error('Bulk delete error:', err)
      alert('Có lỗi xảy ra khi xóa hàng loạt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 flex flex-col items-center gap-2">
      {resultMessage && (
        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{resultMessage}</span>
          <button
            type="button"
            onClick={() => setResultMessage(null)}
            className="p-0.5 text-slate-400 hover:text-white rounded"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 max-w-[95vw] overflow-x-auto">
          {/* Count Badge */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700 whitespace-nowrap">
            <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-medium text-slate-200">công việc</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            {/* Assignee — only visible if user has task:assign permission */}
            {_canAssign && (
              <button
                onClick={() => setActiveAction(activeAction === 'assignee' ? null : 'assignee')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  activeAction === 'assignee' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Người xử lý</span>
              </button>
            )}

            {/* Department */}
            <button
              onClick={() => setActiveAction(activeAction === 'department' ? null : 'department')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeAction === 'department' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-indigo-400" />
              <span>Phòng ban</span>
            </button>

            {/* Priority */}
            <button
              onClick={() => setActiveAction(activeAction === 'priority' ? null : 'priority')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeAction === 'priority' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              <span>Ưu tiên</span>
            </button>

            {/* Status */}
            <button
              onClick={() => setActiveAction(activeAction === 'status' ? null : 'status')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeAction === 'status' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trạng thái</span>
            </button>

            {/* Deadline */}
            <button
              onClick={() => setActiveAction(activeAction === 'deadline' ? null : 'deadline')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeAction === 'deadline' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>Hạn chót</span>
            </button>

            {/* Dossier */}
            <button
              onClick={() => setActiveAction(activeAction === 'dossier' ? null : 'dossier')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeAction === 'dossier' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Hồ sơ</span>
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          </div>

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            title="Bỏ chọn tất cả"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Popover Action Menus */}
      {selectedIds.length > 0 && activeAction && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-3 min-w-[280px] z-50 animate-in fade-in zoom-in-95 duration-150">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center rounded-xl z-10">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          )}

          {/* Assignee Selector */}
          {activeAction === 'assignee' && _canAssign && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Chọn người xử lý mới:</p>
              <select
                value={selectedAssignee}
                onChange={e => setSelectedAssignee(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chưa giao --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName || s.shortName || s.title || s.email}</option>
                ))}
              </select>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const st = staff.find(s => s.id === selectedAssignee)
                    handleApplyUpdate({
                      assigneeId: selectedAssignee || null,
                      assigneeName: st?.shortName || st?.fullName || st?.title || null,
                      assigneeDepartmentId: st?.primaryDepartmentId ?? null,
                    })
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}

          {/* Department Selector */}
          {activeAction === 'department' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Chuyển sang phòng ban:</p>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Không phân phòng ban --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyUpdate({ departmentId: selectedDept || null })}
                  className="px-3 py-1 text-xs bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}

          {/* Priority Selector */}
          {activeAction === 'priority' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Đổi mức ưu tiên:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleApplyUpdate({ priority: p })}
                    className="px-2.5 py-1.5 text-xs text-left font-medium border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{TASK_PRIORITY_DOTS[p]}</span>
                      <span>{TASK_PRIORITY_LABELS[p]}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status Selector */}
          {activeAction === 'status' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Đổi trạng thái:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['pending', 'in_progress', 'completed', 'cancelled'] as TaskStatus[]).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleApplyUpdate({ status: st })}
                    className="px-2.5 py-1.5 text-xs text-left font-medium border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>{TASK_STATUS_LABELS[st]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deadline Selector */}
          {activeAction === 'deadline' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Chọn hạn hoàn thành mới:</p>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const due = selectedDate ? new Date(selectedDate) : null
                    handleApplyUpdate({ dueDate: due })
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}

          {/* Dossier Selector */}
          {activeAction === 'dossier' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Thêm vào hồ sơ:</p>
              <select
                value={selectedDossier}
                onChange={e => setSelectedDossier(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chọn hồ sơ công việc --</option>
                {dossiers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!selectedDossier}
                  onClick={() => handleApplyUpdate({ addDossierId: selectedDossier })}
                  className="px-3 py-1 text-xs bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Thêm vào
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
