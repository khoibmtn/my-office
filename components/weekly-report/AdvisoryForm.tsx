'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileText, Link2, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { DocumentPickerPanel } from '@/components/tasks/DocumentPickerPanel'
import { useAdvisoryDocs } from '@/hooks/useAdvisoryDocs'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import { useWeeks } from '@/hooks/useWeeks'
import { useDocuments } from '@/hooks/useDocuments'
import { useDossiers } from '@/hooks/useDossiers'
import { extractDriveFileId } from '@/lib/link-detector'
import { formatAdvisoryLine } from '@/lib/weekly-report/advisory-format'
import { createAdvisoryDoc, deleteAdvisoryDoc, updateAdvisoryDoc } from '@/lib/weekly-report/firestore'
import { addDays, formatDM, formatDMY, resolvePeriod, todayVN, weekIdForDate } from '@/lib/weekly-report/period'
import {
  DOC_TYPE_PREFIX,
  type AdvisoryDoc,
  type AdvisorySourceSnapshot,
  type DocTypeDef,
  type ISODate,
} from '@/types/weekly-report'
import type { Document } from '@/types'

function toIsoDateVN(val: unknown): ISODate | null {
  if (!val) return null
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)
    const parsed = new Date(val)
    return Number.isNaN(parsed.getTime()) ? null : todayVN(parsed)
  }
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : todayVN(val)
  }
  const maybeTs = val as { toDate?: () => Date; seconds?: number }
  if (typeof maybeTs.toDate === 'function') {
    const d = maybeTs.toDate()
    return Number.isNaN(d.getTime()) ? null : todayVN(d)
  }
  if (typeof maybeTs.seconds === 'number') {
    return todayVN(new Date(maybeTs.seconds * 1000))
  }
  return null
}

export function documentToSourceSnapshot(doc: Document): AdvisorySourceSnapshot {
  return {
    id: doc.id,
    docNumber: (doc.docNumber ?? '').trim(),
    title: (doc.title ?? '').trim(),
    sender: (doc.sender ?? '').trim(),
    issueDate: toIsoDateVN(doc.issueDate),
  }
}

export function buildSuggestedTitle(type: string, source: AdvisorySourceSnapshot | null): string {
  if (!source) return ''
  const base = [source.docNumber, source.title].filter(Boolean).join(' ').trim()
  if (!base) return ''
  if (type === 'TB') return `Về việc triển khai ${base}`
  if (type === 'KH') return `Triển khai thực hiện ${base}`
  if (type === 'CV') {
    if (/^(?:V\/v|Về việc)(?=[\s:.\-–]|$)/i.test(base)) return base
    return `Về việc thực hiện ${base}`
  }
  return base
}

function getTypePillText(typeDef: DocTypeDef): string {
  if (typeDef.code === 'KHAC') return typeDef.label || 'Khác'
  return DOC_TYPE_PREFIX[typeDef.code] || typeDef.code
}

function SourceDocumentPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[]
  onChange: (ids: string[], docs: Document[]) => void
}) {
  const { documents } = useDocuments()
  const { dossiers } = useDossiers()

  return (
    <DocumentPickerPanel
      documents={documents}
      dossiers={dossiers}
      selectedIds={selectedIds}
      onChange={(nextIds) => onChange(nextIds, documents)}
      maxHeight="220px"
    />
  )
}

export interface AdvisoryFormProps {
  open: boolean
  onClose: () => void
  sourceDocument?: Document | null
  defaultWeekId?: string
  defaultAdvisedDate?: ISODate
  editingDoc?: AdvisoryDoc | null
  onSaved?: (advisoryId: string) => void
  onDeleted?: (advisoryId: string) => void
}

export function AdvisoryForm(props: AdvisoryFormProps) {
  if (!props.open) return null
  return <AdvisoryFormModal {...props} />
}

function AdvisoryFormModal({
  open,
  onClose,
  sourceDocument,
  defaultWeekId,
  defaultAdvisedDate,
  editingDoc,
  onSaved,
  onDeleted,
}: AdvisoryFormProps) {
  const { config } = useWeeklyReportConfig()
  const { weeks } = useWeeks()

  const sortedDocTypes = useMemo(
    () => [...config.docTypes].sort((a, b) => a.order - b.order),
    [config.docTypes],
  )

  const initialSources = useMemo<AdvisorySourceSnapshot[]>(() => {
    if (editingDoc) {
      if (editingDoc.sourceSnapshot?.length > 0) return editingDoc.sourceSnapshot
      return (editingDoc.sourceDocumentIds ?? []).map((id) => ({
        id,
        docNumber: '',
        title: '',
        sender: '',
        issueDate: null,
      }))
    }
    if (sourceDocument) return [documentToSourceSnapshot(sourceDocument)]
    return []
  }, [editingDoc, sourceDocument])

  const initialType = editingDoc?.type || sortedDocTypes[0]?.code || 'CV'
  const initialDate = editingDoc?.advisedDate || defaultAdvisedDate || todayVN()

  const [type, setType] = useState<string>(initialType)
  const [title, setTitle] = useState<string>(
    editingDoc ? editingDoc.title : buildSuggestedTitle(initialType, initialSources[0] ?? null),
  )
  const [titleDirty, setTitleDirty] = useState<boolean>(Boolean(editingDoc))
  const [docNumber, setDocNumber] = useState<string>(editingDoc?.docNumber ?? '')
  const [advisedDate, setAdvisedDate] = useState<ISODate>(initialDate)
  const [overrideWeekId, setOverrideWeekId] = useState<string>(() => {
    if (editingDoc) return editingDoc.weekIdOverridden ? editingDoc.weekId : ''
    if (defaultWeekId) {
      const auto = weekIdForDate(initialDate, weeks)
      return auto !== defaultWeekId ? defaultWeekId : ''
    }
    return ''
  })
  const [sources, setSources] = useState<AdvisorySourceSnapshot[]>(initialSources)
  const [showSourcePicker, setShowSourcePicker] = useState<boolean>(false)
  const [draftLink, setDraftLink] = useState<string>(editingDoc?.draftLink ?? '')
  const [note, setNote] = useState<string>(editingDoc?.note ?? '')
  const [markSourceCompleted, setMarkSourceCompleted] = useState<boolean>(
    !editingDoc && initialSources.length > 0,
  )
  const [highlight, setHighlight] = useState<boolean>(editingDoc?.highlight ?? false)
  const [saving, setSaving] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form state whenever target item changes
  const resetKey = `${editingDoc?.id ?? 'new'}:${sourceDocument?.id ?? 'none'}:${defaultWeekId ?? ''}:${defaultAdvisedDate ?? ''}`
  useEffect(() => {
    const nextSources: AdvisorySourceSnapshot[] = editingDoc
      ? (editingDoc.sourceSnapshot?.length > 0
          ? editingDoc.sourceSnapshot
          : (editingDoc.sourceDocumentIds ?? []).map((id) => ({
              id,
              docNumber: '',
              title: '',
              sender: '',
              issueDate: null,
            })))
      : sourceDocument
      ? [documentToSourceSnapshot(sourceDocument)]
      : []

    const nextType = editingDoc?.type || sortedDocTypes[0]?.code || 'CV'
    const nextDate = editingDoc?.advisedDate || defaultAdvisedDate || todayVN()
    const nextOverride = editingDoc
      ? editingDoc.weekIdOverridden
        ? editingDoc.weekId
        : ''
      : defaultWeekId && weekIdForDate(nextDate, weeks) !== defaultWeekId
      ? defaultWeekId
      : ''

    setType(nextType)
    setTitle(editingDoc ? editingDoc.title : buildSuggestedTitle(nextType, nextSources[0] ?? null))
    setTitleDirty(Boolean(editingDoc))
    setDocNumber(editingDoc?.docNumber ?? '')
    setAdvisedDate(nextDate)
    setOverrideWeekId(nextOverride)
    setSources(nextSources)
    setShowSourcePicker(false)
    setDraftLink(editingDoc?.draftLink ?? '')
    setNote(editingDoc?.note ?? '')
    setMarkSourceCompleted(!editingDoc && nextSources.length > 0)
    setHighlight(editingDoc?.highlight ?? false)
    setConfirmDelete(false)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const primarySourceId = sources[0]?.id ?? ''
  const { docs: existingForPrimarySource } = useAdvisoryDocs({
    sourceDocumentId: primarySourceId,
  })

  const duplicateTypeDocs = useMemo(() => {
    if (!primarySourceId) return []
    return existingForPrimarySource.filter(
      (d) => d.type === type && d.id !== editingDoc?.id,
    )
  }, [primarySourceId, existingForPrimarySource, type, editingDoc?.id])

  const autoWeekId = useMemo(
    () => (advisedDate ? weekIdForDate(advisedDate, weeks) : weekIdForDate(todayVN(), weeks)),
    [advisedDate, weeks],
  )
  const effectiveWeekId = overrideWeekId || autoWeekId
  const effectivePeriod = useMemo(
    () => resolvePeriod(effectiveWeekId, weeks),
    [effectiveWeekId, weeks],
  )

  const weekOptions = useMemo(() => {
    const idSet = new Set<string>([autoWeekId])
    if (defaultWeekId) idSet.add(defaultWeekId)
    if (editingDoc?.weekId) idSet.add(editingDoc.weekId)
    for (const w of weeks) idSet.add(w.id)
    const todayAuto = weekIdForDate(todayVN(), weeks)
    for (let i = -8; i <= 6; i++) {
      idSet.add(addDays(autoWeekId, i * 7))
      idSet.add(addDays(todayAuto, i * 7))
    }
    return Array.from(idSet)
      .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id))
      .sort((a, b) => b.localeCompare(a))
      .map((id) => ({
        id,
        period: resolvePeriod(id, weeks),
      }))
  }, [autoWeekId, defaultWeekId, editingDoc?.weekId, weeks])

  const selectedTypeDef = sortedDocTypes.find((t) => t.code === type)

  const handleSelectType = (nextType: string) => {
    setType(nextType)
    if (!editingDoc && !titleDirty && sources[0]) {
      setTitle(buildSuggestedTitle(nextType, sources[0]))
    }
  }

  const handlePickerChange = (nextIds: string[], allDocs: Document[]) => {
    const byId = new Map(allDocs.map((d) => [d.id, d]))
    const prevById = new Map(sources.map((s) => [s.id, s]))
    const nextSnapshots = nextIds.map((id) => {
      const found = byId.get(id)
      if (found) return documentToSourceSnapshot(found)
      return (
        prevById.get(id) ?? {
          id,
          docNumber: '',
          title: '',
          sender: '',
          issueDate: null,
        }
      )
    })
    setSources(nextSnapshots)
    if (!editingDoc && !titleDirty && nextSnapshots[0] && !title.trim()) {
      setTitle(buildSuggestedTitle(type, nextSnapshots[0]))
    }
    if (!editingDoc && nextSnapshots.length > 0 && sources.length === 0) {
      setMarkSourceCompleted(true)
    }
  }

  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type) {
      setError('Vui lòng chọn loại văn bản tham mưu.')
      return
    }
    if (!title.trim()) {
      setError('Vui lòng nhập tên hoặc trích yếu văn bản tham mưu.')
      return
    }
    if (!advisedDate) {
      setError('Vui lòng chọn ngày tham mưu.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const cleanLink = draftLink.trim() || null
      const driveId = cleanLink ? extractDriveFileId(cleanLink) : null
      const sourceIds = sources.map((s) => s.id)

      const payload = {
        type,
        title: title.trim(),
        docNumber: docNumber.trim() || null,
        advisedDate,
        sourceDocumentIds: sourceIds,
        sourceSnapshot: sources,
        draftLink: cleanLink,
        draftDriveFileId: driveId,
        note: note.trim(),
        highlight,
        taskId: editingDoc?.taskId ?? null,
      }

      if (editingDoc) {
        const nextWeekId =
          overrideWeekId !== ''
            ? overrideWeekId
            : editingDoc.weekIdOverridden
            ? '' // '' = clear override, recompute from advisedDate
            : undefined

        await updateAdvisoryDoc(editingDoc.id, {
          ...payload,
          ...(nextWeekId !== undefined ? { weekId: nextWeekId } : {}),
        })
        onSaved?.(editingDoc.id)
      } else {
        const id = await createAdvisoryDoc(
          {
            ...payload,
            ...(overrideWeekId !== '' ? { weekId: overrideWeekId } : {}),
          },
          { markSourceCompleted: sourceIds.length > 0 && markSourceCompleted },
        )
        onSaved?.(id)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu văn bản tham mưu.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingDoc) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAdvisoryDoc(editingDoc.id)
      onDeleted?.(editingDoc.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xoá văn bản tham mưu.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={editingDoc ? 'Sửa văn bản tham mưu' : 'Xử lý / Tham mưu văn bản'}
      className="z-[1005] sm:max-w-xl shadow-2xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          {editingDoc ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] text-base"
              disabled={saving || deleting}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Xoá
            </Button>
          ) : (
            <div />
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-base"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              form="advisory-form"
              className="min-h-[44px] text-base bg-blue-600 hover:bg-blue-700 text-white"
              disabled={saving || deleting}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu văn bản tham mưu
            </Button>
          </div>
        </div>
      }
    >
      <form id="advisory-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-base text-red-700"
          >
            {error}
          </div>
        )}

        {/* Delete confirmation */}
        {editingDoc && confirmDelete && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3.5 space-y-2.5">
            <p className="text-base font-semibold text-red-800">
              Xác nhận xoá &ldquo;{formatAdvisoryLine(editingDoc)}&rdquo;?
            </p>
            <p className="text-sm text-red-700">
              Thao tác này sẽ xoá văn bản tham mưu khỏi tuần giao ban và gỡ liên kết ngược trên văn bản gốc.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] text-base"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-[44px] text-base"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận xoá
              </Button>
            </div>
          </div>
        )}

        {/* Source document warning for duplicate type */}
        {duplicateTypeDocs.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2.5 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-base leading-snug">
              <p className="font-semibold">
                Văn bản gốc này đã có văn bản tham mưu loại {selectedTypeDef?.label || type}:
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
                {duplicateTypeDocs.map((d) => (
                  <li key={d.id}>
                    • {formatAdvisoryLine(d)} (tuần {formatDMY(d.weekId)})
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-sm text-amber-800">
                Bạn vẫn có thể lưu nếu đây là văn bản khác.
              </p>
            </div>
          </div>
        )}

        {/* Type quick pills */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-base font-semibold text-slate-900">
              Loại văn bản <span className="text-red-600">*</span>
            </label>
            {selectedTypeDef && (
              <span className="text-sm font-medium text-blue-700">{selectedTypeDef.label}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedDocTypes.map((t) => {
              const active = t.code === type
              return (
                <button
                  key={t.code}
                  type="button"
                  title={t.label}
                  onClick={() => handleSelectType(t.code)}
                  className={`min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-lg text-base font-medium border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {getTypePillText(t)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Title / summary */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor="advisory-title" className="text-base font-semibold text-slate-900">
              Tên / trích yếu <span className="text-red-600">*</span>
            </label>
            {sources[0] && (
              <button
                type="button"
                onClick={() => {
                  setTitle(buildSuggestedTitle(type, sources[0]))
                  setTitleDirty(false)
                }}
                className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Gợi ý từ VB gốc
              </button>
            )}
          </div>
          <textarea
            id="advisory-title"
            rows={2}
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleDirty(true)
            }}
            placeholder="Nhập tên văn bản (không cần gõ tiền tố loại)..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-slate-600">
            Hiển thị trên báo cáo:{' '}
            <span className={highlight ? 'text-red-700 font-bold' : 'font-medium text-slate-900'}>
              {formatAdvisoryLine({ type, title: title.trim() || '...' })}
            </span>
          </p>
        </div>

        {/* Doc number + Advised date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="advisory-doc-number" className="block text-base font-semibold text-slate-900 mb-1.5">
              Số ký hiệu
            </label>
            <input
              id="advisory-doc-number"
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="VD: 123/TB-BV"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="advisory-date" className="block text-base font-semibold text-slate-900 mb-1.5">
              Ngày tham mưu <span className="text-red-600">*</span>
            </label>
            <input
              id="advisory-date"
              type="date"
              required
              value={advisedDate}
              onChange={(e) => setAdvisedDate(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Target week indicator + override */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-blue-950">
              → tuần giao ban {formatDMY(effectiveWeekId)}
            </span>
            <span className="text-sm text-blue-800">
              Kỳ {formatDM(effectivePeriod.periodStart)}–{formatDM(effectivePeriod.periodEnd)}
              {overrideWeekId ? ' (đang ghi đè)' : ''}
            </span>
          </div>
          <div>
            <label htmlFor="advisory-week-override" className="block text-sm font-medium text-slate-700 mb-1">
              Chọn tuần khác (nếu cần ghi đè)
            </label>
            <select
              id="advisory-week-override"
              value={overrideWeekId}
              onChange={(e) => setOverrideWeekId(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                Tự động theo ngày tham mưu (Giao ban {formatDMY(autoWeekId)})
              </option>
              {weekOptions.map(({ id, period }) => (
                <option key={id} value={id}>
                  Ghi đè → Giao ban {formatDMY(id)} (kỳ {formatDM(period.periodStart)}–{formatDM(period.periodEnd)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linked source documents */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-slate-900">
              Văn bản gốc ({sources.length})
            </span>
            <button
              type="button"
              onClick={() => setShowSourcePicker((v) => !v)}
              className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Link2 className="w-4 h-4 text-blue-600" />
              {showSourcePicker ? 'Đóng chọn VB gốc' : sources.length > 0 ? 'Thay đổi VB gốc' : '+ Gắn văn bản gốc'}
            </button>
          </div>

          {sources.length > 0 ? (
            <div className="space-y-1.5">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-slate-900 break-words">
                      <FileText className="w-4 h-4 inline-block mr-1.5 text-blue-600 -mt-0.5" />
                      {src.docNumber ? `${src.docNumber} — ` : ''}
                      {src.title || `Văn bản #${src.id.slice(-6)}`}
                    </p>
                    {(src.sender || src.issueDate) && (
                      <p className="text-sm text-slate-600 mt-0.5">
                        {[src.sender, src.issueDate ? `ngày ${formatDMY(src.issueDate)}` : '']
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSource(src.id)}
                    aria-label="Gỡ văn bản gốc"
                    title="Gỡ văn bản gốc"
                    className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Không gắn văn bản gốc (có thể bấm &ldquo;+ Gắn văn bản gốc&rdquo; để liên kết ngay hoặc gắn lại sau).
            </p>
          )}

          {showSourcePicker && (
            <div className="pt-2 border-t border-slate-200">
              <SourceDocumentPicker
                selectedIds={sources.map((s) => s.id)}
                onChange={handlePickerChange}
              />
            </div>
          )}
        </div>

        {/* Draft link */}
        <div>
          <label htmlFor="advisory-draft-link" className="block text-base font-semibold text-slate-900 mb-1.5">
            Link bản thảo (Google Drive / Docs)
          </label>
          <input
            id="advisory-draft-link"
            type="text"
            value={draftLink}
            onChange={(e) => setDraftLink(e.target.value)}
            placeholder="https://docs.google.com/..."
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="advisory-note" className="block text-base font-semibold text-slate-900 mb-1.5">
            Ghi chú
          </label>
          <textarea
            id="advisory-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú thêm (không bắt buộc)..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-1 pt-1">
          {!editingDoc && sources.length > 0 && (
            <label className="flex items-center gap-3 min-h-[44px] px-2 rounded-lg hover:bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={markSourceCompleted}
                onChange={(e) => setMarkSourceCompleted(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-base text-slate-800">
                Đánh dấu văn bản gốc đã xử lý xong
              </span>
            </label>
          )}

          <label className="flex items-center gap-3 min-h-[44px] px-2 rounded-lg hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className={highlight ? 'text-base text-red-700 font-bold' : 'text-base text-slate-800'}>
              Tô đỏ (nhấn mạnh đỏ + đậm trong báo cáo)
            </span>
          </label>
        </div>
      </form>
    </ResponsiveModal>
  )
}
