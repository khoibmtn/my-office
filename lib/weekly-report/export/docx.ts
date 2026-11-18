/**
 * Server-only DOCX generator for weekly/monthly reports.
 * Do NOT import this file from client components (keeps `docx` out of client bundles).
 * Note: Intentionally omits `import 'server-only'` so pure unit tests in Vitest can run directly.
 */
import {
  AlignmentType,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from 'docx'
import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  RICH_SECTION_LABELS,
  type RichSectionKey,
} from '@/types/weekly-report'
import { formatAdvisoryLine, formatAdvisorySummary, sortAdvisory } from '../advisory-format'
import { formatDMY } from '../period'
import type { MonthExportInput, WeekExportInput } from './markdown'
import { isRedMark, parseTiptapDoc, type TiptapNode } from './tiptap-markdown'

const DOCX_FONT = 'Times New Roman'
const DOCX_SIZE_HALF_POINTS = 28 // 14pt
const HIGHLIGHT_RED = 'C00000'

const BULLET_REF = 'weekly-bullets'
const ORDERED_REF = 'weekly-ordered'

const RICH_SECTION_ORDER: RichSectionKey[] = [
  'opinions',
  'nextWeek',
  'proposedSchedule',
  'deputyOpinions',
]

interface RunStyle {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  highlight?: boolean
  color?: string
}

function makeRun(text: string, style: RunStyle = {}): TextRun {
  const isRed = Boolean(style.highlight)
  return new TextRun({
    text,
    font: DOCX_FONT,
    size: DOCX_SIZE_HALF_POINTS,
    bold: isRed || style.bold ? true : undefined,
    italics: style.italics ? true : undefined,
    strike: style.strike ? true : undefined,
    color: isRed ? HIGHLIGHT_RED : style.color,
  })
}

function extractInlineRuns(nodes: TiptapNode[] | undefined, forceBold = false): TextRun[] {
  if (!nodes || nodes.length === 0) return []
  const runs: TextRun[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      const text = node.text ?? ''
      if (!text) continue
      let bold = forceBold
      let italics = false
      let strike = false
      let highlight = false

      for (const m of node.marks ?? []) {
        const mt = (m.type || '').toLowerCase()
        if (mt === 'bold' || mt === 'strong') bold = true
        else if (mt === 'italic' || mt === 'em') italics = true
        else if (mt === 'strike') strike = true
        if (isRedMark(m)) highlight = true
      }

      runs.push(makeRun(text, { bold, italics, strike, highlight }))
      continue
    }

    if (node.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1, font: DOCX_FONT, size: DOCX_SIZE_HALF_POINTS }))
      continue
    }

    if (node.type === 'image') {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : ''
      if (src) {
        runs.push(makeRun(`[ảnh: ${src}]`, { italics: true }))
      }
      continue
    }

    if (node.content) {
      runs.push(...extractInlineRuns(node.content, forceBold))
    }
  }

  return runs
}

function tiptapListToParagraphs(node: TiptapNode, ordered: boolean, level: number): Paragraph[] {
  const out: Paragraph[] = []
  const items = (node.content ?? []).filter((c) => c.type === 'listItem')
  const clampedLevel = Math.min(1, Math.max(0, level))
  const ref = ordered ? ORDERED_REF : BULLET_REF

  for (const item of items) {
    let usedFirst = false
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        if (!usedFirst) {
          out.push(
            new Paragraph({
              numbering: { reference: ref, level: clampedLevel },
              children: [makeRun('')],
              spacing: { after: 60 },
            }),
          )
          usedFirst = true
        }
        out.push(...tiptapListToParagraphs(child, child.type === 'orderedList', level + 1))
        continue
      }

      if (child.type === 'paragraph' || child.type === 'heading') {
        const runs = extractInlineRuns(child.content, child.type === 'heading')
        if (runs.length === 0) continue
        if (!usedFirst) {
          out.push(
            new Paragraph({
              numbering: { reference: ref, level: clampedLevel },
              children: runs,
              spacing: { after: 60 },
            }),
          )
          usedFirst = true
        } else {
          out.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.35 * (clampedLevel + 1)) },
              children: runs,
              spacing: { after: 60 },
            }),
          )
        }
        continue
      }

      const subParagraphs = tiptapBlockToParagraphs(child)
      out.push(...subParagraphs)
    }
  }

  return out
}

function tiptapBlockToParagraphs(node: TiptapNode): Paragraph[] {
  switch (node.type) {
    case 'doc': {
      const out: Paragraph[] = []
      for (const child of node.content ?? []) {
        out.push(...tiptapBlockToParagraphs(child))
      }
      return out
    }
    case 'paragraph': {
      const runs = extractInlineRuns(node.content)
      if (runs.length === 0) return []
      return [new Paragraph({ children: runs, spacing: { after: 80 } })]
    }
    case 'heading': {
      const runs = extractInlineRuns(node.content, true)
      if (runs.length === 0) return []
      return [new Paragraph({ children: runs, spacing: { before: 100, after: 80 } })]
    }
    case 'bulletList':
      return tiptapListToParagraphs(node, false, 0)
    case 'orderedList':
      return tiptapListToParagraphs(node, true, 0)
    case 'blockquote': {
      const inner: Paragraph[] = []
      for (const child of node.content ?? []) {
        if (child.type === 'paragraph') {
          const runs = extractInlineRuns(child.content)
          if (runs.length > 0) {
            inner.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.35) },
                children: runs,
                spacing: { after: 80 },
              }),
            )
          }
        } else {
          inner.push(...tiptapBlockToParagraphs(child))
        }
      }
      return inner
    }
    case 'codeBlock': {
      const text = (node.content ?? []).map((c) => c.text ?? '').join('')
      if (!text.trim()) return []
      return [
        new Paragraph({
          indent: { left: convertInchesToTwip(0.25) },
          children: [makeRun(text)],
          spacing: { after: 80 },
        }),
      ]
    }
    case 'horizontalRule':
      return [new Paragraph({ children: [makeRun('---')], spacing: { after: 80 } })]
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : ''
      if (!src) return []
      return [
        new Paragraph({
          children: [makeRun(`[ảnh: ${src}]`, { italics: true })],
          spacing: { after: 80 },
        }),
      ]
    }
    default: {
      if (node.content) {
        const out: Paragraph[] = []
        for (const child of node.content) {
          out.push(...tiptapBlockToParagraphs(child))
        }
        return out
      }
      if (typeof node.text === 'string' && node.text.trim()) {
        return [new Paragraph({ children: [makeRun(node.text)], spacing: { after: 80 } })]
      }
      return []
    }
  }
}

function buildWeekParagraphs(input: WeekExportInput): Paragraph[] {
  const { week, advisory, config, includeRichSections } = input
  const displayDate = week.actualMeetingDate || week.meetingDate
  const title = config.reportTitle || DEFAULT_WEEKLY_REPORT_CONFIG.reportTitle
  const unitHeading =
    week.unitHeading || config.unitHeading || DEFAULT_WEEKLY_REPORT_CONFIG.unitHeading

  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [makeRun(formatDMY(displayDate), { highlight: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [makeRun(title, { bold: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [makeRun(unitHeading, { bold: true })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [makeRun('Tình hình thực hiện nhiệm vụ tuần qua:', { bold: true })],
      spacing: { after: 60 },
    }),
  ]

  const workItems = [...(week.workItems ?? [])].sort((a, b) => a.order - b.order)
  for (const item of workItems) {
    const parentText = item.text.trim()
    const children = [...(item.children ?? [])]
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.text.trim() !== '')

    if (!parentText && children.length === 0) continue
    if (parentText) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: BULLET_REF, level: 0 },
          children: [makeRun(parentText, { highlight: item.highlight })],
          spacing: { after: 60 },
        }),
      )
    }
    for (const child of children) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: BULLET_REF, level: 1 },
          children: [makeRun(child.text.trim(), { highlight: child.highlight })],
          spacing: { after: 60 },
        }),
      )
    }
  }

  const sortedAdv = sortAdvisory(advisory)
  paragraphs.push(
    new Paragraph({
      numbering: { reference: BULLET_REF, level: 0 },
      children: [makeRun(formatAdvisorySummary(sortedAdv, config.docTypes))],
      spacing: { after: 60 },
    }),
  )

  for (const doc of sortedAdv) {
    const advLine = formatAdvisoryLine(doc)
    if (!advLine) continue
    paragraphs.push(
      new Paragraph({
        numbering: { reference: BULLET_REF, level: 0 },
        children: [makeRun(advLine, { highlight: doc.highlight })],
        spacing: { after: 60 },
      }),
    )
  }

  if (includeRichSections && week.sections) {
    for (const key of RICH_SECTION_ORDER) {
      const sec = week.sections[key]
      if (!sec) continue
      const parsed = parseTiptapDoc(sec.docJson)
      const bodyParagraphs = parsed
        ? tiptapBlockToParagraphs(parsed)
        : sec.plainText?.trim()
          ? [new Paragraph({ children: [makeRun(sec.plainText.trim())], spacing: { after: 80 } })]
          : []
      if (bodyParagraphs.length === 0) continue

      const label =
        key === 'deputyOpinions'
          ? config.deputySectionLabel || RICH_SECTION_LABELS.deputyOpinions
          : RICH_SECTION_LABELS[key]

      paragraphs.push(
        new Paragraph({
          children: [makeRun(label, { bold: true })],
          spacing: { before: 120, after: 60 },
        }),
        ...bodyParagraphs,
      )
    }
  }

  return paragraphs
}

function createDocxDocument(children: Paragraph[]): Document {
  const safeChildren = children.length > 0 ? children : [new Paragraph({ children: [] })]
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_FONT,
            size: DOCX_SIZE_HALF_POINTS,
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: DOCX_FONT, size: DOCX_SIZE_HALF_POINTS },
                paragraph: {
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: '–',
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: DOCX_FONT, size: DOCX_SIZE_HALF_POINTS },
                paragraph: {
                  indent: { left: convertInchesToTwip(0.7), hanging: convertInchesToTwip(0.2) },
                },
              },
            },
          ],
        },
        {
          reference: ORDERED_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: DOCX_FONT, size: DOCX_SIZE_HALF_POINTS },
                paragraph: {
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: '%2.',
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: DOCX_FONT, size: DOCX_SIZE_HALF_POINTS },
                paragraph: {
                  indent: { left: convertInchesToTwip(0.7), hanging: convertInchesToTwip(0.2) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: safeChildren,
      },
    ],
  })
}

export async function buildWeekDocx(input: WeekExportInput): Promise<Buffer> {
  const doc = createDocxDocument(buildWeekParagraphs(input))
  const out = await Packer.toBuffer(doc)
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}

export async function buildMonthDocx(input: MonthExportInput): Promise<Buffer> {
  const allParagraphs: Paragraph[] = []
  input.weeks.forEach(({ period, report, advisory }, idx) => {
    if (idx > 0) {
      allParagraphs.push(new Paragraph({ children: [] }))
    }
    const weekInput: WeekExportInput = {
      week: report ? { ...period, ...report } : period,
      advisory,
      config: input.config,
      includeRichSections: input.includeRichSections,
    }
    allParagraphs.push(...buildWeekParagraphs(weekInput))
  })
  const doc = createDocxDocument(allParagraphs)
  const out = await Packer.toBuffer(doc)
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}
