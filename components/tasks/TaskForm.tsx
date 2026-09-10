'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { useTags } from '@/hooks/useTags'
import { createTask } from '@/lib/tasks/mutations'
import type { TaskPriority } from '@/types/tasks'
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

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      const input: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        departmentId: departmentId || undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        dossierIds: dossierId ? [dossierId] : undefined,
        documentIds: documentId ? [documentId] : undefined,
      }

      if (dueDate) {
        input.dueDate = Timestamp.fromDate(new Date(dueDate + 'T23:59:59'))
      }

      const taskId = await createTask(input, actorId, actorName)
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

      {/* Row: Assignee + Department */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Người xử lý</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Chưa giao</option>
            {activeStaff.map(s => (
              <option key={s.id} value={s.id}>{s.shortName} — {s.title}</option>
            ))}
          </select>
        </div>
        {departments.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phòng ban</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Không chọn</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
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
