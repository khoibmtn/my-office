'use client'

import React, { useState, useRef } from 'react'
import { Plus, Check, GripVertical, Trash2 } from 'lucide-react'
import type { Task } from '@/types/tasks'
import { createTask, updateTaskStatus } from '@/lib/tasks/mutations'
import { calculateSubtaskProgress } from '@/lib/tasks/progress'

interface SubtaskListProps {
  parentTaskId: string
  subtasks: Task[]
  actorId: string
  actorName: string
  canEdit: boolean
}

export function SubtaskList({ parentTaskId, subtasks, actorId, actorName, canEdit }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const progress = calculateSubtaskProgress(subtasks.map(s => ({ isClosed: s.isClosed })))
  const completedCount = subtasks.filter(s => s.isClosed).length

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      await createTask(
        { title: newTitle.trim(), parentTaskId },
        actorId,
        actorName
      )
      setNewTitle('')
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to create subtask:', err)
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (subtask: Task) => {
    try {
      const newStatus = subtask.isClosed ? 'pending' : 'completed'
      await updateTaskStatus(subtask.id, newStatus, actorId, actorName)
    } catch (err) {
      console.error('Failed to toggle subtask:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-2">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">
          Việc con ({completedCount}/{subtasks.length})
        </span>
        <span className="text-xs text-slate-400">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progress >= 100 ? 'bg-emerald-500' :
            progress >= 50 ? 'bg-blue-500' :
            'bg-slate-300'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Subtask items */}
      <div className="space-y-0.5">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className={`flex items-center gap-2 py-1.5 px-2 rounded-lg group hover:bg-slate-50 transition-colors ${
              subtask.isClosed ? 'opacity-60' : ''
            }`}
          >
            <button
              onClick={() => handleToggle(subtask)}
              disabled={!canEdit}
              className={`shrink-0 w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${
                subtask.isClosed
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-slate-300 hover:border-blue-400'
              }`}
            >
              {subtask.isClosed && <Check className="w-3 h-3 text-white" />}
            </button>
            <span className={`text-sm flex-1 ${subtask.isClosed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
              {subtask.title}
            </span>
          </div>
        ))}
      </div>

      {/* Add subtask input */}
      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          <Plus className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Thêm việc con..."
            disabled={adding}
            className="flex-1 text-sm border-0 border-b border-dashed border-slate-200 bg-transparent py-1 focus:border-blue-400 focus:outline-none placeholder:text-slate-300"
          />
        </div>
      )}
    </div>
  )
}
