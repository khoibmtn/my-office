'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CheckSquare, Plus, Trash2, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier, DossierChecklistItem } from '@/types'
import { updateDossier } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'

interface DossierPanelProps {
  dossier: Dossier
  onClose: () => void
  canEdit: boolean
}

export function DossierPanel({ dossier, onClose, canEdit }: DossierPanelProps) {
  const { staffId, staffName } = useRole()
  const [description, setDescription] = useState(dossier.description || '')
  const [checklist, setChecklist] = useState<DossierChecklistItem[]>(dossier.checklist || [])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [savingDesc, setSavingDesc] = useState(false)

  // Sync state when active dossier changes
  useEffect(() => {
    setDescription(dossier.description || '')
    setChecklist(dossier.checklist || [])
  }, [dossier])

  // Debounced auto-save description (1000ms)
  const descTimer = useRef<NodeJS.Timeout | null>(null)
  const handleDescriptionChange = (text: string) => {
    setDescription(text)
    if (!canEdit) return

    if (descTimer.current) clearTimeout(descTimer.current)
    descTimer.current = setTimeout(async () => {
      setSavingDesc(true)
      try {
        await updateDossier(dossier.id, { description: text }, staffId || 'unknown')
      } catch (err) {
        console.error('Save description failed:', err)
      }
      setSavingDesc(false)
    }, 1000)
  }

  // Save checklist helper
  const saveChecklist = async (newList: DossierChecklistItem[]) => {
    setChecklist(newList)
    if (!canEdit) return
    try {
      await updateDossier(dossier.id, { checklist: newList }, staffId || 'unknown')
    } catch (err) {
      console.error('Save checklist failed:', err)
    }
  }

  const handleToggleTask = (taskId: string) => {
    const newList = checklist.map(item => {
      if (item.id === taskId) {
        const nextState = !item.completed
        return {
          ...item,
          completed: nextState,
          completedAt: nextState ? ({ seconds: Math.floor(Date.now() / 1000) } as any) : null,
          completedBy: nextState ? (staffName || staffId || 'User') : null,
        }
      }
      return item
    })
    saveChecklist(newList)
  }

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    const newItem: DossierChecklistItem = {
      id: Math.random().toString(36).substring(2, 10),
      title: newTaskTitle.trim(),
      completed: false,
      completedAt: null,
      completedBy: null,
      order: checklist.length + 1,
    }
    const newList = [...checklist, newItem]
    setNewTaskTitle('')
    saveChecklist(newList)
  }

  const handleDeleteTask = (taskId: string) => {
    const newList = checklist.filter(t => t.id !== taskId)
    saveChecklist(newList)
  }

  // Calculate progress
  const total = checklist.length
  const completed = checklist.filter(t => t.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <aside className="w-80 bg-white border-l border-slate-200 h-full flex flex-col shrink-0 shadow-lg animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <h3 className="font-semibold text-slate-800 text-sm truncate">
            Chi tiết — {dossier.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Notes & Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mô tả & Mục đích hồ sơ
            </label>
            {savingDesc && (
              <span className="text-[10px] text-blue-600 flex items-center gap-1 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
              </span>
            )}
          </div>
          <textarea
            rows={4}
            value={description}
            onChange={e => handleDescriptionChange(e.target.value)}
            disabled={!canEdit}
            placeholder={canEdit ? 'Nhập ghi chú cấu trúc, mục đích của hồ sơ này...' : 'Chưa có ghi chú'}
            className="w-full p-2.5 border border-slate-200 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/30 disabled:opacity-70"
          />
        </div>

        {/* Section 2: Checklist Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Checklist Tiến độ ({completed}/{total})
            </label>
            <span className="text-xs font-bold text-blue-600">{percent}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Checklist Items List */}
          <div className="space-y-2 mb-3">
            {checklist.map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                  item.completed ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleTask(item.id)}
                  disabled={!canEdit}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-tight ${item.completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                    {item.title}
                  </p>
                  {item.completed && item.completedBy && (
                    <span className="text-[10px] text-slate-400 italic block mt-0.5">
                      ✓ {item.completedBy}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDeleteTask(item.id)}
                    className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new task input */}
          {canEdit && (
            <form onSubmit={handleAddTask} className="flex gap-1.5">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="+ Thêm công việc mới..."
                className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" size="sm" className="h-8 px-2 text-xs" disabled={!newTaskTitle.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </aside>
  )
}
