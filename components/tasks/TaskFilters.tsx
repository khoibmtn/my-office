'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { TaskStatus, TaskPriority } from '@/types/tasks'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS } from '@/lib/tasks/constants'
import type { StaffMember } from '@/types'
import type { Department } from '@/types/departments'

export type TaskScopeTab = 'all' | 'my' | 'created' | 'unassigned'

export interface TaskFilterValues {
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  assigneeId: string | 'all'
  departmentId: string | 'all'
  searchQuery: string
}

interface TaskFiltersProps {
  filters: TaskFilterValues
  onFilterChange: (filters: TaskFilterValues) => void
  staffList: StaffMember[]
  departments: Department[]
  scopeTab?: TaskScopeTab
  onScopeTabChange?: (tab: TaskScopeTab) => void
  scopeCounts?: Record<TaskScopeTab, number>
}

export const DEFAULT_FILTERS: TaskFilterValues = {
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  departmentId: 'all',
  searchQuery: '',
}

const SCOPE_LABELS: Record<TaskScopeTab, string> = {
  all: 'Tất cả công việc',
  my: 'Việc của tôi',
  created: 'Tôi đã giao',
  unassigned: 'Chưa giao',
}

export function TaskFilters({
  filters,
  onFilterChange,
  staffList,
  departments,
  scopeTab = 'all',
  onScopeTabChange,
  scopeCounts,
}: TaskFiltersProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState(filters.searchQuery)

  const latestRef = useRef({ filters, onFilterChange })
  latestRef.current = { filters, onFilterChange }

  const activeSelectFilterCount = [
    filters.status !== 'all',
    filters.priority !== 'all',
    filters.assigneeId !== 'all',
    filters.departmentId !== 'all',
    Boolean(onScopeTabChange && scopeTab !== 'all'),
  ].filter(Boolean).length

  const hasAnyActiveFilter = activeSelectFilterCount > 0 || filters.searchQuery !== ''

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = latestRef.current
      if (localSearch !== current.filters.searchQuery) {
        current.onFilterChange({ ...current.filters, searchQuery: localSearch })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch])

  // Sync external changes
  useEffect(() => {
    setLocalSearch(filters.searchQuery)
  }, [filters.searchQuery])

  const updateFilter = <K extends keyof TaskFilterValues>(key: K, value: TaskFilterValues[K]) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    setLocalSearch('')
    onFilterChange(DEFAULT_FILTERS)
    onScopeTabChange?.('all')
  }

  const selectedAssigneeName =
    filters.assigneeId !== 'all'
      ? staffList.find((s) => s.id === filters.assigneeId)?.shortName || filters.assigneeId
      : null

  const singleDepartmentName =
    filters.departmentId !== 'all' && !filters.departmentId.includes(',')
      ? departments.find((d) => d.id === filters.departmentId)?.name || filters.departmentId
      : null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Search box */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm kiếm công việc..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            aria-label="Tìm kiếm công việc"
            className="w-full min-h-[44px] h-11 sm:h-10 text-base sm:text-sm border border-slate-200 rounded-xl pl-9 pr-11 bg-white text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 transition-all"
          />
          {localSearch && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => {
                setLocalSearch('')
                updateFilter('searchQuery', '')
              }}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Single unified Filter button */}
        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          aria-label={activeSelectFilterCount > 0 ? `Lọc (${activeSelectFilterCount})` : 'Lọc'}
          className={`inline-flex items-center justify-center gap-2 min-h-[44px] h-11 sm:h-10 px-3.5 rounded-xl border text-sm font-medium shrink-0 transition-colors ${
            activeSelectFilterCount > 0
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4 shrink-0" />
          <span>{activeSelectFilterCount > 0 ? `Lọc (${activeSelectFilterCount})` : 'Lọc'}</span>
        </button>

        {hasAnyActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="hidden sm:inline-flex items-center gap-1 min-h-[40px] px-2.5 rounded-xl text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
            Bỏ lọc
          </button>
        )}
      </div>

      {/* Compact chips for active filters */}
      {activeSelectFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {onScopeTabChange && scopeTab !== 'all' && (
            <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <span>Phạm vi: {SCOPE_LABELS[scopeTab]}</span>
              <button
                type="button"
                onClick={() => onScopeTabChange('all')}
                aria-label="Bỏ lọc phạm vi"
                className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {filters.status !== 'all' && (
            <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <span>Trạng thái: {TASK_STATUS_LABELS[filters.status]}</span>
              <button
                type="button"
                onClick={() => updateFilter('status', 'all')}
                aria-label="Bỏ lọc trạng thái"
                className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-blue-100 text-blue-600 hover:text-blue-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {filters.priority !== 'all' && (
            <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <span>Ưu tiên: {TASK_PRIORITY_LABELS[filters.priority]}</span>
              <button
                type="button"
                onClick={() => updateFilter('priority', 'all')}
                aria-label="Bỏ lọc ưu tiên"
                className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-amber-100 text-amber-700 hover:text-amber-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {selectedAssigneeName && (
            <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span>Người xử lý: {selectedAssigneeName}</span>
              <button
                type="button"
                onClick={() => updateFilter('assigneeId', 'all')}
                aria-label="Bỏ lọc người xử lý"
                className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {singleDepartmentName && (
            <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span>Phòng ban: {singleDepartmentName}</span>
              <button
                type="button"
                onClick={() => updateFilter('departmentId', 'all')}
                aria-label="Bỏ lọc phòng ban"
                className="max-md:min-w-[44px] max-md:min-h-[44px] max-md:-my-2 max-md:-mr-1 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="sm:hidden inline-flex items-center gap-1 min-h-[44px] px-2.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Bỏ lọc
            </button>
          )}
        </div>
      )}

      {/* Filter ResponsiveModal (both mobile and desktop) */}
      <ResponsiveModal
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Lọc công việc"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setIsFilterModalOpen(false)
              }}
              className="flex-1 min-h-[44px] h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Bỏ lọc
            </button>
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="flex-1 min-h-[44px] h-11 px-4 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Áp dụng
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {onScopeTabChange && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Phạm vi công việc
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'my', 'created', 'unassigned'] as TaskScopeTab[]).map((key) => {
                  const active = scopeTab === key
                  const count = scopeCounts?.[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onScopeTabChange(key)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-medium text-left flex items-center justify-between gap-2 transition-colors ${
                        active
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{SCOPE_LABELS[key]}</span>
                      {typeof count === 'number' && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                            active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="task-filter-status" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Trạng thái
            </label>
            <select
              id="task-filter-status"
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value as TaskStatus | 'all')}
              className="w-full min-h-[44px] h-11 text-base sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-filter-priority" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Mức độ ưu tiên
            </label>
            <select
              id="task-filter-priority"
              value={filters.priority}
              onChange={(e) => updateFilter('priority', e.target.value as TaskPriority | 'all')}
              className="w-full min-h-[44px] h-11 text-base sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
            >
              <option value="all">Tất cả ưu tiên</option>
              {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([key, label]) => (
                <option key={key} value={key}>{TASK_PRIORITY_DOTS[key]} {label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-filter-assignee" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Người xử lý
            </label>
            <select
              id="task-filter-assignee"
              value={filters.assigneeId}
              onChange={(e) => updateFilter('assigneeId', e.target.value)}
              className="w-full min-h-[44px] h-11 text-base sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
            >
              <option value="all">Tất cả người xử lý</option>
              {staffList.filter((s) => s.isActive).map((s) => (
                <option key={s.id} value={s.id}>{s.shortName}</option>
              ))}
            </select>
          </div>

          {departments.length > 0 && (
            <div>
              <label htmlFor="task-filter-department" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Phòng ban
              </label>
              <select
                id="task-filter-department"
                value={filters.departmentId}
                onChange={(e) => updateFilter('departmentId', e.target.value)}
                className="w-full min-h-[44px] h-11 text-base sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              >
                <option value="all">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </ResponsiveModal>
    </div>
  )
}
