'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardPaste, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { useWeeks } from '@/hooks/useWeeks'
import { formatAdvisorySummary, parseBulkAdvisoryLines } from '@/lib/weekly-report/advisory-format'
import { createAdvisoryDoc } from '@/lib/weekly-report/firestore'
import { formatDMY, resolvePeriod } from '@/lib/weekly-report/period'
import { DOC_TYPE_PREFIX, type ISODate } from '@/types/weekly-report'

interface PreviewRow {
  key: string
  type: string
  title: string
  highlight: boolean
}

export interface BulkPasteDialogProps {
  open: boolean
  onClose: () => void
  weekId: string
  existingMaxOrder?: number
  onSaved?: (count: number) => void
}

export function BulkPasteDialog(props: BulkPasteDialogProps) {
  if (!props.open) return null
  return <BulkPasteDialogModal {...props} />
}

function BulkPasteDialogModal({
  open,
  onClose,
  weekId,
  existingMaxOrder = -1,
  onSaved,
}: BulkPasteDialogProps) {
  const { config } = useWeeklyReportConfig()
  const { weeks } = useWeeks()

  const sortedDocTypes = useMemo(
    () => [...config.docTypes].sort((a, b) => a.order - b.order),
    [config.docTypes],
  )

  const period = useMemo(() => resolvePeriod(weekId, weeks), [weekId, weeks])

  const [rawText, setRawText] = useState('')
  const [advisedDate, setAdvisedDate] = useState<ISODate>(period.periodEnd)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [rowsEdited, setRowsEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRawText('')
    setRows([])
    setRowsEdited(false)
    setAdvisedDate(period.periodEnd)
    setError(null)
    setProgress(null)
  }, [weekId, period.periodEnd])

  const parseTextToRows = (text: string): PreviewRow[] => {
    const parsed = parseBulkAdvisoryLines(text, sortedDocTypes)
    return parsed.map((item, idx) => ({
      key: `${idx}-${item.raw.slice(0, 16)}`,
      type: item.type,
      title: item.title,
      highlight: false,
    }))
  }

  const handleTextChange = (nextText: string) => {
    setRawText(nextText)
    if (!rowsEdited) {
      setRows(parseTextToRows(nextText))
    }
  }

  const handleReparse = () => {
    setRows(parseTextToRows(rawText))
    setRowsEdited(false)
  }

  const updateRow = (key: string, patch: Partial<PreviewRow>) => {
    setRowsEdited(true)
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const removeRow = (key: string) => {
    setRowsEdited(true)
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  const validRows = useMemo(
    () => rows.filter((r) => r.title.trim().length > 0),
    [rows],
  )

  const previewSummary = useMemo(
    () => formatAdvisorySummary(validRows, sortedDocTypes),
    [validRows, sortedDocTypes],
  )

  const handleSave = async () => {
    if (validRows.length === 0) {
      setError('Chưa có dòng văn bản hợp lệ nào để lưu.')
      return
    }
    if (!advisedDate) {
      setError('Vui lòng chọn ngày tham mưu chung.')
      return
    }

    setSaving(true)
    setError(null)
    setProgress({ done: 0, total: validRows.length })

    const baseOrder = existingMaxOrder + 1
    let savedCount = 0

    try {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        await createAdvisoryDoc({
          type: row.type,
          title: row.title.trim(),
          docNumber: null,
          advisedDate,
          weekId,
          order: baseOrder + i,
          sourceDocumentIds: [],
          sourceSnapshot: [],
          draftLink: null,
          draftDriveFileId: null,
          note: '',
          highlight: row.highlight,
          taskId: null,
        })
        savedCount++
        setProgress({ done: savedCount, total: validRows.length })
      }
      onSaved?.(savedCount)
      onClose()
    } catch (err) {
      if (savedCount > 0) {
        const savedKeys = new Set(validRows.slice(0, savedCount).map((r) => r.key))
        setRows((prev) => prev.filter((r) => !savedKeys.has(r.key)))
        setRowsEdited(true)
      }
      setError(
        `Đã lưu ${savedCount}/${validRows.length} văn bản rồi gặp lỗi: ${
          err instanceof Error ? err.message : 'Không thể lưu dữ liệu'
        }`,
      )
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Dán nhiều dòng văn bản tham mưu"
      className="z-[1005] sm:max-w-3xl shadow-2xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm text-slate-600 tabular-nums">
            {progress
              ? `Đang lưu ${progress.done}/${progress.total} văn bản...`
              : `${validRows.length} văn bản sẽ được ghi vào tuần ${formatDMY(weekId)}`}
          </span>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-base"
              onClick={onClose}
              disabled={saving}
            >
              Đóng
            </Button>
            <Button
              type="button"
              className="min-h-[44px] text-base bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={saving || validRows.length === 0}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu {validRows.length} văn bản tham mưu
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-base text-red-700"
          >
            {error}
          </div>
        )}

        {/* Target week & common date */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-base font-semibold text-blue-950">
              Ghi vào tuần giao ban {formatDMY(weekId)}
            </p>
            <p className="text-sm text-blue-800">
              Kỳ tuần {formatDMY(period.periodStart)} – {formatDMY(period.periodEnd)}
            </p>
          </div>
          <div className="sm:w-52">
            <label htmlFor="bulk-advised-date" className="block text-sm font-medium text-slate-700 mb-1">
              Ngày tham mưu chung
            </label>
            <input
              id="bulk-advised-date"
              type="date"
              value={advisedDate}
              onChange={(e) => setAdvisedDate(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Paste area */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label htmlFor="bulk-paste-input" className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
              <ClipboardPaste className="w-4 h-4 text-blue-600" />
              Dán danh sách văn bản (mỗi dòng một văn bản)
            </label>
            {rowsEdited && rawText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReparse}
                className="min-h-[44px] sm:min-h-[36px] text-sm gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Phân tích lại từ ô dán
              </Button>
            )}
          </div>
          <textarea
            id="bulk-paste-input"
            rows={5}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              'Ví dụ:\n- KH Kế hoạch kiểm tra công tác chuyên môn tháng 11\n- TB Về việc triển khai hướng dẫn mới\n- V/v báo cáo số liệu định kỳ\n- Tờ trình phê duyệt mua sắm vật tư'
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-slate-500">
            Tự động nhận diện tiền tố: KH, CV, BC, TB, QĐ, GM, HD, PA, BB, CB, Tờ trình, V/v (→ CV)…
          </p>
        </div>

        {/* Preview table */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Xem trước &amp; chỉnh sửa ({validRows.length})
            </h3>
            <span className="text-sm text-slate-700 bg-yellow-100 px-2.5 py-1 rounded-md font-medium">
              {previewSummary}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-base text-slate-500">
              Chưa có dòng nào để xem trước. Hãy dán danh sách văn bản từ Google Doc vào ô phía trên.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="hidden md:grid md:grid-cols-[36px_150px_1fr_72px_48px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                <span className="text-center">#</span>
                <span>Loại</span>
                <span>Tên / trích yếu</span>
                <span className="text-center">Tô đỏ</span>
                <span className="text-center">Xoá</span>
              </div>
              <div className="divide-y divide-slate-200 max-h-[320px] overflow-y-auto bg-white">
                {rows.map((row, idx) => (
                  <div
                    key={row.key}
                    className="p-2.5 md:grid md:grid-cols-[36px_150px_1fr_72px_48px] md:items-center gap-2 space-y-2 md:space-y-0"
                  >
                    <span className="hidden md:inline text-center text-sm text-slate-500 tabular-nums">
                      {idx + 1}
                    </span>

                    <div className="flex items-center gap-2 md:block">
                      <span className="md:hidden text-sm font-medium text-slate-500 w-6 tabular-nums">
                        {idx + 1}.
                      </span>
                      <select
                        aria-label={`Loại dòng ${idx + 1}`}
                        value={row.type}
                        onChange={(e) => updateRow(row.key, { type: e.target.value })}
                        className="flex-1 md:w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {sortedDocTypes.map((t) => {
                          const prefix = DOC_TYPE_PREFIX[t.code]
                          const label = prefix && prefix !== t.label ? `${prefix} — ${t.label}` : t.label
                          return (
                            <option key={t.code} value={t.code}>
                              {label}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <input
                      type="text"
                      aria-label={`Tên văn bản dòng ${idx + 1}`}
                      value={row.title}
                      onChange={(e) => updateRow(row.key, { title: e.target.value })}
                      className={`w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        row.highlight ? 'text-red-700 font-bold' : 'text-slate-900'
                      }`}
                    />

                    <div className="flex items-center justify-between md:justify-center gap-3">
                      <label className="inline-flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] cursor-pointer">
                        <input
                          type="checkbox"
                          aria-label={`Tô đỏ dòng ${idx + 1}`}
                          checked={row.highlight}
                          onChange={(e) => updateRow(row.key, { highlight: e.target.checked })}
                          className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="md:hidden text-base text-red-700 font-medium">Tô đỏ</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        aria-label={`Xoá dòng ${idx + 1}`}
                        title="Xoá dòng này"
                        className="md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Xoá dòng ${idx + 1}`}
                      title="Xoá dòng này"
                      className="hidden md:inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ResponsiveModal>
  )
}
