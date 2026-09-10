'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Loader2, Save, X, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import type { Tag } from '@/types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#78716c',
]

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | null = null
    ensureAuth().then(() => {
      unsub = onSnapshot(collection(db(), 'tags'), (snap) => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag))
        const active = all.filter(t => !t.deletedAt)
        active.sort((a, b) => {
          const tA = (a.createdAt as any)?.seconds || 0
          const tB = (b.createdAt as any)?.seconds || 0
          return tB - tA
        })
        setTags(active)
        setLoading(false)
      })
    })
    return () => { if (unsub) unsub() }
  }, [])

  const handleOpenCreate = () => {
    setEditingTag(null)
    setName('')
    setColor('#3b82f6')
    setShowForm(true)
  }

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag)
    setName(tag.name)
    setColor(tag.color || '#3b82f6')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editingTag) {
        await updateDoc(doc(db(), 'tags', editingTag.id), {
          name: name.trim(),
          color,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db(), 'tags'), {
          name: name.trim(),
          color,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deletedAt: null,
        })
      }
      setShowForm(false)
      setEditingTag(null)
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không thể lưu'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Xóa nhãn "${tag.name}"?`)) return
    try {
      // Soft delete
      await updateDoc(doc(db(), 'tags', tag.id), {
        deletedAt: serverTimestamp(),
      })
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Đang tải nhãn...</span>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý Nhãn</h1>
          <p className="text-sm text-gray-500 mt-1">Nhãn phân loại cho văn bản và công việc ({tags.length} nhãn)</p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Thêm nhãn
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {editingTag ? `Sửa: ${editingTag.name}` : 'Thêm nhãn mới'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingTag(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên nhãn *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="VD: ATSH, KSK, Báo cáo..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Màu</label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md border-2 border-gray-200" style={{ backgroundColor: color }} />
                <div className="flex flex-wrap gap-1 max-w-xs">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-5 h-5 rounded-sm border transition-all ${color === c ? 'border-gray-800 scale-110 ring-1 ring-gray-400' : 'border-gray-200 hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingTag(null) }}>Hủy</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingTag ? 'Cập nhật' : 'Tạo nhãn'}
            </Button>
          </div>
        </div>
      )}

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Chưa có nhãn nào. Bấm &quot;Thêm nhãn&quot; để bắt đầu.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {tags.map((tag, idx) => (
            <div
              key={tag.id}
              className={`flex items-center justify-between px-4 py-3 hover:bg-blue-50/30 transition-colors ${idx > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color || '#3b82f6' }} />
                <span className="font-medium text-sm text-gray-900">{tag.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleOpenEdit(tag)} className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" title="Sửa">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(tag)} className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors" title="Xóa">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
