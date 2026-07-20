'use client'

import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc, collection, onSnapshot, orderBy, query, deleteDoc as firestoreDeleteDoc, updateDoc } from 'firebase/firestore'
import { db, resetSession, linkGoogleAccount, isGoogleUser, hasGoogleToken, auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Users, Loader2, Palette, AlertTriangle, Check, Link2, RotateCcw, ShieldCheck, ShieldX, Key, Eye, EyeOff, Shield } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { usePermissions } from '@/hooks/usePermissions'
import { hashPassword, savePermissions, DEFAULT_STAFF_PERMISSIONS, DEFAULT_GUEST_PERMISSIONS } from '@/lib/staff'
import { serverTimestamp } from 'firebase/firestore'
import type { StaffMember, RolePermissions } from '@/types'

const DEFAULT_THRESHOLDS = {
  overdueColor: '#ef4444',
  expiredColor: '#f97316',
  urgent1Color: '#f59e0b',
  urgent2Color: '#eab308',
  normalColor: '#22c55e',
  completedColor: '#10b981',
}

const PRESET_COLORS = [
  '#ac725e', '#d06b64', '#f83a22', '#fa573c', '#ff7537', '#ffad46', '#fbe983', '#fad165',
  '#42d692', '#92e1c0', '#9fe1e7', '#9fc6e7', '#4986e7', '#16a765', '#7bd148', '#b3dc6c',
  '#595959', '#c2c2c2', '#cabdbf', '#cca6ac', '#f691b2', '#cd74e6', '#a47ae2', '#9a9cff'
]

const PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  canViewAll: 'Xem tất cả văn bản',
  canAddDocument: 'Thêm văn bản mới',
  canEditDocument: 'Sửa văn bản',
  canDeleteDocument: 'Xóa văn bản',
  canAssignStaff: 'Giao việc cho nhân viên',
  canSetDeadline: 'Đặt hạn xử lý',
  canSetCompletedDate: 'Đặt ngày hoàn thành',
  canEditNotes: 'Sửa ghi chú',
  canToggleComplete: 'Đánh dấu hoàn thành (tất cả)',
  canCompleteAssigned: 'Hoàn thành (chỉ việc được giao)',
  canCopyTaskString: 'Copy chuỗi giao việc',
  canAccessSettings: 'Truy cập Cài đặt',
}

function ColorPickerDropdown({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-10 h-10 rounded-full border border-slate-200 cursor-pointer shadow-sm transition-transform hover:scale-105"
        style={{ background: value }}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute z-10 top-12 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-[220px] animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map(c => {
              const isSelected = value.toLowerCase() === c.toLowerCase()
              return (
                <button
                  key={c}
                  className="w-[20px] h-[20px] rounded-full flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
                  style={{ background: c, boxShadow: isSelected ? '0 0 0 1px #fff, 0 0 0 2px #3b82f6' : 'none' }}
                  onClick={() => { onChange(c); setOpen(false) }}
                >
                  {isSelected && <Check size={12} className="text-white drop-shadow-md" />}
                </button>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Hoặc tự chọn màu:</span>
            <input
              type="color"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer p-0 border-0"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Staff Form Modal
// ============================================================
function StaffFormModal({
  editingStaff,
  onClose,
  onSave,
}: {
  editingStaff: Partial<StaffMember> | null
  onClose: () => void
  onSave: (data: {
    fullName: string; shortName: string; nickname: string;
    password?: string; title: string; position: string
  }, docId?: string) => Promise<void>
}) {
  const isEdit = editingStaff && 'id' in editingStaff && editingStaff.id
  const [fullName, setFullName] = useState(editingStaff?.fullName || '')
  const [shortName, setShortName] = useState(editingStaff?.shortName || '')
  const [nickname, setNickname] = useState(editingStaff?.nickname || '')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState(editingStaff?.title || '')
  const [position, setPosition] = useState(editingStaff?.position || '')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Họ tên không được để trống'); return }
    if (!shortName.trim()) { setError('Tên ngắn không được để trống'); return }
    if (!nickname.trim()) { setError('Nickname không được để trống'); return }
    if (!isEdit && !password.trim()) { setError('Mật khẩu không được để trống'); return }

    setSaving(true)
    setError('')
    try {
      // Find firestore doc ID from editingStaff (it might be stored differently)
      const docId = isEdit ? (editingStaff as any)._docId : undefined
      await onSave({
        fullName: fullName.trim(),
        shortName: shortName.trim(),
        nickname: nickname.toLowerCase().trim(),
        password: password || undefined,
        title: title.trim(),
        position: position.trim(),
      }, docId)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Lỗi lưu nhân viên')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Sửa nhân viên' : 'Thêm nhân viên mới'}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên đầy đủ *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nguyễn Văn Giang"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên ngắn *</label>
              <input type="text" value={shortName} onChange={e => setShortName(e.target.value)}
                placeholder="Giang"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nickname (đăng nhập) *</label>
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder="giang"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mật khẩu {isEdit ? '(để trống nếu không đổi)' : '*'}
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Nhập mật khẩu'}
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chức danh</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Chuyên viên"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chức vụ</label>
              <input type="text" value={position} onChange={e => setPosition(e.target.value)}
                placeholder="Phó trưởng phòng"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {isEdit ? 'Cập nhật' : 'Thêm'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// Change Password Modal
// ============================================================
function ChangePasswordModal({ staffName, docId, onClose }: { staffName: string; docId: string; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setSaving(true)
    try {
      const hash = await hashPassword(password)
      await updateDoc(doc(db(), 'staff', docId), { passwordHash: hash, updatedAt: serverTimestamp() })
      onClose()
    } catch (err) {
      alert('Lỗi đổi mật khẩu: ' + String(err))
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Đổi mật khẩu — {staffName}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới"
              autoFocus
              className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            <Button type="submit" size="sm" disabled={saving || !password.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
              Đổi mật khẩu
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// Main Settings Page
// ============================================================
export default function SettingsPage() {
  const { isAdmin, isGuest } = useRole()
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [migrating, setMigrating] = useState(false)

  // Staff management
  const [staffMembers, setStaffMembers] = useState<(StaffMember & { _docId: string })[]>([])
  const [staffFormOpen, setStaffFormOpen] = useState<Partial<StaffMember & { _docId: string }> | null>(null)
  const [passwordModal, setPasswordModal] = useState<{ name: string; docId: string } | null>(null)

  // Permissions
  const [permStaff, setPermStaff] = useState<RolePermissions>(DEFAULT_STAFF_PERMISSIONS)
  const [permGuest, setPermGuest] = useState<RolePermissions>(DEFAULT_GUEST_PERMISSIONS)
  const [permSaving, setPermSaving] = useState(false)
  const [permSaved, setPermSaved] = useState(false)

  useEffect(() => {
    loadSettings()
    checkGoogleStatus()
    loadPermissions()

    // Live staff list
    const q = query(collection(db(), 'staff'), orderBy('shortName', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setStaffMembers(snap.docs.map(d => ({ ...d.data(), _docId: d.id } as StaffMember & { _docId: string })))
    })
    return () => unsub()
  }, [])

  function checkGoogleStatus() {
    const firebaseAuth = auth()
    const user = firebaseAuth.currentUser
    if (user && !user.isAnonymous) {
      setGoogleLinked(true)
      setGoogleEmail(user.email)
    } else {
      setGoogleLinked(false)
      setGoogleEmail(null)
    }
  }

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db(), 'settings', 'general'))
      if (snap.exists()) {
        const data = snap.data()
        setThresholds({
          overdueColor: data.overdueColor ?? DEFAULT_THRESHOLDS.overdueColor,
          expiredColor: data.expiredColor ?? DEFAULT_THRESHOLDS.expiredColor,
          urgent1Color: data.urgent1Color ?? DEFAULT_THRESHOLDS.urgent1Color,
          urgent2Color: data.urgent2Color ?? DEFAULT_THRESHOLDS.urgent2Color,
          normalColor: data.normalColor ?? DEFAULT_THRESHOLDS.normalColor,
          completedColor: data.completedColor ?? DEFAULT_THRESHOLDS.completedColor,
        })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
    setLoading(false)
  }

  async function loadPermissions() {
    try {
      const snap = await getDoc(doc(db(), 'settings', 'permissions'))
      if (snap.exists()) {
        const data = snap.data()
        setPermStaff({ ...DEFAULT_STAFF_PERMISSIONS, ...data.staff })
        setPermGuest({ ...DEFAULT_GUEST_PERMISSIONS, ...data.guest })
      }
    } catch (err) {
      console.error('Failed to load permissions:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db(), 'settings', 'general'), thresholds, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Lỗi lưu: ' + (err instanceof Error ? err.message : String(err)))
    }
    setSaving(false)
  }

  async function handleSavePermissions() {
    setPermSaving(true)
    try {
      await savePermissions({ staff: permStaff, guest: permGuest })
      setPermSaved(true)
      setTimeout(() => setPermSaved(false), 2000)
    } catch (err) {
      alert('Lỗi lưu phân quyền: ' + String(err))
    }
    setPermSaving(false)
  }

  async function handleLinkGoogle() {
    setLinking(true)
    try {
      const user = await linkGoogleAccount()
      if (user) {
        setGoogleLinked(true)
        setGoogleEmail(user.email)
      }
    } catch (err: any) {
      alert('Lỗi liên kết Google: ' + (err?.message || String(err)))
    }
    setLinking(false)
  }

  async function handleReset() {
    if (!confirm('Bạn có chắc muốn đặt lại phiên? Tài khoản Google sẽ bị hủy liên kết, nhưng dữ liệu văn bản vẫn được giữ nguyên.')) return
    setResetting(true)
    try {
      await resetSession()
      window.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
      setResetting(false)
    }
  }

  async function handleMigrate() {
    if (!confirm('Migrate dữ liệu nhân viên từ hệ thống cũ? Chỉ chạy 1 lần.')) return
    setMigrating(true)
    try {
      const res = await fetch('/api/admin/migrate-staff', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(`Migration thành công! ${data.staffCreated} nhân viên, ${data.documentsUpdated} văn bản cập nhật.`)
      } else {
        alert('Migration lỗi: ' + (data.error || 'Unknown'))
      }
    } catch (err) {
      alert('Lỗi: ' + String(err))
    }
    setMigrating(false)
  }

  function generateId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
    return result
  }

  async function handleSaveStaff(data: {
    fullName: string; shortName: string; nickname: string;
    password?: string; title: string; position: string
  }, docId?: string) {
    if (docId) {
      // Update existing
      const updateData: Record<string, unknown> = {
        fullName: data.fullName,
        shortName: data.shortName,
        nickname: data.nickname,
        title: data.title,
        position: data.position,
        updatedAt: serverTimestamp(),
      }
      if (data.password) {
        updateData.passwordHash = await hashPassword(data.password)
      }
      await updateDoc(doc(db(), 'staff', docId), updateData)
    } else {
      // Create new
      const id = generateId()
      const passwordHash = data.password ? await hashPassword(data.password) : ''
      const { addDoc: addDocFn } = await import('firebase/firestore')
      await addDocFn(collection(db(), 'staff'), {
        id,
        fullName: data.fullName,
        shortName: data.shortName,
        nickname: data.nickname,
        passwordHash,
        title: data.title,
        position: data.position,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  async function handleDeleteStaff(docId: string, name: string) {
    if (!confirm(`Xóa nhân viên "${name}"? Hành động này không thể hoàn tác.`)) return
    await firestoreDeleteDoc(doc(db(), 'staff', docId))
  }

  // Access guard
  if (!isAdmin) {
    return (
      <main className="p-8 max-w-2xl">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <ShieldX className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Không có quyền truy cập</h2>
          <p className="text-sm text-slate-600">Trang này chỉ dành cho quản trị viên.</p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <main className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">⚙️ Cài đặt</h1>

      {/* Google Account & Session */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          {googleLinked ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldX className="h-5 w-5 text-slate-400" />}
          <h2 className="text-lg font-semibold text-slate-800">Tài khoản & Phiên</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Google Drive</p>
                {googleLinked ? (
                  <p className="text-sm text-green-600 mt-0.5">✅ Đã liên kết: <span className="font-medium">{googleEmail}</span></p>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">Chưa liên kết — cần liên kết để tải file lên Google Drive</p>
                )}
              </div>
              {!googleLinked && (
                <Button size="sm" variant="outline" onClick={handleLinkGoogle} disabled={linking}>
                  {linking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                  Liên kết Google
                </Button>
              )}
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm font-medium text-slate-700 mb-1">Phiên Extension</p>
            <p className="text-sm text-slate-500">
              {hasGoogleToken() ? (
                <span className="text-green-600">✅ Token có sẵn — Extension sẵn sàng</span>
              ) : (
                <span className="text-amber-600">⚠️ Chưa có token Drive — Hãy liên kết Google ở trên</span>
              )}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Đặt lại phiên</p>
              <p className="text-xs text-slate-500 mt-0.5">Hủy liên kết Google, xóa token. Dữ liệu văn bản vẫn được giữ nguyên.</p>
            </div>
            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleReset} disabled={resetting}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Đặt lại
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Staff Management */}
      {/* ============================================================ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Quản lý nhân viên</h2>
          </div>
          <div className="flex items-center gap-2">
            {staffMembers.length === 0 && (
              <Button size="sm" variant="outline" onClick={handleMigrate} disabled={migrating}
                className="text-amber-600 hover:text-amber-700 border-amber-300">
                {migrating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Migrate từ hệ thống cũ
              </Button>
            )}
            <Button size="sm" onClick={() => setStaffFormOpen({})}>
              <Plus className="h-4 w-4 mr-1" />
              Thêm nhân viên
            </Button>
          </div>
        </div>

        {staffMembers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Chưa có nhân viên nào. Thêm mới hoặc migrate từ hệ thống cũ.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Họ tên</th>
                  <th className="px-2 py-2 font-medium">Tên ngắn</th>
                  <th className="px-2 py-2 font-medium">Nickname</th>
                  <th className="px-2 py-2 font-medium">Chức danh</th>
                  <th className="px-2 py-2 font-medium">Chức vụ</th>
                  <th className="px-2 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((s, i) => (
                  <tr key={s._docId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-800">{s.fullName}</td>
                    <td className="px-2 py-2.5 text-slate-600">{s.shortName}</td>
                    <td className="px-2 py-2.5 text-blue-600 font-mono text-xs">{s.nickname}</td>
                    <td className="px-2 py-2.5 text-slate-500">{s.title || '—'}</td>
                    <td className="px-2 py-2.5 text-slate-500">{s.position || '—'}</td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setStaffFormOpen({ ...s })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Sửa"
                        >
                          <Palette className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setPasswordModal({ name: s.shortName, docId: s._docId })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Đổi mật khẩu"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(s._docId, s.shortName)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* Permission Table */}
      {/* ============================================================ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-800">Bảng phân quyền</h2>
          </div>
          <Button size="sm" onClick={handleSavePermissions} disabled={permSaving} variant={permSaved ? 'outline' : 'default'}>
            {permSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : permSaved ? '✓ Đã lưu' : <><Save className="h-4 w-4 mr-1" />Lưu phân quyền</>}
          </Button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Admin luôn có đầy đủ quyền. Tùy chỉnh quyền cho Staff và Guest bên dưới.
        </p>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="px-3 py-2.5 font-medium text-slate-700">Quyền</th>
                <th className="px-3 py-2.5 font-medium text-center text-green-700 w-24">Staff</th>
                <th className="px-3 py-2.5 font-medium text-center text-slate-500 w-24">Guest</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSION_LABELS) as (keyof RolePermissions)[]).map((key) => (
                <tr key={key} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-700">{PERMISSION_LABELS[key]}</td>
                  <td className="px-3 py-2.5 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permStaff[key]}
                        onChange={() => setPermStaff({ ...permStaff, [key]: !permStaff[key] })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-green-500 peer-focus:ring-2 peer-focus:ring-green-300 transition-colors
                        after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permGuest[key]}
                        onChange={() => setPermGuest({ ...permGuest, [key]: !permGuest[key] })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-green-500 peer-focus:ring-2 peer-focus:ring-green-300 transition-colors
                        after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Warning thresholds & colors */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-800">Ngưỡng cảnh báo</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Thiết lập ngưỡng ngày và màu sắc cảnh báo cho văn bản
        </p>

        <div className="space-y-4">
          {[
            { key: 'overdueColor', label: 'Quá hạn (< 0 ngày):' },
            { key: 'expiredColor', label: 'Hết hạn (0 ngày):' },
            { key: 'urgent1Color', label: 'Cận hạn (1-3 ngày):' },
            { key: 'urgent2Color', label: 'Cận hạn (4-7 ngày):' },
            { key: 'normalColor', label: 'Còn hạn (> 7 ngày):' },
            { key: 'completedColor', label: 'Hoàn thành:' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4">
              <label className="w-40 text-sm font-medium text-slate-700">{label}</label>
              <div className="w-20" />
              <div className="flex items-center gap-2">
                <ColorPickerDropdown
                  value={(thresholds as any)[key]}
                  onChange={val => setThresholds({ ...thresholds, [key]: val })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Xem trước:</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'overdueColor', label: 'Quá hạn' },
              { key: 'expiredColor', label: 'Hết hạn (0 ngày)' },
              { key: 'urgent1Color', label: 'Cận hạn 1-3 ngày' },
              { key: 'urgent2Color', label: 'Cận hạn 4-7 ngày' },
              { key: 'normalColor', label: 'Còn hạn > 7 ngày' },
              { key: 'completedColor', label: 'Hoàn thành' },
            ].map(({ key, label }) => (
              <span key={key} className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: (thresholds as any)[key] }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : saved ? (
            '✓ Đã lưu'
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Lưu cài đặt
            </>
          )}
        </Button>
      </div>

      {/* Modals */}
      {staffFormOpen !== null && (
        <StaffFormModal
          editingStaff={staffFormOpen}
          onClose={() => setStaffFormOpen(null)}
          onSave={handleSaveStaff}
        />
      )}
      {passwordModal && (
        <ChangePasswordModal
          staffName={passwordModal.name}
          docId={passwordModal.docId}
          onClose={() => setPasswordModal(null)}
        />
      )}
    </main>
  )
}
