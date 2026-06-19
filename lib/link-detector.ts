export type LinkType = 'drive' | 'docs' | 'url'

export interface DetectResult {
  type: LinkType
  fileId: string | null
}

export function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export function detectLinkType(url: string): DetectResult {
  const { hostname } = new URL(url)
  if (hostname === 'drive.google.com') return { type: 'drive', fileId: extractDriveFileId(url) }
  if (hostname === 'docs.google.com') return { type: 'docs', fileId: extractDriveFileId(url) }
  return { type: 'url', fileId: null }
}
