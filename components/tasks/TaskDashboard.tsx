'use client'

import React from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Clock, AlertCircle, Ban,
  TrendingUp, ArrowUp, Calendar,
} from 'lucide-react'
import type { ComputedTaskStats } from '@/lib/tasks/firestore'

interface TaskDashboardProps {
  stats: ComputedTaskStats | null
  assigneeId?: string
  includeCollaborator?: boolean
  departmentId?: string
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  color: string
  bgColor: string
  subtitle?: string
  href: string
}

export function buildTasksFilterHref(params: {
  status?: string
  assigneeId?: string
  includeCollaborator?: boolean
  departmentId?: string
}): string {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.assigneeId && params.assigneeId !== 'all') {
    sp.set('assigneeId', params.assigneeId)
    if (params.includeCollaborator) {
      sp.set('includeCollaborator', '1')
    }
  }
  if (params.departmentId && params.departmentId !== 'all') {
    sp.set('departmentId', params.departmentId)
  }
  const qs = sp.toString()
  return qs ? `/tasks?${qs}` : '/tasks'
}

function StatCard({ icon: Icon, label, value, color, bgColor, subtitle, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-blue-300 transition-all block group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-600">
            {label}
          </p>
          <p className={`text-3xl font-bold mt-1 ${color} group-hover:underline`}>{value}</p>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </Link>
  )
}

export function TaskDashboard({
  stats,
  assigneeId,
  includeCollaborator,
  departmentId,
}: TaskDashboardProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-20 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  const total = stats.total
  const completionRate = stats.completionRate

  return (
    <div className="space-y-6">
      {/* Khối thẻ chính: Quá hạn / Đến hạn 7 ngày / Đang thực hiện / Hoàn thành tuần */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={AlertCircle}
          label="Quá hạn"
          value={stats.overdue}
          color="text-red-600"
          bgColor="bg-red-50"
          subtitle={stats.overdue > 0 ? 'Cần xử lý ngay!' : 'Tốt lắm!'}
          href={buildTasksFilterHref({ status: 'overdue', assigneeId, includeCollaborator, departmentId })}
        />
        <StatCard
          icon={Calendar}
          label="Đến hạn 7 ngày"
          value={stats.dueIn7Days}
          color="text-amber-600"
          bgColor="bg-amber-50"
          subtitle="Sắp tới hạn trong 7 ngày"
          href={buildTasksFilterHref({ status: 'due7', assigneeId, includeCollaborator, departmentId })}
        />
        <StatCard
          icon={TrendingUp}
          label="Đang thực hiện"
          value={stats.inProgress}
          color="text-blue-600"
          bgColor="bg-blue-50"
          subtitle={`${stats.open} việc đang mở`}
          href={buildTasksFilterHref({ status: 'in_progress', assigneeId, includeCollaborator, departmentId })}
        />
        <StatCard
          icon={CheckCircle2}
          label="Hoàn thành tuần"
          value={stats.completedThisWeek}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          subtitle="Từ thứ Hai tuần này"
          href={buildTasksFilterHref({ status: 'done_week', assigneeId, includeCollaborator, departmentId })}
        />
      </div>

      {/* Thẻ phụ: Chờ xử lý / Bị chặn / Hoàn thành tháng / Tỷ lệ hoàn thành */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Chờ xử lý"
          value={stats.pending}
          color="text-slate-700"
          bgColor="bg-slate-100"
          href={buildTasksFilterHref({ status: 'pending', assigneeId, includeCollaborator, departmentId })}
        />
        <StatCard
          icon={Ban}
          label="Bị chặn"
          value={stats.blocked}
          color="text-red-500"
          bgColor="bg-red-50"
          href={buildTasksFilterHref({ status: 'blocked', assigneeId, includeCollaborator, departmentId })}
        />
        <StatCard
          icon={CheckCircle2}
          label="Hoàn thành tháng"
          value={stats.completedThisMonth}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          href={buildTasksFilterHref({ status: 'done_month', assigneeId, includeCollaborator, departmentId })}
        />
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tỷ lệ hoàn thành</p>
              <p className="text-3xl font-bold mt-1 text-violet-600">{completionRate}%</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-50">
              <ArrowUp className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phân bố trạng thái */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Phân bố trạng thái</h3>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
          {total > 0 && (
            <>
              {stats.pending > 0 && (
                <div className="bg-slate-400 transition-all" style={{ width: `${(stats.pending / total) * 100}%` }} title={`Chờ xử lý: ${stats.pending}`} />
              )}
              {stats.inProgress > 0 && (
                <div className="bg-blue-500 transition-all" style={{ width: `${(stats.inProgress / total) * 100}%` }} title={`Đang thực hiện: ${stats.inProgress}`} />
              )}
              {stats.blocked > 0 && (
                <div className="bg-red-500 transition-all" style={{ width: `${(stats.blocked / total) * 100}%` }} title={`Bị chặn: ${stats.blocked}`} />
              )}
              {stats.completed > 0 && (
                <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.completed / total) * 100}%` }} title={`Hoàn thành: ${stats.completed}`} />
              )}
              {stats.cancelled > 0 && (
                <div className="bg-gray-400 transition-all" style={{ width: `${(stats.cancelled / total) * 100}%` }} title={`Đã hủy: ${stats.cancelled}`} />
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {[
            { label: 'Chờ', value: stats.pending, color: 'bg-slate-400' },
            { label: 'Đang làm', value: stats.inProgress, color: 'bg-blue-500' },
            { label: 'Chặn', value: stats.blocked, color: 'bg-red-500' },
            { label: 'Xong', value: stats.completed, color: 'bg-emerald-500' },
            { label: 'Hủy', value: stats.cancelled, color: 'bg-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label}: {value}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
