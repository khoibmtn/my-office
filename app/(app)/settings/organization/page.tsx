'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Building2, Users, ChevronRight, ChevronDown, Loader2, MapPin, Phone, Save, X, ArrowUp, ArrowDown, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/lib/departments'
import { subscribeOrgNames, addOrgName, updateOrgName, deleteOrgName, reorderOrgNames, type OrgName } from '@/lib/orgNames'
import { seedOrgNames } from '@/lib/seedOrgNames'
import { useStaff } from '@/hooks/useStaff'
import { useDocuments } from '@/hooks/useDocuments'
import type { Department, DepartmentType } from '@/types/departments'

const DEPT_TYPE_LABELS: Record<DepartmentType, string> = {
  'ban_giám_đốc': 'Ban Giám đốc',
  'chức_năng': 'Phòng chức năng',
  'lâm_sàng': 'Khoa lâm sàng',
  'cận_lâm_sàng': 'Khoa cận lâm sàng',
  'khác': 'Khác',
}

const DEPT_TYPE_COLORS: Record<DepartmentType, string> = {
  'ban_giám_đốc': 'bg-red-100 text-red-700',
  'chức_năng': 'bg-purple-100 text-purple-700',
  'lâm_sàng': 'bg-blue-100 text-blue-700',
  'cận_lâm_sàng': 'bg-teal-100 text-teal-700',
  'khác': 'bg-gray-100 text-gray-700',
}

interface DeptFormData {
  name: string
  code: string
  shortName: string
  type: DepartmentType
  description: string
  phone: string
  location: string
  color: string
  headStaffId: string
}

const emptyForm: DeptFormData = {
  name: '', code: '', shortName: '', type: 'chức_năng',
  description: '', phone: '', location: '', color: '#4986e7', headStaffId: '',
}

export default function OrganizationPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [form, setForm] = useState<DeptFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const { staff } = useStaff()

  const activeStaff = useMemo(() => staff.filter(s => s.isActive), [staff])

  useEffect(() => {
    const unsub = subscribeDepartments(
      (depts) => { setDepartments(depts); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])
  // === OrgNames state ===
  const [orgNames, setOrgNames] = useState<OrgName[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [newOrgName, setNewOrgName] = useState('')
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [editingOrgValue, setEditingOrgValue] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)
  const { documents } = useDocuments()

  useEffect(() => {
    const unsub = subscribeOrgNames(
      (names) => { setOrgNames(names); setOrgLoading(false) },
      () => setOrgLoading(false)
    )
    return unsub
  }, [])

  // Auto-seed defaults if empty
  useEffect(() => {
    if (!orgLoading && orgNames.length === 0) {
      seedOrgNames().catch(() => {})
    }
  }, [orgLoading, orgNames.length])

  // Count docs per org name
  const orgDocCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    orgNames.forEach(n => {
      counts[n.id] = (documents || []).filter(d => d.sender?.trim().toLowerCase() === n.name.trim().toLowerCase()).length
    })
    return counts
  }, [orgNames, documents])

  const handleAddOrgName = async () => {
    const name = newOrgName.trim()
    if (!name) return
    setOrgSaving(true)
    try {
      await addOrgName(name, orgNames.length)
      setNewOrgName('')
    } finally { setOrgSaving(false) }
  }

  const handleSaveOrgEdit = async (id: string) => {
    const name = editingOrgValue.trim()
    if (!name) return
    setOrgSaving(true)
    try {
      await updateOrgName(id, name)
      setEditingOrgId(null)
    } finally { setOrgSaving(false) }
  }

  const handleDeleteOrg = async (id: string) => {
    if (orgDocCounts[id] > 0) {
      alert('Không thể xóa tên đơn vị đang gắn với văn bản!')
      return
    }
    if (!confirm('Xóa tên đơn vị này?')) return
    await deleteOrgName(id)
  }

  const handleMoveOrg = async (idx: number, dir: 'up' | 'down') => {
    const items = [...orgNames]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= items.length) return
    ;[items[idx], items[swapIdx]] = [items[swapIdx], items[idx]]
    await reorderOrgNames(items.map((item, i) => ({ id: item.id, order: i })))
  }

  const staffMap = useMemo(() => {
    const map: Record<string, string> = {}
    activeStaff.forEach(s => { map[s.id] = s.shortName || s.fullName })
    return map
  }, [activeStaff])

  // Group departments by type for display
  const deptsByType = useMemo(() => {
    const groups: Record<DepartmentType, Department[]> = {
      'ban_giám_đốc': [], 'chức_năng': [], 'lâm_sàng': [], 'cận_lâm_sàng': [], 'khác': [],
    }
    departments.forEach(d => {
      const type = d.type || 'khác'
      if (groups[type]) groups[type].push(d)
      else groups['khác'].push(d)
    })
    return groups
  }, [departments])

  const handleOpenCreate = () => {
    setEditingDept(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept)
    setForm({
      name: dept.name,
      code: dept.code,
      shortName: dept.shortName || dept.code,
      type: dept.type,
      description: dept.description || '',
      phone: dept.phone || '',
      location: dept.location || '',
      color: dept.color || '#4986e7',
      headStaffId: dept.headStaffId || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) return
    setSaving(true)
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          shortName: form.shortName.trim() || form.code.trim().toUpperCase(),
          type: form.type,
          description: form.description.trim(),
          phone: form.phone.trim(),
          location: form.location.trim(),
          color: form.color,
          headStaffId: form.headStaffId || null,
        })
      } else {
        await createDepartment({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          shortName: form.shortName.trim() || form.code.trim().toUpperCase(),
          type: form.type,
          description: form.description.trim(),
          phone: form.phone.trim(),
          location: form.location.trim(),
          color: form.color,
          order: departments.length,
        })
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditingDept(null)
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không thể lưu'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${dept.name}"? Phòng ban sẽ bị vô hiệu hóa.`)) return
    try {
      await deleteDepartment(dept.id)
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    }
  }

  const toggleExpand = (type: DepartmentType) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Đang tải cơ cấu tổ chức...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cơ cấu tổ chức</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý khoa, phòng ban trong đơn vị ({departments.length} phòng ban)</p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Thêm phòng ban
        </Button>
      </div>

      {/* Department Form Modal */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {editingDept ? `Sửa: ${editingDept.name}` : 'Thêm phòng ban mới'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingDept(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên phòng ban *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="VD: Phòng Kế hoạch Nghiệp vụ"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Mã *</label>
                <input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="KHNV"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm uppercase focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Viết tắt</label>
                <input
                  value={form.shortName}
                  onChange={e => setForm(p => ({ ...p, shortName: e.target.value }))}
                  placeholder="KHNV"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loại phòng ban</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as DepartmentType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              >
                {Object.entries(DEPT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trưởng khoa/phòng</label>
              <select
                value={form.headStaffId}
                onChange={e => setForm(p => ({ ...p, headStaffId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              >
                <option value="">-- Chọn --</option>
                {activeStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.shortName || s.fullName} {s.title ? `(${s.title})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mô tả</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Chức năng, nhiệm vụ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Điện thoại</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="02xx..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vị trí</label>
                <input
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="Tầng 3, Nhà A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingDept(null) }}>Hủy</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim() || !form.code.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingDept ? 'Cập nhật' : 'Tạo phòng ban'}
            </Button>
          </div>
        </div>
      )}

      {/* Department Tree by Type */}
      {departments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Chưa có phòng ban nào. Bấm &quot;Thêm phòng ban&quot; để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.entries(deptsByType) as [DepartmentType, Department[]][])
            .filter(([, depts]) => depts.length > 0)
            .map(([type, depts]) => {
              const isExpanded = expandedIds.has(type) || expandedIds.size === 0 // default expanded
              return (
                <div key={type} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleExpand(type)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEPT_TYPE_COLORS[type]}`}>
                        {DEPT_TYPE_LABELS[type]}
                      </span>
                      <span className="text-xs text-gray-400">{depts.length} phòng ban</span>
                    </div>
                  </button>

                  {/* Department List */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {depts.map((dept, idx) => (
                        <div
                          key={dept.id}
                          className={`flex items-center justify-between px-4 py-3 hover:bg-blue-50/30 transition-colors ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: dept.color || '#4986e7' }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900 truncate">{dept.name}</span>
                                <span className="text-xs text-gray-400 font-mono">{dept.code}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                {dept.headStaffId && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {staffMap[dept.headStaffId] || '(chưa gán)'}
                                  </span>
                                )}
                                {dept.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {dept.location}
                                  </span>
                                )}
                                {dept.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {dept.phone}
                                  </span>
                                )}
                                <span className="text-gray-400">
                                  {dept.memberCount ?? 0} nhân viên
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenEdit(dept)}
                              className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Sửa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(dept)}
                              className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}
      {/* ── OrgNames Configuration ── */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <Building className="w-4.5 h-4.5 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Tên đơn vị (Cơ quan ban hành)</h2>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-3">
            Danh sách tên đơn vị sẽ hiển thị ưu tiên khi chọn cơ quan ban hành văn bản.
          </p>
          {/* Add new */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOrgName()}
              placeholder="Nhập tên đơn vị mới..."
              className="flex-1 h-9 px-3 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <Button size="sm" onClick={handleAddOrgName} disabled={!newOrgName.trim() || orgSaving} className="h-9 px-3 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Thêm
            </Button>
          </div>

          {/* List */}
          {orgLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : orgNames.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">Chưa có tên đơn vị nào</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {orgNames.map((org, idx) => (
                <div key={org.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors group">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveOrg(idx, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Lên"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrg(idx, 'down')}
                      disabled={idx === orgNames.length - 1}
                      className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Xuống"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Name (edit mode or display) */}
                  {editingOrgId === org.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingOrgValue}
                        onChange={(e) => setEditingOrgValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveOrgEdit(org.id)}
                        className="flex-1 h-7 px-2 text-xs border border-blue-300 rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                        autoFocus
                      />
                      <button type="button" onClick={() => handleSaveOrgEdit(org.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Lưu">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingOrgId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Hủy">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 flex-1 min-w-0 truncate">{org.name}</span>
                      {orgDocCounts[org.id] > 0 && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {orgDocCounts[org.id]} VB
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => { setEditingOrgId(org.id); setEditingOrgValue(org.name) }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Sửa"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrg(org.id)}
                          disabled={orgDocCounts[org.id] > 0}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title={orgDocCounts[org.id] > 0 ? 'Đang gắn với văn bản, không thể xóa' : 'Xóa'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
