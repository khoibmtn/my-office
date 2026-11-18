'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useWeeks } from '@/hooks/useWeeks'
import { currentWeekId, todayVN } from '@/lib/weekly-report/period'

function RedirectToCurrentWeek() {
  const router = useRouter()
  const { weeks, loading } = useWeeks()

  useEffect(() => {
    if (loading) return
    const targetId = currentWeekId(todayVN(), weeks)
    router.replace(`/weekly-reports/${targetId}`)
  }, [loading, weeks, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-base text-slate-600">
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      <p>Đang mở tuần giao ban hiện tại…</p>
    </div>
  )
}

export default function WeeklyReportsIndexPage() {
  const { isAdmin, loading: roleLoading } = useRole()

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
          <div className="flex items-center gap-2 text-red-700 font-semibold text-lg">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Không có quyền truy cập</span>
          </div>
          <p className="text-slate-700">
            Module Giao ban tuần chỉ dành cho tài khoản quản trị viên.
          </p>
          <Link
            href="/documents"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 min-h-[44px] font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Quay về Văn bản
          </Link>
        </div>
      </div>
    )
  }

  return <RedirectToCurrentWeek />
}
