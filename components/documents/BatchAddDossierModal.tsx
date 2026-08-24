'use client'

import React, { useState } from 'react'
import { Folder, Search, X, Check, Loader2 } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtered = dossiers.filter(d =>
    d.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
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

          {/* Dossiers Checkbox List */}
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Không tìm thấy hồ sơ nào.</p>
            ) : (
              filtered.map(d => {
                const isChecked = selectedIds.includes(d.id)
                return (
                  <label
                    key={d.id}
                    onClick={() => toggleSelect(d.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                        : 'bg-white border-slate-150 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2" style={{ paddingLeft: `${(d.level - 1) * 12}px` }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-blue-600 focus:ring-blue-500 shrink-0"
                      />
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-blue-600 fill-blue-100' : 'text-slate-400'}`} />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      (Cấp {d.level})
                    </span>
                  </label>
                )
              })
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
