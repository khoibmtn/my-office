'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, FileCheck2, Loader2, Pencil } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useAdvisoryDocs } from '@/hooks/useAdvisoryDocs'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { formatAdvisoryLine, sortAdvisory } from '@/lib/weekly-report/advisory-format'
import { formatDMY } from '@/lib/weekly-report/period'
import { AdvisoryButton } from '@/components/weekly-report/AdvisoryButton'
import { AdvisoryForm } from '@/components/weekly-report/AdvisoryForm'
import type { AdvisoryDoc } from '@/types/weekly-report'
import type { Document } from '@/types'

export interface DocumentAdvisorySectionProps {
  document: Document
  onNavigate?: () => void
  onDocumentUpdated?: () => void
}

export function DocumentAdvisorySection(props: DocumentAdvisorySectionProps) {
  const { isAdmin, loading } = useRole()
  if (loading || !isAdmin) return null
  return <DocumentAdvisorySectionContent {...props} />
}

function DocumentAdvisorySectionContent({
  document,
  onNavigate,
  onDocumentUpdated,
}: DocumentAdvisorySectionProps) {
  const { docs, loading } = useAdvisoryDocs({ sourceDocumentId: document.id })
  const { config } = useWeeklyReportConfig()
  const [editingDoc, setEditingDoc] = useState<AdvisoryDoc | null>(null)

  const sortedDocs = useMemo(() => sortAdvisory(docs), [docs])
  const typeLabelMap = useMemo(
    () => new Map(config.docTypes.map((t) => [t.code, t.label])),
    [config.docTypes],
  )

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="px-3 py-1.5 bg-emerald-100/70 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-bold text-emerald-950">
            Văn bản đã tham mưu từ văn bản này ({sortedDocs.length})
          </span>
        </div>
        <AdvisoryButton
          document={document}
          label="Tham mưu"
          size="sm"
          className="bg-white"
          onSaved={() => onDocumentUpdated?.()}
        />
      </div>

      {/* Body */}
      <div className="p-3">
        {loading ? (
          <div className="py-3 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Đang tải...</span>
          </div>
        ) : sortedDocs.length === 0 ? (
          <div className="text-xs text-slate-600 py-1 space-y-1">
            <p className="font-medium text-slate-700">
              Chưa có văn bản tham mưu nào từ văn bản này.
            </p>
            <p className="text-slate-500">
              Bấm nút &ldquo;Tham mưu&rdquo; ở trên sau khi soạn xong công văn, kế hoạch hoặc thông báo triển khai.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedDocs.map((adv) => (
              <li
                key={adv.id}
                className={`rounded-lg border p-2.5 bg-white space-y-1.5 ${
                  adv.highlight ? 'border-red-300 bg-red-50/40' : 'border-emerald-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm leading-snug break-words flex-1 min-w-0 ${
                      adv.highlight ? 'text-red-700 font-bold' : 'text-slate-900 font-medium'
                    }`}
                  >
                    {formatAdvisoryLine(adv)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingDoc(adv)}
                    title="Sửa hoặc xoá văn bản tham mưu"
                    className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] sm:min-w-[32px] sm:min-h-[32px] px-2 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-xs font-medium shrink-0 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>{typeLabelMap.get(adv.type) || adv.type}</span>
                  <span>Ngày {formatDMY(adv.advisedDate)}</span>
                  {adv.docNumber && <span>Số: {adv.docNumber}</span>}
                  <Link
                    href={`/weekly-reports/${adv.weekId}`}
                    onClick={onNavigate}
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                  >
                    Tuần {formatDMY(adv.weekId)}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                  {adv.draftLink && /^https?:\/\//i.test(adv.draftLink) && (
                    <a
                      href={adv.draftLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                    >
                      Bản thảo
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdvisoryForm
        open={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        editingDoc={editingDoc}
        onSaved={() => onDocumentUpdated?.()}
        onDeleted={() => onDocumentUpdated?.()}
      />
    </div>
  )
}
