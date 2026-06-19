import { describe, it, expect } from 'vitest'
import { detectLinkType, extractDriveFileId } from './link-detector'

describe('extractDriveFileId', () => {
  it('extracts file ID from drive URL with trailing path', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/ABC123/view')).toBe('ABC123')
  })
  it('extracts file ID from drive URL without trailing path', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/ABC123')).toBe('ABC123')
  })
  it('returns null for non-drive URL', () => {
    expect(extractDriveFileId('https://example.com')).toBeNull()
  })
})

describe('detectLinkType', () => {
  it('detects drive link', () => {
    expect(detectLinkType('https://drive.google.com/file/d/ABC123/view')).toEqual({ type: 'drive', fileId: 'ABC123' })
  })
  it('detects docs link', () => {
    expect(detectLinkType('https://docs.google.com/document/d/XYZ/edit')).toEqual({ type: 'docs', fileId: 'XYZ' })
  })
  it('detects generic URL', () => {
    expect(detectLinkType('https://example.com/file.pdf')).toEqual({ type: 'url', fileId: null })
  })
})
