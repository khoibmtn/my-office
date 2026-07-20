'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentForm } from '@/components/documents/DocumentForm'
import { usePermissions } from '@/hooks/usePermissions'

export default function NewDocumentPage() {
  const perms = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!perms.loading && !perms.canAddDocument) {
      router.replace('/documents')
    }
  }, [perms.loading, perms.canAddDocument, router])

  if (perms.loading || !perms.canAddDocument) return null

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-6">Thêm văn bản</h1>
      <DocumentForm />
    </div>
  )
}
