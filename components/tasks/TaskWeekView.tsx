'use client'

import React, { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useStaff } from '@/hooks/useStaff'
import { useOrganization } from '@/hooks/useOrganization'
import { buildTaskActorContext } from '@/lib/tasks/permissions'
import { changeTaskStatus } from '@/lib/tasks/mutations'
import {
  appendTaskToWeeklyReport,
  formatPeriodBanner,
  formatPeriodFullTooltip,
  groupTasksForWeeklyPeriod,
  timestampToVNDate,
} from '@/lib/tasks/weekly-bridge'
import { formatDMY } from '@/lib/weekly-report/period'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskStatusBadge } from './TaskStatusBadge'
import type { Task } from '@/types/tasks'
import type { ISODate, WeekPeriod, WeekPeriodInfo } from '@/types/weekly-report'

export interface TaskWeekViewProps {
  tasks: Task[]
  allTasks?: Task[]
  period: WeekPeriod
  weeks: WeekPeriodInfo[]
  actualMeetingDate?: ISODate | null
  isDefaultPeriod: boolean
  onPrevPeriod: () => void
  onNextPeriod: () => void
  onResetToCurrentPeriod: () => void
  now?: number
}

interface WeekNotice {
  type: 'success' | 'warning' | 'error'
  message: string
  weekId?: string
  actionTask?: Task
}

export function TaskWeekView({
  tasks,
  allTasks,
  period,
  weeks,
  actualMeetingDate,
  isDefaultPeriod,
  onPrevPeriod,
  onNextPeriod,
  onResetToCurrentPeriod,
  now = Date.now(),
}: TaskWeekViewProps) {
  const router = useRouter()
  const { isAdmin, staffId, staffName, role } = useRole()
  const { getStaffName } = useStaff()
  const { currentStaff, hasPermission } = useOrganization()

  const [completingId, setCompletingId] = useState<string | null>(null)
  const [bridgingId, setBridgingId] = useState<string | null>(null)
  const [justAddedMap, setJustAddedMap] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<WeekNotice | null>(null)
  const [showUnscheduled, setShowUnscheduled] = useState(false)

  const actorCtx = useMemo(
    () =>
      buildTaskActorContext({
        staffId,
        staffName,
        role,
        isAdmin,
        currentStaff,
        hasPermission,
      }),
    [staffId, staffName, role, isAdmin, currentStaff, hasPermission]
  )

  const subtasksByParentId = useMemo(() => {
    const source = allTasks ?? tasks
    const grouped: Record<string, Task[]> = {}
    for (const t of source) {
      if (t.parentTaskId && !t.deletedAt) {
        if (!grouped[t.parentTaskId]) grouped[t.parentTaskId] = []
        grouped[t.parentTaskId].push(t)
      }
    }
    return grouped
  }, [allTasks, tasks])

  const groups = useMemo(
    () => groupTasksForWeeklyPeriod(tasks, period, now),
    [tasks, period, now]
  )

  const resolveAssignee = useCallback(
    (task: Task) => {
      if (task.assigneeName) return task.assigneeName
      if (task.assigneeId) return getStaffName(task.assigneeId) || task.assigneeId
      return 'Chưa giao'
    },
    [getStaffName]
  )

  const handleAppendToWeekly = async (task: Task) => {
    if (bridgingId) return
    setBridgingId(task.id)
    setNotice(null)
    try {
      const res = await appendTaskToWeeklyReport(task, {
        weekId: period.weekId,
        weeks,
      })
      if (res.ok) {
        setJustAddedMap((prev) => ({ ...prev, [task.id]: res.weekId }))
        setNotice({
          type: 'success',
          message: res.message,
          weekId: res.weekId,
        })
      } else {
        setNotice({
          type: 'warning',
          message: res.message,
          weekId: res.weekId,
        })
      }
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể đưa công việc vào giao ban',
      })
    } finally {
      setBridgingId(null)
    }
  }

  const handleCompleteTask = async (task: Task) => {
    if (completingId) return
    setCompletingId(task.id)
    setNotice(null)
    try {
      await changeTaskStatus(task.id, 'completed', actorCtx.actor, {
        autoStartFromPending: true,
        subtasks: subtasksByParentId[task.id],
      })
      setNotice({
        type: 'success',
        message: `Đã hoàn thành "${task.title}"`,
        weekId: period.weekId,
        actionTask: isAdmin ? task : undefined,
      })
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể hoàn thành công việc',
      })
    } finally {
      setCompletingId(null)
    }
  }

  const totalMainCount =
    groups.overdue.length + groups.dueInPeriod.length + groups.completedInPeriod.length

  const renderOpenTaskRow = (task: Task, variant: 'overdue' | 'due' | 'unscheduled') => {
    const dueVN = timestampToVNDate(task.dueDate)
    const isBlocked = task.status === 'blocked'
    const isCompleting = completingId === task.id

    return (
      <div
        key={task.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 bg-white hover:bg-slate-50/70 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-2 flex-wrap">
            <Link
              href={`/tasks/${task.id}`}
              onMouseEnter={() => router.prefetch(`/tasks/${task.id}`)}
              className="text-base font-medium text-slate-900 hover:text-blue-600 transition-colors break-words leading-snug"
            >
              {task.title}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} size="sm" showLabel />
            <span className="inline-flex items-center gap-1 text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {resolveAssignee(task)}
            </span>
            {dueVN ? (
              <span
                className={`inline-flex items-center gap-1 ${
                  variant === 'overdue'
                    ? 'text-red-700 font-bold'
                    : 'text-slate-600 font-medium'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                Hạn {formatDMY(dueVN)}
              </span>
            ) : (
              <span className="text-slate-400">Chưa đặt hạn</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-end">
          {isBlocked ? (
            <Link
              href={`/tasks/${task.id}`}
              className="inline-flex items-center justify-center min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              Mở gỡ chặn
            </Link>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isCompleting}
              onClick={() => handleCompleteTask(task)}
              className="min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-3.5 border-emerald-200 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-800 text-sm font-medium"
            >
              {isCompleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Hoàn thành
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Period navigation bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onPrevPeriod}
            aria-label="Kỳ trước"
            title="Kỳ trước"
            className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-9 sm:h-9 sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shrink-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 px-1.5">
            <div
              className="text-base font-semibold text-slate-900 truncate"
              title={formatPeriodFullTooltip(period, actualMeetingDate)}
            >
              {formatPeriodBanner(period, actualMeetingDate)}
            </div>
            <div className="text-xs text-slate-500">
              {formatPeriodFullTooltip(period, actualMeetingDate)}
            </div>
          </div>

          <button
            type="button"
            onClick={onNextPeriod}
            aria-label="Kỳ sau"
            title="Kỳ sau"
            className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-9 sm:h-9 sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shrink-0 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isDefaultPeriod && (
            <button
              type="button"
              onClick={onResetToCurrentPeriod}
              className="min-h-[44px] h-11 sm:h-9 sm:min-h-[36px] px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              Kỳ hiện tại
            </button>
          )}
          {isAdmin && (
            <Link
              href={`/weekly-reports/${period.weekId}`}
              className="inline-flex items-center gap-1.5 min-h-[44px] h-11 sm:h-9 sm:min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 text-sm font-medium transition-colors"
            >
              <span>Trang Giao ban tuần</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Non-blocking status / bridge banner */}
      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notice.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium break-words">{notice.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            {notice.actionTask && isAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleAppendToWeekly(notice.actionTask!)}
                disabled={bridgingId === notice.actionTask.id}
                className="min-h-[44px] h-11 sm:h-8 sm:min-h-[34px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Đưa vào giao ban
              </Button>
            )}
            {notice.type === 'warning' && notice.weekId && (
              <Link
                href={`/weekly-reports/${notice.weekId}`}
                className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
              >
                Mở trang Giao ban tuần
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            {notice.type === 'success' && !notice.actionTask && notice.weekId && (
              <Link
                href={`/weekly-reports/${notice.weekId}`}
                className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-sm font-medium transition-colors"
              >
                Xem giao ban
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setNotice(null)}
              className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-lg hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Overall empty guidance if nothing in period */}
      {totalMainCount === 0 && groups.unscheduledOpen.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-2">
          <p className="text-base font-semibold text-slate-800">
            Kỳ {formatPeriodBanner(period, actualMeetingDate)} chưa có công việc nào
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Nhập tiêu đề công việc vào ô thêm nhanh phía trên và nhấn Enter (hạn mặc định cuối kỳ{' '}
            {formatDMY(period.periodEnd)}), hoặc chuyển sang tab Danh sách để xem toàn bộ công việc.
          </p>
        </div>
      )}

      {/* Group 1: Quá hạn */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                groups.overdue.length > 0 ? 'text-red-600' : 'text-slate-400'
              }`}
            />
            <h2 className="text-base font-semibold text-slate-900">Quá hạn</h2>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs tabular-nums ${
              groups.overdue.length > 0
                ? 'bg-red-100 text-red-700 font-bold border border-red-200'
                : 'bg-slate-200/80 text-slate-600 font-medium'
            }`}
          >
            {groups.overdue.length}
          </span>
        </div>

        {groups.overdue.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">Không có công việc quá hạn.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.overdue.map((task) => renderOpenTaskRow(task, 'overdue'))}
          </div>
        )}
      </section>

      {/* Group 2: Đến hạn trong kỳ */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">Đến hạn trong kỳ</h2>
            <span className="text-xs text-slate-500">
              ({formatDMY(period.periodStart)} – {formatDMY(period.periodEnd)})
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums bg-blue-100 text-blue-700">
            {groups.dueInPeriod.length}
          </span>
        </div>

        {groups.dueInPeriod.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            Chưa có công việc đến hạn trong kỳ này. Gõ tiêu đề vào ô thêm nhanh phía trên và nhấn
            Enter để tạo việc mới.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.dueInPeriod.map((task) => renderOpenTaskRow(task, 'due'))}
          </div>
        )}
      </section>

      {/* Group 3: Đã xong trong kỳ */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">Đã xong trong kỳ</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums bg-emerald-100 text-emerald-700">
            {groups.completedInPeriod.length}
          </span>
        </div>

        {groups.completedInPeriod.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            Chưa có việc hoàn thành trong kỳ này. Khi hoàn thành việc, bấm &ldquo;Đưa vào giao
            ban&rdquo; tại đây để chuyển sang báo cáo tuần.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.completedInPeriod.map((task) => {
              const completedVN = timestampToVNDate(task.completedAt ?? task.updatedAt)
              const addedWeekId = justAddedMap[task.id] || task.weeklyReportWeekId || null
              const isInCurrentWeekReport = addedWeekId === period.weekId
              const isBridging = bridgingId === task.id

              return (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 bg-white hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={`/tasks/${task.id}`}
                      onMouseEnter={() => router.prefetch(`/tasks/${task.id}`)}
                      className="text-base font-medium text-slate-800 hover:text-blue-600 transition-colors break-words leading-snug block"
                    >
                      {task.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {resolveAssignee(task)}
                      </span>
                      {completedVN && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Xong {formatDMY(completedVN)}
                        </span>
                      )}
                      {addedWeekId && addedWeekId !== period.weekId && (
                        <span className="text-xs text-slate-500">
                          Đã đưa vào tuần {formatDMY(addedWeekId)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {isInCurrentWeekReport ? (
                        <Link
                          href={`/weekly-reports/${period.weekId}`}
                          className="inline-flex items-center gap-1.5 min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-colors"
                        >
                          <Check className="w-4 h-4 shrink-0" />
                          <span>Đã trong giao ban</span>
                        </Link>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBridging}
                          onClick={() => handleAppendToWeekly(task)}
                          className="min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                        >
                          {isBridging ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          ) : (
                            <Send className="w-4 h-4 mr-1.5" />
                          )}
                          Đưa vào giao ban
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Optional Group: Việc chưa đặt hạn */}
      {groups.unscheduledOpen.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setShowUnscheduled((v) => !v)}
            aria-expanded={showUnscheduled}
            className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              {showUnscheduled ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
              <span className="text-base font-semibold text-slate-800">Việc chưa đặt hạn</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-slate-200 text-slate-700">
              {groups.unscheduledOpen.length}
            </span>
          </button>

          {showUnscheduled && (
            <div className="divide-y divide-slate-100 border-t border-slate-200">
              {groups.unscheduledOpen.map((task) => renderOpenTaskRow(task, 'unscheduled'))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
