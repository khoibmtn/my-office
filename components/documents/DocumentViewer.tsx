'use client'

import { useState } from 'react'
import { Document } from '@/types'
import { Badge } from '@/components/ui/badge'
import { AttachmentPanel } from './AttachmentPanel'
import { parseFileNameFromUrl, getStructuredMainFileName } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { IframePreview } from './IframePreview'

interface DocumentViewerProps {
  doc: Document
}

export function DocumentViewer({ doc }: DocumentViewerProps) {
  const { user } = useAuth()
  const [activeUrl, setActiveUrl] = useState(doc.driveViewUrl ?? '')

  const tabs = [
    { label: doc.originalLink ? parseFileNameFromUrl(doc.originalLink, getStructuredMainFileName(doc)) : getStructuredMainFileName(doc), driveViewUrl: doc.driveViewUrl ?? '' },
    ...(doc.attachments ?? []).map((a, i) => ({
      label: `Đính kèm ${i + 1}`,
      driveViewUrl: a.driveViewUrl,
    })),
  ]

  return (
    <div className="flex h-screen">
      {/* Left panel: 40% */}
      <div className="w-2/5 overflow-y-auto border-r p-4">
        <h1 className="text-xl font-semibold leading-tight mb-2">{doc.title}</h1>
        <Badge className="mb-3">{doc.status}</Badge>
        {doc.sender && (
          <p className="text-sm text-slate-600 mb-1"><span className="font-semibold text-slate-700">Cơ quan ban hành:</span> {doc.sender}</p>
        )}
        {doc.leader && (
          <p className="text-sm text-slate-600 mb-1"><span className="font-semibold text-slate-700">Lãnh đạo:</span> {doc.leader}</p>
        )}
        {doc.deadline && (() => {
          const now = new Date(); now.setHours(0,0,0,0)
          const dl = doc.deadline.toDate(); dl.setHours(0,0,0,0)
          const days = Math.ceil((dl.getTime() - now.getTime()) / 86400000)
          const daysText = days < 0 ? ` (quá ${Math.abs(days)} ngày)` : days === 0 ? ' (hôm nay!)' : ` (còn ${days} ngày)`
          const isWarning = days <= 3
          return (
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-semibold text-slate-700">Deadline:</span>{' '}
              <span className={isWarning ? "font-bold text-red-600" : ""}>
                {doc.deadline.toDate().toLocaleDateString('vi-VN')}
                <strong style={{color: days <= 1 ? '#ef4444' : days <= 3 ? '#f59e0b' : '#22c55e', marginLeft: '4px'}}>{daysText}</strong>
              </span>
            </p>
          )
        })()}
        <p className="text-sm text-slate-600 mb-2">
          <span className="font-semibold text-slate-700">Người được giao:</span>{' '}
          {(!doc.assignee || doc.assignee === user?.displayName) ? (
            <span className="text-slate-400 italic">Chưa giao</span>
          ) : (
            doc.assignee
          )}
        </p>
        {(() => {
          const lines = (doc.notes || '').split('\n').map(l => l.trim()).filter(Boolean)
          const filtered = lines.filter(l => {
            if (doc.sender && l.includes(doc.sender) && /^(CQBH|CQ ban hành)/i.test(l)) return false
            if (doc.leader && l.includes(doc.leader) && /^Lãnh đạo/i.test(l)) return false
            return true
          })
          
          return (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
              <p className="text-xs font-semibold text-amber-800 mb-1">📝 Ghi chú cá nhân:</p>
              <p className={filtered.length === 0 ? "text-sm text-slate-400 italic" : "text-sm text-amber-900 whitespace-pre-wrap"}>
                {filtered.length === 0 ? 'Không có' : filtered.join('\n')}
              </p>
            </div>
          )
        })()}
        {doc.tags && doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {doc.tags.map((tag) => (
              <Badge key={tag} className="bg-slate-100 text-slate-700">{tag}</Badge>
            ))}
          </div>
        )}
        <AttachmentPanel attachments={doc.attachments ?? []} onTabSelect={setActiveUrl} />
      </div>

      {/* Right panel: 60% */}
      <div className="flex-1 flex flex-col">
        <IframePreview tabs={tabs} activeUrl={activeUrl} onTabChange={setActiveUrl} />
      </div>
    </div>
  )
}
