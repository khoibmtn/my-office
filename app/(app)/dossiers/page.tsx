'use client'

import React, { useState, useMemo } from 'react'
import { Plus, FolderPlus, ArrowRightLeft, Trash2, FileText, Search, PanelRightOpen, PanelRightClose, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDossiers } from '@/hooks/useDossiers'
import { useDocuments } from '@/hooks/useDocuments'
import { useStaff } from '@/hooks/useStaff'
import { usePermissions } from '@/hooks/usePermissions'
import { useRole } from '@/hooks/useRole'
import { DossierBreadcrumb } from '@/components/dossiers/DossierBreadcrumb'
import { DossierFolderGrid } from '@/components/dossiers/DossierFolderGrid'
import { DossierPanel } from '@/components/dossiers/DossierPanel'
import { DossierModal } from '@/components/dossiers/DossierModal'
import { DeleteDossierModal } from '@/components/dossiers/DeleteDossierModal'
import { TransferDossierModal } from '@/components/dossiers/TransferDossierModal'
import { DocumentTable } from '@/components/documents/DocumentTable'
import type { Dossier, Document } from '@/types'

export default function DossiersPage() {
  const { dossiers, loading: dossiersLoading } = useDossiers()
  const { documents, loading: docsLoading } = useDocuments()
  const { staff } = useStaff()
  const perms = usePermissions()
  const { isGuest } = useRole()

  // Navigation path state
  const [activePath, setActivePath] = useState<Dossier[]>([])
  const activeFolder = activePath[activePath.length - 1] || null

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [globalSearch, setGlobalSearch] = useState(false)

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false)

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Dossier | null>(null)
  const [transferTarget, setTransferTarget] = useState<Dossier | null>(null)

  // Filter sub-folders of current folder
  const subFolders = useMemo(() => {
    const parentId = activeFolder ? activeFolder.id : null
    return dossiers.filter(d => d.parentId === parentId)
  }, [dossiers, activeFolder])

  // Filter documents in current folder or global search
  const currentDocs = useMemo(() => {
    if (!documents) return []
    if (globalSearch || searchQuery.trim()) {
      return documents
    }
    if (!activeFolder) {
      // Root level: show documents that have no dossierIds
      return documents.filter(d => !d.dossierIds || d.dossierIds.length === 0)
    }
    // Specific dossier level: show documents containing activeFolder.id
    return documents.filter(d => (d.dossierIds || []).includes(activeFolder.id))
  }, [documents, activeFolder, globalSearch, searchQuery])

  // Navigate breadcrumb
  const handleNavigate = (targetFolder: Dossier | null) => {
    if (!targetFolder) {
      setActivePath([])
      return
    }
    const idx = activePath.findIndex(d => d.id === targetFolder.id)
    if (idx >= 0) {
      setActivePath(activePath.slice(0, idx + 1))
    } else {
      setActivePath([...activePath, targetFolder])
    }
  }

  // Count children of delete target
  const deleteChildCount = useMemo(() => {
    if (!deleteTarget) return 0
    return dossiers.filter(d => d.parentId === deleteTarget.id).length
  }, [dossiers, deleteTarget])

  if (isGuest) {
    return (
      <main className="p-8 text-center text-slate-500">
        <p className="text-sm">Bạn không có quyền truy cập trang Quản lý Hồ sơ.</p>
      </main>
    )
  }

  return (
    <div className="h-full flex flex-col min-w-0 bg-slate-50">
      {/* Top Action Bar */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Folder className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Quản lý Hồ sơ</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Add Dossier Button */}
          {perms.canCreateDossier && (
            <Button
              size="sm"
              onClick={() => {
                setEditingDossier(null)
                setModalOpen(true)
              }}
            >
              <FolderPlus className="w-4 h-4 mr-1.5" />
              + Thêm hồ sơ
            </Button>
          )}

          {/* Current folder actions */}
          {activeFolder && (
            <>
              {perms.canTransferDossier && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransferTarget(activeFolder)}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-1.5 text-blue-600" />
                  Chuyển hồ sơ này
                </Button>
              )}
              {perms.canDeleteDossier && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => setDeleteTarget(activeFolder)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Xóa
                </Button>
              )}
            </>
          )}

          {/* Toggle Panel Button */}
          {activeFolder && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPanelOpen(!panelOpen)}
              className="text-slate-600 hover:text-slate-900"
            >
              {panelOpen ? <PanelRightClose className="w-4 h-4 mr-1.5" /> : <PanelRightOpen className="w-4 h-4 mr-1.5" />}
              Ghi chú & Tiến độ
            </Button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Content Pane */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col min-w-0">
          {/* Breadcrumb & Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-5">
            <DossierBreadcrumb currentPath={activePath} onNavigate={handleNavigate} />

            {/* Search Input with Location toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={globalSearch ? 'Tìm văn bản toàn hệ thống...' : 'Tìm trong thư mục này...'}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={globalSearch}
                  onChange={e => setGlobalSearch(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Tìm toàn hệ thống</span>
              </label>
            </div>
          </div>

          {/* Sub-Folders Grid */}
          <DossierFolderGrid
            folders={subFolders}
            documents={documents || []}
            onOpenFolder={f => setActivePath([...activePath, f])}
            onEditFolder={f => { setEditingDossier(f); setModalOpen(true) }}
            onDeleteFolder={f => setDeleteTarget(f)}
            onTransferFolder={f => setTransferTarget(f)}
            canEdit={!!perms.canEditDossier}
            canDelete={!!perms.canDeleteDossier}
            canTransfer={!!perms.canTransferDossier}
          />

          {/* Documents Table */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-[300px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                {activeFolder ? `Văn bản trong "${activeFolder.name}"` : 'Văn bản chưa xếp hồ sơ'}
                <span className="text-xs text-slate-400 font-normal">({currentDocs.length})</span>
              </h3>
            </div>

            <DocumentTable documents={currentDocs} />
          </div>
        </main>

        {/* Collapsible Right Panel */}
        {activeFolder && panelOpen && (
          <DossierPanel
            dossier={activeFolder}
            onClose={() => setPanelOpen(false)}
            canEdit={!!perms.canEditDossier}
          />
        )}
      </div>

      {/* Modals */}
      {modalOpen && (
        <DossierModal
          editingDossier={editingDossier}
          parentDossier={activeFolder}
          availableParents={dossiers}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {}}
        />
      )}

      {deleteTarget && (
        <DeleteDossierModal
          dossier={deleteTarget}
          childCount={deleteChildCount}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            if (activeFolder?.id === deleteTarget.id) {
              setActivePath(activePath.slice(0, -1))
            }
          }}
        />
      )}

      {transferTarget && (
        <TransferDossierModal
          dossier={transferTarget}
          allDossiers={dossiers}
          staffList={staff}
          onClose={() => setTransferTarget(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}
