'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  X, CheckSquare, Plus, Trash2, FileText, Loader2, StickyNote,
  MessageSquare, Send, CornerDownLeft, User, Share2, Pencil,
  ChevronUp, ChevronDown, Check, ExternalLink, Sparkles, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier, DossierChecklistItem, DossierComment } from '@/types'
import { updateDossier, addDossierComment, deleteDossierComment } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'
import { useDocuments } from '@/hooks/useDocuments'
import { useDossiers } from '@/hooks/useDossiers'
import { useTasks } from '@/hooks/useTasks'
import { createTask, updateTaskStatus, deleteTask as deleteTaskEngine } from '@/lib/tasks/mutations'
import { migrateSingleDossierChecklist } from '@/lib/tasks/migration'
import type { Task } from '@/types/tasks'

interface DossierPanelProps {
  dossier: Dossier
  onClose: () => void
  canEdit: boolean
  onShare?: () => void
}

function formatCommentTime(ts: any): string {
  if (!ts) return ''
  let d: Date
  if (ts.toDate && typeof ts.toDate === 'function') d = ts.toDate()
  else if (ts.seconds) d = new Date(ts.seconds * 1000)
  else if (ts instanceof Date) d = ts
  else d = new Date(ts)

  if (isNaN(d.getTime())) return ''

  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) {
    return `${hours}:${mins}`
  }
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${hours}:${mins} ${day}/${month}`
}

export function DossierPanel({ dossier, onClose, canEdit, onShare }: DossierPanelProps) {
  const { staffId, staffName, role, isAdmin } = useRole()
  const { documents } = useDocuments()
  const { dossiers } = useDossiers()

  const isOwner =
    dossier.ownerId === staffId ||
    (isAdmin && (dossier.ownerId === 'admin' || !dossier.ownerId)) ||
    isAdmin

  // Collect all descendant folder IDs in this dossier tree (including this dossier)
  const treeDossierIds = useMemo(() => {
    const ids = new Set<string>([dossier.id])
    const collect = (pid: string) => {
      dossiers.filter(d => d.parentId === pid && !d.deletedAt).forEach(child => {
        ids.add(child.id)
        collect(child.id)
      })
    }
    collect(dossier.id)
    return ids
  }, [dossier.id, dossiers])

  // Check if current user is assigned or co-assigned to at least 1 document in this dossier or any of its subfolders
  const hasAssignedDocInTree = useMemo(() => {
    if (isAdmin || isOwner) return true
    if (!documents || !staffId) return false
    return documents.some(doc => {
      const inTree = (doc.dossierIds || []).some(did => treeDossierIds.has(did))
      if (!inTree) return false
      const isAssigned =
        doc.assigneeId === staffId ||
        (doc.coAssigneeIds || []).includes(staffId) ||
        (staffName && doc.assignee === staffName)
      return isAssigned
    })
  }, [isAdmin, isOwner, documents, staffId, staffName, treeDossierIds])

  // Permission for checklist: Owner, Admin, OR shared user with at least 1 assigned document in the tree
  const canEditChecklist = isOwner || isAdmin || hasAssignedDocInTree
  const canShare = isOwner || isAdmin
  
  // Section 1: Description
  const [description, setDescription] = useState(dossier.description || '')
  const [savingDesc, setSavingDesc] = useState(false)

  // Section 2: Notes
  const [notes, setNotes] = useState(dossier.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  // Section 3: Tasks & Checklist (Task Engine integration with dual-read support)
  const { tasks: dossierTasks, loading: tasksLoading } = useTasks({ view: 'dossier', dossierId: dossier.id })
  const [migrating, setMigrating] = useState(false)
  const [taskSubmitting, setTaskSubmitting] = useState(false)
  const [checklist, setChecklist] = useState<DossierChecklistItem[]>(dossier.checklist || [])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskTitle, setEditingTaskTitle] = useState('')

  const hasTasks = dossierTasks.length > 0
  const hasLegacyChecklist = checklist.length > 0

  // Section 4: Comments (Chat)
  const [comments, setComments] = useState<DossierComment[]>(dossier.comments || [])
  const [newCommentText, setNewCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Sync state when active dossier changes
  useEffect(() => {
    setDescription(dossier.description || '')
    setNotes(dossier.notes || '')
    setChecklist(dossier.checklist || [])
    setComments(dossier.comments || [])
    setEditingTaskId(null)
    setEditingTaskTitle('')
  }, [dossier])

  // Scroll to bottom of chat when comments change
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // Mark dossier comments as read when panel is open for this dossier
  useEffect(() => {
    if (dossier?.id && typeof window !== 'undefined') {
      const userKey = staffId || (isAdmin ? 'admin' : 'guest')
      localStorage.setItem(`myoffice_dossier_read_${dossier.id}_${userKey}`, String(Date.now()))
      window.dispatchEvent(new CustomEvent('myoffice_dossier_read', { detail: { dossierId: dossier.id } }))
    }
  }, [dossier?.id, comments.length, staffId, isAdmin])

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

  // Debounced auto-save notes (1000ms)
  const notesTimer = useRef<NodeJS.Timeout | null>(null)
  const handleNotesChange = (text: string) => {
    setNotes(text)

    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      setSavingNotes(true)
      try {
        await updateDossier(dossier.id, { notes: text }, staffId || 'unknown')
      } catch (err) {
        console.error('Save notes failed:', err)
      }
      setSavingNotes(false)
    }, 1000)
  }

  // Save checklist helper
  const saveChecklist = async (newList: DossierChecklistItem[]) => {
    setChecklist(newList)
    if (!canEditChecklist) return
    try {
      await updateDossier(dossier.id, { checklist: newList }, staffId || 'unknown')
    } catch (err) {
      console.error('Save checklist failed:', err)
    }
  }

  const handleToggleTask = (taskId: string) => {
    if (!canEditChecklist) return
    const currentName = staffName || (isAdmin ? 'Admin' : 'Thành viên')
    const newList = checklist.map(item => {
      if (item.id === taskId) {
        const nextState = !item.completed
        return {
          ...item,
          completed: nextState,
          completedAt: nextState ? ({ seconds: Math.floor(Date.now() / 1000) } as any) : null,
          completedBy: nextState ? currentName : null,
        }
      }
      return item
    })
    saveChecklist(newList)
  }

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditChecklist || !newTaskTitle.trim()) return
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

  const handleStartEditTask = (item: DossierChecklistItem) => {
    if (!canEditChecklist) return
    setEditingTaskId(item.id)
    setEditingTaskTitle(item.title)
  }

  const handleSaveEditTask = (taskId: string) => {
    if (!editingTaskTitle.trim()) return
    const newList = checklist.map(item =>
      item.id === taskId ? { ...item, title: editingTaskTitle.trim() } : item
    )
    setEditingTaskId(null)
    setEditingTaskTitle('')
    saveChecklist(newList)
  }

  const handleCancelEditTask = () => {
    setEditingTaskId(null)
    setEditingTaskTitle('')
  }

  const handleMoveTask = (index: number, direction: 'up' | 'down') => {
    if (!canEditChecklist) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= checklist.length) return
    const newList = [...checklist]
    const [moved] = newList.splice(index, 1)
    newList.splice(targetIndex, 0, moved)
    const updatedList = newList.map((item, idx) => ({ ...item, order: idx + 1 }))
    saveChecklist(updatedList)
  }

  const handleDeleteTask = (taskId: string) => {
    if (!canEditChecklist) return
    const newList = checklist.filter(t => t.id !== taskId)
    saveChecklist(newList)
  }

  // Send new comment
  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = newCommentText.trim()
    if (!content || sendingComment) return

    setSendingComment(true)
    const sender = staffName || (isAdmin ? 'Admin' : 'Thành viên')
    const sId = staffId || (isAdmin ? 'admin' : 'anonymous')

    try {
      const added = await addDossierComment(
        dossier.id,
        {
          senderId: sId,
          senderName: sender,
          content,
        },
        sId
      )
      setComments(prev => [...prev, added])
      setNewCommentText('')
    } catch (err) {
      console.error('Send comment failed:', err)
    } finally {
      setSendingComment(false)
    }
  }

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDossierComment(dossier.id, commentId, staffId || 'unknown')
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      console.error('Delete comment failed:', err)
    }
  }

  const handleToggleTaskEngine = async (task: Task) => {
    if (!canEditChecklist) return
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    await updateTaskStatus(task.id, nextStatus, staffId || 'unknown', staffName || (isAdmin ? 'Admin' : 'Thành viên'))
  }

  const handleAddDossierTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditChecklist || !newTaskTitle.trim() || taskSubmitting) return
    setTaskSubmitting(true)
    try {
      if (hasTasks || !hasLegacyChecklist) {
        await createTask(
          {
            title: newTaskTitle.trim(),
            dossierIds: [dossier.id],
          },
          staffId || 'unknown',
          staffName || (isAdmin ? 'Admin' : 'Thành viên')
        )
      } else {
        handleAddTask(e)
      }
      setNewTaskTitle('')
    } catch (err) {
      console.error('Create dossier task failed:', err)
    } finally {
      setTaskSubmitting(false)
    }
  }

  const handleDeleteTaskEngine = async (taskId: string) => {
    if (!canEditChecklist) return
    await deleteTaskEngine(taskId, staffId || 'unknown')
  }

  const handleMigrateChecklist = async () => {
    if (migrating) return
    setMigrating(true)
    try {
      await migrateSingleDossierChecklist(
        dossier.id,
        checklist,
        dossier.ownerId,
        staffId || 'unknown'
      )
    } catch (err) {
      console.error('Migrate checklist error:', err)
    } finally {
      setMigrating(false)
    }
  }

  // Calculate progress
  const total = hasTasks ? dossierTasks.length : checklist.length
  const completed = hasTasks
    ? dossierTasks.filter(t => t.status === 'completed').length
    : checklist.filter(t => t.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <aside className="w-88 sm:w-96 bg-white border-l border-slate-200 h-full flex flex-col shrink-0 shadow-lg animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 bg-slate-50/70">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <h3 className="font-bold text-slate-800 text-sm truncate">
            Chi tiết — {dossier.name}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onShare && canShare && (
            <button
              onClick={onShare}
              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Chia sẻ hồ sơ"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Frame 1: Description (Blue Theme) */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 overflow-hidden shadow-2xs">
          <div className="px-3.5 py-2 bg-blue-100/80 border-b border-blue-200/90 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-blue-950 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-blue-700" />
              <span>Mô tả & Mục đích</span>
            </label>
            {savingDesc && (
              <span className="text-[10px] text-blue-700 flex items-center gap-1 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
              </span>
            )}
          </div>
          <div className="p-3">
            <textarea
              rows={3}
              value={description}
              onChange={e => handleDescriptionChange(e.target.value)}
              disabled={!canEdit}
              placeholder={canEdit ? 'Nhập mô tả mục đích của hồ sơ này...' : 'Chưa có mô tả'}
              className="w-full p-2.5 border border-blue-200/90 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-70 resize-y text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Frame 2: Notes (Amber Theme) */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden shadow-2xs">
          <div className="px-3.5 py-2 bg-amber-100/90 border-b border-amber-200 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950 uppercase tracking-wider">
              <StickyNote className="w-3.5 h-3.5 text-amber-700" />
              <span>Ghi chú hồ sơ</span>
            </label>
            {savingNotes && (
              <span className="text-[10px] text-amber-800 flex items-center gap-1 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
              </span>
            )}
          </div>
          <div className="p-3">
            <textarea
              rows={3}
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Nhập ghi chú quan trọng, lưu ý chung cho hồ sơ này (tự động lưu)..."
              className="w-full p-2.5 border border-amber-200 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white placeholder:text-slate-400 resize-y text-slate-800"
            />
          </div>
        </div>

        {/* Frame 3: Tasks & Checklist (Emerald Theme - Task Engine Integrated) */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden shadow-2xs">
          <div className="px-3.5 py-2 bg-emerald-100/90 border-b border-emerald-200 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 uppercase tracking-wider">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>Công việc & Tiến độ ({completed}/{total})</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-200/60 px-1.5 py-0.5 rounded">{percent}%</span>
              {hasTasks && (
                <Link
                  href="/tasks"
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-0.5"
                  title="Mở không gian công việc"
                >
                  Bảng việc <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>
          </div>

          <div className="p-3">
            {/* Progress bar */}
            <div className="w-full h-2 bg-emerald-200/80 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Migration Banner if legacy checklist exists and not migrated yet */}
            {!hasTasks && hasLegacyChecklist && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Checklist cũ ({checklist.length} mục)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleMigrateChecklist}
                    disabled={migrating}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-60 shrink-0 cursor-pointer"
                  >
                    {migrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Đồng bộ sang Task
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 mt-1">
                  Nhấn &quot;Đồng bộ sang Task&quot; để tích hợp đầy đủ lịch, thông báo và Kanban.
                </p>
              </div>
            )}

            {/* Tasks / Checklist List */}
            <div className="space-y-1.5 mb-3">
              {hasTasks ? (
                // Task Engine tasks
                dossierTasks.map((task) => {
                  const isDone = task.status === 'completed'
                  return (
                    <div
                      key={task.id}
                      className={`group/task flex items-start gap-2 p-2 rounded-lg border transition-all ${
                        isDone
                          ? 'bg-emerald-100/50 border-emerald-200'
                          : 'bg-white border-emerald-200/70 hover:border-emerald-300 shadow-2xs'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => handleToggleTaskEngine(task)}
                        disabled={!canEditChecklist}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/tasks/${task.id}`}
                            className={`text-xs leading-tight hover:text-blue-600 truncate ${
                              isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                            }`}
                            title={task.title}
                          >
                            {task.title}
                          </Link>
                          <Link
                            href={`/tasks/${task.id}`}
                            className="text-slate-400 hover:text-blue-600 shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity"
                            title="Mở chi tiết công việc"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        {task.assigneeName && (
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
                            Giao cho: {task.assigneeName}
                          </span>
                        )}
                      </div>
                      {canEditChecklist && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTaskEngine(task.id)}
                          className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover/task:opacity-100 transition-opacity"
                          title="Xóa công việc"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })
              ) : checklist.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">Chưa có công việc nào trong hồ sơ</p>
              ) : (
                // Legacy checklist fallback
                checklist.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`group/task flex items-start gap-2 p-2 rounded-lg border transition-all ${
                      item.completed
                        ? 'bg-emerald-100/50 border-emerald-200'
                        : 'bg-white border-emerald-200/70 hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    {editingTaskId === item.id ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingTaskTitle}
                          onChange={e => setEditingTaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSaveEditTask(item.id)
                            } else if (e.key === 'Escape') {
                              handleCancelEditTask()
                            }
                          }}
                          autoFocus
                          placeholder="Tên công việc..."
                          className="flex-1 px-2 py-1 text-xs border border-emerald-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditTask(item.id)}
                          disabled={!editingTaskTitle.trim()}
                          className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                          title="Lưu (Enter)"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditTask}
                          className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                          title="Hủy (Esc)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleTask(item.id)}
                          disabled={!canEditChecklist}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-tight break-words ${item.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                            {item.title}
                          </p>
                          {item.completed && item.completedBy && (
                            <span className="text-[10px] text-emerald-700/80 italic block mt-0.5">
                              ✓ {item.completedBy}
                            </span>
                          )}
                        </div>

                        {canEditChecklist && (
                          <div className="flex items-center gap-0.5 opacity-70 group-hover/task:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveTask(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-emerald-700 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                              title="Di chuyển lên trên"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveTask(idx, 'down')}
                              disabled={idx === checklist.length - 1}
                              className="p-1 text-slate-400 hover:text-emerald-700 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                              title="Di chuyển xuống dưới"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditTask(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Chỉnh sửa công việc"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="Xóa công việc"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new task input */}
            {canEditChecklist && (
              <form onSubmit={handleAddDossierTask} className="flex gap-1.5">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="+ Thêm công việc mới vào hồ sơ..."
                  disabled={taskSubmitting}
                  className="flex-1 px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400 disabled:opacity-60"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!newTaskTitle.trim() || taskSubmitting}
                >
                  {taskSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Frame 4: Chat & Comments (Indigo Theme) */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden shadow-2xs flex flex-col">
          <div className="px-3.5 py-2 bg-indigo-100/90 border-b border-indigo-200 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-700" />
              <span>Trao đổi & Bình luận ({comments.length})</span>
            </label>
          </div>

          <div className="p-3 flex flex-col">
            {/* Messages list container */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 mb-3">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  Chưa có trao đổi nào. Hãy gửi tin nhắn đầu tiên!
                </div>
              ) : (
                comments.map(c => {
                  const isMine =
                    (staffId && c.senderId === staffId) ||
                    (isAdmin && (c.senderId === 'admin' || c.senderName === 'Admin' || c.senderId === 'anonymous')) ||
                    (staffName && c.senderName === staffName)
                  const canDelete = isMine || isAdmin
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-col group ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      {isMine ? (
                        /* My Message: Right aligned, Blue bubble, discreet time inside */
                        <div className="relative max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-xs px-3 py-2 text-xs leading-relaxed break-words shadow-2xs">
                          <p className="whitespace-pre-line inline">{c.content}</p>
                          <span className="inline-flex items-center gap-1 float-right mt-1 ml-2 text-[10px] text-blue-200/90 select-none leading-none pt-0.5">
                            <span>{formatCommentTime(c.createdAt)}</span>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-200 hover:text-white transition-opacity cursor-pointer ml-0.5"
                                title="Xóa tin nhắn"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        </div>
                      ) : (
                        /* Other's Message: Left aligned, Slate bubble with sender name on top & discreet time inside */
                        <div className="relative max-w-[85%] bg-white text-slate-800 border border-slate-200/90 rounded-2xl rounded-tl-xs px-3 py-2 text-xs leading-relaxed break-words shadow-2xs">
                          <div className="font-bold text-[11px] text-indigo-700 mb-1 select-none flex items-center gap-1">
                            <span>{c.senderName}</span>
                          </div>
                          <p className="whitespace-pre-line inline text-slate-800">{c.content}</p>
                          <span className="inline-flex items-center gap-1 float-right mt-1 ml-2 text-[10px] text-slate-400 select-none leading-none pt-0.5">
                            <span>{formatCommentTime(c.createdAt)}</span>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer ml-0.5"
                                title="Xóa tin nhắn"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment input area */}
            <form onSubmit={handleSendComment} className="flex items-end gap-1.5 pt-2 border-t border-indigo-200/70">
              <textarea
                rows={2}
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendComment()
                  }
                }}
                placeholder="Nhập nội dung trao đổi (Enter để gửi)..."
                className="flex-1 px-2.5 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 resize-none text-slate-800"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newCommentText.trim() || sendingComment}
                className="h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0"
                title="Gửi tin nhắn"
              >
                {sendingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  )
}
