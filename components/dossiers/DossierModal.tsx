'use client'

import React, { useState } from 'react'
import { X, Loader2, FolderPlus, Pencil, Folder, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier } from '@/types'
import { createDossier, updateDossier } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'

interface DossierModalProps {
  editingDossier: Dossier | null
  parentDossier: Dossier | null
  availableParents: Dossier[]
  onClose: () => void
  onSuccess: () => void
}

const PRESET_COLORS = [
  { name: 'Xanh dương', hex: '#2563eb' },
  { name: 'Xanh lá', hex: '#10b981' },
  { name: 'Vàng cam', hex: '#f59e0b' },
  { name: 'Đỏ hồng', hex: '#f43f5e' },
  { name: 'Tím', hex: '#8b5cf6' },
  { name: 'Xanh lam', hex: '#06b6d4' },
  { name: 'Chàm', hex: '#4f46e5' },
  { name: 'Xám', hex: '#64748b' },
]

export function DossierModal({
  editingDossier,
  parentDossier,
  availableParents,
  onClose,
  onSuccess,
}: DossierModalProps) {
  const { staffId } = useRole()
  const isEdit = !!editingDossier
  const [name, setName] = useState(editingDossier?.name || '')
  const [parentId, setParentId] = useState<string | null>(
    editingDossier ? editingDossier.parentId : (parentDossier ? parentDossier.id : null)
  )
  const [description, setDescription] = useState(editingDossier?.description || '')
  const [color, setColor] = useState(editingDossier?.color || '#2563eb')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Filter available parents to max level 2 (so new child becomes level 3 max)
  const validParents = availableParents.filter(p => p.level < 3 && p.id !== editingDossier?.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Tên hồ sơ không được để trống')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (isEdit && editingDossier) {
        await updateDossier(
          editingDossier.id,
          { name: name.trim(), description: description.trim(), color },
          staffId || 'unknown'
        )
      } else {
        await createDossier({
          name: name.trim(),
          parentId: parentId || null,
          description: description.trim(),
          color,
          actorId: staffId || 'unknown',
        })
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {isEdit ? <Pencil className="w-5 h-5 text-amber-600" /> : <FolderPlus className="w-5 h-5 text-blue-600" />}
            <h3 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Sửa thông tin hồ sơ' : 'Thêm hồ sơ mới'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên hồ sơ *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Kế hoạch, Chỉ đạo tuyến..."
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color Picker for Folder Icon */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Màu biểu tượng thư mục</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                <Folder className="w-3.5 h-3.5" style={{ color: color, fill: color }} />
                <span>Xem trước</span>
              </span>
            </label>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
                    color.toLowerCase() === c.hex.toLowerCase()
                      ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-sm'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {color.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                  )}
                </button>
              ))}
              <div className="relative flex items-center">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 overflow-hidden shadow-xs"
                  title="Tùy chỉnh màu"
                />
              </div>
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thư mục cha</label>
              <select
                value={parentId || ''}
                onChange={e => setParentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">(Không có — Hồ sơ Cấp 1)</option>
                {validParents.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.level === 1 ? '📂 ' : '  └ 📂 '} {p.name} (Cấp {p.level})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú & Mục đích</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Nhập mô tả cấu trúc, nhiệm vụ của hồ sơ..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {isEdit ? 'Cập nhật' : 'Tạo hồ sơ'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
