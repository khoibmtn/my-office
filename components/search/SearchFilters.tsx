'use client'

import { Input } from '@/components/ui/input'
import type { SearchFilters } from '@/hooks/useSearch'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'upload_failed', label: 'Lỗi upload' },
]

export function SearchFilters({
  filters,
  onChange,
}: {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
}) {
  function toggleStatus(val: string) {
    const current = filters.status ?? []
    const next = current.includes(val) ? current.filter((s) => s !== val) : [...current, val]
    onChange({ ...filters, status: next.length ? next : undefined })
  }

  return (
    <div className="w-64 shrink-0 space-y-5 p-4 border border-slate-200 rounded-xl bg-white">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Trạng thái</p>
        <div className="space-y-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.status ?? []).includes(opt.value)}
                onChange={() => toggleStatus(opt.value)}
                className="rounded border-slate-300"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Deadline</p>
        <div className="space-y-1.5">
          <input
            type="date"
            className="w-full text-sm border border-slate-200 rounded-md px-2 py-1"
            value={filters.deadlineFrom ? new Date(filters.deadlineFrom).toISOString().slice(0, 10) : ''}
            onChange={(e) =>
              onChange({ ...filters, deadlineFrom: e.target.value ? new Date(e.target.value).getTime() : undefined })
            }
          />
          <input
            type="date"
            className="w-full text-sm border border-slate-200 rounded-md px-2 py-1"
            value={filters.deadlineTo ? new Date(filters.deadlineTo).toISOString().slice(0, 10) : ''}
            onChange={(e) =>
              onChange({ ...filters, deadlineTo: e.target.value ? new Date(e.target.value).getTime() : undefined })
            }
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Người phụ trách</p>
        <Input
          placeholder="Tên người phụ trách..."
          value={filters.assignee ?? ''}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value || undefined })}
          className="text-sm"
        />
      </div>
    </div>
  )
}
