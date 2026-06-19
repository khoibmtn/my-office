'use client'

import { useDocuments } from '@/hooks/useDocuments'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentsPage() {
  const { documents, loading } = useDocuments()

  if (loading) {
    return (
      <main className="p-8 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </main>
    )
  }

  if (documents.length === 0) {
    return (
      <main className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-slate-900">Chưa có văn bản nào</h2>
        <p className="mt-2 text-sm text-slate-500">
          Nhấn &quot;Thêm văn bản&quot; để thêm văn bản đầu tiên.
        </p>
      </main>
    )
  }

  return (
    <main className="p-8">
      <DocumentTable documents={documents} />
    </main>
  )
}
