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
  // Display metadata from bcsolieu (optional — older snapshots lack it)
  key?: string
  groupKey?: string
  parent?: string
  style?: string
  labelMain?: string
  labelSub?: string
  bold?: boolean
  italic?: boolean
  numItalic?: boolean
  decimals?: number
  inside?: boolean
}

export interface WeeklyStatsGroup {
  key: string
  name: string
  bedNote: string | null
}

export interface WeeklyStatsData {
  rows: WeeklyStatsRow[]
  groups?: WeeklyStatsGroup[]
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
      groups: parsed.groups ?? [],
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
        <>
          {!snapshot.rows.some((r) => r.groupKey) && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Bản số liệu này lấy bằng phiên bản cũ nên chưa có dòng tổng / dòng con.
                {editable ? <> Bấm <strong>&ldquo;Cập nhật số liệu&rdquo;</strong> để hiển thị đúng như trang Báo cáo tuần.</> : null}
              </span>
            </div>
          )}
          <StatsBoards data={snapshot} />
        </>
      )}
    </section>
  )
}

// ===== Visual boards (mirrors bcsolieu /bao-cao-tuan) =====

const ACCENTS: Record<string, string> = {
  BENH_VIEN: 'bg-blue-950',
  MINH_DUC: 'bg-teal-900',
  QUANG_THANH: 'bg-indigo-950',
}
const ACCENT_FALLBACK = ['bg-slate-900', 'bg-emerald-900', 'bg-indigo-900', 'bg-sky-900']

function fmt(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)
}

function DeltaBadge({ prev, curr, decimals = 0 }: { prev: number | null; curr: number | null; decimals?: number }) {
  if (prev === null || curr === null || prev === curr) {
    return <span className="text-xs text-slate-400" aria-label="Không đổi">—</span>
  }
  const up = curr > prev
  const diff = fmt(Math.abs(curr - prev), decimals)
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ${
        up ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-orange-50 text-orange-700 ring-orange-600/20'
      }`}
    >
      {up ? '↗ +' : '↘ −'}
      {diff}
    </span>
  )
}

function StatsBoards({ data }: { data: WeeklyStatsData }) {
  const groups = useMemo(() => {
    const order: WeeklyStatsGroup[] = data.groups?.length
      ? data.groups
      : Array.from(new Set(data.rows.map((r) => r.group))).map((name) => ({ key: name, name, bedNote: null }))
    return order.map((g, i) => ({
      ...g,
      accent: ACCENTS[g.key] ?? ACCENT_FALLBACK[i % ACCENT_FALLBACK.length],
      rows: data.rows.filter((r) => (r.groupKey ? r.groupKey === g.key : r.group === g.name)),
    }))
  }, [data])
  const [filter, setFilter] = useState<string>('ALL')
  const shown = filter === 'ALL' ? groups : groups.filter((g) => g.key === filter)
  const range = (r: { from: string; to: string } | null) =>
    r ? `${r.from.slice(8, 10)}/${r.from.slice(5, 7)}–${r.to.slice(8, 10)}/${r.to.slice(5, 7)}` : ''

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1">
        {[{ key: 'ALL', name: `Tất cả khối (${groups.length})`, count: null as number | null }, ...groups.map((g) => ({ key: g.key, name: g.name, count: g.rows.length }))].map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={`shrink-0 rounded-md border px-2.5 min-h-[36px] sm:min-h-[28px] text-xs font-semibold uppercase ${
              filter === chip.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {chip.name}
            {chip.count !== null && <span className="ml-1 font-normal opacity-70">{chip.count}</span>}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 gap-3 ${filter === 'ALL' && shown.length >= 3 ? 'xl:grid-cols-3 lg:grid-cols-2' : filter === 'ALL' && shown.length === 2 ? 'lg:grid-cols-2' : ''}`}>
        {shown.map((g) => {
          const parentIds = new Set(g.rows.map((r) => r.parent).filter(Boolean) as string[])
          const byKey = new Map(g.rows.map((r) => [r.key ?? r.label, r]))
          const up = g.rows.filter((r) => r.prev !== null && r.curr !== null && r.curr > r.prev).length
          const down = g.rows.filter((r) => r.prev !== null && r.curr !== null && r.curr < r.prev).length
          return (
            <section key={g.key} aria-label={`Khối ${g.name}`} className="self-start overflow-hidden rounded-lg border border-slate-300 bg-white">
              <div className={`flex items-center justify-between gap-2 px-3 py-2 ${g.accent}`}>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white">{g.name}</h3>
                  {g.bedNote && (
                    <span className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-white/90">
                      {g.bedNote.replace(/^\(|\)$/g, '')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs tabular-nums">
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-200 ring-1 ring-emerald-400/30" title="Số chỉ tiêu tăng">↑ {up}</span>
                  <span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-semibold text-orange-200 ring-1 ring-orange-400/30" title="Số chỉ tiêu giảm">↓ {down}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px] leading-snug">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-900">
                      <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase">Danh mục</th>
                      <th className="w-[70px] px-2 py-1.5 text-right text-[11px] font-bold">
                        Tuần 1<div className="font-normal text-slate-500">{range(data.prevRange)}</div>
                      </th>
                      <th className="w-[76px] px-2 py-1.5 text-right text-[11px] font-bold text-blue-900">
                        Tuần 2<div className="font-normal text-blue-700">{range(data.currRange)}</div>
                      </th>
                      <th className="w-[72px] px-2 py-1.5 text-right text-[11px] font-bold uppercase">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {g.rows.map((r, i) => {
                      const isGroup = r.style === 'tong_dam' || r.bold === true || (!!r.key && parentIds.has(r.key))
                      const isChild = !isGroup && (!!r.parent || r.style === 'con_nghieng')
                      const italic = r.italic ?? r.style === 'thuong_nghieng'
                      const parent = r.parent ? byKey.get(r.parent) : undefined
                      let bar = 0
                      if (parent && parent.curr && parent.curr > 0 && r.curr !== null) bar = Math.min(100, Math.round((r.curr / parent.curr) * 100))
                      else if ((r.prev ?? 0) > 0 || (r.curr ?? 0) > 0) bar = Math.max(6, Math.round(((r.curr ?? 0) / Math.max(r.prev ?? 0, r.curr ?? 0, 1)) * 100))
                      const barColor = r.prev !== null && r.curr !== null && r.curr > r.prev ? 'bg-emerald-500' : r.prev !== null && r.curr !== null && r.curr < r.prev ? 'bg-orange-500' : 'bg-blue-500'
                      return (
                        <tr key={r.key ?? `${g.key}-${i}`} className={isGroup ? 'bg-slate-100/80' : 'bg-white hover:bg-slate-50'}>
                          <td className={`py-1.5 pr-2 align-middle ${isChild ? 'pl-5 font-normal text-slate-700' : 'pl-2.5'} ${isGroup ? 'font-bold text-slate-900' : !isChild ? 'font-medium text-slate-900' : ''} ${italic ? 'italic' : ''}`}>
                            {isChild && <span aria-hidden className="mr-1 text-xs text-slate-400">└</span>}
                            {r.labelSub ? (
                              <>
                                <span className={isGroup ? 'font-bold' : 'font-semibold'}>{r.labelMain}</span>{' '}
                                <span className="text-xs font-normal text-slate-500">{r.labelSub}</span>
                              </>
                            ) : (
                              r.label
                            )}
                          </td>
                          <td className={`px-2 py-1.5 text-right align-middle tabular-nums ${isGroup ? 'font-bold text-slate-900' : 'text-slate-700'} ${r.numItalic ? 'italic' : ''}`}>
                            {fmt(r.prev, r.decimals)}
                          </td>
                          <td className={`px-2 py-1.5 text-right align-middle tabular-nums ${isGroup ? 'font-bold text-blue-800' : 'font-semibold text-blue-700'} ${r.numItalic ? 'italic' : ''}`}>
                            <div>{fmt(r.curr, r.decimals)}</div>
                            {bar > 0 && (
                              <div aria-hidden className="ml-auto mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-slate-200">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${bar}%` }} />
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right align-middle">
                            <DeltaBadge prev={r.prev} curr={r.curr} decimals={r.decimals} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
