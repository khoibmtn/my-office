'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AttachmentInput } from './AttachmentInput'
import { submitDocumentWithDriveCopy, createDocument } from '@/lib/firestore'
import type { AttachmentInput as AttachmentInputItem, DocumentStatus } from '@/types'
import { v4 as uuid } from 'uuid'

type AttachmentRow = AttachmentInputItem & { id: string }

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'overdue', label: 'Quá hạn' },
]

export function DocumentForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [originalLink, setOriginalLink] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<DocumentStatus>('pending')
  const [deadline, setDeadline] = useState('')
  const [assignee, setAssignee] = useState('')
  const [tags, setTags] = useState('')
  const [attachments, setAttachments] = useState<AttachmentRow[]>([
    { id: uuid(), title: '', originalLink: '' },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const docId = await createDocument({
        title,
        originalLink,
        notes: notes || undefined,
        assignee: assignee || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        attachmentInputs: attachments.map(({ title, originalLink }) => ({
          title,
          originalLink,
        })),
      })
      router.push('/')
      submitDocumentWithDriveCopy(
        docId,
        originalLink,
        attachments.map(({ title, originalLink }) => ({ title, originalLink }))
      )
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="title">Tiêu đề *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="originalLink">Link file chính *</Label>
        <Input
          id="originalLink"
          value={originalLink}
          onChange={(e) => setOriginalLink(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="notes">Ghi chú</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="deadline">Deadline</Label>
        <Input
          id="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="assignee">Người nhận</Label>
        <Input
          id="assignee"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          placeholder="Phân cách bằng dấu phẩy"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Đính kèm</Label>
        <AttachmentInput value={attachments} onChange={setAttachments} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Hủy thao tác
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Lưu văn bản
        </Button>
      </div>
    </form>
  )
}
