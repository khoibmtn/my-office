'use client'

import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Palette } from 'lucide-react'

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-md border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56">
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false) }}
                className={`w-6 h-6 rounded-md border transition-all ${value === c ? 'border-blue-500 scale-110 ring-2 ring-blue-200' : 'border-gray-200 hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-8 h-8 cursor-pointer"
            />
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="flex-1 text-xs font-mono px-2 py-1 border border-gray-200 rounded"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function GeneralPage() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Đang tải cấu hình...</span>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Cấu hình chung</h1>
      <p className="text-sm text-gray-500 mb-6">Tùy chỉnh màu sắc trạng thái và cấu hình hệ thống</p>

      {/* Color Thresholds */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-800">Màu trạng thái hạn xử lý</h2>
        </div>
        <div className="space-y-3">
          {[
            { key: 'overdueColor', label: 'Quá hạn:' },
            { key: 'expiredColor', label: 'Hết hạn (0 ngày):' },
            { key: 'urgent1Color', label: 'Cận hạn (1-3 ngày):' },
            { key: 'urgent2Color', label: 'Cận hạn (4-7 ngày):' },
            { key: 'normalColor', label: 'Còn hạn (> 7 ngày):' },
            { key: 'completedColor', label: 'Hoàn thành:' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4">
              <label className="w-44 text-sm font-medium text-gray-700">{label}</label>
              <ColorPickerDropdown
                value={(thresholds as any)[key]}
                onChange={val => setThresholds({ ...thresholds, [key]: val })}
              />
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Xem trước:</p>
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

      {/* Save */}
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
    </div>
  )
}
