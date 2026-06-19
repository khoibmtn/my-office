'use client'

import { Attachment } from '@/types'
import { Button } from '@/components/ui/button'
import { Eye, Copy, ExternalLink } from 'lucide-react'

interface AttachmentPanelProps {
  attachments: Attachment[]
  onTabSelect: (driveViewUrl: string) => void
}

export function AttachmentPanel({ attachments, onTabSelect }: AttachmentPanelProps) {
  if (attachments.length === 0) return null

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-slate-700 mb-2">File đính kèm</p>
      <div className="space-y-1">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-2 min-h-[44px]">
            <span className="flex-1 text-sm truncate">{att.title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabSelect(att.driveViewUrl)}
              disabled={!att.driveViewUrl}
            >
              <Eye className="h-4 w-4 mr-1" />
              Xem
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(att.driveViewUrl)}
              disabled={!att.driveViewUrl}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy link
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={att.driveViewUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Mở Drive
              </a>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
