'use client'

import React, { Suspense, useState } from 'react'
import { useDocuments } from '@/hooks/useDocuments'
import { useRole } from '@/hooks/useRole'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { AdvisoryForm } from '@/components/weekly-report/AdvisoryForm'
import { Skeleton } from '@/components/ui/skeleton'
import type { Document } from '@/types'

function DocumentsContent() {
  const { documents, loading } = useDocuments()
  const { isAdmin } = useRole()
  const [adviseDoc, setAdviseDoc] = useState<Document | null>(null)

  if (loading) {
    return (
      <main className="p-4 lg:p-6 xl:p-8 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </main>
    )
  }

  if (documents.length === 0) {
    return (
      <main className="p-4 lg:p-6 xl:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-slate-900">Chưa có văn bản nào</h2>
        <p className="mt-2 text-sm text-slate-500">
          Nhấn &quot;Thêm văn bản&quot; để thêm văn bản đầu tiên.
        </p>
      </main>
    )
  }

  return (
    <main className="p-4 lg:p-6 xl:p-8">
      <DocumentTable documents={documents} onAdvise={isAdmin ? setAdviseDoc : undefined} />
      {isAdmin && (
        <AdvisoryForm
          open={!!adviseDoc}
          onClose={() => setAdviseDoc(null)}
          sourceDocument={adviseDoc}
        />
      )}
    </main>
  )
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <main className="p-4 lg:p-6 xl:p-8 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </main>
    }>
      <DocumentsContent />
    </Suspense>
  )
}
