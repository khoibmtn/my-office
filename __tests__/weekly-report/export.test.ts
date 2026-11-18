import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { countByType } from '@/lib/weekly-report/advisory-format'
import {
  buildMonthDocx,
  buildWeekDocx,
  monthToMarkdown,
  tiptapToMarkdown,
  tiptapToPlainText,
  toCoworkMonth,
  toCoworkWeek,
  weekToMarkdown,
} from '@/lib/weekly-report/export'
import {
  sampleAdvisoryWeek1,
  sampleAdvisoryWeek2,
  sampleAdvisoryWeek3,
  sampleConfig,
  sampleMonthWeeksInput,
  samplePeriodsNov2026,
  sampleTiptapDocJson,
  sampleWeek1,
  sampleWeek2DraftWithSecrets,
  sampleWeek3SpecialPeriod,
} from './fixtures/sample-data'

function readZipEntryText(zipBuffer: Buffer, entryName: string): string {
  // Scan backwards for End of Central Directory (0x06054b50)
  let eocdOffset = -1
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: missing EOCD')

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10)
  let cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16)

  for (let i = 0; i < totalEntries; i++) {
    if (zipBuffer.readUInt32LE(cdOffset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory signature')
    }
    const compressionMethod = zipBuffer.readUInt16LE(cdOffset + 10)
    const compressedSize = zipBuffer.readUInt32LE(cdOffset + 20)
    const nameLen = zipBuffer.readUInt16LE(cdOffset + 28)
    const extraLen = zipBuffer.readUInt16LE(cdOffset + 30)
    const commentLen = zipBuffer.readUInt16LE(cdOffset + 32)
    const localOffset = zipBuffer.readUInt32LE(cdOffset + 42)
    const fileName = zipBuffer.subarray(cdOffset + 46, cdOffset + 46 + nameLen).toString('utf8')

    if (fileName === entryName) {
      const lhNameLen = zipBuffer.readUInt16LE(localOffset + 26)
      const lhExtraLen = zipBuffer.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + lhNameLen + lhExtraLen
      const compressed = zipBuffer.subarray(dataStart, dataStart + compressedSize)
      if (compressionMethod === 0) return compressed.toString('utf8')
      if (compressionMethod === 8) return inflateRawSync(compressed).toString('utf8')
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`)
    }

    cdOffset += 46 + nameLen + extraLen + commentLen
  }

  throw new Error(`Entry ${entryName} not found in DOCX zip`)
}

describe('tiptapToMarkdown & tiptapToPlainText', () => {
  it('converts headings, bold, italic, red marks, nested bullet/ordered lists, and images', () => {
    const md = tiptapToMarkdown(sampleTiptapDocJson)
    expect(md).toContain('## Nội dung tổng hợp')
    expect(md).toContain('**quan trọng**')
    expect(md).toContain('**lưu ý khẩn**')
    expect(md).toContain('*ghi chú nghiêng*')
    expect(md).toContain('- Đầu việc A\n  - Chi tiết A1\n- Đầu việc B')
    expect(md).toContain('1. Bước thứ nhất\n2. Bước thứ hai')
    expect(md).toContain('![ảnh minh hoạ](/api/weekly-reports/images/demo-img-01)')
  })

  it('recognizes all red mark variants and avoids double asterisks when combined with bold', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'red', marks: [{ type: 'red' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'highlight', marks: [{ type: 'highlight' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'styled', marks: [{ type: 'textStyle', attrs: { color: '#dc2626' } }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'both', marks: [{ type: 'bold' }, { type: 'redMark' }] },
          ],
        },
        {
          type: 'image',
          attrs: { src: '/api/weekly-reports/images/img-99' },
        },
      ],
    })
    const md = tiptapToMarkdown(json)
    expect(md).toBe(
      '**red** **highlight** **styled** **both**\n\n![ảnh](/api/weekly-reports/images/img-99)',
    )
  })

  it('returns plain text cleanly and handles empty or malformed JSON', () => {
    expect(tiptapToMarkdown('')).toBe('')
    expect(tiptapToMarkdown('not-valid-json{')).toBe('')
    expect(tiptapToPlainText('')).toBe('')
    expect(tiptapToPlainText('invalid')).toBe('')

    const plain = tiptapToPlainText(sampleTiptapDocJson)
    expect(plain).not.toContain('**')
    expect(plain).toContain('Nội dung tổng hợp')
    expect(plain).toContain('- Đầu việc A')
    expect(plain).toContain('  - Chi tiết A1')
    expect(plain).toContain('1. Bước thứ nhất')
    expect(plain).toContain('[ảnh]')
  })
})

describe('weekToMarkdown & monthToMarkdown', () => {
  it('matches tom-tat layout, actualMeetingDate, highlights, and advisory summary counts (AC-M2, AC-M3)', () => {
    const md = weekToMarkdown({
      week: sampleWeek2DraftWithSecrets,
      advisory: sampleAdvisoryWeek2,
      config: sampleConfig,
      includeRichSections: false,
    })

    const lines = md.split('\n')
    expect(lines[0]).toBe('13/11/2026')
    expect(lines[1]).toBe('Báo cáo giao ban Lãnh đạo tuần')
    expect(lines[2]).toBe('1. KHTH')
    expect(lines[3]).toBe('Tình hình thực hiện nhiệm vụ tuần qua:')

    expect(md).toContain('- Đảm bảo công việc thường xuyên giả lập')
    expect(md).toContain('- **Hoàn thiện báo cáo kiểm tra chuyên đề mẫu**')
    expect(md).toContain('  - **Rà soát phụ lục mẫu số 02**')
    expect(md).toContain('- Tham mưu VB: 4 văn bản: 1 TB, 1 QĐ, 1 Tờ trình, 1 Khác')
    expect(md).toContain('- **TB Về việc điều chỉnh lịch trực mẫu tuần 2**')
    expect(md).toContain('- QĐ Thành lập tổ rà soát hồ sơ mẫu')
    expect(md).toContain('- Tờ trình Xin chủ trương mua sắm vật tư mẫu')
    expect(md).toContain('- Biên bản làm việc tổng kết mẫu')

    expect(md).not.toContain('NOI_DUNG_Y_KIEN_BI_MAT')
    expect(md).not.toContain('NOI_DUNG_PGD_BI_MAT')
  })

  it('includes non-empty rich sections only when includeRichSections is true', () => {
    const mdWithRich = weekToMarkdown({
      week: sampleWeek2DraftWithSecrets,
      advisory: sampleAdvisoryWeek2,
      config: sampleConfig,
      includeRichSections: true,
    })
    expect(mdWithRich).toContain('2. Ý kiến\nNOI_DUNG_Y_KIEN_BI_MAT cần kiểm tra tách biệt')
    expect(mdWithRich).toContain('3. Tuần tới\nNOI_DUNG_TUAN_TOI_BI_MAT dự kiến tuần sau')
    expect(mdWithRich).toContain('Đề xuất lịch tuần tới\nNOI_DUNG_LICH_BI_MAT lịch họp dự kiến')
    expect(mdWithRich).toContain('Ý kiến PGĐ Khôi\nNOI_DUNG_PGD_BI_MAT ý kiến chỉ đạo nội bộ')

    // Week 1 has null sections -> nothing appended even with includeRichSections: true
    const mdWeek1 = weekToMarkdown({
      week: sampleWeek1,
      advisory: sampleAdvisoryWeek1,
      config: sampleConfig,
      includeRichSections: true,
    })
    expect(mdWeek1).not.toContain('2. Ý kiến')
  })

  it('uses actualMeetingDate for special period and renders all weeks in monthToMarkdown', () => {
    const md = monthToMarkdown({
      month: '2026-11',
      weeks: sampleMonthWeeksInput,
      config: sampleConfig,
      includeRichSections: false,
    })

    expect(md).toContain('06/11/2026')
    expect(md).toContain('13/11/2026')
    expect(md).toContain('18/11/2026') // actualMeetingDate of week 3
    expect(md).toContain('27/11/2026')
    expect(md).toContain('04/12/2026')

    // AC-M3: verify advisory summary count matches actual rendered advisory lines per week
    const week2Md = weekToMarkdown({
      week: sampleWeek2DraftWithSecrets,
      advisory: sampleAdvisoryWeek2,
      config: sampleConfig,
      includeRichSections: false,
    })
    const summaryMatch = /- Tham mưu VB: (\d+) văn bản: (.+)/.exec(week2Md)
    expect(summaryMatch).not.toBeNull()
    const declaredTotal = Number(summaryMatch![1])
    expect(declaredTotal).toBe(sampleAdvisoryWeek2.length)
    const breakdownSum = summaryMatch![2]
      .split(',')
      .map((s) => Number(s.trim().split(' ')[0]))
      .reduce((acc, n) => acc + n, 0)
    expect(breakdownSum).toBe(declaredTotal)
  })
})

describe('toCoworkWeek & toCoworkMonth (AC3, AC-M4, AC-M5)', () => {
  it('never leaks sections or statsSnapshotJson from toCoworkWeek or toCoworkMonth', () => {
    const cwWeek = toCoworkWeek({
      week: sampleWeek2DraftWithSecrets,
      advisory: sampleAdvisoryWeek2,
      config: sampleConfig,
    })

    expect('sections' in cwWeek).toBe(false)
    expect('statsSnapshotJson' in cwWeek).toBe(false)
    const weekJson = JSON.stringify(cwWeek)
    for (const forbidden of [
      'sections',
      'opinions',
      'nextWeek',
      'proposedSchedule',
      'deputyOpinions',
      'statsSnapshotJson',
      'NOI_DUNG_Y_KIEN_BI_MAT',
      'NOI_DUNG_TUAN_TOI_BI_MAT',
      'NOI_DUNG_LICH_BI_MAT',
      'NOI_DUNG_PGD_BI_MAT',
    ]) {
      expect(weekJson).not.toContain(forbidden)
    }

    const cwMonth = toCoworkMonth({
      month: '2026-11',
      weeks: sampleMonthWeeksInput,
      config: sampleConfig,
      today: '2026-11-18',
    })
    const monthJson = JSON.stringify(cwMonth)
    for (const forbidden of [
      'sections',
      'opinions',
      'nextWeek',
      'proposedSchedule',
      'deputyOpinions',
      'statsSnapshotJson',
      'NOI_DUNG_Y_KIEN_BI_MAT',
      'NOI_DUNG_PGD_BI_MAT',
    ]) {
      expect(monthJson).not.toContain(forbidden)
    }
  })

  it('includes required period, workItems, advisory fields, countsByType, total, and all warning codes', () => {
    const cwWeek3 = toCoworkWeek({
      week: sampleWeek3SpecialPeriod,
      advisory: sampleAdvisoryWeek3,
      config: sampleConfig,
    })
    expect(cwWeek3.periodStart).toBe('2026-11-13')
    expect(cwWeek3.periodEnd).toBe('2026-11-18')
    expect(cwWeek3.periodOverridden).toBe(true)
    expect(cwWeek3.actualMeetingDate).toBe('2026-11-18')
    expect(cwWeek3.periodNote).toBe('Họp sớm trước kỳ công tác giả lập')
    expect(cwWeek3.reportMonth).toBe('2026-11')
    expect(cwWeek3.reportMonthOverridden).toBe(true)
    expect(cwWeek3.status).toBe('finalized')

    const cwWeek2 = toCoworkWeek({
      week: sampleWeek2DraftWithSecrets,
      advisory: sampleAdvisoryWeek2,
      config: sampleConfig,
    })
    expect(cwWeek2.workItems).toHaveLength(2)
    expect(cwWeek2.workItems[1].highlight).toBe(true)
    expect(cwWeek2.workItems[1].children[0].highlight).toBe(true)
    expect(cwWeek2.advisoryDocs[0]).toMatchObject({
      type: 'TB',
      typeLabel: 'Thông báo',
      prefix: 'TB',
      title: 'Về việc điều chỉnh lịch trực mẫu tuần 2',
      docNumber: '103/KHTH-TB',
      advisedDate: '2026-11-09',
      weekId: '2026-11-13',
      highlight: true,
    })

    const cwMonthIncomplete = toCoworkMonth({
      month: '2026-11',
      weeks: sampleMonthWeeksInput,
      config: sampleConfig,
      today: '2026-11-18',
    })
    expect(cwMonthIncomplete.weeks).toHaveLength(5)
    expect(cwMonthIncomplete.total).toBe(
      sampleAdvisoryWeek1.length + sampleAdvisoryWeek2.length + sampleAdvisoryWeek3.length,
    )
    expect(cwMonthIncomplete.countsByType).toEqual(
      countByType(
        [...sampleAdvisoryWeek1, ...sampleAdvisoryWeek2, ...sampleAdvisoryWeek3],
        sampleConfig.docTypes,
      ),
    )

    const codes = new Set(cwMonthIncomplete.warnings.map((w) => w.code))
    expect(codes).toEqual(
      new Set([
        'MONTH_INCOMPLETE',
        'BOUNDARY_WEEK',
        'WEEK_NOT_FINALIZED',
        'MONTH_OVERRIDDEN',
        'PERIOD_OVERRIDDEN',
        'WEEK_MISSING',
      ]),
    )

    // When today is after last periodEnd, MONTH_INCOMPLETE is absent
    const cwMonthComplete = toCoworkMonth({
      month: '2026-11',
      weeks: sampleMonthWeeksInput,
      config: sampleConfig,
      today: '2026-12-05',
    })
    expect(cwMonthComplete.warnings.some((w) => w.code === 'MONTH_INCOMPLETE')).toBe(false)
    expect(cwMonthComplete.weeks[3].status).toBe('missing')
    expect(cwMonthComplete.weeks[3].periodStart).toBe(samplePeriodsNov2026[3].periodStart)
  })
})

describe('buildWeekDocx & buildMonthDocx', () => {
  it('builds valid PK-headed DOCX buffers with Times New Roman 14pt and red highlights', async () => {
    const weekBuf = await buildWeekDocx({
      week: sampleWeek2DraftWithSecrets,
      advisory: sampleAdvisoryWeek2,
      config: sampleConfig,
      includeRichSections: false,
    })
    expect(Buffer.isBuffer(weekBuf)).toBe(true)
    expect(weekBuf.subarray(0, 2).toString('utf8')).toBe('PK')

    const weekXml = readZipEntryText(weekBuf, 'word/document.xml')
    expect(weekXml).toContain('Times New Roman')
    expect(weekXml).toContain('w:val="28"') // 14pt = 28 half-points
    expect(weekXml).toContain('C00000')
    expect(weekXml).toContain('1. KHTH')
    expect(weekXml).toContain('Tình hình thực hiện nhiệm vụ tuần qua:')
    expect(weekXml).toContain('Tham mưu VB: 4 văn bản')
    expect(weekXml).not.toContain('NOI_DUNG_Y_KIEN_BI_MAT')

    const monthBuf = await buildMonthDocx({
      month: '2026-11',
      weeks: sampleMonthWeeksInput,
      config: sampleConfig,
      includeRichSections: true,
    })
    expect(Buffer.isBuffer(monthBuf)).toBe(true)
    expect(monthBuf.subarray(0, 2).toString('utf8')).toBe('PK')

    const monthXml = readZipEntryText(monthBuf, 'word/document.xml')
    expect(monthXml).toContain('06/11/2026')
    expect(monthXml).toContain('18/11/2026')
    expect(monthXml).toContain('NOI_DUNG_Y_KIEN_BI_MAT')
  })
})

describe('Client bundle safety (AC5)', () => {
  it('never imports docx or export barrel from client monthly summary files', () => {
    const root = process.cwd()
    const clientFiles = [
      'app/(app)/weekly-reports/monthly/page.tsx',
      'app/(app)/weekly-reports/monthly/[month]/page.tsx',
      'components/weekly-report/MonthlySummary.tsx',
    ]

    for (const rel of clientFiles) {
      const src = readFileSync(path.join(root, rel), 'utf8')
      expect(src).not.toMatch(/from\s+['"]docx['"]/)
      expect(src).not.toMatch(/from\s+['"][^'"]*\/export\/docx['"]/)
      expect(src).not.toMatch(/from\s+['"][^'"]*\/export['"]/)
      expect(src).not.toMatch(/require\(\s*['"]docx['"]\s*\)/)
    }
  })
})
