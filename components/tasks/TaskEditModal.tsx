"use client"

import React, { useState, useMemo } from "react"
import { Timestamp } from "firebase/firestore"
import { X, Loader2, Save, UserCheck, Users, Building, Building2, FileText, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStaff } from "@/hooks/useStaff"
import { useDepartments } from "@/hooks/useDepartments"
import { useTags } from "@/hooks/useTags"
import { useDocuments } from "@/hooks/useDocuments"
import { useDossiers } from "@/hooks/useDossiers"
import { CoAssigneePicker } from "@/components/documents/CoAssigneePicker"
import { CoDepartmentPicker } from "@/components/tasks/CoDepartmentPicker"
import { updateTask } from "@/lib/tasks/mutations"
import { updateRecurringTaskScoped, type RecurrenceMutationScope } from "@/lib/tasks/series"
import { RecurringScopeModal } from "./RecurringScopeModal"
import type { Task, TaskPriority } from "@/types/tasks"
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS } from "@/lib/tasks/constants"

interface TaskEditModalProps {
  task: Task
  actorId: string
  actorName: string
  onClose: () => void
  onSuccess?: () => void
}

export function TaskEditModal({ task, actorId, actorName, onClose, onSuccess }: TaskEditModalProps) {
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const { tags } = useTags()
  const { documents } = useDocuments()
  const { dossiers } = useDossiers()

  const [title, setTitle] = useState(task.title || "")
  const [description, setDescription] = useState(task.description || "")
  const [priority, setPriority] = useState<TaskPriority>(task.priority || "normal")
  const [dueDate, setDueDate] = useState(() => {
    if (!task.dueDate) return ""
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date((task.dueDate as any).seconds * 1000)
    return d.toISOString().split("T")[0]
  })
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "")
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(task.collaboratorIds || [])
  const [departmentId, setDepartmentId] = useState(task.departmentId || "")
  const [cooperatingDepartmentIds, setCooperatingDepartmentIds] = useState<string[]>(task.cooperatingDepartmentIds || [])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(task.tagIds || [])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(task.documentIds || [])
  const [selectedDossierIds, setSelectedDossierIds] = useState<string[]>(task.dossierIds || [])
  const [saving, setSaving] = useState(false)
  const [showScopeModal, setShowScopeModal] = useState(false)
  const [pendingFields, setPendingFields] = useState<any>(null)

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const prepareFields = () => {
    const chosenStaff = activeStaff.find(s => s.id === assigneeId || (s as any).staffId === assigneeId)
    const fields: any = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigneeId: assigneeId || null,
      assigneeName: chosenStaff ? (chosenStaff.shortName || chosenStaff.fullName) : null,
      collaboratorIds,
      departmentId: departmentId || null,
      cooperatingDepartmentIds,
      tagIds: selectedTagIds,
      documentIds: selectedDocIds,
      dossierIds: selectedDossierIds,
    }

    if (dueDate) {
      fields.dueDate = Timestamp.fromDate(new Date(dueDate + "T23:59:59"))
    } else {
      fields.dueDate = null
    }

    return fields
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return

    const fields = prepareFields()

    // If task belongs to a recurring series, prompt for Google Calendar scope
    if (task.seriesId) {
      setPendingFields(fields)
      setShowScopeModal(true)
      return
    }

    setSaving(true)
    try {
      await updateTask(task.id, fields, actorId, actorName)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error("Failed to update task:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleScopeConfirm = async (scope: RecurrenceMutationScope) => {
    if (!pendingFields) return
    setSaving(true)
    try {
      await updateRecurringTaskScoped(task, scope, pendingFields, actorId, actorName)
      setShowScopeModal(false)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error("Failed to update scoped recurring task:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-800">Chỉnh sửa công việc</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề công việc..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết công việc..."
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mức ưu tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{TASK_PRIORITY_DOTS[key as TaskPriority]} {label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn hoàn thành</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              />
            </div>
          </div>

          {/* Assignment & Department: Giao chính & Phối hợp (Parity with Documents) */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
            {/* Staff Assignment */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                  Người xử lý chính
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => {
                    const newId = e.target.value
                    setAssigneeId(newId)
                    if (newId && collaboratorIds.includes(newId)) {
                      setCollaboratorIds(collaboratorIds.filter(id => id !== newId))
                    }
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">Chưa giao</option>
                  {activeStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.shortName} — {s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  Người phối hợp <span className="text-[11px] text-slate-400 font-normal">(Nhiều người, cùng theo dõi và xử lý)</span>
                </label>
                <CoAssigneePicker
                  allStaff={staffList}
                  mainAssigneeId={assigneeId}
                  value={collaboratorIds}
                  onChange={setCollaboratorIds}
                  placeholder="Tìm và gắp người phối hợp..."
                />
              </div>
            </div>

            {/* Department Assignment */}
            {departments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-indigo-500" />
                    Đơn vị chủ trì
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      const newDept = e.target.value
                      setDepartmentId(newDept)
                      if (newDept && cooperatingDepartmentIds.includes(newDept)) {
                        setCooperatingDepartmentIds(cooperatingDepartmentIds.filter(id => id !== newDept))
                      }
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">Không chọn phòng ban</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    Đơn vị phối hợp <span className="text-[11px] text-slate-400 font-normal">(Nhiều phòng ban cùng tham gia)</span>
                  </label>
                  <CoDepartmentPicker
                    departments={departments}
                    mainDepartmentId={departmentId}
                    value={cooperatingDepartmentIds}
                    onChange={setCooperatingDepartmentIds}
                    placeholder="Tìm và chọn các đơn vị phối hợp..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Document & Dossier links */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                Văn bản liên quan
              </label>
              <select
                onChange={e => {
                  const v = e.target.value
                  if (v && !selectedDocIds.includes(v)) setSelectedDocIds([...selectedDocIds, v])
                  e.target.value = ''
                }}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none bg-white"
              >
                <option value="">+ Chọn văn bản...</option>
                {documents.filter(d => !selectedDocIds.includes(d.id)).map(d => (
                  <option key={d.id} value={d.id}>{d.title || d.docNumber || d.id}</option>
                ))}
              </select>
              {selectedDocIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedDocIds.map(id => {
                    const d = documents.find(doc => doc.id === id)
                    return (
                      <span key={id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <FileText className="w-2.5 h-2.5" />
                        {d?.title || id.slice(-6)}
                        <button type="button" onClick={() => setSelectedDocIds(selectedDocIds.filter(i => i !== id))} className="hover:text-red-500">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                Hồ sơ liên quan
              </label>
              <select
                onChange={e => {
                  const v = e.target.value
                  if (v && !selectedDossierIds.includes(v)) setSelectedDossierIds([...selectedDossierIds, v])
                  e.target.value = ''
                }}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none bg-white"
              >
                <option value="">+ Chọn hồ sơ...</option>
                {dossiers.filter(d => !selectedDossierIds.includes(d.id)).map(d => (
                  <option key={d.id} value={d.id}>{d?.name}</option>
                ))}
              </select>
              {selectedDossierIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedDossierIds.map(id => {
                    const d = dossiers.find(dos => dos.id === id)
                    return (
                      <span key={id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Folder className="w-2.5 h-2.5" />
                        {d?.name || id.slice(-6)}
                        <button type="button" onClick={() => setSelectedDossierIds(selectedDossierIds.filter(i => i !== id))} className="hover:text-red-500">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>

      {showScopeModal && (
        <RecurringScopeModal
          isOpen={showScopeModal}
          action="edit"
          taskTitle={task.title}
          onClose={() => setShowScopeModal(false)}
          onConfirm={handleScopeConfirm}
          loading={saving}
        />
      )}
    </div>
  )
}
