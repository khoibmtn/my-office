'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadPermissionMatrix, savePermissionMatrix, getDefaultPermissionMatrix } from '@/lib/permissions'
import type { PermissionMatrix } from '@/types/permissions'
import { PERMISSION_GROUPS } from '@/types/permissions'
import type { UserRole } from '@/types'
import { ROLE_LABELS } from '@/types'

const EDITABLE_ROLES: UserRole[] = ['truong_phong', 'pho_phong', 'giao_viec', 'nhan_vien', 'guest']

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    loadPermissionMatrix().then(m => { setMatrix(m); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const togglePermission = (role: UserRole, action: string) => {
    if (!matrix || role === 'admin') return // Admin always has all
    setMatrix(prev => {
      if (!prev) return prev
      const current = prev[role]?.[action as keyof typeof prev[typeof role]] ?? false
      return {
        ...prev,
        [role]: { ...prev[role], [action]: !current },
      }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!matrix) return
    setSaving(true)
    try {
      await savePermissionMatrix(matrix)
      setDirty(false)
      alert('Đã lưu phân quyền!')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!window.confirm('Khôi phục phân quyền về mặc định?')) return
    setMatrix(getDefaultPermissionMatrix())
    setDirty(true)
  }

  if (loading || !matrix) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Đang tải phân quyền...</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Phân quyền theo vai trò</h1>
          <p className="text-sm text-gray-500 mt-1">Ma trận quyền hạn cho từng vai trò trong hệ thống</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Mặc định
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-64">Quyền hạn</th>
                <th className="text-center px-3 py-3 font-medium text-red-600 w-24">
                  <div className="text-xs">Admin</div>
                  <div className="text-[10px] text-gray-400 font-normal">Tất cả</div>
                </th>
                {EDITABLE_ROLES.map(role => (
                  <th key={role} className="text-center px-3 py-3 w-24">
                    <div className="text-xs font-medium text-gray-700">{ROLE_LABELS[role]?.replace('khoa/phòng', 'K/P')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group, gi) => (
                <>
                  {/* Group header */}
                  <tr key={`g-${gi}`} className="bg-gray-50/50">
                    <td colSpan={2 + EDITABLE_ROLES.length} className="px-4 py-2 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      {group.label}
                    </td>
                  </tr>
                  {/* Permissions in group */}
                  {group.actions.map((perm, pi) => (
                    <tr key={perm.action} className={`${pi > 0 ? 'border-t border-gray-50' : ''} hover:bg-blue-50/20`}>
                      <td className="px-4 py-2">
                        <div className="text-gray-700">{perm.label}</div>
                        {perm.description && <div className="text-[11px] text-gray-400">{perm.description}</div>}
                      </td>
                      {/* Admin column (always checked, non-interactive) */}
                      <td className="text-center px-3 py-2">
                        <div className="w-5 h-5 mx-auto rounded bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 text-xs">✓</span>
                        </div>
                      </td>
                      {/* Editable role columns */}
                      {EDITABLE_ROLES.map(role => {
                        const checked = matrix[role]?.[perm.action] === true
                        return (
                          <td key={role} className="text-center px-3 py-2">
                            <button
                              onClick={() => togglePermission(role, perm.action)}
                              className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'bg-white border-gray-300 hover:border-blue-300'
                              }`}
                            >
                              {checked && <span className="text-white text-xs font-bold">✓</span>}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dirty && (
        <div className="mt-3 text-xs text-amber-600 flex items-center gap-1">
          ⚠ Có thay đổi chưa lưu
        </div>
      )}
    </div>
  )
}
