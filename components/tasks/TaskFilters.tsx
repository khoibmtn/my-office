'use client'

import React, { useState, useMemo } from 'react'
import { Filter, X } from 'lucide-react'
import type { TaskStatus, TaskPriority } from '@/types/tasks'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/tasks/constants'
import type { StaffMember } from '@/types'
import type { Department } from '@/types/departments'

export interface TaskFilterValues {
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  assigneeId: string | 'all'
  departmentId: string | 'all'
}

interface TaskFiltersProps {
  filters: TaskFilterValues
  onFilterChange: (filters: TaskFilterValues) => void
  staffList: StaffMember[]
  departments: Department[]
}

const DEFAULT_FILTERS: TaskFilterValues = {
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  departmentId: 'all',
}

export function TaskFilters({ filters, onFilterChange, staffList, departments }: TaskFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(v => v !== 'all')

  const updateFilter = <K extends keyof TaskFilterValues>(key: K, value: TaskFilterValues[K]) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const clearFilters = () => onFilterChange(DEFAULT_FILTERS)

  return (
    <div className="flex items-center gap-2 flex-wrap">
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

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={(e) => updateFilter('priority', e.target.value as TaskPriority | 'all')}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="all">Tất cả ưu tiên</option>
        {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
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

export { DEFAULT_FILTERS }
