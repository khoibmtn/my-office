'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Users, Loader2, Palette, AlertTriangle } from 'lucide-react'

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

export default function SettingsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

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
              <input
                type="color"
                value={thresholds.overdueColor}
                onChange={e => setThresholds({ ...thresholds, overdueColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-400">Màu quá hạn</span>
            </div>
          </div>

          {/* Expired */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Hết hạn (0 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={thresholds.expiredColor}
                onChange={e => setThresholds({ ...thresholds, expiredColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-400">Màu hết hạn</span>
            </div>
          </div>

          {/* Urgent 1-3 */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Cận hạn (1-3 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={thresholds.urgent1Color}
                onChange={e => setThresholds({ ...thresholds, urgent1Color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-400">Màu cận hạn</span>
            </div>
          </div>

          {/* Urgent 4-7 */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Cận hạn (4-7 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={thresholds.urgent2Color}
                onChange={e => setThresholds({ ...thresholds, urgent2Color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-400">Màu cận hạn</span>
            </div>
          </div>

          {/* Normal */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Còn hạn (&gt; 7 ngày):</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={thresholds.normalColor}
                onChange={e => setThresholds({ ...thresholds, normalColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-400">Màu bình thường</span>
            </div>
          </div>

          {/* Completed color */}
          <div className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">Hoàn thành:</label>
            <div className="w-20" />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={thresholds.completedColor}
                onChange={e => setThresholds({ ...thresholds, completedColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
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

      {/* Token info */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-slate-800">Google Drive Token</h2>
        </div>
        <p className="text-sm text-slate-500 mb-2">
          Token Google Drive được lưu tự động khi bạn đăng nhập. Extension Chrome đọc token từ trang này để upload file.
        </p>
        <div className="p-3 bg-slate-50 rounded-lg text-sm">
          <span className="font-medium text-slate-600">Trạng thái: </span>
          {typeof window !== 'undefined' && localStorage.getItem('google_access_token') ? (
            <span className="text-green-600 font-semibold">✅ Token có sẵn</span>
          ) : (
            <span className="text-red-600 font-semibold">❌ Chưa có token — Hãy đăng xuất và đăng nhập lại</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          <strong>Vercel/Production:</strong> Extension cần được cập nhật domain trong manifest.json và token-sync.js để hoạt động trên domain production.
        </p>
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
