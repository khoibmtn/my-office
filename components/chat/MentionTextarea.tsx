'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Send, FileText, X, Paperclip, User, Loader2 } from 'lucide-react'
import { useStaff } from '@/hooks/useStaff'
import type { StaffMember } from '@/types'
import type { AttachedDocMetadata } from '@/types/tasks'
import { DocAttachmentPickerModal } from './DocAttachmentPickerModal'

interface MentionTextareaProps {
  onSend: (content: string, mentions: string[], attachedDoc?: AttachedDocMetadata | null) => Promise<void> | void
  disabled?: boolean
  placeholder?: string
  contextDocIds?: string[]
  externalAttachedDoc?: AttachedDocMetadata | null
  onClearExternalAttachedDoc?: () => void
}

export function MentionTextarea({
  onSend,
  disabled = false,
  placeholder = 'Nhập tin nhắn... (Gõ @ để nhắc tên, Enter để gửi)',
  contextDocIds = [],
  externalAttachedDoc,
  onClearExternalAttachedDoc,
}: MentionTextareaProps) {
  const { staff: staffList } = useStaff()
  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const [text, setText] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [attachedDoc, setAttachedDoc] = useState<AttachedDocMetadata | null>(null)
  const [sending, setSending] = useState(false)
  const [showDocPicker, setShowDocPicker] = useState(false)

  // Sync external attached document if passed
  useEffect(() => {
    if (externalAttachedDoc) {
      setAttachedDoc(externalAttachedDoc)
    }
  }, [externalAttachedDoc])

  // Mention Autocomplete State
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionMenuRef = useRef<HTMLDivElement>(null)

  // Filter staff matching query
  const filteredStaff = useMemo(() => {
    if (!showMentionMenu) return []
    const q = mentionQuery.toLowerCase().trim()
    if (!q) return activeStaff.slice(0, 7)
    return activeStaff
      .filter(s =>
        s.fullName?.toLowerCase().includes(q) ||
        s.shortName?.toLowerCase().includes(q) ||
        s.nickname?.toLowerCase().includes(q) ||
        s.title?.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q)
      )
      .slice(0, 7)
  }, [showMentionMenu, mentionQuery, activeStaff])

  // Check for @ trigger when typing
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = val.slice(0, cursorPos)

    // Match @query at cursor
    const match = /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCursor)
    if (match) {
      const query = match[1]
      const atSymbolIndex = match.index + (match[0].startsWith(' ') ? 1 : 0)
      setMentionQuery(query)
      setMentionIndex(atSymbolIndex)
      setShowMentionMenu(true)
      setSelectedIndex(0)
    } else {
      setShowMentionMenu(false)
    }
  }

  // Insert selected staff
  const selectStaff = useCallback((staff: StaffMember) => {
    if (!textareaRef.current) return

    const nameToInsert = staff.shortName || staff.fullName
    const beforeAt = text.slice(0, mentionIndex)
    const afterCursor = text.slice(textareaRef.current.selectionStart || text.length)

    const newText = `${beforeAt}@${nameToInsert} ${afterCursor}`
    setText(newText)

    if (!mentions.includes(staff.id)) {
      setMentions(prev => [...prev, staff.id])
    }

    setShowMentionMenu(false)

    // Focus and restore cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeAt.length + nameToInsert.length + 2
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 10)
  }, [text, mentionIndex, mentions])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredStaff.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredStaff.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredStaff.length) % filteredStaff.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectStaff(filteredStaff[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionMenu(false)
        return
      }
    }

    // Enter to send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    if ((!text.trim() && !attachedDoc) || sending || disabled) return
    setSending(true)
    try {
      await onSend(text.trim(), mentions, attachedDoc)
      setText('')
      setMentions([])
      setAttachedDoc(null)
      if (onClearExternalAttachedDoc) onClearExternalAttachedDoc()
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    } catch (err) {
      console.error('Failed to send comment:', err)
    } finally {
      setSending(false)
    }
  }

  const handleRemoveDoc = () => {
    setAttachedDoc(null)
    if (onClearExternalAttachedDoc) onClearExternalAttachedDoc()
  }

  return (
    <div className="relative flex flex-col bg-white border-t border-slate-200 p-2.5">
      {/* Floating Mention Autocomplete Popover */}
      {showMentionMenu && filteredStaff.length > 0 && (
        <div
          ref={mentionMenuRef}
          className="absolute bottom-full mb-1 left-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden w-64 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Nhắc đến nhân viên
          </div>
          <div className="p-1 space-y-0.5">
            {filteredStaff.map((staff, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => selectStaff(staff)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                    isSelected ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {(staff.shortName || staff.fullName || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-tight">
                      {staff.fullName}
                      {staff.shortName && staff.shortName !== staff.fullName && (
                        <span className="text-[10px] text-slate-400 ml-1 font-normal">({staff.shortName})</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {staff.position || staff.title || 'Nhân viên'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Attached Document Pill (if selected) */}
      {attachedDoc && (
        <div className="mb-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-blue-900 truncate block">
                {attachedDoc.docNumber ? `[${attachedDoc.docNumber}] ` : ''}
                {attachedDoc.title}
              </span>
              {attachedDoc.files && attachedDoc.files.length > 0 && (
                <span className="text-[10px] text-blue-600">
                  Kèm {attachedDoc.files.length} tệp tài liệu
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveDoc}
            className="p-1 rounded-md text-blue-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Bỏ đính kèm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || sending}
          className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 max-h-28 leading-snug bg-slate-50/60 focus:bg-white transition-all"
        />

        {/* Attach Document Button */}
        <button
          type="button"
          onClick={() => setShowDocPicker(true)}
          disabled={disabled || sending}
          className="shrink-0 p-2 rounded-xl border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
          title="Đính kèm văn bản vào tin nhắn"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && !attachedDoc) || sending || disabled}
          className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shadow-2xs"
          title="Gửi tin nhắn (Enter)"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Bottom hint bar */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 px-0.5 select-none">
        <span>Gõ <strong className="text-blue-600">@</strong> để nhắc tên • <strong className="text-blue-600">Enter</strong> để gửi</span>
        <button
          type="button"
          onClick={() => setShowDocPicker(true)}
          className="hover:text-blue-600 transition-colors flex items-center gap-0.5"
        >
          <FileText className="w-3 h-3" /> Đính kèm văn bản
        </button>
      </div>

      {/* Document Picker Modal */}
      <DocAttachmentPickerModal
        isOpen={showDocPicker}
        onClose={() => setShowDocPicker(false)}
        onSelectDoc={(docMeta) => setAttachedDoc(docMeta)}
        contextDocIds={contextDocIds}
      />
    </div>
  )
}
