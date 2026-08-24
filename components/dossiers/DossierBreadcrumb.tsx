'use client'

import React from 'react'
import { ChevronRight, Home, Folder } from 'lucide-react'
import type { Dossier } from '@/types'

interface DossierBreadcrumbProps {
  currentPath: Dossier[]
  onNavigate: (dossier: Dossier | null) => void
}

export function DossierBreadcrumb({ currentPath, onNavigate }: DossierBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-700 overflow-x-auto select-none">
      <div className="flex items-center gap-1.5 font-bold shrink-0 text-slate-800">
        <Folder className="w-5 h-5 text-blue-600 shrink-0" />
        <span>Hồ sơ của tôi</span>
      </div>

      {currentPath.map((item, idx) => {
        const isLast = idx === currentPath.length - 1
        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <button
              onClick={() => onNavigate(item)}
              disabled={isLast}
              className={`flex items-center gap-1 font-semibold truncate max-w-[220px] transition-colors shrink-0 ${
                isLast
                  ? 'text-blue-900 font-bold cursor-default'
                  : 'hover:text-blue-600 text-slate-600'
              }`}
            >
              <Folder className={`w-4 h-4 shrink-0 ${isLast ? 'text-blue-600 fill-blue-50' : 'text-slate-400'}`} />
              <span className="truncate">{item.name}</span>
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
