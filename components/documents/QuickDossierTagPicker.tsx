'use client'

import React, { useState, useEffect } from 'react'
import { Folder, Tag as TagIcon, Plus, X, Loader2 } from 'lucide-react'
import { useDossiers } from '@/hooks/useDossiers'
import { useTags } from '@/hooks/useTags'
import { useRole } from '@/hooks/useRole'
import { toggleDocumentDossier, moveDocumentDossier } from '@/lib/dossiers'
import { createTag } from '@/lib/tags'
import { updateDocument } from '@/lib/firestore'
import type { Document, Tag } from '@/types'

interface QuickDossierTagPickerProps {
  document: Document
  onUpdate?: (updatedFields: Partial<Document>) => void
}

export function QuickDossierTagPicker({ document: docItem, onUpdate }: QuickDossierTagPickerProps) {
  const { staffId } = useRole()
  const { dossiers } = useDossiers()
  const { tags: allTags } = useTags()

  const [dossierIds, setDossierIds] = useState<string[]>(docItem.dossierIds || [])
  const [tagIds, setTagIds] = useState<string[]>(docItem.tagIds || [])
  const [newTagName, setNewTagName] = useState('')
  const [savingTag, setSavingTag] = useState(false)

  useEffect(() => {
    setDossierIds(docItem.dossierIds || [])
    setTagIds(docItem.tagIds || [])
  }, [docItem])

  // Current attached dossiers
  const currentDossiers = dossiers.filter(d => dossierIds.includes(d.id))
  // Available dossiers to add
  const availableDossiers = dossiers.filter(d => !dossierIds.includes(d.id))

  // Current attached tags
  const currentTags = allTags.filter(t => tagIds.includes(t.id))
  // Available tags to add
  const availableTags = allTags.filter(t => !tagIds.includes(t.id))

  const handleAddDossier = async (dossierId: string) => {
    if (!dossierId) return
    const next = [...dossierIds, dossierId]
    setDossierIds(next)
    try {
      await toggleDocumentDossier(docItem.id, dossierId, 'add', staffId || 'unknown')
      if (onUpdate) onUpdate({ dossierIds: next })
    } catch (err) {
      console.error(err)
    }
  }

  const handleMoveDossier = async (toDossierId: string) => {
    if (!toDossierId) return
    const fromId = currentDossiers[0]?.id || null
    try {
      await moveDocumentDossier(docItem.id, fromId, toDossierId, staffId || 'unknown')
      const next = fromId
        ? dossierIds.filter(id => id !== fromId).concat(toDossierId)
        : [...dossierIds, toDossierId]
      setDossierIds(next)
      if (onUpdate) onUpdate({ dossierIds: next })
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemoveDossier = async (dossierId: string) => {
    const next = dossierIds.filter(id => id !== dossierId)
    setDossierIds(next)
    try {
      await toggleDocumentDossier(docItem.id, dossierId, 'remove', staffId || 'unknown')
      if (onUpdate) onUpdate({ dossierIds: next })
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddTagId = async (tagId: string) => {
    if (!tagId || tagIds.includes(tagId)) return
    const next = [...tagIds, tagId]
    setTagIds(next)
    try {
      await updateDocument(docItem.id, { tagIds: next })
      if (onUpdate) onUpdate({ tagIds: next })
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemoveTagId = async (tagId: string) => {
    const next = tagIds.filter(id => id !== tagId)
    setTagIds(next)
    try {
      await updateDocument(docItem.id, { tagIds: next })
      if (onUpdate) onUpdate({ tagIds: next })
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateAndAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return
    setSavingTag(true)
    try {
      const createdId = await createTag(newTagName.trim(), staffId || 'unknown')
      await handleAddTagId(createdId)
      setNewTagName('')
    } catch (err) {
      console.error(err)
    }
    setSavingTag(false)
  }

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200">
      {/* Dossier Quick Picker Section */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Folder className="w-3.5 h-3.5 text-blue-600" />
          Hồ sơ chứa văn bản ({currentDossiers.length})
        </label>

        {/* Attached Dossiers Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {currentDossiers.map(d => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
            >
              <span>📂 {d.name}</span>
              <button
                onClick={() => handleRemoveDossier(d.id)}
                className="hover:text-red-600 transition-colors p-0.5"
                title="Gỡ khỏi hồ sơ"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {currentDossiers.length === 0 && (
            <span className="text-xs text-slate-400 italic">Chưa xếp vào hồ sơ nào</span>
          )}
        </div>

        {/* Add or Move Dossier Dropdowns */}
        {availableDossiers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <select
              value=""
              onChange={e => handleAddDossier(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs bg-slate-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
              title="Thêm văn bản này vào thêm 1 hồ sơ nữa"
            >
              <option value="">+ Thêm vào hồ sơ khác...</option>
              {availableDossiers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.level === 1 ? '📂 ' : '  └ 📂 '}{d.name} (Cấp {d.level})
                </option>
              ))}
            </select>

            <select
              value=""
              onChange={e => handleMoveDossier(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-amber-200 rounded-md text-xs bg-amber-50/60 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer font-medium text-amber-900"
              title="Di chuyển hẳn sang hồ sơ khác (gỡ khỏi hồ sơ hiện tại)"
            >
              <option value="">⇄ Di chuyển sang hồ sơ...</option>
              {availableDossiers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.level === 1 ? '📂 ' : '  └ 📂 '}{d.name} (Cấp {d.level})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tag Quick Picker Section */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <TagIcon className="w-3.5 h-3.5 text-purple-600" />
          Nhãn / Tags ({currentTags.length})
        </label>

        {/* Attached Tags Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {currentTags.map(t => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-white shadow-sm"
              style={{ background: t.color }}
            >
              <span>{t.name}</span>
              <button
                onClick={() => handleRemoveTagId(t.id)}
                className="hover:opacity-80 transition-opacity p-0.5"
                title="Xóa nhãn"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Add/Create Tag Input & Dropdown */}
        <form onSubmit={handleCreateAndAddTag} className="flex gap-1">
          <input
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="+ Thêm nhãn mới hoặc chọn..."
            className="flex-1 px-2.5 py-1 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {availableTags.length > 0 && (
            <select
              value=""
              onChange={e => handleAddTagId(e.target.value)}
              className="w-24 px-1.5 py-1 border border-slate-200 rounded-md text-xs bg-slate-50"
            >
              <option value="">Có sẵn...</option>
              {availableTags.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {newTagName.trim() && (
            <button
              type="submit"
              disabled={savingTag}
              className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              {savingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
