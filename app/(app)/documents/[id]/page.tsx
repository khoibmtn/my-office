import { notFound } from 'next/navigation'
import { getDocument } from '@/lib/firestore'
import { DocumentViewer } from '@/components/documents/DocumentViewer'

interface Props {
  params: { id: string }
}

export default async function DocumentPage({ params }: Props) {
  const document = await getDocument(params.id)
  if (!document) notFound()
  return <DocumentViewer doc={document} />
}
