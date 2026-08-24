'use client'

import React from 'react'
import { Folder, MoreVertical, Pencil, Trash2, ArrowRightLeft, FileText, CheckSquare } from 'lucide-react'
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
    <div className="mb-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
        Thư mục con ({folders.length})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {folders.map((folder) => {
          // Count documents directly inside this folder
          const docCount = documents.filter(d => (d.dossierIds || []).includes(folder.id)).length

          // Calculate checklist completion
          const totalTasks = folder.checklist?.length || 0
          const completedTasks = folder.checklist?.filter(t => t.completed).length || 0
          const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

          return (
            <div
              key={folder.id}
              onClick={() => onOpenFolder(folder)}
              className="group relative bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              {/* Header: Icon + Level Badge + Menu */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                      {folder.name}
                    </h4>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                      Cấp {folder.level}
                    </span>
                  </div>
                </div>

                {/* Actions Dropdown */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {canEdit && (
                    <button
                      onClick={() => onEditFolder(folder)}
                      className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Sửa hồ sơ"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canTransfer && (
                    <button
                      onClick={() => onTransferFolder(folder)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Chuyển hồ sơ"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDeleteFolder(folder)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Xóa hồ sơ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Footer: Document count & Checklist progress */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  {docCount} văn bản
                </span>

                {totalTasks > 0 && (
                  <span className="flex items-center gap-1 font-medium text-slate-600" title={`${completedTasks}/${totalTasks} việc`}>
                    <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                    {percent}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
