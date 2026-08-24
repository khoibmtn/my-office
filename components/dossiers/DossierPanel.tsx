'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X, CheckSquare, Plus, Trash2, FileText, Loader2, StickyNote,
  MessageSquare, Send, CornerDownLeft, User, Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier, DossierChecklistItem, DossierComment } from '@/types'
import { updateDossier, addDossierComment, deleteDossierComment } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'

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
  const isOwner = dossier.ownerId === staffId || (isAdmin && (dossier.ownerId === 'admin' || !dossier.ownerId)) || isAdmin
  const canEditChecklist = isOwner || isAdmin
  const canShare = isOwner || isAdmin
  
  // Section 1: Description
  const [description, setDescription] = useState(dossier.description || '')
  const [savingDesc, setSavingDesc] = useState(false)

  // Section 2: Notes
  const [notes, setNotes] = useState(dossier.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  // Section 3: Checklist
  const [checklist, setChecklist] = useState<DossierChecklistItem[]>(dossier.checklist || [])
  const [newTaskTitle, setNewTaskTitle] = useState('')

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
  }, [dossier])

  // Scroll to bottom of chat when comments change
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

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

  // Calculate progress
  const total = checklist.length
  const completed = checklist.filter(t => t.completed).length
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

        {/* Frame 3: Checklist Progress (Emerald Theme) */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden shadow-2xs">
          <div className="px-3.5 py-2 bg-emerald-100/90 border-b border-emerald-200 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 uppercase tracking-wider">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>Checklist Tiến độ ({completed}/{total})</span>
            </label>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-200/60 px-1.5 py-0.5 rounded">{percent}%</span>
          </div>

          <div className="p-3">
            {/* Progress bar */}
            <div className="w-full h-2 bg-emerald-200/80 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Checklist Items List */}
            <div className="space-y-1.5 mb-3">
              {checklist.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">Chưa có công việc nào trong checklist</p>
              ) : (
                checklist.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                      item.completed ? 'bg-emerald-100/50 border-emerald-200' : 'bg-white border-emerald-200/70 hover:border-emerald-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleTask(item.id)}
                      disabled={!canEdit}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-tight ${item.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
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
                        type="button"
                        onClick={() => handleDeleteTask(item.id)}
                        className="p-1 text-slate-300 hover:text-red-600 transition-colors cursor-pointer"
                        title="Xóa công việc"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new task input */}
            {canEdit && (
              <form onSubmit={handleAddTask} className="flex gap-1.5">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="+ Thêm công việc mới..."
                  className="flex-1 px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400"
                />
                <Button type="submit" size="sm" className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!newTaskTitle.trim()}>
                  <Plus className="w-3.5 h-3.5" />
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
