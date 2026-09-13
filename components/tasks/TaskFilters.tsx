'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Search, Filter, X } from 'lucide-react'
import type { TaskStatus, TaskPriority } from '@/types/tasks'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_DOTS } from '@/lib/tasks/constants'
import type { StaffMember } from '@/types'
import type { Department } from '@/types/departments'

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
}

export const DEFAULT_FILTERS: TaskFilterValues = {
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  departmentId: 'all',
  searchQuery: '',
}

export function TaskFilters({ filters, onFilterChange, staffList, departments }: TaskFiltersProps) {
  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'searchQuery') return v !== ''
    return v !== 'all'
  })

  // Local search state for debouncing
  const [localSearch, setLocalSearch] = useState(filters.searchQuery)

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onFilterChange({ ...filters, searchQuery: localSearch })
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
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search box */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Tìm kiếm công việc..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none w-48 placeholder:text-slate-400"
        />
        {localSearch && (
          <button
            onClick={() => { setLocalSearch(''); updateFilter('searchQuery', '') }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="w-px h-5 bg-slate-200" />

      <Filter className="w-4 h-4 text-slate-400 shrink-0" />

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => updateFilter('status', e.target.value as TaskStatus | 'all')}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="all">Tất cả trạng thái</option>
        {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* Priority — with dot prefix */}
      <select
        value={filters.priority}
        onChange={(e) => updateFilter('priority', e.target.value as TaskPriority | 'all')}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="all">Tất cả ưu tiên</option>
        {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([key, label]) => (
          <option key={key} value={key}>{TASK_PRIORITY_DOTS[key]} {label}</option>
        ))}
      </select>

      {/* Assignee */}
      <select
        value={filters.assigneeId}
        onChange={(e) => updateFilter('assigneeId', e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="all">Tất cả người xử lý</option>
        {staffList.filter(s => s.isActive).map(s => (
          <option key={s.id} value={s.id}>{s.shortName}</option>
        ))}
      </select>

      {/* Department */}
      {departments.length > 0 && (
        <select
          value={filters.departmentId}
          onChange={(e) => updateFilter('departmentId', e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="all">Tất cả phòng ban</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
        >
          <X className="w-3 h-3" />
          Xóa bộ lọc
        </button>
      )}
    </div>
  )
}

