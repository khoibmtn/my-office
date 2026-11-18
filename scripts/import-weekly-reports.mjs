// One-off importer: Google Doc "GB tuần" extract (JSON, kept OUTSIDE the public repo) → weeklyReports + advisoryDocs.
// Usage: node --env-file=.env.local scripts/import-weekly-reports.mjs <file.json> [--commit]
// Dry-run by default. Never overwrites an existing week (skips it).
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const [file, flag] = process.argv.slice(2)
const commit = flag === '--commit'
const data = JSON.parse(readFileSync(file, 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) }))

const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const reportMonthFor = (s, e) => {
  const c = {}; for (let d = s; d <= e; d = addDays(d, 1)) c[d.slice(0, 7)] = (c[d.slice(0, 7)] || 0) + 1
  const best = Math.max(...Object.values(c)); const tops = Object.keys(c).filter((k) => c[k] === best)
  return tops.includes(e.slice(0, 7)) ? e.slice(0, 7) : tops.sort().pop()
}
const PINNED = [/^Đảm bảo công việc thường xuyên/i, /^TH báo cáo tuần nhiệm vụ đổi mới sáng tạo/i]
const PREFIX = [[/^Tờ trình\s+/i, 'TTr'], [/^TTr\s+/, 'TTr'], [/^(QĐ|QD)\s+/, 'QD'], [/^KH\s+/, 'KH'], [/^BC\s+/, 'BC'], [/^CV\s+/, 'CV'],
  [/^TB\s+/, 'TB'], [/^GM\s+/, 'GM'], [/^HD\s+/, 'HD'], [/^PA\s+/, 'PA'], [/^BB\s+/, 'BB']]
function parseAdv(raw) {
  const line = raw.replace(/^[-•*\s]+/, '').trim()
  for (const [re, type] of PREFIX) if (re.test(line)) return { type, title: line.replace(re, '').trim() }
  if (/^Báo cáo\s+/i.test(line)) return { type: 'BC', title: line }
  if (/^(V\/v|Về việc)\s+/i.test(line)) return { type: 'CV', title: line }
  return { type: 'KHAC', title: line }
}
const para = (text, italic) => ({ type: 'paragraph', content: text ? [{ type: 'text', text, ...(italic ? { marks: [{ type: 'italic' }] } : {}) }] : [] })
function rich(paragraphs, extra = []) {
  const ps = paragraphs.map((p) => p.trim()).filter((p) => p && p !== 'x')
  if (!ps.length && !extra.length) return null
  const content = []
  ps.forEach((p, i) => { content.push(para(p)); if (extra[i]) content.push(...extra[i]) })
  return { docJson: JSON.stringify({ type: 'doc', content }), plainText: ps.join('\n'), updatedAt: Timestamp.now() }
}

for (const w of data.weeks) {
  const weekId = w.meetingDate
  const ref = db.collection('weeklyReports').doc(weekId)
  const exists = (await ref.get()).exists
  const periodStart = addDays(weekId, -7), periodEnd = addDays(weekId, -1)
  const workItems = w.workItems.map((it, i) => ({
    id: randomUUID(), text: it.text, highlight: !!it.highlight, pinned: PINNED.some((re) => re.test(it.text)),
    order: i, source: 'import', taskId: null,
    children: (it.children || []).map((c, j) => ({ id: randomUUID(), text: c.text, highlight: !!c.highlight, order: j })),
  }))
  const extraOpinion = (w.opinionsAfter || {})
  const report = {
    meetingDate: weekId, periodStart, periodEnd, periodOverridden: false, actualMeetingDate: null, periodNote: '',
    reportMonth: reportMonthFor(periodStart, periodEnd), reportMonthOverridden: false,
    status: 'finalized', finalizedAt: Timestamp.now(), unitHeading: '1. KHTH', workItems,
    sections: {
      opinions: rich(w.opinions || [], Object.fromEntries(Object.entries(extraOpinion).map(([k, v]) => [Number(k), v.map((t) => para(t, true))]))),
      nextWeek: rich(w.nextWeek || []),
      proposedSchedule: rich(w.proposedSchedule || []),
      deputyOpinions: rich(w.deputyOpinions || []),
    },
    statsSnapshotJson: null, statsFetchedAt: null, carriedFromWeekId: null,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  }
  const advisory = (w.advisory || []).map((a, i) => ({ ...parseAdv(a.raw), highlight: !!a.highlight, order: i }))
  console.log(`${weekId} kỳ ${periodStart}→${periodEnd} tháng ${report.reportMonth}: ${workItems.length} việc (${workItems.filter((x) => x.pinned).length} ghim), ${advisory.length} văn bản [${advisory.map((a) => a.type).join(',')}]${exists ? ' — ĐÃ CÓ, BỎ QUA' : ''}`)
  if (!commit || exists) continue
  const batch = db.batch()
  batch.set(ref, report)
  for (const a of advisory) {
    batch.set(db.collection('advisoryDocs').doc(), {
      type: a.type, title: a.title, docNumber: null, advisedDate: periodEnd, weekId, weekIdOverridden: false,
      sourceDocumentIds: [], sourceSnapshot: [], draftLink: null, draftDriveFileId: null, note: 'Nhập từ Google Doc GB tuần',
      highlight: a.highlight, order: a.order, taskId: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
  }
  await batch.commit()
  console.log('  → đã ghi')
}
