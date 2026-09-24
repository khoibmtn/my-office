'use client'

import React, { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import {
  ArrowLeft,
  Loader2,
  UserCheck,
  Users,
  Building,
  Building2,
  FileText,
  Folder,
  Link2,
  Settings2,
  StickyNote,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Tag,
  ClipboardList,
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

/* ── Reusable section card ── */
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

/* ── Document Picker with search, columns: Hồ sơ | Tên văn bản ── */
function DocumentPickerPanel({
  documents,
  dossiers,
  selectedIds,
  onChange,
}: {
  documents: Document[]
  dossiers: Dossier[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const listRef = React.useRef<HTMLDivElement>(null)

  // Get level-1 dossier name for a document
  const getLevel1Dossier = useCallback((doc: Document) => {
    if (!doc.dossierIds?.length) return null
    for (const did of doc.dossierIds) {
      const dos = dossiers.find(d => d.id === did)
      if (!dos) continue
      if (dos.level === 1) return dos.name
      if (dos.parentId) {
        const parent = dossiers.find(d => d.id === dos.parentId)
        if (parent?.level === 1) return parent.name
        if (parent?.parentId) {
          const grandparent = dossiers.find(d => d.id === parent.parentId)
          if (grandparent?.level === 1) return grandparent.name
        }
      }
    }
    return null
  }, [dossiers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return documents
    return documents.filter(d => {
      const title = (d.title || '').toLowerCase()
      const docNum = (d.docNumber || '').toLowerCase()
      return title.includes(q) || docNum.includes(q)
    })
  }, [documents, search])

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    )
  }

  const scrollToDoc = (id: string) => {
    if (!listRef.current) return
    const row = listRef.current.querySelector(`[data-doc-id="${id}"]`)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.classList.add('ring-2', 'ring-blue-400')
      setTimeout(() => row.classList.remove('ring-2', 'ring-blue-400'), 1200)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Selected tags — full title, click to scroll */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-1">
          {selectedIds.map(id => {
            const d = documents.find(doc => doc.id === id)
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors group"
                onClick={() => scrollToDoc(id)}
                title="Bấm để cuộn đến văn bản này"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 min-w-0 leading-snug">{d?.title || d?.docNumber || id.slice(-6)}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(id) }}
                  className="p-0.5 text-blue-400 hover:text-red-500 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm văn bản theo tiêu đề, mã hiệu..."
          className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Document list with columns */}
      <div ref={listRef} className="border border-slate-200 rounded-lg max-h-[240px] overflow-y-auto bg-white">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-3 text-center">Không tìm thấy văn bản nào</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8 px-2 py-1.5"></th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500 uppercase w-[120px]">Hồ sơ</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Tên văn bản</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const isChecked = selectedIds.includes(doc.id)
                const dossierName = getLevel1Dossier(doc)
                return (
                  <tr
                    key={doc.id}
                    data-doc-id={doc.id}
                    onClick={() => toggle(doc.id)}
                    className={`cursor-pointer transition-all rounded ${isChecked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(doc.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                      {dossierName ? (
                        <span className="inline-flex items-center gap-1">
                          <Folder className="w-3 h-3 text-amber-500" />
                          <span className="max-w-[100px] truncate">{dossierName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700 break-words leading-snug">
                      {doc.title || doc.docNumber || <span className="text-slate-400 italic">Không tiêu đề</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ── Dossier Tree Picker ── */
function DossierTreePicker({
  dossiers,
  selectedIds,
  onChange,
}: {
  dossiers: Dossier[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  // Build tree structure
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

    // Sort
    const sortFn = (a: Dossier, b: Dossier) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
    roots.sort(sortFn)
    for (const [, children] of childrenMap) children.sort(sortFn)

    return { roots, childrenMap }
  }, [dossiers])

  const filteredRoots = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return tree.roots
    // Show roots that match or have matching children
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
          style={{ paddingLeft: `${12 + depth * 24}px`, paddingRight: '8px' }}
        >
          {/* Expand toggle — always reserve space */}
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

          {/* Checkbox — each item is independent */}
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleCheck(dossier.id)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
          />

          {/* Icon + name */}
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

        {/* Children */}
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
      {/* Selected tags */}
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

      {/* Search */}
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

      {/* Tree */}
      <div className="border border-slate-200 rounded-lg max-h-[220px] overflow-y-auto bg-white py-1">
        {filteredRoots.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-3 text-center">Không có hồ sơ nào</p>
        ) : (
          filteredRoots.map(root => renderNode(root, 0))
        )}
      </div>
    </div>
  )
}


function NewTaskContent() {
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

  // Form state
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
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [selectedDossierIds, setSelectedDossierIds] = useState<string[]>([])
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showTemplateSuggestions, setShowTemplateSuggestions] = useState(false)

  // Templates matching title text
  const matchingTemplates = useMemo(() => {
    if (!title.trim() || templates.length === 0) return []
    const q = title.toLowerCase().trim()
    return templates.filter(tpl => tpl.name.toLowerCase().includes(q))
  }, [title, templates])

  // Close suggestions on click outside
  useEffect(() => {
    if (!showTemplateSuggestions) return
    const handler = () => setShowTemplateSuggestions(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showTemplateSuggestions])

  const markDirty = useCallback(() => { if (!isDirty) setIsDirty(true) }, [isDirty])

  // Unsaved changes warning
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleNavigateBack = useCallback(() => {
    if (isDirty) {
      const choice = confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời trang không?\n\nBấm OK để rời trang (mất thay đổi).\nBấm Cancel để ở lại.')
      if (!choice) return
    }
    router.back()
  }, [isDirty, router])

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
    markDirty()
  }

  const handleAssigneeChange = (id: string) => {
    setAssigneeId(id)
    if (id && collaboratorIds.includes(id)) {
      setCollaboratorIds(collaboratorIds.filter(cid => cid !== id))
    }
    markDirty()
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
    markDirty()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    // Validation
    if (!title.trim()) {
      setError('Vui lòng nhập Tiêu đề công việc.')
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

      const taskId = await createTask(input, staffId || 'unknown', staffName || 'Unknown')

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
          }, staffId || 'unknown', staffName || 'Unknown')
        }
      }

      setIsDirty(false)
      router.push(`/tasks/${taskId}`)
    } catch (err) {
      console.error('Failed to create task:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  /* ── Card: Basic Info ── */
  const cardInfo = (
    <SectionCard icon={ClipboardList} iconColor="text-blue-500" title="Thông tin công việc">
      <div className="flex flex-col gap-1 relative">
        <Label className="text-xs font-medium text-slate-600">
          Tiêu đề <span className="text-red-400">*</span>
        </Label>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); markDirty(); setShowTemplateSuggestions(true) }}
          onFocus={() => { if (title.trim() && matchingTemplates.length > 0) setShowTemplateSuggestions(true) }}
          placeholder="Nhập tiêu đề công việc..."
          className="h-9 text-xs"
          required
          autoFocus
          autoComplete="off"
        />
        {/* Template autocomplete dropdown */}
        {showTemplateSuggestions && matchingTemplates.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">📋 Mẫu quy trình phù hợp</span>
            </div>
            {matchingTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => { handleSelectTemplate(tpl); setShowTemplateSuggestions(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
              >
                <span className="font-medium text-slate-700 truncate">{tpl.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">{tpl.steps?.length || 0} bước</span>
              </button>
            ))}
          </div>
        )}
        {/* Selected template badge */}
        {selectedTemplateId && (() => {
          const tpl = templates.find(t => t.id === selectedTemplateId)
          return tpl ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                📋 {tpl.name} ({tpl.steps?.length || 0} bước)
                <button type="button" onClick={() => setSelectedTemplateId(null)} className="ml-0.5 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          ) : null
        })()}
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-slate-600">Mô tả</Label>
        <Textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty() }}
          placeholder="Mô tả chi tiết..."
          className="min-h-[72px] text-xs resize-y leading-relaxed"
        />
      </div>
    </SectionCard>
  )

  /* ── Card: Priority & Schedule ── */
  const cardSchedule = (
    <SectionCard icon={Settings2} iconColor="text-emerald-500" title="Ưu tiên & Thời hạn">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium text-slate-600">Mức ưu tiên</Label>
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value as TaskPriority); markDirty() }}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-700"
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{TASK_PRIORITY_DOTS[key as TaskPriority]} {label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium text-slate-600">Hạn hoàn thành</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); markDirty() }}
            className="h-9 text-xs px-2"
          />
        </div>
      </div>
    </SectionCard>
  )

  /* ── Card: Assignment ── */
  const cardAssignment = (
    <SectionCard icon={UserCheck} iconColor="text-indigo-500" title="Phân công" className="relative z-30">
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-slate-600">Người xử lý chính</Label>
        <select
          value={assigneeId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
        >
          <option value="">-- Chưa giao --</option>
          {activeStaff.map(s => (
            <option key={s.id} value={s.id}>{s.shortName} — {s.fullName}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-slate-600">
          Người phối hợp <span className="text-slate-400 font-normal text-[11px]">(Nhiều người, cùng theo dõi)</span>
        </Label>
        <CoAssigneePicker
          allStaff={staffList}
          mainAssigneeId={assigneeId}
          value={collaboratorIds}
          onChange={(ids) => { setCollaboratorIds(ids); markDirty() }}
          placeholder="Tìm và gắp người phối hợp..."
        />
      </div>

      {/* Department */}
      {departments.length > 0 && (
        <>
          <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-1">
            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-indigo-500" />
              Đơn vị chủ trì
            </Label>
            <select
              value={departmentId}
              onChange={(e) => {
                const newDept = e.target.value
                setDepartmentId(newDept)
                if (newDept && cooperatingDepartmentIds.includes(newDept)) {
                  setCooperatingDepartmentIds(cooperatingDepartmentIds.filter(id => id !== newDept))
                }
                markDirty()
              }}
              className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="">Không chọn phòng ban</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              Đơn vị phối hợp <span className="text-slate-400 font-normal text-[11px]">(Nhiều phòng ban)</span>
            </Label>
            <CoDepartmentPicker
              departments={departments}
              mainDepartmentId={departmentId}
              value={cooperatingDepartmentIds}
              onChange={(ids) => { setCooperatingDepartmentIds(ids); markDirty() }}
              placeholder="Tìm và chọn các đơn vị phối hợp..."
            />
          </div>
        </>
      )}
    </SectionCard>
  )

  /* ── Card: Linked Documents (searchable checkbox list) ── */
  const cardDocuments = (
    <SectionCard icon={FileText} iconColor="text-blue-500" title="Văn bản liên quan">
      {documents.length > 0 ? (
        <DocumentPickerPanel
          documents={documents}
          dossiers={dossiers}
          selectedIds={selectedDocIds}
          onChange={(ids) => { setSelectedDocIds(ids); markDirty() }}
        />
      ) : (
        <p className="text-xs text-slate-400 italic">Chưa có văn bản nào</p>
      )}
    </SectionCard>
  )

  /* ── Card: Linked Dossiers (tree view) ── */
  const cardDossiers = (
    <SectionCard icon={Folder} iconColor="text-amber-500" title="Hồ sơ liên quan">
      {dossiers.length > 0 ? (
        <DossierTreePicker
          dossiers={dossiers}
          selectedIds={selectedDossierIds}
          onChange={(ids) => { setSelectedDossierIds(ids); markDirty() }}
        />
      ) : (
        <p className="text-xs text-slate-400 italic">Chưa có hồ sơ nào</p>
      )}
    </SectionCard>
  )

  /* ── Card: Dependencies ── */
  /* ── Dependencies: Searchable checkbox list ── */
  const [depSearch, setDepSearch] = useState('')
  const depListRef = React.useRef<HTMLDivElement>(null)

  const topLevelTasks = useMemo(() => existingTasks.filter(t => !t.parentTaskId), [existingTasks])

  const filteredDeps = useMemo(() => {
    const q = depSearch.toLowerCase().trim()
    if (!q) return topLevelTasks
    return topLevelTasks.filter(t => t.title.toLowerCase().includes(q))
  }, [topLevelTasks, depSearch])

  const toggleDep = (id: string) => {
    setDependsOnTaskIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
    markDirty()
  }

  const scrollToDep = (id: string) => {
    if (!depListRef.current) return
    const row = depListRef.current.querySelector(`[data-task-id="${id}"]`)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.classList.add('ring-2', 'ring-violet-400')
      setTimeout(() => row.classList.remove('ring-2', 'ring-violet-400'), 1200)
    }
  }

  const cardDependencies = (
    <SectionCard icon={Link2} iconColor="text-violet-500" title="Công việc tiên quyết">
      <p className="text-[11px] text-slate-400 -mt-1">
        Việc này sẽ bị chặn cho đến khi việc tiên quyết hoàn thành
      </p>
      {topLevelTasks.length > 0 ? (
        <div className="flex flex-col gap-2">
          {/* Selected tags — full title, click to scroll */}
          {dependsOnTaskIds.length > 0 && (
            <div className="flex flex-col gap-1">
              {dependsOnTaskIds.map(id => {
                const t = topLevelTasks.find(item => item.id === id)
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 cursor-pointer hover:bg-violet-100 transition-colors group"
                    onClick={() => scrollToDep(id)}
                    title="Bấm để cuộn đến công việc này"
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 min-w-0 leading-snug">{t?.title || id.slice(-6)}</span>
                    {t && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t.status === 'completed' ? 'Đã xong' : 'Chưa xong'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleDep(id) }}
                      className="p-0.5 text-violet-400 hover:text-red-500 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={depSearch}
              onChange={(e) => setDepSearch(e.target.value)}
              placeholder="Tìm công việc theo tiêu đề..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            {depSearch && (
              <button type="button" onClick={() => setDepSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Task list */}
          <div ref={depListRef} className="border border-slate-200 rounded-lg max-h-[200px] overflow-y-auto bg-white">
            {filteredDeps.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 text-center">Không tìm thấy công việc nào</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDeps.map(t => {
                  const isChecked = dependsOnTaskIds.includes(t.id)
                  return (
                    <div
                      key={t.id}
                      data-task-id={t.id}
                      onClick={() => toggleDep(t.id)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all ${isChecked ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDep(t.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-slate-700 flex-1 min-w-0 leading-snug">{t.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.status === 'completed' ? 'Đã xong' : 'Chưa xong'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Chưa có công việc nào khác</p>
      )}
    </SectionCard>
  )

  /* ── Card: Tags ── */
  const cardTags = tags.length > 0 ? (
    <SectionCard icon={Tag} iconColor="text-pink-500" title="Nhãn">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
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
  ) : null

  return (
    <div className="mx-auto py-5 px-4 sm:px-6 max-w-5xl">
      {/* ── Page Header ── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <button
            type="button"
            onClick={handleNavigateBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-1.5 group cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Quay lại danh sách
          </button>
          <h1 className="text-lg font-bold text-slate-900">Tạo công việc mới</h1>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNavigateBack}
            className="h-8 px-3 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="h-8 px-4 text-xs font-semibold shadow-xs"
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

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 mb-4">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      {/* ── Cards Layout ── */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4 min-w-0">
          {cardInfo}
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          {cardSchedule}
          {cardAssignment}
          {cardTags}
        </div>
        {/* Văn bản liên quan: full-width */}
        <div className="md:col-span-2">
          {cardDocuments}
        </div>
        {/* Hồ sơ + Công việc tiên quyết: side by side */}
        <div className="min-w-0">
          {cardDossiers}
        </div>
        <div className="min-w-0">
          {cardDependencies}
        </div>

        {/* ── Sticky Bottom Action Bar ── */}
        <div className="md:col-span-2 flex justify-end items-center gap-2.5 pt-3 pb-3 sticky bottom-0 bg-slate-50/95 backdrop-blur-xs border-t border-slate-200/80 -mx-4 px-4 sm:-mx-6 sm:px-6 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNavigateBack}
            className="h-8 px-3 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="h-8 px-4 text-xs font-semibold shadow-xs"
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
      </form>
    </div>
  )
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={null}>
      <NewTaskContent />
    </Suspense>
  )
}
