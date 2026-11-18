'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Printer } from 'lucide-react'
import { formatDMY } from '@/lib/weekly-report/period'
import {
  formatAdvisoryLine,
  formatAdvisorySummary,
  sortAdvisory,
} from '@/lib/weekly-report/advisory-format'
import { RichViewer, isRichSectionEmpty } from './RichViewer'
import {
  formatStatDiff,
  formatStatNumber,
  parseStatsSnapshot,
  type WeeklyStatsRow,
} from './WeeklyStatsPanel'
import {
  RICH_SECTION_LABELS,
  type AdvisoryDoc,
  type WeeklyReport,
  type WeeklyReportConfig,
} from '@/types/weekly-report'

export interface ReadingViewProps {
  report: WeeklyReport
  advisoryDocs: AdvisoryDoc[]
  config: WeeklyReportConfig
  onExit: () => void
}

export function ReadingView({
  report,
  advisoryDocs,
  config,
  onExit,
}: ReadingViewProps) {
  const stats = useMemo(
    () => parseStatsSnapshot(report.statsSnapshotJson),
    [report.statsSnapshotJson],
  )
  const [showStats, setShowStats] = useState<boolean>(Boolean(stats && stats.rows.length > 0))

  useEffect(() => {
    setShowStats(Boolean(stats && stats.rows.length > 0))
  }, [stats])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onExit])

  const meetingDateStr = formatDMY(report.actualMeetingDate || report.meetingDate)
  const reportTitle = config.reportTitle || 'Báo cáo giao ban Lãnh đạo tuần'
  const unitHeading = report.unitHeading || config.unitHeading || '1. KHTH'
  const deputyLabel = config.deputySectionLabel || RICH_SECTION_LABELS.deputyOpinions

  const nonEmptyWorkItems = useMemo(() => {
    return report.workItems
      .map((item) => ({
        ...item,
        children: item.children.filter((c) => c.text.trim().length > 0),
      }))
      .filter((item) => item.text.trim().length > 0 || item.children.length > 0)
  }, [report.workItems])

  const sortedAdvisory = useMemo(() => sortAdvisory(advisoryDocs), [advisoryDocs])
  const advisorySummary = useMemo(
    () => formatAdvisorySummary(sortedAdvisory, config.docTypes),
    [sortedAdvisory, config.docTypes],
  )

  const hasSection1 = nonEmptyWorkItems.length > 0 || sortedAdvisory.length > 0
  const showOpinions = !isRichSectionEmpty(report.sections.opinions)
  const showNextWeek = !isRichSectionEmpty(report.sections.nextWeek)
  const showProposedSchedule = !isRichSectionEmpty(report.sections.proposedSchedule)
  const showDeputyOpinions = !isRichSectionEmpty(report.sections.deputyOpinions)

  const groupedStats = useMemo(() => {
    if (!stats) return []
    const groups = new Map<string, WeeklyStatsRow[]>()
    for (const row of stats.rows) {
      const key = row.group || 'Chỉ tiêu'
      const arr = groups.get(key)
      if (arr) arr.push(row)
      else groups.set(key, [row])
    }
    return Array.from(groups.entries())
  }, [stats])

  const nothingToShow =
    !hasSection1 &&
    !showOpinions &&
    !showNextWeek &&
    !showProposedSchedule &&
    !showDeputyOpinions &&
    (!showStats || !stats || stats.rows.length === 0)

  return (
    <div className="weekly-read-overlay fixed inset-0 z-[60] bg-stone-100 overflow-y-auto">
      <style>{`
        .weekly-read-paper {
          font-family: "Times New Roman", Times, Georgia, serif;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 18mm 18mm 18mm 22mm;
          }
          html,
          body,
          body > div,
          body > div > div,
          main,
          .weekly-read-overlay {
            display: block !important;
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          aside,
          header,
          nav[aria-label="Thanh điều hướng di động"],
          .weekly-read-no-print {
            display: none !important;
          }
          .weekly-read-paper {
            box-shadow: none !important;
            border: none !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: "Times New Roman", Times, serif !important;
            font-size: 14pt !important;
            line-height: 1.5 !important;
            color: #000000 !important;
          }
          .weekly-read-paper * {
            font-family: "Times New Roman", Times, serif !important;
          }
          .weekly-read-paper .ProseMirror {
            font-size: 14pt !important;
            line-height: 1.5 !important;
            color: #000000 !important;
          }
          .weekly-read-paper h2,
          .weekly-read-paper h3 {
            break-after: avoid;
            page-break-after: avoid;
          }
          .weekly-read-paper img {
            max-width: 100% !important;
            max-height: 210mm !important;
            height: auto !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .weekly-read-paper table,
          .weekly-read-paper tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .weekly-read-red {
            color: #b91c1c !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Thanh công cụ đầu trang (ẩn khi in) */}
      <div className="weekly-read-no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-2.5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 min-h-[44px] text-base font-medium text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Quay lại trang soạn</span>
            <span className="hidden sm:inline text-sm text-slate-400">(Esc)</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {stats && stats.rows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStats((v) => !v)}
                aria-pressed={showStats}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 min-h-[44px] text-base font-medium transition-colors ${
                  showStats
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>{showStats ? 'Ẩn số liệu tuần' : 'Hiện số liệu tuần'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 min-h-[44px] text-base font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>In / Lưu PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trang nội dung đọc giao ban */}
      <div className="px-3 py-5 sm:px-6 sm:py-8">
        <article className="weekly-read-paper mx-auto max-w-[760px] rounded-xl border border-slate-200 bg-white px-5 py-7 sm:px-12 sm:py-12 shadow-sm text-[19px] sm:text-[20px] leading-[1.65] text-slate-950">
          {/* Ngày giao ban (đỏ + đậm) */}
          <p className="weekly-read-red text-red-700 font-bold mb-2">
            {meetingDateStr}
          </p>

          {/* Tiêu đề chính (căn giữa, đậm) */}
          <h1 className="text-center font-bold text-[22px] sm:text-[24px] leading-snug mb-5">
            {reportTitle}
          </h1>

          {nothingToShow ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600 font-sans text-base">
              Tuần này chưa có nội dung để đọc giao ban. Hãy quay lại trang soạn để nhập công việc hoặc văn bản tham mưu.
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. KHTH */}
              {hasSection1 && (
                <section className="space-y-2.5">
                  <h2 className="font-bold">{unitHeading}</h2>

                  {nonEmptyWorkItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-semibold">
                        Tình hình thực hiện nhiệm vụ tuần qua:
                      </p>
                      <ul className="list-disc pl-6 space-y-1.5">
                        {nonEmptyWorkItems.map((item) => (
                          <li key={item.id}>
                            {item.text.trim() && (
                              <span
                                className={
                                  item.highlight
                                    ? 'weekly-read-red text-red-700 font-bold'
                                    : undefined
                                }
                              >
                                {item.text}
                              </span>
                            )}
                            {item.children.length > 0 && (
                              <ul className="list-[circle] pl-6 mt-1 space-y-1">
                                {item.children.map((child) => (
                                  <li key={child.id}>
                                    <span
                                      className={
                                        child.highlight
                                          ? 'weekly-read-red text-red-700 font-bold'
                                          : undefined
                                      }
                                    >
                                      {child.text}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sortedAdvisory.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <ul className="list-disc pl-6 space-y-1.5">
                        <li>
                          <span className="font-semibold">{advisorySummary}</span>
                          <ul className="list-[circle] pl-6 mt-1 space-y-1">
                            {sortedAdvisory.map((doc) => (
                              <li key={doc.id}>
                                <span
                                  className={
                                    doc.highlight
                                      ? 'weekly-read-red text-red-700 font-bold'
                                      : undefined
                                  }
                                >
                                  {formatAdvisoryLine(doc)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* 2. Ý kiến */}
              {showOpinions && (
                <section className="space-y-1.5">
                  <h2 className="font-bold">{RICH_SECTION_LABELS.opinions}</h2>
                  <RichViewer
                    value={report.sections.opinions?.docJson ?? null}
                    className="!text-[19px] sm:!text-[20px] !leading-[1.65] !text-slate-950"
                  />
                </section>
              )}

              {/* 3. Tuần tới */}
              {showNextWeek && (
                <section className="space-y-1.5">
                  <h2 className="font-bold">{RICH_SECTION_LABELS.nextWeek}</h2>
                  <RichViewer
                    value={report.sections.nextWeek?.docJson ?? null}
                    className="!text-[19px] sm:!text-[20px] !leading-[1.65] !text-slate-950"
                  />
                </section>
              )}

              {/* Mục tuỳ chọn: Đề xuất lịch tuần tới */}
              {showProposedSchedule && (
                <section className="space-y-1.5">
                  <h2 className="font-bold">{RICH_SECTION_LABELS.proposedSchedule}</h2>
                  <RichViewer
                    value={report.sections.proposedSchedule?.docJson ?? null}
                    className="!text-[19px] sm:!text-[20px] !leading-[1.65] !text-slate-950"
                  />
                </section>
              )}

              {/* Mục tuỳ chọn: Ý kiến PGĐ */}
              {showDeputyOpinions && (
                <section className="space-y-1.5">
                  <h2 className="font-bold">{deputyLabel}</h2>
                  <RichViewer
                    value={report.sections.deputyOpinions?.docJson ?? null}
                    className="!text-[19px] sm:!text-[20px] !leading-[1.65] !text-slate-950"
                  />
                </section>
              )}

              {/* Phụ lục số liệu tuần (từ snapshot) */}
              {showStats && stats && stats.rows.length > 0 && (
                <section className="space-y-2 pt-2 border-t border-slate-200">
                  <h2 className="font-bold">Phụ lục: Số liệu chuyên môn tuần</h2>
                  {(stats.prevRange || stats.currRange) && (
                    <p className="text-[16px] text-slate-700">
                      {stats.prevRange &&
                        `Tuần trước: ${formatDMY(stats.prevRange.from)}–${formatDMY(stats.prevRange.to)}`}
                      {stats.prevRange && stats.currRange && ' · '}
                      {stats.currRange &&
                        `Tuần này: ${formatDMY(stats.currRange.from)}–${formatDMY(stats.currRange.to)}`}
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-400 text-[16px] sm:text-[17px]">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold">
                            Chỉ tiêu
                          </th>
                          <th className="border border-slate-400 px-2.5 py-1.5 text-right font-bold">
                            Tuần trước
                          </th>
                          <th className="border border-slate-400 px-2.5 py-1.5 text-right font-bold">
                            Tuần này
                          </th>
                          <th className="border border-slate-400 px-2.5 py-1.5 text-right font-bold">
                            Chênh lệch
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedStats.map(([groupName, rows]) => (
                          <React.Fragment key={groupName}>
                            <tr className="bg-slate-50">
                              <td
                                colSpan={4}
                                className="border border-slate-400 px-2.5 py-1 font-bold"
                              >
                                {groupName}
                              </td>
                            </tr>
                            {rows.map((row, idx) => {
                              const diff = formatStatDiff(row.prev, row.curr)
                              return (
                                <tr key={`${groupName}-${idx}`}>
                                  <td className="border border-slate-400 px-2.5 py-1">
                                    {row.label}
                                  </td>
                                  <td className="border border-slate-400 px-2.5 py-1 text-right tabular-nums">
                                    {formatStatNumber(row.prev)}
                                  </td>
                                  <td className="border border-slate-400 px-2.5 py-1 text-right tabular-nums font-bold">
                                    {formatStatNumber(row.curr)}
                                  </td>
                                  <td className="border border-slate-400 px-2.5 py-1 text-right tabular-nums">
                                    {diff.text}
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
