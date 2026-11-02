'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { X, Search, FileText, Paperclip } from 'lucide-react'
import { useDocuments } from '@/hooks/useDocuments'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { Document } from '@/types'
import type { AttachedDocMetadata } from '@/types/tasks'

interface DocAttachmentPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDoc: (metadata: AttachedDocMetadata) => void
  contextDocIds?: string[]
  title?: string
}

function formatDate(ts: any): string {
  if (!ts) return ''
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : ts instanceof Date ? ts : new Date(ts)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

export function DocAttachmentPickerModal({
  isOpen,
  onClose,
  onSelectDoc,
  contextDocIds = [],
  title = 'Chọn văn bản đính kèm vào tin nhắn',
}: DocAttachmentPickerModalProps) {
  const { documents } = useDocuments()
  const [activeTab, setActiveTab] = useState<'context' | 'all'>(
    contextDocIds.length > 0 ? 'context' : 'all'
  )
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches) {
      const id = requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isOpen])

  // Context docs (belonging to current task/dossier)
  const contextDocs = useMemo(() => {
    if (!contextDocIds.length) return []
    return documents.filter(d => contextDocIds.includes(d.id))
  }, [documents, contextDocIds])

  // Filtered docs based on active tab & search query
  const displayedDocs = useMemo(() => {
    const base = activeTab === 'context' && contextDocIds.length > 0 ? contextDocs : documents
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(d =>
      (d.title && d.title.toLowerCase().includes(q)) ||
      (d.docNumber && d.docNumber.toLowerCase().includes(q)) ||
      (d.sender && d.sender.toLowerCase().includes(q))
    )
  }, [activeTab, contextDocIds, contextDocs, documents, search])

  const handleChoose = (doc: Document) => {
    const files = []

    if (doc.driveViewUrl || doc.originalLink) {
      files.push({
        title: doc.title || doc.docNumber || 'Văn bản chính',
        driveViewUrl: doc.driveViewUrl || doc.originalLink,
        originalLink: doc.originalLink,
        mimeType: doc.mimeType,
        isAttachment: false,
      })
    }

    if (doc.attachments?.length) {
      for (const att of doc.attachments) {
        const url = att.driveViewUrl || att.originalLink
        if (url) {
          files.push({
            id: att.id,
            title: att.title || 'Tệp đính kèm',
            driveViewUrl: url,
            originalLink: att.originalLink,
            mimeType: att.mimeType,
            isAttachment: true,
          })
        }
      }
    }

    const metadata: AttachedDocMetadata = {
      docId: doc.id,
      docNumber: doc.docNumber,
      title: doc.title || doc.docNumber || 'Văn bản',
      sender: doc.sender,
      issueDate: doc.issueDate ? formatDate(doc.issueDate) : undefined,
      driveViewUrl: doc.driveViewUrl || doc.originalLink,
      originalLink: doc.originalLink,
      files,
    }

    onSelectDoc(metadata)
    onClose()
  }

  return (
    <ResponsiveModal
      open={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FileText className="w-4 h-4" />
          </span>
          <span className="min-w-0 block">
            <span className="text-sm font-bold text-slate-800 leading-tight truncate block">{title}</span>
            <span className="text-[11px] font-normal text-slate-500 truncate block">
              Người xem có thể mở xem trực tiếp trong chat
            </span>
          </span>
        </span>
      }
      className="sm:max-w-xl"
    >
      <div className="flex flex-col">
        {/* Tabs & Search */}
        <div className="pb-3 border-b border-slate-100 space-y-2.5 bg-white">
          {contextDocIds.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('context')}
                className={`flex-1 py-1 max-lg:min-h-[36px] text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'context'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Trong mục này ({contextDocs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1 max-lg:min-h-[36px] text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tất cả văn bản ({documents.length})
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo số hiệu, trích yếu, nơi ban hành..."
              className="w-full pl-8 pr-8 py-1.5 text-base md:text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto pt-2 space-y-1.5 divide-y divide-slate-100 max-h-[60dvh] sm:max-h-96">
          {displayedDocs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-1 text-slate-300 opacity-60" />
              Không tìm thấy văn bản phù hợp
            </div>
          ) : (
            displayedDocs.map((doc) => {
              const fileCount = (doc.driveViewUrl || doc.originalLink ? 1 : 0) + (doc.attachments?.length || 0)
              return (
                <div
                  key={doc.id}
                  onClick={() => handleChoose(doc)}
                  className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-blue-50/60 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {doc.docNumber && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {doc.docNumber}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-800 truncate block" title={doc.title}>
                          {doc.title || 'Văn bản không tên'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 mt-0.5">
                        {doc.sender && <span className="text-red-600 font-medium italic">{doc.sender}</span>}
                        {doc.issueDate && <span>Ngày: {formatDate(doc.issueDate)}</span>}
                        {fileCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium">
                            <Paperclip className="w-2.5 h-2.5" /> {fileCount} tệp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleChoose(doc)
                    }}
                    className="hover-reveal max-lg:opacity-100 max-lg:min-h-[36px] max-lg:px-3 shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center"
                  >
                    Chọn
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </ResponsiveModal>
  )
}
