'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ClipboardPaste,
  ExternalLink,
  Highlighter,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdvisoryDocs } from '@/hooks/useAdvisoryDocs'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { useWeeks } from '@/hooks/useWeeks'
import {
  formatAdvisoryLine,
  formatAdvisorySummary,
  sortAdvisoryForReport,
  sameReportSlot,
} from '@/lib/weekly-report/advisory-format'
import { updateAdvisoryDoc } from '@/lib/weekly-report/firestore'
import { formatDMY, resolvePeriod, todayVN } from '@/lib/weekly-report/period'
import type { AdvisoryDoc, AdvisorySourceSnapshot } from '@/types/weekly-report'
import { AdvisoryForm } from './AdvisoryForm'
import { BulkPasteDialog } from './BulkPasteDialog'

export interface AdvisoryListProps {
  weekId: string
  editable: boolean
}

function renderSummaryWithHighlight(summary: string) {
  const parts = summary.split(/(\b\d+\s+văn bản\b)/)
  return parts.map((part, idx) =>
    /^\d+\s+văn bản$/.test(part) ? (
      <mark
        key={idx}
        className="bg-yellow-200/80 text-slate-900 px-1.5 py-0.5 rounded font-semibold"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    ),
  )
}

function getSourceLinks(doc: AdvisoryDoc): AdvisorySourceSnapshot[] {
  if (doc.sourceSnapshot && doc.sourceSnapshot.length > 0) {
    return doc.sourceSnapshot
  }
  return (doc.sourceDocumentIds ?? []).map((id) => ({
    id,
    docNumber: '',
    title: '',
    sender: '',
    issueDate: null,
  }))
}

export function AdvisoryList({ weekId, editable }: AdvisoryListProps) {
  const { docs, loading } = useAdvisoryDocs({ weekId })
  const { config } = useWeeklyReportConfig()
  const { weeks } = useWeeks()

  const [formOpen, setFormOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<AdvisoryDoc | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const sortedDocs = useMemo(() => sortAdvisoryForReport(docs, config.docTypes), [docs, config.docTypes])
  const summaryText = useMemo(
    () => formatAdvisorySummary(sortedDocs, config.docTypes),
    [sortedDocs, config.docTypes],
  )
  const maxOrder = useMemo(
    () => sortedDocs.reduce((m, d) => Math.max(m, d.order), -1),
    [sortedDocs],
  )

  const period = useMemo(() => resolvePeriod(weekId, weeks), [weekId, weeks])
  const defaultAdvisedDate = useMemo(() => {
    const today = todayVN()
    if (today >= period.periodStart && today <= period.periodEnd) return today
    return period.periodEnd
  }, [period.periodStart, period.periodEnd])

  const handleToggleHighlight = async (doc: AdvisoryDoc) => {
    setBusyId(doc.id)
    setActionError(null)
    try {
      await updateAdvisoryDoc(doc.id, { highlight: !doc.highlight })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể đổi trạng thái tô đỏ.')
    } finally {
      setBusyId(null)
    }
  }

  const handleMove = async (index: number, delta: -1 | 1) => {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= sortedDocs.length) return
    const current = sortedDocs[index]
    const neighbor = sortedDocs[targetIndex]
    if (!sameReportSlot(current, neighbor)) return

    const sameDateGroup = sortedDocs.filter((d) => sameReportSlot(d, current))
    const posInGroup = sameDateGroup.findIndex((d) => d.id === current.id)
    const targetPosInGroup = posInGroup + delta
    if (posInGroup < 0 || targetPosInGroup < 0 || targetPosInGroup >= sameDateGroup.length) return

    const reordered = [...sameDateGroup]
    const [moved] = reordered.splice(posInGroup, 1)
    reordered.splice(targetPosInGroup, 0, moved)

    setBusyId(current.id)
    setActionError(null)
    try {
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].order !== i) {
          await updateAdvisoryDoc(reordered[i].id, { order: i })
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể đổi thứ tự văn bản.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section
      aria-label="Văn bản tham mưu trong tuần"
      className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3"
    >
      {/* Summary line */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <p className="text-sm font-medium text-slate-900 leading-relaxed">
          • {renderSummaryWithHighlight(summaryText)}
        </p>
        <Link
          href="/weekly-reports/advisory"
          className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Sổ tham mưu
        </Link>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-6 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Đang tải văn bản tham mưu...</span>
        </div>
      ) : sortedDocs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Chưa có văn bản tham mưu nào trong tuần này.</p>
          {editable ? (
            <p className="mt-1 text-xs text-slate-600">
              Bấm &ldquo;+ Thêm văn bản tham mưu&rdquo; để nhập mới hoặc &ldquo;Dán nhiều dòng&rdquo; để chép nhanh từ danh sách có sẵn.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Chuyển sang chế độ chỉnh sửa hoặc bấm nút Tham mưu trên văn bản để bổ sung.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sortedDocs.map((doc, idx) => {
            const sources = getSourceLinks(doc)
            const canMoveUp = idx > 0 && sortedDocs[idx - 1].advisedDate === doc.advisedDate
            const canMoveDown =
              idx < sortedDocs.length - 1 && sortedDocs[idx + 1].advisedDate === doc.advisedDate
            const isBusy = busyId === doc.id

            return (
              <li
                key={doc.id}
                className={`py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 ${
                  doc.highlight ? 'pl-3 border-l-4 border-red-600 bg-red-50/40 rounded-r-lg pr-2' : ''
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p
                    className={`text-sm leading-relaxed break-words ${
                      doc.highlight ? 'text-red-700 font-bold' : 'text-slate-900 font-normal'
                    }`}
                  >
                    {formatAdvisoryLine(doc)}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                    <span>Ngày {formatDMY(doc.advisedDate)}</span>
                    {doc.docNumber && (
                      <span className="font-medium text-slate-700">Số: {doc.docNumber}</span>
                    )}
                    {sources.map((src) => (
                      <Link
                        key={src.id}
                        href={`/documents/${src.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-2 py-0.5 font-medium transition-colors"
                        title={src.title || 'Mở văn bản gốc'}
                      >
                        <span>↩ {src.docNumber || src.title || 'VB gốc'}</span>
                      </Link>
                    ))}
                    {doc.draftLink && /^https?:\/\//i.test(doc.draftLink) && (
                      <a
                        href={doc.draftLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                      >
                        Bản thảo
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {doc.note && (
                    <p className="text-xs text-slate-500 whitespace-pre-wrap">{doc.note}</p>
                  )}
                </div>

                {editable && (
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={!canMoveUp || isBusy}
                      onClick={() => handleMove(idx, -1)}
                      title={
                        canMoveUp
                          ? 'Đưa lên trên'
                          : 'Chỉ đổi thứ tự giữa các văn bản cùng ngày tham mưu'
                      }
                      aria-label="Đưa lên trên"
                      className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] sm:min-w-[28px] sm:min-h-[28px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!canMoveDown || isBusy}
                      onClick={() => handleMove(idx, 1)}
                      title={
                        canMoveDown
                          ? 'Đưa xuống dưới'
                          : 'Chỉ đổi thứ tự giữa các văn bản cùng ngày tham mưu'
                      }
                      aria-label="Đưa xuống dưới"
                      className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] sm:min-w-[28px] sm:min-h-[28px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleHighlight(doc)}
                      title={doc.highlight ? 'Bỏ tô đỏ' : 'Tô đỏ (đỏ + đậm)'}
                      className={`min-h-[44px] sm:min-h-[28px] px-2.5 inline-flex items-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
                        doc.highlight
                          ? 'border-red-300 bg-red-100 text-red-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <Highlighter className="w-3.5 h-3.5" />
                      <span>Đỏ</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setEditingDoc(doc)
                        setFormOpen(true)
                      }}
                      title="Sửa hoặc xoá văn bản tham mưu"
                      className="min-h-[44px] sm:min-h-[28px] px-2.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-xs font-medium transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Action bar */}
      {editable && (
        <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditingDoc(null)
              setFormOpen(true)
            }}
            className="min-h-[44px] sm:min-h-[32px] text-sm gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          >
            <Plus className="w-4 h-4" />
            Thêm văn bản tham mưu
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setBulkOpen(true)}
            className="min-h-[44px] sm:min-h-[32px] text-sm gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <ClipboardPaste className="w-4 h-4" />
            Dán nhiều dòng
          </Button>
        </div>
      )}

      <AdvisoryForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingDoc(null)
        }}
        editingDoc={editingDoc}
        defaultWeekId={weekId}
        defaultAdvisedDate={defaultAdvisedDate}
      />

      <BulkPasteDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        weekId={weekId}
        existingMaxOrder={maxOrder}
      />
    </section>
  )
}
