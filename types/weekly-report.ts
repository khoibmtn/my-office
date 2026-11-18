/**
 * Weekly report ("Giao ban tuần") — shared data contract.
 * See docs/WEEKLY_REPORT_PLAN.md §4, §5 and §15 (decisions win over earlier sections).
 *
 * All calendar dates are Vietnam-local strings 'YYYY-MM-DD' (never JS Date in local tz),
 * because the server runs in UTC. Months are 'YYYY-MM'.
 */
import type { Timestamp } from 'firebase/firestore'

export type ISODate = string // 'YYYY-MM-DD'
export type YearMonth = string // 'YYYY-MM'

// ===== Period =====

/** Minimal shape needed by the pure period functions (subset of WeeklyReport). */
export interface WeekPeriodInfo {
  id: string // weekId = nominal Friday meetingDate
  meetingDate: ISODate
  periodStart: ISODate
  periodEnd: ISODate
  periodOverridden: boolean
  reportMonth: YearMonth
  reportMonthOverridden: boolean
}

export interface WeekPeriod {
  weekId: string
  meetingDate: ISODate // nominal Friday
  periodStart: ISODate
  periodEnd: ISODate
  dayCount: number
}

// ===== Weekly report =====

export interface WorkItemChild {
  id: string
  text: string
  highlight: boolean
  order: number
}

export interface WorkItem {
  id: string
  text: string
  highlight: boolean // red line (render red + bold)
  pinned: boolean // recurring routine work, carried to next week
  order: number
  source: 'manual' | 'carried' | 'task' | 'import'
  taskId: string | null
  children: WorkItemChild[]
}

export interface RichSection {
  docJson: string // Tiptap JSON, stored as STRING
  plainText: string
  updatedAt: Timestamp | null
}

export type RichSectionKey = 'opinions' | 'nextWeek' | 'proposedSchedule' | 'deputyOpinions'

export const RICH_SECTION_LABELS: Record<RichSectionKey, string> = {
  opinions: '2. Ý kiến',
  nextWeek: '3. Tuần tới',
  proposedSchedule: 'Đề xuất lịch tuần tới',
  deputyOpinions: 'Ý kiến PGĐ Khôi',
}

export type WeeklyReportStatus = 'draft' | 'finalized'

export interface WeeklyReport extends WeekPeriodInfo {
  actualMeetingDate: ISODate | null // meeting moved (e.g. before Tết)
  periodNote: string // e.g. 'Họp sớm trước nghỉ Tết' — shown to Cowork
  status: WeeklyReportStatus
  finalizedAt: Timestamp | null

  unitHeading: string // '1. KHTH'
  workItems: WorkItem[] // Mục 1
  sections: {
    opinions: RichSection | null
    nextWeek: RichSection | null
    proposedSchedule: RichSection | null
    deputyOpinions: RichSection | null
  }
  statsSnapshotJson: string | null // bcsolieu numbers captured on demand / finalize
  statsFetchedAt: Timestamp | null
  carriedFromWeekId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface WeeklyReportSnapshot {
  id: string
  createdAt: Timestamp
  reason: 'finalize' | 'reopen' | 'manual'
  payloadJson: string
}

// ===== Advisory documents (văn bản đã tham mưu) =====

export interface AdvisorySourceSnapshot {
  id: string
  docNumber: string
  title: string
  sender: string
  issueDate: ISODate | null
}

export interface AdvisoryDoc {
  id: string
  type: string // code from config.docTypes, e.g. 'KH' | 'CV' | 'BC' | 'TB' | 'QD' | 'TTr' | 'KHAC'
  title: string // WITHOUT type prefix
  docNumber: string | null
  advisedDate: ISODate
  weekId: string // = weekIdForDate(advisedDate, weeks) unless overridden
  weekIdOverridden: boolean
  sourceDocumentIds: string[]
  sourceSnapshot: AdvisorySourceSnapshot[]
  draftLink: string | null
  draftDriveFileId: string | null
  note: string
  highlight: boolean
  order: number
  taskId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type AdvisoryDocInput = Omit<AdvisoryDoc, 'id' | 'createdAt' | 'updatedAt' | 'weekId' | 'weekIdOverridden' | 'order'> & {
  weekId?: string // if given => weekIdOverridden = true
  order?: number
}

// ===== Config =====

export interface DocTypeDef {
  code: string
  label: string // 'Kế hoạch'
  order: number
}

export interface WeeklyReportConfig {
  docTypes: DocTypeDef[]
  monthRule: 'majority'
  unitHeading: string
  reportTitle: string
  deputySectionLabel: string
}

export const DEFAULT_DOC_TYPES: DocTypeDef[] = [
  { code: 'CV', label: 'Công văn', order: 1 },
  { code: 'KH', label: 'Kế hoạch', order: 2 },
  { code: 'BC', label: 'Báo cáo', order: 3 },
  { code: 'TB', label: 'Thông báo', order: 4 },
  { code: 'QD', label: 'Quyết định', order: 5 },
  { code: 'TTr', label: 'Tờ trình', order: 6 },
  { code: 'GM', label: 'Giấy mời', order: 7 },
  { code: 'HD', label: 'Hướng dẫn', order: 8 },
  { code: 'PA', label: 'Phương án', order: 9 },
  { code: 'BB', label: 'Biên bản', order: 10 },
  { code: 'CB', label: 'Công bố', order: 11 },
  { code: 'KHAC', label: 'Khác', order: 99 },
]

/** Display prefix per type code (as written in the Google Doc). */
export const DOC_TYPE_PREFIX: Record<string, string> = {
  CV: 'CV', KH: 'KH', BC: 'BC', TB: 'TB', QD: 'QĐ', TTr: 'Tờ trình', GM: 'GM', HD: 'HD', PA: 'PA', BB: 'BB', CB: 'CB', KHAC: '',
}

export const DEFAULT_WEEKLY_REPORT_CONFIG: WeeklyReportConfig = {
  docTypes: DEFAULT_DOC_TYPES,
  monthRule: 'majority',
  unitHeading: '1. KHTH',
  reportTitle: 'Báo cáo giao ban Lãnh đạo tuần',
  deputySectionLabel: 'Ý kiến PGĐ Khôi',
}

/** Plain-language rule text, exposed to Cowork via /api/cowork/v1/catalog. */
export const PERIOD_RULES_TEXT = [
  'Ngày giao ban mặc định là Thứ 6. Kỳ tuần = Thứ 6 tuần trước → hết Thứ 5 tuần này. weekId = ngày Thứ 6 giao ban danh nghĩa (YYYY-MM-DD).',
  'Tuần đặc biệt (nghỉ lễ/Tết): giao ban có thể họp sớm; khi đó kỳ = ngày sau kỳ trước kết thúc → ngày báo cáo (periodOverridden = true, actualMeetingDate, periodNote). Tuần kế tiếp bắt đầu ngay sau periodEnd của tuần trước nên có thể dài hơn 7 ngày.',
  'Luôn dùng periodStart/periodEnd của từng tuần, không tự suy ra từ weekId.',
  'Mỗi tuần thuộc đúng một tháng báo cáo (reportMonth): tháng chứa đa số ngày của kỳ; hoà thì lấy tháng của periodEnd; có thể bị ghi đè tay (reportMonthOverridden). Không bao giờ tính một tuần cho hai tháng.',
  'Văn bản tham mưu thuộc tuần có kỳ chứa ngày tham mưu (advisedDate), trừ khi weekIdOverridden.',
]
