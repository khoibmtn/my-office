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
    <nav className="flex items-center gap-1.5 text-sm text-slate-600 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 font-medium hover:text-blue-600 transition-colors shrink-0"
      >
        <Home className="w-4 h-4 text-slate-500" />
        <span>Hồ sơ của tôi</span>
      </button>

      {currentPath.map((item, idx) => {
        const isLast = idx === currentPath.length - 1
        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <button
              onClick={() => onNavigate(item)}
              disabled={isLast}
              className={`flex items-center gap-1 font-medium truncate max-w-[200px] transition-colors shrink-0 ${
                isLast
                  ? 'text-slate-900 font-semibold cursor-default'
                  : 'hover:text-blue-600 text-slate-600'
              }`}
            >
              <Folder className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
