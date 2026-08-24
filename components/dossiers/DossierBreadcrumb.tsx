'use client'

import React from 'react'
import { ChevronRight, Folder, Check, MinusCircle } from 'lucide-react'
import type { Dossier } from '@/types'

interface DossierBreadcrumbProps {
  currentPath: Dossier[]
  onNavigate: (dossier: Dossier | null) => void
  hasSubDossiers?: boolean
  includeSubDossiers?: boolean
  onToggleIncludeSubDossiers?: (val: boolean) => void
}

export function DossierBreadcrumb({
  currentPath,
  onNavigate,
  hasSubDossiers = false,
  includeSubDossiers = false,
  onToggleIncludeSubDossiers,
}: DossierBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-700 overflow-x-auto select-none py-0.5">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 font-bold shrink-0 text-slate-800 hover:text-blue-600 transition-colors"
      >
        <Folder className="w-5 h-5 text-blue-600 shrink-0" />
        <span>Hồ sơ của tôi</span>
      </button>

      {currentPath.map((item, idx) => {
        const isLast = idx === currentPath.length - 1
        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onNavigate(item)}
                disabled={isLast}
                className={`flex items-center gap-1 font-semibold truncate max-w-[220px] transition-colors ${
                  isLast
                    ? 'text-blue-900 font-bold cursor-default'
                    : 'hover:text-blue-600 text-slate-600'
                }`}
              >
                <Folder
                  className="w-4 h-4 shrink-0"
                  style={{ color: item.color || '#3b82f6', fill: item.color || '#3b82f6' }}
                />
                <span className="truncate">{item.name}</span>
              </button>

              {/* Sub-dossiers toggle button displayed right after active dossier name */}
              {isLast && hasSubDossiers && onToggleIncludeSubDossiers && (
                <button
                  type="button"
                  onClick={() => onToggleIncludeSubDossiers(!includeSubDossiers)}
                  className={`ml-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border transition-all flex items-center gap-1 cursor-pointer select-none ${
                    includeSubDossiers
                      ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs hover:bg-blue-100'
                      : 'bg-amber-50 text-slate-600 border-amber-200/80 hover:bg-amber-100'
                  }`}
                  title={
                    includeSubDossiers
                      ? 'Đang hiển thị văn bản từ hồ sơ này và tất cả hồ sơ con. Nhấn để tắt.'
                      : 'Nhấn để bật hiển thị & tìm kiếm tất cả văn bản trong các hồ sơ con'
                  }
                >
                  {includeSubDossiers ? (
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  ) : (
                    <MinusCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span>HS con</span>
                </button>
              )}
            </div>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
