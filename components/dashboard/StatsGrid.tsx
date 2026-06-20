'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Document } from '@/types'
import { Timestamp } from 'firebase/firestore'

interface StatsGridProps {
  documents: Document[]
}

export function StatsGrid({ documents }: StatsGridProps) {
  const total = documents.length
  const pending = documents.filter(
    (d) => d.status === 'pending' || d.status === 'in_progress'
  ).length
  const overdue = documents.filter((d) => {
    if (!d.deadline) return false
    const date = d.deadline instanceof Timestamp ? d.deadline.toDate() : new Date(d.deadline)
    return date < new Date() && d.status !== 'completed'
  }).length

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tổng văn bản</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Đang xử lý</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{pending}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Quá hạn</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${overdue > 0 ? 'text-red-600' : ''}`}>{overdue}</p>
        </CardContent>
      </Card>
    </div>
  )
}
