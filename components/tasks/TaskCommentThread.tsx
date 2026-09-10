'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import type { TaskComment } from '@/types/tasks'
import { addTaskComment } from '@/lib/tasks/mutations'

interface TaskCommentThreadProps {
  taskId: string
  comments: TaskComment[]
  actorId: string
  actorName: string
  canComment: boolean
}

function formatTime(timestamp: any): string {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function TaskCommentThread({ taskId, comments, actorId, actorName, canComment }: TaskCommentThreadProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const handleSend = async () => {
    if (!content.trim() || sending) return
    setSending(true)
    try {
      await addTaskComment(taskId, content.trim(), actorId, actorName)
      setContent('')
      textareaRef.current?.focus()
    } catch (err) {
      console.error('Failed to send comment:', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {comments.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-xs">
            Chưa có bình luận nào
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = comment.authorId === actorId
            return (
              <div key={comment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'order-2' : 'order-1'}`}>
                  {!isMe && (
                    <div className="text-[10px] font-medium text-slate-500 mb-0.5 px-1">
                      {comment.authorName}
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  }`}>
                    {comment.content}
                  </div>
                  <div className={`text-[10px] text-slate-400 mt-0.5 px-1 ${isMe ? 'text-right' : ''}`}>
                    {formatTime(comment.createdAt)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canComment && (
        <div className="border-t border-slate-200 p-2 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập bình luận..."
              rows={1}
              className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none max-h-20"
            />
            <button
              onClick={handleSend}
              disabled={!content.trim() || sending}
              className="shrink-0 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
