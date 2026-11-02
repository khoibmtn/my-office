'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Folder, FolderPlus, Pencil, Trash2, Archive, ArchiveRestore,
  Search, FileText, AlertCircle, Loader2, X, PlusSquare, MinusSquare, ArrowRightLeft,
  ChevronUp, ChevronDown, FolderSymlink, UserCheck, Share2, Users
} from 'lucide-react'
import type { Dossier, Document, StaffMember } from '@/types'
import { toggleArchiveDossier, reorderLevel1Dossiers } from '@/lib/dossiers'
import { useRole } from '@/hooks/useRole'
import { useDossierUnread } from '@/hooks/useDossierUnread'
import { useOrganization } from '@/hooks/useOrganization'
import { useStaff } from '@/hooks/useStaff'
import { MoveDossierModal } from './MoveDossierModal'

interface DossierTableProps {
  dossiers: Dossier[]
  documents: Document[]
  loading?: boolean
  onAddSubDossier: (parent: Dossier) => void
  onEditDossier: (dossier: Dossier) => void
  onDeleteDossier: (dossier: Dossier) => void
  onTransferDossier?: (dossier: Dossier) => void
  onShareDossier?: (dossier: Dossier) => void
  perms: {
    canCreateDossier?: boolean
    canTransferDossier?: boolean
  }
}

// Ordered fuzzy match helper
function fuzzyMatchOrdered(text: string, query: string): boolean {
  if (!query.trim() || !text) return false
  const t = text.toLowerCase()
  const q = query.trim().toLowerCase()

  // 1. Substring match
  if (t.includes(q)) return true

  // 2. All words match
  const words = q.split(/\s+/).filter(Boolean)
  if (words.every(w => t.includes(w))) return true

  // 3. Ordered sequential character match (e.g., "ksk" -> "Khám sức khỏe")
  let qIdx = 0
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++
    }
  }
  return qIdx === q.length
}

// Highlight matching search words/query
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return <>{text}</>
  const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi')
  const parts = String(text).split(regex)
  return (
    <>
      {parts.map((part, i) =>
        words.some(w => w.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5 font-bold">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function DossierTable({
  dossiers,
  documents,
  loading = false,
  onAddSubDossier,
  onEditDossier,
  onDeleteDossier,
  onTransferDossier,
  onShareDossier,
  perms,
}: DossierTableProps) {
  const router = useRouter()
  const { staffId, isAdmin } = useRole()
  const { hasPermission, currentStaff } = useOrganization()
  const { staff: staffList } = useStaff()
  const { unreadMap, getSubtreeUnread, markAsRead } = useDossierUnread(dossiers)

  // Current user's department IDs
  const myDeptIds = currentStaff?.departmentIds ||
    (currentStaff?.primaryDepartmentId ? [currentStaff.primaryDepartmentId] : [])

  // Check if a dossier's owner belongs to the same department as current user
  const isDossierInMyDepartment = (dossier: Dossier): boolean => {
    const owner = staffList.find((s: StaffMember) => s.id === dossier.ownerId)
    if (!owner) return false
    const ownerDepts = owner.departmentIds ||
      (owner.primaryDepartmentId ? [owner.primaryDepartmentId] : [])
    return ownerDepts.some(d => myDeptIds.includes(d))
  }

  // Per-dossier permission helpers
  const canEditThisDossier = (dossier: Dossier): boolean => {
    if (isAdmin) return true
    if (hasPermission('dossier:edit_all')) {
      // Scope: chỉ trong phạm vi khoa (trừ admin đã return ở trên)
      return isDossierInMyDepartment(dossier) ||
             dossier.createdBy === staffId ||
             dossier.ownerId === staffId
    }
    if (hasPermission('dossier:edit_own')) {
      return dossier.createdBy === staffId || dossier.ownerId === staffId
    }
    return false
  }

  const canDeleteThisDossier = (dossier: Dossier): boolean => {
    if (isAdmin && (!dossier.sharedWith?.length)) return true
    // Block delete if currently shared with others
    if (dossier.sharedWith && dossier.sharedWith.length > 0) return false
    if (hasPermission('dossier:delete_all')) {
      // Scope: chỉ trong phạm vi khoa
      return isDossierInMyDepartment(dossier) ||
             dossier.createdBy === staffId ||
             dossier.ownerId === staffId
    }
    if (hasPermission('dossier:delete_own')) {
      return dossier.createdBy === staffId || dossier.ownerId === staffId
    }
    return false
  }

  const [tab, setTab] = useState<'active' | 'archived' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('myoffice_dossierTable_tab')
      if (saved === 'active' || saved === 'archived' || saved === 'all') return saved
    }
    return 'active'
  })

  const handleSetTab = (t: 'active' | 'archived' | 'all') => {
    setTab(t)
    if (typeof window !== 'undefined') {
      localStorage.setItem('myoffice_dossierTable_tab', t)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('myoffice_dossierTable_tab')
    if (saved === 'active' || saved === 'archived' || saved === 'all') {
      setTab(saved)
    }
  }, [])

  const [search, setSearch] = useState('')
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archivedAlert, setArchivedAlert] = useState<string | null>(null)
  const [movingDossier, setMovingDossier] = useState<Dossier | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  // Active Level 1 dossiers sorted by order for checking first/last position
  const activeRootDossiers = useMemo(() => {
    return dossiers
      .filter(d => !d.parentId && !d.isArchived)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))
  }, [dossiers])

  const handleReorder = async (dossierId: string, direction: 'up' | 'down') => {
    setReorderingId(dossierId)
    try {
      await reorderLevel1Dossiers(dossierId, direction, staffId || 'unknown', dossiers)
    } catch (err) {
      console.error(err)
    } finally {
      setReorderingId(null)
    }
  }

  // Expand/collapse state for tree nodes in table (all parent dossiers expanded by default)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(dossiers.map(d => d.id))
  })

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  // Build depth-first tree structure with Vietnamese A-Z sorting & fuzzy search matching
  const treeOrderedDossiers = useMemo(() => {
    const query = search.trim().toLowerCase()

    // Base pool filtered by tab
    const pool = dossiers.filter(d => {
      if (tab === 'active' && d.isArchived) return false
      if (tab === 'archived' && !d.isArchived) return false
      return true
    })

    // Check if node or any of its descendants match search query
    function matchesOrHasMatchingDescendant(d: Dossier): boolean {
      if (!query) return true
      if (fuzzyMatchOrdered(d.name, query) || fuzzyMatchOrdered(d.description || '', query)) return true
      const children = pool.filter(c => c.parentId === d.id)
      return children.some(c => matchesOrHasMatchingDescendant(c))
    }

    const result: Dossier[] = []
    const rootNodes = pool.filter(d => (!d.parentId || !pool.some(p => p.id === d.parentId)) && matchesOrHasMatchingDescendant(d))
    rootNodes.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))

    function traverse(node: Dossier) {
      result.push(node)
      
      // If NOT searching, respect user expand/collapse toggle
      if (!query && !expandedIds.has(node.id)) return

      const children = pool.filter(c => c.parentId === node.id && matchesOrHasMatchingDescendant(c))
      children.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
      children.forEach(child => traverse(child))
    }

    rootNodes.forEach(root => traverse(root))
    return result
  }, [dossiers, tab, search, expandedIds])

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
    markAsRead(dossier.id)
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
    <div className="flex flex-col gap-4 min-w-0 max-w-full">
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs min-w-0 max-w-full">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold w-full sm:w-auto max-w-full overflow-x-auto flex-wrap sm:flex-nowrap">
          <button
            onClick={() => handleSetTab('active')}
            className={`px-3 py-1.5 min-h-[36px] sm:min-h-0 rounded-md transition-all ${
              tab === 'active'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📂 Đang hoạt động ({activeCount})
          </button>
          <button
            onClick={() => handleSetTab('archived')}
            className={`px-3 py-1.5 min-h-[36px] sm:min-h-0 rounded-md transition-all ${
              tab === 'archived'
                ? 'bg-white text-purple-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📦 Đã lưu trữ ({archivedCount})
          </button>
          <button
            onClick={() => handleSetTab('all')}
            className={`px-3 py-1.5 min-h-[36px] sm:min-h-0 rounded-md transition-all ${
              tab === 'all'
                ? 'bg-white text-slate-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({dossiers.length})
          </button>
        </div>

        {/* Search Bar with Fuzzy matching, ESC key listener, and X clear button */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('')
            }}
            placeholder="Tìm tên hoặc nội dung hồ sơ..."
            className="w-full pl-9 pr-8 py-1.5 border border-slate-200 rounded-lg text-base md:text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
              title="Xóa nhanh tìm kiếm (ESC)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Card List (< sm) */}
      <div className="sm:hidden flex flex-col gap-2.5 min-w-0 max-w-full">
        {loading ? (
          <div className="py-10 px-4 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Đang tải danh sách hồ sơ...</span>
          </div>
        ) : treeOrderedDossiers.length === 0 ? (
          <div className="py-10 px-4 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
            Không tìm thấy hồ sơ nào phù hợp.
          </div>
        ) : (
          treeOrderedDossiers.map(dossier => {
            const count = docCounts[dossier.id] || 0
            const hasChildren = dossiers.some(c => c.parentId === dossier.id)
            const isExpanded = expandedIds.has(dossier.id)
            const isArchived = !!dossier.isArchived
            const unreadCount = isExpanded ? (unreadMap[dossier.id] || 0) : getSubtreeUnread(dossier.id)
            const rootIndex = activeRootDossiers.findIndex(r => r.id === dossier.id)
            const isFirstRoot = rootIndex === 0
            const isLastRoot = rootIndex === activeRootDossiers.length - 1
            const isShared = (dossier.sharedWith || []).length > 0
            const folderColor = isArchived ? '#a855f7' : (dossier.color || '#3b82f6')

            return (
              <div
                key={dossier.id}
                className={`rounded-xl border p-3 bg-white shadow-2xs transition-colors min-w-0 max-w-full ${
                  isArchived ? 'border-purple-200 bg-purple-50/20' : 'border-slate-200'
                } ${dossier.level === 2 ? 'ml-3' : dossier.level === 3 ? 'ml-6' : ''}`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {hasChildren ? (
                    <button
                      onClick={e => toggleExpand(dossier.id, e)}
                      className="min-w-[40px] min-h-[40px] -ml-1 -mt-1 inline-flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0 transition-colors"
                      title={isExpanded ? 'Thu gọn hồ sơ con' : 'Mở rộng hồ sơ con'}
                    >
                      {isExpanded ? (
                        <MinusSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <PlusSquare className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  ) : null}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isShared ? (
                        <FolderSymlink className="w-4 h-4 shrink-0" style={{ color: folderColor }} />
                      ) : (
                        <Folder className="w-4 h-4 shrink-0" style={{ color: folderColor, fill: folderColor }} />
                      )}
                      <button
                        onClick={() => handleDossierClick(dossier)}
                        className={`font-semibold text-sm hover:underline text-left truncate max-w-full ${
                          isArchived ? 'text-purple-900 opacity-80' : 'text-slate-800 hover:text-blue-600'
                        }`}
                      >
                        <Highlight text={dossier.name} query={search} />
                      </button>
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shrink-0">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                        dossier.level === 1
                          ? 'bg-blue-100 text-blue-800 border border-blue-200 font-bold'
                          : dossier.level === 2
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        Cấp {dossier.level}
                      </span>
                      {dossier.sharedWith && dossier.sharedWith.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                          <Users className="w-3 h-3" />
                          <span>{dossier.sharedWith.length}</span>
                        </span>
                      )}
                    </div>

                    {dossier.description && (
                      <p className="text-xs text-slate-500 italic line-clamp-2 mt-1">
                        <Highlight text={dossier.description} query={search} />
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mt-2 text-[11px] text-slate-500">
                      <span className="font-mono">{formatDate(dossier.createdAt)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                        count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <FileText className="w-3 h-3" />
                        <span>{count} văn bản</span>
                      </span>
                      {isArchived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          <Archive className="w-3 h-3" />
                          Đã lưu trữ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Đang hoạt động
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Card Actions */}
                <div className="flex items-center justify-end gap-1 flex-wrap mt-2 pt-2 border-t border-slate-100">
                  {canEditThisDossier(dossier) && dossier.level === 1 && !isArchived && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleReorder(dossier.id, 'up')
                        }}
                        disabled={isFirstRoot || reorderingId === dossier.id}
                        className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
                        title="Chuyển vị trí lên trên"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleReorder(dossier.id, 'down')
                        }}
                        disabled={isLastRoot || reorderingId === dossier.id}
                        className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
                        title="Chuyển vị trí xuống dưới"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {perms.canCreateDossier && dossier.level < 3 && !isArchived && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onAddSubDossier(dossier)
                      }}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Thêm hồ sơ con"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  )}
                  {canEditThisDossier(dossier) && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onEditDossier(dossier)
                      }}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Chỉnh sửa thông tin hồ sơ"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canEditThisDossier(dossier) && !isArchived && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setMovingDossier(dossier)
                      }}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-lg"
                      title="Di chuyển hồ sơ"
                    >
                      <FolderSymlink className="w-4 h-4" />
                    </button>
                  )}
                  {onShareDossier && canEditThisDossier(dossier) && !isArchived && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onShareDossier(dossier)
                      }}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-teal-600 hover:bg-teal-50 rounded-lg"
                      title="Chia sẻ hồ sơ"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                  {onTransferDossier && perms.canTransferDossier && !isArchived && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onTransferDossier(dossier)
                      }}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      title="Chuyển quyền sở hữu"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                  {canEditThisDossier(dossier) && (
                    <button
                      onClick={e => handleToggleArchive(dossier, e)}
                      disabled={archivingId === dossier.id}
                      className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg ${
                        isArchived ? 'text-purple-700 hover:bg-purple-50' : 'text-amber-700 hover:bg-amber-50'
                      }`}
                      title={isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ hồ sơ'}
                    >
                      {archivingId === dossier.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isArchived ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {canDeleteThisDossier(dossier) && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onDeleteDossier(dossier)
                      }}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg"
                      title="Xóa hồ sơ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Main Tree Table (>= sm) */}
      <div className="hidden sm:block overflow-x-auto max-w-full rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-slate-100 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-700">
              <th className="py-3 px-3.5">Cấu trúc cây Hồ sơ (A-Z)</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Ngày tạo</th>
              <th className="py-3 px-3.5 text-center whitespace-nowrap">Số văn bản</th>
              <th className="py-3 px-3.5 text-center whitespace-nowrap">Trạng thái</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Đang tải danh sách hồ sơ...</span>
                  </div>
                </td>
              </tr>
            ) : treeOrderedDossiers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                  Không tìm thấy hồ sơ nào phù hợp.
                </td>
              </tr>
            ) : (
              treeOrderedDossiers.map(dossier => {
                const count = docCounts[dossier.id] || 0
                const hasChildren = dossiers.some(c => c.parentId === dossier.id)
                const isExpanded = expandedIds.has(dossier.id)
                const isArchived = !!dossier.isArchived
                const unreadCount = isExpanded ? (unreadMap[dossier.id] || 0) : getSubtreeUnread(dossier.id)

                const rootIndex = activeRootDossiers.findIndex(r => r.id === dossier.id)
                const isFirstRoot = rootIndex === 0
                const isLastRoot = rootIndex === activeRootDossiers.length - 1

                return (
                  <tr
                    key={dossier.id}
                    className={`hover:bg-blue-50/50 transition-colors group ${
                      isArchived ? 'bg-purple-50/30' : dossier.level === 1 ? 'bg-slate-50/40 font-medium' : ''
                    }`}
                  >
                    {/* Tree Hierarchy Dossier Name with [+] [-] expand toggle & Highlight */}
                    <td className="py-3 px-3.5 max-w-xs">
                      <div
                        className="flex items-start gap-1.5"
                        style={{ paddingLeft: `${(dossier.level - 1) * 20}px` }}
                      >
                        {/* [+] [-] Expand / Collapse Toggle Button */}
                        {hasChildren ? (
                          <button
                            onClick={e => toggleExpand(dossier.id, e)}
                            className="p-0.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded shrink-0 mt-0.5 transition-colors"
                            title={isExpanded ? 'Thu gọn hồ sơ con' : 'Mở rộng hồ sơ con'}
                          >
                            {isExpanded ? (
                              <MinusSquare className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </button>
                        ) : dossier.level > 1 ? (
                          <span className="text-slate-300 font-mono text-xs select-none shrink-0 mt-0.5 font-bold pl-1">
                            └─
                          </span>
                        ) : (
                          <span className="w-4 h-4 shrink-0" />
                        )}

                        {(() => {
                          const isShared = (dossier.sharedWith || []).length > 0
                          const folderColor = isArchived ? '#a855f7' : (dossier.color || '#3b82f6')
                          if (isShared) {
                            return (
                              <FolderSymlink
                                className="w-4 h-4 shrink-0 mt-0.5"
                                style={{ color: folderColor }}
                              />
                            )
                          }
                          return (
                            <Folder
                              className="w-4 h-4 shrink-0 mt-0.5"
                              style={{ color: folderColor, fill: folderColor }}
                            />
                          )
                        })()}

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleDossierClick(dossier)}
                              className={`font-semibold text-xs hover:underline text-left truncate max-w-[220px] ${
                                isArchived ? 'text-purple-900 cursor-not-allowed opacity-80' : 'text-slate-800 hover:text-blue-600'
                              }`}
                              title={isArchived ? 'Hồ sơ đã lưu trữ (không thể mở trên thanh trái)' : `Bấm để mở hồ sơ "${dossier.name}"`}
                            >
                              <Highlight text={dossier.name} query={search} />
                            </button>
                            {unreadCount > 0 && (
                              <span
                                title={`${unreadCount} tin nhắn mới chưa đọc`}
                                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shrink-0 shadow-2xs animate-in zoom-in-50 duration-150"
                              >
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                              dossier.level === 1
                                ? 'bg-blue-100 text-blue-800 border border-blue-200 font-bold'
                                : dossier.level === 2
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}>
                              Cấp {dossier.level}
                            </span>
                            {dossier.sharedWith && dossier.sharedWith.length > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-700 border border-teal-200 font-semibold"
                                title={`Đã chia sẻ với ${dossier.sharedWith.length} cán bộ`}
                              >
                                <Users className="w-3 h-3" />
                                <span>{dossier.sharedWith.length}</span>
                              </span>
                            )}
                          </div>
                          {dossier.description && (
                            <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5">
                              <Highlight text={dossier.description} query={search} />
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
                        {/* Up / Down Reorder for Level 1 Dossiers */}
                        {canEditThisDossier(dossier) && dossier.level === 1 && !isArchived && (
                          <div className="inline-flex items-center gap-0.5 border-r pr-1.5 mr-1 border-slate-200">
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                handleReorder(dossier.id, 'up')
                              }}
                              disabled={isFirstRoot || reorderingId === dossier.id}
                              className={`p-1 rounded transition-colors ${
                                isFirstRoot || reorderingId === dossier.id
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer'
                              }`}
                              title={isFirstRoot ? 'Hồ sơ đã ở vị trí đầu tiên' : 'Chuyển vị trí lên trên'}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={e => {
                                e.stopPropagation()
                                handleReorder(dossier.id, 'down')
                              }}
                              disabled={isLastRoot || reorderingId === dossier.id}
                              className={`p-1 rounded transition-colors ${
                                isLastRoot || reorderingId === dossier.id
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer'
                              }`}
                              title={isLastRoot ? 'Hồ sơ đã ở vị trí cuối cùng' : 'Chuyển vị trí xuống dưới'}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
                        {canEditThisDossier(dossier) && (
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

                        {/* Move Dossier Location */}
                        {canEditThisDossier(dossier) && !isArchived && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setMovingDossier(dossier)
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
                            title="Di chuyển hồ sơ này sang vị trí thư mục khác"
                          >
                            <FolderSymlink className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Share Dossier */}
                        {onShareDossier && canEditThisDossier(dossier) && !isArchived && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onShareDossier(dossier)
                            }}
                            className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-md transition-colors"
                            title="Chia sẻ hồ sơ này cho cán bộ khác"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Transfer Ownership */}
                        {onTransferDossier && perms.canTransferDossier && !isArchived && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onTransferDossier(dossier)
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
                            title="Chuyển quyền sở hữu hồ sơ này cho cán bộ khác"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Archive / Unarchive */}
                        {canEditThisDossier(dossier) && (
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
                        {canDeleteThisDossier(dossier) && (
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
                        {/* Show disabled delete with tooltip if shared */}
                        {!canDeleteThisDossier(dossier) && (dossier.createdBy === staffId || dossier.ownerId === staffId || isAdmin) && dossier.sharedWith && dossier.sharedWith.length > 0 && (
                          <button
                            disabled
                            className="p-1.5 text-gray-300 cursor-not-allowed rounded-md"
                            title={`Không thể xóa — đang chia sẻ với ${dossier.sharedWith.length} người`}
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

      {/* Move Dossier Modal */}
      <MoveDossierModal
        open={!!movingDossier}
        onOpenChange={open => !open && setMovingDossier(null)}
        movingDossier={movingDossier}
        allDossiers={dossiers}
        actorId={staffId || 'unknown'}
      />
    </div>
  )
}
