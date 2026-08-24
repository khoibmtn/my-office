'use client'

import React, { useState, useMemo } from 'react'
import { Folder, Search, X, Loader2, PlusSquare, MinusSquare } from 'lucide-react'
import type { Dossier } from '@/types'

interface BatchAddDossierModalProps {
  selectedDocCount: number
  dossiers: Dossier[]
  onConfirm: (targetDossierIds: string[]) => Promise<void>
  onClose: () => void
}

export function BatchAddDossierModal({
  selectedDocCount,
  dossiers,
  onConfirm,
  onClose,
}: BatchAddDossierModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Default expand root level 1 dossiers
    return new Set(dossiers.filter(d => !d.parentId).map(d => d.id))
  })
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return
    setSubmitting(true)
    try {
      await onConfirm(selectedIds)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const searchNormalized = search.trim().toLowerCase()
  const isSearching = searchNormalized.length > 0

  const rootDossiers = useMemo(() => {
    return dossiers.filter(d => !d.parentId)
  }, [dossiers])

  const renderTreeNode = (d: Dossier, level: number = 0) => {
    const children = dossiers.filter(c => c.parentId === d.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(d.id)
    const isChecked = selectedIds.includes(d.id)

    return (
      <div key={d.id} className="flex flex-col">
        <div
          onClick={() => toggleSelect(d.id)}
          className={`group flex items-center justify-between p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
            isChecked
              ? 'bg-blue-50/90 border-blue-300 text-blue-900 font-semibold'
              : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {/* Left side: Expand toggle + Folder icon + Folder Name */}
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-2">
            {hasChildren ? (
              <button
                onClick={e => toggleExpand(d.id, e)}
                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded shrink-0"
                title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
              >
                {isExpanded ? (
                  <MinusSquare className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            ) : (
              <span className="w-3.5 h-3.5 shrink-0" />
            )}

            <Folder className={`w-4 h-4 shrink-0 ${isChecked ? 'text-blue-600 fill-blue-100' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span className="truncate">{d.name}</span>
          </div>

          {/* Right side: Level badge + Checkbox at the FAR RIGHT */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-mono">
              (Cấp {d.level})
            </span>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => {}}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Recursive Children */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col gap-1 mt-1 pl-1">
            {children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Folder className="w-4 h-4 text-blue-600" />
            <span>Thêm {selectedDocCount} văn bản vào Hồ sơ</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-500 italic">
            💡 Bạn có thể tích chọn **nhiều hồ sơ** để gán đồng thời các văn bản đã chọn vào tất cả các hồ sơ đó.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm hồ sơ..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dossiers Tree / Flat List when searching */}
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {isSearching ? (
              dossiers.filter(d => d.name.toLowerCase().includes(searchNormalized)).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Không tìm thấy hồ sơ nào.</p>
              ) : (
                dossiers
                  .filter(d => d.name.toLowerCase().includes(searchNormalized))
                  .map(d => {
                    const isChecked = selectedIds.includes(d.id)
                    return (
                      <div
                        key={d.id}
                        onClick={() => toggleSelect(d.id)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50/90 border-blue-300 text-blue-900 font-semibold'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Folder className={`w-4 h-4 shrink-0 ${isChecked ? 'text-blue-600 fill-blue-100' : 'text-slate-400'}`} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono">(Cấp {d.level})</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                          />
                        </div>
                      </div>
                    )
                  })
              )
            ) : rootDossiers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có hồ sơ nào.</p>
            ) : (
              rootDossiers.map(d => renderTreeNode(d, 0))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Đã chọn <strong className="text-blue-700">{selectedIds.length}</strong> hồ sơ
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedIds.length === 0 || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Thêm vào {selectedIds.length} hồ sơ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
