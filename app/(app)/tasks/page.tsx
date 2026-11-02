'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, ListChecks, LayoutGrid, Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useTasks,
  isVisibleTask,
  computeTaskStats,
  filterTasksByParams,
  type SpecialTaskStatus,
} from '@/hooks/useTasks'
import { useRole } from '@/hooks/useRole'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { TaskTable } from '@/components/tasks/TaskTable'
import { TaskFilters, DEFAULT_FILTERS, type TaskFilterValues } from '@/components/tasks/TaskFilters'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { TaskCalendar } from '@/components/tasks/TaskCalendar'
import type { TaskStatus } from '@/types/tasks'

const VALID_TASK_STATUSES: TaskStatus[] = [
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
]

const SPECIAL_TASK_STATUSES: SpecialTaskStatus[] = [
  'overdue',
  'due7',
  'open',
  'done_week',
  'done_month',
]

const SPECIAL_STATUS_LABELS: Record<SpecialTaskStatus, string> = {
  overdue: 'Trạng thái: Quá hạn',
  due7: 'Trạng thái: Đến hạn 7 ngày tới',
  open: 'Trạng thái: Đang mở',
  done_week: 'Trạng thái: Hoàn thành tuần này',
  done_month: 'Trạng thái: Hoàn thành tháng này',
}

export default function TasksPage() {
  const { isAdmin, staffId, staffName } = useRole()
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const paramStatus = searchParams.get('status')
  const paramAssigneeId = searchParams.get('assigneeId')
  const paramDepartmentId = searchParams.get('departmentId')
  const paramIncludeCollaborator = searchParams.get('includeCollaborator') === '1'

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'created' | 'unassigned'>('all')
  const [specialStatus, setSpecialStatus] = useState<SpecialTaskStatus | null>(() => {
    if (paramStatus && SPECIAL_TASK_STATUSES.includes(paramStatus as SpecialTaskStatus)) {
      return paramStatus as SpecialTaskStatus
    }
    return null
  })
  const [includeCollaborator, setIncludeCollaborator] = useState<boolean>(
    () => paramIncludeCollaborator
  )
  const [filters, setFilters] = useState<TaskFilterValues>(() => ({
    ...DEFAULT_FILTERS,
    status:
      paramStatus && VALID_TASK_STATUSES.includes(paramStatus as TaskStatus)
        ? (paramStatus as TaskStatus)
        : 'all',
    assigneeId: paramAssigneeId || 'all',
    departmentId: paramDepartmentId || 'all',
  }))
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list')

  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'all') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  useEffect(() => {
    setSpecialStatus(
      paramStatus && SPECIAL_TASK_STATUSES.includes(paramStatus as SpecialTaskStatus)
        ? (paramStatus as SpecialTaskStatus)
        : null
    )
    setIncludeCollaborator(paramIncludeCollaborator)
    setFilters((prev) => ({
      ...prev,
      status:
        paramStatus && VALID_TASK_STATUSES.includes(paramStatus as TaskStatus)
          ? (paramStatus as TaskStatus)
          : 'all',
      assigneeId: paramAssigneeId || 'all',
      departmentId: paramDepartmentId || 'all',
    }))
  }, [paramStatus, paramAssigneeId, paramDepartmentId, paramIncludeCollaborator])

  const handleFilterChange = (nextFilters: TaskFilterValues) => {
    const isReset =
      nextFilters.status === 'all' &&
      nextFilters.priority === 'all' &&
      nextFilters.assigneeId === 'all' &&
      nextFilters.departmentId === 'all' &&
      nextFilters.searchQuery === ''

    const urlUpdates: Record<string, string | null> = {}

    if (isReset) {
      setSpecialStatus(null)
      setIncludeCollaborator(false)
      urlUpdates.status = null
      urlUpdates.assigneeId = null
      urlUpdates.departmentId = null
      urlUpdates.includeCollaborator = null
    } else {
      if (nextFilters.status !== filters.status) {
        setSpecialStatus(null)
        urlUpdates.status = nextFilters.status === 'all' ? null : nextFilters.status
      }
      if (nextFilters.assigneeId !== filters.assigneeId) {
        setIncludeCollaborator(false)
        urlUpdates.assigneeId = nextFilters.assigneeId === 'all' ? null : nextFilters.assigneeId
        urlUpdates.includeCollaborator = null
      }
      if (nextFilters.departmentId !== filters.departmentId) {
        urlUpdates.departmentId =
          nextFilters.departmentId === 'all' ? null : nextFilters.departmentId
      }
    }

    setFilters(nextFilters)
    if (Object.keys(urlUpdates).length > 0) {
      updateUrlParams(urlUpdates)
    }
  }

  const multiDepartmentNames = useMemo(() => {
    if (filters.departmentId === 'all' || !filters.departmentId.includes(',')) return []
    const ids = filters.departmentId
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length <= 1) return []
    return ids.map((id) => departments.find((d) => d.id === id)?.name || id)
  }, [filters.departmentId, departments])

  const hasHiddenFilterChips =
    specialStatus !== null || multiDepartmentNames.length > 0 || includeCollaborator

  const handleRemoveSpecialStatusChip = () => {
    setSpecialStatus(null)
    updateUrlParams({ status: null })
  }

  const handleRemoveMultiDeptChip = () => {
    setFilters((prev) => ({ ...prev, departmentId: 'all' }))
    updateUrlParams({ departmentId: null })
  }

  const handleRemoveIncludeCollabChip = () => {
    setIncludeCollaborator(false)
    updateUrlParams({ includeCollaborator: null })
  }

  const { tasks: allTasks, loading } = useTasks({ view: 'all' })

  const visibleTasks = useMemo(() => {
    return allTasks.filter((t) => isVisibleTask(t, now))
  }, [allTasks, now])

  // Segment tasks by tab
  const tabTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      if (activeTab === 'my') {
        return (
          t.assigneeId === staffId ||
          t.collaboratorIds?.includes(staffId || '')
        )
      }
      if (activeTab === 'created') {
        // Only tasks created by me AND actually assigned to someone
        return (t.createdBy === staffId || (isAdmin && t.createdBy === 'admin')) && !!t.assigneeId
      }
      if (activeTab === 'unassigned') {
        return !t.assigneeId
      }
      return true
    })
  }, [visibleTasks, activeTab, staffId, isAdmin])

  // Real-time computed stats
  const stats = useMemo(() => {
    return computeTaskStats(visibleTasks, now)
  }, [visibleTasks, now])

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: visibleTasks.length,
      my: visibleTasks.filter(
        (t) =>
          t.assigneeId === staffId ||
          t.collaboratorIds?.includes(staffId || '')
      ).length,
      created: visibleTasks.filter(
        (t) => (t.createdBy === staffId || (isAdmin && t.createdBy === 'admin')) && !!t.assigneeId
      ).length,
      unassigned: visibleTasks.filter((t) => !t.assigneeId).length,
    }
  }, [visibleTasks, staffId, isAdmin])

  // Client-side filtering (including fuzzy search and special status from dashboard links)
  const filteredTasks = useMemo(() => {
    return filterTasksByParams(
      tabTasks,
      {
        status: specialStatus ?? filters.status,
        priority: filters.priority,
        assigneeId: filters.assigneeId,
        includeCollaborator,
        departmentId: filters.departmentId,
        searchQuery: filters.searchQuery,
      },
      now
    )
  }, [tabTasks, filters, specialStatus, includeCollaborator, now])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-2.5 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Công việc</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tabTasks.length} công việc
            {stats.overdue > 0 && (
              <span className="text-red-500 font-medium ml-2">• {stats.overdue} quá hạn</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 max-md:px-2 max-md:min-h-[40px] max-md:min-w-[40px] rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                viewMode === 'list' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 shrink-0" /> Danh sách
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 max-md:px-2 max-md:min-h-[40px] max-md:min-w-[40px] rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                viewMode === 'kanban' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1 max-md:px-2 max-md:min-h-[40px] max-md:min-w-[40px] rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                viewMode === 'calendar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" /> Lịch
            </button>
          </div>

          <Link href="/tasks/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white max-md:min-h-[40px] max-md:h-10 max-md:px-3">
              <Plus className="w-4 h-4 mr-1" />
              Tạo mới
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
          { key: 'all', label: 'Tất cả công việc', count: tabCounts.all },
          { key: 'my', label: 'Công việc của tôi', count: tabCounts.my },
          { key: 'created', label: 'Tôi đã giao', count: tabCounts.created },
          { key: 'unassigned', label: 'Chưa giao', count: tabCounts.unassigned },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-1.5 max-md:min-h-[40px] rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
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
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-2.5 pb-1 md:pb-0 md:grid md:grid-cols-5 md:gap-3">
        {[
          { label: 'Chờ xử lý', value: stats.pending, color: 'text-slate-700' },
          { label: 'Đang thực hiện', value: stats.inProgress, color: 'text-blue-600' },
          { label: 'Bị chặn', value: stats.blocked, color: 'text-red-600' },
          { label: 'Quá hạn', value: stats.overdue, color: 'text-red-600' },
          { label: 'Hoàn thành tuần', value: stats.completedThisWeek, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="w-[120px] shrink-0 snap-start md:w-auto md:shrink bg-white rounded-xl border border-slate-200 px-3 py-2 md:px-4 md:py-3 shadow-2xs"
          >
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</div>
            <div className={`text-xl md:text-2xl font-bold mt-0.5 md:mt-1 ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <TaskFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        staffList={staffList}
        departments={departments}
      />

      {/* Active URL filter chips (special status, multi-department, includeCollaborator) */}
      {hasHiddenFilterChips && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Đang lọc theo:</span>
          {specialStatus && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <span>{SPECIAL_STATUS_LABELS[specialStatus]}</span>
              <button
                type="button"
                onClick={handleRemoveSpecialStatusChip}
                aria-label="Bỏ lọc trạng thái đặc biệt"
                className="ml-0.5 rounded-full hover:bg-blue-100 px-1 text-blue-600 hover:text-blue-800 font-bold leading-none max-md:min-w-[40px] max-md:min-h-[40px] max-md:-my-1.5 max-md:-mr-2 max-md:inline-flex max-md:items-center max-md:justify-center"
              >
                ×
              </button>
            </span>
          )}
          {multiDepartmentNames.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span>Khoa/Phòng: {multiDepartmentNames.join(', ')}</span>
              <button
                type="button"
                onClick={handleRemoveMultiDeptChip}
                aria-label="Bỏ lọc nhiều khoa phòng"
                className="ml-0.5 rounded-full hover:bg-indigo-100 px-1 text-indigo-600 hover:text-indigo-800 font-bold leading-none max-md:min-w-[40px] max-md:min-h-[40px] max-md:-my-1.5 max-md:-mr-2 max-md:inline-flex max-md:items-center max-md:justify-center"
              >
                ×
              </button>
            </span>
          )}
          {includeCollaborator && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span>Bao gồm việc phối hợp</span>
              <button
                type="button"
                onClick={handleRemoveIncludeCollabChip}
                aria-label="Bỏ lọc bao gồm việc phối hợp"
                className="ml-0.5 rounded-full hover:bg-emerald-100 px-1 text-emerald-600 hover:text-emerald-800 font-bold leading-none max-md:min-w-[40px] max-md:min-h-[40px] max-md:-my-1.5 max-md:-mr-2 max-md:inline-flex max-md:items-center max-md:justify-center"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Task views */}
      {viewMode === 'list' && (
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
      )}

      {viewMode === 'kanban' && (
        <KanbanBoard
          tasks={filteredTasks}
          allTasks={allTasks}
          actorId={staffId || 'unknown'}
          actorName={staffName || 'Unknown'}
        />
      )}

      {viewMode === 'calendar' && (
        <TaskCalendar tasks={filteredTasks} />
      )}

    </div>
  )
}
