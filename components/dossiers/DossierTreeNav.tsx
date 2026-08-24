'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Folder, PlusSquare, MinusSquare } from 'lucide-react'
import { useDossiers } from '@/hooks/useDossiers'
import { useDocuments } from '@/hooks/useDocuments'
import type { Dossier } from '@/types'

interface DossierTreeNavProps {
  isOpen?: boolean
}

export function DossierTreeNav({ isOpen = true }: DossierTreeNavProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeId = searchParams.get('id')
  
  const { dossiers, loading } = useDossiers()
  const { documents } = useDocuments()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Filter out archived dossiers: only active dossiers are shown in left panel
  const activeDossiers = useMemo(() => {
    return dossiers.filter(d => !d.isArchived)
  }, [dossiers])

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

  // Auto-expand parents of active dossier
  useEffect(() => {
    if (!activeId || activeDossiers.length === 0) return
    const newExpanded = new Set(expandedIds)
    let curr: string | null = activeId
    
    // Always expand active dossier itself if it has children
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

  const toggleExpand = (id: string, e: React.MouseEvent) => {
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
  }

  const handleExpandAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const allParentIds = activeDossiers
      .filter(parent => activeDossiers.some(child => child.parentId === parent.id))
      .map(d => d.id)
    setExpandedIds(new Set(allParentIds))
  }

  const handleCollapseAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setExpandedIds(new Set())
  }

  const handleSelect = (id: string | null) => {
    if (id) {
      router.push(`/dossiers?id=${id}`)
    } else {
      router.push('/dossiers')
    }
  }

  // Recursive Tree Node renderer
  const renderDossierNode = (dossier: Dossier, level: number = 0) => {
    const children = activeDossiers
      .filter(child => child.parentId === dossier.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(dossier.id)
    const isActive = activeId === dossier.id
    const count = docCounts[dossier.id] || 0

    return (
      <div key={dossier.id} className="flex flex-col">
        <div
          onClick={() => handleSelect(dossier.id)}
          title={`${dossier.name} (${count} văn bản)`}
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
                onClick={e => toggleExpand(dossier.id, e)}
                className="p-0.5 hover:bg-slate-200 rounded transition-colors text-slate-500 shrink-0"
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

            <Folder
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: dossier.color || '#3b82f6', fill: dossier.color || '#3b82f6' }}
            />
            <span className="truncate">{dossier.name}</span>
          </div>

          <span title={`${count} văn bản`} className={`text-[10px] ml-1 font-mono px-1 rounded ${isActive ? 'text-blue-600 bg-blue-100' : 'text-slate-400 group-hover:text-slate-600'}`}>
            ({count})
          </span>
        </div>

        {/* Render child nodes recursively */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col mt-0.5">
            {children.map(child => renderDossierNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const rootDossiers = useMemo(() => {
    return activeDossiers
      .filter(d => !d.parentId)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))
  }, [activeDossiers])

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 mt-0.5 mb-1 px-2">
        <div className="h-3.5 bg-slate-200 animate-pulse rounded w-3/4" />
        <div className="h-3.5 bg-slate-200 animate-pulse rounded w-1/2 ml-3" />
        <div className="h-3.5 bg-slate-200 animate-pulse rounded w-2/3 ml-3" />
      </div>
    )
  }

  if (activeDossiers.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5 mt-1 mb-1.5 pl-1 bg-slate-50/60 p-1.5 rounded-lg border border-slate-200/60">
      {/* Action controls: Bung hết / Thu hết */}
      <div className="flex items-center justify-between px-1.5 py-1 mb-1 text-[11px] font-medium border-b border-slate-200/60">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Danh mục cây</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors cursor-pointer"
            title="Mở rộng tất cả hồ sơ Cấp 1, Cấp 2 để lộ tất cả hồ sơ con"
          >
            <PlusSquare className="w-3 h-3" />
            <span>Bung hết</span>
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:underline font-semibold transition-colors cursor-pointer"
            title="Thu gọn tất cả hồ sơ con về Cấp 1 gốc"
          >
            <MinusSquare className="w-3 h-3" />
            <span>Thu hết</span>
          </button>
        </div>
      </div>

      {rootDossiers.map(d => renderDossierNode(d, 0))}
    </div>
  )
}
