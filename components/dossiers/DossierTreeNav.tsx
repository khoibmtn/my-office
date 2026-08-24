'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const activeId = searchParams.get('id')
  
  const { dossiers, loading } = useDossiers()
  const { documents } = useDocuments()
  const { staff: allStaff } = useStaff()
  const { staffId, isAdmin } = useRole()

  const [isOpen, setIsOpen] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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

  // Auto-expand parents of active dossier
  useEffect(() => {
    if (!activeId || activeDossiers.length === 0) return
    const newExpanded = new Set(expandedIds)
    let curr: string | null = activeId
    
    newExpanded.add(activeId)

    while (curr) {
      const d = activeDossiers.find(item => item.id === curr)
      if (d && d.parentId) {
        newExpanded.add(d.parentId)
        curr = d.parentId
      } else {
        break
      }
    }
    setExpandedIds(newExpanded)
  }, [activeId, activeDossiers])

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
    router.push('/dossiers')
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleToggleTreeOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(prev => !prev)
  }

  const handleSelect = (id: string | null) => {
    if (id) {
      markAsRead(id)
      router.push(`/dossiers?id=${id}`)
    } else {
      router.push('/dossiers')
    }
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

    return (
      <div key={dossier.id} className="flex flex-col">
        <div
          onClick={() => handleSelect(dossier.id)}
          title={`${displayName} (${count} văn bản)${unreadCount > 0 ? ` • ${unreadCount} tin nhắn mới` : ''}`}
          className={`
            group flex items-center justify-between py-1 px-2 rounded-md text-xs cursor-pointer select-none transition-colors
            ${isActive
              ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 pl-1.5'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
          `}
          style={{ paddingLeft: level > 0 ? `${level * 12 + 8}px` : undefined }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={e => toggleExpand(dossier.id, e)}
                className="p-0.5 hover:bg-slate-200 rounded transition-colors text-slate-500 shrink-0"
                title={isExpanded ? "Thu gọn" : "Bung mở"}
              >
                {isExpanded ? (
                  <MinusSquare className="w-3 h-3 text-slate-500" />
                ) : (
                  <PlusSquare className="w-3 h-3 text-blue-500" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {isShared ? (
              <FolderSymlink
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: dossier.color || '#3b82f6' }}
              />
            ) : (
              <Folder
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: dossier.color || '#3b82f6', fill: dossier.color || '#3b82f6' }}
              />
            )}
            <span className="truncate">{displayName}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Telegram / Zalo style Red Unread Pill Badge */}
            {unreadCount > 0 && (
              <span
                title={`${unreadCount} tin nhắn mới chưa đọc`}
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shrink-0 shadow-2xs animate-in zoom-in-50 duration-150"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span title={`${count} văn bản`} className={`text-[10px] font-mono px-1 rounded ${isActive ? 'text-blue-600 bg-blue-100' : 'text-slate-400 group-hover:text-slate-600'}`}>
              ({count})
            </span>
          </div>
        </div>

        {/* Render child nodes recursively */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col mt-0.5">
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
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 select-none cursor-pointer group ${
          active
            ? 'bg-slate-100 text-slate-900 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Folder className="h-4.5 w-4.5 shrink-0 text-blue-600" />
        
        {/* Label + [+] / [-] button */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="truncate">Quản lý Hồ sơ</span>
          {!isOpen && totalUnreadAll > 0 && (
            <span
              title={`${totalUnreadAll} tin nhắn mới chưa đọc`}
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shrink-0 shadow-2xs animate-in zoom-in-50 duration-150"
            >
              {totalUnreadAll > 99 ? '99+' : totalUnreadAll}
            </span>
          )}
          {isOpen && parentIdsWithChildren.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              title={hasAnyExpanded ? "Thu gọn tất cả thư mục" : "Bung tất cả thư mục"}
              className="p-0.5 hover:bg-slate-200/80 rounded transition-colors text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0"
            >
              {hasAnyExpanded ? (
                <MinusSquare className="w-3.5 h-3.5 text-slate-500 hover:text-slate-800" />
              ) : (
                <PlusSquare className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
              )}
            </button>
          )}
        </div>

        {/* Tree toggle chevron */}
        <button
          type="button"
          onClick={handleToggleTreeOpen}
          className="p-0.5 hover:bg-slate-200/60 rounded transition-colors shrink-0 text-slate-400 hover:text-slate-700"
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
        <div className="pl-2 pr-0.5 mt-0.5 mb-1 flex flex-col gap-0.5">
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
                <div className="mt-2 pt-2 border-t border-slate-200/80 flex flex-col gap-0.5">
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
    </div>
  )
}

// Keep DossierTreeNav export for compatibility if needed
export function DossierTreeNav({ isOpen = true }: { isOpen?: boolean }) {
  if (!isOpen) return null
  return <DossierNavItem active={false} />
}

