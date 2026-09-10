'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Plus, Check, Trash2, Edit2,
  ChevronUp, ChevronDown, Loader2
} from 'lucide-react'
import type { Task } from '@/types/tasks'
import { createTask, updateTaskStatus, updateSubtaskTitle, deleteTask, updateTask } from '@/lib/tasks/mutations'
import { calculateSubtaskProgress } from '@/lib/tasks/progress'

interface SubtaskListProps {
  parentTaskId: string
  subtasks: Task[]
  actorId: string
  actorName: string
  canEdit: boolean
}

export function SubtaskList({ parentTaskId, subtasks, actorId, actorName, canEdit }: SubtaskListProps) {
  // Local optimistic state
  const [localItems, setLocalItems] = useState<Task[]>(subtasks)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with prop when server data arrives
  useEffect(() => {
    setLocalItems(subtasks)
  }, [subtasks])

  const completedCount = localItems.filter(s => s.isClosed || s.status === 'completed').length
  const totalCount = localItems.length
  const progress = calculateSubtaskProgress(localItems.map(s => ({ isClosed: s.isClosed || s.status === 'completed' })))

  const handleToggle = async (subtask: Task) => {
    const isCurrentlyDone = subtask.isClosed || subtask.status === 'completed'
    const nextStatus = isCurrentlyDone ? 'pending' : 'completed'
    const nextIsClosed = !isCurrentlyDone

    // Optimistic local update
    const updated = localItems.map(s =>
      s.id === subtask.id ? { ...s, status: nextStatus as any, isClosed: nextIsClosed } : s
    )
    setLocalItems(updated)

    // Compute new parent progress
    const newProgress = calculateSubtaskProgress(updated.map(s => ({ isClosed: s.isClosed })))

    try {
      await updateTaskStatus(subtask.id, nextStatus, actorId, actorName)
      // Update parent task progress
      await updateTask(parentTaskId, { progress: newProgress }, actorId, actorName)
    } catch (err) {
      console.error('Failed to toggle subtask:', err)
      // Revert on error
      setLocalItems(subtasks)
    }
  }

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newTitle.trim() || adding) return

    const titleToAdd = newTitle.trim()
    setNewTitle('')

    // Temporary optimistic ID
    const tempId = `temp-${Date.now()}`
    const tempItem: any = {
      id: tempId,
      title: titleToAdd,
      status: 'pending',
      isClosed: false,
      parentTaskId,
      createdAt: null,
    }
    const nextItems = [...localItems, tempItem]
    setLocalItems(nextItems)
    setAdding(true)

    try {
      const realId = await createTask(
        { title: titleToAdd, parentTaskId },
        actorId,
        actorName
      )
      // Replace temp item
      setLocalItems(prev => prev.map(s => s.id === tempId ? { ...s, id: realId } : s))
      // Update parent task progress
      const newProgress = calculateSubtaskProgress(nextItems.map(s => ({ isClosed: s.isClosed })))
      await updateTask(parentTaskId, { progress: newProgress }, actorId, actorName)
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to create subtask:', err)
      setLocalItems(subtasks)
    } finally {
      setAdding(false)
    }
  }

  const handleStartEdit = (subtask: Task) => {
    setEditingId(subtask.id)
    setEditTitle(subtask.title)
  }

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    const finalTitle = editTitle.trim()
    setLocalItems(prev => prev.map(s => s.id === subtaskId ? { ...s, title: finalTitle } : s))
    setEditingId(null)

    try {
      await updateSubtaskTitle(subtaskId, finalTitle)
    } catch (err) {
      console.error('Failed to update subtask title:', err)
      setLocalItems(subtasks)
    }
  }

  const handleDelete = async (subtaskId: string) => {
    const nextItems = localItems.filter(s => s.id !== subtaskId)
    setLocalItems(nextItems)
    const newProgress = calculateSubtaskProgress(nextItems.map(s => ({ isClosed: s.isClosed })))

    try {
      await deleteTask(subtaskId, actorId)
      await updateTask(parentTaskId, { progress: newProgress }, actorId, actorName)
    } catch (err) {
      console.error('Failed to delete subtask:', err)
      setLocalItems(subtasks)
    }
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= localItems.length) return
    const reordered = [...localItems]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    setLocalItems(reordered)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Việc con ({completedCount}/{totalCount})
          </span>
          {totalCount > 0 && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
              progress === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {progress}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progress === 100 ? 'bg-emerald-500' :
            progress >= 50 ? 'bg-blue-600' :
            progress > 0 ? 'bg-blue-400' : 'bg-slate-300'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Subtask items list */}
      <div className="space-y-1.5 pt-1">
        {localItems.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2 text-center">Chưa có công việc con nào</p>
        ) : (
          localItems.map((subtask, index) => {
            const isDone = subtask.isClosed || subtask.status === 'completed'
            const isEditing = editingId === subtask.id

            return (
              <div
                key={subtask.id}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${
                  isDone
                    ? 'bg-slate-100/70 border-slate-200 opacity-75'
                    : 'bg-white border-slate-200/90 hover:border-blue-300 shadow-2xs'
                }`}
              >
                {/* Real Checkbox */}
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => handleToggle(subtask)}
                  disabled={!canEdit}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                />

                {/* Subtask Title (view or edit) */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(subtask.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(subtask.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="w-full text-xs font-medium px-1.5 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => canEdit && handleStartEdit(subtask)}
                      className={`text-xs block truncate ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                      }`}
                      title={subtask.title}
                    >
                      {subtask.title}
                    </span>
                  )}
                </div>

                {/* Action buttons on hover */}
                {canEdit && !isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      title="Di chuyển lên"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === localItems.length - 1}
                      title="Di chuyển xuống"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(subtask)}
                      title="Sửa tên việc con"
                      className="p-1 text-slate-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(subtask.id)}
                      title="Xóa việc con"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add subtask input */}
      {canEdit && (
        <form onSubmit={handleAdd} className="flex items-center gap-1.5 pt-1">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="+ Nhập tên việc con mới rồi Enter..."
            disabled={adding}
            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-400 shadow-2xs"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || adding}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs transition-colors"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Thêm
          </button>
        </form>
      )}
    </div>
  )
}
