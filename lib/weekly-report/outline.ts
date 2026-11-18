/** Pure reducer for the "Mục 1" work-item outline (max 2 levels). */
import type { WorkItem, WorkItemChild } from '@/types/weekly-report'

export type OutlineAction =
  | { type: 'add'; afterId?: string; text?: string }
  | { type: 'addChild'; parentId: string; text?: string }
  | { type: 'update'; id: string; text: string }
  | { type: 'remove'; id: string }
  | { type: 'indent'; id: string }
  | { type: 'outdent'; id: string }
  | { type: 'moveUp'; id: string }
  | { type: 'moveDown'; id: string }
  | { type: 'toggleHighlight'; id: string }
  | { type: 'togglePinned'; id: string }
  | { type: 'replaceAll'; items: WorkItem[] }

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 20)
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
}

function normalize(items: WorkItem[]): WorkItem[] {
  return items.map((it, i) => ({
    ...it,
    order: i,
    children: (it.children ?? []).map((c, j) => ({ ...c, order: j })),
  }))
}

function blankItem(text: string): WorkItem {
  return { id: newId(), text, highlight: false, pinned: false, order: 0, source: 'manual', taskId: null, children: [] }
}

function blankChild(text: string): WorkItemChild {
  return { id: newId(), text, highlight: false, order: 0 }
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const a = arr.slice()
  ;[a[i], a[j]] = [a[j], a[i]]
  return a
}

export function outlineReducer(items: WorkItem[], action: OutlineAction): WorkItem[] {
  if (action.type === 'replaceAll') return normalize(action.items)

  const topIdx = (id: string) => items.findIndex((i) => i.id === id)
  const childLoc = (id: string): { p: number; c: number } | null => {
    for (let p = 0; p < items.length; p++) {
      const c = items[p].children.findIndex((x) => x.id === id)
      if (c >= 0) return { p, c }
    }
    return null
  }
  const mapChildren = (p: number, fn: (cs: WorkItemChild[]) => WorkItemChild[]) =>
    items.map((it, i) => (i === p ? { ...it, children: fn(it.children) } : it))

  switch (action.type) {
    case 'add': {
      const item = blankItem(action.text ?? '')
      if (action.afterId) {
        const t = topIdx(action.afterId)
        if (t >= 0) return normalize([...items.slice(0, t + 1), item, ...items.slice(t + 1)])
        const loc = childLoc(action.afterId)
        if (loc) {
          const child = blankChild(action.text ?? '')
          return normalize(mapChildren(loc.p, (cs) => [...cs.slice(0, loc.c + 1), child, ...cs.slice(loc.c + 1)]))
        }
      }
      return normalize([...items, item])
    }
    case 'addChild': {
      const t = topIdx(action.parentId)
      if (t < 0) return items
      return normalize(mapChildren(t, (cs) => [...cs, blankChild(action.text ?? '')]))
    }
    case 'update': {
      const t = topIdx(action.id)
      if (t >= 0) return items.map((it, i) => (i === t ? { ...it, text: action.text } : it))
      const loc = childLoc(action.id)
      if (loc) return mapChildren(loc.p, (cs) => cs.map((c, j) => (j === loc.c ? { ...c, text: action.text } : c)))
      return items
    }
    case 'remove': {
      const t = topIdx(action.id)
      if (t >= 0) return normalize(items.filter((_, i) => i !== t))
      const loc = childLoc(action.id)
      if (loc) return normalize(mapChildren(loc.p, (cs) => cs.filter((_, j) => j !== loc.c)))
      return items
    }
    case 'indent': {
      const t = topIdx(action.id)
      if (t <= 0) return items // first item or a child: nothing to do (max 2 levels)
      const it = items[t]
      const asChildren: WorkItemChild[] = [
        { id: it.id, text: it.text, highlight: it.highlight, order: 0 },
        ...it.children.map((c) => ({ ...c })),
      ]
      const next = items.filter((_, i) => i !== t)
      next[t - 1] = { ...next[t - 1], children: [...next[t - 1].children, ...asChildren] }
      return normalize(next)
    }
    case 'outdent': {
      const loc = childLoc(action.id)
      if (!loc) return items
      const child = items[loc.p].children[loc.c]
      const promoted: WorkItem = { ...blankItem(child.text), id: child.id, highlight: child.highlight }
      const next = mapChildren(loc.p, (cs) => cs.filter((_, j) => j !== loc.c))
      return normalize([...next.slice(0, loc.p + 1), promoted, ...next.slice(loc.p + 1)])
    }
    case 'moveUp':
    case 'moveDown': {
      const d = action.type === 'moveUp' ? -1 : 1
      const t = topIdx(action.id)
      if (t >= 0) {
        const j = t + d
        return j < 0 || j >= items.length ? items : normalize(swap(items, t, j))
      }
      const loc = childLoc(action.id)
      if (loc) {
        const j = loc.c + d
        const len = items[loc.p].children.length
        return j < 0 || j >= len ? items : normalize(mapChildren(loc.p, (cs) => swap(cs, loc.c, j)))
      }
      return items
    }
    case 'toggleHighlight': {
      const t = topIdx(action.id)
      if (t >= 0) return items.map((it, i) => (i === t ? { ...it, highlight: !it.highlight } : it))
      const loc = childLoc(action.id)
      if (loc) return mapChildren(loc.p, (cs) => cs.map((c, j) => (j === loc.c ? { ...c, highlight: !c.highlight } : c)))
      return items
    }
    case 'togglePinned': {
      const t = topIdx(action.id)
      if (t < 0) return items
      return items.map((it, i) => (i === t ? { ...it, pinned: !it.pinned } : it))
    }
  }
}

/** Pinned lines only (no children) with fresh ids, for the next week. */
export function carryPinned(prev: WorkItem[]): WorkItem[] {
  return normalize(
    prev
      .filter((it) => it.pinned)
      .map((it) => ({ ...it, id: newId(), source: 'carried' as const, taskId: null, children: [] })),
  )
}
