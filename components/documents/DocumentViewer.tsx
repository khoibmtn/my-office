'use client'

import { useState } from 'react'
import { Document } from '@/types'
import { Badge } from '@/components/ui/badge'
import { AttachmentPanel } from './AttachmentPanel'
import { IframePreview } from './IframePreview'

interface DocumentViewerProps {
  doc: Document
}

export function DocumentViewer({ doc }: DocumentViewerProps) {
  const [activeUrl, setActiveUrl] = useState(doc.driveViewUrl ?? '')

  const tabs = [
    { label: 'File chính', driveViewUrl: doc.driveViewUrl ?? '' },
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
        {doc.deadline && (
          <p className="text-sm text-slate-600 mb-1">
            Deadline: {doc.deadline.toDate().toLocaleDateString('vi-VN')}
          </p>
        )}
        {doc.assignee && (
          <p className="text-sm text-slate-600 mb-1">Người nhận: {doc.assignee}</p>
        )}
        {doc.notes && (
          <p className="text-sm text-slate-600 mb-2">{doc.notes}</p>
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
