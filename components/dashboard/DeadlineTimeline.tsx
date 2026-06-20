'use client'

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useDeadlineDocuments } from '@/hooks/useDeadlineDocuments'
import { Timestamp } from 'firebase/firestore'

function getDaysRemaining(deadline: Timestamp): number {
  return Math.ceil((deadline.toDate().getTime() - Date.now()) / 86400000)
}

function deadlineColor(days: number): string {
  if (days <= 1) return 'text-red-600'
  if (days <= 3) return 'text-orange-500'
  return 'text-muted-foreground'
}

export function DeadlineTimeline() {
  const { documents, loading } = useDeadlineDocuments()

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Hạn sắp đến (7 ngày tới)</h2>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">Không có văn bản nào đến hạn trong 7 ngày tới</p>
      ) : (
        <div className="divide-y">
          {documents.map((doc) => {
            const days = doc.deadline ? getDaysRemaining(doc.deadline) : null
            return (
              <div key={doc.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span>📄</span>
                  <Link href={`/documents/${doc.id}`} className="font-medium truncate hover:underline">
                    {doc.title}
                  </Link>
                  {doc.assignee && (
                    <span className="text-muted-foreground text-sm hidden sm:inline">· {doc.assignee}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {days !== null && (
                    <span className={`text-sm ${deadlineColor(days)}`}>còn {days} ngày</span>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/documents/${doc.id}`}>Xem</Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
