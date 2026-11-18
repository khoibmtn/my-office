import 'server-only'
import { google } from 'googleapis'
import { getAdminFirestore } from '@/lib/firebase-admin'
import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  type AdvisoryDoc,
  type WeeklyReport,
  type WeeklyReportConfig,
} from '@/types/weekly-report'

/** Drive client for server routes — same credential order as /api/drive/upload. */
export function getServerDriveClient(userAccessToken?: string) {
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    return google.drive({ version: 'v3', auth: oauth2Client })
  }
  if (userAccessToken) {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: userAccessToken })
    return google.drive({ version: 'v3', auth: oauth2 })
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

const db = () => getAdminFirestore()

// Admin SDK Timestamps are structurally compatible for our use (toDate/toMillis); cast at the boundary.
export async function getWeekAdmin(weekId: string): Promise<WeeklyReport | null> {
  const snap = await db().collection('weeklyReports').doc(weekId).get()
  return snap.exists ? ({ id: snap.id, ...snap.data() } as unknown as WeeklyReport) : null
}

export async function listWeeksAdmin(): Promise<WeeklyReport[]> {
  const snap = await db().collection('weeklyReports').orderBy('meetingDate', 'asc').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as WeeklyReport)
}

export async function listAdvisoryByWeekIdsAdmin(weekIds: string[]): Promise<AdvisoryDoc[]> {
  const out: AdvisoryDoc[] = []
  for (let i = 0; i < weekIds.length; i += 30) {
    const chunk = weekIds.slice(i, i + 30)
    if (!chunk.length) continue
    const snap = await db().collection('advisoryDocs').where('weekId', 'in', chunk).get()
    snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() } as unknown as AdvisoryDoc))
  }
  return out
}

export async function listAdvisoryByDateRangeAdmin(from: string, to: string): Promise<AdvisoryDoc[]> {
  const snap = await db().collection('advisoryDocs').where('advisedDate', '>=', from).where('advisedDate', '<=', to).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as AdvisoryDoc)
}

export async function getConfigAdmin(): Promise<WeeklyReportConfig> {
  const snap = await db().collection('weeklyReportConfig').doc('main').get()
  return { ...DEFAULT_WEEKLY_REPORT_CONFIG, ...((snap.exists ? snap.data() : {}) as Partial<WeeklyReportConfig>) }
}

// ===== Shared builders for export + Cowork routes =====
import { resolvePeriod, weeksOfMonth } from '@/lib/weekly-report/period'
import type { MonthExportInput, WeekExportInput } from '@/lib/weekly-report/export/markdown'

export async function buildWeekInput(weekId: string, includeRichSections: boolean): Promise<WeekExportInput> {
  const [weeks, config, advisory] = await Promise.all([listWeeksAdmin(), getConfigAdmin(), listAdvisoryByWeekIdsAdmin([weekId])])
  const report = weeks.find((w) => w.id === weekId) ?? null
  const week = report ?? { ...resolvePeriod(weekId, weeks) }
  return { week, advisory, config, includeRichSections }
}

export async function buildMonthInput(month: string, includeRichSections: boolean): Promise<MonthExportInput> {
  const [weeks, config] = await Promise.all([listWeeksAdmin(), getConfigAdmin()])
  const periods = weeksOfMonth(month, weeks)
  const advisory = await listAdvisoryByWeekIdsAdmin(periods.map((p) => p.weekId))
  return {
    month,
    config,
    includeRichSections,
    weeks: periods.map((period) => ({
      period,
      report: weeks.find((w) => w.id === period.weekId) ?? null,
      advisory: advisory.filter((a) => a.weekId === period.weekId),
    })),
  }
}
