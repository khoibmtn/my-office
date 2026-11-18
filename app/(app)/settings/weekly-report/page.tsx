'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  ClipboardList,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { saveConfig } from '@/lib/weekly-report/firestore'
import {
  DEFAULT_DOC_TYPES,
  DEFAULT_WEEKLY_REPORT_CONFIG,
  type DocTypeDef,
} from '@/types/weekly-report'

export default function WeeklyReportSettingsPage() {
  const { isAdmin, loading } = useRole()

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Đang kiểm tra quyền truy cập...</span>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-semibold text-base">
          <ShieldAlert className="w-5 h-5 text-amber-700" />
          <span>Chỉ quản trị viên mới được chỉnh cấu hình Giao ban tuần</span>
        </div>
        <p className="text-sm text-amber-800">
          Vui lòng đăng nhập bằng tài khoản quản trị viên để thay đổi danh mục loại văn bản và nhãn báo cáo.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-[32px] px-4 py-2 rounded-lg bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại cài đặt
        </Link>
      </div>
    )
  }

  return <WeeklyReportSettingsContent />
}

interface EditableDocType extends DocTypeDef {
  rowKey: string
}

function toEditableList(list: DocTypeDef[]): EditableDocType[] {
  return [...list]
    .sort((a, b) => a.order - b.order)
    .map((t, idx) => ({ ...t, rowKey: `${idx}-${t.code}` }))
}

function WeeklyReportSettingsContent() {
  const { config, loading } = useWeeklyReportConfig()

  const [reportTitle, setReportTitle] = useState(DEFAULT_WEEKLY_REPORT_CONFIG.reportTitle)
  const [unitHeading, setUnitHeading] = useState(DEFAULT_WEEKLY_REPORT_CONFIG.unitHeading)
  const [deputySectionLabel, setDeputySectionLabel] = useState(
    DEFAULT_WEEKLY_REPORT_CONFIG.deputySectionLabel,
  )
  const [docTypes, setDocTypes] = useState<EditableDocType[]>(() =>
    toEditableList(DEFAULT_DOC_TYPES),
  )
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBanner, setSavedBanner] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

  useEffect(() => {
    if (loading || isDirty) return
    setReportTitle(config.reportTitle || DEFAULT_WEEKLY_REPORT_CONFIG.reportTitle)
    setUnitHeading(config.unitHeading || DEFAULT_WEEKLY_REPORT_CONFIG.unitHeading)
    setDeputySectionLabel(
      config.deputySectionLabel || DEFAULT_WEEKLY_REPORT_CONFIG.deputySectionLabel,
    )
    setDocTypes(
      toEditableList(config.docTypes?.length ? config.docTypes : DEFAULT_DOC_TYPES),
    )
  }, [config, loading, isDirty])

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const markDirty = () => {
    setIsDirty(true)
    setSavedBanner(false)
    setError(null)
  }

  const handleUpdateType = (rowKey: string, patch: Partial<DocTypeDef>) => {
    markDirty()
    setDocTypes((prev) =>
      prev.map((item) => (item.rowKey === rowKey ? { ...item, ...patch } : item)),
    )
  }

  const handleMoveType = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= docTypes.length) return
    markDirty()
    const next = [...docTypes]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setDocTypes(
      next.map((item, idx) => ({
        ...item,
        order: item.code === 'KHAC' ? 99 : idx + 1,
      })),
    )
  }

  const handleAddType = () => {
    markDirty()
    const nonFallbackOrders = docTypes
      .filter((t) => t.code !== 'KHAC')
      .map((t) => t.order)
    const nextOrder = (nonFallbackOrders.length ? Math.max(...nonFallbackOrders) : 0) + 1
    const newItem: EditableDocType = {
      rowKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: '',
      label: '',
      order: nextOrder,
    }
    const khacIdx = docTypes.findIndex((t) => t.code === 'KHAC')
    if (khacIdx >= 0) {
      const next = [...docTypes]
      next.splice(khacIdx, 0, newItem)
      setDocTypes(next)
    } else {
      setDocTypes([...docTypes, newItem])
    }
  }

  const handleDeleteType = (rowKey: string) => {
    markDirty()
    setDocTypes((prev) => prev.filter((item) => item.rowKey !== rowKey))
    setConfirmDeleteKey(null)
  }

  const handleResetDefaultTypes = () => {
    markDirty()
    setDocTypes(toEditableList(DEFAULT_DOC_TYPES))
    setConfirmDeleteKey(null)
  }

  const duplicateCodes = useMemo(() => {
    const seen = new Set<string>()
    const dups = new Set<string>()
    for (const t of docTypes) {
      const code = t.code.trim()
      if (!code) continue
      if (seen.has(code)) dups.add(code)
      seen.add(code)
    }
    return dups
  }, [docTypes])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportTitle.trim() || !unitHeading.trim() || !deputySectionLabel.trim()) {
      setError('Tiêu đề báo cáo, nhãn đơn vị và nhãn Ý kiến PGĐ không được để trống.')
      return
    }
    const cleanedTypes: DocTypeDef[] = docTypes.map((t) => ({
      code: t.code.trim(),
      label: t.label.trim(),
      order: Number.isFinite(Number(t.order)) ? Number(t.order) : 99,
    }))
    if (cleanedTypes.length === 0) {
      setError('Danh mục loại văn bản phải có ít nhất 1 loại.')
      return
    }
    if (cleanedTypes.some((t) => !t.code || !t.label)) {
      setError('Mỗi loại văn bản phải có đầy đủ Mã loại và Tên hiển thị.')
      return
    }
    if (duplicateCodes.size > 0) {
      setError(`Mã loại bị trùng: ${Array.from(duplicateCodes).join(', ')}`)
      return
    }

    const sortedClean = [...cleanedTypes].sort((a, b) => a.order - b.order)

    setSaving(true)
    setError(null)
    try {
      await saveConfig({
        reportTitle: reportTitle.trim(),
        unitHeading: unitHeading.trim(),
        deputySectionLabel: deputySectionLabel.trim(),
        docTypes: sortedClean,
      })
      setDocTypes(toEditableList(sortedClean))
      setIsDirty(false)
      setSavedBanner(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cấu hình giao ban tuần.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Đang tải cấu hình giao ban tuần...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Danh mục cài đặt
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href="/weekly-reports"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
            >
              <ClipboardList className="w-4 h-4" />
              Giao ban tuần
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href="/weekly-reports/advisory"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
            >
              <BookOpen className="w-4 h-4" />
              Sổ tham mưu
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Cài đặt Giao ban tuần &amp; Văn bản tham mưu
          </h1>
          <p className="text-sm text-slate-600">
            Tuỳ chỉnh nhãn mục trong báo cáo giao ban và danh mục loại văn bản tham mưu.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {savedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Đã lưu cấu hình Giao ban tuần. Loại văn bản mới áp dụng ngay lập tức.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Labels section */}
        <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Nhãn tiêu đề báo cáo</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="cfg-report-title" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Tiêu đề báo cáo
              </label>
              <input
                id="cfg-report-title"
                type="text"
                required
                value={reportTitle}
                onChange={(e) => {
                  markDirty()
                  setReportTitle(e.target.value)
                }}
                placeholder="VD: Báo cáo giao ban Lãnh đạo tuần"
                className="w-full min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="cfg-unit-heading" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Nhãn đơn vị Mục 1
              </label>
              <input
                id="cfg-unit-heading"
                type="text"
                required
                value={unitHeading}
                onChange={(e) => {
                  markDirty()
                  setUnitHeading(e.target.value)
                }}
                placeholder="VD: 1. KHTH"
                className="w-full min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="cfg-deputy-label" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Nhãn mục Ý kiến PGĐ
              </label>
              <input
                id="cfg-deputy-label"
                type="text"
                required
                value={deputySectionLabel}
                onChange={(e) => {
                  markDirty()
                  setDeputySectionLabel(e.target.value)
                }}
                placeholder="VD: Ý kiến PGĐ Khôi"
                className="w-full min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Doc types section */}
        <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Danh mục loại văn bản tham mưu ({docTypes.length})
              </h2>
              <p className="text-xs text-slate-600">
                Thứ tự quyết định vị trí các nút chọn nhanh và thứ tự liệt kê ở dòng đếm &ldquo;Tham mưu VB: ...&rdquo;.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetDefaultTypes}
                className="min-h-[44px] sm:min-h-[32px] text-xs gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Khôi phục mặc định
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddType}
                className="min-h-[44px] sm:min-h-[32px] text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" />
                Thêm loại văn bản
              </Button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[120px_1fr_96px_156px] gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <span>Mã loại</span>
              <span>Tên hiển thị</span>
              <span className="text-right">Thứ tự</span>
              <span className="text-right">Thao tác</span>
            </div>

            <div className="divide-y divide-slate-200">
              {docTypes.map((item, idx) => {
                const isFallback = item.code.trim() === 'KHAC'
                const isDup = duplicateCodes.has(item.code.trim())
                const confirmingDelete = confirmDeleteKey === item.rowKey

                return (
                  <div key={item.rowKey} className="p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_96px_156px] gap-2.5 items-center">
                      <div>
                        <label className="md:hidden block text-xs font-medium text-slate-600 mb-1">
                          Mã loại
                        </label>
                        <input
                          type="text"
                          value={item.code}
                          disabled={isFallback}
                          onChange={(e) =>
                            handleUpdateType(item.rowKey, { code: e.target.value })
                          }
                          placeholder="VD: CV"
                          className={`w-full min-h-[44px] sm:min-h-[32px] rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600 ${
                            isDup ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="md:hidden block text-xs font-medium text-slate-600 mb-1">
                          Tên hiển thị
                        </label>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) =>
                            handleUpdateType(item.rowKey, { label: e.target.value })
                          }
                          placeholder="VD: Công văn"
                          className="w-full min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="md:hidden block text-xs font-medium text-slate-600 mb-1">
                          Thứ tự
                        </label>
                        <input
                          type="number"
                          value={item.order}
                          onChange={(e) =>
                            handleUpdateType(item.rowKey, {
                              order: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-right tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveType(idx, -1)}
                          title="Đưa lên"
                          aria-label="Đưa lên"
                          className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === docTypes.length - 1}
                          onClick={() => handleMoveType(idx, 1)}
                          title="Đưa xuống"
                          aria-label="Đưa xuống"
                          className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isFallback}
                          onClick={() => setConfirmDeleteKey(item.rowKey)}
                          title={
                            isFallback
                              ? 'Loại dự phòng mặc định, không thể xoá'
                              : 'Xoá loại văn bản này'
                          }
                          aria-label="Xoá loại văn bản"
                          className="min-w-[44px] sm:min-w-[32px] min-h-[44px] sm:min-h-[32px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {confirmingDelete && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-red-800">
                          Xác nhận xoá loại &ldquo;{item.label || item.code || 'chưa đặt tên'}&rdquo;?
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="min-h-[36px]"
                          >
                            Huỷ
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteType(item.rowKey)}
                            className="min-h-[36px]"
                          >
                            Xoá
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="min-h-[44px] sm:min-h-[32px] px-6 text-sm bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu cài đặt giao ban tuần
          </Button>
          {isDirty && !saving && (
            <span className="text-xs font-medium text-amber-700">
              Có thay đổi chưa lưu
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
