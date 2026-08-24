'use client'

import React, { useState } from 'react'
import { X, Loader2, Tag as TagIcon, Check } from 'lucide-react'
import { updateOrMergeTag } from '@/lib/tags'
import { useRole } from '@/hooks/useRole'
import type { Tag } from '@/types'

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#64748B', '#14B8A6'
]

interface TagEditModalProps {
  tag: Tag
  onClose: () => void
  onSuccess: (finalTagId: string) => void
}

export function TagEditModal({ tag, onClose, onSuccess }: TagEditModalProps) {
  const { staffId } = useRole()
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color || PRESET_COLORS[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Tên nhãn không được để trống')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await updateOrMergeTag(tag.id, name.trim(), color, staffId || 'unknown')
      if (res.merged) {
        alert(`Nhãn "${name.trim()}" đã tồn tại. Toàn bộ văn bản thuộc nhãn cũ đã được hợp nhất tự động vào nhãn "${res.mergedIntoName}"!`)
      }
      onSuccess(res.finalTagId)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi cập nhật nhãn')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <TagIcon className="w-4 h-4 text-blue-600" />
            <span>Chỉnh sửa Nhãn</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên nhãn
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nhập tên nhãn mới..."
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1 italic">
              💡 Nếu trùng tên nhãn khác, hệ thống sẽ tự động gộp toàn bộ văn bản vào nhãn đó.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Màu sắc hiển thị
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                  style={{ background: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Lưu nhãn</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
