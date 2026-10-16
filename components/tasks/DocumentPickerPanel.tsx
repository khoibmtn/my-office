'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { Search, X, FileText, Folder } from 'lucide-react'
import type { Document, Dossier } from '@/types'

export interface DocumentPickerPanelProps {
  documents: Document[]
  dossiers: Dossier[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxHeight?: string
}

export function DocumentPickerPanel({
  documents,
  dossiers,
  selectedIds,
  onChange,
  maxHeight = '240px',
}: DocumentPickerPanelProps) {
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Get level-1 dossier name for a document
  const getLevel1Dossier = useCallback((doc: Document) => {
    if (!doc.dossierIds?.length) return null
    for (const did of doc.dossierIds) {
      const dos = dossiers.find(d => d.id === did)
      if (!dos) continue
      if (dos.level === 1) return dos.name
      if (dos.parentId) {
        const parent = dossiers.find(d => d.id === dos.parentId)
        if (parent?.level === 1) return parent.name
        if (parent?.parentId) {
          const grandparent = dossiers.find(d => d.id === parent.parentId)
          if (grandparent?.level === 1) return grandparent.name
        }
      }
    }
    return null
  }, [dossiers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return documents
    return documents.filter(d => {
      const title = (d.title || '').toLowerCase()
      const docNum = (d.docNumber || '').toLowerCase()
      return title.includes(q) || docNum.includes(q)
    })
  }, [documents, search])

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    )
  }

  const scrollToDoc = (id: string) => {
    if (!listRef.current) return
    const row = listRef.current.querySelector(`[data-doc-id="${id}"]`)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.classList.add('ring-2', 'ring-blue-400')
      setTimeout(() => row.classList.remove('ring-2', 'ring-blue-400'), 1200)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Selected tags — full title, click to scroll */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-1">
          {selectedIds.map(id => {
            const d = documents.find(doc => doc.id === id)
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors group"
                onClick={() => scrollToDoc(id)}
                title="Bấm để cuộn đến văn bản này"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 min-w-0 leading-snug">{d?.title || d?.docNumber || id.slice(-6)}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(id) }}
                  className="p-0.5 text-blue-400 hover:text-red-500 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm văn bản theo tiêu đề, mã hiệu..."
          className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Document list with columns */}
      <div ref={listRef} style={{ maxHeight }} className="border border-slate-200 rounded-lg overflow-y-auto bg-white">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-3 text-center">Không tìm thấy văn bản nào</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                <th className="w-8 px-2 py-1.5"></th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500 uppercase w-[120px]">Hồ sơ</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Tên văn bản</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const isChecked = selectedIds.includes(doc.id)
                const dossierName = getLevel1Dossier(doc)
                return (
                  <tr
                    key={doc.id}
                    data-doc-id={doc.id}
                    onClick={() => toggle(doc.id)}
                    className={`cursor-pointer transition-all rounded ${isChecked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(doc.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                      {dossierName ? (
                        <span className="inline-flex items-center gap-1">
                          <Folder className="w-3 h-3 text-amber-500" />
                          <span className="max-w-[100px] truncate">{dossierName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700 break-words leading-snug">
                      {doc.title || doc.docNumber || <span className="text-slate-400 italic">Không tiêu đề</span>}
                      {(doc.sender || doc.issueDate) && (
                        <span className="ml-1 text-[11px]">
                          {'('}
                          {doc.sender && <span className="font-bold italic text-red-600">{doc.sender}</span>}
                          {doc.sender && doc.issueDate && ', '}
                          {doc.issueDate && (
                            <>
                              <span className="text-slate-500">ngày </span>
                              <span className="font-bold text-blue-600">
                                {(() => {
                                  const d = typeof doc.issueDate?.toDate === 'function' ? doc.issueDate.toDate() : doc.issueDate instanceof Date ? doc.issueDate : null
                                  if (!d || isNaN(d.getTime())) return '—'
                                  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
                                })()}
                              </span>
                            </>
                          )}
                          {')'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
