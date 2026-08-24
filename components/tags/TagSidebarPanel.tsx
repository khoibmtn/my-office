'use client'

import React, { useState } from 'react'
import { Tag as TagIcon, ChevronDown, Check, Pencil } from 'lucide-react'
import { useTags } from '@/hooks/useTags'
import { TagSearchModal } from './TagSearchModal'
import { TagEditModal } from './TagEditModal'
import type { Tag } from '@/types'

interface TagSidebarPanelProps {
  selectedTagId: string | null
  onSelectTag: (tagId: string | null) => void
}

export function TagSidebarPanel({ selectedTagId, onSelectTag }: TagSidebarPanelProps) {
  const { tags, loading } = useTags()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  if (loading || tags.length === 0) return null

  // Show top 5 tags
  const topTags = tags.slice(0, 5)

  return (
    <div className="px-3 py-2 border-t border-slate-100 shrink-0">
      <div className="flex items-center justify-between px-2 mb-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <TagIcon className="w-3 h-3 text-slate-400" />
          Nhãn (Tags)
        </span>
        {selectedTagId && (
          <button
            onClick={() => onSelectTag(null)}
            className="text-[10px] text-red-500 hover:underline font-medium"
          >
            Bỏ chọn
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {topTags.map(t => {
          const isSelected = selectedTagId === t.id
          return (
            <div
              key={t.id}
              onClick={() => onSelectTag(isSelected ? null : t.id)}
              className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: t.color }} />
                <span className="truncate">{t.name}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingTag(t)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded transition-all"
                  title="Sửa hoặc gộp nhãn này"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {isSelected && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
              </div>
            </div>
          )
        })}

        {tags.length > 5 && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50 font-medium transition-colors"
          >
            <span>Hiển thị tất cả ({tags.length})</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {modalOpen && (
        <TagSearchModal
          tags={tags}
          selectedTagId={selectedTagId}
          onSelectTag={onSelectTag}
          onClose={() => setModalOpen(false)}
        />
      )}

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
