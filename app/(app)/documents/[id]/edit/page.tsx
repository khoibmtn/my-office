'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { toLocalISODate } from '@/lib/utils'
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
  const [sender, setSender] = useState('')
  const [leader, setLeader] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<DocumentStatus>('pending')
  const [deadline, setDeadline] = useState('')
  const [completedDate, setCompletedDate] = useState('')
  const [issueDate, setIssueDate] = useState('')
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
      setOriginalLink(d.driveViewUrl || d.originalLink || '')
      setSender(d.sender ?? '')
      setLeader(d.leader ?? '')
      setNotes(d.notes ?? '')
      setStatus((d.status === 'uploading' || d.status === 'upload_failed') ? 'pending' : d.status as DocumentStatus)
      setAssignee(d.assignee ?? '')
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
      // Synchronous Drive copy if link changed or upload failed
      if (originalLinkChanged || status === 'upload_failed') {
        const atts = attachments
          .filter((a) => a.originalLink)
          .map(({ title, originalLink }) => ({ title, originalLink }))
        try {
          // If it is NOT a Google Drive link, the backend will try to upload it
          await submitDocumentWithDriveCopy(id, originalLink, atts)
        } catch (err) {
          const keep = confirm('Tải file gốc lên hệ thống Google Drive thất bại.\n\nBạn có muốn giữ nguyên các link (URL) gốc làm link đích (và lưu vào CSDL) không?\n\n- Chọn OK để giữ link gốc và thoát.\n- Chọn Cancel để ở lại màn hình này chỉnh sửa tiếp.')
          if (!keep) {
            setSaving(false)
            return
          } else {
            // User chose to keep original links. Update driveViewUrl to point to the external link.
            await updateDocument(id, { driveViewUrl: originalLink, mimeType: 'url' })
            // Note: attachments are not updated with driveViewUrl=originalLink here, but they will be accessed via originalLink if driveViewUrl fails
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

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sender">Cơ quan ban hành</Label>
            <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="leader">Lãnh đạo</Label>
            <Input id="leader" value={leader} onChange={(e) => setLeader(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="notes">Ghi chú cá nhân</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú thêm (không hiển thị trong extension)..." />
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
          <Label htmlFor="completedDate">Ngày hoàn thành</Label>
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
          />
          {completedDate && issueDate && completedDate < issueDate && (
            <span className="text-red-500 text-xs">Ngày hoàn thành phải &gt;= ngày ban hành</span>
          )}
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
