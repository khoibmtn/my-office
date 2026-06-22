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
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [mainFile, setMainFile] = useState<File | null>(null)

  async function uploadFileToDrive(file: File): Promise<string> {
    const token = localStorage.getItem('google_access_token')
    const form = new FormData()
    form.append('file', file)
    form.append('folderId', process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID ?? '')
    if (token) form.append('userAccessToken', token)
    const res = await fetch('/api/drive/upload', { method: 'POST', body: form })
    if (!res.ok) throw new Error(await res.text())
    const { driveFileId } = await res.json()
    return `https://drive.google.com/file/d/${driveFileId}/view`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      let link = originalLink
      if (mainFile) {
        link = await uploadFileToDrive(mainFile)
      }
      const docId = await createDocument({
        title,
        originalLink: link,
        notes: notes || undefined,
        assignee: assignee || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        attachmentInputs: attachments.map(({ title, originalLink }) => ({
          title,
          originalLink,
        })),
      })
      router.push('/')
      if (!mainFile) {
        submitDocumentWithDriveCopy(
          docId,
          link,
          attachments.map(({ title, originalLink }) => ({ title, originalLink }))
        )
      }
    } catch (err) {
      console.error('Submit error:', err)
      setSubmitError(err instanceof Error ? err.message : String(err))
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
        <Label htmlFor="originalLink">Link file chính {!mainFile && '*'}</Label>
        <Input
          id="originalLink"
          value={originalLink}
          onChange={(e) => setOriginalLink(e.target.value)}
          required={!mainFile}
          placeholder="https://..."
        />
        {originalLink.includes('qlvb.hpnet.vn') && !mainFile && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            ⚠️ Link từ <b>qlvb.hpnet.vn</b> yêu cầu đăng nhập — server không thể tải tự động.
            Hãy tải file về máy rồi chọn <b>&quot;Tải file lên trực tiếp&quot;</b> bên dưới.
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-400">hoặc</span>
          <label className="text-xs text-blue-600 cursor-pointer hover:underline">
            Tải file lên trực tiếp
            <input type="file" className="hidden" onChange={(e) => setMainFile(e.target.files?.[0] ?? null)} />
          </label>
          {mainFile && (
            <span className="text-xs text-slate-600 flex items-center gap-1">
              📎 {mainFile.name}
              <button type="button" onClick={() => setMainFile(null)} className="text-slate-400 hover:text-red-500 ml-1">✕</button>
            </span>
          )}
        </div>
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
        {submitError && (
          <p className="text-sm text-red-600 self-center mr-auto">{submitError}</p>
        )}
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
