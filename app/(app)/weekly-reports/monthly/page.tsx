'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRole } from '@/hooks/useRole'
import { todayVN } from '@/lib/weekly-report/period'

export default function MonthlyRedirectPage() {
  const router = useRouter()
  const { isAdmin, loading } = useRole()

  useEffect(() => {
    if (!loading && isAdmin) {
      const currentMonth = todayVN().slice(0, 7)
      router.replace(`/weekly-reports/monthly/${currentMonth}`)
    }
  }, [loading, isAdmin, router])

  if (loading || isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-sm text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span>Đang mở tổng hợp tháng hiện tại…</span>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-700">
            <ShieldAlert className="h-6 w-6 shrink-0" />
            <span>Chỉ dành cho quản trị viên</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <p>
            Trang Tổng hợp giao ban tháng chỉ mở cho tài khoản quản trị viên.
          </p>
          <Button asChild className="h-auto min-h-[44px] sm:min-h-[32px] px-3 py-1.5 text-sm">
            <Link href="/documents">Quay lại trang Văn bản</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
