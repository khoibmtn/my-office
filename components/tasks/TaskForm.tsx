'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { X, Loader2, UserCheck, Users, Building, Building2, FileText, Folder, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { useTags } from '@/hooks/useTags'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { useTasks } from '@/hooks/useTasks'
import { CoAssigneePicker } from '@/components/documents/CoAssigneePicker'
import { CoDepartmentPicker } from '@/components/tasks/CoDepartmentPicker'
import { useDocuments } from '@/hooks/useDocuments'
import { useDossiers } from '@/hooks/useDossiers'
import { createTask } from '@/lib/tasks/mutations'
import type { TaskPriority, TaskTemplate } from '@/types/tasks'
import { TASK_PRIORITY_LABELS } from '@/lib/tasks/constants'

interface TaskFormProps {
  actorId: string
  actorName: string
  onClose?: () => void
  /** Pre-fill dossier */
  dossierId?: string
  /** Pre-fill document */
  documentId?: string
}

export function TaskForm({ actorId, actorName, onClose, dossierId, documentId }: TaskFormProps) {
  const router = useRouter()
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const { tags } = useTags()
  const { templates } = useTaskTemplates()
  const { documents } = useDocuments()
  const { dossiers } = useDossiers()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [cooperatingDepartmentIds, setCooperatingDepartmentIds] = useState<string[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(documentId ? [documentId] : [])
  const [selectedDossierIds, setSelectedDossierIds] = useState<string[]>(dossierId ? [dossierId] : [])
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const { tasks: existingTasks } = useTasks({ view: 'all' })

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const handleSelectTemplate = (tpl: TaskTemplate) => {
    if (selectedTemplateId === tpl.id) {
      setSelectedTemplateId(null)
      return
    }
    setSelectedTemplateId(tpl.id)
    setTitle(tpl.name)
    if (tpl.description) setDescription(tpl.description)
    if (tpl.defaults?.priority) setPriority(tpl.defaults.priority)
    if (tpl.defaults?.departmentId) setDepartmentId(tpl.defaults.departmentId)
    if (tpl.defaults?.tagIds?.length) setSelectedTagIds(tpl.defaults.tagIds)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      const chosenStaff = activeStaff.find(s => s.id === assigneeId || (s as any).staffId === assigneeId)
      const input: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        assigneeName: chosenStaff?.shortName || chosenStaff?.fullName || undefined,
        collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : undefined,
        departmentId: departmentId || undefined,
        cooperatingDepartmentIds: cooperatingDepartmentIds.length > 0 ? cooperatingDepartmentIds : undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        dossierIds: selectedDossierIds.length > 0 ? selectedDossierIds : undefined,
        documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      }

      if (dependsOnTaskIds.length > 0) {
        input.dependsOnTaskIds = dependsOnTaskIds
        const uncompletedDeps = existingTasks.filter(
          t => dependsOnTaskIds.includes(t.id) && t.status !== 'completed'
        )
        if (uncompletedDeps.length > 0) {
          input.status = 'blocked'
          input.blockedReason = 'dependency'
          input.blockedByTaskIds = uncompletedDeps.map(t => t.id)
        }
      }

      if (dueDate) {
        input.dueDate = Timestamp.fromDate(new Date(dueDate + 'T23:59:59'))
      }

      const taskId = await createTask(input, actorId, actorName)

      // If template had steps, create them as subtasks
      const activeTpl = templates.find(t => t.id === selectedTemplateId)
      if (activeTpl && activeTpl.steps?.length) {
        for (const st of activeTpl.steps) {
          await createTask({
            title: st.title,
            description: st.description || undefined,
            parentTaskId: taskId,
            priority,
            dossierIds: selectedDossierIds.length > 0 ? selectedDossierIds : undefined,
            documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          }, actorId, actorName)
        }
      }

      router.push(`/tasks/${taskId}`)
      onClose?.()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Tạo công việc mới</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Template picker */}
      {templates.length > 0 && (
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
            📋 Mẫu quy trình (tự động điền &amp; sinh việc con):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedTemplateId === tpl.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tpl.name} ({tpl.steps?.length || 0} bước)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tiêu đề <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nhập tiêu đề công việc..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          required
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả chi tiết..."
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </div>

      {/* Row: Priority + Due Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mức ưu tiên</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hạn hoàn thành</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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

      {/* Linked Documents */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-blue-500" />
          Văn bản liên quan
        </label>
        {documents.length > 0 ? (
          <select
            onChange={e => {
              const v = e.target.value
              if (v && !selectedDocIds.includes(v)) setSelectedDocIds([...selectedDocIds, v])
              e.target.value = ''
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">+ Chọn văn bản liên kết...</option>
            {documents.filter(d => !selectedDocIds.includes(d.id)).map(d => (
              <option key={d.id} value={d.id}>{d.title || d.docNumber || d.id}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có văn bản nào</p>
        )}
        {selectedDocIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {selectedDocIds.map(id => {
              const d = documents.find(doc => doc.id === id)
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <FileText className="w-3 h-3" />
                  {d?.title || d?.docNumber || id.slice(-6)}
                  <button type="button" onClick={() => setSelectedDocIds(selectedDocIds.filter(i => i !== id))} className="ml-0.5 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Linked Dossiers */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
          <Folder className="w-3.5 h-3.5 text-amber-500" />
          Hồ sơ liên quan
        </label>
        {dossiers.length > 0 ? (
          <select
            onChange={e => {
              const v = e.target.value
              if (v && !selectedDossierIds.includes(v)) setSelectedDossierIds([...selectedDossierIds, v])
              e.target.value = ''
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">+ Chọn hồ sơ liên kết...</option>
            {dossiers.filter(d => !selectedDossierIds.includes(d.id)).map(d => (
              <option key={d.id} value={d.id}>{d?.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có hồ sơ nào</p>
        )}
        {selectedDossierIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {selectedDossierIds.map(id => {
              const d = dossiers.find(dos => dos.id === id)
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Folder className="w-3 h-3" />
                  {d?.name || id.slice(-6)}
                  <button type="button" onClick={() => setSelectedDossierIds(selectedDossierIds.filter(i => i !== id))} className="ml-0.5 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Prerequisite / Dependency Tasks */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
          <Link2 className="w-3.5 h-3.5 text-indigo-500" />
          Công việc tiên quyết (Phụ thuộc)
          <span className="text-[11px] text-slate-400 font-normal">(Việc này sẽ bị chặn cho đến khi việc tiên quyết hoàn thành)</span>
        </label>
        {existingTasks.length > 0 ? (
          <select
            onChange={e => {
              const v = e.target.value
              if (v && !dependsOnTaskIds.includes(v)) setDependsOnTaskIds([...dependsOnTaskIds, v])
              e.target.value = ''
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">+ Chọn công việc tiên quyết...</option>
            {existingTasks.filter(t => !dependsOnTaskIds.includes(t.id)).map(t => (
              <option key={t.id} value={t.id}>
                {t.title} {t.status === 'completed' ? '— [Đã xong]' : '— [Chưa xong]'}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có công việc nào khác</p>
        )}
        {dependsOnTaskIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {dependsOnTaskIds.map(id => {
              const t = existingTasks.find(item => item.id === id)
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Link2 className="w-3 h-3" />
                  {t?.title || id.slice(-6)}
                  <button type="button" onClick={() => setDependsOnTaskIds(dependsOnTaskIds.filter(i => i !== id))} className="ml-0.5 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nhãn</label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-2">
        {onClose && (
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!title.trim() || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Tạo công việc
        </Button>
      </div>
    </form>
  )
}
