'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, FolderSymlink, Share2, Check, UserPlus, Users, Search, Loader2, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier, StaffMember } from '@/types'
import { useStaff } from '@/hooks/useStaff'
import { useRole } from '@/hooks/useRole'
import { shareDossier } from '@/lib/dossiers'

interface ShareDossierModalProps {
  dossier: Dossier | null
  isOpen: boolean
  onClose: () => void
}

export function ShareDossierModal({ dossier, isOpen, onClose }: ShareDossierModalProps) {
  const { staff: allStaff } = useStaff()
  const { staffId } = useRole()

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync state when modal opens
  useEffect(() => {
    if (dossier) {
      setSelectedStaffIds(dossier.sharedWith || [])
      setSearch('')
      setError(null)
    }
  }, [dossier, isOpen])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter available staff (exclude owner and already selected)
  const availableStaff = useMemo(() => {
    if (!dossier) return []
    return allStaff.filter(
      s => s.isActive && s.id !== dossier.ownerId && !selectedStaffIds.includes(s.id)
    )
  }, [allStaff, dossier, selectedStaffIds])

  // Filtered by search query
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableStaff
    return availableStaff.filter(s =>
      s.shortName.toLowerCase().includes(q) ||
      s.fullName.toLowerCase().includes(q) ||
      (s.nickname && s.nickname.toLowerCase().includes(q)) ||
      (s.position && s.position.toLowerCase().includes(q)) ||
      (s.title && s.title.toLowerCase().includes(q))
    )
  }, [availableStaff, search])

  // Selected staff members
  const selectedStaffList = useMemo(() => {
    return selectedStaffIds
      .map(id => allStaff.find(s => s.id === id))
      .filter((s): s is StaffMember => Boolean(s))
  }, [selectedStaffIds, allStaff])

  // Owner staff member
  const ownerStaff = useMemo(() => {
    if (!dossier) return null
    return allStaff.find(s => s.id === dossier.ownerId)
  }, [allStaff, dossier])

  if (!isOpen || !dossier) return null

  const handleAddStaff = (id: string) => {
    setSelectedStaffIds(prev => [...prev, id])
    setSearch('')
    inputRef.current?.focus()
  }

  const handleRemoveStaff = (id: string) => {
    setSelectedStaffIds(prev => prev.filter(sId => sId !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await shareDossier(dossier.id, selectedStaffIds, staffId || 'unknown')
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi chia sẻ hồ sơ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs"
              style={{ backgroundColor: `${dossier.color || '#3b82f6'}20`, color: dossier.color || '#3b82f6' }}
            >
              <FolderSymlink className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>Chia sẻ Hồ sơ</span>
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-xs font-medium">
                {dossier.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Owner info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
            <span className="text-slate-500 font-medium">Chủ sở hữu hồ sơ:</span>
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{ownerStaff ? `${ownerStaff.shortName} (${ownerStaff.fullName})` : (dossier.ownerId === 'admin' ? 'Admin' : dossier.ownerId)}</span>
            </span>
          </div>

          {/* Member Picker */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chọn cán bộ chia sẻ ({selectedStaffList.length})
            </label>

            {/* Selected Badges Area */}
            {selectedStaffList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[38px] items-center">
                {selectedStaffList.map(s => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold bg-white text-blue-700 border border-blue-200 shadow-2xs group"
                  >
                    <span className="truncate max-w-[120px]">{s.shortName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStaff(s.id)}
                      className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title={`Gỡ ${s.shortName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Combobox Input */}
            <div className="relative">
              <div
                onClick={() => {
                  setDropdownOpen(true)
                  inputRef.current?.focus()
                }}
                className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-xs cursor-text transition-colors shadow-2xs ${
                  dropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    if (!dropdownOpen) setDropdownOpen(true)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={selectedStaffList.length === 0 ? 'Tìm và gắp cán bộ vào danh sách chia sẻ...' : '+ Thêm cán bộ khác...'}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 min-w-[120px]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSearch('')
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Dropdown Options */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1 flex flex-col gap-0.5 animate-in fade-in-50 duration-100">
                  {filteredStaff.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-slate-400 text-center italic">
                      {search ? 'Không tìm thấy cán bộ phù hợp' : 'Đã chọn tất cả cán bộ khả dụng'}
                    </div>
                  ) : (
                    filteredStaff.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleAddStaff(s.id)}
                        className="shrink-0 min-h-[34px] flex items-center px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer select-none transition-colors text-slate-700 hover:bg-blue-50 hover:text-blue-700 leading-normal"
                      >
                        <span className="truncate">{s.shortName}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description info */}
          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-800 leading-relaxed space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-blue-900">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Quyền hạn khi được chia sẻ:</span>
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1 text-[11px]">
              <li>Cán bộ được chia sẻ có thể xem danh sách văn bản, xem ghi chú và cùng trao đổi (chat) trong hồ sơ.</li>
              <li>Chỉ chủ sở hữu mới có quyền tick hoàn thành checklist tiến độ hoặc thay đổi cấu trúc hồ sơ.</li>
              <li>Với văn bản: Cán bộ được giao xử lý chính có toàn quyền; cán bộ khác chỉ xem.</li>
            </ul>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[90px]"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Lưu chia sẻ</span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
