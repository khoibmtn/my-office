'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import {
  countByType,
  formatAdvisoryLine,
  formatAdvisorySummary,
  sortAdvisory,
} from '@/lib/weekly-report/advisory-format'
import { listAdvisoryByDateRange } from '@/lib/weekly-report/firestore'
import { formatDMY, todayVN } from '@/lib/weekly-report/period'
import { AdvisoryForm } from '@/components/weekly-report/AdvisoryForm'
import type { AdvisoryDoc, AdvisorySourceSnapshot, ISODate, YearMonth } from '@/types/weekly-report'

function monthToDateRange(month: YearMonth): { from: ISODate; to: ISODate } {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) {
    const today = todayVN()
    return { from: `${today.slice(0, 7)}-01`, to: today }
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function previousMonth(month: YearMonth): YearMonth {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
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
  if (doc.sourceSnapshot && doc.sourceSnapshot.length > 0) return doc.sourceSnapshot
  return (doc.sourceDocumentIds ?? []).map((id) => ({
    id,
    docNumber: '',
    title: '',
    sender: '',
    issueDate: null,
  }))
}

export default function AdvisoryLedgerPage() {
  const { isAdmin, loading } = useRole()

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Đang kiểm tra quyền truy cập...</span>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <main className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-base">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <span>Chỉ quản trị viên mới truy cập được sổ văn bản tham mưu</span>
          </div>
          <p className="text-sm text-amber-800">
            Tài khoản hiện tại không có quyền xem hoặc chỉnh sửa dữ liệu Giao ban tuần.
          </p>
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-[32px] px-4 py-2 rounded-lg bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay về danh sách văn bản
          </Link>
        </div>
      </main>
    )
  }

  return <AdvisoryLedgerContent />
}

function AdvisoryLedgerContent() {
  const { config } = useWeeklyReportConfig()
  const currentMonth = todayVN().slice(0, 7)

  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(currentMonth)
  const initialRange = useMemo(() => monthToDateRange(currentMonth), [currentMonth])
  const [fromDate, setFromDate] = useState<ISODate>(initialRange.from)
  const [toDate, setToDate] = useState<ISODate>(initialRange.to)

  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [docs, setDocs] = useState<AdvisoryDoc[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState<number>(0)

  const [formOpen, setFormOpen] = useState<boolean>(false)
  const [editingDoc, setEditingDoc] = useState<AdvisoryDoc | null>(null)

  const activeRange = useMemo(
    () => (filterMode === 'month' ? monthToDateRange(selectedMonth) : { from: fromDate, to: toDate }),
    [filterMode, selectedMonth, fromDate, toDate],
  )

  const loadDocs = useCallback(async (from: ISODate, to: ISODate) => {
    if (!from || !to || from > to) {
      setDocs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listAdvisoryByDateRange(from, to)
      setDocs(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách văn bản tham mưu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!activeRange.from || !activeRange.to || activeRange.from > activeRange.to) {
        if (!cancelled) {
          setDocs([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      setError(null)
      try {
        const result = await listAdvisoryByDateRange(activeRange.from, activeRange.to)
        if (!cancelled) setDocs(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không thể tải danh sách văn bản tham mưu.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [activeRange.from, activeRange.to, reloadTick])

  const docsMatchingSearch = useMemo(() => {
    const sorted = sortAdvisory(docs).reverse() // newest first in ledger
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((doc) => {
      const line = formatAdvisoryLine(doc).toLowerCase()
      const docNum = (doc.docNumber ?? '').toLowerCase()
      const note = (doc.note ?? '').toLowerCase()
      const sourceMatch = (doc.sourceSnapshot ?? []).some(
        (s) =>
          s.docNumber.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.sender.toLowerCase().includes(q),
      )
      return line.includes(q) || docNum.includes(q) || note.includes(q) || sourceMatch
    })
  }, [docs, searchQuery])

  const countsByType = useMemo(
    () => countByType(docsMatchingSearch, config.docTypes),
    [docsMatchingSearch, config.docTypes],
  )

  const filteredDocs = useMemo(() => {
    if (selectedType === 'ALL') return docsMatchingSearch
    return docsMatchingSearch.filter((d) => d.type === selectedType)
  }, [docsMatchingSearch, selectedType])

  const summaryText = useMemo(
    () => formatAdvisorySummary(filteredDocs, config.docTypes),
    [filteredDocs, config.docTypes],
  )

  const typeLabelMap = useMemo(
    () => new Map(config.docTypes.map((t) => [t.code, t.label])),
    [config.docTypes],
  )

  const handleMonthPreset = (month: YearMonth) => {
    setFilterMode('month')
    setSelectedMonth(month)
  }

  const handleYearPreset = () => {
    const y = todayVN().slice(0, 4)
    setFilterMode('range')
    setFromDate(`${y}-01-01`)
    setToDate(`${y}-12-31`)
  }

  const handleRefresh = () => {
    setReloadTick((t) => t + 1)
  }

  return (
    <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/weekly-reports"
              className="inline-flex items-center gap-1 min-h-[36px] text-blue-700 hover:underline font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Giao ban tuần
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href="/settings/weekly-report"
              className="inline-flex items-center gap-1 min-h-[36px] text-slate-600 hover:text-slate-900 font-medium"
            >
              <Settings className="w-4 h-4" />
              Cài đặt loại văn bản
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>Sổ văn bản tham mưu</span>
          </h1>
        </div>

        <Button
          type="button"
          onClick={() => {
            setEditingDoc(null)
            setFormOpen(true)
          }}
          className="min-h-[44px] sm:min-h-[32px] text-sm bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Thêm văn bản tham mưu
        </Button>
      </div>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          {/* Date mode + inputs */}
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleMonthPreset(currentMonth)}
                className={`min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  filterMode === 'month' && selectedMonth === currentMonth
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tháng này
              </button>
              <button
                type="button"
                onClick={() => handleMonthPreset(previousMonth(currentMonth))}
                className={`min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  filterMode === 'month' && selectedMonth === previousMonth(currentMonth)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tháng trước
              </button>
              <button
                type="button"
                onClick={handleYearPreset}
                className={`min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  filterMode === 'range' &&
                  fromDate === `${todayVN().slice(0, 4)}-01-01` &&
                  toDate === `${todayVN().slice(0, 4)}-12-31`
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cả năm {todayVN().slice(0, 4)}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (filterMode === 'month') {
                    const r = monthToDateRange(selectedMonth)
                    setFromDate(r.from)
                    setToDate(r.to)
                    setFilterMode('range')
                  } else {
                    setFilterMode('month')
                  }
                }}
                className="min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5"
              >
                <Calendar className="w-4 h-4 text-slate-500" />
                {filterMode === 'month' ? 'Chọn khoảng ngày' : 'Chọn theo tháng'}
              </button>
            </div>

            {filterMode === 'month' ? (
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="ledger-month" className="text-sm font-medium text-slate-700">
                  Tháng:
                </label>
                <input
                  id="ledger-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500">
                  ({formatDMY(activeRange.from)} – {formatDMY(activeRange.to)})
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="ledger-from" className="text-sm font-medium text-slate-700">
                    Từ:
                  </label>
                  <input
                    id="ledger-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="ledger-to" className="text-sm font-medium text-slate-700">
                    Đến:
                  </label>
                  <input
                    id="ledger-to"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Search box */}
          <div className="lg:w-80">
            <label htmlFor="ledger-search" className="block text-xs font-medium text-slate-700 mb-1">
              Tìm theo tên, số hiệu, văn bản gốc
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="ledger-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập từ khoá..."
                className="w-full min-h-[44px] sm:min-h-[32px] pl-9 pr-9 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Xoá tìm kiếm"
                  onClick={() => setSearchQuery('')}
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {activeRange.from > activeRange.to && (
          <p className="text-sm text-red-700 font-medium">
            Ngày bắt đầu không được lớn hơn ngày kết thúc.
          </p>
        )}

        {/* Type filter & counts */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <p className="text-sm font-medium text-slate-900">
            {renderSummaryWithHighlight(summaryText)}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedType('ALL')}
              className={`min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors tabular-nums ${
                selectedType === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tất cả ({docsMatchingSearch.length})
            </button>

            {countsByType.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setSelectedType(selectedType === c.code ? 'ALL' : c.code)}
                className={`min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors tabular-nums ${
                  selectedType === c.code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadDocs(activeRange.from, activeRange.to)}
            className="min-h-[44px] sm:min-h-[32px]"
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Đang tải sổ văn bản tham mưu...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            {docs.length === 0
              ? `Không có văn bản tham mưu nào trong khoảng ${formatDMY(activeRange.from)} – ${formatDMY(activeRange.to)}.`
              : 'Không tìm thấy văn bản tham mưu phù hợp với bộ lọc hiện tại.'}
          </p>
          <p className="text-sm text-slate-600">
            {docs.length === 0
              ? 'Hãy chọn tháng/khoảng ngày khác hoặc bấm "+ Thêm văn bản tham mưu" để tạo mới.'
              : 'Thử bỏ chọn bộ lọc loại hoặc xoá từ khoá tìm kiếm.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {(selectedType !== 'ALL' || searchQuery) && (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] sm:min-h-[32px] text-sm"
                onClick={() => {
                  setSelectedType('ALL')
                  setSearchQuery('')
                }}
              >
                Xoá bộ lọc
              </Button>
            )}
            <Button
              type="button"
              className="min-h-[44px] sm:min-h-[32px] text-sm bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setEditingDoc(null)
                setFormOpen(true)
              }}
            >
              <Plus className="w-4 h-4" />
              Thêm văn bản tham mưu
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredDocs.map((doc) => {
              const sources = getSourceLinks(doc)
              return (
                <article
                  key={doc.id}
                  className={`rounded-xl border bg-white p-4 space-y-2.5 ${
                    doc.highlight ? 'border-l-4 border-l-red-600 border-red-200 bg-red-50/30' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
                      <span className="font-semibold text-slate-800">
                        {formatDMY(doc.advisedDate)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {typeLabelMap.get(doc.type) || doc.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc(doc)
                        setFormOpen(true)
                      }}
                      className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] px-3 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil className="w-4 h-4" />
                      Sửa
                    </button>
                  </div>

                  <p
                    className={`text-sm leading-relaxed break-words ${
                      doc.highlight ? 'text-red-700 font-bold' : 'text-slate-900 font-medium'
                    }`}
                  >
                    {formatAdvisoryLine(doc)}
                  </p>

                  {doc.docNumber && (
                    <p className="text-xs text-slate-600">Số ký hiệu: {doc.docNumber}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                    <Link
                      href={`/weekly-reports/${doc.weekId}`}
                      className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100"
                    >
                      Tuần {formatDMY(doc.weekId)}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    {sources.map((src) => (
                      <Link
                        key={src.id}
                        href={`/documents/${src.id}`}
                        className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
                      >
                        ↩ {src.docNumber || src.title || 'VB gốc'}
                      </Link>
                    ))}

                    {doc.draftLink && (
                      <a
                        href={doc.draftLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100"
                      >
                        Bản thảo
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-32">Ngày</th>
                  <th className="py-3 px-4 w-36">Loại</th>
                  <th className="py-3 px-4">Nội dung văn bản tham mưu</th>
                  <th className="py-3 px-4 w-44">Tuần giao ban</th>
                  <th className="py-3 px-4 w-52">Văn bản gốc</th>
                  <th className="py-3 px-4 w-24 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDocs.map((doc) => {
                  const sources = getSourceLinks(doc)
                  return (
                    <tr
                      key={doc.id}
                      className={doc.highlight ? 'bg-red-50/40' : 'hover:bg-slate-50/70'}
                    >
                      <td className="py-3 px-4 align-top whitespace-nowrap text-slate-700 tabular-nums">
                        {formatDMY(doc.advisedDate)}
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-medium">
                          {typeLabelMap.get(doc.type) || doc.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top space-y-1">
                        <p
                          className={`leading-relaxed break-words ${
                            doc.highlight ? 'text-red-700 font-bold' : 'text-slate-900 font-medium'
                          }`}
                        >
                          {formatAdvisoryLine(doc)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          {doc.docNumber && <span>Số: {doc.docNumber}</span>}
                          {doc.draftLink && (
                            <a
                              href={doc.draftLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-medium"
                            >
                              Bản thảo
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {doc.note && <span className="text-slate-500">Ghi chú: {doc.note}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <Link
                          href={`/weekly-reports/${doc.weekId}`}
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium tabular-nums"
                        >
                          {formatDMY(doc.weekId)}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {sources.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sources.map((src) => (
                              <Link
                                key={src.id}
                                href={`/documents/${src.id}`}
                                title={src.title || 'Mở văn bản gốc'}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-2 py-0.5 text-xs font-medium transition-colors"
                              >
                                ↩ {src.docNumber || src.title || 'VB gốc'}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDoc(doc)
                            setFormOpen(true)
                          }}
                          className="min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Sửa
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AdvisoryForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingDoc(null)
        }}
        editingDoc={editingDoc}
        onSaved={handleRefresh}
        onDeleted={handleRefresh}
      />
    </main>
  )
}
