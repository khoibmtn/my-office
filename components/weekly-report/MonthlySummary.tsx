'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { useWeeks } from '@/hooks/useWeeks'
import { authedFetch } from '@/lib/authedFetch'
import {
  countByType,
  formatAdvisoryLine,
  formatAdvisorySummary,
  sortAdvisory,
} from '@/lib/weekly-report/advisory-format'
import { monthToMarkdown } from '@/lib/weekly-report/export/markdown'
import { listAdvisoryByWeekIds } from '@/lib/weekly-report/firestore'
import {
  formatDMY,
  isBoundaryWeek,
  todayVN,
  weeksOfMonth,
} from '@/lib/weekly-report/period'
import type {
  AdvisoryDoc,
  WeekPeriod,
  WeeklyReport,
  YearMonth,
} from '@/types/weekly-report'

function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const [yearStr, monthStr] = month.split('-')
  const totalMonths = Number(yearStr) * 12 + (Number(monthStr) - 1) + delta
  const nextYear = Math.floor(totalMonths / 12)
  const nextMonth = (totalMonths % 12) + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`
}

function formatMonthMMYYYY(month: YearMonth): string {
  const [y, m] = month.split('-')
  return `${m}/${y}`
}

function formatDefaultFilename(month: YearMonth, ext: 'docx' | 'md'): string {
  const [y, m] = month.split('-')
  return `${m}.${y}.${ext}`
}

function parseFilenameFromHeader(header: string | null): string | null {
  if (!header) return null
  const utf8Match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      return utf8Match[1].trim()
    }
  }
  const plainMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(header)
  return plainMatch?.[1]?.trim() || null
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) {
    throw new Error('Trình duyệt không hỗ trợ sao chép tự động')
  }
}

interface WeekEntry {
  period: WeekPeriod
  report: WeeklyReport | null
  advisory: AdvisoryDoc[]
}

export function MonthlySummary({ month }: { month: YearMonth }) {
  const { weeks: savedWeeks, loading: weeksLoading } = useWeeks()
  const { config, loading: configLoading } = useWeeklyReportConfig()

  const [advisoryDocs, setAdvisoryDocs] = useState<AdvisoryDoc[]>([])
  const [advisoryLoading, setAdvisoryLoading] = useState(true)
  const [advisoryError, setAdvisoryError] = useState<string | null>(null)
  const [reloadSeq, setReloadSeq] = useState(0)

  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'md' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const monthPeriods = useMemo(
    () => weeksOfMonth(month, savedWeeks),
    [month, savedWeeks],
  )
  const weekIdsKey = useMemo(
    () => monthPeriods.map((p) => p.weekId).join(','),
    [monthPeriods],
  )

  useEffect(() => {
    if (weeksLoading) return
    const weekIds = weekIdsKey ? weekIdsKey.split(',') : []
    if (weekIds.length === 0) {
      setAdvisoryDocs([])
      setAdvisoryError(null)
      setAdvisoryLoading(false)
      return
    }

    let cancelled = false
    setAdvisoryLoading(true)
    setAdvisoryError(null)

    listAdvisoryByWeekIds(weekIds)
      .then((docs) => {
        if (!cancelled) {
          setAdvisoryDocs(docs)
          setAdvisoryLoading(false)
        }
      })
      .catch((err) => {
        console.error('[MonthlySummary] listAdvisoryByWeekIds failed', err)
        if (!cancelled) {
          setAdvisoryError('Không tải được danh sách văn bản tham mưu từ máy chủ.')
          setAdvisoryLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [weeksLoading, weekIdsKey, reloadSeq])

  const weekEntries: WeekEntry[] = useMemo(() => {
    const savedById = new Map(savedWeeks.map((w) => [w.id, w]))
    const advByWeekId = new Map<string, AdvisoryDoc[]>()
    for (const doc of advisoryDocs) {
      const list = advByWeekId.get(doc.weekId)
      if (list) list.push(doc)
      else advByWeekId.set(doc.weekId, [doc])
    }

    return monthPeriods.map((period) => ({
      period,
      report: savedById.get(period.weekId) ?? null,
      advisory: sortAdvisory(advByWeekId.get(period.weekId) ?? []),
    }))
  }, [monthPeriods, savedWeeks, advisoryDocs])

  const allAdvisory = useMemo(
    () => sortAdvisory(weekEntries.flatMap((w) => w.advisory)),
    [weekEntries],
  )

  const typeCounts = useMemo(
    () => countByType(allAdvisory, config.docTypes),
    [allAdvisory, config.docTypes],
  )

  const summaryText = useMemo(
    () => formatAdvisorySummary(allAdvisory, config.docTypes),
    [allAdvisory, config.docTypes],
  )

  const finalizedCount = useMemo(
    () => weekEntries.filter((w) => w.report?.status === 'finalized').length,
    [weekEntries],
  )

  const today = todayVN()
  const lastPeriodEnd =
    monthPeriods.length > 0 ? monthPeriods[monthPeriods.length - 1].periodEnd : null
  const isMonthIncomplete = Boolean(lastPeriodEnd && today <= lastPeriodEnd)

  const prevMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, 1)
  const monthLabel = formatMonthMMYYYY(month)

  const handleDownload = useCallback(
    async (format: 'docx' | 'md') => {
      setDownloadingFormat(format)
      setExportError(null)
      try {
        const res = await authedFetch(
          `/api/weekly-reports/export?month=${encodeURIComponent(month)}&format=${format}`,
        )
        if (!res.ok) {
          let message = `Xuất file thất bại (mã ${res.status}).`
          try {
            const raw = await res.text()
            if (raw) {
              try {
                const json = JSON.parse(raw) as { message?: string; error?: string }
                message = json.message || json.error || message
              } catch {
                message = raw
              }
            }
          } catch {
            // ignore response body parse error
          }
          setExportError(message)
          return
        }

        const blob = await res.blob()
        const filename =
          parseFilenameFromHeader(res.headers.get('content-disposition')) ||
          formatDefaultFilename(month, format)

        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      } catch (err) {
        console.error('[MonthlySummary] download failed', err)
        setExportError('Không thể kết nối tới máy chủ để tải file. Vui lòng thử lại.')
      } finally {
        setDownloadingFormat(null)
      }
    },
    [month],
  )

  const handleCopyMarkdown = useCallback(async () => {
    setExportError(null)
    try {
      const md = monthToMarkdown({
        month,
        weeks: weekEntries,
        config,
        includeRichSections: false,
      })
      await copyTextToClipboard(md)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('[MonthlySummary] copy failed', err)
      setExportError('Không thể sao chép vào clipboard trên trình duyệt này.')
    }
  }, [month, weekEntries, config])

  const isLoading = weeksLoading || configLoading || advisoryLoading

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6 text-base text-slate-900">
      {/* Thanh tiêu đề & điều hướng tháng */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base"
              >
                <Link href={`/weekly-reports/monthly/${prevMonth}`}>
                  <ChevronLeft className="h-5 w-5" />
                  <span>Tháng trước</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base"
              >
                <Link href={`/weekly-reports/monthly/${nextMonth}`}>
                  <span>Tháng sau</span>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            <Button
              asChild
              variant="ghost"
              className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base text-slate-700"
            >
              <Link href="/weekly-reports">
                <Calendar className="h-5 w-5" />
                <span>Giao ban tuần</span>
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Tổng hợp giao ban tháng {monthLabel}
              </h1>
              <p className="text-base text-slate-600 tabular-nums">
                {weekEntries.length} tuần thuộc tháng · {finalizedCount} đã chốt ·{' '}
                {allAdvisory.length} văn bản tham mưu
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="default"
                disabled={isLoading || downloadingFormat !== null}
                onClick={() => void handleDownload('docx')}
                className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base"
              >
                {downloadingFormat === 'docx' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                <span>Tải .docx</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading || downloadingFormat !== null}
                onClick={() => void handleDownload('md')}
                className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base"
              >
                {downloadingFormat === 'md' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                <span>Tải .md</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => void handleCopyMarkdown()}
                className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </Button>
            </div>
          </div>

          {exportError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
            >
              {exportError}
            </div>
          )}

          {advisoryError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
            >
              <span>{advisoryError}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReloadSeq((s) => s + 1)}
                className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base border-red-300 bg-white text-red-800 hover:bg-red-100"
              >
                <RefreshCw className="h-5 w-5" />
                <span>Thử lại</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cảnh báo MONTH_INCOMPLETE */}
      {!isLoading && isMonthIncomplete && lastPeriodEnd && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-base text-amber-900"
        >
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Tháng {monthLabel} chưa đủ dữ liệu (MONTH_INCOMPLETE)
            </p>
            <p className="text-amber-800">
              Kỳ cuối của tháng kết thúc ngày {formatDMY(lastPeriodEnd)} chưa qua. Bạn vẫn có thể
              sao chép hoặc xuất file với các tuần hiện có.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3 text-base text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span>Đang tải dữ liệu tổng hợp tháng {monthLabel}…</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Khối 1: Danh sách tuần thuộc tháng */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-slate-900">
                1. Danh sách tuần thuộc tháng {monthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weekEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 space-y-3 text-base text-slate-700">
                  <p>Không tìm thấy tuần giao ban nào được gán cho tháng {monthLabel}.</p>
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto min-h-[44px] px-4 py-2.5 text-base"
                  >
                    <Link href="/weekly-reports">Mở trang Giao ban tuần</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {weekEntries.map(({ period, report, advisory }) => {
                    const displayMeeting = report?.actualMeetingDate || period.meetingDate
                    const isMissing = report === null
                    const isFinalized = report?.status === 'finalized'
                    const boundary = isBoundaryWeek(period)
                    const isSpecialPeriod = Boolean(
                      report?.periodOverridden ||
                        report?.actualMeetingDate ||
                        period.dayCount !== 7,
                    )
                    const isMonthOverridden = Boolean(report?.reportMonthOverridden)
                    const workItemCount = report?.workItems?.length ?? 0

                    return (
                      <div
                        key={period.weekId}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-lg text-slate-900">
                              Giao ban {formatDMY(displayMeeting)}
                            </span>
                            {report?.actualMeetingDate &&
                              report.actualMeetingDate !== period.meetingDate && (
                                <span className="text-base text-slate-600">
                                  (Lịch gốc: {formatDMY(period.meetingDate)})
                                </span>
                              )}
                          </div>

                          <p className="text-base text-slate-700 tabular-nums">
                            Kỳ {formatDMY(period.periodStart)} – {formatDMY(period.periodEnd)} (
                            {period.dayCount} ngày) · {workItemCount} dòng việc ·{' '}
                            {advisory.length} văn bản tham mưu
                          </p>

                          <div className="flex flex-wrap items-center gap-2">
                            {isMissing ? (
                              <Badge className="border-red-200 bg-red-50 px-3 py-1 text-base text-red-800">
                                Chưa có dữ liệu
                              </Badge>
                            ) : isFinalized ? (
                              <Badge className="border-emerald-200 bg-emerald-50 px-3 py-1 text-base text-emerald-800">
                                Đã chốt
                              </Badge>
                            ) : (
                              <Badge className="border-amber-200 bg-amber-50 px-3 py-1 text-base text-amber-900">
                                Chưa chốt
                              </Badge>
                            )}

                            {boundary && (
                              <Badge className="border-blue-200 bg-blue-50 px-3 py-1 text-base text-blue-800">
                                Tuần giáp ranh
                              </Badge>
                            )}

                            {isSpecialPeriod && (
                              <Badge className="border-purple-200 bg-purple-50 px-3 py-1 text-base text-purple-800">
                                Kỳ đặc biệt
                              </Badge>
                            )}

                            {isMonthOverridden && (
                              <Badge className="border-slate-300 bg-slate-100 px-3 py-1 text-base text-slate-800">
                                Gán tháng thủ công
                              </Badge>
                            )}
                          </div>

                          {report?.periodNote && (
                            <p className="text-base text-slate-700 italic">
                              Ghi chú kỳ: {report.periodNote}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          <Button
                            asChild
                            variant="outline"
                            className="h-auto min-h-[44px] min-w-[44px] px-4 py-2.5 text-base"
                          >
                            <Link href={`/weekly-reports/${period.weekId}`}>
                              <span>Mở tuần</span>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Khối 2: Bảng đếm văn bản tham mưu theo loại */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-slate-900">
                2. Thống kê văn bản tham mưu theo loại
              </CardTitle>
              <p className="text-base font-medium text-slate-700">{summaryText}</p>
            </CardHeader>
            <CardContent>
              {allAdvisory.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 space-y-3 text-base text-slate-700">
                  <p>
                    Chưa có văn bản tham mưu nào được ghi nhận cho các tuần thuộc tháng{' '}
                    {monthLabel}. Hãy mở tuần giao ban hoặc vào mục Văn bản để bấm &ldquo;Tham
                    mưu&rdquo;.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto min-h-[44px] px-4 py-2.5 text-base"
                  >
                    <Link href="/weekly-reports">Đi tới Giao ban tuần</Link>
                  </Button>
                </div>
              ) : (
                <Table className="text-base">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-12 text-base font-semibold text-slate-700">
                        Loại văn bản
                      </TableHead>
                      <TableHead className="h-12 text-base font-semibold text-slate-700">
                        Tiền tố
                      </TableHead>
                      <TableHead className="h-12 text-right text-base font-semibold text-slate-700 tabular-nums">
                        Số lượng
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeCounts.map((row) => (
                      <TableRow key={row.code}>
                        <TableCell className="py-3 text-base font-medium text-slate-900">
                          {row.label}
                        </TableCell>
                        <TableCell className="py-3 text-base text-slate-700">
                          {row.prefix || '—'}
                        </TableCell>
                        <TableCell className="py-3 text-right text-base font-semibold text-slate-900 tabular-nums">
                          {row.count}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-bold">
                      <TableCell className="py-3 text-base text-slate-900" colSpan={2}>
                        Tổng cộng
                      </TableCell>
                      <TableCell className="py-3 text-right text-base text-slate-900 tabular-nums">
                        {allAdvisory.length}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Khối 3: Toàn bộ văn bản tham mưu nhóm theo tuần */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-slate-900">
                3. Danh sách văn bản tham mưu theo tuần
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {weekEntries.map(({ period, report, advisory }) => {
                const displayMeeting = report?.actualMeetingDate || period.meetingDate
                return (
                  <div
                    key={period.weekId}
                    className="rounded-lg border border-slate-200 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-semibold text-slate-900">
                          Tuần giao ban {formatDMY(displayMeeting)} (kỳ{' '}
                          {formatDMY(period.periodStart)} – {formatDMY(period.periodEnd)})
                        </h3>
                        <p className="text-base text-slate-700">
                          {formatAdvisorySummary(advisory, config.docTypes)}
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-auto min-h-[44px] min-w-[44px] px-3 py-2.5 text-base text-blue-700"
                      >
                        <Link href={`/weekly-reports/${period.weekId}`}>Xem tuần</Link>
                      </Button>
                    </div>

                    {advisory.length === 0 ? (
                      <p className="text-base text-slate-600">
                        Chưa có văn bản tham mưu nào trong tuần này.
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {advisory.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-col gap-1 rounded-md bg-slate-50 px-3.5 py-2.5"
                          >
                            <span
                              className={
                                doc.highlight
                                  ? 'text-base font-bold text-red-700 break-words'
                                  : 'text-base text-slate-900 break-words'
                              }
                            >
                              {formatAdvisoryLine(doc)}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-600">
                              <span>Ngày {formatDMY(doc.advisedDate)}</span>
                              {doc.docNumber && <span>Số: {doc.docNumber}</span>}
                              {doc.sourceSnapshot.map((src) => (
                                <Link
                                  key={src.id}
                                  href={`/documents/${src.id}`}
                                  className="inline-flex min-h-[44px] items-center text-base font-medium text-blue-700 hover:underline"
                                >
                                  ↩ {src.docNumber || src.title}
                                </Link>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
