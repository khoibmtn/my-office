"use client"

import React, { useState, useMemo } from "react"
import { Timestamp } from "firebase/firestore"
import { X, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStaff } from "@/hooks/useStaff"
import { useDepartments } from "@/hooks/useDepartments"
import { useTags } from "@/hooks/useTags"
import { updateTask } from "@/lib/tasks/mutations"
import type { Task, TaskPriority } from "@/types/tasks"
import { TASK_PRIORITY_LABELS } from "@/lib/tasks/constants"

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

  const [title, setTitle] = useState(task.title || "")
  const [description, setDescription] = useState(task.description || "")
  const [priority, setPriority] = useState<TaskPriority>(task.priority || "normal")
  const [dueDate, setDueDate] = useState(() => {
    if (!task.dueDate) return ""
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date((task.dueDate as any).seconds * 1000)
    return d.toISOString().split("T")[0]
  })
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "")
  const [departmentId, setDepartmentId] = useState(task.departmentId || "")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(task.tagIds || [])
  const [saving, setSaving] = useState(false)

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return

    setSaving(true)
    try {
      const chosenStaff = activeStaff.find(s => s.id === assigneeId || (s as any).staffId === assigneeId)
      const fields: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigneeId: assigneeId || null,
        assigneeName: chosenStaff ? (chosenStaff.shortName || chosenStaff.fullName) : null,
        departmentId: departmentId || null,
        tagIds: selectedTagIds,
      }

      if (dueDate) {
        fields.dueDate = Timestamp.fromDate(new Date(dueDate + "T23:59:59"))
      } else {
        fields.dueDate = null
      }

      await updateTask(task.id, fields, actorId, actorName)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error("Failed to update task:", err)
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
                  <option key={key} value={key}>{label}</option>
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

          {/* Assignee + Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Người xử lý</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Chưa giao</option>
                {activeStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.shortName} — {s.title}</option>
                ))}
              </select>
            </div>
            {departments.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phòng ban</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">Chung</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
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
    </div>
  )
}
