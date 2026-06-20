import { liteClient } from 'algoliasearch/lite'

let _client: ReturnType<typeof liteClient> | null = null

function getClient() {
  if (!_client) {
    _client = liteClient(
      process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
      process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
    )
  }
  return _client
}

export const INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ?? 'documents'

export function searchClient() {
  return getClient()
}
