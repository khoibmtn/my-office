'use client'

import React, { useState } from 'react'
import { AlertTriangle, Trash2, Loader2, X, FolderSymlink, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dossier } from '@/types'
import { deleteDossier } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'

interface DeleteDossierModalProps {
  dossier: Dossier
  childCount: number
  onClose: () => void
  onSuccess: () => void
}

export function DeleteDossierModal({
  dossier,
  childCount,
  onClose,
  onSuccess,
}: DeleteDossierModalProps) {
  const { staffId } = useRole()
  const [option, setOption] = useState<'move_to_parent' | 'release'>('move_to_parent')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const hasChildren = childCount > 0
  const hasParent = !!dossier.parentId

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteDossier(
        dossier.id,
        hasParent ? option : 'release',
        staffId || 'unknown'
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi xóa hồ sơ')
    }
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-lg font-semibold text-slate-900">Xóa hồ sơ — {dossier.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {hasChildren ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <p className="font-semibold mb-1">⚠️ Không thể xóa hồ sơ này trực tiếp!</p>
              <p>
                Hồ sơ <strong>"{dossier.name}"</strong> hiện đang có <strong>{childCount} hồ sơ con</strong> bên trong.
                Vui lòng xóa hoặc di chuyển tất cả các hồ sơ con trước khi thực hiện xóa hồ sơ cha.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa hồ sơ <strong>"{dossier.name}"</strong>? Hãy chọn hướng xử lý cho các văn bản thuộc hồ sơ này:
              </p>

              {hasParent ? (
                <div className="space-y-2">
                  <label
                    onClick={() => setOption('move_to_parent')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      option === 'move_to_parent'
                        ? 'bg-blue-50/60 border-blue-500 text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delete_option"
                      checked={option === 'move_to_parent'}
                      onChange={() => setOption('move_to_parent')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-xs flex items-center gap-1">
                        <FolderSymlink className="w-3.5 h-3.5 text-blue-600" />
                        Tùy chọn 1: Chuyển toàn bộ văn bản lên Hồ sơ cấp cha
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Các văn bản trong hồ sơ này sẽ được tự động gán vào Hồ sơ cấp trên trực tiếp.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setOption('release')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      option === 'release'
                        ? 'bg-blue-50/60 border-blue-500 text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delete_option"
                      checked={option === 'release'}
                      onChange={() => setOption('release')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-xs flex items-center gap-1">
                        <LogOut className="w-3.5 h-3.5 text-amber-600" />
                        Tùy chọn 2: Giải phóng toàn bộ văn bản ra ngoài hồ sơ
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Văn bản sẽ trở thành văn bản tự do, không thuộc hồ sơ này nữa (văn bản vẫn còn trên hệ thống).
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                  ℹ️ Đây là Hồ sơ Cấp 1. Khi xóa, tất cả văn bản bên trong sẽ được giải phóng ra ngoài hồ sơ (văn bản không bị xóa khỏi hệ thống).
                </p>
              )}
            </>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            {!hasChildren && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Xác nhận xóa
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
