'use client'

import React, { useState } from 'react'
import { ArrowRightLeft, X, Loader2, Users, Check, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier, StaffMember } from '@/types'
import { transferDossier } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'

interface TransferDossierModalProps {
  dossier: Dossier
  allDossiers: Dossier[]
  staffList: StaffMember[]
  onClose: () => void
  onSuccess: () => void
}

export function TransferDossierModal({
  dossier,
  allDossiers,
  staffList,
  onClose,
  onSuccess,
}: TransferDossierModalProps) {
  const { staffId } = useRole()
  const [targetOwnerId, setTargetOwnerId] = useState('')
  const [reassignUncompletedDocs, setReassignUncompletedDocs] = useState(true)

  // Find all child/descendant dossiers of this dossier
  const childDossiers = allDossiers.filter(d => {
    let curr = d.parentId
    while (curr) {
      if (curr === dossier.id) return true
      const parent = allDossiers.find(p => p.id === curr)
      curr = parent ? parent.parentId : null
    }
    return false
  })

  const [selectedChildIds, setSelectedChildIds] = useState<string[]>(
    childDossiers.map(c => c.id)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Filter valid target staff (exclude current owner)
  const availableStaff = staffList.filter(s => s.id !== dossier.ownerId && s.isActive)

  const handleToggleChild = (cid: string) => {
    setSelectedChildIds(prev =>
      prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]
    )
  }

  const handleToggleAll = (check: boolean) => {
    if (check) setSelectedChildIds(childDossiers.map(c => c.id))
    else setSelectedChildIds([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetOwnerId) {
      setError('Vui lòng chọn người nhận hồ sơ')
      return
    }

    const targetStaff = staffList.find(s => s.id === targetOwnerId)
    setSubmitting(true)
    setError('')
    try {
      await transferDossier({
        dossierId: dossier.id,
        targetOwnerId,
        targetOwnerName: targetStaff?.shortName || '',
        selectedChildIds,
        reassignUncompletedDocs,
        actorId: staffId || 'unknown',
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi chuyển giao hồ sơ')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2 text-blue-600">
            <ArrowRightLeft className="w-5 h-5" />
            <h3 className="text-lg font-semibold text-slate-900">Chuyển giao hồ sơ — {dossier.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target user selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Users className="w-4 h-4 text-slate-500" />
              Chọn người nhận hồ sơ *
            </label>
            <select
              value={targetOwnerId}
              onChange={e => setTargetOwnerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">-- Chọn nhân viên --</option>
              {availableStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.shortName} ({s.fullName})
                </option>
              ))}
            </select>
          </div>

          {/* Child dossiers checkbox tree */}
          {childDossiers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Hồ sơ con đi kèm ({selectedChildIds.length}/{childDossiers.length})
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleAll(selectedChildIds.length !== childDossiers.length)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  {selectedChildIds.length === childDossiers.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-1.5 bg-slate-50/50">
                {childDossiers.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedChildIds.includes(c.id)}
                      onChange={() => handleToggleChild(c.id)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{c.name} (Cấp {c.level})</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 italic">
                * Hồ sơ con không được chọn sẽ được nâng lên làm Hồ sơ Cấp 1 thuộc quyền quản lý của bạn.
              </p>
            </div>
          )}

          {/* Uncompleted tasks option */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={reassignUncompletedDocs}
                onChange={e => setReassignUncompletedDocs(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800">Chuyển Người thực hiện chính văn bản chưa hoàn thành</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Các văn bản CHƯA HOÀN THÀNH trong hồ sơ sẽ được gán Người thực hiện chính sang người mới. Các văn bản ĐÃ HOÀN THÀNH giữ nguyên người làm cũ.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            <Button type="submit" size="sm" disabled={submitting || !targetOwnerId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Chuyển hồ sơ
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
