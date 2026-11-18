'use client'

import React, { useState } from 'react'
import { CheckCircle2, Lock, Unlock } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import type { WeeklyReportStatus } from '@/types/weekly-report'

export interface FinalizeBarProps {
  status: WeeklyReportStatus
  finalizedAt?: unknown
  hasPendingSaves?: boolean
  onFinalize: () => Promise<void>
  onReopen: () => Promise<void>
}

function formatFinalizedTime(ts: unknown): string {
  if (!ts) return ''
  try {
    let d: Date | null = null
    if (ts instanceof Date) d = ts
    else if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      d = (ts as { toDate: () => Date }).toDate()
    } else if (typeof (ts as { seconds?: number }).seconds === 'number') {
      d = new Date((ts as { seconds: number }).seconds * 1000)
    }
    if (!d || Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(d)
  } catch {
    return ''
  }
}

export function FinalizeBar({
  status,
  finalizedAt,
  hasPendingSaves = false,
  onFinalize,
  onReopen,
}: FinalizeBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalizedLabel = formatFinalizedTime(finalizedAt)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (status === 'draft') {
        await onFinalize()
      } else {
        await onReopen()
      }
      setConfirmOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại, vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          {status === 'finalized' ? (
            <>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Tuần giao ban đã được chốt</span>
              </div>
              <p className="text-xs text-slate-600">
                {finalizedLabel
                  ? `Chốt lúc ${finalizedLabel}. Đã lưu bản chụp (snapshot); muốn chỉnh sửa hãy bấm "Mở lại".`
                  : 'Đã lưu bản chụp (snapshot); muốn chỉnh sửa hãy bấm "Mở lại".'}
              </p>
            </>
          ) : (
            <>
              <div className="font-semibold text-sm text-slate-900">
                Hoàn tất soạn thảo tuần giao ban
              </div>
              <p className="text-xs text-slate-600">
                Khi bấm &ldquo;Chốt tuần&rdquo;, hệ thống sẽ lưu lại một bản chụp toàn bộ nội dung và danh sách văn bản tham mưu của tuần này.
              </p>
            </>
          )}
        </div>

        <div className="shrink-0">
          {status === 'draft' ? (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setConfirmOpen(true)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-1.5 min-h-[44px] sm:min-h-[32px] w-full sm:w-auto text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span>Chốt tuần</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setConfirmOpen(true)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-1.5 min-h-[44px] sm:min-h-[32px] w-full sm:w-auto text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <Unlock className="h-4 w-4 shrink-0" />
              <span>Mở lại</span>
            </button>
          )}
        </div>
      </section>

      <ResponsiveModal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title={status === 'draft' ? 'Xác nhận chốt tuần giao ban' : 'Xác nhận mở lại tuần đã chốt'}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
              className="min-h-[44px] sm:min-h-[32px] text-sm"
            >
              Huỷ
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className={`min-h-[44px] sm:min-h-[32px] text-sm text-white ${
                status === 'draft'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {submitting
                ? 'Đang xử lý…'
                : status === 'draft'
                  ? 'Xác nhận chốt tuần'
                  : 'Xác nhận mở lại'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          {status === 'draft' ? (
            <>
              <p>
                Hệ thống sẽ lưu các thay đổi chưa lưu (nếu có), tạo một bản chụp (snapshot) của tuần hiện tại và khoá chỉnh sửa để chuẩn bị đọc giao ban.
              </p>
              {hasPendingSaves && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
                  Đang có thay đổi chưa đồng bộ — hệ thống sẽ lưu trước khi chốt.
                </p>
              )}
            </>
          ) : (
            <p>
              Hệ thống sẽ tạo một bản chụp lưu trạng thái hiện tại trước khi mở lại tuần về trạng thái <strong>Đang soạn</strong> để bạn chỉnh sửa tiếp.
            </p>
          )}

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              {error}
            </div>
          )}
        </div>
      </ResponsiveModal>
    </>
  )
}
