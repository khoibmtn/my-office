'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, User, Users, CheckCircle2, Clock, AlertCircle,
  TrendingUp, ArrowRight, ShieldCheck, UserCheck, BarChart3,
  Calendar, Layers, Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useTasks } from '@/hooks/useTasks'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { TaskDashboard } from '@/components/tasks/TaskDashboard'
import { TaskTable } from '@/components/tasks/TaskTable'

export default function DashboardPage() {
  const router = useRouter()
  const { staffId, staffName, isAdmin } = useRole()
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const { tasks: allTasks, loading } = useTasks({ view: 'all' })

  // View mode toggle: 'personal' (individual staff) vs 'manager' (lead/admin)
  const [viewMode, setViewMode] = useState<'personal' | 'manager'>(isAdmin ? 'manager' : 'personal')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all')

  // Top level active tasks (exclude subtasks from top-level counts)
  const topLevelTasks = useMemo(() => {
    return allTasks.filter(t => !t.parentTaskId && !t.deletedAt)
  }, [allTasks])

  const now = Date.now()

  // Dynamic global/manager stats
  const globalStats = useMemo(() => {
    return {
      id: 'dynamic',
      scope: 'global' as const,
      scopeId: 'all',
      pending: topLevelTasks.filter(t => t.status === 'pending').length,
      inProgress: topLevelTasks.filter(t => t.status === 'in_progress').length,
      blocked: topLevelTasks.filter(t => t.status === 'blocked').length,
      completed: topLevelTasks.filter(t => t.status === 'completed').length,
      cancelled: topLevelTasks.filter(t => t.status === 'cancelled').length,
      overdue: topLevelTasks.filter(t => {
        if (t.isClosed || !t.dueDate) return false
        const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
        return due < now
      }).length,
      completedThisWeek: topLevelTasks.filter(t => t.status === 'completed').length,
      completedThisMonth: topLevelTasks.filter(t => t.status === 'completed').length,
      updatedAt: null as any,
    }
  }, [topLevelTasks, now])

  // Personal tasks
  const personalTasks = useMemo(() => {
    if (!staffId) return []
    return topLevelTasks.filter(t =>
      t.assigneeId === staffId ||
      t.collaboratorIds?.includes(staffId)
    )
  }, [topLevelTasks, staffId])

  // Dynamic personal stats
  const personalStats = useMemo(() => {
    return {
      id: 'personal',
      scope: 'user' as const,
      scopeId: staffId || 'unknown',
      pending: personalTasks.filter(t => t.status === 'pending').length,
      inProgress: personalTasks.filter(t => t.status === 'in_progress').length,
      blocked: personalTasks.filter(t => t.status === 'blocked').length,
      completed: personalTasks.filter(t => t.status === 'completed').length,
      cancelled: personalTasks.filter(t => t.status === 'cancelled').length,
      overdue: personalTasks.filter(t => {
        if (t.isClosed || !t.dueDate) return false
        const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
        return due < now
      }).length,
      completedThisWeek: personalTasks.filter(t => t.status === 'completed').length,
      completedThisMonth: personalTasks.filter(t => t.status === 'completed').length,
      updatedAt: null as any,
    }
  }, [personalTasks, staffId, now])

  // Global overdue tasks
  const globalOverdueList = useMemo(() => {
    return topLevelTasks.filter(t => {
      if (t.isClosed || !t.dueDate) return false
      const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
      return due < now
    })
  }, [topLevelTasks, now])

  // Personal overdue tasks
  const personalOverdueList = useMemo(() => {
    return personalTasks.filter(t => {
      if (t.isClosed || !t.dueDate) return false
      const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
      return due < now
    })
  }, [personalTasks, now])

  // Personal active tasks
  const personalActiveTasks = useMemo(() => {
    return personalTasks.filter(t => !t.isClosed)
  }, [personalTasks])

  // Staff performance & workload aggregation for Manager view
  const staffWorkload = useMemo(() => {
    const activeStaff = staffList.filter(s => s.isActive)
    return activeStaff.map(s => {
      const assigned = topLevelTasks.filter(t => t.assigneeId === s.id)
      const total = assigned.length
      const inProgress = assigned.filter(t => t.status === 'in_progress').length
      const pending = assigned.filter(t => t.status === 'pending').length
      const blocked = assigned.filter(t => t.status === 'blocked').length
      const completed = assigned.filter(t => t.status === 'completed').length
      const overdue = assigned.filter(t => {
        if (t.isClosed || !t.dueDate) return false
        const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
        return due < now
      }).length

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
      const activeCount = inProgress + pending + blocked

      let workloadStatus: 'overload' | 'normal' | 'light' = 'normal'
      if (overdue > 0 || activeCount >= 8) {
        workloadStatus = 'overload'
      } else if (activeCount <= 1) {
        workloadStatus = 'light'
      }

      const deptId = s.primaryDepartmentId || (s.departmentIds && s.departmentIds[0])
      const dept = departments.find(d => d.id === deptId)?.name || 'Chưa xếp'

      return {
        staff: s,
        dept,
        total,
        inProgress,
        pending,
        blocked,
        completed,
        overdue,
        activeCount,
        completionRate,
        workloadStatus,
      }
    }).filter(item => {
      if (selectedDeptFilter === 'all') return true
      return (
        item.staff.primaryDepartmentId === selectedDeptFilter ||
        item.staff.departmentIds?.includes(selectedDeptFilter)
      )
    }).sort((a, b) => {
      // Prioritize staff with overdue or highest active tasks
      if (b.overdue !== a.overdue) return b.overdue - a.overdue
      return b.activeCount - a.activeCount
    })
  }, [staffList, topLevelTasks, departments, selectedDeptFilter, now])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with Role & View Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📊</span>
            {viewMode === 'personal' ? 'Tiến độ Công việc Cá nhân' : 'Báo cáo Quản lý & Giám sát Nhân sự'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {viewMode === 'personal'
              ? `Xin chào ${staffName || 'bạn'} • Theo dõi hiệu suất và danh sách công việc của riêng bạn`
              : 'Theo dõi tiến độ toàn đơn vị, đôn đốc công việc quá hạn và phân bổ khối lượng làm việc nhân sự'}
          </p>
        </div>

        {/* View Mode Toggle Button */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0 shadow-2xs">
          <button
            onClick={() => setViewMode('personal')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'personal'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Tiến độ cá nhân
          </button>
          <button
            onClick={() => setViewMode('manager')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'manager'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Quản lý nhân sự
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PERSONAL VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'personal' && (
        <div className="space-y-6">
          <TaskDashboard stats={personalStats} />

          {/* Personal Overdue tasks */}
          {personalOverdueList.length > 0 && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Công việc của bạn bị quá hạn ({personalOverdueList.length}) - Cần xử lý gấp!
              </h2>
              <div className="bg-white rounded-xl border border-red-200 shadow-2xs overflow-hidden">
                <TaskTable tasks={personalOverdueList} />
              </div>
            </div>
          )}

          {/* Personal Active Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Công việc của bạn đang tiến hành ({personalActiveTasks.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Các công việc bạn được giao xử lý hoặc phối hợp</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/tasks')}
                className="text-xs text-blue-600 hover:bg-blue-50"
              >
                Xem tất cả tại danh sách
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <TaskTable
                tasks={personalActiveTasks}
                emptyMessage="Tuyệt vời! Bạn không còn công việc nào đang chờ xử lý."
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANAGER VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'manager' && (
        <div className="space-y-6">
          <TaskDashboard stats={globalStats} />

          {/* Department Breakdown Cards */}
          {departments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {departments.map(dept => {
                const deptTasks = topLevelTasks.filter(t => t.departmentId === dept.id)
                const total = deptTasks.length
                const active = deptTasks.filter(t => !t.isClosed).length
                const completed = deptTasks.filter(t => t.status === 'completed').length
                const overdue = deptTasks.filter(t => {
                  if (t.isClosed || !t.dueDate) return false
                  const due = (t.dueDate as any).toMillis ? (t.dueDate as any).toMillis() : (t.dueDate as any).seconds * 1000
                  return due < now
                }).length
                const rate = total > 0 ? Math.round((completed / total) * 100) : 0

                return (
                  <div key={dept.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{dept.name}</h3>
                      {overdue > 0 && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                          {overdue} quá hạn
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                      <span>Tổng: <b className="text-slate-800">{total}</b></span>
                      <span>Đang làm: <b className="text-blue-600">{active}</b></span>
                      <span>Xong: <b className="text-emerald-600">{completed}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">{rate}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Department filter bar for workload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Bảng Theo dõi Tiến độ & Tải Công việc Nhân sự
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Giám sát khối lượng công việc, tỷ lệ hoàn thành và cảnh báo quá hạn của từng nhân viên
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDeptFilter}
                onChange={e => setSelectedDeptFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 font-medium"
              >
                <option value="all">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Workload Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Nhân sự</th>
                    <th className="py-3 px-3">Phòng ban</th>
                    <th className="py-3 px-3 text-center">Tổng việc</th>
                    <th className="py-3 px-3 text-center">Đang làm</th>
                    <th className="py-3 px-3 text-center">Quá hạn</th>
                    <th className="py-3 px-3 text-center">Hoàn thành</th>
                    <th className="py-3 px-4 w-40">Tiến độ hoàn thành</th>
                    <th className="py-3 px-3 text-center">Đánh giá tải</th>
                    <th className="py-3 px-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffWorkload.map(item => (
                    <tr key={item.staff.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Staff info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {item.staff.shortName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{item.staff.fullName}</div>
                            <div className="text-[11px] text-slate-400">@{item.staff.shortName}</div>
                          </div>
                        </div>
                      </td>

                      {/* Dept */}
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {item.dept}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {item.total}
                      </td>

                      {/* In Progress */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {item.inProgress}
                        </span>
                      </td>

                      {/* Overdue */}
                      <td className="py-3 px-3 text-center">
                        {item.overdue > 0 ? (
                          <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            {item.overdue}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Completed */}
                      <td className="py-3 px-3 text-center text-emerald-600 font-semibold">
                        {item.completed}
                      </td>

                      {/* Progress Bar & Rate */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.completionRate >= 80
                                  ? 'bg-emerald-500'
                                  : item.completionRate >= 50
                                  ? 'bg-blue-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${item.completionRate}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 min-w-[32px] text-right">
                            {item.completionRate}%
                          </span>
                        </div>
                      </td>

                      {/* Workload Status */}
                      <td className="py-3 px-3 text-center">
                        {item.workloadStatus === 'overload' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full">
                            ⚠️ Quá tải / Chậm
                          </span>
                        ) : item.workloadStatus === 'light' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            🟢 Sẵn sàng nhận việc
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            ✓ Bình thường
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/tasks?assigneeId=${item.staff.id}`)}
                          className="text-xs text-blue-600 hover:bg-blue-50 px-2 h-7"
                        >
                          Xem việc
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {staffWorkload.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Không tìm thấy nhân sự phù hợp
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue tasks toàn viện */}
          {globalOverdueList.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Danh sách công việc quá hạn toàn đơn vị cần đôn đốc ({globalOverdueList.length})
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/tasks')}
                  className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  Xử lý ngay
                </Button>
              </div>
              <div className="rounded-xl border border-red-100 overflow-hidden">
                <TaskTable tasks={globalOverdueList} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
