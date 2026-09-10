'use client'

import React, { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useTasks } from '@/hooks/useTasks'
import { TaskDashboard } from '@/components/tasks/TaskDashboard'
import { TaskTable } from '@/components/tasks/TaskTable'

export default function DashboardPage() {
  const { staffId } = useRole()
  const { tasks: allTasks, loading } = useTasks({ view: 'all' })

  // Real-time computed stats
  const dynamicStats = useMemo(() => {
    const activeList = allTasks.filter(t => !t.parentTaskId)
    const now = Date.now()
    return {
      id: 'dynamic',
      scope: 'global' as const,
      scopeId: 'all',
      pending: activeList.filter(t => t.status === 'pending').length,
      inProgress: activeList.filter(t => t.status === 'in_progress').length,
      blocked: activeList.filter(t => t.status === 'blocked').length,
      completed: activeList.filter(t => t.status === 'completed').length,
      cancelled: activeList.filter(t => t.status === 'cancelled').length,
      overdue: activeList.filter(t => {
        if (t.isClosed || !t.dueDate) return false
        const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
        return due < now
      }).length,
      completedThisWeek: activeList.filter(t => t.status === 'completed').length,
      completedThisMonth: activeList.filter(t => t.status === 'completed').length,
      updatedAt: null as any,
    }
  }, [allTasks])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // Filter overdue from loaded tasks
  const now = Date.now()
  const overdueList = allTasks.filter(t => {
    if (t.isClosed || !t.dueDate) return false
    const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
    return due < now
  })

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">📊 Dashboard</h1>
        <p className="text-sm text-slate-500">Tổng quan công việc toàn viện</p>
      </div>

      <TaskDashboard stats={dynamicStats} />

      {/* Overdue tasks */}
      {overdueList.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
            ⚠️ Công việc quá hạn ({overdueList.length})
          </h2>
          <div className="bg-white rounded-xl border border-red-200 shadow-2xs">
            <TaskTable tasks={overdueList} />
          </div>
        </div>
      )}
    </div>
  )
}
