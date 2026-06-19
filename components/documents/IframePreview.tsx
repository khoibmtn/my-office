'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Tab {
  label: string
  driveViewUrl: string
}

interface IframePreviewProps {
  tabs: Tab[]
  activeUrl: string
  onTabChange: (url: string) => void
}

export function IframePreview({ tabs, activeUrl, onTabChange }: IframePreviewProps) {
  return (
    <Tabs value={activeUrl} onValueChange={onTabChange} className="flex flex-col h-full">
      <TabsList className="shrink-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.label}
            value={tab.driveViewUrl}
            disabled={tab.driveViewUrl === ''}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.label} value={tab.driveViewUrl} className="flex-1 mt-0">
          {tab.driveViewUrl === '' ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              Đang tải lên...
            </div>
          ) : (
            <iframe
              src={tab.driveViewUrl}
              className="w-full h-full border-0"
              allow="fullscreen"
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
