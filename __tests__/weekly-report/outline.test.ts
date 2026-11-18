import { describe, it, expect } from 'vitest'
import { outlineReducer, carryPinned, newId } from '@/lib/weekly-report/outline'
import type { WorkItem } from '@/types/weekly-report'

const item = (id: string, text = id, over: Partial<WorkItem> = {}): WorkItem => ({
  id, text, highlight: false, pinned: false, order: 0, source: 'manual', taskId: null, children: [], ...over,
})
const ids = (xs: WorkItem[]) => xs.map((x) => x.id)

describe('outlineReducer', () => {
  const base = [item('a'), item('b'), item('c')]

  it('add appends or inserts after, normalising order', () => {
    const r1 = outlineReducer(base, { type: 'add', text: 'n' })
    expect(r1).toHaveLength(4)
    expect(r1.map((x) => x.order)).toEqual([0, 1, 2, 3])
    const r2 = outlineReducer(base, { type: 'add', afterId: 'a', text: 'n' })
    expect(r2[1].text).toBe('n')
    expect(r2[1].source).toBe('manual')
  })
  it('addChild / update / remove', () => {
    let r = outlineReducer(base, { type: 'addChild', parentId: 'a', text: 'kid' })
    const kid = r[0].children[0]
    expect(kid.text).toBe('kid')
    r = outlineReducer(r, { type: 'update', id: kid.id, text: 'kid2' })
    expect(r[0].children[0].text).toBe('kid2')
    r = outlineReducer(r, { type: 'remove', id: kid.id })
    expect(r[0].children).toHaveLength(0)
    r = outlineReducer(r, { type: 'remove', id: 'b' })
    expect(ids(r)).toEqual(['a', 'c'])
  })
  it('indent makes the item a child of the previous one; outdent restores it', () => {
    const r = outlineReducer(base, { type: 'indent', id: 'b' })
    expect(ids(r)).toEqual(['a', 'c'])
    expect(r[0].children.map((c) => c.id)).toEqual(['b'])
    const back = outlineReducer(r, { type: 'outdent', id: 'b' })
    expect(ids(back)).toEqual(['a', 'b', 'c'])
    expect(back[1].children).toEqual([])
  })
  it('indent on first item is a no-op; indent flattens grandchildren to 2 levels', () => {
    expect(outlineReducer(base, { type: 'indent', id: 'a' })).toBe(base)
    const withKid = [item('a'), item('b', 'b', { children: [{ id: 'k', text: 'k', highlight: false, order: 0 }] })]
    const r = outlineReducer(withKid, { type: 'indent', id: 'b' })
    expect(r[0].children.map((c) => c.id)).toEqual(['b', 'k'])
  })
  it('moveUp / moveDown for top-level and children, bounded', () => {
    expect(ids(outlineReducer(base, { type: 'moveUp', id: 'b' }))).toEqual(['b', 'a', 'c'])
    expect(ids(outlineReducer(base, { type: 'moveDown', id: 'b' }))).toEqual(['a', 'c', 'b'])
    expect(outlineReducer(base, { type: 'moveUp', id: 'a' })).toBe(base)
    const kids = [item('p', 'p', { children: [
      { id: 'k1', text: '1', highlight: false, order: 0 }, { id: 'k2', text: '2', highlight: false, order: 1 },
    ] })]
    const r = outlineReducer(kids, { type: 'moveUp', id: 'k2' })
    expect(r[0].children.map((c) => c.id)).toEqual(['k2', 'k1'])
    expect(r[0].children.map((c) => c.order)).toEqual([0, 1])
  })
  it('toggleHighlight / togglePinned', () => {
    expect(outlineReducer(base, { type: 'toggleHighlight', id: 'a' })[0].highlight).toBe(true)
    expect(outlineReducer(base, { type: 'togglePinned', id: 'a' })[0].pinned).toBe(true)
  })
  it('replaceAll normalises order', () => {
    const r = outlineReducer([], { type: 'replaceAll', items: [item('x', 'x', { order: 9 }), item('y', 'y', { order: 3 })] })
    expect(r.map((x) => x.order)).toEqual([0, 1])
  })
  it('does not mutate input', () => {
    const snap = JSON.stringify(base)
    outlineReducer(base, { type: 'indent', id: 'b' })
    outlineReducer(base, { type: 'toggleHighlight', id: 'c' })
    expect(JSON.stringify(base)).toBe(snap)
  })
  it('newId is unique', () => {
    expect(newId()).not.toBe(newId())
  })
})

describe('carryPinned', () => {
  it('keeps only pinned lines, no children, fresh ids, source carried', () => {
    const prev = [
      item('a', 'routine', { pinned: true, children: [{ id: 'k', text: 'k', highlight: false, order: 0 }] }),
      item('b', 'one-off'),
      item('c', 'routine2', { pinned: true, source: 'task', taskId: 't1' }),
    ]
    const r = carryPinned(prev)
    expect(r.map((x) => x.text)).toEqual(['routine', 'routine2'])
    expect(r.every((x) => x.source === 'carried' && x.children.length === 0 && x.pinned && x.taskId === null)).toBe(true)
    expect(r.some((x) => x.id === 'a' || x.id === 'c')).toBe(false)
    expect(r.map((x) => x.order)).toEqual([0, 1])
  })
})
