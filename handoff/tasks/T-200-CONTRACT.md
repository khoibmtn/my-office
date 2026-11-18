# T-200 — Hợp đồng chung module Giao ban tuần (BẮT BUỘC tuân thủ)

Đọc: `docs/WEEKLY_REPORT_PLAN.md` (đặc biệt §4, §5, §6, §7, §12 và **§15 quyết định đã chốt — thắng mọi mục khác**), `types/weekly-report.ts` (kiểu dữ liệu — KHÔNG sửa, cần thêm gì thì ghi vào REPORT), `handoff/tasks/_RULES.md`.

Thư viện đã cài: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image` (v3), `docx` (v9). Không thêm gói khác.

## Chủ sở hữu file (mỗi file chỉ một gói sửa)

| File / thư mục | Gói |
|---|---|
| `types/weekly-report.ts`, `firestore.rules`, `app/(app)/layout.tsx`, `components/layout/MobileTabBar.tsx`, `app/api/weekly-reports/images/**`, `app/api/cowork/**`, `app/api/weekly-reports/export/**`, `app/api/bcsolieu/**`, `lib/cowork/**`, `lib/weekly-report/server.ts`, `lib/weekly-report/image-client.ts` | Claude chính |
| `lib/weekly-report/{period,advisory-format,outline,firestore}.ts`, `hooks/useWeeklyReport.ts`, `hooks/useAdvisoryDocs.ts`, `hooks/useWeeklyReportConfig.ts`, `hooks/useWeeks.ts`, `__tests__/weekly-report/{period,advisory-format,outline}.test.ts` | T-201 (Claude subagent) |
| `lib/weekly-report/export/**`, `__tests__/weekly-report/export*.test.ts`, `app/(app)/weekly-reports/monthly/**`, `components/weekly-report/MonthlySummary.tsx` | T-214 (Antigravity) |
| `app/(app)/weekly-reports/page.tsx`, `app/(app)/weekly-reports/[weekId]/**`, `app/(app)/weekly-reports/dev-preview/**`, `components/weekly-report/{WorkItemOutliner,RichEditor,RichViewer,WeekHeader,FinalizeBar,TaskSuggestions,ReadingView,WeeklyStatsPanel,PeriodEditDialog}.tsx`, `components/weekly-report/extensions/**` | T-220 (Antigravity) |
| `components/weekly-report/{AdvisoryForm,AdvisoryList,BulkPasteDialog,AdvisoryButton}.tsx`, `components/documents/DocumentAdvisorySection.tsx`, sửa nhỏ `components/documents/{DocumentTable,DocumentModal,DocumentViewer}.tsx`, `app/(app)/weekly-reports/advisory/**`, `app/(app)/settings/weekly-report/**` | T-213 (Antigravity) |
| `app/(app)/tasks/**`, `components/tasks/**`, `lib/tasks/**` | T-240 (Antigravity) |

## Chữ ký hàm (KHÔNG đổi tên/tham số; được thêm hàm phụ)

### `lib/weekly-report/period.ts` (thuần, không import firebase)
```ts
todayVN(now?: Date): ISODate                       // ngày hiện tại giờ VN (UTC+7)
addDays(d: ISODate, n: number): ISODate
diffDays(a: ISODate, b: ISODate): number           // b - a
dayOfWeek(d: ISODate): number                      // 0=CN … 5=T6, 6=T7
formatDMY(d: ISODate): string                      // 'dd/MM/yyyy'
formatDM(d: ISODate): string                       // 'dd/MM'
defaultMeetingDateFor(d: ISODate): ISODate         // Thứ 6 gần nhất SAU d (d là T6 → T6 tuần kế)
defaultPeriod(meetingDate: ISODate): WeekPeriod    // start = meeting-7, end = meeting-1
resolvePeriod(weekId: string, weeks: WeekPeriodInfo[]): WeekPeriod
  // tuần đã lưu → dùng kỳ đã lưu; chưa lưu → defaultPeriod nhưng periodStart = max(meeting-7, periodEnd của tuần đã lưu liền trước + 1)
weekIdForDate(d: ISODate, weeks?: WeekPeriodInfo[]): string
  // tuần đã lưu có [periodStart, periodEnd] chứa d → id đó; nếu không: id = defaultMeetingDateFor(d), rồi nếu tuần đã lưu id đó có periodEnd < d thì +7 (lặp)
currentWeekId(today: ISODate, weeks?: WeekPeriodInfo[]): string // T6 → today; ngày khác → weekIdForDate(today)
reportMonthFor(periodStart: ISODate, periodEnd: ISODate): YearMonth // đa số ngày; hoà → tháng của periodEnd
weeksOfMonth(month: YearMonth, weeks: WeekPeriodInfo[]): WeekPeriod[]
  // mọi tuần (đã lưu hoặc ảo theo mặc định) có reportMonth = month, tôn trọng ghi đè; sắp theo meetingDate
isBoundaryWeek(p: WeekPeriod): boolean             // kỳ trải 2 tháng
```

### `lib/weekly-report/advisory-format.ts` (thuần)
```ts
countByType(docs: Pick<AdvisoryDoc,'type'>[], types: DocTypeDef[]): Array<{ code: string; label: string; prefix: string; count: number }> // bỏ count 0, theo order
formatAdvisorySummary(docs: Pick<AdvisoryDoc,'type'>[], types: DocTypeDef[]): string
  // 'Tham mưu VB: 9 văn bản: 3 CV, 2 KH, 1 BC, 3 TB' ; 0 văn bản → 'Tham mưu VB: 0 văn bản'
formatAdvisoryLine(doc: Pick<AdvisoryDoc,'type'|'title'>): string // 'TB Về việc …' (prefix từ DOC_TYPE_PREFIX; KHAC → chỉ title)
parseBulkAdvisoryLines(text: string, types: DocTypeDef[]): Array<{ type: string; title: string; raw: string }>
  // mỗi dòng không rỗng một văn bản; bỏ ký tự đầu dòng '-', '•', '*', số thứ tự; nhận tiền tố KH, CV, BC, TB, QĐ/QD, GM, HD, PA, BB, 'Tờ trình'/'TTr', 'Báo cáo'→BC, 'V/v'/'Về việc'→CV (giữ 'V/v …' trong title); không nhận → KHAC
sortAdvisory<T extends Pick<AdvisoryDoc,'order'|'advisedDate'>>(docs: T[]): T[]
```

### `lib/weekly-report/outline.ts` (thuần) — reducer Mục 1
```ts
type OutlineAction =
  | { type: 'add'; afterId?: string; text?: string }
  | { type: 'addChild'; parentId: string; text?: string }
  | { type: 'update'; id: string; text: string }
  | { type: 'remove'; id: string }
  | { type: 'indent'; id: string } | { type: 'outdent'; id: string }
  | { type: 'moveUp'; id: string } | { type: 'moveDown'; id: string }
  | { type: 'toggleHighlight'; id: string } | { type: 'togglePinned'; id: string }
  | { type: 'replaceAll'; items: WorkItem[] }
outlineReducer(items: WorkItem[], action: OutlineAction): WorkItem[] // id con dùng cùng không gian id; order chuẩn hoá 0..n-1
newId(): string
carryPinned(prev: WorkItem[]): WorkItem[] // chỉ dòng pinned, không con, source 'carried', id mới
```

### `lib/weekly-report/firestore.ts` (client, firebase SDK như `lib/firestore.ts`)
Collections: `weeklyReports/{weekId}` (+ `snapshots`), `advisoryDocs`, `weeklyReportConfig/main`.
```ts
ensureWeek(weekId: string): Promise<{ report: WeeklyReport; created: boolean; carriedCount: number }> // transaction; kỳ = resolvePeriod; mang pinned từ tuần đã lưu gần nhất trước đó
subscribeWeek(weekId: string, cb: (r: WeeklyReport | null) => void): () => void
subscribeWeeks(cb: (weeks: WeeklyReport[]) => void): () => void          // orderBy meetingDate desc
listWeeks(): Promise<WeeklyReport[]>
updateWorkItems(weekId: string, items: WorkItem[]): Promise<void>
updateSection(weekId: string, key: RichSectionKey, section: { docJson: string; plainText: string } | null): Promise<void>
updateWeekMeta(weekId: string, patch: Partial<Pick<WeeklyReport,'actualMeetingDate'|'periodStart'|'periodEnd'|'periodOverridden'|'periodNote'|'reportMonth'|'reportMonthOverridden'|'unitHeading'>>): Promise<void>
  // nếu đổi kỳ mà reportMonth không ghi đè → tính lại reportMonth; đổi kỳ → tính lại weekId của advisoryDocs không ghi đè có advisedDate trong kỳ cũ/mới
saveStatsSnapshot(weekId: string, json: string): Promise<void>
finalizeWeek(weekId: string): Promise<void>   // snapshot reason 'finalize' + status finalized
reopenWeek(weekId: string): Promise<void>     // snapshot 'reopen' + draft
createAdvisoryDoc(input: AdvisoryDocInput, opts?: { markSourceCompleted?: boolean }): Promise<string>
  // weekId = input.weekId ?? weekIdForDate(advisedDate, listWeeks()); ghi arrayUnion advisoryDocIds lên documents/{sourceId}; markSourceCompleted → documents status 'completed', completedDate
updateAdvisoryDoc(id: string, patch: Partial<AdvisoryDocInput>): Promise<void> // đổi advisedDate → tính lại weekId nếu không ghi đè
deleteAdvisoryDoc(id: string): Promise<void>  // gỡ arrayRemove khỏi documents
subscribeAdvisoryByWeek(weekId: string, cb: (docs: AdvisoryDoc[]) => void): () => void
subscribeAdvisoryBySource(documentId: string, cb: (docs: AdvisoryDoc[]) => void): () => void
listAdvisoryByDateRange(from: ISODate, to: ISODate): Promise<AdvisoryDoc[]>
listAdvisoryByWeekIds(weekIds: string[]): Promise<AdvisoryDoc[]>
subscribeConfig(cb: (c: WeeklyReportConfig) => void): () => void  // thiếu doc → DEFAULT_WEEKLY_REPORT_CONFIG
saveConfig(patch: Partial<WeeklyReportConfig>): Promise<void>
```
Hooks: `useWeeklyReport(weekId)` → `{ report, loading, error, carriedCount }` (gọi ensureWeek một lần rồi subscribe); `useWeeks()` → `{ weeks, loading }`; `useAdvisoryDocs({ weekId } | { sourceDocumentId })` → `{ docs, loading }`; `useWeeklyReportConfig()` → `{ config, loading }`.

### Ảnh (Claude chính làm) — `lib/weekly-report/image-client.ts`
```ts
uploadWeeklyReportImage(file: File, ctx: { weekId: string; section: RichSectionKey }): Promise<{ url: string; imageId: string }>
```
(nén Canvas ≤2000px rồi POST `/api/weekly-reports/images`; url dạng `/api/weekly-reports/images/<fileId>`). Gói T-220 import hàm này; trong dev-preview có thể mock.

### Bộ xuất `lib/weekly-report/export/` (T-214, thuần — không import firebase client)
```ts
tiptapToMarkdown(docJson: string): string        // paragraph, heading, bulletList/orderedList, bold/italic, mark đỏ → **text**, image → ![ảnh](url)
tiptapToPlainText(docJson: string): string
weekToMarkdown(input: { week: WeeklyReport | WeekPeriod & Partial<WeeklyReport>; advisory: AdvisoryDoc[]; config: WeeklyReportConfig; includeRichSections: boolean }): string
monthToMarkdown(input: { month: YearMonth; weeks: Array<{ period: WeekPeriod; report: WeeklyReport | null; advisory: AdvisoryDoc[] }>; config: WeeklyReportConfig; includeRichSections: boolean }): string
  // định dạng như tom-tat: mỗi tuần "dd/MM/yyyy" → tiêu đề → "1. KHTH" → "Tình hình thực hiện nhiệm vụ tuần qua:" → gạch đầu dòng → "Tham mưu VB: …" → danh sách
buildWeekDocx(sameInputAsWeekToMarkdown): Promise<Buffer>
buildMonthDocx(sameInputAsMonthToMarkdown): Promise<Buffer>   // Times New Roman 14pt, dòng highlight màu đỏ
toCoworkWeek(input): CoworkWeek     // CHỈ Mục 1 (workItems) + advisory (Q4); có periodStart/End/Overridden/actualMeetingDate/periodNote/reportMonth/status
toCoworkMonth(input): CoworkMonth   // weeks[], advisoryDocs[], countsByType, total, warnings[] (WEEK_NOT_FINALIZED, WEEK_MISSING, MONTH_INCOMPLETE, BOUNDARY_WEEK, MONTH_OVERRIDDEN, PERIOD_OVERRIDDEN)
```
Kiểu `CoworkWeek`, `CoworkMonth` khai báo trong `lib/weekly-report/export/cowork.ts`.

## Quy ước UI (mọi gói UI)
Đọc `~/.claude/skills/ui-ux-chuan/reference/chuan-san.md` và `anti-pattern.md`. Chữ nội dung ≥16px (bản đọc 18–20px), vùng bấm ≥44px trên điện thoại, không giấu hành động sau hover, tô đỏ = đỏ + đậm, ngày `dd/MM/yyyy`, trạng thái rỗng nói lý do + việc nên làm, theo phong cách shadcn/Tailwind sẵn có trong `components/ui`. Chỉ admin (`useRole` → isAdmin) thấy module này.
