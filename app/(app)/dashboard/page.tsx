'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useTaskStats } from '@/hooks/useTaskStats'
import { useTasks } from '@/hooks/useTasks'
import { TaskDashboard } from '@/components/tasks/TaskDashboard'
import { TaskTable } from '@/components/tasks/TaskTable'

export default function DashboardPage() {
  const { staffId } = useRole()
  const { stats, loading: statsLoading } = useTaskStats('global', 'all')
  const { tasks: overdueTasks, loading: tasksLoading } = useTasks({
    view: 'my',
    assigneeId: staffId || undefined,
  })

  const loading = statsLoading || tasksLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // Filter overdue from loaded tasks
  const now = new Date()
  const overdueList = overdueTasks.filter(t => {
    if (t.isClosed || !t.dueDate) return false
    const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate.seconds * 1000)
    return due < now
  })

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">📊 Dashboard</h1>
        <p className="text-sm text-slate-500">Tổng quan công việc</p>
      </div>

      <TaskDashboard stats={stats} />

      {/* Overdue tasks */}
      {overdueList.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
            ⚠️ Công việc quá hạn ({overdueList.length})
          </h2>
          <div className="bg-white rounded-xl border border-red-200">
            <TaskTable tasks={overdueList} />
          </div>
        </div>
      )}
    </div>
  )
}
