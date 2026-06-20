'use client'

import { useDocuments } from '@/hooks/useDocuments'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { DeadlineTimeline } from '@/components/dashboard/DeadlineTimeline'

export default function DashboardPage() {
  const { documents } = useDocuments()

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <StatsGrid documents={documents} />
      <DeadlineTimeline />
    </div>
  )
}
