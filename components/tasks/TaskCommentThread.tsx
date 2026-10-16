'use client'

import React, { useRef, useEffect } from 'react'
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
  const bottomRef = useRef<HTMLDivElement>(null)

  // Filter non-deleted comments
  const activeComments = comments.filter(c => !c.deletedAt)

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeComments.length])

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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
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
        <div ref={bottomRef} />
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
