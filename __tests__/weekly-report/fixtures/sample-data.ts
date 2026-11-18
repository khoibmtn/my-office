import type { Timestamp } from 'firebase/firestore'
import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  type AdvisoryDoc,
  type WeekPeriod,
  type WeeklyReport,
  type WeeklyReportConfig,
} from '@/types/weekly-report'

const FAKE_TS = {
  seconds: 1794528000,
  nanoseconds: 0,
  toDate: () => new Date('2026-11-13T00:00:00Z'),
  toMillis: () => 1794528000000,
  isEqual: () => false,
  toJSON: () => ({ seconds: 1794528000, nanoseconds: 0, type: 'timestamp' }),
  valueOf: () => '',
} as unknown as Timestamp

export const sampleConfig: WeeklyReportConfig = {
  ...DEFAULT_WEEKLY_REPORT_CONFIG,
}

export const sampleTiptapDocJson = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Nội dung tổng hợp' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Văn bản ' },
        { type: 'text', text: 'quan trọng', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' và ' },
        { type: 'text', text: 'lưu ý khẩn', marks: [{ type: 'redMark' }] },
        { type: 'text', text: ' kèm ' },
        { type: 'text', text: 'ghi chú nghiêng', marks: [{ type: 'italic' }] },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Đầu việc A' }] },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chi tiết A1' }] }],
                },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Đầu việc B' }] }],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước thứ nhất' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước thứ hai' }] }],
        },
      ],
    },
    {
      type: 'image',
      attrs: { src: '/api/weekly-reports/images/demo-img-01', alt: 'ảnh minh hoạ' },
    },
  ],
})

export const secretOpinionsJson = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'NOI_DUNG_Y_KIEN_BI_MAT cần kiểm tra tách biệt' }],
    },
  ],
})

export const secretNextWeekJson = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'NOI_DUNG_TUAN_TOI_BI_MAT dự kiến tuần sau' }],
    },
  ],
})

export const secretScheduleJson = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'NOI_DUNG_LICH_BI_MAT lịch họp dự kiến' }],
    },
  ],
})

export const secretDeputyJson = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'NOI_DUNG_PGD_BI_MAT ý kiến chỉ đạo nội bộ' }],
    },
  ],
})

export const samplePeriodsNov2026: WeekPeriod[] = [
  {
    weekId: '2026-11-06',
    meetingDate: '2026-11-06',
    periodStart: '2026-10-30',
    periodEnd: '2026-11-05',
    dayCount: 7,
  },
  {
    weekId: '2026-11-13',
    meetingDate: '2026-11-13',
    periodStart: '2026-11-06',
    periodEnd: '2026-11-12',
    dayCount: 7,
  },
  {
    weekId: '2026-11-20',
    meetingDate: '2026-11-20',
    periodStart: '2026-11-13',
    periodEnd: '2026-11-18',
    dayCount: 6,
  },
  {
    weekId: '2026-11-27',
    meetingDate: '2026-11-27',
    periodStart: '2026-11-19',
    periodEnd: '2026-11-26',
    dayCount: 8,
  },
  {
    weekId: '2026-12-04',
    meetingDate: '2026-12-04',
    periodStart: '2026-11-27',
    periodEnd: '2026-12-03',
    dayCount: 7,
  },
]

export const sampleWeek1: WeeklyReport = {
  id: '2026-11-06',
  meetingDate: '2026-11-06',
  actualMeetingDate: null,
  periodStart: '2026-10-30',
  periodEnd: '2026-11-05',
  periodOverridden: false,
  periodNote: '',
  reportMonth: '2026-11',
  reportMonthOverridden: false,
  status: 'finalized',
  finalizedAt: FAKE_TS,
  unitHeading: '1. KHTH',
  workItems: [
    {
      id: 'wi-1',
      text: 'Duy trì công tác chuyên môn thường xuyên theo kế hoạch giả lập',
      highlight: false,
      pinned: true,
      order: 0,
      source: 'manual',
      taskId: null,
      children: [
        {
          id: 'wi-1-c1',
          text: 'Tổng hợp số liệu định kỳ tuần giả lập số 1',
          highlight: false,
          order: 0,
        },
      ],
    },
  ],
  sections: {
    opinions: null,
    nextWeek: null,
    proposedSchedule: null,
    deputyOpinions: null,
  },
  statsSnapshotJson: null,
  statsFetchedAt: null,
  carriedFromWeekId: null,
  createdAt: FAKE_TS,
  updatedAt: FAKE_TS,
}

export const sampleWeek2DraftWithSecrets: WeeklyReport = {
  id: '2026-11-13',
  meetingDate: '2026-11-13',
  actualMeetingDate: null,
  periodStart: '2026-11-06',
  periodEnd: '2026-11-12',
  periodOverridden: false,
  periodNote: '',
  reportMonth: '2026-11',
  reportMonthOverridden: false,
  status: 'draft',
  finalizedAt: null,
  unitHeading: '1. KHTH',
  workItems: [
    {
      id: 'wi-2',
      text: 'Đảm bảo công việc thường xuyên giả lập',
      highlight: false,
      pinned: true,
      order: 0,
      source: 'carried',
      taskId: null,
      children: [],
    },
    {
      id: 'wi-3',
      text: 'Hoàn thiện báo cáo kiểm tra chuyên đề mẫu',
      highlight: true,
      pinned: false,
      order: 1,
      source: 'task',
      taskId: 'task-demo-99',
      children: [
        {
          id: 'wi-3-c1',
          text: 'Rà soát phụ lục mẫu số 02',
          highlight: true,
          order: 0,
        },
      ],
    },
  ],
  sections: {
    opinions: {
      docJson: secretOpinionsJson,
      plainText: 'NOI_DUNG_Y_KIEN_BI_MAT',
      updatedAt: FAKE_TS,
    },
    nextWeek: {
      docJson: secretNextWeekJson,
      plainText: 'NOI_DUNG_TUAN_TOI_BI_MAT',
      updatedAt: FAKE_TS,
    },
    proposedSchedule: {
      docJson: secretScheduleJson,
      plainText: 'NOI_DUNG_LICH_BI_MAT',
      updatedAt: FAKE_TS,
    },
    deputyOpinions: {
      docJson: secretDeputyJson,
      plainText: 'NOI_DUNG_PGD_BI_MAT',
      updatedAt: FAKE_TS,
    },
  },
  statsSnapshotJson: '{"rows":[{"label":"Chỉ tiêu giả lập","curr":42}]}',
  statsFetchedAt: FAKE_TS,
  carriedFromWeekId: '2026-11-06',
  createdAt: FAKE_TS,
  updatedAt: FAKE_TS,
}

export const sampleWeek3SpecialPeriod: WeeklyReport = {
  id: '2026-11-20',
  meetingDate: '2026-11-20',
  actualMeetingDate: '2026-11-18',
  periodStart: '2026-11-13',
  periodEnd: '2026-11-18',
  periodOverridden: true,
  periodNote: 'Họp sớm trước kỳ công tác giả lập',
  reportMonth: '2026-11',
  reportMonthOverridden: true,
  status: 'finalized',
  finalizedAt: FAKE_TS,
  unitHeading: '1. KHTH',
  workItems: [
    {
      id: 'wi-4',
      text: 'Chuẩn bị tài liệu họp sớm giả lập',
      highlight: false,
      pinned: false,
      order: 0,
      source: 'manual',
      taskId: null,
      children: [],
    },
  ],
  sections: {
    opinions: null,
    nextWeek: null,
    proposedSchedule: null,
    deputyOpinions: null,
  },
  statsSnapshotJson: null,
  statsFetchedAt: null,
  carriedFromWeekId: null,
  createdAt: FAKE_TS,
  updatedAt: FAKE_TS,
}

export const sampleAdvisoryWeek1: AdvisoryDoc[] = [
  {
    id: 'adv-1',
    type: 'CV',
    title: 'V/v triển khai công tác chuyên môn tháng 11 giả lập',
    docNumber: '101/KHTH-CV',
    advisedDate: '2026-11-02',
    weekId: '2026-11-06',
    weekIdOverridden: false,
    sourceDocumentIds: ['doc-src-1'],
    sourceSnapshot: [
      {
        id: 'doc-src-1',
        docNumber: '11/SYT-NVY',
        title: 'Văn bản hướng dẫn mẫu số 1',
        sender: 'Sở Y tế giả lập',
        issueDate: '2026-10-30',
      },
    ],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 0,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
  {
    id: 'adv-2',
    type: 'KH',
    title: 'Tổ chức tập huấn quy trình nội bộ giả lập',
    docNumber: '102/KHTH-KH',
    advisedDate: '2026-11-04',
    weekId: '2026-11-06',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 1,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
]

export const sampleAdvisoryWeek2: AdvisoryDoc[] = [
  {
    id: 'adv-3',
    type: 'TB',
    title: 'Về việc điều chỉnh lịch trực mẫu tuần 2',
    docNumber: '103/KHTH-TB',
    advisedDate: '2026-11-09',
    weekId: '2026-11-13',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: true,
    order: 0,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
  {
    id: 'adv-4',
    type: 'QD',
    title: 'Thành lập tổ rà soát hồ sơ mẫu',
    docNumber: '104/QĐ-BV',
    advisedDate: '2026-11-10',
    weekId: '2026-11-13',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 1,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
  {
    id: 'adv-5',
    type: 'TTr',
    title: 'Xin chủ trương mua sắm vật tư mẫu',
    docNumber: null,
    advisedDate: '2026-11-11',
    weekId: '2026-11-13',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 2,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
  {
    id: 'adv-6',
    type: 'KHAC',
    title: 'Biên bản làm việc tổng kết mẫu',
    docNumber: null,
    advisedDate: '2026-11-12',
    weekId: '2026-11-13',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 3,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
]

export const sampleAdvisoryWeek3: AdvisoryDoc[] = [
  {
    id: 'adv-7',
    type: 'CV',
    title: 'V/v đôn đốc hoàn thành chỉ tiêu tháng giả lập',
    docNumber: '105/KHTH-CV',
    advisedDate: '2026-11-16',
    weekId: '2026-11-20',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 0,
    taskId: null,
    createdAt: FAKE_TS,
    updatedAt: FAKE_TS,
  },
]

export const sampleMonthWeeksInput = [
  {
    period: samplePeriodsNov2026[0],
    report: sampleWeek1,
    advisory: sampleAdvisoryWeek1,
  },
  {
    period: samplePeriodsNov2026[1],
    report: sampleWeek2DraftWithSecrets,
    advisory: sampleAdvisoryWeek2,
  },
  {
    period: samplePeriodsNov2026[2],
    report: sampleWeek3SpecialPeriod,
    advisory: sampleAdvisoryWeek3,
  },
  {
    period: samplePeriodsNov2026[3],
    report: null,
    advisory: [],
  },
  {
    period: samplePeriodsNov2026[4],
    report: null,
    advisory: [],
  },
]
