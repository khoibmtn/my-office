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
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()

  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'created'>('all')
  const [filters, setFilters] = useState<TaskFilterValues>(DEFAULT_FILTERS)
  const [showForm, setShowForm] = useState(false)

  const { tasks: allTasks, loading } = useTasks({ view: 'all' })

  // Segment tasks by tab
  const tabTasks = useMemo(() => {
    return allTasks.filter(t => {
      // Exclude subtasks from main list (they are displayed inside parent task details)
      if (t.parentTaskId) return false

      if (activeTab === 'my') {
        return (
          t.assigneeId === staffId ||
          t.collaboratorIds?.includes(staffId || '') ||
          (isAdmin && !t.assigneeId)
        )
      }
      if (activeTab === 'created') {
        return t.createdBy === staffId || (isAdmin && t.createdBy === 'admin')
      }
      return true
    })
  }, [allTasks, activeTab, staffId, isAdmin])

  // Real-time computed stats
  const stats = useMemo(() => {
    const now = Date.now()
    const activeList = allTasks.filter(t => !t.parentTaskId)
    return {
      pending: activeList.filter(t => t.status === 'pending').length,
      inProgress: activeList.filter(t => t.status === 'in_progress').length,
      blocked: activeList.filter(t => t.status === 'blocked').length,
      overdue: activeList.filter(t => {
        if (t.isClosed || !t.dueDate) return false
        const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
        return due < now
      }).length,
      completedThisWeek: activeList.filter(t => t.status === 'completed').length,
    }
  }, [allTasks])

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const topLevel = allTasks.filter(t => !t.parentTaskId)
    return {
      all: topLevel.length,
      my: topLevel.filter(t =>
        t.assigneeId === staffId ||
        t.collaboratorIds?.includes(staffId || '') ||
        (isAdmin && !t.assigneeId)
      ).length,
      created: topLevel.filter(t => t.createdBy === staffId || (isAdmin && t.createdBy === 'admin')).length,
    }
  }, [allTasks, staffId, isAdmin])

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tabTasks.filter(t => {
      if (filters.status !== 'all' && t.status !== filters.status) return false
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false
      if (filters.assigneeId !== 'all' && t.assigneeId !== filters.assigneeId) return false
      if (filters.departmentId !== 'all' && t.departmentId !== filters.departmentId) return false
      return true
    })
  }, [tabTasks, filters])

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Công việc</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tabTasks.length} công việc
            {stats.overdue > 0 && (
              <span className="text-red-500 font-medium ml-2">• {stats.overdue} quá hạn</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-1" />
            Tạo mới
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
        {[
          { key: 'all', label: 'Tất cả công việc', count: tabCounts.all },
          { key: 'my', label: 'Công việc của tôi', count: tabCounts.my },
          { key: 'created', label: 'Tôi đã giao', count: tabCounts.created },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === tab.key ? 'bg-blue-700/80 text-white' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Chờ xử lý', value: stats.pending, color: 'text-slate-700' },
          { label: 'Đang thực hiện', value: stats.inProgress, color: 'text-blue-600' },
          { label: 'Bị chặn', value: stats.blocked, color: 'text-red-600' },
          { label: 'Quá hạn', value: stats.overdue, color: 'text-red-600' },
          { label: 'Đã hoàn thành', value: stats.completedThisWeek, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
            <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <TaskFilters
        filters={filters}
        onFilterChange={setFilters}
        staffList={staffList}
        departments={departments}
      />

      {/* Task list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <TaskTable
          tasks={filteredTasks}
          emptyMessage={
            activeTab === 'my'
              ? 'Không có công việc nào được giao cho bạn'
              : activeTab === 'created'
              ? 'Bạn chưa giao công việc nào'
              : 'Chưa có công việc nào trong hệ thống'
          }
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
