'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Users, Loader2, Save, X, Key, Search, Shield, Building2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAllStaff, createStaff, updateStaff, deleteStaff, changeStaffPassword } from '@/lib/staff'
import { subscribeDepartments } from '@/lib/departments'
import { useRole } from '@/hooks/useRole'
import type { StaffMember, UserRole } from '@/types'
import { ROLE_LABELS } from '@/types'
import type { Department } from '@/types/departments'

const DEFAULT_PASSWORD = '123456'

export default function StaffPage() {
  const { isAdmin } = useRole()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<(StaffMember & { docId?: string }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterRole, setFilterRole] = useState('')

  // Form state
  const [form, setForm] = useState({
    fullName: '', shortName: '', nickname: '', password: '',
    title: '', position: '', organizationRole: 'nhan_vien' as UserRole,
    primaryDepartmentId: '', departmentIds: [] as string[],
    phone: '', email: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [changePwStaffId, setChangePwStaffId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Fetch staff
  useEffect(() => {
    getAllStaff().then(s => { setStaff(s); setLoading(false) }).catch(() => setLoading(false))
  }, [saving]) // refetch after save

  // Subscribe departments
  useEffect(() => {
    const unsub = subscribeDepartments((depts) => setDepartments(depts))
    return unsub
  }, [])

  const deptMap = useMemo(() => {
    const map: Record<string, string> = {}
    departments.forEach(d => { map[d.id] = d.shortName || d.code || d.name })
    return map
  }, [departments])

  // Filter staff
  const filteredStaff = useMemo(() => {
    let list = staff.filter(s => s.isActive)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(s =>
        s.fullName?.toLowerCase().includes(q) ||
        s.shortName?.toLowerCase().includes(q) ||
        s.nickname?.toLowerCase().includes(q)
      )
    }
    if (filterDept) {
      list = list.filter(s => s.departmentIds?.includes(filterDept) || s.primaryDepartmentId === filterDept)
    }
    if (filterRole) {
      list = list.filter(s => (s.organizationRole || 'nhan_vien') === filterRole)
    }
    return list
  }, [staff, searchQuery, filterDept, filterRole])

  const handleOpenCreate = () => {
    setEditingStaff(null)
    setForm({
      fullName: '', shortName: '', nickname: '', password: DEFAULT_PASSWORD,
      title: '', position: '', organizationRole: 'nhan_vien',
      primaryDepartmentId: '', departmentIds: [],
      phone: '', email: '',
    })
    setShowPassword(false)
    setShowForm(true)
  }

  const handleOpenEdit = (s: StaffMember & { docId?: string }) => {
    setEditingStaff(s)
    setForm({
      fullName: s.fullName, shortName: s.shortName, nickname: s.nickname,
      password: '',
      title: s.title || '', position: s.position || '',
      organizationRole: s.organizationRole || 'nhan_vien',
      primaryDepartmentId: s.primaryDepartmentId || '',
      departmentIds: s.departmentIds || [],
      phone: s.phone || '', email: s.email || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.nickname.trim()) return
    setSaving(true)
    try {
      if (editingStaff) {
        // Find docId — staff items from getAllStaff have their Firestore doc ID
        const docId = (editingStaff as any).docId || staff.find(s => s.id === editingStaff.id)?.id
        // Get all staff docs to find the actual Firestore doc ID
        const allDocs = await import('firebase/firestore').then(m =>
          m.getDocs(m.query(m.collection((require('@/lib/firebase') as any).db(), 'staff'), m.where('id', '==', editingStaff.id)))
        )
        const actualDocId = allDocs?.docs?.[0]?.id
        if (!actualDocId) throw new Error('Không tìm thấy nhân viên')

        await updateStaff(actualDocId, {
          fullName: form.fullName.trim(),
          shortName: form.shortName.trim() || form.fullName.trim(),
          nickname: form.nickname.trim().toLowerCase(),
          title: form.title.trim(),
          position: form.position.trim(),
          organizationRole: form.organizationRole,
          primaryDepartmentId: form.primaryDepartmentId || null,
          departmentIds: form.departmentIds,
          phone: form.phone.trim(),
          email: form.email.trim(),
        })
      } else {
        if (!form.password) throw new Error('Mật khẩu không được để trống')
        await createStaff({
          fullName: form.fullName.trim(),
          shortName: form.shortName.trim() || form.fullName.trim(),
          nickname: form.nickname.trim().toLowerCase(),
          password: form.password,
          title: form.title.trim(),
          position: form.position.trim(),
        })
      }
      setShowForm(false)
      setEditingStaff(null)
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không thể lưu'))
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (staffDocId: string) => {
    if (!newPassword.trim()) return
    try {
      await changeStaffPassword(staffDocId, newPassword.trim())
      alert('Đổi mật khẩu thành công!')
      setChangePwStaffId(null)
      setNewPassword('')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    }
  }

  const toggleDepartment = (deptId: string) => {
    setForm(prev => {
      const ids = prev.departmentIds.includes(deptId)
        ? prev.departmentIds.filter(id => id !== deptId)
        : [...prev.departmentIds, deptId]
      // If primary was removed, clear it
      const primary = ids.includes(prev.primaryDepartmentId) ? prev.primaryDepartmentId : (ids[0] || '')
      return { ...prev, departmentIds: ids, primaryDepartmentId: primary }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Đang tải danh sách nhân sự...</span>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý Nhân sự</h1>
          <p className="text-sm text-gray-500 mt-1">{staff.filter(s => s.isActive).length + 1} nhân viên đang hoạt động (bao gồm Admin)</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Thêm nhân viên
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm nhân viên..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
        {departments.length > 0 && (
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.shortName || d.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Tất cả vai trò</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Staff Form */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {editingStaff ? `Sửa: ${editingStaff.fullName}` : 'Thêm nhân viên mới'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingStaff(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Họ tên đầy đủ *</label>
              <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Nguyễn Văn A" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên ngắn</label>
              <input value={form.shortName} onChange={e => setForm(p => ({ ...p, shortName: e.target.value }))}
                placeholder="BS Khôi" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên đăng nhập *</label>
              <input value={form.nickname} onChange={e => setForm(p => ({ ...p, nickname: e.target.value.toLowerCase() }))}
                placeholder="khoi" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-200" />
            </div>
            {!editingStaff && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mật khẩu *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chức danh</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="BSCKII, ThS, CN..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chức vụ</label>
              <input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                placeholder="Trưởng phòng, Phó phòng..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vai trò tổ chức</label>
              <select value={form.organizationRole} onChange={e => setForm(p => ({ ...p, organizationRole: e.target.value as UserRole }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200">
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'guest').map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Điện thoại</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="090..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="email@..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>

          {/* Department assignment */}
          {departments.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">Phòng ban</label>
              <div className="flex flex-wrap gap-2">
                {departments.map(dept => {
                  const isSelected = form.departmentIds.includes(dept.id)
                  const isPrimary = form.primaryDepartmentId === dept.id
                  return (
                    <div key={dept.id} className="flex items-center gap-1">
                      <button
                        onClick={() => toggleDepartment(dept.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {dept.shortName || dept.code}
                      </button>
                      {isSelected && (
                        <button
                          onClick={() => setForm(p => ({ ...p, primaryDepartmentId: dept.id }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            isPrimary
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : 'text-gray-400 border-gray-200 hover:bg-gray-100'
                          }`}
                          title={isPrimary ? 'Phòng chính' : 'Đặt làm phòng chính'}
                        >
                          {isPrimary ? '★ Chính' : '☆'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingStaff(null) }}>Hủy</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.fullName.trim() || !form.nickname.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingStaff ? 'Cập nhật' : 'Tạo nhân viên'}
            </Button>
          </div>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Họ tên</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Chức danh / Chức vụ</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Phòng ban</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Vai trò</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {/* Admin Account Row — always shown at top */}
            <tr className="bg-gradient-to-r from-red-50/60 to-orange-50/40 border-b border-red-100">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-red-500" />
                  <span className="font-medium text-gray-900">Admin</span>
                </div>
                <div className="text-xs text-gray-400">khoibm.tn@gmail.com</div>
              </td>
              <td className="px-4 py-2.5 text-gray-600">
                <div>Quản trị viên hệ thống</div>
              </td>
              <td className="px-4 py-2.5">
                <span className="text-xs text-gray-400">Tất cả phòng ban</span>
              </td>
              <td className="px-4 py-2.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  🛡️ Quản trị viên
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <span className="text-xs text-gray-400 italic">Quyền tối cao — không thể tắt</span>
              </td>
            </tr>
            {filteredStaff.map((s, idx) => {
              const role = s.organizationRole || 'nhan_vien'
              const primaryDept = s.primaryDepartmentId ? deptMap[s.primaryDepartmentId] : null
              const otherDepts = (s.departmentIds || [])
                .filter(id => id !== s.primaryDepartmentId)
                .map(id => deptMap[id])
                .filter(Boolean)

              return (
                <tr key={s.id} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-blue-50/20`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{s.shortName || s.fullName}</div>
                    <div className="text-xs text-gray-400 font-mono">@{s.nickname}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <div>{s.title || '-'}</div>
                    {s.position && <div className="text-xs text-gray-400">{s.position}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    {primaryDept ? (
                      <div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{primaryDept}</span>
                        {otherDepts.map((d, i) => (
                          <span key={i} className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{d}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Chưa gán</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      role === 'admin' ? 'bg-red-100 text-red-700' :
                      role === 'truong_phong' ? 'bg-purple-100 text-purple-700' :
                      role === 'pho_phong' ? 'bg-indigo-100 text-indigo-700' :
                      role === 'giao_viec' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {ROLE_LABELS[role as UserRole] || role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <>
                          <button onClick={() => handleOpenEdit(s)} className="p-1.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600" title="Sửa">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setChangePwStaffId(changePwStaffId === s.id ? null : s.id)}
                            className="p-1.5 rounded hover:bg-amber-100 text-gray-400 hover:text-amber-600" title="Đổi mật khẩu"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    {/* Change password inline */}
                    {changePwStaffId === s.id && (
                      <div className="flex items-center gap-2 mt-2 justify-end">
                        <input
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Mật khẩu mới"
                          type="password"
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={() => {
                          // Need to find Firestore doc ID
                          // For now use a simple approach
                          const allStaffDocs = staff as any[]
                          const target = allStaffDocs.find(x => x.id === s.id)
                          if (target) handleChangePassword((target as any).docId || target.id, )
                        }} className="text-xs h-7 px-2">OK</Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filteredStaff.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  {searchQuery || filterDept || filterRole ? 'Không tìm thấy nhân viên phù hợp' : 'Chưa có nhân viên nào'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
