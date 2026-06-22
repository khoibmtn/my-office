'use client'

import { useState } from 'react'
import { Document } from '@/types'
import { Badge } from '@/components/ui/badge'
import { AttachmentPanel } from './AttachmentPanel'
import { parseFileNameFromUrl } from '@/lib/utils'
import { IframePreview } from './IframePreview'

interface DocumentViewerProps {
  doc: Document
}

export function DocumentViewer({ doc }: DocumentViewerProps) {
  const [activeUrl, setActiveUrl] = useState(doc.driveViewUrl ?? '')

  const tabs = [
    { label: doc.originalLink ? parseFileNameFromUrl(doc.originalLink, 'File chính') : 'File chính', driveViewUrl: doc.driveViewUrl ?? '' },
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
        {doc.deadline && (
          <p className="text-sm text-slate-600 mb-1"><span className="font-semibold text-slate-700">Deadline:</span> {doc.deadline.toDate().toLocaleDateString('vi-VN')}</p>
        )}
        {doc.assignee && (
          <p className="text-sm text-slate-600 mb-2"><span className="font-semibold text-slate-700">Người nhận:</span> {doc.assignee}</p>
        )}
        {doc.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
            <p className="text-xs font-semibold text-amber-800 mb-1">📝 Ghi chú cá nhân:</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{doc.notes}</p>
          </div>
        )}
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
