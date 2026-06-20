'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AlgoliaHit } from '@/hooks/useSearch'

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  upload_failed: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabels: Record<string, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  completed: 'Hoàn thành',
  upload_failed: 'Lỗi upload',
}

const fmt = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function SearchResultCard({ hit }: { hit: AlgoliaHit }) {
  const titleHtml = hit._highlightResult?.title?.value ?? hit.title

  return (
    <Link href={`/documents/${hit.objectID}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 space-y-2">
          <div
            className="font-medium text-slate-900 [&_em]:font-semibold [&_em]:text-blue-600 [&_em]:not-italic"
            dangerouslySetInnerHTML={{ __html: titleHtml }}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge className={statusStyles[hit.status] ?? 'bg-slate-100 text-slate-700'}>
              {statusLabels[hit.status] ?? hit.status}
            </Badge>
            {hit.deadline != null && (
              <span>{fmt.format(new Date(hit.deadline))}</span>
            )}
            {hit.assignee && <span>{hit.assignee}</span>}
            {hit.attachmentCount > 0 && (
              <span className="ml-auto">📎 {hit.attachmentCount}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
