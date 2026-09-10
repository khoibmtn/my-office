'use client'

import React, { useState } from 'react'
import { X, Calendar, CalendarRange, Layers, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type RecurrenceMutationScope = 'this_only' | 'this_and_future' | 'all'

interface RecurringScopeModalProps {
  isOpen: boolean
  action?: 'edit' | 'delete'
  taskTitle: string
  onClose: () => void
  onConfirm: (scope: RecurrenceMutationScope) => void
  loading?: boolean
}

export function RecurringScopeModal({
  isOpen,
  action = 'edit',
  taskTitle,
  onClose,
  onConfirm,
  loading = false,
}: RecurringScopeModalProps) {
  const [selectedScope, setSelectedScope] = useState<RecurrenceMutationScope>('this_only')

  if (!isOpen) return null

  const isDelete = action === 'delete'

  const options: {
    id: RecurrenceMutationScope
    title: string
    description: string
    icon: React.ElementType
    badge?: string
  }[] = [
    {
      id: 'this_only',
      title: isDelete ? 'Chỉ xóa kỳ này' : 'Chỉ áp dụng cho kỳ này',
      description: isDelete
        ? 'Xóa công việc của kỳ hiện tại. Các kỳ định kỳ tiếp theo vẫn sẽ diễn ra bình thường.'
        : 'Tách công việc này thành công việc riêng lẻ. Chuỗi định kỳ vẫn giữ nguyên cấu hình cũ.',
      icon: Calendar,
      badge: 'Mặc định',
    },
    {
      id: 'this_and_future',
      title: isDelete ? 'Kỳ này và tất cả các kỳ sau' : 'Kỳ này và tất cả các kỳ tiếp theo',
      description: isDelete
        ? 'Dừng chuỗi định kỳ kể từ ngày này. Các kỳ trước đó trong quá khứ vẫn được lưu giữ.'
        : 'Bắt đầu một chuỗi mới từ kỳ này với cấu hình mới. Lịch sử các kỳ trước được bảo lưu nguyên vẹn.',
      icon: CalendarRange,
    },
    {
      id: 'all',
      title: isDelete ? 'Toàn bộ chuỗi công việc' : 'Tất cả các công việc trong chuỗi',
      description: isDelete
        ? 'Hủy bỏ chuỗi định kỳ và xóa toàn bộ các kỳ chưa hoàn thành.'
        : 'Cập nhật thiết lập của chuỗi định kỳ và áp dụng cho tất cả các kỳ chưa đóng.',
      icon: Layers,
    },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isDelete ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isDelete ? 'Xóa công việc định kỳ' : 'Chỉnh sửa công việc định kỳ'}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {taskTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2.5 pt-1">
          {options.map((opt) => {
            const Icon = opt.icon
            const isSelected = selectedScope === opt.id

            return (
              <label
                key={opt.id}
                className={`
                  flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }
                `}
                onClick={() => setSelectedScope(opt.id)}
              >
                <div className="pt-0.5">
                  <input
                    type="radio"
                    name="recurrence-scope"
                    checked={isSelected}
                    onChange={() => setSelectedScope(opt.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{opt.title}</span>
                    {opt.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
              </label>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onConfirm(selectedScope)}
            disabled={loading}
            className={isDelete ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
          >
            {loading ? 'Đang xử lý...' : (isDelete ? 'Xác nhận xóa' : 'Áp dụng')}
          </Button>
        </div>
      </div>
    </div>
  )
}
