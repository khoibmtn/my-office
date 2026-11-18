'use client'

import Link from 'next/link'
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthlySummary } from '@/components/weekly-report/MonthlySummary'
import { useRole } from '@/hooks/useRole'
import { todayVN } from '@/lib/weekly-report/period'

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default function MonthlyReportPage({ params }: { params: { month: string } }) {
  const { isAdmin, loading } = useRole()
  const month = params.month

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-sm text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span>Đang kiểm tra quyền truy cập…</span>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <span>Không có quyền truy cập</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              Module Giao ban tuần và Tổng hợp tháng chỉ dành cho quản trị viên.
            </p>
            <Button asChild className="h-auto min-h-[44px] sm:min-h-[32px] px-3 py-1.5 text-sm">
              <Link href="/documents">Quay lại trang Văn bản</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!YEAR_MONTH_RE.test(month)) {
    const currentMonth = todayVN().slice(0, 7)
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <span>Tháng không hợp lệ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              Đường dẫn tháng <span className="font-semibold">{month}</span> không đúng định dạng{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">YYYY-MM</code> (ví dụ{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">{currentMonth}</code>).
            </p>
            <Button asChild className="h-auto min-h-[44px] sm:min-h-[32px] px-3 py-1.5 text-sm">
              <Link href={`/weekly-reports/monthly/${currentMonth}`}>
                Về tháng hiện tại
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <MonthlySummary month={month} />
}
