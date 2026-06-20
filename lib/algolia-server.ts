import 'server-only'
import { algoliasearch } from 'algoliasearch'
import { getDocument } from './firestore'

export type AlgoliaDocSchema = {
  objectID: string
  title: string
  notes: string
  textSnippet: string
  status: string
  assignee: string
  deadline: number | null
  tags: string[]
  attachmentCount: number
}

const INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ?? 'documents'

function getClient() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
  const adminKey = process.env.ALGOLIA_ADMIN_KEY
  if (!appId || !adminKey) return null
  return algoliasearch(appId, adminKey)
}

export async function syncToAlgolia(
  docId: string,
  doc: Partial<AlgoliaDocSchema>
): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('syncToAlgolia: missing Algolia env vars, skipping sync')
    return
  }
  try {
    await client.saveObject({
      indexName: INDEX_NAME,
      body: { objectID: docId, ...doc } as Record<string, unknown>,
    })
  } catch (e) {
    console.error('syncToAlgolia error:', e)
  }
}

export async function partialUpdateAlgoliaStatus(
  docId: string,
  status: string
): Promise<void> {
  const client = getClient()
  if (!client) return
  try {
    await client.partialUpdateObject({
      indexName: INDEX_NAME,
      objectID: docId,
      attributesToUpdate: { status },
    })
  } catch (e) {
    console.error('partialUpdateAlgoliaStatus error:', e)
  }
}

export async function syncAfterDriveUpdate(docId: string): Promise<void> {
  try {
    const doc = await getDocument(docId)
    if (!doc) return
    await syncToAlgolia(docId, {
      objectID: docId,
      title: doc.title ?? '',
      notes: doc.notes ?? '',
      textSnippet: (doc.notes ?? '').slice(0, 500),
      status: doc.status ?? 'pending',
      assignee: doc.assignee ?? '',
      deadline: (doc.deadline as { toMillis?: () => number } | null)?.toMillis?.() ?? null,
      tags: doc.tags ?? [],
      attachmentCount: (doc.attachments ?? []).length,
    })
  } catch (e) {
    console.error('syncAfterDriveUpdate error:', e)
  }
}
