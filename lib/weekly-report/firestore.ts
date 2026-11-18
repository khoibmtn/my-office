/**
 * Weekly report data layer (client-side Firestore). See T-200 contract.
 * Collections: weeklyReports/{weekId} (+ snapshots), advisoryDocs, weeklyReportConfig/main.
 * Never writes `undefined` (stripped), docJson is stored as a string.
 */
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  type DocumentSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  type AdvisoryDoc, type AdvisoryDocInput, type ISODate, type RichSectionKey, type WeeklyReport,
  type WeeklyReportConfig, type WorkItem,
} from '@/types/weekly-report'
import { dayOfWeek, diffDays, reportMonthFor, resolvePeriod, weekIdForDate } from './period'
import { carryPinned } from './outline'

const WEEKS = 'weeklyReports'
const ADVISORY = 'advisoryDocs'
const CONFIG = 'weeklyReportConfig'
const DOCUMENTS = 'documents'

// ───────── helpers ─────────

/** Recursively drop `undefined` from plain objects/arrays (leaves Timestamps/FieldValues intact). */
function strip<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map((v) => strip(v)) as unknown as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = strip(v)
    }
    return out as T
  }
  return value
}

/** Subscribe after auth is ready; returns a sync unsubscribe that is safe to call early. */
function subscribeAuthed(attach: () => Unsubscribe, onError?: (e: unknown) => void): Unsubscribe {
  let unsub: Unsubscribe | null = null
  let cancelled = false
  ensureAuth()
    .then(() => {
      if (!cancelled) unsub = attach()
    })
    .catch((e) => {
      console.error('[weekly-report] ensureAuth failed', e)
      onError?.(e)
    })
  return () => {
    cancelled = true
    unsub?.()
  }
}

function toWeek(snap: DocumentSnapshot): WeeklyReport | null {
  if (!snap.exists()) return null
  const d = snap.data() as Partial<WeeklyReport>
  return {
    actualMeetingDate: null,
    periodNote: '',
    periodOverridden: false,
    reportMonthOverridden: false,
    status: 'draft',
    finalizedAt: null,
    unitHeading: DEFAULT_WEEKLY_REPORT_CONFIG.unitHeading,
    statsSnapshotJson: null,
    statsFetchedAt: null,
    carriedFromWeekId: null,
    ...d,
    id: snap.id,
    meetingDate: d.meetingDate ?? snap.id,
    workItems: d.workItems ?? [],
    sections: { opinions: null, nextWeek: null, proposedSchedule: null, deputyOpinions: null, ...(d.sections ?? {}) },
  } as WeeklyReport
}

function toAdvisory(snap: DocumentSnapshot): AdvisoryDoc {
  const d = snap.data() as Partial<AdvisoryDoc>
  return {
    docNumber: null, weekIdOverridden: false, sourceDocumentIds: [], sourceSnapshot: [], draftLink: null,
    draftDriveFileId: null, note: '', highlight: false, order: 0, taskId: null,
    ...d, id: snap.id,
  } as AdvisoryDoc
}

function vnMidnight(d: ISODate): Timestamp {
  return Timestamp.fromDate(new Date(`${d}T00:00:00+07:00`))
}

// ───────── weeks ─────────

export async function listWeeks(): Promise<WeeklyReport[]> {
  await ensureAuth()
  const snap = await getDocs(query(collection(db(), WEEKS), orderBy('meetingDate', 'desc')))
  return snap.docs.map((s) => toWeek(s)!).filter(Boolean)
}

export function subscribeWeeks(cb: (weeks: WeeklyReport[]) => void, onError?: (e: unknown) => void): () => void {
  return subscribeAuthed(
    () => onSnapshot(
      query(collection(db(), WEEKS), orderBy('meetingDate', 'desc')),
      (snap) => cb(snap.docs.map((s) => toWeek(s)!).filter(Boolean)),
      (e) => { console.error('[weekly-report] subscribeWeeks', e); onError?.(e) },
    ),
    onError,
  )
}

export function subscribeWeek(weekId: string, cb: (r: WeeklyReport | null) => void, onError?: (e: unknown) => void): () => void {
  return subscribeAuthed(
    () => onSnapshot(
      doc(db(), WEEKS, weekId),
      (snap) => cb(toWeek(snap)),
      (e) => { console.error('[weekly-report] subscribeWeek', e); onError?.(e) },
    ),
    onError,
  )
}

async function readConfig(): Promise<WeeklyReportConfig> {
  const snap = await getDoc(doc(db(), CONFIG, 'main'))
  return { ...DEFAULT_WEEKLY_REPORT_CONFIG, ...((snap.exists() ? snap.data() : {}) as Partial<WeeklyReportConfig>) }
}

/** Create the week on first open (transaction, only if absent), carrying pinned lines from the latest earlier saved week. */
export async function ensureWeek(weekId: string): Promise<{ report: WeeklyReport; created: boolean; carriedCount: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekId) || dayOfWeek(weekId) !== 5) {
    throw new Error('Mã tuần phải là ngày Thứ 6 giao ban (YYYY-MM-DD)')
  }
  await ensureAuth()
  const ref = doc(db(), WEEKS, weekId)
  const existing = toWeek(await getDoc(ref))
  if (existing) return { report: existing, created: false, carriedCount: 0 }

  const [weeks, config] = await Promise.all([listWeeks(), readConfig()])
  const period = resolvePeriod(weekId, weeks)
  const prev = weeks.filter((w) => w.meetingDate < weekId).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))[0] ?? null
  const carried = prev ? carryPinned(prev.workItems) : []

  const created = await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) return false
    tx.set(ref, strip({
      id: weekId,
      meetingDate: weekId,
      actualMeetingDate: null,
      periodNote: '',
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodOverridden: false,
      reportMonth: reportMonthFor(period.periodStart, period.periodEnd),
      reportMonthOverridden: false,
      status: 'draft',
      finalizedAt: null,
      unitHeading: config.unitHeading,
      workItems: carried,
      sections: { opinions: null, nextWeek: null, proposedSchedule: null, deputyOpinions: null },
      statsSnapshotJson: null,
      statsFetchedAt: null,
      carriedFromWeekId: prev && carried.length > 0 ? prev.id : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    return true
  })

  const report = toWeek(await getDoc(ref))!
  return { report, created, carriedCount: created ? carried.length : 0 }
}

export async function updateWorkItems(weekId: string, items: WorkItem[]): Promise<void> {
  await ensureAuth()
  await updateDoc(doc(db(), WEEKS, weekId), strip({ workItems: items, updatedAt: serverTimestamp() }))
}

export async function updateSection(
  weekId: string,
  key: RichSectionKey,
  section: { docJson: string; plainText: string } | null,
): Promise<void> {
  await ensureAuth()
  await updateDoc(doc(db(), WEEKS, weekId), strip({
    [`sections.${key}`]: section ? { docJson: section.docJson, plainText: section.plainText, updatedAt: serverTimestamp() } : null,
    updatedAt: serverTimestamp(),
  }))
}

type WeekMetaPatch = Partial<Pick<WeeklyReport,
  'actualMeetingDate' | 'periodStart' | 'periodEnd' | 'periodOverridden' | 'periodNote' | 'reportMonth' | 'reportMonthOverridden' | 'unitHeading'>>

export async function updateWeekMeta(weekId: string, patch: WeekMetaPatch): Promise<void> {
  await ensureAuth()
  const ref = doc(db(), WEEKS, weekId)
  const current = toWeek(await getDoc(ref))
  if (!current) throw new Error(`Week ${weekId} not found`)

  const next: Record<string, unknown> = { ...patch }
  const newStart = patch.periodStart ?? current.periodStart
  const newEnd = patch.periodEnd ?? current.periodEnd
  const periodChanged = newStart !== current.periodStart || newEnd !== current.periodEnd

  if (periodChanged) {
    if (diffDays(newStart, newEnd) < 0) throw new Error('periodStart must not be after periodEnd')
    // Hand-edited period => flag it, unless caller says otherwise.
    if (patch.periodOverridden === undefined) next.periodOverridden = true
    const monthOverridden = patch.reportMonthOverridden ?? current.reportMonthOverridden
    if (!monthOverridden && patch.reportMonth === undefined) next.reportMonth = reportMonthFor(newStart, newEnd)
  }
  await updateDoc(ref, strip({ ...next, updatedAt: serverTimestamp() }))

  if (periodChanged) {
    // Re-home advisory docs (not manually overridden) whose date falls in the old or new period.
    const from = [current.periodStart, newStart].sort()[0]
    const to = [current.periodEnd, newEnd].sort().reverse()[0]
    const [weeks, docs] = await Promise.all([listWeeks(), listAdvisoryByDateRange(from, to)])
    for (const a of docs) {
      if (a.weekIdOverridden) continue
      const target = weekIdForDate(a.advisedDate, weeks)
      if (target !== a.weekId) {
        await updateDoc(doc(db(), ADVISORY, a.id), { weekId: target, updatedAt: serverTimestamp() })
      }
    }
  }
}

export async function saveStatsSnapshot(weekId: string, json: string): Promise<void> {
  await ensureAuth()
  await updateDoc(doc(db(), WEEKS, weekId), {
    statsSnapshotJson: json, statsFetchedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

async function writeSnapshot(weekId: string, reason: 'finalize' | 'reopen' | 'manual'): Promise<void> {
  const week = toWeek(await getDoc(doc(db(), WEEKS, weekId)))
  if (!week) throw new Error(`Week ${weekId} not found`)
  const advisory = await listAdvisoryByWeekIds([weekId])
  await addDoc(collection(db(), WEEKS, weekId, 'snapshots'), {
    createdAt: serverTimestamp(),
    reason,
    payloadJson: JSON.stringify({ week, advisory }),
  })
}

export async function finalizeWeek(weekId: string): Promise<void> {
  await ensureAuth()
  await writeSnapshot(weekId, 'finalize')
  await updateDoc(doc(db(), WEEKS, weekId), { status: 'finalized', finalizedAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function reopenWeek(weekId: string): Promise<void> {
  await ensureAuth()
  await writeSnapshot(weekId, 'reopen')
  await updateDoc(doc(db(), WEEKS, weekId), { status: 'draft', finalizedAt: null, updatedAt: serverTimestamp() })
}

// ───────── advisory docs ─────────

async function linkSources(advisoryId: string, ids: string[], link: boolean): Promise<void> {
  for (const sourceId of ids) {
    try {
      await updateDoc(doc(db(), DOCUMENTS, sourceId), {
        advisoryDocIds: link ? arrayUnion(advisoryId) : arrayRemove(advisoryId),
      })
    } catch (e) {
      console.warn('[weekly-report] cannot update source document', sourceId, e)
    }
  }
}

export async function createAdvisoryDoc(input: AdvisoryDocInput, opts?: { markSourceCompleted?: boolean }): Promise<string> {
  await ensureAuth()
  const { weekId: explicitWeek, order: explicitOrder, ...rest } = input
  const weeks = await listWeeks()
  const weekId = explicitWeek ?? weekIdForDate(input.advisedDate, weeks)

  let order = explicitOrder
  if (order === undefined) {
    const same = await getDocs(query(collection(db(), ADVISORY), where('weekId', '==', weekId)))
    order = same.docs.reduce((m, s) => Math.max(m, (s.data().order as number | undefined) ?? -1), -1) + 1
  }

  const ref = await addDoc(collection(db(), ADVISORY), strip({
    ...rest,
    docNumber: rest.docNumber ?? null,
    draftLink: rest.draftLink ?? null,
    draftDriveFileId: rest.draftDriveFileId ?? null,
    taskId: rest.taskId ?? null,
    sourceDocumentIds: rest.sourceDocumentIds ?? [],
    sourceSnapshot: rest.sourceSnapshot ?? [],
    weekId,
    weekIdOverridden: explicitWeek !== undefined,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))

  await linkSources(ref.id, rest.sourceDocumentIds ?? [], true)
  if (opts?.markSourceCompleted) {
    for (const sourceId of rest.sourceDocumentIds ?? []) {
      try {
        await updateDoc(doc(db(), DOCUMENTS, sourceId), {
          status: 'completed', completedDate: vnMidnight(input.advisedDate), updatedAt: serverTimestamp(),
        })
      } catch (e) {
        console.warn('[weekly-report] cannot mark source completed', sourceId, e)
      }
    }
  }
  return ref.id
}

export async function updateAdvisoryDoc(id: string, patch: Partial<AdvisoryDocInput>): Promise<void> {
  await ensureAuth()
  const ref = doc(db(), ADVISORY, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Advisory doc ${id} not found`)
  const current = toAdvisory(snap)

  const { weekId: explicitWeek, ...rest } = patch
  const next: Record<string, unknown> = { ...rest }

  if (explicitWeek === '') {
    // Clear a manual override: back to the automatic week of the (new) advised date
    next.weekId = weekIdForDate(patch.advisedDate ?? current.advisedDate, await listWeeks())
    next.weekIdOverridden = false
  } else if (explicitWeek !== undefined) {
    next.weekId = explicitWeek
    next.weekIdOverridden = true
  } else if (patch.advisedDate && patch.advisedDate !== current.advisedDate && !current.weekIdOverridden) {
    next.weekId = weekIdForDate(patch.advisedDate, await listWeeks())
  }
  await updateDoc(ref, strip({ ...next, updatedAt: serverTimestamp() }))

  if (patch.sourceDocumentIds) {
    const before = new Set(current.sourceDocumentIds)
    const after = new Set(patch.sourceDocumentIds)
    await linkSources(id, [...after].filter((s) => !before.has(s)), true)
    await linkSources(id, [...before].filter((s) => !after.has(s)), false)
  }
}

export async function deleteAdvisoryDoc(id: string): Promise<void> {
  await ensureAuth()
  const ref = doc(db(), ADVISORY, id)
  const snap = await getDoc(ref)
  if (snap.exists()) await linkSources(id, toAdvisory(snap).sourceDocumentIds, false)
  await deleteDoc(ref)
}

export function subscribeAdvisoryByWeek(weekId: string, cb: (docs: AdvisoryDoc[]) => void, onError?: (e: unknown) => void): () => void {
  return subscribeAuthed(
    () => onSnapshot(
      query(collection(db(), ADVISORY), where('weekId', '==', weekId)),
      (snap) => cb(snap.docs.map(toAdvisory).sort((a, b) => a.advisedDate.localeCompare(b.advisedDate) || a.order - b.order)),
      (e) => { console.error('[weekly-report] subscribeAdvisoryByWeek', e); onError?.(e) },
    ),
    onError,
  )
}

export function subscribeAdvisoryBySource(documentId: string, cb: (docs: AdvisoryDoc[]) => void, onError?: (e: unknown) => void): () => void {
  return subscribeAuthed(
    () => onSnapshot(
      query(collection(db(), ADVISORY), where('sourceDocumentIds', 'array-contains', documentId)),
      (snap) => cb(snap.docs.map(toAdvisory).sort((a, b) => a.advisedDate.localeCompare(b.advisedDate) || a.order - b.order)),
      (e) => { console.error('[weekly-report] subscribeAdvisoryBySource', e); onError?.(e) },
    ),
    onError,
  )
}

export async function listAdvisoryByDateRange(from: ISODate, to: ISODate): Promise<AdvisoryDoc[]> {
  await ensureAuth()
  const snap = await getDocs(query(
    collection(db(), ADVISORY), where('advisedDate', '>=', from), where('advisedDate', '<=', to), orderBy('advisedDate', 'asc'),
  ))
  return snap.docs.map(toAdvisory)
}

export async function listAdvisoryByWeekIds(weekIds: string[]): Promise<AdvisoryDoc[]> {
  await ensureAuth()
  const out: AdvisoryDoc[] = []
  for (let i = 0; i < weekIds.length; i += 30) {
    const chunk = weekIds.slice(i, i + 30)
    const snap = await getDocs(query(collection(db(), ADVISORY), where('weekId', 'in', chunk)))
    out.push(...snap.docs.map(toAdvisory))
  }
  return out.sort((a, b) => a.advisedDate.localeCompare(b.advisedDate) || a.order - b.order)
}

// ───────── config ─────────

export function subscribeConfig(cb: (c: WeeklyReportConfig) => void, onError?: (e: unknown) => void): () => void {
  return subscribeAuthed(
    () => onSnapshot(
      doc(db(), CONFIG, 'main'),
      (snap) => cb({ ...DEFAULT_WEEKLY_REPORT_CONFIG, ...((snap.exists() ? snap.data() : {}) as Partial<WeeklyReportConfig>) }),
      (e) => { console.error('[weekly-report] subscribeConfig', e); onError?.(e) },
    ),
    onError,
  )
}

export async function saveConfig(patch: Partial<WeeklyReportConfig>): Promise<void> {
  await ensureAuth()
  await setDoc(doc(db(), CONFIG, 'main'), strip({ ...patch, updatedAt: serverTimestamp() }), { merge: true })
}
