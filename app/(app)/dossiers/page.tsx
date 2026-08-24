'use client'

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { FolderPlus, ArrowRightLeft, Trash2, PanelRightOpen, PanelRightClose, Archive, FileText, Layers, Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDossiers } from '@/hooks/useDossiers'
import { useDocuments } from '@/hooks/useDocuments'
import { useStaff } from '@/hooks/useStaff'
import { usePermissions } from '@/hooks/usePermissions'
import { useRole } from '@/hooks/useRole'
import { useDossierUnread } from '@/hooks/useDossierUnread'
import { toggleArchiveDossier } from '@/lib/dossiers'
import { DossierBreadcrumb } from '@/components/dossiers/DossierBreadcrumb'
import { DossierPanel } from '@/components/dossiers/DossierPanel'
import { DossierModal } from '@/components/dossiers/DossierModal'
import { DeleteDossierModal } from '@/components/dossiers/DeleteDossierModal'
import { TransferDossierModal } from '@/components/dossiers/TransferDossierModal'
import { ShareDossierModal } from '@/components/dossiers/ShareDossierModal'
import { DossierTable } from '@/components/dossiers/DossierTable'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Dossier, Document } from '@/types'

function DossiersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetId = searchParams.get('id')
  const { dossiers, loading: dossiersLoading } = useDossiers()
  const { documents, loading: docsLoading } = useDocuments()
  const { staff } = useStaff()
  const perms = usePermissions()
  const { isGuest, staffId, staffName, isAdmin } = useRole()
  const { markAsRead } = useDossierUnread(dossiers)

  // Navigation path state
  const [activePath, setActivePath] = useState<Dossier[]>([])
  const activeFolder = activePath[activePath.length - 1] || null

  // Root view tab
  const [rootTab, setRootTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('myoffice_dossier_rootTab')
      if (saved) return saved
    }
    return 'default'
  })

  const effectiveRootTab = useMemo(() => {
    if (isAdmin) {
      if (rootTab === 'unassigned') return 'unassigned'
      return 'dossiers'
    }
    if (rootTab === 'shared') return 'shared'
    if (rootTab === 'unassigned') return 'unassigned'
    return 'my_dossiers'
  }, [isAdmin, rootTab])

  const handleSetRootTab = useCallback((tab: string) => {
    setRootTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('myoffice_dossier_rootTab', tab)
    }
  }, [])

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

    markAsRead(targetId)

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
  }, [targetId, dossiers, markAsRead])

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false)

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null)
  const [parentDossierForCreate, setParentDossierForCreate] = useState<Dossier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Dossier | null>(null)
  const [transferTarget, setTransferTarget] = useState<Dossier | null>(null)
  const [shareTarget, setShareTarget] = useState<Dossier | null>(null)
  const [includeSubDossiers, setIncludeSubDossiers] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('myoffice_dossier_includeSubDossiers')
      if (saved !== null) return saved === 'true'
    }
    return false
  })

  const handleToggleIncludeSubDossiers = useCallback((val: boolean) => {
    setIncludeSubDossiers(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('myoffice_dossier_includeSubDossiers', String(val))
    }
  }, [])

  // Hydrate preferences on mount
  useEffect(() => {
    const savedInclude = localStorage.getItem('myoffice_dossier_includeSubDossiers')
    if (savedInclude !== null) {
      setIncludeSubDossiers(savedInclude === 'true')
    }
  }, [])

  // Split into "My Dossiers" and "Shared with Me"
  const { myDossiers, sharedDossiers } = useMemo(() => {
    if (isAdmin) {
      return { myDossiers: dossiers, sharedDossiers: [] }
    }

    const my: Dossier[] = []
    const shared: Dossier[] = []

    // 1. My Dossiers: ONLY dossiers owned by this staff member
    dossiers.forEach(d => {
      if (staffId && d.ownerId === staffId) {
        my.push(d)
      }
    })

    // 2. Shared with me: directly shared or descendant of shared dossiers
    const sharedIdSet = new Set<string>()
    dossiers.forEach(d => {
      if (staffId && d.ownerId !== staffId && (d.sharedWith || []).includes(staffId)) {
        sharedIdSet.add(d.id)
      }
    })

    let added = true
    while (added) {
      added = false
      dossiers.forEach(d => {
        if (d.parentId && sharedIdSet.has(d.parentId) && !sharedIdSet.has(d.id)) {
          sharedIdSet.add(d.id)
          added = true
        }
      })
    }

    dossiers.forEach(d => {
      if (sharedIdSet.has(d.id)) {
        shared.push(d)
      }
    })

    return { myDossiers: my, sharedDossiers: shared }
  }, [dossiers, staffId, isAdmin])

  // Check if current active path is a shared root
  const isSharedRoot = useMemo(() => {
    if (isAdmin || activePath.length === 0) return false
    const rootDossier = activePath[0]
    return rootDossier.ownerId !== staffId
  }, [isAdmin, activePath, staffId])

  // Collect all descendant dossier IDs for the active folder
  const descendantDossierIds = useMemo(() => {
    if (!activeFolder) return []
    const ids: string[] = []
    const collect = (pid: string) => {
      const children = dossiers.filter(d => d.parentId === pid && !d.deletedAt)
      children.forEach(c => {
        ids.push(c.id)
        collect(c.id)
      })
    }
    collect(activeFolder.id)
    return ids
  }, [activeFolder, dossiers])

  const hasSubDossiers = descendantDossierIds.length > 0

  // Count unassigned docs accurately for current user
  const unassignedDocs = useMemo(() => {
    if (!documents) return []
    if (isAdmin) {
      return documents.filter(d => !d.dossierIds || d.dossierIds.length === 0)
    }
    const myDossierIdSet = new Set(myDossiers.map(d => d.id))
    return documents.filter(d => {
      const isAssignedToMe =
        (staffId && d.assigneeId === staffId) ||
        (staffId && (d.coAssigneeIds || []).includes(staffId)) ||
        (staffName && d.assignee === staffName)
      if (!isAssignedToMe) return false
      return !d.dossierIds || !d.dossierIds.some(did => myDossierIdSet.has(did))
    })
  }, [documents, isAdmin, staffId, staffName, myDossiers])

  // Filter documents in current folder (and optional sub-dossiers)
  const currentDocs = useMemo(() => {
    if (!documents) return []

    // 1. Root Tab: Unassigned documents
    if (!activeFolder) {
      if (effectiveRootTab === 'unassigned') {
        return unassignedDocs
      }
      return []
    }

    // 2. Active Folder documents
    if (includeSubDossiers && hasSubDossiers) {
      const allowedIds = new Set([activeFolder.id, ...descendantDossierIds])
      return documents.filter(d =>
        (d.dossierIds || []).some(did => allowedIds.has(did))
      )
    }

    return documents.filter(d =>
      (d.dossierIds || []).includes(activeFolder.id)
    )
  }, [documents, activeFolder, effectiveRootTab, unassignedDocs, includeSubDossiers, hasSubDossiers, descendantDossierIds])

  // Navigate breadcrumb
  const handleNavigate = useCallback((target: Dossier | null) => {
    if (!target) {
      router.push('/dossiers')
      setActivePath([])
      return
    }
    router.push(`/dossiers?id=${target.id}`)
  }, [router])

  const handleAddSubDossier = useCallback((parent: Dossier) => {
    setEditingDossier(null)
    setParentDossierForCreate(parent)
    setModalOpen(true)
  }, [])

  const handleEditDossier = useCallback((dossier: Dossier) => {
    setEditingDossier(dossier)
    setParentDossierForCreate(null)
    setModalOpen(true)
  }, [])

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
          <DossierBreadcrumb
            currentPath={activePath}
            onNavigate={handleNavigate}
            hasSubDossiers={hasSubDossiers}
            includeSubDossiers={includeSubDossiers}
            onToggleIncludeSubDossiers={handleToggleIncludeSubDossiers}
            isSharedRoot={isSharedRoot}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto shrink-0">
          {/* Add Dossier Button: Only shown at Root level */}
          {!activeFolder && perms.canCreateDossier && (
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

          {/* Share Button: Shown when user is owner or admin */}
          {activeFolder && (isAdmin || activeFolder.ownerId === staffId) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShareTarget(activeFolder)}
              className="text-slate-700 hover:text-blue-700 border-slate-200 shadow-2xs"
            >
              <Share2 className="w-4 h-4 mr-1.5 text-teal-600" />
              Chia sẻ
            </Button>
          )}

          {/* Toggle Panel Button: Shown when viewing a specific dossier */}
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
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
                {isAdmin ? (
                  <button
                    onClick={() => handleSetRootTab('dossiers')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      effectiveRootTab === 'dossiers'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Danh sách tất cả Hồ sơ ({dossiers.length})</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleSetRootTab('my_dossiers')}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                        effectiveRootTab === 'my_dossiers'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Hồ sơ của tôi ({myDossiers.length})</span>
                    </button>

                    <button
                      onClick={() => handleSetRootTab('shared')}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                        effectiveRootTab === 'shared'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Share2 className="w-4 h-4 text-teal-500" />
                      <span>Chia sẻ với tôi ({sharedDossiers.length})</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleSetRootTab('unassigned')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    effectiveRootTab === 'unassigned'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Văn bản chưa xếp Hồ sơ ({unassignedDocs.length})</span>
                </button>
              </div>

              {effectiveRootTab === 'dossiers' || effectiveRootTab === 'my_dossiers' ? (
                <DossierTable
                  dossiers={isAdmin ? dossiers : myDossiers}
                  documents={documents}
                  loading={dossiersLoading}
                  onAddSubDossier={handleAddSubDossier}
                  onEditDossier={handleEditDossier}
                  onDeleteDossier={setDeleteTarget}
                  onTransferDossier={setTransferTarget}
                  onShareDossier={setShareTarget}
                  perms={perms}
                />
              ) : effectiveRootTab === 'shared' ? (
                <DossierTable
                  dossiers={sharedDossiers}
                  documents={documents}
                  loading={dossiersLoading}
                  onAddSubDossier={handleAddSubDossier}
                  onEditDossier={handleEditDossier}
                  onDeleteDossier={setDeleteTarget}
                  onTransferDossier={setTransferTarget}
                  onShareDossier={setShareTarget}
                  perms={{
                    ...perms,
                    canCreateDossier: false,
                    canEditDossier: false,
                    canDeleteDossier: false,
                    canTransferDossier: false,
                  }}
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
            onShare={() => setShareTarget(activeFolder)}
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

      {shareTarget && (
        <ShareDossierModal
          dossier={shareTarget}
          isOpen={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  )
}

export default function DossiersPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <DossiersContent />
    </Suspense>
  )
}
