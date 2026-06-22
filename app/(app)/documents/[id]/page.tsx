'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getDocument } from '@/lib/firestore'
import { DocumentViewer } from '@/components/documents/DocumentViewer'
import type { Document } from '@/types'

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<Document | null | undefined>(undefined)

  useEffect(() => {
    getDocument(id).then(setDoc)
  }, [id])

  if (doc === undefined) return (
    <div className="p-8 flex justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
  if (doc === null) return <div className="p-8 text-slate-500">Không tìm thấy văn bản.</div>
  return <DocumentViewer doc={doc} />
}
