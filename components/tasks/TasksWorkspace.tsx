'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  CalendarClock,
  ListChecks,
  LayoutGrid,
  Calendar,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react'
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
import { subscribeWeeks } from '@/lib/weekly-report/firestore'
import { resolvePeriod } from '@/lib/weekly-report/period'
import {
  getDefaultWeeklyPeriod,
  groupTasksForWeeklyPeriod,
  shiftWeeklyPeriod,
} from '@/lib/tasks/weekly-bridge'
import { TaskQuickAdd } from '@/components/tasks/TaskQuickAdd'
import {
  TaskFilters,
  DEFAULT_FILTERS,
  type TaskFilterValues,
  type TaskScopeTab,
} from '@/components/tasks/TaskFilters'
import { TaskWeekView } from '@/components/tasks/TaskWeekView'
import { TaskTable } from '@/components/tasks/TaskTable'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { TaskCalendar } from '@/components/tasks/TaskCalendar'
import { RecurringSeriesView } from '@/components/tasks/RecurringSeriesView'
import type { TaskStatus } from '@/types/tasks'
import type { WeeklyReport } from '@/types/weekly-report'

export type TasksViewMode = 'week' | 'list' | 'kanban' | 'calendar' | 'recurring'

const VALID_VIEW_MODES: TasksViewMode[] = ['week', 'list', 'kanban', 'calendar', 'recurring']

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

const VIEW_TABS: { key: TasksViewMode; label: string; icon: React.ElementType }[] = [
  { key: 'week', label: 'Tuần này', icon: CalendarClock },
  { key: 'list', label: 'Danh sách', icon: ListChecks },
  { key: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { key: 'calendar', label: 'Lịch', icon: Calendar },
  { key: 'recurring', label: 'Định kỳ', icon: RefreshCw },
]

export interface TasksWorkspaceProps {
  initialMode?: TasksViewMode
}

export function TasksWorkspace({ initialMode }: TasksWorkspaceProps) {
  const { isAdmin, staffId, staffName } = useRole()
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const paramView = searchParams.get('view')
  const paramStatus = searchParams.get('status')
  const paramAssigneeId = searchParams.get('assigneeId')
  const paramDepartmentId = searchParams.get('departmentId')
  const paramIncludeCollaborator = searchParams.get('includeCollaborator') === '1'

  const resolveMode = useCallback((): TasksViewMode => {
    if (paramView && VALID_VIEW_MODES.includes(paramView as TasksViewMode)) {
      return paramView as TasksViewMode
    }
    if (initialMode) {
      return initialMode
    }
    if (paramStatus || paramAssigneeId || paramDepartmentId) {
      return 'list'
    }
    return 'week'
  }, [paramView, initialMode, paramStatus, paramAssigneeId, paramDepartmentId])

  const [viewMode, setViewMode] = useState<TasksViewMode>(resolveMode)
  useEffect(() => {
    setViewMode(resolveMode())
  }, [resolveMode])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Only subscribe to weeklyReports when admin (matches Firestore security rules)
  const [weeks, setWeeks] = useState<WeeklyReport[]>([])
  useEffect(() => {
    if (!isAdmin) {
      setWeeks([])
      return
    }
    return subscribeWeeks(
      (w) => setWeeks(w),
      () => setWeeks([])
    )
  }, [isAdmin])

  const defaultWeek = useMemo(() => getDefaultWeeklyPeriod(weeks, new Date(now)), [weeks, now])
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null)
  const activeWeekId = selectedWeekId ?? defaultWeek.weekId
  const activePeriod = useMemo(
    () => resolvePeriod(activeWeekId, weeks),
    [activeWeekId, weeks]
  )
  const activeWeekDoc = useMemo(
    () => weeks.find((w) => w.id === activeWeekId) ?? null,
    [weeks, activeWeekId]
  )

  const [scopeTab, setScopeTab] = useState<TaskScopeTab>('all')
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

  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>, targetPath: string = pathname) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'all') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      const qs = next.toString()
      const dest = qs ? `${targetPath}?${qs}` : targetPath
      if (targetPath !== pathname) {
        router.push(dest)
      } else {
        router.replace(dest, { scroll: false })
      }
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

  const handleModeChange = (nextMode: TasksViewMode) => {
    setViewMode(nextMode)
    const viewParam = nextMode === 'week' ? null : nextMode
    if (pathname !== '/tasks') {
      updateUrlParams({ view: viewParam }, '/tasks')
    } else {
      updateUrlParams({ view: viewParam }, '/tasks')
    }
  }

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

  const tabTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      if (scopeTab === 'my') {
        return (
          t.assigneeId === staffId ||
          t.collaboratorIds?.includes(staffId || '')
        )
      }
      if (scopeTab === 'created') {
        return (t.createdBy === staffId || (isAdmin && t.createdBy === 'admin')) && !!t.assigneeId
      }
      if (scopeTab === 'unassigned') {
        return !t.assigneeId
      }
      return true
    })
  }, [visibleTasks, scopeTab, staffId, isAdmin])

  const stats = useMemo(() => computeTaskStats(visibleTasks, now), [visibleTasks, now])

  const weeklySummaryGroups = useMemo(
    () => groupTasksForWeeklyPeriod(visibleTasks, activePeriod, now),
    [visibleTasks, activePeriod, now]
  )

  const tabCounts = useMemo<Record<TaskScopeTab, number>>(() => {
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

  if (loading && viewMode !== 'recurring') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-4">
      {/* Compact Header: Title + Stat Chips + 5-Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-bold text-slate-900">Công việc</h1>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
              Đang mở <strong>{stats.open}</strong>
            </span>

            {stats.overdue > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 tabular-nums">
                Quá hạn {stats.overdue}
              </span>
            )}

            {stats.blocked > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
                Bị chặn {stats.blocked}
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
              Xong trong kỳ <strong>{weeklySummaryGroups.completedInPeriod.length}</strong>
            </span>
          </div>
        </div>

        {/* 5-Mode Segmented Control */}
        <div
          role="tablist"
          aria-label="Chế độ xem công việc"
          className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full"
        >
          {VIEW_TABS.map(({ key, label, icon: Icon }) => {
            const isActive = viewMode === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleModeChange(key)}
                className={`px-3 py-1.5 max-md:min-h-[44px] rounded-lg text-sm font-medium transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick Add + Unified Filter (for week / list / kanban / calendar) */}
      {viewMode !== 'recurring' && (
        <div className="space-y-2.5">
          <TaskQuickAdd defaultDueDate={activePeriod.periodEnd} />

          <TaskFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            staffList={staffList}
            departments={departments}
            scopeTab={scopeTab}
            onScopeTabChange={setScopeTab}
            scopeCounts={tabCounts}
          />

          {/* Active URL filter chips (special status, multi-department, includeCollaborator) */}
          {hasHiddenFilterChips && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Đang lọc theo:</span>
              {specialStatus && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <span>{SPECIAL_STATUS_LABELS[specialStatus]}</span>
                  <button
                    type="button"
                    onClick={handleRemoveSpecialStatusChip}
                    aria-label="Bỏ lọc trạng thái đặc biệt"
                    className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-blue-100 text-blue-600 hover:text-blue-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {multiDepartmentNames.length > 0 && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span>Khoa/Phòng: {multiDepartmentNames.join(', ')}</span>
                  <button
                    type="button"
                    onClick={handleRemoveMultiDeptChip}
                    aria-label="Bỏ lọc nhiều khoa phòng"
                    className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-indigo-100 text-indigo-600 hover:text-indigo-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {includeCollaborator && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span>Bao gồm việc phối hợp</span>
                  <button
                    type="button"
                    onClick={handleRemoveIncludeCollabChip}
                    aria-label="Bỏ lọc bao gồm việc phối hợp"
                    className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-emerald-100 text-emerald-600 hover:text-emerald-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active View */}
      {viewMode === 'week' && (
        <TaskWeekView
          tasks={filteredTasks}
          allTasks={allTasks}
          period={activePeriod}
          weeks={weeks}
          actualMeetingDate={activeWeekDoc?.actualMeetingDate}
          isDefaultPeriod={activeWeekId === defaultWeek.weekId}
          onPrevPeriod={() =>
            setSelectedWeekId(shiftWeeklyPeriod(activeWeekId, -1, weeks).weekId)
          }
          onNextPeriod={() =>
            setSelectedWeekId(shiftWeeklyPeriod(activeWeekId, 1, weeks).weekId)
          }
          onResetToCurrentPeriod={() => setSelectedWeekId(null)}
          now={now}
        />
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <TaskTable
            tasks={filteredTasks}
            emptyMessage={
              scopeTab === 'my'
                ? 'Không có công việc nào được giao cho bạn'
                : scopeTab === 'created'
                ? 'Bạn chưa giao công việc nào'
                : 'Chưa có công việc nào phù hợp'
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

      {viewMode === 'calendar' && <TaskCalendar tasks={filteredTasks} />}

      {viewMode === 'recurring' && <RecurringSeriesView />}
    </div>
  )
}
