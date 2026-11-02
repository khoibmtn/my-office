import { describe, it, expect } from 'vitest'
import { deriveDocumentStatus, diffDocumentIds } from '@/lib/tasks/documentSync'

describe('deriveDocumentStatus', () => {
  it('returns null when document is uploading or upload_failed', () => {
    expect(
      deriveDocumentStatus('uploading', [
        { status: 'pending', deletedAt: null, parentTaskId: null },
      ])
    ).toBeNull()

    expect(
      deriveDocumentStatus('upload_failed', [
        { status: 'completed', deletedAt: null, parentTaskId: null },
      ])
    ).toBeNull()
  })

  it('returns null when there are no linked tasks or only deleted/subtasks', () => {
    expect(deriveDocumentStatus('pending', [])).toBeNull()
    expect(deriveDocumentStatus('in_progress', [])).toBeNull()
    expect(
      deriveDocumentStatus('pending', [
        { status: 'in_progress', deletedAt: null, parentTaskId: 'parent-1' },
        { status: 'completed', deletedAt: { seconds: 1000 } as any, parentTaskId: null },
      ])
    ).toBeNull()
  })

  it('returns in_progress when at least one root task is open (pending, in_progress, blocked)', () => {
    expect(
      deriveDocumentStatus('pending', [
        { status: 'pending', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('in_progress')

    expect(
      deriveDocumentStatus('pending', [
        { status: 'completed', deletedAt: null, parentTaskId: null },
        { status: 'blocked', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('in_progress')

    // Reopens a completed document when a linked task is reopened or added
    expect(
      deriveDocumentStatus('completed', [
        { status: 'completed', deletedAt: null, parentTaskId: null },
        { status: 'pending', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('in_progress')

    expect(
      deriveDocumentStatus('in_progress', [
        { status: 'in_progress', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('in_progress')
  })

  it('returns completed when all root tasks are closed and at least one is completed', () => {
    expect(
      deriveDocumentStatus('in_progress', [
        { status: 'completed', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('completed')

    expect(
      deriveDocumentStatus('pending', [
        { status: 'completed', deletedAt: null, parentTaskId: null },
        { status: 'cancelled', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('completed')

    expect(
      deriveDocumentStatus('completed', [
        { status: 'completed', deletedAt: null, parentTaskId: null },
      ])
    ).toBe('completed')
  })

  it('returns null when all root tasks are cancelled', () => {
    expect(
      deriveDocumentStatus('in_progress', [
        { status: 'cancelled', deletedAt: null, parentTaskId: null },
        { status: 'cancelled', deletedAt: null, parentTaskId: null },
      ])
    ).toBeNull()
  })
})

describe('diffDocumentIds', () => {
  it('computes added, removed, and affected document IDs accurately', () => {
    const res = diffDocumentIds(['doc-1', 'doc-2'], ['doc-2', 'doc-3'])
    expect(res.added).toEqual(['doc-3'])
    expect(res.removed).toEqual(['doc-1'])
    expect(res.affected).toEqual(['doc-3', 'doc-1'])
  })
})
