'use client'

import React, { useMemo, useState } from 'react'
import { AlertCircle, BarChart3, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { authedFetch } from '@/lib/authedFetch'
import { saveStatsSnapshot } from '@/lib/weekly-report/firestore'
import { formatDMY } from '@/lib/weekly-report/period'
import type { ISODate } from '@/types/weekly-report'

export interface WeeklyStatsRow {
  group: string
  label: string
  prev: number | null
  curr: number | null
}

export interface WeeklyStatsData {
  rows: WeeklyStatsRow[]
  prevRange: { from: string; to: string } | null
  currRange: { from: string; to: string } | null
}

export function parseStatsSnapshot(json: string | null | undefined): WeeklyStatsData | null {
  if (!json || !json.trim()) return null
  try {
    const parsed = JSON.parse(json) as Partial<WeeklyStatsData>
    if (!parsed || !Array.isArray(parsed.rows)) return null
    return {
      rows: parsed.rows,
      prevRange: parsed.prevRange ?? null,
      currRange: parsed.currRange ?? null,
    }
  } catch {
    return null
  }
}

export function formatStatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('vi-VN').format(v)
}

export function formatStatDiff(prev: number | null, curr: number | null): {
  text: string
  toneClass: string
} {
  if (prev === null || curr === null || Number.isNaN(prev) || Number.isNaN(curr)) {
    return { text: '—', toneClass: 'text-slate-400' }
  }
  const diff = curr - prev
  if (diff === 0) return { text: '0', toneClass: 'text-slate-600' }
  const sign = diff > 0 ? '+' : '−'
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(diff))
  return {
    text: `${sign}${formatted}`,
    toneClass: diff > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold',
  }
}

function formatFetchedAt(ts: unknown): string {
  if (!ts) return ''
  try {
    let date: Date | null = null
    if (ts instanceof Date) date = ts
    else if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      date = (ts as { toDate: () => Date }).toDate()
    } else if (typeof (ts as { seconds?: number }).seconds === 'number') {
      date = new Date((ts as { seconds: number }).seconds * 1000)
    }
    if (!date || Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date)
  } catch {
    return ''
  }
}

export interface WeeklyStatsPanelProps {
  weekId: string
  periodStart: ISODate
  periodEnd: ISODate
  statsSnapshotJson: string | null
  statsFetchedAt?: unknown
  editable?: boolean
  /** Optional mock handlers for dev-preview (no real network or Firestore writes). */
  onFetchStats?: (weekId: string) => Promise<{ ok: true; data: WeeklyStatsData } | { ok: false; message: string }>
  onSaveSnapshot?: (json: string) => Promise<void>
}

export function WeeklyStatsPanel({
  weekId,
  periodStart,
  periodEnd,
  statsSnapshotJson,
  statsFetchedAt,
  editable = true,
  onFetchStats,
  onSaveSnapshot,
}: WeeklyStatsPanelProps) {
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const snapshot = useMemo(() => parseStatsSnapshot(statsSnapshotJson), [statsSnapshotJson])
  const fetchedLabel = useMemo(() => formatFetchedAt(statsFetchedAt), [statsFetchedAt])

  const bcsolieuUrl = `https://bvtn-bcsolieu.vercel.app/bao-cao-tuan?t2_tu=${encodeURIComponent(periodStart)}&t2_den=${encodeURIComponent(periodEnd)}`

  const groupedRows = useMemo(() => {
    if (!snapshot) return []
    const groups = new Map<string, WeeklyStatsRow[]>()
    for (const row of snapshot.rows) {
      const key = row.group || 'Chỉ tiêu'
      const arr = groups.get(key)
      if (arr) arr.push(row)
      else groups.set(key, [row])
    }
    return Array.from(groups.entries())
  }, [snapshot])

  // Chỉ gọi mạng khi người dùng chủ động bấm nút "Lấy số liệu" (§15 Q5)
  const handleFetch = async () => {
    if (fetching) return
    setFetching(true)
    setError(null)
    try {
      let result: { ok: boolean; data?: WeeklyStatsData; message?: string }
      if (onFetchStats) {
        result = await onFetchStats(weekId)
      } else {
        const res = await authedFetch(
          `/api/bcsolieu/weekly-stats?weekId=${encodeURIComponent(weekId)}`,
        )
        result = (await res.json().catch(() => null)) ?? {
          ok: false,
          message: `Không đọc được phản hồi từ máy chủ (${res.status}).`,
        }
      }

      if (!result.ok || !result.data) {
        setError(result.message || 'Không lấy được số liệu từ bcsolieu.')
        return
      }

      const serialized = JSON.stringify(result.data)
      if (onSaveSnapshot) {
        await onSaveSnapshot(serialized)
      } else {
        await saveStatsSnapshot(weekId, serialized)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối bcsolieu. Trang giao ban vẫn dùng bình thường.',
      )
    } finally {
      setFetching(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Số liệu tuần</h2>
            {fetchedLabel && (
              <p className="text-xs text-slate-500">Chụp lúc {fetchedLabel}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <button
              type="button"
              onClick={handleFetch}
              disabled={fetching}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {fetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>{snapshot ? 'Cập nhật số liệu' : 'Lấy số liệu'}</span>
            </button>
          )}

          <a
            href={bcsolieuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <span>Mở Báo cáo tuần bcsolieu</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" />
          </a>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-xs text-red-700 mt-0.5">
              Bạn vẫn có thể soạn báo cáo bình thường hoặc mở trực tiếp trang Báo cáo tuần bcsolieu.
            </p>
          </div>
        </div>
      )}

      {!snapshot ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Chưa lấy bảng số liệu cho kỳ {formatDMY(periodStart)}–{formatDMY(periodEnd)}. Hệ thống chỉ tải khi bạn bấm <strong>&ldquo;Lấy số liệu&rdquo;</strong> để tiết kiệm lượt gọi máy chủ.
        </div>
      ) : snapshot.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Không có dòng số liệu nào trong kỳ này.
        </div>
      ) : (
        <div className="space-y-2">
          {(snapshot.prevRange || snapshot.currRange) && (
            <p className="text-xs text-slate-600">
              {snapshot.prevRange && (
                <span>
                  Tuần trước: {formatDMY(snapshot.prevRange.from)}–{formatDMY(snapshot.prevRange.to)}
                </span>
              )}
              {snapshot.prevRange && snapshot.currRange && <span> · </span>}
              {snapshot.currRange && (
                <span>
                  Tuần này: {formatDMY(snapshot.currRange.from)}–{formatDMY(snapshot.currRange.to)}
                </span>
              )}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
                  <th className="px-3 py-1.5 font-semibold">Chỉ tiêu</th>
                  <th className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                    Tuần trước
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                    Tuần này
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                    Chênh lệch
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(([groupName, rows]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bg-slate-100/80 border-b border-slate-200">
                      <td
                        colSpan={4}
                        className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700"
                      >
                        {groupName}
                      </td>
                    </tr>
                    {rows.map((row, rIdx) => {
                      const diff = formatStatDiff(row.prev, row.curr)
                      return (
                        <tr
                          key={`${groupName}-${rIdx}`}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2 text-slate-900">{row.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {formatStatNumber(row.prev)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                            {formatStatNumber(row.curr)}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums ${diff.toneClass}`}>
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
        </div>
      )}
    </section>
  )
}
