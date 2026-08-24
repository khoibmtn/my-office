'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Folder, FolderPlus, Pencil, Trash2, Archive, ArchiveRestore,
  Search, Calendar, FileText, Layers, AlertCircle, Loader2
} from 'lucide-react'
import type { Dossier, Document } from '@/types'
import { toggleArchiveDossier } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'

interface DossierTableProps {
  dossiers: Dossier[]
  documents: Document[]
  onAddSubDossier: (parent: Dossier) => void
  onEditDossier: (dossier: Dossier) => void
  onDeleteDossier: (dossier: Dossier) => void
  perms: {
    canCreateDossier?: boolean
    canEditDossier?: boolean
    canDeleteDossier?: boolean
  }
}

export function DossierTable({
  dossiers,
  documents,
  onAddSubDossier,
  onEditDossier,
  onDeleteDossier,
  perms,
}: DossierTableProps) {
  const router = useRouter()
  const { staffId } = useRole()

  const [tab, setTab] = useState<'active' | 'archived' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archivedAlert, setArchivedAlert] = useState<string | null>(null)

  // Document counts map
  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!documents) return counts
    documents.forEach(doc => {
      (doc.dossierIds || []).forEach(did => {
        counts[did] = (counts[did] || 0) + 1
      })
    })
    return counts
  }, [documents])

  // Filter dossiers by tab & search query
  const filteredDossiers = useMemo(() => {
    return dossiers.filter(d => {
      // Tab filter
      if (tab === 'active' && d.isArchived) return false
      if (tab === 'archived' && !d.isArchived) return false

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        return d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [dossiers, tab, search])

  // Stats
  const activeCount = useMemo(() => dossiers.filter(d => !d.isArchived).length, [dossiers])
  const archivedCount = useMemo(() => dossiers.filter(d => d.isArchived).length, [dossiers])

  const handleToggleArchive = async (dossier: Dossier, e: React.MouseEvent) => {
    e.stopPropagation()
    setArchivingId(dossier.id)
    try {
      await toggleArchiveDossier(dossier.id, !dossier.isArchived, staffId || 'unknown')
    } catch (err) {
      console.error(err)
    } finally {
      setArchivingId(null)
    }
  }

  const handleDossierClick = (dossier: Dossier) => {
    if (dossier.isArchived) {
      setArchivedAlert(`Hồ sơ "${dossier.name}" đã lưu trữ. Không thể mở trên thanh điều hướng trái. Vui lòng bấm nút "Bỏ lưu trữ" nếu muốn xem và thao tác.`)
      setTimeout(() => setArchivedAlert(null), 5000)
      return
    }
    // Navigate and auto-expand on left panel
    router.push(`/dossiers?id=${dossier.id}`)
  }

  const formatDate = (ts: any) => {
    if (!ts) return '—'
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Alert toast for archived dossier click */}
      {archivedAlert && (
        <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs font-semibold text-purple-900 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{archivedAlert}</span>
          </div>
          <button onClick={() => setArchivedAlert(null)} className="text-purple-400 hover:text-purple-700 font-bold px-1">
            ✕
          </button>
        </div>
      )}

      {/* Toolbar: Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setTab('active')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              tab === 'active'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📂 Đang hoạt động ({activeCount})
          </button>
          <button
            onClick={() => setTab('archived')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              tab === 'archived'
                ? 'bg-white text-purple-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📦 Đã lưu trữ ({archivedCount})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              tab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({dossiers.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên hoặc nội dung hồ sơ..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-slate-100 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-700">
              <th className="py-3 px-3.5">Hồ sơ</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Ngày tạo</th>
              <th className="py-3 px-3.5 text-center whitespace-nowrap">Số văn bản</th>
              <th className="py-3 px-3.5">Hồ sơ con</th>
              <th className="py-3 px-3.5 text-center whitespace-nowrap">Trạng thái</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {filteredDossiers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                  Không tìm thấy hồ sơ nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredDossiers.map(dossier => {
                const count = docCounts[dossier.id] || 0
                const childDossiers = dossiers.filter(c => c.parentId === dossier.id)
                const isArchived = !!dossier.isArchived

                return (
                  <tr
                    key={dossier.id}
                    className={`hover:bg-blue-50/50 transition-colors group ${
                      isArchived ? 'bg-purple-50/30' : ''
                    }`}
                  >
                    {/* Dossier Name & Level */}
                    <td className="py-3 px-3.5 max-w-xs">
                      <div className="flex items-start gap-2">
                        <Folder className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isArchived ? 'text-purple-500' : 'text-blue-600 fill-blue-50'
                        }`} />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleDossierClick(dossier)}
                              className={`font-semibold text-xs hover:underline text-left truncate max-w-[220px] ${
                                isArchived ? 'text-purple-900 cursor-not-allowed opacity-80' : 'text-slate-800 hover:text-blue-600'
                              }`}
                              title={isArchived ? 'Hồ sơ đã lưu trữ (không thể mở trên thanh trái)' : `Bấm để mở hồ sơ "${dossier.name}"`}
                            >
                              {dossier.name}
                            </button>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              Cấp {dossier.level}
                            </span>
                          </div>
                          {dossier.description && (
                            <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5">
                              {dossier.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {formatDate(dossier.createdAt)}
                    </td>

                    {/* Document Count */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <FileText className="w-3 h-3" />
                        <span>{count} văn bản</span>
                      </span>
                    </td>

                    {/* Sub-dossiers */}
                    <td className="py-3 px-3.5">
                      {childDossiers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {childDossiers.map(child => {
                            const childCount = docCounts[child.id] || 0
                            return (
                              <button
                                key={child.id}
                                onClick={() => handleDossierClick(child)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 border border-slate-200 transition-colors"
                                title={`Mở hồ sơ con: ${child.name}`}
                              >
                                <Folder className="w-3 h-3 text-slate-500" />
                                <span className="truncate max-w-[120px]">{child.name}</span>
                                <span className="text-slate-400 font-mono">({childCount})</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Không có</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      {isArchived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          <Archive className="w-3 h-3" />
                          Đã lưu trữ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Đang hoạt động
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Add Sub-dossier */}
                        {perms.canCreateDossier && dossier.level < 3 && !isArchived && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onAddSubDossier(dossier)
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                            title="Thêm hồ sơ con vào hồ sơ này"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit */}
                        {perms.canEditDossier && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onEditDossier(dossier)
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                            title="Chỉnh sửa thông tin hồ sơ"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Archive / Unarchive */}
                        {perms.canEditDossier && (
                          <button
                            onClick={e => handleToggleArchive(dossier, e)}
                            disabled={archivingId === dossier.id}
                            className={`p-1.5 rounded-md transition-colors ${
                              isArchived
                                ? 'text-purple-700 hover:bg-purple-100'
                                : 'text-amber-700 hover:bg-amber-100'
                            }`}
                            title={isArchived ? 'Bỏ lưu trữ (Hiển thị lại trên thanh điều hướng)' : 'Lưu trữ hồ sơ này'}
                          >
                            {archivingId === dossier.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isArchived ? (
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Delete */}
                        {perms.canDeleteDossier && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onDeleteDossier(dossier)
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            title="Xóa hồ sơ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
