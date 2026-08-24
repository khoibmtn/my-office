'use client'

import React, { useState } from 'react'
import { Search, X, Tag as TagIcon, Pencil } from 'lucide-react'
import { TagEditModal } from './TagEditModal'
import type { Tag } from '@/types'

interface TagSearchModalProps {
  tags: Tag[]
  selectedTagId: string | null
  onSelectTag: (tagId: string | null) => void
  onClose: () => void
}

export function TagSearchModal({
  tags,
  selectedTagId,
  onSelectTag,
  onClose,
}: TagSearchModalProps) {
  const [query, setQuery] = useState('')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-800">
            <TagIcon className="w-4 h-4 text-blue-600" />
            <h3 className="text-base font-bold">Tất cả Nhãn ({tags.length})</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm kiếm nhãn..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {selectedTagId && (
              <button
                onClick={() => { onSelectTag(null); onClose() }}
                className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <span>✕ Bỏ lọc nhãn đang chọn</span>
              </button>
            )}

            {filteredTags.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Không tìm thấy nhãn nào.</p>
            ) : (
              filteredTags.map(tag => {
                const isSelected = selectedTagId === tag.id
                return (
                  <div
                    key={tag.id}
                    onClick={() => { onSelectTag(isSelected ? null : tag.id); onClose() }}
                    className={`group w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
                      <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: tag.color }} />
                      <span className="truncate">{tag.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTag(tag)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded transition-all"
                        title="Sửa hoặc gộp nhãn này"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {isSelected && <span className="text-[10px] font-bold text-blue-600">✓</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {editingTag && (
        <TagEditModal
          tag={editingTag}
          onClose={() => setEditingTag(null)}
          onSuccess={(finalId) => {
            if (selectedTagId === editingTag.id) {
              onSelectTag(finalId)
            }
          }}
        />
      )}
    </div>
  )
}
