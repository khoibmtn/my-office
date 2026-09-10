'use client'

import React, { useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { TaskTable } from '@/components/tasks/TaskTable'
import { TaskFilters, DEFAULT_FILTERS, type TaskFilterValues } from '@/components/tasks/TaskFilters'

export default function AllTasksPage() {
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const [filters, setFilters] = useState<TaskFilterValues>(DEFAULT_FILTERS)

  const { tasks, loading } = useTasks({ view: 'all' })

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
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tất cả công việc</h1>
        <p className="text-sm text-slate-500 mt-0.5">{filteredTasks.length} / {tasks.length} công việc</p>
      </div>

      <TaskFilters
        filters={filters}
        onFilterChange={setFilters}
        staffList={staffList}
        departments={departments}
      />

      <div className="bg-white rounded-xl border border-slate-200">
        <TaskTable tasks={filteredTasks} />
      </div>
    </div>
  )
}
