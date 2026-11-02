'use client'

import React, { useRef, useEffect, useLayoutEffect } from 'react'
import type { TaskComment, AttachedDocMetadata } from '@/types/tasks'
import { addTaskComment, deleteTaskComment } from '@/lib/tasks/mutations'
import { MentionTextarea } from '@/components/chat/MentionTextarea'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'

interface TaskCommentThreadProps {
  taskId: string
  comments: TaskComment[]
  actorId: string
  actorName: string
  canComment: boolean
  taskDocumentIds?: string[]
  onLinkDocumentToTask?: (docId: string, metadata?: any) => Promise<void> | void
  onAttachFileToDoc?: (fileUrl: string, fileName: string) => void
  onCreateDocFromMessage?: (content: string, metadata?: any) => void
  externalDraftDoc?: AttachedDocMetadata | null
  onClearExternalDraftDoc?: () => void
}

export function TaskCommentThread({
  taskId,
  comments,
  actorId,
  actorName,
  canComment,
  taskDocumentIds = [],
  onLinkDocumentToTask,
  onAttachFileToDoc,
  onCreateDocFromMessage,
  externalDraftDoc,
  onClearExternalDraftDoc,
}: TaskCommentThreadProps) {
  const threadRootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef<number | null>(null)

  // Filter non-deleted comments
  const activeComments = comments.filter(c => !c.deletedAt)

  // Whether the user was at (or near) the bottom BEFORE the latest render — updated on scroll.
  const wasNearBottomRef = useRef(true)

  const isChatInputFocused = () => {
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null
    return Boolean(
      activeEl &&
      threadRootRef.current?.contains(activeEl) &&
      (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')
    )
  }

  const handleListScroll = () => {
    const listEl = listRef.current
    if (!listEl || listEl.clientHeight === 0) return
    const distanceFromBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight
    wasNearBottomRef.current = distanceFromBottom <= 80
  }

  const scrollChatToBottom = () => {
    const listEl = listRef.current
    if (!listEl) return
    listEl.scrollTop = listEl.scrollHeight
    wasNearBottomRef.current = true
  }

  // Scroll to bottom on first load (incl. comments arriving 0 → n after mount) and when new
  // comments arrive while the user was near the bottom or typing.
  useLayoutEffect(() => {
    const prev = prevCountRef.current
    const count = activeComments.length
    if (prev === null || prev === 0 || wasNearBottomRef.current || isChatInputFocused()) {
      scrollChatToBottom()
    }
    prevCountRef.current = count
  }, [activeComments.length])

  // On mobile the chat column is display:none while the "Thông tin" tab is active, so scrollTop
  // assignments are lost. When the list becomes visible again, jump to the newest message if the
  // user was at the bottom.
  useEffect(() => {
    const listEl = listRef.current
    if (!listEl || typeof ResizeObserver === 'undefined') return
    let wasHidden = listEl.clientHeight === 0
    const ro = new ResizeObserver(() => {
      const hidden = listEl.clientHeight === 0
      if (wasHidden && !hidden && wasNearBottomRef.current) scrollChatToBottom()
      wasHidden = hidden
    })
    ro.observe(listEl)
    return () => ro.disconnect()
  }, [])

  // Keep bottom in view when the virtual keyboard resizes visualViewport on mobile
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const handleViewportResize = () => {
      if (isChatInputFocused() || wasNearBottomRef.current) {
        scrollChatToBottom()
      }
    }
    vv.addEventListener('resize', handleViewportResize)
    return () => vv.removeEventListener('resize', handleViewportResize)
  }, [])

  const handleSend = async (
    content: string,
    mentions: string[],
    attachedDoc?: AttachedDocMetadata | null
  ) => {
    await addTaskComment(
      taskId,
      content,
      actorId,
      actorName,
      mentions,
      attachedDoc?.docId,
      attachedDoc
    )
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Bạn có chắc muốn xóa tin nhắn này?')) return
    try {
      await deleteTaskComment(commentId)
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  return (
    <div ref={threadRootRef} className="flex flex-col flex-1 h-full min-h-0 bg-slate-50">
      {/* Comment list */}
      <div ref={listRef} onScroll={handleListScroll} className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 min-h-0">
        {activeComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs text-center px-4">
            <div className="w-9 h-9 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-400 mb-2">
              💬
            </div>
            <p className="font-semibold text-slate-600">Chưa có trao đổi nào</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gõ @ để nhắc tên nhân viên hoặc đính kèm văn bản vào cuộc trao đổi
            </p>
          </div>
        ) : (
          activeComments.map((comment) => {
            const isMe = comment.authorId === actorId
            const isAlreadyInTask = taskDocumentIds.includes(comment.attachedDocId || '')

            return (
              <ChatMessageBubble
                key={comment.id}
                id={comment.id}
                authorId={comment.authorId}
                authorName={comment.authorName}
                content={comment.content}
                createdAt={comment.createdAt}
                isMe={isMe}
                canDelete={isMe}
                onDelete={() => handleDelete(comment.id)}
                attachedDocId={comment.attachedDocId}
                attachedDocMetadata={comment.attachedDocMetadata}
                mentions={comment.mentions}
                onLinkToTask={onLinkDocumentToTask ? (docId, meta) => onLinkDocumentToTask(docId, meta) : undefined}
                isAlreadyInTask={isAlreadyInTask}
                onAttachFileToDoc={onAttachFileToDoc}
                onCreateDocFromMessage={onCreateDocFromMessage}
              />
            )
          })
        )}
      </div>

      {/* Input bar */}
      {canComment && (
        <MentionTextarea
          onSend={handleSend}
          contextDocIds={taskDocumentIds}
          externalAttachedDoc={externalDraftDoc}
          onClearExternalAttachedDoc={onClearExternalDraftDoc}
        />
      )}
    </div>
  )
}
