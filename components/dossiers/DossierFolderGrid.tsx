'use client'

import React from 'react'
import { Folder, Pencil, Trash2, ArrowRightLeft } from 'lucide-react'
import type { Dossier, Document } from '@/types'

interface DossierFolderGridProps {
  folders: Dossier[]
  documents: Document[]
  onOpenFolder: (folder: Dossier) => void
  onEditFolder: (folder: Dossier) => void
  onDeleteFolder: (folder: Dossier) => void
  onTransferFolder: (folder: Dossier) => void
  canEdit: boolean
  canDelete: boolean
  canTransfer: boolean
}

export function DossierFolderGrid({
  folders,
  documents,
  onOpenFolder,
  onEditFolder,
  onDeleteFolder,
  onTransferFolder,
  canEdit,
  canDelete,
  canTransfer,
}: DossierFolderGridProps) {
  if (folders.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Thư mục con ({folders.length}):
        </span>

        {folders.map((folder) => {
          // Count documents directly inside this folder
          const docCount = documents.filter(d => (d.dossierIds || []).includes(folder.id)).length

          return (
            <div
              key={folder.id}
              onClick={() => onOpenFolder(folder)}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-medium text-slate-700 hover:text-blue-700 shadow-xs transition-all cursor-pointer select-none"
            >
              <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[200px]">{folder.name}</span>
              <span className="text-[11px] text-slate-400 font-mono">({docCount})</span>

              {/* Actions Dropdown on Hover */}
              <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-1 border-l border-slate-200" onClick={e => e.stopPropagation()}>
                {canEdit && (
                  <button
                    onClick={() => onEditFolder(folder)}
                    className="p-0.5 text-slate-400 hover:text-amber-600 transition-colors"
                    title="Sửa hồ sơ"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {canTransfer && (
                  <button
                    onClick={() => onTransferFolder(folder)}
                    className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Chuyển hồ sơ"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDeleteFolder(folder)}
                    className="p-0.5 text-slate-400 hover:text-red-600 transition-colors"
                    title="Xóa hồ sơ"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
