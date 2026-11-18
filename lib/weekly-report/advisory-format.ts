/** Advisory document formatting/parsing — pure. */
import { DEFAULT_DOC_TYPES, DOC_TYPE_PREFIX } from '@/types/weekly-report'
import type { AdvisoryDoc, DocTypeDef } from '@/types/weekly-report'

export function countByType(
  docs: Pick<AdvisoryDoc, 'type'>[],
  types: DocTypeDef[],
): Array<{ code: string; label: string; prefix: string; count: number }> {
  const counts = new Map<string, number>()
  for (const d of docs) counts.set(d.type, (counts.get(d.type) ?? 0) + 1)
  const known = new Set(types.map((t) => t.code))
  const rows = [...types]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ code: t.code, label: t.label, prefix: DOC_TYPE_PREFIX[t.code] ?? t.code, count: counts.get(t.code) ?? 0 }))
  // Unknown codes (type removed from config) are still counted, after known ones.
  for (const [code, count] of counts) {
    if (!known.has(code)) rows.push({ code, label: code, prefix: DOC_TYPE_PREFIX[code] ?? code, count })
  }
  return rows.filter((r) => r.count > 0)
}

export function formatAdvisorySummary(docs: Pick<AdvisoryDoc, 'type'>[], types: DocTypeDef[]): string {
  if (docs.length === 0) return 'Tham mưu VB: 0 văn bản'
  const parts = countByType(docs, types).map((r) => (r.prefix ? `${r.count} ${r.prefix}` : `${r.count} ${r.label}`))
  return `Tham mưu VB: ${docs.length} văn bản: ${parts.join(', ')}`
}

export function formatAdvisoryLine(doc: Pick<AdvisoryDoc, 'type' | 'title'>): string {
  const prefix = DOC_TYPE_PREFIX[doc.type] ?? doc.type
  return prefix ? `${prefix} ${doc.title}`.trim() : doc.title
}

const LEADING_BULLET = /^\s*(?:[-•*–—·]+|\d+[.)])\s*/
const CODE_RE = /^(KH|CV|BC|TB|QĐ|QD|GM|HD|PA|BB|CB)(?=[\s:.\-–]|$)[\s:.\-–]*/
const NAME_PREFIXES: Array<[RegExp, string]> = [
  [/^(?:Tờ trình|TTr)(?=[\s:.\-–]|$)[\s:.\-–]*/i, 'TTr'],
  [/^Báo cáo(?=[\s:.\-–]|$)[\s:.\-–]*/i, 'BC'],
  [/^Giấy mời(?=[\s:.\-–]|$)[\s:.\-–]*/i, 'GM'],
]
const VV_RE = /^(?:V\/v|Về việc)(?=[\s:.\-–]|$)/i

export function parseBulkAdvisoryLines(
  text: string,
  types: DocTypeDef[],
): Array<{ type: string; title: string; raw: string }> {
  const known = new Set(types.map((t) => t.code))
  const out: Array<{ type: string; title: string; raw: string }> = []
  const ok = (code: string) => (known.has(code) ? code : 'KHAC')

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw) continue
    const line = raw.replace(LEADING_BULLET, '').trim()
    if (!line) continue

    let type = 'KHAC'
    let title = line

    const code = CODE_RE.exec(line)
    if (code) {
      type = ok(code[1] === 'QĐ' ? 'QD' : code[1])
      title = line.slice(code[0].length).trim()
    } else if (VV_RE.test(line)) {
      type = ok('CV') // keep 'V/v …' in the title
    } else {
      for (const [re, t] of NAME_PREFIXES) {
        const m = re.exec(line)
        if (m) {
          type = ok(t)
          title = line.slice(m[0].length).trim()
          break
        }
      }
    }
    if (!title) {
      type = 'KHAC'
      title = line
    }
    out.push({ type, title, raw })
  }
  return out
}

export function sortAdvisory<T extends Pick<AdvisoryDoc, 'order' | 'advisedDate'>>(docs: T[]): T[] {
  return docs
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.advisedDate.localeCompare(b.d.advisedDate) || a.d.order - b.d.order || a.i - b.i)
    .map((x) => x.d)
}

/**
 * Order used in the weekly report (anh Khôi, 19/11/2026): red-highlighted docs first, then the rest;
 * inside each part group by document type (config order), then by advised date — all ascending.
 */
export function sortAdvisoryForReport<T extends Pick<AdvisoryDoc, 'order' | 'advisedDate' | 'type' | 'highlight'>>(
  docs: T[],
  types: DocTypeDef[] = DEFAULT_DOC_TYPES,
): T[] {
  const rank = new Map(types.map((t) => [t.code, t.order]))
  const r = (code: string) => rank.get(code) ?? 999
  return docs
    .map((d, i) => ({ d, i }))
    .sort(
      (a, b) =>
        Number(!!b.d.highlight) - Number(!!a.d.highlight) ||
        r(a.d.type) - r(b.d.type) ||
        a.d.advisedDate.localeCompare(b.d.advisedDate) ||
        a.d.order - b.d.order ||
        a.i - b.i,
    )
    .map((x) => x.d)
}

/** Docs that sort into the same slot (manual order only applies inside this group). */
export function sameReportSlot(a: Pick<AdvisoryDoc, 'advisedDate' | 'type' | 'highlight'>, b: Pick<AdvisoryDoc, 'advisedDate' | 'type' | 'highlight'>): boolean {
  return !!a.highlight === !!b.highlight && a.type === b.type && a.advisedDate === b.advisedDate
}
