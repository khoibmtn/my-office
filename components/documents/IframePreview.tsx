'use client'

import { ExternalLink } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { extractDriveFileId } from '@/lib/link-detector'

interface Tab {
  label: string
  driveViewUrl: string
  driveFileId?: string
}

interface IframePreviewProps {
  tabs: Tab[]
  activeUrl: string
  onTabChange: (url: string) => void
  driveOpenUrl?: string
  driveOpenLabel?: string
}

export function IframePreview({
  tabs,
  activeUrl,
  onTabChange,
  driveOpenUrl,
  driveOpenLabel = 'Mở trong Google Drive',
}: IframePreviewProps) {
  const activeTab = activeUrl ? tabs.find((t) => t.driveViewUrl === activeUrl) : undefined
  const resolvedDriveId = activeTab
    ? (activeTab.driveFileId || (activeTab.driveViewUrl ? extractDriveFileId(activeTab.driveViewUrl) : '') || '')
    : (activeUrl ? (extractDriveFileId(activeUrl) || '') : '')
  const resolvedDriveLink =
    driveOpenUrl !== undefined
      ? driveOpenUrl
      : (resolvedDriveId ? `https://drive.google.com/file/d/${resolvedDriveId}/view` : '')

  return (
    <Tabs value={activeUrl} onValueChange={onTabChange} className="flex flex-col h-full w-full min-w-0">
      <div className="flex items-center justify-between gap-2 max-md:p-2 bg-slate-50 max-md:border-b border-slate-200 shrink-0 flex-wrap min-w-0">
        <TabsList className="shrink-0 max-md:h-auto max-md:min-h-[40px] max-w-full overflow-x-auto justify-start">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.label}
              value={tab.driveViewUrl}
              disabled={tab.driveViewUrl === ''}
              className="max-md:min-h-[40px]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {resolvedDriveLink && (
          <a
            href={resolvedDriveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-[40px] rounded-md text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span>{driveOpenLabel}</span>
          </a>
        )}
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.label} value={tab.driveViewUrl} className="flex-1 mt-0 w-full min-h-[70dvh] lg:min-h-0">
          {tab.driveViewUrl === '' ? (
            <div className="flex items-center justify-center h-[70dvh] lg:h-full text-sm text-slate-500">
              Đang tải lên...
            </div>
          ) : (
            <iframe
              src={tab.driveViewUrl}
              className="w-full h-[70dvh] lg:h-full border-0"
              allow="fullscreen"
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
