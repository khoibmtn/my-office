'use client'

import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Document, DocumentStatus } from '@/types'

function formatDate(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  const d = ts.toDate()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function isOverdue(ts: { toDate(): Date } | undefined): boolean {
  if (!ts) return false
  return ts.toDate() < new Date()
}

const STATUS_MAP: Record<DocumentStatus, { label: string; className: string }> = {
  pending:       { label: 'Chờ xử lý',       className: 'bg-slate-100 text-slate-600' },
  in_progress:   { label: 'Đang xử lý',       className: 'bg-blue-100 text-blue-700' },
  completed:     { label: 'Hoàn thành',        className: 'bg-green-100 text-green-700' },
  overdue:       { label: 'Quá hạn',           className: 'bg-red-100 text-red-600' },
  uploading:     { label: 'Đang tải lên...',   className: 'bg-slate-100 text-slate-500' },
  upload_failed: { label: 'Tải lên thất bại', className: 'bg-red-100 text-red-600' },
}

export function DocumentTable({ documents }: { documents: Document[] }) {
  const router = useRouter()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30%]">Tiêu đề</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Người nhận</TableHead>
          <TableHead>📎</TableHead>
          <TableHead>Ngày tạo</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const s = STATUS_MAP[doc.status]
          const overdue = isOverdue(doc.deadline)

          return (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.title}</TableCell>
              <TableCell>
                {doc.status === 'uploading' ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {s.label}
                  </span>
                ) : (
                  <Badge className={s.className}>{s.label}</Badge>
                )}
              </TableCell>
              <TableCell className={overdue ? 'text-red-600' : ''}>
                {formatDate(doc.deadline)}
              </TableCell>
              <TableCell>{doc.assignee ?? '—'}</TableCell>
              <TableCell>
                {doc.attachments?.length > 0 ? `📎 ${doc.attachments.length}` : ''}
              </TableCell>
              <TableCell>{formatDate(doc.createdAt)}</TableCell>
              <TableCell>
                {doc.status === 'uploading' ? (
                  <Button size="sm" disabled>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Button>
                ) : doc.status === 'upload_failed' ? (
                  <Button size="sm" variant="outline">Thử lại</Button>
                ) : (
                  <Button size="sm" onClick={() => router.push(`/documents/${doc.id}`)}>
                    Xem trước
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
