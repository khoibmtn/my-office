'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Folder, PlusSquare, MinusSquare, ChevronDown, ChevronRight, FolderSymlink, Users } from 'lucide-react'
import { useDossiers } from '@/hooks/useDossiers'
import { useDocuments } from '@/hooks/useDocuments'
import { useStaff } from '@/hooks/useStaff'
import { useRole } from '@/hooks/useRole'
import { useDossierUnread } from '@/hooks/useDossierUnread'
import type { Dossier } from '@/types'

interface DossierNavItemProps {
  active: boolean
}

export function DossierNavItem({ active }: DossierNavItemProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const urlActiveId = searchParams.get('id')
  // Optimistic selection: highlight immediately on click, before the URL/page catches up
  const [pendingId, setPendingId] = useState<string | null>(null)
  const activeId = pendingId ?? urlActiveId
  useEffect(() => {
    setPendingId(null)
  }, [urlActiveId])

  // Instant tooltip for truncated names (native `title` waits ~1s)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const showTooltip = useCallback((e: React.MouseEvent<HTMLElement>, text: string) => {
    const row = e.currentTarget
    const label = row.querySelector<HTMLElement>('[data-tree-label]')
    if (!label || label.scrollWidth <= label.clientWidth) return
    const rect = row.getBoundingClientRect()
    setTooltip({ text, x: rect.right + 8, y: rect.top + rect.height / 2 })
  }, [])
  const hideTooltip = useCallback(() => setTooltip(null), [])
  
  const { dossiers, loading } = useDossiers()
  const { documents } = useDocuments()
  const { staff: allStaff } = useStaff()
  const { staffId, isAdmin } = useRole()

  const [isOpen, setIsOpen] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Remember the last active dossier ID so we can restore it
  const lastActiveIdRef = useRef<string | null>(null)

  // Active non-archived dossiers
  const activeDossiers = useMemo(() => {
    return dossiers.filter(d => !d.isArchived)
  }, [dossiers])

  // Track unread comments for dossiers
  const { unreadMap, getSubtreeUnread, markAsRead } = useDossierUnread(activeDossiers)

  // Split into "My Dossiers" and "Shared with Me"
  const { myDossiers, sharedDossiers } = useMemo(() => {
    if (isAdmin) {
      // Admin sees all dossiers in My Dossiers
      return { myDossiers: activeDossiers, sharedDossiers: [] }
    }

    const my: Dossier[] = []
    const shared: Dossier[] = []

    // 1. My Dossiers: ONLY dossiers owned by this staff member
    activeDossiers.forEach(d => {
      if (staffId && d.ownerId === staffId) {
        my.push(d)
      }
    })

    // 2. Shared with me: directly shared or descendant of shared dossiers
    const sharedIdSet = new Set<string>()
    activeDossiers.forEach(d => {
      if (staffId && d.ownerId !== staffId && (d.sharedWith || []).includes(staffId)) {
        sharedIdSet.add(d.id)
      }
    })

    // Auto-inherit children of shared dossiers
    let added = true
    while (added) {
      added = false
      activeDossiers.forEach(d => {
        if (d.parentId && sharedIdSet.has(d.parentId) && !sharedIdSet.has(d.id)) {
          sharedIdSet.add(d.id)
          added = true
        }
      })
    }

    activeDossiers.forEach(d => {
      if (sharedIdSet.has(d.id)) {
        shared.push(d)
      }
    })

    return { myDossiers: my, sharedDossiers: shared }
  }, [activeDossiers, staffId, isAdmin])

  // Calculate document counts per dossier
  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!documents) return counts
    documents.forEach(d => {
      (d.dossierIds || []).forEach(did => {
        counts[did] = (counts[did] || 0) + 1
      })
    })
    return counts
  }, [documents])

  // Get owner display name
  const getOwnerDisplayName = useCallback((ownerId?: string | null) => {
    if (!ownerId || ownerId === 'admin' || ownerId === 'unknown') return 'Admin'
    const found = allStaff.find(s => s.id === ownerId)
    if (found) return found.shortName
    return 'Admin'
  }, [allStaff])

  // Get parent dossiers that have children
  const parentIdsWithChildren = useMemo(() => {
    return activeDossiers
      .filter(parent => activeDossiers.some(child => child.parentId === parent.id))
      .map(d => d.id)
  }, [activeDossiers])

  // Check if at least 1 folder is expanded
  const hasAnyExpanded = useMemo(() => {
    return parentIdsWithChildren.some(id => expandedIds.has(id))
  }, [parentIdsWithChildren, expandedIds])

  // Auto-expand the ancestors of the active dossier — once per selection change, so a Firestore
  // snapshot does not re-open a folder the user just collapsed. The active folder itself is
  // opened by handleNodeClick (or here when arriving via URL).
  const expandedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeId || activeDossiers.length === 0) return
    lastActiveIdRef.current = activeId
    if (expandedForRef.current === activeId) return
    expandedForRef.current = activeId
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.add(activeId)
      let curr: string | null = activeId
      while (curr) {
        const d = activeDossiers.find(item => item.id === curr)
        if (d && d.parentId) {
          next.add(d.parentId)
          curr = d.parentId
        } else {
          break
        }
      }
      return next
    })
  }, [activeId, activeDossiers])

  // Auto-collapse when navigating away from /dossiers
  // But preserve expandedIds so they restore when re-opening
  const prevPathnameRef = useRef(pathname)
  useEffect(() => {
    const wasDossiers = prevPathnameRef.current.startsWith('/dossiers')
    const isDossiers = pathname.startsWith('/dossiers')
    prevPathnameRef.current = pathname

    if (wasDossiers && !isDossiers) {
      // Navigated away — collapse tree but keep expandedIds
      setIsOpen(false)
    }
  }, [pathname])

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleExpandAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isOpen) setIsOpen(true)
    if (hasAnyExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(parentIdsWithChildren))
    }
  }, [isOpen, hasAnyExpanded, parentIdsWithChildren])

  const handleRowClick = () => {
    const isDossiers = pathname.startsWith('/dossiers')
    if (isDossiers) {
      // Already on dossiers — toggle tree and navigate to dossiers root
      setIsOpen(prev => !prev)
      router.push('/dossiers')
    } else {
      // Coming from another page — open tree and navigate to last position
      setIsOpen(true)
      if (lastActiveIdRef.current) {
        router.push(`/dossiers?id=${lastActiveIdRef.current}`)
      } else {
        router.push('/dossiers')
      }
    }
  }

  const handleToggleTreeOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(prev => !prev)
  }

  const handleSelect = (id: string | null) => {
    const url = id ? `/dossiers?id=${id}` : '/dossiers'
    if (id) {
      setPendingId(id)
      markAsRead(id)
    }
    if (pathname.startsWith('/dossiers')) {
      // Same page, only the query changes: update the URL client-side (Next syncs
      // useSearchParams with history.pushState) — no server round-trip
      window.history.pushState(null, '', url)
    } else {
      router.push(url)
    }
  }

  // Finder/Explorer behaviour: clicking a folder selects it and opens it;
  // clicking the already-selected folder toggles it open/closed.
  const handleNodeClick = (dossier: Dossier, hasChildren: boolean) => {
    if (hasChildren) {
      const isSelected = activeId === dossier.id
      setExpandedIds(prev => {
        const next = new Set(prev)
        if (isSelected && next.has(dossier.id)) next.delete(dossier.id)
        else next.add(dossier.id)
        return next
      })
    }
    if (activeId !== dossier.id) handleSelect(dossier.id)
  }

  // Recursive Tree Node renderer for My Dossiers
  const renderDossierNode = (dossier: Dossier, level: number = 0, isSharedList: boolean = false) => {
    const list = isSharedList ? sharedDossiers : myDossiers
    const children = list
      .filter(child => child.parentId === dossier.id)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(dossier.id)
    const isActive = activeId === dossier.id
    const count = docCounts[dossier.id] || 0
    const isShared = isSharedList || (dossier.sharedWith && dossier.sharedWith.length > 0)
    const displayName = isSharedList
      ? `${dossier.name} (${getOwnerDisplayName(dossier.ownerId)})`
      : dossier.name

    // If expanded, show direct unread count; if collapsed, aggregate entire subtree unread
    const unreadCount = isExpanded ? (unreadMap[dossier.id] || 0) : getSubtreeUnread(dossier.id)

    const tooltipText = `${displayName} · ${count} văn bản${unreadCount > 0 ? ` · ${unreadCount} tin nhắn mới` : ''}`

    return (
      <div key={dossier.id} className="flex flex-col" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
        <div
          onClick={() => handleNodeClick(dossier, hasChildren)}
          onMouseEnter={e => showTooltip(e, tooltipText)}
          onMouseLeave={hideTooltip}
          className={`
            group flex items-center gap-1 h-7 max-lg:h-9 pr-1.5 rounded text-[13px] leading-none cursor-pointer select-none
            ${isActive
              ? 'bg-blue-100/80 text-blue-800 font-semibold'
              : 'text-slate-700 hover:bg-slate-100'}
          `}
          // 16px per level: every child's toggle slot (and folder icon) sits one step right of its parent's
          style={{ paddingLeft: `${4 + level * 16}px` }}
        >
          {/* Fixed-width toggle slot (also for leaves) so icons of the same level line up */}
          <span className="w-4 max-lg:w-7 h-full shrink-0 inline-flex items-center justify-center">
            {hasChildren && (
              <button
                type="button"
                onClick={e => toggleExpand(dossier.id, e)}
                className="inline-flex items-center justify-center w-4 h-4 max-lg:w-7 max-lg:h-7 rounded-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                aria-label={isExpanded ? 'Thu gọn' : 'Bung mở'}
              >
                {isExpanded ? (
                  <MinusSquare className="w-3.5 h-3.5 max-lg:w-4 max-lg:h-4" />
                ) : (
                  <PlusSquare className="w-3.5 h-3.5 max-lg:w-4 max-lg:h-4 text-blue-500" />
                )}
              </button>
            )}
          </span>

          {isShared ? (
            <FolderSymlink
              className="w-4 h-4 shrink-0"
              style={{ color: dossier.color || '#3b82f6' }}
            />
          ) : (
            <Folder
              className="w-4 h-4 shrink-0"
              style={{ color: dossier.color || '#3b82f6', fill: dossier.color || '#3b82f6' }}
            />
          )}
          <span data-tree-label className="truncate flex-1 min-w-0 ml-0.5">{displayName}</span>

          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shrink-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className={`text-[10px] font-mono tabular-nums shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
            {count}
          </span>
        </div>

        {/* Child nodes */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col" role="group">
            {children.map(child => renderDossierNode(child, level + 1, isSharedList))}
          </div>
        )}
      </div>
    )
  }

  const rootMyDossiers = useMemo(() => {
    return myDossiers
      .filter(d => !d.parentId)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))
  }, [myDossiers])

  const rootSharedDossiers = useMemo(() => {
    return sharedDossiers
      .filter(d => !d.parentId || !sharedDossiers.some(p => p.id === d.parentId))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [sharedDossiers])

  const totalUnreadAll = useMemo(() => {
    return Object.values(unreadMap).reduce((sum, v) => sum + v, 0)
  }, [unreadMap])

  return (
    <div className="flex flex-col">
      {/* Menu item row */}
      <div
        onClick={handleRowClick}
        className={`flex items-center gap-2.5 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 select-none cursor-pointer group ${
          active
            ? 'bg-slate-100 text-slate-900 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Folder className="h-[18px] w-[18px] shrink-0 text-blue-600" />
        
        {/* Label + [+] / [-] button */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="truncate">Quản lý Hồ sơ</span>
          {!isOpen && totalUnreadAll > 0 && (
            <span
              title={`${totalUnreadAll} tin nhắn mới chưa đọc`}
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shrink-0 shadow-sm"
            >
              {totalUnreadAll > 99 ? '99+' : totalUnreadAll}
            </span>
          )}
          {isOpen && parentIdsWithChildren.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              title={hasAnyExpanded ? "Thu gọn tất cả thư mục" : "Bung tất cả thư mục"}
              className="p-0.5 max-lg:p-2 max-lg:min-w-[36px] max-lg:min-h-[36px] hover:bg-slate-200/80 rounded transition-colors text-slate-400 hover:text-slate-700 inline-flex items-center justify-center shrink-0"
            >
              {hasAnyExpanded ? (
                <MinusSquare className="w-4 h-4 text-slate-500 hover:text-slate-800" />
              ) : (
                <PlusSquare className="w-4 h-4 text-blue-500 hover:text-blue-700" />
              )}
            </button>
          )}
        </div>

        {/* Tree toggle chevron */}
        <button
          type="button"
          onClick={handleToggleTreeOpen}
          className="p-0.5 max-lg:p-2 max-lg:min-w-[36px] max-lg:min-h-[36px] inline-flex items-center justify-center hover:bg-slate-200/60 rounded transition-colors shrink-0 text-slate-400 hover:text-slate-700"
          title={isOpen ? "Ẩn cây thư mục" : "Hiện cây thư mục"}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>
      </div>

      {/* Simplified tree list below */}
      {isOpen && (
        <div className="pl-1 pr-0.5 mt-0.5 mb-1 flex flex-col" role="tree" onScroll={hideTooltip}>
          {loading ? (
            <div className="flex flex-col gap-1.5 mt-1 px-2">
              <div className="h-3.5 bg-slate-200 animate-pulse rounded w-3/4" />
              <div className="h-3.5 bg-slate-200 animate-pulse rounded w-1/2 ml-3" />
              <div className="h-3.5 bg-slate-200 animate-pulse rounded w-2/3 ml-3" />
            </div>
          ) : (
            <>
              {/* My Dossiers */}
              {rootMyDossiers.map(d => renderDossierNode(d, 0, false))}

              {/* Shared With Me Section */}
              {rootSharedDossiers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/80 flex flex-col">
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <FolderSymlink className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">Chia sẻ với tôi</span>
                  </div>
                  {rootSharedDossiers.map(d => renderDossierNode(d, 0, true))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tooltip && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="fixed z-[100] -translate-y-1/2 max-w-[360px] px-2 py-1 rounded-md bg-slate-900 text-white text-xs leading-snug shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>,
        document.body
      )}
    </div>
  )
}

// Keep DossierTreeNav export for compatibility if needed
export function DossierTreeNav({ isOpen = true }: { isOpen?: boolean }) {
  if (!isOpen) return null
  return <DossierNavItem active={false} />
}

