'use client'

import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, resetSession, linkGoogleAccount, isGoogleUser, hasGoogleToken, auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Users, Loader2, Palette, AlertTriangle, Check, Link2, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react'

interface StaffMember {
  name: string
}

const DEFAULT_STAFF: StaffMember[] = [
  { name: 'Giang' },
  { name: 'Ngân' },
  { name: 'Liên' },
  { name: 'Sắn' },
  { name: 'Lệ' },
  { name: 'Trinh' },
]

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
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                  }}
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

export default function SettingsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadSettings()
    checkGoogleStatus()
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
        setStaff(data.staff || DEFAULT_STAFF)
        setThresholds({
          overdueColor: data.overdueColor ?? DEFAULT_THRESHOLDS.overdueColor,
          expiredColor: data.expiredColor ?? DEFAULT_THRESHOLDS.expiredColor,
          urgent1Color: data.urgent1Color ?? DEFAULT_THRESHOLDS.urgent1Color,
          urgent2Color: data.urgent2Color ?? DEFAULT_THRESHOLDS.urgent2Color,
          normalColor: data.normalColor ?? DEFAULT_THRESHOLDS.normalColor,
          completedColor: data.completedColor ?? DEFAULT_THRESHOLDS.completedColor,
        })
      } else {
        setStaff(DEFAULT_STAFF)
        await setDoc(doc(db(), 'settings', 'general'), { staff: DEFAULT_STAFF, ...DEFAULT_THRESHOLDS })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      setStaff(DEFAULT_STAFF)
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db(), 'settings', 'general'), {
        staff,
        ...thresholds,
      }, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Lỗi lưu: ' + (err instanceof Error ? err.message : String(err)))
    }
    setSaving(false)
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
    if (!confirm('Bạn có chắc muốn đặt lại phiên? Tài khoản Google sẽ bị hủy liên kết, nhưng dữ liệu văn bản vẫn được giữ nguyên.')) {
      return
    }
    setResetting(true)
    try {
      await resetSession()
      window.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
      setResetting(false)
    }
  }

  function addStaff() {
    setStaff([...staff, { name: '' }])
  }

  function removeStaff(idx: number) {
    setStaff(staff.filter((_, i) => i !== idx))
  }

  function updateStaff(idx: number, name: string) {
    const updated = [...staff]
    updated[idx] = { name }
    setStaff(updated)
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">⚙️ Cài đặt</h1>

      {/* Google Account & Session */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          {googleLinked ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldX className="h-5 w-5 text-slate-400" />
          )}
          <h2 className="text-lg font-semibold text-slate-800">Tài khoản & Phiên</h2>
        </div>
        
        <div className="space-y-4">
          {/* Google account status */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Google Drive</p>
                {googleLinked ? (
                  <p className="text-sm text-green-600 mt-0.5">
                    ✅ Đã liên kết: <span className="font-medium">{googleEmail}</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">
                    Chưa liên kết — cần liên kết để tải file lên Google Drive
                  </p>
                )}
              </div>
              {!googleLinked && (
                <Button size="sm" variant="outline" onClick={handleLinkGoogle} disabled={linking}>
                  {linking ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-1" />
                  )}
                  Liên kết Google
                </Button>
              )}
            </div>
          </div>

          {/* Token status */}
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

          {/* Reset session */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Đặt lại phiên</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hủy liên kết Google, xóa token. Dữ liệu văn bản vẫn được giữ nguyên.
                </p>
              </div>
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleReset} disabled={resetting}>
                {resetting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Đặt lại
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Staff management */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">Danh sách nhân viên</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Quản lý nhân viên để giao việc xử lý văn bản
        </p>

        <div className="space-y-2 mb-4">
          {staff.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 text-right text-sm text-slate-400 font-medium">{i + 1}.</span>
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateStaff(i, e.target.value)}
                placeholder="Họ tên nhân viên..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => removeStaff(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button size="sm" variant="outline" onClick={addStaff}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm nhân viên
        </Button>
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
          {/* Overdue */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Quá hạn (&lt; 0 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <ColorPickerDropdown
                value={thresholds.overdueColor}
                onChange={val => setThresholds({ ...thresholds, overdueColor: val })}
              />
              <span className="text-xs text-slate-400">Màu quá hạn</span>
            </div>
          </div>

          {/* Expired */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Hết hạn (0 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <ColorPickerDropdown
                value={thresholds.expiredColor}
                onChange={val => setThresholds({ ...thresholds, expiredColor: val })}
              />
              <span className="text-xs text-slate-400">Màu hết hạn</span>
            </div>
          </div>

          {/* Urgent 1-3 */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Cận hạn (1-3 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <ColorPickerDropdown
                value={thresholds.urgent1Color}
                onChange={val => setThresholds({ ...thresholds, urgent1Color: val })}
              />
              <span className="text-xs text-slate-400">Màu cận hạn</span>
            </div>
          </div>

          {/* Urgent 4-7 */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Cận hạn (4-7 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <ColorPickerDropdown
                value={thresholds.urgent2Color}
                onChange={val => setThresholds({ ...thresholds, urgent2Color: val })}
              />
              <span className="text-xs text-slate-400">Màu cận hạn</span>
            </div>
          </div>

          {/* Normal */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Còn hạn (&gt; 7 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <ColorPickerDropdown
                value={thresholds.normalColor}
                onChange={val => setThresholds({ ...thresholds, normalColor: val })}
              />
              <span className="text-xs text-slate-400">Màu bình thường</span>
            </div>
          </div>

          {/* Completed color */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Hoàn thành:</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <ColorPickerDropdown
                value={thresholds.completedColor}
                onChange={val => setThresholds({ ...thresholds, completedColor: val })}
              />
              <span className="text-xs text-slate-400">Màu hoàn thành</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Xem trước:</p>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: thresholds.overdueColor }}>
              Quá hạn
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: thresholds.expiredColor }}>
              Hết hạn (0 ngày)
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: thresholds.urgent1Color }}>
              Cận hạn 1-3 ngày
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: thresholds.urgent2Color }}>
              Cận hạn 4-7 ngày
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: thresholds.normalColor }}>
              Còn hạn &gt; 7 ngày
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: thresholds.completedColor }}>
              Hoàn thành
            </span>
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
              Lưu tất cả
            </>
          )}
        </Button>
      </div>
    </main>
  )
}
