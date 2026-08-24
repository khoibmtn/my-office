'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { FolderPlus, ArrowRightLeft, Trash2, PanelRightOpen, PanelRightClose, Archive, FileText, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDossiers } from '@/hooks/useDossiers'
import { useDocuments } from '@/hooks/useDocuments'
import { useStaff } from '@/hooks/useStaff'
import { usePermissions } from '@/hooks/usePermissions'
import { useRole } from '@/hooks/useRole'
import { toggleArchiveDossier } from '@/lib/dossiers'
import { DossierBreadcrumb } from '@/components/dossiers/DossierBreadcrumb'
import { DossierPanel } from '@/components/dossiers/DossierPanel'
import { DossierModal } from '@/components/dossiers/DossierModal'
import { DeleteDossierModal } from '@/components/dossiers/DeleteDossierModal'
import { TransferDossierModal } from '@/components/dossiers/TransferDossierModal'
import { DossierTable } from '@/components/dossiers/DossierTable'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Dossier, Document } from '@/types'

export default function DossiersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetId = searchParams.get('id')
  const { dossiers, loading: dossiersLoading } = useDossiers()
  const { documents, loading: docsLoading } = useDocuments()
  const { staff } = useStaff()
  const perms = usePermissions()
  const { isGuest, staffId } = useRole()

  // Navigation path state
  const [activePath, setActivePath] = useState<Dossier[]>([])
  const activeFolder = activePath[activePath.length - 1] || null

  // Root view tab ('dossiers' | 'unassigned')
  const [rootTab, setRootTab] = useState<'dossiers' | 'unassigned'>('dossiers')

  // Auto-expand breadcrumb path when URL has ?id=...
  useEffect(() => {
    if (!targetId) {
      setActivePath([])
      return
    }
    if (dossiers.length === 0) return
    const target = dossiers.find(d => d.id === targetId)
    if (!target) {
      setActivePath([])
      return
    }

    // Do not expand archived dossiers in panel
    if (target.isArchived) {
      setActivePath([])
      return
    }

    const path: Dossier[] = [target]
    let curr = target.parentId
    while (curr) {
      const parent = dossiers.find(p => p.id === curr)
      if (parent) {
        path.unshift(parent)
        curr = parent.parentId
      } else {
        break
      }
    }
    setActivePath(path)
  }, [targetId, dossiers])

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false)

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null)
  const [parentDossierForCreate, setParentDossierForCreate] = useState<Dossier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Dossier | null>(null)
  const [transferTarget, setTransferTarget] = useState<Dossier | null>(null)

  // Filter documents in current folder
  const currentDocs = useMemo(() => {
    if (!documents) return []
    if (!activeFolder) {
      // Root level: show documents that have no dossierIds
      return documents.filter(d => !d.dossierIds || d.dossierIds.length === 0)
    }
    // Specific dossier level: show documents containing activeFolder.id
    return documents.filter(d => (d.dossierIds || []).includes(activeFolder.id))
  }, [documents, activeFolder])

  // Navigate breadcrumb
  const handleNavigate = (targetFolder: Dossier | null) => {
    if (!targetFolder) {
      setActivePath([])
      router.push('/dossiers')
      return
    }
    router.push(`/dossiers?id=${targetFolder.id}`)
  }

  const handleAddSubDossier = (parent: Dossier) => {
    setEditingDossier(null)
    setParentDossierForCreate(parent)
    setModalOpen(true)
  }

  const handleEditDossier = (dossier: Dossier) => {
    setEditingDossier(dossier)
    setParentDossierForCreate(null)
    setModalOpen(true)
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
      {/* Top Action Header with Integrated Breadcrumb */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <DossierBreadcrumb currentPath={activePath} onNavigate={handleNavigate} />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto shrink-0">
          {/* Add Dossier Button */}
          {perms.canCreateDossier && (
            <Button
              size="sm"
              onClick={() => {
                setEditingDossier(null)
                setParentDossierForCreate(null)
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
              {perms.canEditDossier && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 hover:bg-amber-50 border-amber-300"
                  onClick={async () => {
                    await toggleArchiveDossier(activeFolder.id, true, staffId || 'unknown')
                    handleNavigate(null)
                  }}
                  title="Lưu trữ hồ sơ này (rút khỏi danh sách điều hướng)"
                >
                  <Archive className="w-4 h-4 mr-1.5" />
                  Lưu trữ
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col min-w-0">
          {!activeFolder ? (
            /* Root View: Show Tab Switcher between Dossiers Management & Unassigned Docs */
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setRootTab('dossiers')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    rootTab === 'dossiers'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Danh sách tất cả Hồ sơ ({dossiers.length})</span>
                </button>

                <button
                  onClick={() => setRootTab('unassigned')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    rootTab === 'unassigned'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Văn bản chưa xếp Hồ sơ ({currentDocs.length})</span>
                </button>
              </div>

              {rootTab === 'dossiers' ? (
                <DossierTable
                  dossiers={dossiers}
                  documents={documents}
                  onAddSubDossier={handleAddSubDossier}
                  onEditDossier={handleEditDossier}
                  onDeleteDossier={setDeleteTarget}
                  perms={perms}
                />
              ) : (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 min-h-[300px] min-w-0 max-w-full overflow-x-auto">
                  <DocumentTable documents={currentDocs} />
                </div>
              )}
            </div>
          ) : (
            /* Specific Active Dossier View: Show Documents Table */
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 min-h-[300px] min-w-0 max-w-full overflow-x-auto">
              <DocumentTable documents={currentDocs} />
            </div>
          )}
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
          parentDossier={parentDossierForCreate || activeFolder}
          availableParents={dossiers}
          onClose={() => {
            setModalOpen(false)
            setParentDossierForCreate(null)
          }}
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
