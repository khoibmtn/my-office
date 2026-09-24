'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Loader2,
  ArrowLeft,
  FileText,
  StickyNote,
  Settings2,
  Users,
  Paperclip,
  AlertCircle,
  Eye,
  ExternalLink,
  Folder,
  X,
  Upload,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { toLocalISODate, getStructuredMainFileName } from '@/lib/utils'
import { extractDriveFileId } from '@/lib/link-detector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AttachmentInput } from '@/components/documents/AttachmentInput'
import { QuickDossierTagPicker } from '@/components/documents/QuickDossierTagPicker'
import { getDocument, updateDocument, submitDocumentWithDriveCopy } from '@/lib/firestore'
import { usePermissions } from '@/hooks/usePermissions'
import { useStaff } from '@/hooks/useStaff'
import { CoAssigneePicker } from '@/components/documents/CoAssigneePicker'
import type { Document, DocumentStatus, AttachmentInput as AttachmentItem } from '@/types'

type AttachmentRow = AttachmentItem & { id: string }

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'pending',     label: 'Chờ xử lý' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'completed',   label: 'Hoàn thành' },
  { value: 'overdue',     label: 'Quá hạn' },
]

/* ── Helper to convert URL to embeddable preview URL ── */
function toEmbedUrl(url: string, driveViewUrl?: string): string {
  if (!url) return ''
  const trimmed = url.trim()

  const driveId = extractDriveFileId(trimmed)
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`
  }

  if (driveViewUrl && driveViewUrl.includes('drive.google.com')) {
    return driveViewUrl
  }

  if (trimmed.includes('docs.google.com')) {
    const docMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (docMatch) {
      if (trimmed.includes('/spreadsheets/')) {
        return `https://docs.google.com/spreadsheets/d/${docMatch[1]}/preview`
      }
      if (trimmed.includes('/presentation/')) {
        return `https://docs.google.com/presentation/d/${docMatch[1]}/preview`
      }
      return `https://docs.google.com/document/d/${docMatch[1]}/preview`
    }
  }

  return trimmed
}

/* ── Reusable section card (NO overflow-hidden to prevent clipping dropdowns) ── */
function SectionCard({
  icon: Icon,
  iconColor,
  title,
  children,
  className = '',
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-xs ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
        <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {children}
      </div>
    </section>
  )
}

export default function EditDocumentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const perms = usePermissions()
  const { staff } = useStaff()
  const activeStaff = staff.filter(s => s.isActive)

  // Permission guard
  useEffect(() => {
    if (!perms.loading && !perms.canEditDocument) {
      router.replace('/documents')
    }
  }, [perms.loading, perms.canEditDocument, router])

  const [fullDoc, setFullDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [originalLink, setOriginalLink] = useState('')
  const [sender, setSender] = useState('')
  const [leader, setLeader] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<DocumentStatus>('pending')
  const [deadline, setDeadline] = useState('')
  const [completedDate, setCompletedDate] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [priority, setPriority] = useState('normal')
  const [assignee, setAssignee] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [coAssigneeIds, setCoAssigneeIds] = useState<string[]>([])
  const [dossierIds, setDossierIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [tags, setTags] = useState('')
  const [attachments, setAttachments] = useState<AttachmentRow[]>([
    { id: uuid(), title: '', originalLink: '' },
  ])
  const [originalLinkChanged, setOriginalLinkChanged] = useState(false)
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Preview panel state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>('')
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null)

  const handleTogglePreview = (url: string, fileTitle?: string, key: string = 'main') => {
    if (!url) return
    if (activePreviewKey === key) {
      handleClosePreview()
      return
    }
    const embed = toEmbedUrl(url, key === 'main' ? fullDoc?.driveViewUrl : undefined)
    setPreviewUrl(embed)
    setPreviewTitle(fileTitle || 'Xem trước tài liệu')
    setActivePreviewKey(key)
  }

  const handleClosePreview = () => {
    setPreviewUrl(null)
    setPreviewTitle('')
    setActivePreviewKey(null)
  }

  const handleAssigneeChange = (id: string) => {
    setAssigneeId(id)
    const member = activeStaff.find(s => s.id === id)
    setAssignee(member?.shortName || '')
    if (id) {
      setCoAssigneeIds(prev => prev.filter(item => item !== id))
    }
  }

  useEffect(() => {
    getDocument(id).then((d) => {
      if (!d) { router.replace('/documents'); return }
      setFullDoc(d)
      setTitle(d.title)
      setOriginalLink(d.driveViewUrl || d.originalLink || '')
      setSender(d.sender ?? '')
      setLeader(d.leader ?? '')
      setNotes(d.notes ?? '')
      setStatus((d.status === 'uploading' || d.status === 'upload_failed') ? 'pending' : d.status as DocumentStatus)
      setAssignee(d.assignee ?? '')
      setAssigneeId(d.assigneeId ?? '')
      setCoAssigneeIds(d.coAssigneeIds ?? [])
      setDossierIds(d.dossierIds ?? [])
      setTagIds(d.tagIds ?? [])
      setPriority(d.priority ?? 'normal')
      setTags((d.tags ?? []).join(', '))
      if (d.deadline) {
        setDeadline(toLocalISODate(d.deadline))
      }
      if (d.completedDate) {
        setCompletedDate(toLocalISODate(d.completedDate))
      }
      if (d.issueDate) {
        setIssueDate(toLocalISODate(d.issueDate))
      }
      const existingAtts = (d.attachments ?? []).map((a) => ({
        id: uuid(),
        title: a.title ?? '',
        originalLink: a.driveViewUrl || a.originalLink || '',
      }))
      setAttachments(existingAtts.length > 0 ? existingAtts : [{ id: uuid(), title: '', originalLink: '' }])
      setLoading(false)
    })
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // Handle file upload first
      if (mainFile) {
        setUploading(true)
        try {
          // Build structured filename: YYYYMMDD-DocNumber.ext
          const docForName = {
            issueDate: issueDate ? { toDate: () => new Date(issueDate + 'T00:00:00') } : fullDoc?.issueDate,
            docNumber: fullDoc?.docNumber,
            mimeType: mainFile.type,
          }
          const structuredName = getStructuredMainFileName(docForName)
          // Determine the actual extension from the uploaded file
          const origExt = mainFile.name.includes('.') ? '.' + mainFile.name.split('.').pop() : ''
          const hasExt = structuredName.includes('.')
          const uploadName = hasExt ? structuredName : (structuredName + origExt)
          // Rename file for upload
          const renamedFile = new File([mainFile], uploadName || mainFile.name, { type: mainFile.type })

          const token = localStorage.getItem('google_access_token')
          const form = new FormData()
          form.append('file', renamedFile)
          form.append('folderId', process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID ?? '')
          if (token) form.append('userAccessToken', token)
          const res = await fetch('/api/drive/upload', { method: 'POST', body: form })
          if (!res.ok) throw new Error(await res.text())
          const { driveFileId, driveViewUrl, mimeType: uploadedMime } = await res.json()
          const driveLink = `https://drive.google.com/file/d/${driveFileId}/preview`
          setOriginalLink(driveLink)
          // Update Firestore with the new Drive info directly
          await updateDocument(id, {
            originalLink: driveLink,
            driveFileId,
            driveViewUrl: driveLink,
            mimeType: uploadedMime || mainFile.type,
            status: 'pending',
          })
          setMainFile(null)
          // Skip the Drive copy step since we already uploaded
          setOriginalLinkChanged(false)
        } catch (uploadErr) {
          setError(`Lỗi upload file: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`)
          setSaving(false)
          setUploading(false)
          return
        } finally {
          setUploading(false)
        }
      }

      // Synchronous Drive copy if link changed or upload failed
      if (originalLinkChanged || status === 'upload_failed') {
        const atts = attachments
          .filter((a) => a.originalLink)
          .map(({ title, originalLink }) => ({ title, originalLink }))
        try {
          await submitDocumentWithDriveCopy(id, originalLink, atts)
        } catch (err) {
          const keep = confirm('Tải file gốc lên hệ thống Google Drive thất bại.\n\nBạn có muốn giữ nguyên các link (URL) gốc làm link đích (và lưu vào CSDL) không?\n\n- Chọn OK để giữ link gốc và thoát.\n- Chọn Cancel để ở lại màn hình này chỉnh sửa tiếp.')
          if (!keep) {
            setSaving(false)
            return
          } else {
            await updateDocument(id, { driveViewUrl: originalLink, mimeType: 'url' })
          }
        }
      }

      const effectiveStatus = completedDate ? 'completed' : (status === 'completed' ? 'pending' : status)

      await updateDocument(id, {
        title,
        originalLink,
        sender: sender || undefined,
        leader: leader || undefined,
        notes: notes || undefined,
        status: effectiveStatus,
        assignee: assignee || undefined,
        assigneeId: assigneeId || undefined,
        coAssigneeIds,
        dossierIds,
        tagIds,
        priority: priority || 'normal',
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        deadline: deadline ? new Date(deadline + 'T00:00:00') : null,
        completedDate: completedDate ? new Date(completedDate + 'T00:00:00') : null,
        issueDate: issueDate ? new Date(issueDate + 'T00:00:00') : null,
      })

      router.push('/documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        <span className="text-sm text-slate-400">Đang tải văn bản…</span>
      </div>
    </div>
  )

  const isMainActive = activePreviewKey === 'main'

  /* ── 6 Card Blocks ── */
  const cardInfo = (
    <SectionCard icon={FileText} iconColor="text-blue-500" title="Thông tin văn bản">
      <div className="flex flex-col gap-1">
        <Label htmlFor="title" className="text-xs font-medium text-slate-600">
          Tiêu đề <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-9 text-xs"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="originalLink" className="text-xs font-medium text-slate-600">
          Link file chính <span className="text-red-400">*</span>
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="originalLink"
            value={originalLink}
            onChange={(e) => { setOriginalLink(e.target.value); setOriginalLinkChanged(true) }}
            required
            placeholder="https://drive.google.com/..."
            className="flex-1 h-9 text-xs"
          />
          {originalLink && (
            <>
              <Button
                type="button"
                variant={isMainActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTogglePreview(originalLink, title || 'File chính', 'main')}
                className={`h-9 px-2.5 text-xs shrink-0 font-medium ${
                  isMainActive
                    ? 'bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs border border-blue-600'
                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title={isMainActive ? 'Đang xem file này (bấm để đóng xem trước)' : 'Xem trước file này ở panel bên cạnh'}
              >
                <Eye className={`h-3.5 w-3.5 mr-1 ${isMainActive ? 'text-white' : ''}`} />
                {isMainActive ? 'Đang xem' : 'Xem'}
              </Button>
              <a
                href={originalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shrink-0 transition-colors"
                title="Mở trong tab mới"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>

        <div className="mt-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">hoặc</span>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 cursor-pointer hover:text-blue-700 hover:underline font-medium">
              <Upload className="h-3.5 w-3.5" />
              Tải file lên trực tiếp (upload lên Google Drive)
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setMainFile(file)
                  if (file) setOriginalLinkChanged(false)
                }}
              />
            </label>
          </div>
          {mainFile && (
            <div className="mt-1.5 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Upload className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-emerald-800 truncate block">{mainFile.name}</span>
                <span className="text-[10px] text-emerald-600">
                  {(mainFile.size / 1024).toFixed(0)} KB — Sẽ upload lên Google Drive khi bấm Lưu
                  {fullDoc?.docNumber && (
                    <> · Đổi tên: <strong>{(() => {
                      const docForName = {
                        issueDate: issueDate ? { toDate: () => new Date(issueDate + 'T00:00:00') } : fullDoc?.issueDate,
                        docNumber: fullDoc?.docNumber,
                        mimeType: mainFile.type,
                      }
                      const structuredName = getStructuredMainFileName(docForName)
                      const origExt = mainFile.name.includes('.') ? '.' + mainFile.name.split('.').pop() : ''
                      return structuredName.includes('.') ? structuredName : structuredName + origExt
                    })()}</strong></>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMainFile(null)}
                className="p-1 text-emerald-400 hover:text-red-500 rounded transition-colors"
                title="Hủy file đã chọn"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {uploading && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Đang upload file lên Google Drive...</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sender" className="text-xs font-medium text-slate-600">Cơ quan ban hành</Label>
          <Input
            id="sender"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="leader" className="text-xs font-medium text-slate-600">Lãnh đạo</Label>
          <Input
            id="leader"
            value={leader}
            onChange={(e) => setLeader(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>
    </SectionCard>
  )

  const cardAttachments = (
    <SectionCard icon={Paperclip} iconColor="text-violet-500" title="File đính kèm">
      <AttachmentInput
        value={attachments}
        onChange={(items) => {
          setAttachments(items)
          if (activePreviewKey && activePreviewKey !== 'main' && !items.some(it => it.id === activePreviewKey)) {
            handleClosePreview()
          }
        }}
        onPreview={(url, fileTitle, id) => handleTogglePreview(url, fileTitle, id || 'att')}
        activePreviewId={activePreviewKey}
      />
    </SectionCard>
  )

  const cardNotes = (
    <SectionCard icon={StickyNote} iconColor="text-amber-500" title="Ghi chú cá nhân">
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ghi chú thêm (chỉ lưu nội bộ)..."
        className="min-h-[72px] text-xs resize-y leading-relaxed"
      />
    </SectionCard>
  )

  const cardStatus = (
    <SectionCard icon={Settings2} iconColor="text-emerald-500" title="Trạng thái & Thời hạn">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="status" className="text-xs font-medium text-slate-600">Trạng thái</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as DocumentStatus)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-700"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="priority" className="text-xs font-medium text-slate-600">Mức độ khẩn</Label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-700"
          >
            <option value="normal">Thường</option>
            <option value="urgent">Khẩn</option>
            <option value="very_urgent">Thượng khẩn</option>
            <option value="express">Hỏa tốc</option>
            <option value="express_scheduled">Hỏa tốc hẹn giờ</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="issueDate" className="text-[11px] font-medium text-slate-600">Ngày ban hành</Label>
          <Input
            id="issueDate"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="h-9 text-xs px-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="deadline" className="text-[11px] font-medium text-slate-600">Deadline</Label>
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-9 text-xs px-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="completedDate" className="text-[11px] font-medium text-slate-600">Hoàn thành</Label>
          <Input
            id="completedDate"
            type="date"
            value={completedDate}
            min={issueDate || undefined}
            onChange={(e) => {
              setCompletedDate(e.target.value)
              if (e.target.value) {
                setStatus('completed')
              } else if (status === 'completed') {
                setStatus(assignee ? 'in_progress' : 'pending')
              }
            }}
            className="h-9 text-xs px-2"
          />
        </div>
      </div>
      {completedDate && issueDate && completedDate < issueDate && (
        <span className="text-red-500 text-[11px] flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Ngày hoàn thành phải &gt;= ngày ban hành
        </span>
      )}
    </SectionCard>
  )

  const cardAssignment = (
    <SectionCard
      icon={Users}
      iconColor="text-indigo-500"
      title="Phân công"
      className="relative z-30"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="assignee" className="text-xs font-medium text-slate-600">
          Người thực hiện chính
        </Label>
        <select
          id="assignee"
          value={assigneeId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
        >
          <option value="">-- Chưa giao --</option>
          {activeStaff.map(s => (
            <option key={s.id} value={s.id}>{s.shortName} — {s.fullName}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-slate-600">
          Người phối hợp <span className="text-slate-400 font-normal text-[11px]">(Nhiều người, chỉ xem)</span>
        </Label>
        <CoAssigneePicker
          allStaff={staff}
          mainAssigneeId={assigneeId}
          value={coAssigneeIds}
          onChange={setCoAssigneeIds}
          placeholder="Tìm và gắp người phối hợp..."
        />
      </div>
    </SectionCard>
  )

  const cardDossiers = (
    <SectionCard icon={Folder} iconColor="text-amber-600" title="Hồ sơ & Phân loại">
      {fullDoc ? (
        <div className="pt-0.5">
          <QuickDossierTagPicker
            document={fullDoc}
            onUpdate={(fields) => {
              setFullDoc(prev => prev ? { ...prev, ...fields } : prev)
              if (fields.dossierIds) setDossierIds(fields.dossierIds)
              if (fields.tagIds) setTagIds(fields.tagIds)
            }}
            readOnly={!perms.canEditDocument}
          />
        </div>
      ) : (
        <div className="text-xs text-slate-400 py-2">Đang tải thông tin hồ sơ...</div>
      )}
    </SectionCard>
  )

  return (
    <div className={`mx-auto py-5 px-4 sm:px-6 transition-all duration-300 ${
      previewUrl ? 'max-w-[1720px]' : 'max-w-5xl'
    }`}>
      {/* ── Page Header & Breadcrumb ── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-1.5 group cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Quay lại danh sách
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-900">Sửa văn bản</h1>
            {title && (
              <span className="text-xs text-slate-500 max-w-[360px] truncate hidden md:inline-block font-normal">
                • {title}
              </span>
            )}
          </div>
        </div>

        {/* Header Action Buttons (Quick Save) */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="h-8 px-3 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="h-8 px-4 text-xs font-semibold shadow-xs"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang lưu…
              </span>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
        </div>
      </div>

      {/* ── Main Container: Form + Optional Side Preview ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Form Container */}
        <form
          onSubmit={handleSubmit}
          className={`${
            previewUrl
              ? 'w-full lg:w-[480px] xl:w-[540px] 2xl:w-[580px] shrink-0'
              : 'flex-1 min-w-0 w-full'
          } flex flex-col gap-4`}
        >
          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Cards: 1 column when preview is open (no cramped controls!), 2 columns when preview is closed */}
          {previewUrl ? (
            <div className="flex flex-col gap-4 w-full">
              {cardInfo}
              {cardStatus}
              {cardAssignment}
              {cardDossiers}
              {cardAttachments}
              {cardNotes}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="flex flex-col gap-4 min-w-0">
                {cardInfo}
                {cardAttachments}
                {cardNotes}
              </div>
              <div className="flex flex-col gap-4 min-w-0">
                {cardStatus}
                {cardAssignment}
                {cardDossiers}
              </div>
            </div>
          )}

          {/* ── Sticky Bottom Action Bar ── */}
          <div className="flex justify-end items-center gap-2.5 pt-3 pb-3 sticky bottom-0 bg-slate-50/95 backdrop-blur-xs border-t border-slate-200/80 -mx-4 px-4 sm:-mx-6 sm:px-6 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="h-8 px-3 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-8 px-4 text-xs font-semibold shadow-xs"
            >
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang lưu…
                </span>
              ) : (
                'Lưu thay đổi'
              )}
            </Button>
          </div>
        </form>

        {/* ── Right: Sticky Preview Panel (When active, takes remaining width) ── */}
        {previewUrl && (
          <aside className="w-full flex-1 min-w-0 sticky top-4 h-[calc(100vh-60px)] flex flex-col bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate" title={previewTitle}>
                  {previewTitle || 'Xem trước tài liệu'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                  title="Đóng khung xem trước"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Preview Iframe Body */}
            <div className="flex-1 bg-slate-100 relative">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview"
                allow="fullscreen"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
