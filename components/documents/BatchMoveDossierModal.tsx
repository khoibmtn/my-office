'use client'

import React, { useState } from 'react'
import { Folder, Search, X, ArrowRightLeft, Loader2 } from 'lucide-react'
import type { Dossier } from '@/types'

interface BatchMoveDossierModalProps {
  selectedDocCount: number
  dossiers: Dossier[]
  onConfirm: (targetDossierId: string) => Promise<void>
  onClose: () => void
}

export function BatchMoveDossierModal({
  selectedDocCount,
  dossiers,
  onConfirm,
  onClose,
}: BatchMoveDossierModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtered = dossiers.filter(d =>
    d.name.toLowerCase().includes(search.trim().toLowerCase())
  )

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
          <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            ⚠️ <strong>Lưu ý:</strong> Thao tác này sẽ **gỡ văn bản khỏi hồ sơ hiện tại** và chỉ chuyển sang duy nhất 1 hồ sơ đích bạn chọn dưới đây.
          </p>

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

          {/* Single Select Dossiers List */}
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Không tìm thấy hồ sơ nào.</p>
            ) : (
              filtered.map(d => {
                const isSelected = selectedId === d.id
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                        : 'bg-white border-slate-150 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2" style={{ paddingLeft: `${(d.level - 1) * 12}px` }}>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {}}
                        className="text-amber-600 focus:ring-amber-500 shrink-0"
                      />
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-600 fill-amber-100' : 'text-slate-400'}`} />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      (Cấp {d.level})
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            {selectedId ? (
              <span className="text-amber-900 font-semibold truncate max-w-[200px] inline-block align-bottom">
                Đã chọn: {dossiers.find(d => d.id === selectedId)?.name}
              </span>
            ) : 'Chưa chọn hồ sơ đích'}
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
