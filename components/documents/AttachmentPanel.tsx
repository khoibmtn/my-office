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
      <div className="space-y-2">
        {attachments.map((att) => {
          const driveLink = att.driveFileId
            ? `https://drive.google.com/file/d/${att.driveFileId}/view`
            : (att.driveViewUrl || '#')
          return (
            <div key={att.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-h-[44px]">
              <span className="w-full sm:w-auto sm:flex-1 text-sm truncate min-w-0">{att.title}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[40px] min-w-[40px]"
                  onClick={() => onTabSelect(att.driveViewUrl)}
                  disabled={!att.driveViewUrl}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Xem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[40px] min-w-[40px]"
                  onClick={() => navigator.clipboard.writeText(att.driveViewUrl)}
                  disabled={!att.driveViewUrl}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy link
                </Button>
                <Button variant="ghost" size="sm" className="min-h-[40px] min-w-[40px]" asChild>
                  <a
                    href={driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Mở Drive
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
