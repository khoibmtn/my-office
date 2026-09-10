'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ListChecks, LayoutGrid, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import { useRole } from '@/hooks/useRole'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { useTaskStats } from '@/hooks/useTaskStats'
import { TaskTable } from '@/components/tasks/TaskTable'
import { TaskFilters, DEFAULT_FILTERS, type TaskFilterValues } from '@/components/tasks/TaskFilters'
import { TaskForm } from '@/components/tasks/TaskForm'
import { TASK_STATUS_LABELS } from '@/lib/tasks/constants'

export default function TasksPage() {
  const { isAdmin, staffId, staffName } = useRole()
  const { staffList } = useStaff()
  const { departments } = useDepartments()
  const { stats } = useTaskStats('user', staffId || 'global')

  const [filters, setFilters] = useState<TaskFilterValues>(DEFAULT_FILTERS)
  const [showForm, setShowForm] = useState(false)

  const { tasks, loading } = useTasks({
    view: 'my',
    assigneeId: staffId || undefined,
  })

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filters.status !== 'all' && t.status !== filters.status) return false
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false
      if (filters.assigneeId !== 'all' && t.assigneeId !== filters.assigneeId) return false
      if (filters.departmentId !== 'all' && t.departmentId !== filters.departmentId) return false
      return true
    })
  }, [tasks, filters])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Công việc của tôi</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tasks.length} công việc
            {stats && stats.overdue > 0 && (
              <span className="text-red-500 font-medium ml-2">• {stats.overdue} quá hạn</span>
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Tạo mới
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Chờ xử lý', value: stats.pending, color: 'text-slate-700' },
            { label: 'Đang thực hiện', value: stats.inProgress, color: 'text-blue-600' },
            { label: 'Bị chặn', value: stats.blocked, color: 'text-red-600' },
            { label: 'Quá hạn', value: stats.overdue, color: 'text-red-600' },
            { label: 'Hoàn thành tuần', value: stats.completedThisWeek, color: 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
              <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <TaskFilters
        filters={filters}
        onFilterChange={setFilters}
        staffList={staffList}
        departments={departments}
      />

      {/* Task list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <TaskTable
          tasks={filteredTasks}
          emptyMessage="Không có công việc nào được giao cho bạn"
        />
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <TaskForm
              actorId={staffId || 'unknown'}
              actorName={staffName || 'Unknown'}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
