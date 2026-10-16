'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import {
  ArrowLeft,
  Loader2,
  Building,
  Building2,
  FileText,
  Folder,
  Link2,
  Settings2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Tag,
  ClipboardList,
  CheckSquare,
  Plus,
  Trash2,
  ChevronUp,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { useTags } from '@/hooks/useTags'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { useTasks } from '@/hooks/useTasks'
import { CoAssigneePicker } from '@/components/documents/CoAssigneePicker'
import { CoDepartmentPicker } from '@/components/tasks/CoDepartmentPicker'
import { useDocuments } from '@/hooks/useDocuments'
import { useDossiers } from '@/hooks/useDossiers'
import { useRole } from '@/hooks/useRole'
import { createTask } from '@/lib/tasks/mutations'
import type { TaskPriority, TaskTemplate } from '@/types/tasks'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS } from '@/lib/tasks/constants'
import type { Dossier, Document } from '@/types'
import { DocumentPickerPanel } from './DocumentPickerPanel'

/* ── Section Card ── */
function SectionCard({
  icon: Icon,
  iconColor,
  title,
  children,
  className = '',
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-xs ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
        <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {children}
      </div>
    </section>
  )
}

/* ── Dossier Tree Picker ── */
export function DossierTreePicker({
  dossiers,
  selectedIds,
  onChange,
  maxHeight = '220px',
}: {
  dossiers: Dossier[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxHeight?: string
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const tree = useMemo(() => {
    const activeDossiers = dossiers.filter(d => !d.isArchived && !d.deletedAt)
    const childrenMap = new Map<string, Dossier[]>()
    const roots: Dossier[] = []

    for (const d of activeDossiers) {
      if (!d.parentId) {
        roots.push(d)
      } else {
        const existing = childrenMap.get(d.parentId) || []
        existing.push(d)
        childrenMap.set(d.parentId, existing)
      }
    }

    const sortFn = (a: Dossier, b: Dossier) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
    roots.sort(sortFn)
    for (const [, children] of childrenMap) children.sort(sortFn)

    return { roots, childrenMap }
  }, [dossiers])

  const filteredRoots = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return tree.roots
    return tree.roots.filter(root => {
      if (root.name.toLowerCase().includes(q)) return true
      const children = tree.childrenMap.get(root.id) || []
      return children.some(c => c.name.toLowerCase().includes(q))
    })
  }, [tree, search])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCheck = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    )
  }

  const renderNode = (dossier: Dossier, depth: number = 0) => {
    const children = tree.childrenMap.get(dossier.id) || []
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(dossier.id)
    const isChecked = selectedIds.includes(dossier.id)
    const q = search.toLowerCase().trim()
    const filteredChildren = q
      ? children.filter(c => c.name.toLowerCase().includes(q))
      : children

    return (
      <div key={dossier.id}>
        <div
          className={`flex items-center gap-1.5 py-1.5 rounded-md cursor-pointer transition-colors ${
            isChecked ? 'bg-amber-50' : 'hover:bg-slate-50'
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '8px' }}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleExpand(dossier.id) }}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : null}
          </div>

          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleCheck(dossier.id)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
          />

          <div
            className="flex items-center gap-1.5 min-w-0 flex-1"
            onClick={() => hasChildren ? toggleExpand(dossier.id) : toggleCheck(dossier.id)}
          >
            <Folder className={`w-3.5 h-3.5 shrink-0 ${depth === 0 ? 'text-amber-500' : 'text-amber-400'}`} />
            <span className={`text-xs truncate ${depth === 0 ? 'font-medium text-slate-700' : 'text-slate-600'}`}>
              {dossier.name}
            </span>
            {hasChildren && (
              <span className="text-[10px] text-slate-400 shrink-0">({children.length})</span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {filteredChildren.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map(id => {
            const d = dossiers.find(dos => dos.id === id)
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Folder className="w-3 h-3" />
                <span className="max-w-[150px] truncate">{d?.name || id.slice(-6)}</span>
                <button type="button" onClick={() => toggleCheck(id)} className="ml-0.5 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm hồ sơ..."
          className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div style={{ maxHeight }} className="border border-slate-200 rounded-lg overflow-y-auto bg-white py-1">
        {filteredRoots.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-3 text-center">Không có hồ sơ nào</p>
        ) : (
          filteredRoots.map(root => renderNode(root, 0))
        )}
      </div>
    </div>
  )
}

export interface TaskCreateFormProps {
  initialData?: {
    title?: string
    description?: string
    priority?: TaskPriority
    dueDate?: string
    assigneeId?: string
    collaboratorIds?: string[]
    departmentId?: string
    cooperatingDepartmentIds?: string[]
    dossierIds?: string[]
    documentIds?: string[]
    tagIds?: string[]
    subtasks?: string[]
  }
  isDrawer?: boolean
  onSuccess?: (taskId: string) => void
  onCancel?: () => void
  titleText?: string
}

export function TaskCreateForm({
  initialData,
  isDrawer = false,
  onSuccess,
  onCancel,
  titleText = 'Tạo công việc mới',
}: TaskCreateFormProps) {
  const router = useRouter()
  const { staffId, staffName } = useRole()
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const { tags } = useTags()
  const { templates } = useTaskTemplates()
  const { documents } = useDocuments()
  const { dossiers } = useDossiers()
  const { tasks: existingTasks } = useTasks({ view: 'all' })

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  // Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority || 'normal')
  const [dueDate, setDueDate] = useState(initialData?.dueDate || '')
  const [startDate, setStartDate] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [assigneeId, setAssigneeId] = useState(initialData?.assigneeId || '')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(initialData?.collaboratorIds || [])
  const [departmentId, setDepartmentId] = useState(initialData?.departmentId || '')
  const [cooperatingDepartmentIds, setCooperatingDepartmentIds] = useState<string[]>(initialData?.cooperatingDepartmentIds || [])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialData?.tagIds || [])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(initialData?.documentIds || [])
  const [selectedDossierIds, setSelectedDossierIds] = useState<string[]>(initialData?.dossierIds || [])
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<string[]>([])

  // Subtasks checklist state
  const [subtasks, setSubtasks] = useState<{ id: string; title: string }[]>(() => {
    return (initialData?.subtasks || []).map((t, i) => ({ id: `init-${i}`, title: t }))
  })
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newSubtaskTitle.trim()) return
    setSubtasks(prev => [...prev, { id: `temp-${Date.now()}-${Math.random()}`, title: newSubtaskTitle.trim() }])
    setNewSubtaskTitle('')
  }

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }

  const handleMoveSubtask = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= subtasks.length) return
    const reordered = [...subtasks]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    setSubtasks(reordered)
  }

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

    if (tpl.steps?.length) {
      setSubtasks(tpl.steps.map((st, i) => ({ id: `tpl-${i}`, title: st.title })))
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề công việc')
      return
    }

    setSaving(true)
    setError(null)

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
        source: initialData?.documentIds?.length ? 'document' : 'manual',
      }

      if (dueDate) {
        input.dueDate = Timestamp.fromDate(new Date(dueDate + 'T23:59:59'))
      }
      if (startDate) {
        input.startDate = Timestamp.fromDate(new Date(startDate + 'T00:00:00'))
      }
      if (estimatedMinutes && !isNaN(Number(estimatedMinutes))) {
        input.estimatedMinutes = Number(estimatedMinutes)
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

      const taskId = await createTask(input, staffId || 'unknown', staffName || 'Admin')

      // Create pre-created subtasks
      if (subtasks.length > 0) {
        for (let i = 0; i < subtasks.length; i++) {
          await createTask({
            title: subtasks[i].title,
            parentTaskId: taskId,
            priority,
            sortOrder: i,
            dossierIds: selectedDossierIds.length > 0 ? selectedDossierIds : undefined,
            documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          }, staffId || 'unknown', staffName || 'Admin')
        }
      }

      if (onSuccess) {
        onSuccess(taskId)
      } else {
        router.push(`/tasks/${taskId}`)
      }
    } catch (err: any) {
      console.error('Failed to create task:', err)
      setError(err?.message || 'Có lỗi xảy ra khi tạo công việc')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) onCancel()
    else router.push('/tasks')
  }

  return (
    <div className={isDrawer ? 'p-4 space-y-4' : 'mx-auto py-5 px-4 sm:px-6 max-w-5xl'}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          {!isDrawer && (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-1.5 group cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Quay lại danh sách
            </button>
          )}
          <h1 className="text-base sm:text-lg font-bold text-slate-900">{titleText}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="h-8 px-3 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="h-8 px-4 text-xs font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang tạo…
              </span>
            ) : (
              'Tạo công việc'
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Templates Bar */}
      {templates.length > 0 && (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
            Mẫu công việc gợi ý
          </span>
          <div className="flex flex-wrap gap-2">
            {templates.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                  selectedTemplateId === tpl.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form sections */}
      <form onSubmit={handleSubmit} className={isDrawer ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {/* Basic Info */}
        <SectionCard icon={ClipboardList} iconColor="text-blue-500" title="Thông tin cơ bản">
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1 block">
              Tiêu đề <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề công việc..."
              className="text-xs h-9"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1 block">Mô tả chi tiết</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập nội dung, chỉ đạo chi tiết..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Mức ưu tiên</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs h-9 border border-slate-200 rounded-md px-2.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {TASK_PRIORITY_DOTS[k as TaskPriority]} {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Hạn hoàn thành</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>
        </SectionCard>

        {/* Assignment */}
        <SectionCard icon={Building} iconColor="text-indigo-500" title="Phân công thực hiện">
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1 block">Người xử lý chính</Label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full text-xs h-9 border border-slate-200 rounded-md px-2.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Chọn người xử lý chính --</option>
              {activeStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.shortName}) {s.title ? `— ${s.title}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1 block">Người phối hợp</Label>
            <CoAssigneePicker
              allStaff={activeStaff}
              mainAssigneeId={assigneeId}
              value={collaboratorIds}
              onChange={setCollaboratorIds}
              placeholder="Chọn các nhân sự phối hợp..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Đơn vị chủ trì</Label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full text-xs h-9 border border-slate-200 rounded-md px-2.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chọn đơn vị chủ trì --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Đơn vị phối hợp</Label>
              <CoDepartmentPicker
                departments={departments}
                mainDepartmentId={departmentId}
                value={cooperatingDepartmentIds}
                onChange={setCooperatingDepartmentIds}
              />
            </div>
          </div>
        </SectionCard>

        {/* Subtasks (Checklist) */}
        <SectionCard
          icon={CheckSquare}
          iconColor="text-emerald-500"
          title={`Việc con (${subtasks.length})`}
          className={isDrawer ? '' : 'md:col-span-2'}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubtask()
                  }
                }}
                placeholder="+ Nhập tên việc con cần làm rồi nhấn Enter..."
                className="text-xs h-9 flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleAddSubtask()}
                disabled={!newSubtaskTitle.trim()}
                className="h-9 px-3 text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm
              </Button>
            </div>

            {subtasks.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50 max-h-48 overflow-y-auto">
                {subtasks.map((st, index) => (
                  <div key={st.id} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 group">
                    <span className="text-[11px] font-bold text-slate-400 w-5 shrink-0">#{index + 1}</span>
                    <input
                      type="text"
                      value={st.title}
                      onChange={(e) => {
                        const val = e.target.value
                        setSubtasks(prev => prev.map((s, i) => i === index ? { ...s, title: val } : s))
                      }}
                      className="flex-1 min-w-0 text-xs text-slate-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                    />
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveSubtask(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Di chuyển lên"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSubtask(index, 'down')}
                        disabled={index === subtasks.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Di chuyển xuống"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(st.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Xóa việc con"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Linked Documents */}
        <SectionCard
          icon={FileText}
          iconColor="text-blue-500"
          title={`Văn bản liên quan (${selectedDocIds.length})`}
          className={isDrawer ? '' : 'md:col-span-2'}
        >
          <DocumentPickerPanel
            documents={documents}
            dossiers={dossiers}
            selectedIds={selectedDocIds}
            onChange={setSelectedDocIds}
            maxHeight={isDrawer ? '200px' : '240px'}
          />
        </SectionCard>

        {/* Dossiers & Dependencies */}
        <SectionCard icon={Folder} iconColor="text-amber-500" title={`Hồ sơ liên quan (${selectedDossierIds.length})`}>
          <DossierTreePicker
            dossiers={dossiers}
            selectedIds={selectedDossierIds}
            onChange={setSelectedDossierIds}
            maxHeight="200px"
          />
        </SectionCard>

        <SectionCard icon={Link2} iconColor="text-violet-500" title="Công việc tiên quyết">
          {existingTasks.length > 0 ? (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {existingTasks.slice(0, 15).map(t => {
                const isChecked = dependsOnTaskIds.includes(t.id)
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setDependsOnTaskIds(prev =>
                        prev.includes(t.id) ? prev.filter(i => i !== t.id) : [...prev, t.id]
                      )
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                      isChecked ? 'bg-violet-50 border-violet-200' : 'hover:bg-slate-50 border-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="w-3.5 h-3.5 rounded text-violet-600 border-slate-300 pointer-events-none"
                    />
                    <span className="flex-1 truncate text-slate-700">{t.title}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Chưa có công việc nào khác</p>
          )}
        </SectionCard>

        {/* Tags */}
        {tags.length > 0 && (
          <SectionCard icon={Tag} iconColor="text-pink-500" title="Nhãn" className={isDrawer ? '' : 'md:col-span-2'}>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setSelectedTagIds(prev =>
                      prev.includes(tag.id) ? prev.filter(i => i !== tag.id) : [...prev, tag.id]
                    )
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    selectedTagIds.includes(tag.id)
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Bottom submit row */}
        <div className={(isDrawer ? '' : 'md:col-span-2 ') + 'flex justify-end gap-2 pt-3 border-t border-slate-200'}>
          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Hủy
          </Button>
          <Button type="submit" size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : 'Tạo công việc'}
          </Button>
        </div>
      </form>
    </div>
  )
}
