import { describe, it, expect } from 'vitest'
import {
  countByType, formatAdvisorySummary, formatAdvisoryLine, parseBulkAdvisoryLines, sortAdvisory,
} from '@/lib/weekly-report/advisory-format'
import { DEFAULT_DOC_TYPES } from '@/types/weekly-report'

const mk = (type: string, n: number) => Array.from({ length: n }, () => ({ type }))

describe('formatAdvisorySummary', () => {
  it('orders by docType order and skips zero counts', () => {
    const docs = [...mk('TB', 3), ...mk('KH', 2), ...mk('BC', 1), ...mk('CV', 3)]
    expect(formatAdvisorySummary(docs, DEFAULT_DOC_TYPES)).toBe('Tham mưu VB: 9 văn bản: 3 CV, 2 KH, 1 BC, 3 TB')
    expect(countByType(docs, DEFAULT_DOC_TYPES).map((r) => r.code)).toEqual(['CV', 'KH', 'BC', 'TB'])
  })
  it('zero documents', () => {
    expect(formatAdvisorySummary([], DEFAULT_DOC_TYPES)).toBe('Tham mưu VB: 0 văn bản')
  })
})

describe('formatAdvisoryLine', () => {
  it('uses display prefix; KHAC has none', () => {
    expect(formatAdvisoryLine({ type: 'TB', title: 'Về việc A' })).toBe('TB Về việc A')
    expect(formatAdvisoryLine({ type: 'QD', title: 'X' })).toBe('QĐ X')
    expect(formatAdvisoryLine({ type: 'KHAC', title: 'Chỉ tiêu đề' })).toBe('Chỉ tiêu đề')
  })
})

describe('parseBulkAdvisoryLines', () => {
  const parse = (t: string) => parseBulkAdvisoryLines(t, DEFAULT_DOC_TYPES)
  it('recognises real-world lines', () => {
    const r = parse([
      '- KH Triển khai thực hiện Nghị quyết',
      'TB Về việc nghỉ lễ',
      '  • BC Kết quả công tác tháng 10',
      '1. CV V/v lấy ý kiến dự thảo',
      '2) QĐ Thành lập hội đồng',
      'Tờ trình v/v xin chủ trương',
      'V/v tham gia ý kiến vào dự thảo',
      'Báo cáo tiến độ thực hiện',
      'Họp triển khai nhiệm vụ',
      '',
      '   ',
    ].join('\n'))
    expect(r.map((x) => x.type)).toEqual(['KH', 'TB', 'BC', 'CV', 'QD', 'TTr', 'CV', 'BC', 'KHAC'])
    expect(r[0].title).toBe('Triển khai thực hiện Nghị quyết')
    expect(r[1].title).toBe('Về việc nghỉ lễ')
    expect(r[3].title).toBe('V/v lấy ý kiến dự thảo')
    expect(r[5].title).toBe('v/v xin chủ trương')
    expect(r[6].title).toBe('V/v tham gia ý kiến vào dự thảo')
    expect(r[8].title).toBe('Họp triển khai nhiệm vụ')
    expect(r[0].raw).toBe('- KH Triển khai thực hiện Nghị quyết')
  })
  it('does not treat words starting with a code as a code', () => {
    expect(parse('KHOA học công nghệ')[0].type).toBe('KHAC')
  })
  it('falls back to KHAC when the type is not in config', () => {
    expect(parseBulkAdvisoryLines('GM Họp', DEFAULT_DOC_TYPES.filter((t) => t.code !== 'GM'))[0].type).toBe('KHAC')
  })
})

describe('sortAdvisory', () => {
  it('sorts by advisedDate then order, without mutating', () => {
    const docs = [
      { advisedDate: '2026-11-12', order: 0, id: 'c' },
      { advisedDate: '2026-11-10', order: 2, id: 'b' },
      { advisedDate: '2026-11-10', order: 1, id: 'a' },
    ]
    expect(sortAdvisory(docs).map((d) => d.id)).toEqual(['a', 'b', 'c'])
    expect(docs[0].id).toBe('c')
  })
})
