'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AttachmentInput } from '@/components/documents/AttachmentInput'
import { getDocument, updateDocument, submitDocumentWithDriveCopy } from '@/lib/firestore'
import type { Document, DocumentStatus, AttachmentInput as AttachmentItem } from '@/types'

type AttachmentRow = AttachmentItem & { id: string }

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'pending',     label: 'Chờ xử lý' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'completed',   label: 'Hoàn thành' },
  { value: 'overdue',     label: 'Quá hạn' },
]

export default function EditDocumentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [originalLink, setOriginalLink] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<DocumentStatus>('pending')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('normal')
  const [assignee, setAssignee] = useState('')
  const [tags, setTags] = useState('')
  const [attachments, setAttachments] = useState<AttachmentRow[]>([
    { id: uuid(), title: '', originalLink: '' },
  ])
  const [originalLinkChanged, setOriginalLinkChanged] = useState(false)

  useEffect(() => {
    getDocument(id).then((d) => {
      if (!d) { router.replace('/documents'); return }
      setTitle(d.title)
      setOriginalLink(d.originalLink ?? '')
      setNotes(d.notes ?? '')
      setStatus((d.status === 'uploading' || d.status === 'upload_failed') ? 'pending' : d.status as DocumentStatus)
      setAssignee(d.assignee ?? '')
      setPriority(d.priority ?? 'normal')
      setTags((d.tags ?? []).join(', '))
      if (d.deadline) {
        const date = (d.deadline as { toDate(): Date }).toDate()
        setDeadline(date.toISOString().split('T')[0])
      }
      const existingAtts = (d.attachments ?? []).map((a) => ({
        id: uuid(),
        title: a.title ?? '',
        originalLink: a.originalLink ?? '',
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
      await updateDocument(id, {
        title,
        originalLink,
        notes: notes || undefined,
        status,
        assignee: assignee || undefined,
        priority: priority || 'normal',
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        deadline: deadline ? new Date(deadline) : undefined,
      })

      // Re-trigger Drive copy if link changed or upload failed
      if (originalLinkChanged || status === 'upload_failed') {
        const atts = attachments
          .filter((a) => a.originalLink)
          .map(({ title, originalLink }) => ({ title, originalLink }))
        submitDocumentWithDriveCopy(id, originalLink, atts)
      }

      router.push('/documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Sửa văn bản</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="title">Tiêu đề *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="originalLink">Link file chính *</Label>
          <Input
            id="originalLink"
            value={originalLink}
            onChange={(e) => { setOriginalLink(e.target.value); setOriginalLinkChanged(true) }}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="notes">Ghi chú</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="status">Trạng thái</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as DocumentStatus)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="priority">Mức độ khẩn</Label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="normal">Thường</option>
            <option value="urgent">Khẩn</option>
            <option value="very_urgent">Thượng khẩn</option>
            <option value="express">Hỏa tốc</option>
            <option value="express_scheduled">Hỏa tốc hẹn giờ</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="assignee">Người nhận</Label>
          <Input id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" placeholder="Phân cách bằng dấu phẩy" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <Label>Đính kèm</Label>
          <AttachmentInput value={attachments} onChange={setAttachments} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {error && <p className="text-sm text-red-600 self-center mr-auto">{error}</p>}
          <Button type="button" variant="outline" onClick={() => router.back()}>Hủy</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </div>
  )
}
