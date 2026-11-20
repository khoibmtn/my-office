import { describe, expect, it } from 'vitest'
import { lineKey, nextWeekLines } from '@/lib/weekly-report/next-week-lines'

const p = (...parts: Array<string | { t: string; red?: boolean } | 'br'>) => ({
  type: 'paragraph',
  content: parts.map((x) =>
    x === 'br'
      ? { type: 'hardBreak' }
      : typeof x === 'string'
        ? { type: 'text', text: x }
        : { type: 'text', text: x.t, ...(x.red ? { marks: [{ type: 'red' }] } : {}) },
  ),
})
const li = (...content: unknown[]) => ({ type: 'listItem', content })
const doc = (...content: unknown[]) => JSON.stringify({ type: 'doc', content })

describe('nextWeekLines', () => {
  it('one item per paragraph, skips empty, splits hard breaks', () => {
    const r = nextWeekLines(doc(p('Việc A'), { type: 'paragraph' }, p('Việc B', 'br', 'Việc C')))
    expect(r.map((x) => x.text)).toEqual(['Việc A', 'Việc B', 'Việc C'])
  })

  it('list items become items, nested items become children, red kept', () => {
    const r = nextWeekLines(
      doc({
        type: 'bulletList',
        content: [
          li(p({ t: 'Kiểm tra', red: true }), { type: 'bulletList', content: [li(p('Khoa Nội')), li(p('Khoa Ngoại'))] }),
          li(p('Họp HĐ')),
        ],
      }),
    )
    expect(r).toEqual([
      { text: 'Kiểm tra', highlight: true, children: [{ text: 'Khoa Nội', highlight: false }, { text: 'Khoa Ngoại', highlight: false }] },
      { text: 'Họp HĐ', highlight: false, children: [] },
    ])
  })

  it('handles empty / plain text input', () => {
    expect(nextWeekLines(null)).toEqual([])
    expect(nextWeekLines(doc({ type: 'paragraph' }))).toEqual([])
    expect(nextWeekLines('a\n\nb').map((x) => x.text)).toEqual(['a', 'b'])
  })

  it('lineKey ignores bullets, case and spacing', () => {
    expect(lineKey('- Họp  giao ban')).toBe(lineKey('họp giao ban'))
  })
})
