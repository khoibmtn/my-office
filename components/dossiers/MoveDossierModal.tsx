'use client'

import React, { useState, useMemo } from 'react'
import { Folder, ArrowRightLeft, AlertTriangle, Loader2, Check, Home } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Dossier } from '@/types'
import { moveDossierHierarchy } from '@/lib/dossiers'

interface MoveDossierModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movingDossier: Dossier | null
  allDossiers: Dossier[]
  actorId: string
  onSuccess?: () => void
}

export function MoveDossierModal({
  open,
  onOpenChange,
  movingDossier,
  allDossiers,
  actorId,
  onSuccess,
}: MoveDossierModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate height of the moving subtree
  const movingSubtreeHeight = useMemo(() => {
    if (!movingDossier) return 1
    const getSubtreeHeight = (id: string): number => {
      const children = allDossiers.filter(d => d.parentId === id && !d.deletedAt)
      if (children.length === 0) return 1
      return 1 + Math.max(...children.map(c => getSubtreeHeight(c.id)))
    }
    return getSubtreeHeight(movingDossier.id)
  }, [movingDossier, allDossiers])

  // Get self and descendants IDs to prevent invalid circular moves
  const selfAndDescendantIds = useMemo(() => {
    if (!movingDossier) return new Set<string>()
    const getDescendants = (id: string): string[] => {
      const children = allDossiers.filter(d => d.parentId === id)
      return [id, ...children.flatMap(c => getDescendants(c.id))]
    }
    return new Set(getDescendants(movingDossier.id))
  }, [movingDossier, allDossiers])

  // Reset state when modal opens
  React.useEffect(() => {
    if (open && movingDossier) {
      setSelectedTargetId(movingDossier.parentId || null)
      setError(null)
    }
  }, [open, movingDossier])

  if (!movingDossier) return null

  const handleConfirmMove = async () => {
    if (selectedTargetId === movingDossier.parentId) {
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await moveDossierHierarchy(movingDossier.id, selectedTargetId, actorId, allDossiers)
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi di chuyển hồ sơ')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper to render tree options with validation status
  const renderOptionNode = (dossier: Dossier, level: number = 0) => {
    const isCurrentParent = movingDossier.parentId === dossier.id
    const isSelfOrDescendant = selfAndDescendantIds.has(dossier.id)
    const targetParentLevel = dossier.level
    const resultingDepth = targetParentLevel + movingSubtreeHeight
    const exceedsMaxDepth = resultingDepth > 3

    const isDisabled = isSelfOrDescendant || exceedsMaxDepth
    const isSelected = selectedTargetId === dossier.id

    let disabledReason = ''
    if (isSelfOrDescendant) {
      disabledReason = 'Không thể di chuyển vào chính nó hoặc hồ sơ con của nó'
    } else if (exceedsMaxDepth) {
      disabledReason = `Không thể chọn: Tổng số cấp sau khi chuyển (${resultingDepth}) vượt quá 3 cấp`
    }

    const children = allDossiers
      .filter(d => d.parentId === dossier.id && !d.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

    return (
      <React.Fragment key={dossier.id}>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => setSelectedTargetId(dossier.id)}
          title={disabledReason || `${dossier.name} (Cấp ${dossier.level})`}
          className={`w-full text-left py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between border mb-1 ${
            isSelected
              ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
              : isDisabled
              ? 'bg-slate-100/70 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
          style={{ marginLeft: `${level * 16}px`, width: `calc(100% - ${level * 16}px)` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Folder
              className="w-4 h-4 shrink-0"
              style={{
                color: isSelected ? '#fff' : isDisabled ? '#94a3b8' : dossier.color || '#3b82f6',
                fill: isSelected ? '#fff' : isDisabled ? '#94a3b8' : dossier.color || '#3b82f6',
              }}
            />
            <span className="truncate">{dossier.name}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
              isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'
            }`}>
              Cấp {dossier.level}
            </span>
            {isCurrentParent && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                Vị trí hiện tại
              </span>
            )}
          </div>

          {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
        </button>

        {children.map(c => renderOptionNode(c, level + 1))}
      </React.Fragment>
    )
  }

  const rootDossiers = allDossiers
    .filter(d => !d.parentId && !d.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  const isRootSelected = selectedTargetId === null
  const canMoveToRoot = movingDossier.parentId !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Di chuyển Hồ sơ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 my-1">
          {/* Target dossier overview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="text-slate-500 font-medium mb-1">Hồ sơ di chuyển:</div>
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <Folder className="w-4 h-4 text-blue-600 fill-blue-600 shrink-0" />
              <span>{movingDossier.name}</span>
              <span className="text-xs font-normal text-slate-500 font-mono">
                (Độ sâu cây con: {movingSubtreeHeight} cấp)
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs font-semibold text-slate-700">
            Chọn vị trí hồ sơ đích (Tối đa 3 cấp):
          </div>

          <div className="max-h-64 overflow-y-auto pr-1 space-y-1 divide-y-0">
            {/* Root Level Option */}
            <button
              type="button"
              onClick={() => setSelectedTargetId(null)}
              className={`w-full text-left py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between border ${
                isRootSelected
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Home className={`w-4 h-4 ${isRootSelected ? 'text-white' : 'text-slate-500'}`} />
                <span>/ Thư mục gốc (Cấp 1)</span>
              </div>
              {isRootSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
            </button>

            {/* Tree Options */}
            {rootDossiers.map(d => renderOptionNode(d, 0))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleConfirmMove}
            disabled={submitting || selectedTargetId === movingDossier.parentId}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Xác nhận Di chuyển
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
