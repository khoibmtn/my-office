'use client'

import React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useWeeklyReport } from '@/hooks/useWeeklyReport'
import { useAdvisoryDocs } from '@/hooks/useAdvisoryDocs'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { currentWeekId, dayOfWeek, todayVN } from '@/lib/weekly-report/period'
import { ReadingView } from '@/components/weekly-report/ReadingView'

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    dayOfWeek(value) === 5
  )
}

function WeeklyReportReadContent({ weekId }: { weekId: string }) {
  const router = useRouter()
  const { report, loading: reportLoading, error } = useWeeklyReport(weekId)
  const { docs: advisoryDocs, loading: advisoryLoading } = useAdvisoryDocs({ weekId })
  const { config } = useWeeklyReportConfig()

  if ((reportLoading && !report) || (advisoryLoading && !report)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-base text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <p>Đang chuẩn bị bản đọc giao ban…</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm space-y-3 text-base">
          <div className="flex items-center gap-2 font-semibold text-red-700 text-lg">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Không tải được bản đọc giao ban</span>
          </div>
          <p className="text-slate-700">
            {error ? error.message : 'Không tìm thấy dữ liệu của tuần giao ban này.'}
          </p>
          <Link
            href={`/weekly-reports/${weekId}`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 min-h-[44px] font-medium text-white hover:bg-slate-800"
          >
            Quay lại trang soạn
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ReadingView
      report={report}
      advisoryDocs={advisoryDocs}
      config={config}
      onExit={() => router.push(`/weekly-reports/${weekId}`)}
    />
  )
}

export default function WeeklyReportReadPage() {
  const params = useParams<{ weekId: string }>()
  const weekId = Array.isArray(params?.weekId) ? params.weekId[0] : params?.weekId || ''
  const { isAdmin, loading: roleLoading } = useRole()
  const fallbackWeekId = currentWeekId(todayVN(), [])

  if (roleLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm space-y-3 text-base">
          <div className="flex items-center gap-2 font-semibold text-red-700 text-lg">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Không có quyền truy cập</span>
          </div>
          <p className="text-slate-700">
            Bản đọc giao ban tuần chỉ dành cho tài khoản quản trị viên.
          </p>
          <Link
            href="/documents"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 min-h-[44px] font-medium text-white hover:bg-slate-800"
          >
            Quay về Văn bản
          </Link>
        </div>
      </div>
    )
  }

  if (!isValidIsoDate(weekId)) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm space-y-3 text-base">
          <div className="flex items-center gap-2 font-semibold text-amber-800 text-lg">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>Mã tuần không hợp lệ</span>
          </div>
          <p className="text-slate-700">
            Mã tuần cần ở định dạng <code className="rounded bg-slate-100 px-1.5 py-0.5">YYYY-MM-DD</code>.
          </p>
          <Link
            href={`/weekly-reports/${fallbackWeekId}`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 min-h-[44px] font-medium text-white hover:bg-blue-700"
          >
            Về tuần hiện tại
          </Link>
        </div>
      </div>
    )
  }

  return <WeeklyReportReadContent weekId={weekId} />
}
