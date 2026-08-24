'use client'

import React, { useState, useMemo } from 'react'
import { Folder, Search, X, ArrowRightLeft, Loader2, PlusSquare, MinusSquare } from 'lucide-react'
import type { Dossier } from '@/types'

interface BatchMoveDossierModalProps {
  selectedDocCount: number
  unassignedDocCount?: number
  dossiers: Dossier[]
  onConfirm: (targetDossierId: string) => Promise<void>
  onClose: () => void
}

export function BatchMoveDossierModal({
  selectedDocCount,
  unassignedDocCount = 0,
  dossiers,
  onConfirm,
  onClose,
}: BatchMoveDossierModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(dossiers.filter(d => !d.parentId).map(d => d.id))
  })
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    if (!selectedId) return
    setSubmitting(true)
    try {
      await onConfirm(selectedId)
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
    return dossiers
      .filter(d => !d.parentId)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))
  }, [dossiers])

  const renderTreeNode = (d: Dossier, level: number = 0) => {
    const children = dossiers
      .filter(c => c.parentId === d.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(d.id)
    const isSelected = selectedId === d.id

    return (
      <div key={d.id} className="flex flex-col">
        <div
          onClick={() => setSelectedId(d.id)}
          className={`group flex items-center justify-between p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-amber-50/90 border-amber-400 text-amber-900 font-bold shadow-xs'
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
                  <MinusSquare className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            ) : (
              <span className="w-3.5 h-3.5 shrink-0" />
            )}

            <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600 fill-amber-100' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span className="truncate">{d.name}</span>
          </div>

          {/* Right side: Level badge + Radio button at the FAR RIGHT */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-mono">
              (Cấp {d.level})
            </span>
            <input
              type="radio"
              checked={isSelected}
              onChange={() => {}}
              className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
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
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-amber-50/50 shrink-0">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            <span>Di chuyển {selectedDocCount} văn bản sang Hồ sơ mới</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 space-y-1">
            <div>
              ⚠️ <strong>Lưu ý:</strong> Di chuyển <strong>{selectedDocCount} văn bản</strong> sang 1 hồ sơ mới (sẽ gỡ khỏi các hồ sơ cũ).
            </div>
            {unassignedDocCount > 0 && (
              <div className="text-amber-800 text-[11px] font-medium border-t border-amber-200/60 pt-1 mt-1">
                ℹ️ Trong đó có <strong>{unassignedDocCount} văn bản</strong> chưa thuộc hồ sơ nào — sẽ được gán trực tiếp vào hồ sơ mới chọn.
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm hồ sơ đích..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Dossiers Tree / Flat list when searching */}
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {isSearching ? (
              dossiers.filter(d => d.name.toLowerCase().includes(searchNormalized)).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Không tìm thấy hồ sơ nào.</p>
              ) : (
                dossiers
                  .filter(d => d.name.toLowerCase().includes(searchNormalized))
                  .map(d => {
                    const isSelected = selectedId === d.id
                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-50/90 border-amber-400 text-amber-900 font-bold shadow-xs'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600 fill-amber-100' : 'text-slate-400'}`} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono">(Cấp {d.level})</span>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
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
          <span className="text-xs text-slate-500 font-medium truncate max-w-[220px]">
            {selectedId ? (
              <span className="text-amber-900 font-semibold truncate block">
                Đã chọn: {dossiers.find(d => d.id === selectedId)?.name}
              </span>
            ) : 'Chưa chọn hồ sơ đích'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedId || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Di chuyển ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
