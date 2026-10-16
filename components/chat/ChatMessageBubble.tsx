'use client'

import React, { useState } from 'react'
import {
  FileText, ExternalLink, Copy, Check, MoreHorizontal,
  FolderPlus, Folder, Paperclip, Trash2, FilePlus, Link as LinkIcon
} from 'lucide-react'
import type { AttachedDocMetadata } from '@/types/tasks'

interface ChatMessageBubbleProps {
  id: string
  authorId: string
  authorName: string
  content: string
  createdAt: any
  isMe: boolean
  canDelete?: boolean
  onDelete?: () => void
  attachedDocId?: string | null
  attachedDocMetadata?: AttachedDocMetadata | null
  mentions?: string[]

  // Action callbacks for bi-directional linking
  onLinkToTask?: (docId: string, metadata?: AttachedDocMetadata | null) => void
  isAlreadyInTask?: boolean
  onLinkToDossier?: (docId: string, metadata?: AttachedDocMetadata | null) => void
  isAlreadyInDossier?: boolean
  onAttachFileToDoc?: (fileUrl: string, fileName: string) => void
  onCreateDocFromMessage?: (content: string, metadata?: AttachedDocMetadata | null) => void
}

function formatCommentTime(ts: any): string {
  if (!ts) return ''
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : ts instanceof Date ? ts : new Date(ts.seconds ? ts.seconds * 1000 : ts)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins}p trước`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h trước`
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Parses text and highlights @mentions and URLs
 */
function renderMessageContent(content: string, isMe: boolean) {
  if (!content) return null

  // Regex to match @mentions and URLs
  const regex = /(@[\w\p{L}]+|https?:\/\/[^\s]+)/gu
  const parts = content.split(regex)

  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={index}
          className={`inline-flex items-center px-1 py-0.2 rounded font-semibold text-[11px] mx-0.5 ${
            isMe
              ? 'bg-blue-400 text-white font-bold'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {part}
        </span>
      )
    }
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className={`underline mx-0.5 break-all ${isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
        >
          {part}
        </a>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export function ChatMessageBubble({
  id,
  authorName,
  content,
  createdAt,
  isMe,
  canDelete = false,
  onDelete,
  attachedDocId,
  attachedDocMetadata,
  onLinkToTask,
  isAlreadyInTask = false,
  onLinkToDossier,
  isAlreadyInDossier = false,
  onAttachFileToDoc,
  onCreateDocFromMessage,
}: ChatMessageBubbleProps) {
  const [copiedFileUrl, setCopiedFileUrl] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedFileUrl(url)
      setTimeout(() => setCopiedFileUrl(null), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  // Detect URL in content if any
  const detectedUrl = content.match(/https?:\/\/[^\s]+/)?.[0]

  return (
    <div className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'} mb-3`}>
      <div className={`relative max-w-[90%] sm:max-w-[85%] flex items-start gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Main message card */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed break-words shadow-2xs ${
            isMe
              ? 'bg-blue-600 text-white rounded-tr-xs'
              : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
          }`}
        >
          {/* Author name (for others) */}
          {!isMe && (
            <div className="font-bold text-[11px] text-blue-700 mb-1 select-none flex items-center gap-1">
              <span>{authorName}</span>
            </div>
          )}

          {/* Text Content */}
          {content && (
            <p className="whitespace-pre-line leading-relaxed">
              {renderMessageContent(content, isMe)}
            </p>
          )}

          {/* Rich Document Card (if attached) */}
          {attachedDocMetadata && (
            <div className={`mt-2 p-2.5 rounded-xl border text-xs ${
              isMe ? 'bg-white text-slate-800 border-blue-200 shadow-xs' : 'bg-slate-50 text-slate-800 border-slate-200'
            }`}>
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {attachedDocMetadata.docNumber && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                        {attachedDocMetadata.docNumber}
                      </span>
                    )}
                    <span className="font-bold text-slate-900 truncate block">
                      {attachedDocMetadata.title}
                    </span>
                  </div>
                  {attachedDocMetadata.sender && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Nơi phát hành: <span className="font-medium text-red-600 italic">{attachedDocMetadata.sender}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Files inside document */}
              {attachedDocMetadata.files && attachedDocMetadata.files.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1">
                  {attachedDocMetadata.files.map((file, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white border border-slate-200/80 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate font-medium text-slate-700 max-w-[150px] sm:max-w-[200px]" title={file.title}>
                          {file.title}
                        </span>
                        <span className="text-[9px] px-1 rounded text-slate-500 bg-slate-100">
                          {file.isAttachment ? 'Đính kèm' : 'Chính'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={file.driveViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Mở xem file"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(file.driveViewUrl)}
                          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Sao chép link file"
                        >
                          {copiedFileUrl === file.driveViewUrl ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Time & status */}
          <div className={`text-[9px] mt-1 select-none flex items-center justify-end gap-1 ${
            isMe ? 'text-blue-200' : 'text-slate-400'
          }`}>
            <span>{formatCommentTime(createdAt)}</span>
          </div>
        </div>

        {/* Actions Button (...) */}
        <div className="relative shrink-0 self-center">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors opacity-0 group-hover:opacity-100"
            title="Thao tác tin nhắn"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Context Action Menu */}
          {showMenu && (
            <div
              className={`absolute top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-48 text-xs text-slate-700 animate-in fade-in duration-100 ${
                isMe ? 'right-0' : 'left-0'
              }`}
            >
              {/* Option: Link to current task */}
              {onLinkToTask && attachedDocMetadata && !isAlreadyInTask && (
                <button
                  type="button"
                  onClick={() => {
                    onLinkToTask(attachedDocMetadata.docId, attachedDocMetadata)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                  Gắn vào công việc này
                </button>
              )}

              {/* Option: Link to current dossier */}
              {onLinkToDossier && attachedDocMetadata && !isAlreadyInDossier && (
                <button
                  type="button"
                  onClick={() => {
                    onLinkToDossier(attachedDocMetadata.docId, attachedDocMetadata)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-600" />
                  Lưu vào hồ sơ này
                </button>
              )}

              {/* Option: Attach file to an existing document */}
              {onAttachFileToDoc && (detectedUrl || attachedDocMetadata?.driveViewUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    const url = detectedUrl || attachedDocMetadata?.driveViewUrl || ''
                    const name = attachedDocMetadata?.title || 'Tài liệu từ trao đổi'
                    onAttachFileToDoc(url, name)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2"
                >
                  <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                  Gắn tệp vào văn bản có sẵn
                </button>
              )}

              {/* Option: Create new document from message */}
              {onCreateDocFromMessage && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateDocFromMessage(content, attachedDocMetadata)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FilePlus className="w-3.5 h-3.5 text-slate-500" />
                  Tạo văn bản từ tin nhắn
                </button>
              )}

              {/* Option: Delete */}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa tin nhắn
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
