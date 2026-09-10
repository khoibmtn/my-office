'use client'

import React from 'react'
import {
  CheckCircle2, Clock, AlertCircle, Ban,
  TrendingUp, ArrowUp, Calendar, Users,
} from 'lucide-react'
import type { TaskStats } from '@/types/tasks'

interface TaskDashboardProps {
  stats: TaskStats | null
  recentCompleted?: number
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  color: string
  bgColor: string
  subtitle?: string
}

function StatCard({ icon: Icon, label, value, color, bgColor, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  )
}

export function TaskDashboard({ stats, recentCompleted = 0 }: TaskDashboardProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-20 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  const total = stats.pending + stats.inProgress + stats.blocked + stats.completed + stats.cancelled
  const active = stats.pending + stats.inProgress + stats.blocked
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Chờ xử lý"
          value={stats.pending}
          color="text-slate-700"
          bgColor="bg-slate-100"
        />
        <StatCard
          icon={TrendingUp}
          label="Đang thực hiện"
          value={stats.inProgress}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={AlertCircle}
          label="Quá hạn"
          value={stats.overdue}
          color="text-red-600"
          bgColor="bg-red-50"
          subtitle={stats.overdue > 0 ? 'Cần xử lý ngay!' : 'Tốt lắm!'}
        />
        <StatCard
          icon={CheckCircle2}
          label="Hoàn thành tuần"
          value={stats.completedThisWeek}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Ban}
          label="Bị chặn"
          value={stats.blocked}
          color="text-red-500"
          bgColor="bg-red-50"
        />
        <StatCard
          icon={CheckCircle2}
          label="Hoàn thành tháng"
          value={stats.completedThisMonth}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          icon={Users}
          label="Tổng active"
          value={active}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
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
          {/* Mini progress bar */}
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status distribution */}
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
